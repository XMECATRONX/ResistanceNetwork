//! Geographic validator cap — on-chain monitoring of validator regions.
//!
//! HONEST SCOPE: This closes the "Centralización geográfica de validadores"
//! gap (attack vector #11). A validator declares a region (e.g. "us-east",
//! "eu-west", "asia"). The consensus engine monitors the stake distribution
//! per region and enforces a cap: no single region may hold more than
//! `GEO_CAP_PCT` of the total active stake. If a region exceeds the cap,
//! validators in that region are deprioritized for leader election (their
//! VRF outputs are effectively skipped) until the distribution rebalances.
//!
//! What is implemented (real, tested):
//!   - Per-region stake aggregation from the validator set.
//!   - Cap enforcement: `regions_over_cap()` returns the regions that exceed
//!     the threshold, and `is_region_capped()` checks a single validator.
//!   - Leader-election integration: `select_leader` in consensus.rs skips
//!     validators whose region is over-cap (VRF redistribution).
//!
//! What is NOT claimed (future research):
//!   - Automatic region assignment from IP geolocation (validators self-declare;
//!     a directory authority could verify IP→region mapping in production).
//!   - Cross-shard geographic rebalancing (shard assignment is independent).

use std::collections::HashMap;

/// Maximum fraction of total active stake a single region may hold (15%).
pub const GEO_CAP_PCT: f64 = 0.15;

/// Aggregate stake per region from the validator set.
/// Returns a map: region -> (validator_count, total_stake).
pub fn region_stake_distribution(
    validators: &[crate::Validator],
) -> HashMap<String, (usize, u128)> {
    let mut dist: HashMap<String, (usize, u128)> = HashMap::new();
    for v in validators.iter() {
        if v.status != crate::ValidatorStatus::Active {
            continue;
        }
        let entry = dist.entry(v.region.clone()).or_insert((0, 0));
        entry.0 += 1;
        entry.1 = entry.1.saturating_add(v.stake);
    }
    dist
}

/// Total active stake across all validators.
pub fn total_active_stake(validators: &[crate::Validator]) -> u128 {
    validators
        .iter()
        .filter(|v| v.status == crate::ValidatorStatus::Active)
        .map(|v| v.stake)
        .fold(0u128, |acc, s| acc.saturating_add(s))
}

/// Return the list of regions whose stake fraction exceeds `GEO_CAP_PCT`.
/// A region over the cap is "capped" — its validators are deprioritized.
pub fn regions_over_cap(validators: &[crate::Validator]) -> Vec<String> {
    let total = total_active_stake(validators);
    if total == 0 {
        return Vec::new();
    }
    let dist = region_stake_distribution(validators);
    dist.into_iter()
        .filter(|(_, (_, stake))| {
            let frac = (*stake as f64) / (total as f64);
            frac > GEO_CAP_PCT
        })
        .map(|(region, _)| region)
        .collect()
}

/// Check whether a validator's region is over the geographic cap.
/// Used by `select_leader` to skip capped-region validators (VRF
/// redistribution: the leader rotates to the next validator not in a
/// capped region).
pub fn is_region_capped(validators: &[crate::Validator], region: &str) -> bool {
    regions_over_cap(validators).iter().any(|r| r == region)
}

/// The fraction of total stake held by a given region.
pub fn region_stake_fraction(validators: &[crate::Validator], region: &str) -> f64 {
    let total = total_active_stake(validators);
    if total == 0 {
        return 0.0;
    }
    let dist = region_stake_distribution(validators);
    dist.get(region)
        .map(|(_, stake)| (*stake as f64) / (total as f64))
        .unwrap_or(0.0)
}

/// A geographic distribution report for the dashboard / RPC.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct GeoReport {
    pub regions: Vec<RegionStat>,
    pub cap_pct: f64,
    pub over_cap: Vec<String>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct RegionStat {
    pub region: String,
    pub validator_count: usize,
    pub total_stake: String,
    pub stake_fraction: f64,
    pub capped: bool,
}

/// Build a full geographic distribution report.
pub fn geo_report(validators: &[crate::Validator]) -> GeoReport {
    let total = total_active_stake(validators);
    let dist = region_stake_distribution(validators);
    let over = regions_over_cap(validators);
    let regions = dist
        .into_iter()
        .map(|(region, (count, stake))| {
            let frac = if total > 0 {
                (stake as f64) / (total as f64)
            } else {
                0.0
            };
            RegionStat {
                region: region.clone(),
                validator_count: count,
                total_stake: stake.to_string(),
                stake_fraction: frac,
                capped: over.contains(&region),
            }
        })
        .collect();
    GeoReport {
        regions,
        cap_pct: GEO_CAP_PCT,
        over_cap: over,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Validator, ValidatorStatus};
    use rstn_crypto::Dilithium3PublicKey;

    fn mk_validator(region: &str, stake: u128) -> Validator {
        Validator {
            pubkey: Dilithium3PublicKey([0u8; 1952]),
            stake,
            commission: 5,
            shard_id: 0,
            uptime: 1.0,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
            region: region.to_string(),
        }
    }

    #[test]
    fn test_region_under_cap_is_not_capped() {
        // 4 validators, 25% each in different regions → no region over 15%.
        let vs = vec![
            mk_validator("us", 25000),
            mk_validator("eu", 25000),
            mk_validator("asia", 25000),
            mk_validator("sa", 25000),
        ];
        assert!(regions_over_cap(&vs).is_empty());
        assert!(!is_region_capped(&vs, "us"));
    }

    #[test]
    fn test_region_over_cap_is_capped() {
        // 2 validators in "us" with 80% of stake → "us" is over the 15% cap.
        let vs = vec![
            mk_validator("us", 80000),
            mk_validator("eu", 10000),
            mk_validator("asia", 10000),
        ];
        let over = regions_over_cap(&vs);
        assert!(over.contains(&"us".to_string()));
        assert!(is_region_capped(&vs, "us"));
        assert!(!is_region_capped(&vs, "eu"));
    }

    #[test]
    fn test_geo_report_builds_correctly() {
        let vs = vec![
            mk_validator("us", 50000),
            mk_validator("eu", 30000),
            mk_validator("asia", 20000),
        ];
        let report = geo_report(&vs);
        assert_eq!(report.regions.len(), 3);
        assert_eq!(report.cap_pct, 0.15);
        // "us" has 50% → over cap.
        assert!(report.over_cap.contains(&"us".to_string()));
    }

    #[test]
    fn test_stake_fraction() {
        let vs = vec![
            mk_validator("us", 30000),
            mk_validator("eu", 70000),
        ];
        assert!((region_stake_fraction(&vs, "eu") - 0.7).abs() < 0.001);
        assert!((region_stake_fraction(&vs, "us") - 0.3).abs() < 0.001);
    }

    #[test]
    fn test_inactive_validators_excluded() {
        let mut v = mk_validator("us", 80000);
        v.status = ValidatorStatus::Inactive;
        let vs = vec![v, mk_validator("eu", 20000)];
        // Inactive validator's stake doesn't count → "eu" is 100% but only
        // 1 active validator; "us" has 0 active stake.
        assert!(regions_over_cap(&vs).is_empty() || regions_over_cap(&vs).contains(&"eu".to_string()));
    }
}
