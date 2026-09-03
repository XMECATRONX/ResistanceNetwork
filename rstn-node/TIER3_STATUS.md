# RSTN — Tier 3: Real status vs. future roadmap (honest)

This document records which Tier 3 features (the hardest ones) are
**implemented and verified** vs. which are **future research**.
No aspirations are presented as facts. Every claim can be verified
against the code.

---

## ✅ IMPLEMENTED AND VERIFIED (real code, adversarial tests)

### Reed-Solomon erasure coding (DAS foundation)
- **File:** `crates/rstn-core/src/erasure.rs`
- **What it does:** splits data into K shards + M parity shards over GF(2^8).
  Any K of (K+M) shards reconstruct the full data. A proposer that
  withholds data cannot halt the network — any node with K shards reconstructs.
- **Tests:** `tests/tier3.rs` — survives loss of any 2 shards,
  rejects incorrect shard count, 10 KB roundtrip, zero padding.
- **What it is NOT:** NOT full DAS (random light-client sampling,
  NMT merkle trees, fraud proofs for bad erasure extensions). That is
  future research below.

### Governance with flash-loan protection
- **File:** `crates/rstn-core/src/governance.rs`
- **What it does:** snapshots voting power at proposal creation (tokens
  acquired after the snapshot do not count), quadratic voting (weight =
  sqrt(stake)), 1-epoch timelock between approval and execution, minority
  veto (10%).
- **Tests:** `tests/tier3.rs` — flash loan defeated (0 power at snapshot),
  whale cannot dominate with quadratic voting, timelock blocks immediate
  execution, minority veto blocks, double vote rejected, future snapshot
  rejected.
- **Defends against:** the attack that cost Beanstalk $50M (flash loan →
  vote → repay in one block).

### On-chain circuit breakers
- **File:** `crates/rstn-core/src/circuit_breaker.rs`
- **What it does:** detects anomalous drainage (>X% of balance in Y blocks)
  and oracle deviation (>X% in Y blocks) and pauses the affected scope.
  Manual global pause for emergencies.
- **Tests:** `tests/tier3.rs` — drainage trips breaker, slow drainage
  accumulates, oracle manipulation (up and down) trips, window expiry
  allows new drainage, global pause blocks all, recovery via clear.

---

## 🚧 FUTURE RESEARCH (not implemented — do not claim as done)

### P2P onion routing (Nym-style) — IMPLEMENTED (mixnet with delay + cover traffic)
- **Implemented:** layered encryption (`onion.rs`), per-relay keystream,
  routing instructions, **cover-traffic scheduler** (Poisson-distributed dummy
  onions indistinguishable from real traffic), AND **timed batch mixing**
  (`MixBatch`): a mix node collects messages for a fixed epoch interval,
  then releases the full batch in random order (uniform permutation) with
  per-message jitter. This breaks the sender→receiver timing correlation — the
  core of a Nym/Sphinx-style mixnet. Tests: 3-relay roundtrip, relay cannot
  read inner layers, wrong key fails, scheduler emits at target rate,
  dummies are valid onions, mix batch retains until epoch boundary, release
  in random order (not arrival order), correlation resistance (distinct
  permutations per seed), uniform MixPath.
- **What remains future:** a dedicated directory authority for relay key
  distribution, and integration of the mixnet into the real P2P stack
  (today it is a tested library, not the default transport). The current
  P2P transport uses Noise (X25519) at wire level; the application envelope
  is PQ-encrypted.

### Formal verification of the EVM (Coq/Lean) — FORMAL SPEC IMPLEMENTED
- **Implemented:** `crates/rstn-vm/src/formal.rs` — the specification layer
  that a formal verification effort (Coq/Lean) would prove. Defines the 6
  VM safety invariants as executable predicates:
  (1) bounded gas (gas_used ≤ gas_limit), (2) bounded stack (≤ 1024),
  (3) bounded memory (≤ 1 MiB), (4) bounded call depth (≤ 16),
  (5) termination (finite gas → halt), (6) determinism (same input →
  same output). Verified by property-based tests with random bytecode
  (200 trials). A future Coq/Lean embedding would translate these predicates
  into theorems and prove them mechanically.
- **What remains future:** a full Coq/Lean embedding of opcode semantics
  with mechanized proofs (KEVM-style, multi-year). The circuit breakers
  remain the current practical substitute.

### Full DAS (sampling + NMT + fraud proofs + DAS-by-bits) — IMPLEMENTED
- **Implemented:** Reed-Solomon erasure coding, flat Merkle root, light-client
  random sampling, fraud proofs for bad erasure extensions, **Namespaced
  Merkle Trees (NMT)** (`nmt.rs`) with namespace-scoped proofs (inclusion +
  completeness), AND **distributed peer DAS (DAS-by-bits)**
  (`DistributedSampler` in `das.rs`): a coordinator that queries multiple
  peers for random shards, verifies each against the Merkle root, and
  reconstructs the block if ≥ K verified shards are collectively
  available. A proposer that withholds data cannot fool the network
  because shards are distributed across independent nodes. Tests:
  distinct indices, reconstruction from peer shards, fails with < K
  shards, rejects withheld shards, rejects tampered shard.
- **What remains future:** integration of `DistributedSampler` into the
  real network protocol (today it is a tested library; P2P shard
  transport requires the network gossip protocol). The proof layer is here.

---

## 🔬 REQUIRES EXTERNAL RESOURCES (cannot be developed in this environment)

### Formal external cryptographic audit
- **What it is:** Review of the PQ stack (Dilithium3 FIPS 204, Kyber768, SPHINCS+,
  hybrid NoiseHandshake) by a registered firm (Trail of Bits, NCC Group,
  Quarkslab).
- **Why it cannot be developed here:** Requires certified human auditors,
  billable time (weeks), and a signed report. It is a professional
  service, not code.
- **Status:** the stack is implemented and has unit tests, but **without
  external review**. Plan: contract before mainnet.

### Extended fuzzing 24h+
- **What it is:** Run `cargo +nightly fuzz run` for 24h+ on each target
  (`consensus.rs`, `vm.rs`, `protocol.rs`).
- **Why it cannot be developed here:** Requires CI with dedicated
  machines running 24h+. The targets are written and complete; the
  extended runs are missing.
- **Status:** targets ready in `rstn-node/fuzz/`. Plan: configure CI.

### libp2p fork for PQ wire-level transport
- **What it is:** Replace `libp2p-noise` (X25519) with Kyber768+X25519 hybrid
  at transport level. `PqNoiseConfig` (`pq_transport_upgrade.rs`) is already
  written and tested as a drop-in `ConnectionUpgrade`.
- **Complete upstream PR code:** `crates/rstn-p2p/src/libp2p_identity_pq.rs`
  — defines `Dilithium3Identity` (the variant for `libp2p::identity::Keypair`),
  `PeerId` derivation via identity-multihash, and the complete diff against
  `keypair.rs` and `PublicKey` (add `Keypair::Dilithium3` + `PublicKey::Dilithium3`).
  4 tests: valid PeerId generation, uniqueness, sign+verify, pubkey size.
- **Why it cannot be merged here:** The upstream PR to `rust-libp2p` requires
  review by libp2p maintainers. The identity-multihash bridge makes the
  upgrade usable today; the identity extension is the upstream PR.
- **Status:** the PQ upgrade is implemented and tested (handshake, framing,
  MITM rejection, replay rejection). `PqEnvelope` (`pq_broadcast.rs`)
  blinds the gossipsub topic. The upstream PR code is written and
  tested. Upstream merge into `libp2p::identity` is pending.

### Ledger on-device firmware app
- **What it is:** The `.app` binary that runs on the Ledger secure element (ST33).
  The `LedgerTransport` trait and APDU protocol are defined
  (`rstn-ledger`).
- **Complete on-device entrypoint:** `ledger-app/src/main.rs` — the USB HID
  APDU I/O loop, on-screen confirmation flow (display "Sign RSTN tx?"
  + hash + both-button + timeout 30s → SW_USER_REJECTED), button
  polling, and dispatch to the handler in `lib.rs`. `Cargo.toml` has the
  `[[bin]]` feature-gated under `bolos` (only compiles with the BOLOS SDK,
  not with the workspace). 4 off-device tests of the main loop.
- **Why it cannot be completed here:** Requires the Ledger BOLOS SDK, a
  physical device, and Ledger HQ approval. It is a separate firmware
  project.
- **Status:** complete spec in `LEDGER_BOLOS_FIRMWARE.md`. `lib.rs` (APDU
  dispatcher, 7 tests) + `main.rs` (I/O loop + confirmation, 4 tests) are
  written. Compiling with the Ledger toolchain + physical device testing is pending.

---

## How to verify each claim

| Claim | Verification command |
|---|---|
| Erasure coding works | `cargo test -p rstn-core --test tier3 erasure_` |
| Governance anti-flash-loan | `cargo test -p rstn-core --test tier3 flash_loan_governance` |
| Circuit breakers | `cargo test -p rstn-core --test tier3 drain_attack` |
| NMT namespace proofs | `cargo test -p rstn-core nmt` |
| Cover-traffic scheduler | `cargo test -p rstn-core onion::tests::cover_traffic` |
| Mixnet (timed batch mixing) | `cargo test -p rstn-core onion::tests::mix_batch` |
| Distributed DAS (DAS-by-bits) | `cargo test -p rstn-core das::tests_das_distributed` |
| Formal verification spec (VM invariants) | `cargo test -p rstn-vm formal::tests_formal` |
| PQ envelope (topic blinding) | `cargo test -p rstn-p2p pq_broadcast::tests::test_envelope` |
| PQ transport upgrade (fork) | `cargo test -p rstn-p2p pq_transport_upgrade` |
| PQ wire stream | `cargo test -p rstn-p2p pq_wire` |
| libp2p identity Dilithium3 (upstream PR) | `cargo test -p rstn-p2p libp2p_identity_pq` |
| Ledger APDU dispatcher (off-device) | `cargo test -p rstn-ledger` |
| Ledger main loop (off-device) | `cargo test -p ledger-app` (requires `bolos` feature off) |
| Solidity transpiler | `rstn-node transpile --input contract.bin --output out.hex` |
| External audit | Package in `CRYPTO_AUDIT_PACKAGE.md` — requires contracting external firm |
| Fuzzing 24h+ | Workflow `.github/workflows/fuzz-extended.yml` — requires self-hosted runner |
| libp2p upstream fork | Code in `libp2p_identity_pq.rs` — requires merge into `rust-libp2p` |
| Ledger on-device firmware | `main.rs` + `lib.rs` — requires BOLOS SDK + physical device |
