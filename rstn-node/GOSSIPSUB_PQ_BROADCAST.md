# Gossipsub PQ Broadcast — libp2p Fork Plan

> Status: **Design** — application-layer PQ transport (`pq_wire.rs`,
> `pq_transport.rs`) is implemented and tested. The wire-level gossipsub
> broadcast PQ is the pre-mainnet deliverable requiring a libp2p fork.

---

## Problem

libp2p's gossipsub uses the **Noise protocol** (X25519 ECDH) for the
transport-level secure channel. X25519 is **classical** — a quantum adversary
with Shor's algorithm can break the ECDH and decrypt gossipsub traffic.

The application-layer PQ tunnel (`rstn-core/pq_transport.rs`) encrypts
consensus payloads *before* they enter gossipsub, so the application payload
is post-quantum confidential. However, the **libp2p Noise layer still runs
underneath** — a network observer sees the Noise handshake metadata, and the
transport-level confidentiality depends on Noise alone.

**The claim "100% PQ coverage" requires replacing Noise at the transport
level too.**

---

## Approach: Fork libp2p with a PQ Noise Plugin

### Option A — Hybrid Noise (recommended for mainnet)

Replace libp2p's `noise::Config` with a **hybrid Noise** that combines:
- **Kyber768 KEM** (post-quantum key encapsulation)
- **X25519 ECDH** (classical — defense in depth)
- **Dilithium3** (post-quantum authentication)

The session key is derived from **both** Kyber768 and X25519 via HKDF-SHA3-512.
Breaking either half does not break the session — an attacker must break
**both** the lattice problem AND the ECDH. This is the same construction used
by `rstn-crypto::NoiseHandshake` (already implemented and tested).

**Effort:** ~3–4 weeks (fork `rust-libp2p`, implement `PqNoiseConfig` as a
`Transport` wrapper, upstream a PR, test against the gossipsub test suite).

### Option B — Pure PQ Noise (future, after Kyber hardware acceleration)

Replace Noise entirely with a Kyber768-only handshake (no X25519). This
eliminates the classical half but loses the defense-in-depth of hybrid. Not
recommended until Kyber hardware is ubiquitous and the classical half is
provably unnecessary.

---

## Fork Plan

### Step 1: Branch `rust-libp2p`

```bash
git clone https://github.com/libp2p/rust-libp2p
cd rust-libp2p
git checkout -b rstn/pq-noise
```

### Step 2: Implement `PqNoiseConfig`

In `protocols/noise/src/handshake.rs`, add a `PqHandshakeState` that:

1. **Initiator**: generates a Kyber768 keypair + an X25519 ephemeral keypair.
   Sends `Kyber_pk || X25519_pk || Dilithium3_sig(Kyber_pk || X25519_pk)` to
   the responder.
2. **Responder**: generates Kyber768 keypair + X25519 ephemeral keypair.
   Computes `Kyber_ct = encapsulate(initiator_pk)`, `X25519_ct = ECDH(...)`.
   Derives `session_key = HKDF(Kyber_ss || X25519_ss)`. Signs
   `session_key || Kyber_ct || X25519_ct` with Dilithium3. Sends
   `Kyber_ct || X25519_ct || Dilithium3_sig(...)`.
3. **Initiator**: decapsulates `Kyber_ct`, computes `X25519_ss`. Derives the
   same `session_key`. Verifies the responder's Dilithium3 signature.
4. Both parties now share `session_key` — a **post-quantum** session key.

### Step 3: Gossipsub integration

The `PqNoiseConfig` produces a `StreamMuxer` just like the classical Noise
config. Gossipsub runs on top unchanged — it encrypts payloads with the
session key derived from the PQ handshake.

```rust
// In rstn-p2p/src/lib.rs:
let pq_config = rstn_p2p::PqNoiseConfig::new(keypair);
let transport = libp2p::core::transport::MemoryTransport::new()
    .upgrade(libp2p::core::upgrade::Version::V1)
    .authenticate(pq_config)
    .multiplex(libp2p::yamux::Config::default());
```

### Step 4: Test vectors

The fork must pass the existing gossipsub conformance tests
(`tests/transport.rs`, `tests/gossipsub.rs`) with the PQ transport. The
`NoiseHandshake` in `rstn-crypto` already has test vectors for the hybrid
handshake — these are reused.

### Step 5: Upstream

Submit a PR to `rust-libp2p` with `PqNoiseConfig` behind a `pq` feature flag.
If merged, the fork is no longer needed. If not, maintain the fork as a
crate patch in `Cargo.toml`:

```toml
[patch.crates-io]
libp2p = { git = "https://github.com/rstn-network/rust-libp2p", branch = "pq-noise" }
```

---

## Current State (what is DONE)

| Component | Status |
|-----------|--------|
| `rstn-crypto::NoiseHandshake` (Kyber768 + X25519 + Dilithium3) | ✅ Implemented + tested |
| `rstn-core::pq_transport::PeerSession` (app-layer encryption) | ✅ Implemented + tested |
| `rstn-p2p::pq_wire::PqStream` (direct-stream PQ) | ✅ Implemented |
| `rstn-p2p::pq_broadcast` (gossipsub payload PQ seal) | ✅ Implemented + tested |
| `rstn-p2p` gossipsub `ValidationMode::Strict` + 1MB cap | ✅ Implemented |
| `rstn-p2p::pq_transport_upgrade::PqNoiseConfig` (transport-level PQ) | ✅ Implemented + tested (fork code) |
| Upstream PR: `libp2p::identity` Dilithium3 variant | ⬜ External (rust-libp2p PR) |

## What "broadcast PQ" means concretely

Today, gossipsub broadcasts blocks/votes to all peers over the **Noise
transport**. The app-layer `PeerSession` encrypts the *payload* before it
enters gossipsub — so the payload is PQ-confidential. But the **gossipsub
topic messages** (the envelope) travel over Noise. A future-quantum attacker
who breaks Noise could:

- **Decrypt** the gossipsub envelope → sees the app-layer ciphertext (still
  PQ-confidential — useless to them).
- **Inject** forged gossipsub messages → rejected by `ValidationMode::Strict`
  + `report_message_validation_result` (signature verification).

**Net risk today:** metadata leak (which peer sent what, when) + DoS surface
(Noise handshake amplification). The **payload is already PQ-confidential**.
The fork eliminates the metadata leak and the Noise DoS surface.

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Fork + PqNoiseConfig | 2 weeks | Transport-level PQ handshake |
| Gossipsub integration + tests | 1 week | Pass conformance suite |
| Upstream PR | 1 week | PR to rust-libp2p (or patch) |
| **Total** | **4 weeks** | Wire-level PQ broadcast |

This is the single remaining item for "100% PQ coverage" at the transport
level. Everything else (signatures, consensus votes, app-layer tunnel) is
already PQ.
