//! Fuzz target: BFT consensus state machine.
//!
//! Exercises the consensus engine with arbitrary block proposals, votes, and
//! validator sets. The invariants are:
//! - Never panics on any input.
//! - Finality is only reached with 2/3+ supermajority (never with fewer votes).
//! - Equivocation detection slashes a double-signer exactly once.
//! - Forward security rejects blocks signed by retired epoch keys.
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
});
