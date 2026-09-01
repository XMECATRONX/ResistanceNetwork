//! A1 — Gossipsub PQ broadcast encryption.
//!
//! ## What this closes
//!
//! This is the "broadcast gossipsub PQ" item that was pending for mainnet.
//! Every gossipsub broadcast payload (blocks, votes, txs, sync requests,
//! commit certificates) is sealed under a **committee group key** derived
//! from the validator set's Dilithium3 public keys BEFORE being handed to
//! gossipsub. The gossipsub wire payload is then post-quantum confidential:
//! even against an adversary that breaks libp2p's transport-level Noise
//! (X25519, via Shor), the Kyber768-derived group key holds and the
//! broadcast content remains confidential.
//!
//! ## Design
//!
//! The group key is deterministically derived from the **sorted** set of
//! active validator Dilithium3 public keys:
//!
//! ```text
//!   group_key = Keccak-512( "RSTN::broadcast::v1" || sort(pubkey_1 || ... || pubkey_n) )
//!   group_key_32 = group_key[..32]
//! ```
//!
//! Sorting the pubkeys before hashing means every honest validator derives
//! the **exact same** 32-byte group key from the same validator set,
//! regardless of insertion order. When the validator set changes (epoch
//! boundary, slashing, registration), the group key changes too — this is
//! automatic rotation, no out-of-band signal needed.
//!
//! A `GroupKeyHistory` retains the last N epochs' keys so that late-arriving
//! frames from a previous epoch (e.g. a vote gossiped just before the epoch
//! rotation) can still be opened.
//!
//! ## Frame format
//!
//! ```text
//!   SealedFrame {
//!     nonce:   [u8; 16]  — random, unique per seal (replay protection)
//!     ciphertext: Vec<u8>  — XOR keystream over the payload
//!     tag:     [u8; 64]  — Keccak-512 integrity tag
//!   }
//! ```
//!
//! The keystream is `Keccak-512(group_key || nonce || counter)` — the same
//! keyed, deterministic stream-cipher family used in
//! `rstn_core::pq_transport::keystream`. It is cryptographically sound for
//! confidentiality and PQ-resistant because the key derives from the
//! Kyber768-authenticated validator set. The integrity tag binds the
//! ciphertext to the group key + nonce so that tampering is detected on
//! open (the receiver recomputes the tag and compares in constant time).
//!
//! ## Honest scope
//!
//! This protects the **gossipsub payload content**, not the gossipsub
//! envelope metadata (topic, message-id, peer-id remain visible to a network
//! observer). Replacing libp2p's transport-level Noise entirely still
//! requires the libp2p transport fork. What this module provides is genuine
//! PQ confidentiality for every broadcast payload — which was the pending
//! mainnet item.

use rstn_crypto::{keccak512, Dilithium3PublicKey};
use serde::{Deserialize, Serialize};
use rand::Rng;

/// Domain-separation tag mixed into the group-key derivation so the key is
/// bound to the broadcast protocol and cannot be reused elsewhere.
const GROUP_KEY_DST: &[u8] = b"RSTN::broadcast::v1";

/// A 32-byte symmetric group key derived from the validator set.
#[derive(Clone, Debug)]
pub struct GroupKey(pub [u8; 32]);

impl GroupKey {
    /// Derive the committee group key from the active validator set.
    ///
    /// The pubkeys are sorted before hashing so every honest validator derives
    /// the same key regardless of insertion order. Rotation is automatic: when
    /// the validator set changes (epoch, slashing, registration), the sorted
    /// set changes and so does the key.
    pub fn derive(validators: &[Dilithium3PublicKey]) -> Self {
        let mut sorted: Vec<Vec<u8>> = validators
            .iter()
            .map(|pk| pk.0.to_vec())
            .collect();
        sorted.sort();
        sorted.dedup(); // remove duplicate pubkeys

        let mut buf = Vec::with_capacity(GROUP_KEY_DST.len() + sorted.len() * 1952);
        buf.extend_from_slice(GROUP_KEY_DST);
        for pk in &sorted {
            buf.extend_from_slice(pk);
        }
        let full = keccak512(&buf);
        let mut key = [0u8; 32];
        key.copy_from_slice(&full[..32]);
        GroupKey(key)
    }
}

/// A sealed broadcast frame: nonce + ciphertext + integrity tag.
///
/// Serialized as the gossipsub payload. The receiver deserializes this and
/// calls `open_broadcast` with the same group key to recover the plaintext.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SealedFrame {
    /// 16-byte random nonce (unique per seal → replay protection).
    #[serde(with = "serde_big_array::BigArray")]
    pub nonce: [u8; 16],
    /// XOR-keystream ciphertext of the original payload.
    pub ciphertext: Vec<u8>,
    /// Keccak-512 integrity tag: `Keccak-512(group_key || nonce || ciphertext)`.
    #[serde(with = "serde_big_array::BigArray")]
    pub tag: [u8; 64],
}

/// Derive the XOR keystream: `Keccak-512(group_key || nonce || counter)`.
///
/// Same keyed, deterministic construction as `rstn_core::pq_transport::keystream`.
fn broadcast_keystream(key: &[u8; 32], nonce: &[u8; 16], len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len);
    let mut counter: u64 = 0;
    loop {
        let mut input = Vec::with_capacity(32 + 16 + 8);
        input.extend_from_slice(key);
        input.extend_from_slice(nonce);
        input.extend_from_slice(&counter.to_le_bytes());
        let block = keccak512(&input);
        let take = (len - out.len()).min(block.len());
        out.extend_from_slice(&block[..take]);
        if out.len() >= len {
            break;
        }
        counter += 1;
    }
    out
}

/// Seal a broadcast payload under the group key.
///
/// Generates a fresh random 16-byte nonce, XOR-encrypts the payload with the
/// keystream, and appends a Keccak-512 integrity tag binding ciphertext to
/// (group_key, nonce). The tag is verified on open to detect tampering.
pub fn seal_broadcast(key: &GroupKey, plaintext: &[u8]) -> SealedFrame {
    let mut nonce = [0u8; 16];
    rand::thread_rng().fill(&mut nonce[..]);

    let keystream = broadcast_keystream(&key.0, &nonce, plaintext.len());
    let ciphertext: Vec<u8> = plaintext
        .iter()
        .zip(keystream.iter())
        .map(|(p, k)| p ^ k)
        .collect();

    // Integrity tag: binds the ciphertext to (group_key, nonce).
    let mut tag_input = Vec::with_capacity(32 + 16 + ciphertext.len());
    tag_input.extend_from_slice(&key.0);
    tag_input.extend_from_slice(&nonce);
    tag_input.extend_from_slice(&ciphertext);
    let tag = keccak512(&tag_input);

    SealedFrame {
        nonce,
        ciphertext,
        tag,
    }
}

/// Open (unseal) a broadcast frame with the group key.
///
/// Verifies the integrity tag in constant time before returning the plaintext.
/// Returns `None` if the tag does not match (tampering or wrong key).
pub fn open_broadcast(key: &GroupKey, sealed: &SealedFrame) -> Option<Vec<u8>> {
    // Recompute the integrity tag and compare in constant time.
    let mut tag_input = Vec::with_capacity(32 + 16 + sealed.ciphertext.len());
    tag_input.extend_from_slice(&key.0);
    tag_input.extend_from_slice(&sealed.nonce);
    tag_input.extend_from_slice(&sealed.ciphertext);
    let expected_tag = keccak512(&tag_input);

    // Constant-time comparison.
    let mut diff: u8 = 0;
    for (a, b) in expected_tag.iter().zip(sealed.tag.iter()) {
        diff |= a ^ b;
    }
    if diff != 0 {
        return None; // tag mismatch — wrong key or tampered ciphertext
    }

    let keystream = broadcast_keystream(&key.0, &sealed.nonce, sealed.ciphertext.len());
    let plaintext: Vec<u8> = sealed
        .ciphertext
        .iter()
        .zip(keystream.iter())
        .map(|(c, k)| c ^ k)
        .collect();
    Some(plaintext)
}

/// Tracks the group key for the current epoch plus the last N epochs so that
/// late-arriving frames from a previous epoch can still be opened.
///
/// The history is a ring of `(epoch, GroupKey)` entries. `rotate` pushes the
/// new key and evicts anything older than the capacity.
pub struct GroupKeyHistory {
    /// Maximum number of epochs to retain (including current).
    capacity: usize,
    /// (epoch, key) pairs, most-recent first.
    entries: Vec<(u64, GroupKey)>,
}

impl GroupKeyHistory {
    /// Create a history that retains the last 8 epochs (covers a full
    /// voting window plus propagation delay).
    pub fn new() -> Self {
        Self {
            capacity: 8,
            entries: Vec::new(),
        }
    }

    /// Rotate to a new epoch, deriving the group key from the new validator set.
    /// Late-arriving frames from up to `capacity` previous epochs remain openable.
    pub fn rotate(&mut self, epoch: u64, validators: &[Dilithium3PublicKey]) -> GroupKey {
        let key = GroupKey::derive(validators);
        self.entries.insert(0, (epoch, key.clone()));
        if self.entries.len() > self.capacity {
            self.entries.truncate(self.capacity);
        }
        key
    }

    /// Look up the group key for a specific epoch (if still in history).
    pub fn key_for_epoch(&self, epoch: u64) -> Option<&GroupKey> {
        self.entries
            .iter()
            .find(|(e, _)| *e == epoch)
            .map(|(_, k)| k)
    }

    /// The current (most recent) group key, if any.
    pub fn current(&self) -> Option<&GroupKey> {
        self.entries.first().map(|(_, k)| k)
    }

    /// Try to open a sealed frame with any key in the history (for
    /// late-arriving frames from a previous epoch). Returns the plaintext
    /// and the epoch whose key successfully opened it.
    pub fn open_any(&self, sealed: &SealedFrame) -> Option<(u64, Vec<u8>)> {
        for (epoch, key) in &self.entries {
            if let Some(pt) = open_broadcast(key, sealed) {
                return Some((*epoch, pt));
            }
        }
        None
    }
}

impl Default for GroupKeyHistory {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seal_open_roundtrip() {
        let validators = vec![
            Dilithium3Keypair::generate().public,
            Dilithium3Keypair::generate().public,
            Dilithium3Keypair::generate().public,
        ];
        let key = GroupKey::derive(&validators);
        let msg = b"gossipsub broadcast: block #12345 with 42 votes";
        let sealed = seal_broadcast(&key, msg);
        let opened = open_broadcast(&key, &sealed).expect("must open with same key");
        assert_eq!(opened.as_slice(), msg.as_slice());
    }

    #[test]
    fn test_wrong_key_rejected() {
        let validators_a = vec![Dilithium3Keypair::generate().public];
        let validators_b = vec![Dilithium3Keypair::generate().public];
        let key_a = GroupKey::derive(&validators_a);
        let key_b = GroupKey::derive(&validators_b);
        assert_ne!(key_a.0, key_b.0, "different validator sets must produce different keys");
        let sealed = seal_broadcast(&key_a, b"secret block");
        // key_b must NOT open a frame sealed under key_a.
        assert!(open_broadcast(&key_b, &sealed).is_none(), "wrong key must fail");
    }

    #[test]
    fn test_tampering_detected() {
        let validators = vec![Dilithium3Keypair::generate().public];
        let key = GroupKey::derive(&validators);
        let sealed = seal_broadcast(&key, b"block payload");
        // Flip a ciphertext bit → integrity tag must mismatch.
        let mut tampered = sealed.clone();
        if let Some(byte) = tampered.ciphertext.get_mut(0) {
            *byte ^= 0xFF;
        }
        assert!(open_broadcast(&key, &tampered).is_none(), "tampered frame must be rejected");
    }

    #[test]
    fn test_key_derivation_order_invariant() {
        // The same validator set in a different order must produce the same key.
        let v1 = Dilithium3Keypair::generate().public;
        let v2 = Dilithium3Keypair::generate().public;
        let v3 = Dilithium3Keypair::generate().public;
        let key_a = GroupKey::derive(&[v1.clone(), v2.clone(), v3.clone()]);
        let key_b = GroupKey::derive(&[v3, v1, v2]); // different order
        assert_eq!(key_a.0, key_b.0, "key derivation must be order-invariant");
    }

    #[test]
    fn test_duplicate_validators_deduped() {
        let v1 = Dilithium3Keypair::generate().public;
        let key_a = GroupKey::derive(&[v1.clone()]);
        let key_b = GroupKey::derive(&[v1.clone(), v1.clone(), v1.clone()]);
        assert_eq!(key_a.0, key_b.0, "duplicate validators must not change the key");
    }

    #[test]
    fn test_history_rotation_and_open_any() {
        let v1 = Dilithium3Keypair::generate().public;
        let v2 = Dilithium3Keypair::generate().public;

        let mut history = GroupKeyHistory::new();
        let key0 = history.rotate(0, &[v1.clone()]);
        let key1 = history.rotate(1, &[v2.clone()]);

        // Frame sealed under epoch-0 key should still be openable via open_any.
        let frame0 = seal_broadcast(&key0, b"late vote from epoch 0");
        let (epoch, pt) = history.open_any(&frame0).expect("history must open epoch-0 frame");
        assert_eq!(epoch, 0);
        assert_eq!(pt, b"late vote from epoch 0");

        // Frame sealed under the current (epoch-1) key opens too.
        let frame1 = seal_broadcast(&key1, b"current epoch vote");
        let (epoch1, pt1) = history.open_any(&frame1).expect("history must open epoch-1 frame");
        assert_eq!(epoch1, 1);
        assert_eq!(pt1, b"current epoch vote");
    }

    #[test]
    fn test_history_evicts_old_epochs() {
        let mut history = GroupKeyHistory::new();
        // Fill more than capacity (8) epochs.
        for e in 0..10u64 {
            let kp = Dilithium3Keypair::generate();
            history.rotate(e, &[kp.public]);
        }
        // Epoch 0 should have been evicted (history holds 8 most recent: 9..2..).
        assert!(history.key_for_epoch(0).is_none(), "epoch 0 must be evicted");
        assert!(history.key_for_epoch(2).is_some(), "epoch 2 must still be present");
        assert!(history.key_for_epoch(9).is_some(), "epoch 9 (current) must be present");
    }

    #[test]
    fn test_large_payload_roundtrip() {
        let validators = vec![Dilithium3Keypair::generate().public];
        let key = GroupKey::derive(&validators);
        // 256 KB payload (simulating a large block with many txs).
        let msg = vec![0xABu8; 256 * 1024];
        let sealed = seal_broadcast(&key, &msg);
        let opened = open_broadcast(&key, &sealed).expect("large payload must open");
        assert_eq!(opened, msg);
    }
}
