# RSTN Bridge — Architectural Decision

> **Version:** 1.0
> **Decision:** Pure decentralized bridge (protocol-pure), no central operator
> **Status:** Approved — implemented in `rstn-bridge` crate

---

## Summary

The RSTN bridge is a **pure decentralized protocol**, not a service operated
by an entity. This decision drastically reduces the legal risk of money
transmitter licensing and AML/KYC compliance.

---

## Why this decision

### The problem

A cross-chain bridge transfers real value (BTC, ETH) between blockchains.
Under U.S. federal law (BSA/FinCEN), this qualifies as **money transmission**:

- Requires a money transmitter license in 49 of 50 states
- Requires an AML program with KYC
- Requires SAR/CTR reporting
- Cost: $5M-$15M + 12-24 months

### The solution: Pure protocol

If the bridge is **code executed by validators** (not a service operated by
an entity), the legal risk changes fundamentally:

| Aspect | Operated bridge | Pure protocol bridge |
|---------|---------------|----------------------|
| Who custodies | The operating entity | The validator set (2/3+ BFT) |
| Who transmits | The entity | The protocol (neutral code) |
| Money transmitter? | Yes | Probably NO (see Thorchain) |
| KYC required? | Yes | Not at the protocol level |
| State license? | Yes | Probably NO |
| Legal risk | HIGH | MEDIUM-LOW |

### Precedent: Thorchain

Thorchain (RUNE) operates a decentralized BTC<->ETH<->BNB bridge without KYC.
Its legal model is based on:

1. The protocol is neutral code, not an entity
2. Validators execute code, they do not custody funds
3. There is no company that "operates" the bridge
4. The SEC has not taken action against Thorchain (as of 2026)

Resistance follows this model, improving it with:
- **Post-quantum signatures** (Dilithium3 instead of ECDSA threshold)
- **On-chain Proof of Reserves** (invariant `locked == minted - burned`)
- **Automatic slashing** for fraudulent validators
- **Emergency pause** if the invariant is violated

---

## How the protocol works

### Lock-and-Mint (Source -> Resistance)

```text
1. User locks BTC in a vault address (P2WSH multisig 2/3+)
2. User sends a lock proof to Resistance via a bridge tx
3. Validators verify the lock proof (SPV or committee attestation)
4. 2/3+ validators sign a mint authorization
5. Resistance VM mints wBTC to the user
6. Proof of Reserves: locked += amount, minted += amount
7. Invariant verified: locked == minted - burned
```

### Burn-and-Release (Resistance -> Source)

```text
1. User burns wBTC on Resistance via a bridge tx
2. Validators verify the burn (on-chain, deterministic)
3. 2/3+ validators sign a release authorization
4. Vault on source chain releases BTC to the user
5. Proof of Reserves: locked -= amount, burned += amount
6. Invariant verified: locked == minted - burned
```

### Security

- **No single point of failure**: 2/3+ BFT threshold for every operation
- **Replay prevention**: each source txid can only be claimed once
- **Proof of Reserves**: on-chain invariant verifiable by anyone
- **Slashing**: validators that sign fraudulently are slashed
- **Emergency pause**: if the invariant is violated, the bridge pauses

---

## Compliance: what stays out of the protocol

The protocol is **neutral**. It does not implement KYC because:

1. **The protocol is not an entity** — it is code. It cannot have an AML program.
2. **Validators are not VASPs** — they execute code, they do not custody user funds.
3. **The wallet is not a VASP** — it is non-custodial, the user holds their keys.

### Compliance responsibility

| Component | Responsible | Compliance |
|-----------|------------|------------|
| Protocol (bridge code) | No one — it is neutral code | N/A |
| Validators | Each individual operator | Depends on jurisdiction |
| Chrome wallet | Non-custodial — not a VASP | No KYC required |
| Frontend/dApp | The frontend operator | May implement geo-block |
| Integrated exchange | The exchange | Full KYC/AML |

### Recommendation for mainnet

1. **Do not implement KYC in the protocol** — keeps the design neutral
2. **Optional geo-block on the frontend** — the frontend operator can block jurisdictions
3. **Public Proof of Reserves** — total transparency for regulators
4. **Formal legal opinion** before mainnet with the bridge active

---

## Implementation

The `rstn-bridge` crate implements:

- `BridgeState` — global bridge state (reserves, pending operations)
- `BridgeOperation` — lock-mint or burn-release operation
- `ProofOfReserves` — per-chain reserves with verifiable invariant
- `BridgeSignature` — Dilithium3 signature from a validator authorizing an operation
- Unit tests: replay prevention, threshold, invariant, duplicate sigs

### Integration with the node

The bridge integrates as a **built-in contract** in the Resistance VM:

```rust
// In rstn-vm, the bridge is a predeployed contract at address 0xbridge
// Bridge txs use tx_type = Contract with an encoded payload
// The VM calls BridgeState::execute_operation() when processing the tx
```

---

## Residual risk

This decision **reduces** risk but does not eliminate it:

1. **FinCEN may claim jurisdiction** — arguing "control de facto"
2. **Individual states may interpret differently** — especially NY (BitLicense)
3. **MiCA in the EU may require compliance** — for VASPs that interact with the bridge
4. **A formal legal opinion is necessary** before mainnet

### Mitigations

- Document that the bridge is a pure protocol (this document)
- Public and auditable Proof of Reserves
- Do not operate the frontend from the U.S. initially
- Obtain a FinCEN No-Action Letter before activating the bridge on mainnet

---

## Conclusion

**Decision: Pure decentralized bridge, no KYC at the protocol level.**

- Implemented in the `rstn-bridge` crate
- Reduces money transmitter risk
- Keeps the protocol neutral
- Compliance is the frontend's responsibility, not the protocol's
- Formal legal opinion required before mainnet
