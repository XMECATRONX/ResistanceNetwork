//! Public multisig with independent (non-team) signers.
//!
//! The bridge vault and critical governance operations require M-of-N
//! signatures from a PUBLIC, INDEPENDENT signer set. The team cannot be
//! part of this set — the signers must be external parties (auditors,
//! community-elected validators, institutional custodians).
//!
//! ## What this prevents
//!
//! Without independent signers, the team controls the multisig:
//! the team could collude to release locked BTC from the bridge vault,
//! or to execute a hostile governance proposal. This module enforces:
//!
//! 1. **Signers must be in the configured `independent_set`** — only
//!    pre-approved external addresses can sign.
//! 2. **No signer in `team_set` can sign** — any signature from a team
//!    member is REJECTED with `TeamSignerRejected`. The team explicitly
//!    CANNOT authorize multisig operations.
//! 3. **M-of-N threshold** — at least `threshold` independent signatures
//!    must verify cryptographically.
//! 4. **Unique signers** — duplicate signatures from the same key don't
//!    count toward the threshold.
//!
//! ## How the independent set is governed
//!
//! The independent signer set can only be changed via governance with a
//! CRITICAL timelock (48-72h). This gives the community time to audit
//! new signers before they take effect. The team cannot add themselves
//! to the independent set — `sets_are_disjoint` enforces this at
//! configuration time.

use rstn_crypto::{Dilithium3PublicKey, Dilithium3Signature, verify_signature};

/// A multisig configuration: M-of-N threshold with an independent signer set.
#[derive(Clone, Debug)]
pub struct MultisigConfig {
    /// Number of valid signatures required (M).
    pub threshold: usize,
    /// The independent signer set (N). These MUST be external, non-team
    /// pubkeys — auditors, community validators, institutional custodians.
    pub independent_signers: Vec<Dilithium3PublicKey>,
}

#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum MultisigError {
    #[error("threshold not met: {got}/{needed} independent signatures")]
    ThresholdNotMet { got: usize, needed: usize },
    #[error("signer is a team member — team cannot sign multisig operations")]
    TeamSignerRejected,
    #[error("signer not in the independent set — only approved external signers allowed")]
    SignerNotAuthorized,
    #[error("no independent signers configured — multisig is empty")]
    EmptySignerSet,
}

impl MultisigConfig {
    /// Verify M-of-N multisig over a message.
    ///
    /// `signatures` is the list of (pubkey, signature) pairs.
    /// `message` is the canonical blob being signed.
    /// `team_set` is the set of team member pubkeys — any signature from a
    /// team member is REJECTED (the team cannot authorize multisig ops).
    ///
    /// Returns Ok(()) if >= `threshold` independent, non-team, cryptographically
    /// valid, unique signatures verify against the message.
    pub fn verify(
        &self,
        signatures: &[(Dilithium3PublicKey, Dilithium3Signature)],
        message: &[u8],
        team_set: &[Dilithium3PublicKey],
    ) -> Result<(), MultisigError> {
        if self.independent_signers.is_empty() {
            return Err(MultisigError::EmptySignerSet);
        }

        let mut valid_count = 0usize;
        let mut seen = std::collections::HashSet::new();

        for (pk, sig) in signatures {
            // Reject team members — they cannot sign multisig operations.
            let is_team = team_set.iter().any(|t| t.0 == pk.0);
            if is_team {
                return Err(MultisigError::TeamSignerRejected);
            }
            // Signer must be in the independent set.
            let is_authorized = self.independent_signers.iter().any(|s| s.0 == pk.0);
            if !is_authorized {
                return Err(MultisigError::SignerNotAuthorized);
            }
            // Signature must be cryptographically valid.
            if verify_signature(pk, message, sig).is_err() {
                continue; // skip invalid sigs — they just don't count
            }
            // Count unique signers only (no double-signing).
            if seen.insert(pk.0) {
                valid_count += 1;
            }
        }

        if valid_count < self.threshold {
            return Err(MultisigError::ThresholdNotMet {
                got: valid_count,
                needed: self.threshold,
            });
        }

        Ok(())
    }

    /// Create a 3-of-5 config (standard for the bridge vault).
    /// Requires exactly 5 independent signers.
    pub fn three_of_five(independent_signers: Vec<Dilithium3PublicKey>) -> Self {
        assert!(
            independent_signers.len() >= 5,
            "3-of-5 requires >= 5 independent signers"
        );
        Self {
            threshold: 3,
            independent_signers,
        }
    }

    /// Create a 2-of-3 config (lighter — for non-critical operations).
    pub fn two_of_three(independent_signers: Vec<Dilithium3PublicKey>) -> Self {
        assert!(
            independent_signers.len() >= 3,
            "2-of-3 requires >= 3 independent signers"
        );
        Self {
            threshold: 2,
            independent_signers,
        }
    }
}

/// Check that a signer set has NO overlap with the team set.
/// Returns true if the sets are disjoint (good — no team member is a signer).
/// Returns false if they overlap (bad — a team member is in the signer set).
pub fn sets_are_disjoint(
    independent: &[Dilithium3PublicKey],
    team: &[Dilithium3PublicKey],
) -> bool {
    !independent
        .iter()
        .any(|i| team.iter().any(|t| t.0 == i.0))
}

/// Validate that a multisig config is safe: the independent set must be
/// disjoint from the team set, and the threshold must be > 0.
pub fn validate_config(
    config: &MultisigConfig,
    team_set: &[Dilithium3PublicKey],
) -> Result<(), MultisigError> {
    if config.threshold == 0 {
        return Err(MultisigError::EmptySignerSet);
    }
    if !sets_are_disjoint(&config.independent_signers, team_set) {
        return Err(MultisigError::TeamSignerRejected);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_team_signer_rejected() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let msg = b"test message";
        let sig = kp.sign(msg);

        // kp is in the independent set, but also in the team set → must reject.
        let config = MultisigConfig {
            threshold: 1,
            independent_signers: vec![kp.public.clone()],
        };
        let team = vec![kp.public.clone()];

        let result = config.verify(&[(kp.public.clone(), sig)], msg, &team);
        assert!(result.is_err(), "team member must be rejected");
        assert!(matches!(result.unwrap_err(), MultisigError::TeamSignerRejected));
    }

    #[test]
    fn test_independent_signer_accepted() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let team_kp = rstn_crypto::Dilithium3Keypair::generate();
        let msg = b"test message";
        let sig = kp.sign(msg);

        let config = MultisigConfig {
            threshold: 1,
            independent_signers: vec![kp.public.clone()],
        };
        let team = vec![team_kp.public.clone()];

        let result = config.verify(&[(kp.public.clone(), sig)], msg, &team);
        assert!(result.is_ok(), "independent signer must be accepted");
    }

    #[test]
    fn test_unauthorized_signer_rejected() {
        let authorized_kp = rstn_crypto::Dilithium3Keypair::generate();
        let attacker_kp = rstn_crypto::Dilithium3Keypair::generate();
        let team_kp = rstn_crypto::Dilithium3Keypair::generate();
        let msg = b"test message";
        let sig = attacker_kp.sign(msg);

        let config = MultisigConfig {
            threshold: 1,
            independent_signers: vec![authorized_kp.public.clone()],
        };
        let team = vec![team_kp.public.clone()];

        let result = config.verify(&[(attacker_kp.public.clone(), sig)], msg, &team);
        assert!(result.is_err(), "unauthorized signer must be rejected");
        assert!(matches!(result.unwrap_err(), MultisigError::SignerNotAuthorized));
    }

    #[test]
    fn test_threshold_3_of_5() {
        let kps: Vec<_> = (0..5)
            .map(|_| rstn_crypto::Dilithium3Keypair::generate())
            .collect();
        let team_kp = rstn_crypto::Dilithium3Keypair::generate();
        let msg = b"critical operation";

        let config =
            MultisigConfig::three_of_five(kps.iter().map(|k| k.public.clone()).collect());
        let team = vec![team_kp.public.clone()];

        // Only 2 signatures — should fail (need 3)
        let sigs2: Vec<_> = kps[..2]
            .iter()
            .map(|k| (k.public.clone(), k.sign(msg)))
            .collect();
        let result = config.verify(&sigs2, msg, &team);
        assert!(result.is_err());

        // 3 signatures — should pass
        let sigs3: Vec<_> = kps[..3]
            .iter()
            .map(|k| (k.public.clone(), k.sign(msg)))
            .collect();
        let result = config.verify(&sigs3, msg, &team);
        assert!(result.is_ok(), "3-of-5 must pass with 3 valid independent sigs");
    }

    #[test]
    fn test_duplicate_signers_dont_count_twice() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let team_kp = rstn_crypto::Dilithium3Keypair::generate();
        let msg = b"test";
        let sig = kp.sign(msg);

        let config = MultisigConfig {
            threshold: 2,
            independent_signers: vec![kp.public.clone()],
        };
        let team = vec![team_kp.public.clone()];

        // Same signer signs twice — should count as 1, not 2
        let result = config.verify(
            &[(kp.public.clone(), sig.clone()), (kp.public.clone(), sig)],
            msg,
            &team,
        );
        assert!(result.is_err(), "duplicate sigs must not count twice");
    }

    #[test]
    fn test_sets_disjoint() {
        let kp1 = rstn_crypto::Dilithium3Keypair::generate();
        let kp2 = rstn_crypto::Dilithium3Keypair::generate();
        let kp3 = rstn_crypto::Dilithium3Keypair::generate();

        // Disjoint — good
        assert!(sets_are_disjoint(
            &[kp1.public.clone(), kp2.public.clone()],
            &[kp3.public.clone()]
        ));

        // Overlap — bad
        assert!(!sets_are_disjoint(
            &[kp1.public.clone(), kp2.public.clone()],
            &[kp1.public.clone()]
        ));
    }

    #[test]
    fn test_empty_signer_set_rejected() {
        let config = MultisigConfig {
            threshold: 1,
            independent_signers: vec![],
        };
        let team = vec![];
        let result = config.verify(&[], b"msg", &team);
        assert!(matches!(result.unwrap_err(), MultisigError::EmptySignerSet));
    }
}
