//! rstn-core -- Forward Security (epoch key rotation)
//!
//! Mitigates long-range attacks: an attacker who buys old validator private
//! keys (from validators that no longer participate) cannot use them to
//! build an alternative chain from genesis, because those keys were only
//! authorized to sign blocks during their own epoch.
//!
//! ## How it works
//!
//! Each validator rotates its signing key at every epoch boundary. The
//! validator generates a fresh Dilithium3 keypair for the next epoch,
//! commits to its public key (by publishing the key's hash) during the
//! current epoch, then reveals the key at rotation time. The on-chain
//! ledger records which public keys are authorized for which epochs.
//!
//! A node syncing from genesis verifies that every block was signed by a
//! key authorized for that block's epoch. An attacker holding a retired
//! epoch key cannot sign blocks for a later epoch — the key is simply not
//! in the authorized set for that epoch.
//!
//! ## Social checkpoints
//!
//! On top of forward security, the community publishes **signed
//! checkpoints** at regular intervals (e.g. every epoch). A new node can
//! pin a checkpoint as its trust anchor instead of trusting genesis
//! alone. Combined with forward security, this makes long-range attacks
//! require corrupting a live supermajority, not just buying dead keys.
//!
//! ## No admin key
//!
//! Key rotation is recorded on-chain by the validators themselves. No
//! party can prevent a validator from rotating, and no party can
//! authorize a retired key to sign future blocks.

use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;
use rstn_crypto::{
    keccak512, Dilithium3PublicKey, Dilithium3Signature,
    verify_signature, derive_address, format_address, PUBKEY_SIZE, SIG_SIZE,
};

use crate::{Validator, ValidatorStatus, CoreError};

/// A forward-secure commitment: the validator commits to the public key it
/// will use in the NEXT epoch, without revealing it (only its hash).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EpochCommitment {
    pub epoch: u64,
    /// Validator's CURRENT-epoch public key (the one authorized now).
    #[serde(with = "BigArray")]
    pub current_pubkey: [u8; PUBKEY_SIZE],
    /// Hash of the NEXT-epoch public key (revealed only at rotation).
    #[serde(with = "BigArray")]
    pub next_pubkey_hash: [u8; 64],
    /// Signature over (epoch || current_pubkey || next_pubkey_hash) by the
    /// current-epoch key, proving the validator authorized the rotation.
    #[serde(with = "BigArray")]
    pub signature: [u8; SIG_SIZE],
}

impl EpochCommitment {
    pub fn canonical_encode(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(8 + PUBKEY_SIZE + 64);
        buf.extend_from_slice(&self.epoch.to_le_bytes());
        buf.extend_from_slice(&self.current_pubkey);
        buf.extend_from_slice(&self.next_pubkey_hash);
        buf
    }

    /// Verify the commitment's signature against the current-epoch pubkey.
    pub fn verify(&self) -> Result<(), CoreError> {
        let pk = Dilithium3PublicKey(self.current_pubkey);
        let sig = Dilithium3Signature(self.signature);
        let msg = self.canonical_encode();
        verify_signature(&pk, &msg, &sig)
            .map_err(|_| CoreError::InvalidBlock(
                "epoch commitment signature invalid".into()
            ))
    }
}

/// The on-chain record of which public keys are authorized for which epochs.
/// A node syncing from genesis checks that every block's signer is in the
/// authorized set for that block's epoch.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ForwardSecurityLedger {
    /// Map: epoch -> set of authorized validator pubkeys for that epoch.
    pub authorized_keys: Vec<EpochKeySet>,
    /// Pending commitments: epoch -> committed next-pubkey hashes, by validator.
    pub pending_commitments: Vec<PendingCommitment>,
    /// The latest epoch for which keys have been revealed.
    pub latest_epoch: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EpochKeySet {
    pub epoch: u64,
    #[serde(with = "BigArray")]
    pub keys: Vec<[u8; PUBKEY_SIZE]>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PendingCommitment {
    pub epoch: u64,
    #[serde(with = "BigArray")]
    pub current_pubkey: [u8; PUBKEY_SIZE],
    #[serde(with = "BigArray")]
    pub next_pubkey_hash: [u8; 64],
}

impl ForwardSecurityLedger {
    pub fn new() -> Self {
        Self::default()
    }

    /// Seed the genesis epoch (epoch 0) with the initial validator set.
    pub fn seed_genesis(&mut self, validators: &[Validator]) {
        let keys: Vec<[u8; PUBKEY_SIZE]> = validators.iter()
            .map(|v| v.pubkey.0)
            .collect();
        self.authorized_keys.push(EpochKeySet { epoch: 0, keys });
        self.latest_epoch = 0;
    }

    /// Record a rotation commitment. The validator commits to next epoch's
    /// key hash. The current key must already be authorized for `epoch`.
    pub fn record_commitment(&mut self, com: EpochCommitment) -> Result<(), CoreError> {
        com.verify()?;
        let authorized = self.is_authorized(com.epoch, &com.current_pubkey);
        if !authorized {
            return Err(CoreError::Consensus(format!(
                "forward security: pubkey not authorized for epoch {}", com.epoch
            )));
        }
        // Stash the pending commitment (dedup by current_pubkey).
        if let Some(p) = self.pending_commitments.iter_mut()
            .find(|p| p.epoch == com.epoch && p.current_pubkey == com.current_pubkey)
        {
            p.next_pubkey_hash = com.next_pubkey_hash;
        } else {
            self.pending_commitments.push(PendingCommitment {
                epoch: com.epoch,
                current_pubkey: com.current_pubkey,
                next_pubkey_hash: com.next_pubkey_hash,
            });
        }
        Ok(())
    }

    /// Rotate a validator into the next epoch. The validator reveals the
    /// next-epoch public key; it must hash to the committed `next_pubkey_hash`.
    pub fn rotate(
        &mut self,
        from_epoch: u64,
        revealed_next_pubkey: [u8; PUBKEY_SIZE],
    ) -> Result<(), CoreError> {
        // Find the pending commitment for this validator at from_epoch.
        let pending_idx = self.pending_commitments.iter().position(|p| {
            p.epoch == from_epoch && keccak512(&revealed_next_pubkey) == p.next_pubkey_hash
        });
        let committed_hash = match pending_idx {
            Some(i) => self.pending_commitments[i].next_pubkey_hash,
            None => return Err(CoreError::Consensus(
                "forward security: no matching commitment for revealed next-epoch key".into()
            )),
        };
        // Verify the revealed key matches the committed hash.
        let computed = keccak512(&revealed_next_pubkey);
        if computed != committed_hash {
            return Err(CoreError::Consensus(
                "forward security: revealed next-epoch pubkey does not match committed hash".into()
            ));
        }
        // Remove the fulfilled commitment.
        self.pending_commitments.swap_remove(pending_idx.unwrap());

        let next_epoch = from_epoch + 1;
        if let Some(set) = self.authorized_keys.iter_mut().find(|s| s.epoch == next_epoch) {
            if !set.keys.contains(&revealed_next_pubkey) {
                set.keys.push(revealed_next_pubkey);
            }
        } else {
            self.authorized_keys.push(EpochKeySet {
                epoch: next_epoch,
                keys: vec![revealed_next_pubkey],
            });
        }
        if next_epoch > self.latest_epoch {
            self.latest_epoch = next_epoch;
        }
        Ok(())
    }

    /// Is a given public key authorized to sign blocks in `epoch`?
    pub fn is_authorized(&self, epoch: u64, pubkey: &[u8; PUBKEY_SIZE]) -> bool {
        self.authorized_keys.iter()
            .any(|s| s.epoch == epoch && s.keys.contains(pubkey))
    }

    /// Validate that a block signer was authorized for the block's epoch.
    /// Used by sync to reject long-range attacks.
    pub fn validate_block_signer(
        &self,
        epoch: u64,
        signer: &[u8; PUBKEY_SIZE],
    ) -> Result<(), CoreError> {
        if self.is_authorized(epoch, signer) {
            Ok(())
        } else {
            let addr = {
                let pk = Dilithium3PublicKey(*signer);
                let a = derive_address(&pk);
                format_address(&a)
            };
            Err(CoreError::Consensus(format!(
                "forward security: signer {} not authorized for epoch {} (long-range attack?)",
                addr, epoch
            )))
        }
    }
}

/// A signed checkpoint published by the community. New nodes pin a
/// checkpoint as a trust anchor instead of (or in addition to) genesis.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SocialCheckpoint {
    pub epoch: u64,
    pub height: u64,
    #[serde(with = "BigArray")]
    pub block_hash: [u8; 64],
    pub signatures: Vec<CheckpointSignature>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CheckpointSignature {
    #[serde(with = "BigArray")]
    pub signer: [u8; PUBKEY_SIZE],
    #[serde(with = "BigArray")]
    pub signature: [u8; SIG_SIZE],
}

impl SocialCheckpoint {
    pub fn canonical_encode(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(16 + 64);
        buf.extend_from_slice(&self.epoch.to_le_bytes());
        buf.extend_from_slice(&self.height.to_le_bytes());
        buf.extend_from_slice(&self.block_hash);
        buf
    }

    /// Verify the checkpoint against a validator set: at least 2/3+ of
    /// active validators must have co-signed.
    pub fn verify(&self, validators: &[Validator]) -> Result<(), CoreError> {
        let active: Vec<&Validator> = validators.iter()
            .filter(|v| v.status == ValidatorStatus::Active)
            .collect();
        if active.is_empty() {
            return Err(CoreError::Consensus("no active validators for checkpoint".into()));
        }
        let threshold = active.len() * 2 / 3 + 1;
        let msg = self.canonical_encode();
        let mut seen = std::collections::HashSet::new();
        for cs in &self.signatures {
            let is_active = active.iter().any(|v| v.pubkey.0 == cs.signer);
            if !is_active {
                continue;
            }
            let pk = Dilithium3PublicKey(cs.signer);
            let sig = Dilithium3Signature(cs.signature);
            if verify_signature(&pk, &msg, &sig).is_ok() {
                seen.insert(cs.signer);
            }
        }
        if seen.len() >= threshold {
            Ok(())
        } else {
            Err(CoreError::Consensus(format!(
                "checkpoint below supermajority: {} signers, need {}", seen.len(), threshold
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstn_crypto::Dilithium3Keypair;

    fn make_validators(n: usize) -> Vec<Dilithium3Keypair> {
        (0..n).map(|_| Dilithium3Keypair::generate()).collect()
    }

    fn to_validators(kps: &[Dilithium3Keypair]) -> Vec<Validator> {
        kps.iter().map(|kp| Validator {
            pubkey: kp.public.clone(),
            stake: 1_000_000,
            commission: 5,
            shard_id: 0,
            uptime: 1.0,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
        }).collect()
    }

    #[test]
    fn test_genesis_seeding_authorizes_initial_keys() {
        let kps = make_validators(4);
        let vals = to_validators(&kps);
        let mut ledger = ForwardSecurityLedger::new();
        ledger.seed_genesis(&vals);
        assert!(ledger.is_authorized(0, &kps[0].public.0));
        assert!(ledger.is_authorized(0, &kps[3].public.0));
    }

    #[test]
    fn test_unauthorized_signer_rejected() {
        let kps = make_validators(4);
        let vals = to_validators(&kps);
        let mut ledger = ForwardSecurityLedger::new();
        ledger.seed_genesis(&vals);

        let attacker = Dilithium3Keypair::generate();
        assert!(ledger.validate_block_signer(0, &attacker.public.0).is_err());
        assert!(ledger.validate_block_signer(0, &kps[0].public.0).is_ok());
    }

    #[test]
    fn test_rotation_authorizes_next_epoch_key() {
        let e0 = Dilithium3Keypair::generate();
        let e1 = Dilithium3Keypair::generate();

        let mut ledger = ForwardSecurityLedger::new();
        ledger.seed_genesis(&[Validator {
            pubkey: e0.public.clone(),
            stake: 1_000_000,
            commission: 5,
            shard_id: 0,
            uptime: 1.0,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
        }]);

        // Commit to next-epoch key hash.
        let next_hash = keccak512(&e1.public.0);
        let com_msg = {
            let mut buf = Vec::new();
            buf.extend_from_slice(&0u64.to_le_bytes());
            buf.extend_from_slice(&e0.public.0);
            buf.extend_from_slice(&next_hash);
            buf
        };
        let com = EpochCommitment {
            epoch: 0,
            current_pubkey: e0.public.0,
            next_pubkey_hash: next_hash,
            signature: e0.sign(&com_msg).0,
        };
        assert!(ledger.record_commitment(com).is_ok());

        // Reveal + rotate.
        assert!(ledger.rotate(0, e1.public.0).is_ok());
        // e1 key is now authorized for epoch 1.
        assert!(ledger.is_authorized(1, &e1.public.0));
        // e0 key is NOT authorized for epoch 1 (long-range protection).
        assert!(!ledger.is_authorized(1, &e0.public.0));
    }

    #[test]
    fn test_rotation_rejects_wrong_revealed_key() {
        let e0 = Dilithium3Keypair::generate();
        let e1 = Dilithium3Keypair::generate();
        let decoy = Dilithium3Keypair::generate();

        let mut ledger = ForwardSecurityLedger::new();
        ledger.seed_genesis(&[Validator {
            pubkey: e0.public.clone(),
            stake: 1_000_000,
            commission: 5,
            shard_id: 0,
            uptime: 1.0,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
        }]);

        let next_hash = keccak512(&e1.public.0);
        let com_msg = {
            let mut buf = Vec::new();
            buf.extend_from_slice(&0u64.to_le_bytes());
            buf.extend_from_slice(&e0.public.0);
            buf.extend_from_slice(&next_hash);
            buf
        };
        let com = EpochCommitment {
            epoch: 0,
            current_pubkey: e0.public.0,
            next_pubkey_hash: next_hash,
            signature: e0.sign(&com_msg).0,
        };
        assert!(ledger.record_commitment(com).is_ok());

        // Try to rotate with the WRONG revealed key (decoy).
        assert!(ledger.rotate(0, decoy.public.0).is_err(),
            "revealed key must match committed hash");
    }

    #[test]
    fn test_rotation_rejects_uncommitted_key() {
        let e0 = Dilithium3Keypair::generate();
        let e1 = Dilithium3Keypair::generate();

        let mut ledger = ForwardSecurityLedger::new();
        ledger.seed_genesis(&[Validator {
            pubkey: e0.public.clone(),
            stake: 1_000_000,
            commission: 5,
            shard_id: 0,
            uptime: 1.0,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
        }]);
        // No commitment recorded → rotate must fail.
        assert!(ledger.rotate(0, e1.public.0).is_err());
    }

    #[test]
    fn test_social_checkpoint_supermajority() {
        let kps = make_validators(4);
        let vals = to_validators(&kps);

        let mut cp = SocialCheckpoint {
            epoch: 5,
            height: 5000,
            block_hash: [7u8; 64],
            signatures: vec![],
        };
        let msg = cp.canonical_encode();
        // 3 of 4 = supermajority (threshold = 3).
        for i in 0..3 {
            cp.signatures.push(CheckpointSignature {
                signer: kps[i].public.0,
                signature: kps[i].sign(&msg).0,
            });
        }
        assert!(cp.verify(&vals).is_ok());

        // Only 2 of 4 = below threshold.
        cp.signatures.pop();
        assert!(cp.verify(&vals).is_err());
    }

    #[test]
    fn test_commitment_rejects_unauthorized_current_key() {
        let e0 = Dilithium3Keypair::generate();
        let stranger = Dilithium3Keypair::generate();

        let mut ledger = ForwardSecurityLedger::new();
        ledger.seed_genesis(&[Validator {
            pubkey: e0.public.clone(),
            stake: 1_000_000,
            commission: 5,
            shard_id: 0,
            uptime: 1.0,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
        }]);

        // stranger is NOT authorized for epoch 0 → commitment must fail.
        let next_hash = keccak512(&e0.public.0);
        let com_msg = {
            let mut buf = Vec::new();
            buf.extend_from_slice(&0u64.to_le_bytes());
            buf.extend_from_slice(&stranger.public.0);
            buf.extend_from_slice(&next_hash);
            buf
        };
        let com = EpochCommitment {
            epoch: 0,
            current_pubkey: stranger.public.0,
            next_pubkey_hash: next_hash,
            signature: stranger.sign(&com_msg).0,
        };
        assert!(ledger.record_commitment(com).is_err());
    }
}
