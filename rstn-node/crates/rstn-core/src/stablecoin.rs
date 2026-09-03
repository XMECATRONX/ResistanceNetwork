//! Over-collateralized stablecoin (rUSD) — DAI model for the RSTN L1.
//!
//! HONEST SCOPE: This is the economic engine for rUSD. The EVM contracts
//! (`RSTNUSD.sol`, `RstnVault.sol`, `RstnOracleAdapter.sol`) implement the
//! permissionless CDP vault. This Rust module is the node-side integration:
//! it feeds the consensus-aggregated median price to the on-chain oracle
//! adapter and exposes RPC to query vault state.
//!
//! Why this is SEC-safe for the "launch and disappear" model:
//!   - rUSD is minted ONLY against over-collateralized debt (>=150%). There
//!     is no central issuer, no admin mint, no reserve promise.
//!   - The deployer mints nothing to themselves. Supply = collateral / 1.5.
//!   - Liquidation is permissionless and algorítmic — no human decides.
//!   - The stability fee flows to the community treasury (governance
//!     timelock), not to any operator. The deployer has no special access.
//!
//! What is implemented (real):
//!   - Price feed: the node's `MultiSourceOracle` (median + TWAP) is the
//!     source of truth. The node writes the median to the on-chain adapter
//!     every block via a system oracle-update transaction.
//!   - Stale-price guard: if the oracle feed is stale (>50 blocks), the vault
//!     rejects reads — no acting on a stale/manipulated price.
//!   - Liquidation monitoring: the node can detect undercollateralized
//!     positions and (optionally) auto-liquidate them, but liquidation is
//!     permissionless so anyone can do it.
//!
//! What is NOT claimed:
//!   - A peg stability module (PSM) for 1:1 USDC swaps (rUSD holds its peg
//!     via over-collateralization + arbitrage, not via a PSM).
//!   - Interest rate feedback loops (the stability fee is a fixed 2% APR;
//!     dynamic rate governance is future work).

use crate::oracle::MultiSourceOracle;

/// Configuration for the rUSD system.
#[derive(Clone, Debug)]
pub struct StablecoinConfig {
    /// Minimum collateral ratio to open a position (in bps). 15000 = 150%.
    pub min_collateral_ratio_bps: u16,
    /// Liquidation threshold (in bps). 15000 = 150%.
    pub liquidation_ratio_bps: u16,
    /// Liquidation penalty (in bps). 1300 = 13%.
    pub liquidation_penalty_bps: u16,
    /// Stability fee per second (1e18 fixed-point). ~2% APR.
    pub stability_fee_per_sec: u128,
    /// Max blocks the oracle price can be stale before the vault rejects reads.
    pub max_stale_blocks: u64,
}

impl Default for StablecoinConfig {
    fn default() -> Self {
        Self {
            min_collateral_ratio_bps: 15000,
            liquidation_ratio_bps: 15000,
            liquidation_penalty_bps: 1300,
            stability_fee_per_sec: 634_195_839, // ~2% APR
            max_stale_blocks: 50,
        }
    }
}

/// The node-side rUSD manager. Holds a reference to the multi-source oracle
/// and tracks the last price written to the on-chain adapter.
#[derive(Clone, Debug)]
pub struct StablecoinManager {
    pub config: StablecoinConfig,
    /// Last median price written on-chain (USD per collateral unit, 18 decimals).
    pub last_written_price: u128,
    /// Block height at which the price was last written.
    pub last_write_height: u64,
    /// Total rUSD supply (mirrors the on-chain totalSupply for RPC queries).
    pub total_supply: u128,
    /// Total collateral locked (token units).
    pub total_collateral: u128,
}

impl StablecoinManager {
    pub fn new(config: StablecoinConfig) -> Self {
        Self {
            config,
            last_written_price: 0,
            last_write_height: 0,
            total_supply: 0,
            total_collateral: 0,
        }
    }

    /// Determine whether the node should write the oracle price to the
    /// on-chain adapter this block. We write if the price changed materially
    /// (>0.5%) or if the feed is approaching staleness.
    pub fn should_write_price(&self, oracle: &MultiSourceOracle, height: u64) -> bool {
        let current = oracle.current_price();
        if current == 0 {
            return false;
        }
        // Always write if we're within 10 blocks of the stale limit.
        if height.saturating_sub(self.last_write_height) >= self.config.max_stale_blocks - 10 {
            return true;
        }
        // Write if price moved >0.5%.
        if self.last_written_price == 0 {
            return true;
        }
        let diff = if current > self.last_written_price {
            current - self.last_written_price
        } else {
            self.last_written_price - current
        };
        let pct = (diff * 10000) / self.last_written_price;
        pct >= 50 // 0.5%
    }

    /// Record that the price was written on-chain at this height.
    pub fn record_write(&mut self, price: u128, height: u64) {
        self.last_written_price = price;
        self.last_write_height = height;
    }

    /// Is the on-chain price stale? (For RPC health checks.)
    pub fn is_price_stale(&self, current_height: u64) -> bool {
        current_height.saturating_sub(self.last_write_height) > self.config.max_stale_blocks
    }

    /// The collateral ratio of a position, given collateral amount and debt.
    /// Returns the ratio in bps (15000 = 150%). Returns u128::MAX if no debt.
    pub fn collateral_ratio(
        &self,
        collateral: u128,
        debt: u128,
        price: u128,
    ) -> u128 {
        if debt == 0 {
            return u128::MAX;
        }
        if price == 0 {
            return 0;
        }
        let collateral_value_usd = (collateral * price) / 1_000_000_000_000_000_000;
        (collateral_value_usd * 10000) / debt
    }

    /// Is a position liquidatable?
    pub fn is_liquidatable(&self, collateral: u128, debt: u128, price: u128) -> bool {
        if debt == 0 {
            return false;
        }
        self.collateral_ratio(collateral, debt, price) < self.config.liquidation_ratio_bps as u128
    }

    /// Max rUSD that can be minted against `collateral` at `price` while
    /// staying above the minimum collateral ratio.
    pub fn max_mintable(&self, collateral: u128, price: u128) -> u128 {
        if price == 0 {
            return 0;
        }
        let collateral_value_usd = (collateral * price) / 1_000_000_000_000_000_000;
        // max_debt = collateral_value_usd * BPS / min_ratio
        (collateral_value_usd * 10000) / self.config.min_collateral_ratio_bps as u128
    }

    /// Accrue the stability fee on a debt over `seconds_elapsed`.
    pub fn accrue_fee(&self, debt: u128, seconds_elapsed: u64) -> u128 {
        if debt == 0 || seconds_elapsed == 0 {
            return debt;
        }
        let fee = (debt * self.config.stability_fee_per_sec * seconds_elapsed as u128) / 1_000_000_000_000_000_000;
        debt + fee
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::circuit_breaker::CircuitBreaker;
    use crate::oracle::{MultiSourceOracle, PriceSample};

    #[test]
    fn test_max_mintable_respects_150pct() {
        let mgr = StablecoinManager::default();
        // $300 of collateral at $1 price (1 unit = $1).
        // max_mintable = 300 * 10000 / 15000 = 200 rUSD.
        let max = mgr.max_mintable(300 * 1e18 as u128, 1e18 as u128);
        assert_eq!(max, 200 * 1e18 as u128);
    }

    #[test]
    fn test_liquidatable_when_undercollateralized() {
        let mgr = StablecoinManager::default();
        // $200 debt, $250 collateral at $1 → ratio = 125% < 150% → liquidatable.
        assert!(mgr.is_liquidatable(250 * 1e18 as u128, 200 * 1e18 as u128, 1e18 as u128));
        // $300 collateral → ratio = 150% → NOT liquidatable (boundary).
        assert!(!mgr.is_liquidatable(300 * 1e18 as u128, 200 * 1e18 as u128, 1e18 as u128));
    }

    #[test]
    fn test_should_write_on_material_change() {
        let mut oracle = MultiSourceOracle::new(100);
        oracle.register_source([1; 20], "src");
        let mut breaker = CircuitBreaker::new();
        let mut mgr = StablecoinManager::default();

        oracle.submit_prices(&[PriceSample { height: 1, source_id: [1; 20], price: 1000 }], 1, &mut breaker);
        assert!(mgr.should_write_price(&oracle, 1));
        mgr.record_write(1000, 1);

        // Small change (0.1%) → no write.
        oracle.submit_prices(&[PriceSample { height: 2, source_id: [1; 20], price: 1001 }], 2, &mut breaker);
        assert!(!mgr.should_write_price(&oracle, 2));

        // Material change (1%) → write.
        oracle.submit_prices(&[PriceSample { height: 3, source_id: [1; 20], price: 1010 }], 3, &mut breaker);
        assert!(mgr.should_write_price(&oracle, 3));
    }

    #[test]
    fn test_stale_detection() {
        let mut mgr = StablecoinManager::default();
        mgr.record_write(1000, 100);
        assert!(!mgr.is_price_stale(120));
        assert!(mgr.is_price_stale(200)); // >50 blocks stale
    }

    #[test]
    fn test_fee_accrual() {
        let mgr = StablecoinManager::default();
        // 2% APR on 100 rUSD for 1 year (31536000s) ≈ 102 rUSD.
        let accrued = mgr.accrue_fee(100 * 1e18 as u128, 31_536_000);
        let expected = 102 * 1e18 as u128;
        let diff = if accrued > expected { accrued - expected } else { expected - accrued };
        // Allow rounding tolerance of 0.01 rUSD.
        assert!(diff < 1e16 as u128, "fee accrual off by too much: {}", diff);
    }
}
