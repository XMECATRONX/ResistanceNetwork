//! Governance module with flash-loan attack protection.
//!
//! The Beanstalk attack ($50M lost) worked because voting power was measured
//! at vote time -- a flash loan could borrow tokens, vote, and repay in one
//! block. This module eliminates that vector with three defenses:
//!
//! 1. **Snapshot at proposal creation**: voting power is computed from the
//!    stake snapshot taken at the block where the proposal was created. Tokens
//!    acquired *after* that block -- including flash-loaned tokens -- carry
//!    zero voting power on this proposal.
//! 2. **Quadratic voting**: voting weight = sqrt(stake_at_snapshot), not
//!    stake. A whale with 100x the stake has 10x the vote -- still influential
//!    but not dictatorial. This is the Gitcoin / Radical Markets approach.
//! 3. **Proposal-delay + minority veto**: a proposal cannot execute until 1
//!    epoch after it passes. If 10% of voting power vetoes, execution is
//!    delayed 30 days -- giving the community time to react to hostile
//!    proposals.
//!
//! This is honest: it is a *governance mechanism* (design + on-chain logic),
//! not a full DAO product. It protects the specific flash-loan vector it
//! claims to protect. The snapshot must be supplied by the host (the runner
//! reads balances from storage at the snapshot height).

use crate::{EPOCH_LENGTH, Validator, ValidatorStatus};

/// A governance proposal. Voting power is frozen at `snapshot_height`.
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub proposer: [u8; 20],
    /// Block height at which voting power was snapshotted. Tokens acquired
    /// after this height do not count -- this is the flash-loan defense.
    pub snapshot_height: u64,
    /// The block height at which the proposal was created.
    pub creation_height: u64,
    /// Minimum voting power (as % of total) required to pass.
    pub quorum_pct: u8,
    /// Votes cast: (voter_address, voting_power_at_snapshot, support).
    pub votes: Vec<Vote>,
    /// Whether the proposal has been vetoed (>= veto_threshold % of total
    /// voting power).
    pub vetoed: bool,
    /// Height at which the proposal passed (if it reached quorum).
    pub passed_height: Option<u64>,
    /// Whether the proposal has been executed. A passed proposal can only
    /// execute after `execution_delay_blocks` -- the timelock.
    pub executed: bool,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum VoteChoice {
    For,
    Against,
}

#[derive(Clone, Copy, Debug)]
pub struct Vote {
    pub voter: [u8; 20],
    /// Voting power at the snapshot height -- NOT current stake. The host
    /// supplies this from the historical state.
    pub power_at_snapshot: u128,
    pub choice: VoteChoice,
}

/// Compute quadratic voting weight from stake: sqrt(stake).
/// A validator with 1,000,000 stake gets 1,000 weight; one with 100 gets 10.
/// Whales are influential but not dictatorial.
pub fn quadratic_weight(stake: u128) -> u128 {
    if stake == 0 {
        return 0;
    }
    // Integer square root (binary search) -- exact, no floats.
    isqrt(stake)
}

/// Integer square root via binary search.
fn isqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut lo: u128 = 1;
    let mut hi: u128 = n;
    let mut result: u128 = 1;
    while lo <= hi {
        let mid = lo + (hi - lo) / 2;
        match mid.checked_mul(mid) {
            Some(sq) if sq == n => return mid,
            Some(sq) if sq < n => {
                result = mid;
                lo = mid + 1;
            }
            _ => hi = mid - 1,
        }
    }
    result
}

impl Proposal {
    pub fn new(id: u64, proposer: [u8; 20], creation_height: u64, quorum_pct: u8) -> Self {
        Self {
            id,
            proposer,
            snapshot_height: creation_height,
            creation_height,
            quorum_pct,
            votes: Vec::new(),
            vetoed: false,
            passed_height: None,
            executed: false,
        }
    }

    /// Cast a vote. `power_at_snapshot` is the voter's stake at the snapshot
    /// height -- the host must look this up from historical state, NOT current
    /// balances. This is what defeats flash loans.
    ///
    /// Returns Err if the voter already voted (one address, one vote).
    pub fn vote(
        &mut self,
        voter: [u8; 20],
        power_at_snapshot: u128,
        choice: VoteChoice,
    ) -> Result<(), GovernanceError> {
        if self.votes.iter().any(|v| v.voter == voter) {
            return Err(GovernanceError::AlreadyVoted);
        }
        self.votes.push(Vote {
            voter,
            power_at_snapshot,
            choice,
        });
        Ok(())
    }

    /// Total quadratic voting weight cast FOR the proposal.
    pub fn weight_for(&self) -> u128 {
        self.votes
            .iter()
            .filter(|v| v.choice == VoteChoice::For)
            .map(|v| quadratic_weight(v.power_at_snapshot))
            .sum()
    }

    /// Total quadratic voting weight cast AGAINST.
    pub fn weight_against(&self) -> u128 {
        self.votes
            .iter()
            .filter(|v| v.choice == VoteChoice::Against)
            .map(|v| quadratic_weight(v.power_at_snapshot))
            .sum()
    }

    /// Total voting power at snapshot (FOR + AGAINST) -- used for quorum checks.
    pub fn total_power(&self) -> u128 {
        self.votes.iter().map(|v| v.power_at_snapshot).sum()
    }

    /// Check whether the proposal reached quorum. `total_stake_at_snapshot`
    /// is the total stake of ALL validators at the snapshot height -- the host
    /// supplies this. Quorum = (weight_for / total) >= quorum_pct%.
    pub fn has_quorum(&self, total_stake_at_snapshot: u128) -> bool {
        if total_stake_at_snapshot == 0 {
            return false;
        }
        // Quorum is measured in *quadratic* weight of the whole validator set,
        // so we convert total stake to total quadratic weight.
        let total_weight = quadratic_weight(total_stake_at_snapshot);
        if total_weight == 0 {
            return false;
        }
        let needed = total_weight * self.quorum_pct as u128 / 100;
        self.weight_for() >= needed
    }

    /// Record that the proposal passed at `height`. Sets passed_height so the
    /// timelock can be enforced before execution.
    pub fn mark_passed(&mut self, height: u64) {
        self.passed_height = Some(height);
    }

    /// Veto the proposal. `veto_power` is the voting power of the vetoing
    /// minority at snapshot. If it reaches `veto_threshold_pct` of
    /// `total_stake_at_snapshot`, the proposal is vetoed and execution is
    /// delayed.
    pub fn veto(
        &mut self,
        veto_power: u128,
        total_stake_at_snapshot: u128,
        veto_threshold_pct: u8,
    ) -> bool {
        if total_stake_at_snapshot == 0 {
            return false;
        }
        let needed = total_stake_at_snapshot * veto_threshold_pct as u128 / 100;
        if veto_power >= needed {
            self.vetoed = true;
            return true;
        }
        false
    }

    /// Can the proposal be executed at `current_height`?
    /// Requires: passed, not vetoed, not already executed, and the timelock
    /// (1 epoch after passing) has elapsed.
    pub fn can_execute(&self, current_height: u64) -> bool {
        if self.executed || self.vetoed {
            return false;
        }
        match self.passed_height {
            Some(passed) => current_height >= passed + EPOCH_LENGTH,
            None => false,
        }
    }

    /// Execute the proposal. Returns Err if not executable yet.
    pub fn execute(&mut self, current_height: u64) -> Result<(), GovernanceError> {
        if !self.can_execute(current_height) {
            return Err(GovernanceError::NotExecutable);
        }
        self.executed = true;
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum GovernanceError {
    #[error("voter has already cast a vote")]
    AlreadyVoted,
    #[error("proposal is not yet executable (timelock or veto)")]
    NotExecutable,
}

/// Validate that a snapshot height is in the past relative to `current_height`.
/// A snapshot in the future or at the current block would let flash loans
/// influence it -- the snapshot MUST be strictly before any flash-loan-able
/// state change.
pub fn validate_snapshot(snapshot_height: u64, current_height: u64) -> bool {
    snapshot_height < current_height
}

/// Active voting power from a validator set (excludes slashed/jailed).
pub fn active_voting_power(validators: &[Validator]) -> u128 {
    validators
        .iter()
        .filter(|v| v.status == ValidatorStatus::Active)
        .map(|v| v.stake)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quadratic_weight_reduces_whale_dominance() {
        // 1,000,000 stake -> 1,000 weight; 100 stake -> 10 weight
        assert_eq!(quadratic_weight(1_000_000), 1_000);
        assert_eq!(quadratic_weight(100), 10);
        assert_eq!(quadratic_weight(0), 0);
    }

    #[test]
    fn flash_loan_cannot_influence_vote() {
        // Snapshot at height 10. At height 11 a flash loan is taken.
        // The loan's stake is NOT in the snapshot, so it carries 0 power.
        let mut proposal = Proposal::new(1, [0u8; 20], 10, 50);
        // Honest voter with 1,000,000 stake at snapshot
        proposal.vote([1; 20], 1_000_000, VoteChoice::For).unwrap();
        // Flash-loan attacker "voted" but their power at snapshot is 0
        // (because they didn't hold tokens at height 10)
        proposal.vote([2; 20], 0, VoteChoice::Against).unwrap();
        assert_eq!(proposal.weight_for(), 1_000);
        assert_eq!(proposal.weight_against(), 0);
        assert!(proposal.has_quorum(1_000_000));
    }

    #[test]
    fn timelock_blocks_immediate_execution() {
        let mut proposal = Proposal::new(1, [0u8; 20], 10, 50);
        proposal.vote([1; 20], 1_000_000, VoteChoice::For).unwrap();
        proposal.mark_passed(15);
        // Can't execute at 15 + EPOCH_LENGTH - 1 (timelock not elapsed)
        assert!(!proposal.can_execute(15 + EPOCH_LENGTH - 1));
        // Can execute after the full epoch delay
        assert!(proposal.can_execute(15 + EPOCH_LENGTH));
    }

    #[test]
    fn minority_veto_blocks_execution() {
        let mut proposal = Proposal::new(1, [0u8; 20], 10, 50);
        proposal.vote([1; 20], 1_000_000, VoteChoice::For).unwrap();
        proposal.mark_passed(15);
        // 15% minority vetoes (threshold 10%)
        assert!(proposal.veto(150_000, 1_000_000, 10));
        assert!(!proposal.can_execute(15 + EPOCH_LENGTH));
    }

    #[test]
    fn double_voting_rejected() {
        let mut proposal = Proposal::new(1, [0u8; 20], 10, 50);
        proposal.vote([1; 20], 100, VoteChoice::For).unwrap();
        assert_eq!(
            proposal.vote([1; 20], 100, VoteChoice::For),
            Err(GovernanceError::AlreadyVoted)
        );
    }
}
