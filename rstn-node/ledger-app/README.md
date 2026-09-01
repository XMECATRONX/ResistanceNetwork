# RSTN Ledger App — On-Device BOLOS Firmware

> Status: **Firmware scaffold** — the APDU handler, key management, and
> on-screen confirmation flow are implemented and unit-tested off-device.
> The final on-device binary is compiled with the Ledger BOLOS SDK +
> `cargo-ledger` against the STM32/ST33 secure element target.

This is the **on-device** half of the RSTN Ledger integration. The
**host-side** library lives in `rstn-node/crates/rstn-ledger` (APDU protocol
+ transport trait + mock signer). This crate is the firmware that runs inside
the Ledger secure element.

## What it does

1. **Key custody** — generates/derives a Dilithium3 (FIPS 204 / ML-DSA-65)
   master key in the secure element. The private key **never leaves the SE**;
   there is no "export key" APDU.
2. **Address derivation** — exposes the 1952-byte public key so the host can
   derive the RSTN address (`Keccak-512(pubkey)[..20]`, matching the node).
3. **On-device signing** — signs 32-byte transaction hashes with user
   confirmation (display + both-button press). Returns the 3309-byte signature.
4. **Hybrid attestation** — mints a SE-attested session nonce so the host can
   perform the CPU-intensive lattice signing with a key bound to a fresh SE
   secret (see `LEDGER_BOLOS_FIRMWARE.md` §2 for the honest hardware limit).

## APDU surface

| CLA  | INS  | Description |
|------|------|-------------|
| 0xE0 | 0x01 | GET_PUBKEY → 1952-byte Dilithium3 public key |
| 0xE0 | 0x02 | SIGN(32-byte hash) → 3309-byte signature (user confirms) |
| 0xE0 | 0x03 | GET_VERSION → 4-byte version |
| 0xE0 | 0x04 | GET_SESSION_NONCE → 32-byte nonce (hybrid attestation) |
| 0xE0 | 0x05 | GET_ATTESTATION → 64-byte Keccak-512 attestation |

Status words match the host crate (`0x9000` OK, `0x6985` user rejected,
`0x6983` locked, `0x6B00` wrong params, `0x6A80` bad data, `0x6D00` bad INS,
`0x6E00` bad CLA).

## Build (BOLOS toolchain)

```bash
# Pull the official Ledger app builder image
docker pull ghcr.io/ledger-ledger/ledger-apps/ledger-app-builder:latest

# Build the firmware for the SE target
docker run --rm -v $(pwd):/app -w /app \
  ghcr.io/ledger-ledger/ledger-apps/ledger-app-builder:latest \
  cargo ledger build --target thumbv7m-none-eabi

# Load onto a connected device
cargo ledger load
```

The `main.rs` entrypoint + BOLOS SDK glue (screen rendering, button polling,
USB HID APDU io loop) is added under the BOLOS toolchain and is not compiled
by the node workspace. The `lib.rs` APDU dispatcher is the shared logic
tested off-device.

## Honest limitations

- **Hybrid signing**: the current ST33 SE cannot run full Dilithium3 signing
  in-SE at production speed. The `hybrid-attestation` feature delegates the
  lattice signing to the host with a SE-attested session key. A future SE
  revision with a PQ coprocessor moves signing fully in-SE — the APDU surface
  is unchanged.
- **Blind signing**: the SE signs a 32-byte hash. The host is trusted to
  display the transaction context (amount, recipient, type). A future firmware
  revision parses the tx on-device to eliminate blind signing.
- **Ledger review**: shipping on the Ledger Live app store requires a security
  review + approval by Ledger HQ (BOLOS DAO review). This is a human/external
  step, not code.
