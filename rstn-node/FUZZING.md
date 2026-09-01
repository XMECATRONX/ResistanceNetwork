# Fuzzing Guide — RSTN Node

Security-critical parsers and verifiers are fuzz-tested with `cargo-fuzz`.

## Setup

```bash
# Install the fuzzer (requires nightly Rust).
rustup toolchain install nightly
cargo +nightly install cargo-fuzz

# From the workspace root:
cd rstn-node/fuzz
```

## Targets

All targets live in `fuzz/fuzz_targets/`. The `protocol` target dispatches by
the first input byte. The `vm` and `consensus` targets are standalone binaries
(each exercises a single surface with deeper coverage).

| Binary | Target | Surface | Invariant |
|--------|--------|---------|-----------|
| `protocol` | `fuzz_verify_signature` | Dilithium3 signature verification | Never panics; rejects non-matching signatures |
| `protocol` | `fuzz_lock_proof_verify` | Bridge `LockProof::verify` | Never accepts a proof below the 2/3 threshold; never panics |
| `protocol` | `fuzz_spv_merkle_proof` | Bitcoin SPV Merkle proof | Never accepts a proof whose computed root ≠ claimed root |
| `protocol` | `fuzz_header_store_insert` | Light-client header store | Never panics; maintains heaviest-chain invariant |
| `protocol` | `fuzz_pq_wire_frame` | PQ wire frame parser | Rejects oversized/malformed frames without panicking |
| `vm` | `fuzz_vm` | RSTN-VM opcode dispatch | Never panics on any bytecode; gas_used ≤ gas_limit; memory ≤ 1MB |
| `consensus` | `fuzz_consensus` | BFT consensus state machine | Never panics; finality only at 2/3+ supermajority |

## Running

```bash
# Run a single target for a fixed duration.
cargo +nightly fuzz run protocol -- -max_total_time=300

# VM fuzzing (opcode dispatch — catches stack/memory/gas panics).
cargo +nightly fuzz run vm -- -max_total_time=600 -rss_limit_mb=4096

# Consensus fuzzing (BFT state machine — catches vote-handling panics).
cargo +nightly fuzz run consensus -- -max_total_time=600 -rss_limit_mb=8192

# Run with a memory limit (catches OOM-based DoS).
cargo +nightly fuzz run protocol -- -rss_limit_mb=4096

# Run with a specific seed to reproduce a crash.
cargo +nightly fuzz run protocol -- -seed=0x1234
```

## CI integration

Add to CI before mainnet:

```yaml
- name: Fuzz protocol (5 min smoke)
  run: |
    cd rstn-node/fuzz
    cargo +nightly fuzz run protocol -- -max_total_time=300 -rss_limit_mb=4096
- name: Fuzz VM (10 min)
  run: |
    cd rstn-node/fuzz
    cargo +nightly fuzz run vm -- -max_total_time=600 -rss_limit_mb=4096
- name: Fuzz consensus (10 min)
  run: |
    cd rstn-node/fuzz
    cargo +nightly fuzz run consensus -- -max_total_time=600 -rss_limit_mb=8192
```

A 5-minute smoke run catches the vast majority of panics. A pre-mainnet
extended run (24h+) is recommended for the cryptographic, bridge, VM, and
consensus surfaces.

## What is NOT fuzzed here

- libp2p transport internals (out of scope — fuzzed upstream by libp2p).
- The full BFT consensus *with network* (covered by `rstn-core/tests/adversarial.rs`).

## Reporting a crash

1. Reproduce with the seed printed by the fuzzer.
2. Minimize: `cargo +nightly fuzz tmin protocol fuzz/artifacts/protocol/...`
3. File a bug bounty report with the minimized input and stack trace.
