# PROTOCOL_SPEC.md — Resistance Network (RSTN) Canonical Specification

> **STATUS:** SCOPE-FROZEN. This is the single source of truth.
> **RULE:** If any other document (README, WHITEPAPER, VERIFICATION.md,
> LEGAL_AUDIT.md, SECURITY_AUDIT_FULL.md, frontend copy) contradicts this
> file, **this file wins** and the other document has a bug.
> **PURPOSE:** Kill all internal contradictions. One spec → many derived docs.
> **DATE:** 2026-09-03 · **VERSION:** 1.0 (freeze)

---

## 0. Definition of Done (global)

The protocol is "done" when ALL of §11 (Pre-Mainnet Checklist) is ✅.
Mainnet is an operational act, not an engineering one. Until §11 is 100%,
no mainnet. No new features. Only closure of existing items.

---

## 1. What Resistance IS

A sovereign Layer 1 blockchain, written in Rust, with:

| Layer | Crate | Status |
|-------|-------|--------|
| Crypto (PQ) | `rstn-crypto` | ✅ Code-complete |
| Consensus (BFT+VRF) | `rstn-core` | ✅ Code-complete |
| Storage (SMT) | `rstn-storage` | ✅ Code-complete |
| VM (EVM-subset) | `rstn-vm` | ✅ Code-complete |
| P2P (libp2p) | `rstn-p2p` | ✅ Code-complete |
| RPC | `rstn-rpc` | ✅ Code-complete |
| Bridge | `rstn-bridge` | ✅ Code-complete |
| Node runner | `rstn-node` | ✅ Code-complete |

**It is NOT (do not claim otherwise):**
- NOT a "production-grade L1 ready for real money" — it is pre-testnet engineering.
- NOT "100% post-quantum at transport layer" — base transport is Noise/X25519.
- NOT "EVM fully compatible" — it is an EVM-subset with PQ extensions.
- NOT "250K TPS measured" — that is a target, not a benchmark.

---

## 2. Cryptography (canonical claims)

| Primitive | Standard | Status | Claim allowed |
|-----------|----------|--------|---------------|
| Dilithium3 (ML-DSA-65) | FIPS 204 | ✅ Implemented, wired to txs + votes | "PQ signatures" ✅ |
| Kyber768 (ML-KEM-768) | FIPS 203 | ✅ Implemented (app-layer transport) | "PQ KEM" ✅ |
| SPHINCS+ (SLH-DSA) | FIPS 205 | ✅ Implemented (fallback) | "hash-based fallback" ✅ |
| Keccak-512 (SHA-3) | FIPS 202 | ✅ Implemented | "256-bit PQ hash" ✅ |
| Ed25519 | RFC 8032 | ✅ Implemented (hybrid, OPTIONAL) | "hybrid co-signature (optional)" ✅ |
| PQ-VRF | Module-LWE | ✅ Implemented + WIRED to consensus | "VRF leader election" ✅ |
| Forward security | per-epoch rotation | ✅ Implemented + wired | "forward security" ✅ |
| Quantum Alarm | emergency rotation | ✅ Implemented + wired | "quantum alarm" ✅ |
| Stealth addresses | Kyber768 KEM | ✅ Primitive (UTXO integration = roadmap) | "stealth primitive" 🚧 |
| Account abstraction | multi-sig/social-recovery | ✅ Primitive (VM integration = roadmap) | "AA primitive" 🚧 |

### 2.1 Transport PQ status (PRECISE)

- **Base transport:** libp2p Noise (X25519) — **classical, NOT PQ.**
- **App-layer PQ:** `pq_wire` (direct streams), `pq_broadcast` (gossipsub
  payload sealing), `pq_session` (authenticated sessions) — **PQ, implemented.**
- **Full PQ transport:** requires libp2p fork (PR upstream pending) — **roadmap.**

**Allowed claim:** "PQ signatures and consensus; PQ confidentiality at
application layer; full PQ transport requires libp2p fork (roadmap)."

**FORBIDDEN claim:** "100% post-quantum transport" / "every layer PQ."

### 2.2 Hybrid signatures

- Dilithium3 is **mandatory** for every tx and BFT vote.
- Ed25519 co-signature is **optional** today (backward compatible).
- Making Ed25519 mandatory is a **production policy parameter**, not a code gap.

---

## 3. Consensus (canonical claims)

| Feature | Status | Claim allowed |
|---------|--------|---------------|
| BFT 2-round (PREPARE→COMMIT) | ✅ | "deterministic finality" ✅ |
| Threshold 2n/3+1 | ✅ | "BFT supermajority" ✅ |
| Leader election by VRF | ✅ (chain-VRF, Algorand-style) | "VRF leader election" ✅ |
| Slashing (equivocation) | ✅ | "slashing" ✅ |
| Forward security | ✅ wired | "forward security" ✅ |
| View-change timeout | ✅ | "view-change" ✅ |
| Commit certificates | ✅ | "finality certificates" ✅ |
| Sync + rejoin | ✅ (manual test) | "fault tolerance" ✅ |

**NOT yet proven (roadmap):** formal BFT safety proof under all Byzantine
scenarios (partitions, out-of-order, multi-equivocation, view changes).
Requires adversarial testnet + external consensus audit.

---

## 4. VM (canonical claims)

**Allowed claim:** "RSTN-VM implements an EVM-subset (opcodes 0x00–0xEF +
PUSH/DUP/SWAP/LOG) with PQ extensions."

**FORBIDDEN claim:** "Full EVM compatibility" / "MetaMask/Hardhat/Foundry
drop-in compatible."

| Feature | Status |
|---------|--------|
| 33+ opcodes | ✅ |
| Gas, memory, stack | ✅ |
| SSTORE journal (rollback on REVERT) | ✅ (audit-closed) |
| CREATE real nonce | ✅ (audit-closed) |
| pop_addr right-aligned | ✅ (audit-closed) |
| EIP-150 gas forwarding | ✅ (semantics need proof) |
| SELFDESTRUCT | 🚧 (no balance transfer / no delete) |
| Move-style resources | ✅ (Rust-level, not Move bytecode verifier) |
| Formal verification | 🚧 (6 invariants; Coq/Lean = roadmap) |

---

## 5. Tokenomics (CANONICAL — Satoshi model)

**Single source of truth. README, WHITEPAPER, LEGAL_AUDIT, frontend MUST match this.**

```
Supply: 1,000,000,000 RSTN (hard cap, fixed genesis, zero minting function)

Distribution:
  95% — Proof of Participation (950M, staking rewards, halving every 4 years)
   5% — Testnet Airdrop (50M, bootstrap to verified node operators)

  ZERO team allocation.
  ZERO ecosystem fund.
  ZERO genesis treasury.
  The team earns RSTN ONLY by operating the genesis validator (work, not pre-allocation).

Fee mechanics:
  50% gas burned (EIP-1559, base fee floored at 1 gwei)
  30% to block validator
  20% to on-chain security reserve (born from usage, NOT a genesis pre-allocation)

Bridge revenue (60/30/10):
  60% — Buyback & Burn of RSTN
  30% — Staker rewards
  10% — Security reserve (bug bounty, incident response)

Zero ICO. Zero pre-sale. Zero VC. Fair launch. No capturable treasury in block 0.
```

### 5.1 Terminology (precise)

- "Zero minting" → **"Fixed genesis supply with protocol-controlled emission pool."**
  (The 950M exists from genesis and is released by protocol rules — there is no
  `mint()` function, but there IS a pre-funded reserve that emits.)
- "Deflationary" → **"Scarcity mechanism"** (do not imply price appreciation).
- "MEV impossible" → **"MEV structurally mitigated via encrypted ordering;
  production-grade DKG is roadmap."**
- "1 RSTN = 1 vote" → **"Quadratic voting credits gated by identity/Sybil rules."**

### 5.2 Validator economics

- Min stake: 32,000 RSTN
- Delegation: from 1 RSTN
- Early bonus: first 100 → 2x, 101–500 → 1.5x, 501–1000 → 1.25x
- APR rule: validator APR ≥ 2× LP APR (design intent, not guarantee)

### 5.3 Concentration risk

"No team allocation" ≠ "no team concentration." The team can operate early
validators and earn from the 950M pool. Concentration must be measured by:
tokens earned, stake controlled, validator count, delegated stake, governance power.

---

## 6. Bridge (canonical claims)

| Feature | Status |
|---------|--------|
| Lock-and-Mint / Burn-and-Release | ✅ |
| SPV verification (BTC double-SHA256, ETH Keccak-256) | ✅ |
| Header store (canonical chain) | ✅ |
| Wrapped balances accounting | ✅ (audit-closed) |
| Threshold ECDSA (100 signers, 51/100) | ✅ (design) |
| Hard-disabled in production without SPV | ✅ |

**Allowed claim:** "RSTN's native consensus/signature layer is post-quantum;
bridged Bitcoin custody remains dependent on Bitcoin's classical cryptography (ECDSA)."

**FORBIDDEN:** "Post-quantum bridge" / "PQ bridge custody."

**Status:** Bridge is a **prototype/architecture**. NOT for real capital until:
external bridge audit + signer committee legal structure + custody insurance.

---

## 7. Sharding & Throughput (canonical claims)

| Claim | Status |
|-------|--------|
| 64 shards | 🚧 (skeleton + dynamic resize, not 64 parallel running) |
| 250,000 TPS | 🛣️ **TARGET, not measured.** Never claim as fact. |
| 0.4s finality | 🚧 (ideal conditions; needs p50/p95/p99 proof) |
| Cross-shard lock-and-commit | ✅ (design) |
| DAS (Reed-Solomon + fraud proofs) | 🚧 (primitives; full integration = roadmap) |

---

## 8. Security posture (honest)

- Internal static review: ✅ (NOT a formal crypto audit)
- Fuzz targets: ✅ written (NOT run 24h+ in CI)
- 15 attack vectors: mitigated in code (some full runtime, some primitives)
- No-admin-key: design intent (must prove via CI grep + verify no mint function)
- Circuit breakers: ✅ (must document trigger/scope/timelock/recovery)

**FORBIDDEN:** "Professionally audited" / "audited and secure."
**ALLOWED:** "Internal static security review + automated testing completed;
external audit pending."

---

## 9. Legal posture (honest)

- Token: fair launch, no sale, no team allocation → reduces Howey risk (does NOT eliminate)
- Bridge: highest legal risk (money transmitter / AML / custody)
- Wallet: non-custodial (lowest risk)
- PQC: excellent NIST alignment (lowest risk)
- Jurisdiction: undecided (recommend Switzerland/Singapore foundation)

**FORBIDDEN:** "RSTN is legally a utility token."
**ALLOWED:** "Designed as a utility token; formal legal opinion pending."

---

## 10. What is OUT of scope for closure (archived / post-mainnet)

| Item | Decision |
|------|----------|
| Move bytecode verifier | Post-mainnet |
| Mixnet / directory authority (full) | Post-mainnet |
| Coq/Lean mechanized proofs | Post-mainnet |
| 250K TPS as production claim | Out — target only |
| Ledger App Store | External — does not block |
| libp2p upstream merge | Mitigated via declaration + app-layer PQ |

---

## 11. Pre-Mainnet Checklist (Definition of Done)

### Code / Docs (this repo)
- [x] Scope frozen (this document)
- [x] Single source of truth (PROTOCOL_SPEC.md)
- [x] README/Whitepaper/frontend aligned to code
- [x] Hybrid signatures (Dilithium3 mandatory, Ed25519 optional)
- [x] VRF wired to leader election
- [x] Domain separation in signatures
- [x] Forward security wired
- [x] Transport PQ status declared precisely
- [x] Stealth/QA/AA: primitives or archived (no false claim)
- [x] VM journal rollback, CREATE nonce, pop_addr
- [x] Tokenomics unified (Satoshi 95/5)
- [ ] CI green (build + test --workspace) — requires local Rust toolchain
- [ ] Fuzz 24h+ no criticals — requires self-hosted runner
- [ ] Bridge adversarial + SPV in production path — code ready, needs run
- [ ] No-admin-key verifiable in CI — script needed

### Engineering (external, code)
- [ ] libp2p fork for PQ gossipsub wire-level (~4 weeks)
- [ ] DKG real for threshold mempool (today: deterministic PRNG)
- [ ] Ledger firmware on-device (BOLOS SDK + Ledger HQ approval)
- [ ] Fuzzing 24h+ extended runs in CI

### External / human / operational (BLOCKS mainnet)
- [ ] External cryptographic audit (Trail of Bits / NCC / Quarkslab)
- [ ] External bridge audit
- [ ] External consensus audit
- [ ] External VM/EVM audit
- [ ] Legal foundation registered (Switzerland / Singapore)
- [ ] Token legal opinion (crypto lawyer)
- [ ] Bridge AML/compliance + signer committee structure
- [ ] Bug bounty active (Immunefi)
- [ ] Public testnet ≥ 30 days stable, 16+ independent validators
- [ ] Reproducible mainnet genesis + confirmed validators
- [ ] Pre-mainnet checklist signed off

**When this list is 100% ✅, the project is done. Mainnet is deployment.**

---

## 12. Execution order (mandatory sequence)

```
A (Truth/Freeze) → B (Crypto prod) → C (Stability) → D (Product) → E (Audits/Legal) → F (Public testnet / pre-mainnet)
```

- Block A: ✅ DONE (this document + VERIFICATION.md + README alignment)
- Block B: ✅ Code done; external crypto audit = Block E
- Block C: 🚧 CI + fuzz + adversarial testnet (needs runner + multi-node run)
- Block D: 🚧 Explorer + wallet + faucet + node operator docs (frontend exists)
- Block E: ❌ Not started (external audits + legal entity + token opinion)
- Block F: ❌ Not started (public testnet + genesis + validators)

**Next concrete action:** Block C — set up CI + run fuzz + stand up private
multi-node testnet. Then Block E (the real blocker for mainnet).

---

*This document is the canonical specification. All other docs derive from it.
If you find a contradiction, the other doc is wrong — report it.*
