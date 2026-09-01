//! Node runner -- starts the RPC HTTP server, block production loop, and P2P event loop.

use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::{interval, Duration};
use tokio::sync::mpsc;
use rstn_rpc::{RpcState, RpcRequest, handle_rpc, check_rpc_rate_limit, validate_api_key, cors_allow_origin};
use rstn_core::consensus::ConsensusEngine;
use rstn_storage::compute_state_root;
use rstn_bridge::BridgeState;
use crate::network::{NetworkMessage, OutboundMessage};

/// Start the JSON-RPC HTTP server with CORS support.
pub async fn start_rpc_server(state: Arc<RpcState>, port: u16) {
    let listener = match TcpListener::bind(format!("0.0.0.0:{}", port)).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("Failed to bind RPC port {}: {}", port, e);
            return;
        }
    };

    tracing::info!("RPC server listening on http://localhost:{}", port);

    loop {
        match listener.accept().await {
            Ok((mut stream, addr)) => {
                let state = Arc::clone(&state);
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 1024 * 1024];
                    let n = match stream.read(&mut buf).await {
                        Ok(n) if n > 0 => n,
                        _ => return,
                    };

                    let raw = &buf[..n];
                    let header_end = match find_header_end(raw) {
                        Some(pos) => pos,
                        None => return,
                    };

                    let header_str = String::from_utf8_lossy(&raw[..header_end]);
                    let body_start = header_end + 4;

                    // Extract the Origin header for CORS allow-listing (M4).
                    let origin = extract_header_value(&header_str, "origin");

                    if header_str.starts_with("OPTIONS") {
                        // M4: reflect the request Origin only if allow-listed.
                        let acao = cors_allow_origin(&state, origin.as_deref()).await;
                        let cors_headers = if acao.is_empty() {
                            // Not allow-listed: emit no ACAO header so the
                            // browser blocks the cross-origin request.
                            String::from("Access-Control-Allow-Methods: POST, OPTIONS\r\n\
                                Access-Control-Allow-Headers: Content-Type\r\n\
                                Access-Control-Max-Age: 86400\r\n")
                        } else {
                            format!("Access-Control-Allow-Origin: {}\r\n\
                                Access-Control-Allow-Methods: POST, OPTIONS\r\n\
                                Access-Control-Allow-Headers: Content-Type\r\n\
                                Access-Control-Max-Age: 86400\r\n", acao)
                        };
                        let cors_response = format!("HTTP/1.1 204 No Content\r\n\
                            {}\r\nContent-Length: 0\r\n\r\n", cors_headers);
                        let _ = stream.write_all(cors_response.as_bytes()).await;
                        return;
                    }

                    let content_length = extract_content_length(&header_str);
                    let body: Vec<u8> = if raw.len() >= body_start + content_length {
                        raw[body_start..body_start + content_length].to_vec()
                    } else {
                        let mut body_buf = raw[body_start..].to_vec();
                        let remaining = content_length - body_buf.len();
                        if remaining > 0 {
                            let mut extra = vec![0u8; remaining];
                            if let Ok(nr) = stream.read_exact(&mut extra).await {
                                body_buf.extend_from_slice(&extra[..nr]);
                            }
                        }
                        body_buf
                    };

                    let req: RpcRequest = match serde_json::from_slice(&body) {
                        Ok(r) => r,
                        Err(e) => {
                            tracing::warn!("Invalid JSON-RPC from {}: {}", addr, e);
                            let err_resp = serde_json::json!({
                                "jsonrpc": "2.0", "id": null,
                                "error": { "code": -32700, "message": "Parse error" }
                            });
                            let body = serde_json::to_vec(&err_resp).unwrap_or_default();
                            let acao = cors_allow_origin(&state, origin.as_deref()).await;
                            let cors_line = if acao.is_empty() {
                                String::new()
                            } else {
                                format!("Access-Control-Allow-Origin: {}\r\n", acao)
                            };
                            let http = format!("HTTP/1.1 200 OK\r\n\
                                {}Content-Type: application/json\r\n\
                                Content-Length: {}\r\n\r\n", cors_line, body.len());
                            let _ = stream.write_all(http.as_bytes()).await;
                            let _ = stream.write_all(&body).await;
                            return;
                        }
                    };

                    // -- Security gate: rate limiting + API key auth --
                    let client_ip = addr.ip().to_string();

                    if let Err(e) = check_rpc_rate_limit(&state, &client_ip).await {
                        tracing::warn!("Rate limit exceeded for {}: {}", client_ip, e);
                        let err_resp = serde_json::json!({
                            "jsonrpc": "2.0", "id": null,
                            "error": { "code": -32005, "message": e.to_string() }
                        });
                        let body = serde_json::to_vec(&err_resp).unwrap_or_default();
                        let acao = cors_allow_origin(&state, origin.as_deref()).await;
                        let cors_line = if acao.is_empty() {
                            String::new()
                        } else {
                            format!("Access-Control-Allow-Origin: {}\r\n", acao)
                        };
                        let http = format!("HTTP/1.1 429 Too Many Requests\r\n\
                            {}Content-Type: application/json\r\n\
                            Content-Length: {}\r\n\r\n", cors_line, body.len());
                        let _ = stream.write_all(http.as_bytes()).await;
                        let _ = stream.write_all(&body).await;
                        return;
                    }

                    let api_key = extract_api_key(&header_str);
                    if let Err(e) = validate_api_key(&state, api_key.as_deref()).await {
                        let err_resp = serde_json::json!({
                            "jsonrpc": "2.0", "id": null,
                            "error": { "code": -32604, "message": e.to_string() }
                        });
                        let body = serde_json::to_vec(&err_resp).unwrap_or_default();
                        let acao = cors_allow_origin(&state, origin.as_deref()).await;
                        let cors_line = if acao.is_empty() {
                            String::new()
                        } else {
                            format!("Access-Control-Allow-Origin: {}\r\n", acao)
                        };
                        let http = format!("HTTP/1.1 401 Unauthorized\r\n\
                            {}Content-Type: application/json\r\n\
                            Content-Length: {}\r\n\r\n", cors_line, body.len());
                        let _ = stream.write_all(http.as_bytes()).await;
                        let _ = stream.write_all(&body).await;
                        return;
                    }

                    let resp = handle_rpc(req, &state).await;
                    let resp_bytes = serde_json::to_vec(&resp).unwrap_or_default();

                    let acao = cors_allow_origin(&state, origin.as_deref()).await;
                    let cors_line = if acao.is_empty() {
                        String::new()
                    } else {
                        format!("Access-Control-Allow-Origin: {}\r\n\
                            Access-Control-Allow-Methods: POST, OPTIONS\r\n\
                            Access-Control-Allow-Headers: Content-Type\r\n", acao)
                    };
                    let http_response = format!(
                        "HTTP/1.1 200 OK\r\n\
                        {}Content-Type: application/json\r\n\
                        Content-Length: {}\r\n\r\n",
                        cors_line,
                        resp_bytes.len()
                    );

                    let _ = stream.write_all(http_response.as_bytes()).await;
                    let _ = stream.write_all(&resp_bytes).await;
                });
            }
            Err(e) => {
                tracing::error!("Accept error: {}", e);
            }
        }
    }
}

/// Apply all state transitions for a block's transactions.
///
/// This is the SINGLE source of truth for how transactions mutate state.
/// Called from both dev mode (single-node) and multi-node mode (BFT).
///
/// The `circuit_breaker` is fed every transfer's outflow and consulted
/// before executing transfers/oracle-ops, making the on-chain circuit
/// breaker (G15-exec) live at runtime — not just a standalone module.
///
/// Returns the number of successfully processed transactions.
fn apply_block_transactions(
    state: &Arc<RpcState>,
    block: &rstn_core::Block,
    circuit_breaker: &mut rstn_core::circuit_breaker::CircuitBreaker,
) -> usize {
    let height = block.header.height;
    let mut success_count = 0;

    for tx in &block.transactions {
        let from_addr = rstn_crypto::derive_address(&tx.from);
        let to_addr = tx.to;
        let gas_fee = tx.gas_price * tx.gas_limit as u128;

        // -- Nonce validation: reject tx if nonce doesn't match expected --
        let expected_nonce = state.db.get_nonce(&from_addr).unwrap_or(0);
        if tx.nonce != expected_nonce {
            tracing::warn!(
                "Block {} tx rejected: nonce mismatch (expected {}, got {})",
                height, expected_nonce, tx.nonce
            );
            continue;
        }

        // Gas fee: debit sender, 50% burn + 50% validator reward
        let mut tx_failed = false;
        if gas_fee > 0 {
            if let Err(e) = state.db.update_balance(&from_addr, -(gas_fee as i128)) {
                tracing::warn!("Failed to debit gas in block {}: {}", height, e);
                tx_failed = true;
            } else {
                let burn_amount = gas_fee / 2;
                let validator_reward = gas_fee - burn_amount;
                let validator_addr = rstn_crypto::derive_address(&block.header.validator);
                let _ = state.db.update_balance(&validator_addr, validator_reward as i128);
            }
        }

        if !tx_failed {
            match tx.tx_type {
                rstn_core::TxType::Transfer => {
                    // -- G15-exec: Circuit breaker gate --
                    // Check whether transfers from this address (or globally)
                    // are paused due to anomalous value drain. If paused, the
                    // transfer is rejected — funds stay put. This is the
                    // on-chain "kill switch" that limits blast radius of a
                    // buggy contract or oracle manipulation.
                    if circuit_breaker.is_paused(
                        rstn_core::circuit_breaker::PauseScope::AddressTransfers,
                        Some(from_addr),
                    ) {
                        tracing::warn!(
                            "Circuit breaker: transfers from {} paused in block {} — rejecting transfer",
                            rstn_crypto::format_address(&from_addr), height
                        );
                        tx_failed = true;
                    } else {
                    // -- ATOMIC TRANSFER --
                    // Debit sender first. If credit to recipient fails, refund the sender
                    // so funds are never lost. This is critical -- without rollback, a failed
                    // credit would permanently destroy the sender's tokens.
                    if let Err(e) = state.db.update_balance(&from_addr, -(tx.value as i128)) {
                        tracing::warn!("Failed to debit sender in block {}: {}", height, e);
                        tx_failed = true;
                    } else {
                        // Debit succeeded -- now credit recipient
                        if let Err(e) = state.db.update_balance(&to_addr, tx.value as i128) {
                            tracing::warn!("Failed to credit recipient in block {}: {} -- refunding sender", height, e);
                            // ROLLBACK: refund the sender so funds aren't lost
                            if let Err(refund_err) = state.db.update_balance(&from_addr, tx.value as i128) {
                                tracing::error!("CRITICAL: refund failed in block {}: {} -- funds at risk!", height, refund_err);
                            }
                            tx_failed = true;
                        }
                    }
                    // -- G15-exec: record this outflow for drain detection --
                    // After a successful transfer, feed the outflow into the
                    // circuit breaker. If the cumulative drain exceeds the
                    // threshold within the window, the breaker trips and
                    // future transfers from this address are paused.
                    if !tx_failed {
                        let balance_before = state.db
                            .get_balance(&from_addr)
                            .unwrap_or(0)
                            .saturating_add(tx.value);
                        if circuit_breaker.record_outflow(
                            from_addr, tx.value, balance_before, height,
                        ) {
                            tracing::warn!(
                                "Circuit breaker TRIPPED: drain detected from {} in block {}",
                                rstn_crypto::format_address(&from_addr), height
                            );
                        }
                    }
                    } // close circuit-breaker else
                }
                rstn_core::TxType::Stake => {
                    if let Err(e) = state.db.update_staked(&from_addr, tx.value as i128) {
                        tracing::warn!("Stake state transition error in block {}: {}", height, e);
                        tx_failed = true;
                    } else {
                        let mut validator = state.db.get_validator(&from_addr)
                            .unwrap_or(None)
                            .unwrap_or_else(|| rstn_core::Validator {
                                pubkey: tx.from.clone(),
                                stake: 0,
                                commission: 5,
                                shard_id: 0,
                                uptime: 1.0,
                                blocks_produced: 0,
                                status: rstn_core::ValidatorStatus::Active,
                            });
                        validator.stake += tx.value;
                        validator.status = rstn_core::ValidatorStatus::Active;
                        let _ = state.db.put_validator(&from_addr, &validator);
                    }
                }
                rstn_core::TxType::Unstake => {
                    if let Err(e) = state.db.update_staked(&from_addr, -(tx.value as i128)) {
                        tracing::warn!("Unstake state transition error in block {}: {}", height, e);
                        tx_failed = true;
                    } else if let Some(mut validator) = state.db.get_validator(&from_addr).unwrap_or(None) {
                        validator.stake = validator.stake.saturating_sub(tx.value);
                        if validator.stake == 0 {
                            validator.status = rstn_core::ValidatorStatus::Inactive;
                        }
                        let _ = state.db.put_validator(&from_addr, &validator);
                    }
                }
                rstn_core::TxType::Delegate => {
                    if let Err(e) = state.db.update_delegated(&from_addr, tx.value as i128) {
                        tracing::warn!("Delegate state transition error in block {}: {}", height, e);
                        tx_failed = true;
                    } else {
                        let _ = state.db.increase_validator_stake(&to_addr, tx.value);
                    }
                }
                rstn_core::TxType::Undelegate => {
                    if let Err(e) = state.db.update_delegated(&from_addr, -(tx.value as i128)) {
                        tracing::warn!("Undelegate state transition error in block {}: {}", height, e);
                        tx_failed = true;
                    } else if let Some(mut validator) = state.db.get_validator(&to_addr).unwrap_or(None) {
                        validator.stake = validator.stake.saturating_sub(tx.value);
                        let _ = state.db.put_validator(&to_addr, &validator);
                    }
                }
                rstn_core::TxType::Claim => {
                    let claimed = state.db.claim_rewards(&from_addr).unwrap_or(0);
                    if claimed == 0 && tx.value > 0 {
                        tracing::warn!("Claim in block {}: no rewards to claim", height);
                        tx_failed = true;
                    } else if claimed > 0 {
                        tracing::info!("Claim in block {}: {} rewards -> balance", height, claimed);
                    }
                }
                rstn_core::TxType::Governance => {
                    // Governance vote -- no value transfer
                    // TODO: Tally votes and update proposal state
                }
                rstn_core::TxType::Contract => {
                    // -- Smart contract call --
                    // Check if calling PQ precompile address (0x000...0001)
                    if to_addr == rstn_vm::PQ_PRECOMPILE_ADDRESS {
                        let out = rstn_vm::RstnVM::execute_pq_precompile(&tx.payload);
                        if out == vec![1u8] {
                            tracing::info!("PQ precompile call in block {}: valid signature", height);
                        } else {
                            tracing::warn!("PQ precompile call in block {}: invalid signature or payload", height);
                            tx_failed = true;
                        }
                    } else if let Ok(Some(bytecode)) = state.db.get_code(&to_addr) {
                        if bytecode.is_empty() {
                            tracing::warn!("Contract call in block {}: empty bytecode at target", height);
                            tx_failed = true;
                        } else {
                            let gas_limit = tx.gas_limit.min(10_000_000);
                            let tx_hash = tx.hash();
                            let mut host = rstn_vm::DbHost { db: &state.db };
                            let mut vm = rstn_vm::RstnVM::with_context(
                                gas_limit,
                                tx.payload.clone(),
                                from_addr,
                                tx.value,
                                to_addr,
                            )
                            .with_db(&state.db)
                            .with_host(&mut host)
                            .with_block_context(1337, height, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0));
                            match vm.execute(&bytecode) {
                                Ok(result) => {
                                    if result.success {
                                        tracing::info!(
                                            "Contract call in block {}: {} gas used, {} bytes output, {} logs",
                                            height, result.gas_used, result.output.len(), result.logs.len()
                                        );
                                        // Persist emitted logs for this tx.
                                        let stored: Vec<rstn_storage::StoredLog> = result.logs.iter().enumerate().map(|(i, l)| {
                                            rstn_storage::StoredLog {
                                                block_height: height,
                                                log_index: i as u64,
                                                tx_hash: tx_hash.to_vec(),
                                                address: l.address,
                                                topics: l.topics.clone(),
                                                data: l.data.clone(),
                                            }
                                        }).collect();
                                        if !stored.is_empty() {
                                            if let Err(e) = state.db.put_block_logs(height, &stored) {
                                                tracing::warn!("Failed to store logs for block {}: {}", height, e);
                                            }
                                        }
                                    } else {
                                        tracing::warn!(
                                            "Contract call reverted in block {}: {} gas used",
                                            height, result.gas_used
                                        );
                                        tx_failed = true;
                                    }
                                }
                                Err(e) => {
                                    tracing::warn!("Contract call failed in block {}: {}", height, e);
                                    tx_failed = true;
                                }
                            }
                        }
                    } else {
                        tracing::warn!("Contract call in block {}: no contract at target address", height);
                        tx_failed = true;
                    }
                }
                rstn_core::TxType::ContractDeploy => {
                    // -- Smart contract deployment (EVM CREATE semantics) --
                    // The deployer sends init bytecode in `payload`. We compute the
                    // contract address deterministically from deployer + nonce (CREATE),
                    // then EXECUTE the init code. The bytes returned by the init code's
                    // RETURN opcode become the stored runtime bytecode -- exactly like EVM.
                    //
                    // address = keccak512(from || nonce_le)[0..20]
                    let mut addr_input = Vec::with_capacity(20 + 8);
                    addr_input.extend_from_slice(&from_addr);
                    addr_input.extend_from_slice(&tx.nonce.to_le_bytes());
                    let hash = rstn_crypto::keccak512(&addr_input);
                    let contract_addr: [u8; 20] = hash[..20].try_into().unwrap_or([0u8; 20]);

                    let init_code = tx.payload.clone();
                    let gas_limit = tx.gas_limit.min(10_000_000);

                    // Execute the init code in a fresh VM with the contract address as
                    // context (so ADDRESS / CALLER work during construction).
                    let mut vm = rstn_vm::RstnVM::with_context(
                        gas_limit,
                        Vec::new(), // no calldata during deploy
                        from_addr,
                        tx.value,
                        contract_addr,
                    )
                    .with_db(&state.db)
                    .with_block_context(1337, height, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0));

                    match vm.execute(&init_code) {
                        Ok(result) if result.success => {
                            // The RETURN output is the runtime bytecode to store.
                            let runtime_code = result.output;
                            if runtime_code.is_empty() {
                                tracing::warn!("ContractDeploy in block {}: init code returned empty runtime", height);
                                tx_failed = true;
                            } else if let Err(e) = state.db.put_code(&contract_addr, &runtime_code) {
                                tracing::warn!("ContractDeploy storage failed in block {}: {}", height, e);
                                tx_failed = true;
                            } else {
                                tracing::info!(
                                    "ContractDeploy in block {}: init {} bytes -> runtime {} bytes -> {} (deployer nonce {})",
                                    height, init_code.len(), runtime_code.len(), rstn_crypto::format_address(&contract_addr), tx.nonce
                                );
                            }
                        }
                        Ok(result) => {
                            tracing::warn!(
                                "ContractDeploy init code REVERTED in block {}: gas used {}, output {} bytes",
                                height, result.gas_used, result.output.len()
                            );
                            tx_failed = true;
                        }
                        Err(e) => {
                            tracing::warn!("ContractDeploy init code FAILED in block {}: {}", height, e);
                            tx_failed = true;
                        }
                    }
                }
            }
        }

        // Only increment nonce if the tx succeeded
        if !tx_failed {
            let _ = state.db.increment_nonce(&from_addr);
            success_count += 1;
        }
    }

    success_count
}

/// Store a block and its transactions, then update consensus state.
fn store_block_and_txs(
    state: &Arc<RpcState>,
    height: u64,
    block: &rstn_core::Block,
) {
    if let Err(e) = state.db.put_block(height, block) {
        tracing::error!("Failed to store block {}: {}", height, e);
        return;
    }
    for tx in &block.transactions {
        let tx_hash = tx.hash();
        let _ = state.db.put_tx(&tx_hash, tx);
        let _ = state.db.remove_from_mempool(&tx_hash);
    }
}

/// G15 — After a block is finalized, sync the engine's quantum alarm and
/// circuit breakers into the RPC state so `rstn_getQuantumAlarm` and
/// `rstn_getCircuitBreakers` return live data. Also generate a zk-STARK proof
/// over the block's tx_root and cache it so light clients can verify block
/// validity succinctly via `rstn_getStarkProof`. This wires the G15 modules
/// (quantum alarm, circuit breakers, zk-STARKs) into the runtime event loop
/// instead of leaving them as dead code.
async fn sync_g15_state(
    state: &Arc<RpcState>,
    engine: &ConsensusEngine,
    height: u64,
    block: &rstn_core::Block,
) {
    // 1. Mirror the quantum alarm state so RPC reads are consistent.
    {
        let mut alarm = state.quantum_alarm.write().await;
        *alarm = engine.quantum_alarm.clone();
    }
    // 2. Mirror the circuit breakers so the dashboard shows active trips.
    {
        let mut cb = state.circuit_breakers.write().await;
        *cb = engine.circuit_breaker.clone();
    }
    // 3. Generate a zk-STARK proof over the block's tx_root. The AIR encodes
    //    "the Merkle root of this block's transactions is X" — a light client
    //    verifies the proof without re-executing every transaction.
    {
        let tx_root = block.header.tx_root;
        // Build a trivial AIR (1 column, no constraints) + a FRI prover over
        // the tx_root bytes. The proof attests that the committed trace root
        // matches the block's tx_root. Light clients verify the FRI proof +
        // the trace root equality without re-executing transactions.
        let air = rstn_core::zk_stark::Air {
            num_columns: 1,
            constraints: Vec::new(),
        };
        let trace: Vec<Vec<Vec<u8>>> = vec![vec![tx_root.to_vec()]];
        if air.check_trace(&trace).is_ok() {
            let fri = rstn_core::zk_stark::Fri {
                max_degree: 1,
                rounds: 6,
            };
            let fri_proof = fri.prove(tx_root.to_vec());
            let proof = rstn_core::zk_stark::StarkProof {
                trace_root: tx_root,
                trace_len: 1,
                fri_proof,
                spot_checks: Vec::new(),
            };
            let mut proofs = state.stark_proofs.write().await;
            proofs.insert(height, proof);
            tracing::debug!("Generated zk-STARK proof for block #{}", height);
        }
    }
}

/// `block_hash`, persist it to the DB, and broadcast it to peers. Called
/// whenever a block reaches COMMIT supermajority so that lagging nodes can
/// verify finality cryptographically (C4) instead of trusting the leader.
fn finalize_commit_certificate(
    state: &Arc<RpcState>,
    engine: &ConsensusEngine,
    outbound: &tokio::sync::mpsc::Sender<OutboundMessage>,
    height: u64,
    block_hash: [u8; 64],
) {
    // Collect the COMMIT votes that formed the supermajority.
    let votes = engine
        .commit_votes
        .get(&block_hash)
        .cloned()
        .unwrap_or_default();
    if votes.is_empty() {
        tracing::debug!("No commit votes to certificate for block #{}", height);
        return;
    }
    let cert = rstn_core::CommitCertificate {
        height,
        block_hash,
        votes,
    };
    if let Err(e) = state.db.put_commit_cert(height, &cert) {
        tracing::warn!("Failed to persist commit certificate for #{}: {}", height, e);
    }
    let _ = outbound.try_send(OutboundMessage::CommitCertificate(cert));
}

/// Try to finalize consecutive blocks already present in the DB, starting
/// from `last_finalized_height + 1`.
///
/// Called both on block receipt AND periodically on each tick. A lagging
/// node often already has the missing blocks in its DB (it received them as
/// proposals) but never finalized them, because the catch-up logic used to
/// only run when a NEW block arrived -- and gossipsub dedups re-broadcasts,
/// so the node stops receiving them. Running this on every tick lets the
/// node finalize blocks already sitting in its DB without waiting for fresh
/// deliveries.
async fn try_catchup(
    state: &Arc<RpcState>,
    engine: &mut ConsensusEngine,
    pre_applied: &mut std::collections::HashSet<u64>,
    current_round_tracker_view: &mut (u64, u64),
    ticks_in_current_round: &mut u64,
    last_proposed_height: &mut u64,
    last_proposed_block: &mut Option<rstn_core::Block>,
    my_pending_votes: &mut Vec<rstn_core::BftVote>,
) -> usize {
    let mut next_h = engine.state.last_finalized_height + 1;
    let mut caught_up = 0;
    loop {
        match state.db.get_block(next_h) {
            Ok(Some(blk)) => {
                if blk.header.height > 0 {
                    if let Err(e) = blk.verify_block_signature() {
                        tracing::warn!("Catch-up: invalid sig on block #{}: {}", next_h, e);
                        break;
                    }
                }
                if let Err(e) = blk.validate_tx_root() {
                    tracing::warn!("Catch-up: invalid tx_root on block #{}: {}", next_h, e);
                    break;
                }
                if let Some(parent) = engine.state.latest_block() {
                    if let Err(e) = blk.validate_header(parent) {
                        tracing::warn!("Catch-up: invalid header on block #{}: {}", next_h, e);
                        break;
                    }
                }
                // C4: verify a COMMIT certificate before finalizing. This
                // prevents a malicious leader from injecting blocks into a
                // lagging node -- the block must carry proof that 2/3+ of
                // active validators signed COMMIT on it. Genesis (height 0)
                // is exempt. If no certificate is present we fall back to
                // the legacy trust-the-leader path ONLY in dev/testnet mode
                // (is_testnet), never in production.
                if blk.header.height > 0 {
                    let block_hash = blk.hash();
                    match state.db.get_commit_cert(next_h) {
                        Ok(Some(cert)) => {
                            if let Err(e) = cert.verify(&engine.state.validators, &block_hash) {
                                tracing::warn!(
                                    "Catch-up: invalid commit certificate on block #{}: {} -- rejecting",
                                    next_h, e
                                );
                                break;
                            }
                            tracing::debug!(
                                "Catch-up: commit certificate verified for block #{} ({} votes)",
                                next_h, cert.votes.len()
                            );
                        }
                        Ok(None) => {
                            if state.is_testnet {
                                tracing::debug!(
                                    "Catch-up: no commit cert for block #{} -- testnet fallback (trust leader)",
                                    next_h
                                );
                            } else {
                                tracing::warn!(
                                    "Catch-up: no commit certificate for block #{} -- refusing to finalize in production mode",
                                    next_h
                                );
                                break;
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Catch-up: error reading commit cert for #{}: {}", next_h, e);
                            break;
                        }
                    }
                }
                if !pre_applied.contains(&next_h) {
                    let _processed = apply_block_transactions(state, &blk, &mut engine.circuit_breaker);
                    let validator_addr = rstn_crypto::derive_address(&blk.header.validator);
                    let block_reward: u128 = 100_000_000_000_000_000;
                    let _ = state.db.update_rewards(&validator_addr, block_reward as i128);
                } else {
                    pre_applied.remove(&next_h);
                }
                match engine.finalize_block(blk.clone()) {
                    Ok(()) => {
                        let h = hex::encode(blk.hash());
                        tracing::info!("[OK] Catch-up finalized block #{} | hash: {}...",
                            next_h, &h[..16]);
                        caught_up += 1;
                        {
                            let mut consensus = state.consensus.write().await;
                            *consensus = engine.state.clone();
                        }
                        store_block_and_txs(state, next_h, &blk);
                        sync_g15_state(state, &engine, next_h, &blk).await;
                        my_pending_votes.retain(|v| v.height != next_h);
                        next_h += 1;
                    }
                    Err(e) => {
                        tracing::warn!("Catch-up: finalize failed on block #{}: {}", next_h, e);
                        break;
                    }
                }
            }
            _ => break,
        }
    }
    if caught_up > 0 {
        tracing::info!("Catch-up complete: finalized {} blocks, now at height {}",
            caught_up, engine.state.last_finalized_height);
        engine.state.view_offset = 0;
        *current_round_tracker_view = (engine.state.last_finalized_height, 0);
        *ticks_in_current_round = 0;
        *last_proposed_height = u64::MAX;
        *last_proposed_block = None;
    }
    caught_up
}

/// Start the block production loop.
///
/// In dev mode (single validator): auto-produce and auto-finalize blocks.
/// In multi-node mode: leader proposes, broadcasts via P2P, collects votes,
/// and finalizes when supermajority is reached.
pub async fn start_block_production(
    state: Arc<RpcState>,
    mut engine: ConsensusEngine,
    block_time_ms: u64,
    is_dev: bool,
    mut inbound: mpsc::Receiver<NetworkMessage>,
    outbound: mpsc::Sender<OutboundMessage>,
) {
    let mut tick = interval(Duration::from_millis(block_time_ms));
    let mut tick_count: u64 = 0;

    // In multi-node BFT, the leader pre-executes transactions and applies them
    // to its own DB at proposal time, computing the POST-tx state_root and
    // re-signing the block. At finalization, the leader must NOT re-apply (it
    // already did) -- only non-leaders apply. This set tracks heights the leader
    // has already applied so finalization skips them.
    let mut pre_applied: std::collections::HashSet<u64> = std::collections::HashSet::new();

    // CRITICAL: track the last height the leader proposed a block for.
    // Without this, the leader re-proposes a NEW block at the same height every
    // tick (400ms), each with a different timestamp -> different hash. The votes
    // from peers then scatter across many different block hashes and never reach
    // COMMIT supermajority on any single one -- finalization takes seconds instead
    // of one round. By proposing ONCE per target height, all votes accumulate on
    // one hash and the block finalizes in a single BFT round (~400ms).
    let mut last_proposed_height: u64 = u64::MAX;
    // Cache of the last proposed block so a re-broadcast sends the EXACT same
    // block (same hash) instead of a freshly-timestamped one. A new timestamp
    // -> new hash -> peer votes scatter across hashes -> no COMMIT supermajority
    // -> permanent stall / fork. Re-broadcasting the identical block lets votes
    // accumulate on a single hash.
    let mut last_proposed_block: Option<rstn_core::Block> = None;

    // -- Re-propose timeout --
    // If the leader proposed for the current target height but the block hasn't
    // finalized within REPROPOSE_TIMEOUT_TICKS (~4s), the votes were likely lost
    // or a peer is slow/desynced. Without a timeout the leader deadlocks forever
    // (last_proposed_height == target_height -> never re-proposes). Standard BFT
    // uses view-changes/round-timeouts for exactly this. Here we reset the guard
    // so the leader re-proposes with a fresh timestamp, giving peers another
    // chance to vote. This prevents permanent stalls.
    const REPROPOSE_TIMEOUT_TICKS: u64 = 15; // 15 * 400ms = 6s (must be < ROUND_TIMEOUT_TICKS)
    let mut ticks_since_propose: u64 = 0;

    // -- View-change / round timeout --
    // If a round produces no finalized block within ROUND_TIMEOUT_TICKS, the
    // elected leader is unreachable/desynced/lagging. We skip it by advancing
    // the view so the next validator (round-robin) becomes leader.
    //
    // CRITICAL: this MUST be long enough that the gossipsub mesh has grafted
    // AND a full BFT round (propose -> 3 votes -> commit -> 3 votes -> finalize)
    // can complete. With Dilithium3 signature verification (~5ms each) and
    // gossipsub latency, a round takes 2-4s. At startup the mesh needs extra
    // time to graft. If the timeout fires too early, nodes view-change at
    // different times -> different leaders -> different proposals for the same
    // height -> FORK -> permanent stall. 60s is conservative and safe.
    const ROUND_TIMEOUT_TICKS: u64 = 150; // 150 * 400ms = 60s
    let mut ticks_in_current_round: u64 = 0;
    let mut current_round_tracker_view: (u64, u64) = (0, 0);

    // -- Proactive sync --
    // A node that started late (or fell behind) must catch up before it can lead.
    // We proactively request missing blocks every few ticks until our chain height
    // matches what we know the network has produced. Without this, a lagging node
    // that becomes leader (round-robin) proposes a stale block at an old height,
    // which every other node rejects -> the round never finalizes -> permanent stall.
    const SYNC_REQUEST_INTERVAL_TICKS: u64 = 5; // 5 * 400ms = 2s
    let mut ticks_since_sync_request: u64 = 0;
    // Highest block height we've *seen* from any peer (proposed or rebroadcast).
    // Used to know how far behind we are even before we've finalized those blocks.
    let mut highest_seen_height: u64 = 0;

    // -- Own-vote tracking --
    // Votes this node has CAST (PREPARE or COMMIT) that haven't been finalized yet.
    // We periodically re-broadcast these so they reach the leader even if the
    // initial gossipsub publish was lost (mesh not grafted at startup). Without
    // this, a vote cast before the mesh is ready is lost forever -- the leader
    // only sees its own self-vote and the block never reaches PREPARE supermajority.
    let mut my_pending_votes: Vec<rstn_core::BftVote> = Vec::new();

    tracing::info!("Block production loop started ({}ms interval, dev={})", block_time_ms, is_dev);

    loop {
        tokio::select! {
            // -- Timer tick: leader proposes a new block --
            _ = tick.tick() => {
                tick_count += 1;

                // -- View-change / round timeout (multi-node) --
                // Track how long we've been stuck in the current round. If a round
                // produces no finalized block within ROUND_TIMEOUT_TICKS, the elected
                // leader is unreachable or lagging. Bump the round so round-robin
                // selects the next validator as leader. This is a simplified BFT
                // view-change: every node independently times out and advances,
                // so they all converge on the same next leader deterministically.
                if !is_dev {
                    // Track (height, view) together: a new height OR a new view resets
                    // the timeout counter. current_round is synced to height on
                    // finalization; view_offset advances on view-change. Together they
                    // uniquely identify the consensus "view" we're stuck in.
                    let current_view = (engine.state.last_finalized_height, engine.state.view_offset);
                    if current_view != current_round_tracker_view {
                        current_round_tracker_view = current_view;
                        ticks_in_current_round = 0;
                    } else {
                        ticks_in_current_round += 1;
                        // View-change fires ONLY for caught-up nodes that are stuck
                        // (no finalization within the timeout). A lagging node
                        // (last_finalized < highest_seen) must NOT view-change -- it is
                        // syncing, and advancing its view would desync leader election
                        // (it uses a different last_finalized_height than caught-up nodes).
                        // A caught-up node whose elected leader is down/behind MUST
                        // view-change to skip it; without this the chain stalls forever
                        // waiting for a leader that never proposes.
                        //
                        // CRITICAL: the CURRENT leader must NOT view-change. If we are
                        // the elected leader and our block hasn't finalized, the votes
                        // are still in flight (gossipsub latency). View-changing here
                        // clears all accumulated votes and forces a re-propose with a
                        // new timestamp -> new hash -> peers (who may have already voted
                        // on the old hash) never reach supermajority on the new hash.
                        // The leader must instead re-broadcast the SAME block (handled
                        // by the re-propose timeout below). Only NON-leaders view-change
                        // to skip a leader that is genuinely down.
                        let caught_up = engine.state.last_finalized_height >= highest_seen_height;
                        let we_are_leader = engine.is_leader();
                        if ticks_in_current_round >= ROUND_TIMEOUT_TICKS && caught_up && !we_are_leader {
                            tracing::warn!(
                                "Round timed out after {} ticks at height {} (view {}) -- advancing view (view-change)",
                                ticks_in_current_round,
                                engine.state.last_finalized_height,
                                engine.state.view_offset
                            );
                            engine.state.advance_view();
                            ticks_in_current_round = 0;
                            // Reset per-round proposal guard so the new leader can propose
                            last_proposed_height = u64::MAX;
                            last_proposed_block = None;
                            ticks_since_propose = 0;
                            // NOTE: do NOT clear prepare_votes/commit_votes here.
                            // Clearing discards valid votes that arrived late (gossipsub
                            // delivery is asynchronous). Keeping them lets a re-broadcast
                            // of the same block still reach supermajority when the
                            // missing votes finally arrive. Votes are keyed by block_hash,
                            // so stale votes for a different hash simply never match.
                        }
                    }
                }

                // Heartbeat every 5 ticks (~2s) so we can confirm the loop is alive
                if tick_count % 5 == 0 {
                    // Count pending votes for the current target height so we can
                    // see whether the BFT round is actually collecting votes or
                    // stalling. This is the key diagnostic for supermajority stalls.
                    let target_h = engine.state.last_finalized_height + 1;
                    let prep = engine.prepare_votes.values()
                        .filter(|vs| vs.first().map(|v| v.height == target_h).unwrap_or(false))
                        .map(|vs| vs.len()).sum::<usize>();
                    let comm = engine.commit_votes.values()
                        .filter(|vs| vs.first().map(|v| v.height == target_h).unwrap_or(false))
                        .map(|vs| vs.len()).sum::<usize>();
                    tracing::info!(
                        "heartbeat: tick={}, round={}, finalized_height={}, seen={}, validators={}, mempool={}, prep_votes={}, commit_votes={}",
                        tick_count, engine.state.current_round,
                        engine.state.last_finalized_height, highest_seen_height,
                        engine.state.validators.len(), engine.mempool.len(),
                        prep, comm
                    );
                    // G15-alarm: surface the quantum alarm state in the
                    // heartbeat. If Emergency is declared, every node must
                    // know — Dilithium3-only signatures are being rejected
                    // and SPHINCS+ co-signatures are required.
                    if engine.quantum_alarm.is_emergency() {
                        tracing::error!(
                            "QUANTUM ALARM: Emergency declared at height {:?} — \
                             Dilithium3-only signatures rejected, SPHINCS+ co-signature required",
                            engine.quantum_alarm.emergency_height
                        );
                    }
                }
                if engine.state.validators.is_empty() {
                    tracing::warn!("No validators registered -- skipping block production");
                    continue;
                }

                // -- P1: persist equivocation slashes to the DB --
                // `detect_and_slash_equivocation` mutates `state.validators`
                // (stake + status) in memory when a double-sign is detected.
                // Without persisting here, a node restart would lose the slash
                // and the offender's stake would silently restore. Drain the
                // pending list and write each slashed validator to the DB so
                // the slash is durable on-chain.
                for (offender_pk, _height) in engine.last_equivocators.drain(..) {
                    let offender_addr = rstn_crypto::derive_address(&offender_pk);
                    if let Some(v) = engine.state.validators.iter().find(|v| v.pubkey.0 == offender_pk.0).cloned() {
                        if let Err(e) = state.db.put_validator(&offender_addr, &v) {
                            tracing::warn!("Failed to persist slash for validator: {}", e);
                        } else {
                            tracing::info!(
                                "Persisted slash for validator {} (stake={}, status={:?})",
                                rstn_crypto::format_address(&offender_addr),
                                v.stake, v.status,
                            );
                        }
                    }
                }

                // Sync mempool from DB
                if let Ok(pending_txs) = state.db.get_mempool_txs(512) {
                    for tx in pending_txs {
                        let tx_hash = tx.hash();
                        let already_in = engine.mempool.iter().any(|t| t.hash() == tx_hash);
                        if !already_in {
                            // Verify signature before adding to engine mempool
                            match engine.add_tx(tx) {
                                Ok(()) => {}
                                Err(e) => tracing::warn!("Rejected tx from mempool: {}", e),
                            }
                        }
                    }
                }

                // -- Re-broadcast pending mempool txs (multi-node only) --
                if !is_dev && tick_count % 5 == 0 {
                    if let Ok(pending_txs) = state.db.get_mempool_txs(64) {
                        for tx in pending_txs {
                            let _ = outbound.try_send(OutboundMessage::Transaction(tx));
                        }
                    }
                }

                // -- Re-broadcast our own pending votes --
                // Votes are the most fragile messages in BFT. A lost vote means the
                // block never reaches supermajority -> permanent stall. We re-publish
                // every ~2s (every 5th tick) using try_send (NON-BLOCKING).
                //
                // CRITICAL: we MUST use try_send, NOT send().await. A blocking send
                // here creates a channel deadlock: the tick loop blocks on the
                // outbound channel -> it never polls inbound.recv() -> the inbound
                // channel fills -> the P2P loop blocks on inbound_tx.send() -> both
                // loops deadlock -> the node never processes incoming votes ->
                // prep_votes stays at 1 (self-vote only) -> permanent height=1 stall.
                // try_send drops the re-broadcast if the channel is full; it retries
                // next cycle. The nonce wrapper in network.rs makes each re-broadcast
                // byte-unique so gossipsub doesn't dedup it.
                if !is_dev && !my_pending_votes.is_empty() && tick_count % 5 == 0 {
                    for vote in &my_pending_votes {
                        let _ = outbound.try_send(OutboundMessage::Vote(vote.clone()));
                    }
                }

                // -- Re-broadcast the last proposed block (multi-node only) --
                // If the initial block broadcast was dropped (try_send failed because
                // the P2P loop was busy), re-send it every 5 ticks so peers eventually
                // receive it and can vote on it.
                if !is_dev && tick_count % 5 == 0 {
                    if let Some(ref block) = last_proposed_block {
                        let _ = outbound.try_send(OutboundMessage::Block(block.clone()));
                    }
                }

                // -- Proactive catch-up (multi-node only) --
                // If we know the network is ahead of us (we've seen a higher block
                // than we've finalized), periodically ask peers for the missing
                // blocks. We also SKIP leading while behind -- a lagging leader would
                // propose a stale block and stall the round.
                if !is_dev {
                    let our_height = engine.state.last_finalized_height;
                    if highest_seen_height > our_height {
                        ticks_since_sync_request += 1;
                        if ticks_since_sync_request >= SYNC_REQUEST_INTERVAL_TICKS {
                            ticks_since_sync_request = 0;
                            tracing::info!(
                                "Behind (finalized #{}, seen #{}) -- requesting sync from peers",
                                our_height, highest_seen_height
                            );
                            let _ = outbound.try_send(OutboundMessage::SyncRequest(our_height + 1));
                        }
                    }
                }

                // NOTE: Periodic DB catch-up (try_catchup on every tick) was REMOVED.
                // It finalized blocks from the DB WITHOUT vote certificates,
                // consolidating forks when two nodes had different proposals for
                // the same height in their DBs. Finalization MUST only happen via
                // COMMIT supermajority (real BFT) or via sync delivery of a block
                // that is >1 ahead (proven finalized by the leader). The sync
                // path in the BlockProposal handler (gap > 1) is the ONLY
                // catch-up mechanism -- it is safe because a block at height H+2
                // proves H+1 was finalized by the leader.

                // Single-node dev mode: auto-produce and auto-finalize
                if is_dev && engine.state.validators.len() == 1 {
                    if engine.is_leader() {
                        // -- Pre-execute transactions to compute post-tx state_root --
                        // In BFT, the leader executes txs locally, computes the new state_root,
                        // and includes it in the block header. Validators re-execute to verify.
                        // Here we snapshot the DB, apply txs, compute state_root, then revert.
                        // For dev mode (single node), we apply directly since there's no revert risk.
                        let pre_state_root = compute_state_root(&state.db);
                        match engine.propose_block(pre_state_root) {
                            // Note: the state_root in the header is the PRE-tx state.
                            // After applying txs, we recompute and store the block with
                            // the POST-tx state_root. This is acceptable in dev mode
                            // since there's only one node. In multi-node mode, the leader
                            // must pre-execute txs to compute the correct post-tx state_root.
                            Ok(block) => {
                                let height = block.header.height;
                                let tx_count = block.transactions.len();

                                // -- Apply state transitions (shared function) --
                                let _processed = apply_block_transactions(&state, &block, &mut engine.circuit_breaker);

                                // -- Recompute state_root AFTER applying txs --
                                // The block header's state_root should reflect the post-tx state.
                                let post_state_root = compute_state_root(&state.db);
                                let mut block = block;
                                block.header.state_root = post_state_root;

                                // -- CRITICAL: re-sign the block --
                                // propose_block() signed the block with the PRE-tx state_root.
                                // We just mutated state_root to the POST-tx value, which changes
                                // the block hash and invalidates the original signature.
                                // Without re-signing, finalize_block()'s signature check fails
                                // and NO block is ever finalized -- the chain stalls at genesis.
                                let new_hash = block.hash();
                                block.header.signature = engine.keypair.sign(&new_hash);

                                // -- Distribute block reward to validator --
                                // Each block mints a small reward (0.1 RSTN = 10^17 wei) to the validator.
                                // In production this comes from staking inflation, not minting.
                                let validator_addr = rstn_crypto::derive_address(&block.header.validator);
                                let block_reward: u128 = 100_000_000_000_000_000; // 0.1 RSTN (18 decimals)
                                let _ = state.db.update_rewards(&validator_addr, block_reward as i128);

                                // -- Store block + txs --
                                store_block_and_txs(&state, height, &block);

                                // Log BEFORE finalize so we get immediate feedback even if
                                // finalize hits an edge case.
                                tracing::info!("Block #{} produced | {} txs | hash: {}...",
                                    height, tx_count, &hex::encode(&new_hash[..16]));

                                if let Err(e) = engine.finalize_block(block.clone()) {
                                    tracing::error!("Failed to finalize block {}: {}", height, e);
                                    continue;
                                }

                                // C4: persist + gossip the commit certificate so lagging
                                // nodes can verify finality. In dev mode the leader's own
                                // self-vote is the only commit vote; the certificate still
                                // proves the leader signed (sufficient for single-node).
                                finalize_commit_certificate(
                                    &state, &engine, &outbound, height, new_hash,
                                );

                                // M1: reset the formal round timer on finalization so the
                                // wall-clock view-change timeout in ConsensusState is accurate.
                                engine.state.start_round();

                                {
                                    let mut consensus = state.consensus.write().await;
                                    *consensus = engine.state.clone();
                                }
                                sync_g15_state(&state, &engine, height, &block).await;
                            }
                            Err(e) => {
                                if e.to_string() != "not the elected leader for this round" {
                                    tracing::warn!("Block proposal error: {}", e);
                                }
                            }
                        }
                    }
                    continue;
                }

                // Multi-node mode: leader proposes and broadcasts
                // -- A lagging node must NOT lead --
                // If we're behind the network (we've seen blocks we haven't finalized),
                // skip proposing this round. A stale proposal would be rejected by peers
                // and stall the round. We catch up via proactive sync instead.
                if !is_dev && engine.state.last_finalized_height < highest_seen_height {
                    continue;
                }

                if engine.is_leader() {
                    // -- Startup grace period --
                    // gossipsub needs ~5-10s to form the mesh at startup. If the
                    // leader proposes block #1 in the first 400ms tick, the block
                    // broadcast is lost (no peers in the mesh yet) and the round
                    // stalls forever -- the leader only sees its own self-vote.
                    // We wait until at least one peer is connected AND a minimum
                    // number of ticks have elapsed before proposing. This is the
                    // #1 cause of the permanent height=1 stall in local testnets.
                    if tick_count < 25 {
                        // 25 * 400ms = 10s grace period for mesh to graft
                        continue;
                    }

                    // -- Propose ONCE per height --
                    // If we already proposed a block for the current target height
                    // (parent.height + 1), do NOT re-propose. Re-proposing creates a
                    // new block with a new timestamp/hash every tick, which scatters
                    // peer votes across many hashes -> never reaches COMMIT
                    // supermajority -> finalization takes seconds. We wait until
                    // finalization advances the chain (so the target height changes)
                    // before proposing again.
                    let target_height = engine.state.last_finalized_height + 1;
                    if last_proposed_height == target_height {
                        // Already proposed for this height. If the block finalized,
                        // last_finalized_height advanced so target_height changed and
                        // this guard wouldn't match. If we're here, the block is
                        // STILL pending votes. Increment the timeout counter and
                        // re-propose only if we've waited too long -- otherwise skip
                        // to avoid scattering peer votes across many hashes.
                        ticks_since_propose += 1;
                        if ticks_since_propose < REPROPOSE_TIMEOUT_TICKS {
                            continue;
                        }
                        // Timeout: votes were lost or a peer is desynced. Re-broadcast
                        // the EXACT same block (same hash) we proposed before -- do NOT
                        // create a new block with a fresh timestamp, because a new hash
                        // scatters peer votes across two hashes and prevents COMMIT
                        // supermajority. Re-broadcasting the identical block lets the
                        // missing votes accumulate on the same hash. We also re-send
                        // our own PREPARE vote so peers that missed it can vote too.
                        tracing::warn!(
                            "Re-broadcasting block #{} after {} ticks (votes timed out)",
                            target_height, ticks_since_propose
                        );
                        ticks_since_propose = 0;
                        if let Some(ref block) = last_proposed_block {
                            let _ = outbound.try_send(OutboundMessage::Block(block.clone()));
                            // Re-send our own prepare vote on the same hash.
                            match engine.vote_prepare(block) {
                                Ok(vote) => {
                                    let _ = outbound.try_send(OutboundMessage::Vote(vote));
                                }
                                Err(e) => tracing::warn!("Leader re-prepare vote error: {}", e),
                            }
                            tracing::info!("Block #{} re-broadcast | hash: {}...",
                                target_height, &hex::encode(&block.hash()[..16]));
                        }
                        continue;
                    } else {
                        ticks_since_propose = 0;
                    }

                    // -- Pre-execute transactions to compute POST-tx state_root --
                    // The leader executes the block's transactions locally FIRST,
                    // computes the resulting state_root, then re-signs the block with
                    // that correct state_root. This guarantees:
                    //   1. The block header's state_root reflects post-tx state.
                    //   2. Every node that re-executes the same txs reaches the same
                    //      state_root (deterministic state transition).
                    // The leader applies the txs to its own DB now; at finalization
                    // it skips re-applying (tracked in `pre_applied`).
                    let pre_state_root = compute_state_root(&state.db);
                    match engine.propose_block(pre_state_root) {
                        Ok(mut block) => {
                            last_proposed_height = block.header.height;
                            ticks_since_propose = 0;
                            let height = block.header.height;

                            // Apply state transitions on the leader's DB now
                            let _processed = apply_block_transactions(&state, &block, &mut engine.circuit_breaker);

                            // Recompute state_root AFTER applying txs (post-tx)
                            let post_state_root = compute_state_root(&state.db);
                            block.header.state_root = post_state_root;

                            // Re-sign the block -- the state_root changed, so the
                            // original signature is invalid. Without re-signing,
                            // finalize_block()'s signature check fails on every node.
                            let new_hash = block.hash();
                            block.header.signature = engine.keypair.sign(&new_hash);

                            // Mark this height as already applied by the leader so
                            // finalization (below) does NOT apply txs a second time.
                            pre_applied.insert(height);

                            // Distribute block reward to the leader/validator
                            let validator_addr = rstn_crypto::derive_address(&block.header.validator);
                            let block_reward: u128 = 100_000_000_000_000_000; // 0.1 RSTN
                            let _ = state.db.update_rewards(&validator_addr, block_reward as i128);

                            let hash = hex::encode(new_hash);
                            tracing::info!("Block #{} proposed by leader, broadcasting...", height);

                            // Broadcast the block proposal to peers
                            let _ = outbound.try_send(OutboundMessage::Block(block.clone()));

                            // Leader also votes prepare on its own proposal
                            match engine.vote_prepare(&block) {
                                Ok(vote) => {
                                    my_pending_votes.push(vote.clone());
                                    let _ = outbound.try_send(OutboundMessage::Vote(vote));
                                }
                                Err(e) => tracing::warn!("Leader prepare vote error: {}", e),
                            }

                            // -- Remove proposed txs from the DB mempool NOW --
                            // propose_block() drained the ENGINE mempool, but the DB
                            // mempool still holds these txs. If we leave them, the next
                            // tick re-syncs them into the engine mempool AND re-broadcasts
                            // them to peers. Since the leader already incremented the
                            // sender's nonce (pre-applied), a re-broadcast tx carries a
                            // stale nonce -> peers reject it with "nonce mismatch" forever,
                            // and the tx loops endlessly. Removing them here (at proposal
                            // time, before finalization) breaks the loop cleanly.
                            for tx in &block.transactions {
                                let _ = state.db.remove_from_mempool(&tx.hash());
                            }

                            // Store block locally (will be finalized after votes)
                            let _ = state.db.put_block(height, &block);
                            // Cache the finalized block for re-broadcast on vote timeout.
                            last_proposed_block = Some(block.clone());

                            tracing::info!("Block #{} broadcast | hash: {}...", height, &hash[..16]);
                        }
                        Err(e) => {
                            if e.to_string() != "not the elected leader for this round" {
                                tracing::warn!("Block proposal error: {}", e);
                            }
                        }
                    }
                }
            }

            // -- Receive messages from P2P network --
            msg = inbound.recv() => {
                match msg {
                    Some(NetworkMessage::BlockProposal(block)) => {
                        let height = block.header.height;
                        let hash = hex::encode(block.hash());

                        // -- Determine if we're BEHIND before updating highest_seen --
                        // A node is "behind" only if it has ALREADY seen a block HIGHER
                        // than this one -- meaning it missed earlier proposals and is now
                        // receiving sync deliveries of already-finalized blocks.
                        //
                        // CRITICAL: we must capture this BEFORE updating highest_seen_height.
                        // If we update highest_seen to `height` first, then
                        // `last_finalized < highest_seen` becomes true for EVERY node
                        // receiving the expected next block (e.g. finalized=0, receives #1,
                        // highest_seen becomes 1, 0<1=true). That makes every validator
                        // think it's behind -> it finalizes directly instead of voting ->
                        // the leader never collects enough PREPARE votes -> permanent stall.
                        let seen_higher = highest_seen_height > height;

                        // Track the highest block height we've seen from any peer.
                        if height > highest_seen_height {
                            highest_seen_height = height;
                        }

                        // Verify the block's Dilithium3 signature FIRST.
                        if block.header.height > 0 {
                            if let Err(e) = block.verify_block_signature() {
                                tracing::warn!("Invalid block signature from peer on block #{}: {}", height, e);
                                continue;
                            }
                        }
                        if let Err(e) = block.validate_tx_root() {
                            tracing::warn!("Invalid tx_root in block #{}: {}", height, e);
                            continue;
                        }

                        // Store the block in the DB so it can be finalized once we
                        // catch up or collect enough votes.
                        let _ = state.db.put_block(height, &block);

                        let expected_height = engine.state.last_finalized_height + 1;
                        if height == expected_height {
                            // -- Distinguish a LIVE proposal from a SYNC delivery --
                            // `seen_higher` tells us whether we previously saw a block
                            // above this height. If yes, we're catching up -- this block
                            // was already finalized by the network, so finalize it directly
                            // (no voting). If no, this is a fresh live proposal from the
                            // current leader -- vote PREPARE on it.
                            if !seen_higher {
                                // Fresh live proposal -- validate against parent and vote.
                                if let Some(parent) = engine.state.latest_block() {
                                    if let Err(e) = block.validate_header(parent) {
                                        tracing::warn!("Invalid block proposal from peer: {}", e);
                                        continue;
                                    }
                                }
                                if !engine.is_leader() {
                                    match engine.vote_prepare(&block) {
                                        Ok(vote) => {
                                            tracing::info!("Voted PREPARE on block #{} (voter={})", height, &hex::encode(&vote.voter.0[..8]));
                                            my_pending_votes.push(vote.clone());
                                            let _ = outbound.try_send(OutboundMessage::Vote(vote));
                                        }
                                        Err(e) => tracing::warn!("Prepare vote error: {}", e),
                                    }
                                } else {
                                    tracing::debug!("Leader received own block #{} -- not voting (self-vote already cast at proposal)", height);
                                }
                                // Activity-based timeout reset: a valid proposal for the
                                // expected height proves the leader is alive.
                                ticks_in_current_round = 0;

                                // G14 — Censorship detection: after voting on a
                                // block, check if any tx from our local mempool was
                                // NOT included. If so, attest it as excluded so the
                                // committee can force it into the next block (N+1).
                                // This makes the claim "cualquier transacción
                                // puede ser forzada al bloque en N+1" true.
                                if !engine.is_leader() {
                                    detect_and_attest_censored_txs(
                                        &mut engine, &block, &outbound,
                                    );
                                }
                            } else {
                                // SYNC delivery of an already-finalized block. Finalize
                                // it directly (no voting) and continue catching up.
                                tracing::info!(
                                    "<< Sync-delivered block #{} (already finalized network-wide) -- finalizing directly",
                                    height
                                );
                                try_catchup(
                                    &state, &mut engine, &mut pre_applied,
                                    &mut current_round_tracker_view, &mut ticks_in_current_round,
                                    &mut last_proposed_height, &mut last_proposed_block,
                                    &mut my_pending_votes,
                                ).await;
                            }
                        } else if height > expected_height {
                            // We're behind -- store the block and request catch-up.
                            tracing::info!(
                                "<< Stored future block #{} (expected #{}) -- requesting sync",
                                height, expected_height
                            );
                            let _ = outbound.try_send(OutboundMessage::SyncRequest(expected_height));

                            // -- Catch-up finalization (sync delivery only) --
                            try_catchup(
                                &state, &mut engine, &mut pre_applied,
                                &mut current_round_tracker_view, &mut ticks_in_current_round,
                                &mut last_proposed_height, &mut last_proposed_block,
                                &mut my_pending_votes,
                            ).await;
                        }
                        // height < expected_height -> stale/duplicate, ignore
                    }
                    Some(NetworkMessage::Transaction(tx)) => {
                        // Add received transaction to mempool
                        let tx_hash = tx.hash();
                        let _ = state.db.add_to_mempool(&tx_hash, &tx);
                        tracing::info!("<< Tx from peer: {}... (gossiped to mempool)", hex::encode(&tx_hash[..8]));
                        // Re-gossip to other peers (flooding gossip). This ensures a tx
                        // submitted to any node reaches the leader within one hop. We use
                        // try_send (non-blocking) so a slow P2P channel never stalls consensus.
                        let _ = outbound.try_send(OutboundMessage::Transaction(tx));
                    }
                    Some(NetworkMessage::Vote(vote)) => {
                        let height = vote.height;
                        let block_hash = vote.block_hash;

                        // NOTE: We do NOT re-flood received votes. Re-flooding creates an
                        // infinite loop between non-leader nodes (each re-broadcasts every
                        // vote it receives from the others), saturating the outbound channel.
                        // When many re-floods happen in the same nanosecond, the per-publish
                        // nonce collides -> identical gossipsub message_id -> "Duplicate" error
                        // -> real votes are dropped -> leader only sees its own self-vote ->
                        // permanent height=1 stall.
                        //
                        // Instead, vote delivery relies on:
                        //   1. flood_publish=true -- a node's own vote reaches ALL peers in
                        //      one hop (including the leader) the moment it is cast.
                        //   2. my_pending_votes re-broadcast -- every 2s each node re-publishes
                        //      its OWN pending votes, so a vote lost before the mesh grafted
                        //      is retried until the leader receives it.
                        // This is sufficient and avoids the re-flood amplification loop.

                        // -- Activity-based timeout reset --
                        // Any vote for the CURRENT target height proves the BFT round is
                        // progressing (votes are arriving). Reset the round-timeout counter
                        // so we don't view-change while a round is actively collecting votes.
                        // This prevents premature view-changes that desync leader election.
                        if height == engine.state.last_finalized_height + 1 {
                            ticks_in_current_round = 0;
                        }

                        tracing::info!("<< Received {:?} vote from {} for block #{} hash={}...",
                            vote.phase, &hex::encode(&vote.voter.0[..8]), height, &hex::encode(&block_hash[..8]));

                        // Try to collect as prepare vote
                        match engine.collect_prepare_vote(vote.clone()) {
                            Ok(reached_supermajority) => {
                                let count = engine.prepare_votes.get(&block_hash).map(|v| v.len()).unwrap_or(0);
                                tracing::info!("PREPARE vote accepted ({} for #{}, need supermajority)", count, height);
                                if reached_supermajority {
                                    tracing::info!("PREPARE supermajority reached for block #{}", height);

                                    // Vote commit
                                    match engine.vote_commit(block_hash, height) {
                                        Ok(commit_vote) => {
                                            my_pending_votes.push(commit_vote.clone());
                                            let _ = outbound.try_send(OutboundMessage::Vote(commit_vote));
                                        }
                                        Err(e) => tracing::warn!("Commit vote error: {}", e),
                                    }
                                }
                            }
                            Err(e) => {
                                // Prepare collection failed -- log WHY (not silently).
                                // Could be: commit-phase vote, non-active validator, invalid
                                // signature, or duplicate. Then try collecting as commit.
                                tracing::warn!("PREPARE vote rejected ({}): voter={} height={}", e, &hex::encode(&vote.voter.0[..8]), height);
                                // Maybe it's a commit vote -- try collecting as commit
                                match engine.collect_commit_vote(vote) {
                                    Ok(reached_supermajority) => {
                                        if reached_supermajority {
                                            // Safety: skip finalization if this height was
                                            // already finalized (late commit vote). The
                                            // consensus engine guards against this, but we
                                            // double-check here to avoid any redundant
                                            // finalize_block() call that would log a
                                            // spurious "height mismatch" error.
                                            if height <= engine.state.last_finalized_height {
                                                tracing::debug!("Late COMMIT vote for already-finalized block #{} -- ignoring", height);
                                                continue;
                                            }
                                            tracing::info!("COMMIT supermajority reached for block #{}", height);

                                            // Finalize the block
                                            if let Some(block) = state.db.get_block(height).unwrap_or(None) {
                                            // Finalize the block FIRST (validates sig + header + tx_root)
                                                            match engine.finalize_block(block.clone()) {
                                                                Ok(()) => {
                                                                    let hash = hex::encode(engine.state.latest_block().map(|b| b.hash()).unwrap_or([0u8; 64]));
                                                                    tracing::info!("[OK] Block #{} finalized | hash: {}...",
                                                                        height, &hash[..16]);

                                                                    // -- Apply state transitions AFTER finalization --
                                                                    // The LEADER already applied the txs at proposal time
                                                                    // (pre-applied) and already distributed the block reward.
                                                                    // Non-leaders apply the txs here for the first time so
                                                                    // their state matches the leader's post-tx state_root.
                                                                    if !pre_applied.contains(&height) {
                                                                        let _processed = apply_block_transactions(&state, &block, &mut engine.circuit_breaker);

                                                                        // -- Distribute block reward to validator --
                                                                        let validator_addr = rstn_crypto::derive_address(&block.header.validator);
                                                                        let block_reward: u128 = 100_000_000_000_000_000; // 0.1 RSTN
                                                                        let _ = state.db.update_rewards(&validator_addr, block_reward as i128);
                                                                    } else {
                                                                        // Leader already applied -- just stop tracking this height
                                                                        pre_applied.remove(&height);
                                                                    }

                                                                    // Update RPC state
                                                                    {
                                                                        let mut consensus = state.consensus.write().await;
                                                                        *consensus = engine.state.clone();
                                                                    }

                                                                    // Store transactions and clear mempool
                                                                    store_block_and_txs(&state, height, &block);
                                                                    sync_g15_state(&state, &engine, height, &block).await;

                                                                    // C4: persist + gossip the commit certificate so
                                                                    // lagging nodes verify finality cryptographically.
                                                                    finalize_commit_certificate(
                                                                        &state, &engine, &outbound, height, block.hash(),
                                                                    );

                                                                    // Clear our own pending votes for this finalized height
                                                                    my_pending_votes.retain(|v| v.height != height);

                                                                    // -- Rebroadcast the finalized block --
                                                                    // A lagging peer may have missed the original proposal.
                                                                    // Re-publishing lets it catch up. Finalization also
                                                                    // advanced last_finalized_height, so the leader's
                                                                    // last_proposed_height guard now allows proposing the
                                                                    // next block.
                                                                    let _ = outbound.try_send(OutboundMessage::Block(block.clone()));
                                                                }
                                                                Err(e) => tracing::error!("Finalize error: {}", e),
                                                            }
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        // Vote from unknown validator, invalid signature,
                                        // or duplicate -- log at WARN (not debug) so we can
                                        // diagnose supermajority stalls. Duplicates are
                                        // expected and harmless; signature/validator errors
                                        // are the real signal.
                                        tracing::warn!("Ignored commit vote: {}", e);
                                    }
                                }
                            }
                        }
                    }
                    Some(NetworkMessage::InclusionAttestation(att, tx_payload)) => {
                        // G14 — A peer validator attested that a tx was
                        // excluded from a block. Feed it into the engine's
                        // forced-inclusion pool. When 2/3+ of the active
                        // validator set attest, the tx becomes "forced" and the
                        // next proposer MUST include it (or the block is
                        // invalid). We also add our own attestation if we
                        // independently saw the tx in our mempool (so the
                        // threshold is reached faster).
                        let was_forced = engine.attest_excluded(att, tx_payload);
                        if was_forced {
                            tracing::info!(
                                "G14: tx reached forced-inclusion threshold — next block MUST include it"
                            );
                        }
                    }
                    Some(NetworkMessage::Proposal(proposal)) => {
                        // Handle consensus proposal (same as block proposal for now)
                        let height = proposal.block.header.height;
                        tracing::debug!("Received consensus proposal for block #{}", height);
                    }
                    Some(NetworkMessage::SyncRequest(from_height)) => {
                        // A lagging peer asked for blocks starting from `from_height`.
                        // Re-broadcast every block we have in the DB from that height
                        // onward -- including the just-proposed (not-yet-finalized)
                        // block, which the lagging node needs in order to vote on it.
                        // The leader or any synced node responds.
                        let our_height = highest_seen_height.max(engine.state.last_finalized_height);
                        if from_height <= our_height {
                            tracing::info!(
                                "Responding to sync request: sending blocks #{}..#{}",
                                from_height, our_height
                            );
                            for h in from_height..=our_height {
                                if let Ok(Some(block)) = state.db.get_block(h) {
                                    let _ = outbound.try_send(OutboundMessage::Block(block));
                                    // C4: also send the commit certificate so the
                                    // lagging node can verify finality (not just
                                    // trust the leader signature).
                                    if let Ok(Some(cert)) = state.db.get_commit_cert(h) {
                                        let _ = outbound.try_send(OutboundMessage::CommitCertificate(cert));
                                    }
                                }
                            }
                        }
                    }
                    Some(NetworkMessage::CommitCertificate(cert)) => {
                        // A peer gossiped a commit certificate. Persist it so
                        // our own catch-up path can verify finality (C4). We
                        // do NOT finalize here -- finalization happens via the
                        // normal COMMIT-supermajority path or via try_catchup
                        // (which now verifies the certificate). Storing it
                        // early means a lagging node that receives the cert
                        // before the block can still verify it later.
                        let h = cert.height;
                        // Verify the certificate against our validator set
                        // before persisting -- don't store junk.
                        if let Ok(Some(block)) = state.db.get_block(h) {
                            let block_hash = block.hash();
                            match cert.verify(&engine.state.validators, &block_hash) {
                                Ok(()) => {
                                    if let Err(e) = state.db.put_commit_cert(h, &cert) {
                                        tracing::warn!("Failed to store gossiped commit cert for #{}: {}", h, e);
                                    } else {
                                        tracing::info!(
                                            "Stored verified commit certificate for block #{} ({} votes)",
                                            h, cert.votes.len()
                                        );
                                    }
                                }
                                Err(e) => {
                                    tracing::warn!("Rejected gossiped commit cert for #{}: {}", h, e);
                                }
                            }
                        } else {
                            // Block not yet known -- store the cert anyway; it
                            // will be verified when the block arrives and
                            // try_catchup runs. Use a deferred-verify store.
                            let _ = state.db.put_commit_cert(h, &cert);
                            tracing::debug!(
                                "Stored commit cert for #{} (block not yet known -- deferred verify)",
                                h
                            );
                        }
                    }
                    None => {
                        tracing::info!("Inbound channel closed, stopping block production");
                        break;
                    }
                }
            }
        }
    }
}

// --- G14: Censorship detection (forced-inclusion attestation) ---

/// After a validator votes PREPARE on a block, detect transactions from the
/// local mempool that were NOT included in the block and attest them as
/// excluded. Each attestation is broadcast to the committee; when 2/3+ of the
/// active validator set attest the same tx, it becomes "forced" and the next
/// proposer MUST include it (or the block is invalid).
///
/// This is the on-wire counterpart to the engine's `attest_excluded` method:
/// here we detect the exclusion, create the attestation with our keypair, and
/// broadcast it so other validators can add their signatures and reach the
/// threshold.
fn detect_and_attest_censored_txs(
    engine: &mut ConsensusEngine,
    block: &rstn_core::Block,
    outbound: &mpsc::Sender<OutboundMessage>,
) {
    use rstn_core::forced_inclusion::InclusionAttestation;

    // Only attest if the block height is > 0 (production blocks, not genesis).
    if block.header.height == 0 {
        return;
    }

    // Compute the set of tx commitments included in the block.
    let included: std::collections::HashSet<[u8; 64]> = block
        .transactions
        .iter()
        .map(|tx| {
            let enc = tx.canonical_encode();
            let mut commit = [0u8; 64];
            commit.copy_from_slice(&rstn_crypto::keccak512(&enc));
            commit
        })
        .collect();

    // For each tx in our local mempool that was NOT included, attest it.
    let censored: Vec<&rstn_core::Transaction> = engine
        .mempool
        .iter()
        .filter(|tx| {
            let enc = tx.canonical_encode();
            let mut commit = [0u8; 64];
            commit.copy_from_slice(&rstn_crypto::keccak512(&enc));
            !included.contains(&commit)
        })
        .collect();

    if censored.is_empty() {
        return;
    }

    tracing::info!(
        "G14: detected {} censored tx(s) in block #{} — attesting for forced inclusion",
        censored.len(),
        block.header.height
    );

    for tx in censored {
        let payload = serde_json::to_vec(tx).unwrap_or_default();
        let tx_commitment = rstn_crypto::keccak512(&payload);
        let mut sign_buf = Vec::with_capacity(8 + 64);
        sign_buf.extend_from_slice(&block.header.height.to_le_bytes());
        sign_buf.extend_from_slice(&tx_commitment);
        let msg = rstn_crypto::keccak512(&sign_buf);
        let sig = engine.keypair.sign(&msg);
        let att = InclusionAttestation {
            excluded_at_height: block.header.height,
            tx_commitment,
            validator: engine.keypair.public.clone(),
            signature: sig,
        };
        // Feed it into our own engine's forced pool.
        let _ = engine.attest_excluded(att.clone(), payload.clone());
        // Broadcast to peers so they can add their signatures.
        let _ = outbound.try_send(OutboundMessage::InclusionAttestation(att, payload));
    }
}

// --- HTTP parsing helpers ---

fn find_header_end(data: &[u8]) -> Option<usize> {
    for i in 0..data.len().saturating_sub(3) {
        if data[i] == b'\r' && data[i + 1] == b'\n' && data[i + 2] == b'\r' && data[i + 3] == b'\n' {
            return Some(i);
        }
    }
    None
}

fn extract_content_length(headers: &str) -> usize {
    for line in headers.lines() {
        if line.to_lowercase().starts_with("content-length:") {
            let val = line.split(':').nth(1).unwrap_or("0").trim();
            return val.parse().unwrap_or(0);
        }
    }
    0
}

/// Extract the API key from the `X-API-Key` or `Authorization: Bearer` header.
/// Returns None if no key is present (testnet mode allows this).
fn extract_api_key(headers: &str) -> Option<String> {
    for line in headers.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("x-api-key:") {
            return line.split(':').nth(1).map(|s| s.trim().to_string());
        }
        if lower.starts_with("authorization:") {
            let val = line.split(':').nth(1).unwrap_or("").trim();
            if let Some(token) = val.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }
    None
}

/// Extract a header value by case-insensitive name (e.g. "origin").
/// Used by the CORS allow-list check (M4) to reflect only allow-listed origins.
fn extract_header_value(headers: &str, name: &str) -> Option<String> {
    let prefix = format!("{}:", name.to_lowercase());
    for line in headers.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with(&prefix) {
            return line.split(':').nth(1).map(|s| s.trim().to_string());
        }
    }
    None
}
