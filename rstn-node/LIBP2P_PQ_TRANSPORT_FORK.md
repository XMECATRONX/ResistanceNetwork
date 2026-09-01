# libp2p PQ Transport Fork — Implementation Status

> Status: **Fork code written + tested.** The remaining work is an upstream PR
> to `rust-libp2p` to extend `libp2p::identity` with a native Dilithium3 key
> variant. The transport upgrade itself is implemented and unit-tested in
> `rstn-p2p::pq_transport_upgrade`.

---

## What was the gap

libp2p's transport uses the **Noise** protocol (X25519 ECDH) for the
wire-level secure channel. X25519 is classical — a quantum adversary with
Shor's algorithm can break the ECDH and decrypt transport traffic.

Before this work, three layers of PQ protection already existed:

1. `rstn-crypto::NoiseHandshake` — the PQ hybrid handshake (Kyber768 + X25519
   + Dilithium3 + HKDF-SHA3-512), implemented and tested.
2. `rstn-core::pq_transport::PeerSession` — app-layer encryption of consensus
   payloads before they enter gossipsub.
3. `rstn-p2p::pq_broadcast` — every gossipsub broadcast sealed under a
   committee group key derived from the validator set's Dilithium3 pubkeys.

What was **missing** was replacing Noise at the *transport* level so the
transport envelope itself is post-quantum — closing the "100% PQ coverage"
claim at the wire.

---

## What is now implemented

### `rstn-p2p::pq_transport_upgrade::PqNoiseConfig`

A drop-in `ConnectionUpgrade` that runs the PQ hybrid handshake as the
transport security layer:

- Implements `libp2p::core::upgrade::{InboundConnectionUpgrade,
  OutboundConnectionUpgrade, UpgradeInfo}`.
- `upgrade_inbound` / `upgrade_outbound` run the tested `NoiseHandshake`,
  derive a 32-byte PQ session key, and return `(PeerId, PqNoiseStream)`.
- The `PeerId` is derived from the remote Dilithium3 public key via an
  **identity multihash** (`Multihash::wrap(Code::Identity, pubkey)`), so the
  upgrade yields a valid `PeerId` without extending
  `libp2p::identity::Keypair` with a new key variant.
- `PqNoiseStream<S>` implements `AsyncRead + AsyncWrite` so libp2p's yamux
  muxer runs on top exactly as it does on a Noise stream.

### Wire format

```text
  [4-byte big-endian length][8-byte nonce][XOR-keystream ciphertext]
```

Identical to `pq_wire::PqStream`. Frame size capped at 1 MiB (matches the
gossipsub `max_transmit_size`).

### Tests (off-device)

- `peer_id_from_dilithium_pubkey_is_valid` — identity-multihash yields a
  valid PeerId.
- `pq_stream_async_roundtrip` — initiator + responder handshake, then
  bidirectional encrypted exchange.
- `frame_size_limit_enforced_async` — oversized frames rejected.

---

## What remains (external / upstream)

The transport upgrade is usable today via the identity-multihash bridge. The
single remaining piece is extending `libp2p::identity` with a native
`Dilithium3` key variant so that:

```rust
SwarmBuilder::with_existing_identity(dilithium_keypair)
    .with_tcp(tcp::Config::default(), PqNoiseConfig::new, yamux::Config::default)
```

binds the transport identity to the libp2p identity model end-to-end. This is
a PR to `rust-libp2p` (add a `Keypair::Dilithium3` variant + the corresponding
`PublicKey` / `PeerId` derivation), not a bug in the RSTN protocol.

Once merged, `rstn-p2p::create_swarm` swaps `noise::Config::new` for
`PqNoiseConfig::new` and the entire transport becomes post-quantum.

---

## Integration point

In `rstn-p2p/src/lib.rs`, `create_swarm` currently uses:

```rust
.with_tcp(tcp::Config::default(), noise::Config::new, libp2p::yamux::Config::default)
```

The fork swaps `noise::Config::new` for `PqNoiseConfig::new(identity)` once
the upstream identity variant lands. No other call-site changes are needed —
`PqNoiseConfig` is a drop-in `ConnectionUpgrade`.
