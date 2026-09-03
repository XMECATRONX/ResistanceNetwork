//! rstn-core -- Genesis Block Construction
//!
//! Builds the genesis block from GenesisConfig.
//! Token allocations are encoded as system transactions in the genesis block.
//!
//! Satoshi model: there is NO team vesting contract. The team has no reserved
//! bucket — it earns RSTN by operating the genesis validator from the 95%
//! Proof-of-Participation staking pool, exactly like Satoshi mined the first
//! BTC by being the first miner. Zero team bucket, zero ecosystem fund, zero
//! genesis treasury.
//!
//! CRITICAL for multi-node consensus: the genesis block MUST be byte-identical
//! across all nodes. The genesis block uses a FIXED, well-known public key
//! (all zeros) as its `validator` field. The genesis block is unsigned
//! (signature = zeros) and signature verification is skipped for height 0,
//! so this is safe. This guarantees every node computes the same genesis hash.

use crate::{Block, BlockHeader, Transaction, TxType, GenesisConfig};
use rstn_crypto::{Dilithium3PublicKey, Dilithium3Signature, keccak512, SIG_SIZE, PUBKEY_SIZE, derive_address};

/// Fixed, well-known genesis public key (all zeros).
///
/// The genesis block is a trusted system block -- its signature is never
/// verified (height 0 is exempt in `verify_block_signature`). Using a fixed
/// pubkey guarantees the genesis hash is byte-identical on every node,
/// which is essential for multi-node BFT consensus: all validators must
/// agree on the chain's starting point.
fn genesis_pubkey() -> Dilithium3PublicKey {
    Dilithium3PublicKey([0u8; PUBKEY_SIZE])
}

/// Build the genesis block.
/// This block has no parent (parent_hash = zeros) and no real transactions.
/// Token allocations are encoded as system transactions.
///
/// Uses a fixed pubkey so the genesis hash is identical on every node.
pub fn build_genesis_block(config: &GenesisConfig) -> Block {
    let genesis_pubkey = genesis_pubkey();
    let transactions = build_genesis_transactions(config, &genesis_pubkey);

    let tx_root = compute_tx_root(&transactions);
    let state_root = compute_genesis_state_root(config);

    Block {
        header: BlockHeader {
            height: 0,
            parent_hash: [0u8; 64],
            state_root,
            tx_root,
            timestamp: config.genesis_time,
            validator: genesis_pubkey,
            signature: Dilithium3Signature([0u8; SIG_SIZE]),
            shard_id: 0,
            epoch: 0,
            round: 0,
            data_root: [0u8; 64], // genesis has no body to encode
            vrf_output: [0u8; 64], // genesis has no VRF (fixed seed = 0)
            vrf_proof: Dilithium3Signature([0u8; SIG_SIZE]), // genesis has no VRF proof
        },
        transactions,
    }
}

/// Compute the Merkle root of genesis transactions.
fn compute_tx_root(txs: &[Transaction]) -> [u8; 64] {
    if txs.is_empty() {
        return [0u8; 64];
    }
    let mut layer: Vec<[u8; 64]> = txs
        .iter()
        .map(|tx| tx.hash()) // Uses canonical encoding
        .collect();

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
            next.push(keccak512(&combined));
        }
        layer = next;
    }
    layer[0]
}

fn compute_genesis_state_root(config: &GenesisConfig) -> [u8; 64] {
    let encoded = serde_json::to_vec(config).unwrap_or_default();
    keccak512(&encoded)
}

/// Genesis transactions:
/// 1. Initialize token allocations for each bucket (Satoshi model: 95% PoP + 5% airdrop)
/// 2. Register initial validators
///
/// There is NO team vesting contract — the team has no reserved bucket.
fn build_genesis_transactions(
    config: &GenesisConfig,
    genesis_pubkey: &Dilithium3PublicKey,
) -> Vec<Transaction> {
    let mut txs = Vec::new();
    let genesis_addr = derive_address(genesis_pubkey);

    // 1. Token allocation transactions
    for (i, alloc) in config.token_allocations.iter().enumerate() {
        let payload = encode_allocation(alloc);
        txs.push(Transaction {
            from: genesis_pubkey.clone(),
            to: genesis_addr,
            value: 0,
            nonce: i as u64,
            gas_price: 0,
            gas_limit: 0,
            tx_type: TxType::Contract,
            payload,
            signature: Dilithium3Signature([0u8; SIG_SIZE]),
            hybrid_signature: None,
            hybrid_pubkey: None,
            gas_used: None,
        });
    }

    // 2. Register initial validators
    for (i, validator) in config.initial_validators.iter().enumerate() {
        let payload = encode_validator_registration(validator);
        txs.push(Transaction {
            from: genesis_pubkey.clone(),
            to: genesis_addr,
            value: 0,
            nonce: (config.token_allocations.len() + i) as u64,
            gas_price: 0,
            gas_limit: 0,
            tx_type: TxType::Stake,
            payload,
            signature: Dilithium3Signature([0u8; SIG_SIZE]),
            hybrid_signature: None,
            hybrid_pubkey: None,
            gas_used: None,
        });
    }

    txs
}

/// Encode a token allocation as a system payload.
/// Format: [2u8 (contract_type=Allocation)] [label length: 1u8] [label bytes] [8 bytes percentage * 10000]
fn encode_allocation(alloc: &crate::TokenAllocation) -> Vec<u8> {
    let label_bytes = alloc.label.as_bytes();
    let mut buf = Vec::with_capacity(2 + label_bytes.len() + 8);
    buf.push(2); // ContractType::Allocation
    buf.push(label_bytes.len() as u8);
    buf.extend_from_slice(label_bytes);
    let pct_scaled = (alloc.percentage * 10000.0) as u64;
    buf.extend_from_slice(&pct_scaled.to_le_bytes());
    buf
}

/// Encode a validator registration as a system payload.
/// Format: [3u8 (contract_type=ValidatorRegistration)] [1952 bytes pubkey] [16 bytes stake] [1 byte commission] [4 bytes shard_id]
fn encode_validator_registration(validator: &crate::Validator) -> Vec<u8> {
    let mut buf = Vec::with_capacity(1 + 1952 + 16 + 1 + 4);
    buf.push(3); // ContractType::ValidatorRegistration
    buf.extend_from_slice(&validator.pubkey.0);
    buf.extend_from_slice(&validator.stake.to_le_bytes());
    buf.push(validator.commission);
    buf.extend_from_slice(&validator.shard_id.to_le_bytes());
    buf
}

/// Verify the genesis block against the config.
pub fn verify_genesis(block: &Block, config: &GenesisConfig) -> bool {
    block.header.height == 0
        && block.header.parent_hash == [0u8; 64]
        && block.header.state_root == compute_genesis_state_root(config)
}
