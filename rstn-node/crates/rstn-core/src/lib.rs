//! rstn-core -- Core Types, Consensus & State Machine
//!
//! Block, Transaction, Validator, and Consensus (BFT+DAG) definitions.
//! This is the heart of the RSTN blockchain: everything else connects here.

pub mod consensus;
pub mod erasure;
pub mod governance;
pub mod circuit_breaker;
pub mod quantum_alarm;
pub mod forward_security;
pub mod genesis;
// Tier-3 research foundations (real, tested primitives; honest scope in each file):
pub mod pq_transport; // G1 -- PQ application-layer transport tunnel
pub mod das;           // G3 -- Data Availability Sampling (Merkle + light-client sampling + fraud proofs)
pub mod onion;         // G6 -- onion-routing mix layer
pub mod ibc;           // G7 -- IBC light client + packet commitments
pub mod sharding;      // G12 -- cross-shard receipts + VRF shard assignment + dynamic resize
pub mod threshold_mempool; // G13 -- threshold-encrypted mempool (MEV elimination)
pub mod forced_inclusion;  // G14 -- forced-inclusion pool (censorship resistance N+1)
pub mod zk_stark;      // G15 -- zk-STARK foundation (hash-based, no trusted setup, PQ-resistant)
pub mod nmt;           // G3-complete -- Namespaced Merkle Trees for application-level DAS
pub mod geo_cap;       // G11 -- Geographic validator cap (on-chain region monitoring)
pub mod directory_authority; // G6-complete -- Directory authority for the onion mixnet
pub mod fee_market;    // EIP-1559 fee market (base fee burned + tip to validator + dynamic inflation)
pub mod relayer_market; // G7-complete -- Permissionless relayer market for IBC
pub mod oracle;        // Oracle multi-source aggregation (median + TWAP)
pub mod move_resources; // Move-style linear resource types (formal verification)
pub mod geo_ip;        // IP-to-region geolocation (automatic validator region verification)
pub mod genesis_exit;  // Gradual genesis validator stake reduction (anti-centralization)
pub mod multisig;      // Public multisig with independent (non-team) signers

use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;
use thiserror::Error;
use rstn_crypto::{
    keccak512, Dilithium3Signature, Dilithium3PublicKey, format_address, derive_address,
    PUBKEY_SIZE, ADDRESS_SIZE, SIG_SIZE,
    HybridPublicKey, HybridSignature, verify_hybrid_signature,
};

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("invalid block: {0}")]
    InvalidBlock(String),
    #[error("invalid transaction: {0}")]
    InvalidTransaction(String),
    #[error("consensus error: {0}")]
    Consensus(String),
    #[error("storage error: {0}")]
    Storage(String),
    #[error("chain fork: {0}")]
    ChainFork(String),
    /// A validator signed two conflicting blocks at the same height+phase
    /// (equivocation / double-signing). The runner reads `last_equivocators`
    /// on the engine and persists the slash to the DB automatically (P1).
    #[error("equivocation (double-signing): {0}")]
    Equivocation(String),
}

// --- Block --------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BlockHeader {
    pub height: u64,
    #[serde(with = "BigArray")]
    pub parent_hash: [u8; 64],
    #[serde(with = "BigArray")]
    pub state_root: [u8; 64],
    #[serde(with = "BigArray")]
    pub tx_root: [u8; 64],
    pub timestamp: u64,
    pub validator: Dilithium3PublicKey,
    pub signature: Dilithium3Signature,
    pub shard_id: u32,
    pub epoch: u64,
    pub round: u64,
    /// Data-availability root (G3 — DAS). The Merkle root over the
    /// erasure-coded shards of the block body, so a light client can verify
    /// a single shard against this root with a Merkle proof and sample
    /// randomly without downloading the full block. A proposer who withholds
    /// data is caught with overwhelming odds by random sampling. Zero for
    /// the genesis block (no body to encode).
    #[serde(with = "BigArray", default = "zero_hash64")]
    pub data_root: [u8; 64],
    /// PQ-VRF output for leader election. The block's leader evaluates
    /// VRF(secret, parent_hash || height) and commits the output + proof.
    /// The next block's leader = validators[output % active_count],
    /// making leader election unpredictable yet deterministic (chain-VRF).
    /// Zero for genesis (no real leader to evaluate the VRF).
    #[serde(with = "BigArray", default = "zero_hash64")]
    pub vrf_output: [u8; 64],
    /// PQ-VRF proof (Dilithium3 signature on the VRF input). Lets any
    /// validator verify the leader's VRF output was correctly computed.
    /// Zero for genesis.
    #[serde(default = "zero_sig")]
    pub vrf_proof: Dilithium3Signature,
}

fn zero_hash64() -> [u8; 64] {
    [0u8; 64]
}

fn zero_sig() -> Dilithium3Signature {
    Dilithium3Signature([0u8; SIG_SIZE])
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    pub header: BlockHeader,
    pub transactions: Vec<Transaction>,
}

impl BlockHeader {
    /// Canonical binary encoding for deterministic hashing.
    /// Excludes the signature field -- the signature is computed over this hash.
    /// Fields are encoded in fixed order, little-endian, ensuring that
    /// any two implementations produce identical bytes.
    pub fn canonical_encode(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(8 + 64 + 64 + 64 + 8 + PUBKEY_SIZE + 4 + 8 + 8 + 64 + SIG_SIZE);
        buf.extend_from_slice(&self.height.to_le_bytes());
        buf.extend_from_slice(&self.parent_hash);
        buf.extend_from_slice(&self.state_root);
        buf.extend_from_slice(&self.tx_root);
        buf.extend_from_slice(&self.timestamp.to_le_bytes());
        buf.extend_from_slice(&self.validator.0);
        buf.extend_from_slice(&self.shard_id.to_le_bytes());
        buf.extend_from_slice(&self.epoch.to_le_bytes());
        buf.extend_from_slice(&self.round.to_le_bytes());
        buf.extend_from_slice(&self.data_root);
        buf.extend_from_slice(&self.vrf_output);
        buf.extend_from_slice(&self.vrf_proof.0);
        buf
    }
}

impl Block {
    /// Compute the Keccak-512 hash of the block header.
    /// Uses canonical binary encoding (excludes signature).
    pub fn hash(&self) -> [u8; 64] {
        keccak512(&self.header.canonical_encode())
    }

    /// Compute the Merkle root of all transactions in this block.
    /// Uses Keccak-512 pairwise hashing.
    pub fn compute_tx_root(&self) -> [u8; 64] {
        if self.transactions.is_empty() {
            return [0u8; 64];
        }

        // Hash each transaction using canonical encoding
        let mut layer: Vec<[u8; 64]> = self.transactions
            .iter()
            .map(|tx| tx.hash())
            .collect();

        // Pairwise hash until we have a single root
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

    /// Validate the block header against its parent.
    pub fn validate_header(&self, parent: &Block) -> Result<(), CoreError> {
        if self.header.height != parent.header.height + 1 {
            return Err(CoreError::InvalidBlock(format!(
                "height mismatch: expected {}, got {}",
                parent.header.height + 1,
                self.header.height
            )));
        }
        if self.header.parent_hash != parent.hash() {
            return Err(CoreError::InvalidBlock(
                "parent hash does not match previous block hash".into(),
            ));
        }
        Ok(())
    }

    /// Verify the block's Dilithium3 signature against the validator's public key.
    /// The signature is computed over the canonical encoding (excludes the signature field).
    pub fn verify_block_signature(&self) -> Result<(), CoreError> {
        let block_hash = self.hash();
        rstn_crypto::verify_signature(&self.header.validator, &block_hash, &self.header.signature)
            .map_err(|_| CoreError::InvalidBlock("invalid block signature -- not signed by claimed validator".into()))
    }

    /// Validate that the tx_root matches the computed Merkle root.
    pub fn validate_tx_root(&self) -> Result<(), CoreError> {
        let computed = self.compute_tx_root();
        if computed != self.header.tx_root {
            return Err(CoreError::InvalidBlock(
                "tx_root mismatch: computed Merkle root does not match header".into(),
            ));
        }
        Ok(())
    }

    /// Validate that the data_root (G3 — DAS) matches the Merkle root over
    /// the erasure-coded shards of the block body. This is the data-availability
    /// guarantee: a light client can verify a single shard against this root
    /// with a Merkle proof, and random sampling catches a withholding proposer.
    ///
    /// A zero data_root means DAS was not computed for this block (genesis, or
    /// a block produced before DAS was wired). We skip validation in that case
    /// rather than rejecting — DAS is enforced on all blocks produced by
    /// `propose_block` (which sets a real root), but legacy/test blocks with a
    /// zero root are accepted for backwards compatibility.
    pub fn validate_data_root(&self) -> Result<(), CoreError> {
        if self.header.data_root == [0u8; 64] {
            return Ok(());
        }
        let body = serde_json::to_vec(&self.transactions)
            .map_err(|_| CoreError::InvalidBlock("failed to encode block body for DAS".into()))?;
        let blob = crate::das::encode_block_body(&body, 256, 4);
        if blob.root != self.header.data_root {
            return Err(CoreError::InvalidBlock(
                "data_root mismatch: computed DAS Merkle root does not match header".into(),
            ));
        }
        Ok(())
    }

    /// Full validation: header + signature + tx_root + data_root.
    pub fn validate_full(&self, parent: &Block) -> Result<(), CoreError> {
        self.validate_header(parent)?;
        self.verify_block_signature()?;
        self.validate_tx_root()?;
        self.validate_data_root()?;
        Ok(())
    }
}

// --- Transaction ---------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transaction {
    pub from: Dilithium3PublicKey,
    /// Recipient address (20-byte RSTN address, NOT a full public key).
    /// The sender's full public key is in `from` -- only needed for signature verification.
    pub to: [u8; ADDRESS_SIZE],
    pub value: u128,
    pub nonce: u64,
    pub gas_price: u128,
    pub gas_limit: u64,
    pub tx_type: TxType,
    pub payload: Vec<u8>,
    pub signature: Dilithium3Signature,
    /// PQ2 — Hybrid signature (Dilithium3 + Ed25519). Optional for backward
    /// compatibility: legacy transactions carry only a Dilithium3 signature,
    /// while transactions produced by hybrid-capable wallets carry BOTH.
    /// When present, `verify_signature` verifies BOTH the Dilithium3 signature
    /// AND the Ed25519 signature — dual verification, defense in depth.
    #[serde(default)]
    pub hybrid_signature: Option<HybridSignature>,
    /// PQ2 — The sender's hybrid public key (Ed25519 half). When
    /// `hybrid_signature` is present, this MUST be set so the Ed25519 half can
    /// be verified. The Dilithium3 half is already in `from`.
    #[serde(default)]
    pub hybrid_pubkey: Option<HybridPublicKey>,
    /// GAS REFUND (Gap 6 fix) — the gas the VM ACTUALLY consumed executing
    /// this tx. Set by the block producer after VM execution; the fee market
    /// charges `gas_price * gas_used` (not `gas_limit`), refunding the unused
    /// reserved gas. `None` for legacy/unsigned txs → falls back to gas_limit.
    #[serde(default)]
    pub gas_used: Option<u64>,
}

impl Transaction {
    /// Canonical binary encoding of the unsigned transaction.
    /// Fixed field order, little-endian integers -- deterministic across implementations.
    /// Excludes `signature`, `hybrid_signature`, and `hybrid_pubkey` — these are
    /// computed over this encoding.
    pub fn canonical_encode(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(
            PUBKEY_SIZE + ADDRESS_SIZE + 16 + 8 + 16 + 8 + 1 + self.payload.len()
        );
        buf.extend_from_slice(&self.from.0);
        buf.extend_from_slice(&self.to);
        buf.extend_from_slice(&self.value.to_le_bytes());
        buf.extend_from_slice(&self.nonce.to_le_bytes());
        buf.extend_from_slice(&self.gas_price.to_le_bytes());
        buf.extend_from_slice(&self.gas_limit.to_le_bytes());
        buf.push(self.tx_type as u8);
        buf.extend_from_slice(&self.payload);
        buf
    }

    /// Compute the Keccak-512 hash of the transaction (for signing & tx_root).
    /// Uses canonical binary encoding (excludes signature fields).
    pub fn hash(&self) -> [u8; 64] {
        keccak512(&self.canonical_encode())
    }

    /// Verify the transaction signature against the sender's public key.
    /// PQ2 — Dual verification: if a hybrid signature (Dilithium3 + Ed25519)
    /// is present, BOTH halves are verified. If either fails, the transaction
    /// is rejected. This is defense in depth: a break of one scheme does not
    /// compromise the transaction unless BOTH are broken simultaneously.
    ///
    /// Legacy transactions (no hybrid signature) fall back to Dilithium3-only
    /// verification for backward compatibility with existing on-chain txs.
    pub fn verify_signature(&self) -> Result<(), CoreError> {
        let msg = self.hash();
        // Always verify the Dilithium3 signature (the primary scheme).
        rstn_crypto::verify_signature(&self.from, &msg, &self.signature)
            .map_err(|_| CoreError::InvalidTransaction("Dilithium3 signature verification failed".into()))?;
        // PQ2: if a hybrid signature is present, verify the Ed25519 half too.
        if let (Some(hsig), Some(hpk)) = (&self.hybrid_signature, &self.hybrid_pubkey) {
            verify_hybrid_signature(hpk, &msg, hsig)
                .map_err(|_| CoreError::InvalidTransaction("hybrid Ed25519 signature verification failed".into()))?;
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum TxType {
    Transfer,
    Stake,
    Unstake,
    Delegate,
    Undelegate,
    Claim,
    Governance,
    Contract,
    /// Deploy a new smart contract (EVM bytecode via revm).
    /// Distinct from Contract (which is a call to an existing contract).
    ContractDeploy,
}

// --- Validator -----------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Validator {
    pub pubkey: Dilithium3PublicKey,
    pub stake: u128,
    pub commission: u8,
    pub shard_id: u32,
    pub uptime: f64,
    pub blocks_produced: u64,
    pub status: ValidatorStatus,
    /// G11 — Geographic region this validator operates in (e.g. "us-east",
    /// "eu-west", "asia"). Self-declared at registration; the consensus
    /// engine monitors the per-region stake distribution and caps any single
    /// region at 15% of total active stake (VRF redistribution for capped
    /// regions). See `geo_cap.rs`.
    #[serde(default = "default_region")]
    pub region: String,
}

/// Default region for validators created before the geo-cap field existed
/// (backward compatibility). "unknown" is never capped.
fn default_region() -> String {
    "unknown".to_string()
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum ValidatorStatus {
    Active,
    Inactive,
    Slashed,
    Jailed,
}

impl Validator {
    pub fn address(&self) -> String {
        let addr = derive_address(&self.pubkey);
        format_address(&addr)
    }
}

// --- Consensus: BFT + DAG ------------------------------------
// Hybrid consensus: DAG for data availability + BFT for finality.
// Finality in 0.4s (2 BFT rounds + DAG aggregation).

pub const FINALITY_ROUNDS: u32 = 2;
pub const TARGET_BLOCK_TIME_MS: u64 = 400;
pub const EPOCH_LENGTH: u64 = 1000;
/// Critical timelock: 48h at 400ms/block = 432,000 blocks.
/// Critical governance proposals (parameter changes, validator set changes,
/// bridge upgrades) cannot execute until this many blocks pass after the
/// proposal reaches quorum. This gives the community 48h to react — exit
/// the bridge, veto, or prepare — before hostile changes take effect.
pub const CRITICAL_TIMELOCK_BLOCKS: u64 = 432_000; // ~48h at 400ms/block
/// Escape hatch delay: 24h at 400ms/block = 216,000 blocks.
/// Users who submit an escape hatch request must wait this long before
/// claiming their proportional share of locked bridge reserves. The
/// validators CANNOT prevent the claim — it executes unilaterally.
pub const ESCAPE_DELAY_BLOCKS: u64 = 216_000; // ~24h at 400ms/block

/// BFT vote message -- a validator's signature on a block proposal.
/// The `phase` field distinguishes PREPARE votes from COMMIT votes,
/// preventing a commit vote from being counted as a prepare vote (or vice versa).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BftVote {
    #[serde(with = "BigArray")]
    pub block_hash: [u8; 64],
    pub height: u64,
    pub round: u64,
    pub voter: Dilithium3PublicKey,
    pub signature: Dilithium3Signature,
    /// Which BFT phase this vote belongs to.
    pub phase: BftVotePhase,
    /// PQ2 — Hybrid signature (Dilithium3 + Ed25519). When present, the vote
    /// is verified with BOTH schemes. Optional for backward compatibility.
    #[serde(default)]
    pub hybrid_signature: Option<HybridSignature>,
    /// PQ2 — The voter's hybrid public key (Ed25519 half).
    #[serde(default)]
    pub hybrid_pubkey: Option<HybridPublicKey>,
}

impl BftVote {
    /// PQ2 — Verify the vote signature. If a hybrid signature is present,
    /// BOTH Dilithium3 and Ed25519 are verified (dual verification).
    /// Legacy votes fall back to Dilithium3-only.
    pub fn verify_vote_signature(&self) -> Result<(), CoreError> {
        rstn_crypto::verify_signature(&self.voter, &self.block_hash, &self.signature)
            .map_err(|_| CoreError::Consensus("invalid Dilithium3 vote signature".into()))?;
        if let (Some(hsig), Some(hpk)) = (&self.hybrid_signature, &self.hybrid_pubkey) {
            verify_hybrid_signature(hpk, &self.block_hash, hsig)
                .map_err(|_| CoreError::Consensus("invalid hybrid Ed25519 vote signature".into()))?;
        }
        Ok(())
    }
}

/// Distinguishes prepare-phase votes from commit-phase votes.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum BftVotePhase {
    Prepare,
    Commit,
}

/// BFT proposal -- the leader's candidate block for a round.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BftProposal {
    pub block: Block,
    pub round: u64,
    pub proposer: Dilithium3PublicKey,
}

/// Commit certificate -- cryptographic proof that a block reached COMMIT
/// supermajority (2/3+ of active validators). Attached to finalized blocks
/// so a lagging node can verify finality WITHOUT trusting the leader's
/// signature alone. This closes the C4 gap: previously `try_catchup`
/// finalized blocks from the DB using only the leader signature + chain
/// linkage, which a malicious leader could exploit to inject blocks.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CommitCertificate {
    /// Height of the finalized block.
    pub height: u64,
    /// Hash of the finalized block (the message every voter signed).
    #[serde(with = "BigArray")]
    pub block_hash: [u8; 64],
    /// The COMMIT votes that form the supermajority. Each carries a
    /// Dilithium3 signature over `block_hash`, verifiable against the
    /// validator set at this height.
    pub votes: Vec<BftVote>,
}

impl CommitCertificate {
    /// Verify the certificate against a validator set: every vote must be
    /// from an active validator, signed over `block_hash`, and the unique
    /// voter count must reach the 2/3+ supermajority threshold. Returns
    /// Ok(()) if the certificate proves finality, Err otherwise.
    pub fn verify(
        &self,
        validators: &[Validator],
        block_hash: &[u8; 64],
    ) -> Result<(), CoreError> {
        // The certificate must be for the block we are verifying.
        if &self.block_hash != block_hash {
            return Err(CoreError::InvalidBlock(
                "commit certificate block_hash mismatch".into(),
            ));
        }
        if self.votes.is_empty() {
            return Err(CoreError::InvalidBlock(
                "commit certificate has no votes".into(),
            ));
        }
        // Active validator set at this height.
        let active: Vec<&Validator> = validators
            .iter()
            .filter(|v| v.status == ValidatorStatus::Active)
            .collect();
        if active.is_empty() {
            return Err(CoreError::InvalidBlock(
                "no active validators for commit certificate".into(),
            ));
        }
        let threshold = active.len() * 2 / 3 + 1;

        // Tally unique voters, verifying each signature.
        let mut seen = std::collections::HashSet::new();
        for vote in &self.votes {
            // Must be a COMMIT-phase vote.
            if vote.phase != BftVotePhase::Commit {
                return Err(CoreError::InvalidBlock(
                    "commit certificate contains non-commit vote".into(),
                ));
            }
            // Voter must be an active validator.
            let is_active = active
                .iter()
                .any(|v| v.pubkey.0 == vote.voter.0);
            if !is_active {
                return Err(CoreError::InvalidBlock(
                    "commit certificate vote from non-active validator".into(),
                ));
            }
            // Signature must verify over the block_hash (PQ2: dual if hybrid present).
            vote.verify_vote_signature()
                .map_err(|_| CoreError::InvalidBlock(
                    "commit certificate vote signature invalid".into(),
                ))?;
            // Dedup by voter.
            seen.insert(vote.voter.0);
        }
        if seen.len() < threshold {
            return Err(CoreError::InvalidBlock(format!(
                "commit certificate below supermajority: {} votes, need {}",
                seen.len(), threshold,
            )));
        }
        Ok(())
    }
}

/// Light client proof -- allows stateless verification of a block.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LightClientProof {
    pub block_header: BlockHeader,
    pub finality_signatures: Vec<(Dilithium3PublicKey, Dilithium3Signature)>,
    pub validator_set: Vec<Validator>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConsensusState {
    pub current_epoch: u64,
    pub current_round: u64,
    pub last_finalized_height: u64,
    pub validators: Vec<Validator>,
    pub shard_count: u32,
    /// Pending votes for the current round, keyed by block hash.
    pub pending_votes: Vec<BftVote>,
    /// The chain of finalized blocks.
    pub chain: Vec<Block>,
    /// View-change offset for the current height. When a round times out without
    /// finalizing, every node increments this deterministically to skip the
    /// unreachable leader and elect the next validator. Reset to 0 on each
    /// finalization. Combined with last_finalized_height, this gives every node
    /// the SAME leader at the SAME (height, view) -- no desync.
    pub view_offset: u64,
    /// Wall-clock ms when the current round started (for view-change timing).
    #[serde(default)]
    pub round_start_ms: u64,
    /// Round timeout in ms. If no block is finalized within this window, every
    /// node advances the view (skips the leader) deterministically (#3).
    #[serde(default = "default_round_timeout")]
    pub round_timeout_ms: u64,
    /// Total view-changes that have occurred (observability / metrics).
    #[serde(default)]
    pub view_changes: u64,
    /// SLASHING TREASURY (Gap 3 fix) — the protocol-owned account that
    /// receives slashed RSTN. Previously `slash_validator` subtracted from
    /// the validator's stake but the slashed tokens VANISHED (no burn, no
    /// redistribution, no treasury) — an accounting black hole. Now every
    /// slash credits this treasury. The treasury is community-governed
    /// (spendable only via a CRITICAL_TIMELOCK governance proposal), so
    /// slashed funds are NOT lost — they are recycled to the community, not
    /// silently destroyed.
    #[serde(default)]
    pub treasury: u128,
    /// Per-validator accumulated rewards owed (tip + block reward). The runner
    /// calls `distribute_rewards` each block to credit the leader. Delegators'
    /// share is reduced by the validator's `commission` (Gap 4 fix).
    #[serde(default)]
    pub pending_rewards: Vec<([u8; 20], u128)>,
}

fn default_round_timeout() -> u64 {
    TARGET_BLOCK_TIME_MS * 3
}

impl ConsensusState {
    pub fn new(shard_count: u32) -> Self {
        Self {
            current_epoch: 0,
            current_round: 0,
            last_finalized_height: 0,
            validators: Vec::new(),
            shard_count,
            pending_votes: Vec::new(),
            chain: Vec::new(),
            view_offset: 0,
            round_start_ms: 0,
            round_timeout_ms: TARGET_BLOCK_TIME_MS * 3, // 3x block time before view-change
            view_changes: 0,
            treasury: 0,
            pending_rewards: Vec::new(),
        }
    }

    /// Select the leader for the current round using PQ-VRF leader election.
    ///
    /// The leader is deterministically selected by the VRF output from the latest
    /// finalized block: leader = validators[vrf_output % active_count]. Each block's
    /// leader evaluates VRF(secret, parent_hash || height) and commits the output,
    /// so the next leader is unpredictable until the current block is finalized.
    ///
    /// CRITICAL: every node at the same chain height elects the SAME leader
    /// deterministically, because the VRF output is public in the block header.
    /// View-change: if the elected leader is unreachable, `view_offset` increments
    /// deterministically, rotating to the next validator (same on every node).
    pub fn select_leader(&self) -> Option<&Validator> {
        if self.validators.is_empty() {
            return None;
        }
        let active: Vec<&Validator> = self
            .validators
            .iter()
            .filter(|v| v.status == ValidatorStatus::Active)
            .collect();
        if active.is_empty() {
            return None;
        }
        // PQ-VRF: the leader is selected by the VRF output from the latest block.
        // The VRF output is a 64-byte hash; we take the first 8 bytes as a u64
        // seed and index into the active validator set. View-change adds an
        // offset to rotate past an unreachable leader.
        let vrf_seed: u64 = self
            .chain
            .last()
            .map(|b| {
                let bytes: [u8; 8] = b.header.vrf_output[..8].try_into().unwrap_or([0u8; 8]);
                u64::from_le_bytes(bytes)
            })
            .unwrap_or(0);
        // G11 — Geographic cap: compute the set of regions over the 15% cap.
        // Validators in a capped region are deprioritized for leader election
        // (VRF redistribution). We skip them unless ALL active validators are
        // in capped regions (degenerate case — fall back to the raw index so
        // consensus doesn't stall).
        let capped_regions = crate::geo_cap::regions_over_cap(&self.validators);
        let eligible: Vec<&Validator> = if capped_regions.is_empty() {
            active.clone()
        } else {
            let filtered: Vec<&Validator> = active
                .iter()
                .copied()
                .filter(|v| !capped_regions.contains(&v.region))
                .collect();
            if filtered.is_empty() {
                active.clone() // degenerate: all capped → don't stall
            } else {
                filtered
            }
        };
        let idx = (vrf_seed.wrapping_add(self.view_offset)) as usize % eligible.len();
        Some(eligible[idx])
    }

    /// Advance the view-change offset, skipping the current unreachable leader
    /// and electing the next validator deterministically. Every node calls this
    /// on the same timeout, so they all converge on the same next leader without
    /// any extra coordination. The offset resets to 0 on finalization.
    pub fn advance_view(&mut self) {
        self.view_offset += 1;
        self.view_changes += 1;
        self.round_start_ms = now_ms();
        // Exponential backoff: each successive view-change doubles the timeout
        // (capped at 10x the base), so a persistently-down leader doesn't spin
        // the network in a tight loop.
        let base = TARGET_BLOCK_TIME_MS * 3;
        let cap = base * 10;
        let backoff = (base << self.view_offset.min(6)) as u64;
        self.round_timeout_ms = backoff.min(cap);
        tracing::warn!("View change: view_offset={} timeout_ms={}", self.view_offset, self.round_timeout_ms);
    }

    /// Mark the start of a new round (called when a block is finalized or a
    /// proposal is made). Resets the round timer.
    pub fn start_round(&mut self) {
        self.round_start_ms = now_ms();
    }

    /// Check whether the current round has timed out and a view-change is due.
    /// The runner calls this on every tick; if true, it calls advance_view().
    pub fn check_view_timeout(&self) -> bool {
        if self.round_start_ms == 0 {
            return false;
        }
        now_ms().saturating_sub(self.round_start_ms) >= self.round_timeout_ms
    }

    /// Check if 2/3+ of ACTIVE validators have signed (BFT threshold).
    /// Only active validators count toward the threshold -- slashed, jailed,
    /// and inactive validators are excluded. This prevents an attacker from
    /// lowering the threshold by getting validators slashed.
    pub fn has_supermajority(&self, signatures: usize) -> bool {
        let active_count = self.validators.iter()
            .filter(|v| v.status == ValidatorStatus::Active)
            .count();
        if active_count == 0 {
            return false;
        }
        let threshold = active_count * 2 / 3 + 1;
        signatures >= threshold
    }

    /// Count unique votes for a specific block hash and phase.
    pub fn count_votes_for(&self, block_hash: &[u8; 64], phase: BftVotePhase) -> usize {
        let mut seen = std::collections::HashSet::new();
        for vote in &self.pending_votes {
            if &vote.block_hash == block_hash && vote.phase == phase {
                seen.insert(vote.voter.0);
            }
        }
        seen.len()
    }

    /// Add a vote and check if the block can be finalized.
    /// PQ2 — Verifies the vote signature (dual Dilithium3 + Ed25519 if hybrid
    /// signature present) against the voter's public key.
    pub fn add_vote(&mut self, vote: BftVote) -> Result<bool, CoreError> {
        // Verify the voter is an active validator
        let voter_exists = self
            .validators
            .iter()
            .any(|v| v.pubkey.0 == vote.voter.0 && v.status == ValidatorStatus::Active);
        if !voter_exists {
            return Err(CoreError::Consensus("vote from non-active validator".into()));
        }

        // Verify the vote signature (PQ2: dual verification if hybrid present)
        vote.verify_vote_signature()
            .map_err(|_| CoreError::Consensus("invalid vote signature".into()))?;

        // Reject duplicate votes (same voter, same phase, same block)
        let is_dup = self.pending_votes.iter().any(|v| {
            v.voter.0 == vote.voter.0
                && v.phase == vote.phase
                && v.block_hash == vote.block_hash
        });
        if is_dup {
            return Ok(false);
        }

        self.pending_votes.push(vote.clone());

        // Check for supermajority on this block
        let vote_count = self.count_votes_for(&vote.block_hash, vote.phase);
        if self.has_supermajority(vote_count) {
            return Ok(true); // Block can be finalized
        }
        Ok(false)
    }

    /// Slash a validator for equivocation (double-signing).
    /// Proportional slashing: confiscates a fraction of the stake, not the entire amount.
    /// - Double-sign (equivocation): 5% of stake
    /// - Downtime (< 90% uptime): 0.1% of stake
    /// - Invalid block: 1% of stake
    /// - Coordinated attack: 10% + expulsion (status -> Slashed)
    ///
    /// SLASHING DESTINATION (Gap 3 fix): the confiscated RSTN is credited to
    /// the protocol treasury (`self.treasury`), NOT destroyed or vanished.
    /// Previously the slashed amount was subtracted from the validator's stake
    /// but went nowhere — an accounting black hole. Now it is traceable and
    /// community-governed: the treasury is spendable only via a
    /// CRITICAL_TIMELOCK governance proposal, so slashed funds recycle to the
    /// community rather than silently disappearing from the supply.
    ///
    /// The protocol guarantees slashing is proportional, never destructive.
    pub fn slash_validator(&mut self, pubkey: &Dilithium3PublicKey, percentage: u8) -> Result<(), CoreError> {
        let validator = self
            .validators
            .iter_mut()
            .find(|v| v.pubkey.0 == pubkey.0)
            .ok_or_else(|| CoreError::Consensus("validator not found for slashing".into()))?;

        if validator.status == ValidatorStatus::Slashed {
            return Err(CoreError::Consensus("validator already slashed".into()));
        }

        let slash_amount = validator.stake * percentage as u128 / 100;
        validator.stake = validator.stake.saturating_sub(slash_amount);

        // Credit the slashed RSTN to the protocol treasury (Gap 3 fix).
        // The treasury is community-governed — spendable only via a
        // CRITICAL_TIMELOCK governance proposal. Slashed funds are recycled
        // to the community, not silently destroyed.
        self.treasury = self.treasury.saturating_add(slash_amount);

        tracing::warn!(
            "SLASHING validator {} -- {}% of stake confiscated ({} RSTN slashed → treasury, {} remaining)",
            format_address(&derive_address(&validator.pubkey)),
            percentage,
            slash_amount,
            validator.stake
        );

        // Only set to Slashed for severe offenses (>= 10%)
        if percentage >= 10 {
            validator.status = ValidatorStatus::Slashed;
        }
        Ok(())
    }

    /// Distribute block rewards to the leader, applying the validator's
    /// commission (Gap 4 fix).
    ///
    /// The leader receives the block's total tip (priority fees) + the block
    /// reward (reserve distribution). If the validator has delegators, the
    /// validator retains `commission%` of the rewards and the rest is owed to
    /// delegators pro-rata. This makes staking-as-a-service economically
    /// viable: a validator with 10% commission keeps 10% of the rewards and
    /// distributes 90% to delegators.
    ///
    /// `total_reward` = validator tip + block reward (in smallest denomination).
    /// Returns the validator's commission share (the rest is owed to delegators
    /// and tracked in `pending_rewards` for later claim).
    pub fn distribute_rewards(
        &mut self,
        leader_pubkey: &Dilithium3PublicKey,
        total_reward: u128,
    ) -> u128 {
        if total_reward == 0 {
            return 0;
        }
        let validator = match self
            .validators
            .iter()
            .find(|v| v.pubkey.0 == leader_pubkey.0)
        {
            Some(v) => v,
            None => return 0,
        };

        // The validator's commission share (e.g. 10% of the reward).
        let commission_bps = (validator.commission as u128) * 100; // commission is 0-100 (%), → bps
        let commission_share = total_reward * commission_bps / 10_000;

        // The delegators' share (the rest) is owed to delegators pro-rata.
        // Track it in pending_rewards keyed by the validator's address so
        // delegators can claim it later via a Claim tx.
        let delegator_share = total_reward.saturating_sub(commission_share);
        if delegator_share > 0 {
            let vaddr = derive_address(&validator.pubkey);
            if let Some(entry) = self
                .pending_rewards
                .iter_mut()
                .find(|(a, _)| a == &vaddr.0)
            {
                entry.1 = entry.1.saturating_add(delegator_share);
            } else {
                self.pending_rewards.push((vaddr.0, delegator_share));
            }
        }

        tracing::info!(
            "Reward distributed to leader {}: total={}, commission={} ({}%), delegators_owed={}",
            format_address(&derive_address(&validator.pubkey)),
            total_reward,
            commission_share,
            validator.commission,
            delegator_share
        );

        commission_share
    }

    /// Spend treasury funds to a recipient. This is the ONLY way to move
    /// slashed RSTN out of the protocol treasury. It requires a CRITICAL
    /// governance proposal (48h timelock) to have passed and reached its
    /// timelock — no single party can move treasury funds unilaterally.
    ///
    /// TREASURY SPENDING PATH (Gap 3 fix): previously `slash_validator`
    /// credited `self.treasury` but there was no way to spend it — the
    /// treasury was an accumulator with no exit. An auditor would flag this
    /// as "funds locked forever." Now the community can, via a critical
    /// governance proposal (48h timelock, supermajority quorum, minority
    /// veto), direct treasury funds to a recipient (e.g. bug bounty,
    /// ecosystem grant, burn). The proposal must have `executed == true`
    /// (timelock elapsed) before this function releases funds.
    ///
    /// Returns the amount actually transferred (may be < requested if the
    /// treasury balance is insufficient).
    pub fn spend_treasury(
        &mut self,
        amount: u128,
        proposal_executed: bool,
    ) -> Result<u128, CoreError> {
        if !proposal_executed {
            return Err(CoreError::InvalidBlock(
                "treasury spend requires an executed critical governance proposal (48h timelock not elapsed)"
                    .to_string(),
            ));
        }
        let transfer = amount.min(self.treasury);
        self.treasury = self.treasury.saturating_sub(transfer);
        tracing::info!(
            "TREASURY spend: {} RSTN released (remaining treasury: {})",
            transfer,
            self.treasury
        );
        Ok(transfer)
    }

    /// Finalize a block: append to chain, advance height, clear pending votes.
    /// Verifies the block signature, header, and tx_root before finalizing.
    /// This is the last line of defense -- even if a malicious proposal slipped
    /// through the vote collection, it cannot be finalized without a valid signature.
    pub fn finalize_block(&mut self, block: Block) -> Result<(), CoreError> {
        // Genesis block (height 0) is unsigned -- it's a trusted system block.
        // All other blocks must have a valid Dilithium3 signature.
        if block.header.height > 0 {
            block.verify_block_signature()?;
        }

        // Validate against parent if chain is non-empty
        if let Some(parent) = self.chain.last() {
            block.validate_header(parent)?;
        }

        // Validate tx_root
        block.validate_tx_root()?;

        let height = block.header.height;
        self.chain.push(block);
        self.last_finalized_height = height;

        // Clear votes for this height
        self.pending_votes
            .retain(|v| v.height != height);

        // Keep current_round synced to the finalized height so vote.round values
        // stay consistent across nodes. NOTE: leader election now derives from
        // last_finalized_height + view_offset (see select_leader), so this field
        // no longer drives consensus -- it's kept for backwards-compatible vote
        // metadata and RPC reporting only.
        self.current_round = height;
        // Reset the view-change offset -- a new height starts fresh at view 0.
        self.view_offset = 0;
        if height > 0 && height % EPOCH_LENGTH == 0 {
            self.current_epoch += 1;
        }

        Ok(())
    }

    /// Handle a chain reorganization (reorg).
    ///
    /// A reorg occurs when a competing fork has more accumulated weight
    /// than the current chain. In BFT consensus with deterministic finality,
    /// reorgs should NEVER happen below the last finalized height.
    /// If they do, it indicates a Byzantine fault and the node should halt.
    pub fn handle_reorg(&mut self, competing_chain: &[Block]) -> Result<Vec<Block>, CoreError> {
        let common_ancestor = self.find_common_ancestor(competing_chain);

        if common_ancestor < self.last_finalized_height {
            tracing::error!(
                "REORG REJECTED: attempting to reorg finalized block {} (last finalized: {})",
                common_ancestor, self.last_finalized_height
            );
            return Err(CoreError::ChainFork(format!(
                "reorg below finalized height {} is not allowed -- possible Byzantine fault",
                self.last_finalized_height
            )));
        }

        tracing::warn!(
            "Reorg detected: common ancestor at {}, replacing blocks after that point",
            common_ancestor
        );

        let removed: Vec<Block> = self.chain.split_off((common_ancestor + 1) as usize);
        for block in competing_chain {
            if block.header.height > common_ancestor {
                self.chain.push(block.clone());
            }
        }
        Ok(removed)
    }

    fn find_common_ancestor(&self, competing: &[Block]) -> u64 {
        for block in competing.iter().rev() {
            if let Some(our_block) = self.chain.get(block.header.height as usize) {
                if our_block.hash() == block.hash() {
                    return block.header.height;
                }
            }
        }
        0
    }

    /// Sync from a peer's chain -- used when a new node joins or a node
    /// has been offline and needs to catch up.
    pub fn sync_blocks(&mut self, peer_blocks: Vec<Block>) -> Result<usize, CoreError> {
        let mut synced = 0;
        for block in peer_blocks {
            if block.header.height <= self.chain_height() {
                continue;
            }
            if block.header.height > 0 {
                block.verify_block_signature()?;
            }
            if let Some(parent) = self.chain.last() {
                block.validate_header(parent)?;
            }
            block.validate_tx_root()?;
            // MTP timestamp validation (#8): reject blocks with timestamps
            // more than 2h from the median of the last 11 finalized blocks.
            if block.header.height > 0 && !self.chain.is_empty() {
                self.validate_timestamp_mtp(&block)?;
            }
            let height = block.header.height;
            self.chain.push(block);
            self.last_finalized_height = height;
            synced += 1;
        }
        if synced > 0 {
            tracing::info!("Synced {} blocks from peers", synced);
        }
        Ok(synced)
    }

    /// Generate a light client proof for a given block height.
    /// Allows light clients (mobile wallets) to verify state without
    /// downloading the full chain.
    pub fn generate_light_client_proof(&self, height: u64) -> Option<LightClientProof> {
        let block = self.chain.get(height as usize)?;
        let finality_sigs: Vec<&BftVote> = self.pending_votes.iter()
            .filter(|v| v.height == height && v.phase == BftVotePhase::Commit)
            .collect();
        Some(LightClientProof {
            block_header: block.header.clone(),
            finality_signatures: finality_sigs.iter().map(|v| (v.voter.clone(), v.signature.clone())).collect(),
            validator_set: self.validators.clone(),
        })
    }

    /// Get the current chain height (height of the latest finalized block).
    pub fn chain_height(&self) -> u64 {
        self.chain.last().map(|b| b.header.height).unwrap_or(0)
    }

    /// Get a block by height.
    pub fn get_block(&self, height: u64) -> Option<&Block> {
        self.chain.get(height as usize)
    }

    /// Median Time Past (MTP) timestamp validation (#8 — anti-timejacking).
    /// Rejects blocks whose timestamp is more than 2 hours from the median
    /// of the last 11 finalized blocks. This prevents an attacker from
    /// connecting nodes with fake timestamps to drift the network clock
    /// and accept a fraudulent alternative chain.
    pub fn validate_timestamp_mtp(&self, block: &Block) -> Result<(), CoreError> {
        // MTP-11 requires a full window of 11 blocks to be meaningful.
        // In the early chain (< 11 blocks), the median is dominated by the
        // genesis timestamp and would reject legitimate real-time blocks.
        // This mirrors Bitcoin's behavior: MTP only constrains after enough
        // blocks exist for a robust median.
        if self.chain.len() < 11 {
            return Ok(());
        }
        // Collect timestamps of the last 11 finalized blocks (MTP-11).
        let window: Vec<u64> = self
            .chain
            .iter()
            .rev()
            .take(11)
            .map(|b| b.header.timestamp)
            .collect();
        if window.is_empty() {
            return Ok(());
        }
        let median = median_u64(&window);
        const TWO_HOURS_MS: u64 = 2 * 60 * 60 * 1000;
        let block_ts = block.header.timestamp;
        if block_ts > median.saturating_add(TWO_HOURS_MS) {
            return Err(CoreError::InvalidBlock(format!(
                "timestamp {} ms is > 2h ahead of MTP {} -- possible timejacking attack",
                block_ts, median
            )));
        }
        if block_ts < median.saturating_sub(TWO_HOURS_MS) {
            return Err(CoreError::InvalidBlock(format!(
                "timestamp {} ms is > 2h behind MTP {} -- possible timejacking attack",
                block_ts, median
            )));
        }
        Ok(())
    }

    /// Get the latest block.
    pub fn latest_block(&self) -> Option<&Block> {
        self.chain.last()
    }
}

/// Compute the median of a slice of u64 values. Used by MTP timestamp
/// validation to produce a robust central tendency that resists outliers
/// (a single attacker's fake timestamp cannot shift the median much).
fn median_u64(values: &[u64]) -> u64 {
    if values.is_empty() {
        return 0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    sorted[sorted.len() / 2]
}

/// Current wall-clock time in milliseconds since Unix epoch.
fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// --- Genesis -------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GenesisConfig {
    pub chain_id: u64,
    pub genesis_time: u64,
    pub shard_count: u32,
    pub max_supply: u128,
    /// Token allocations encoded as system transactions in the genesis block.
    ///
    /// Satoshi model: only TWO buckets. 95% Proof-of-Participation (staking
    /// pool, earned by work — the team operates the genesis validator and
    /// earns from here, no reserved bucket) and 5% testnet airdrop (bootstrap
    /// seed). Zero team bucket, zero ecosystem fund, zero genesis treasury.
    pub token_allocations: Vec<TokenAllocation>,
    pub initial_validators: Vec<Validator>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TokenAllocation {
    pub label: String,
    pub percentage: f64,
    pub recipient: Option<Dilithium3PublicKey>,
}

impl Default for GenesisConfig {
    fn default() -> Self {
        Self {
            chain_id: 1,
            genesis_time: 0,
            shard_count: 64,
            max_supply: 1_000_000_000 * 10u128.pow(18), // 1B RSTN x 18 decimals = 10^27
            // Satoshi model — 2 buckets only, no team vesting.
            token_allocations: vec![
                TokenAllocation { label: "Proof of Participation (Staking pool)".into(), percentage: 95.0, recipient: None },
                TokenAllocation { label: "Airdrop Testnet (Bootstrap seed)".into(), percentage: 5.0, recipient: None },
            ],
            initial_validators: Vec::new(),
        }
    }
}
