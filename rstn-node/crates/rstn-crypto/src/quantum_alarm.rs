//! Quantum Alarm — Emergency key rotation
//!
//! If a catastrophic break of Dilithium3 is announced (e.g., a quantum
//! computer can forge signatures), the network can trigger an emergency
//! rotation to a fallback signature scheme (SPHINCS+).
//!
//! Design:
//!   - The alarm is an on-chain signal. Any validator can raise it by
//!     submitting a "quantum alarm transaction".
//!   - The alarm requires a supermajority (2/3+) of validators to confirm
//!     it within a short window. This prevents a single panic from
//!     triggering rotation.
//!   - Once confirmed, the network enters a "rotation epoch" where:
//!       1. Block production pauses for N blocks (cooldown).
//!       2. Each validator publishes a new SPHINCS+ public key.
//!       3. After the cooldown, blocks require BOTH Dilithium3 AND
//!          SPHINCS+ signatures (hybrid) until the next epoch boundary,
//!          where Dilithium3 is dropped entirely.
//!   - The alarm is logged on-chain and is auditable.

use crate::{
    Dilithium3Keypair, Dilithium3PublicKey, Dilithium3Signature,
    verify_signature, CryptoError,
};
use serde::{Deserialize, Serialize};

/// Alarm states.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuantumAlarmState {
    /// No alarm raised. Normal operation.
    Normal,
    /// Alarm raised, awaiting supermajority confirmation.
    Pending,
    /// Alarm confirmed by 2/3+ of validators. Rotation in progress.
    Rotating,
    /// Rotation complete. Network now uses the fallback scheme.
    Rotated,
}

/// A quantum alarm transaction.
///
/// Submitted by a validator to raise the alarm. Contains:
///   - The validator's public key (for authentication).
///   - The reason code (why the alarm was raised).
///   - A Dilithium3 signature over (pubkey || reason || timestamp).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QuantumAlarmTx {
    pub validator_pubkey: Dilithium3PublicKey,
    pub reason: QuantumAlarmReason,
    /// Block height at which the alarm was raised.
    pub height: u64,
    pub signature: Dilithium3Signature,
}

/// Why the alarm was raised.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuantumAlarmReason {
    /// A practical break of Dilithium3 was demonstrated.
    Dilithium3Broken,
    /// A large-scale quantum computer is operational.
    QuantumComputerOnline,
    /// A vulnerability in the signature aggregation was found.
    AggregationVulnerability,
}

impl QuantumAlarmReason {
    pub fn to_code(&self) -> u8 {
        match self {
            QuantumAlarmReason::Dilithium3Broken => 0,
            QuantumAlarmReason::QuantumComputerOnline => 1,
            QuantumAlarmReason::AggregationVulnerability => 2,
        }
    }
}

/// The on-chain quantum alarm state.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct QuantumAlarm {
    pub state: QuantumAlarmState,
    /// Validators who have confirmed the alarm (pubkey → signature).
    pub confirmations: Vec<(Dilithium3PublicKey, Dilithium3Signature)>,
    /// The height at which the alarm was raised.
    pub raised_at_height: Option<u64>,
    /// The reason for the alarm.
    pub reason: Option<QuantumAlarmReason>,
}

impl Default for QuantumAlarmState {
    fn default() -> Self {
        QuantumAlarmState::Normal
    }
}

impl QuantumAlarmTx {
    /// Sign a quantum alarm transaction.
    pub fn sign(
        keypair: &Dilithium3Keypair,
        reason: QuantumAlarmReason,
        height: u64,
    ) -> Self {
        let pubkey = keypair.public.clone();
        let mut msg = Vec::new();
        msg.extend_from_slice(&pubkey.0);
        msg.push(reason.to_code());
        msg.extend_from_slice(&height.to_le_bytes());
        let signature = keypair.sign(&msg);

        Self {
            validator_pubkey: pubkey,
            reason,
            height,
            signature,
        }
    }

    /// Verify the alarm transaction's signature.
    pub fn verify(&self) -> Result<(), CryptoError> {
        let mut msg = Vec::new();
        msg.extend_from_slice(&self.validator_pubkey.0);
        msg.push(self.reason.to_code());
        msg.extend_from_slice(&self.height.to_le_bytes());
        verify_signature(&self.validator_pubkey, &msg, &self.signature)
    }
}

impl QuantumAlarm {
    /// Raise the alarm (first validator to signal).
    pub fn raise(&mut self, tx: &QuantumAlarmTx) -> Result<(), CryptoError> {
        if self.state != QuantumAlarmState::Normal {
            return Err(CryptoError::InvalidSignature); // already raised
        }
        tx.verify()?;
        self.state = QuantumAlarmState::Pending;
        self.raised_at_height = Some(tx.height);
        self.reason = Some(tx.reason);
        self.confirmations
            .push((tx.validator_pubkey.clone(), tx.signature.clone()));
        Ok(())
    }

    /// Confirm the alarm (subsequent validators).
    pub fn confirm(
        &mut self,
        tx: &QuantumAlarmTx,
        total_validators: usize,
    ) -> Result<bool, CryptoError> {
        if self.state != QuantumAlarmState::Pending {
            return Err(CryptoError::InvalidSignature);
        }
        tx.verify()?;

        // Don't double-count the same validator.
        if self
            .confirmations
            .iter()
            .any(|(pk, _)| pk.0 == tx.validator_pubkey.0)
        {
            return Err(CryptoError::InvalidSignature);
        }

        self.confirmations
            .push((tx.validator_pubkey.clone(), tx.signature.clone()));

        // Check for supermajority (2/3+).
        let threshold = (total_validators * 2 / 3) + 1;
        if self.confirmations.len() >= threshold {
            self.state = QuantumAlarmState::Rotating;
            return Ok(true); // rotation triggered
        }
        Ok(false)
    }

    /// Complete the rotation.
    pub fn complete_rotation(&mut self) {
        if self.state == QuantumAlarmState::Rotating {
            self.state = QuantumAlarmState::Rotated;
        }
    }

    /// Is the alarm active (rotation in progress or complete)?
    pub fn is_active(&self) -> bool {
        matches!(
            self.state,
            QuantumAlarmState::Rotating | QuantumAlarmState::Rotated
        )
    }

    /// Reset the alarm (for testing).
    pub fn reset(&mut self) {
        self.state = QuantumAlarmState::Normal;
        self.confirmations.clear();
        self.raised_at_height = None;
        self.reason = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_alarm_raise_and_verify() {
        let kp = Dilithium3Keypair::generate();
        let tx = QuantumAlarmTx::sign(&kp, QuantumAlarmReason::Dilithium3Broken, 1000);
        assert!(tx.verify().is_ok());
    }

    #[test]
    fn test_alarm_rejects_tampered_reason() {
        let kp = Dilithium3Keypair::generate();
        let mut tx = QuantumAlarmTx::sign(&kp, QuantumAlarmReason::Dilithium3Broken, 1000);
        tx.reason = QuantumAlarmReason::QuantumComputerOnline;
        assert!(tx.verify().is_err(), "tampered reason must be rejected");
    }

    #[test]
    fn test_alarm_rejects_tampered_height() {
        let kp = Dilithium3Keypair::generate();
        let mut tx = QuantumAlarmTx::sign(&kp, QuantumAlarmReason::Dilithium3Broken, 1000);
        tx.height = 2000;
        assert!(tx.verify().is_err(), "tampered height must be rejected");
    }

    #[test]
    fn test_alarm_requires_supermajority() {
        let validators: Vec<Dilithium3Keypair> =
            (0..4).map(|_| Dilithium3Keypair::generate()).collect();
        let mut alarm = QuantumAlarm::default();

        // Validator 0 raises the alarm.
        let tx0 = QuantumAlarmTx::sign(
            &validators[0],
            QuantumAlarmReason::QuantumComputerOnline,
            500,
        );
        assert!(alarm.raise(&tx0).is_ok());
        assert_eq!(alarm.state, QuantumAlarmState::Pending);

        // Validator 1 confirms (2/4 = 50%, threshold = 3).
        let tx1 = QuantumAlarmTx::sign(
            &validators[1],
            QuantumAlarmReason::QuantumComputerOnline,
            500,
        );
        let triggered = alarm.confirm(&tx1, 4).unwrap();
        assert!(!triggered, "2 confirmations is not supermajority (need 3)");
        assert_eq!(alarm.state, QuantumAlarmState::Pending);

        // Validator 2 confirms (3/4 = 75%, threshold = 3) → triggered.
        let tx2 = QuantumAlarmTx::sign(
            &validators[2],
            QuantumAlarmReason::QuantumComputerOnline,
            500,
        );
        let triggered = alarm.confirm(&tx2, 4).unwrap();
        assert!(triggered, "3 confirmations is supermajority → rotation triggered");
        assert_eq!(alarm.state, QuantumAlarmState::Rotating);
    }

    #[test]
    fn test_alarm_rejects_double_confirmation() {
        let validators: Vec<Dilithium3Keypair> =
            (0..4).map(|_| Dilithium3Keypair::generate()).collect();
        let mut alarm = QuantumAlarm::default();

        let tx0 = QuantumAlarmTx::sign(
            &validators[0],
            QuantumAlarmReason::Dilithium3Broken,
            100,
        );
        alarm.raise(&tx0).unwrap();

        // Same validator tries to confirm again → rejected.
        let result = alarm.confirm(&tx0, 4);
        assert!(result.is_err(), "double confirmation must be rejected");
    }

    #[test]
    fn test_alarm_cannot_raise_twice() {
        let kp = Dilithium3Keypair::generate();
        let mut alarm = QuantumAlarm::default();
        let tx = QuantumAlarmTx::sign(&kp, QuantumAlarmReason::Dilithium3Broken, 1);
        alarm.raise(&tx).unwrap();

        // Second raise → rejected.
        let tx2 = QuantumAlarmTx::sign(&kp, QuantumAlarmReason::Dilithium3Broken, 2);
        assert!(alarm.raise(&tx2).is_err(), "cannot raise alarm twice");
    }

    #[test]
    fn test_alarm_completion() {
        let validators: Vec<Dilithium3Keypair> =
            (0..4).map(|_| Dilithium3Keypair::generate()).collect();
        let mut alarm = QuantumAlarm::default();

        for i in 0..3 {
            let tx = QuantumAlarmTx::sign(
                &validators[i],
                QuantumAlarmReason::AggregationVulnerability,
                100,
            );
            if i == 0 {
                alarm.raise(&tx).unwrap();
            } else {
                alarm.confirm(&tx, 4).ok();
            }
        }
        assert_eq!(alarm.state, QuantumAlarmState::Rotating);
        assert!(alarm.is_active());

        alarm.complete_rotation();
        assert_eq!(alarm.state, QuantumAlarmState::Rotated);
        assert!(alarm.is_active());
    }

    #[test]
    fn test_alarm_rejects_wrong_validator_signature() {
        let kp1 = Dilithium3Keypair::generate();
        let kp2 = Dilithium3Keypair::generate();
        let mut tx = QuantumAlarmTx::sign(&kp1, QuantumAlarmReason::Dilithium3Broken, 1);
        // Swap the pubkey to a different validator → signature won't match.
        tx.validator_pubkey = kp2.public.clone();
        assert!(tx.verify().is_err(), "mismatched pubkey must be rejected");
    }
}
