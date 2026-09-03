# RSTN — External Cryptographic Audit Package

> **Purpose:** This document is the hand-off package for an external
> cryptographic audit firm (Trail of Bits, Least Authority, NCC Group, or
> Quarkslab). It scopes the review, lists every primitive under audit, and
> maps each to its source file + test command so the auditors can verify
> claims independently.

---

## 1. Scope of review

The audit must cover the **entire post-quantum cryptographic stack** of
Resistance Network. Nothing in the PQ path is out of scope.

| # | Primitive | Standard | Source | Test command |
|---|-----------|----------|--------|--------------|
| 1 | Dilithium3 (ML-DSA-65) sign/verify/keygen | NIST FIPS 204 | `crates/rstn-crypto/src/lib.rs` | `cargo test -p rstn-crypto dilithium` |
| 2 | Kyber768 (ML-KEM-768) encapsulate/decapsulate | NIST FIPS 203 | `crates/rstn-crypto/src/lib.rs` | `cargo test -p rstn-crypto kyber` |
| 3 | SLH-DSA / SPHINCS+ (Shake-128f) fallback | NIST FIPS 205 | `crates/rstn-crypto/src/lib.rs` | `cargo test -p rstn-crypto sphincs` |
| 4 | Keccak-512 hash (Grover-resistant) | NIST FIPS 202 | `crates/rstn-crypto/src/lib.rs` | `cargo test -p rstn-crypto keccak` |
| 5 | Hybrid signature (Dilithium3 + Ed25519) | — | `crates/rstn-crypto/src/lib.rs` | `cargo test -p rstn-crypto hybrid` |
| 6 | PQ hybrid Noise handshake (Kyber768 + X25519 + Dilithium3 + HKDF-SHA3-512) | — | `crates/rstn-crypto/src/lib.rs` | `cargo test -p rstn-crypto handshake` |
| 7 | Forward security (epoch key rotation) | — | `crates/rstn-crypto/src/forward_security.rs` | `cargo test -p rstn-crypto forward` |
| 8 | Account abstraction (PQ session keys) | — | `crates/rstn-crypto/src/account_abstraction.rs` | `cargo test -p rstn-crypto account_abstraction` |
| 9 | Quantum Alarm (emergency key rotation on-chain) | — | `crates/rstn-crypto/src/quantum_alarm.rs` | `cargo test -p rstn-crypto quantum_alarm` |
| 10 | Stealth addresses (PQ) | — | `crates/rstn-crypto/src/lib.rs` | `cargo test -p rstn-crypto stealth` |
| 11 | PQ group-key broadcast seal (gossipsub) | — | `crates/rstn-p2p/src/pq_broadcast.rs` | `cargo test -p rstn-p2p pq_broadcast` |
| 12 | PQ wire-level transport upgrade (libp2p) | — | `crates/rstn-p2p/src/pq_transport_upgrade.rs` | `cargo test -p rstn-p2p pq_transport` |
| 13 | PQ direct-stream wire channel | — | `crates/rstn-p2p/src/pq_wire.rs` | `cargo test -p rstn-p2p pq_wire` |
| 14 | PQ session manager | — | `crates/rstn-p2p/src/pq_session.rs` | `cargo test -p rstn-p2p pq_session` |
| 15 | Bridge threshold signatures (2/3 committee) | — | `crates/rstn-bridge/src/lib.rs` | `cargo test -p rstn-bridge` |
| 16 | Bitcoin SPV Merkle proofs | — | `crates/rstn-bridge/src/spv.rs` | `cargo test -p rstn-bridge spv` |
| 17 | Ledger APDU protocol (host + on-device) | — | `crates/rstn-ledger/src/lib.rs`, `ledger-app/src/lib.rs` | `cargo test -p rstn-ledger` |

---

## 2. Specific attack surfaces to review

The auditors must specifically assess resistance to:

### 2.1 Key-recovery attacks
- **Dilithium3 lattice attacks** — verify the `fips204` implementation does not
  leak the secret polynomial via side-channels in the signing loop.
- **Kyber768 decryption failures** — verify the CCA transform (Fujisaki-Okamoto)
  is correctly applied so a decryption-failure oracle cannot recover the
  secret key.
- **SPHINCS+ state reuse** — verify the `slh-dsa` RNG path never reuses a
  randomizer across two signatures on the same key (catastrophic for
  stateful-hash signatures).

### 2.2 Handshake attacks
- **MITM on the PQ hybrid handshake** — the responder must reject an
  initiator whose transcript signature does not match the expected
  Dilithium3 public key. Test: `pq_stream_rejects_mitm`.
- **Replay across sessions** — nonces must advance monotonically; a replayed
  sealed frame must be rejected. Test: `pq_stream_replay_rejected`.
- **Downgrade to classical** — the transport upgrade must not fall back to
  X25519-only Noise if the peer advertises PQ support. The protocol name
  `/rstn/pq-noise/1.0.0` is the only accepted upgrade.

### 2.3 Bridge attacks
- **Threshold bypass** — a `LockProof` with fewer than 2/3 of the committee
  signatures must never mint. Fuzz target: `fuzz_lock_proof_verify`.
- **SPV forgery** — a Merkle proof whose computed root differs from the
  claimed root must never confirm. Fuzz target: `fuzz_spv_merkle_proof`.
- **Chain reorg** — the header store must maintain the heaviest-chain
  invariant under arbitrary insertions. Fuzz target: `fuzz_header_store_insert`.

### 2.4 Consensus attacks
- **Equivocation (double-signing)** — the slashing detector must fire exactly
  once per offender, never zero, never twice. Fuzz target: `consensus.rs` §1.
- **Phase confusion** — a COMMIT vote must never count as PREPARE. Fuzz target:
  `consensus.rs` §2.
- **Forged signature** — a vote signed by key B claiming to be from key A must
  be rejected. Fuzz target: `consensus.rs` §3.
- **Vote inflation** — duplicate votes from the same validator must be
  deduped. Fuzz target: `consensus.rs` §4.

### 2.5 VM attacks
- **Gas bypass** — `gas_used` must never exceed `gas_limit`. Fuzz target:
  `vm.rs`.
- **Memory OOM** — memory must never exceed 1 MiB. Fuzz target: `vm.rs`.
- **Infinite loop** — a self-jumping loop must terminate via out-of-gas, not
  hang. Fuzz target: `vm.rs` §1.

---

## 3. Dependency provenance

All cryptographic dependencies are pinned and auditable:

| Crate | Version | Role | Source |
|-------|---------|------|--------|
| `fips204` | 0.4 | Dilithium3 (FIPS 204 final) | crates.io |
| `slh-dsa` | 0.2.0-rc.5 | SPHINCS+ / SLH-DSA (FIPS 205) | crates.io |
| `pqc_kyber` | 0.7 | Kyber768 (FIPS 203) | crates.io |
| `x25519-dalek` | 2.0 | X25519 ECDH (hybrid) | crates.io |
| `ed25519-dalek` | 3.0 | Ed25519 (hybrid sig) | crates.io |
| `sha3` | 0.10 | Keccak-512 | crates.io |
| `hkdf` | 0.12 | HKDF-SHA3-512 | crates.io |
| `zeroize` | 1.8 | Secret zeroization | crates.io |

The auditors must verify that no `unsafe` block in these crates is reachable
from the RSTN call sites, and that all secret material is zeroized on drop.

---

## 4. Test vectors to reproduce

The auditors must independently reproduce:

```bash
# Full PQ crypto suite
cargo test -p rstn-crypto

# Consensus + slashing + forward security
cargo test -p rstn-core

# VM invariants (formal spec)
cargo test -p rstn-vm formal

# P2P PQ transport + broadcast
cargo test -p rstn-p2p

# Bridge threshold + SPV
cargo test -p rstn-bridge

# Ledger host + firmware logic
cargo test -p rstn-ledger

# Adversarial fuzz targets (short run — 24h run is separate)
cargo +nightly fuzz run consensus -- -max_total_time=60
cargo +nightly fuzz run vm -- -max_total_time=60
cargo +nightly fuzz run protocol -- -max_total_time=60
```

---

## 5. Known honest limitations (for the auditors)

These are NOT bugs — they are documented design constraints the auditors
should confirm are acceptable:

1. **Ledger hybrid signing.** The ST33 secure element cannot run full
   Dilithium3 signing at production speed. The `hybrid-attestation` feature
   delegates lattice signing to the host with a SE-attested session key.
   The auditors must confirm the attestation binds the host signing key to a
   fresh SE-minted nonce (INS 0x04 + INS 0x05).

2. **Identity-multihash bridge for libp2p.** The PQ transport upgrade derives
   `PeerId` from a Dilithium3 public key via an identity multihash, without
   extending `libp2p::identity::Keypair`. The auditors must confirm this does
   not create a PeerId collision space (identity multihash of a 1952-byte key
   is collision-free).

3. **XOR keystream for wire encryption.** The `PeerSession::seal` uses a
   Keccak-512-based XOR keystream keyed by the PQ-derived session key, not an
   AEAD. The auditors must confirm the nonce is 8 bytes, monotonically
   advancing, and that the keystream is not reusable (the nonce space of 2^64
   is sufficient for the session lifetime).

4. **Blind signing on Ledger.** The SE signs a 32-byte hash, not a parsed
   transaction. The host is trusted to display the transaction context. A
   future firmware revision parses the tx on-device.

---

## 6. Deliverables expected from the audit

1. **Signed audit report** covering each of the 17 primitives in §1.
2. **Severity-rated findings** (Critical / High / Medium / Low / Informational).
3. **Reproduction instructions** for any finding.
4. **Remediation verification** — after fixes, a re-test of each finding.
5. **Final attestation** that the PQ stack is safe for mainnet, or a list of
   blockers.

---

## 7. Timeline

| Phase | Duration | Owner |
|-------|----------|-------|
| Scoping call | 1 week | RSTN + auditor |
| Code review | 3-4 weeks | auditor |
| Draft report | 1 week | auditor |
| Remediation | 1-2 weeks | RSTN |
| Re-test + final report | 1 week | auditor |
| **Total** | **6-9 weeks** | |

The audit must be **complete and clean** before mainnet genesis. No exceptions.
