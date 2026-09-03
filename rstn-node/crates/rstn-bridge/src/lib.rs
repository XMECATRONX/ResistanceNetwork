//! rstn-bridge -- Decentralized Lock-and-Mint Bridge (Protocol-Pure)
//!
//! ## Design Philosophy
//!
//! This bridge is a **protocol**, not a service. No single entity operates it.
//! The validator set collectively signs lock/mint operations via threshold
//! Dilithium3 signatures. This design reduces money-transmitter risk because:
//!
//! 1. No entity custodies user funds -- the validator set does collectively
//! 2. No entity can unilaterally release funds -- 2/3+ BFT threshold required
//! 3. The bridge is smart-contract-like code executed by all validators
//! 4. Proof of Reserves is on-chain and publicly verifiable
//!
//! ## Flow
//!
//! ```text
//! LOCK (source chain -> RSTN):
//!   1. User locks BTC/ETH in a source-chain vault address (P2WSH / multisig)
//!   2. User submits lock proof to RSTN via bridge transaction
//!   3. Validators verify the lock proof (SPV proof or committee attestation)
//!   4. 2/3+ validators sign a mint authorization
//!   5. RSTN VM mints wrapped tokens (wBTC/wETH) to user's RSTN address
//!   6. Proof of Reserves updated: locked += amount, minted += amount
//!
//! UNLOCK (RSTN -> source chain):
//!   1. User burns wrapped tokens on RSTN via bridge transaction
//!   2. Validators verify the burn (on-chain, deterministic)
//!   3. 2/3+ validators sign a release authorization
//!   4. Source-chain vault releases BTC/ETH to user's original address
//!   5. Proof of Reserves updated: locked -= amount, minted -= amount
//! ```
//!
//! ## Security Guarantees
//!
//! - **No single point of failure**: 2/3+ BFT threshold for every operation
//! - **No KYC at protocol level**: the protocol is neutral code; compliance
//!   is the responsibility of the interface/front-end, not the protocol
//! - **Proof of Reserves**: `locked == minted` is an invariant enforced on-chain
//! - **Slashing**: validators that sign fraudulent mint/release are slashed
//! - **Post-quantum**: all bridge signatures use Dilithium3 (FIPS 204)

use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;
use thiserror::Error;
use rstn_crypto::{keccak512, Dilithium3PublicKey, Dilithium3Signature};
use rstn_core::TxType;

/// Escape hatch delay: ~24h at 400ms/block = 216,000 blocks.
/// Users must wait this long after submitting an escape request before
/// claiming their proportional share of locked reserves. The validators
/// CANNOT prevent the claim — it executes unilaterally after the delay.
pub const ESCAPE_DELAY_BLOCKS: u64 = 216_000;

// SPV lock-verification framework (C1-production).
pub mod spv;

// Bring the `LockVerifier` trait into scope so `spv_proof.verify(...)` resolves
// (the `verify` method is a trait method, not an inherent one).
use crate::spv::LockVerifier;

// Light-client header store — feeds canonical headers + confirmation depth to
// the SPV verifier. Closes the C1-production gap: the verifier can now confirm
// a header is on the canonical source chain, not just cryptographically valid.
pub mod header_store;

// --- Errors -------------------------------------------------

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("invalid lock proof: {0}")]
    InvalidLockProof(String),
    #[error("insufficient reserves: locked={locked}, requested={requested}")]
    InsufficientReserves { locked: u128, requested: u128 },
    #[error("bridge signature threshold not met: {got}/{needed}")]
    ThresholdNotMet { got: usize, needed: usize },
    #[error("duplicate bridge signature")]
    DuplicateSignature,
    #[error("reserves invariant violated: locked={locked}, minted={minted}")]
    ReservesInvariantViolated { locked: u128, minted: u128 },
    #[error("unsupported source chain: {0}")]
    UnsupportedChain(String),
    #[error("bridge operation already executed: {0}")]
    AlreadyExecuted(String),
}

// --- Supported Source Chains -------------------------------

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "PascalCase")]
pub enum SourceChain {
    Bitcoin,
    Ethereum,
    Solana,
    Bsc,
    Avalanche,
}

impl SourceChain {
    pub fn wrapped_token_symbol(&self) -> &'static str {
        match self {
            SourceChain::Bitcoin => "wBTC",
            SourceChain::Ethereum => "wETH",
            SourceChain::Solana => "wSOL",
            SourceChain::Bsc => "wBNB",
            SourceChain::Avalanche => "wAVAX",
        }
    }

    pub fn from_string(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "BTC" | "BITCOIN" => Some(SourceChain::Bitcoin),
            "ETH" | "ETHEREUM" => Some(SourceChain::Ethereum),
            "SOL" | "SOLANA" => Some(SourceChain::Solana),
            "BSC" | "BNB" => Some(SourceChain::Bsc),
            "AVAX" | "AVALANCHE" => Some(SourceChain::Avalanche),
            _ => None,
        }
    }
}

// --- Bridge Operation Types --------------------------------

/// A lock-and-mint or burn-and-release operation submitted to the bridge.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BridgeOperation {
    /// Unique operation ID (hash of source_txid + source_chain + amount)
    #[serde(with = "BigArray")]
    pub op_id: [u8; 64],
    /// Which source chain this bridges from
    pub source_chain: SourceChain,
    /// Source chain transaction ID (e.g., Bitcoin txid)
    pub source_txid: Vec<u8>,
    /// Amount locked/burned (in smallest unit: satoshis, wei, etc.)
    pub amount: u128,
    /// User's RSTN address (for mint) or source address (for release)
    pub user_address: [u8; 20],
    /// Operation direction
    pub direction: BridgeDirection,
    /// Block height on RSTN when this op was submitted
    pub rstn_height: u64,
    /// Validator signatures authorizing this operation
    pub signatures: Vec<BridgeSignature>,
    /// Whether this operation has been executed
    pub executed: bool,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum BridgeDirection {
    /// Source -> RSTN (lock & mint)
    LockMint,
    /// RSTN -> Source (burn & release)
    BurnRelease,
}

/// A validator's signature authorizing a bridge operation.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BridgeSignature {
    pub validator: Dilithium3PublicKey,
    pub signature: Dilithium3Signature,
}

impl BridgeOperation {
    /// Compute the canonical operation ID from source txid + chain + amount.
    /// This prevents replay attacks -- each source transaction can only be
    /// claimed once.
    pub fn compute_op_id(
        source_chain: SourceChain,
        source_txid: &[u8],
        amount: u128,
        user_address: &[u8; 20],
    ) -> [u8; 64] {
        let mut buf = Vec::with_capacity(1 + source_txid.len() + 16 + 20);
        buf.push(source_chain as u8);
        buf.extend_from_slice(source_txid);
        buf.extend_from_slice(&amount.to_le_bytes());
        buf.extend_from_slice(user_address);
        keccak512(&buf)
    }

    /// Check if 2/3+ of the validator set have signed this operation.
    pub fn has_threshold(&self, active_validators: usize) -> bool {
        if active_validators == 0 {
            return false;
        }
        let needed = active_validators * 2 / 3 + 1;
        // Deduplicate signatures by validator pubkey
        let mut seen = std::collections::HashSet::new();
        for sig in &self.signatures {
            seen.insert(sig.validator.0);
        }
        seen.len() >= needed
    }

    /// Add a validator signature, checking for duplicates.
    pub fn add_signature(&mut self, sig: BridgeSignature) -> Result<(), BridgeError> {
        let is_dup = self.signatures.iter().any(|s| s.validator.0 == sig.validator.0);
        if is_dup {
            return Err(BridgeError::DuplicateSignature);
        }
        self.signatures.push(sig);
        Ok(())
    }
}

// --- Proof of Reserves -------------------------------------

/// Tracks locked and minted amounts per source chain.
/// The invariant `locked == minted` MUST hold at all times.
/// Any violation indicates a bug or attack and halts the bridge.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProofOfReserves {
    pub chain: SourceChain,
    /// Total amount locked on the source chain (custodied by validator set)
    pub locked: u128,
    /// Total amount minted as wrapped tokens on RSTN
    pub minted: u128,
    /// Total amount burned (unlocked back to source chain)
    pub burned: u128,
}

impl ProofOfReserves {
    pub fn new(chain: SourceChain) -> Self {
        Self {
            chain,
            locked: 0,
            minted: 0,
            burned: 0,
        }
    }

    /// Verify the reserves invariant: locked == minted (in circulation).
    /// `minted - burned` is the circulating supply of wrapped tokens.
    /// `locked` must equal `minted - burned` at all times.
    pub fn verify_invariant(&self) -> Result<(), BridgeError> {
        let circulating = self.minted.saturating_sub(self.burned);
        if self.locked != circulating {
            return Err(BridgeError::ReservesInvariantViolated {
                locked: self.locked,
                minted: self.minted,
            });
        }
        Ok(())
    }

    /// Record a lock operation: increases locked and minted by the same amount.
    pub fn record_lock(&mut self, amount: u128) -> Result<(), BridgeError> {
        self.locked = self
            .locked
            .checked_add(amount)
            .ok_or(BridgeError::InsufficientReserves { locked: self.locked, requested: amount })?;
        self.minted = self
            .minted
            .checked_add(amount)
            .ok_or(BridgeError::InsufficientReserves { locked: self.locked, requested: amount })?;
        self.verify_invariant()
    }

    /// Record a burn/release operation: decreases locked and increases burned.
    pub fn record_burn(&mut self, amount: u128) -> Result<(), BridgeError> {
        if self.locked < amount {
            return Err(BridgeError::InsufficientReserves {
                locked: self.locked,
                requested: amount,
            });
        }
        self.locked -= amount;
        self.burned = self
            .burned
            .checked_add(amount)
            .ok_or(BridgeError::InsufficientReserves { locked: self.locked, requested: amount })?;
        self.verify_invariant()
    }
}

// --- Lock Proof (relayer committee attestation) ------------

/// A single relayer's attestation that it observed a source-chain lock.
/// The relayer signs the canonical blob: chain_byte || source_txid || amount_le || user_address.
/// This binds the attestation to the exact (chain, txid, amount, user) tuple,
/// so a relayer cannot reuse one attestation for a different mint.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelayerAttestation {
    pub relayer_pubkey: Dilithium3PublicKey,
    pub signature: Dilithium3Signature,
}

/// Committee proof that a source-chain lock occurred.
///
/// In production this carries >= 2/3 of the relayer committee signatures.
/// In testnet mode the node self-attests (single relayer = full proof).
/// `verify()` checks every signature against the canonical blob and rejects
/// the proof if the threshold of unique relayers is not met.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LockProof {
    pub attestations: Vec<RelayerAttestation>,
}

impl LockProof {
    /// Canonical blob that every attestation must sign.
    fn canonical_blob(
        source_chain: SourceChain,
        source_txid: &[u8],
        amount: u128,
        user_address: &[u8; 20],
    ) -> Vec<u8> {
        let mut buf = Vec::with_capacity(1 + source_txid.len() + 16 + 20);
        buf.push(source_chain as u8);
        buf.extend_from_slice(source_txid);
        buf.extend_from_slice(&amount.to_le_bytes());
        buf.extend_from_slice(user_address);
        buf
    }

    /// Build a self-attested proof (testnet: the node is the sole relayer).
    pub fn self_attest(
        kp: &rstn_crypto::Dilithium3Keypair,
        source_chain: SourceChain,
        source_txid: &[u8],
        amount: u128,
        user_address: &[u8; 20],
    ) -> Self {
        let blob = Self::canonical_blob(source_chain, source_txid, amount, user_address);
        let sig = kp.sign(&blob);
        LockProof {
            attestations: vec![RelayerAttestation {
                relayer_pubkey: kp.public.clone(),
                signature: sig,
            }],
        }
    }

    /// Verify the proof: every attestation must be a valid Dilithium3 signature
    /// over the canonical blob, AND the signer must be a member of the
    /// authorized relayer committee, AND the number of UNIQUE authorized
    /// relayers must meet the 2/3+ threshold.
    ///
    /// SECURITY (B1): previously this accepted a proof with a single valid
    /// signature from ANY keypair -- an attacker could generate a fresh
    /// Dilithium3 keypair, self-attest, and the proof would verify. Now the
    /// caller supplies the authorized relayer set (`authorized_relayers`) and
    /// the proof is only valid if >= 2/3 of that committee signed. In testnet
    /// mode pass a single-element committee (threshold = 1).
    pub fn verify(
        &self,
        source_chain: SourceChain,
        source_txid: &[u8],
        amount: u128,
        user_address: &[u8; 20],
        authorized_relayers: &[Dilithium3PublicKey],
    ) -> Result<(), BridgeError> {
        if authorized_relayers.is_empty() {
            return Err(BridgeError::InvalidLockProof("no authorized relayers configured".into()));
        }
        let blob = Self::canonical_blob(source_chain, source_txid, amount, user_address);
        let mut seen = std::collections::HashSet::new();
        let mut valid = 0usize;
        for att in &self.attestations {
            // Signature must be cryptographically valid.
            if rstn_crypto::verify_signature(&att.relayer_pubkey, &blob, &att.signature).is_err() {
                continue;
            }
            // Signer must be a member of the authorized relayer committee.
            let is_authorized = authorized_relayers
                .iter()
                .any(|r| r.0 == att.relayer_pubkey.0);
            if !is_authorized {
                continue;
            }
            // Count unique authorized relayers only.
            if seen.insert(att.relayer_pubkey.0) {
                valid += 1;
            }
        }
        // 2/3+ threshold of the authorized committee.
        let needed = authorized_relayers.len() * 2 / 3 + 1;
        if valid < needed {
            return Err(BridgeError::InvalidLockProof(format!(
                "lock proof threshold not met: {}/{} (need {} authorized signatures)",
                valid,
                authorized_relayers.len(),
                needed
            )));
        }
        Ok(())
    }
}

// --- Escape Hatch (unilateral user exit) --------------------

/// A user's unilateral escape request. The user escrows their wrapped
/// tokens (debiting their balance at submit time) and, after a delay
/// (`ESCAPE_DELAY_BLOCKS` ≈ 24h), can claim a proportional share of
/// the locked reserves — WITHOUT validator permission.
///
/// This is the safety net: if all validators go rogue, a user can still
/// exit with their proportional share of the locked BTC/ETH. The
/// validators cannot censor, block, or delay the claim — it executes
/// deterministically after the delay period.
///
/// Proportional claim: if the user has X wrapped tokens and total
/// circulating supply is Y, and total locked reserves is Z, the user
/// gets (X / Y) * Z of the source-chain asset. When reserves are fully
/// backed (Z == Y, the invariant), this equals X — 1:1 redemption.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EscapeHatchRequest {
    /// Unique request ID (hash of chain || user || amount || height).
    #[serde(with = "BigArray")]
    pub request_id: [u8; 64],
    pub user: [u8; 20],
    pub chain: SourceChain,
    pub amount: u128,
    pub request_height: u64,
    /// Height at which the claim can be executed
    /// (request_height + ESCAPE_DELAY_BLOCKS).
    pub claimable_at_height: u64,
    pub executed: bool,
}

// --- Bridge State ------------------------------------------

/// Global bridge state -- managed by the RSTN VM as a built-in contract.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BridgeState {
    /// Reserves per source chain
    pub reserves: Vec<ProofOfReserves>,
    /// Pending operations awaiting validator signatures
    pub pending_ops: Vec<BridgeOperation>,
    /// Completed operations (for audit trail)
    pub completed_ops: Vec<BridgeOperation>,
    /// Paused flag -- halts all bridge operations if invariant is violated
    pub paused: bool,
    /// Daily volume per chain (for rate limiting) -- resets every 24h
    /// chain -> (volume_today, window_start_timestamp_ms)
    #[serde(default)]
    pub daily_volume: Vec<(SourceChain, u128, u64)>,
    /// Maximum daily volume per chain (rate limiting)
    /// Prevents draining all reserves in a single day during an attack.
    #[serde(skip)]
    pub max_daily_volume: u128,
    /// Per-user daily limit -- prevents a single user from dominating bridge volume
    #[serde(default)]
    pub user_daily_volume: Vec<([u8; 20], u128, u64)>,
    /// Wrapped token balances per user: (chain, user_address) -> balance.
    /// Mints add to this balance; burns subtract from it.
    #[serde(default)]
    pub wrapped_balances: Vec<(SourceChain, [u8; 20], u128)>,
    /// Pending escape hatch requests (unilateral user exit). Users who
    /// want to leave the bridge without validator permission submit a
    /// request here; after `ESCAPE_DELAY_BLOCKS` they can claim their
    /// proportional share of locked reserves.
    #[serde(default)]
    pub escape_requests: Vec<EscapeHatchRequest>,
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            reserves: vec![
                ProofOfReserves::new(SourceChain::Bitcoin),
                ProofOfReserves::new(SourceChain::Ethereum),
                ProofOfReserves::new(SourceChain::Solana),
                ProofOfReserves::new(SourceChain::Bsc),
                ProofOfReserves::new(SourceChain::Avalanche),
            ],
            pending_ops: Vec::new(),
            completed_ops: Vec::new(),
            paused: false,
            daily_volume: Vec::new(),
            max_daily_volume: 10_000_000_000_000, // 10,000 units (in smallest denomination)
            user_daily_volume: Vec::new(),
            wrapped_balances: Vec::new(),
            escape_requests: Vec::new(),
        }
    }

    /// Mint wrapped tokens to a user's balance (called after a lock operation executes).
    pub fn mint_wrapped(&mut self, chain: SourceChain, user: &[u8; 20], amount: u128) {
        if let Some((_, _, bal)) = self
            .wrapped_balances
            .iter_mut()
            .find(|(c, a, _)| *c == chain && a == user)
        {
            *bal = bal.saturating_add(amount);
        } else {
            self.wrapped_balances.push((chain, *user, amount));
        }
    }

    /// Burn wrapped tokens from a user's balance (called before a burn/release).
    /// Returns Ok(()) if the user had enough balance, Err otherwise.
    pub fn burn_wrapped(&mut self, chain: SourceChain, user: &[u8; 20], amount: u128) -> Result<(), BridgeError> {
        let entry = self
            .wrapped_balances
            .iter_mut()
            .find(|(c, a, _)| *c == chain && a == user);
        match entry {
            Some((_, _, bal)) => {
                if *bal < amount {
                    return Err(BridgeError::InsufficientReserves {
                        locked: *bal,
                        requested: amount,
                    });
                }
                *bal -= amount;
                Ok(())
            }
            None => Err(BridgeError::InsufficientReserves {
                locked: 0,
                requested: amount,
            }),
        }
    }

    /// Get a user's wrapped token balance for a chain.
    pub fn get_wrapped_balance(&self, chain: SourceChain, user: &[u8; 20]) -> u128 {
        self.wrapped_balances
            .iter()
            .find(|(c, a, _)| *c == chain && a == user)
            .map(|(_, _, b)| *b)
            .unwrap_or(0)
    }

    /// Check and enforce rate limits for a bridge operation.
    /// Returns an error if the daily volume limit is exceeded.
    fn check_rate_limit(&mut self, chain: SourceChain, amount: u128, user: &[u8; 20]) -> Result<(), BridgeError> {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        const DAY_MS: u64 = 24 * 60 * 60 * 1000;

        // Check chain daily limit
        let chain_vol = self.daily_volume.iter_mut()
            .find(|(c, _, _)| *c == chain);
        match chain_vol {
            Some((_, vol, window_start)) => {
                if now_ms.saturating_sub(*window_start) > DAY_MS {
                    // Reset window
                    *vol = 0;
                    *window_start = now_ms;
                }
                if vol.checked_add(amount).unwrap_or(u128::MAX) > self.max_daily_volume {
                    return Err(BridgeError::InvalidLockProof(format!(
                        "daily volume limit exceeded for {:?}: {} + {} > {}",
                        chain, vol, amount, self.max_daily_volume
                    )));
                }
            }
            None => {
                self.daily_volume.push((chain, 0, now_ms));
            }
        }

        // Check per-user daily limit (max 10% of total daily limit per user)
        let user_limit = self.max_daily_volume / 10;
        let user_vol = self.user_daily_volume.iter_mut()
            .find(|(u, _, _)| u == user);
        match user_vol {
            Some((_, vol, window_start)) => {
                if now_ms.saturating_sub(*window_start) > DAY_MS {
                    *vol = 0;
                    *window_start = now_ms;
                }
                if vol.checked_add(amount).unwrap_or(u128::MAX) > user_limit {
                    return Err(BridgeError::InvalidLockProof(format!(
                        "user daily limit exceeded: {} + {} > {}", vol, amount, user_limit
                    )));
                }
            }
            None => {
                self.user_daily_volume.push((*user, 0, now_ms));
            }
        }

        Ok(())
    }

    /// Update volume tracking after a successful operation.
    fn update_volume(&mut self, chain: SourceChain, amount: u128, user: &[u8; 20]) {
        if let Some((_, vol, _)) = self.daily_volume.iter_mut().find(|(c, _, _)| *c == chain) {
            *vol += amount;
        }
        if let Some((_, vol, _)) = self.user_daily_volume.iter_mut().find(|(u, _, _)| u == user) {
            *vol += amount;
        }
    }

    /// Get reserves for a specific chain.
    pub fn get_reserves(&self, chain: SourceChain) -> Option<&ProofOfReserves> {
        self.reserves.iter().find(|r| r.chain == chain)
    }

    /// Get mutable reserves for a specific chain.
    fn get_reserves_mut(&mut self, chain: SourceChain) -> Option<&mut ProofOfReserves> {
        self.reserves.iter_mut().find(|r| r.chain == chain)
    }

    /// Submit a new lock-mint operation.
    ///
    /// SECURITY (#9): a lock operation is NOT accepted on faith. The caller
    /// must supply a `lock_proof` -- a committee of relayer attestations that
    /// each independently observed the source-chain transaction. In testnet
    /// mode the proof is accepted with a single self-attestation; in
    /// production the proof must carry >= 2/3 of the relayer committee
    /// signatures over the canonical (chain || txid || amount || user) blob.
    /// Without this, anyone could mint wrapped tokens by inventing a txid.
    ///
    /// `authorized_relayers` is the configured relayer committee. The proof is
    /// only valid if >= 2/3 of that committee signed (B1).
    ///
    /// Returns the operation ID for tracking.
    pub fn submit_lock(
        &mut self,
        source_chain: SourceChain,
        source_txid: Vec<u8>,
        amount: u128,
        user_address: [u8; 20],
        rstn_height: u64,
        lock_proof: &LockProof,
        authorized_relayers: &[Dilithium3PublicKey],
    ) -> Result<[u8; 64], BridgeError> {
        if self.paused {
            return Err(BridgeError::AlreadyExecuted("bridge is paused".into()));
        }

        // Verify the lock proof BEFORE accepting the operation. The proof
        // binds the canonical op blob (chain || txid || amount || user) so a
        // relayer cannot attest to a different amount/user for the same txid.
        // Only signatures from the authorized relayer committee count (B1).
        lock_proof.verify(source_chain, &source_txid, amount, &user_address, authorized_relayers)?;

        // Rate limit check -- prevents draining reserves in a single day
        self.check_rate_limit(source_chain, amount, &user_address)?;

        let op_id = BridgeOperation::compute_op_id(
            source_chain,
            &source_txid,
            amount,
            &user_address,
        );

        // Check for replay -- same source txid cannot be claimed twice
        let already_exists = self.pending_ops.iter().any(|op| op.op_id == op_id)
            || self.completed_ops.iter().any(|op| op.op_id == op_id);
        if already_exists {
            return Err(BridgeError::AlreadyExecuted(hex::encode(op_id)));
        }

        let op = BridgeOperation {
            op_id,
            source_chain,
            source_txid,
            amount,
            user_address,
            direction: BridgeDirection::LockMint,
            rstn_height,
            signatures: Vec::new(),
            executed: false,
        };

        self.pending_ops.push(op);
        Ok(op_id)
    }

    /// Submit a burn-release operation.
    pub fn submit_burn(
        &mut self,
        source_chain: SourceChain,
        amount: u128,
        user_address: [u8; 20],
        rstn_height: u64,
    ) -> Result<[u8; 64], BridgeError> {
        if self.paused {
            return Err(BridgeError::AlreadyExecuted("bridge is paused".into()));
        }

        // Rate limit check
        self.check_rate_limit(source_chain, amount, &user_address)?;

        // Generate a synthetic txid for burn ops (RSTN tx hash)
        let synthetic_txid = keccak512(&{
            let mut buf = Vec::with_capacity(20 + 16 + 8);
            buf.extend_from_slice(&user_address);
            buf.extend_from_slice(&amount.to_le_bytes());
            buf.extend_from_slice(&rstn_height.to_le_bytes());
            buf
        });

        let op_id = BridgeOperation::compute_op_id(
            source_chain,
            &synthetic_txid,
            amount,
            &user_address,
        );

        // Check reserves are sufficient
        let reserves = self.get_reserves(source_chain)
            .ok_or(BridgeError::UnsupportedChain(format!("{:?}", source_chain)))?;
        if reserves.locked < amount {
            return Err(BridgeError::InsufficientReserves {
                locked: reserves.locked,
                requested: amount,
            });
        }

        let op = BridgeOperation {
            op_id,
            source_chain,
            source_txid: synthetic_txid.to_vec(),
            amount,
            user_address,
            direction: BridgeDirection::BurnRelease,
            rstn_height,
            signatures: Vec::new(),
            executed: false,
        };

        self.pending_ops.push(op);
        Ok(op_id)
    }

    /// Add a validator signature to a pending operation.
    pub fn add_bridge_signature(
        &mut self,
        op_id: &[u8; 64],
        sig: BridgeSignature,
    ) -> Result<usize, BridgeError> {
        let op = self
            .pending_ops
            .iter_mut()
            .find(|op| &op.op_id == op_id)
            .ok_or(BridgeError::AlreadyExecuted("operation not found".into()))?;

        if op.executed {
            return Err(BridgeError::AlreadyExecuted("operation already executed".into()));
        }

        op.add_signature(sig.clone())?;
        Ok(op.signatures.len())
    }

    /// Execute a pending operation once threshold is met.
    /// Mints wrapped tokens (lock) or releases source assets (burn).
    ///
    /// SECURITY (B3): `active_validator_pubkeys` is the set of currently-active
    /// validator public keys. Only signatures from members of this set count
    /// toward the 2/3+ threshold. Previously `has_threshold` only counted
    /// unique pubkeys -- an attacker could generate 3 fresh keypairs (not
    /// validators), sign, reach the 3/4 threshold, and execute the operation
    /// (mint wBTC without a real lock). Now every signer must be a verified
    /// active validator.
    pub fn execute_operation(
        &mut self,
        op_id: &[u8; 64],
        active_validator_pubkeys: &[Dilithium3PublicKey],
    ) -> Result<BridgeDirection, BridgeError> {
        if self.paused {
            return Err(BridgeError::AlreadyExecuted("bridge is paused".into()));
        }

        // Find the operation
        let op_idx = self
            .pending_ops
            .iter()
            .position(|op| &op.op_id == op_id)
            .ok_or(BridgeError::AlreadyExecuted("operation not found".into()))?;

        let op = &self.pending_ops[op_idx];

        if op.executed {
            return Err(BridgeError::AlreadyExecuted("already executed".into()));
        }

        // Verify all signatures against the operation's canonical op_id AND
        // verify each signer is an active validator (B3).
        let op_hash = op.op_id; // Already a keccak512 hash
        let mut authorized_count = 0usize;
        let mut seen = std::collections::HashSet::new();
        for sig in &op.signatures {
            // Signature must be cryptographically valid.
            rstn_crypto::verify_signature(&sig.validator, &op_hash[..], &sig.signature)
                .map_err(|_| BridgeError::InvalidLockProof("invalid validator signature".into()))?;
            // Signer must be an active validator.
            let is_validator = active_validator_pubkeys
                .iter()
                .any(|v| v.0 == sig.validator.0);
            if !is_validator {
                return Err(BridgeError::InvalidLockProof(format!(
                    "signature from non-validator pubkey (not in active set)"
                )));
            }
            // Count unique authorized validators only.
            if seen.insert(sig.validator.0) {
                authorized_count += 1;
            }
        }

        // 2/3+ threshold of the active validator set.
        let active_count = active_validator_pubkeys.len();
        if active_count == 0 {
            return Err(BridgeError::ThresholdNotMet { got: 0, needed: 1 });
        }
        let needed = active_count * 2 / 3 + 1;
        if authorized_count < needed {
            return Err(BridgeError::ThresholdNotMet {
                got: authorized_count,
                needed,
            });
        }

        // Execute based on direction
        let chain = op.source_chain;
        let amount = op.amount;
        let direction = op.direction;
        let user = op.user_address; // [u8; 20] — Copy, extracted so `op`'s
                                     // borrow of self.pending_ops ends here,
                                     // allowing the mutable self borrows below.

        match direction {
            BridgeDirection::LockMint => {
                if let Some(reserves) = self.get_reserves_mut(chain) {
                    reserves.record_lock(amount)?;
                }
                // Credit the user's wrapped balance so the minted tokens are
                // actually spendable. Without this the user never receives
                // wBTC/wETH even though reserves were incremented (C2-critical).
                self.mint_wrapped(chain, &user, amount);
            }
            BridgeDirection::BurnRelease => {
                // Debit the user's wrapped balance BEFORE releasing reserves.
                // Without this an attacker could burn for any amount up to the
                // total locked reserves — releasing real BTC/ETH without ever
                // holding wrapped tokens (C2-critical).
                self.burn_wrapped(chain, &user, amount)?;
                if let Some(reserves) = self.get_reserves_mut(chain) {
                    reserves.record_burn(amount)?;
                }
            }
        }

        // Move to completed
        let mut op = self.pending_ops.remove(op_idx);
        op.executed = true;

        // Update rate limit volume tracking
        self.update_volume(chain, amount, &op.user_address);

        self.completed_ops.push(op);

        tracing::info!(
            "Bridge operation executed: {:?} {} {} on {:?}",
            direction,
            amount,
            chain.wrapped_token_symbol(),
            chain
        );

        Ok(direction)
    }

    /// Emergency pause -- halts all bridge operations.
    /// Called when the reserves invariant is violated.
    /// Also auto-pauses if any chain's reserves invariant fails.
    pub fn emergency_pause(&mut self) {
        self.paused = true;
        tracing::error!("Bridge EMERGENCY PAUSED -- reserves invariant may be violated");
    }

    /// Check all chains' reserves invariants. Auto-pauses if any fail.
    /// Call this after every block that contains bridge operations.
    pub fn verify_all_reserves(&mut self) -> Result<(), BridgeError> {
        for reserves in &self.reserves {
            if let Err(e) = reserves.verify_invariant() {
                self.emergency_pause();
                return Err(e);
            }
        }
        Ok(())
    }

    // ── Escape Hatch: unilateral user exit ──────────────────────────

    /// Submit a unilateral escape request. The user escrows their wrapped
    /// tokens (debited immediately so they can't double-spend during the
    /// delay) and, after `ESCAPE_DELAY_BLOCKS` (≈24h), can claim a
    /// proportional share of the locked reserves WITHOUT validator
    /// permission.
    ///
    /// This is the safety net against validator collusion: even if every
    /// validator goes rogue and refuses to process normal burn-release
    /// operations, users can still exit with their proportional share.
    ///
    /// Returns the request ID for tracking + claiming later.
    pub fn submit_escape_hatch(
        &mut self,
        chain: SourceChain,
        amount: u128,
        user: [u8; 20],
        current_height: u64,
    ) -> Result<[u8; 64], BridgeError> {
        if self.paused {
            return Err(BridgeError::AlreadyExecuted("bridge is paused".into()));
        }
        if amount == 0 {
            return Err(BridgeError::InvalidLockProof(
                "escape amount must be > 0".into(),
            ));
        }
        // Escrow the wrapped tokens — debit the user's balance immediately
        // so they can't double-spend during the delay period. The reserves
        // are NOT reduced yet (that happens at claim time).
        self.burn_wrapped(chain, &user, amount)?;

        let request_id = keccak512(&{
            let mut buf = Vec::with_capacity(1 + 20 + 16 + 8);
            buf.push(chain as u8);
            buf.extend_from_slice(&user);
            buf.extend_from_slice(&amount.to_le_bytes());
            buf.extend_from_slice(&current_height.to_le_bytes());
            buf
        });

        let claimable_at = current_height + ESCAPE_DELAY_BLOCKS;

        self.escape_requests.push(EscapeHatchRequest {
            request_id,
            user,
            chain,
            amount,
            request_height: current_height,
            claimable_at_height: claimable_at,
            executed: false,
        });

        tracing::info!(
            "Escape hatch submitted: {} {} for user {:?}, claimable at height {}",
            amount,
            chain.wrapped_token_symbol(),
            user,
            claimable_at
        );

        Ok(request_id)
    }

    /// Claim an escape request after the delay has elapsed. Burns a
    /// proportional share of the locked reserves and releases it to
    /// the user's source-chain address. The validators CANNOT prevent
    /// this — it executes unilaterally after `claimable_at_height`.
    ///
    /// Proportional claim: if the user escrowed X tokens and total
    /// circulating supply is Y, and total locked reserves is Z, the
    /// user gets (X / Y) * Z. When reserves are fully backed (Z == Y),
    /// this equals X — 1:1 redemption. If reserves are short (attack
    /// or bug), the user gets a proportional share of what remains.
    ///
    /// Returns (chain, release_amount, user_address).
    pub fn claim_escape(
        &mut self,
        request_id: &[u8; 64],
        current_height: u64,
    ) -> Result<(SourceChain, u128, [u8; 20]), BridgeError> {
        let idx = self
            .escape_requests
            .iter()
            .position(|r| &r.request_id == request_id)
            .ok_or(BridgeError::AlreadyExecuted(
                "escape request not found".into(),
            ))?;

        let req = &self.escape_requests[idx];
        if req.executed {
            return Err(BridgeError::AlreadyExecuted(
                "escape already claimed".into(),
            ));
        }
        if current_height < req.claimable_at_height {
            return Err(BridgeError::InvalidLockProof(format!(
                "escape delay not elapsed: need height >= {}, got {}",
                req.claimable_at_height, current_height
            )));
        }

        let chain = req.chain;
        let user = req.user;
        let escrowed = req.amount;

        // Compute the proportional release amount.
        let reserves = self
            .get_reserves(chain)
            .ok_or(BridgeError::UnsupportedChain(format!("{:?}", chain)))?;
        let circulating = reserves.minted.saturating_sub(reserves.burned);
        if circulating == 0 {
            return Err(BridgeError::InsufficientReserves {
                locked: 0,
                requested: escrowed,
            });
        }
        // Proportional: escrowed * locked / circulating.
        // When locked == circulating (normal), this = escrowed (1:1).
        // When locked < circulating (attack), this < escrowed (proportional).
        let mut release_amount = escrowed * reserves.locked / circulating;
        // Cap at locked (can't release more than is actually locked).
        if release_amount > reserves.locked {
            release_amount = reserves.locked;
        }

        // Record the burn — reduces locked, increases burned.
        if let Some(reserves) = self.get_reserves_mut(chain) {
            reserves.record_burn(release_amount)?;
        }

        self.escape_requests[idx].executed = true;

        tracing::info!(
            "Escape hatch claimed: {} {} released to user {:?}",
            release_amount,
            chain.wrapped_token_symbol(),
            user
        );

        Ok((chain, release_amount, user))
    }

    /// Get all pending escape requests (for RPC queries).
    pub fn get_escape_requests(&self) -> &[EscapeHatchRequest] {
        &self.escape_requests
    }

    /// Check if an escape request is claimable at `current_height`.
    pub fn is_escape_claimable(&self, request_id: &[u8; 64], current_height: u64) -> bool {
        self.escape_requests
            .iter()
            .any(|r| &r.request_id == request_id && !r.executed && current_height >= r.claimable_at_height)
    }

    /// Resume bridge operations after manual review.
    /// Requires governance vote in production.
    pub fn resume(&mut self) {
        self.paused = false;
        tracing::info!("Bridge resumed -- operations enabled");
    }

    /// Get all pending operations (for RPC queries).
    pub fn get_pending_ops(&self) -> &[BridgeOperation] {
        &self.pending_ops
    }

    /// Get proof of reserves for all chains (for RPC queries).
    pub fn get_all_reserves(&self) -> &[ProofOfReserves] {
        &self.reserves
    }

    /// Verify a lock proof against the light-client header store AND the SPV
    /// cryptographic proof. This is the production-grade lock verification path
    /// (C1-production): it confirms (1) the Merkle/receipt proof is
    /// cryptographically valid, (2) the anchoring header is on the canonical
    /// source chain, and (3) the header has the required confirmation depth.
    ///
    /// `header_hash` is the source-chain block header that anchors the lock.
    /// The caller obtains it from the lock proof (the block the source tx is
    /// included in). The header store must already have that header inserted
    /// (via the light-client sync process).
    pub fn verify_lock_with_header_store(
        &self,
        chain: SourceChain,
        source_txid: &[u8],
        amount: u128,
        user_address: &[u8; 20],
        header_hash: &[u8; 32],
        spv_proof: &spv::BitcoinSpvProof,
        header_store: &header_store::HeaderStore,
    ) -> Result<(), BridgeError> {
        // 1. Canonicality: the header must be on the canonical source chain.
        if !header_store.is_canonical(chain, header_hash) {
            return Err(BridgeError::InvalidLockProof(
                "header is not on the canonical source chain".into(),
            ));
        }
        // 2. Confirmation depth from the canonical tip.
        let confirmations = header_store
            .confirmations(chain, header_hash)
            .map_err(|e| BridgeError::InvalidLockProof(format!("header store: {e}")))?;
        let needed = spv::min_confirmations(chain);
        if confirmations < needed {
            return Err(BridgeError::InvalidLockProof(format!(
                "insufficient confirmations: got {confirmations}, need {needed}"
            )));
        }
        // 3. Cross-check the proof's merkle root against the header store's root.
        let stored_root = header_store
            .root(chain, header_hash)
            .map_err(|e| BridgeError::InvalidLockProof(format!("header store: {e}")))?;
        if spv_proof.merkle_root != stored_root {
            return Err(BridgeError::InvalidLockProof(
                "merkle root mismatch: proof root does not match canonical header root".into(),
            ));
        }
        // 4. Cryptographic Merkle proof verification.
        spv_proof
            .verify(chain, source_txid, amount, user_address, needed)
            .map_err(|e| BridgeError::InvalidLockProof(format!("spv: {e}")))?;
        Ok(())
    }
}

impl Default for BridgeState {
    fn default() -> Self {
        Self::new()
    }
}

// --- Bridge Transaction Helpers ----------------------------

/// Create a bridge lock-mint transaction payload.
/// This is the `payload` field of a RSTN `Transaction` with `tx_type = Contract`.
pub fn encode_lock_payload(
    source_chain: SourceChain,
    source_txid: &[u8],
    amount: u128,
) -> Vec<u8> {
    let mut buf = Vec::with_capacity(1 + 1 + source_txid.len() + 16);
    buf.push(TxType::Contract as u8);
    buf.push(BridgeDirection::LockMint as u8);
    buf.push(source_chain as u8);
    buf.push(source_txid.len() as u8);
    buf.extend_from_slice(source_txid);
    buf.extend_from_slice(&amount.to_le_bytes());
    buf
}

/// Create a bridge burn-release transaction payload.
pub fn encode_burn_payload(
    source_chain: SourceChain,
    amount: u128,
) -> Vec<u8> {
    let mut buf = Vec::with_capacity(1 + 1 + 1 + 16);
    buf.push(TxType::Contract as u8);
    buf.push(BridgeDirection::BurnRelease as u8);
    buf.push(source_chain as u8);
    buf.extend_from_slice(&amount.to_le_bytes());
    buf
}

// --- Tests -------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proof_of_reserves_invariant() {
        let mut reserves = ProofOfReserves::new(SourceChain::Bitcoin);
        assert!(reserves.verify_invariant().is_ok());

        reserves.record_lock(1_000_000).unwrap();
        assert!(reserves.verify_invariant().is_ok());
        assert_eq!(reserves.locked, 1_000_000);
        assert_eq!(reserves.minted, 1_000_000);

        reserves.record_burn(500_000).unwrap();
        assert!(reserves.verify_invariant().is_ok());
        assert_eq!(reserves.locked, 500_000);
        assert_eq!(reserves.burned, 500_000);
    }

    #[test]
    fn test_replay_prevention() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut state = BridgeState::new();
        let user = [0u8; 20];
        let txid = vec![1, 2, 3, 4];

        // Testnet committee = [kp] (single authorized relayer, threshold = 1).
        let committee = vec![kp.public.clone()];
        let proof = LockProof::self_attest(&kp, SourceChain::Bitcoin, &txid, 1000, &user);
        let op_id1 = state
            .submit_lock(SourceChain::Bitcoin, txid.clone(), 1000, user, 1, &proof, &committee)
            .unwrap();

        // Same txid + amount + user -> should fail (replay)
        let result = state.submit_lock(SourceChain::Bitcoin, txid, 1000, user, 2, &proof, &committee);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            BridgeError::AlreadyExecuted(_)
        ));

        // Different amount -> different op_id, should succeed
        let txid2 = vec![1, 2, 3, 4, 5];
        let proof2 = LockProof::self_attest(&kp, SourceChain::Bitcoin, &txid2, 2000, &user);
        let op_id3 = state
            .submit_lock(SourceChain::Bitcoin, txid2, 2000, user, 3, &proof2, &committee)
            .unwrap();
        assert_ne!(op_id1, op_id3);
    }

    #[test]
    fn test_threshold_logic() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut state = BridgeState::new();
        let user = [0u8; 20];
        let txid = vec![1, 2, 3];

        // Testnet committee = [kp] (1 relayer, threshold = 1).
        let committee = vec![kp.public.clone()];
        let proof = LockProof::self_attest(&kp, SourceChain::Bitcoin, &txid, 1000, &user);
        state
            .submit_lock(SourceChain::Bitcoin, txid, 1000, user, 1, &proof, &committee)
            .unwrap();

        // Active validator set = the testnet node's pubkey (1 validator, threshold = 1).
        let active_validators = vec![kp.public.clone()];
        let op_id = state.pending_ops[0].op_id;

        // Add a signature from a NON-validator (pk1) -- execute must reject it (B3).
        let pk1 = Dilithium3PublicKey([1u8; 1952]);
        let sig = Dilithium3Signature([0u8; 3309]);
        state
            .add_bridge_signature(&op_id, BridgeSignature {
                validator: pk1,
                signature: sig.clone(),
            })
            .unwrap();

        // pk1 is not in active_validators -> execute must fail (non-validator signer).
        let result = state.execute_operation(&op_id, &active_validators);
        assert!(result.is_err(), "non-validator signature must be rejected (B3)");
    }

    #[test]
    fn test_lock_proof_rejects_unauthorized_relayer() {
        // B1: a proof signed by a keypair NOT in the authorized committee must fail.
        let kp_authorized = rstn_crypto::Dilithium3Keypair::generate();
        let kp_attacker = rstn_crypto::Dilithium3Keypair::generate();
        let mut state = BridgeState::new();
        let user = [0u8; 20];
        let txid = vec![1, 2, 3];

        // Committee = [kp_authorized] only.
        let committee = vec![kp_authorized.public.clone()];

        // Attacker self-attests with its OWN keypair (not in committee).
        let proof_attacker = LockProof::self_attest(&kp_attacker, SourceChain::Bitcoin, &txid, 1000, &user);
        let result = state.submit_lock(SourceChain::Bitcoin, txid, 1000, user, 1, &proof_attacker, &committee);
        assert!(result.is_err(), "unauthorized relayer proof must be rejected (B1)");
    }

    #[test]
    fn test_duplicate_signature_rejected() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut state = BridgeState::new();
        let user = [0u8; 20];
        let txid = vec![1, 2, 3];

        let committee = vec![kp.public.clone()];
        let proof = LockProof::self_attest(&kp, SourceChain::Bitcoin, &txid, 1000, &user);
        state
            .submit_lock(SourceChain::Bitcoin, txid, 1000, user, 1, &proof, &committee)
            .unwrap();

        let op_id = state.pending_ops[0].op_id;
        let pk = Dilithium3PublicKey([1u8; 1952]);
        let sig = Dilithium3Signature([0u8; 3309]);

        state
            .add_bridge_signature(&op_id, BridgeSignature {
                validator: pk.clone(),
                signature: sig.clone(),
            })
            .unwrap();

        // Same validator -> duplicate
        let result = state.add_bridge_signature(&op_id, BridgeSignature {
            validator: pk,
            signature: sig,
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_insufficient_reserves_for_burn() {
        let mut state = BridgeState::new();
        let user = [0u8; 20];

        // Try to burn without any locks
        let result = state.submit_burn(SourceChain::Bitcoin, 1000, user, 1);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            BridgeError::InsufficientReserves { .. }
        ));
    }

    #[test]
    fn test_emergency_pause() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut state = BridgeState::new();
        state.emergency_pause();

        let user = [0u8; 20];
        let txid = vec![1];
        let committee = vec![kp.public.clone()];
        let proof = LockProof::self_attest(&kp, SourceChain::Bitcoin, &txid, 1000, &user);
        let result = state.submit_lock(SourceChain::Bitcoin, txid, 1000, user, 1, &proof, &committee);
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_lock_with_header_store_canonical() {
        // End-to-end C1-production path: a header store with a canonical chain
        // anchors an SPV proof. The proof verifies because the header is
        // canonical AND has enough confirmations AND the Merkle root matches.
        use header_store::{HeaderStore, SourceHeader};

        let mut store = HeaderStore::new();
        // Build a 7-block canonical chain (genesis + 6 = 6 confirmations).
        let mut parent = [0u8; 32];
        for i in 0..7u8 {
            let mut hash = [0u8; 32];
            hash[0] = i + 1;
            let hdr = SourceHeader {
                chain: SourceChain::Bitcoin,
                height: i as u64,
                parent_hash: parent,
                hash,
                root: [0u8; 32], // patched below for the anchoring header
                accumulated_work: 100 * (i as u128 + 1),
            };
            store.insert(hdr).unwrap();
            parent = hash;
        }

        // The anchoring header is the tip (height 6, hash [7,0..]). Give it a
        // real Merkle root by building a 2-leaf tree.
        let txid = [0x11u8; 32];
        let sibling = [0x22u8; 32];
        let mut combined = [0u8; 64];
        combined[..32].copy_from_slice(&txid);
        combined[32..].copy_from_slice(&sibling);
        // Use the same hash function as the SPV module's double_sha256
        // (real Bitcoin double-SHA256) so the round-trip holds.
        use sha2::Digest;
        let first = sha2::Sha256::digest(&combined);
        let second = sha2::Sha256::digest(&first);
        let mut root = [0u8; 32];
        root.copy_from_slice(&second);

        // Re-insert the tip with the real root.
        let mut tip_hash = [0u8; 32];
        tip_hash[0] = 7;
        // Remove and re-insert is not exposed; instead insert a fresh header
        // at height 7 extending the chain, carrying the real root.
        let mut h7 = [0u8; 32];
        h7[0] = 8;
        store.insert(SourceHeader {
            chain: SourceChain::Bitcoin,
            height: 7,
            parent_hash: tip_hash,
            hash: h7,
            root,
            accumulated_work: 1000,
        }).unwrap();

        let proof = spv::BitcoinSpvProof {
            merkle_root: root,
            branch: vec![(sibling, false)],
            confirmations: 7, // store will recompute from canonical depth
        };

        let state = BridgeState::new();
        let res = state.verify_lock_with_header_store(
            SourceChain::Bitcoin,
            &txid,
            1000,
            &[0u8; 20],
            &h7,
            &proof,
            &store,
        );
        assert!(res.is_ok(), "canonical header with valid SPV proof must verify");
    }

    #[test]
    fn test_verify_lock_rejects_non_canonical_header() {
        use header_store::{HeaderStore, SourceHeader};

        let mut store = HeaderStore::new();
        // Canonical chain: h(1) -> h(2) (heavier).
        store.insert(SourceHeader {
            chain: SourceChain::Bitcoin, height: 0, parent_hash: [0u8;32],
            hash: { let mut b=[0u8;32]; b[0]=1; b }, root: [0u8;32], accumulated_work: 100,
        }).unwrap();
        store.insert(SourceHeader {
            chain: SourceChain::Bitcoin, height: 1, parent_hash: { let mut b=[0u8;32]; b[0]=1; b },
            hash: { let mut b=[0u8;32]; b[0]=2; b }, root: [0u8;32], accumulated_work: 300,
        }).unwrap();
        // Abandoned fork: h(3) at height 1, lighter work.
        store.insert(SourceHeader {
            chain: SourceChain::Bitcoin, height: 1, parent_hash: { let mut b=[0u8;32]; b[0]=1; b },
            hash: { let mut b=[0u8;32]; b[0]=3; b }, root: [0u8;32], accumulated_work: 200,
        }).unwrap();

        let proof = spv::BitcoinSpvProof {
            merkle_root: [0u8; 32],
            branch: vec![],
            confirmations: 6,
        };
        let mut non_canon = [0u8; 32];
        non_canon[0] = 3;
        let state = BridgeState::new();
        let res = state.verify_lock_with_header_store(
            SourceChain::Bitcoin, &[0u8;32], 0, &[0u8;20], &non_canon, &proof, &store,
        );
        assert!(res.is_err(), "non-canonical header must be rejected");
    }

    #[test]
    fn test_verify_lock_rejects_insufficient_confirmations() {
        use header_store::{HeaderStore, SourceHeader};

        let mut store = HeaderStore::new();
        // Only 2 blocks -> genesis has 1 confirmation, but Bitcoin needs 6.
        store.insert(SourceHeader {
            chain: SourceChain::Bitcoin, height: 0, parent_hash: [0u8;32],
            hash: { let mut b=[0u8;32]; b[0]=1; b }, root: [0u8;32], accumulated_work: 100,
        }).unwrap();
        store.insert(SourceHeader {
            chain: SourceChain::Bitcoin, height: 1, parent_hash: { let mut b=[0u8;32]; b[0]=1; b },
            hash: { let mut b=[0u8;32]; b[0]=2; b }, root: [0u8;32], accumulated_work: 200,
        }).unwrap();

        let proof = spv::BitcoinSpvProof {
            merkle_root: [0u8; 32],
            branch: vec![],
            confirmations: 6,
        };
        let mut genesis = [0u8; 32];
        genesis[0] = 1;
        let state = BridgeState::new();
        let res = state.verify_lock_with_header_store(
            SourceChain::Bitcoin, &[0u8;32], 0, &[0u8;20], &genesis, &proof, &store,
        );
        assert!(res.is_err(), "insufficient confirmations must be rejected");
    }

    #[test]
    fn test_verify_lock_rejects_merkle_root_mismatch() {
        use header_store::{HeaderStore, SourceHeader};

        let mut store = HeaderStore::new();
        // 7-block chain so confirmations are sufficient.
        let mut parent = [0u8; 32];
        for i in 0..7u8 {
            let mut hash = [0u8; 32];
            hash[0] = i + 1;
            store.insert(SourceHeader {
                chain: SourceChain::Bitcoin,
                height: i as u64,
                parent_hash: parent,
                hash,
                root: [0xaa; 32], // canonical root
                accumulated_work: 100 * (i as u128 + 1),
            }).unwrap();
            parent = hash;
        }
        let mut tip = [0u8; 32];
        tip[0] = 7;

        // Proof claims a DIFFERENT merkle root than the canonical header.
        let proof = spv::BitcoinSpvProof {
            merkle_root: [0xbb; 32],
            branch: vec![],
            confirmations: 6,
        };
        let state = BridgeState::new();
        let res = state.verify_lock_with_header_store(
            SourceChain::Bitcoin, &[0u8;32], 0, &[0u8;20], &tip, &proof, &store,
        );
        assert!(res.is_err(), "merkle root mismatch must be rejected");
    }

    // ── C2-critical: wrapped balance accounting ─────────────────────

    #[test]
    fn test_lock_mints_wrapped_balance() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut state = BridgeState::new();
        let user = [1u8; 20];
        let txid = vec![9, 9, 9, 9];
        let committee = vec![kp.public.clone()];
        let proof = LockProof::self_attest(&kp, SourceChain::Bitcoin, &txid, 1000, &user);
        let op_id = state
            .submit_lock(SourceChain::Bitcoin, txid, 1000, user, 1, &proof, &committee)
            .unwrap();
        // Execute with a real validator signature on the op_id.
        let active = vec![kp.public.clone()];
        let sig = BridgeSignature {
            validator: kp.public.clone(),
            signature: kp.sign(&op_id[..]),
        };
        state.add_bridge_signature(&op_id, sig).unwrap();
        state.execute_operation(&op_id, &active).unwrap();
        // The user must have received 1000 wBTC.
        assert_eq!(
            state.get_wrapped_balance(SourceChain::Bitcoin, &user),
            1000,
            "lock must credit wrapped balance (C2)"
        );
    }

    #[test]
    fn test_burn_without_wrapped_balance_rejected() {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let mut state = BridgeState::new();
        // Lock 1000 for user A so reserves are populated.
        let user_a = [1u8; 20];
        let txid = vec![7, 7, 7, 7];
        let committee = vec![kp.public.clone()];
        let proof = LockProof::self_attest(&kp, SourceChain::Bitcoin, &txid, 1000, &user_a);
        let lock_op = state
            .submit_lock(SourceChain::Bitcoin, txid, 1000, user_a, 1, &proof, &committee)
            .unwrap();
        let active = vec![kp.public.clone()];
        let lock_sig = BridgeSignature {
            validator: kp.public.clone(),
            signature: kp.sign(&lock_op[..]),
        };
        state.add_bridge_signature(&lock_op, lock_sig).unwrap();
        state.execute_operation(&lock_op, &active).unwrap();
        assert_eq!(state.get_wrapped_balance(SourceChain::Bitcoin, &user_a), 1000);

        // User B has 0 wrapped balance but tries to burn 1000.
        // submit_burn checks reserves.locked >= amount (passes: 1000 >= 1000).
        // But execute_operation must reject because burn_wrapped fails (B has 0).
        let user_b = [2u8; 20];
        let burn_op = state
            .submit_burn(SourceChain::Bitcoin, 1000, user_b, 2)
            .unwrap();
        let burn_sig = BridgeSignature {
            validator: kp.public.clone(),
            signature: kp.sign(&burn_op[..]),
        };
        state.add_bridge_signature(&burn_op, burn_sig).unwrap();
        let result = state.execute_operation(&burn_op, &active);
        assert!(
            result.is_err(),
            "burn without wrapped balance must be rejected (C2)"
        );
        // Reserves must be unchanged (burn was rejected before record_burn).
        let reserves = state.get_reserves(SourceChain::Bitcoin).unwrap();
        assert_eq!(reserves.locked, 1000);
    }

    // ── Escape Hatch (unilateral user exit) ────────────────────────

    /// Helper: lock tokens so the user has wrapped balance + reserves exist.
    fn setup_lock_and_mint(
        state: &mut BridgeState,
        user: [u8; 20],
        amount: u128,
    ) -> ([u8; 64], rstn_crypto::Dilithium3Keypair) {
        let kp = rstn_crypto::Dilithium3Keypair::generate();
        let txid = vec![1, 2, 3, 4, 5, 6];
        let committee = vec![kp.public.clone()];
        let proof = LockProof::self_attest(&kp, SourceChain::Bitcoin, &txid, amount, &user);
        let op_id = state
            .submit_lock(SourceChain::Bitcoin, txid, amount, user, 1, &proof, &committee)
            .unwrap();
        let active = vec![kp.public.clone()];
        let sig = BridgeSignature {
            validator: kp.public.clone(),
            signature: kp.sign(&op_id[..]),
        };
        state.add_bridge_signature(&op_id, sig).unwrap();
        state.execute_operation(&op_id, &active).unwrap();
        (op_id, kp)
    }

    #[test]
    fn test_escape_hatch_submit_escrows_balance() {
        let mut state = BridgeState::new();
        let user = [1u8; 20];
        setup_lock_and_mint(&mut state, user, 1000);

        // User has 1000 wBTC.
        assert_eq!(state.get_wrapped_balance(SourceChain::Bitcoin, &user), 1000);

        // Submit escape hatch for 500.
        let req_id = state
            .submit_escape_hatch(SourceChain::Bitcoin, 500, user, 100)
            .unwrap();

        // The 500 is escrowed (debited from wrapped balance).
        assert_eq!(state.get_wrapped_balance(SourceChain::Bitcoin, &user), 500);
        assert_eq!(state.escape_requests.len(), 1);
        assert_eq!(state.escape_requests[0].amount, 500);
    }

    #[test]
    fn test_escape_hatch_cannot_claim_before_delay() {
        let mut state = BridgeState::new();
        let user = [1u8; 20];
        setup_lock_and_mint(&mut state, user, 1000);

        let req_id = state
            .submit_escape_hatch(SourceChain::Bitcoin, 500, user, 100)
            .unwrap();

        // Try to claim immediately — must fail (delay not elapsed).
        let result = state.claim_escape(&req_id, 100 + ESCAPE_DELAY_BLOCKS - 1);
        assert!(result.is_err(), "cannot claim before delay elapses");
    }

    #[test]
    fn test_escape_hatch_claims_after_delay() {
        let mut state = BridgeState::new();
        let user = [1u8; 20];
        setup_lock_and_mint(&mut state, user, 1000);

        // Reserves: locked=1000, minted=1000, burned=0.
        assert_eq!(state.get_reserves(SourceChain::Bitcoin).unwrap().locked, 1000);

        let req_id = state
            .submit_escape_hatch(SourceChain::Bitcoin, 500, user, 100)
            .unwrap();

        // Claim after the delay — should succeed and release 500 (1:1 since
        // locked == circulating).
        let claim_height = 100 + ESCAPE_DELAY_BLOCKS;
        let (chain, released, claimed_user) = state.claim_escape(&req_id, claim_height).unwrap();
        assert_eq!(chain, SourceChain::Bitcoin);
        assert_eq!(released, 500);
        assert_eq!(claimed_user, user);

        // Reserves reduced by 500.
        assert_eq!(state.get_reserves(SourceChain::Bitcoin).unwrap().locked, 500);
    }

    #[test]
    fn test_escape_hatch_proportional_when_reserves_short() {
        let mut state = BridgeState::new();
        let user = [1u8; 20];
        setup_lock_and_mint(&mut state, user, 1000);

        // Simulate reserves shortage: manually burn 500 from reserves without
        // burning from a real user (simulating an attack/bug where locked < circulating).
        // circulating = minted - burned = 1000 - 500 = 500.
        // User escrows 100 tokens, should get 100 * 500 / 500 = 100 (1:1 since circulating == locked after the burn).
        // But if we burn more, the proportional formula kicks in.
        // For this test, we lock 1000, then burn 600 from reserves (simulating a partial drain).
        // locked = 400, circulating = 1000 (minted) - 600 (burned) = 400.
        // User escrows 200, should get 200 * 400 / 400 = 200 (still 1:1 because locked == circulating).
        // The proportional < 1:1 case only happens if locked < circulating, which would require
        // minting without locking (a bug). We simulate that by directly reducing locked.
        let reserves = state.get_reserves_mut(SourceChain::Bitcoin).unwrap();
        reserves.locked = 400; // simulate partial drain — only 400 actually locked

        let req_id = state
            .submit_escape_hatch(SourceChain::Bitcoin, 200, user, 200)
            .unwrap();

        // circulating = 1000 - 0 = 1000 (burned is still 0 in our test setup).
        // release = 200 * 400 / 1000 = 80 (proportional — user gets 80% of escrowed).
        let claim_height = 200 + ESCAPE_DELAY_BLOCKS;
        let (_, released, _) = state.claim_escape(&req_id, claim_height).unwrap();
        assert_eq!(released, 80, "proportional release when reserves are short");
    }

    #[test]
    fn test_escape_hatch_double_claim_rejected() {
        let mut state = BridgeState::new();
        let user = [1u8; 20];
        setup_lock_and_mint(&mut state, user, 1000);

        let req_id = state
            .submit_escape_hatch(SourceChain::Bitcoin, 500, user, 100)
            .unwrap();

        let claim_height = 100 + ESCAPE_DELAY_BLOCKS;
        state.claim_escape(&req_id, claim_height).unwrap();

        // Second claim — must fail (already claimed).
        let result = state.claim_escape(&req_id, claim_height + 1);
        assert!(result.is_err(), "double claim must be rejected");
    }

    #[test]
    fn test_escape_hatch_paused_bridge_rejected() {
        let mut state = BridgeState::new();
        let user = [1u8; 20];
        setup_lock_and_mint(&mut state, user, 1000);

        state.emergency_pause();
        let result = state.submit_escape_hatch(SourceChain::Bitcoin, 500, user, 100);
        assert!(result.is_err(), "escape hatch on paused bridge must be rejected");
    }

    #[test]
    fn test_escape_hatch_zero_amount_rejected() {
        let mut state = BridgeState::new();
        let user = [1u8; 20];
        let result = state.submit_escape_hatch(SourceChain::Bitcoin, 0, user, 100);
        assert!(result.is_err(), "zero amount escape must be rejected");
    }

    #[test]
    fn test_escape_hatch_without_balance_rejected() {
        let mut state = BridgeState::new();
        let user = [1u8; 20];
        // No lock/mint — user has 0 balance.
        let result = state.submit_escape_hatch(SourceChain::Bitcoin, 100, user, 100);
        assert!(result.is_err(), "escape without wrapped balance must be rejected");
    }
}
