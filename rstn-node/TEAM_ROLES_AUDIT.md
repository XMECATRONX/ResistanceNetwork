# RSTN — Blockchain Team: Integrated and Missing Roles

> Date: 2026-09-01
> Status: **CONFIDENTIAL — INTERNAL USE**

---

## 1. "Integrated" roles (covered by current development)

Development to date has covered the following roles through the work of the
AI assistant. These roles are **coded** but **have no human behind them**.

| # | Role | What is done | What is missing |
|---|------|-------------|-----------------|
| 1 | **Protocol architect** | 7-layer design, BFT+DAG consensus, 64-shard sharding, Satoshi tokenomics (0% team, 95% fair launch, 5% seed), IBC, DAS, forced-inclusion, threshold mempool, zk-STARK foundation | — |
| 2 | **PQ cryptographer (partial)** | Dilithium3 stack (FIPS 204 ML-DSA-65) + Kyber768 + SPHINCS+ + hybrid NoiseHandshake + forward security + quantum alarm + account abstraction. Canonical FIPS wire sizes (pk=1952, sk=4032, sig=3309) | **Formal external cryptographic audit** — no human firm has reviewed the stack |
| 3 | **Rust engineer (node)** | rstn-node with 15 crates: core, crypto, p2p, bridge, VM, storage, rpc, node, ledger, sol-transpiler, vm, consensus, sharding, ibc, onion, zk_stark | libp2p fork for PQ gossipsub |
| 4 | **Solidity engineer (DEX/bridge)** | DEX contracts (RstnDexPool, RstnDexFactory, WRSTN) + bridge lock-and-mint + ERC20Mock. 85/85 tests pass | External Solidity audit |
| 5 | **Frontend engineer (React/TS)** | Landing page, DevPortal, terminal, 25+ views, wallet adapter, i18n ES/EN, design tokens, framer-motion animations | — |
| 6 | **Security engineer (partial)** | Complete internal audit (C1, C1-prod, C2, A1-A3, M1-M5), fuzz targets (protocol + VM + consensus), remediation, real SPV (Bitcoin double-SHA256, Ethereum Keccak-256) | **External auditor** (Trail of Bits, OpenZeppelin, Certik, Halborn), **penetration tester / red team** |
| 7 | **UX/UI designer** | Design token system, shadcn components, coherent palette (single green), animations, responsive | — |
| 8 | **Technical writer** | Whitepaper, legal whitepaper, SECURITY_AUDIT_FULL, READMEs, deploy docs, tokenomics whitepaper | — |

---

## 2. REAL human roles missing (not replaceable by AI)

These are the professionals who **must be hired/integrated** before mainnet.
AI cannot sign with legal reputation or certify cryptography.

### P0 — Critical for mainnet

| # | Role | Why it is irreplaceable | Reference |
|---|------|------------------------|-----------|
| 1 | **Post-quantum cryptographer with PhD** | Formally audit the PQ stack (Dilithium3, Kyber768, SPHINCS+, NoiseHandshake). No serious investor trusts cryptography not audited by humans. The stack uses `@noble/post-quantum` and `fips204` (audited libraries), but the **composition** and **parameters** must be reviewed. | NIST PQC, Trail of Bits, Quarkslab |
| 2 | **Smart contract auditor (registered firm)** | External audit of the DEX (Solidity) and the bridge (Rust + Solidity). The 85 tests pass, but tests are not an audit. Wormhole lost $320M to a bug the tests did not cover. | Trail of Bits, OpenZeppelin, Certik, Halborn, Spearbit |
| 3 | **Blockchain DevOps/SRE engineer** | Operate the public testnet, monitor nodes, seed node infrastructure across 6 continents. The deploy scripts exist but **no one is operating the network**. | — |
| 4 | **Crypto lawyer / regulatory counsel** | Token classification (security vs utility) by jurisdiction, bridge AML/KYC compliance, real legal terms (not templates). | — |

### P1 — High for adoption

| # | Role | Why | |
|---|------|-----|--|
| 5 | **Community manager + dev relations** | Validator onboarding, docs for node operators, Discord/Telegram, bug bounty programs. | — |
| 6 | **Tokenomics economist** | Validation of the emission model (1B RSTN, 95% fair launch), scarcity simulation (EIP-1559 + bridge burn), staking game theory (32K minimum, 5% slashing). | — |
| 7 | **Penetration tester / red team** | Real attack on the node (RPC, p2p, gossipsub), the bridge (SPV, committee), the wallet (XSS, phishing), the web (CORS, CSP) before mainnet. | — |
| 8 | **Ledger firmware engineer (BOLOS)** | Write the on-device app (Rust + BOLOS SDK) that signs Dilithium3 on the secure element. The spec is in `LEDGER_BOLOS_FIRMWARE.md`. | Ledger's security team review |

### P2 — Medium for scale

| # | Role | Why | |
|---|------|-----|--|
| 9 | **Consensus / distributed systems engineer** | Review of BFT+DAG, slashing, finality, view-changes. Consensus specialists are scarce. | — |
| 10 | **libp2p engineer (fork)** | Implement `PqNoiseConfig` in the libp2p fork for wire-level PQ gossipsub. Plan in `GOSSIPSUB_PQ_BROADCAST.md` (~4 weeks). | — |

---

## 3. Estimated budget (pre-mainnet, 6 months)

| Role | FTE | Estimated cost (USD/year) | Total (6 months) |
|-----|-----|---------------------------|-------------------|
| PQ cryptographer (PhD) | 0.5 | $180K | $90K |
| Solidity auditor (external, one audit) | contract | $80K–$150K | $100K |
| Rust auditor (external, one audit) | contract | $80K–$150K | $100K |
| DevOps/SRE | 1.0 | $140K | $70K |
| Crypto lawyer | 0.3 | $200K | $30K |
| Community manager | 1.0 | $80K | $40K |
| Tokenomics economist | 0.3 | $150K | $22K |
| Pen tester (one audit) | contract | $40K | $40K |
| Ledger firmware | 0.5 | $160K | $80K |
| **Total** | | | **~$572K** |

---

## 4. Honest verdict

You have the **technical product** (code + docs + tests + fuzz + design specs)
but **zero human team**. For mainnet, the non-negotiable minimum is:

1. **1 PQ cryptographer** (formal stack audit)
2. **1 external Solidity auditor** (DEX + bridge)
3. **1 external Rust auditor** (node + consensus)
4. **1 DevOps** (operate the public testnet)
5. **1 crypto lawyer** (token classification)

Without those five, the project **is not credibly launchable**, no matter that
the code compiles, the 85 tests pass, and the build is clean. The difference
between "code that works" and "a protocol where someone deposits $1M" is
exactly these five roles.

---

## 5. Mainnet status — checklist

| Item | Status | Blocked by |
|------|--------|------------|
| Node code (Rust) | ✅ Compiles + tests | — |
| Contracts (Solidity) | ✅ 85/85 tests | — |
| Frontend (React/TS) | ✅ Clean build | — |
| Wallet extension | ✅ Functional | — |
| Bridge SPV (BTC double-SHA256 + ETH Keccak) | ✅ Implemented + tested | — |
| Forced-inclusion pool | ✅ Wired in propose_block + vote_prepare | — |
| Threshold mempool (MEV) | ✅ Enabled in main.rs | — |
| DAS + erasure coding | ✅ Implemented | — |
| Forward security (anti long-range) | ✅ Implemented | — |
| Fuzz targets (protocol + VM + consensus) | ✅ Ready | 24h+ CI runs |
| Ledger firmware spec | ✅ Designed | On-device app (BOLOS) |
| Gossipsub PQ plan | ✅ Designed | libp2p fork (~4 weeks) |
| **External cryptographic audit** | ⬜ Pending | PQ cryptographer |
| **External Solidity audit** | ⬜ Pending | Solidity auditor |
| **External Rust audit** | ⬜ Pending | Rust auditor |
| **Operated public testnet** | ⬜ Pending | DevOps/SRE |
| **Legal token classification** | ⬜ Pending | Crypto lawyer |
| **Ledger on-device firmware** | ⬜ Pending | BOLOS engineer |
| **libp2p fork (PQ gossipsub)** | ⬜ Pending | libp2p engineer |
