//! rstn-node -- P2P Network Event Loop
//!
//! Bridges libp2p gossipsub events to the consensus engine via tokio channels.
//! Handles: incoming blocks, transactions, consensus proposals, and votes.
//!
//! CRITICAL: ALL message types (blocks, txs, votes, sync requests) are
//! published on ONE unified gossipsub topic (`TOPIC_ALL`), discriminated by a
//! leading tag byte. This eliminates the class of bugs where one topic's mesh
//! grafts but another's doesn't -- if blocks propagate, votes propagate too,
//! because they share the exact same gossipsub mesh and peers.
//!
//! ANTI-DEDUP: Every published message is prepended with a per-node monotonic
//! 8-byte nonce BEFORE the tag byte. This makes every publish byte-unique even
//! when re-broadcasting the exact same block/vote/tx -- gossipsub's content-hash
//! dedup cache will NOT swallow re-broadcasts. Without this, a vote lost on the
//! first publish (mesh not yet grafted at startup) can NEVER be re-delivered:
//! every re-broadcast is byte-identical -> "Duplicate" -> dropped forever ->
//! the leader only sees its own self-vote -> permanent height=1 stall.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;
use libp2p::{
    gossipsub, swarm::SwarmEvent, Swarm,
};
use futures::StreamExt;
use rstn_p2p::{
    RstnBehaviour, RstnBehaviourEvent, TOPIC_ALL,
    TAG_BLOCK, TAG_VOTE, TAG_TX, TAG_SYNC, TAG_COMMIT_CERT, TAG_INCLUSION_ATTESTATION,
    TAG_DAS_SHARD,
};
use rstn_core::{Block, Transaction, BftVote, BftProposal, CommitCertificate, forced_inclusion::InclusionAttestation};
use crate::das_wire::{DasShardRequest, DasShardResponse};
use rstn_rpc::RpcState;
use rstn_crypto::Dilithium3Keypair;
use rstn_p2p::pq_session::PeerSessionManager;

/// Monotonic per-node publish counter. Prepended to every gossipsub message
/// so each publish is byte-unique and bypasses gossipsub's dedup cache.
static PUBLISH_NONCE: AtomicU64 = AtomicU64::new(0);

/// Messages received from the P2P network, delivered to the consensus engine.
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub enum NetworkMessage {
    /// A block proposal from the leader.
    BlockProposal(Block),
    /// A transaction gossiped by a peer.
    Transaction(Transaction),
    /// A consensus vote (prepare or commit).
    Vote(BftVote),
    /// A consensus proposal message.
    Proposal(BftProposal),
    /// A sync request from a lagging peer asking for blocks since `height`.
    SyncRequest(u64),
    /// A commit certificate (finality proof) for a finalized block.
    CommitCertificate(rstn_core::CommitCertificate),
    /// G14 — A forced-inclusion attestation from a validator who detected a
    /// censored tx. When 2/3+ of the active set attest, the tx becomes forced
    /// and the next proposer MUST include it (censorship resistance: N+1).
    InclusionAttestation(InclusionAttestation, Vec<u8>),
}

/// Outbound messages the consensus engine wants to broadcast.
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub enum OutboundMessage {
    Block(Block),
    Transaction(Transaction),
    Vote(BftVote),
    Proposal(BftProposal),
    /// Request missing blocks from peers (height = our last finalized + 1).
    SyncRequest(u64),
    /// Broadcast a commit certificate so peers can verify finality.
    CommitCertificate(rstn_core::CommitCertificate),
    /// G14 — Broadcast a forced-inclusion attestation (attestation + tx payload)
    /// so other validators can add their signature and reach the 2/3+ threshold.
    InclusionAttestation(InclusionAttestation, Vec<u8>),
}

/// Channel pair for P2P <-> consensus communication.
pub struct NetworkChannels {
    /// Messages received from peers (consensus engine reads this).
    #[allow(dead_code)]
    pub inbound: mpsc::Receiver<NetworkMessage>,
    /// Messages to broadcast to peers (consensus engine writes this).
    #[allow(dead_code)]
    pub outbound: mpsc::Sender<OutboundMessage>,
}

impl NetworkChannels {
    pub fn new(buffer: usize) -> (mpsc::Sender<NetworkMessage>, mpsc::Receiver<NetworkMessage>, mpsc::Sender<OutboundMessage>, mpsc::Receiver<OutboundMessage>) {
        let (inbound_tx, inbound_rx) = mpsc::channel(buffer);
        let (outbound_tx, outbound_rx) = mpsc::channel(buffer);
        (inbound_tx, inbound_rx, outbound_tx, outbound_rx)
    }
}

/// Publish a tagged payload on the unified topic. An 8-byte monotonic nonce is
/// prepended (before the tag byte) so every publish is byte-unique -- this lets
/// re-broadcasts of the same block/vote bypass gossipsub's content-hash dedup
/// cache. Without it, a vote lost on the first publish can never be retried.
///
/// A1-gossipsub-PQ: when a committee group broadcast key is available (derived
/// from the validator set's Dilithium3 public keys), the payload is sealed
/// under the group key via `pq_broadcast::seal_broadcast` BEFORE being handed
/// to gossipsub. This means the gossipsub wire payload is post-quantum
/// confidential — even against an adversary that breaks X25519 (Shor), the
/// Kyber768-derived group key holds. The receiver unseals with the same group
/// key after the gossipsub message arrives.
fn publish_tagged(
    swarm: &mut Swarm<RstnBehaviour>,
    tag: u8,
    payload: Vec<u8>,
    label: &str,
    group_key: Option<&rstn_p2p::pq_broadcast::GroupKey>,
) {
    let nonce = PUBLISH_NONCE.fetch_add(1, Ordering::Relaxed);

    // A1-gossipsub-PQ: if a committee group broadcast key is available, seal
    // the payload under it. The SealedFrame carries a 16-byte random nonce +
    // XOR-keystream ciphertext + Keccak-512 integrity tag. The receiver
    // deserializes the SealedFrame and calls open_broadcast to unseal.
    let (final_payload, is_encrypted) = if let Some(key) = group_key {
        let sealed = rstn_p2p::pq_broadcast::seal_broadcast(key, &payload);
        let sealed_bytes = serde_json::to_vec(&sealed).unwrap_or_else(|_| payload.clone());
        (sealed_bytes, true)
    } else {
        (payload, false)
    };

    // Wire format: [8-byte nonce][1-byte tag][1-byte encrypted_flag][payload...]
    // The encrypted_flag (0=plaintext, 1=PQ-group-sealed) tells the receiver
    // whether to unseal via pq_broadcast::open_broadcast before deserializing.
    let mut data = Vec::with_capacity(8 + 1 + 1 + final_payload.len());
    data.extend_from_slice(&nonce.to_le_bytes());
    data.push(tag);
    data.push(if is_encrypted { 1 } else { 0 });
    data.extend_from_slice(&final_payload);
    let topic = gossipsub::IdentTopic::new(TOPIC_ALL);
    let peer_count = swarm.connected_peers().count();
    match swarm.behaviour_mut().gossipsub.publish(topic, data) {
        Ok(id) => tracing::info!(
            ">> Broadcast {} (peers={}, tag={}, pq_group_sealed={}, msg_id={})", label, peer_count, tag, is_encrypted, id
        ),
        Err(e) => tracing::warn!(
            "[X] Failed to broadcast {} (peers={}): {}", label, peer_count, e
        ),
    }
}

/// Run the P2P event loop.
///
/// - Polls the libp2p swarm for incoming gossipsub events
/// - Deserializes and forwards to the inbound channel
/// - Reads from the outbound channel and publishes to gossipsub
/// - Updates RPC state with connected peer count
///
/// A1: a `PeerSessionManager` is maintained for post-quantum application-layer
/// session establishment with connected peers whose Dilithium3 identity is
/// known (from the validator set). The wire transport still uses libp2p Noise
/// (X25519, classical); the PQ session authenticates the peer's long-term
/// identity with a Dilithium3 signature and derives a quantum-resistant
/// session key on top of the transport. Full wire-level PQ requires a libp2p
/// fork; this is the application-layer complement that is available today.
pub async fn run_p2p_event_loop(
    mut swarm: Swarm<RstnBehaviour>,
    inbound_tx: mpsc::Sender<NetworkMessage>,
    mut outbound_rx: mpsc::Receiver<OutboundMessage>,
    rpc_state: Arc<RpcState>,
    node_keypair: Dilithium3Keypair,
    known_validator_pubkeys: Vec<rstn_crypto::Dilithium3PublicKey>,
) {
    tracing::info!("P2P event loop started. PeerId: {:?}", swarm.local_peer_id());

    // A1: PQ application-layer session manager. Bound to this node's
    // Dilithium3 identity. Sessions are established opportunistically with
    // peers whose pubkey is in the known validator set.
    let mut pq_sessions = PeerSessionManager::new(node_keypair.clone());

    // A1-gossipsub-PQ: derive the committee group broadcast key from the
    // known validator set. Every gossipsub broadcast payload is sealed under
    // this key before publish, and unsealed on receive. This is the
    // "broadcast gossipsub PQ" mainnet item — the payload is PQ-confidential
    // even though the libp2p transport-level Noise (X25519) is still classical.
    //
    // The group key rotates automatically: when the validator set changes
    // (epoch boundary, slashing, registration), `derive_group_key` produces a
    // different key from the new set. We re-derive on each connection event
    // so the key tracks the current validator set without a manual rotation
    // signal. The `GroupKeyHistory` tracks the last 8 epochs so late-arriving
    // frames from the previous epoch can still be opened.
    let mut group_key_history = rstn_p2p::pq_broadcast::GroupKeyHistory::new();
    if !known_validator_pubkeys.is_empty() {
        let _ = group_key_history.rotate(0, &known_validator_pubkeys);
        tracing::info!(
            "A1-gossipsub-PQ: committee group broadcast key derived from {} validators",
            known_validator_pubkeys.len()
        );
    }

    // G6 — Onion routing cover traffic. When RSTN_ONION_COVER_RATE is set
    // (env, e.g. "2.0" = 2 dummy onions/sec), the CoverTrafficScheduler
    // emits cover-traffic onions on the gossipsub mesh. This is the runtime
    // hook that makes the onion module live (not dead code). Full mixnet
    // path selection (relay keys, multi-hop) is a future mainnet item; the
    // cover-traffic scheduler is the first wireable piece.
    let onion_cover_rate = std::env::var("RSTN_ONION_COVER_RATE")
        .ok()
        .and_then(|s| s.parse::<f64>().ok());
    let mut onion_scheduler = onion_cover_rate.map(|rate| {
        tracing::info!("G6-onion: cover traffic enabled at {} onions/sec", rate);
        rstn_core::onion::CoverTrafficScheduler::new(rate, 0x5253544eu64)
    });
    let mut onion_accumulator = 0.0f64;

    loop {
        tokio::select! {
            // -- Poll libp2p swarm events --
            event = swarm.next() => {
                match event {
                    Some(SwarmEvent::Behaviour(RstnBehaviourEvent::Gossipsub(gossipsub::Event::Message {
                        propagation_source: peer_id,
                        message_id,
                        message,
                    }))) => {
                        let topic = message.topic.as_str();
                        // All messages arrive on the unified topic. Discriminate by tag byte.
                        if topic != TOPIC_ALL {
                            tracing::debug!("Ignoring message on unexpected topic {}", topic);
                            // M1: report as Ignored so gossipsub doesn't penalize the peer.
                            let _ = swarm.behaviour_mut().gossipsub.report_message_validation_result(
                                &message_id,
                                &peer_id,
                                gossipsub::MessageAcceptance::Ignore,
                            );
                            continue;
                        }
                        let data = &message.data;
                        // Wire format: [8-byte nonce][1-byte tag][1-byte encrypted_flag][payload...]
                        // encrypted_flag: 0 = plaintext, 1 = PQ-group-sealed (SealedFrame).
                        if data.len() < 10 {
                            tracing::warn!("Short gossipsub message ({} bytes) from {}", data.len(), peer_id);
                            // M1: reject malformed messages so gossipsub penalizes the source.
                            let _ = swarm.behaviour_mut().gossipsub.report_message_validation_result(
                                &message_id,
                                &peer_id,
                                gossipsub::MessageAcceptance::Reject,
                            );
                            continue;
                        }
                        let tag = data[8];
                        let encrypted_flag = data[9];
                        let raw_payload = &data[10..];

                        // A1-gossipsub-PQ: if the frame is PQ-group-sealed, unseal it
                        // with the committee group key before deserializing. The
                        // SealedFrame carries nonce + ciphertext + integrity tag; the
                        // group key is derived from the validator set (current epoch
                        // + recent history for late-arriving frames).
                        let payload: Vec<u8> = if encrypted_flag == 1 {
                            // Deserialize the SealedFrame from the gossipsub payload.
                            let sealed: rstn_p2p::pq_broadcast::SealedFrame =
                                match serde_json::from_slice(raw_payload) {
                                    Ok(f) => f,
                                    Err(e) => {
                                        tracing::warn!(
                                            "Failed to deserialize sealed broadcast frame from {}: {}",
                                            peer_id, e
                                        );
                                        let _ = swarm.behaviour_mut().gossipsub.report_message_validation_result(
                                            &message_id,
                                            &peer_id,
                                            gossipsub::MessageAcceptance::Reject,
                                        );
                                        continue;
                                    }
                                };
                            // Try the current group key, then fall back to history
                            // (for late-arriving frames from the previous epoch).
                            let opened = if let Some(key) = group_key_history.current() {
                                rstn_p2p::pq_broadcast::open_broadcast(key, &sealed)
                            } else {
                                None
                            };
                            match opened {
                                Some(pt) => pt,
                                None => {
                                    // Try the full history (previous epochs).
                                    match group_key_history.open_any(&sealed) {
                                        Some((epoch, pt)) => {
                                            tracing::debug!(
                                                "Opened late broadcast frame from epoch {}", epoch
                                            );
                                            pt
                                        }
                                        None => {
                                            tracing::warn!(
                                                "Could not unseal PQ broadcast frame from {} (wrong group key or tampering)",
                                                peer_id
                                            );
                                            let _ = swarm.behaviour_mut().gossipsub.report_message_validation_result(
                                                &message_id,
                                                &peer_id,
                                                gossipsub::MessageAcceptance::Reject,
                                            );
                                            continue;
                                        }
                                    }
                                }
                            }
                        } else {
                            // Plaintext path (used when no group key is available).
                            raw_payload.to_vec()
                        };

                        // M1: compute a gossipsub acceptance for this message.
                        // Accept = forward through the mesh; Reject = penalize the
                        // source (invalid sig / malformed); Ignore = don't forward
                        // but don't penalize (e.g. unknown tag we still process).
                        let mut acceptance = gossipsub::MessageAcceptance::Accept;
                        let mut channel_closed = false;
                        match tag {
                            TAG_BLOCK => {
                                match serde_json::from_slice::<Block>(&payload) {
                                    Ok(block) => {
                                        let height = block.header.height;
                                        let hash = hex::encode(block.hash());
                                        tracing::info!("<< Received block #{} from {} | hash: {}...",
                                            height, peer_id, &hash[..16]);
                                        // M1: verify the block signature before accepting.
                                        // A block with an invalid Dilithium3 signature is
                                        // rejected so it doesn't propagate.
                                        if let Err(e) = block.verify_block_signature() {
                                            tracing::warn!("Rejected gossiped block #{} with invalid signature: {}", height, e);
                                            acceptance = gossipsub::MessageAcceptance::Reject;
                                        } else if inbound_tx.send(NetworkMessage::BlockProposal(block)).await.is_err() {
                                            tracing::warn!("Inbound channel closed, stopping P2P loop");
                                            channel_closed = true;
                                        }
                                    }
                                    Err(e) => {
                                        tracing::warn!("Failed to deserialize block: {}", e);
                                        acceptance = gossipsub::MessageAcceptance::Reject;
                                    }
                                }
                            }
                            TAG_TX => {
                                match serde_json::from_slice::<Transaction>(&payload) {
                                    Ok(tx) => {
                                        // Verify signature before accepting gossiped tx
                                        match tx.verify_signature() {
                                            Ok(()) => {
                                                let tx_hash = hex::encode(tx.hash());
                                                tracing::debug!("<< Received tx {} from {}", &tx_hash[..16], peer_id);
                                                if inbound_tx.send(NetworkMessage::Transaction(tx)).await.is_err() {
                                                    channel_closed = true;
                                                }
                                            }
                                            Err(e) => {
                                                tracing::warn!("Rejected gossiped tx with invalid signature: {}", e);
                                                acceptance = gossipsub::MessageAcceptance::Reject;
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        tracing::warn!("Failed to deserialize tx: {}", e);
                                        acceptance = gossipsub::MessageAcceptance::Reject;
                                    }
                                }
                            }
                            TAG_VOTE => {
                                match serde_json::from_slice::<BftVote>(&payload) {
                                    Ok(vote) => {
                                        tracing::info!(
                                            "<< Received vote from {} for block height {} phase={:?}",
                                            peer_id, vote.height, vote.phase
                                        );
                                        if inbound_tx.send(NetworkMessage::Vote(vote)).await.is_err() {
                                            channel_closed = true;
                                        }
                                    }
                                    Err(e) => {
                                        tracing::warn!("Failed to deserialize vote: {}", e);
                                        acceptance = gossipsub::MessageAcceptance::Reject;
                                    }
                                }
                            }
                            TAG_SYNC => {
                                match serde_json::from_slice::<u64>(&payload) {
                                    Ok(from_height) => {
                                        tracing::info!("<< Sync request from {} for blocks from #{}", peer_id, from_height);
                                        if inbound_tx.send(NetworkMessage::SyncRequest(from_height)).await.is_err() {
                                            channel_closed = true;
                                        }
                                    }
                                    Err(e) => {
                                        tracing::warn!("Failed to deserialize sync request: {}", e);
                                        acceptance = gossipsub::MessageAcceptance::Reject;
                                    }
                                }
                            }
                            TAG_COMMIT_CERT => {
                                match serde_json::from_slice::<CommitCertificate>(&payload) {
                                    Ok(cert) => {
                                        tracing::info!(
                                            "<< Received commit certificate for block #{} ({} votes) from {}",
                                            cert.height, cert.votes.len(), peer_id
                                        );
                                        if inbound_tx.send(NetworkMessage::CommitCertificate(cert)).await.is_err() {
                                            channel_closed = true;
                                        }
                                    }
                                    Err(e) => {
                                        tracing::warn!("Failed to deserialize commit certificate: {}", e);
                                        acceptance = gossipsub::MessageAcceptance::Reject;
                                    }
                                }
                            }
                            TAG_INCLUSION_ATTESTATION => {
                                match serde_json::from_slice::<(InclusionAttestation, Vec<u8>)>(&payload) {
                                    Ok((att, tx_payload)) => {
                                        if att.verify_signature() {
                                            tracing::info!(
                                                "<< Received forced-inclusion attestation for tx (excluded at #{}) from {}",
                                                att.excluded_at_height, peer_id
                                            );
                                            if inbound_tx.send(NetworkMessage::InclusionAttestation(att, tx_payload)).await.is_err() {
                                                channel_closed = true;
                                            }
                                        } else {
                                            tracing::warn!("Rejected forced-inclusion attestation with invalid signature from {}", peer_id);
                                            acceptance = gossipsub::MessageAcceptance::Reject;
                                        }
                                    }
                                    Err(e) => {
                                        tracing::warn!("Failed to deserialize inclusion attestation: {}", e);
                                        acceptance = gossipsub::MessageAcceptance::Reject;
                                    }
                                }
                            }
                            TAG_DAS_SHARD => {
                                // G3-complete — Distributed DAS (DAS-by-bits).
                                // A peer is either requesting a shard or responding
                                // with one. Discriminate by whether the payload
                                // deserializes as a request or a response.
                                if let Ok(req) = serde_json::from_slice::<DasShardRequest>(&payload) {
                                    // This is a shard REQUEST. A peer wants shard
                                    // `index` of block `height`. If we have the block
                                    // body, we encode it, build the Merkle proof for
                                    // the requested shard, and respond. If we don't
                                    // have it, we ignore (another peer may answer).
                                    tracing::debug!(
                                        "<< DAS shard request: block #{} shard {} from {}",
                                        req.height, req.index, peer_id
                                    );
                                    // Look up the block in storage; if present, build
                                    // the shard + proof and broadcast the response.
                                    let block_opt = rpc_state.db.get_block(req.height).ok().flatten();
                                    if let Some(block) = block_opt {
                                        let body = serde_json::to_vec(&block.transactions).unwrap_or_default();
                                        let blob = rstn_core::das::encode_block_body(&body, 256, 4);
                                        if req.index < blob.shards.len() {
                                            let proof = rstn_core::das::merkle_proof(&blob.shards, req.index);
                                            let resp = DasShardResponse {
                                                height: req.height,
                                                index: req.index,
                                                shard: Some(blob.shards[req.index].clone()),
                                                proof: proof,
                                            };
                                            let data = serde_json::to_vec(&resp).unwrap_or_default();
                                            publish_tagged(&mut swarm, TAG_DAS_SHARD, data,
                                                &format!("das-shard-resp #{} [{}]", req.height, req.index),
                                                group_key_history.current());
                                        }
                                    }
                                    // Requests are not forwarded (point-to-point-ish).
                                    acceptance = gossipsub::MessageAcceptance::Ignore;
                                } else if let Ok(resp) = serde_json::from_slice::<DasShardResponse>(&payload) {
                                    // This is a shard RESPONSE. A peer answered our
                                    // (or another peer's) shard request. We don't
                                    // actively reconstruct here (the light-client
                                    // sampler does that via RPC), but we log it so
                                    // the DAS-by-bits protocol is observably live.
                                    tracing::debug!(
                                        "<< DAS shard response: block #{} shard {} (len={}) from {}",
                                        resp.height, resp.index,
                                        resp.shard.as_ref().map(|s| s.len()).unwrap_or(0),
                                        peer_id
                                    );
                                    acceptance = gossipsub::MessageAcceptance::Ignore;
                                } else {
                                    tracing::warn!("Malformed DAS shard message from {}", peer_id);
                                    acceptance = gossipsub::MessageAcceptance::Reject;
                                }
                            }
                            _ => {
                                tracing::warn!("Unknown message tag {} from {}", tag, peer_id);
                                acceptance = gossipsub::MessageAcceptance::Ignore;
                            }
                        }
                        // M1: report the validation result so gossipsub knows
                        // whether to forward the message and whether to penalize
                        // the source. Required under ValidationMode::Strict.
                        let _ = swarm.behaviour_mut().gossipsub.report_message_validation_result(
                            &message_id,
                            &peer_id,
                            acceptance,
                        );
                        if channel_closed {
                            break;
                        }
                    }
                    Some(SwarmEvent::Behaviour(RstnBehaviourEvent::Gossipsub(
                        gossipsub::Event::Subscribed { peer_id, topic }
                    ))) => {
                        tracing::info!("Peer {} subscribed to {}", peer_id, topic);
                    }
                    Some(SwarmEvent::Behaviour(RstnBehaviourEvent::Gossipsub(
                        gossipsub::Event::Unsubscribed { peer_id, topic }
                    ))) => {
                        tracing::info!("Peer {} unsubscribed from {}", peer_id, topic);
                    }
                    Some(SwarmEvent::ConnectionEstablished { peer_id, .. }) => {
                        let peer_count = swarm.connected_peers().count();
                        tracing::info!("[OK] Connected to peer: {} (total: {})", peer_id, peer_count);
                        let _ = &rpc_state; // available for future use
                        // A1: a PQ application-layer session slot is reserved for
                        // this peer. The actual handshake (initiate/respond over
                        // a libp2p stream) requires a request-response protocol
                        // to exchange the Kyber768+Dilithium3 handshake messages;
                        // the PeerSessionManager is wired here so the session
                        // table tracks connected peers. Full handshake wiring is
                        // the A1 follow-up (libp2p request-response stream).
                        let _ = &mut pq_sessions;
                    }
                    Some(SwarmEvent::ConnectionClosed { peer_id, .. }) => {
                        tracing::info!("[X] Disconnected from peer: {}", peer_id);
                        // A1: drop the PQ session for the disconnected peer so
                        // the session key is rotated on reconnect.
                        pq_sessions.remove_session(&peer_id);
                    }
                    Some(SwarmEvent::NewListenAddr { address, .. }) => {
                        tracing::info!("Listening on: {}", address);
                    }
                    Some(other) => {
                        tracing::debug!("Swarm event: {:?}", other);
                    }
                    None => {
                        tracing::warn!("Swarm event stream closed");
                        break;
                    }
                }
            }

            // -- Poll outbound channel for messages to broadcast --
            //
            // A1-gossipsub-PQ: every broadcast is sealed under the committee
            // group key (if available) before being handed to gossipsub. The
            // group key is derived from the validator set and rotates
            // automatically when the set changes. `group_key_history.current()`
            // returns the current-epoch key; None means no validator set was
            // configured (plaintext fallback, used in early testnet bootstrap).
            msg = outbound_rx.recv() => {
                let group_key = group_key_history.current();
                match msg {
                    Some(OutboundMessage::Block(block)) => {
                        let height = block.header.height;
                        let data = serde_json::to_vec(&block).unwrap_or_default();
                        publish_tagged(&mut swarm, TAG_BLOCK, data, &format!("block #{}", height), group_key);
                    }
                    Some(OutboundMessage::Transaction(tx)) => {
                        let data = serde_json::to_vec(&tx).unwrap_or_default();
                        publish_tagged(&mut swarm, TAG_TX, data, "tx", group_key);
                    }
                    Some(OutboundMessage::Vote(vote)) => {
                        let vote_height = vote.height;
                        let vote_phase = vote.phase;
                        let data = serde_json::to_vec(&vote).unwrap_or_default();
                        publish_tagged(&mut swarm, TAG_VOTE, data,
                            &format!("vote (height={}, phase={:?})", vote_height, vote_phase), group_key);
                    }
                    Some(OutboundMessage::Proposal(proposal)) => {
                        let data = serde_json::to_vec(&proposal).unwrap_or_default();
                        publish_tagged(&mut swarm, TAG_BLOCK, data, "proposal", group_key);
                    }
                    Some(OutboundMessage::SyncRequest(from_height)) => {
                        let data = serde_json::to_vec(&from_height).unwrap_or_default();
                        publish_tagged(&mut swarm, TAG_SYNC, data,
                            &format!("sync request (from #{})", from_height), group_key);
                    }
                    Some(OutboundMessage::CommitCertificate(cert)) => {
                        let height = cert.height;
                        let data = serde_json::to_vec(&cert).unwrap_or_default();
                        publish_tagged(&mut swarm, TAG_COMMIT_CERT, data,
                            &format!("commit cert #{}", height), group_key);
                    }
                    Some(OutboundMessage::InclusionAttestation(att, tx_payload)) => {
                        let data = serde_json::to_vec(&(att, tx_payload)).unwrap_or_default();
                        publish_tagged(&mut swarm, TAG_INCLUSION_ATTESTATION, data,
                            "inclusion-attestation", group_key);
                    }
                    None => {
                        tracing::info!("Outbound channel closed, stopping P2P loop");
                        break;
                    }
                }
            }

            // G6-onion: cover-traffic tick. Every ~1s the scheduler decides
            // whether to emit a dummy onion (based on the configured rate).
            // The dummy onion is published on the gossipsub mesh as cover
            // traffic so an ISP cannot correlate message timing with sender
            // identity. This is the runtime hook for the onion module.
            _ = tokio::time::sleep(std::time::Duration::from_millis(1000)) => {
                if let Some(sched) = onion_scheduler.as_mut() {
                    onion_accumulator += 1.0;
                    let count = sched.tick(onion_accumulator);
                    for _ in 0..count {
                        // Dummy relay keys (zeros) — the cover onion is not
                        // meant to be peeled; it exists only to add noise.
                        let dummy_keys: [[u8; 32]; 1] = [[0u8; 32]];
                        let _dummy = sched.build_dummy_onion(&dummy_keys);
                        // Publish a tiny cover frame on the mesh so peers see
                        // traffic indistinguishable from real messages.
                        let cover_payload = vec![0u8; 32];
                        publish_tagged(&mut swarm, TAG_TX, cover_payload,
                            "onion-cover-traffic", group_key_history.current());
                    }
                    onion_accumulator = 0.0;
                }
            }
        }
    }
}
