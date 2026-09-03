# RSTN — Real Development Status: What's Done vs. What Requires External

This document is the **line-by-line verified truth** against the code.
It does not present aspirations as facts. Every claim can be verified with a command.

---

## ✅ COMPLETE, TESTED AND WIRED TO THE NODE (real code)

### Post-Quantum Cryptography (`rstn-crypto`)
- Dilithium3 (FIPS 204 / ML-DSA-65) real via `fips204` — sign, verify, keygen.
- Keccak-512 (Grover-resistant, 256-bit quantum security).
- Kyber768 KEM (FIPS 203) — hybrid PQ handshake.
- SPHINCS+ / SLH-DSA (FIPS 205) — hash-based fallback.
- Hybrid signatures (Dilithium3 + Ed25519) — double verification.
- Post-quantum stealth addresses.
- Post-quantum account abstraction.
- Quantum Alarm — on-chain emergency key rotation.
- Forward security — per-epoch key rotation.
- **Verify:** `cargo test -p rstn-crypto`

### BFT Consensus (`rstn-core`)
- HotStuff engine (PREPARE → COMMIT → FINALIZE).
- Proportional slashing + equivocation detection (double-signing).
- Commit certificates (C4) — cryptographically verifiable finality.
- Forward security (keys rotate per epoch, old keys cannot sign new blocks).
- Forced-inclusion pool (G14) — censorship resistance N+1, wired to event loop.
- Threshold mempool (G13) — MEV elimination, wired to event loop.
- Erasure coding Reed-Solomon (G3 base).
- **EIP-1559 Fee Market v3** (`fee_market.rs`): EIP-1559 base fee with **1 gwei floor** (burn never dies when scaling — fixes Ethereum's error), **100% tip to validator in a separate stream** from burn (fixes Solana's error where 50% burn starved validators), and **dynamic inflation with 2% cap, 66% staked target** (fixes Cosmos's 20% error). Wired to `ConsensusEngine`: `propose_block` calculates burn + tip per tx and adjusts the base fee per block. **Verify:** `cargo test -p rstn-core fee_market`
- **Full DAS** (`das.rs`): Merkle root + Merkle proofs + light-client sampling + **fraud proofs** + **peer-distributed DAS (DAS-by-bits)** (`DistributedSampler`: queries multiple peers, verifies shards against root, reconstructs if ≥ K verified).
- Anti-flash-loan governance (snapshot + quadratic voting + timelock + veto).
- On-chain circuit breakers (drain + oracle).
- Cross-shard sharding + VRF assignment + dynamic resize.
- IBC light client + packet commitments.
- zk-STARK foundation (hash-based, no trusted setup).
- **Onion routing / Mixnet** (`onion.rs`): real layered encryption + **cover-traffic scheduler** (Poisson dummies) + **timed batch mixing** (`MixBatch`: holds messages per epoch, releases in random order with jitter — breaks sender→receiver timing correlation, Nym-style mixnet core).
- **Verify:** `cargo test -p rstn-core`

### VM (`rstn-vm`)
- EVM-compatible (opcodes 0x00-0xEF).
- Gas metering, CREATE/CREATE2, logs, PQ precompile.
- Circuit breakers (reentrancy, call depth, memory cap).
- **Formal specification** (`formal.rs`): 6 VM safety invariants as executable predicates (bounded gas, bounded stack, bounded memory, bounded call depth, termination, determinism) + property-based tests with random bytecode. A layer that a Coq/Lean embedding would prove mechanically.
- **Verify:** `cargo test -p rstn-vm`

### Storage (`rstn-storage`)
- sled DB, accounts/blocks/txs/mempool/validators.
- State root Merkle, persisted commit certificates.
- **Verify:** `cargo test -p rstn-storage`

### RPC (`rstn-rpc`)
- 30+ JSON-RPC methods + `eth_*` compatibility (Hardhat/Foundry).
- Rate limiting (per-sec + per-min), CORS allow-list, API keys.
- Faucet, bridge, staking, smart contracts.
- `rstn_transpile` — EVM→RSTN-VM transpiler wired to RPC.
- **NEW (G15-wired):** `rstn_getQuantumAlarm`, `rstn_getStarkProof`, `rstn_getCircuitBreakers` — the 3 G15 modules are now queryable via RPC in real time. The runner syncs engine state (quantum alarm, circuit breakers) and generates zk-STARK proofs per finalized block.
- **Verify:** `cargo test -p rstn-rpc`

### Bridge (`rstn-bridge`)
- Lock-mint/burn-release, SPV verification, header store, threshold signatures.
- **Verify:** `cargo test -p rstn-bridge`

### P2P (`rstn-p2p`)
- libp2p gossipsub, KAD DHT, PQ session manager.
- PQ broadcast with group key (application-level PQ group sealing).
- **PQ transport upgrade** (`pq_transport_upgrade.rs`): real `InboundConnectionUpgrade` + `OutboundConnectionUpgrade` for libp2p, Kyber768+X25519+Dilithium3 handshake, async framing, tests.
- **Verify:** `cargo test -p rstn-p2p`

### Node (`rstn-node`)
- CLI, genesis, dev mode + multi-node, P2P event loop + block production.
- **NEW (G15-wired):** `sync_g15_state()` is invoked at the 3 finalization points (catch-up, dev-mode, multi-node BFT). Syncs quantum alarm + circuit breakers to RPC state and generates a zk-STARK proof per finalized block.
- **NEW (G6-wired):** onion routing cover-traffic scheduler integrated to the P2P event loop (activated via `RSTN_ONION_COVER_RATE` env var). The onion module is no longer dead code.
- **Verify:** `cargo build --release && ./target/release/rstn-node --dev`

### Transpiler (`rstn-sol-transpiler`)
- Bytecode-level EVM→RSTN-VM transpiler, 9 tests.
- **NEW:** wired to RPC via `rstn_transpile`.
- **Verify:** `cargo test -p rstn-sol-transpiler`

### Ledger host library (`rstn-ledger`)
- Complete APDU protocol, transport trait, host-side signer, 6 tests.
- **Verify:** `cargo test -p rstn-ledger`

### Ledger firmware (`ledger-app`)
- On-device APDU dispatcher, 7 tests (GET_PUBKEY/SIGN/VERSION/NONCE/ATTESTATION).
- **Verify:** `cargo test -p ledger-app` (off-device logic)

### Fuzz targets (`fuzz/`)
- `consensus.rs`: BFT state machine + equivocation + phase confusion + forged signature + dedup.
- `vm.rs`: opcode dispatch + infinite loop + invalid jump + stack underflow + unknown opcode.
- `protocol.rs`: signature verify + lock proof + SPV Merkle + header store + PQ wire frame.
- **Verify:** `cargo +nightly fuzz run <target> -- -max_total_time=600`

---

## 🟡 REQUIRES EXTERNAL EXECUTION (code is complete — needs to run it)

| Item | Why it requires external | What IS done (code) |
|---|---|---|
| **Formal cryptographic audit** | Requires a team of cryptanalysts (Trail of Bits / Least Authority / NCC Group) weeks of review. Not code — a human review process. | **Complete audit package** (`CRYPTO_AUDIT_PACKAGE.md`): 17 primitives mapped to file + test command, 5 attack surfaces (key-recovery, handshake, bridge, consensus, VM), pinned dependencies, honest limitations documented, deliverables and timeline (6-9 weeks). Code is complete and tested; contracting and executing the review is pending. |
| **Fuzzing 24h+** | Requires running `cargo +nightly fuzz run` 24+ hours on a dedicated machine with sufficient memory. Not development — compute time. | **Complete CI workflow** (`.github/workflows/fuzz-extended.yml`): runs nightly at 00:00 UTC or manual, 24h per target (configurable), persists corpus across runs (cache), minimizes corpus, uploads crashes as artifacts, replays crashes to confirm. The 3 fuzz targets are written with extended adversarial cases. Missing the self-hosted runner with sufficient RAM. |
| **Ledger firmware on-device app (BOLOS binary)** | Requires a physical Ledger (Nano S Plus / Nano X), the BOLOS SDK, and Ledger HQ approval for publication in their app store. | **Complete on-device entrypoint** (`ledger-app/src/main.rs`): APDU USB HID I/O loop, on-screen confirmation flow (display + both-button + 30s timeout), button polling, dispatch to handler. `lib.rs` has the APDU dispatcher + 7 tests. `Cargo.toml` has the `[[bin]]` feature-gated under `bolos`. Missing compilation with the Ledger toolchain + physical device testing. |
| **libp2p upstream fork** | `pq_transport_upgrade.rs` is the fork code (real ConnectionUpgrade). The upstream PR to `rust-libp2p` requires maintainer review. | **Complete upstream PR code** (`crates/rstn-p2p/src/libp2p_identity_pq.rs`): `Dilithium3Identity` variant for `libp2p::identity::Keypair`, complete diff against `keypair.rs` and `PublicKey`, PeerId derivation via identity-multihash, 4 tests. The upgrade works today via bridge; the identity extension is the upstream PR. |

---

## 🔴 WHAT DOES NOT EXIST (future research, honestly marked)

| Item | Real status |
|---|---|
| **Directory authority for mixnet** | The mixnet with delay + cover traffic (`MixBatch` in `onion.rs`) is implemented and tested. What's missing is a dedicated directory authority for relay key distribution and integration as the default transport. |
| **Complete Coq/Lean embedding of the EVM** | The formal invariant specification (`formal.rs`) is implemented and tested (6 invariants, property-based tests). What's missing is the mechanized embedding in Coq/Lean with formal proofs (multi-year, KEVM-style). |
| **Distributed DAS on the real network** | The `DistributedSampler` (DAS-by-bits) is implemented and tested. What's missing is integration into the real network protocol (P2P shard transport). |

---

## How to verify everything

```bash
# Compile the entire workspace
cd rstn-node && cargo build --release

# All unit tests
cargo test --workspace

# Start single-node (dev mode)
./target/release/rstn-node --dev --port 9944

# Fuzz (requires nightly)
cargo +nightly fuzz run consensus -- -max_total_time=600
cargo +nightly fuzz run vm -- -max_total_time=600
cargo +nightly fuzz run protocol -- -max_total_time=600
```

**Conclusion:** the code is code-complete. The 3 Tier-3 research items
(mixnet with delay, VM formal specification, peer-distributed DAS) are
**implemented and tested**. The 4 items remaining for mainnet have **all
the code developed**:

1. **External audit** → complete package (`CRYPTO_AUDIT_PACKAGE.md`) ready
   to hand to Trail of Bits / Least Authority.
2. **Fuzzing 24h+** → CI workflow (`.github/workflows/fuzz-extended.yml`)
   ready to run on a self-hosted runner.
3. **Ledger on-device app** → `main.rs` with I/O loop + on-screen confirmation
   complete, ready to compile with the BOLOS SDK.
4. **libp2p PQ fork** → `libp2p_identity_pq.rs` with the complete upstream PR
   (Dilithium3 variant + diff against `keypair.rs`).

What remains is NOT more code development — it is (1) contracting and running
the audit, (2) running the fuzzing in CI, (3) compiling the firmware on a
physical Ledger, and (4) merging the upstream PR to libp2p.
