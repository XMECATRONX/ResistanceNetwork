//! Post-quantum peer session establishment (A1).
//!
//! ## Status & migration path
//!
//! The libp2p transport still uses standard Noise (X25519 ECDH), which is
//! CLASSICAL and vulnerable to Shor's algorithm. A fully post-quantum
//! *transport* requires a custom libp2p `Transport`/`ConnectionUpgrade`
//! that wraps the PQ handshake — libp2p does not expose a stable PQ Noise
//! plugin in Rust, so this is tracked as a follow-up that needs a libp2p
//! fork.
//!
//! What IS implemented here is the **application-layer PQ session**: once a
//! peer connection exists, both sides run the tested `rstn_crypto::NoiseHandshake`
//! (Kyber768 KEM + X25519 ECDH + Dilithium3 auth, HKDF-SHA3-512) to derive a
//! 32-byte PQ-authenticated session key. This key can be used to
//! authenticate/encrypt application messages on top of the transport, so that
//! even though the wire channel is classical, the peer identity is bound to a
//! post-quantum signature and the session key is quantum-resistant.
//!
//! On-chain signatures and consensus votes remain fully post-quantum
//! (Dilithium3 / FIPS 204) regardless of the transport.
//!
//! ## Usage
//!
//! ```ignore
//! let mut mgr = PeerSessionManager::new(my_identity);
//! // On a new connection (initiator side):
//! let init_msg = mgr.initiate_session(&peer_id, &peer_dilithium_pub)?;
//! // send init_msg over a libp2p stream...
//! // On the responder side:
//! let resp_msg = mgr.respond_session(&peer_id, &init_msg, &peer_dilithium_pub)?;
//! // send resp_msg back...
//! // On the initiator side, finalize:
//! mgr.finalize_session(&peer_id, &resp_msg, &init_msg)?;
//! // Both sides now share a PQ session key:
//! let key = mgr.session_key(&peer_id).expect("handshake done");
//! ```

use std::collections::HashMap;
use libp2p::PeerId;
use rstn_crypto::{
    Dilithium3Keypair, Dilithium3PublicKey, NoiseHandshake, HandshakeRole,
};

/// A completed (or in-progress) PQ session with a peer.
struct PeerSession {
    handshake: NoiseHandshake,
    /// Cached initiator message (needed to finalize on the initiator side).
    init_msg: Option<Vec<u8>>,
    /// Derived session key once the handshake completes.
    session_key: Option<[u8; 32]>,
}

/// Manages PQ hybrid sessions for all connected peers.
///
/// Each peer gets at most one session. The handshake is run once per
/// connection; the resulting session key is reused for the connection's
/// lifetime and rotated on reconnect.
pub struct PeerSessionManager {
    /// This node's long-term Dilithium3 identity (used to sign transcripts).
    identity: Dilithium3Keypair,
    /// peer_id -> session state.
    sessions: HashMap<PeerId, PeerSession>,
}

/// Error type for session establishment.
#[derive(Debug, thiserror::Error)]
pub enum SessionError {
    #[error("no session for peer {0}")]
    NoSession(String),
    #[error("handshake not yet complete for peer {0}")]
    NotComplete(String),
    #[error("crypto error: {0}")]
    Crypto(String),
}

impl From<rstn_crypto::CryptoError> for SessionError {
    fn from(e: rstn_crypto::CryptoError) -> Self {
        SessionError::Crypto(e.to_string())
    }
}

impl PeerSessionManager {
    /// Create a new manager bound to this node's Dilithium3 identity keypair.
    pub fn new(identity: Dilithium3Keypair) -> Self {
        Self {
            identity,
            sessions: HashMap::new(),
        }
    }

    /// Initiate a PQ session with a peer (initiator side).
    ///
    /// `peer_dilithium_pub` is the remote peer's long-term Dilithium3 public
    /// key, learned out-of-band (e.g. from the validator set / identify
    /// protocol). The returned bytes are sent to the peer over a libp2p
    /// stream; the peer calls `respond_session` with them.
    pub fn initiate_session(
        &mut self,
        peer_id: &PeerId,
        peer_dilithium_pub: &Dilithium3PublicKey,
    ) -> Result<Vec<u8>, SessionError> {
        let mut hs = NoiseHandshake::new(HandshakeRole::Initiator);
        let init_msg = hs.initiate(peer_dilithium_pub, &self.identity);
        self.sessions.insert(
            *peer_id,
            PeerSession {
                handshake: hs,
                init_msg: Some(init_msg.clone()),
                session_key: None,
            },
        );
        Ok(init_msg)
    }

    /// Respond to a peer's initiation (responder side).
    ///
    /// `init_msg` is the bytes received from the initiator. `peer_dilithium_pub`
    /// is the initiator's expected Dilithium3 public key — the responder
    /// verifies the initiator's transcript signature against it before
    /// deriving the session key (MITM protection). Returns the responder
    /// message to send back.
    pub fn respond_session(
        &mut self,
        peer_id: &PeerId,
        init_msg: &[u8],
        peer_dilithium_pub: &Dilithium3PublicKey,
    ) -> Result<Vec<u8>, SessionError> {
        let mut hs = NoiseHandshake::new(HandshakeRole::Responder);
        let resp = hs.respond(init_msg, &self.identity, peer_dilithium_pub)?;
        let key = hs
            .shared_secret()
            .copied()
            .ok_or_else(|| SessionError::NotComplete(peer_id.to_string()))?;
        self.sessions.insert(
            *peer_id,
            PeerSession {
                handshake: hs,
                init_msg: None,
                session_key: Some(key),
            },
        );
        Ok(resp)
    }

    /// Finalize the session on the initiator side after receiving the
    /// responder's message.
    pub fn finalize_session(
        &mut self,
        peer_id: &PeerId,
        resp: &[u8],
    ) -> Result<(), SessionError> {
        let session = self
            .sessions
            .get_mut(peer_id)
            .ok_or_else(|| SessionError::NoSession(peer_id.to_string()))?;
        let init_msg = session
            .init_msg
            .clone()
            .ok_or_else(|| SessionError::NoSession(peer_id.to_string()))?;
        session
            .handshake
            .finalize(resp, &self.identity, &init_msg)?;
        session.session_key = session.handshake.shared_secret().copied();
        Ok(())
    }

    /// Get the derived PQ session key for a peer, if the handshake completed.
    pub fn session_key(&self, peer_id: &PeerId) -> Option<&[u8; 32]> {
        self.sessions
            .get(peer_id)
            .and_then(|s| s.session_key.as_ref())
    }

    /// Drop the session for a disconnected peer.
    pub fn remove_session(&mut self, peer_id: &PeerId) {
        self.sessions.remove(peer_id);
    }

    /// Number of active (in-progress or complete) sessions.
    pub fn len(&self) -> usize {
        self.sessions.len()
    }

    /// Whether there are any sessions.
    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gen() -> Dilithium3Keypair {
        Dilithium3Keypair::generate()
    }

    #[test]
    fn pq_session_end_to_end() {
        // Two nodes, each with a Dilithium3 identity, establish a PQ session.
        let alice_kp = gen();
        let bob_kp = gen();
        let alice = PeerId::random();
        let bob = PeerId::random();

        let mut alice_mgr = PeerSessionManager::new(alice_kp.clone());
        let mut bob_mgr = PeerSessionManager::new(bob_kp.clone());

        // Alice initiates with Bob's public key.
        let init_msg = alice_mgr
            .initiate_session(&alice, &bob_kp.public)
            .expect("initiate");

        // Bob responds, verifying Alice's signature against her public key.
        let resp_msg = bob_mgr
            .respond_session(&bob, &init_msg, &alice_kp.public)
            .expect("respond");

        // Alice finalizes.
        alice_mgr
            .finalize_session(&alice, &resp_msg)
            .expect("finalize");

        // Both derive the SAME session key.
        let alice_key = alice_mgr.session_key(&alice).expect("alice key");
        let bob_key = bob_mgr.session_key(&bob).expect("bob key");
        assert_eq!(alice_key, bob_key, "PQ session keys must match");
    }

    #[test]
    fn mitm_rejected() {
        // An attacker (mallory) without Alice's Dilithium3 secret cannot
        // produce a valid initiator transcript, so Bob rejects it.
        let alice_kp = gen();
        let bob_kp = gen();
        let mallory_kp = gen(); // attacker identity
        let alice = PeerId::random();
        let bob = PeerId::random();

        let mut mallory_mgr = PeerSessionManager::new(mallory_kp);
        let mut bob_mgr = PeerSessionManager::new(bob_kp.clone());

        // Mallory initiates with HER own key, but Bob expects ALICE's key.
        let forged = mallory_mgr
            .initiate_session(&alice, &bob_kp.public)
            .expect("initiate");

        let result = bob_mgr.respond_session(&bob, &forged, &alice_kp.public);
        assert!(
            result.is_err(),
            "responder must reject a transcript not signed by the expected initiator"
        );
    }
}
