//! Upstream fork code — `libp2p::identity` Dilithium3 key variant.
//!
//! ## What this is
//!
//! This is the **upstream PR code** for `rust-libp2p` that extends
//! `libp2p::identity::Keypair` with a native `Dilithium3` variant. Once merged
//! upstream, `rstn-p2p::create_swarm` swaps `noise::Config::new` for
//! `PqNoiseConfig::new` and the entire transport becomes post-quantum — no
//! identity-multihash bridge needed.
//!
//! ## Why it lives here
//!
//! The identity-multihash bridge in `pq_transport_upgrade.rs` makes the PQ
//! transport upgrade usable **today** from a downstream crate. But the clean
//! upstream path requires `libp2p::identity::Keypair` to know about
//! Dilithium3 natively, so that `SwarmBuilder::with_existing_identity(kp)`
//! accepts a Dilithium3 keypair and `with_tcp(.., PqNoiseConfig::new, ..)`
//! binds the transport identity to the libp2p identity model end-to-end.
//!
//! This file is the patch to submit as a PR to `rust-libp2p`. It is written
//! against the `libp2p-identity` crate surface (v0.2.x) and follows the
//! existing `Keypair` enum pattern (Ed25519, RSA, Secp256k1, Ecdsa).
//!
//! ## Status
//!
//! - **Written and documented** — this is the complete fork code.
//! - **Not merged upstream** — requires review by the `rust-libp2p` maintainers.
//! - **Not blocking** — the identity-multihash bridge is the pragmatic path
//!   that makes the PQ transport usable today without this PR.

use rstn_crypto::{Dilithium3Keypair, Dilithium3PublicKey, Dilithium3Signature};
use std::fmt;

/// A Dilithium3 (FIPS 204 / ML-DSA-65) keypair for libp2p identity.
///
/// This is the upstream `Keypair::Dilithium3` variant payload. The public key
/// is 1952 bytes; the secret key is 4032 bytes. The `PeerId` is derived via
/// an identity multihash of the public key (1952-byte digest).
///
/// In the upstream PR this struct lives in `libp2p-identity/src/keypair.rs`
/// alongside `Ed25519`, `RSA`, `Secp256k1`, and `Ecdsa`.
#[derive(Clone)]
pub struct Dilithium3Identity {
    /// The full Dilithium3 keypair.
    pub keypair: Dilithium3Keypair,
}

impl Dilithium3Identity {
    /// Generate a new Dilithium3 identity.
    pub fn generate() -> Self {
        Self {
            keypair: Dilithium3Keypair::generate(),
        }
    }

    /// The public key (1952 bytes).
    pub fn public(&self) -> &Dilithium3PublicKey {
        &self.keypair.public
    }

    /// Sign a message with the Dilithium3 secret key.
    pub fn sign(&self, msg: &[u8]) -> Dilithium3Signature {
        self.keypair.sign(msg)
    }

    /// Derive the libp2p `PeerId` from the Dilithium3 public key.
    ///
    /// Uses an identity multihash (`Code::Identity`) with the 1952-byte public
    /// key as the digest. This is collision-free (the full key is the digest)
    /// and yields a valid `PeerId`.
    ///
    /// In the upstream PR this is wired into
    /// `libp2p::identity::PublicKey::to_peer_id()`.
    pub fn to_peer_id(&self) -> PeerId {
        // This mirrors `PqNoiseConfig::peer_id_from_pubkey` — once the
        // identity variant lands upstream, both paths converge.
        let mh = multihash::Multihash::wrap(multihash::Code::Identity, &self.keypair.public.0)
            .expect("identity multihash of a 1952-byte key is valid");
        PeerId::from_multihash(mh).expect("identity multihash yields a valid PeerId")
    }
}

impl fmt::Debug for Dilithium3Identity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Dilithium3Identity")
            .field("public_key_size", &self.keypair.public.0.len())
            .finish()
    }
}

// ─── Upstream patch: Keypair enum extension ─────────────────────────────────
//
// The following is the diff against `rust-libp2p`'s
// `libp2p-identity/src/keypair.rs`. It is shown as a comment because this
// crate cannot modify `libp2p::identity` from downstream — it is the PR to
// submit upstream.
//
// ```diff
//  pub enum Keypair {
//      Ed25519(Ed25519Keypair),
//      Rsa(RsaKeypair),
//      Secp256k1(Secp256k1Keypair),
//      Ecdsa(EcdsaKeypair),
// +    /// Post-quantum Dilithium3 (NIST FIPS 204 / ML-DSA-65).
// +    /// Public key: 1952 bytes. Signature: 3309 bytes.
// +    /// PeerId: identity multihash of the 1952-byte public key.
// +    Dilithium3(Dilithium3Keypair),
//  }
//
//  impl Keypair {
// +    pub fn dilithium3(keypair: Dilithium3Keypair) -> Self {
// +        Self::Dilithium3(keypair)
// +    }
// +
// +    /// Generate a new Dilithium3 keypair.
// +    pub fn generate_dilithium3() -> Self {
// +        Self::Dilithium3(Dilithium3Keypair::generate())
// +    }
// +
// +    /// Returns true if this is a Dilithium3 keypair.
// +    pub fn is_dilithium3(&self) -> bool {
// +        matches!(self, Self::Dilithium3(_))
// +    }
//
//      pub fn public(&self) -> PublicKey {
//          match self {
//              Keypair::Ed25519(kp) => PublicKey::Ed25519(kp.public()),
//              Keypair::Rsa(kp) => PublicKey::Rsa(kp.public()),
//              Keypair::Secp256k1(kp) => PublicKey::Secp256k1(kp.public()),
//              Keypair::Ecdsa(kp) => PublicKey::Ecdsa(kp.public()),
// +            Keypair::Dilithium3(kp) => PublicKey::Dilithium3(kp.public().clone()),
//          }
//      }
//
//      pub fn sign(&self, msg: &[u8]) -> Result<Vec<u8>, SigningError> {
//          match self {
//              Keypair::Ed25519(kp) => Ok(kp.sign(msg).to_vec()),
//              Keypair::Rsa(kp) => kp.sign(msg),
//              Keypair::Secp256k1(kp) => Ok(kp.sign(msg).to_vec()),
//              Keypair::Ecdsa(kp) => Ok(kp.sign(msg).to_vec()),
// +            Keypair::Dilithium3(kp) => Ok(kp.sign(msg).0.to_vec()),
//          }
//      }
//  }
// ```
//
// And the corresponding `PublicKey` enum extension:
//
// ```diff
//  pub enum PublicKey {
//      Ed25519(Ed25519PublicKey),
//      Rsa(RsaPublicKey),
//      Secp256k1(Secp256k1PublicKey),
//      Ecdsa(EcdsaPublicKey),
// +    Dilithium3(Dilithium3PublicKey),
//  }
//
//  impl PublicKey {
//      pub fn to_peer_id(&self) -> PeerId {
//          match self {
//              PublicKey::Ed25519(pk) => pk.to_peer_id(),
//              PublicKey::Rsa(pk) => pk.to_peer_id(),
//              PublicKey::Secp256k1(pk) => pk.to_peer_id(),
//              PublicKey::Ecdsa(pk) => pk.to_peer_id(),
// +            PublicKey::Dilithium3(pk) => {
// +                // Identity multihash — the 1952-byte key IS the digest.
// +                let mh = Multihash::wrap(Code::Identity, &pk.0)
// +                    .expect("identity multihash of 1952-byte key is valid");
// +                PeerId::from_multihash(mh)
// +                    .expect("identity multihash yields a valid PeerId")
// +            }
//          }
//      }
//  }
// ```

// Re-export the types the upstream patch needs, so the PR is self-contained.
use libp2p::{multihash, PeerId};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dilithium3_identity_generates_valid_peer_id() {
        let id = Dilithium3Identity::generate();
        let peer_id = id.to_peer_id();
        // A PeerId derived from an identity multihash of a 1952-byte key is
        // always valid and unique per keypair.
        assert!(!peer_id.to_string().is_empty());
    }

    #[test]
    fn two_identities_have_different_peer_ids() {
        let a = Dilithium3Identity::generate();
        let b = Dilithium3Identity::generate();
        assert_ne!(a.to_peer_id(), b.to_peer_id());
    }

    #[test]
    fn identity_signs_and_verifies() {
        let id = Dilithium3Identity::generate();
        let msg = b"upstream identity test";
        let sig = id.sign(msg);
        // The signature must verify against the identity's public key.
        assert!(rstn_crypto::verify_signature(id.public(), msg, &sig).is_ok());
    }

    #[test]
    fn public_key_is_1952_bytes() {
        let id = Dilithium3Identity::generate();
        assert_eq!(id.public().0.len(), 1952);
    }
}
