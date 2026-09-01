//! Adversarial tests for Tier 3 features:
//! - Reed-Solomon erasure coding (DAS foundation)
//! - Governance flash-loan protection
//! - On-chain circuit breakers
//!
//! These tests attack the features the way an adversary would:
//! - Withholding shards, corrupting shards, exceeding thresholds,
//!   flash-loan governance capture, oracle manipulation, drain attacks.

use rstn_core::erasure;
use rstn_core::governance::{Proposal, VoteChoice, GovernanceError};
use rstn_core::circuit_breaker::{CircuitBreaker, PauseScope};

// ===== Reed-Solomon adversarial =====

#[test]
fn erasure_survives_any_two_shards_lost() {
    // 4 data shards + 2 parity = 6 total. Lose any 2 -> reconstruct.
    let data: Vec<Vec<u8>> = (0..4).map(|i| {
        (0..32).map(|j| (i * 32 + j) as u8).collect()
    }).collect();
    let encoded = erasure::encode(&data, 2);
    assert_eq!(encoded.len(), 6);

    // Try every combination of 4 surviving shards out of 6
    for lost1 in 0..6 {
        for lost2 in lost1..6 {
            let surviving: Vec<(usize, Vec<u8>)> = (0..6)
                .filter(|i| *i != lost1 && *i != lost2)
                .map(|i| (i, encoded[i].clone()))
                .collect();
            assert_eq!(surviving.len(), 4);
            let decoded = erasure::reconstruct(&surviving, 4, 32);
            assert_eq!(decoded, data, "reconstruction failed losing shards {} and {}", lost1, lost2);
        }
    }
}

#[test]
fn erasure_rejects_wrong_shard_count() {
    let data = vec![vec![1, 2, 3, 4], vec![5, 6, 7, 8]];
    let encoded = erasure::encode(&data, 2);
    // Only 1 surviving shard when 2 needed -> must panic (assert)
    let result = std::panic::catch_unwind(|| {
        erasure::reconstruct(&[(0, encoded[0].clone())], 2, 4);
    });
    assert!(result.is_err(), "reconstruct with too few shards must panic");
}

#[test]
fn erasure_bytes_roundtrip_large() {
    // 10 KB of pseudo-random data, 4 data + 3 parity shards (small case)
    let mut orig = Vec::new();
    let mut x: u8 = 1;
    for _ in 0..10_000 {
        x = x.wrapping_mul(31).wrapping_add(17);
        orig.push(x);
    }
    // Use a small shard size so k is manageable. shard_len=256 -> k=40.
    let k = (orig.len() + 255) / 256;
    let m = 3;
    let encoded = erasure::encode_bytes(&orig, 256, m);
    assert_eq!(encoded.len(), k + m);
    // Lose the first 3 data shards (0,1,2). Reconstruct from the remaining
    // (k - 3) data shards + the 3 parity shards = k shards total.
    let surviving: Vec<(usize, Vec<u8>)> = (3..k + m)
        .map(|i| (i, encoded[i].clone()))
        .collect();
    assert_eq!(surviving.len(), k);
    let decoded = erasure::reconstruct_bytes(&surviving, k, 256, orig.len());
    assert_eq!(decoded, orig);
}

#[test]
fn erasure_zero_padding_reconstructs() {
    // Data whose last shard is all-zero (padding) -- reconstruction must
    // still produce the correct (zero) padding, not garbage.
    let orig = vec![1u8, 2, 3, 4, 5, 6]; // < 1 shard of 16 bytes
    let encoded = erasure::encode_bytes(&orig, 16, 2);
    // k=1 data shard; lose it (shard 0), reconstruct from a parity shard.
    let surviving = vec![(1, encoded[1].clone())];
    let decoded = erasure::reconstruct_bytes(&surviving, 1, 16, orig.len());
    assert_eq!(decoded, orig);
}

// ===== Governance adversarial =====

#[test]
fn flash_loan_governance_attack_defeated() {
    // Attacker takes a flash loan at block 20 to swing a vote at block 21.
    // The snapshot was taken at block 10 (proposal creation). The attacker's
    // stake at block 10 was 0 (they didn't hold tokens then). Their vote
    // carries 0 power -> attack defeated.
    let mut proposal = Proposal::new(1, [0u8; 20], 10, 50);
    // Honest voters held tokens at snapshot (block 10)
    proposal.vote([1; 20], 1_000_000, VoteChoice::For).unwrap();
    proposal.vote([2; 20], 800_000, VoteChoice::For).unwrap();
    // Flash-loan attacker votes with 0 power at snapshot
    proposal.vote([3; 20], 0, VoteChoice::Against).unwrap();
    // The attacker's "stake" at vote time was 5,000,000 (flash loan) but at
    // snapshot it was 0 -> weight_against = 0
    assert_eq!(proposal.weight_against(), 0);
    assert!(proposal.has_quorum(1_800_000));
}

#[test]
fn whale_cannot_unilaterally_pass_with_quadratic_voting() {
    // A whale with 100x the stake of the median voter. With linear voting
    // they'd dominate; with quadratic they have 10x -- still influential
    // but the small holders can out-vote them collectively.
    let mut proposal = Proposal::new(1, [0u8; 20], 10, 50);
    // Whale: 100,000,000 stake -> 10,000 weight
    proposal.vote([1; 20], 100_000_000, VoteChoice::Against).unwrap();
    // 1,000 small holders, each 10,000 stake -> 100 weight each = 100,000 total
    for i in 0u8..200 {
        proposal.vote([i; 20], 10_000, VoteChoice::For).unwrap();
    }
    // Whale weight = 10,000; small holders weight = 200 * 100 = 20,000
    assert_eq!(proposal.weight_against(), 10_000);
    assert_eq!(proposal.weight_for(), 20_000);
    assert!(proposal.weight_for() > proposal.weight_against());
}

#[test]
fn timelock_prevents_same_block_attack() {
    // Proposal passes at block 15. Timelock = 1 epoch. Even with quorum,
    // immediate execution is blocked.
    let mut proposal = Proposal::new(1, [0u8; 20], 10, 50);
    proposal.vote([1; 20], 1_000_000, VoteChoice::For).unwrap();
    proposal.mark_passed(15);
    assert!(!proposal.can_execute(15));
    assert!(!proposal.can_execute(15 + 100));
    assert!(proposal.can_execute(15 + 1000)); // EPOCH_LENGTH = 1000
}

#[test]
fn minority_veto_blocks_even_post_timelock() {
    let mut proposal = Proposal::new(1, [0u8; 20], 10, 50);
    proposal.vote([1; 20], 1_000_000, VoteChoice::For).unwrap();
    proposal.mark_passed(15);
    // 12% minority veto (threshold 10%)
    assert!(proposal.veto(120_000, 1_000_000, 10));
    // Even after timelock, vetoed proposals cannot execute
    assert!(!proposal.can_execute(15 + 1000));
}

#[test]
fn double_vote_rejected() {
    let mut proposal = Proposal::new(1, [0u8; 20], 10, 50);
    proposal.vote([1; 20], 100, VoteChoice::For).unwrap();
    assert_eq!(
        proposal.vote([1; 20], 100, VoteChoice::For),
        Err(GovernanceError::AlreadyVoted)
    );
}

#[test]
fn future_snapshot_rejected() {
    use rstn_core::governance::validate_snapshot;
    // A snapshot at the current block or future would let flash loans
    // influence it -- must be strictly in the past.
    assert!(!validate_snapshot(15, 15)); // same block
    assert!(!validate_snapshot(16, 15)); // future
    assert!(validate_snapshot(10, 15)); // past -> OK
}

// ===== Circuit breaker adversarial =====

#[test]
fn drain_attack_trips_breaker() {
    // An attacker drains 30% of an address's balance in one block.
    // The breaker must trip and block further transfers from that address.
    let mut cb = CircuitBreaker::new();
    assert!(cb.record_outflow([1; 20], 30, 100, 1));
    assert!(cb.is_paused(PauseScope::AddressTransfers, Some([1; 20])));
    // The attacker's address is blocked; others are not
    assert!(!cb.is_paused(PauseScope::AddressTransfers, Some([2; 20])));
}

#[test]
fn slow_drain_evades_breaker_but_capped() {
    // 10% per block for 3 blocks = 30% total, but the window (100 blocks)
    // accumulates -> trips at 30% cumulative.
    let mut cb = CircuitBreaker::new();
    assert!(!cb.record_outflow([1; 20], 10, 100, 1));
    assert!(!cb.record_outflow([1; 20], 10, 100, 2));
    // Third 10% -> 30% cumulative > 25% threshold -> trip
    assert!(cb.record_outflow([1; 20], 10, 100, 3));
}

#[test]
fn oracle_manipulation_trips() {
    let mut cb = CircuitBreaker::new();
    cb.record_oracle_price(1000, 1); // baseline
    // 20% manipulation in one block -> trips at 5% threshold
    assert!(cb.record_oracle_price(1200, 2));
    assert!(cb.is_paused(PauseScope::OracleOps, None));
}

#[test]
fn oracle_downward_manipulation_trips() {
    let mut cb = CircuitBreaker::new();
    cb.record_oracle_price(1000, 1);
    // 15% downward -> trips
    assert!(cb.record_oracle_price(850, 2));
}

#[test]
fn window_expiry_allows_new_drain() {
    // After the window expires, a new drain is evaluated fresh -- the breaker
    // doesn't permanently block an address that drained once long ago.
    let mut cb = CircuitBreaker::new();
    cb.record_outflow([1; 20], 20, 100, 1); // 20% (under 25%)
    // 200 blocks later -- window is 100, so the old sample is pruned
    assert!(!cb.record_outflow([1; 20], 20, 100, 200));
    assert!(cb.is_healthy());
}

#[test]
fn global_pause_blocks_all_scopes() {
    let mut cb = CircuitBreaker::new();
    cb.pause_global("governance emergency: anomalous outflow detected", 5);
    assert!(cb.is_paused(PauseScope::Global, None));
    assert!(cb.is_paused(PauseScope::AddressTransfers, Some([1; 20])));
    assert!(cb.is_paused(PauseScope::OracleOps, None));
}

#[test]
fn breaker_recovery_via_clear() {
    let mut cb = CircuitBreaker::new();
    cb.record_outflow([1; 20], 30, 100, 1);
    assert!(!cb.is_healthy());
    cb.clear("addr:0101010101010101010101010101010101010101");
    assert!(cb.is_healthy());
}
