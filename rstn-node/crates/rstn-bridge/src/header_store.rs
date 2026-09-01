//! Light-client header store for the bridge SPV verifier.
//!
//! ## Purpose (C1-production wiring)
//!
//! The [`spv::LockVerifier`] implementations check the *cryptographic* validity
//! of a lock proof (Merkle branch, amount, vault) and the *confirmation depth*
//! of the header that anchors the proof. But they cannot, by themselves, know
//! whether a given header is on the **canonical** source chain — a relayer
//! could fabricate a header with a valid Merkle root and enough "confirmations"
//! that is actually on a short fork, or entirely invented.
//!
//! This module closes that gap. [`HeaderStore`] tracks source-chain block
//! headers, maintains the canonical (heaviest-work) chain per source chain, and
//! answers two questions the verifier needs:
//!
//! 1. **Is this header canonical?** — i.e. is it an ancestor of the current
//!    chain tip, or on a fork that was abandoned.
//! 2. **How many confirmations does it have?** — the depth from the current
//!    canonical tip back to this header.
//!
//! ## Honest scope
//!
//! This is a *self-contained* header store: an operator (or a future
//! light-client sync process) inserts headers via [`HeaderStore::insert`]. The
//! store validates internal consistency (parent linkage, height monotonicity,
//! accumulated work accounting) and maintains the heaviest chain. It does NOT
//! itself sync headers from a source chain P2P network — that wiring (SPV node
//! or RPC header subscription) is the operator's responsibility. What it DOES
//! guarantee is that once a header is inserted and confirmed, the SPV verifier
//! can trust the confirmation count it reports.
//!
//! The store is deliberately chain-agnostic about *what* a header contains
//! beyond the fields needed for chain selection: height, parent hash, a
//! Merkle/receipts root (for the verifier), and an accumulated work value. For
//! Bitcoin the work is derived from the difficulty target; for Ethereum it is
//! the block number (post-merge the chain is finality-gated, so depth is the
//! relevant signal). This keeps the store free of chain-specific parsing while
//! remaining correct for chain selection.

use crate::SourceChain;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum HeaderStoreError {
    #[error("header already exists: {0}")]
    Duplicate(String),
    #[error("parent header not found: {0}")]
    UnknownParent(String),
    #[error("height regression: parent height {parent}, child height {child}")]
    HeightRegression { parent: u64, child: u64 },
    #[error("header not on canonical chain: {0}")]
    NotCanonical(String),
    #[error("header not found: {0}")]
    NotFound(String),
    #[error("genesis parent mismatch: header claims parent {0}")]
    InvalidGenesisParent(String),
}

/// A source-chain block header, stripped to the fields the bridge needs.
///
/// `accumulated_work` is a monotonically-increasing score along a chain. For
/// PoW chains it is the sum of `2^256 / (target+1)` per block (Bitcoin's
/// chain-selection rule); for PoS/finality chains it is simply the block
/// height, since finality makes depth the relevant signal. The store only
/// requires that more work == heavier chain; it does not interpret the value.
#[derive(Clone, Debug)]
pub struct SourceHeader {
    pub chain: SourceChain,
    pub height: u64,
    /// 32-byte parent header hash. The genesis header uses all-zeros.
    pub parent_hash: [u8; 32],
    /// 32-byte hash of this header (the block hash / header hash).
    pub hash: [u8; 32],
    /// Merkle root (Bitcoin) or receipts root (Ethereum) — passed to the SPV
    /// verifier so it can anchor a lock proof to this header.
    pub root: [u8; 32],
    /// Accumulated work up to and including this header.
    pub accumulated_work: u128,
}

impl SourceHeader {
    /// Bitcoin genesis-like sentinel: all-zero parent.
    pub fn is_genesis(&self) -> bool {
        self.parent_hash.iter().all(|b| *b == 0)
    }
}

/// Per-chain state: the set of known headers and the current canonical tip.
#[derive(Clone, Debug, Default)]
struct ChainState {
    /// hash -> header
    headers: HashMap<[u8; 32], SourceHeader>,
    /// height -> hash (for fast canonical lookup)
    by_height: HashMap<u64, [u8; 32]>,
    /// Current canonical tip hash (heaviest accumulated work).
    tip: Option<[u8; 32]>,
}

impl ChainState {
    fn new() -> Self {
        Self::default()
    }
}

/// The light-client header store, tracking all supported source chains.
pub struct HeaderStore {
    chains: HashMap<SourceChain, ChainState>,
}

impl Default for HeaderStore {
    fn default() -> Self {
        Self::new()
    }
}

impl HeaderStore {
    pub fn new() -> Self {
        let mut chains = HashMap::new();
        // Pre-seed all supported chains so lookups never miss the map.
        for c in [
            SourceChain::Bitcoin,
            SourceChain::Ethereum,
            SourceChain::Solana,
            SourceChain::Bsc,
            SourceChain::Avalanche,
        ] {
            chains.insert(c, ChainState::new());
        }
        Self { chains }
    }

    /// Insert a header. Validates:
    /// - No duplicate hash.
    /// - Parent exists (unless genesis).
    /// - Child height == parent height + 1.
    /// - Accumulated work strictly increases.
    ///
    /// After insertion, recomputes the canonical tip (heaviest accumulated
    /// work; ties broken by greater height, then lexicographically larger hash
    /// for determinism).
    pub fn insert(&mut self, header: SourceHeader) -> Result<(), HeaderStoreError> {
        let chain = self
            .chains
            .get_mut(&header.chain)
            .ok_or(HeaderStoreError::NotFound(format!("{:?}", header.chain)))?;
        let hash = header.hash;
        let hash_hex = hex::encode(hash);

        if chain.headers.contains_key(&hash) {
            return Err(HeaderStoreError::Duplicate(hash_hex));
        }

        // Validate parent linkage.
        if header.is_genesis() {
            if header.height != 0 {
                return Err(HeaderStoreError::HeightRegression {
                    parent: 0,
                    child: header.height,
                });
            }
        } else {
            let parent = chain
                .headers
                .get(&header.parent_hash)
                .ok_or_else(|| HeaderStoreError::UnknownParent(hex::encode(header.parent_hash)))?;
            if header.height != parent.height + 1 {
                return Err(HeaderStoreError::HeightRegression {
                    parent: parent.height,
                    child: header.height,
                });
            }
            if header.accumulated_work <= parent.accumulated_work {
                return Err(HeaderStoreError::InvalidGenesisParent(format!(
                    "accumulated_work did not increase: parent={}, child={}",
                    parent.accumulated_work, header.accumulated_work
                )));
            }
        }

        // Insert.
        chain.by_height.insert(header.height, hash);
        chain.headers.insert(hash, header);

        // Recompute canonical tip: heaviest accumulated work.
        let new_tip = chain
            .headers
            .values()
            .max_by(|a, b| {
                a.accumulated_work
                    .cmp(&b.accumulated_work)
                    .then_with(|| a.height.cmp(&b.height))
                    .then_with(|| a.hash.cmp(&b.hash))
            })
            .map(|h| h.hash);
        chain.tip = new_tip;
        Ok(())
    }

    /// Is the given header hash on the canonical chain (i.e. an ancestor of
    /// the current tip)? A header is canonical if walking parent pointers from
    /// the tip reaches it.
    pub fn is_canonical(&self, chain: SourceChain, hash: &[u8; 32]) -> bool {
        let Some(state) = self.chains.get(&chain) else {
            return false;
        };
        let Some(tip) = state.tip else {
            return false;
        };
        let mut cursor = tip;
        let mut steps = 0u32;
        // Guard against cycles (shouldn't happen, but defend in depth).
        let max_steps = state.headers.len() as u32 + 1;
        while steps <= max_steps {
            if &cursor == hash {
                return true;
            }
            let Some(hdr) = state.headers.get(&cursor) else {
                return false;
            };
            if hdr.is_genesis() {
                return &hdr.hash == hash;
            }
            cursor = hdr.parent_hash;
            steps += 1;
        }
        false
    }

    /// Confirmations = depth of `hash` below the canonical tip.
    /// Returns an error if the header is unknown or not canonical.
    pub fn confirmations(&self, chain: SourceChain, hash: &[u8; 32]) -> Result<u32, HeaderStoreError> {
        let Some(state) = self.chains.get(&chain) else {
            return Err(HeaderStoreError::NotFound(format!("{:?}", chain)));
        };
        let Some(tip) = state.tip else {
            return Err(HeaderStoreError::NotFound("no tip".into()));
        };
        if !self.is_canonical(chain, hash) {
            return Err(HeaderStoreError::NotCanonical(hex::encode(hash)));
        }
        let tip_hdr = state
            .headers
            .get(&tip)
            .ok_or_else(|| HeaderStoreError::NotFound(hex::encode(tip)))?;
        let target_hdr = state
            .headers
            .get(hash)
            .ok_or_else(|| HeaderStoreError::NotFound(hex::encode(hash)))?;
        // tip height - target height = confirmations (depth).
        Ok((tip_hdr.height - target_hdr.height) as u32)
    }

    /// Get the Merkle/receipts root for a header, for the SPV verifier.
    pub fn root(&self, chain: SourceChain, hash: &[u8; 32]) -> Result<[u8; 32], HeaderStoreError> {
        let Some(state) = self.chains.get(&chain) else {
            return Err(HeaderStoreError::NotFound(format!("{:?}", chain)));
        };
        state
            .headers
            .get(hash)
            .map(|h| h.root)
            .ok_or_else(|| HeaderStoreError::NotFound(hex::encode(hash)))
    }

    /// Current canonical tip height for a chain (for monitoring / RPC).
    pub fn tip_height(&self, chain: SourceChain) -> Option<u64> {
        self.chains.get(&chain).and_then(|s| {
            s.tip.and_then(|h| s.headers.get(&h).map(|hdr| hdr.height))
        })
    }

    /// Number of headers known for a chain.
    pub fn len(&self, chain: SourceChain) -> usize {
        self.chains.get(&chain).map(|s| s.headers.len()).unwrap_or(0)
    }

    /// Is the store empty for a chain?
    pub fn is_empty(&self, chain: SourceChain) -> bool {
        self.len(chain) == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hdr(
        chain: SourceChain,
        height: u64,
        parent: [u8; 32],
        hash: [u8; 32],
        work: u128,
    ) -> SourceHeader {
        SourceHeader {
            chain,
            height,
            parent_hash: parent,
            hash,
            root: [0xff; 32],
            accumulated_work: work,
        }
    }

    fn h(n: u8) -> [u8; 32] {
        let mut b = [0u8; 32];
        b[0] = n;
        b
    }

    #[test]
    fn genesis_insert_and_canonical() {
        let mut store = HeaderStore::new();
        let g = hdr(SourceChain::Bitcoin, 0, [0u8; 32], h(1), 100);
        store.insert(g.clone()).unwrap();
        assert!(store.is_canonical(SourceChain::Bitcoin, &h(1)));
        assert_eq!(store.confirmations(SourceChain::Bitcoin, &h(1)).unwrap(), 0);
        assert_eq!(store.tip_height(SourceChain::Bitcoin), Some(0));
    }

    #[test]
    fn chain_growth_and_confirmations() {
        let mut store = HeaderStore::new();
        // Genesis -> b1 -> b2 -> b3
        store.insert(hdr(SourceChain::Bitcoin, 0, [0u8; 32], h(1), 100)).unwrap();
        store.insert(hdr(SourceChain::Bitcoin, 1, h(1), h(2), 200)).unwrap();
        store.insert(hdr(SourceChain::Bitcoin, 2, h(2), h(3), 300)).unwrap();
        store.insert(hdr(SourceChain::Bitcoin, 3, h(3), h(4), 400)).unwrap();

        // Tip is h(4) at height 3. Genesis has 3 confirmations.
        assert_eq!(store.tip_height(SourceChain::Bitcoin), Some(3));
        assert_eq!(store.confirmations(SourceChain::Bitcoin, &h(1)).unwrap(), 3);
        assert_eq!(store.confirmations(SourceChain::Bitcoin, &h(2)).unwrap(), 2);
        assert_eq!(store.confirmations(SourceChain::Bitcoin, &h(3)).unwrap(), 1);
        assert_eq!(store.confirmations(SourceChain::Bitcoin, &h(4)).unwrap(), 0);
    }

    #[test]
    fn fork_reorg_to_heavier_chain() {
        let mut store = HeaderStore::new();
        // Common genesis.
        store.insert(hdr(SourceChain::Bitcoin, 0, [0u8; 32], h(1), 100)).unwrap();
        // Fork A: h(2) -> h(3), work 200, 300.
        store.insert(hdr(SourceChain::Bitcoin, 1, h(1), h(2), 200)).unwrap();
        store.insert(hdr(SourceChain::Bitcoin, 2, h(2), h(3), 300)).unwrap();
        // Fork B: h(5) -> h(6), work 250, 400 (heavier).
        store.insert(hdr(SourceChain::Bitcoin, 1, h(1), h(5), 250)).unwrap();
        store.insert(hdr(SourceChain::Bitcoin, 2, h(5), h(6), 400)).unwrap();

        // Heaviest tip is h(6) (work 400 > 300).
        assert_eq!(store.tip_height(SourceChain::Bitcoin), Some(2));
        assert!(store.is_canonical(SourceChain::Bitcoin, &h(6)));
        assert!(store.is_canonical(SourceChain::Bitcoin, &h(5)));
        assert!(!store.is_canonical(SourceChain::Bitcoin, &h(3)));
        assert!(!store.is_canonical(SourceChain::Bitcoin, &h(2)));

        // h(1) genesis is canonical on both forks.
        assert!(store.is_canonical(SourceChain::Bitcoin, &h(1)));
        assert_eq!(store.confirmations(SourceChain::Bitcoin, &h(1)).unwrap(), 2);
    }

    #[test]
    fn duplicate_rejected() {
        let mut store = HeaderStore::new();
        store.insert(hdr(SourceChain::Bitcoin, 0, [0u8; 32], h(1), 100)).unwrap();
        let res = store.insert(hdr(SourceChain::Bitcoin, 0, [0u8; 32], h(1), 100));
        assert!(matches!(res, Err(HeaderStoreError::Duplicate(_))));
    }

    #[test]
    fn unknown_parent_rejected() {
        let mut store = HeaderStore::new();
        let res = store.insert(hdr(SourceChain::Bitcoin, 5, h(99), h(2), 600));
        assert!(matches!(res, Err(HeaderStoreError::UnknownParent(_))));
    }

    #[test]
    fn height_regression_rejected() {
        let mut store = HeaderStore::new();
        store.insert(hdr(SourceChain::Bitcoin, 0, [0u8; 32], h(1), 100)).unwrap();
        // Child claims height 5 but parent is height 0.
        let res = store.insert(hdr(SourceChain::Bitcoin, 5, h(1), h(2), 200));
        assert!(matches!(res, Err(HeaderStoreError::HeightRegression { .. })));
    }

    #[test]
    fn non_canonical_confirmations_error() {
        let mut store = HeaderStore::new();
        store.insert(hdr(SourceChain::Bitcoin, 0, [0u8; 32], h(1), 100)).unwrap();
        store.insert(hdr(SourceChain::Bitcoin, 1, h(1), h(2), 200)).unwrap();
        // h(9) doesn't exist.
        let res = store.confirmations(SourceChain::Bitcoin, &h(9));
        assert!(res.is_err());
    }

    #[test]
    fn independent_chains() {
        let mut store = HeaderStore::new();
        store.insert(hdr(SourceChain::Bitcoin, 0, [0u8; 32], h(1), 100)).unwrap();
        store.insert(hdr(SourceChain::Ethereum, 0, [0u8; 32], h(2), 1)).unwrap();
        store.insert(hdr(SourceChain::Ethereum, 1, h(2), h(3), 2)).unwrap();

        // Bitcoin tip is h(1) (height 0), Ethereum tip is h(3) (height 1).
        assert_eq!(store.tip_height(SourceChain::Bitcoin), Some(0));
        assert_eq!(store.tip_height(SourceChain::Ethereum), Some(1));
        assert_eq!(store.confirmations(SourceChain::Ethereum, &h(2)).unwrap(), 1);
    }

    #[test]
    fn root_lookup() {
        let mut store = HeaderStore::new();
        let mut g = hdr(SourceChain::Bitcoin, 0, [0u8; 32], h(1), 100);
        g.root = [0xaa; 32];
        store.insert(g).unwrap();
        assert_eq!(store.root(SourceChain::Bitcoin, &h(1)).unwrap(), [0xaa; 32]);
    }
}
