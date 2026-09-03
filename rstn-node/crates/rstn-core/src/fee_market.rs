//! EIP-1559 Fee Market + Dynamic Inflation (Model v3)
//!
//! Fee model v3 — superior to Solana/Ethereum/Cosmos:
//!
//! **Base fee**: EIP-1559 adjustment, 100% burned, FLOORED at 1 gwei.
//!   - Fixes Ethereum's mistake: no floor → burn died at scale (revenue
//!     collapsed 96.5% in Jan 2026 when gas limits expanded).
//!   - With a floor, the base fee can decay toward 1 gwei but never to zero,
//!     so every transaction still burns something and spam is never free.
//!
//! **Tip (priority fee)**: 100% to validator, separate stream from burn.
//!   - Fixes Solana's mistake: their 50% burn competed directly with
//!     validator income → validators starved → SIMD-96 reverted it in 2025.
//!   - RSTN's burn and tip are independent streams: the burn takes the base
//!     fee, the tip goes to the validator. Neither reduces the other.
//!
//! **Dynamic inflation**: targets 66% staked, capped at 2%.
//!   - Fixes Cosmos' mistake: 20% inflation diluted holders.
//!   - The reserve distribution schedule (halving) is the base rate. A
//!     dynamic multiplier adjusts it: if staking < 66%, distribute up to
//!     +2% more (incentivize staking); if > 66%, distribute the base rate.
//!   - The cap is 2% — never the 20% that hurt Cosmos.

use serde::{Deserialize, Serialize};

/// 1 gwei in wei — the floor below which the base fee never drops.
/// This prevents the burn from dying when the network scales (Ethereum's
/// mistake): with a floor, the base fee can decay toward 1 gwei but never
/// to zero, so every transaction still burns something and spam is never
/// free.
pub const BASE_FEE_FLOOR: u128 = 1_000_000_000; // 1 gwei

/// Initial base fee at genesis (1 gwei — the floor).
pub const INITIAL_BASE_FEE: u128 = BASE_FEE_FLOOR;

/// Target gas usage per block (15M — 50% of the 30M gas budget).
pub const TARGET_GAS_PER_BLOCK: u64 = 15_000_000;

/// EIP-1559 elasticity multiplier (1/8 = 12.5% adjustment per block).
/// When a block is full, the base fee increases by 12.5%. When empty, it
/// decreases by 12.5%. This is the same parameter as Ethereum's EIP-1559.
pub const ELASTICITY_MULTIPLIER: u128 = 8;

/// The fee market tracks the current base fee and adjusts it per block
/// based on gas usage vs target. The base fee is floored at 1 gwei so it
/// never reaches zero — the burn always lives, spam is never free.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FeeMarket {
    /// Current base fee per gas unit (in wei). Starts at 1 gwei, adjusts
    /// per block based on fullness. Never drops below BASE_FEE_FLOOR.
    pub base_fee: u128,
    /// Total gas used in the last block (for adjustment calculation).
    pub last_block_gas: u64,
}

impl Default for FeeMarket {
    fn default() -> Self {
        Self {
            base_fee: INITIAL_BASE_FEE,
            last_block_gas: 0,
        }
    }
}

impl FeeMarket {
    /// Create a new fee market at genesis (base fee = floor = 1 gwei).
    pub fn new() -> Self {
        Self::default()
    }

    /// Adjust the base fee after a block is produced, based on how full
    /// the block was relative to the target. This is the EIP-1559 mechanic:
    /// - If gas_used > target: base fee increases by ~12.5%
    /// - If gas_used < target: base fee decreases by ~12.5%
    /// - The base fee NEVER drops below the floor (1 gwei)
    ///
    /// This fixes Ethereum's mistake (no floor → burn dies at scale) because
    /// even when the network is empty, the base fee stays at 1 gwei, not zero.
    pub fn update_after_block(&mut self, gas_used: u64) {
        if gas_used > TARGET_GAS_PER_BLOCK {
            // Block is above target — increase base fee
            let delta = self.base_fee / ELASTICITY_MULTIPLIER;
            self.base_fee = self.base_fee.saturating_add(delta.max(1));
        } else if gas_used < TARGET_GAS_PER_BLOCK {
            // Block is below target — decrease base fee, but never below floor
            let delta = self.base_fee / ELASTICITY_MULTIPLIER;
            let new_fee = self.base_fee.saturating_sub(delta);
            self.base_fee = new_fee.max(BASE_FEE_FLOOR);
        }
        // Enforce the floor regardless
        self.base_fee = self.base_fee.max(BASE_FEE_FLOOR);
        self.last_block_gas = gas_used;
    }

    /// Split a transaction's gas fee into base fee (burned) + tip (validator),
    /// charging ONLY for the gas actually consumed (`gas_used`), NOT the
    /// reserved `gas_limit`.
    ///
    /// This fixes the "no gas refund" gap (Ethereum refunds unused gas; before
    /// this fix RSTN charged for the full reserved `gas_limit`, meaning a user
    /// who reserved 100k gas but used 30k paid for 100k — a 70k penalty for
    /// efficiency). Now the user pays only for what the VM consumed.
    ///
    /// - `base_fee * gas_used` is BURNED (destroyed, deflationary)
    /// - `(gas_price - base_fee) * gas_used` goes to the VALIDATOR (tip)
    ///
    /// If the user's gas_price is below the base fee, the tip is zero and
    /// only the base fee portion is burned.
    ///
    /// Returns (burn_amount, validator_tip).
    pub fn split_fee(&self, gas_price: u128, gas_used: u64) -> (u128, u128) {
        let base_fee_total = self.base_fee.saturating_mul(gas_used as u128);
        let total_fee = gas_price.saturating_mul(gas_used as u128);

        // The burn is the base fee portion (capped at what the user actually pays)
        let burn = base_fee_total.min(total_fee);
        // The tip is what's left after the burn — 100% to the validator
        let tip = total_fee.saturating_sub(burn);

        (burn, tip)
    }

    /// Legacy split that charges the full reserved `gas_limit`. Kept for
    /// backward-compatibility with callers that pre-pay the full reserve
    /// (e.g. balance checks that must hold the worst case). Production
    /// finalization MUST use `split_fee` with `gas_used` so users are
    /// refunded for unused gas.
    pub fn split_fee_reserved(&self, gas_price: u128, gas_limit: u64) -> (u128, u128) {
        let base_fee_total = self.base_fee.saturating_mul(gas_limit as u128);
        let total_fee = gas_price.saturating_mul(gas_limit as u128);
        let burn = base_fee_total.min(total_fee);
        let tip = total_fee.saturating_sub(burn);
        (burn, tip)
    }

    /// Get the current base fee (for RPC / display).
    pub fn current_base_fee(&self) -> u128 {
        self.base_fee
    }
}

/// Dynamic inflation targeting 66% staked, capped at 2%.
///
/// This fixes Cosmos' mistake (20% inflation diluted holders). The reserve
/// distribution schedule (halving every 4 years) is the base rate. This
/// module applies a multiplier:
/// - If staking ratio < 66%: distribute UP TO +2% more per year (incentivize
///   staking, boost security)
/// - If staking ratio >= 66%: distribute the base rate (no bonus needed)
///
/// The cap is 2% — never the 20% that hurt Cosmos.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DynamicInflation {
    /// Target staking ratio in basis points (6600 = 66%).
    pub target_staking_ratio: u128,
    /// Maximum adjustment above the base schedule in basis points (200 = 2%).
    pub max_adjustment_bps: u128,
}

impl Default for DynamicInflation {
    fn default() -> Self {
        Self {
            target_staking_ratio: 6600, // 66%
            max_adjustment_bps: 200,    // 2%
        }
    }
}

impl DynamicInflation {
    /// Create a new dynamic inflation controller targeting 66% staked, 2% cap.
    pub fn new() -> Self {
        Self::default()
    }

    /// Compute the distribution rate multiplier based on the current staking ratio.
    ///
    /// `staking_ratio_bps` = staked_tokens * 10000 / total_supply (in basis points).
    ///
    /// Returns a multiplier in basis points (10000 = 1.0× = base schedule):
    /// - If staking_ratio < 66%: multiplier scales from 10000 (at 66%) up to
    ///   10200 (at 0%) — the deficit drives a linear bonus capped at +2%.
    /// - If staking_ratio >= 66%: multiplier = 10000 (base schedule, no bonus)
    ///
    /// The maximum bonus is +2% (200 bps) — the cap that prevents Cosmos-style
    /// dilution. Never the 20% (2000 bps) that hurt ATOM.
    pub fn rate_multiplier(&self, staking_ratio_bps: u128) -> u128 {
        if staking_ratio_bps >= self.target_staking_ratio {
            // At or above target — distribute at base rate (halving schedule)
            10000
        } else {
            // Below target — distribute more, up to +2% cap
            // Linear interpolation: at 0% staked → +2%, at 66% → +0%
            let deficit = self.target_staking_ratio.saturating_sub(staking_ratio_bps);
            // Scale the deficit to the max adjustment: (deficit / target) * max
            let bonus = (deficit * self.max_adjustment_bps) / self.target_staking_ratio;
            10000 + bonus
        }
    }
}

/// Maximum stake dominance — no operator may exceed this fraction of the
/// total stake. Set at 20% (2000 bps), which maximizes decentralization
/// protection while still allowing professional staking to be viable
/// (5+ operators can coexist). This fixes Lido's problem on Ethereum
/// (32% → governance capture). 20% gives a 1.67× safety margin below
/// the 33% BFT finality-blocking threshold. Excess rewards beyond 20%
/// are redistributed — growing past 20% is not profitable.
pub const MAX_STAKE_DOMINANCE_BPS: u128 = 2000; // 20%

/// Compute the capped stake for a validator given the total stake.
/// If the validator's stake exceeds 20% of the total, the excess is
/// redistributed — the validator earns rewards only on their capped share.
pub fn capped_stake(validator_stake: u128, total_stake: u128) -> u128 {
    if total_stake == 0 {
        return 0;
    }
    let cap = total_stake * MAX_STAKE_DOMINANCE_BPS / 10000;
    validator_stake.min(cap)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base_fee_starts_at_floor() {
        let fm = FeeMarket::new();
        assert_eq!(fm.base_fee, BASE_FEE_FLOOR);
        assert_eq!(fm.base_fee, 1_000_000_000); // 1 gwei
    }

    #[test]
    fn test_base_fee_floor_never_zero() {
        let mut fm = FeeMarket::new();
        // Simulate many empty blocks — base fee should stay at floor
        for _ in 0..100 {
            fm.update_after_block(0);
        }
        assert_eq!(fm.base_fee, BASE_FEE_FLOOR);
    }

    #[test]
    fn test_base_fee_increases_on_full_block() {
        let mut fm = FeeMarket::new();
        let initial = fm.base_fee;
        // 2× target = full block → base fee increases
        fm.update_after_block(TARGET_GAS_PER_BLOCK * 2);
        assert!(fm.base_fee > initial);
    }

    #[test]
    fn test_base_fee_decreases_on_empty_block_but_not_below_floor() {
        let mut fm = FeeMarket::new();
        // Set a high base fee first
        fm.base_fee = 1_000_000_000_000; // 1000 gwei
        fm.update_after_block(0); // empty block
        assert!(fm.base_fee < 1_000_000_000_000);
        assert!(fm.base_fee >= BASE_FEE_FLOOR);
    }

    #[test]
    fn test_split_fee_burn_and_tip_at_floor() {
        let fm = FeeMarket::new();
        // base_fee = 1 gwei (floor), gas_price = 10 gwei, gas_limit = 21000
        let gas_price = 10_000_000_000u128; // 10 gwei
        let gas_limit = 21_000u64;

        let (burn, tip) = fm.split_fee(gas_price, gas_limit);

        // burn = base_fee * gas_limit = 1 gwei * 21000 = 21000 gwei
        assert_eq!(burn, 1_000_000_000u128 * 21_000);
        // tip = (gas_price - base_fee) * gas_limit = 9 gwei * 21000 = 189000 gwei
        assert_eq!(tip, 9_000_000_000u128 * 21_000);
        // Total = gas_price * gas_limit
        assert_eq!(burn + tip, gas_price * gas_limit as u128);
    }

    #[test]
    fn test_split_fee_when_gas_price_below_base_fee() {
        let mut fm = FeeMarket::new();
        fm.base_fee = 10_000_000_000; // 10 gwei
        // gas_price = 5 gwei (below base fee) → all goes to burn, no tip
        let (burn, tip) = fm.split_fee(5_000_000_000, 21_000);
        assert_eq!(burn, 5_000_000_000 * 21_000); // all of the user's payment
        assert_eq!(tip, 0); // no tip for validator
    }

    #[test]
    fn test_split_fee_equal_to_base_fee() {
        let fm = FeeMarket::new();
        // gas_price = base_fee = 1 gwei → all burn, no tip
        let (burn, tip) = fm.split_fee(BASE_FEE_FLOOR, 21_000);
        assert_eq!(burn, BASE_FEE_FLOOR * 21_000);
        assert_eq!(tip, 0);
    }

    #[test]
    fn test_dynamic_inflation_at_target() {
        let di = DynamicInflation::new();
        // 66% staked → 1.0× multiplier (base schedule)
        assert_eq!(di.rate_multiplier(6600), 10000);
    }

    #[test]
    fn test_dynamic_inflation_below_target() {
        let di = DynamicInflation::new();
        // 0% staked → max bonus (2% → 10200 bps)
        assert_eq!(di.rate_multiplier(0), 10200);
        // 33% staked → half the max bonus (1% → 10100 bps)
        assert_eq!(di.rate_multiplier(3300), 10100);
    }

    #[test]
    fn test_dynamic_inflation_above_target() {
        let di = DynamicInflation::new();
        // 80% staked → base rate (no bonus needed)
        assert_eq!(di.rate_multiplier(8000), 10000);
        // 100% staked → still base rate
        assert_eq!(di.rate_multiplier(10000), 10000);
    }

    #[test]
    fn test_dynamic_inflation_cap_is_2_percent() {
        let di = DynamicInflation::new();
        // The maximum multiplier is 10200 (10000 + 200 bps = 2% cap)
        let max_multiplier = di.rate_multiplier(0);
        assert_eq!(max_multiplier, 10200);
        // Never the 20% that hurt Cosmos (which would be 12000)
        assert!(max_multiplier < 12000);
    }

    #[test]
    fn test_stake_dominance_cap_20_percent() {
        // A validator with 25% of total stake → capped to 20%
        let total = 1_000_000_000_000_000_000u128; // 1B RSTN
        let validator = total * 25 / 100; // 25% → exceeds cap
        let capped = capped_stake(validator, total);
        assert_eq!(capped, total * 20 / 100); // capped to 20%
    }

    #[test]
    fn test_stake_dominance_under_cap_unchanged() {
        // A validator with 15% of total stake → unchanged (below cap)
        let total = 1_000_000_000_000_000_000u128;
        let validator = total * 15 / 100;
        let capped = capped_stake(validator, total);
        assert_eq!(capped, validator); // not capped
    }

    #[test]
    fn test_stake_dominance_exactly_20_percent() {
        // A validator with exactly 20% → not capped (at the boundary)
        let total = 1_000_000_000_000_000_000u128;
        let validator = total * 20 / 100;
        let capped = capped_stake(validator, total);
        assert_eq!(capped, validator);
    }

    #[test]
    fn test_stake_dominance_zero_total() {
        // Zero total stake → capped stake is 0
        assert_eq!(capped_stake(1_000_000, 0), 0);
    }
}
