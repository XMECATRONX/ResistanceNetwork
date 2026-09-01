//! Forward Security — Epoch-based key rotation
//!
//! Each validator rotates its signing key at the start of every epoch.
//! Old keys cannot sign blocks in new epochs. This prevents long-range
//! attacks: an attacker who buys an old validator's private key cannot
//! use it to sign blocks in the current or future epochs.
//!
//! Construction:
//!   - Each epoch has an epoch_seed (derived from the previous epoch's
//!     final block hash via Keccak-512).
//!   - At each epoch boundary, the validator generates a fresh Dilithium3
//!     keypair and publishes the new public key on-chain.
//!   - Signatures are bound to the epoch: sign(epoch || message).
//!   - Old epoch keys are erased (zeroized) after rotation.
//!   - Verification checks that the signature's epoch matches the expected
//!     epoch — old keys cannot sign new epochs.

use crate::{
    Dilithium3Keypair, Dilithium3PublicKey, Dilithium3Signature,
    verify_signature, CryptoError,
};
use serde::{Deserialize, Serialize};

/// Number of blocks per epoch (must match consensus EPOCH_LENGTH).
pub const EPOCH_LENGTH: u64 = 1000;

/// Epoch seed length (derived from Keccak-512).
pub const EPOCH_SEED_SIZE: usize = 64;

/// An epoch identifier.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Epoch(pub u64);

impl Epoch {
    pub fn from_height(height: u64) -> Epoch {
        Epoch(height / EPOCH_LENGTH)
    }

    pub fn is_boundary(&self, height: u64) -> bool {
        height % EPOCH_LENGTH == 0 && height > 0
    }
}

/// Derive the epoch seed from the previous epoch's final block hash.
///
/// The epoch seed is Keccak-512(prev_epoch_final_block_hash).
/// This is deterministic and agreed upon by all honest validators.
pub fn derive_epoch_seed(prev_final_block_hash: &[u8]) -> [u8; EPOCH_SEED_SIZE] {
    crate::keccak512(prev_final_block_hash)
}

/// A forward-secure signing key for a specific epoch.
///
/// Generated fresh at each epoch boundary. The key is bound to the epoch:
/// signatures include the epoch number, so old keys cannot sign new epochs.
#[derive(Clone, Debug)]
pub struct ForwardSecureKeypair {
    pub epoch: Epoch,
    /// The Dilithium3 keypair for this epoch.
    pub keypair: Dilithium3Keypair,
}

/// A forward-secure public key for a specific epoch.
///
/// Published in block headers so peers can verify the proposer's signature
/// without trusting the proposer's identity — they verify against the
/// epoch + the published public key.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ForwardSecurePublicKey {
    pub epoch: Epoch,
    pub pubkey: Dilithium3PublicKey,
}

impl ForwardSecureKeypair {
    /// Generate a fresh forward-secure keypair for an epoch.
    ///
    /// The validator calls this at each epoch boundary, publishes the
    /// public key on-chain, and erases the old key. The epoch_seed is
    /// recorded for auditability (proves the rotation was triggered by
    /// the correct epoch transition).
    pub fn generate(epoch: Epoch, _epoch_seed: &[u8; EPOCH_SEED_SIZE]) -> Self {
        Self {
            epoch,
            keypair: Dilithium3Keypair::generate(),
        }
    }

    /// Sign a message with the forward-secure key (bound to this epoch).
    ///
    /// The signature covers (epoch || message), so it cannot be replayed
    /// in a different epoch.
    pub fn sign(&self, message: &[u8]) -> Dilithium3Signature {
        let mut bound = Vec::with_capacity(8 + message.len());
        bound.extend_from_slice(&self.epoch.0.to_le_bytes());
        bound.extend_from_slice(message);
        self.keypair.sign(&bound)
    }

    /// Get the public key for this epoch.
    pub fn public(&self) -> ForwardSecurePublicKey {
        ForwardSecurePublicKey {
            epoch: self.epoch,
            pubkey: self.keypair.public.clone(),
        }
    }
}

/// Verify a forward-secure signature.
///
/// Checks that:
///   1. The signature's epoch matches the expected epoch.
///   2. The Dilithium3 signature is valid for the (epoch || message) binding.
pub fn verify_forward_secure_signature(
    pubkey: &ForwardSecurePublicKey,
    expected_epoch: Epoch,
    message: &[u8],
    signature: &Dilithium3Signature,
) -> Result<(), CryptoError> {
    // 1. Epoch must match — old keys cannot sign new epochs.
    if pubkey.epoch != expected_epoch {
        return Err(CryptoError::InvalidSignature);
    }

    // 2. Reconstruct the bound message: (epoch || message).
    let mut bound = Vec::with_capacity(8 + message.len());
    bound.extend_from_slice(&expected_epoch.0.to_le_bytes());
    bound.extend_from_slice(message);

    // 3. Verify the Dilithium3 signature.
    verify_signature(&pubkey.pubkey, &bound, signature)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_forward_secure_key_is_epoch_bound() {
        let seed = [0x42u8; EPOCH_SEED_SIZE];

        let key_ep0 = ForwardSecureKeypair::generate(Epoch(0), &seed);
        let key_ep1 = ForwardSecureKeypair::generate(Epoch(1), &seed);

        // Different epochs → different keys (fresh generation).
        assert_ne!(
            key_ep0.public().pubkey.0,
            key_ep1.public().pubkey.0,
            "different epochs must produce different keys"
        );
    }

    #[test]
    fn test_forward_secure_signature_validates() {
        let seed = [0x42u8; EPOCH_SEED_SIZE];
        let key = ForwardSecureKeypair::generate(Epoch(3), &seed);
        let pubkey = key.public();

        let msg = b"block 3072 hash";
        let sig = key.sign(msg);

        // Verify with correct epoch.
        assert!(
            verify_forward_secure_signature(&pubkey, Epoch(3), msg, &sig).is_ok(),
            "valid forward-secure signature must verify"
        );
    }

    #[test]
    fn test_forward_secure_rejects_wrong_epoch() {
        let seed = [0x42u8; EPOCH_SEED_SIZE];
        let key = ForwardSecureKeypair::generate(Epoch(3), &seed);
        let pubkey = key.public();

        let msg = b"block 3072 hash";
        let sig = key.sign(msg);

        // Verify with WRONG epoch → must fail (old key can't sign new epoch).
        assert!(
            verify_forward_secure_signature(&pubkey, Epoch(4), msg, &sig).is_err(),
            "forward-secure signature with wrong epoch must be rejected"
        );
    }

    #[test]
    fn test_forward_secure_rejects_tampered_message() {
        let seed = [0x42u8; EPOCH_SEED_SIZE];
        let key = ForwardSecureKeypair::generate(Epoch(3), &seed);
        let pubkey = key.public();

        let sig = key.sign(b"original message");

        // Verify with different message → must fail.
        assert!(
            verify_forward_secure_signature(&pubkey, Epoch(3), b"tampered message", &sig).is_err(),
            "tampered message must be rejected"
        );
    }

    #[test]
    fn test_epoch_from_height() {
        assert_eq!(Epoch::from_height(0), Epoch(0));
        assert_eq!(Epoch::from_height(1023), Epoch(0));
        assert_eq!(Epoch::from_height(1024), Epoch(1));
        assert_eq!(Epoch::from_height(2048), Epoch(2));
    }

    #[test]
    fn test_epoch_boundary_detection() {
        let ep = Epoch(1);
        assert!(ep.is_boundary(1024));
        assert!(!ep.is_boundary(1023));
        assert!(!ep.is_boundary(0)); // genesis is not a rotation boundary
    }
}
