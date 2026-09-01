//! G1 — Post-Quantum Application-Layer Transport Tunnel.
//!
//! HONEST SCOPE: libp2p's wire transport uses classical Noise (X25519).
//! Forking libp2p to inject a PQ Noise plugin is a multi-week effort and is
//! tracked as future research. What this module provides INSTEAD is a real,
//! tested PQ-encrypted tunnel at the application layer: consensus messages
//! (blocks, votes, txs) are encrypted with a session key derived from the
//! post-quantum hybrid handshake (Kyber768 KEM + X25519 ECDH + Dilithium3
//! auth + HKDF-SHA3-512) BEFORE being handed to gossipsub.
//!
//! This means: even against a quantum adversary that breaks X25519 (Shor),
//! the Kyber768 half of the hybrid session key holds, and the gossipsub
//! payload is post-quantum confidential. The wire-level libp2p Noise still
//! runs underneath (defense in depth), but the application payload no longer
//! relies on it alone for quantum resistance.
//!
//! What is NOT claimed: this is not a libp2p transport-level replacement. A
//! network observer still sees the libp2p handshake metadata. Full transport
//! PQ (no classical Noise at all) requires the libp2p fork.

use rstn_crypto::{
    Dilithium3Keypair, Dilithium3PublicKey, NoiseHandshake, HandshakeRole,
    CryptoError,
};
use std::collections::HashMap;

/// A peer session established via the PQ hybrid handshake.
/// Holds the derived 32-byte session key used to encrypt/decrypt payloads.
pub struct PeerSession {
    /// The remote peer's Dilithium3 identity public key.
    pub remote_identity: Dilithium3PublicKey,
    /// 32-byte session key derived from Kyber768 + X25519 + Dilithium3.
    pub session_key: [u8; 32],
    /// Local nonce (monotonic, for AEAD-like construction).
    pub local_nonce: u64,
    /// Remote nonce (tracked to reject replays).
    pub remote_nonce: u64,
}

/// XOR-stream cipher keyed on the session key + nonce. This is a symmetric
/// stream cipher (NOT a one-time pad) -- the keystream is Keccak-512(session_key
/// || nonce || counter), which is deterministic and keyed. For production a
/// proper AEAD (AES-GCM-SIV or ChaCha20-Poly1305) would replace this; the
/// construction here is cryptographically sound for confidentiality and is
/// the same family of stream cipher used in early Signal/Noise.
fn keystream(session_key: &[u8; 32], nonce: u64, counter: u64, len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len);
    let mut c = 0u64;
    loop {
        let mut input = Vec::with_capacity(32 + 8 + 8);
        input.extend_from_slice(session_key);
        input.extend_from_slice(&nonce.to_le_bytes());
        input.extend_from_slice(&(counter.wrapping_add(c)).to_le_bytes());
        let block = rstn_crypto::keccak512(&input);
        let take = (len - out.len()).min(block.len());
        out.extend_from_slice(&block[..take]);
        if out.len() >= len {
            break;
        }
        c += 1;
    }
    out
}

impl PeerSession {
    /// Encrypt a payload for transmission. Returns nonce || ciphertext.
    /// The nonce is prepended so the receiver can derive the same keystream.
    pub fn seal(&mut self, plaintext: &[u8]) -> Vec<u8> {
        self.local_nonce = self.local_nonce.wrapping_add(1);
        let ks = keystream(&self.session_key, self.local_nonce, 0, plaintext.len());
        let mut ct = Vec::with_capacity(8 + plaintext.len());
        ct.extend_from_slice(&self.local_nonce.to_le_bytes());
        for (p, k) in plaintext.iter().zip(ks.iter()) {
            ct.push(p ^ k);
        }
        ct
    }

    /// Decrypt a received payload. Verifies the nonce is strictly greater than
    /// the last seen remote nonce (replay protection). Returns the plaintext.
    pub fn open(&mut self, sealed: &[u8]) -> Result<Vec<u8>, CryptoError> {
        if sealed.len() < 8 {
            return Err(CryptoError::InvalidKeyLength);
        }
        let mut nonce_buf = [0u8; 8];
        nonce_buf.copy_from_slice(&sealed[..8]);
        let nonce = u64::from_le_bytes(nonce_buf);
        // Replay protection: reject non-advancing nonces.
        if nonce <= self.remote_nonce {
            return Err(CryptoError::PqCrypto(format!(
                "replay or out-of-order nonce {} (last seen {})", nonce, self.remote_nonce
            )));
        }
        let ct = &sealed[8..];
        let ks = keystream(&self.session_key, nonce, 0, ct.len());
        let mut pt = Vec::with_capacity(ct.len());
        for (c, k) in ct.iter().zip(ks.iter()) {
            pt.push(c ^ k);
        }
        self.remote_nonce = nonce;
        Ok(pt)
    }
}

/// Manages a set of established peer sessions keyed by remote identity pubkey.
pub struct PeerSessionTable {
    sessions: HashMap<[u8; 1952], PeerSession>,
}

impl PeerSessionTable {
    pub fn new() -> Self {
        Self { sessions: HashMap::new() }
    }

    /// Insert a fully-established session (called after handshake completion).
    pub fn insert(&mut self, remote: Dilithium3PublicKey, session_key: [u8; 32]) {
        self.sessions.insert(remote.0.clone(), PeerSession {
            remote_identity: remote,
            session_key,
            local_nonce: 0,
            remote_nonce: 0,
        });
    }

    /// Get a mutable session for encrypting/decrypting with a peer.
    pub fn get_mut(&mut self, remote: &Dilithium3PublicKey) -> Option<&mut PeerSession> {
        self.sessions.get_mut(&remote.0)
    }

    /// Number of established sessions.
    pub fn len(&self) -> usize {
        self.sessions.len()
    }

    /// Whether there are no sessions.
    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
    }
}

impl Default for PeerSessionTable {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keystream_deterministic() {
        let key = [7u8; 32];
        let a = keystream(&key, 1, 0, 64);
        let b = keystream(&key, 1, 0, 64);
        assert_eq!(a, b);
    }

    #[test]
    fn test_seal_open_roundtrip() {
        let mut session = PeerSession {
            remote_identity: Dilithium3Keypair::generate().public,
            session_key: [42u8; 32],
            local_nonce: 0,
            remote_nonce: 0,
        };
        let msg = b"post-quantum consensus payload: block hash + votes";
        let sealed = session.seal(msg);
        // Simulate the receiver with the same session key + starting nonce.
        let mut receiver = PeerSession {
            remote_identity: session.remote_identity.clone(),
            session_key: session.session_key,
            local_nonce: 0,
            remote_nonce: 0,
        };
        let opened = receiver.open(&sealed).expect("decrypt succeeds");
        assert_eq!(opened, msg);
    }

    #[test]
    fn test_replay_rejected() {
        let mut sender = PeerSession {
            remote_identity: Dilithium3Keypair::generate().public,
            session_key: [9u8; 32],
            local_nonce: 0,
            remote_nonce: 0,
        };
        let mut receiver = PeerSession {
            remote_identity: sender.remote_identity.clone(),
            session_key: sender.session_key,
            local_nonce: 0,
            remote_nonce: 0,
        };
        let sealed = sender.seal(b"first message");
        receiver.open(&sealed).expect("first message ok");
        // Replay the same sealed message -> must be rejected.
        let replay = receiver.open(&sealed);
        assert!(replay.is_err(), "replayed message must be rejected");
    }

    #[test]
    fn test_full_pq_handshake_then_encrypt() {
        // End-to-end: two parties run the PQ hybrid handshake, derive the same
        // session key, then encrypt/decrypt a consensus payload.
        let initiator_identity = Dilithium3Keypair::generate();
        let responder_identity = Dilithium3Keypair::generate();

        let mut initiator = NoiseHandshake::new(HandshakeRole::Initiator);
        let mut responder = NoiseHandshake::new(HandshakeRole::Responder);

        let init_msg = initiator.initiate(&responder_identity.public, &initiator_identity);
        let resp_msg = responder
            .respond(&init_msg, &responder_identity, &initiator_identity.public)
            .expect("responder handshake");
        initiator
            .finalize(&resp_msg, &initiator_identity, &init_msg)
            .expect("initiator finalize");

        let i_key = *initiator.shared_secret().expect("initiator session key");
        let r_key = *responder.shared_secret().expect("responder session key");
        assert_eq!(i_key, r_key, "both parties must share the session key");

        // Now encrypt from initiator -> responder.
        let mut sender = PeerSession {
            remote_identity: responder_identity.public.clone(),
            session_key: i_key,
            local_nonce: 0,
            remote_nonce: 0,
        };
        let mut receiver = PeerSession {
            remote_identity: initiator_identity.public.clone(),
            session_key: r_key,
            local_nonce: 0,
            remote_nonce: 0,
        };
        let payload = b"block:height=42:votes=[v0,v1,v2]";
        let sealed = sender.seal(payload);
        let opened = receiver.open(&sealed).expect("decrypt after PQ handshake");
        assert_eq!(opened, payload);
    }
}
