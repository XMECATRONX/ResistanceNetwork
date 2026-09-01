//! On-chain circuit breakers -- automatic pause when anomalous activity is
//! detected. This is the "kill switch" that limits blast radius of a smart
//! contract bug or oracle manipulation.
//!
//! Monitored signals:
//! - **Value drain**: if total value transferred out of an address exceeds
//!   `drain_pct`% of that address's balance within `window_blocks`, pause
//!   transfers from that address. (Protects against a buggy contract draining
//!   a user's funds.)
//! - **Oracle deviation**: if a price moves more than `deviation_pct`% within
//!   `window_blocks`, pause oracle-dependent operations. (Protects against
//!   oracle manipulation -- the Lodestar/BonqDAO/Mango pattern.)
//! - **Global pause**: a manual or governance-triggered full halt.
//!
//! This is honest scope: the circuit breaker *detects* the anomaly and
//! *returns a pause signal*. The actual operation handlers (RPC, VM) must
//! check `is_paused()` before executing. It does NOT auto-revert state --
//! that requires the runner to gate execution on these flags.

use std::collections::HashMap;

/// The category of operation that can be paused. Finer-grained than a single
/// global flag so a localized anomaly doesn't halt the whole chain.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PauseScope {
    /// All transfers paused (global emergency).
    Global,
    /// Transfers from a specific address paused (drain detected).
    AddressTransfers,
    /// Oracle-dependent contract calls paused (oracle deviation detected).
    OracleOps,
}

/// A circuit-breaker trip record -- why and when it was triggered.
#[derive(Clone, Debug)]
pub struct BreakerTrip {
    pub scope: PauseScope,
    pub address: Option<[u8; 20]>,
    pub reason: String,
    pub tripped_at_height: u64,
}

/// Configuration for a single breaker rule.
#[derive(Clone, Debug)]
pub struct BreakerConfig {
    /// Sliding window in blocks over which to measure the anomaly.
    pub window_blocks: u64,
    /// Percentage threshold (0-100) that triggers the breaker.
    pub threshold_pct: u8,
}

impl Default for BreakerConfig {
    fn default() -> Self {
        Self {
            window_blocks: 100,
            threshold_pct: 25, // 25% drain in 100 blocks -> trip
        }
    }
}

/// The circuit-breaker state machine. Tracks rolling value flow per address
/// and oracle price history, and trips when a threshold is exceeded.
#[derive(Clone, Debug, Default)]
pub struct CircuitBreaker {
    /// Paused scopes -> trip record. A scope in this map is paused.
    pub paused: HashMap<String, BreakerTrip>,
    /// Rolling outflow per address within the window: (height, amount).
    pub outflows: HashMap<[u8; 20], Vec<(u64, u128)>>,
    /// Recent oracle price samples: (height, price).
    pub oracle_samples: Vec<(u64, u128)>,
    pub drain_config: BreakerConfig,
    pub oracle_config: BreakerConfig,
}

impl CircuitBreaker {
    pub fn new() -> Self {
        Self {
            drain_config: BreakerConfig::default(),
            oracle_config: BreakerConfig {
                window_blocks: 50,
                threshold_pct: 5, // 5% price move in 50 blocks -> trip
            },
            ..Default::default()
        }
    }

    /// Record a value outflow from `address` and check the drain breaker.
    /// Returns true if the breaker tripped on this call.
    pub fn record_outflow(
        &mut self,
        address: [u8; 20],
        amount: u128,
        balance_before: u128,
        height: u64,
    ) -> bool {
        if balance_before == 0 {
            return false;
        }
        let window = self.drain_config.window_blocks;
        let entry = self.outflows.entry(address).or_default();
        entry.push((height, amount));
        // Prune samples older than the window
        entry.retain(|(h, _)| height.saturating_sub(*h) <= window);
        // Total outflow in the window
        let total_out: u128 = entry.iter().map(|(_, a)| *a).sum();
        // Drain ratio
        let ratio = (total_out * 100) / balance_before;
        if ratio > self.drain_config.threshold_pct as u128 {
            let pct = ratio.min(100) as u8;
            self.paused.insert(
                format!("addr:{}", hex_addr(&address)),
                BreakerTrip {
                    scope: PauseScope::AddressTransfers,
                    address: Some(address),
                    reason: format!("drain {}% in {} blocks", pct, window),
                    tripped_at_height: height,
                },
            );
            return true;
        }
        false
    }

    /// Record an oracle price sample and check the deviation breaker.
    /// Returns true if the breaker tripped (price moved > threshold_pct).
    pub fn record_oracle_price(&mut self, price: u128, height: u64) -> bool {
        self.oracle_samples.push((height, price));
        let window = self.oracle_config.window_blocks;
        // Prune old samples
        self.oracle_samples
            .retain(|(h, _)| height.saturating_sub(*h) <= window);
        if self.oracle_samples.len() < 2 {
            return false;
        }
        let oldest = self.oracle_samples.first().unwrap().1;
        let newest = *self.oracle_samples.last().unwrap();
        if oldest == 0 {
            return false;
        }
        // Absolute percentage deviation
        let diff = if newest.1 > oldest {
            newest.1 - oldest
        } else {
            oldest - newest.1
        };
        let deviation = (diff * 100) / oldest;
        if deviation > self.oracle_config.threshold_pct as u128 {
            self.paused.insert(
                "oracle".to_string(),
                BreakerTrip {
                    scope: PauseScope::OracleOps,
                    address: None,
                    reason: format!("oracle deviation {}% in {} blocks", deviation, window),
                    tripped_at_height: height,
                },
            );
            return true;
        }
        false
    }

    /// Is a given operation paused? Checks global first, then address, then
    /// oracle scope.
    pub fn is_paused(&self, scope: PauseScope, address: Option<[u8; 20]>) -> bool {
        // Global pause blocks everything
        if self.paused.contains_key("global") {
            return true;
        }
        match scope {
            PauseScope::Global => self.paused.contains_key("global"),
            PauseScope::AddressTransfers => {
                if let Some(addr) = address {
                    self.paused.contains_key(&format!("addr:{}", hex_addr(&addr)))
                } else {
                    false
                }
            }
            PauseScope::OracleOps => self.paused.contains_key("oracle"),
        }
    }

    /// Manually trigger a global pause (governance / emergency).
    pub fn pause_global(&mut self, reason: &str, height: u64) {
        self.paused.insert(
            "global".to_string(),
            BreakerTrip {
                scope: PauseScope::Global,
                address: None,
                reason: reason.to_string(),
                tripped_at_height: height,
            },
        );
    }

    /// Clear a specific pause (governance recovery).
    pub fn clear(&mut self, key: &str) {
        self.paused.remove(key);
    }

    /// Is the breaker currently healthy (no pauses)?
    pub fn is_healthy(&self) -> bool {
        self.paused.is_empty()
    }

    /// Active trips (for RPC observability).
    pub fn active_trips(&self) -> Vec<&BreakerTrip> {
        self.paused.values().collect()
    }
}

fn hex_addr(addr: &[u8; 20]) -> String {
    addr.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drain_trips_breaker() {
        let mut cb = CircuitBreaker::new();
        // 30% drain in one block -> exceeds 25% threshold
        assert!(cb.record_outflow([1; 20], 30, 100, 1));
        assert!(cb.is_paused(PauseScope::AddressTransfers, Some([1; 20])));
        // Other addresses unaffected
        assert!(!cb.is_paused(PauseScope::AddressTransfers, Some([2; 20])));
    }

    #[test]
    fn small_drain_does_not_trip() {
        let mut cb = CircuitBreaker::new();
        assert!(!cb.record_outflow([1; 20], 10, 100, 1)); // 10%
        assert!(cb.is_healthy());
    }

    #[test]
    fn oracle_deviation_trips() {
        let mut cb = CircuitBreaker::new();
        cb.record_oracle_price(1000, 1); // baseline
        // 10% jump in one block -> exceeds 5% threshold
        assert!(cb.record_oracle_price(1100, 2));
        assert!(cb.is_paused(PauseScope::OracleOps, None));
    }

    #[test]
    fn oracle_stable_does_not_trip() {
        let mut cb = CircuitBreaker::new();
        cb.record_oracle_price(1000, 1);
        assert!(!cb.record_oracle_price(1003, 2)); // 0.3%
        assert!(cb.is_healthy());
    }

    #[test]
    fn global_pause_blocks_everything() {
        let mut cb = CircuitBreaker::new();
        cb.pause_global("emergency", 5);
        assert!(cb.is_paused(PauseScope::Global, None));
        assert!(cb.is_paused(PauseScope::AddressTransfers, Some([1; 20])));
        assert!(cb.is_paused(PauseScope::OracleOps, None));
    }

    #[test]
    fn clear_recovers() {
        let mut cb = CircuitBreaker::new();
        cb.pause_global("emergency", 5);
        cb.clear("global");
        assert!(cb.is_healthy());
    }

    #[test]
    fn window_pruning_keeps_recent() {
        let mut cb = CircuitBreaker::new();
        // 20% at block 1 (under threshold), then window expires, then 20% at
        // block 200 -- the old sample must NOT accumulate (it's pruned).
        cb.record_outflow([1; 20], 20, 100, 1);
        assert!(!cb.is_paused(PauseScope::AddressTransfers, Some([1; 20])));
        cb.record_outflow([1; 20], 20, 100, 200);
        // Only the recent 20% counts -- under threshold -> healthy
        assert!(cb.is_healthy());
    }
}
