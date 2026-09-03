# RSTN — Threat Model for External Auditors

> **Purpose:** Companion to `CRYPTO_AUDIT_PACKAGE.md`. This is the structured
> threat model the auditors use to scope their review. Each threat is mapped
> to the asset, the attack surface, the existing mitigation, and the test that
> verifies it.

---

## 1. Assets

| Asset | Location | Why it matters |
|-------|----------|----------------|
| Validator private keys (Dilithium3) | `rstn-crypto` keygen | If stolen → forge any signature → double-spend, equivocate |
| Bridge committee keys | `rstn-bridge` threshold | If 1/3+ stolen → mint unbacked wBTC |
| Session keys (P2P) | `rstn-p2p` PQ session | If recovered → decrypt wire traffic |
| Forward-security epoch keys | `rstn-core/forward_security.rs` | If old key reused → long-range attack |
| Ledger master seed | `ledger-app` SE | If exported → steal all funds on device |

---

## 2. Threats — STRIDE-mapped

### 2.1 Spoofing

| Threat | Surface | Mitigation | Verify with |
|--------|---------|------------|--------------|
| Forged validator signature | consensus vote collection | Dilithium3 verify per vote | `consensus.rs` §3 (forged sig) |
| MITM on PQ handshake | `pq_transport_upgrade.rs` | Transcript signature must match advertised pubkey | `pq_stream_rejects_mitm` |
| PeerId spoofing | `libp2p_identity_pq.rs` | PeerId = identity multihash of Dilithium3 pubkey (collision-free) | audit §5.2 |

### 2.2 Tampering

| Threat | Surface | Mitigation | Verify with |
|--------|---------|------------|--------------|
| Block tampering | consensus finalization | BFT 2/3+ supermajority required | `consensus.rs` §1 (equivocation) |
| Phase confusion (COMMIT as PREPARE) | vote collection | Phase field checked | `consensus.rs` §2 |
| Bridge proof tampering | `spv.rs` LockProof::verify | Threshold 2/3 + amount binding | `protocol.rs` fuzz_lock_proof_verify |
| SPV Merkle forgery | `spv.rs` BitcoinSpvProof | Computed root must match claimed root | `protocol.rs` fuzz_spv_merkle_proof |
| Wire frame tampering | `pq_wire.rs` | Length-prefixed, max 1MB, nonce-monotonic | `protocol.rs` fuzz_pq_wire_frame |

### 2.3 Repudiation

| Threat | Surface | Mitigation | Verify with |
|--------|---------|------------|--------------|
| Deny signing (equivocation) | slashing | Double-sign detection → slash | `consensus.rs` §1 |
| Replay old signature | mempool | Nonce in canonical_encode | audit §2.2 (replay) |

### 2.4 Information disclosure

| Threat | Surface | Mitigation | Verify with |
|--------|---------|------------|--------------|
| Secret key side-channel | Dilithium3 signing loop | `zeroize` on drop; no `unsafe` in call sites | audit §2.1 |
| Kyber decryption oracle | CCA transform (FO) | Fujisaki-Okamoto correctly applied | audit §2.1 |
| SPHINCS+ state reuse | RNG path | Randomizer never reused per key | audit §2.1 |
| Wire traffic decryption | XOR keystream | 8-byte monotonic nonce, 2^64 space | audit §5.3 |

### 2.5 Denial of service

| Threat | Surface | Mitigation | Verify with |
|--------|---------|------------|--------------|
| VM OOM | memory cap | 1MB max | `vm.rs` |
| VM infinite loop | gas | Out-of-gas termination | `vm.rs` §1 |
| Gas bypass | gas accounting | gas_used ≤ gas_limit assertion | `vm.rs` |
| Stack underflow | VM stack | Bounds check → VmError | `vm.rs` §3 |
| Oversized wire frame | `pq_wire.rs` | 1MB max → FrameTooLarge | `protocol.rs` fuzz_pq_wire_frame |
| Timejacking | MTP validation | MTP-11 median (≥11 blocks) | `lib.rs` validate_timestamp |

### 2.6 Elevation of privilege

| Threat | Surface | Mitigation | Verify with |
|--------|---------|------------|--------------|
| Admin key abuse | governance | No admin key exists | `NO_ADMIN_KEY.md` |
| Emergency key abuse | quantum_alarm | Emergency is irreversible on-chain (no revert method) | `quantum_alarm.rs` §295 |
| Threshold bypass | bridge committee | 2/3+ required, no fewer | `protocol.rs` fuzz_lock_proof_verify |
| Validator dominance | staking | 22% dominance cap | `protocolMonetary.ts` |

---

## 3. Out of scope (honest)

| Item | Why out of scope | Where it's tracked |
|------|------------------|--------------------|
| libp2p transport internals | Fuzzed upstream by libp2p | `FUZZING.md` |
| Full BFT with network | Covered by `rstn-core/tests/adversarial.rs` | `FUZZING.md` |
| Ledger SE hardware | Requires physical device + Ledger HQ audit | `LEDGER_BOLOS_FIRMWARE.md` |
| Formal verification (Coq/Lean) | Research, not pre-mainnet | `TIER3_STATUS.md` |
| DAS distributed sampling | Research, not pre-mainnet | `TIER3_STATUS.md` |

---

## 4. Auditor deliverables

1. Confirm each threat in §2 has a working mitigation (run the test).
2. Rate any gap as Critical / High / Medium / Low / Informational.
3. Provide reproduction steps for any finding.
4. Re-test after remediation.
5. Final attestation: PQ stack is safe for mainnet, or list of blockers.
