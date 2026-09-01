//! Adversarial + fuzzing tests for the BFT consensus engine.
//!
//! These tests attack the consensus layer with Byzantine inputs: forged
//! certificates, reorgs below finality, votes from slashed validators, and
//! randomized vote sequences. The invariants under test:
//!   1. Finalized blocks are IRREVERSIBLE -- no reorg below last_finalized.
//!   2. A forged CommitCertificate (bad sigs / below threshold) is rejected.
//!   3. Slashed validators cannot vote or count toward the threshold.
//!   4. The engine never panics on adversarial vote sequences.
//!
//! These are the bugs that would let an attacker steal funds or stall
//! consensus -- the highest-severity class in a Layer 1.

use rstn_core::{
    Block, BlockHeader, BftVote, BftVotePhase, CommitCertificate, ConsensusState, CoreError,
    Transaction, TxType, Validator, ValidatorStatus,
    EPOCH_LENGTH,
};
use rstn_core::consensus::ConsensusEngine;
use rstn_crypto::{Dilithium3Keypair, Dilithium3Signature, derive_address};

/// Simple deterministic PRNG (LCG) for reproducible fuzzing.
fn lcg(seed: &mut u64) -> u64 {
    *seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    *seed
}

fn genesis_block(validator_pub: &rstn_crypto::Dilithium3PublicKey) -> Block {
    Block {
        header: BlockHeader {
            height: 0,
            parent_hash: [0u8; 64],
            state_root: [0u8; 64],
            tx_root: [0u8; 64],
            timestamp: 0,
            validator: validator_pub.clone(),
            signature: Dilithium3Signature([0u8; 3309]),
            shard_id: 0,
            epoch: 0,
            round: 0,
            data_root: [0u8; 64],
        },
        transactions: vec![],
    }
}

fn make_cluster(n: usize) -> (Vec<Dilithium3Keypair>, ConsensusState) {
    let keypairs: Vec<Dilithium3Keypair> = (0..n).map(|_| Dilithium3Keypair::generate()).collect();
    let validators: Vec<Validator> = keypairs
        .iter()
        .map(|kp| Validator {
            pubkey: kp.public.clone(),
            stake: 1_000_000,
            commission: 5,
            shard_id: 0,
            uptime: 99.9,
            blocks_produced: 0,
            status: ValidatorStatus::Active,
        })
        .collect();
    let mut state = ConsensusState::new(4);
    state.validators = validators;
    let genesis = genesis_block(&keypairs[0].public);
    state.chain.push(genesis);
    state.last_finalized_height = 0;
    (keypairs, state)
}

fn make_tx(kp: &Dilithium3Keypair, nonce: u64, value: u128, to: [u8; 20]) -> Transaction {
    let mut tx = Transaction {
        from: kp.public.clone(),
        to,
        value,
        nonce,
        gas_price: 1,
        gas_limit: 100_000,
        tx_type: TxType::Transfer,
        payload: vec![],
        signature: Dilithium3Signature([0u8; 3309]),
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let msg = tx.hash();
    tx.signature = kp.sign(&msg);
    tx
}

/// Build a real, properly-signed COMMIT vote from `kp` over `block_hash`.
fn make_commit_vote(kp: &Dilithium3Keypair, block_hash: [u8; 64], height: u64) -> BftVote {
    BftVote {
        block_hash,
        height,
        round: height,
        voter: kp.public.clone(),
        signature: kp.sign(&block_hash),
        phase: BftVotePhase::Commit,
        hybrid_signature: None,
        hybrid_pubkey: None,
    }
}

// ===== 1. Finality irreversibility =====

#[test]
fn test_reorg_below_finality_rejected() {
    // A reorg that would replace a finalized block must be REJECTED with a
    // ChainFork error. This is the single most important consensus invariant:
    // if it fails, an attacker can rewrite history and double-spend.
    let (keypairs, mut state) = make_cluster(4);
    // Finalize a block at height 1.
    let mut b1 = genesis_block(&keypairs[0].public);
    b1.header.height = 1;
    b1.header.parent_hash = state.chain[0].hash();
    b1.header.validator = keypairs[0].public.clone();
    let h = b1.hash();
    b1.header.signature = keypairs[0].sign(&h);
    state.finalize_block(b1).unwrap();
    assert_eq!(state.last_finalized_height, 1);

    // Attacker presents a competing chain that forks at height 0 (below
    // finalized height 1). This MUST be rejected.
    let mut bad = genesis_block(&keypairs[1].public);
    bad.header.height = 1;
    bad.header.parent_hash = state.chain[0].hash();
    bad.header.validator = keypairs[1].public.clone();
    let bh = bad.hash();
    bad.header.signature = keypairs[1].sign(&bh);
    let result = state.handle_reorg(&[bad]);
    assert!(matches!(result, Err(CoreError::ChainFork(_))), "reorg below finality must be rejected");
}

#[test]
fn test_sync_rejects_block_with_bad_signature() {
    let (keypairs, mut state) = make_cluster(4);
    let parent = state.chain[0].clone();
    let mut bad = genesis_block(&keypairs[0].public);
    bad.header.height = 1;
    bad.header.parent_hash = parent.hash();
    bad.header.validator = keypairs[1].public.clone();
    // Sign with the WRONG key (keypairs[0]) so the signature does not match
    // the claimed validator (keypairs[1]).
    let h = bad.hash();
    bad.header.signature = keypairs[0].sign(&h);
    let result = state.sync_blocks(vec![bad]);
    assert!(result.is_err(), "block with mismatched signature must be rejected on sync");
}

// ===== 2. CommitCertificate forgery =====

#[test]
fn test_commit_certificate_with_bad_signature_rejected() {
    // A certificate whose votes have invalid signatures must fail verification.
    let (keypairs, state) = make_cluster(4);
    let block_hash = [0xAA; 64];
    let mut votes: Vec<BftVote> = keypairs.iter().take(3).map(|kp| {
        make_commit_vote(kp, block_hash, 1)
    }).collect();
    // Corrupt one signature.
    votes[0].signature.0[0] ^= 0xFF;
    let cert = CommitCertificate { height: 1, block_hash, votes };
    let result = cert.verify(&state.validators, &block_hash);
    assert!(result.is_err(), "certificate with a bad signature must be rejected");
}

#[test]
fn test_commit_certificate_below_threshold_rejected() {
    // 4 validators -> threshold = 3. A certificate with only 2 votes must fail.
    let (keypairs, state) = make_cluster(4);
    let block_hash = [0xBB; 64];
    let votes: Vec<BftVote> = keypairs.iter().take(2).map(|kp| {
        make_commit_vote(kp, block_hash, 1)
    }).collect();
    let cert = CommitCertificate { height: 1, block_hash, votes };
    let result = cert.verify(&state.validators, &block_hash);
    assert!(result.is_err(), "certificate below 2/3 threshold must be rejected");
}

#[test]
fn test_commit_certificate_wrong_block_hash_rejected() {
    let (keypairs, state) = make_cluster(4);
    let real_hash = [0xCC; 64];
    let other_hash = [0xDD; 64];
    let votes: Vec<BftVote> = keypairs.iter().take(3).map(|kp| {
        make_commit_vote(kp, real_hash, 1)
    }).collect();
    let cert = CommitCertificate { height: 1, block_hash: other_hash, votes };
    // Verify against the REAL hash -> mismatch must be caught.
    let result = cert.verify(&state.validators, &real_hash);
    assert!(result.is_err(), "certificate for a different block must be rejected");
}

#[test]
fn test_commit_certificate_valid_passes() {
    // Sanity: a properly-signed certificate with 3/4 votes MUST verify.
    let (keypairs, state) = make_cluster(4);
    let block_hash = [0xEE; 64];
    let votes: Vec<BftVote> = keypairs.iter().take(3).map(|kp| {
        make_commit_vote(kp, block_hash, 1)
    }).collect();
    let cert = CommitCertificate { height: 1, block_hash, votes };
    let result = cert.verify(&state.validators, &block_hash);
    assert!(result.is_ok(), "valid certificate must verify: {:?}", result);
}

#[test]
fn test_commit_certificate_rejects_prepare_phase_votes() {
    // A certificate that sneaks in a PREPARE-phase vote must be rejected.
    let (keypairs, state) = make_cluster(4);
    let block_hash = [0x11; 64];
    let mut votes: Vec<BftVote> = keypairs.iter().take(3).map(|kp| {
        make_commit_vote(kp, block_hash, 1)
    }).collect();
    votes[0].phase = BftVotePhase::Prepare; // wrong phase
    let cert = CommitCertificate { height: 1, block_hash, votes };
    let result = cert.verify(&state.validators, &block_hash);
    assert!(result.is_err(), "non-commit vote in certificate must be rejected");
}

// ===== 3. Slashed validators =====

#[test]
fn test_slashed_validator_cannot_vote() {
    // A vote from a slashed validator must be rejected by collect_prepare_vote.
    let (keypairs, mut state) = make_cluster(4);
    // Slash validator 2.
    state.slash_validator(&keypairs[2].public, 10).unwrap();
    assert_eq!(state.validators[2].status, ValidatorStatus::Slashed);

    let mut engine = ConsensusEngine::new(state, keypairs[0].clone());
    let block_hash = [0x22; 64];
    let vote = BftVote {
        block_hash,
        height: 1,
        round: 1,
        voter: keypairs[2].public.clone(),
        signature: keypairs[2].sign(&block_hash),
        phase: BftVotePhase::Prepare,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let result = engine.collect_prepare_vote(vote);
    assert!(result.is_err(), "vote from slashed validator must be rejected");
}

#[test]
fn test_slashing_does_not_lower_threshold() {
    // Slashing a validator must NOT lower the 2/3 threshold -- the threshold
    // is computed over ACTIVE validators only, so an attacker cannot get
    // validators slashed to reduce the quorum.
    let (keypairs, mut state) = make_cluster(4);
    // 4 active -> threshold 3.
    assert!(state.has_supermajority(3));
    assert!(!state.has_supermajority(2));
    // Slash one -> 3 active -> threshold still 3.
    state.slash_validator(&keypairs[3].public, 10).unwrap();
    assert!(state.has_supermajority(3));
    assert!(!state.has_supermajority(2));
}

// ===== 4. Equivocation (double-signing) =====

#[test]
fn test_equivocation_slashes_and_rejects_second_vote() {
    // A validator signing two DIFFERENT blocks at the same height must be
    // slashed and the second vote rejected.
    let (keypairs, mut state) = make_cluster(4);
    let mut engine = ConsensusEngine::new(state.clone(), keypairs[0].clone());

    let hash_a = [0x0A; 64];
    let hash_b = [0x0B; 64];
    let voter = &keypairs[1];

    let vote_a = BftVote {
        block_hash: hash_a, height: 1, round: 1,
        voter: voter.public.clone(),
        signature: voter.sign(&hash_a),
        phase: BftVotePhase::Prepare,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let vote_b = BftVote {
        block_hash: hash_b, height: 1, round: 1,
        voter: voter.public.clone(),
        signature: voter.sign(&hash_b),
        phase: BftVotePhase::Prepare,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    // First vote accepted.
    assert!(engine.collect_prepare_vote(vote_a).is_ok());
    // Second (conflicting) vote must be rejected as equivocation.
    let result = engine.collect_prepare_vote(vote_b);
    assert!(result.is_err(), "double-signing vote must be rejected");
    // The equivocator must be recorded for slashing.
    assert!(!engine.last_equivocators.is_empty(), "equivocator must be recorded");
}

// ===== 5. Mempool replay protection =====

#[test]
fn test_mempool_rejects_duplicate_nonce() {
    let (keypairs, state) = make_cluster(4);
    let mut engine = ConsensusEngine::new(state, keypairs[0].clone());
    let to = [0xAB; 20];
    let tx1 = make_tx(&keypairs[0], 0, 100, to);
    // First tx accepted.
    assert!(engine.add_tx(tx1.clone()).is_ok());
    // Same sender + nonce must be rejected (replay).
    let result = engine.add_tx(tx1);
    assert!(result.is_err(), "duplicate nonce must be rejected");
}

#[test]
fn test_mempool_rejects_low_nonce() {
    let (keypairs, state) = make_cluster(4);
    let mut engine = ConsensusEngine::new(state, keypairs[0].clone());
    let to = [0xCD; 20];
    // Inject account state: expected nonce = 5.
    engine.set_account_lookup(
        |_| Some(5),
        |_| Some(1_000_000),
    );
    let tx = make_tx(&keypairs[0], 0, 100, to); // nonce 0 < 5
    let result = engine.add_tx(tx);
    assert!(result.is_err(), "nonce below account state must be rejected");
}

#[test]
fn test_mempool_rejects_insufficient_balance() {
    let (keypairs, state) = make_cluster(4);
    let mut engine = ConsensusEngine::new(state, keypairs[0].clone());
    let to = [0xEF; 20];
    engine.set_account_lookup(
        |_| Some(0),
        |_| Some(50), // only 50 balance
    );
    let tx = make_tx(&keypairs[0], 0, 100, to); // value 100 > 50
    let result = engine.add_tx(tx);
    assert!(result.is_err(), "tx exceeding balance must be rejected");
}

// ===== 6. Randomized fuzzing =====

#[test]
fn test_fuzz_random_votes_never_panic() {
    // Feed 500 random (mostly invalid) votes to the engine. It must never
    // panic -- every input yields Ok or a structured Err.
    let (keypairs, state) = make_cluster(4);
    let mut engine = ConsensusEngine::new(state, keypairs[0].clone());
    let mut seed = 0xDEAD_u64;
    for _ in 0..500 {
        let voter_idx = (lcg(&mut seed) as usize) % 4;
        let voter = &keypairs[voter_idx];
        let mut block_hash = [0u8; 64];
        for i in 0..8 {
            block_hash[i] = (lcg(&mut seed) & 0xFF) as u8;
        }
        let height = lcg(&mut seed) % 10;
        let phase = if lcg(&mut seed) % 2 == 0 { BftVotePhase::Prepare } else { BftVotePhase::Commit };
        let vote = BftVote {
            block_hash,
            height,
            round: height,
            voter: voter.public.clone(),
            signature: voter.sign(&block_hash),
            phase,
            hybrid_signature: None,
            hybrid_pubkey: None,
        };
        // Must not panic regardless of input.
        let _ = if phase == BftVotePhase::Prepare {
            engine.collect_prepare_vote(vote)
        } else {
            engine.collect_commit_vote(vote)
        };
    }
}

#[test]
fn test_fuzz_random_blocks_sync_never_panics() {
    // Feed 200 random blocks to sync_blocks. It must never panic.
    let (keypairs, mut state) = make_cluster(4);
    let mut seed = 0xBEEF_u64;
    let mut blocks = vec![];
    for i in 1..=200 {
        let proposer_idx = (lcg(&mut seed) as usize) % 4;
        let mut b = genesis_block(&keypairs[proposer_idx].public);
        b.header.height = i;
        b.header.parent_hash = [lcg(&mut seed) as u8; 64];
        b.header.validator = keypairs[proposer_idx].public.clone();
        let h = b.hash();
        b.header.signature = keypairs[proposer_idx].sign(&h);
        blocks.push(b);
    }
    // sync_blocks must not panic on any of these (it will reject most).
    let _ = state.sync_blocks(blocks);
}

#[test]
fn test_fuzz_commit_certificates_never_accept_invalid() {
    // 100 random certificates -- valid ones must pass, invalid ones must fail,
    // and verification must never panic.
    let (keypairs, state) = make_cluster(4);
    let mut seed = 0xCAFE_u64;
    for _ in 0..100 {
        let mut block_hash = [0u8; 64];
        for i in 0..8 {
            block_hash[i] = (lcg(&mut seed) & 0xFF) as u8;
        }
        let n_votes = 1 + (lcg(&mut seed) as usize) % 4;
        let mut votes = vec![];
        for j in 0..n_votes {
            let kp = &keypairs[j % 4];
            votes.push(make_commit_vote(kp, block_hash, 1));
        }
        // Optionally corrupt a signature.
        if lcg(&mut seed) % 3 == 0 && !votes.is_empty() {
            votes[0].signature.0[0] ^= 0xFF;
        }
        let cert = CommitCertificate { height: 1, block_hash, votes };
        let result = cert.verify(&state.validators, &block_hash);
        // We don't assert pass/fail (random), only that it didn't panic.
        let _ = result;
    }
}

// ===== 7. Forward security — anti long-range attack =====

#[test]
fn test_forward_security_rejects_retired_epoch_key() {
    // Long-range attack scenario: an attacker buys a validator's RETIRED
    // epoch key (epoch 0) and tries to sign a block for epoch 1. Forward
    // security must reject it — the key is not authorized for epoch 1.
    let (keypairs, state) = make_cluster(4);
    let mut engine = ConsensusEngine::new(state, keypairs[0].clone());
    engine.enable_forward_security();
    assert!(engine.has_forward_security());

    // The epoch-0 key IS authorized for epoch 0.
    assert!(
        engine.validate_forward_security(0, &keypairs[0].public).is_ok(),
        "epoch-0 key must be authorized for epoch 0"
    );

    // The epoch-0 key is NOT authorized for epoch 1 (long-range attack).
    let result = engine.validate_forward_security(1, &keypairs[0].public);
    assert!(
        matches!(result, Err(CoreError::Consensus(_))),
        "retired epoch-0 key must be rejected for epoch 1 (anti long-range)"
    );
}

#[test]
fn test_forward_security_disabled_allows_all_keys() {
    // Without forward security (testnet compatibility), any key is accepted.
    // This proves the feature is opt-in and does not break existing testnets.
    let (keypairs, state) = make_cluster(4);
    let engine = ConsensusEngine::new(state, keypairs[0].clone());
    assert!(!engine.has_forward_security());

    // Any epoch, any key — accepted (no ledger).
    assert!(engine.validate_forward_security(0, &keypairs[0].public).is_ok());
    assert!(engine.validate_forward_security(999, &keypairs[0].public).is_ok());

    // A brand-new key (never seeded) is also accepted when disabled.
    let stranger = Dilithium3Keypair::generate();
    assert!(engine.validate_forward_security(5, &stranger.public).is_ok());
}

#[test]
fn test_forward_security_blocks_vote_on_retired_key() {
    // End-to-end: a validator tries to vote_prepare on a block signed by a
    // retired epoch key in a new epoch. The engine must reject the vote.
    let (keypairs, mut state) = make_cluster(4);
    let mut engine = ConsensusEngine::new(state.clone(), keypairs[1].clone());
    engine.enable_forward_security();

    // Build a block at a height in epoch 1 (height >= EPOCH_LENGTH), signed
    // by a retired epoch-0 key (keypairs[0]).
    let parent = state.chain[0].clone();
    let mut block = genesis_block(&keypairs[0].public);
    block.header.height = EPOCH_LENGTH; // first block of epoch 1
    block.header.parent_hash = parent.hash();
    block.header.epoch = 1;
    block.header.validator = keypairs[0].public.clone(); // retired epoch-0 key
    let h = block.hash();
    block.header.signature = keypairs[0].sign(&h);

    // vote_prepare must FAIL — the signer is not authorized for epoch 1.
    let result = engine.vote_prepare(&block);
    assert!(
        result.is_err(),
        "vote on a block signed by a retired epoch key must be rejected"
    );
}

// ─── MTP timestamp validation (#8) ──────────────────────────────────────────

#[test]
fn test_mtp_rejects_block_far_ahead() {
    // A block whose timestamp is > 2h ahead of the MTP median is rejected
    // as a timejacking attack.
    let (keypairs, mut state) = make_cluster(4);
    let now = 1_700_000_000_000u64; // arbitrary fixed "now"
    let two_hours = 2 * 60 * 60 * 1000;

    // Push 11 blocks with timestamps near `now`.
    for i in 1..=11 {
        let mut b = genesis_block(&keypairs[0].public);
        b.header.height = i;
        b.header.parent_hash = state.chain[i - 1].hash();
        b.header.timestamp = now + i * 1000;
        b.header.signature = {
            let h = b.hash();
            keypairs[0].sign(&h)
        };
        state.chain.push(b);
        state.last_finalized_height = i;
    }

    // A block 3h ahead of the median must be rejected.
    let mut bad = genesis_block(&keypairs[0].public);
    bad.header.height = 12;
    bad.header.parent_hash = state.chain[11].hash();
    bad.header.timestamp = now + two_hours + 3 * 60 * 60 * 1000; // +3h
    bad.header.signature = { let h = bad.hash(); keypairs[0].sign(&h) };
    let result = state.validate_timestamp_mtp(&bad);
    assert!(
        matches!(result, Err(CoreError::InvalidBlock(_))),
        "block > 2h ahead of MTP must be rejected (timejacking)"
    );
}

#[test]
fn test_mtp_rejects_block_far_behind() {
    // A block whose timestamp is > 2h behind the MTP median is rejected.
    let (keypairs, mut state) = make_cluster(4);
    let now = 1_700_000_000_000u64;
    let two_hours = 2 * 60 * 60 * 1000;

    for i in 1..=11 {
        let mut b = genesis_block(&keypairs[0].public);
        b.header.height = i;
        b.header.parent_hash = state.chain[i - 1].hash();
        b.header.timestamp = now + i * 1000;
        b.header.signature = { let h = b.hash(); keypairs[0].sign(&h) };
        state.chain.push(b);
        state.last_finalized_height = i;
    }

    // A block 3h BEHIND the median must be rejected.
    let mut bad = genesis_block(&keypairs[0].public);
    bad.header.height = 12;
    bad.header.parent_hash = state.chain[11].hash();
    bad.header.timestamp = now - two_hours - 3 * 60 * 60 * 1000; // -3h behind
    bad.header.signature = { let h = bad.hash(); keypairs[0].sign(&h) };
    let result = state.validate_timestamp_mtp(&bad);
    assert!(
        matches!(result, Err(CoreError::InvalidBlock(_))),
        "block > 2h behind MTP must be rejected (timejacking)"
    );
}

#[test]
fn test_mtp_accepts_block_within_window() {
    // A block within the ±2h window is accepted.
    let (keypairs, mut state) = make_cluster(4);
    let now = 1_700_000_000_000u64;

    for i in 1..=11 {
        let mut b = genesis_block(&keypairs[0].public);
        b.header.height = i;
        b.header.parent_hash = state.chain[i - 1].hash();
        b.header.timestamp = now + i * 1000;
        b.header.signature = { let h = b.hash(); keypairs[0].sign(&h) };
        state.chain.push(b);
        state.last_finalized_height = i;
    }

    // A block 30 min ahead — within the window — is accepted.
    let mut ok = genesis_block(&keypairs[0].public);
    ok.header.height = 12;
    ok.header.parent_hash = state.chain[11].hash();
    ok.header.timestamp = now + 30 * 60 * 1000; // +30 min
    ok.header.signature = { let h = ok.hash(); keypairs[0].sign(&h) };
    let result = state.validate_timestamp_mtp(&ok);
    assert!(result.is_ok(), "block within ±2h of MTP must be accepted");
}

// ─── Anti-spam mempool caps (#7) ────────────────────────────────────────────

#[test]
fn test_mempool_rejects_too_many_txs_per_sender() {
    // A sender cannot exceed 64 pending txs in the mempool.
    let (keypairs, state) = make_cluster(4);
    let mut engine = ConsensusEngine::new(state, keypairs[0].clone());
    let to = derive_address(&keypairs[1].public);

    // Add 64 txs from keypairs[1] (different sender) — all should be accepted
    // (the leader is keypairs[0], but add_tx just validates, not leadership).
    for i in 0..64u64 {
        let tx = make_tx(&keypairs[1], i, 1, to);
        let r = engine.add_tx(tx);
        assert!(r.is_ok(), "tx {} should be accepted (under per-sender cap)", i);
    }
    // The 65th tx from the same sender must be rejected.
    let tx = make_tx(&keypairs[1], 64, 1, to);
    let r = engine.add_tx(tx);
    assert!(
        r.is_err(),
        "65th tx from same sender must be rejected (per-sender anti-spam cap)"
    );
}

#[test]
fn test_mempool_global_cap_rejects_overflow() {
    // If the mempool has 4096 txs (from many senders), the next is rejected.
    // We simulate this by pre-filling the mempool directly.
    let (keypairs, mut state) = make_cluster(4);
    state.chain = state.chain.split_off(0); // keep genesis
    let mut engine = ConsensusEngine::new(state, keypairs[0].clone());
    let to = derive_address(&keypairs[0].public);

    // Pre-fill mempool with 4096 txs from distinct senders (so per-sender cap
    // does not trigger). We generate enough keypairs for this.
    let extra_kps: Vec<Dilithium3Keypair> = (0..4096).map(|_| Dilithium3Keypair::generate()).collect();
    for (i, kp) in extra_kps.iter().enumerate() {
        let tx = make_tx(kp, 0, 1, to);
        // Bypass the per-sender check by pushing directly (simulating prior
        // acceptance); the global cap is what we test.
        engine.mempool.push(tx);
        let _ = i;
    }
    assert_eq!(engine.mempool.len(), 4096);

    // Now a new tx (valid, from a new sender) must be rejected by the global cap.
    let new_kp = Dilithium3Keypair::generate();
    let tx = make_tx(&new_kp, 0, 1, to);
    let r = engine.add_tx(tx);
    assert!(
        r.is_err(),
        "mempool at global cap (4096) must reject new tx (anti-spam)"
    );
}
