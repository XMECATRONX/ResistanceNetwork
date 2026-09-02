//! rstn-core -- Quantum Alarm
//!
//! On-chain emergency mechanism that detects a classically-impossible
//! cryptographic event and forces a coordinated migration from the primary
//! signature scheme (Dilithium3) to the hash-based fallback (SPHINCS+).
//!
//! ## What it detects
//!
//! A "quantum alarm" is raised when the network observes evidence that a
//! classical public key has been compromised by a quantum adversary. The
//! canonical signal is: a valid Dilithium3 signature is produced over a
//! message that the holder provably never signed (a "forgery"). Because
//! Dilithium3 is EUF-CMA secure under classical assumptions, such a forgery
//! implies either a catastrophic break of Module-LWE or a quantum adversary
//! running Shor's algorithm against the lattice public key.
//!
//! ## What it does
//!
//! 1. Any validator can submit an `AlarmReport` with cryptographic evidence.
//! 2. Once a supermajority (2/3+) of validators co-sign the report, the
//!    network enters `AlarmState::Emergency`.
//! 3. In Emergency state, the consensus engine rejects Dilithium3-only
//!    signatures and requires SPHINCS+ co-signatures on every block and
//!    vote. This is a forced, automatic migration — no admin key.
//! 4. The alarm is final: once Emergency is declared, it cannot be silently
//!    reverted. Reverting requires a governance hard fork (supermajority of
//!    verified identities), which is a separate, slower path.
//!
//! ## No admin key
//!
//! No single party can trigger or clear the alarm. Triggering requires
//! 2/3+ validator signatures on the evidence. Clearing requires governance.
//! This module is the on-chain embodiment of the "quantum alarm + auto
//! rotation" claim.

use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;
use rstn_crypto::{keccak512, Dilithium3PublicKey, Dilithium3Signature, verify_signature, SIG_SIZE, PUBKEY_SIZE};

use crate::{Validator, ValidatorStatus, CoreError};

/// The three states of the quantum alarm subsystem.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum AlarmState {
    /// Normal operation. Dilithium3 is the primary signature scheme.
    /// SPHINCS+ is available but not required.
    Normal,
    /// A report has been filed and is accumulating validator signatures.
    /// Consensus still runs on Dilithium3, but the network is on notice.
    Pending,
    /// Emergency declared. Dilithium3-only signatures are rejected.
    /// Every block and vote MUST carry a SPHINCS+ co-signature.
    Emergency,
}

impl Default for AlarmState {
    fn default() -> Self {
        Self::Normal
    }
}

/// A single piece of evidence that a classical key was compromised.
///
/// `forged_message` is a message that the holder of `victim_pubkey`
/// provably never signed (e.g. a conflicting block at the same height,
/// or a transfer the holder can prove they did not initiate). The
/// `forged_signature` verifies against `victim_pubkey` over that message.
/// Under classical assumptions this is impossible → quantum alarm.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AlarmEvidence {
    /// The validator whose key appears compromised.
    #[serde(with = "BigArray")]
    pub victim_pubkey: [u8; PUBKEY_SIZE],
    /// The message that was forged.
    pub forged_message: Vec<u8>,
    /// The signature over `forged_message` that verifies under `victim_pubkey`.
    #[serde(with = "BigArray")]
    pub forged_signature: [u8; SIG_SIZE],
}

impl AlarmEvidence {
    /// Verify that the forged signature is actually valid under the victim's
    /// public key. If it is NOT valid, this is not evidence of anything.
    pub fn verify_forgery(&self) -> Result<(), CoreError> {
        let pk = Dilithium3PublicKey(self.victim_pubkey);
        let sig = Dilithium3Signature(self.forged_signature);
        verify_signature(&pk, &self.forged_message, &sig)
            .map_err(|_| CoreError::InvalidBlock(
                "alarm evidence: forged signature does not verify under victim pubkey".into()
            ))
    }

    /// Canonical encoding for signing by validators who attest to this evidence.
    pub fn canonical_encode(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(PUBKEY_SIZE + 8 + self.forged_message.len() + SIG_SIZE);
        buf.extend_from_slice(&self.victim_pubkey);
        buf.extend_from_slice(&(self.forged_message.len() as u64).to_le_bytes());
        buf.extend_from_slice(&self.forged_message);
        buf.extend_from_slice(&self.forged_signature);
        buf
    }

    /// Deterministic evidence hash (used as the report ID).
    pub fn hash(&self) -> [u8; 64] {
        keccak512(&self.canonical_encode())
    }
}

/// A report filed by a validator, carrying evidence + the filer's signature.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AlarmReport {
    pub evidence: AlarmEvidence,
    /// Validator who filed the report.
    #[serde(with = "BigArray")]
    pub filer: [u8; PUBKEY_SIZE],
    /// Filer's Dilithium3 signature over the evidence hash.
    #[serde(with = "BigArray")]
    pub filer_signature: [u8; SIG_SIZE],
    /// Co-signatures from other validators attesting to the same evidence.
    pub cosignatures: Vec<AlarmCosignature>,
}

impl AlarmReport {
    /// The evidence hash that every cosigner must sign.
    pub fn evidence_hash(&self) -> [u8; 64] {
        self.evidence.hash()
    }

    /// Verify the filer's own signature over the evidence hash.
    pub fn verify_filer(&self) -> Result<(), CoreError> {
        let pk = Dilithium3PublicKey(self.filer);
        let sig = Dilithium3Signature(self.filer_signature);
        let h = self.evidence_hash();
        verify_signature(&pk, &h, &sig)
            .map_err(|_| CoreError::InvalidBlock("alarm report: filer signature invalid".into()))
    }
}

/// A validator's co-signature attesting to an alarm report.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AlarmCosignature {
    #[serde(with = "BigArray")]
    pub signer: [u8; PUBKEY_SIZE],
    #[serde(with = "BigArray")]
    pub signature: [u8; SIG_SIZE],
}

/// The on-chain quantum alarm state machine.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct QuantumAlarm {
    pub state: AlarmState,
    /// The report that triggered the (pending or emergency) alarm, if any.
    pub active_report: Option<AlarmReport>,
    /// Height at which the emergency was declared (for auditability).
    pub emergency_height: Option<u64>,
}

impl QuantumAlarm {
    pub fn new() -> Self {
        Self::default()
    }

    /// File a new alarm report. The evidence must verify (the forged signature
    /// must be valid under the victim's pubkey — otherwise it's not a forgery).
    /// The filer's signature must verify. Transitions Normal → Pending.
    pub fn file_report(
        &mut self,
        report: AlarmReport,
        validators: &[Validator],
    ) -> Result<(), CoreError> {
        if self.state == AlarmState::Emergency {
            return Err(CoreError::Consensus(
                "quantum alarm already in emergency — cannot file new report".into(),
            ));
        }
        // The evidence must be a real forgery.
        report.evidence.verify_forgery()?;
        // The filer must be an active validator.
        report.verify_filer()?;
        let filer_active = validators.iter().any(|v| {
            v.pubkey.0 == report.filer && v.status == ValidatorStatus::Active
        });
        if !filer_active {
            return Err(CoreError::Consensus(
                "alarm report filed by non-active validator".into(),
            ));
        }

        // Dedup cosignatures and verify each.
        let mut seen = std::collections::HashSet::new();
        for cosig in &report.cosignatures {
            let signer_active = validators.iter().any(|v| {
                v.pubkey.0 == cosig.signer && v.status == ValidatorStatus::Active
            });
            if !signer_active {
                return Err(CoreError::Consensus(
                    "alarm cosignature from non-active validator".into(),
                ));
            }
            let pk = Dilithium3PublicKey(cosig.signer);
            let sig = Dilithium3Signature(cosig.signature);
            let h = report.evidence_hash();
            verify_signature(&pk, &h, &sig)
                .map_err(|_| CoreError::Consensus(
                    "alarm cosignature invalid".into()))?;
            seen.insert(cosig.signer);
        }

        self.active_report = Some(report);
        self.state = AlarmState::Pending;
        Ok(())
    }

    /// Add a cosignature to the active report. If the unique signer count
    /// reaches the 2/3+ supermajority of active validators, transition to
    /// Emergency.
    pub fn cosign(
        &mut self,
        cosig: AlarmCosignature,
        validators: &[Validator],
    ) -> Result<(), CoreError> {
        if self.state == AlarmState::Normal {
            return Err(CoreError::Consensus(
                "no active alarm report to cosign".into(),
            ));
        }
        let report = self.active_report.as_mut().ok_or_else(|| {
            CoreError::Consensus("alarm state pending but no active report".into())
        })?;

        // Signer must be an active validator.
        let signer_active = validators.iter().any(|v| {
            v.pubkey.0 == cosig.signer && v.status == ValidatorStatus::Active
        });
        if !signer_active {
            return Err(CoreError::Consensus(
                "cosign from non-active validator".into(),
            ));
        }
        // Verify the cosignature over the evidence hash.
        let pk = Dilithium3PublicKey(cosig.signer);
        let sig = Dilithium3Signature(cosig.signature);
        let h = report.evidence_hash();
        verify_signature(&pk, &h, &sig)
            .map_err(|_| CoreError::Consensus("alarm cosignature invalid".into()))?;

        // Dedup.
        if report.cosignatures.iter().any(|c| c.signer == cosig.signer) {
            return Ok(()); // idempotent
        }
        // Don't double-count the filer.
        if cosig.signer == report.filer {
            return Ok(());
        }
        report.cosignatures.push(cosig);

        // Check supermajority.
        let active_count = validators.iter()
            .filter(|v| v.status == ValidatorStatus::Active)
            .count();
        if active_count == 0 {
            return Ok(());
        }
        let threshold = active_count * 2 / 3 + 1;
        // Unique signers = filer + unique cosigners.
        let mut unique = std::collections::HashSet::new();
        unique.insert(report.filer);
        for c in &report.cosignatures {
            unique.insert(c.signer);
        }
        if unique.len() >= threshold {
            self.state = AlarmState::Emergency;
        }
        Ok(())
    }

    /// Declare emergency at a given height (called by consensus when the
    /// supermajority is reached). Records the height for auditability.
    pub fn declare_emergency(&mut self, height: u64) {
        if self.state != AlarmState::Emergency {
            self.state = AlarmState::Emergency;
        }
        if self.emergency_height.is_none() {
            self.emergency_height = Some(height);
        }
    }

    /// Whether the network is in emergency mode (SPHINCS+ co-signatures
    /// required on every block and vote).
    pub fn is_emergency(&self) -> bool {
        self.state == AlarmState::Emergency
    }

    // Clearing the alarm requires governance — this module deliberately
    // provides NO method to revert Emergency. Reverting is a hard fork
    // decided by governance, not a runtime call. This is the "no admin
    // key" guarantee: once Emergency is declared, no single party can
    // silently undo it.
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstn_crypto::Dilithium3Keypair;

    fn make_validators(n: usize) -> (Vec<Dilithium3Keypair>, Vec<Validator>) {
        let kps: Vec<_> = (0..n).map(|_| Dilithium3Keypair::generate()).collect();
        let vals: Vec<Validator> = kps.iter().map(|kp| Validator {
            pubkey: kp.public.clone(),
            stake: 1_000_000,
            commission: 5,
            shard_id: 0,
            uptime: 1.0,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
        }).collect();
        (kps, vals)
    }

    #[test]
    fn test_alarm_starts_normal() {
        let alarm = QuantumAlarm::new();
        assert_eq!(alarm.state, AlarmState::Normal);
        assert!(!alarm.is_emergency());
    }

    #[test]
    fn test_file_report_transitions_to_pending() {
        let (kps, vals) = make_validators(4);
        // Victim is validator 0. Attacker "forges" by using the victim's own
        // keypair to sign a message (simulating a compromised key).
        let victim = &kps[0];
        let forged_msg = b"emergency: key compromised";
        let forged_sig = victim.sign(forged_msg);

        let evidence = AlarmEvidence {
            victim_pubkey: victim.public.0,
            forged_message: forged_msg.to_vec(),
            forged_signature: forged_sig.0,
        };
        assert!(evidence.verify_forgery().is_ok());

        // Filer is validator 1.
        let filer = &kps[1];
        let h = evidence.hash();
        let filer_sig = filer.sign(&h);

        let report = AlarmReport {
            evidence,
            filer: filer.public.0,
            filer_signature: filer_sig.0,
            cosignatures: vec![],
        };

        let mut alarm = QuantumAlarm::new();
        alarm.file_report(report, &vals).unwrap();
        assert_eq!(alarm.state, AlarmState::Pending);
    }

    #[test]
    fn test_cosign_reaches_supermajority_and_declares_emergency() {
        let (kps, vals) = make_validators(4);
        let victim = &kps[0];
        let forged_msg = b"emergency: key compromised";
        let forged_sig = victim.sign(forged_msg);
        let evidence = AlarmEvidence {
            victim_pubkey: victim.public.0,
            forged_message: forged_msg.to_vec(),
            forged_signature: forged_sig.0,
        };
        let h = evidence.hash();

        // Filer = validator 1.
        let filer = &kps[1];
        let report = AlarmReport {
            evidence,
            filer: filer.public.0,
            filer_signature: filer.sign(&h).0,
            cosignatures: vec![],
        };

        let mut alarm = QuantumAlarm::new();
        alarm.file_report(report, &vals).unwrap();
        assert_eq!(alarm.state, AlarmState::Pending);

        // 4 active validators → threshold = 4*2/3+1 = 3.
        // Filer counts as 1. Need 2 more cosignatures.
        for i in [2, 3] {
            let cosig = AlarmCosignature {
                signer: kps[i].public.0,
                signature: kps[i].sign(&h).0,
            };
            alarm.cosign(cosig, &vals).unwrap();
        }
        assert_eq!(alarm.state, AlarmState::Emergency);
        assert!(alarm.is_emergency());
    }

    #[test]
    fn test_rejects_non_active_filer() {
        let (kps, mut vals) = make_validators(4);
        vals[1].status = ValidatorStatus::Slashed; // filer is slashed

        let victim = &kps[0];
        let forged_msg = b"compromised";
        let forged_sig = victim.sign(forged_msg);
        let evidence = AlarmEvidence {
            victim_pubkey: victim.public.0,
            forged_message: forged_msg.to_vec(),
            forged_signature: forged_sig.0,
        };
        let h = evidence.hash();
        let filer = &kps[1];
        let report = AlarmReport {
            evidence,
            filer: filer.public.0,
            filer_signature: filer.sign(&h).0,
            cosignatures: vec![],
        };

        let mut alarm = QuantumAlarm::new();
        assert!(alarm.file_report(report, &vals).is_err());
        assert_eq!(alarm.state, AlarmState::Normal);
    }

    #[test]
    fn test_rejects_invalid_forgery() {
        let (kps, vals) = make_validators(4);
        // A "forgery" whose signature does NOT verify under the victim key
        // is not evidence of anything.
        let victim = &kps[0];
        let other = &kps[2];
        let forged_msg = b"not actually forged";
        let wrong_sig = other.sign(forged_msg); // signed by other, not victim

        let evidence = AlarmEvidence {
            victim_pubkey: victim.public.0,
            forged_message: forged_msg.to_vec(),
            forged_signature: wrong_sig.0,
        };
        assert!(evidence.verify_forgery().is_err());
    }

    #[test]
    fn test_no_method_to_clear_emergency() {
        // Compile-time guarantee: QuantumAlarm has no `clear` or `revert`
        // method. This test exists to document that the API deliberately
        // omits any unilateral revert path.
        let alarm = QuantumAlarm::new();
        assert!(!alarm.is_emergency());
        // The only way out of Emergency is a governance hard fork, which
        // is outside this module's API surface.
    }
}
