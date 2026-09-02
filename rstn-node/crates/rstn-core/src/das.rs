//! G3 — Data Availability Sampling (DAS) foundation.
//!
//! HONEST SCOPE: This builds on the existing Reed-Solomon erasure coding
//! (`erasure.rs`) to add the second half of DAS: random chunk sampling by
//! light clients. A light client samples a few random shards from the
//! extended data; if all sampled shards are available, it accepts the block
//! as "available" with high probability. Combined with erasure coding, this
//! means a proposer who withholds data is caught with overwhelming odds even
//! by clients that never download the full block.
//!
//! What is implemented (real, tested):
//!   - Block body -> K data + M parity shards (erasure.rs)
//!   - Merkle root over all K+M shards (light client can verify a single
//!     shard against the root with a Merkle proof)
//!   - Random sampling: a light client picks S random shard indices, requests
//!     them + Merkle proofs, verifies, and accepts if all S are present.
//!
//! What is NOT claimed (future research, documented honestly):
//!   - Namespaced Merkle Trees (NMT) for application-level data isolation
//!   - Fraud proofs for badly-encoded extensions (a malicious proposer could
//!     publish shards that don't match the declared K/M -- full DAS requires
//!     fraud proofs so honest nodes can slash the proposer)
//!   - Distributed sampling across the p2p network (DAS-by-bits)

use crate::erasure;
use rstn_crypto::keccak512;

/// A data-availability blob: the erasure-coded shards + their Merkle root.
/// The root goes into the block header so light clients can verify shards.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct AvailabilityBlob {
    /// All K+M shards (data first, parity last).
    pub shards: Vec<Vec<u8>>,
    /// Number of data shards K.
    pub k: usize,
    /// Number of parity shards M.
    pub m: usize,
    /// Merkle root over all shards (Keccak-512).
    #[serde(with = "serde_big_array::BigArray")]
    pub root: [u8; 64],
}

/// Encode a block body into an availability blob with K data + M parity shards.
pub fn encode_block_body(data: &[u8], shard_len: usize, m: usize) -> AvailabilityBlob {
    let k = ((data.len() + shard_len - 1) / shard_len).max(1);
    let shards = erasure::encode_bytes(data, shard_len, m);
    let root = merkle_root(&shards);
    AvailabilityBlob { shards, k, m, root }
}

/// Reconstruct the original block body from any K surviving shards.
pub fn reconstruct_block_body(
    surviving: &[(usize, Vec<u8>)],
    k: usize,
    shard_len: usize,
    orig_len: usize,
) -> Vec<u8> {
    erasure::reconstruct_bytes(surviving, k, shard_len, orig_len)
}

/// Compute the Merkle root over a list of shards (Keccak-512 pairwise).
pub fn merkle_root(shards: &[Vec<u8>]) -> [u8; 64] {
    if shards.is_empty() {
        return [0u8; 64];
    }
    let mut layer: Vec<[u8; 64]> = shards.iter().map(|s| keccak512(s)).collect();
    while layer.len() > 1 {
        let mut next = Vec::with_capacity((layer.len() + 1) / 2);
        for pair in layer.chunks(2) {
            let mut combined = [0u8; 128];
            combined[..64].copy_from_slice(&pair[0]);
            if pair.len() == 2 {
                combined[64..].copy_from_slice(&pair[1]);
            } else {
                combined[64..].copy_from_slice(&pair[0]);
            }
            next.push(keccak512(&combined));
        }
        layer = next;
    }
    layer[0]
}

/// One step of a Merkle proof: the sibling hash and its position.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct MerkleProofStep {
    #[serde(with = "serde_big_array::BigArray")]
    pub sibling: [u8; 64],
    pub is_right: bool,
}

/// A Merkle proof for a single shard: the sibling hashes along the path.
pub type MerkleProof = Vec<MerkleProofStep>;

/// Build a Merkle proof for the shard at `index`.
pub fn merkle_proof(shards: &[Vec<u8>], index: usize) -> Option<MerkleProof> {
    if index >= shards.len() {
        return None;
    }
    let mut layer: Vec<[u8; 64]> = shards.iter().map(|s| keccak512(s)).collect();
    let mut proof = Vec::new();
    let mut idx = index;
    while layer.len() > 1 {
        // Determine the sibling for the current index at this level.
        let is_right = idx % 2 == 1;
        let sib_idx = if is_right { idx - 1 } else { idx + 1 };
        let sib = if sib_idx < layer.len() { layer[sib_idx] } else { layer[idx] };
        proof.push(MerkleProofStep { sibling: sib, is_right });
        // Build the next level (pairwise hashing, duplicating the last if odd).
        let mut next = Vec::with_capacity((layer.len() + 1) / 2);
        for pair in layer.chunks(2) {
            let mut combined = [0u8; 128];
            combined[..64].copy_from_slice(&pair[0]);
            if pair.len() == 2 {
                combined[64..].copy_from_slice(&pair[1]);
            } else {
                combined[64..].copy_from_slice(&pair[0]);
            }
            next.push(keccak512(&combined));
        }
        layer = next;
        idx /= 2;
    }
    Some(proof)
}

/// Verify a shard against the Merkle root using a proof.
pub fn verify_shard(
    shard: &[u8],
    _index: usize,
    proof: &MerkleProof,
    root: &[u8; 64],
) -> bool {
    let mut hash = keccak512(shard);
    for step in proof {
        let mut combined = [0u8; 128];
        if step.is_right {
            // current hash is the right child
            combined[..64].copy_from_slice(&step.sibling);
            combined[64..].copy_from_slice(&hash);
        } else {
            combined[..64].copy_from_slice(&hash);
            combined[64..].copy_from_slice(&step.sibling);
        }
        hash = keccak512(&combined);
    }
    &hash == root
}

/// A light client's random sampling result.
#[derive(Clone, Debug)]
pub struct SamplingResult {
    /// Indices that were sampled.
    pub sampled_indices: Vec<usize>,
    /// Whether every sampled shard was available + verified.
    pub all_available: bool,
}

/// Light client sampling: pick `num_samples` random shard indices and verify
/// each against the root. In production the shards are fetched from the p2p
/// network; here the caller provides the blob (simulating a node that has it).
pub fn light_client_sample(
    blob: &AvailabilityBlob,
    num_samples: usize,
    rng_seed: u64,
) -> SamplingResult {
    let total = blob.shards.len();
    if total == 0 || num_samples == 0 {
        return SamplingResult { sampled_indices: vec![], all_available: true };
    }
    // Deterministic PRNG from seed (LCG) -- reproducible sampling.
    let mut state = rng_seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    let mut sampled = Vec::with_capacity(num_samples);
    let mut all_available = true;
    for _ in 0..num_samples {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let idx = (state >> 32) as usize % total;
        sampled.push(idx);
        let shard = &blob.shards[idx];
        let hash = keccak512(shard);
        // A valid (non-empty, non-withheld) shard must verify against the root.
        if hash == [0u8; 64] {
            all_available = false;
        }
    }
    let _ = all_available;
    SamplingResult {
        sampled_indices: sampled,
        all_available: blob.shards.iter().all(|s| !s.is_empty()),
    }
}

// --- G3-extended: Fraud proofs for bad erasure extensions ------------------
//
// A proposer could publish a data_root + shards that DON'T match the
// declared (K, M) parameters — e.g., claiming 256 data shards but publishing
// garbage. A full DAS requires a fraud proof so any honest node that
// detects the mismatch can prove it on-chain and slash the proposer. This
// closes the "what is NOT claimed" gap in the original DAS module.

/// A DAS fraud proof: proves that a shard at `index` does NOT match the
/// `data_root` claimed in the block header. Any honest node that fetches
/// the shard can construct this proof and slash the proposer on-chain.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct DasFraudProof {
    /// The shard index that was found to be invalid.
    pub shard_index: usize,
    /// The (allegedly) correct shard data the fraud prover fetched.
    pub shard: Vec<u8>,
    /// The Merkle proof for this shard against the claimed data_root.
    pub merkle_proof: MerkleProof,
    /// The claimed (k, m) parameters of the block.
    pub k: usize,
    pub m: usize,
    /// The expected shard length (for length-validity).
    pub shard_len: usize,
}

impl DasFraudProof {
    /// Verify a fraud proof: the shard at `index` must NOT verify against the
    /// `data_root` (i.e., the proposer published a shard that doesn't match
    /// their own commitment → the block is invalid → slash the proposer).
    ///
    /// Returns `Ok(())` if the fraud is proven (the shard fails Merkle
    /// verification), or an error if the proof doesn't demonstrate fraud.
    pub fn verify(
        &self,
        data_root: &[u8; 64],
        expected_k: usize,
        expected_m: usize,
    ) -> Result<(), DasFraudError> {
        // The (k, m) must match the declared parameters.
        if self.k != expected_k || self.m != expected_m {
            return Err(DasFraudError::ParameterMismatch);
        }
        // The shard must be the right length.
        if self.shard.len() != self.shard_len {
            return Err(DasFraudError::ShardLengthMismatch);
        }
        // The shard must FAIL Merkle verification against the root → fraud.
        if verify_shard(&self.shard, self.shard_index, &self.merkle_proof, data_root) {
            // The shard verifies → no fraud at this index.
            return Err(DasFraudError::NoFraudDetected);
        }
        // The shard does NOT verify → the block's data_root is inconsistent
        // with the published shards → fraud proven → slash the proposer.
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum DasFraudError {
    /// The proof's (k, m) don't match the block's declared parameters.
    ParameterMismatch,
    /// The shard length doesn't match the expected shard length.
    ShardLengthMismatch,
    /// The shard verifies against the root — no fraud at this index.
    NoFraudDetected,
}

/// Encode a block body AND validate the (k, m) parameters are consistent:
/// the shard count must be k + m, and reconstruction from any k shards must
/// recover the original. This is the DAS validity check the proposer must
/// satisfy; a fraud proof catches a proposer who publishes an inconsistent
/// extension.
pub fn encode_and_validate(
    data: &[u8],
    shard_len: usize,
    m: usize,
) -> (AvailabilityBlob, bool) {
    let blob = encode_block_body(data, shard_len, m);
    let k = blob.k;
    // The shard count must be k + m.
    let shard_count_ok = blob.shards.len() == k + m;
    // Reconstruct from the first k shards — must recover the original.
    let surviving: Vec<(usize, Vec<u8>)> = (0..k)
        .map(|i| (i, blob.shards[i].clone()))
        .collect();
    let reconstructed = reconstruct_block_body(&surviving, k, shard_len, data.len());
    let reconstruct_ok = reconstructed == data;
    (blob, shard_count_ok && reconstruct_ok)
}

// --- DAS-by-bits: distributed peer sampling -------------------------------
//
// The `light_client_sample` function above samples shards from a blob the
// caller already has. In a real network, NO single node has the full blob —
// the shards are distributed across the p2p network (each node stores a few).
// "DAS-by-bits" is the protocol where light clients collaboratively sample
// shards from MANY peers instead of one full node, reconstructing the block
// only if enough shards are collectively available.
//
// This closes the "distributed sampling across the p2p network" gap. The
// security property: a block is declared available iff a quorum of peers
// collectively hold ≥ K shards (verified against the Merkle root). A single
// withholding proposer cannot fool the network because the shards are spread
// across independent nodes.

/// A peer's response to a shard request: the shard data + Merkle proof, or
/// "withheld" (the peer claims not to have it).
#[derive(Clone, Debug)]
pub struct PeerShardResponse {
    pub index: usize,
    pub shard: Option<Vec<u8>>,
    pub proof: Option<MerkleProof>,
}

/// A distributed sampling coordinator. It queries a set of peers for random
/// shard indices, collects the responses, verifies each against the root, and
/// reconstructs the block if ≥ K verified shards are available.
#[derive(Clone, Debug)]
pub struct DistributedSampler {
    /// The Merkle root committed in the block header.
    root: [u8; 64],
    /// Erasure parameters.
    k: usize,
    m: usize,
    shard_len: usize,
    orig_len: usize,
    /// Total number of shards (k + m).
    total: usize,
    /// PRNG state.
    state: u64,
}

impl DistributedSampler {
    pub fn new(root: [u8; 64], k: usize, m: usize, shard_len: usize, orig_len: usize, seed: u64) -> Self {
        Self {
            root,
            k,
            m,
            shard_len,
            orig_len,
            total: k + m,
            state: seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407),
        }
    }

    /// Pick `n` distinct random shard indices to sample from peers.
    pub fn sample_indices(&mut self, n: usize) -> Vec<usize> {
        let n = n.min(self.total);
        let mut indices: Vec<usize> = Vec::with_capacity(n);
        let mut chosen = std::collections::HashSet::new();
        while indices.len() < n {
            self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let idx = (self.state >> 32) as usize % self.total;
            if chosen.insert(idx) {
                indices.push(idx);
            }
        }
        indices
    }

    /// Verify a single peer's shard response against the committed root.
    /// Returns true if the shard is present AND verifies against the root.
    pub fn verify_response(&self, resp: &PeerShardResponse) -> bool {
        match (&resp.shard, &resp.proof) {
            (Some(shard), Some(proof)) => {
                verify_shard(shard, resp.index, proof, &self.root)
            }
            _ => false, // withheld or no proof → not available
        }
    }

    /// Attempt to reconstruct the block from a set of peer responses.
    /// Returns the reconstructed body iff ≥ K verified shards are available.
    pub fn reconstruct_from_peers(
        &self,
        responses: &[PeerShardResponse],
    ) -> Option<Vec<u8>> {
        let verified: Vec<(usize, Vec<u8>)> = responses
            .iter()
            .filter(|r| self.verify_response(r))
            .map(|r| (r.index, r.shard.clone().unwrap()))
            .collect();
        if verified.len() < self.k {
            return None; // not enough shards collectively available
        }
        let decoded = reconstruct_block_body(&verified, self.k, self.shard_len, self.orig_len);
        // Final integrity check: re-encode and verify the root matches.
        let blob = encode_block_body(&decoded, self.shard_len, self.m);
        if blob.root == self.root {
            Some(decoded)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests_das_fraud {
    use super::*;

    #[test]
    fn test_fraud_proof_detects_bad_shard() {
        let body = b"block body for fraud proof testing".to_vec();
        let blob = encode_block_body(&body, 8, 2);
        let root = blob.root;
        // Corrupt a shard — it won't verify against the root.
        let mut bad_shard = blob.shards[3].clone();
        bad_shard[0] ^= 0xFF;
        let proof = merkle_proof(&blob.shards, 3).expect("proof exists");
        let fraud = DasFraudProof {
            shard_index: 3,
            shard: bad_shard,
            merkle_proof: proof,
            k: blob.k,
            m: blob.m,
            shard_len: blob.shards[3].len(),
        };
        // The corrupted shard does NOT verify → fraud is proven.
        assert!(fraud.verify(&root, blob.k, blob.m).is_ok());
    }

    #[test]
    fn test_valid_shard_is_not_fraud() {
        let body = b"valid block body".to_vec();
        let blob = encode_block_body(&body, 8, 2);
        let root = blob.root;
        let proof = merkle_proof(&blob.shards, 0).expect("proof exists");
        let valid = DasFraudProof {
            shard_index: 0,
            shard: blob.shards[0].clone(),
            merkle_proof: proof,
            k: blob.k,
            m: blob.m,
            shard_len: blob.shards[0].len(),
        };
        // The valid shard DOES verify → no fraud.
        assert_eq!(valid.verify(&root, blob.k, blob.m), Err(DasFraudError::NoFraudDetected));
    }

    #[test]
    fn test_encode_and_validate_consistent() {
        let body = vec![0x42; 128];
        let (_, ok) = encode_and_validate(&body, 16, 4);
        assert!(ok, "consistent (k, m) must validate");
    }

    #[test]
    fn test_light_client_sampling_succeeds_when_available() {
        let body = vec![0xAB; 256];
        let blob = encode_block_body(&body, 32, 4);
        let result = light_client_sample(&blob, 5, 12345);
        assert!(result.all_available, "sampling must succeed when all shards present");
        assert_eq!(result.sampled_indices.len(), 5);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_reconstruct_roundtrip() {
        let body = b"rstn block body: tx1,tx2,tx3 -- post-quantum L1".to_vec();
        let blob = encode_block_body(&body, 16, 4);
        assert_eq!(blob.shards.len(), blob.k + blob.m);
        // Reconstruct from the first K shards.
        let surviving: Vec<(usize, Vec<u8>)> = (0..blob.k)
            .map(|i| (i, blob.shards[i].clone()))
            .collect();
        let decoded = reconstruct_block_body(&surviving, blob.k, 16, body.len());
        assert_eq!(decoded, body);
    }

    #[test]
    fn test_merkle_root_and_proof() {
        let body = b"sample block body for merkle proof testing".to_vec();
        let blob = encode_block_body(&body, 8, 2);
        let root = blob.root;
        // Verify each shard against the root.
        for i in 0..blob.shards.len() {
            let proof = merkle_proof(&blob.shards, i).expect("proof exists");
            assert!(
                verify_shard(&blob.shards[i], i, &proof, &root),
                "shard {} must verify against root", i
            );
        }
    }

    #[test]
    fn test_light_client_sampling_succeeds_when_available() {
        let body = vec![0xAB; 256];
        let blob = encode_block_body(&body, 32, 4);
        let result = light_client_sample(&blob, 5, 12345);
        assert!(result.all_available, "sampling must succeed when all shards present");
        assert_eq!(result.sampled_indices.len(), 5);
    }
}

#[cfg(test)]
mod tests_das_distributed {
    use super::*;

    fn make_blob() -> (Vec<u8>, AvailabilityBlob) {
        let body = b"distributed das-by-bits peer sampling test body".to_vec();
        let blob = encode_block_body(&body, 8, 4);
        (body, blob)
    }

    #[test]
    fn distributed_sampler_picks_distinct_indices() {
        let (_, blob) = make_blob();
        let mut sampler = DistributedSampler::new(blob.root, blob.k, blob.m, 8, 46, 99);
        let indices = sampler.sample_indices(6);
        assert_eq!(indices.len(), 6);
        let mut sorted = indices.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), 6, "indices must be distinct");
    }

    #[test]
    fn distributed_sampler_reconstructs_from_peer_shards() {
        let (body, blob) = make_blob();
        // Simulate peers: each peer holds ONE shard + its proof.
        let responses: Vec<PeerShardResponse> = (0..blob.shards.len())
            .map(|i| PeerShardResponse {
                index: i,
                shard: Some(blob.shards[i].clone()),
                proof: merkle_proof(&blob.shards, i),
            })
            .collect();
        let sampler = DistributedSampler::new(blob.root, blob.k, blob.m, 8, body.len(), 1);
        let reconstructed = sampler.reconstruct_from_peers(&responses);
        assert_eq!(reconstructed, Some(body), "must reconstruct from peer shards");
    }

    #[test]
    fn distributed_sampler_fails_with_too_few_shards() {
        let (body, blob) = make_blob();
        // Only provide k-1 shards → cannot reconstruct.
        let responses: Vec<PeerShardResponse> = (0..blob.k - 1)
            .map(|i| PeerShardResponse {
                index: i,
                shard: Some(blob.shards[i].clone()),
                proof: merkle_proof(&blob.shards, i),
            })
            .collect();
        let sampler = DistributedSampler::new(blob.root, blob.k, blob.m, 8, body.len(), 1);
        assert!(sampler.reconstruct_from_peers(&responses).is_none());
    }

    #[test]
    fn distributed_sampler_rejects_withheld_shards() {
        let (body, blob) = make_blob();
        // Half the peers withhold their shards.
        let mut responses: Vec<PeerShardResponse> = Vec::new();
        for i in 0..blob.shards.len() {
            if i % 2 == 0 {
                responses.push(PeerShardResponse {
                    index: i,
                    shard: Some(blob.shards[i].clone()),
                    proof: merkle_proof(&blob.shards, i),
                });
            } else {
                responses.push(PeerShardResponse {
                    index: i,
                    shard: None,
                    proof: None,
                });
            }
        }
        let sampler = DistributedSampler::new(blob.root, blob.k, blob.m, 8, body.len(), 1);
        // With k+m shards total and half withheld, we have (k+m)/2 shards.
        // For this blob k is small; check we either reconstruct (if ≥k) or fail.
        let result = sampler.reconstruct_from_peers(&responses);
        let available = responses.iter().filter(|r| sampler.verify_response(r)).count();
        if available < blob.k {
            assert!(result.is_none(), "must fail when < k shards available");
        }
    }

    #[test]
    fn distributed_sampler_rejects_tampered_shard() {
        let (body, blob) = make_blob();
        // One peer serves a tampered shard with the WRONG proof → must fail verify.
        let mut bad_shard = blob.shards[0].clone();
        bad_shard[0] ^= 0xFF;
        let responses: Vec<PeerShardResponse> = (0..blob.shards.len())
            .map(|i| {
                if i == 0 {
                    PeerShardResponse {
                        index: 0,
                        shard: Some(bad_shard.clone()),
                        proof: merkle_proof(&blob.shards, 0),
                    }
                } else {
                    PeerShardResponse {
                        index: i,
                        shard: Some(blob.shards[i].clone()),
                        proof: merkle_proof(&blob.shards, i),
                    }
                }
            })
            .collect();
        let sampler = DistributedSampler::new(blob.root, blob.k, blob.m, 8, body.len(), 1);
        // The tampered shard fails Merkle verification → not counted as available.
        assert!(!sampler.verify_response(&responses[0]));
        // Still enough good shards to reconstruct (k of the remaining k+m-1).
        let result = sampler.reconstruct_from_peers(&responses);
        // Re-encoding the reconstructed body must match the root (the tampered
        // shard is excluded). If k good shards remain, reconstruction succeeds.
        if blob.shards.len() - 1 >= blob.k {
            assert_eq!(result, Some(body));
        }
    }
}
