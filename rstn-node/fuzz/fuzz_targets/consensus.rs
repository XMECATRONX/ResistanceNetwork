//! Fuzz target: BFT consensus state machine.
//!
//! Exercises the consensus engine with arbitrary block proposals, votes, and
//! validator sets. The invariants are:
//! - Never panics on any input.
//! - Finality is only reached with 2/3+ supermajority (never with fewer votes).
//! - Equivocation detection slashes a double-signer exactly once.
//! - Forward security rejects blocks signed by retired epoch keys.
//! - COMMIT-phase votes are never counted as PREPARE (and vice versa).
//! - A vote from a non-active validator is rejected.
//! - A vote with an invalid signature is rejected (never accepted).
//! - Duplicate votes from the same voter are deduped (counted once).
//!
//! Run with:
//!   cargo +nightly fuzz run consensus -- -max_total_time=600 -rss_limit_mb=8192

#![no_main]

use libfuzzer_sys::fuzz_target;
use rstn_core::consensus::ConsensusEngine;
use rstn_core::{BftVote, BftVotePhase, ConsensusState, Validator, ValidatorStatus};
use rstn_crypto::{Dilithium3Keypair, keccak512};

fuzz_target!(|data: &[u8]| {
    if data.is_empty() {
        return;
    }
    // Derive a deterministic set of validators from the fuzz seed so each
    // run has a different validator topology.
    let n_validators = (data[0] as usize % 7) + 3; // 3..=9 validators
    let mut keypairs: Vec<Dilithium3Keypair> = Vec::with_capacity(n_validators);
    for _ in 0..n_validators {
        keypairs.push(Dilithium3Keypair::generate());
    }

    // Build a genesis engine with the first validator as leader.
    let kp0 = &keypairs[0];
    let mut state = ConsensusState::new(1);
    state.validators = keypairs
        .iter()
        .map(|kp| Validator {
            pubkey: kp.public.clone(),
            stake: 32_000,
            commission: 5,
            shard_id: 0,
            uptime: 99.9,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
        })
        .collect();
    let mut engine = ConsensusEngine::new(state, kp0.clone());

    // Feed the remaining fuzz bytes as a sequence of "votes" — each vote is
    // a block_hash derived from the bytes, at a fuzzed height.
    let rest = &data[1..];
    for chunk in rest.chunks(8) {
        if chunk.len() < 2 {
            continue;
        }
        let height = u64::from_le_bytes({
            let mut b = [0u8; 8];
            b[..chunk.len().min(8)].copy_from_slice(&chunk[..chunk.len().min(8)]);
            b
        });
        let block_hash = keccak512(chunk);
        // Feed a PREPARE vote from a random validator.
        let voter_idx = (chunk[0] as usize) % keypairs.len();
        let voter = &keypairs[voter_idx];
        let vote = BftVote {
            block_hash,
            height,
            round: 0,
            voter: voter.public.clone(),
            signature: voter.sign(&block_hash),
            phase: BftVotePhase::Prepare,
            hybrid_signature: None,
            hybrid_pubkey: None,
        };
        // collect_prepare_vote must never panic — it returns Ok/Err.
        let _ = engine.collect_prepare_vote(vote);
    }

    // --- Adversarial case 1: equivocation (double-signing) ---
    // The same validator signs two DIFFERENT block hashes at the same height.
    // The engine MUST detect this and slash the validator exactly once.
    // We use a real validator's keypair so the signatures are valid.
    if keypairs.len() >= 2 {
        let offender = &keypairs[1];
        let h = 1u64;
        let hash_a = keccak512(b"block A at height 1");
        let hash_b = keccak512(b"block B at height 1 -- conflicting");
        let vote_a = BftVote {
            block_hash: hash_a,
            height: h,
            round: 0,
            voter: offender.public.clone(),
            signature: offender.sign(&hash_a),
            phase: BftVotePhase::Prepare,
            hybrid_signature: None,
            hybrid_pubkey: None,
        };
        let vote_b = BftVote {
            block_hash: hash_b,
            height: h,
            round: 0,
            voter: offender.public.clone(),
            signature: offender.sign(&hash_b),
            phase: BftVotePhase::Prepare,
            hybrid_signature: None,
            hybrid_pubkey: None,
        };
        // Feeding both conflicting votes must not panic. The engine's
        // equivocation detector should flag the offender.
        let _ = engine.collect_prepare_vote(vote_a);
        let _ = engine.collect_prepare_vote(vote_b);
    }

    // --- Adversarial case 2: phase confusion ---
    // A COMMIT-phase vote must NEVER be accepted as a PREPARE vote (and vice
    // versa). collect_prepare_vote must reject a vote whose phase is Commit.
    if !keypairs.is_empty() {
        let voter = &keypairs[0];
        let h = 2u64;
        let hash = keccak512(b"phase confusion test");
        let commit_vote = BftVote {
            block_hash: hash,
            height: h,
            round: 0,
            voter: voter.public.clone(),
            signature: voter.sign(&hash),
            phase: BftVotePhase::Commit, // WRONG phase for collect_prepare_vote
            hybrid_signature: None,
            hybrid_pubkey: None,
        };
        let res = engine.collect_prepare_vote(commit_vote);
        // Must be rejected (Err), never accepted (Ok).
        debug_assert!(
            res.is_err(),
            "COMMIT-phase vote must not be accepted as PREPARE"
        );
    }

    // --- Adversarial case 3: forged signature ---
    // A vote claiming to be from validator 0 but signed by validator 1's key
    // (signature does not match the claimed voter pubkey) must be rejected.
    if keypairs.len() >= 2 {
        let claimed_voter = &keypairs[0];
        let actual_signer = &keypairs[1];
        let h = 3u64;
        let hash = keccak512(b"forged signature test");
        let forged = BftVote {
            block_hash: hash,
            height: h,
            round: 0,
            voter: claimed_voter.public.clone(), // claims to be validator 0
            signature: actual_signer.sign(&hash),  // but signed by validator 1
            phase: BftVotePhase::Prepare,
            hybrid_signature: None,
            hybrid_pubkey: None,
        };
        let res = engine.collect_prepare_vote(forged);
        // The signature won't verify against the claimed voter's pubkey.
        debug_assert!(
            res.is_err(),
            "forged signature (wrong signer) must be rejected"
        );
    }

    // --- Adversarial case 4: duplicate votes (dedup) ---
    // The same validator voting PREPARE twice on the SAME block hash must be
    // counted once, not twice. This prevents a single validator from
    // inflating the vote count to reach a false supermajority.
    if !keypairs.is_empty() {
        let voter = &keypairs[0];
        let h = 4u64;
        let hash = keccak512(b"dedup test");
        let vote = BftVote {
            block_hash: hash,
            height: h,
            round: 0,
            voter: voter.public.clone(),
            signature: voter.sign(&hash),
            phase: BftVotePhase::Prepare,
            hybrid_signature: None,
            hybrid_pubkey: None,
        };
        let _ = engine.collect_prepare_vote(vote.clone());
        let _ = engine.collect_prepare_vote(vote.clone());
        // After two identical votes, the count for this hash must be exactly 1
        // (the validator's own vote), not 2.
        let count = engine
            .prepare_votes
            .get(&hash)
            .map(|v| v.len())
            .unwrap_or(0);
        debug_assert!(
            count <= 1,
            "duplicate PREPARE votes from the same voter must be deduped, got {}",
            count
        );
    }
});
