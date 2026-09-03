//! rstn-node -- Binary Entry Point
//!
//! Wires together all crates: crypto, storage, P2P, VM, RPC, consensus.
//! Run with `cargo run --release` or `./target/release/rstn-node`.
//!
//! Commands:
//!   rstn-node keygen     -- Generate a new Dilithium3 keypair
//!   rstn-node init       -- Initialize genesis block
//!   rstn-node run        -- Start the node (RPC + P2P + consensus)
//!   rstn-node --dev run  -- Dev mode (single node, no P2P, auto-blocks)
//!   rstn-node run --peers /ip4/127.0.0.1/tcp/9946  -- Connect to a peer

use clap::{Parser, Subcommand};
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

mod config;
mod network;
mod runner;
mod das_wire;

use rstn_core::{
    GenesisConfig, ConsensusState, genesis, Validator, ValidatorStatus,
    consensus::ConsensusEngine,
};
use rstn_crypto::Dilithium3Keypair;
use rstn_storage::RstnDB;
use rstn_rpc::RpcState;
use network::{NetworkChannels, OutboundMessage, run_p2p_event_loop};

// --- CLI ----------------------------------------------------

#[derive(Parser)]
#[command(name = "rstn-node", version, about = "Resistance Network (RSTN) -- Post-Quantum L1 Node")]
struct Cli {
    /// Run in development mode (single node, no P2P, auto-blocks)
    #[arg(long)]
    dev: bool,

    /// Run a multi-node testnet (with --genesis + P2P) but with the bridge
    /// auto-execute / threshold=1 path enabled. Distinct from --dev, which
    /// disables P2P entirely. Use this for the local 4-node testnet.
    #[arg(long)]
    testnet: bool,

    /// Path to config file (TOML)
    #[arg(short, long)]
    config: Option<String>,

    /// RPC server port (default 9944)
    #[arg(short, long, default_value = "9944")]
    port: u16,

    /// P2P listen port (default 9945)
    #[arg(long, default_value = "9945")]
    p2p_port: u16,

    /// Data directory for storage
    #[arg(long, default_value = "./rstn-data")]
    data_dir: String,

    /// Peer addresses to connect to (e.g. /ip4/127.0.0.1/tcp/9946)
    #[arg(long)]
    peers: Vec<String>,

    /// Validator stake amount in RSTN (default 32000)
    #[arg(long, default_value = "32000")]
    stake: u64,

    /// Path to a shared genesis.json file (multi-node mode).
    ///
    /// When provided, the node loads the validator set from genesis.json so
    /// every node starts with the identical genesis block and validator set.
    /// The node uses the validator at `--validator-index` as its own identity.
    #[arg(long)]
    genesis: Option<String>,

    /// Index of this node's validator keypair within the genesis.json
    /// validator array (0-based). Used with --genesis to select which
    /// validator identity this node assumes.
    #[arg(long, default_value = "0")]
    validator_index: usize,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate a new Dilithium3 keypair
    Keygen,
    /// Initialize genesis block
    Init,
    /// Start the node
    Run,
    /// Generate genesis.json with N validator keypairs
    Genesis {
        /// Number of validators to generate
        #[arg(long, default_value = "4")]
        validators: usize,
        /// Chain ID
        #[arg(long, default_value = "1337")]
        chain_id: u64,
        /// Number of shards
        #[arg(long, default_value = "4")]
        shard_count: u32,
        /// Output file path
        #[arg(long, default_value = "./genesis.json")]
        output: String,
    },
    /// Transpile EVM bytecode (from solc) to RSTN-VM bytecode.
    ///
    /// Solidity devs compile with their existing toolchain (solc) and run
    /// `rstn-node transpile --input contract.bin` on the output. The
    /// transpiler validates opcodes, checks PUSH immediates, records valid
    /// jumpdests, and emits bytecode ready for `rstn_vm::Vm::deploy()`.
    Transpile {
        /// Path to the input EVM bytecode file (hex or raw bytes).
        #[arg(short, long)]
        input: String,
        /// Path to write the transpiled RSTN-VM bytecode (hex).
        #[arg(short, long, default_value = "./contract.rstn.hex")]
        output: String,
        /// Treat the input as raw hex text (default). If false, read as raw bytes.
        #[arg(long, default_value = "true")]
        hex_input: bool,
    },
}

/// A validator entry loaded from genesis.json.
#[derive(serde::Deserialize)]
struct GenesisValidator {
    #[allow(dead_code)]
    address: String,
    pubkey_hex: String,
    seckey_hex: String,
    stake: u64,
}

/// The genesis.json file format produced by `rstn-node genesis`.
#[derive(serde::Deserialize)]
struct GenesisFile {
    chain_id: u64,
    genesis_time: u64,
    shard_count: u32,
    validators: Vec<GenesisValidator>,
}

// --- Main ---------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("rstn=info".parse()?))
        .init();

    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Keygen) => {
            println!("Generating Dilithium3 keypair...");
            let keypair = Dilithium3Keypair::generate();
            let addr = rstn_crypto::derive_address(&keypair.public);
            let addr_str = rstn_crypto::format_address(&addr);
            println!("Address: {}", addr_str);
            println!("Public key (hex): {}", hex::encode(&keypair.public.0));
            println!("Secret key (hex): {}", hex::encode(&keypair.secret.0));
        }
        Some(Commands::Init) => {
            println!("Initializing genesis block...");
            let config = GenesisConfig::default();
            let block = genesis::build_genesis_block(&config);
            println!("Genesis block hash: {}", hex::encode(block.hash()));
            println!("Transactions in genesis: {}", block.transactions.len());

            let db_path = format!("{}/db", cli.data_dir);
            std::fs::create_dir_all(&db_path).ok();
            let db = RstnDB::open(&db_path)?;
            db.put_block(0, &block)?;
            println!("Genesis block stored at {}", db_path);
        }
        Some(Commands::Genesis { validators, chain_id, shard_count, output }) => {
            generate_genesis_file(validators, chain_id, shard_count, &output)?;
        }
        Some(Commands::Transpile { input, output, hex_input }) => {
            transpile_command(&input, &output, hex_input)?;
        }
        Some(Commands::Run) | None => {
            run_node(cli).await?;
        }
    }

    Ok(())
}

/// `rstn-node transpile --input contract.bin --output contract.rstn.hex`
///
/// Reads EVM bytecode (hex or raw), transpiles it to RSTN-VM bytecode via
/// `rstn_sol_transpiler::transpile`, and writes the result as hex.
fn transpile_command(input_path: &str, output_path: &str, hex_input: bool) -> anyhow::Result<()> {
    let raw = std::fs::read(input_path)
        .map_err(|e| anyhow::anyhow!("failed to read input {}: {}", input_path, e))?;

    let evm_bytecode = if hex_input {
        // The file may contain hex text (with or without 0x prefix / whitespace).
        let text = std::str::from_utf8(&raw)
            .map_err(|e| anyhow::anyhow!("input is not valid UTF-8 hex: {}", e))?;
        let trimmed = text.trim().trim_start_matches("0x").replace([' ', '\n', '\r'], "");
        hex::decode(&trimmed)
            .map_err(|e| anyhow::anyhow!("input is not valid hex: {}", e))?
    } else {
        raw
    };

    println!("Transpiling {} bytes of EVM bytecode → RSTN-VM...", evm_bytecode.len());

    let result = rstn_sol_transpiler::transpile(&evm_bytecode)
        .map_err(|e| anyhow::anyhow!("transpile failed: {}", e))?;

    let hex_out = result.to_hex();
    std::fs::write(output_path, &hex_out)
        .map_err(|e| anyhow::anyhow!("failed to write output {}: {}", output_path, e))?;

    println!("OK Transpiled {} opcodes → {} bytes", result.opcode_count, result.bytecode.len());
    println!("  PQ opcodes (0x0C/0x0D): {}", result.has_pq_opcodes);
    println!("  CREATE/CREATE2 (0xF0/0xF5): {}", result.has_create);
    println!("  Valid jumpdests: {}", result.valid_jumpdests.len());
    println!("  Output: {} ({} hex chars)", output_path, hex_out.len());

    Ok(())
}

async fn run_node(cli: Cli) -> anyhow::Result<()> {
    tracing::info!("==========================================");
    tracing::info!("|   Resistance Network (RSTN) -- PQ L1 Node   |");
    tracing::info!("==========================================");
    tracing::info!("Data dir: {}", cli.data_dir);
    tracing::info!("RPC port: {}", cli.port);
    tracing::info!("P2P port: {}", cli.p2p_port);
    tracing::info!("Dev mode: {}", cli.dev);
    if !cli.peers.is_empty() {
        tracing::info!("Bootstrap peers: {:?}", cli.peers);
    }

    // -- Open storage --
    let db_path = format!("{}/db", cli.data_dir);
    std::fs::create_dir_all(&db_path).ok();
    let db = Arc::new(RstnDB::open(&db_path)?);

    // -- Load genesis.json (multi-node) or build default genesis (dev) --
    //
    // In multi-node mode (--genesis path/to/genesis.json), every node loads the
    // SAME genesis file so they all compute the identical genesis block hash and
    // start with the same validator set. This node assumes the identity of the
    // validator at --validator-index.
    //
    // In dev mode (no --genesis), a single self-registered validator is used.
    let genesis_file: Option<GenesisFile> = if let Some(path) = &cli.genesis {
        let content = std::fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("Failed to read genesis file {}: {}", path, e))?;
        let gf: GenesisFile = serde_json::from_str(&content)
            .map_err(|e| anyhow::anyhow!("Failed to parse genesis file {}: {}", path, e))?;
        tracing::info!("Loaded genesis.json from {} ({} validators)", path, gf.validators.len());
        Some(gf)
    } else {
        None
    };

    // -- Load or create genesis block in storage --
    let latest_height = db.get_latest_height()?;
    if latest_height == 0 && db.get_block(0)?.is_none() {
        tracing::info!("No genesis block found. Initializing...");
        let config = if let Some(ref gf) = genesis_file {
            // Build a GenesisConfig that matches the shared genesis.json so the
            // genesis block hash is identical across all nodes.
            GenesisConfig {
                chain_id: gf.chain_id,
                genesis_time: gf.genesis_time,
                shard_count: gf.shard_count,
                ..GenesisConfig::default()
            }
        } else {
            // Dev mode: use current wall-clock time as genesis_time so the
            // MTP-11 anti-timejacking check does not reject real-time blocks
            // (genesis_time=0 would make MTP=0, and live blocks ~2h ahead).
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            GenesisConfig {
                genesis_time: now_ms,
                ..GenesisConfig::default()
            }
        };
        let block = genesis::build_genesis_block(&config);
        db.put_block(0, &block)?;
        tracing::info!("Genesis block created: {}...", &hex::encode(block.hash())[..16]);
    } else {
        tracing::info!("Loaded chain from storage. Height: {}", latest_height);
    }

    // -- Load this node's keypair --
    //
    // Multi-node: load the validator keypair from genesis.json at the given
    // index. This node signs blocks/votes with this keypair, and the other
    // nodes recognize it as a valid validator (it's in the shared set).
    //
    // Dev/single-node: load from disk or generate a fresh keypair.
    let keypair = if let Some(ref gf) = genesis_file {
        let idx = cli.validator_index;
        let gv = gf.validators.get(idx)
            .ok_or_else(|| anyhow::anyhow!("validator_index {} out of range (genesis has {} validators)", idx, gf.validators.len()))?;
        let pub_bytes = hex::decode(&gv.pubkey_hex)
            .map_err(|e| anyhow::anyhow!("invalid pubkey_hex in genesis: {}", e))?;
        let sec_bytes = hex::decode(&gv.seckey_hex)
            .map_err(|e| anyhow::anyhow!("invalid seckey_hex in genesis: {}", e))?;
        if pub_bytes.len() != rstn_crypto::PUBKEY_SIZE {
            return Err(anyhow::anyhow!("genesis pubkey is {} bytes, expected {}", pub_bytes.len(), rstn_crypto::PUBKEY_SIZE));
        }
        if sec_bytes.len() != rstn_crypto::PRIVKEY_SIZE {
            return Err(anyhow::anyhow!("genesis seckey is {} bytes, expected {}", sec_bytes.len(), rstn_crypto::PRIVKEY_SIZE));
        }
        let mut public_arr = [0u8; rstn_crypto::PUBKEY_SIZE];
        let mut secret_arr = [0u8; rstn_crypto::PRIVKEY_SIZE];
        public_arr.copy_from_slice(&pub_bytes);
        secret_arr.copy_from_slice(&sec_bytes);
        tracing::info!("Loaded validator #{} keypair from genesis.json", idx);
        Dilithium3Keypair {
            public: rstn_crypto::Dilithium3PublicKey(public_arr),
            secret: rstn_crypto::Dilithium3SecretKey(secret_arr),
        }
    } else {
        load_or_generate_keypair(&cli.data_dir)?
    };
    let addr = rstn_crypto::derive_address(&keypair.public);
    tracing::info!("Node address: {}", rstn_crypto::format_address(&addr));

    // -- Initialize consensus state --
    let mut consensus = ConsensusState::new(64);

    // -- Replay chain from storage --
    // Load ALL blocks from storage into consensus chain, not just genesis.
    // This ensures the node resumes from the correct height after a restart.
    let latest = db.get_latest_height()?;
    if latest > 0 || db.get_block(0)?.is_some() {
        tracing::info!("Replaying chain from storage (height 0..={})...", latest);
        for height in 0..=latest {
            if let Some(block) = db.get_block(height)? {
                consensus.chain.push(block);
            }
        }
        consensus.last_finalized_height = latest;
        consensus.current_round = latest; // Resume from last finalized round
        tracing::info!("Chain replayed: {} blocks loaded, height={}", consensus.chain.len(), latest);
    }

    // -- Register validators --
    //
    // Multi-node: register ALL validators from the shared genesis.json so every
    // node knows the full validator set. BFT supermajority is computed against
    // this set.
    //
    // Dev/single-node: register only this node as the sole validator.
    if let Some(ref gf) = genesis_file {
        tracing::info!("Registering {} validators from genesis.json", gf.validators.len());
        for (i, gv) in gf.validators.iter().enumerate() {
            let pub_bytes = hex::decode(&gv.pubkey_hex)
                .map_err(|e| anyhow::anyhow!("invalid pubkey_hex for validator {}: {}", i, e))?;
            if pub_bytes.len() != rstn_crypto::PUBKEY_SIZE {
                return Err(anyhow::anyhow!("validator {} pubkey wrong size", i));
            }
            let mut public_arr = [0u8; rstn_crypto::PUBKEY_SIZE];
            public_arr.copy_from_slice(&pub_bytes);
            let stake_wei = (gv.stake as u128) * 10u128.pow(18);
            let validator = Validator {
                pubkey: rstn_crypto::Dilithium3PublicKey(public_arr),
                stake: stake_wei,
                commission: 5,
                shard_id: (i as u32) % gf.shard_count.max(1),
                uptime: 1.0,
                blocks_produced: 0,
                status: ValidatorStatus::Active,
                // G11 — assign a region to each validator for the geographic
                // cap. In a real deployment each operator self-declares; for
                // the local testnet we distribute across regions round-robin
                // so the geo-cap monitoring is observably live.
                region: ["us-east", "eu-west", "asia-east", "sa-east"][i % 4].to_string(),
            };
            let vaddr = rstn_crypto::derive_address(&validator.pubkey);
            consensus.validators.push(validator.clone());
            db.put_validator(&vaddr, &validator)?;
            // Give each validator an initial balance + staked amount
            let mut account = rstn_storage::AccountState::default();
            account.balance = 1_000_000_000_000_000_000_000_000_000; // 1B RSTN
            account.staked = stake_wei;
            db.put_account(&vaddr, &account)?;
        }
    } else {
        tracing::info!("Registering self as validator (stake: {} RSTN)", cli.stake);
        let stake_wei = (cli.stake as u128) * 10u128.pow(18);
        let validator = Validator {
            pubkey: keypair.public.clone(),
            stake: stake_wei,
            commission: 5,
            shard_id: 0,
            uptime: 1.0,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
            region: "us-east".to_string(),
        };
        consensus.validators.push(validator.clone());
        let addr_bytes = rstn_crypto::derive_address(&keypair.public);
        db.put_validator(&addr_bytes, &validator)?;
        let mut account = rstn_storage::AccountState::default();
        account.balance = 1_000_000_000_000_000_000_000_000_000; // 1B RSTN
        account.staked = stake_wei;
        db.put_account(&addr_bytes, &account)?;
    }

    // -- Create consensus engine --
    // Clone the keypair BEFORE moving it into the engine so we can also hand
    // copies to the RPC state (used by `rstn_debugSendTx` to sign test txs)
    // and to the P2P event loop (A1: PQ application-layer session identity).
    let keypair_for_rpc = keypair.clone();
    let keypair_for_p2p = keypair.clone();
    // A1: snapshot the known validator pubkeys BEFORE the engine is moved
    // into the block-production task. The P2P event loop uses these to
    // establish PQ sessions with peers whose identity is in the validator set.
    let known_validator_pubkeys: Vec<rstn_crypto::Dilithium3PublicKey> = consensus
        .validators
        .iter()
        .map(|v| v.pubkey.clone())
        .collect();
    let mut engine = ConsensusEngine::new(consensus, keypair);

    // Wire account-state lookups into the consensus engine so add_tx() can
    // validate nonce and balance against on-chain state (#2). The closures
    // read from the shared DB (Arc) -- safe because the DB outlives the engine.
    {
        let db_for_nonce = Arc::clone(&db);
        let db_for_balance = Arc::clone(&db);
        engine.set_account_lookup(
            move |addr: &[u8; 20]| Some(db_for_nonce.get_nonce(addr).unwrap_or(0)),
            move |addr: &[u8; 20]| Some(db_for_balance.get_balance(addr).unwrap_or(0)),
        );
    }

    // -- Enable production-grade security modules on mainnet nodes only --
    // These modules are dormant in dev/testnet for compatibility. On a
    // production node (multi-node, --genesis, no --testnet/--dev) we activate:
    //   • Forward security (anti long-range attack): the engine validates every
    //     block's signer against the epoch-authorized validator set, so an
    //     attacker who buys a retired epoch key cannot sign blocks in a later
    //     epoch.
    //   • Threshold-encrypted mempool (G13 anti-MEV): the proposer sees only
    //     the commitment of each tx; payloads are decrypted only after 2/3+
    //     COMMIT finality, making MEV structurally impossible.
    //   • Forced-inclusion pool (G14 anti-censorship): a tx attested as
    //     excluded by 2/3+ of the active set becomes "forced" and the next
    //     proposer MUST include it or the block is invalid.
    let is_mainnet = !cli.testnet && !cli.dev && genesis_file.is_some();
    if is_mainnet {
        engine.enable_forward_security();
        engine.enable_threshold_mempool();
        engine.enable_forced_inclusion();
        tracing::warn!("MAINNET: forward security + threshold mempool + forced-inclusion pool ENABLED");
    } else {
        tracing::info!("Testnet/dev mode: forward security + threshold mempool + forced-inclusion pool DISABLED (compatibility)");
    }

    // -- Build RPC state --
    let shared_consensus = tokio::sync::RwLock::new(engine.state.clone());
    // Tx gossip channel: RPC `send_transaction` -> forwarder -> P2P outbound.
    // `None` in dev mode (single node -- txs stay in the local mempool).
    let (tx_gossip_tx, tx_gossip_rx) = tokio::sync::mpsc::channel::<rstn_core::Transaction>(512);
    let rpc_state = Arc::new(RpcState {
        db: Arc::clone(&db),
        consensus: shared_consensus,
        faucet_claims: tokio::sync::RwLock::new(std::collections::HashMap::new()),
        rpc_rate_limits: tokio::sync::RwLock::new(std::collections::HashMap::new()),
        api_keys: tokio::sync::RwLock::new(std::collections::HashSet::new()),
        outbound_tx: tokio::sync::RwLock::new(None),
        node_keypair: Some(keypair_for_rpc),
        bridge_state: tokio::sync::RwLock::new({
            // Load persisted bridge state if present (#10): wrapped balances
            // and reserves survive a node restart instead of resetting to zero.
            match db.get_bridge_state() {
                Ok(Some(blob)) => serde_json::from_slice::<rstn_bridge::BridgeState>(&blob)
                    .unwrap_or_else(|_| rstn_bridge::BridgeState::new()),
                _ => rstn_bridge::BridgeState::new(),
            }
        }),
        bridge_validator_count: tokio::sync::RwLock::new(
            engine.state.validators.len(),
        ),
        // Testnet = explicit --testnet flag, dev mode, OR a single-node
        // genesis-less run. In production (multi-node with a real validator
        // set and no testnet flag) the 2/3+ threshold is enforced.
        is_testnet: cli.testnet || cli.dev || genesis_file.is_none(),
        // M4: CORS allow-list. In testnet this is empty → server emits ACAO:*.
        // In production the operator MUST set RSTN_ALLOWED_ORIGINS to the official
        // dApp origins; any other origin is rejected by the browser.
        allowed_origins: tokio::sync::RwLock::new(parse_allowed_origins()),
        // G15-alarm: quantum alarm state, mirrored from the engine so RPC can
        // query it. The runner syncs the engine's alarm into this slot after
        // every finalize so RPC reads are consistent with consensus state.
        quantum_alarm: tokio::sync::RwLock::new(rstn_core::quantum_alarm::QuantumAlarm::new()),
        // G15: zk-STARK proof cache, indexed by block height. The runner
        // generates a proof over each finalized block's tx_root and stores it
        // here so light clients verify block validity succinctly via RPC.
        stark_proofs: tokio::sync::RwLock::new(std::collections::HashMap::new()),
        // G15-exec: circuit breakers, mirrored from the engine so RPC can
        // query active trips. The runner syncs the engine's breaker into this
        // slot after every block.
        circuit_breakers: tokio::sync::RwLock::new(rstn_core::circuit_breaker::CircuitBreaker::new()),
        // Forward-security ledger (long-range attack protection). Seeded with
        // the genesis validator set so epoch-0 keys are authorized. The runner
        // syncs rotations after every finalize so RPC reads are consistent.
        forward_security: tokio::sync::RwLock::new({
            let mut ledger = rstn_core::forward_security::ForwardSecurityLedger::new();
            ledger.seed_genesis(&engine.state.validators);
            ledger
        }),
        // Multi-source oracle aggregator (median + TWAP). The runner feeds
        // aggregated prices into the circuit breaker for deviation detection.
        oracle: tokio::sync::RwLock::new(rstn_core::oracle::MultiSourceOracle::new(100)),
        // Permissionless relayer market for IBC. Min bond 1,000 micro-RSTN.
        relayer_market: tokio::sync::RwLock::new(rstn_core::relayer_market::RelayerMarket::new(1_000)),
        // IP-to-region geolocation engine (curated prefix table, no external API).
        geo_ip: tokio::sync::RwLock::new(rstn_core::geo_ip::GeoIpLocator::new()),
        // State rent manager (per-account storage pricing). The runner
        // collects rent per block from accounts with stored state.
        state_rent: tokio::sync::RwLock::new(rstn_core::state_rent::StateRentManager::new()),
        // Onion-routing directory authority. Seeded with the validator set
        // as relays so the mixnet has a real relay directory from genesis.
        directory_authority: tokio::sync::RwLock::new({
            let mut da = rstn_core::directory_authority::DirectoryAuthority::new(keypair_for_rpc.clone());
            // Seed relays from the validator set (each validator is a relay).
            for (i, v) in engine.state.validators.iter().enumerate() {
                let relay_id = {
                    let mut id = [0u8; 32];
                    let pk_bytes = v.pubkey.0.to_vec();
                    let n = pk_bytes.len().min(32);
                    id[..n].copy_from_slice(&pk_bytes[..n]);
                    id
                };
                let relay_key = {
                    let mut k = [0u8; 32];
                    let h = rstn_crypto::keccak512(&v.pubkey.0);
                    k.copy_from_slice(&h[..32]);
                    k
                };
                da.register(rstn_core::directory_authority::RelayEntry {
                    relay_id,
                    relay_key,
                    region: v.region.clone(),
                    uptime: 1.0,
                });
                let _ = i;
            }
            da
        }),
        // Cover-traffic scheduler: 5 dummy onions/sec mean rate (Poisson).
        // The runner ticks it per block to emit cover traffic into the mixnet.
        cover_traffic: tokio::sync::RwLock::new(rstn_core::onion::CoverTrafficScheduler::new(5.0, 42)),
        // Governance proposals (on-chain, flash-loan defense + timelock).
        governance_proposals: tokio::sync::RwLock::new(Vec::new()),
    });

    // C1 startup guard: refuse to start in production mode if the bridge
    // self-attest path could ever be reached. `is_testnet` MUST be false on a
    // mainnet node; if an operator accidentally leaves --testnet/--dev on a
    // node holding real value, the bridge would let anyone mint wrapped tokens
    // by self-attesting a fake lock. Fail fast and loud instead.
    //
    // C1-production: the bridge lock-and-mint path requires a committee lock
    // proof + a cryptographically verified SPV inclusion proof (see
    // `bridge_submit_lock`). This startup check catches a mainnet node that
    // was launched without a genesis file: in that case `is_testnet` is
    // derived as `true` (single-node, genesis-less run), which would silently
    // enable the self-attest path. A production node MUST be launched with
    // --genesis and without --testnet/--dev.
    let is_production = !rpc_state.is_testnet;
    if is_production {
        tracing::warn!("PRODUCTION MODE: privileged RPC shortcuts (faucet, debugSendTx, staking shortcuts) are DISABLED.");
        tracing::warn!("PRODUCTION MODE: bridge lock-and-mint requires committee lock proof + SPV inclusion proof (C1).");
        if rpc_state.allowed_origins.read().await.is_empty() {
            tracing::error!("FATAL: production node started with no RSTN_ALLOWED_ORIGINS — RPC would reject all browser origins. Set RSTN_ALLOWED_ORIGINS=https://your-dapp.example");
            anyhow::bail!("production node requires RSTN_ALLOWED_ORIGINS to be set (C1/M4)");
        }
    }
    // Detect the silent flip: an operator intends mainnet (passes --genesis)
    // but the node still computes `is_testnet = true` because of a leftover
    // --testnet or --dev flag. A real multi-node genesis run must NOT be in
    // testnet mode — otherwise the bridge self-attest path is reachable.
    if genesis_file.is_some() && !cli.dev && !cli.testnet && rpc_state.is_testnet {
        tracing::error!("FATAL: node launched with --genesis but is_testnet=true (silent flip). The bridge self-attest path would be reachable on a mainnet validator set.");
        anyhow::bail!("mainnet node (with --genesis) must not run in testnet mode (C1-production)");
    }

    // -- Start RPC server --
    let rpc_state_clone = Arc::clone(&rpc_state);
    let rpc_port = cli.port;
    tokio::spawn(async move {
        runner::start_rpc_server(rpc_state_clone, rpc_port).await;
    });

    if cli.dev {
        // -- Dev mode: single-node, no P2P --
        tracing::info!("Dev mode: P2P disabled, single-node block production active");

        // Create dummy channels -- dev mode only uses the timer tick path.
        // CRITICAL: keep the inbound SENDER alive for the lifetime of the block
        // production task. If the sender is dropped, the channel closes and
        // inbound.recv() returns None immediately, which makes the select! in
        // start_block_production break the loop before any block is produced.
        let (dummy_inbound_tx, dummy_inbound) = tokio::sync::mpsc::channel(1);
        let (dummy_outbound, _) = tokio::sync::mpsc::channel(1);

        let rpc_state_for_blocks = Arc::clone(&rpc_state);
        let engine_for_blocks = engine;
        let block_time = rstn_core::TARGET_BLOCK_TIME_MS;

        tokio::spawn(async move {
            let _keep_alive = dummy_inbound_tx; // hold sender so channel never closes
            runner::start_block_production(
                rpc_state_for_blocks,
                engine_for_blocks,
                block_time,
                true, // is_dev
                dummy_inbound,
                dummy_outbound,
            ).await;
        });
    } else {
        // -- Multi-node mode: start P2P networking --
        tracing::info!("Starting P2P networking...");

        // Create libp2p keypair (Ed25519 for P2P identity, separate from Dilithium3)
        let libp2p_keypair = libp2p::identity::Keypair::generate_ed25519();

        // Create the swarm
        let mut swarm = rstn_p2p::create_swarm(cli.p2p_port, libp2p_keypair)
            .map_err(|e| anyhow::anyhow!("P2P swarm creation failed: {}", e))?;

        // Start listening
        rstn_p2p::start_listening(&mut swarm, cli.p2p_port)
            .map_err(|e| anyhow::anyhow!("P2P listen failed: {}", e))?;

        // Connect to bootstrap peers
        for peer_addr in &cli.peers {
            tracing::info!("Dialing peer: {}", peer_addr);
            if let Ok(addr) = peer_addr.parse::<libp2p::Multiaddr>() {
                let _ = swarm.dial(addr);
            }
        }

        // Also try seed nodes if no explicit peers
        if cli.peers.is_empty() {
            tracing::info!("No explicit peers provided, trying seed nodes...");
            rstn_p2p::bootstrap(&mut swarm).ok();
        }

        // Create P2P channels
        let (inbound_tx, inbound_rx, outbound_tx, outbound_rx) = NetworkChannels::new(256);

        // -- Wire tx gossip into the RPC state --
        // `send_transaction` pushes txs onto tx_gossip_tx; the forwarder below
        // maps them to OutboundMessage::Transaction and feeds the P2P outbound
        // channel so peers (including the leader) receive and mempool them.
        *rpc_state.outbound_tx.write().await = Some(tx_gossip_tx);
        let forward_outbound = outbound_tx.clone();
        tokio::spawn(async move {
            let mut rx = tx_gossip_rx;
            while let Some(tx) = rx.recv().await {
                if forward_outbound.send(OutboundMessage::Transaction(tx)).await.is_err() {
                    break;
                }
            }
        });

        // Spawn P2P event loop.
        // A1: pass this node's Dilithium3 keypair and the known validator
        // pubkeys so the event loop can establish PQ application-layer
        // sessions with peers whose identity is in the validator set.
        let rpc_state_for_p2p = Arc::clone(&rpc_state);
        tokio::spawn(async move {
            run_p2p_event_loop(
                swarm,
                inbound_tx,
                outbound_rx,
                rpc_state_for_p2p,
                keypair_for_p2p,
                known_validator_pubkeys,
            ).await;
        });

        // Spawn block production with P2P channels
        let rpc_state_for_blocks = Arc::clone(&rpc_state);
        let engine_for_blocks = engine;
        let block_time = rstn_core::TARGET_BLOCK_TIME_MS;

        tokio::spawn(async move {
            runner::start_block_production(
                rpc_state_for_blocks,
                engine_for_blocks,
                block_time,
                false, // not dev -- multi-node BFT
                inbound_rx,
                outbound_tx,
            ).await;
        });
    }

    tracing::info!("==========================================");
    tracing::info!("|  RSTN Node running                       |");
    tracing::info!("|  RPC: http://localhost:{}                |", cli.port);
    tracing::info!("|  P2P: tcp://0.0.0.0:{}                  |", cli.p2p_port);
    tracing::info!("|  Frontend: set RPC_MODE = true            |");
    tracing::info!("|  RPC_ENDPOINT = http://localhost:{}      |", cli.port);
    tracing::info!("==========================================");

    // Keep running
    tokio::signal::ctrl_c().await?;
    tracing::info!("Shutting down RSTN Node...");
    Ok(())
}

/// Load the node's Dilithium3 keypair from disk, or generate a new one
/// and persist it. This ensures the node's identity (address) remains
/// stable across restarts.
fn load_or_generate_keypair(data_dir: &str) -> anyhow::Result<Dilithium3Keypair> {
    let key_path = format!("{}/node_key.hex", data_dir);
    std::fs::create_dir_all(data_dir).ok();

    // Try to load existing keypair
    if let Ok(content) = std::fs::read_to_string(&key_path) {
        let parts: Vec<&str> = content.trim().split('\n').collect();
        if parts.len() == 2 {
            let pub_bytes = hex::decode(parts[0])?;
            let sec_bytes = hex::decode(parts[1])?;
            if pub_bytes.len() == rstn_crypto::PUBKEY_SIZE && sec_bytes.len() == rstn_crypto::PRIVKEY_SIZE {
                let mut public_arr = [0u8; rstn_crypto::PUBKEY_SIZE];
                let mut secret_arr = [0u8; rstn_crypto::PRIVKEY_SIZE];
                public_arr.copy_from_slice(&pub_bytes);
                secret_arr.copy_from_slice(&sec_bytes);
                tracing::info!("Loaded existing node keypair from {}", key_path);
                return Ok(Dilithium3Keypair {
                    public: rstn_crypto::Dilithium3PublicKey(public_arr),
                    secret: rstn_crypto::Dilithium3SecretKey(secret_arr),
                });
            }
        }
        tracing::warn!("Existing key file malformed, generating new keypair");
    }

    // Generate new keypair and persist
    let keypair = Dilithium3Keypair::generate();
    let content = format!(
        "{}\n{}",
        hex::encode(&keypair.public.0),
        hex::encode(&keypair.secret.0),
    );
    std::fs::write(&key_path, content)
        .map_err(|e| anyhow::anyhow!("Failed to write keypair to {}: {}", key_path, e))?;
    tracing::info!("Generated and persisted new node keypair to {}", key_path);
    Ok(keypair)
}

/// Generate a genesis.json file with N validator keypairs.
///
/// Each validator gets a fresh Dilithium3 keypair. The genesis file contains:
/// - chain_id, shard_count, genesis_time
/// - validators: [{ id, address, pubkey_hex, seckey_hex, stake }]
///
/// This file is consumed by docker-compose to bootstrap a multi-node testnet.
fn generate_genesis_file(
    num_validators: usize,
    chain_id: u64,
    shard_count: u32,
    output_path: &str,
) -> anyhow::Result<()> {
    use serde_json::json;

    println!("Generating {} validator keypairs (Dilithium3 / ML-DSA-65)...", num_validators);

    let mut validators_arr = Vec::with_capacity(num_validators);

    for i in 0..num_validators {
        let keypair = Dilithium3Keypair::generate();
        let addr = rstn_crypto::derive_address(&keypair.public);
        let addr_str = rstn_crypto::format_address(&addr);

        println!("  Validator {}: {}", i, addr_str);

        validators_arr.push(json!({
            "id": i,
            "address": addr_str,
            "pubkey_hex": hex::encode(&keypair.public.0),
            "seckey_hex": hex::encode(&keypair.secret.0),
            "stake": 32000,
        }));
    }

    let genesis_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let genesis = json!({
        "chain_id": chain_id,
        "genesis_time": genesis_time,
        "shard_count": shard_count,
        "validators": validators_arr,
    });

    let json_str = serde_json::to_string_pretty(&genesis)?;
    std::fs::write(output_path, &json_str)?;

    println!();
    println!("OK Genesis written to {}", output_path);
    println!("  Chain ID: {}", chain_id);
    println!("  Shards: {}", shard_count);
    println!("  Validators: {}", num_validators);
    println!();
    println!("Next steps -- launch a multi-node testnet:");
    println!("  # Node 0 (seed):");
    println!("    rstn-node --genesis {} --validator-index 0 --port 9944 --p2p-port 9945", output_path);
    println!("  # Node 1 (connects to node 0):");
    println!("    rstn-node --genesis {} --validator-index 1 --port 9946 --p2p-port 9947 \\", output_path);
    println!("      --peers /ip4/127.0.0.1/tcp/9945");
    println!("  # Node 2, 3, ... similarly with incrementing --validator-index and ports");

    Ok(())
}

/// Parse the `RSTN_ALLOWED_ORIGINS` env var into a list of origins.
///
/// Format: comma-separated, e.g.
///   `RSTN_ALLOWED_ORIGINS=https://app.rstn.network,https://explorer.rstn.network`
///
/// In testnet/dev mode an empty list is fine (server emits ACAO:*). In
/// production the startup guard in `run_node` refuses to boot if this is
/// empty, so a misconfigured mainnet node fails loudly instead of exposing
/// an open CORS policy (M4).
fn parse_allowed_origins() -> Vec<String> {
    std::env::var("RSTN_ALLOWED_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}
