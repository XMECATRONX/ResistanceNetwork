//! Account Abstraction (post-quantum)
//!
//! Account abstraction lets users define custom validation logic for
//! their accounts. Instead of a single Dilithium3 key controlling an
//! account, the account has a "validation function" that decides whether
//! a transaction is authorized.
//!
//! This enables:
//!   - Multi-sig accounts (require M-of-N signatures).
//!   - Social recovery (guardians can recover a lost key).
//!   - Session keys (temporary keys with limited permissions).
//!   - Post-quantum rotation (rotate the validation scheme to a new
//!     signature scheme without changing the account address).
//!
//! Design:
//!   - An abstract account's address is derived from its initial validation
//!     scheme (deterministic).
//!   - Transactions carry a validation payload that the scheme checks.
//!   - The validation returns authorized or rejected.
//!   - Scheme rotation changes validation without changing the address.

use crate::{
    keccak512, Dilithium3Keypair, Dilithium3PublicKey,
    Dilithium3Signature, verify_signature, CryptoError, ADDRESS_SIZE,
};
use serde::{Deserialize, Serialize};

/// An abstract account's validation scheme.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum ValidationScheme {
    /// Single Dilithium3 key (standard account, backwards compatible).
    SingleKey {
        pubkey: Dilithium3PublicKey,
    },
    /// M-of-N multi-signature.
    MultiSig {
        pubkeys: Vec<Dilithium3PublicKey>,
        threshold: u8,
    },
    /// Social recovery: the owner key + guardians can recover.
    SocialRecovery {
        owner: Dilithium3PublicKey,
        guardians: Vec<Dilithium3PublicKey>,
        threshold: u8,
    },
    /// Custom validation contract (RSTN-VM bytecode).
    Contract {
        contract_address: [u8; 32],
    },
}

/// An abstract account.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AbstractAccount {
    /// The account address (derived from the initial validation scheme).
    pub address: [u8; ADDRESS_SIZE],
    /// The current validation scheme.
    pub scheme: ValidationScheme,
    /// Nonce (incremented per transaction).
    pub nonce: u64,
}

/// A validation payload attached to a transaction.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ValidationPayload {
    /// The transaction hash being authorized.
    pub tx_hash: [u8; 64],
    /// Signatures (interpretation depends on the scheme).
    pub signatures: Vec<Dilithium3Signature>,
    /// Which signers (indices into the pubkey list, for multi-sig).
    pub signer_indices: Vec<u8>,
}

/// Derive an address from arbitrary scheme bytes.
fn derive_scheme_address(scheme_bytes: &[u8]) -> [u8; ADDRESS_SIZE] {
    let hash = keccak512(scheme_bytes);
    let mut addr = [0u8; ADDRESS_SIZE];
    addr.copy_from_slice(&hash[64 - ADDRESS_SIZE..]);
    addr
}

impl AbstractAccount {
    /// Create a new abstract account with a single-key scheme.
    pub fn new_single_key(pubkey: Dilithium3PublicKey) -> Self {
        let mut scheme_bytes = Vec::new();
        scheme_bytes.push(0u8); // scheme type: SingleKey
        scheme_bytes.extend_from_slice(&pubkey.0);
        let address = derive_scheme_address(&scheme_bytes);

        Self {
            address,
            scheme: ValidationScheme::SingleKey { pubkey },
            nonce: 0,
        }
    }

    /// Create a new abstract account with a multi-sig scheme.
    pub fn new_multisig(
        pubkeys: Vec<Dilithium3PublicKey>,
        threshold: u8,
    ) -> Self {
        let mut scheme_bytes = Vec::new();
        scheme_bytes.push(1u8); // scheme type: MultiSig
        scheme_bytes.push(threshold);
        for pk in &pubkeys {
            scheme_bytes.extend_from_slice(&pk.0);
        }
        let address = derive_scheme_address(&scheme_bytes);

        Self {
            address,
            scheme: ValidationScheme::MultiSig { pubkeys, threshold },
            nonce: 0,
        }
    }

    /// Create a new abstract account with social recovery.
    pub fn new_social_recovery(
        owner: Dilithium3PublicKey,
        guardians: Vec<Dilithium3PublicKey>,
        threshold: u8,
    ) -> Self {
        let mut scheme_bytes = Vec::new();
        scheme_bytes.push(2u8); // scheme type: SocialRecovery
        scheme_bytes.extend_from_slice(&owner.0);
        scheme_bytes.push(threshold);
        for g in &guardians {
            scheme_bytes.extend_from_slice(&g.0);
        }
        let address = derive_scheme_address(&scheme_bytes);

        Self {
            address,
            scheme: ValidationScheme::SocialRecovery {
                owner,
                guardians,
                threshold,
            },
            nonce: 0,
        }
    }

    /// Validate a transaction's authorization.
    pub fn validate(&self, payload: &ValidationPayload) -> Result<(), CryptoError> {
        match &self.scheme {
            ValidationScheme::SingleKey { pubkey } => {
                if payload.signatures.len() != 1 {
                    return Err(CryptoError::InvalidSignature);
                }
                verify_signature(pubkey, &payload.tx_hash, &payload.signatures[0])
            }

            ValidationScheme::MultiSig { pubkeys, threshold } => {
                let t = *threshold as usize;
                if payload.signatures.len() < t {
                    return Err(CryptoError::InvalidSignature);
                }
                if payload.signer_indices.len() != payload.signatures.len() {
                    return Err(CryptoError::InvalidSignature);
                }

                let mut verified = 0usize;
                let mut used = std::collections::HashSet::new();
                for (i, sig) in payload.signatures.iter().enumerate() {
                    let idx = payload.signer_indices[i] as usize;
                    if idx >= pubkeys.len() {
                        return Err(CryptoError::InvalidSignature);
                    }
                    if !used.insert(idx) {
                        return Err(CryptoError::InvalidSignature); // duplicate signer
                    }
                    if verify_signature(&pubkeys[idx], &payload.tx_hash, sig).is_ok() {
                        verified += 1;
                    }
                }

                if verified >= t {
                    Ok(())
                } else {
                    Err(CryptoError::InvalidSignature)
                }
            }

            ValidationScheme::SocialRecovery {
                owner,
                guardians,
                threshold,
            } => {
                // Normal operation: owner signs.
                if payload.signatures.len() == 1 && payload.signer_indices.is_empty() {
                    return verify_signature(owner, &payload.tx_hash, &payload.signatures[0]);
                }

                // Recovery: threshold guardians sign.
                let t = *threshold as usize;
                if payload.signatures.len() < t {
                    return Err(CryptoError::InvalidSignature);
                }

                let mut verified = 0usize;
                let mut used = std::collections::HashSet::new();
                for (i, sig) in payload.signatures.iter().enumerate() {
                    if i >= guardians.len() {
                        break;
                    }
                    if !used.insert(i) {
                        continue;
                    }
                    if verify_signature(&guardians[i], &payload.tx_hash, sig).is_ok() {
                        verified += 1;
                    }
                }

                if verified >= t {
                    Ok(())
                } else {
                    Err(CryptoError::InvalidSignature)
                }
            }

            ValidationScheme::Contract { .. } => {
                // Contract validation is performed by the VM, not here.
                Ok(())
            }
        }
    }

    /// Increment the nonce after a successful transaction.
    pub fn increment_nonce(&mut self) {
        self.nonce += 1;
    }

    /// Rotate the validation scheme (post-quantum migration).
    pub fn rotate_scheme(&mut self, new_scheme: ValidationScheme) {
        self.scheme = new_scheme;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_key_account_validates() {
        let kp = Dilithium3Keypair::generate();
        let account = AbstractAccount::new_single_key(kp.public.clone());

        let tx_hash = keccak512(b"transaction data");
        let sig = kp.sign(&tx_hash);

        let payload = ValidationPayload {
            tx_hash,
            signatures: vec![sig],
            signer_indices: vec![],
        };

        assert!(account.validate(&payload).is_ok());
    }

    #[test]
    fn test_single_key_account_rejects_wrong_sig() {
        let kp1 = Dilithium3Keypair::generate();
        let kp2 = Dilithium3Keypair::generate();
        let account = AbstractAccount::new_single_key(kp1.public.clone());

        let tx_hash = keccak512(b"transaction data");
        let sig = kp2.sign(&tx_hash);

        let payload = ValidationPayload {
            tx_hash,
            signatures: vec![sig],
            signer_indices: vec![],
        };

        assert!(account.validate(&payload).is_err());
    }

    #[test]
    fn test_multisig_2_of_3_validates() {
        let kps: Vec<Dilithium3Keypair> =
            (0..3).map(|_| Dilithium3Keypair::generate()).collect();
        let pubkeys: Vec<Dilithium3PublicKey> = kps.iter().map(|k| k.public.clone()).collect();
        let account = AbstractAccount::new_multisig(pubkeys, 2);

        let tx_hash = keccak512(b"multisig tx");
        let sig0 = kps[0].sign(&tx_hash);
        let sig1 = kps[1].sign(&tx_hash);

        let payload = ValidationPayload {
            tx_hash,
            signatures: vec![sig0, sig1],
            signer_indices: vec![0, 1],
        };

        assert!(account.validate(&payload).is_ok());
    }

    #[test]
    fn test_multisig_1_of_3_rejected() {
        let kps: Vec<Dilithium3Keypair> =
            (0..3).map(|_| Dilithium3Keypair::generate()).collect();
        let pubkeys: Vec<Dilithium3PublicKey> = kps.iter().map(|k| k.public.clone()).collect();
        let account = AbstractAccount::new_multisig(pubkeys, 2);

        let tx_hash = keccak512(b"multisig tx");
        let sig0 = kps[0].sign(&tx_hash);

        let payload = ValidationPayload {
            tx_hash,
            signatures: vec![sig0],
            signer_indices: vec![0],
        };

        assert!(account.validate(&payload).is_err(), "1 signature < threshold 2");
    }

    #[test]
    fn test_multisig_rejects_duplicate_signer() {
        let kps: Vec<Dilithium3Keypair> =
            (0..3).map(|_| Dilithium3Keypair::generate()).collect();
        let pubkeys: Vec<Dilithium3PublicKey> = kps.iter().map(|k| k.public.clone()).collect();
        let account = AbstractAccount::new_multisig(pubkeys, 2);

        let tx_hash = keccak512(b"multisig tx");
        let sig0 = kps[0].sign(&tx_hash);

        let payload = ValidationPayload {
            tx_hash,
            signatures: vec![sig0.clone(), sig0],
            signer_indices: vec![0, 0],
        };

        assert!(account.validate(&payload).is_err(), "duplicate signer rejected");
    }

    #[test]
    fn test_social_recovery_owner_signs() {
        let owner = Dilithium3Keypair::generate();
        let guardians: Vec<Dilithium3Keypair> =
            (0..3).map(|_| Dilithium3Keypair::generate()).collect();
        let guardian_pubs: Vec<Dilithium3PublicKey> =
            guardians.iter().map(|g| g.public.clone()).collect();

        let account = AbstractAccount::new_social_recovery(
            owner.public.clone(),
            guardian_pubs,
            2,
        );

        let tx_hash = keccak512(b"normal tx");
        let sig = owner.sign(&tx_hash);

        let payload = ValidationPayload {
            tx_hash,
            signatures: vec![sig],
            signer_indices: vec![],
        };

        assert!(account.validate(&payload).is_ok(), "owner can always sign");
    }

    #[test]
    fn test_social_recovery_guardians_recover() {
        let owner = Dilithium3Keypair::generate();
        let guardians: Vec<Dilithium3Keypair> =
            (0..3).map(|_| Dilithium3Keypair::generate()).collect();
        let guardian_pubs: Vec<Dilithium3PublicKey> =
            guardians.iter().map(|g| g.public.clone()).collect();

        let account = AbstractAccount::new_social_recovery(
            owner.public.clone(),
            guardian_pubs,
            2,
        );

        let tx_hash = keccak512(b"recovery tx");
        let sig0 = guardians[0].sign(&tx_hash);
        let sig1 = guardians[1].sign(&tx_hash);

        let payload = ValidationPayload {
            tx_hash,
            signatures: vec![sig0, sig1],
            signer_indices: vec![],
        };

        assert!(account.validate(&payload).is_ok(), "2 guardians can recover");
    }

    #[test]
    fn test_address_is_deterministic() {
        let kp = Dilithium3Keypair::generate();
        let a1 = AbstractAccount::new_single_key(kp.public.clone());
        let a2 = AbstractAccount::new_single_key(kp.public.clone());
        assert_eq!(a1.address, a2.address, "same key → same address");
    }

    #[test]
    fn test_different_schemes_different_addresses() {
        let kp = Dilithium3Keypair::generate();
        let single = AbstractAccount::new_single_key(kp.public.clone());
        let multi = AbstractAccount::new_multisig(vec![kp.public.clone()], 1);
        assert_ne!(single.address, multi.address, "different schemes → different addresses");
    }

    #[test]
    fn test_nonce_increments() {
        let kp = Dilithium3Keypair::generate();
        let mut account = AbstractAccount::new_single_key(kp.public.clone());
        assert_eq!(account.nonce, 0);
        account.increment_nonce();
        assert_eq!(account.nonce, 1);
    }

    #[test]
    fn test_scheme_rotation() {
        let kp = Dilithium3Keypair::generate();
        let mut account = AbstractAccount::new_single_key(kp.public.clone());
        let original_address = account.address;

        account.rotate_scheme(ValidationScheme::MultiSig {
            pubkeys: vec![kp.public.clone()],
            threshold: 1,
        });

        assert_eq!(account.address, original_address);
    }
}
