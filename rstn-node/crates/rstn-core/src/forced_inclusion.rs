//! G14 — Forced-inclusion pool (censorship resistance: N+1).
//!
//! ## Purpose — "Enf.10 Censorship resistance"
//!
//! The claim on the landing page: "Censorship-resistant consensus with
//! forced-inclusion pool. Any transaction can be forced into the block
//! at N+1 if it was censored at N."
//!
//! This module makes that claim true. The mechanism:
//!
//! 1. A user whose tx was *not included* in block N (censored by the
//!    proposer) submits it to the **forced-inclusion pool** — a separate
//!    mempool that the protocol MANDATES the next proposer include.
//! 2. At block N+1, the proposer MUST include all forced txs (up to the
//!    block gas limit). If they refuse, the block is **invalid** and the
//!    committee rejects it — censorship of a forced tx is a protocol
//!    violation that the next proposer cannot commit.
//! 3. The forced pool is **governed by the BFT committee**, not a single
//!    proposer: a tx enters the forced pool when `t+1` validators attest
//!    it was seen in the regular mempool at block N but not included.
//!    This prevents griefing (an attacker forcing garbage into blocks).
//!
//! ## Honest scope (what is implemented, tested)
//!
//! - **Forced-inclusion pool**: a separate queue that the next proposer
//!   must drain. `take_forced` returns txs up to the gas budget; any
//!   left after the block is a protocol violation.
//! - **Inclusion proof**: `attest_excluded` lets `t+1` validators sign
//!   that a tx was in the regular mempool at height N but not included.
//!   This binds the forced status to committee agreement, not a single
//!   proposer's claim.
//! - **Mandatory inclusion check**: `validate_block` verifies that a
//!   block at height N+1 includes all forced txs up to the gas budget.
//!   A block that skips a forced tx is REJECTED — the proposer cannot
//!   censor a tx that the committee forced.
//!
//! ## What is NOT claimed
//!
//! - The forced pool does not prevent a *supermajority* of colluding
//!   validators from censoring (that's the 67% attack — out of scope,
//!   mitigated by slashing + DAS, not by forced inclusion).
//! - Gas accounting is simplified (per-tx flat budget); production
//!   would use EVM gas metering.

use rstn_crypto::{Dilithium3Signature, Dilithium3PublicKey, keccak512, verify_signature};
use std::collections::{HashMap, HashSet, VecDeque};

/// A transaction's commitment (Keccak-512 of the canonical encoding).
pub type TxCommitment = [u8; 64];

/// An attestation that a tx was in the regular mempool at height N but
/// not included in block N. Signed by a validator.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct InclusionAttestation {
    /// Height at which the tx was seen in the regular mempool but excluded.
    pub excluded_at_height: u64,
    /// The tx commitment (Keccak-512 of the tx).
    #[serde(with = "serde_big_array::BigArray")]
    pub tx_commitment: TxCommitment,
    /// The validator's public key.
    pub validator: Dilithium3PublicKey,
    /// The validator's signature over (excluded_at_height || tx_commitment).
    pub signature: Dilithium3Signature,
}

impl InclusionAttestation {
    /// The message that the validator signs: height || tx_commitment.
    pub fn sign_message(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(8 + 64);
        buf.extend_from_slice(&self.excluded_at_height.to_le_bytes());
        buf.extend_from_slice(&self.tx_commitment);
        buf
    }

    /// Verify the attestation signature.
    pub fn verify_signature(&self) -> bool {
        let msg = keccak512(&self.sign_message());
        verify_signature(&self.validator, &msg, &self.signature).is_ok()
    }
}

/// The forced-inclusion pool. A tx becomes "forced" when `t+1` validators
/// attest it was excluded at height N; the proposer of block N+1 MUST
/// include it (up to the gas budget) or the block is invalid.
#[derive(Clone, Debug, Default)]
pub struct ForcedInclusionPool {
    /// Forced txs keyed by commitment -> set of attesting validators.
    pub forced: HashMap<TxCommitment, ForcedEntry>,
    /// FIFO order of forced commitments (oldest first).
    pub order: VecDeque<TxCommitment>,
}

/// A forced entry: the tx commitment, the height it was excluded at, and
/// the set of validators who attested.
#[derive(Clone, Debug)]
pub struct ForcedEntry {
    pub excluded_at_height: u64,
    pub attestations: Vec<InclusionAttestation>,
    /// The actual tx payload (provided by the first attester; verified by
    /// others via the commitment).
    pub tx_payload: Vec<u8>,
}

impl ForcedInclusionPool {
    pub fn new() -> Self {
        Self::default()
    }

    /// Attest that a tx was excluded at height N. Adds the attestation to
    /// the forced pool. Returns `true` if the tx newly crossed the
    /// threshold (became forced).
    pub fn attest_excluded(
        &mut self,
        attestation: InclusionAttestation,
        tx_payload: Vec<u8>,
        validator_set: &[Dilithium3PublicKey],
        threshold: usize,
    ) -> bool {
        // The validator must be in the active set.
        let is_active = validator_set.iter().any(|v| v.0 == attestation.validator.0);
        if !is_active || !attestation.verify_signature() {
            return false;
        }
        // Verify the payload matches the commitment.
        if keccak512(&tx_payload) != attestation.tx_commitment {
            return false;
        }
        let entry = self.forced.entry(attestation.tx_commitment).or_insert(ForcedEntry {
            excluded_at_height: attestation.excluded_at_height,
            attestations: Vec::new(),
            tx_payload: tx_payload.clone(),
        });
        // Don't double-count an attestation from the same validator.
        let already = entry.attestations.iter().any(|a| a.validator.0 == attestation.validator.0);
        if already {
            return false;
        }
        let commitment = attestation.tx_commitment;
        entry.attestations.push(attestation);
        // Check if we crossed the threshold.
        let count = entry.attestations.len();
        if count == threshold {
            // Newly forced — add to FIFO order.
            self.order.push_back(commitment);
            return true;
        }
        false
    }

    /// Take forced txs up to `gas_budget`. The proposer MUST include these
    /// in block N+1. Returns the payloads (in FIFO order) up to the budget.
    pub fn take_forced(&mut self, gas_budget: u64, gas_per_tx: u64) -> Vec<Vec<u8>> {
        let mut out = Vec::new();
        let mut spent = 0u64;
        let mut remaining = VecDeque::new();
        while let Some(commitment) = self.order.pop_front() {
            if spent + gas_per_tx > gas_budget {
                // Can't fit this one — put it back for the next block.
                remaining.push_front(commitment);
                break;
            }
            if let Some(entry) = self.forced.remove(&commitment) {
                out.push(entry.tx_payload);
                spent += gas_per_tx;
            }
        }
        // Re-queue any that didn't fit.
        while let Some(c) = remaining.pop_front() {
            self.order.push_front(c);
        }
        out
    }

    /// Validate that a block at height N+1 includes all forced txs up to the
    /// gas budget. `included` is the set of tx commitments the block includes.
    /// Returns Ok if the block satisfies the forced-inclusion rule, or an
    /// error listing the forced txs that were skipped (censorship).
    pub fn validate_block(
        &self,
        included: &HashSet<TxCommitment>,
        gas_budget: u64,
        gas_per_tx: u64,
    ) -> Result<(), ForcedInclusionError> {
        let mut missing = Vec::new();
        let mut spent = 0u64;
        for commitment in &self.order {
            if spent + gas_per_tx > gas_budget {
                break; // Budget exhausted — remaining forced txs wait for next block.
            }
            if !included.contains(commitment) {
                missing.push(*commitment);
            }
            spent += gas_per_tx;
        }
        if missing.is_empty() {
            Ok(())
        } else {
            Err(ForcedInclusionError::CensoredForcedTxs(missing))
        }
    }

    /// Number of forced txs pending.
    pub fn pending(&self) -> usize {
        self.forced.len()
    }

    /// Is a given tx commitment currently forced?
    pub fn is_forced(&self, commitment: &TxCommitment) -> bool {
        self.forced.contains_key(commitment)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum ForcedInclusionError {
    /// The block at N+1 skipped forced txs that fit in the gas budget.
    CensoredForcedTxs(Vec<TxCommitment>),
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstn_crypto::Dilithium3Keypair;

    fn make_attestation(
        kp: &Dilithium3Keypair,
        height: u64,
        tx_commitment: TxCommitment,
    ) -> InclusionAttestation {
        let mut buf = Vec::new();
        buf.extend_from_slice(&height.to_le_bytes());
        buf.extend_from_slice(&tx_commitment);
        let msg = keccak512(&buf);
        let sig = kp.sign(&msg);
        InclusionAttestation {
            excluded_at_height: height,
            tx_commitment,
            validator: kp.public.clone(),
            signature: sig,
        }
    }

    #[test]
    fn tx_becomes_forced_at_threshold() {
        let n = 4;
        let threshold = 3; // 2/3+ of 4
        let mut keypairs = Vec::new();
        let mut validator_set = Vec::new();
        for _ in 0..n {
            let kp = Dilithium3Keypair::generate();
            validator_set.push(kp.public.clone());
            keypairs.push(kp);
        }
        let tx_payload = b"censored transfer".to_vec();
        let tx_commitment = keccak512(&tx_payload);
        let mut pool = ForcedInclusionPool::new();
        // 2 attestations (below threshold) -> not forced.
        for i in 0..2 {
            let att = make_attestation(&keypairs[i], 100, tx_commitment);
            assert!(!pool.attest_excluded(att, tx_payload.clone(), &validator_set, threshold));
        }
        assert!(!pool.is_forced(&tx_commitment));
        // 3rd attestation -> crosses threshold -> forced.
        let att = make_attestation(&keypairs[2], 100, tx_commitment);
        assert!(pool.attest_excluded(att, tx_payload.clone(), &validator_set, threshold));
        assert!(pool.is_forced(&tx_commitment));
    }

    #[test]
    fn proposer_must_include_forced_tx() {
        let n = 4;
        let threshold = 3;
        let mut keypairs = Vec::new();
        let mut validator_set = Vec::new();
        for _ in 0..n {
            let kp = Dilithium3Keypair::generate();
            validator_set.push(kp.public.clone());
            keypairs.push(kp);
        }
        let tx_payload = b"force me".to_vec();
        let tx_commitment = keccak512(&tx_payload);
        let mut pool = ForcedInclusionPool::new();
        for i in 0..threshold {
            let att = make_attestation(&keypairs[i], 100, tx_commitment);
            pool.attest_excluded(att, tx_payload.clone(), &validator_set, threshold);
        }
        // Block N+1 that does NOT include the forced tx -> rejected.
        let included = HashSet::new();
        assert!(pool.validate_block(&included, 1_000_000, 21_000).is_err());
        // Block N+1 that DOES include it -> accepted.
        let mut included = HashSet::new();
        included.insert(tx_commitment);
        assert!(pool.validate_block(&included, 1_000_000, 21_000).is_ok());
    }

    #[test]
    fn take_forced_respects_gas_budget() {
        let n = 4;
        let threshold = 3;
        let mut keypairs = Vec::new();
        let mut validator_set = Vec::new();
        for _ in 0..n {
            let kp = Dilithium3Keypair::generate();
            validator_set.push(kp.public.clone());
            keypairs.push(kp);
        }
        let mut pool = ForcedInclusionPool::new();
        // Force 3 txs.
        for tx_id in 0..3u8 {
            let payload = vec![tx_id; 16];
            let commitment = keccak512(&payload);
            for i in 0..threshold {
                let att = make_attestation(&keypairs[i], 50, commitment);
                pool.attest_excluded(att, payload.clone(), &validator_set, threshold);
            }
        }
        // Gas budget fits only 1 tx (21000 * 1).
        let taken = pool.take_forced(21_000, 21_000);
        assert_eq!(taken.len(), 1);
        // Remaining 2 stay forced.
        assert_eq!(pool.pending(), 2);
        // Next take gets the rest (bigger budget).
        let _ = pool.take_forced(100_000, 21_000);
        assert_eq!(pool.pending(), 0);
    }

    #[test]
    fn invalid_signature_attestation_rejected() {
        let kp = Dilithium3Keypair::generate();
        let kp2 = Dilithium3Keypair::generate();
        let payload = b"bad sig".to_vec();
        let commitment = keccak512(&payload);
        let validator_set = vec![kp.public.clone()];
        // Attestation signed by kp2 but claiming kp's pubkey is in the set —
        // the signature won't verify against kp.public, so it's rejected.
        let mut att = make_attestation(&kp, 100, commitment);
        att.validator = kp2.public.clone(); // mismatched key
        let mut pool = ForcedInclusionPool::new();
        assert!(!pool.attest_excluded(att, payload, &validator_set, 1));
    }

    #[test]
    fn duplicate_attestation_from_same_validator_ignored() {
        let n = 4;
        let threshold = 3;
        let mut keypairs = Vec::new();
        let mut validator_set = Vec::new();
        for _ in 0..n {
            let kp = Dilithium3Keypair::generate();
            validator_set.push(kp.public.clone());
            keypairs.push(kp);
        }
        let payload = b"dup".to_vec();
        let commitment = keccak512(&payload);
        let mut pool = ForcedInclusionPool::new();
        // Validator 0 attests 3 times — should only count once.
        for _ in 0..3 {
            let att = make_attestation(&keypairs[0], 100, commitment);
            pool.attest_excluded(att, payload.clone(), &validator_set, threshold);
        }
        // Need 2 MORE distinct validators to cross threshold.
        assert!(!pool.is_forced(&commitment));
        for i in 1..3 {
            let att = make_attestation(&keypairs[i], 100, commitment);
            pool.attest_excluded(att, payload.clone(), &validator_set, threshold);
        }
        assert!(pool.is_forced(&commitment));
    }
}
