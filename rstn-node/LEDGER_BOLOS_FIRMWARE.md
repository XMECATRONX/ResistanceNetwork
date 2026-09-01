# RSTN Ledger App — BOLOS Firmware Design Spec

> Status: **Design specification** — host-side library implemented (`rstn-ledger`);
> on-device firmware is the pre-mainnet deliverable.
> Target: Ledger Nano S Plus / Nano X (BOLOS, STM32 + ST33 secure element)

---

## 1. Objective

A Ledger BOLOS app that stores a Dilithium3 (FIPS 204 / ML-DSA-65) master key
in the secure element, derives RSTN addresses, and signs transactions on-device
without ever exporting the private key. This is the **hardware custody** layer
of the "quantum refuge" — large holders store their keys in an HSM, not a
browser extension.

---

## 2. The Hybrid SE Problem (Honest Scope)

Current Ledger secure elements (ST33J2M1 on Nano S Plus, ST33K1M5 on Nano X)
have ~256KB flash and ~64KB RAM. Dilithium3 (ML-DSA-65) key generation requires
**NTT over 256-coefficient polynomials** — computationally feasible on the SE
but slow (~3–8s per signature). The full in-SE signing path is:

```
keygen:  ~15s (acceptable — one-time)
sign:    ~3–8s per tx (PAINFUL — 0.4s finality × 20 txs = UX killer)
verify:  ~2s (done on host, not SE)
```

### Design decision: hybrid attestation

The SE holds the **master seed** (BIP-39-style) and derives a Dilithium3
keypair. The SE exports the public key freely. For signing, the SE derives a
**session secret** (Keccak-512(seed || nonce)) and attests it with a
Dilithium3 signature. The host performs the CPU-intensive lattice signing
using the session-attested key. The host never sees the master seed.

**Security properties:**
1. The master seed never leaves the SE → a compromised host cannot extract it.
2. Each signing session is bound to a SE-attested nonce → the host cannot
   reuse a session key to sign without a fresh SE attestation.
3. The signature is verifiable against the SE's public key → a host that
   substitutes a different key produces a non-verifying signature.

**Future hardware:** a Ledger revision with a PQ coprocessor (or a larger SE
like the ST33K1M5 with hardware NTT) moves the full signing in-SE, eliminating
the host-side lattice computation entirely. The host-side `rstn-ledger` crate
already supports a future `InSeTransport` that returns signatures from the SE
directly — no host-side key handling.

---

## 3. APDU Protocol

| CLA | INS  | P1   | P2   | Lc   | Data                 | Le    |
|-----|------|------|------|------|----------------------|-------|
| E0  | 0x01 | 0x00 | 0x00 | 0    | —                    | 1952  |
| E0  | 0x02 | 0x00 | 0x00 | 32   | message_hash         | 3309  |
| E0  | 0x03 | 0x00 | 0x00 | 0    | —                    | 4     |
| E0  | 0x04 | 0x00 | 0x00 | 0    | —                    | 32    |
| E0  | 0x05 | 0x00 | 0x00 | 0    | —                    | 64    |

- **0x01 GET_PUBKEY**: returns the 1,952-byte Dilithium3 public key.
- **0x02 SIGN**: signs a 32-byte message hash, returns the 3,309-byte
  signature. **User must confirm on-device** (display the hash, press both
  buttons).
- **0x03 GET_VERSION**: returns app version (4 bytes: major.minor.patch.reserved).
- **0x04 GET_SESSION_NONCE**: returns a 32-byte session nonce (used for
  hybrid attestation — see §2).
- **0x05 GET_ATTESTATION**: returns a 64-byte Keccak-512 attestation over
  the session nonce, proving the SE minted it.

### Status words

| SW    | Meaning                          |
|-------|----------------------------------|
| 9000  | OK                               |
| 6985  | User rejected (declined on-device) |
| 6983  | Device locked — enter PIN        |
| 6B00  | Wrong parameters                 |
| 6A80  | Incorrect data / malformed       |
| 6D00  | INS not supported                |
| 6E00  | CLA not supported                |

---

## 4. On-Device Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  Ledger Nano (ST33 SE)                                           │
│                                                                  │
│  1. On first launch: generate master seed (256-bit) in SE.       │
│  2. Derive Dilithium3 keypair from seed (Keccak-512(seed)).       │
│  3. Display address (first 20 bytes of Keccak-512(pubkey)).       │
│                                                                  │
│  4. On SIGN APDU:                                                 │
│     a. Display "Sign RSTN tx?" + hash (16 hex chars).            │
│     b. Wait for both-button confirmation.                       │
│     c. [Hybrid] Derive session key, sign hash, return signature. │
│     d. [Future in-SE] Sign hash in SE, return signature.         │
│  5. Reject after 30s timeout → SW 6985.                          │
└──────────────────────────────────────────────────────────────────┘
         │ APDU (USB HID / BLE)
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Host (wallet / node) — rstn-ledger crate                         │
│                                                                  │
│  LedgerDevice::get_public_key()  → cache pubkey                  │
│  LedgerDevice::sign(hash)         → user confirms → signature    │
│  LedgerDevice::get_address()      → Keccak-512(pubkey)[..20]      │
│  verify_signature(pubkey, hash, sig) → host verifies (not SE)    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Security Properties

1. **Key isolation**: the master seed is generated in-SE and never exported.
   The APDU protocol has no "export key" INS.
2. **User confirmation**: every SIGN requires a physical button press on the
   device. A compromised host cannot sign without the user present.
3. **Address binding**: the RSTN address is `Keccak-512(pubkey)[0..20]`,
   matching the node's `derive_address()`. The device displays this address
   on first launch so the user can verify it matches their wallet.
4. **Replay protection**: each SIGN APDU signs a 32-byte hash that includes
   the transaction's nonce (from `canonical_encode`). A replayed signature
   has a stale nonce and is rejected by the node's mempool.
5. **Blind signing risk**: the SE signs a *hash*, not the full transaction.
   The host must display enough context (amount, recipient, type) for the
   user to know what they are signing. A future firmware revision parses the
   transaction on-device and displays the decoded fields — eliminating blind
   signing.

---

## 6. Build & Deploy

### Toolchain

```bash
# Ledger BOLOS SDK
docker pull ghcr.io/ledger-ledger/ledger-apps/ledger-app-builder:latest

# Rust target (ARM Cortex-M4 for ST33)
rustup target add thumbvm
cargo install cargo-ledger
```

### Build the firmware

```bash
cd rstn-node/ledger-app
cargo ledger build --target thumbvm --manifest-path Cargo.toml
# Produces app.elf → load onto device:
cargo ledger load
```

### App manifest (manifest.json)

```json
{
  "name": "RSTN",
  "version": "1.0.0",
  "icon": "rstn_16px.gif",
  "apiLevel": "1",
  "dataSize": 4096,
  "parameters": ["--auto-display-address"]
}
```

---

## 7. Pre-Mainnet Deliverables

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Host-side `rstn-ledger` crate (APDU + transport + mock) | ✅ Done |
| 2 | APDU protocol spec (INS 0x01–0x05) | ✅ Done |
| 3 | On-device APDU dispatcher + keygen + address derivation | ✅ Scaffold (`ledger-app/src/lib.rs`) |
| 4 | On-device SIGN with user confirmation | ✅ Scaffold (handler + confirmation flow) |
| 5 | Hybrid attestation (session nonce + attestation) | ✅ Scaffold (INS 0x04/0x05) |
| 6 | Transaction decoding + field display (anti-blind-sign) | ⬜ Firmware (BOLOS UI) |
| 7 | BOLOS `main.rs` + SDK glue (screen, buttons, USB HID io loop) | ⬜ Firmware (BOLOS toolchain) |
| 8 | Ledger SDK audit (BOLOS review by Ledger's security team) | ⬜ External (Ledger HQ) |
| 9 | End-to-end test: Nano S Plus + Nano X sign a real testnet tx | ⬜ External (device) |

---

## 8. Honest Limitations

1. **Hybrid signing**: the current ST33 cannot sign Dilithium3 fully in-SE at
   production speed. The host performs the lattice computation with a
   SE-attested session key. A future hardware revision (or a PQ coprocessor
   add-on) eliminates this. This is the same trade-off Ledger faces for any
   PQ scheme today.
2. **Blind signing**: the SE signs a 32-byte hash. The host is trusted to
   display the correct transaction context. Mitigation: future firmware parses
   the tx on-device.
3. **No BLE signing on Nano S** (no Bluetooth). Nano X supports BLE.
4. **Not a Trezor / Keystone spec**: this is Ledger-specific. Other HSMs
   require separate integrations (see `HSM_INTEGRATION.md` — future).
