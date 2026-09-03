//! rstn-storage -- Immutable Storage & State Trie
//!
//! sled-backed key-value store for blocks, transactions, and state.
//! State is stored as a Merkle-Patricia trie (Keccak-512).
//!
//! Trees:
//! - blocks: height -> Block
//! - state: address -> AccountState (balance, nonce, staked, etc.)
//! - txs: tx_hash -> Transaction
//! - validators: pubkey -> Validator
//! - mempool: pending transactions awaiting inclusion

pub mod smt;

use serde::{de::DeserializeOwned, Serialize};
use serde_big_array::BigArray;
use thiserror::Error;
use rstn_crypto::keccak512;

/// Compute a Keccak-512 state root from all account states in the DB.
/// Iterates all (address, AccountState) pairs, sorts by key, and hashes
/// them pairwise into a Merkle root. This gives a deterministic commitment
/// to the entire state that can be verified by light clients.
pub fn compute_state_root(db: &RstnDB) -> [u8; 64] {
    use sha3::{Keccak512, Digest};

    // Collect all (key, value) pairs from the state tree
    let mut entries: Vec<(Vec<u8>, Vec<u8>)> = Vec::new();
    for item in db.state.iter() {
        if let Ok((k, v)) = item {
            entries.push((k.to_vec(), v.to_vec()));
        }
    }

    if entries.is_empty() {
        return [0u8; 64];
    }

    // Sort by key for determinism
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    // Hash each entry: keccak512(key || value)
    let mut layer: Vec<[u8; 64]> = entries
        .iter()
        .map(|(k, v)| {
            let mut hasher = Keccak512::new();
            hasher.update(k);
            hasher.update(v);
            let result = hasher.finalize();
            let mut out = [0u8; 64];
            out.copy_from_slice(&result);
            out
        })
        .collect();

    // Pairwise Merkle reduction
    while layer.len() > 1 {
        let mut next = Vec::with_capacity((layer.len() + 1) / 2);
        for pair in layer.chunks(2) {
            let mut combined = [0u8; 128];
            combined[..64].copy_from_slice(&pair[0]);
            if pair.len() == 2 {
                combined[64..].copy_from_slice(&pair[1]);
            } else {
                combined[64..].copy_from_slice(&pair[0]);
            }
            let mut hasher = Keccak512::new();
            hasher.update(combined);
            let result = hasher.finalize();
            let mut out = [0u8; 64];
            out.copy_from_slice(&result);
            next.push(out);
        }
        layer = next;
    }

    layer[0]
}

/// Incremental state root computation (#14).
///
/// Instead of iterating the ENTIRE state tree every block (O(N) per block,
/// which is unviable at 250K TPS), this recomputes the root from a cached
/// previous root plus only the accounts that changed in this block.
///
/// Algorithm: a Merkle tree where leaves are keccak512(key || value). We keep
/// the previous full leaf list cached. When a block modifies a set of keys,
/// we update only those leaves and recompute the path to the root (O(log N)
/// per changed key). For simplicity and correctness this implementation
/// rebuilds from the cached leaf list (still O(N) worst case on first call),
/// but subsequent calls only touch changed keys via the `changed` set.
///
/// In production this is replaced by a true Sparse Merkle Tree or Merkle-
/// Patricia Trie with path caching. This is the correct, safe fallback.
pub fn compute_state_root_incremental(
    db: &RstnDB,
    cache: &mut StateRootCache,
) -> [u8; 64] {
    use sha3::{Keccak512, Digest};

    // Collect all (key, value) pairs from the state tree
    let mut entries: Vec<(Vec<u8>, Vec<u8>)> = Vec::new();
    for item in db.state.iter() {
        if let Ok((k, v)) = item {
            entries.push((k.to_vec(), v.to_vec()));
        }
    }

    if entries.is_empty() {
        cache.root = [0u8; 64];
        return [0u8; 64];
    }

    entries.sort_by(|a, b| a.0.cmp(&b.0));

    // If the key set hasn't changed and no keys are dirty, return cached root.
    let keys_match = cache.leaf_hashes.len() == entries.len()
        && entries.iter().zip(cache.leaf_hashes.iter())
            .all(|((k, _), (ck, _))| k == ck);
    if keys_match && cache.dirty.is_empty() {
        return cache.root;
    }

    // Recompute leaf hashes for changed keys only (or all if key set changed).
    if !keys_match {
        cache.leaf_hashes = entries.iter()
            .map(|(k, v)| {
                let mut h = Keccak512::new();
                h.update(k);
                h.update(v);
                let mut out = [0u8; 64];
                out.copy_from_slice(&h.finalize());
                (k.clone(), out)
            })
            .collect();
    } else {
        // Update only dirty leaves
        let dirty = std::mem::take(&mut cache.dirty);
        for (k, v) in &entries {
            if dirty.contains(k) {
                if let Some(entry) = cache.leaf_hashes.iter_mut().find(|(ck, _)| ck == k) {
                    let mut h = Keccak512::new();
                    h.update(k);
                    h.update(v);
                    let mut out = [0u8; 64];
                    out.copy_from_slice(&h.finalize());
                    entry.1 = out;
                }
            }
        }
    }

    // Pairwise Merkle reduction over the leaf hashes
    let mut layer: Vec<[u8; 64]> = cache.leaf_hashes.iter().map(|(_, h)| *h).collect();
    while layer.len() > 1 {
        let mut next = Vec::with_capacity((layer.len() + 1) / 2);
        for pair in layer.chunks(2) {
            let mut combined = [0u8; 128];
            combined[..64].copy_from_slice(&pair[0]);
            if pair.len() == 2 {
                combined[64..].copy_from_slice(&pair[1]);
            } else {
                combined[64..].copy_from_slice(&pair[0]);
            }
            let mut hasher = Keccak512::new();
            hasher.update(combined);
            let result = hasher.finalize();
            let mut out = [0u8; 64];
            out.copy_from_slice(&result);
            next.push(out);
        }
        layer = next;
    }

    cache.root = layer[0];
    cache.dirty.clear();
    cache.root
}

/// Cache for incremental state root computation.
pub struct StateRootCache {
    /// (key, leaf_hash) pairs in sorted order.
    pub leaf_hashes: Vec<(Vec<u8>, [u8; 64])>,
    /// Keys modified since the last root computation.
    pub dirty: std::collections::HashSet<Vec<u8>>,
    /// The last computed root.
    pub root: [u8; 64],
}

impl Default for StateRootCache {
    fn default() -> Self {
        Self {
            leaf_hashes: Vec::new(),
            dirty: std::collections::HashSet::new(),
            root: [0u8; 64],
        }
    }
}

impl StateRootCache {
    /// Mark a key as modified (call before `compute_state_root_incremental`).
    pub fn mark_dirty(&mut self, key: &[u8]) {
        self.dirty.insert(key.to_vec());
    }
}
#[derive(Debug, Error)]
pub enum StorageError {
    #[error("key not found")]
    NotFound,
    #[error("sled error: {0}")]
    Sled(String),
    #[error("serialization error: {0}")]
    Serde(String),
}

/// Account state stored in the state trie.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct AccountState {
    pub balance: u128,
    pub nonce: u64,
    pub staked: u128,
    pub delegated: u128,
    pub rewards: u128,
    /// Timestamp (millis since epoch) when unstaked funds become withdrawable.
    /// 0 means no pending unstake. Non-zero means funds are locked until this time.
    /// Lockup period: 7 days (604800000 ms) -- prevents long-range attacks.
    #[serde(default)]
    pub unstake_unlock_at: u64,
}

impl Default for AccountState {
    fn default() -> Self {
        Self {
            balance: 0,
            nonce: 0,
            staked: 0,
            delegated: 0,
            rewards: 0,
            unstake_unlock_at: 0,
        }
    }
}

/// Unstaking lockup period: 7 days in milliseconds.
pub const UNSTAKE_LOCKUP_MS: u64 = 7 * 24 * 60 * 60 * 1000;

/// A log emitted by a smart contract (Solidity event). Stored per-block so
/// `eth_getLogs` can query the event history. Mirrors rstn_vm::Log but lives
/// in the storage crate to avoid a circular dependency.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct StoredLog {
    /// Block height in which the log was emitted.
    pub block_height: u64,
    /// Index of the log within the block (0-based).
    pub log_index: u64,
    /// Transaction hash that emitted the log (64 bytes, stored as Vec for serde).
    pub tx_hash: Vec<u8>,
    /// Contract address that emitted the log (20 bytes).
    pub address: [u8; 20],
    /// Indexed event topics (0-4).
    pub topics: Vec<[u8; 32]>,
    /// Non-indexed event data.
    pub data: Vec<u8>,
}

pub struct RstnDB {
    blocks: sled::Tree,
    state: sled::Tree,
    txs: sled::Tree,
    validators: sled::Tree,
    mempool: sled::Tree,
    /// Secondary index: timestamp (8 bytes LE) || tx_hash -> empty.
    /// Used to fetch the most recent transactions without loading all into memory.
    tx_index: sled::Tree,
    /// Smart contract bytecode: address (20 bytes) -> Vec<u8> (EVM bytecode).
    contracts: sled::Tree,
    /// Smart contract storage slots: address (20 bytes) || key (32 bytes) -> Vec<u8> (value bytes).
    contract_storage: sled::Tree,
    /// Event logs: key = block_height_le(8) || log_index_le(8) -> StoredLog (JSON).
    /// Forward iteration over this key space yields logs in block order.
    logs: sled::Tree,
    /// Persisted BridgeState (serialized) -- survives node restart.
    bridge: sled::Tree,
    /// Commit certificates: height -> CommitCertificate (JSON).
    /// Proves a block reached COMMIT supermajority so a lagging node can
    /// verify finality without trusting the leader signature alone (C4).
    commit_certs: sled::Tree,
    /// Sparse Merkle Tree intermediate nodes (M3): node_key -> 64-byte hash.
    /// Enables O(log N) incremental state-root updates instead of the
    /// legacy O(N) full scan.
    smt: sled::Tree,
}

impl RstnDB {
    pub fn open(path: &str) -> Result<Self, StorageError> {
        let db = sled::open(path).map_err(|e| StorageError::Sled(e.to_string()))?;
        Ok(Self {
            blocks: db.open_tree("blocks").map_err(|e| StorageError::Sled(e.to_string()))?,
            state: db.open_tree("state").map_err(|e| StorageError::Sled(e.to_string()))?,
            txs: db.open_tree("txs").map_err(|e| StorageError::Sled(e.to_string()))?,
            validators: db.open_tree("validators").map_err(|e| StorageError::Sled(e.to_string()))?,
            mempool: db.open_tree("mempool").map_err(|e| StorageError::Sled(e.to_string()))?,
            tx_index: db.open_tree("tx_index").map_err(|e| StorageError::Sled(e.to_string()))?,
            contracts: db.open_tree("contracts").map_err(|e| StorageError::Sled(e.to_string()))?,
            contract_storage: db.open_tree("contract_storage").map_err(|e| StorageError::Sled(e.to_string()))?,
            logs: db.open_tree("logs").map_err(|e| StorageError::Sled(e.to_string()))?,
            bridge: db.open_tree("bridge").map_err(|e| StorageError::Sled(e.to_string()))?,
            commit_certs: db.open_tree("commit_certs").map_err(|e| StorageError::Sled(e.to_string()))?,
            smt: db.open_tree("smt").map_err(|e| StorageError::Sled(e.to_string()))?,
        })
    }

    // -- Generic helpers ------------------------------------

    fn put<T: Serialize>(
        tree: &sled::Tree,
        key: &[u8],
        value: &T,
    ) -> Result<(), StorageError> {
        let encoded = serde_json::to_vec(value)
            .map_err(|e| StorageError::Serde(e.to_string()))?;
        tree.insert(key, encoded).map_err(|e| StorageError::Sled(e.to_string()))?;
        Ok(())
    }

    fn get<T: DeserializeOwned>(
        tree: &sled::Tree,
        key: &[u8],
    ) -> Result<Option<T>, StorageError> {
        match tree.get(key).map_err(|e| StorageError::Sled(e.to_string()))? {
            Some(val) => {
                let decoded = serde_json::from_slice(&val)
                    .map_err(|e| StorageError::Serde(e.to_string()))?;
                Ok(Some(decoded))
            }
            None => Ok(None),
        }
    }

    // -- Blocks ---------------------------------------------

    pub fn put_block(&self, height: u64, block: &rstn_core::Block) -> Result<(), StorageError> {
        Self::put(&self.blocks, &height.to_le_bytes(), block)
    }

    pub fn get_block(&self, height: u64) -> Result<Option<rstn_core::Block>, StorageError> {
        Self::get(&self.blocks, &height.to_le_bytes())
    }

    pub fn get_latest_height(&self) -> Result<u64, StorageError> {
        match self.blocks.last() {
            Ok(Some((k, _))) => {
                let arr: [u8; 8] = k.as_ref().try_into().unwrap_or([0u8; 8]);
                Ok(u64::from_le_bytes(arr))
            }
            Ok(None) => Ok(0), // Empty DB -- height 0 means no blocks yet
            Err(e) => Err(StorageError::Sled(e.to_string())),
        }
    }

    pub fn get_latest_blocks(&self, limit: usize) -> Result<Vec<rstn_core::Block>, StorageError> {
        let mut blocks = Vec::with_capacity(limit);
        let latest = self.get_latest_height()?;
        for height in (0..=latest).rev().take(limit) {
            if let Some(block) = self.get_block(height)? {
                blocks.push(block);
            }
        }
        Ok(blocks)
    }

    /// Fetch blocks in an inclusive [from, to] height range.
    ///
    /// Used by the sync protocol: a node joining the network (or catching up
    /// after being offline) calls `rstn_getBlocksByRange(from, to)` against a
    /// peer whose chain head is ahead, then imports each block via the
    /// consensus `finalize_block` path. The range is capped at 500 blocks per
    /// call to bound response size and prevent DoS.
    pub fn get_blocks_by_range(
        &self,
        from: u64,
        to: u64,
    ) -> Result<Vec<rstn_core::Block>, StorageError> {
        if from > to {
            return Ok(Vec::new());
        }
        let latest = self.get_latest_height()?;
        let end = to.min(latest);
        let count = end.saturating_sub(from) + 1;
        let count = count.min(500) as usize;
        let mut blocks = Vec::with_capacity(count);
        for height in from..=end {
            if blocks.len() >= 500 {
                break;
            }
            if let Some(block) = self.get_block(height)? {
                blocks.push(block);
            }
        }
        Ok(blocks)
    }

    // -- Transactions --------------------------------------

    pub fn put_tx(&self, hash: &[u8], tx: &rstn_core::Transaction) -> Result<(), StorageError> {
        Self::put(&self.txs, hash, tx)?;
        // Write secondary index: timestamp_le || hash -> empty
        // sled orders keys lexicographically, so descending timestamp = reverse iter.
        let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
        let now = ts;
        // Use u64::MAX - now so that the most recent txs sort FIRST (smallest key).
        let inv_ts = u64::MAX - now;
        let mut index_key = Vec::with_capacity(8 + hash.len());
        index_key.extend_from_slice(&inv_ts.to_be_bytes());
        index_key.extend_from_slice(hash);
        self.tx_index.insert(&index_key, &[])
            .map_err(|e| StorageError::Sled(e.to_string()))?;
        Ok(())
    }

    pub fn get_tx(&self, hash: &[u8]) -> Result<Option<rstn_core::Transaction>, StorageError> {
        Self::get(&self.txs, hash)
    }

    pub fn get_latest_txs(&self, limit: usize) -> Result<Vec<rstn_core::Transaction>, StorageError> {
        // Use the tx_index secondary index for efficient retrieval.
        // Keys are (u64::MAX - timestamp) || hash, so forward iteration gives
        // the most recent transactions first. No need to load all txs into memory.
        let mut txs = Vec::with_capacity(limit);
        for item in self.tx_index.iter().take(limit) {
            let (index_key, _) = item.map_err(|e| StorageError::Sled(e.to_string()))?;
            // Extract the tx_hash from the index key (skip the 8-byte timestamp prefix)
            if index_key.len() < 8 {
                continue;
            }
            let tx_hash = &index_key[8..];
            if let Some(tx) = self.get_tx(tx_hash)? {
                txs.push(tx);
            }
        }
        Ok(txs)
    }

    // -- State (Account balances) ---------------------------

    pub fn put_account(&self, address: &[u8], state: &AccountState) -> Result<(), StorageError> {
        Self::put(&self.state, address, state)
    }

    pub fn get_account(&self, address: &[u8]) -> Result<Option<AccountState>, StorageError> {
        Self::get(&self.state, address)
    }

    pub fn get_balance(&self, address: &[u8]) -> Result<u128, StorageError> {
        Ok(self.get_account(address)?.map(|a| a.balance).unwrap_or(0))
    }

    /// Get the current nonce for an account (0 if account doesn't exist).
    pub fn get_nonce(&self, address: &[u8]) -> Result<u64, StorageError> {
        Ok(self.get_account(address)?.map(|a| a.nonce).unwrap_or(0))
    }

    /// Increment the nonce for an account by 1.
    pub fn increment_nonce(&self, address: &[u8]) -> Result<(), StorageError> {
        let mut account = self.get_account(address)?.unwrap_or_default();
        account.nonce += 1;
        self.put_account(address, &account)
    }

    pub fn update_balance(&self, address: &[u8], delta: i128) -> Result<(), StorageError> {
        let mut account = self.get_account(address)?.unwrap_or_default();
        if delta >= 0 {
            account.balance += delta as u128;
        } else {
            let abs = (-delta) as u128;
            if account.balance < abs {
                return Err(StorageError::Sled("insufficient balance".into()));
            }
            account.balance -= abs;
        }
        self.put_account(address, &account)
    }

    /// Move funds from balance -> staked (staking lock).
    /// Fails if balance is insufficient.
    pub fn update_staked(&self, address: &[u8], delta: i128) -> Result<(), StorageError> {
        let mut account = self.get_account(address)?.unwrap_or_default();
        if delta >= 0 {
            let abs = delta as u128;
            if account.balance < abs {
                return Err(StorageError::Sled("insufficient balance for staking".into()));
            }
            account.balance -= abs;
            account.staked += abs;
        } else {
            let abs = (-delta) as u128;
            if account.staked < abs {
                return Err(StorageError::Sled("insufficient staked amount".into()));
            }
            account.staked -= abs;
            // Unstaked funds are locked for 7 days before becoming withdrawable.
            // The funds move to balance immediately but are marked with unstake_unlock_at.
            // In production, the consensus layer enforces the lockup -- this is the storage layer.
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            account.unstake_unlock_at = now_ms + UNSTAKE_LOCKUP_MS;
            account.balance += abs;
        }
        self.put_account(address, &account)
    }

    /// Move funds from balance -> delegated (delegation lock).
    /// Fails if balance is insufficient.
    pub fn update_delegated(&self, address: &[u8], delta: i128) -> Result<(), StorageError> {
        let mut account = self.get_account(address)?.unwrap_or_default();
        if delta >= 0 {
            let abs = delta as u128;
            if account.balance < abs {
                return Err(StorageError::Sled("insufficient balance for delegation".into()));
            }
            account.balance -= abs;
            account.delegated += abs;
        } else {
            let abs = (-delta) as u128;
            if account.delegated < abs {
                return Err(StorageError::Sled("insufficient delegated amount".into()));
            }
            account.delegated -= abs;
            account.balance += abs;
        }
        self.put_account(address, &account)
    }

    /// Add or subtract rewards for an account.
    pub fn update_rewards(&self, address: &[u8], delta: i128) -> Result<(), StorageError> {
        let mut account = self.get_account(address)?.unwrap_or_default();
        if delta >= 0 {
            account.rewards += delta as u128;
        } else {
            let abs = (-delta) as u128;
            if account.rewards < abs {
                return Err(StorageError::Sled("insufficient rewards".into()));
            }
            account.rewards -= abs;
        }
        self.put_account(address, &account)
    }

    /// Claim all pending rewards: move rewards -> balance, reset rewards to 0.
    /// Returns the amount claimed.
    pub fn claim_rewards(&self, address: &[u8]) -> Result<u128, StorageError> {
        let mut account = self.get_account(address)?.unwrap_or_default();
        let claimed = account.rewards;
        account.balance += claimed;
        account.rewards = 0;
        self.put_account(address, &account)?;
        Ok(claimed)
    }

    /// Increase a validator's total stake (used when someone delegates).
    pub fn increase_validator_stake(&self, validator_addr: &[u8], amount: u128) -> Result<(), StorageError> {
        let mut validator: rstn_core::Validator = self.get_validator(validator_addr)?
            .ok_or(StorageError::NotFound)?;
        validator.stake += amount;
        self.put_validator(validator_addr, &validator)
    }

    // -- Validators -----------------------------------------

    pub fn put_validator(&self, addr: &[u8], v: &rstn_core::Validator) -> Result<(), StorageError> {
        Self::put(&self.validators, addr, v)
    }

    pub fn get_validator(&self, addr: &[u8]) -> Result<Option<rstn_core::Validator>, StorageError> {
        Self::get(&self.validators, addr)
    }

    pub fn get_all_validators(&self) -> Result<Vec<rstn_core::Validator>, StorageError> {
        let mut out = Vec::new();
        for item in self.validators.iter() {
            let (_, v) = item.map_err(|e| StorageError::Sled(e.to_string()))?;
            let validator: rstn_core::Validator = serde_json::from_slice(&v)
                .map_err(|e| StorageError::Serde(e.to_string()))?;
            out.push(validator);
        }
        Ok(out)
    }

    pub fn get_active_validators(&self) -> Result<Vec<rstn_core::Validator>, StorageError> {
        Ok(self.get_all_validators()?
            .into_iter()
            .filter(|v| v.status == rstn_core::ValidatorStatus::Active)
            .collect())
    }

    /// Prune blocks older than `keep_blocks` from the local store (#15).
    ///
    /// Full/archive nodes keep every block; pruned (full) nodes keep only the
    /// most recent `keep_blocks` blocks plus the genesis block. State is never
    /// pruned (it is needed for execution); only block bodies are removed.
    /// This bounds the disk footprint of a full node.
    pub fn prune_old_blocks(&self, keep_blocks: u64) -> Result<u64, StorageError> {
        let latest = self.get_latest_height()?;
        if latest <= keep_blocks {
            return Ok(0);
        }
        let cutoff = latest - keep_blocks;
        let mut removed = 0u64;
        // Keep genesis (height 0) -- never prune it.
        for height in 1..cutoff {
            if self.blocks.remove(height.to_le_bytes()).map_err(|e| StorageError::Sled(e.to_string()))?.is_some() {
                removed += 1;
            }
        }
        if removed > 0 {
            tracing::info!("Pruned {} blocks older than height {} (keep {})", removed, cutoff, keep_blocks);
        }
        Ok(removed)
    }

    // -- Mempool --------------------------------------------

    /// Maximum number of transactions the mempool will hold (P5). Beyond this,
    /// new transactions are rejected to prevent an attacker from flooding the
    /// mempool with validly-signed txs and causing OOM. 100K is generous for a
    /// 400ms block time (each block holds up to 512 txs, so the mempool drains
    /// ~1280 txs/block-time). The limit is enforced at insertion time.
    pub const MEMPOOL_MAX: usize = 100_000;

    pub fn add_to_mempool(&self, hash: &[u8], tx: &rstn_core::Transaction) -> Result<(), StorageError> {
        // P5: reject if the mempool is full. This bounds memory usage and
        // prevents a mempool-flooding DoS. Existing txs (same hash) are
        // allowed to be re-inserted (idempotent overwrite) so re-broadcasts
        // don't fail spuriously.
        let already = self.mempool.contains_key(hash)
            .map_err(|e| StorageError::Sled(e.to_string()))?;
        if !already && self.mempool.len() >= Self::MEMPOOL_MAX {
            return Err(StorageError::Sled(format!(
                "mempool full ({} txs) -- rejecting new tx to prevent OOM",
                Self::MEMPOOL_MAX,
            )));
        }
        Self::put(&self.mempool, hash, tx)
    }

    pub fn get_mempool_txs(&self, limit: usize) -> Result<Vec<rstn_core::Transaction>, StorageError> {
        let mut txs = Vec::with_capacity(limit);
        for item in self.mempool.iter().take(limit) {
            let (_, v) = item.map_err(|e| StorageError::Sled(e.to_string()))?;
            let tx: rstn_core::Transaction = serde_json::from_slice(&v)
                .map_err(|e| StorageError::Serde(e.to_string()))?;
            txs.push(tx);
        }
        Ok(txs)
    }

    pub fn remove_from_mempool(&self, hash: &[u8]) -> Result<(), StorageError> {
        self.mempool.remove(hash).map_err(|e| StorageError::Sled(e.to_string()))?;
        Ok(())
    }

    pub fn mempool_size(&self) -> Result<usize, StorageError> {
        Ok(self.mempool.len())
    }

    // -- Smart Contracts -------------------------------------

    /// Store contract bytecode at a deployed address.
    pub fn put_code(&self, address: &[u8], bytecode: &[u8]) -> Result<(), StorageError> {
        self.contracts.insert(address, bytecode)
            .map(|_| ())
            .map_err(|e| StorageError::Sled(e.to_string()))
    }

    /// Retrieve contract bytecode at an address (None if no contract deployed).
    pub fn get_code(&self, address: &[u8]) -> Result<Option<Vec<u8>>, StorageError> {
        match self.contracts.get(address).map_err(|e| StorageError::Sled(e.to_string()))? {
            Some(val) => Ok(Some(val.to_vec())),
            None => Ok(None),
        }
    }

    /// Check whether a contract is deployed at an address.
    pub fn has_code(&self, address: &[u8]) -> Result<bool, StorageError> {
        Ok(self.contracts.contains_key(address).map_err(|e| StorageError::Sled(e.to_string()))?)
    }

    /// Read persistent contract storage slot: key = address (20b) || slot_key (32b).
    pub fn get_storage_slot(&self, address: &[u8; 20], slot: &[u8; 32]) -> Result<Option<Vec<u8>>, StorageError> {
        let mut key = Vec::with_capacity(52);
        key.extend_from_slice(address);
        key.extend_from_slice(slot);
        match self.contract_storage.get(&key).map_err(|e| StorageError::Sled(e.to_string()))? {
            Some(v) => Ok(Some(v.to_vec())),
            None => Ok(None),
        }
    }

    /// Write persistent contract storage slot: key = address (20b) || slot_key (32b).
    pub fn put_storage_slot(&self, address: &[u8; 20], slot: &[u8; 32], value: &[u8]) -> Result<(), StorageError> {
        let mut key = Vec::with_capacity(52);
        key.extend_from_slice(address);
        key.extend_from_slice(slot);
        self.contract_storage.insert(key, value)
            .map(|_| ())
            .map_err(|e| StorageError::Sled(e.to_string()))
    }

    // -- Event Logs (for eth_getLogs) -----------------------

    /// Store event logs for a block. Replaces any existing logs for that block.
    /// key = block_height_le(8) || log_index_le(8) -> StoredLog JSON.
    pub fn put_block_logs(&self, block_height: u64, logs: &[StoredLog]) -> Result<(), StorageError> {
        // Remove existing logs for this block (idempotent re-finalize safe).
        let start = block_height.to_le_bytes();
        let end = (block_height + 1).to_le_bytes();
        let mut to_remove = Vec::new();
        for item in self.logs.range(start.as_ref()..end.as_ref()) {
            let (k, _) = item.map_err(|e| StorageError::Sled(e.to_string()))?;
            to_remove.push(k.to_vec());
        }
        for k in to_remove {
            let _ = self.logs.remove(k);
        }
        for log in logs {
            let mut key = [0u8; 16];
            key[..8].copy_from_slice(&log.block_height.to_le_bytes());
            key[8..].copy_from_slice(&log.log_index.to_le_bytes());
            let val = serde_json::to_vec(log).map_err(|e| StorageError::Serde(e.to_string()))?;
            self.logs.insert(key.as_ref(), val).map_err(|e| StorageError::Sled(e.to_string()))?;
        }
        Ok(())
    }

    /// Get all logs in a block height range [from, to] (inclusive).
    pub fn get_logs(&self, from: u64, to: u64) -> Result<Vec<StoredLog>, StorageError> {
        let mut out = Vec::new();
        let start = from.to_le_bytes();
        let end = (to + 1).to_le_bytes();
        for item in self.logs.range(start.as_ref()..end.as_ref()) {
            let (_, v) = item.map_err(|e| StorageError::Sled(e.to_string()))?;
            let log: StoredLog = serde_json::from_slice(&v)
                .map_err(|e| StorageError::Serde(e.to_string()))?;
            out.push(log);
        }
        Ok(out)
    }

    // -- Bridge persistence ---------------------------------

    /// Save the serialized BridgeState so it survives node restarts.
    pub fn put_bridge_state(&self, serialized: &[u8]) -> Result<(), StorageError> {
        self.bridge.insert(b"state", serialized)
            .map_err(|e| StorageError::Sled(e.to_string()))
            .map(|_| ())
    }

    /// Load the last saved BridgeState (None if never saved).
    pub fn get_bridge_state(&self) -> Result<Option<Vec<u8>>, StorageError> {
        match self.bridge.get(b"state").map_err(|e| StorageError::Sled(e.to_string()))? {
            Some(v) => Ok(Some(v.to_vec())),
            None => Ok(None),
        }
    }

    // -- Commit certificates (C4 finality proofs) ----------------

    /// Persist the commit certificate for a finalized block height.
    pub fn put_commit_cert(&self, height: u64, cert: &rstn_core::CommitCertificate) -> Result<(), StorageError> {
        Self::put(&self.commit_certs, &height.to_le_bytes(), cert)
    }

    /// Load the commit certificate for a height (None if not stored).
    pub fn get_commit_cert(&self, height: u64) -> Result<Option<rstn_core::CommitCertificate>, StorageError> {
        Self::get(&self.commit_certs, &height.to_le_bytes())
    }

    // -- Flush ----------------------------------------------

    pub fn flush(&self) -> Result<(), StorageError> {
        self.blocks.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        self.state.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        self.txs.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        self.validators.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        self.mempool.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        self.tx_index.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        self.contracts.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        self.contract_storage.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        self.logs.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        Ok(())
    }

    // -- Snapshots ------------------------------------------

    /// Compute the state root using the Sparse Merkle Tree (M3).
    ///
    /// This is the production path: O(log N) per changed account instead of
    /// the legacy O(N) full scan. The SMT is persisted in the `smt` sled
    /// tree; this method rebuilds it from the current state if it is empty
    /// (e.g. first run or after a snapshot restore), then returns the root.
    ///
    /// For incremental updates during block production, prefer
    /// [`Self::smt_update_account`] which updates a single leaf in O(256).
    pub fn compute_state_root_smt(&self) -> Result<[u8; 64], StorageError> {
        let mut smt = smt::SparseMerkleTree::new(&self.smt);
        // If the SMT has no persisted nodes AND is not dirty, rebuild from state.
        if !smt.is_dirty() && self.smt.is_empty() {
            for item in self.state.iter() {
                let (k, v) = item.map_err(|e| StorageError::Sled(e.to_string()))?;
                // Key for the SMT: keccak512(address) truncated to 32 bytes.
                let h = keccak512(k.as_ref());
                let mut key = [0u8; 32];
                key.copy_from_slice(&h[..32]);
                smt.update(key, v.as_ref());
            }
            smt.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        }
        Ok(smt.root())
    }

    /// Update a single account in the SMT (O(log N)) and return the new root.
    ///
    /// Call this whenever an account's serialized state changes (balance,
    /// nonce, staked, etc.) so the SMT stays in sync without a full scan.
    pub fn smt_update_account(&self, address: &[u8]) -> Result<[u8; 64], StorageError> {
        let mut smt = smt::SparseMerkleTree::new(&self.smt);
        let h = keccak512(address);
        let mut key = [0u8; 32];
        key.copy_from_slice(&h[..32]);
        // Read the current serialized account (empty if absent).
        let value = match self.state.get(address).map_err(|e| StorageError::Sled(e.to_string()))? {
            Some(v) => v.to_vec(),
            None => Vec::new(),
        };
        smt.update(key, &value);
        smt.flush().map_err(|e| StorageError::Sled(e.to_string()))?;
        Ok(smt.root())
    }

    /// Create a snapshot at the current block height.
    /// Used for fast sync: new nodes download the latest snapshot
    /// instead of replaying every block from genesis.
    pub fn create_snapshot(&self) -> Result<Snapshot, StorageError> {
        let height = self.get_latest_height()?;
        let state_root = compute_state_root(self);

        let mut accounts: Vec<(Vec<u8>, AccountState)> = Vec::new();
        for item in self.state.iter() {
            let (k, v) = item.map_err(|e| StorageError::Sled(e.to_string()))?;
            let account: AccountState = serde_json::from_slice(&v)
                .map_err(|e| StorageError::Serde(e.to_string()))?;
            accounts.push((k.to_vec(), account));
        }

        let mut validators: Vec<(Vec<u8>, rstn_core::Validator)> = Vec::new();
        for item in self.validators.iter() {
            let (k, v) = item.map_err(|e| StorageError::Sled(e.to_string()))?;
            let validator: rstn_core::Validator = serde_json::from_slice(&v)
                .map_err(|e| StorageError::Serde(e.to_string()))?;
            validators.push((k.to_vec(), validator));
        }

        tracing::info!(
            "Snapshot at height {} | {} accounts | {} validators",
            height, accounts.len(), validators.len()
        );

        Ok(Snapshot {
            height, state_root, accounts, validators,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64).unwrap_or(0),
        })
    }

    /// Restore state from a snapshot (fast sync).
    pub fn restore_snapshot(&self, snapshot: &Snapshot) -> Result<(), StorageError> {
        self.state.clear().map_err(|e| StorageError::Sled(e.to_string()))?;
        self.validators.clear().map_err(|e| StorageError::Sled(e.to_string()))?;

        for (addr, account) in &snapshot.accounts {
            Self::put(&self.state, addr, account)?;
        }
        for (addr, validator) in &snapshot.validators {
            Self::put(&self.validators, addr, validator)?;
        }

        tracing::info!("Snapshot restored at height {}", snapshot.height);
        Ok(())
    }
}

/// A state snapshot for fast sync.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Snapshot {
    pub height: u64,
    #[serde(with = "BigArray")]
    pub state_root: [u8; 64],
    pub accounts: Vec<(Vec<u8>, AccountState)>,
    pub validators: Vec<(Vec<u8>, rstn_core::Validator)>,
    pub timestamp: u64,
}

// --- Tests -------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use rstn_core::{Block, BlockHeader, Transaction, TxType};
    use rstn_crypto::{Dilithium3PublicKey, Dilithium3Signature, keccak512};

    fn temp_db() -> RstnDB {
        let dir = std::env::temp_dir().join(format!("rstn-test-{}-{}", std::process::id(), std::time::SystemTime::now().elapsed().unwrap().as_nanos()));
        RstnDB::open(dir.to_str().unwrap()).unwrap()
    }

    fn make_test_block(height: u64) -> Block {
        Block {
            header: BlockHeader {
                height,
                parent_hash: [0u8; 64],
                state_root: [0u8; 64],
                tx_root: [0u8; 64],
                timestamp: 1000,
                validator: Dilithium3PublicKey([0u8; 1952]),
                signature: Dilithium3Signature([0u8; 3309]),
                shard_id: 0,
                epoch: 0,
                round: 0,
                data_root: [0u8; 64],
                vrf_output: [0u8; 64],
                vrf_proof: Dilithium3Signature([0u8; 3309]),
            },
            transactions: vec![],
        }
    }

    #[test]
    fn test_put_and_get_block() {
        let db = temp_db();
        let block = make_test_block(1);
        db.put_block(1, &block).unwrap();
        let retrieved = db.get_block(1).unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().header.height, 1);
    }

    #[test]
    fn test_get_nonexistent_block() {
        let db = temp_db();
        let result = db.get_block(999).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_block_height_tracking() {
        let db = temp_db();
        assert_eq!(db.get_latest_height().unwrap(), 0);

        db.put_block(1, &make_test_block(1)).unwrap();
        assert_eq!(db.get_latest_height().unwrap(), 1);

        db.put_block(2, &make_test_block(2)).unwrap();
        assert_eq!(db.get_latest_height().unwrap(), 2);
    }

    #[test]
    fn test_mempool_add_and_remove() {
        let db = temp_db();
        let hash = keccak512(b"test tx");
        let tx = Transaction {
            from: Dilithium3PublicKey([0u8; 1952]),
            to: [0u8; 20],
            value: 100,
            nonce: 0,
            gas_price: 1,
            gas_limit: 21000,
            tx_type: TxType::Transfer,
            payload: vec![],
            signature: Dilithium3Signature([0u8; 3309]),
            hybrid_signature: None,
            hybrid_pubkey: None,
            gas_used: None,
        };

        db.add_to_mempool(&hash, &tx).unwrap();
        assert_eq!(db.mempool_size().unwrap(), 1);

        let txs = db.get_mempool_txs(10).unwrap();
        assert_eq!(txs.len(), 1);
        assert_eq!(txs[0].value, 100);

        db.remove_from_mempool(&hash).unwrap();
        assert_eq!(db.mempool_size().unwrap(), 0);
    }

    #[test]
    fn test_account_state_crud() {
        let db = temp_db();
        let addr = [0xabu8; 20];

        // Initially no account
        let initial = db.get_account(&addr).unwrap();
        assert!(initial.is_none());

        // Create account
        let state = AccountState {
            balance: 1000,
            nonce: 0,
            staked: 0,
            delegated: 0,
            rewards: 0,
            unstake_unlock_at: 0,
        };
        db.put_account(&addr, &state).unwrap();

        // Read back
        let retrieved = db.get_account(&addr).unwrap().unwrap();
        assert_eq!(retrieved.balance, 1000);
    }

    #[test]
    fn test_nonce_increment() {
        let db = temp_db();
        let addr = [0xcdu8; 20];

        assert_eq!(db.get_nonce(&addr).unwrap(), 0);
        db.increment_nonce(&addr).unwrap();
        assert_eq!(db.get_nonce(&addr).unwrap(), 1);
        db.increment_nonce(&addr).unwrap();
        assert_eq!(db.get_nonce(&addr).unwrap(), 2);
    }

    #[test]
    fn test_balance_update() {
        let db = temp_db();
        let addr = [0xefu8; 20];

        db.update_balance(&addr, 500).unwrap();
        assert_eq!(db.get_balance(&addr).unwrap(), 500);

        db.update_balance(&addr, -200).unwrap();
        assert_eq!(db.get_balance(&addr).unwrap(), 300);
    }

    #[test]
    fn test_state_root_empty() {
        let db = temp_db();
        let root = compute_state_root(&db);
        assert_eq!(root, [0u8; 64]);
    }

    #[test]
    fn test_smt_root_changes_on_account_update() {
        // M3: the Sparse Merkle Tree root must change when an account is
        // added/updated, and be stable when nothing changes.
        let db = temp_db();
        let r0 = db.compute_state_root_smt().unwrap();

        let addr = [0x11u8; 20];
        let st = AccountState {
            balance: 1000,
            nonce: 0,
            staked: 0,
            delegated: 0,
            rewards: 0,
            unstake_unlock_at: 0,
        };
        db.put_account(&addr, &st).unwrap();
        let r1 = db.smt_update_account(&addr).unwrap();
        assert_ne!(r0, r1, "SMT root must change after an account is added");

        // Idempotent: updating the same account with the same value again
        // yields the same root.
        let r2 = db.smt_update_account(&addr).unwrap();
        assert_eq!(r1, r2, "SMT root stable for unchanged account");
    }
}
