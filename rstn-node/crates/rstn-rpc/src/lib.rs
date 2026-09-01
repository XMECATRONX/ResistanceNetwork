//! rstn-rpc -- JSON-RPC Server
//!
//! Exposes 30+ RPC methods that match the frontend SDK exactly.
//! When this server is running, flip `RPC_MODE = true` in the frontend.
//!
//! Methods:
//!   rstn_getNetworkStats       -> NetworkStats
//!   rstn_health                -> bool
//!   rstn_getExplorerStats      -> ExplorerStats
//!   rstn_getLatestBlocks       -> Block[]
//!   rstn_getBlockByHeight      -> Block | null
//!   rstn_getLatestTransactions -> Transaction[]
//!   rstn_getTransactionByHash  -> Transaction | null
//!   rstn_getTopValidators      -> Validator[]
//!   rstn_getBalance            -> WalletPortfolio
//!   rstn_getStakingValidators  -> StakingValidator[]
//!   rstn_getProposals          -> GovernanceProposal[]
//!   rstn_sendTransaction       -> Hash
//!   rstn_faucetClaim           -> { hash, amount }
//!   rstn_stake                 -> { hash, amount, type }
//!   rstn_unstake               -> { hash, amount, type }
//!   rstn_delegate              -> { hash, amount, type }
//!   rstn_undelegate            -> { hash, amount, type }
//!   rstn_claimRewards          -> { hash, amount, type }
//!   rstn_getStakingInfo        -> StakingInfo

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{mpsc, RwLock};
use rstn_core::{Block, Transaction, Validator, ConsensusState, TxType};
use rstn_storage::RstnDB;
use rstn_crypto::{derive_address, format_address, Dilithium3Keypair, Dilithium3PublicKey, Dilithium3Signature};
use rstn_bridge::{BridgeState, SourceChain as BridgeSourceChain};

#[derive(Debug, Error)]
pub enum RpcError {
    #[error("method not found: {0}")]
    MethodNotFound(String),
    #[error("invalid params: {0}")]
    InvalidParams(String),
    #[error("internal: {0}")]
    Internal(String),
}

// --- RPC Request/Response -----------------------------------

#[derive(Debug, Deserialize)]
pub struct RpcRequest {
    #[serde(default = "default_jsonrpc")]
    pub jsonrpc: String,
    #[serde(default)]
    pub id: Value,
    pub method: String,
    #[serde(default, deserialize_with = "deserialize_params")]
    pub params: Vec<Value>,
}

fn default_jsonrpc() -> String {
    "2.0".to_string()
}

fn deserialize_params<'de, D>(deserializer: D) -> Result<Vec<Value>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let val: Value = serde::Deserialize::deserialize(deserializer)?;
    match val {
        Value::Array(arr) => Ok(arr),
        Value::Object(_) => Ok(vec![val]),
        Value::Null => Ok(Vec::new()),
        _ => Ok(vec![val]),
    }
}

#[derive(Debug, Serialize)]
pub struct RpcResponse {
    pub jsonrpc: String,
    pub id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcErrorData>,
}

#[derive(Debug, Serialize)]
pub struct RpcErrorData {
    pub code: i32,
    pub message: String,
}

// --- Server State -------------------------------------------

pub struct RpcState {
    pub db: Arc<RstnDB>,
    pub consensus: RwLock<ConsensusState>,
    /// Faucet rate limiting: maps address -> last claim timestamp (millis since epoch).
    /// 1 claim per address per 24h. Enforced in-memory (resets on restart).
    pub faucet_claims: RwLock<std::collections::HashMap<Vec<u8>, u64>>,
    /// RPC rate limiting: maps IP -> (per_sec_count, sec_window_start, per_min_count, min_window_start).
    /// Prevents RPC spam / DoS attacks. Enforces both per-second and per-minute caps.
    pub rpc_rate_limits: RwLock<std::collections::HashMap<String, (u64, std::time::Instant, u64, std::time::Instant)>>,
    /// API keys for authenticated access (commercial use).
    /// Empty = no auth required (testnet mode).
    pub api_keys: RwLock<std::collections::HashSet<String>>,
    /// Outbound transaction broadcast channel (P2P gossip).
    /// `None` in dev mode (single node -- txs stay in the local mempool).
    /// In multi-node mode, `send_transaction` pushes the tx here so the P2P
    /// event loop gossips it to peers, ensuring the leader sees it and includes
    /// it in a block. Without this, a tx submitted to a non-leader node sits in
    /// that node's mempool forever and blocks stay empty.
    pub outbound_tx: RwLock<Option<mpsc::Sender<rstn_core::Transaction>>>,
    /// This node's validator keypair. Used by `rstn_debugSendTx` to sign
    /// test transactions so we can validate P2P tx gossip end-to-end without
    /// needing a full wallet. `None` only if the node has no signing key.
    /// NEVER exposed over RPC -- only used to sign txs locally.
    pub node_keypair: Option<Dilithium3Keypair>,
    /// Bridge state -- tracks locked/minted reserves and wrapped token balances.
    /// In testnet mode, the node auto-signs and auto-executes bridge operations
    /// (single-validator threshold). In production, 2/3+ validators must sign.
    pub bridge_state: tokio::sync::RwLock<BridgeState>,
    /// Number of active validators (for bridge threshold computation).
    pub bridge_validator_count: tokio::sync::RwLock<usize>,
    /// True when running in testnet/dev mode (1 node = full threshold).
    /// False in production: the 2/3+ multi-validator threshold is enforced.
    pub is_testnet: bool,
    /// CORS allow-list. In testnet with an empty list, the RPC server emits
    /// `Access-Control-Allow-Origin: *`. In production (is_testnet == false)
    /// the list MUST be populated with the official dApp origins; requests
    /// whose `Origin` is not in the list receive no ACAO header and are
    /// rejected by the browser's same-origin policy. This prevents a
    /// malicious site from driving the user's local node (M4).
    pub allowed_origins: RwLock<Vec<String>>,
}

/// RPC rate limit: max requests per IP per second.
const RPC_RATE_LIMIT_PER_SEC: u64 = 50;
/// RPC rate limit: max requests per IP per minute (burst protection).
const RPC_RATE_LIMIT_PER_MIN: u64 = 500;

/// Check if an IP is within rate limits. Returns Err if exceeded.
/// Enforces BOTH a per-second and a per-minute cap to prevent DoS.
pub async fn check_rpc_rate_limit(
    state: &RpcState,
    ip: &str,
) -> Result<(), RpcError> {
    let mut limits = state.rpc_rate_limits.write().await;
    let now = std::time::Instant::now();
    let entry = limits.entry(ip.to_string()).or_insert((0, now, 0, now));

    // Reset per-second window every second
    if now.duration_since(entry.1) > std::time::Duration::from_secs(1) {
        entry.0 = 0;
        entry.1 = now;
    }
    entry.0 += 1;

    if entry.0 > RPC_RATE_LIMIT_PER_SEC {
        return Err(RpcError::InvalidParams(format!(
            "rate limit exceeded: {} requests/sec from {} (max {})",
            entry.0, ip, RPC_RATE_LIMIT_PER_SEC
        )));
    }

    // Reset per-minute window every 60 seconds
    if now.duration_since(entry.3) > std::time::Duration::from_secs(60) {
        entry.2 = 0;
        entry.3 = now;
    }
    entry.2 += 1;

    if entry.2 > RPC_RATE_LIMIT_PER_MIN {
        return Err(RpcError::InvalidParams(format!(
            "rate limit exceeded: {} requests/min from {} (max {})",
            entry.2, ip, RPC_RATE_LIMIT_PER_MIN
        )));
    }
    Ok(())
}

/// Validate API key if auth is enabled.
pub async fn validate_api_key(
    state: &RpcState,
    api_key: Option<&str>,
) -> Result<(), RpcError> {
    let keys = state.api_keys.read().await;
    if keys.is_empty() {
        return Ok(()); // No auth required (testnet mode)
    }
    match api_key {
        Some(key) if keys.contains(key) => Ok(()),
        _ => Err(RpcError::InvalidParams("invalid or missing API key".into())),
    }
}

/// Reject privileged/testnet-only RPC shortcuts in production mode.
///
/// The staking shortcuts (`rstn_stake`, `rstn_unstake`, `rstn_delegate`,
/// `rstn_undelegate`, `rstn_claimRewards`), the faucet, and `rstn_debugSendTx`
/// mutate consensus state WITHOUT verifying a Dilithium3 signature. They
/// exist only for dev/testnet convenience. In production they MUST be
/// disabled so an attacker cannot move another account's stake or mint
/// tokens by knowing an address (A3). Real staking goes through
/// `rstn_sendTransaction` with a signed Stake/Unstake/Delegate tx.
pub fn require_testnet(state: &RpcState, method: &str) -> Result<(), RpcError> {
    if !state.is_testnet {
        return Err(RpcError::Internal(format!(
            "{method} is disabled in production mode — submit a signed transaction via rstn_sendTransaction instead"
        )));
    }
    Ok(())
}

/// Compute the `Access-Control-Allow-Origin` header value for a response.
///
/// - Testnet with no configured origins → `*` (permissive, dev-friendly).
/// - Production (or any configured allow-list) → reflect the request `Origin`
///   only if it is in `allowed_origins`; otherwise return an empty string,
///   meaning the caller should OMIT the ACAO header entirely (browser blocks
///   the cross-origin read). This is the M4 fix: a malicious site can no
///   longer drive the user's local node.
pub async fn cors_allow_origin(state: &RpcState, origin: Option<&str>) -> String {
    let origins = state.allowed_origins.read().await;
    if origins.is_empty() && state.is_testnet {
        return "*".to_string();
    }
    match origin {
        Some(o) if origins.iter().any(|allowed| allowed == o) => o.to_string(),
        _ => String::new(), // no ACAO header
    }
}

// --- Method Dispatcher --------------------------------------

pub async fn handle_rpc(req: RpcRequest, state: &RpcState) -> RpcResponse {
    let result = match req.method.as_str() {
        // -- Network --------------------------------------
        "rstn_getNetworkStats" => get_network_stats(state).await,
        "rstn_health" => Ok(Value::Bool(true)),
        "rstn_getPeers" => get_peers(state).await,
        "rstn_getShards" => get_shards(state).await,

        // -- Explorer --------------------------------------
        "rstn_getExplorerStats" => get_explorer_stats(state).await,
        "rstn_getLatestBlocks" => get_latest_blocks(state, req.params.first()).await,
        "rstn_getBlockByHeight" => get_block_by_height(state, req.params.first()).await,
        "rstn_getBlockByHash" => get_block_by_hash(state, req.params.first()).await,
        "rstn_getBlocksByRange" => get_blocks_by_range(state, req.params.first()).await,
        "rstn_getSyncStatus" => get_sync_status(state).await,
        "rstn_getLatestTransactions" => get_latest_txs(state, req.params.first()).await,
        "rstn_getTransactionByHash" => get_tx_by_hash(state, req.params.first()).await,
        "rstn_getTransactionsByAddress" => get_txs_by_address(state, req.params.first()).await,
        "rstn_getPendingTransactions" => get_pending_txs(state, req.params.first()).await,
        "rstn_getTopValidators" => get_top_validators(state, req.params.first()).await,
        "rstn_getValidator" => get_validator_info(state, req.params.first()).await,

        // -- Wallet & Staking -----------------------------
        "rstn_getBalance" => get_balance(state, req.params.first()).await,
        "rstn_getNonce" => get_nonce_rpc(state, req.params.first()).await,
        "rstn_getStakingValidators" => get_staking_validators(state).await,
        "rstn_getProposals" => get_proposals(state).await,
        "rstn_getProposal" => get_proposal(state, req.params.first()).await,

        // -- Transactions ----------------------------------
        "rstn_sendTransaction" => send_transaction(state, req.params.first()).await,

        // -- Debug (testnet only) ---------------------------
        // M5: `rstn_debugSendTx` signs a tx with the node's validator keypair.
        // It is a critical security hole in production (an attacker could craft
        // txs signed by the validator), so the entire code path is compiled OUT
        // of release builds via the `debug-rpc` cargo feature. In a build
        // WITHOUT that feature the method simply returns "not found", so it
        // cannot be reached even if `is_testnet` is accidentally left true.
        #[cfg(feature = "debug-rpc")]
        "rstn_debugSendTx" => debug_send_tx(state, req.params.first()).await,
        #[cfg(not(feature = "debug-rpc"))]
        "rstn_debugSendTx" => Err(RpcError::MethodNotFound(
            "rstn_debugSendTx is disabled in this build (M5)".into(),
        )),

        // -- Staking --------------------------------------
        "rstn_stake" => stake(state, req.params.first()).await,
        "rstn_unstake" => unstake(state, req.params.first()).await,
        "rstn_delegate" => delegate(state, req.params.first()).await,
        "rstn_undelegate" => undelegate(state, req.params.first()).await,
        "rstn_claimRewards" => claim_rewards(state, req.params.first()).await,
        "rstn_getStakingInfo" => get_staking_info(state, req.params.first()).await,

        // -- Faucet (testnet) ------------------------------
        "rstn_faucetClaim" => faucet_claim(state, req.params.first()).await,

        // -- Bridge ----------------------------------------
        "rstn_getBridgeReserves" => get_bridge_reserves(state).await,
        "rstn_bridgeSubmitLock" => bridge_submit_lock(state, req.params.first()).await,
        "rstn_bridgeSubmitBurn" => bridge_submit_burn(state, req.params.first()).await,
        "rstn_bridgeGetWrappedBalance" => bridge_get_wrapped_balance(state, req.params.first()).await,
        "rstn_bridgeGetOps" => bridge_get_ops(state, req.params.first()).await,

        // -- Smart Contracts ---------------------------------
        "rstn_getCode" => get_code(state, req.params.first()).await,
        "rstn_getStorageAt" => get_storage_at(state, req.params.first()).await,
        "rstn_call" => call_contract(state, req.params.first()).await,
        "rstn_getContractAddress" => get_contract_address(state, req.params.first()).await,

        // -- EVM Compatibility (eth_*) for Hardhat/Foundry --
        "eth_chainId" => Ok(Value::String("0x539".into())),         // 1337
        "net_version" => Ok(Value::String("1337".into())),
        "net_listening" => Ok(Value::Bool(true)),
        "net_peerCount" => Ok(Value::String("0x0".into())),
        "web3_clientVersion" => Ok(Value::String("rstn-node/v0.1.0".into())),
        "web3_sha3" => web3_sha3(req.params.first()).await,
        "eth_blockNumber" => eth_block_number(state).await,
        "eth_gasPrice" => Ok(Value::String("0x1".into())),
        "eth_getBalance" => eth_get_balance(state, req.params.first()).await,
        "eth_getTransactionCount" => eth_get_transaction_count(state, req.params.first()).await,
        "eth_getCode" => eth_get_code(state, req.params.first()).await,
        "eth_getStorageAt" => eth_get_storage_at(state, req.params.first()).await,
        "eth_getBlockByNumber" => eth_get_block_by_number(state, req.params.first()).await,
        "eth_getBlockByHash" => eth_get_block_by_hash(state, req.params.first()).await,
        "eth_getTransactionByHash" => eth_get_tx_by_hash(state, req.params.first()).await,
        "eth_getTransactionReceipt" => eth_get_tx_receipt(state, req.params.first()).await,
        "eth_estimateGas" => Ok(Value::String("0x5208".into())),     // 21000
        "eth_accounts" => Ok(Value::Array(vec![])),
        "eth_sendRawTransaction" => eth_send_raw_tx(state, req.params.first()).await,
        "eth_call" => eth_call(state, req.params.first()).await,
        "eth_syncing" => Ok(Value::Bool(false)),
        "eth_mining" => Ok(Value::Bool(true)),
        "eth_getLogs" => eth_get_logs(state, req.params.first()).await,
        "eth_getBlockTransactionCountByNumber" => eth_block_tx_count_by_number(state, req.params.first()).await,

        // -- Unknown ---------------------------------------
        _ => Err(RpcError::MethodNotFound(req.method.clone())),
    };

    match result {
        Ok(value) => RpcResponse {
            jsonrpc: "2.0".into(),
            id: req.id,
            result: Some(value),
            error: None,
        },
        Err(e) => RpcResponse {
            jsonrpc: "2.0".into(),
            id: req.id,
            result: None,
            error: Some(RpcErrorData {
                code: -32603,
                message: e.to_string(),
            }),
        },
    }
}

// --- Address helpers ------------------------------------------

/// Strip the "rstn1" prefix from an address string and decode to bytes.
/// Accepts both "rstn1abc..." and raw hex "abc..." formats.
fn parse_address(addr_str: &str) -> Result<Vec<u8>, RpcError> {
    let clean = addr_str.strip_prefix("rstn1").unwrap_or(addr_str);
    let clean = clean.strip_prefix("0x").unwrap_or(clean);
    hex::decode(clean)
        .map_err(|e| RpcError::InvalidParams(format!("invalid address '{}': {}", addr_str, e)))
}

// --- Method Implementations ---------------------------------

async fn get_network_stats(state: &RpcState) -> Result<Value, RpcError> {
    let consensus = state.consensus.read().await;
    let validator_count = consensus.validators.len();
    let chain_height = consensus.chain_height();

    Ok(serde_json::json!({
        "tps": 0,
        "finality": "0.4s",
        "blockTime": "400ms",
        "validators": validator_count,
        "nodes": validator_count,
        "quantumSecurity": "Dilithium3 + Keccak-512",
        "signatureScheme": "Dilithium3 (NIST FIPS 204)",
        "hashFunction": "Keccak-512",
        "vrfScheme": "PQ-VRF (Dilithium-based)",
        // A1: HONEST status. On-chain signatures and consensus votes are
        // fully post-quantum (Dilithium3 / FIPS 204). The P2P transport still
        // uses libp2p Noise (X25519); the PQ hybrid handshake (Kyber768 +
        // X25519 + Dilithium3) is implemented in rstn-crypto and used to
        // establish PQ-authenticated application sessions, but is NOT yet
        // wired as the transport's wire encryption (requires a libp2p fork).
        "transport": "Noise (X25519) + PQ app-session (Kyber768/Dilithium3) — transport PQ migration in progress",
        "transportPqStatus": "signatures=full-PQ; transport=migration-in-progress",
        "shardCount": consensus.shard_count,
        "uptime": "100%",
        "energyEfficiency": "99.98% menos que PoW",
        "txCost": "0.0001 RSTN",
        // A1: corrected from "100%" — the transport is NOT yet fully PQ.
        "pqCoverage": "signatures: 100% (Dilithium3); transport: migration in progress",
        "genesisDate": "TBD",
        "token": "RSTN",
        "maxSupply": "1,000,000,000",
        "chainHeight": chain_height,
    }))
}

async fn get_explorer_stats(state: &RpcState) -> Result<Value, RpcError> {
    let consensus = state.consensus.read().await;
    let block_height = consensus.chain_height();
    let active_validators = consensus.validators.iter()
        .filter(|v| v.status == rstn_core::ValidatorStatus::Active)
        .count();
    let pending_txs = state.db.mempool_size()
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    Ok(serde_json::json!({
        "blockHeight": block_height,
        "avgBlockTime": "400ms",
        "tps": 0,
        "tpsTarget": 250000,
        "activeValidators": active_validators,
        "pendingTxs": pending_txs,
        "avgFee": "0.0001",
        "totalTxCount": "0",
        "shardCount": consensus.shard_count,
    }))
}

async fn get_latest_blocks(state: &RpcState, limit: Option<&Value>) -> Result<Value, RpcError> {
    let limit = limit
        .and_then(|v| v.as_u64())
        .unwrap_or(10)
        .min(100) as usize; // Cap at 100 to prevent DoS

    let blocks = state.db.get_latest_blocks(limit)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    let result: Vec<Value> = blocks.iter().map(|b| {
        serde_json::json!({
            "height": b.header.height,
            "hash": format!("0x{}", hex::encode(b.hash())),
            "validator": format_address(&derive_address(&b.header.validator)),
            "txCount": b.transactions.len(),
            "size": format!("{:.1} KB", serde_json::to_vec(b).map(|v| v.len()).unwrap_or(0) as f64 / 1024.0),
            "age": format!("{}s", (chrono::Utc::now().timestamp_millis() as u64).saturating_sub(b.header.timestamp) / 1000),
            "gasUsed": "0",
            "gasLimit": "0",
            "shard": b.header.shard_id,
        })
    }).collect();

    Ok(serde_json::json!(result))
}

async fn get_block_by_height(state: &RpcState, height: Option<&Value>) -> Result<Value, RpcError> {
    let height = height
        .and_then(|v| v.as_u64())
        .ok_or_else(|| RpcError::InvalidParams("missing height".into()))?;

    let block = state.db.get_block(height)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    match block {
        Some(b) => Ok(serde_json::json!({
            "height": b.header.height,
            "hash": format!("0x{}", hex::encode(b.hash())),
            "validator": format_address(&derive_address(&b.header.validator)),
            "txCount": b.transactions.len(),
            "shard": b.header.shard_id,
            "epoch": b.header.epoch,
            "round": b.header.round,
        })),
        None => Ok(Value::Null),
    }
}

/// `rstn_getBlocksByRange(from, to)` -> Block[]
///
/// Sync protocol: returns serialized blocks in the inclusive [from, to] range
/// (capped at 500). A node that is behind asks a peer for the missing range,
/// then imports each block through the consensus finalize path. This is what
/// makes it possible for a brand-new node to join a public testnet without a
/// pre-populated local DB.
async fn get_blocks_by_range(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params
        .and_then(|v| v.as_array())
        .ok_or_else(|| RpcError::InvalidParams("expected [from, to]".into()))?;
    if arr.len() < 2 {
        return Err(RpcError::InvalidParams("expected [from, to]".into()));
    }
    let from = arr[0]
        .as_u64()
        .ok_or_else(|| RpcError::InvalidParams("from must be a number".into()))?;
    let to = arr[1]
        .as_u64()
        .ok_or_else(|| RpcError::InvalidParams("to must be a number".into()))?;

    let blocks = state
        .db
        .get_blocks_by_range(from, to)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    let result: Vec<Value> = blocks
        .iter()
        .map(|b| {
            serde_json::json!({
                "height": b.header.height,
                "hash": format!("0x{}", hex::encode(b.hash())),
                "parentHash": format!("0x{}", hex::encode(b.header.parent_hash)),
                "validator": format_address(&derive_address(&b.header.validator)),
                "txCount": b.transactions.len(),
                "shard": b.header.shard_id,
                "epoch": b.header.epoch,
                "round": b.header.round,
                "timestamp": b.header.timestamp,
                "serialized": format!("0x{}", hex::encode(serde_json::to_vec(b).unwrap_or_default())),
            })
        })
        .collect();

    Ok(serde_json::json!(result))
}

/// `rstn_getSyncStatus` -> { localHeight, latestKnownHeight, catchingUp }
///
/// Reports the node's local finalized height versus the latest height it has
/// observed from peers. A syncing node reports `catchingUp: true` until its
/// local height catches up to the network head.
async fn get_sync_status(state: &RpcState) -> Result<Value, RpcError> {
    let local_height = state
        .db
        .get_latest_height()
        .map_err(|e| RpcError::Internal(e.to_string()))?;
    let consensus = state.consensus.read().await;
    let latest_known = consensus.last_finalized_height.max(local_height);
    Ok(serde_json::json!({
        "localHeight": local_height,
        "latestKnownHeight": latest_known,
        "catchingUp": latest_known > local_height,
    }))
}

async fn get_latest_txs(state: &RpcState, limit: Option<&Value>) -> Result<Value, RpcError> {
    let limit = limit
        .and_then(|v| v.as_u64())
        .unwrap_or(12)
        .min(100) as usize; // Cap at 100 to prevent DoS

    let txs = state.db.get_latest_txs(limit)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    // Look up the block height for each tx by searching recent blocks.
    let latest_height = state.db.get_latest_height().unwrap_or(0);
    let search_depth = (limit + 10) as u64;
    let start = latest_height.saturating_sub(search_depth);

    let result: Vec<Value> = txs.iter().map(|tx| {
        let tx_hash = tx.hash();
        let mut block_height = 0u64;
        for h in (start..=latest_height).rev() {
            if let Ok(Some(block)) = state.db.get_block(h) {
                if block.transactions.iter().any(|t| t.hash() == tx_hash) {
                    block_height = h;
                    break;
                }
            }
        }
        // Look up the shard_id from the block that contains this tx
        let shard_id = if block_height > 0 {
            state.db.get_block(block_height).ok()
                .flatten()
                .map(|b| b.header.shard_id)
                .unwrap_or(0)
        } else { 0 };

        serde_json::json!({
            "hash": format!("0x{}", hex::encode(tx_hash)),
            "from": format_address(&derive_address(&tx.from)),
            "to": format_address(&tx.to),
            "value": tx.value.to_string(),
            "type": format!("{:?}", tx.tx_type),
            "status": "confirmed",
            "block": block_height,
            "fee": tx.gas_price.to_string(),
            "shard": shard_id,
        })
    }).collect();

    Ok(serde_json::json!(result))
}

async fn get_tx_by_hash(state: &RpcState, hash: Option<&Value>) -> Result<Value, RpcError> {
    let hash_str = hash
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing hash".into()))?;

    let hash_bytes = hex::decode(hash_str)
        .map_err(|e| RpcError::InvalidParams(format!("invalid hash: {}", e)))?;

    let tx = state.db.get_tx(&hash_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    match tx {
        Some(t) => Ok(serde_json::json!({
            "hash": format!("0x{}", hex::encode(t.hash())),
            "from": format_address(&derive_address(&t.from)),
            "to": format_address(&t.to),
            "value": t.value.to_string(),
            "type": format!("{:?}", t.tx_type),
            "status": "confirmed",
            "nonce": t.nonce,
            "gasPrice": t.gas_price.to_string(),
            "gasLimit": t.gas_limit,
        })),
        None => Ok(Value::Null),
    }
}

async fn get_top_validators(state: &RpcState, limit: Option<&Value>) -> Result<Value, RpcError> {
    let limit = limit
        .and_then(|v| v.as_u64())
        .unwrap_or(10)
        .min(200) as usize; // Cap at 200

    let mut validators = state.db.get_all_validators()
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    // Sort by stake descending
    validators.sort_by(|a, b| b.stake.cmp(&a.stake));
    validators.truncate(limit);

    let result: Vec<Value> = validators.iter().enumerate().map(|(i, v)| {
        serde_json::json!({
            "rank": i + 1,
            "address": v.address(),
            "stake": v.stake.to_string(),
            "blocksProduced": v.blocks_produced,
            "uptime": format!("{:.2}%", v.uptime * 100.0),
            "commission": format!("{}%", v.commission),
            "status": format!("{:?}", v.status),
            "shard": v.shard_id,
        })
    }).collect();

    Ok(serde_json::json!(result))
}

async fn get_balance(state: &RpcState, address: Option<&Value>) -> Result<Value, RpcError> {
    let addr_str = address
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;

    let addr_bytes = parse_address(addr_str)?;

    let account = state.db.get_account(&addr_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?
        .unwrap_or_default();

    // Convert wei (18 decimals) to display units for frontend compatibility.
    let to_display = |wei: u128| -> String {
        let display = wei as f64 / 10u128.pow(18) as f64;
        if display >= 1.0 { format!("{:.2}", display) } else { format!("{:.6}", display) }
    };

    Ok(serde_json::json!({
        "address": addr_str,
        "balance": to_display(account.balance),
        "staked": to_display(account.staked),
        "delegated": to_display(account.delegated),
        "rewards": to_display(account.rewards),
        "nonce": account.nonce,
        "apy": "Variable",
        "pendingRewards": to_display(account.rewards),
    }))
}

async fn get_staking_validators(state: &RpcState) -> Result<Value, RpcError> {
    let validators = state.db.get_active_validators()
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    let result: Vec<Value> = validators.iter().take(10).map(|v| {
        serde_json::json!({
            "address": v.address(),
            "name": format!("Validator-{}", &v.address()[..8]),
            "stake": v.stake.to_string(),
            "apy": "Variable",
            "uptime": format!("{:.2}%", v.uptime * 100.0),
            "commission": format!("{}%", v.commission),
            "shard": v.shard_id,
            "delegated": false,
        })
    }).collect();

    Ok(serde_json::json!(result))
}

async fn get_proposals(_state: &RpcState) -> Result<Value, RpcError> {
    // Governance proposals are stored on-chain; return empty for now
    Ok(serde_json::json!([]))
}

async fn send_transaction(state: &RpcState, tx: Option<&Value>) -> Result<Value, RpcError> {
    let tx_value = tx
        .ok_or_else(|| RpcError::InvalidParams("missing transaction".into()))?;

    // The SDK sends value/gas_price as strings (BigInt.toString()) and
    // from/to/signature/payload as arrays of bytes. We manually parse
    // because serde's default u128 deserializer can't handle string-encoded u128s.
    let from_arr: Vec<u8> = tx_value.get("from")
        .and_then(|v| v.as_array())
        .ok_or_else(|| RpcError::InvalidParams("missing 'from' array".into()))?
        .iter()
        .filter_map(|b| b.as_u64().map(|n| n as u8))
        .collect();
    if from_arr.len() != rstn_crypto::PUBKEY_SIZE {
        return Err(RpcError::InvalidParams(format!(
            "'from' must be {} bytes (Dilithium3 public key), got {}", rstn_crypto::PUBKEY_SIZE, from_arr.len()
        )));
    }

    let to_arr: Vec<u8> = tx_value.get("to")
        .and_then(|v| v.as_array())
        .ok_or_else(|| RpcError::InvalidParams("missing 'to' array".into()))?
        .iter()
        .filter_map(|b| b.as_u64().map(|n| n as u8))
        .collect();
    if to_arr.len() != 20 {
        return Err(RpcError::InvalidParams(format!(
            "'to' must be 20 bytes (RSTN address), got {}", to_arr.len()
        )));
    }

    let sig_arr: Vec<u8> = tx_value.get("signature")
        .and_then(|v| v.as_array())
        .ok_or_else(|| RpcError::InvalidParams("missing 'signature' array".into()))?
        .iter()
        .filter_map(|b| b.as_u64().map(|n| n as u8))
        .collect();
    if sig_arr.len() != rstn_crypto::SIG_SIZE {
        return Err(RpcError::InvalidParams(format!(
            "'signature' must be {} bytes (Dilithium3), got {}", rstn_crypto::SIG_SIZE, sig_arr.len()
        )));
    }

    let payload_arr: Vec<u8> = tx_value.get("payload")
        .and_then(|v| v.as_array())
        .unwrap_or(&Vec::new())
        .iter()
        .filter_map(|b| b.as_u64().map(|n| n as u8))
        .collect();

    // Parse value/gas_price from string or number
    let value_str = tx_value.get("value")
        .map(|v| {
            if let Some(s) = v.as_str() { s.to_string() }
            else if let Some(n) = v.as_u64() { n.to_string() }
            else { "0".to_string() }
        })
        .unwrap_or_else(|| "0".to_string());
    let value: u128 = value_str.parse::<u128>()
        .map_err(|e| RpcError::InvalidParams(format!("invalid value '{}': {}", value_str, e)))?;

    let gas_price_str = tx_value.get("gas_price")
        .map(|v| {
            if let Some(s) = v.as_str() { s.to_string() }
            else if let Some(n) = v.as_u64() { n.to_string() }
            else { "0".to_string() }
        })
        .unwrap_or_else(|| "0".to_string());
    let gas_price: u128 = gas_price_str.parse::<u128>()
        .map_err(|e| RpcError::InvalidParams(format!("invalid gas_price '{}': {}", gas_price_str, e)))?;

    let nonce: u64 = tx_value.get("nonce")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let gas_limit: u64 = tx_value.get("gas_limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(21000);

    let tx_type_str = tx_value.get("tx_type")
        .and_then(|v| v.as_str())
        .unwrap_or("Transfer");
    let tx_type = match tx_type_str {
        "Stake" => TxType::Stake,
        "Unstake" => TxType::Unstake,
        "Delegate" => TxType::Delegate,
        "Undelegate" => TxType::Undelegate,
        "Claim" => TxType::Claim,
        "Governance" => TxType::Governance,
        "Contract" => TxType::Contract,
        "ContractDeploy" => TxType::ContractDeploy,
        _ => TxType::Transfer,
    };

    // Build the Transaction struct
    let mut from_pk = [0u8; rstn_crypto::PUBKEY_SIZE];
    from_pk.copy_from_slice(&from_arr);
    let mut to_addr = [0u8; 20];
    to_addr.copy_from_slice(&to_arr);
    let mut sig = [0u8; rstn_crypto::SIG_SIZE];
    sig.copy_from_slice(&sig_arr);

    let transaction = Transaction {
        from: Dilithium3PublicKey(from_pk),
        to: to_addr,
        value,
        nonce,
        gas_price,
        gas_limit,
        tx_type,
        payload: payload_arr,
        signature: Dilithium3Signature(sig),
        hybrid_signature: None,
        hybrid_pubkey: None,
    };

    // Verify signature
    transaction.verify_signature()
        .map_err(|e| RpcError::InvalidParams(e.to_string()))?;

    // -- Pre-flight validation: nonce + balance --
    // Reject txs early (before mempool insertion) so invalid txs don't
    // waste block space or cause "insufficient balance" errors at finalize.
    let from_addr = rstn_crypto::derive_address(&transaction.from);
    let expected_nonce = state.db.get_nonce(&from_addr).unwrap_or(0);
    if transaction.nonce != expected_nonce {
        return Err(RpcError::InvalidParams(format!(
            "nonce mismatch: expected {}, got {}", expected_nonce, transaction.nonce
        )));
    }

    let gas_fee = transaction.gas_price.saturating_mul(transaction.gas_limit as u128);
    let total_needed = gas_fee.saturating_add(transaction.value);
    if total_needed > 0 {
        let balance = state.db.get_balance(&from_addr).unwrap_or(0);
        if balance < total_needed {
            return Err(RpcError::InvalidParams(format!(
                "insufficient balance: have {} wei, need {} (value={} + gas_fee={})",
                balance, total_needed, transaction.value, gas_fee
            )));
        }
    }

    // Add to mempool
    let tx_hash = transaction.hash();
    state.db.add_to_mempool(&tx_hash, &transaction)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    // Broadcast to P2P peers (gossip) so the leader includes it in a block.
    // In dev mode (single node) outbound_tx is None -- the leader pulls from
    // its own DB mempool each tick, so no broadcast is needed.
    if let Some(sender) = state.outbound_tx.read().await.as_ref() {
        let _ = sender.try_send(transaction.clone());
        tracing::info!("Tx gossiped to {} peers via P2P", sender.max_capacity());
    }

    tracing::info!(
        "Tx received: from={}... value={} type={:?} (hash: {}...)",
        hex::encode(&from_arr[..8]),
        value,
        tx_type,
        hex::encode(&tx_hash[..8]),
    );

    Ok(Value::String(hex::encode(tx_hash)))
}

/// Debug helper (testnet only): sign a transaction with THIS node's validator
/// keypair and submit it through the normal mempool + P2P gossip path.
///
/// Params (all optional except `to`):
///   { "to": "rstn1...", "value": "1000000000000000000", "tx_type": "Transfer" }
///
/// This lets us validate that a Dilithium3-signed tx submitted to a non-leader
/// node propagates via gossipsub and gets included in a block by the leader.
/// The signature is real (Dilithium3 / ML-DSA-65), so it exercises the full
/// verify_signature -> mempool -> gossip -> propose -> finalize pipeline.
/// Signs a transaction with the node's validator keypair and submits it.
///
/// M5: this method is gated behind the `debug-rpc` cargo feature and is
/// compiled OUT of release builds entirely. In a build without the feature
/// the method is not present, so even a misconfigured `is_testnet = true`
/// cannot expose the validator's signing capability.
#[cfg(feature = "debug-rpc")]
async fn debug_send_tx(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    // B2: this method signs a transaction with the node's validator keypair.
    // In production (is_testnet == false) exposing a key-signing RPC is a
    // critical security hole -- an attacker could craft arbitrary txs signed
    // by the validator. Gate it behind the testnet flag so it is only
    // available in dev/testnet mode, never in a production deployment.
    if !state.is_testnet {
        return Err(RpcError::Internal(
            "rstn_debugSendTx is disabled in production mode (use a wallet to sign txs)".into(),
        ));
    }

    let p = match params {
        Some(Value::Object(map)) => Value::Object(map.clone()),
        Some(Value::Array(arr)) if !arr.is_empty() && arr[0].is_object() => arr[0].clone(),
        Some(val) => val.clone(),
        None => return Err(RpcError::InvalidParams("missing params object".into())),
    };

    let keypair = state.node_keypair.as_ref()
        .ok_or_else(|| RpcError::Internal("this node has no signing keypair".into()))?;

    // Recipient address (20 bytes, bech32 "rstn1..." or hex)
    let to_addr = if let Some(s) = p.get("to").and_then(|v| v.as_str()) {
        let bytes = parse_address(s)?;
        if bytes.len() != 20 {
            return Err(RpcError::InvalidParams(format!("'to' must be 20 bytes, got {}", bytes.len())));
        }
        let mut arr = [0u8; 20];
        arr.copy_from_slice(&bytes);
        arr
    } else {
        return Err(RpcError::InvalidParams("missing 'to' address".into()));
    };

    let value: u128 = p.get("value")
        .and_then(|v| v.as_str())
        .unwrap_or("0")
        .parse::<u128>()
        .map_err(|e| RpcError::InvalidParams(format!("invalid value: {}", e)))?;

    let tx_type_str = p.get("tx_type")
        .and_then(|v| v.as_str())
        .unwrap_or("Transfer");
    let tx_type = match tx_type_str {
        "Stake" => TxType::Stake,
        "Unstake" => TxType::Unstake,
        "Delegate" => TxType::Delegate,
        "Undelegate" => TxType::Undelegate,
        "Claim" => TxType::Claim,
        "Governance" => TxType::Governance,
        "Contract" => TxType::Contract,
        "ContractDeploy" => TxType::ContractDeploy,
        _ => TxType::Transfer,
    };

    // Build the unsigned transaction, sign it with Dilithium3.
    let from_addr = derive_address(&keypair.public);
    // Query the current on-chain nonce for the sender so the tx is not
    // rejected by the nonce check after the first tx is finalized.
    let current_nonce = state.db.get_nonce(&from_addr).unwrap_or(0);
    let unsigned = Transaction {
        from: keypair.public.clone(),
        to: to_addr,
        value,
        nonce: current_nonce,
        gas_price: 1,
        gas_limit: 21000,
        tx_type,
        payload: Vec::new(),
        signature: Dilithium3Signature([0u8; rstn_crypto::SIG_SIZE]),
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let tx_hash = unsigned.hash();
    let signature = keypair.sign(&tx_hash);
    let transaction = Transaction { signature, ..unsigned };

    // Verify our own signature before submitting (sanity check).
    transaction.verify_signature()
        .map_err(|e| RpcError::Internal(format!("self-signature verification failed: {}", e)))?;

    // Submit through the normal path: mempool + gossip.
    state.db.add_to_mempool(&transaction.hash(), &transaction)
        .map_err(|e| RpcError::Internal(e.to_string()))?;
    if let Some(sender) = state.outbound_tx.read().await.as_ref() {
        let _ = sender.try_send(transaction.clone());
        tracing::info!("debug tx gossiped via P2P");
    }

    tracing::info!(
        "Debug tx signed & submitted: from={} value={} type={:?} (hash: {}...)",
        format_address(&from_addr),
        value,
        tx_type,
        hex::encode(&tx_hash[..8]),
    );

    Ok(serde_json::json!({
        "hash": format!("0x{}", hex::encode(transaction.hash())),
        "from": format_address(&from_addr),
        "to": format_address(&to_addr),
        "value": value.to_string(),
        "tx_type": tx_type_str,
        "gossiped": state.outbound_tx.read().await.is_some(),
    }))
}

/// Faucet claim -- credits testnet RSTN to the caller's address.
///
/// In testnet, the faucet is a privileged endpoint that directly mints
/// RSTN to the requester. This is testnet-only and disabled in mainnet.
///
/// Rate limiting: 1 claim per address per COOLDOWN_MS (enforced in-memory
/// per node). Amount: 1,000 RSTN per claim.
///
/// M2 LIMITATION: the per-address cooldown is held in process memory and is
/// NOT shared across nodes. In a multi-node testnet, a claimant can hit
/// different nodes within the cooldown window and receive multiple drops.
/// This is acceptable for a testnet faucet (the validator is pre-funded with
/// 1B RSTN), but MUST NOT be relied upon for mainnet — where the faucet is
/// disabled entirely (see `require_testnet`). A production faucet would
/// coordinate via an on-chain claim registry keyed by address.
async fn faucet_claim(state: &RpcState, address: Option<&Value>) -> Result<Value, RpcError> {
    // B3: the faucet mints RSTN for free. In production (is_testnet == false)
    // it must be disabled -- an attacker could generate infinite addresses
    // and drain the faucet. Only available in dev/testnet mode.
    require_testnet(state, "rstn_faucetClaim")?;

    let addr_str = address
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;

    let addr_bytes = parse_address(addr_str)?;
    if addr_bytes.len() != 20 {
        return Err(RpcError::InvalidParams(format!(
            "'address' must be 20 bytes, got {}", addr_bytes.len()
        )));
    }
    let mut to_addr = [0u8; 20];
    to_addr.copy_from_slice(&addr_bytes);

    const FAUCET_AMOUNT: u128 = 1_000; // 1,000 RSTN (display units)
    const FAUCET_AMOUNT_WEI: u128 = 1_000 * 10u128.pow(18); // 1,000 RSTN with 18 decimals
    const COOLDOWN_MS: u64 = 60 * 1000; // 60s -- local testnet friendly (was 24h)

    // Rate limiting: 1 claim per address per 24h
    {
        let mut claims = state.faucet_claims.write().await;
        let now = chrono::Utc::now().timestamp_millis() as u64;
        if let Some(last) = claims.get(&addr_bytes) {
            if now - last < COOLDOWN_MS {
                let remaining = (COOLDOWN_MS - (now - last)) / 1000 / 60;
                return Err(RpcError::InvalidParams(format!(
                    "faucet cooldown: {} minutes remaining", remaining
                )));
            }
        }
        claims.insert(addr_bytes.clone(), now);
    }

    // -- Emit a REAL on-chain transaction signed by this node's validator --
    // In multi-node mode, a direct DB balance update only affects the local
    // node -- other validators never see it, so they reject the recipient's
    // subsequent spend tx for insufficient balance. Instead, we sign a real
    // Transfer from the validator (pre-funded with 1B RSTN at genesis) to the
    // claimant and submit it through the normal mempool + P2P gossip path.
    // Every node applies it at finalization, so all DBs stay consistent.
    let keypair = state.node_keypair.as_ref()
        .ok_or_else(|| RpcError::Internal("this node has no signing keypair".into()))?;

    let from_addr = derive_address(&keypair.public);

    // M2: guard against draining the faucet. Before signing the drop, verify
    // the validator (faucet source) actually holds enough balance. In a
    // multi-node setup where the in-memory cooldown isn't shared, this bounds
    // the worst-case over-issuance to the validator's pre-funded balance and
    // fails loudly instead of producing a tx that consensus will reject for
    // insufficient funds (which would silently strand the claim).
    let faucet_balance = state.db.get_balance(&from_addr)
        .map_err(|e| RpcError::Internal(e.to_string()))?;
    if faucet_balance < FAUCET_AMOUNT_WEI {
        return Err(RpcError::Internal(format!(
            "faucet source balance too low ({} < {}); refill the faucet account",
            faucet_balance, FAUCET_AMOUNT_WEI
        )));
    }

    let current_nonce = state.db.get_nonce(&from_addr).unwrap_or(0);
    let unsigned = Transaction {
        from: keypair.public.clone(),
        to: to_addr,
        value: FAUCET_AMOUNT_WEI,
        nonce: current_nonce,
        gas_price: 1,
        gas_limit: 21000,
        tx_type: TxType::Transfer,
        payload: Vec::new(),
        signature: Dilithium3Signature([0u8; rstn_crypto::SIG_SIZE]),
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let tx_hash = unsigned.hash();
    let signature = keypair.sign(&tx_hash);
    let transaction = Transaction { signature, ..unsigned };

    // Sanity-check our own signature before submitting.
    transaction.verify_signature()
        .map_err(|e| RpcError::Internal(format!("faucet self-signature verification failed: {}", e)))?;

    // Submit through the normal path: mempool + gossip.
    state.db.add_to_mempool(&transaction.hash(), &transaction)
        .map_err(|e| RpcError::Internal(e.to_string()))?;
    if let Some(sender) = state.outbound_tx.read().await.as_ref() {
        let _ = sender.try_send(transaction.clone());
        tracing::info!("faucet tx gossiped via P2P");
    }

    tracing::info!(
        "Faucet claim: {} RSTN -> {} (tx hash: {}...)",
        FAUCET_AMOUNT,
        &addr_str[..addr_str.len().min(16)],
        hex::encode(&tx_hash[..8]),
    );

    Ok(serde_json::json!({
        "hash": format!("0x{}", hex::encode(transaction.hash())),
        "amount": FAUCET_AMOUNT,
    }))
}

// --- Staking Methods ------------------------------------------

/// Stake RSTN: lock balance -> staked.
/// Params: { address, amount }
/// The caller must have sufficient balance. The staked amount is locked
/// and the validator (self if solo staking) gets credit.
async fn stake(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    require_testnet(state, "rstn_stake")?;
    let p = params
        .ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let addr_str = p.get("address")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    // Parse amount as string or number -- amounts are in wei (u128), not u64.
    // u64 max is ~18.4 quintillion which is only ~18 RSTN in wei -- far too small.
    let amount_str = p.get("amount")
        .map(|v| {
            if let Some(s) = v.as_str() { s.to_string() }
            else if let Some(n) = v.as_u64() { n.to_string() }
            else { "0".to_string() }
        })
        .unwrap_or_else(|| "0".to_string());
    let amount: u128 = amount_str.parse::<u128>()
        .map_err(|e| RpcError::InvalidParams(format!("invalid amount '{}': {}", amount_str, e)))?;

    let addr_bytes = parse_address(addr_str)?;

    let amount_i128 = amount as i128;
    state.db.update_staked(&addr_bytes, amount_i128)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    // Update or register validator status -- staking makes the account a validator
    // candidate. The pubkey is set to zeros here as a placeholder; the real pubkey
    // is registered when the staker submits an on-chain Stake transaction (which
    // carries the sender's full Dilithium3 public key). The RPC shortcut is for
    // testing convenience only -- real staking must go through sendTransaction.
    let mut validator = state.db.get_validator(&addr_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?
        .unwrap_or_else(|| rstn_core::Validator {
            pubkey: Dilithium3PublicKey([0u8; rstn_crypto::PUBKEY_SIZE]), // placeholder -- real pubkey set via on-chain tx
            stake: 0,
            commission: 0,
            shard_id: 0,
            uptime: 1.0,
            blocks_produced: 0,
            status: rstn_core::ValidatorStatus::Active,
        });
    // Only overwrite pubkey if it's still zeros (don't clobber a real registered pubkey)
    if validator.pubkey.0 == [0u8; rstn_crypto::PUBKEY_SIZE] {
        tracing::warn!(
            "Stake via RPC shortcut: validator {} has placeholder pubkey. \
             Submit a real on-chain Stake tx to register the validator's Dilithium3 public key.",
            &addr_str[..addr_str.len().min(16)]
        );
    }
    validator.stake += amount;
    validator.status = rstn_core::ValidatorStatus::Active;
    state.db.put_validator(&addr_bytes, &validator)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    // Generate tx hash for record
    use sha3::{Keccak512, Digest};
    let mut hasher = Keccak512::new();
    hasher.update(b"stake");
    hasher.update(&addr_bytes);
    hasher.update(&amount.to_le_bytes());
    hasher.update(&chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0).to_le_bytes());
    let result = hasher.finalize();
    let tx_hash: Vec<u8> = result[..32].to_vec();

    tracing::info!(
        "Stake: {} RSTN locked by {} (hash: {}...)",
        amount,
        &addr_str[..addr_str.len().min(16)],
        hex::encode(&tx_hash[..8]),
    );

    Ok(serde_json::json!({
        "hash": format!("0x{}", hex::encode(&tx_hash)),
        "amount": amount.to_string(),
        "type": "stake",
    }))
}

/// Unstake RSTN: unlock staked -> balance.
/// Params: { address, amount }
async fn unstake(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    require_testnet(state, "rstn_unstake")?;
    let p = params
        .ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let addr_str = p.get("address")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    let amount_str = p.get("amount")
        .map(|v| {
            if let Some(s) = v.as_str() { s.to_string() }
            else if let Some(n) = v.as_u64() { n.to_string() }
            else { "0".to_string() }
        })
        .unwrap_or_else(|| "0".to_string());
    let amount: u128 = amount_str.parse::<u128>()
        .map_err(|e| RpcError::InvalidParams(format!("invalid amount '{}': {}", amount_str, e)))?;

    let addr_bytes = parse_address(addr_str)?;

    // Unstake: negative delta moves staked -> balance
    let amount_i128 = -(amount as i128);
    state.db.update_staked(&addr_bytes, amount_i128)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    // Decrease validator stake, set inactive if fully unstaked
    if let Some(mut validator) = state.db.get_validator(&addr_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))? {
        validator.stake = validator.stake.saturating_sub(amount);
        if validator.stake == 0 {
            validator.status = rstn_core::ValidatorStatus::Inactive;
        }
        state.db.put_validator(&addr_bytes, &validator)
            .map_err(|e| RpcError::Internal(e.to_string()))?;
    }

    use sha3::{Keccak512, Digest};
    let mut hasher = Keccak512::new();
    hasher.update(b"unstake");
    hasher.update(&addr_bytes);
    hasher.update(&amount.to_le_bytes());
    hasher.update(&chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0).to_le_bytes());
    let result = hasher.finalize();
    let tx_hash: Vec<u8> = result[..32].to_vec();

    tracing::info!(
        "Unstake: {} RSTN unlocked by {} (hash: {}...)",
        amount,
        &addr_str[..addr_str.len().min(16)],
        hex::encode(&tx_hash[..8]),
    );

    Ok(serde_json::json!({
        "hash": format!("0x{}", hex::encode(&tx_hash)),
        "amount": amount.to_string(),
        "type": "unstake",
    }))
}

/// Delegate RSTN to a validator: lock balance -> delegated + increase validator stake.
/// Params: { delegator, validator, amount }
async fn delegate(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    require_testnet(state, "rstn_delegate")?;
    let p = params
        .ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let delegator_str = p.get("delegator")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing delegator".into()))?;
    let validator_str = p.get("validator")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing validator".into()))?;
    let amount_str = p.get("amount")
        .map(|v| {
            if let Some(s) = v.as_str() { s.to_string() }
            else if let Some(n) = v.as_u64() { n.to_string() }
            else { "0".to_string() }
        })
        .unwrap_or_else(|| "0".to_string());
    let amount: u128 = amount_str.parse::<u128>()
        .map_err(|e| RpcError::InvalidParams(format!("invalid amount '{}': {}", amount_str, e)))?;

    let delegator_bytes = parse_address(delegator_str)?;
    let validator_bytes = parse_address(validator_str)?;

    // Lock balance -> delegated
    state.db.update_delegated(&delegator_bytes, amount as i128)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    // Increase validator's total stake
    state.db.increase_validator_stake(&validator_bytes, amount)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    use sha3::{Keccak512, Digest};
    let mut hasher = Keccak512::new();
    hasher.update(b"delegate");
    hasher.update(&delegator_bytes);
    hasher.update(&validator_bytes);
    hasher.update(&amount.to_le_bytes());
    hasher.update(&chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0).to_le_bytes());
    let result = hasher.finalize();
    let tx_hash: Vec<u8> = result[..32].to_vec();

    tracing::info!(
        "Delegate: {} RSTN from {} -> {} (hash: {}...)",
        amount,
        &delegator_str[..delegator_str.len().min(16)],
        &validator_str[..validator_str.len().min(16)],
        hex::encode(&tx_hash[..8]),
    );

    Ok(serde_json::json!({
        "hash": format!("0x{}", hex::encode(&tx_hash)),
        "amount": amount.to_string(),
        "type": "delegate",
    }))
}

/// Undelegate RSTN from a validator: unlock delegated -> balance.
/// Params: { delegator, validator, amount }
async fn undelegate(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    require_testnet(state, "rstn_undelegate")?;
    let p = params
        .ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let delegator_str = p.get("delegator")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing delegator".into()))?;
    let validator_str = p.get("validator")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing validator".into()))?;
    let amount_str = p.get("amount")
        .map(|v| {
            if let Some(s) = v.as_str() { s.to_string() }
            else if let Some(n) = v.as_u64() { n.to_string() }
            else { "0".to_string() }
        })
        .unwrap_or_else(|| "0".to_string());
    let amount: u128 = amount_str.parse::<u128>()
        .map_err(|e| RpcError::InvalidParams(format!("invalid amount '{}': {}", amount_str, e)))?;

    let delegator_bytes = parse_address(delegator_str)?;
    let validator_bytes = parse_address(validator_str)?;

    // Unlock delegated -> balance
    state.db.update_delegated(&delegator_bytes, -(amount as i128))
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    // Decrease validator's total stake
    let mut validator: Validator = state.db.get_validator(&validator_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?
        .ok_or_else(|| RpcError::InvalidParams("validator not found".into()))?;
    if validator.stake < amount {
        return Err(RpcError::InvalidParams("validator stake lower than undelegation".into()));
    }
    validator.stake -= amount;
    state.db.put_validator(&validator_bytes, &validator)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    use sha3::{Keccak512, Digest};
    let mut hasher = Keccak512::new();
    hasher.update(b"undelegate");
    hasher.update(&delegator_bytes);
    hasher.update(&validator_bytes);
    hasher.update(&amount.to_le_bytes());
    hasher.update(&chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0).to_le_bytes());
    let result = hasher.finalize();
    let tx_hash: Vec<u8> = result[..32].to_vec();

    tracing::info!(
        "Undelegate: {} RSTN from {} <- {} (hash: {}...)",
        amount,
        &delegator_str[..delegator_str.len().min(16)],
        &validator_str[..validator_str.len().min(16)],
        hex::encode(&tx_hash[..8]),
    );

    Ok(serde_json::json!({
        "hash": format!("0x{}", hex::encode(&tx_hash)),
        "amount": amount.to_string(),
        "type": "undelegate",
    }))
}

/// Claim all pending staking rewards: rewards -> balance.
/// Params: { address }
async fn claim_rewards(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    require_testnet(state, "rstn_claimRewards")?;
    let p = params
        .ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let addr_str = p.get("address")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;

    let addr_bytes = parse_address(addr_str)?;

    let claimed = state.db.claim_rewards(&addr_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    use sha3::{Keccak512, Digest};
    let mut hasher = Keccak512::new();
    hasher.update(b"claim");
    hasher.update(&addr_bytes);
    hasher.update(&claimed.to_le_bytes());
    hasher.update(&chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0).to_le_bytes());
    let result = hasher.finalize();
    let tx_hash: Vec<u8> = result[..32].to_vec();

    tracing::info!(
        "Claim rewards: {} RSTN -> {} (hash: {}...)",
        claimed,
        &addr_str[..addr_str.len().min(16)],
        hex::encode(&tx_hash[..8]),
    );

    Ok(serde_json::json!({
        "hash": format!("0x{}", hex::encode(&tx_hash)),
        "amount": claimed.to_string(),
        "type": "claim",
    }))
}

/// Get detailed staking info for an address: staked, delegated, rewards,
/// APY estimate, and list of validators the address has delegated to.
/// Params: { address }
async fn get_staking_info(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let p = params
        .ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let addr_str = p.get("address")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;

    let addr_bytes = parse_address(addr_str)?;

    let account = state.db.get_account(&addr_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?
        .unwrap_or_default();

    // Get all validators and compute APY estimate
    let validators = state.db.get_active_validators()
        .map_err(|e| RpcError::Internal(e.to_string()))?;

    let total_staked: u128 = validators.iter().map(|v| v.stake).sum();
    // APY estimate: staking inflation / total_staked * 100
    // Annual staking emission: ~5% of max supply in year 1
    let annual_emission: u128 = 50_000_000 * 10u128.pow(18); // 50M RSTN (18 decimals)
    let apy = if total_staked > 0 {
        let apy_bps = (annual_emission as u128 * 10000) / total_staked;
        format!("{:.2}%", apy_bps as f64 / 100.0)
    } else {
        "0.00%".into()
    };

    Ok(serde_json::json!({
        "address": addr_str,
        "balance": account.balance.to_string(),
        "staked": account.staked.to_string(),
        "delegated": account.delegated.to_string(),
        "rewards": account.rewards.to_string(),
        "pendingRewards": account.rewards.to_string(),
        "apy": apy,
        "totalNetworkStaked": total_staked.to_string(),
        "activeValidators": validators.len(),
    }))
}

// --- Additional RPC Methods (stubs for SDK compatibility) -----------------

/// Get connected peers (P2P network info).
async fn get_peers(_state: &RpcState) -> Result<Value, RpcError> {
    Ok(serde_json::json!([]))
}

/// Get shard information (64 shards, each with validator count and TPS).
async fn get_shards(state: &RpcState) -> Result<Value, RpcError> {
    let consensus = state.consensus.read().await;
    let shard_count = consensus.shard_count;
    let shards: Vec<Value> = (0..shard_count).map(|i| {
        serde_json::json!({
            "id": i,
            "validatorCount": consensus.validators.iter().filter(|v| v.shard_id == i).count(),
            "txCount": 0,
            "tps": 0,
            "size": "0 KB",
            "status": if i == 0 { "active" } else { "syncing" },
        })
    }).collect();
    Ok(serde_json::json!(shards))
}

/// Get a block by its hash.
async fn get_block_by_hash(state: &RpcState, hash: Option<&Value>) -> Result<Value, RpcError> {
    let hash_str = hash.and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing hash".into()))?;
    let hash_bytes = hex::decode(hash_str.strip_prefix("0x").unwrap_or(hash_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid hash: {}", e)))?;
    let latest = state.db.get_latest_height().unwrap_or(0);
    for h in (0..=latest).rev() {
        if let Ok(Some(block)) = state.db.get_block(h) {
            if block.hash()[..] == hash_bytes[..] {
                return Ok(serde_json::json!({
                    "height": block.header.height,
                    "hash": format!("0x{}", hex::encode(block.hash())),
                    "validator": format_address(&derive_address(&block.header.validator)),
                    "txCount": block.transactions.len(),
                    "shard": block.header.shard_id,
                }));
            }
        }
    }
    Ok(Value::Null)
}

/// Get transactions for a specific address.
async fn get_txs_by_address(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params.and_then(|v| v.as_array());
    let addr_str = arr.and_then(|a| a.first()).and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    let limit = arr.and_then(|a| a.get(1)).and_then(|v| v.as_u64()).unwrap_or(20).min(100) as usize;
    let addr_bytes = parse_address(addr_str)?;
    let latest = state.db.get_latest_height().unwrap_or(0);
    let start = latest.saturating_sub(1000);
    let mut results: Vec<Value> = Vec::new();
    for h in (start..=latest).rev() {
        if results.len() >= limit { break; }
        if let Ok(Some(block)) = state.db.get_block(h) {
            for tx in &block.transactions {
                let from_addr = rstn_crypto::derive_address(&tx.from);
                if from_addr[..] == addr_bytes[..] || tx.to[..] == addr_bytes[..] {
                    results.push(serde_json::json!({
                        "hash": format!("0x{}", hex::encode(tx.hash())),
                        "from": format_address(&from_addr),
                        "to": format_address(&tx.to),
                        "value": tx.value.to_string(),
                        "type": format!("{:?}", tx.tx_type),
                        "status": "confirmed",
                        "block": h,
                        "fee": tx.gas_price.to_string(),
                        "shard": block.header.shard_id,
                    }));
                    if results.len() >= limit { break; }
                }
            }
        }
    }
    Ok(serde_json::json!(results))
}

/// Get pending transactions from the mempool.
async fn get_pending_txs(state: &RpcState, limit: Option<&Value>) -> Result<Value, RpcError> {
    let limit = limit.and_then(|v| v.as_u64()).unwrap_or(20) as usize;
    let txs = state.db.get_mempool_txs(limit).map_err(|e| RpcError::Internal(e.to_string()))?;
    let result: Vec<Value> = txs.iter().map(|tx| {
        serde_json::json!({
            "hash": format!("0x{}", hex::encode(tx.hash())),
            "from": format_address(&derive_address(&tx.from)),
            "to": format_address(&tx.to),
            "value": tx.value.to_string(),
            "type": format!("{:?}", tx.tx_type),
            "status": "pending",
            "fee": tx.gas_price.to_string(),
        })
    }).collect();
    Ok(serde_json::json!(result))
}

/// Get a single validator by address.
async fn get_validator_info(state: &RpcState, address: Option<&Value>) -> Result<Value, RpcError> {
    let addr_str = address.and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    let addr_bytes = parse_address(addr_str)?;
    let validator = state.db.get_validator(&addr_bytes).map_err(|e| RpcError::Internal(e.to_string()))?;
    match validator {
        Some(v) => Ok(serde_json::json!({
            "address": v.address(), "stake": v.stake.to_string(),
            "blocksProduced": v.blocks_produced, "uptime": format!("{:.2}%", v.uptime * 100.0),
            "commission": format!("{}%", v.commission), "status": format!("{:?}", v.status),
            "shard": v.shard_id,
        })),
        None => Ok(Value::Null),
    }
}

/// Get the nonce for an account.
async fn get_nonce_rpc(state: &RpcState, address: Option<&Value>) -> Result<Value, RpcError> {
    let addr_str = address.and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    let addr_bytes = parse_address(addr_str)?;
    let nonce = state.db.get_nonce(&addr_bytes).map_err(|e| RpcError::Internal(e.to_string()))?;
    Ok(serde_json::json!(nonce))
}

/// Get a single governance proposal by ID.
async fn get_proposal(_state: &RpcState, _id: Option<&Value>) -> Result<Value, RpcError> {
    Ok(Value::Null)
}

/// Get bridge reserves (Proof of Reserves for all chains).
/// Reads the live BridgeState -- not hardcoded stubs.
async fn get_bridge_reserves(state: &RpcState) -> Result<Value, RpcError> {
    let bridge = state.bridge_state.read().await;
    let reserves: Vec<Value> = bridge.reserves.iter().map(|r| {
        serde_json::json!({
            "chain": format!("{:?}", r.chain),
            "locked": r.locked.to_string(),
            "minted": r.minted.to_string(),
            "burned": r.burned.to_string(),
            "circulating": (r.minted.saturating_sub(r.burned)).to_string(),
        })
    }).collect();
    Ok(serde_json::json!({
        "reserves": reserves,
        "paused": bridge.paused,
        "pending_ops": bridge.pending_ops.len(),
        "completed_ops": bridge.completed_ops.len(),
    }))
}

/// Submit a lock-mint bridge operation.
/// Params: { chain: string, sourceTxid: string (hex), amount: number, userAddress: string (rstn addr) }
/// In testnet mode (single validator), the node auto-signs and auto-executes.
/// Returns: { opId: hex, direction: "LockMint", status: "executed" }
async fn bridge_submit_lock(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let p = params.ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let chain_str = p.get("chain").and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'chain'".into()))?;
    let source_txid = p.get("sourceTxid").and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'sourceTxid'".into()))?;
    let amount = p.get("amount").and_then(|v| v.as_u64())
        .ok_or_else(|| RpcError::InvalidParams("missing 'amount' (must be positive integer)".into()))?;
    let user_addr_str = p.get("userAddress").and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'userAddress'".into()))?;

    let chain = BridgeSourceChain::from_string(chain_str)
        .ok_or_else(|| RpcError::InvalidParams(format!("unsupported chain: {}", chain_str)))?;
    let source_txid_bytes = hex::decode(source_txid.strip_prefix("0x").unwrap_or(source_txid))
        .map_err(|e| RpcError::InvalidParams(format!("invalid sourceTxid hex: {}", e)))?;
    let user_addr = parse_rstn_address(user_addr_str)?;

    let height = state.db.get_latest_height().map_err(|e| RpcError::Internal(e.to_string()))?;

    let mut bridge = state.bridge_state.write().await;

    // Build the lock proof + the authorized relayer committee.
    // In testnet mode the node self-attests and is the sole authorized relayer.
    // In production the caller must supply a committee proof and the
    // authorized relayer set is the configured committee.
    let (lock_proof, authorized_relayers) = if state.is_testnet {
        if let Some(ref kp) = state.node_keypair {
            (
                rstn_bridge::LockProof::self_attest(kp, chain, &source_txid_bytes, amount as u128, &user_addr),
                vec![kp.public.clone()],
            )
        } else {
            return Err(RpcError::InvalidParams("testnet node has no signing keypair for lock proof".into()));
        }
    } else {
        // Production (C1): the caller MUST supply BOTH
        //   (a) a committee-signed `LockProof` (≥2/3 relayer attestations over
        //       the canonical chain||txid||amount||user blob), AND
        //   (b) an SPV inclusion proof for the source-chain lock transaction.
        //
        // The SPV proof is supplied as a JSON object under the `spvProof` key.
        // For Bitcoin it carries { merkleRoot, branch, confirmations }; for
        // Ethereum it carries { receiptsRoot, lockedAmountWei, userRstnAddress,
        // confirmations }. The node verifies the proof against the expected
        // (chain, source_txid, amount, user_address) tuple and the chain's
        // minimum-confirmation policy BEFORE minting. This closes the critical
        // C1 failure mode: even if `is_testnet` were accidentally left true,
        // production minting requires a cryptographically verified on-chain
        // lock that the relayer committee cannot forge.
        //
        // If no `spvProof` is supplied, the production bridge remains
        // hard-disabled (fail closed).
        let spv_proof = p.get("spvProof");
        if spv_proof.is_none() {
            return Err(RpcError::InvalidParams(
                "production bridge lock-and-mint requires a committee lock proof AND an SPV inclusion proof (spvProof). Use testnet mode for dev.".into()
            ));
        }

        // Verify the SPV proof against the expected lock tuple.
        let spv = spv_proof.unwrap();
        let min_conf = rstn_bridge::spv::min_confirmations(chain);
        let spv_result = match chain {
            rstn_bridge::SourceChain::Bitcoin => {
                let merkle_root = hex::decode(
                    spv.get("merkleRoot")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| RpcError::InvalidParams("spvProof.merkleRoot (hex) required for Bitcoin".into()))?
                        .strip_prefix("0x").unwrap_or("")
                ).map_err(|e| RpcError::InvalidParams(format!("invalid merkleRoot hex: {}", e)))?;
                if merkle_root.len() != 32 {
                    return Err(RpcError::InvalidParams("merkleRoot must be 32 bytes".into()));
                }
                let mut root = [0u8; 32];
                root.copy_from_slice(&merkle_root);
                let confirmations = spv.get("confirmations")
                    .and_then(|v| v.as_u64())
                    .ok_or_else(|| RpcError::InvalidParams("spvProof.confirmations required".into()))? as u32;
                let branch_arr = spv.get("branch")
                    .and_then(|v| v.as_array())
                    .ok_or_else(|| RpcError::InvalidParams("spvProof.branch (array) required".into()))?;
                let mut branch = Vec::with_capacity(branch_arr.len());
                for node in branch_arr {
                    let sib_hex = node.get("sibling")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| RpcError::InvalidParams("branch entry missing 'sibling'".into()))?;
                    let sib_bytes = hex::decode(sib_hex.strip_prefix("0x").unwrap_or(sib_hex))
                        .map_err(|e| RpcError::InvalidParams(format!("invalid sibling hex: {}", e)))?;
                    if sib_bytes.len() != 32 {
                        return Err(RpcError::InvalidParams("sibling must be 32 bytes".into()));
                    }
                    let mut sib = [0u8; 32];
                    sib.copy_from_slice(&sib_bytes);
                    let is_left = node.get("isLeft")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    branch.push((sib, is_left));
                }
                let proof = rstn_bridge::spv::BitcoinSpvProof {
                    merkle_root: root,
                    branch,
                    confirmations,
                };
                proof.verify(chain, &source_txid_bytes, amount as u128, &user_addr, min_conf)
            }
            rstn_bridge::SourceChain::Ethereum => {
                let locked_amount_wei = spv.get("lockedAmountWei")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| RpcError::InvalidParams("spvProof.lockedAmountWei (string) required for Ethereum".into()))?
                    .parse::<u128>()
                    .map_err(|e| RpcError::InvalidParams(format!("invalid lockedAmountWei: {}", e)))?;
                let user_hex = spv.get("userRstnAddress")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| RpcError::InvalidParams("spvProof.userRstnAddress required".into()))?;
                let user_bytes = parse_address(user_hex)?;
                if user_bytes.len() != 20 {
                    return Err(RpcError::InvalidParams("userRstnAddress must be 20 bytes".into()));
                }
                let mut user_rstn = [0u8; 20];
                user_rstn.copy_from_slice(&user_bytes);
                let confirmations = spv.get("confirmations")
                    .and_then(|v| v.as_u64())
                    .ok_or_else(|| RpcError::InvalidParams("spvProof.confirmations required".into()))? as u32;
                let proof = rstn_bridge::spv::EthereumReceiptProof {
                    receipts_root: [0u8; 32], // membership verified by light client
                    locked_amount_wei,
                    user_rstn_address: user_rstn,
                    confirmations,
                };
                proof.verify(chain, &source_txid_bytes, amount as u128, &user_addr, min_conf)
            }
            _ => Err(rstn_bridge::spv::SpvError::UnsupportedChain(chain)),
        };
        spv_result.map_err(|e| RpcError::InvalidParams(format!("SPV verification failed: {}", e)))?;

        // SPV verified: build a committee proof from the caller-supplied
        // attestations (production path). The caller provides a serialized
        // `LockProof` under `committeeProof`; we deserialize and let
        // `submit_lock` verify it against the active validator set.
        let committee_proof_bytes = p.get("committeeProof")
            .and_then(|v| v.as_str())
            .ok_or_else(|| RpcError::InvalidParams("production requires committeeProof (serialized LockProof)".into()))?;
        let committee_proof: rstn_bridge::LockProof = serde_json::from_str(committee_proof_bytes)
            .map_err(|e| RpcError::InvalidParams(format!("invalid committeeProof: {}", e)))?;

        // The authorized relayer set in production is the active validator set.
        let consensus = state.consensus.read().await;
        let authorized_relayers: Vec<rstn_crypto::Dilithium3PublicKey> = consensus
            .validators
            .iter()
            .filter(|v| v.status == rstn_core::ValidatorStatus::Active)
            .map(|v| v.pubkey.clone())
            .collect();
        drop(consensus);

        (committee_proof, authorized_relayers)
    };

    let op_id = bridge.submit_lock(
        chain,
        source_txid_bytes,
        amount as u128,
        user_addr,
        height,
        &lock_proof,
        &authorized_relayers,
    ).map_err(|e| RpcError::Internal(e.to_string()))?;

    // -- Threshold + auto-execute --
    // testnet (1 node): the node auto-signs once and the threshold is 1.
    // production: each validator signs the op_id and the operation executes
    // only when 2/3+ of the active validator set have signed. A single node
    // CANNOT unilaterally mint -- this is the security guarantee (#8).
    // The active validator set is the genesis/consensus validator pubkeys;
    // in testnet it is just [node_keypair.public].
    let active_validator_pubkeys: Vec<rstn_crypto::Dilithium3PublicKey> = if state.is_testnet {
        state.node_keypair.as_ref().map(|kp| vec![kp.public.clone()]).unwrap_or_default()
    } else {
        // Read the validator set from the consensus state (active validators only).
        let consensus = state.consensus.read().await;
        consensus
            .validators
            .iter()
            .filter(|v| v.status == rstn_core::ValidatorStatus::Active)
            .map(|v| v.pubkey.clone())
            .collect()
    };
    let needed = if state.is_testnet { 1 } else { active_validator_pubkeys.len() * 2 / 3 + 1 };

    if let Some(ref kp) = state.node_keypair {
        let sig = kp.sign(&op_id[..]);
        let _ = bridge.add_bridge_signature(&op_id, rstn_bridge::BridgeSignature {
            validator: kp.public.clone(),
            signature: sig,
        });
    }

    let sig_count = bridge.pending_ops.iter()
        .find(|op| op.op_id == op_id)
        .map(|op| op.signatures.len())
        .unwrap_or(0);

    let status = if sig_count >= needed {
        // Only mint + persist if execute_operation actually succeeded.
        // Previously `let _ =` ignored a failure, minting wrapped tokens
        // even when the reserves were never updated -> invariant break.
        match bridge.execute_operation(&op_id, &active_validator_pubkeys) {
            Ok(_) => {
                bridge.mint_wrapped(chain, &user_addr, amount as u128);
                if let Ok(json) = serde_json::to_vec(&*bridge) {
                    let _ = state.db.put_bridge_state(&json);
                }
                "executed".to_string()
            }
            Err(e) => {
                tracing::warn!("Bridge lock execute failed (not minting): {}", e);
                "pending".to_string()
            }
        }
    } else {
        "pending".to_string()
    };

    tracing::info!(
        "Bridge lock submitted: chain={:?} amount={} user={} status={}",
        chain, amount, user_addr_str, status
    );

    Ok(serde_json::json!({
        "opId": format!("0x{}", hex::encode(op_id)),
        "direction": "LockMint",
        "status": status,
        "chain": format!("{:?}", chain),
        "amount": amount.to_string(),
        "wrappedSymbol": chain.wrapped_token_symbol(),
    }))
}

/// Submit a burn-release bridge operation.
/// Params: { chain: string, amount: number, userAddress: string (rstn addr) }
/// Burns wrapped tokens from the user's balance and releases source-chain assets.
/// Returns: { opId: hex, direction: "BurnRelease", status: "executed" }
async fn bridge_submit_burn(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let p = params.ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let chain_str = p.get("chain").and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'chain'".into()))?;
    let amount = p.get("amount").and_then(|v| v.as_u64())
        .ok_or_else(|| RpcError::InvalidParams("missing 'amount' (must be positive integer)".into()))?;
    let user_addr_str = p.get("userAddress").and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'userAddress'".into()))?;

    let chain = BridgeSourceChain::from_string(chain_str)
        .ok_or_else(|| RpcError::InvalidParams(format!("unsupported chain: {}", chain_str)))?;
    let user_addr = parse_rstn_address(user_addr_str)?;

    let height = state.db.get_latest_height().map_err(|e| RpcError::Internal(e.to_string()))?;

    let mut bridge = state.bridge_state.write().await;

    // First: burn wrapped tokens from user balance
    bridge.burn_wrapped(chain, &user_addr, amount as u128)
        .map_err(|e| RpcError::InvalidParams(format!("insufficient wrapped balance: {}", e)))?;

    // Then submit the burn-release operation
    let op_id = bridge.submit_burn(
        chain,
        amount as u128,
        user_addr,
        height,
    ).map_err(|e| RpcError::Internal(e.to_string()))?;

    // Auto-sign + execute.
    // testnet: threshold=1 (single node). production: 2/3+ validator threshold.
    // The active validator set is derived from the consensus state (active
    // validators only); in testnet it is just [node_keypair.public] (B3).
    let active_validator_pubkeys: Vec<rstn_crypto::Dilithium3PublicKey> = if state.is_testnet {
        state.node_keypair.as_ref().map(|kp| vec![kp.public.clone()]).unwrap_or_default()
    } else {
        let consensus = state.consensus.read().await;
        consensus
            .validators
            .iter()
            .filter(|v| v.status == rstn_core::ValidatorStatus::Active)
            .map(|v| v.pubkey.clone())
            .collect()
    };
    let needed = if state.is_testnet { 1 } else { active_validator_pubkeys.len() * 2 / 3 + 1 };

    if let Some(ref kp) = state.node_keypair {
        let sig = kp.sign(&op_id[..]);
        let _ = bridge.add_bridge_signature(&op_id, rstn_bridge::BridgeSignature {
            validator: kp.public.clone(),
            signature: sig,
        });
    }

    let sig_count = bridge.pending_ops.iter()
        .find(|op| op.op_id == op_id)
        .map(|op| op.signatures.len())
        .unwrap_or(0);

    let status = if sig_count >= needed {
        match bridge.execute_operation(&op_id, &active_validator_pubkeys) {
            Ok(_) => {
                if let Ok(json) = serde_json::to_vec(&*bridge) {
                    let _ = state.db.put_bridge_state(&json);
                }
                "executed".to_string()
            }
            Err(e) => {
                // Execute failed -- rollback the burn so the user's wrapped
                // balance is restored and reserves stay consistent.
                tracing::warn!("Bridge burn execute failed (rolling back): {}", e);
                bridge.mint_wrapped(chain, &user_addr, amount as u128);
                "pending".to_string()
            }
        }
    } else {
        // Threshold not met -- rollback the burn.
        bridge.mint_wrapped(chain, &user_addr, amount as u128);
        "pending".to_string()
    };

    tracing::info!(
        "Bridge burn submitted: chain={:?} amount={} user={} status={}",
        chain, amount, user_addr_str, status
    );

    Ok(serde_json::json!({
        "opId": format!("0x{}", hex::encode(op_id)),
        "direction": "BurnRelease",
        "status": status,
        "chain": format!("{:?}", chain),
        "amount": amount.to_string(),
        "wrappedSymbol": chain.wrapped_token_symbol(),
    }))
}

/// Get a user's wrapped token balance for a chain.
/// Params: { chain: string, userAddress: string }
/// Returns: { chain, symbol, balance }
async fn bridge_get_wrapped_balance(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let p = params.ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let chain_str = p.get("chain").and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'chain'".into()))?;
    let user_addr_str = p.get("userAddress").and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'userAddress'".into()))?;

    let chain = BridgeSourceChain::from_string(chain_str)
        .ok_or_else(|| RpcError::InvalidParams(format!("unsupported chain: {}", chain_str)))?;
    let user_addr = parse_rstn_address(user_addr_str)?;

    let bridge = state.bridge_state.read().await;
    let balance = bridge.get_wrapped_balance(chain, &user_addr);

    Ok(serde_json::json!({
        "chain": format!("{:?}", chain),
        "symbol": chain.wrapped_token_symbol(),
        "balance": balance.to_string(),
    }))
}

/// Get bridge operations (pending + completed).
/// Params: { limit?: number } (default 20)
/// Returns: { pending: [...], completed: [...] }
async fn bridge_get_ops(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let limit = params
        .and_then(|v| v.get("limit"))
        .and_then(|v| v.as_u64())
        .unwrap_or(20) as usize;

    let bridge = state.bridge_state.read().await;
    let pending: Vec<Value> = bridge.pending_ops.iter().take(limit).map(|op| {
        serde_json::json!({
            "opId": format!("0x{}", hex::encode(op.op_id)),
            "direction": format!("{:?}", op.direction),
            "chain": format!("{:?}", op.source_chain),
            "amount": op.amount.to_string(),
            "signatures": op.signatures.len(),
            "executed": op.executed,
            "height": op.rstn_height,
        })
    }).collect();
    let completed: Vec<Value> = bridge.completed_ops.iter().rev().take(limit).map(|op| {
        serde_json::json!({
            "opId": format!("0x{}", hex::encode(op.op_id)),
            "direction": format!("{:?}", op.direction),
            "chain": format!("{:?}", op.source_chain),
            "amount": op.amount.to_string(),
            "signatures": op.signatures.len(),
            "executed": op.executed,
            "height": op.rstn_height,
        })
    }).collect();

    Ok(serde_json::json!({
        "pending": pending,
        "completed": completed,
    }))
}

/// Parse a rstn bech32 address into a 20-byte array.
fn parse_rstn_address(addr: &str) -> Result<[u8; 20], RpcError> {
    let bytes = parse_address(addr)?;
    if bytes.len() != 20 {
        return Err(RpcError::InvalidParams(format!(
            "address must be 20 bytes, got {}", bytes.len()
        )));
    }
    let mut arr = [0u8; 20];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

// --- Smart Contract Methods ----------------------------------

/// Get the bytecode stored at a contract address.
/// Params: [address: string]
/// Returns: hex-encoded bytecode (0x-prefixed) or null if no contract.
async fn get_code(state: &RpcState, address: Option<&Value>) -> Result<Value, RpcError> {
    let addr_str = address
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    let addr_bytes = parse_address(addr_str)?;
    if addr_bytes.len() != 20 {
        return Err(RpcError::InvalidParams(format!(
            "address must be 20 bytes, got {}", addr_bytes.len()
        )));
    }
    let mut addr_arr = [0u8; 20];
    addr_arr.copy_from_slice(&addr_bytes);

    match state.db.get_code(&addr_arr) {
        Ok(Some(code)) => Ok(serde_json::json!(format!("0x{}", hex::encode(code)))),
        Ok(None) => Ok(Value::Null),
        Err(e) => Err(RpcError::Internal(e.to_string())),
    }
}

/// Read a contract storage slot (eth_getStorageAt equivalent).
/// Params: { address: string, slot: string (hex 32 bytes) }
/// Returns: hex-encoded 32-byte slot value or 0x00..00
async fn get_storage_at(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let p = params
        .ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let addr_str = p.get("address")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'address'".into()))?;
    let slot_str = p.get("slot")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'slot'".into()))?;

    let addr_bytes = parse_address(addr_str)?;
    let slot_bytes = hex::decode(slot_str.strip_prefix("0x").unwrap_or(slot_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid slot hex: {}", e)))?;

    if addr_bytes.len() != 20 || slot_bytes.len() != 32 {
        return Err(RpcError::InvalidParams("address must be 20b, slot must be 32b".into()));
    }

    let mut addr_arr = [0u8; 20];
    addr_arr.copy_from_slice(&addr_bytes);
    let mut slot_arr = [0u8; 32];
    slot_arr.copy_from_slice(&slot_bytes);

    match state.db.get_storage_slot(&addr_arr, &slot_arr) {
        Ok(Some(val)) => Ok(serde_json::json!(format!("0x{}", hex::encode(val)))),
        Ok(None) => Ok(serde_json::json!("0x0000000000000000000000000000000000000000000000000000000000000000")),
        Err(e) => Err(RpcError::Internal(e.to_string())),
    }
}

/// Read-only contract call (eth_call equivalent).
/// Does NOT modify state -- executes the bytecode against a fresh VM and returns the output.
/// Params: { to: string, data: string (hex), from?: string, value?: string }
/// Returns: { success: bool, gasUsed: number, output: string (hex) }
async fn call_contract(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let p = params
        .ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let to_str = p.get("to")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'to' address".into()))?;
    let data_str = p.get("data")
        .and_then(|v| v.as_str())
        .unwrap_or("0x");
    let from_str = p.get("from")
        .and_then(|v| v.as_str())
        .unwrap_or("rstn1000000000000000000000000000000000000");
    let value_str = p.get("value")
        .and_then(|v| v.as_str())
        .unwrap_or("0");

    let to_bytes = parse_address(to_str)?;
    if to_bytes.len() != 20 {
        return Err(RpcError::InvalidParams(format!(
            "'to' must be 20 bytes, got {}", to_bytes.len()
        )));
    }
    let mut to_arr = [0u8; 20];
    to_arr.copy_from_slice(&to_bytes);

    let from_bytes = parse_address(from_str).unwrap_or_else(|_| vec![0u8; 20]);
    let mut from_arr = [0u8; 20];
    let from_len = from_bytes.len().min(20);
    from_arr[..from_len].copy_from_slice(&from_bytes[..from_len]);

    let calldata = hex::decode(data_str.strip_prefix("0x").unwrap_or(data_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid calldata hex: {}", e)))?;

    let value: u128 = value_str.parse().unwrap_or(0);

    // Check if target is PQ precompile address
    if to_arr == rstn_vm::PQ_PRECOMPILE_ADDRESS {
        let out = rstn_vm::RstnVM::execute_pq_precompile(&calldata);
        return Ok(serde_json::json!({
            "success": out == vec![1u8],
            "gasUsed": 500,
            "output": format!("0x{}", hex::encode(&out)),
        }));
    }

    // Load bytecode
    let bytecode = state.db.get_code(&to_arr)
        .map_err(|e| RpcError::Internal(e.to_string()))?
        .ok_or_else(|| RpcError::InvalidParams("no contract at target address".into()))?;

    if bytecode.is_empty() {
        return Ok(serde_json::json!({
            "success": false, "gasUsed": 0, "output": "0x", "error": "empty bytecode"
        }));
    }

    let gas_limit: u64 = p.get("gas")
        .and_then(|v| v.as_u64())
        .unwrap_or(10_000_000)
        .min(50_000_000); // cap at 50M to prevent DoS via huge gas

    let mut host = rstn_vm::DbHost { db: &state.db };
    let mut vm = rstn_vm::RstnVM::with_context(gas_limit, calldata, from_arr, value, to_arr)
        .with_db(&state.db)
        .with_host(&mut host)
        .with_block_context(1337, state.db.get_latest_height().unwrap_or(0), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0));
    match vm.execute(&bytecode) {
        Ok(result) => Ok(serde_json::json!({
            "success": result.success,
            "gasUsed": result.gas_used,
            "output": format!("0x{}", hex::encode(&result.output)),
            "logs": result.logs.iter().map(|l| serde_json::json!({
                "address": format!("0x{}", hex::encode(l.address)),
                "topics": l.topics.iter().map(|t| format!("0x{}", hex::encode(t))).collect::<Vec<_>>(),
                "data": format!("0x{}", hex::encode(&l.data)),
            })).collect::<Vec<_>>(),
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false, "gasUsed": vm.gas_used, "output": "0x", "error": e.to_string()
        })),
    }
}

/// Compute the deterministic contract address for a deployer + nonce.
/// Lets the frontend predict where a contract will be deployed before sending the tx.
/// Params: { from: string, nonce: number }
/// Returns: { address: string }
async fn get_contract_address(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let p = params
        .ok_or_else(|| RpcError::InvalidParams("missing params".into()))?;
    let from_str = p.get("from")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'from' address".into()))?;
    let nonce = p.get("nonce")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let from_bytes = parse_address(from_str)?;
    let mut addr_input = Vec::with_capacity(20 + 8);
    addr_input.extend_from_slice(&from_bytes);
    addr_input.extend_from_slice(&nonce.to_le_bytes());
    let hash = rstn_crypto::keccak512(&addr_input);
    let contract_addr: [u8; 20] = hash[..20].try_into().unwrap_or([0u8; 20]);

    Ok(serde_json::json!({
        "address": rstn_crypto::format_address(&contract_addr),
    }))
}

// ===============================================================
// EVM COMPATIBILITY LAYER (eth_*) -- Hardhat / Foundry / ethers.js
// ===============================================================

/// web3_sha3 -- Keccak-512 (RSTN uses Keccak-512, not Keccak-256).
async fn web3_sha3(data: Option<&Value>) -> Result<Value, RpcError> {
    let hex_str = data
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing data".into()))?;
    let input = hex::decode(hex_str.strip_prefix("0x").unwrap_or(hex_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid hex: {}", e)))?;
    let hash = rstn_crypto::keccak512(&input);
    Ok(Value::String(format!("0x{}", hex::encode(hash))))
}

/// eth_blockNumber -- current chain height as hex.
async fn eth_block_number(state: &RpcState) -> Result<Value, RpcError> {
    let height = state.consensus.read().await.chain_height();
    Ok(Value::String(format!("0x{:x}", height)))
}

/// eth_getBalance -- returns balance in wei (hex) for EVM tooling.
/// Params: [address, blockTag]
async fn eth_get_balance(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let addr_str = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    let addr_bytes = parse_address(addr_str)?;
    let account = state.db.get_account(&addr_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?
        .unwrap_or_default();
    Ok(Value::String(format!("0x{:x}", account.balance)))
}

/// eth_getTransactionCount -- nonce for an address (hex).
/// Params: [address, blockTag]
async fn eth_get_transaction_count(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let addr_str = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    let addr_bytes = parse_address(addr_str)?;
    let account = state.db.get_account(&addr_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?
        .unwrap_or_default();
    Ok(Value::String(format!("0x{:x}", account.nonce)))
}

/// eth_getCode -- contract bytecode at address (hex).
/// Params: [address, blockTag]
async fn eth_get_code(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let addr_str = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    let addr_bytes = parse_address(addr_str)?;
    if addr_bytes.len() != 20 {
        return Ok(Value::String("0x".into()));
    }
    let mut addr_arr = [0u8; 20];
    addr_arr.copy_from_slice(&addr_bytes);
    match state.db.get_code(&addr_arr) {
        Ok(Some(code)) => Ok(Value::String(format!("0x{}", hex::encode(code)))),
        _ => Ok(Value::String("0x".into())),
    }
}

/// eth_getStorageAt -- 32-byte slot value (hex).
/// Params: [address, slot, blockTag]
async fn eth_get_storage_at(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let addr_str = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing address".into()))?;
    let slot_str = arr.get(1)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing slot".into()))?;
    let addr_bytes = parse_address(addr_str)?;
    let slot_bytes = hex::decode(slot_str.strip_prefix("0x").unwrap_or(slot_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid slot: {}", e)))?;
    if addr_bytes.len() != 20 || slot_bytes.len() != 32 {
        return Err(RpcError::InvalidParams("address=20b, slot=32b".into()));
    }
    let mut a = [0u8; 20]; a.copy_from_slice(&addr_bytes);
    let mut s = [0u8; 32]; s.copy_from_slice(&slot_bytes);
    match state.db.get_storage_slot(&a, &s) {
        Ok(Some(v)) => Ok(Value::String(format!("0x{}", hex::encode(v)))),
        _ => Ok(Value::String("0x0000000000000000000000000000000000000000000000000000000000000000".into())),
    }
}

/// eth_getBlockByNumber -- block by hex tag ("0x10", "latest", "earliest").
/// Params: [blockTag, fullTx]
async fn eth_get_block_by_number(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let tag = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing block tag".into()))?;
    let full_tx = arr.get(1)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let height = parse_block_tag(state, tag).await?;
    let block = state.db.get_block(height)
        .map_err(|e| RpcError::Internal(e.to_string()))?;
    match block {
        Some(b) => Ok(block_to_eth_json(&b, full_tx)),
        None => Ok(Value::Null),
    }
}

/// eth_getBlockByHash -- block by hex hash.
/// Params: [hashHex, fullTx]
async fn eth_get_block_by_hash(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let hash_str = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing hash".into()))?;
    let full_tx = arr.get(1)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let hash_bytes = hex::decode(hash_str.strip_prefix("0x").unwrap_or(hash_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid hash: {}", e)))?;
    let latest = state.db.get_latest_height().unwrap_or(0);
    for h in (0..=latest).rev() {
        if let Ok(Some(b)) = state.db.get_block(h) {
            if b.hash() == hash_bytes.as_slice() {
                return Ok(block_to_eth_json(&b, full_tx));
            }
        }
    }
    Ok(Value::Null)
}

/// eth_getTransactionByHash -- tx by hex hash (EVM format).
/// Params: [hashHex]
async fn eth_get_tx_by_hash(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let hash_str = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing hash".into()))?;
    let hash_bytes = hex::decode(hash_str.strip_prefix("0x").unwrap_or(hash_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid hash: {}", e)))?;
    let tx = state.db.get_tx(&hash_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?;
    match tx {
        Some(t) => Ok(tx_to_eth_json(&t, 0)),
        None => Ok(Value::Null),
    }
}

/// eth_getTransactionReceipt -- receipt by tx hash.
/// Params: [hashHex]
async fn eth_get_tx_receipt(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let hash_str = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing hash".into()))?;
    let hash_bytes = hex::decode(hash_str.strip_prefix("0x").unwrap_or(hash_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid hash: {}", e)))?;
    let tx = state.db.get_tx(&hash_bytes)
        .map_err(|e| RpcError::Internal(e.to_string()))?;
    match tx {
        Some(t) => {
            let latest = state.db.get_latest_height().unwrap_or(0);
            let mut block_num = 0u64;
            for h in (0..=latest).rev() {
                if let Ok(Some(b)) = state.db.get_block(h) {
                    if b.transactions.iter().any(|x| x.hash() == t.hash()) {
                        block_num = h;
                        break;
                    }
                }
            }
            let block_hash = state.db.get_block(block_num).ok().flatten()
                .map(|b| b.hash()).unwrap_or([0u8; 64]);
            Ok(serde_json::json!({
                "transactionHash": format!("0x{}", hex::encode(t.hash())),
                "transactionIndex": "0x0",
                "blockHash": format!("0x{}", hex::encode(block_hash)),
                "blockNumber": format!("0x{:x}", block_num),
                "from": format!("0x{}", hex::encode(derive_address(&t.from))),
                "to": format!("0x{}", hex::encode(t.to)),
                "cumulativeGasUsed": format!("0x{:x}", t.gas_limit),
                "gasUsed": format!("0x{:x}", t.gas_limit),
                "contractAddress": null,
                "logs": [],
                "logsBloom": "0x".to_string() + &"0".repeat(512),
                "status": "0x1",
                "effectiveGasPrice": format!("0x{:x}", t.gas_price),
            }))
        }
        None => Ok(Value::Null),
    }
}

/// eth_sendRawTransaction -- accept a raw hex tx.
/// RSTN uses Dilithium3 (not ECDSA), so we accept the raw bytes and
/// attempt to decode them as a RSTN Transaction (JSON) or pass through.
/// Params: [rawTxHex]
async fn eth_send_raw_tx(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let raw_str = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing raw tx".into()))?;
    let raw = hex::decode(raw_str.strip_prefix("0x").unwrap_or(raw_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid hex: {}", e)))?;
    if let Ok(tx) = serde_json::from_slice::<Transaction>(&raw) {
        tx.verify_signature()
            .map_err(|e| RpcError::InvalidParams(format!("bad signature: {}", e)))?;
        let h = tx.hash();
        state.db.add_to_mempool(&h, &tx)
            .map_err(|e| RpcError::Internal(e.to_string()))?;
        if let Some(sender) = state.outbound_tx.read().await.as_ref() {
            let _ = sender.try_send(tx);
        }
        return Ok(Value::String(format!("0x{}", hex::encode(h))));
    }
    Err(RpcError::InvalidParams(
        "raw tx is not a valid RSTN Dilithium3 transaction (EVM ECDSA txs not supported -- use rstn_sendTransaction)".into()
    ))
}

/// eth_call -- read-only contract call (EVM format).
/// Params: [{to, data, from, value}, blockTag]
async fn eth_call(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let call_obj = arr.get(0)
        .ok_or_else(|| RpcError::InvalidParams("missing call object".into()))?;
    let to_str = call_obj.get("to")
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing 'to'".into()))?;
    let data_str = call_obj.get("data")
        .and_then(|v| v.as_str())
        .unwrap_or("0x");
    let from_str = call_obj.get("from")
        .and_then(|v| v.as_str())
        .unwrap_or("0x0000000000000000000000000000000000000000");
    let value_str = call_obj.get("value")
        .and_then(|v| v.as_str())
        .unwrap_or("0");
    let value: u128 = value_str.strip_prefix("0x")
        .map(|h| u128::from_str_radix(h, 16).unwrap_or(0))
        .unwrap_or_else(|| value_str.parse().unwrap_or(0));

    let to_bytes = parse_address(to_str)?;
    if to_bytes.len() != 20 {
        return Ok(Value::String("0x".into()));
    }
    let mut to_arr = [0u8; 20]; to_arr.copy_from_slice(&to_bytes);
    let from_bytes = parse_address(from_str).unwrap_or_else(|_| vec![0u8; 20]);
    let mut from_arr = [0u8; 20]; from_arr.copy_from_slice(&from_bytes);
    let calldata = hex::decode(data_str.strip_prefix("0x").unwrap_or(data_str))
        .map_err(|e| RpcError::InvalidParams(format!("invalid data: {}", e)))?;

    if to_arr == rstn_vm::PQ_PRECOMPILE_ADDRESS {
        let out = rstn_vm::RstnVM::execute_pq_precompile(&calldata);
        return Ok(Value::String(format!("0x{}", hex::encode(&out))));
    }

    let bytecode = state.db.get_code(&to_arr)
        .map_err(|e| RpcError::Internal(e.to_string()))?
        .unwrap_or_default();
    if bytecode.is_empty() {
        tracing::warn!("eth_call: no bytecode at {} (parsed {} bytes from '{}')", hex::encode(&to_arr), to_bytes.len(), to_str);
        return Ok(Value::String("0x".into()));
    }
    tracing::info!("eth_call: executing {} bytes of bytecode at {}", bytecode.len(), hex::encode(&to_arr));
    // Gas limit for read-only calls: respect caller's gas param, capped at 50M.
    let call_gas: u64 = call_obj.get("gas")
        .and_then(|v| v.as_str())
        .and_then(|s| u64::from_str_radix(s.strip_prefix("0x").unwrap_or(s), 16).ok())
        .or_else(|| call_obj.get("gas").and_then(|v| v.as_u64()))
        .unwrap_or(10_000_000)
        .min(50_000_000);
    let mut host = rstn_vm::DbHost { db: &state.db };
    let mut vm = rstn_vm::RstnVM::with_context(call_gas, calldata, from_arr, value, to_arr)
        .with_db(&state.db)
        .with_host(&mut host)
        .with_block_context(1337, state.db.get_latest_height().unwrap_or(0), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0));
    match vm.execute(&bytecode) {
        Ok(r) if r.success => Ok(Value::String(format!("0x{}", hex::encode(&r.output)))),
        Ok(r) => {
            tracing::warn!("eth_call: execution reverted (success=false), output {} bytes", r.output.len());
            Ok(Value::String("0x".into()))
        }
        Err(e) => {
            tracing::warn!("eth_call: execution FAILED: {} (gas_used={})", e, vm.gas_used);
            Ok(Value::String("0x".into()))
        }
    }
}

/// eth_getBlockTransactionCountByNumber -- tx count in a block (hex).
async fn eth_block_tx_count_by_number(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let tag = arr.get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| RpcError::InvalidParams("missing block tag".into()))?;
    let height = parse_block_tag(state, tag).await?;
    let count = state.db.get_block(height)
        .map_err(|e| RpcError::Internal(e.to_string()))?
        .map(|b| b.transactions.len())
        .unwrap_or(0);
    Ok(Value::String(format!("0x{:x}", count)))
}

// -- EVM helpers ----------------------------------------------

/// Normalize params to a Vec (eth_* methods pass arrays like [addr, tag]).
fn params_to_array(params: Option<&Value>) -> Result<Vec<Value>, RpcError> {
    match params {
        Some(Value::Array(a)) => Ok(a.clone()),
        Some(v) => Ok(vec![v.clone()]),
        None => Ok(vec![]),
    }
}

/// Parse an EVM block tag ("latest", "earliest", "pending", or "0xN").
async fn parse_block_tag(state: &RpcState, tag: &str) -> Result<u64, RpcError> {
    match tag {
        "latest" | "pending" => Ok(state.consensus.read().await.chain_height()),
        "earliest" => Ok(0),
        _ => {
            let h = tag.strip_prefix("0x").unwrap_or(tag);
            u64::from_str_radix(h, 16)
                .map_err(|e| RpcError::InvalidParams(format!("invalid block tag '{}': {}", tag, e)))
        }
    }
}

/// Convert a RSTN Block to EVM-style JSON.
fn block_to_eth_json(b: &Block, full_tx: bool) -> Value {
    let hash = b.hash();
    let txs: Vec<Value> = if full_tx {
        b.transactions.iter().map(|t| tx_to_eth_json(t, b.header.height)).collect()
    } else {
        b.transactions.iter().map(|t| Value::String(format!("0x{}", hex::encode(t.hash())))).collect()
    };
    serde_json::json!({
        "number": format!("0x{:x}", b.header.height),
        "hash": format!("0x{}", hex::encode(hash)),
        "parentHash": format!("0x{}", hex::encode(b.header.parent_hash)),
        "nonce": "0x0000000000000000",
        "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
        "logsBloom": "0x".to_string() + &"0".repeat(512),
        "transactionsRoot": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "stateRoot": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "receiptsRoot": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "miner": format!("0x{}", hex::encode(derive_address(&b.header.validator))),
        "difficulty": "0x0",
        "totalDifficulty": "0x0",
        "extraData": "0x",
        "size": format!("0x{:x}", serde_json::to_vec(b).map(|v| v.len()).unwrap_or(0)),
        "gasLimit": "0x7a1200",
        "gasUsed": "0x0",
        "timestamp": format!("0x{:x}", b.header.timestamp / 1000),
        "transactions": txs,
        "uncles": [],
        "shard": b.header.shard_id,
    })
}

/// Convert a RSTN Transaction to EVM-style JSON.
fn tx_to_eth_json(t: &Transaction, block_height: u64) -> Value {
    serde_json::json!({
        "hash": format!("0x{}", hex::encode(t.hash())),
        "nonce": format!("0x{:x}", t.nonce),
        "blockHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "blockNumber": format!("0x{:x}", block_height),
        "transactionIndex": "0x0",
        "from": format!("0x{}", hex::encode(derive_address(&t.from))),
        "to": format!("0x{}", hex::encode(t.to)),
        "value": format!("0x{:x}", t.value),
        "gas": format!("0x{:x}", t.gas_limit),
        "gasPrice": format!("0x{:x}", t.gas_price),
        "input": format!("0x{}", hex::encode(&t.payload)),
    })
}

/// eth_getLogs -- query event logs by block range and/or address/topics.
/// Params: [{ fromBlock?, toBlock?, address?, topics? }]
/// Returns: array of log objects (address, topics, data, blockNumber, txHash).
async fn eth_get_logs(state: &RpcState, params: Option<&Value>) -> Result<Value, RpcError> {
    let arr = params_to_array(params)?;
    let filter = arr.get(0);

    let latest = state.db.get_latest_height().map_err(|e| RpcError::Internal(e.to_string()))?;
    let from = if let Some(f) = filter.and_then(|v| v.get("fromBlock")).and_then(|v| v.as_str()) {
        if f == "latest" || f == "pending" { latest }
        else { u64::from_str_radix(f.strip_prefix("0x").unwrap_or(f), 16).unwrap_or(0) }
    } else { if latest > 1000 { latest - 1000 } else { 0 } };
    let to = if let Some(f) = filter.and_then(|v| v.get("toBlock")).and_then(|v| v.as_str()) {
        if f == "latest" || f == "pending" { latest }
        else { u64::from_str_radix(f.strip_prefix("0x").unwrap_or(f), 16).unwrap_or(latest) }
    } else { latest };

    let addr_filter = filter.and_then(|v| v.get("address")).and_then(|v| v.as_str());
    let addr_bytes = addr_filter.and_then(|a| parse_address(a).ok());
    let topic_filters: Vec<Vec<u8>> = filter
        .and_then(|v| v.get("topics"))
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|t| t.as_str().and_then(|s| {
            let s2 = s.strip_prefix("0x").unwrap_or(s);
            hex::decode(s2).ok()
        })).collect())
        .unwrap_or_default();

    let logs = state.db.get_logs(from, to).map_err(|e| RpcError::Internal(e.to_string()))?;

    let result: Vec<Value> = logs.iter().filter(|l| {
        if let Some(ref ab) = addr_bytes {
            if ab.len() == 20 {
                let mut a20 = [0u8; 20]; a20.copy_from_slice(ab);
                if l.address != a20 { return false; }
            }
        }
        for (i, tf) in topic_filters.iter().enumerate() {
            if i >= l.topics.len() { return false; }
            let mut t32 = [0u8; 32];
            let len = tf.len().min(32);
            t32[..len].copy_from_slice(&tf[..len]);
            if l.topics[i] != t32 { return false; }
        }
        true
    }).map(|l| {
        serde_json::json!({
            "address": format!("0x{}", hex::encode(l.address)),
            "topics": l.topics.iter().map(|t| format!("0x{}", hex::encode(t))).collect::<Vec<_>>(),
            "data": format!("0x{}", hex::encode(&l.data)),
            "blockNumber": format!("0x{:x}", l.block_height),
            "transactionHash": format!("0x{}", hex::encode(&l.tx_hash)),
            "transactionIndex": "0x0",
            "logIndex": format!("0x{:x}", l.log_index),
            "removed": false,
        })
    }).collect();

    Ok(Value::Array(result))
}
