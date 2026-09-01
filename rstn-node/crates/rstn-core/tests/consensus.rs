//! Integration tests for the BFT consensus engine.
//!
//! These tests cover the full propose -> prepare -> commit -> finalize
//! lifecycle, plus the specific bugs that were found and fixed:
//!   - Late-vote rejection (height mismatch spam fix)
//!   - Nonce + balance validation in add_tx
//!   - Duplicate vote rejection
//!   - Slashed validators excluded from threshold
//!   - View-change leader rotation
//!   - Equivocation (double-signing) detection + automatic slashing (M2)
//!   - Formal view-change wall-clock timeout (M1)

use rstn_core::{
    Block, BlockHeader, BftVote, BftVotePhase, ConsensusState, CoreError,
    Transaction, TxType, Validator, ValidatorStatus, EPOCH_LENGTH,
};
use rstn_core::consensus::ConsensusEngine;
use rstn_crypto::{Dilithium3Keypair, Dilithium3Signature, derive_address};

/// Build a genesis block (height 0, unsigned) with the given validator as proposer.
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

/// Build N validator keypairs + a ConsensusState seeded with genesis.
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
    // Seed genesis block signed by validator 0 (the first leader).
    let genesis = genesis_block(&keypairs[0].public);
    state.chain.push(genesis);
    state.last_finalized_height = 0;
    (keypairs, state)
}

/// Build a signed transaction from a keypair.
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

// ============================================================
// Full BFT lifecycle: propose -> prepare -> commit -> finalize
// ============================================================

/// A 4-validator cluster finalizes a block when 3 (supermajority) commit.
#[test]
fn test_full_bft_lifecycle_4_validators() {
    let (keypairs, state0) = make_cluster(4);

    // Node 0 is the leader at height 1 (round-robin: height % active).
    let mut leader = ConsensusEngine::new(state0, keypairs[0].clone());
    assert!(leader.is_leader(), "validator 0 should be leader at height 1");

    // Leader proposes a block.
    let block = leader.propose_block([0u8; 64]).expect("propose should succeed");
    assert_eq!(block.header.height, 1);
    assert!(block.verify_block_signature().is_ok(), "block must be signed by leader");

    // Each validator votes PREPARE.
    let mut voters: Vec<ConsensusEngine> = keypairs[1..]
        .iter()
        .map(|kp| {
            let s = ConsensusState::new(4);
            let mut s = s;
            s.validators = leader.state.validators.clone();
            s.chain.push(genesis_block(&keypairs[0].public));
            s.last_finalized_height = 0;
            ConsensusEngine::new(s, kp.clone())
        })
        .collect();

    // Collect prepare votes from validators 1, 2, 3 on the leader.
    let mut reached_prepare = false;
    for voter in &mut voters {
        let vote = voter.vote_prepare(&block).expect("vote_prepare should succeed");
        let ready = leader.collect_prepare_vote(vote).expect("collect_prepare_vote should succeed");
        if ready {
            reached_prepare = true;
        }
    }
    // 3 prepare votes (validators 1,2,3) + leader's own = 4 >= threshold 3.
    assert!(reached_prepare, "prepare supermajority should be reached");

    // Collect commit votes.
    let mut reached_commit = false;
    for voter in &mut voters {
        let vote = voter.vote_commit(block.hash(), block.header.height).expect("vote_commit");
        let ready = leader.collect_commit_vote(vote).expect("collect_commit_vote");
        if ready {
            reached_commit = true;
        }
    }
    assert!(reached_commit, "commit supermajority should be reached");

    // Finalize the block.
    leader.finalize_block(block).expect("finalize should succeed");
    assert_eq!(leader.state.last_finalized_height, 1);
    assert_eq!(leader.state.chain.len(), 2, "chain should have genesis + block 1");
}

// ============================================================
// Late-vote rejection (the "height mismatch spam" fix)
// ============================================================

/// A COMMIT vote for an already-finalized height must be silently ignored
/// (returns Ok(false)), NOT re-trigger finalization. This was the root cause
/// of the "height mismatch: expected X, got X-1" log spam.
#[test]
fn test_late_commit_vote_ignored() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    let block = leader.propose_block([0u8; 64]).unwrap();

    // Simulate that the block is already finalized at height 1.
    leader.state.last_finalized_height = 1;

    // A late commit vote arrives for height 1.
    let late_vote = BftVote {
        block_hash: block.hash(),
        height: 1,
        round: 0,
        voter: keypairs[1].public.clone(),
        signature: keypairs[1].sign(&block.hash()),
        phase: BftVotePhase::Commit,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };

    let result = leader.collect_commit_vote(late_vote).expect("should not error");
    assert_eq!(result, false, "late commit vote must be ignored, not re-finalize");
}

/// A late PREPARE vote for an already-finalized height must be ignored too.
#[test]
fn test_late_prepare_vote_ignored() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());
    let block = leader.propose_block([0u8; 64]).unwrap();
    leader.state.last_finalized_height = 1;

    let late_vote = BftVote {
        block_hash: block.hash(),
        height: 1,
        round: 0,
        voter: keypairs[1].public.clone(),
        signature: keypairs[1].sign(&block.hash()),
        phase: BftVotePhase::Prepare,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };

    let result = leader.collect_prepare_vote(late_vote).expect("should not error");
    assert_eq!(result, false, "late prepare vote must be ignored");
}

// ============================================================
// Phase-mismatch rejection
// ============================================================

/// A commit-phase vote in the prepare collector must be rejected.
#[test]
fn test_commit_vote_rejected_in_prepare_collector() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());
    let block = leader.propose_block([0u8; 64]).unwrap();

    let wrong_phase = BftVote {
        block_hash: block.hash(),
        height: 1,
        round: 0,
        voter: keypairs[1].public.clone(),
        signature: keypairs[1].sign(&block.hash()),
        phase: BftVotePhase::Commit, // wrong phase for prepare collector
        hybrid_signature: None,
        hybrid_pubkey: None,
    };

    let result = leader.collect_prepare_vote(wrong_phase);
    assert!(result.is_err(), "commit vote must be rejected in prepare collector");
}

/// A prepare-phase vote in the commit collector must be rejected.
#[test]
fn test_prepare_vote_rejected_in_commit_collector() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());
    let block = leader.propose_block([0u8; 64]).unwrap();

    let wrong_phase = BftVote {
        block_hash: block.hash(),
        height: 1,
        round: 0,
        voter: keypairs[1].public.clone(),
        signature: keypairs[1].sign(&block.hash()),
        phase: BftVotePhase::Prepare, // wrong phase for commit collector
        hybrid_signature: None,
        hybrid_pubkey: None,
    };

    let result = leader.collect_commit_vote(wrong_phase);
    assert!(result.is_err(), "prepare vote must be rejected in commit collector");
}

// ============================================================
// Duplicate vote rejection
// ============================================================

/// The same validator voting PREPARE twice must not double-count.
#[test]
fn test_duplicate_prepare_vote_not_double_counted() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());
    let block = leader.propose_block([0u8; 64]).unwrap();

    let vote = BftVote {
        block_hash: block.hash(),
        height: 1,
        round: 0,
        voter: keypairs[1].public.clone(),
        signature: keypairs[1].sign(&block.hash()),
        phase: BftVotePhase::Prepare,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };

    // First vote: counted.
    leader.collect_prepare_vote(vote.clone()).unwrap();
    // Second identical vote: ignored (returns false, no supermajority yet).
    let result = leader.collect_prepare_vote(vote).unwrap();
    assert_eq!(result, false, "duplicate vote must not be double-counted");
}

// ============================================================
// Nonce + balance validation in add_tx
// ============================================================

/// A transaction with a nonce below the account's expected nonce is rejected.
#[test]
fn test_add_tx_rejects_low_nonce() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    // Inject account state: sender's expected nonce is 5.
    let sender_addr = derive_address(&keypairs[1].public);
    leader.account_nonce_fn = Some(Box::new(
        move |a: &[u8; 20]| if *a == sender_addr { Some(5u64) } else { None },
    ));
    leader.account_balance_fn = Some(Box::new(
        |_: &[u8; 20]| -> Option<u128> { None },
    ));

    // Tx with nonce 3 (< 5) -> rejected.
    let tx = make_tx(&keypairs[1], 3, 100, [0u8; 20]);
    let result = leader.add_tx(tx);
    assert!(result.is_err(), "low nonce must be rejected");
    match result {
        Err(CoreError::InvalidTransaction(msg)) => assert!(msg.contains("nonce too low")),
        other => panic!("expected InvalidTransaction, got {:?}", other),
    }
}

/// A transaction with an insufficient balance is rejected.
#[test]
fn test_add_tx_rejects_insufficient_balance() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    let sender_addr = derive_address(&keypairs[1].public);
    leader.account_nonce_fn = Some(Box::new(
        move |a: &[u8; 20]| if *a == sender_addr { Some(0u64) } else { None },
    ));
    leader.account_balance_fn = Some(Box::new(
        move |a: &[u8; 20]| if *a == sender_addr { Some(50u128) } else { None },
    ));

    // Tx needs value(100) + gas(1 * 100000) = 100100, but balance is 50.
    let tx = make_tx(&keypairs[1], 0, 100, [0u8; 20]);
    let result = leader.add_tx(tx);
    assert!(result.is_err(), "insufficient balance must be rejected");
    match result {
        Err(CoreError::InvalidTransaction(msg)) => assert!(msg.contains("insufficient balance")),
        other => panic!("expected InvalidTransaction, got {:?}", other),
    }
}

/// A valid transaction (correct nonce, sufficient balance) is accepted.
#[test]
fn test_add_tx_accepts_valid_tx() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    let sender_addr = derive_address(&keypairs[1].public);
    leader.account_nonce_fn = Some(Box::new(
        move |a: &[u8; 20]| if *a == sender_addr { Some(0u64) } else { None },
    ));
    leader.account_balance_fn = Some(Box::new(
        move |a: &[u8; 20]| if *a == sender_addr { Some(1_000_000u128) } else { None },
    ));

    let tx = make_tx(&keypairs[1], 0, 100, [0u8; 20]);
    leader.add_tx(tx).expect("valid tx should be accepted");
    assert_eq!(leader.mempool.len(), 1);
}

/// A duplicate (same sender + nonce) transaction is rejected.
#[test]
fn test_add_tx_rejects_duplicate_nonce() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    let tx1 = make_tx(&keypairs[1], 0, 100, [0u8; 20]);
    let tx2 = make_tx(&keypairs[1], 0, 200, [0u8; 20]); // same nonce, different value
    leader.add_tx(tx1).expect("first tx accepted");
    let result = leader.add_tx(tx2);
    assert!(result.is_err(), "duplicate nonce must be rejected");
}

/// A transaction with a bad signature is rejected.
#[test]
fn test_add_tx_rejects_bad_signature() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    let mut tx = make_tx(&keypairs[1], 0, 100, [0u8; 20]);
    // Corrupt the signature.
    tx.signature.0[0] ^= 0xFF;
    let result = leader.add_tx(tx);
    assert!(result.is_err(), "bad signature must be rejected");
}

// ============================================================
// Slashed validators excluded from threshold
// ============================================================

/// With 4 validators where 1 is slashed, the threshold is 3 (of 3 active).
/// 2 votes must NOT reach supermajority; 3 must.
#[test]
fn test_slashed_validator_excluded_from_threshold() {
    let (keypairs, mut state) = make_cluster(4);
    // Slash validator 3.
    state.validators[3].status = ValidatorStatus::Slashed;

    // 3 active -> threshold = 3*2/3+1 = 3.
    assert!(!state.has_supermajority(2));
    assert!(state.has_supermajority(3));
    let _ = keypairs;
}

// ============================================================
// Block validation
// ============================================================

/// A block with the wrong height is rejected.
#[test]
fn test_block_height_mismatch_rejected() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());
    let parent = leader.state.latest_block().unwrap().clone();

    let mut bad_block = genesis_block(&keypairs[0].public);
    bad_block.header.height = 5; // wrong height (should be 1)
    let result = bad_block.validate_header(&parent);
    assert!(result.is_err(), "wrong height must be rejected");
}

/// A block with the wrong parent hash is rejected.
#[test]
fn test_block_wrong_parent_hash_rejected() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());
    let parent = leader.state.latest_block().unwrap().clone();

    let mut bad_block = Block {
        header: BlockHeader {
            height: 1,
            parent_hash: [0xAA; 64], // wrong parent hash
            state_root: [0u8; 64],
            tx_root: [0u8; 64],
            timestamp: 0,
            validator: keypairs[0].public.clone(),
            signature: Dilithium3Signature([0u8; 3309]),
            shard_id: 0,
            epoch: 0,
            round: 0,
            data_root: [0u8; 64],
        },
        transactions: vec![],
    };
    let result = bad_block.validate_header(&parent);
    assert!(result.is_err(), "wrong parent hash must be rejected");
}

/// A block with a tampered tx_root is rejected.
#[test]
fn test_block_bad_tx_root_rejected() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    let mut block = leader.propose_block([0u8; 64]).unwrap();
    // Tamper with the tx_root.
    block.header.tx_root = [0xBB; 64];
    let result = block.validate_tx_root();
    assert!(result.is_err(), "bad tx_root must be rejected");
}

/// A block with an invalid signature is rejected.
#[test]
fn test_block_bad_signature_rejected() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());
    let mut block = leader.propose_block([0u8; 64]).unwrap();
    // Corrupt the signature.
    block.header.signature.0[0] ^= 0xFF;
    let result = block.verify_block_signature();
    assert!(result.is_err(), "bad block signature must be rejected");
}

// ============================================================
// Leader selection & view-change
// ============================================================

/// The leader rotates round-robin by height.
#[test]
fn test_leader_rotation_by_height() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    // Height 0 -> leader is validator 0.
    leader.state.last_finalized_height = 0;
    leader.state.view_offset = 0;
    let l0 = leader.state.select_leader().unwrap();
    assert_eq!(l0.pubkey.0, keypairs[0].public.0);

    // Height 1 -> leader is validator 1.
    leader.state.last_finalized_height = 1;
    let l1 = leader.state.select_leader().unwrap();
    assert_eq!(l1.pubkey.0, keypairs[1].public.0);

    // Height 2 -> leader is validator 2.
    leader.state.last_finalized_height = 2;
    let l2 = leader.state.select_leader().unwrap();
    assert_eq!(l2.pubkey.0, keypairs[2].public.0);
}

/// View-change skips an unreachable leader deterministically.
#[test]
fn test_view_change_skips_leader() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    // At height 0, view 0 -> leader 0.
    leader.state.last_finalized_height = 0;
    leader.state.view_offset = 0;
    assert_eq!(leader.state.select_leader().unwrap().pubkey.0, keypairs[0].public.0);

    // View-change -> view_offset 1 -> skips leader 0, elects leader 1.
    leader.state.advance_view();
    assert_eq!(leader.state.view_offset, 1);
    assert_eq!(leader.state.select_leader().unwrap().pubkey.0, keypairs[1].public.0);
    assert!(leader.state.view_offset >= 1);
}

// ============================================================
// Transaction canonical encoding & hashing determinism
// ============================================================

/// Two transactions with identical fields produce the same hash.
#[test]
fn test_tx_hash_deterministic() {
    let kp = Dilithium3Keypair::generate();
    let tx1 = make_tx(&kp, 7, 1000, [1u8; 20]);
    let tx2 = make_tx(&kp, 7, 1000, [1u8; 20]);
    assert_eq!(tx1.hash(), tx2.hash(), "identical txs must hash identically");
}

/// A transaction with a different nonce produces a different hash.
#[test]
fn test_tx_hash_differs_on_nonce() {
    let kp = Dilithium3Keypair::generate();
    let tx1 = make_tx(&kp, 7, 1000, [1u8; 20]);
    let tx2 = make_tx(&kp, 8, 1000, [1u8; 20]);
    assert_ne!(tx1.hash(), tx2.hash(), "different nonces must produce different hashes");
}

/// Block hashing is deterministic: two blocks with identical header fields
/// (including timestamp) produce the same hash. We construct two blocks by
/// hand with a fixed timestamp rather than re-proposing, because
/// `propose_block` stamps the current wall-clock time (which would differ
/// between two calls and make the hashes differ).
#[test]
fn test_block_hash_deterministic() {
    let (keypairs, _state) = make_cluster(4);
    let header = BlockHeader {
        height: 1,
        parent_hash: [0u8; 64],
        state_root: [0u8; 64],
        tx_root: [0u8; 64],
        timestamp: 1_700_000_000_000,
        validator: keypairs[0].public.clone(),
        signature: Dilithium3Signature([0u8; 3309]),
        shard_id: 0,
        epoch: 0,
        round: 0,
        data_root: [0u8; 64],
    };
    let block1 = Block { header: header.clone(), transactions: vec![] };
    let block2 = Block { header, transactions: vec![] };
    assert_eq!(block1.hash(), block2.hash(), "identical blocks must hash identically");
}

/// Blocks that differ in any header field must hash differently.
#[test]
fn test_block_hash_differs_on_height() {
    let (keypairs, _state) = make_cluster(4);
    let mk = |height: u64| Block {
        header: BlockHeader {
            height,
            parent_hash: [0u8; 64],
            state_root: [0u8; 64],
            tx_root: [0u8; 64],
            timestamp: 1_700_000_000_000,
            validator: keypairs[0].public.clone(),
            signature: Dilithium3Signature([0u8; 3309]),
            shard_id: 0,
            epoch: 0,
            round: 0,
            data_root: [0u8; 64],
        },
        transactions: vec![],
    };
    assert_ne!(mk(1).hash(), mk(2).hash(), "different heights must hash differently");
}

// ============================================================
// Epoch advancement
// ============================================================

/// Finalizing a block at an EPOCH_LENGTH boundary advances the epoch.
#[test]
fn test_epoch_advances_at_boundary() {
    let (keypairs, state) = make_cluster(4);

    // Set the chain so the next block is at height EPOCH_LENGTH.
    let mut genesis = genesis_block(&keypairs[0].public);
    genesis.header.height = EPOCH_LENGTH - 1;
    let mut state = state;
    state.chain = vec![genesis];
    state.last_finalized_height = EPOCH_LENGTH - 1;

    // select_leader() derives from last_finalized_height + view_offset.
    // At height EPOCH_LENGTH-1, the elected leader is validators[(EPOCH_LENGTH-1) % 4].
    let leader_idx = ((EPOCH_LENGTH - 1) as usize) % keypairs.len();
    let mut leader = ConsensusEngine::new(state, keypairs[leader_idx].clone());
    let epoch_before = leader.state.current_epoch;

    // Propose + finalize a block at height EPOCH_LENGTH.
    let block = leader.propose_block([0u8; 64]).unwrap();
    assert_eq!(block.header.height, EPOCH_LENGTH);
    leader.finalize_block(block).unwrap();

    assert_eq!(
        leader.state.current_epoch,
        epoch_before + 1,
        "epoch must advance at EPOCH_LENGTH boundary"
    );
}

// ============================================================
// M2: Equivocation (double-signing) detection + automatic slashing
// ============================================================

/// A validator that signs PREPARE on two DIFFERENT blocks at the same height
/// is detected as an equivocator, slashed 5%, and the second vote is rejected.
#[test]
fn test_equivocation_prepare_detected_and_slashed() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    // Block A (a real proposal from the leader).
    let block_a = leader.propose_block([0u8; 64]).unwrap();

    // Validator 1 votes PREPARE on block A -- accepted.
    let vote_a = BftVote {
        block_hash: block_a.hash(),
        height: 1,
        round: 0,
        voter: keypairs[1].public.clone(),
        signature: keypairs[1].sign(&block_a.hash()),
        phase: BftVotePhase::Prepare,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let r = leader.collect_prepare_vote(vote_a).expect("first prepare vote accepted");
    assert!(!r, "1 vote should not reach supermajority");

    // Block B -- a DIFFERENT block at the same height (a competing proposal).
    // Construct it by re-proposing with a different state_root so the hash differs.
    let mut block_b = leader.propose_block([0u8; 64]).unwrap_or_else(|_| block_a.clone());
    block_b.header.state_root = [0xFF; 64]; // different state_root -> different hash
    block_b.header.signature = leader.keypair.sign(&block_b.hash());

    // Validator 1 NOW votes PREPARE on block B -- this is equivocation.
    let vote_b = BftVote {
        block_hash: block_b.hash(),
        height: 1,
        round: 0,
        voter: keypairs[1].public.clone(),
        signature: keypairs[1].sign(&block_b.hash()),
        phase: BftVotePhase::Prepare,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let result = leader.collect_prepare_vote(vote_b);

    // The equivocating vote must be REJECTED with an Equivocation error.
    assert!(result.is_err(), "equivocating prepare vote must be rejected");
    match result {
        Err(CoreError::Equivocation(msg)) => assert!(
            msg.contains("double-signed"),
            "error must mention double-signing, got: {}", msg
        ),
        other => panic!("expected Equivocation error, got {:?}", other),
    }

    // The offender must have been slashed 5%.
    let offender = &leader.state.validators[1];
    assert_eq!(offender.stake, 950_000, "equivocator must be slashed 5% (1M -> 950K)");
    assert!(
        leader.last_equivocators.iter().any(|(kp, _)| kp.0 == keypairs[1].public.0),
        "last_equivocators must record the offender (got {:?})",
        leader.last_equivocators
    );
}

/// A validator that signs COMMIT on two different blocks at the same height is
/// also detected and slashed.
#[test]
fn test_equivocation_commit_detected_and_slashed() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    let block_a = leader.propose_block([0u8; 64]).unwrap();
    let mut block_b = block_a.clone();
    block_b.header.state_root = [0x11; 64];
    block_b.header.signature = leader.keypair.sign(&block_b.hash());

    // Validator 2 votes COMMIT on block A -- accepted (inserted directly).
    let vote_a = BftVote {
        block_hash: block_a.hash(),
        height: 1,
        round: 0,
        voter: keypairs[2].public.clone(),
        signature: keypairs[2].sign(&block_a.hash()),
        phase: BftVotePhase::Commit,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    leader.commit_votes.entry(block_a.hash()).or_default().push(vote_a);

    // Validator 2 votes COMMIT on block B -- equivocation.
    let vote_b = BftVote {
        block_hash: block_b.hash(),
        height: 1,
        round: 0,
        voter: keypairs[2].public.clone(),
        signature: keypairs[2].sign(&block_b.hash()),
        phase: BftVotePhase::Commit,
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let result = leader.collect_commit_vote(vote_b);
    assert!(result.is_err(), "equivocating commit vote must be rejected");
    let offender = &leader.state.validators[2];
    assert_eq!(offender.stake, 950_000, "commit equivocator must be slashed 5%");
}

// ============================================================
// M1: Formal view-change wall-clock timeout
// ============================================================

/// `check_view_timeout()` returns false when the round just started (timer
/// reset) and true after the timeout window elapses.
#[test]
fn test_view_timeout_wall_clock() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    // Round just started -> not timed out.
    leader.state.start_round();
    assert!(!leader.state.check_view_timeout(), "freshly started round must not time out");

    // Force the round_start into the distant past so the window has elapsed.
    // We set round_timeout_ms = 0 so the comparison
    // `now_ms().saturating_sub(round_start_ms) >= round_timeout_ms` is ALWAYS true
    // regardless of the wall clock (now_ms() may return 0 via its unwrap_or(0)
    // fallback in some test environments). round_start_ms must be non-zero to
    // pass the "round not started yet" sentinel guard (== 0 -> return false).
    leader.state.round_start_ms = 1;
    leader.state.round_timeout_ms = 0;
    assert!(leader.state.check_view_timeout(), "a round started in the distant past must time out");
}

/// `advance_view()` increments view_offset and view_changes and resets the
/// round timer, with exponential backoff on the timeout.
#[test]
fn test_advance_view_backoff() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    let timeout0 = leader.state.round_timeout_ms;
    leader.state.advance_view();
    assert_eq!(leader.state.view_offset, 1);
    assert_eq!(leader.state.view_changes, 1);
    // After view-change the round timer resets to "now" -> not timed out.
    assert!(!leader.state.check_view_timeout());
    // Backoff: timeout should have grown (capped at 10x base).
    assert!(leader.state.round_timeout_ms > timeout0 || leader.state.round_timeout_ms == timeout0 * 10,
        "view-change timeout must back off");
    let _ = keypairs;
}

// ============================================================
// G3: DAS wired into block production
// ============================================================

/// A block produced by `propose_block` MUST carry a non-zero `data_root`
/// (the DAS Merkle root over the erasure-coded block body), and
/// `validate_data_root` MUST accept it. This proves DAS is wired into the
/// real consensus path, not just a standalone library.
#[test]
fn test_proposed_block_carries_das_root() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());

    // Propose a block (leader is keypairs[0] at height 0).
    let block = leader.propose_block([0u8; 64]).expect("leader must propose");

    // The data_root must be non-zero (DAS computed over the body).
    assert_ne!(
        block.header.data_root, [0u8; 64],
        "a proposed block must carry a non-zero DAS data_root"
    );

    // validate_data_root must accept the block (the root matches the body).
    block.validate_data_root().expect("proposed block's data_root must validate");
}

/// A block with a tampered data_root (non-zero but wrong) MUST be rejected
/// by validate_data_root. This proves the DAS root is actually verified, not
/// just stored.
#[test]
fn test_tampered_das_root_rejected() {
    let (keypairs, state) = make_cluster(4);
    let mut leader = ConsensusEngine::new(state, keypairs[0].clone());
    let mut block = leader.propose_block([0u8; 64]).expect("leader must propose");

    // Tamper: flip a bit in the data_root.
    block.header.data_root[0] ^= 0xFF;

    // validate_data_root must reject the tampered root.
    assert!(
        block.validate_data_root().is_err(),
        "a block with a wrong data_root must be rejected"
    );
}

// ============================================================
// PQ2: Hybrid signatures (Dilithium3 + Ed25519) dual verification
// ============================================================

/// A transaction carrying a valid hybrid signature (Dilithium3 + Ed25519)
/// must verify successfully. Both halves must pass.
#[test]
fn test_hybrid_tx_signature_verifies() {
    use rstn_crypto::{HybridKeypair, HybridPublicKey, HybridSignature};
    let kp = HybridKeypair::generate();
    let hpk: HybridPublicKey = kp.public();
    let to = [0u8; 20];
    let mut tx = Transaction {
        from: kp.dilithium.public.clone(),
        to,
        value: 100,
        nonce: 0,
        gas_price: 1,
        gas_limit: 21000,
        tx_type: TxType::Transfer,
        payload: vec![],
        signature: rstn_crypto::Dilithium3Signature([0u8; 3309]),
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let msg = tx.hash();
    let hsig: HybridSignature = kp.sign(&msg);
    tx.signature = kp.dilithium.sign(&msg);
    tx.hybrid_signature = Some(hsig);
    tx.hybrid_pubkey = Some(hpk);
    assert!(tx.verify_signature().is_ok(), "valid hybrid tx must verify");
}

/// A transaction with a tampered Ed25519 half of the hybrid signature must
/// be REJECTED, even though the Dilithium3 half is valid. This proves dual
/// verification: breaking one scheme breaks the whole signature.
#[test]
fn test_hybrid_tx_rejects_tampered_ed25519() {
    use rstn_crypto::{HybridKeypair, HybridPublicKey, HybridSignature};
    let kp = HybridKeypair::generate();
    let hpk: HybridPublicKey = kp.public();
    let to = [0u8; 20];
    let mut tx = Transaction {
        from: kp.dilithium.public.clone(),
        to,
        value: 100,
        nonce: 0,
        gas_price: 1,
        gas_limit: 21000,
        tx_type: TxType::Transfer,
        payload: vec![],
        signature: rstn_crypto::Dilithium3Signature([0u8; 3309]),
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let msg = tx.hash();
    let mut hsig: HybridSignature = kp.sign(&msg);
    // Tamper the Ed25519 half
    hsig.ed25519[0] ^= 0xFF;
    tx.signature = kp.dilithium.sign(&msg);
    tx.hybrid_signature = Some(hsig);
    tx.hybrid_pubkey = Some(hpk);
    assert!(
        tx.verify_signature().is_err(),
        "tampered Ed25519 half must reject the whole hybrid signature"
    );
}

/// A legacy transaction (no hybrid signature) must still verify with
/// Dilithium3-only verification. This proves backward compatibility.
#[test]
fn test_legacy_tx_dilithium_only_still_verifies() {
    let kp = Dilithium3Keypair::generate();
    let to = [0u8; 20];
    let mut tx = Transaction {
        from: kp.public.clone(),
        to,
        value: 100,
        nonce: 0,
        gas_price: 1,
        gas_limit: 21000,
        tx_type: TxType::Transfer,
        payload: vec![],
        signature: rstn_crypto::Dilithium3Signature([0u8; 3309]),
        hybrid_signature: None,
        hybrid_pubkey: None,
    };
    let msg = tx.hash();
    tx.signature = kp.sign(&msg);
    assert!(tx.verify_signature().is_ok(), "legacy Dilithium3-only tx must verify");
}
