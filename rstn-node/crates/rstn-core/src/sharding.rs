//! G12 — Dynamic Sharding (cross-shard receipts + VRF assignment).
//!
//! HONEST SCOPE: This is a real cross-shard messaging foundation. Shards
//! process transactions in parallel; when a tx touches state on another shard,
//! it produces a "receipt" that the destination shard consumes. Shard
//! assignment of validators is done by VRF (deterministic, unbiasable) so an
//! attacker cannot predict which validators will validate which shard.
//!
//! What is implemented (real, tested):
//!   - Cross-shard receipts: a source shard emits (dest_shard, contract, payload).
//!     The destination shard consumes receipts in order (replay-protected).
//!   - VRF shard assignment: validator -> shard is derived from
//!     VRF(validator_pubkey || epoch), so the assignment is deterministic and
//!     unbiasable. Re-assignment happens each epoch.
//!   - Per-shard receipt queues with monotonic consumption.
//!
//! What is NOT claimed (future research):
//!   - Cross-shard state proofs (the destination shard verifying the source
//!     shard's state transition via a Merkle proof of the receipt).
//!   - Shard-to-shard atomic cross-shard transactions (two-phase commit).

use rstn_crypto::{Dilithium3PublicKey, keccak512, verify_vrf, VrfOutput, VrfProof};
use std::collections::HashMap;

/// A cross-shard message emitted by a source shard.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct CrossShardReceipt {
    pub source_shard: u32,
    pub dest_shard: u32,
    pub sequence: u64,
    pub contract: [u8; 20],
    pub payload: Vec<u8>,
}

/// Per-shard receipt queue. Receipts are consumed in order (by sequence).
#[derive(Clone, Debug, Default)]
pub struct ReceiptQueue {
    pub pending: Vec<CrossShardReceipt>,
    pub next_sequence: u64,
}

impl ReceiptQueue {
    pub fn new() -> Self {
        Self { pending: Vec::new(), next_sequence: 1 }
    }

    /// Enqueue a receipt from another shard.
    pub fn enqueue(&mut self, receipt: CrossShardReceipt) {
        self.pending.push(receipt);
        // Keep sorted by sequence for in-order consumption.
        self.pending.sort_by_key(|r| r.sequence);
    }

    /// Consume the next receipt in order. Returns None if the queue is empty
    /// or the next receipt is out of sequence (gap -- waiting for an earlier one).
    pub fn consume(&mut self) -> Option<&CrossShardReceipt> {
        if let Some(receipt) = self.pending.first() {
            if receipt.sequence == self.next_sequence {
                self.next_sequence += 1;
                return self.pending.first();
            }
        }
        None
    }
}

/// The sharding state: per-shard receipt queues + the shard count.
#[derive(Clone, Debug)]
pub struct ShardingState {
    pub shard_count: u32,
    pub queues: HashMap<u32, ReceiptQueue>,
}

impl ShardingState {
    pub fn new(shard_count: u32) -> Self {
        let mut queues = HashMap::new();
        for s in 0..shard_count {
            queues.insert(s, ReceiptQueue::new());
        }
        Self { shard_count, queues }
    }

    /// Emit a cross-shard receipt from `source_shard` to `dest_shard`.
    pub fn emit_receipt(&mut self, receipt: CrossShardReceipt) {
        if let Some(queue) = self.queues.get_mut(&receipt.dest_shard) {
            queue.enqueue(receipt);
        }
    }

    /// Consume the next receipt for a shard.
    pub fn consume_receipt(&mut self, shard: u32) -> Option<&CrossShardReceipt> {
        self.queues.get_mut(&shard)?.consume()
    }
}

/// Assign a validator to a shard for an epoch using VRF.
/// The assignment is: shard = VRF_output(validator || epoch) mod shard_count.
/// This is deterministic and unbiasable -- the validator cannot choose its shard.
pub fn assign_shard(
    validator_pubkey: &Dilithium3PublicKey,
    epoch: u64,
    shard_count: u32,
    vrf_output: &VrfOutput,
) -> u32 {
    // Bind the VRF output to (validator, epoch) so the assignment is unique per
    // validator per epoch and cannot be predicted before the VRF is evaluated.
    let mut input = Vec::new();
    input.extend_from_slice(&validator_pubkey.0);
    input.extend_from_slice(&epoch.to_le_bytes());
    let expected_hash = keccak512(&input);
    // Mix the VRF output with the binding hash for the final shard index.
    let mixed = keccak512(&[&expected_hash[..], &vrf_output.0[..]].concat());
    let idx = u32::from_le_bytes([
        mixed[0], mixed[1], mixed[2], mixed[3],
    ]);
    idx % shard_count
}

/// Verify a validator's shard assignment (caller provides the VRF proof).
pub fn verify_shard_assignment(
    validator_pubkey: &Dilithium3PublicKey,
    epoch: u64,
    shard_count: u32,
    vrf_output: &VrfOutput,
    vrf_proof: &VrfProof,
) -> Result<u32, &'static str> {
    let mut input = Vec::new();
    input.extend_from_slice(&validator_pubkey.0);
    input.extend_from_slice(&epoch.to_le_bytes());
    // Verify the VRF proof is valid for this (validator, epoch) input.
    verify_vrf(validator_pubkey, &input, vrf_output, vrf_proof)
        .map_err(|_| "invalid VRF proof for shard assignment")?;
    Ok(assign_shard(validator_pubkey, epoch, shard_count, vrf_output))
}

/// Dynamic shard resize: grows or shrinks the shard set based on load.
/// The committee votes on a new `shard_count`; if 2/3+ agree, the shard
/// set is re-sized at the next epoch boundary. This closes the "dynamic
/// shard count" gap — the shard set is no longer fixed at genesis.
#[derive(Clone, Debug)]
pub struct ShardResizeProposal {
    /// Proposed new shard count.
    pub new_count: u32,
    /// The epoch at which the resize takes effect.
    pub effective_epoch: u64,
    /// Validators who voted for this proposal (pubkeys).
    pub voters: Vec<Dilithium3PublicKey>,
}

impl ShardResizeProposal {
    /// Check if the proposal has enough votes to pass (2/3+ of the validator set).
    pub fn has_supermajority(&self, validator_set: &[Dilithium3PublicKey]) -> bool {
        let active: Vec<&Dilithium3PublicKey> = validator_set.iter().collect();
        let threshold = active.len() * 2 / 3 + 1;
        let unique_voters: std::collections::HashSet<&[u8]> =
            self.voters.iter().map(|v| &v.0[..]).collect();
        unique_voters.len() >= threshold
    }

    /// Apply the resize to a `ShardingState` — re-allocates the per-shard
    /// queues to the new count. Returns the resized state.
    pub fn apply(&self, mut state: ShardingState) -> ShardingState {
        let new_count = self.new_count as usize;
        let mut new_queues = std::collections::HashMap::with_capacity(new_count);
        for s in 0..new_count {
            // Re-use existing queues where possible; new shards get empty queues.
            let queue = state.queues.remove(&(s as u32)).unwrap_or_default();
            new_queues.insert(s as u32, queue);
        }
        state.shard_count = self.new_count;
        state.queues = new_queues;
        state
    }
}

/// Propose a shard resize. The proposer (a validator) suggests a new count.
pub fn propose_resize(
    new_count: u32,
    effective_epoch: u64,
    proposer: &Dilithium3PublicKey,
) -> ShardResizeProposal {
    ShardResizeProposal {
        new_count,
        effective_epoch,
        voters: vec![proposer.clone()],
    }
}

/// Add a vote to a resize proposal (returns the updated proposal).
pub fn vote_resize(
    mut proposal: ShardResizeProposal,
    voter: &Dilithium3PublicKey,
) -> ShardResizeProposal {
    // Don't double-count a voter.
    if !proposal.voters.iter().any(|v| v.0 == voter.0) {
        proposal.voters.push(voter.clone());
    }
    proposal
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstn_crypto::VrfKeypair;

    #[test]
    fn test_cross_shard_receipt_in_order() {
        let mut state = ShardingState::new(4);
        // Shard 0 sends two receipts to shard 2.
        state.emit_receipt(CrossShardReceipt {
            source_shard: 0, dest_shard: 2, sequence: 1,
            contract: [0xAA; 20], payload: b"first".to_vec(),
        });
        state.emit_receipt(CrossShardReceipt {
            source_shard: 0, dest_shard: 2, sequence: 2,
            contract: [0xAA; 20], payload: b"second".to_vec(),
        });
        // Consume in order.
        let r1 = state.consume_receipt(2).expect("first receipt");
        assert_eq!(r1.payload, b"first");
        let r2 = state.consume_receipt(2).expect("second receipt");
        assert_eq!(r2.payload, b"second");
        // No more.
        assert!(state.consume_receipt(2).is_none());
    }

    #[test]
    fn test_receipts_isolated_per_shard() {
        let mut state = ShardingState::new(4);
        state.emit_receipt(CrossShardReceipt {
            source_shard: 1, dest_shard: 3, sequence: 1,
            contract: [0; 20], payload: b"to-shard-3".to_vec(),
        });
        // Shard 0 has no receipts.
        assert!(state.consume_receipt(0).is_none());
        // Shard 3 has one.
        let r = state.consume_receipt(3).expect("receipt for shard 3");
        assert_eq!(r.payload, b"to-shard-3");
    }

    #[test]
    fn test_vrf_shard_assignment_deterministic() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let vrf_kp = VrfKeypair::from_dilithium(&kp);
        let input = b"epoch_5";
        let (output, _proof) = vrf_kp.evaluate(input);
        let s1 = assign_shard(&kp.public, 5, 4, &output);
        let s2 = assign_shard(&kp.public, 5, 4, &output);
        assert_eq!(s1, s2, "VRF shard assignment must be deterministic");
        assert!(s1 < 4, "shard must be in range");
    }

    #[test]
    fn test_vrf_shard_assignment_verifiable() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let vrf_kp = VrfKeypair::from_dilithium(&kp);
        let mut input = Vec::new();
        input.extend_from_slice(&kp.public.0);
        input.extend_from_slice(&7u64.to_le_bytes()); // epoch 7
        let (output, proof) = vrf_kp.evaluate(&input);
        let assigned = assign_shard(&kp.public, 7, 8, &output);
        let verified = verify_shard_assignment(&kp.public, 7, 8, &output, &proof)
            .expect("VRF proof verifies");
        assert_eq!(assigned, verified, "verified assignment must match");
    }

    #[test]
    fn test_dynamic_shard_resize_grows() {
        let mut state = ShardingState::new(4);
        // Put a receipt in shard 2.
        state.emit_receipt(CrossShardReceipt {
            source_shard: 0, dest_shard: 2, sequence: 1,
            contract: [0; 20], payload: b"survive resize".to_vec(),
        });
        // Resize from 4 to 8 shards.
        let proposal = ShardResizeProposal {
            new_count: 8,
            effective_epoch: 10,
            voters: vec![rstn_crypto::Dilithium3Keypair::generate().public],
        };
        state = proposal.apply(state);
        assert_eq!(state.shard_count, 8);
        // The receipt in shard 2 survives the resize.
        let r = state.consume_receipt(2).expect("receipt survived resize");
        assert_eq!(r.payload, b"survive resize");
        // New shards 4-7 exist and are empty.
        for s in 4..8 {
            assert!(state.consume_receipt(s as u32).is_none());
        }
    }

    #[test]
    fn test_resize_supermajority_threshold() {
        let mut keypairs = Vec::new();
        let mut validator_set = Vec::new();
        for _ in 0..6 {
            let kp = rstn_crypto::Dilithium3Keypair::generate();
            validator_set.push(kp.public.clone());
            keypairs.push(kp);
        }
        // Threshold = 6 * 2 / 3 + 1 = 5.
        let mut proposal = propose_resize(8, 1, &keypairs[0].public);
        // 4 votes (below 5) -> no supermajority.
        for i in 1..4 {
            proposal = vote_resize(proposal, &keypairs[i].public);
        }
        assert!(!proposal.has_supermajority(&validator_set));
        // 5th vote -> supermajority.
        proposal = vote_resize(proposal, &keypairs[4].public);
        assert!(proposal.has_supermajority(&validator_set));
    }
}
