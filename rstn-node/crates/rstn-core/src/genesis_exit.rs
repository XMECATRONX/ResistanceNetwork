//! Gradual exit of the genesis validator.
//!
//! The genesis validator starts with a large stake (the Satoshi position).
//! Over time, its stake is automatically reduced according to a schedule,
//! ensuring no single validator retains absolute power indefinitely.
//!
//! ## Schedule
//!
//! - Before `EXIT_START_EPOCH`: full original stake (network bootstraps).
//! - During exit (`EXIT_START_EPOCH` .. `EXIT_START_EPOCH + EXIT_DURATION_EPOCHS`):
//!   linear reduction from 100% to `STAKE_FLOOR_PCT`% of the original.
//! - After exit: `STAKE_FLOOR_PCT`% of original (the floor — never zero).
//!
//! This is NOT a team vesting contract — the genesis validator earns RSTN
//! by validating, and the gradual exit reduces its governance weight over
//! time. New validators joining dilute the genesis validator naturally;
//! this schedule ACCELERATES that dilution to guarantee the transition.
//!
//! ## Why this matters
//!
//! Without a gradual exit, the genesis validator has absolute power:
//! it is the sole validator at launch and can censor every transaction.
//! The gradual exit guarantees that, over time, the network transitions
//! to a decentralized validator set — even if the genesis operator
//! disappears (the Satoshi model: launch, then step away).

use crate::Validator;

/// Number of epochs over which the genesis stake is reduced.
/// At 1,000 blocks/epoch and 400ms/block, this is ~46 days of gradual exit.
pub const EXIT_DURATION_EPOCHS: u64 = 10_000;

/// Epoch at which the exit begins (gives the network time to bootstrap
/// before the genesis validator starts losing power).
pub const EXIT_START_EPOCH: u64 = 1_000;

/// Floor: the genesis validator keeps this % of its original stake forever.
/// 10% — enough to stay meaningful but not dominant.
pub const STAKE_FLOOR_PCT: u8 = 10;

/// Compute the genesis validator's effective stake at a given epoch.
///
/// Before `EXIT_START_EPOCH`: full original stake (bootstrap period).
/// During exit: linear reduction from 100% to `STAKE_FLOOR_PCT`%.
/// After exit: `STAKE_FLOOR_PCT`% of original (the floor — never zero).
///
/// This is used by the consensus engine when computing voting power:
/// the genesis validator's `stake` field is replaced by this effective
/// value, so its governance weight diminishes over time without
/// requiring the validator to manually unstake.
pub fn genesis_effective_stake(original_stake: u128, current_epoch: u64) -> u128 {
    if original_stake == 0 {
        return 0;
    }
    if current_epoch < EXIT_START_EPOCH {
        return original_stake;
    }
    let exit_end = EXIT_START_EPOCH + EXIT_DURATION_EPOCHS;
    if current_epoch >= exit_end {
        return original_stake * STAKE_FLOOR_PCT as u128 / 100;
    }
    // Linear interpolation: from 100% to STAKE_FLOOR_PCT% over the exit period.
    let elapsed = current_epoch - EXIT_START_EPOCH;
    let progress = elapsed as f64 / EXIT_DURATION_EPOCHS as f64;
    let start_pct = 100.0_f64;
    let end_pct = STAKE_FLOOR_PCT as f64;
    let current_pct = start_pct - (start_pct - end_pct) * progress;
    // Floor at STAKE_FLOOR_PCT% — never go below the floor during exit.
    let computed = (original_stake as f64 * current_pct / 100.0) as u128;
    let floor = original_stake * STAKE_FLOOR_PCT as u128 / 100;
    computed.max(floor)
}

/// Check if a validator is the genesis validator by comparing its pubkey
/// against the well-known genesis pubkey (all zeros).
pub fn is_genesis_validator(validator: &Validator, genesis_pubkey: &[u8]) -> bool {
    validator.pubkey.0 == genesis_pubkey
}

/// Apply the gradual exit to a validator's stake.
/// If the validator is the genesis validator, return the reduced stake.
/// Otherwise, return the stake unchanged.
pub fn apply_genesis_exit(
    validator: &Validator,
    genesis_pubkey: &[u8],
    current_epoch: u64,
) -> u128 {
    if is_genesis_validator(validator, genesis_pubkey) {
        genesis_effective_stake(validator.stake, current_epoch)
    } else {
        validator.stake
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_stake_before_exit_start() {
        let stake = genesis_effective_stake(1_000_000, 500);
        assert_eq!(stake, 1_000_000, "before exit start, stake is full");
    }

    #[test]
    fn test_floor_stake_after_exit() {
        let stake =
            genesis_effective_stake(1_000_000, EXIT_START_EPOCH + EXIT_DURATION_EPOCHS + 1);
        assert_eq!(stake, 100_000, "after exit, stake is 10% floor");
    }

    #[test]
    fn test_linear_reduction_mid_exit() {
        let mid = EXIT_START_EPOCH + EXIT_DURATION_EPOCHS / 2;
        let stake = genesis_effective_stake(1_000_000, mid);
        // At midpoint, should be roughly 55% (halfway between 100% and 10%)
        assert!(
            stake > 450_000 && stake < 600_000,
            "mid-exit stake should be ~55%, got {stake}"
        );
    }

    #[test]
    fn test_stake_never_zero() {
        let stake = genesis_effective_stake(1_000_000, u64::MAX);
        assert!(stake > 0, "stake must never reach zero");
        assert_eq!(stake, 100_000, "floor is 10%");
    }

    #[test]
    fn test_power_monotonically_decreasing() {
        let s1 = genesis_effective_stake(1_000_000, EXIT_START_EPOCH);
        let s2 = genesis_effective_stake(1_000_000, EXIT_START_EPOCH + 1000);
        let s3 = genesis_effective_stake(1_000_000, EXIT_START_EPOCH + 5000);
        assert!(s1 >= s2, "stake must not increase during exit");
        assert!(s2 >= s3, "stake must not increase during exit");
    }

    #[test]
    fn test_zero_stake_stays_zero() {
        assert_eq!(genesis_effective_stake(0, EXIT_START_EPOCH + 1), 0);
        assert_eq!(genesis_effective_stake(0, u64::MAX), 0);
    }
}
