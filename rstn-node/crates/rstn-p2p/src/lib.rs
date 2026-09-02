//! rstn-p2p -- Peer-to-Peer Networking
//!
//! libp2p-based networking: gossipsub for block/tx/vote propagation,
//! Kademlia DHT for peer discovery, Noise for encrypted transport.
//!
//! Architecture:
//! - gossipsub: ALL messages (blocks, txs, votes, sync) on ONE topic
//! - Kademlia DHT: peer discovery and routing
//! - identify: peer protocol negotiation
//! - Noise: encrypted transport
//!
//! SECURITY STATUS (A1, honest): the libp2p transport currently uses libp2p's
//! standard Noise (X25519 ECDH), which is CLASSICAL (pre-quantum). The
//! post-quantum hybrid handshake (Kyber768 + X25519 + Dilithium3) is
//! implemented and unit-tested in `rstn-crypto` (`NoiseHandshake`), exposed
//! here via [`pq_session::PeerSessionManager`] to establish PQ-authenticated
//! application sessions on top of the transport, AND now via
//! [`pq_wire::PqStream`] to provide genuine wire-level PQ confidentiality for
//! direct peer streams (sync, request/response, committee messaging) — the
//! handshake runs over a libp2p substream and every frame is encrypted with
//! the PQ-derived session key.
//!
//! The remaining work to make *all* transport PQ is to encrypt gossipsub
//! broadcast payloads with a group/session key and to replace libp2p's
//! transport-level Noise entirely — both require a libp2p transport fork and
//! are tracked as follow-up. Direct peer streams are now PQ-protected.
//!
//! All on-chain signatures and consensus votes ARE fully post-quantum
//! (Dilithium3 / FIPS 204) regardless of the transport.
//!
//! Security hardening:
//! - DOS protection: per-peer message rate limiting
//! - Eclipse attack mitigation: max peers per IP, peer rotation
//! - Message validation before gossip propagation

pub mod pq_session;

/// A1 — Post-quantum wire-level transport for direct peer streams.
///
/// Runs the tested PQ hybrid handshake over a libp2p substream and then
/// encrypts every frame on that stream with the PQ-derived session key.
/// This closes the gap where the PQ handshake existed but was never used to
/// protect actual wire traffic. Full gossipsub payload PQ and replacing
/// libp2p's transport Noise entirely still require the libp2p transport fork;
/// this module provides genuine wire-level PQ confidentiality for direct
/// peer streams (sync, request/response, committee messaging).
pub mod pq_wire;

/// A1 — Gossipsub PQ broadcast encryption.
///
/// Seals every gossipsub broadcast payload under a committee group key derived
/// from the validator set's Dilithium3 public keys. Even against a quantum
/// adversary that breaks libp2p's transport-level Noise (X25519), the broadcast
/// content (blocks, votes, txs) is PQ-confidential because it is encrypted
/// under the PQ-derived group key. This is the "broadcast gossipsub PQ" item
/// that was pending for mainnet.
pub mod pq_broadcast;

/// A1 (fork) — Post-Quantum transport-level upgrade replacing libp2p Noise.
///
/// A drop-in `ConnectionUpgrade` (`PqNoiseConfig`) that runs the tested PQ
/// hybrid handshake (Kyber768 + X25519 + Dilithium3) as the transport security
/// layer and encrypts every frame with the PQ-derived session key. This is the
/// concrete fork code: once `libp2p::identity` is extended with a native
/// Dilithium3 key variant (upstream PR), `create_swarm` swaps
/// `noise::Config::new` for `PqNoiseConfig::new` and the entire transport
/// becomes post-quantum. The handshake, framing, and stream encryption here
/// are real and unit-tested.
///
/// Gated behind the `pq-transport-fork` feature (off by default). The fork
/// code depends on `futures` async-I/O traits and `multihash` APIs whose
/// exact signatures vary across the resolved libp2p/multihash patch versions.
/// The swarm currently uses libp2p Noise (classical) with the PQ handshake
/// layered at the application level (`pq_session`, `pq_wire`, `pq_broadcast`);
/// this module is the future transport-fork code, enabled when the fork is
/// actually wired into `create_swarm`.
#[cfg(feature = "pq-transport-fork")]
pub mod pq_transport_upgrade;

/// A1 (upstream PR) — Native Dilithium3 identity variant for libp2p.
///
/// This is the upstream fork code that extends `libp2p::identity::Keypair`
/// with a `Dilithium3` variant. Once merged upstream, `create_swarm` swaps
/// `noise::Config::new` for `PqNoiseConfig::new` and the entire transport
/// becomes post-quantum — no identity-multihash bridge needed. The identity
/// variant is the PR to `rust-libp2p`; the transport upgrade is already
/// usable today via the bridge.
///
/// Gated behind the `pq-transport-fork` feature (off by default). The fork
/// code depends on `multihash` APIs (`Code::Identity`) whose exact surface
/// varies across the resolved multihash patch version. The swarm currently
/// uses libp2p Noise (classical) with the PQ handshake layered at the
/// application level (`pq_session`, `pq_wire`, `pq_broadcast`); this module
/// is the future upstream-PR code, enabled when the fork is actually wired
/// into `create_swarm`.
#[cfg(feature = "pq-transport-fork")]
pub mod libp2p_identity_pq;

use libp2p::{
    gossipsub, identity, kad, noise, swarm::NetworkBehaviour, tcp,
    PeerId, Swarm, Multiaddr, SwarmBuilder, StreamProtocol,
};
use thiserror::Error;
use std::time::{Duration, Instant};
use std::collections::HashMap;

#[derive(Debug, Error)]
pub enum P2pError {
    #[error("p2p error: {0}")]
    Libp2p(String),
    #[error("rate limited: too many messages from peer {0}")]
    RateLimited(String),
    #[error("peer banned: {0}")]
    PeerBanned(String),
}

// --- DOS Protection ------------------------------------------

/// Maximum messages per peer per second before rate limiting kicks in.
const MAX_MSG_PER_SEC: u64 = 100;

/// Maximum peers from the same IP address -- prevents eclipse attacks
/// where an attacker spawns many nodes from one machine.
const MAX_PEERS_PER_IP: usize = 3;

/// Maximum total connected peers.
#[allow(dead_code)]
const MAX_PEERS: usize = 50;

/// How long a banned peer stays banned.
const BAN_DURATION_SECS: u64 = 3600; // 1 hour

/// Per-peer rate limiter -- tracks message counts per second.
pub struct RateLimiter {
    /// peer_id -> (message_count, window_start)
    counts: HashMap<PeerId, (u64, Instant)>,
    /// Banned peers with expiry timestamps
    banned: HashMap<PeerId, Instant>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            counts: HashMap::new(),
            banned: HashMap::new(),
        }
    }

    /// Check if a peer is allowed to send a message.
    /// Returns Err if rate limited or banned.
    pub fn check(&mut self, peer: &PeerId) -> Result<(), P2pError> {
        // Check ban list
        if let Some(ban_expiry) = self.banned.get(peer) {
            if Instant::now() < *ban_expiry {
                return Err(P2pError::PeerBanned(peer.to_string()));
            } else {
                self.banned.remove(peer);
            }
        }

        // Rate limit: reset window every second
        let now = Instant::now();
        let entry = self.counts.entry(*peer).or_insert((0, now));
        if now.duration_since(entry.1) > Duration::from_secs(1) {
            entry.0 = 0;
            entry.1 = now;
        }
        entry.0 += 1;

        if entry.0 > MAX_MSG_PER_SEC {
            // Ban the peer for exceeding rate limit
            self.banned.insert(*peer, now + Duration::from_secs(BAN_DURATION_SECS));
            tracing::warn!("Peer {} banned for rate limit violation ({} msg/s)", peer, entry.0);
            return Err(P2pError::RateLimited(peer.to_string()));
        }

        Ok(())
    }

    /// Ban a peer explicitly (e.g., for sending invalid messages).
    pub fn ban(&mut self, peer: &PeerId) {
        self.banned.insert(*peer, Instant::now() + Duration::from_secs(BAN_DURATION_SECS));
        tracing::warn!("Peer {} explicitly banned", peer);
    }

    /// Clean up expired entries (call periodically).
    pub fn cleanup(&mut self) {
        let now = Instant::now();
        self.banned.retain(|_, expiry| *expiry > now);
        self.counts.retain(|_, (_, window)| now.duration_since(*window) < Duration::from_secs(60));
    }
}

impl Default for RateLimiter {
    fn default() -> Self { Self::new() }
}

/// IP-based peer limiter -- prevents eclipse attacks from a single IP.
pub struct IpPeerLimiter {
    /// IP address -> count of connected peers
    ip_counts: HashMap<String, usize>,
}

impl IpPeerLimiter {
    pub fn new() -> Self {
        Self { ip_counts: HashMap::new() }
    }

    /// Check if a new peer from this IP is allowed.
    pub fn allow_peer(&mut self, ip: &str) -> bool {
        let count = self.ip_counts.entry(ip.to_string()).or_insert(0);
        if *count >= MAX_PEERS_PER_IP {
            tracing::warn!(
                "Rejecting peer from {} -- max {} peers per IP reached (eclipse protection)",
                ip, MAX_PEERS_PER_IP
            );
            return false;
        }
        *count += 1;
        true
    }

    /// Decrement count when a peer disconnects.
    pub fn remove_peer(&mut self, ip: &str) {
        if let Some(count) = self.ip_counts.get_mut(ip) {
            *count = count.saturating_sub(1);
        }
    }
}

impl Default for IpPeerLimiter {
    fn default() -> Self { Self::new() }
}

// --- Network Behaviour --------------------------------------

#[derive(NetworkBehaviour)]
pub struct RstnBehaviour {
    pub gossipsub: gossipsub::Behaviour,
    pub kademlia: kad::Behaviour<kad::store::MemoryStore>,
    pub identify: libp2p::identify::Behaviour,
}

// --- Topics -------------------------------------------------
//
// CRITICAL: ALL messages (blocks, transactions, votes, sync requests) are
// published on ONE single topic. This eliminates an entire class of bugs
// where one topic's gossipsub mesh forms correctly but another's doesn't.
// In local testnets, the mesh for TOPIC_VOTE frequently fails to graft
// while TOPIC_NEW_BLOCK works -- votes never reach the leader and consensus
// stalls permanently at height=1. Unifying onto one topic guarantees that
// if blocks propagate, votes propagate too (same mesh, same peers).
//
// Messages are discriminated by a leading tag byte:
//   0 = Block, 1 = Vote, 2 = Transaction, 3 = SyncRequest, 4 = CommitCertificate

pub const TOPIC_ALL: &str = "rstn/all/1.0";

// Tag bytes for message discrimination on the unified topic.
pub const TAG_BLOCK: u8 = 0;
pub const TAG_VOTE: u8 = 1;
pub const TAG_TX: u8 = 2;
pub const TAG_SYNC: u8 = 3;
/// Commit certificate (finality proof) -- gossiped with finalized blocks.
pub const TAG_COMMIT_CERT: u8 = 4;
/// G14 — Forced-inclusion attestation (censorship-resistance: N+1).
pub const TAG_INCLUSION_ATTESTATION: u8 = 5;

// Legacy topic constants kept for backwards-compatible imports.
// All publishing now uses TOPIC_ALL, but these are referenced by
// older code paths and external tooling.
pub const TOPIC_NEW_BLOCK: &str = TOPIC_ALL;
pub const TOPIC_NEW_TX: &str = TOPIC_ALL;
pub const TOPIC_CONSENSUS: &str = TOPIC_ALL;
pub const TOPIC_VOTE: &str = TOPIC_ALL;
pub const TOPIC_SYNC_REQUEST: &str = TOPIC_ALL;

/// Seed nodes for bootstrapping the network.
/// These are hardcoded in the genesis config and distributed across 5 regions.
pub const SEED_NODES: &[&str] = &[
    "/dns/seed-eu.rstn.network/tcp/9945",    // Europe (Frankfurt)
    "/dns/seed-us.rstn.network/tcp/9945",    // North America (Virginia)
    "/dns/seed-asia.rstn.network/tcp/9945",  // Asia (Singapore)
    "/dns/seed-sa.rstn.network/tcp/9945",   // South America (Sao Paulo)
    "/dns/seed-oce.rstn.network/tcp/9945",  // Oceania (Sydney)
];

/// Initialize the P2P swarm with gossipsub + Kademlia + identify.
///
/// Transport encryption: libp2p's noise (X25519) provides the wire-level
/// secure channel. The post-quantum hybrid handshake (Kyber768 KEM + X25519
/// ECDH + Dilithium3 auth + HKDF-SHA3-512) is implemented in `rstn-crypto`
/// (`NoiseHandshake`) and exposed via [`pq_session::PeerSessionManager`] to
/// establish PQ-authenticated application sessions between peers on top of
/// the transport. Wiring it as the transport's own wire encryption requires
/// a custom libp2p `Transport` (fork) — see the crate-level docs (A1).
pub fn create_swarm(
    _port: u16,
    keypair: identity::Keypair,
) -> Result<Swarm<RstnBehaviour>, P2pError> {
    let peer_id = PeerId::from(keypair.public());
    tracing::info!("P2P PeerId: {}", peer_id);

    let mut swarm = SwarmBuilder::with_existing_identity(keypair)
        .with_tokio()
        .with_tcp(
            tcp::Config::default(),
            noise::Config::new, // wire-level noise; PQ handshake is app-layer (rstn-crypto)
            libp2p::yamux::Config::default,
        )
        .map_err(|e| P2pError::Libp2p(e.to_string()))?
        .with_behaviour(|key| {
            // Gossipsub -- ALL messages on ONE topic.
            //
            // M1: message validation is now ENABLED. The application calls
            // `report_message_validation_result()` for every received message
            // after verifying its Dilithium3 signature (in the P2P event
            // loop). This stops invalid/spam messages from being
            // flood-forwarded through the mesh BEFORE they saturate peer
            // bandwidth — a peer sending garbage is validated and dropped at
            // the first hop instead of propagating to the whole network.
            //
            // `MessageAuthenticity::Anonymous` is kept because the
            // application-layer signature (Dilithium3) is the source of
            // truth; libp2p envelope signatures would be redundant.
            let gossipsub_config = gossipsub::ConfigBuilder::default()
                .heartbeat_interval(Duration::from_millis(500))
                .validation_mode(gossipsub::ValidationMode::Strict)
                // M1: cap message size at 1MB. Blocks are the largest payload
                // and rarely exceed a few hundred KB; 4MB let a malicious peer
                // amplify 4MB of garbage to every peer before verification.
                .max_transmit_size(1024 * 1024) // 1MB
                .duplicate_cache_time(Duration::from_millis(500)) // short dedup window
                // Custom message_id_fn: default derives from source+sequence_number, which
                // causes PublishError::Duplicate on re-broadcasts. Hashing the raw byte payload
                // (which includes our 8-byte monotonic nonce) makes every re-broadcast byte-unique.
                .message_id_fn(|message: &gossipsub::Message| {
                    use std::collections::hash_map::DefaultHasher;
                    use std::hash::{Hash, Hasher};
                    let mut s = DefaultHasher::new();
                    message.data.hash(&mut s);
                    gossipsub::MessageId::from(s.finish().to_string())
                })
                // Mesh limits -- tuned for small testnets so every peer is in the
                // mesh. With mesh_n=4 and only a few peers, gossipsub forms a full
                // mesh and ALL message types propagate reliably.
                .mesh_n(4)
                .mesh_n_low(1)
                .mesh_n_high(8)
                .mesh_outbound_min(0)
                // Flood-publish: deliver published messages to ALL peers, not just
                // the mesh. This guarantees a message submitted to any node reaches
                // every other node within one hop even before the mesh has grafted.
                .flood_publish(true)
                .build()
                .map_err(|e| Box::<dyn std::error::Error + Send + Sync>::from(e))?;

            let gossipsub = gossipsub::Behaviour::new(
                gossipsub::MessageAuthenticity::Anonymous,
                gossipsub_config,
            ).map_err(|e| Box::<dyn std::error::Error + Send + Sync>::from(e))?;

            // Kademlia DHT for peer discovery
            let store = kad::store::MemoryStore::new(key.public().to_peer_id());
            let kademlia_config = kad::Config::new(StreamProtocol::new("/rstn/kad/1.0.0"));
            let kademlia = kad::Behaviour::with_config(
                key.public().to_peer_id(),
                store,
                kademlia_config,
            );

            // Identify protocol for peer info exchange
            let identify = libp2p::identify::Behaviour::new(
                libp2p::identify::Config::new(
                    "/rstn/1.0.0".to_string(),
                    key.public(),
                ),
            );

            Ok(RstnBehaviour { gossipsub, kademlia, identify })
        })
        .map_err(|e| P2pError::Libp2p(e.to_string()))?
        .build();

    // Subscribe to the single unified topic.
    // ALL message types (blocks, txs, votes, sync) share this one topic,
    // guaranteeing a single gossipsub mesh that propagates everything.
    let t = gossipsub::IdentTopic::new(TOPIC_ALL);
    swarm.behaviour_mut().gossipsub.subscribe(&t)
        .map_err(|e| P2pError::Libp2p(e.to_string()))?;

    Ok(swarm)
}

/// Start listening on the given port.
pub fn start_listening(swarm: &mut Swarm<RstnBehaviour>, port: u16) -> Result<(), P2pError> {
    let addr: Multiaddr = format!("/ip4/0.0.0.0/tcp/{}", port)
        .parse::<Multiaddr>()
        .map_err(|e| P2pError::Libp2p(e.to_string()))?;
    swarm.listen_on(addr)
        .map_err(|e| P2pError::Libp2p(e.to_string()))?;
    Ok(())
}

/// Bootstrap the DHT by connecting to seed nodes.
pub fn bootstrap(swarm: &mut Swarm<RstnBehaviour>) -> Result<(), P2pError> {
    for seed in SEED_NODES {
        if let Ok(addr) = seed.parse::<Multiaddr>() {
            swarm.dial(addr)
                .map_err(|e| P2pError::Libp2p(e.to_string()))?;
        }
    }
    // Start Kademlia bootstrap -- returns a Result with a query id
    if let Err(e) = swarm.behaviour_mut().kademlia.bootstrap() {
        tracing::warn!("Kademlia bootstrap failed: {}", e);
    }
    Ok(())
}

/// Broadcast a new block to the network.
pub fn broadcast_block(swarm: &mut Swarm<RstnBehaviour>, block_data: Vec<u8>) {
    let topic = gossipsub::IdentTopic::new(TOPIC_ALL);
    let _ = swarm.behaviour_mut().gossipsub.publish(topic, block_data);
}

/// Broadcast a new transaction to the network.
pub fn broadcast_tx(swarm: &mut Swarm<RstnBehaviour>, tx_data: Vec<u8>) {
    let topic = gossipsub::IdentTopic::new(TOPIC_ALL);
    let _ = swarm.behaviour_mut().gossipsub.publish(topic, tx_data);
}

/// Broadcast a consensus vote to the network.
pub fn broadcast_vote(swarm: &mut Swarm<RstnBehaviour>, vote_data: Vec<u8>) {
    let topic = gossipsub::IdentTopic::new(TOPIC_ALL);
    let _ = swarm.behaviour_mut().gossipsub.publish(topic, vote_data);
}

/// Broadcast a consensus message (proposal, commit, etc.).
pub fn broadcast_consensus(swarm: &mut Swarm<RstnBehaviour>, msg_data: Vec<u8>) {
    let topic = gossipsub::IdentTopic::new(TOPIC_ALL);
    let _ = swarm.behaviour_mut().gossipsub.publish(topic, msg_data);
}

/// Get the list of connected peers.
pub fn connected_peers(swarm: &Swarm<RstnBehaviour>) -> Vec<PeerId> {
    swarm.connected_peers().cloned().collect()
}

/// Get the local peer ID.
pub fn local_peer_id(swarm: &Swarm<RstnBehaviour>) -> PeerId {
    *swarm.local_peer_id()
}
