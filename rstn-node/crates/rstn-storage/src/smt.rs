//! Sparse Merkle Tree (SMT) for incremental state root computation (M3).
//!
//! The legacy `compute_state_root` iterates EVERY account every block — O(N)
//! per block, unviable at 250K TPS with millions of accounts. This module
//! implements a proper Sparse Merkle Tree with:
//!
//! - 256-bit keys (Keccak-512 of the 20-byte address, truncated to 32 bytes)
//! - Keccak-512 internal node hashing (domain-separated leaves vs. nodes)
//! - Default-zero subtrees: an empty subtree hashes to a precomputed
//!   constant, so we only store nodes along the paths to non-empty leaves.
//!   Update/proof cost is O(log N) = O(256) per changed account.
//! - Persisted intermediate nodes in a sled tree so the tree survives
//!   restarts and is shared across block production.
//!
//! The SMT is OPTIONAL: the legacy full-scan root remains available as a
//! correctness cross-check. The SMT root is byte-identical to the full-scan
//! root only when both use the same leaf/empty conventions; the SMT is the
//! production path, the full scan is the audit fallback.

use sha3::{Digest, Keccak512};
use std::collections::HashMap;

/// Hash size (Keccak-512 = 64 bytes). Internal nodes and the root are 64 bytes.
pub const NODE_HASH_SIZE: usize = 64;
/// Tree depth: 256 bits => 256 levels. Keys are 32 bytes.
pub const TREE_DEPTH: usize = 256;

/// Domain-separated leaf hash: keccak512(0x00 || key || value).
/// The leading 0x00 tag prevents a leaf hash from colliding with an internal
/// node hash (which is tagged 0x01).
fn hash_leaf(key: &[u8; 32], value: &[u8]) -> [u8; NODE_HASH_SIZE] {
    let mut h = Keccak512::new();
    h.update([0x00]);
    h.update(key);
    h.update(value);
    let mut out = [0u8; NODE_HASH_SIZE];
    out.copy_from_slice(&h.finalize());
    out
}

/// Domain-separated internal node hash: keccak512(0x01 || left || right).
fn hash_node(left: &[u8; NODE_HASH_SIZE], right: &[u8; NODE_HASH_SIZE]) -> [u8; NODE_HASH_SIZE] {
    let mut h = Keccak512::new();
    h.update([0x01]);
    h.update(left);
    h.update(right);
    let mut out = [0u8; NODE_HASH_SIZE];
    out.copy_from_slice(&h.finalize());
    out
}

/// Precomputed default hash for an empty subtree at each depth.
/// `DEFAULT_HASHES[d]` is the hash of an empty subtree of depth `d`
/// (i.e. `2^d` empty leaves). `DEFAULT_HASHES[0]` is the hash of a single
/// empty leaf.
fn default_hashes() -> Vec<[u8; NODE_HASH_SIZE]> {
    let mut v: Vec<[u8; NODE_HASH_SIZE]> = Vec::with_capacity(TREE_DEPTH + 1);
    // Depth 0: empty leaf hash. We use a leaf with an empty value.
    v.push(hash_leaf(&[0u8; 32], &[]));
    for d in 1..=TREE_DEPTH {
        let prev = v[d - 1];
        v.push(hash_node(&prev, &prev));
    }
    v
}

/// A node key in the persisted tree: the path bits from the root down to (but
/// not including) the node's level, packed into a Vec<u8> with a known depth.
/// We store nodes keyed by (depth, path) so lookups are O(1).
fn node_key(depth: usize, path_bits: &[u8]) -> Vec<u8> {
    // path_bits length == depth (one bit per level descended). Pack into
    // bytes, MSB-first, then prefix with depth for namespacing.
    let mut out = Vec::with_capacity(1 + (depth + 7) / 8);
    out.push(depth as u8);
    let mut byte = 0u8;
    let mut bit_count = 0;
    for &b in path_bits {
        byte = (byte << 1) | (b & 1);
        bit_count += 1;
        if bit_count == 8 {
            out.push(byte);
            byte = 0;
            bit_count = 0;
        }
    }
    if bit_count > 0 {
        byte <<= 8 - bit_count;
        out.push(byte);
    }
    out
}

/// A Sparse Merkle Tree backed by a sled tree for persisted intermediate nodes.
///
/// In-memory cache of dirty/updated nodes is flushed to sled on `flush`.
/// Reads fall back to sled for nodes not in the cache.
pub struct SparseMerkleTree<'a> {
    /// sled tree storing persisted node hashes: node_key -> 64-byte hash.
    db: &'a sled::Tree,
    /// In-memory overlay of node hashes (uncommitted). path-bytes (Vec<u8>)
    /// -> hash. Using a HashMap keyed by the packed node_key bytes.
    overlay: HashMap<Vec<u8>, [u8; NODE_HASH_SIZE]>,
    /// Cached default hashes per depth.
    defaults: Vec<[u8; NODE_HASH_SIZE]>,
    /// Current root (cached). None = not computed yet this session.
    root: Option<[u8; NODE_HASH_SIZE]>,
}

impl<'a> SparseMerkleTree<'a> {
    /// Open the SMT over an existing sled tree (e.g. `db.open_tree("smt")`).
    /// The tree must already be opened by the caller.
    pub fn new(db: &'a sled::Tree) -> Self {
        Self {
            db,
            overlay: HashMap::new(),
            defaults: default_hashes(),
            root: None,
        }
    }

    /// The hash of an empty subtree at `depth` (default-zero optimization).
    fn empty_hash(&self, depth: usize) -> [u8; NODE_HASH_SIZE] {
        self.defaults[depth]
    }

    /// Read a node hash at (depth, path), checking the overlay first, then sled.
    fn get_node(&self, depth: usize, path: &[u8]) -> [u8; NODE_HASH_SIZE] {
        let key = node_key(depth, path);
        if let Some(h) = self.overlay.get(&key) {
            return *h;
        }
        if let Ok(Some(v)) = self.db.get(&key) {
            if v.len() == NODE_HASH_SIZE {
                let mut out = [0u8; NODE_HASH_SIZE];
                out.copy_from_slice(&v);
                return out;
            }
        }
        // Not stored => empty subtree at this depth.
        self.empty_hash(depth)
    }

    /// Write a node hash to the in-memory overlay.
    fn set_node(&mut self, depth: usize, path: &[u8], hash: [u8; NODE_HASH_SIZE]) {
        let key = node_key(depth, path);
        self.overlay.insert(key, hash);
    }

    /// Update (or insert) a leaf and recompute the path to the root.
    /// `value` is the serialized account state bytes.
    /// O(TREE_DEPTH) = O(256) hash operations.
    pub fn update(&mut self, key: [u8; 32], value: &[u8]) {
        let leaf = hash_leaf(&key, value);
        let mut path: Vec<u8> = Vec::with_capacity(TREE_DEPTH);
        // Walk down from the root, tracking the path bits (MSB of key first).
        for depth in 0..TREE_DEPTH {
            let bit = (key[depth / 8] >> (7 - (depth % 8))) & 1;
            // Set the leaf at the bottom.
            if depth == TREE_DEPTH - 1 {
                self.set_node(TREE_DEPTH, &path, leaf);
            }
            path.push(bit);
        }
        // Now recompute bottom-up.
        // Collect bits first.
        let mut bits = Vec::with_capacity(TREE_DEPTH);
        for depth in 0..TREE_DEPTH {
            bits.push((key[depth / 8] >> (7 - (depth % 8))) & 1);
        }
        // Current child hash, starting from the leaf.
        let mut child_hash = leaf;
        let mut child_path: Vec<u8> = Vec::new();
        for depth in (0..TREE_DEPTH).rev() {
            let bit = bits[depth];
            // The node at this depth has children: `child` (along `bit`) and
            // the sibling (along `1 - bit`).
            // Sibling is at the same parent (path = first `depth` bits) with
            // the opposite bit. child_path has length `depth+1`; the parent
            // path is the first `depth` bits.
            let parent_path: Vec<u8> = child_path[..depth].to_vec();
            let mut sibling_path = parent_path.clone();
            sibling_path.push(1 - bit);
            let sibling_hash = self.get_node(depth + 1, &sibling_path);
            let (left, right) = if bit == 0 {
                (child_hash, sibling_hash)
            } else {
                (sibling_hash, child_hash)
            };
            let node = hash_node(&left, &right);
            self.set_node(depth, &parent_path, node);
            child_hash = node;
            child_path = parent_path;
        }
        self.root = Some(child_hash);
    }

    /// The current root. If no updates happened this session, returns the
    /// persisted root or the empty-tree root.
    pub fn root(&mut self) -> [u8; NODE_HASH_SIZE] {
        if let Some(r) = self.root {
            return r;
        }
        // Try to read the persisted root (depth 0, empty path).
        let r = self.get_node(0, &[]);
        self.root = Some(r);
        r
    }

    /// Flush the in-memory overlay to sled.
    pub fn flush(&self) -> Result<(), sled::Error> {
        let mut batch = sled::Batch::default();
        for (k, v) in &self.overlay {
            batch.insert(k.clone(), v.to_vec());
        }
        self.db.apply_batch(batch)?;
        Ok(())
    }

    /// Whether the in-memory overlay has uncommitted changes.
    pub fn is_dirty(&self) -> bool {
        !self.overlay.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_tree() -> sled::Tree {
        let dir = std::env::temp_dir().join(format!(
            "rstn-smt-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now().elapsed().unwrap().as_nanos()
        ));
        let db = sled::open(dir).unwrap();
        db.open_tree("smt").unwrap()
    }

    #[test]
    fn empty_tree_has_default_root() {
        let tree = temp_tree();
        let mut smt = SparseMerkleTree::new(&tree);
        let root = smt.root();
        // Empty root == default hash at depth TREE_DEPTH.
        let defaults = default_hashes();
        assert_eq!(root, defaults[TREE_DEPTH]);
    }

    #[test]
    fn single_update_changes_root() {
        let tree = temp_tree();
        let mut smt = SparseMerkleTree::new(&tree);
        let empty = smt.root();
        smt.update([0xaa; 32], b"account-data");
        let after = smt.root();
        assert_ne!(after, empty, "root must change after an update");
    }

    #[test]
    fn different_keys_different_roots() {
        let tree1 = temp_tree();
        let mut a = SparseMerkleTree::new(&tree1);
        a.update([0x01; 32], b"x");
        let tree2 = temp_tree();
        let mut b = SparseMerkleTree::new(&tree2);
        b.update([0x02; 32], b"x");
        assert_ne!(a.root(), b.root(), "different keys => different roots");
    }

    #[test]
    fn update_is_idempotent() {
        let tree = temp_tree();
        let mut smt = SparseMerkleTree::new(&tree);
        smt.update([0x42; 32], b"v1");
        let r1 = smt.root();
        smt.update([0x42; 32], b"v1"); // same key, same value
        let r2 = smt.root();
        assert_eq!(r1, r2, "re-updating the same (key,value) is idempotent");
    }

    #[test]
    fn many_updates_stay_sublinear_and_consistent() {
        // 1000 updates should complete quickly (O(256) each) and produce a
        // stable, non-empty root.
        let tree = temp_tree();
        let mut smt = SparseMerkleTree::new(&tree);
        for i in 0..1000u32 {
            let mut k = [0u8; 32];
            k[..4].copy_from_slice(&i.to_be_bytes());
            smt.update(k, &i.to_le_bytes());
        }
        let root = smt.root();
        assert_ne!(root, default_hashes()[TREE_DEPTH]);
        assert!(smt.is_dirty());
        smt.flush().unwrap();
    }
}
