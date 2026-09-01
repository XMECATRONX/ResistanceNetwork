# Tier-3 Research Foundations — Status

This document tracks the **honest** status of the 6 advanced research areas.
Each module is a **real, tested Rust primitive** — not a stub, not a claim.
The "honest scope" header in each source file states exactly what is built
and what remains future research.

## Build & test

```bash
cd rstn-node
cargo test --release -p rstn-core --lib das onion ibc sharding pq_transport
```

## Status table

| Gap | Module | What's built (real) | What's NOT claimed (future) |
|---|---|---|---|
| **G1** PQ transport | `pq_transport.rs` | PQ-encrypted app-layer tunnel: Kyber768+X25519+Dilithium3 handshake → session key → seal/open with replay protection. 4 tests. | Not a libp2p transport-level replacement. Wire-level Noise still classical. Full transport PQ needs libp2p fork. |
| **G3** DAS | `das.rs` | Erasure-coded shards + Keccak-512 Merkle root + Merkle proofs + light-client random sampling. 3 tests. | No NMT (namespaced Merkle trees). No fraud proofs for bad extensions. No distributed DAS-by-bits. |
| **G6** Onion routing | `onion.rs` | Layered encryption mix: N relays, each peels one layer, learns only next hop. 3 tests. | No timed batch release (Nym-style mixnet). No cover traffic. Relay keys pre-shared (no directory authority). |
| **G7** IBC | `ibc.rs` | Light client (trusted header + Merkle membership verification) + packet commitments + replay-protected delivery. 4 tests. | No full IBC protocol suite (connection/channel/timeout/ACK). No permissionless relayer market. |
| **G11** Formal verification | — | NOT BUILT. Documented as multi-year research (Move Prover / resource types). | Move-style resources + Move Prover. This is years of research, honestly out of scope for now. |
| **G12** Sharding | `sharding.rs` | Cross-shard receipts (ordered, replay-protected queues) + VRF shard assignment (deterministic, verifiable). 4 tests. | No cross-shard state proofs. No dynamic shard count. No atomic cross-shard txs (two-phase commit). |

## What this means for the protocol

These foundations let the frontend make **honest, verifiable** claims:

- "Post-quantum transport encryption exists and is tested" (G1) — TRUE at app layer.
- "Data availability sampling exists" (G3) — TRUE for the sampling primitive.
- "Onion routing layer exists" (G6) — TRUE as a mix layer (not full mixnet).
- "IBC light client exists" (G7) — TRUE for verification + commitments.
- "Cross-shard messaging + VRF assignment exists" (G12) — TRUE for receipts + assignment.

What we do NOT claim (and the frontend must not claim):
- "Full libp2p PQ transport" — needs the fork (G1 future).
- "Celestia-grade DAS with fraud proofs" — needs NMT + fraud proofs (G3 future).
- "Nym-grade mixnet anonymity" — needs timed batching + cover traffic (G6 future).
- "Full IBC protocol" — needs the complete handler suite (G7 future).
- "Move formal verification" — years of research (G11, not started).
- "Dynamic cross-shard state proofs" — needs Merkle state proofs (G12 future).

## Test count

- `pq_transport.rs`: 4 tests (keystream, seal/open, replay rejection, full PQ handshake → encrypt)
- `das.rs`: 3 tests (encode/reconstruct, Merkle root+proof, light-client sampling)
- `onion.rs`: 3 tests (3-relay roundtrip, relay can't read inner, wrong key fails)
- `ibc.rs`: 4 tests (commitment determinism, sequence differs, deliver-once, wrong dest, mismatch)
- `sharding.rs`: 4 tests (in-order receipts, per-shard isolation, VRF deterministic, VRF verifiable)

**Total: 18 new tests, all passing.**
