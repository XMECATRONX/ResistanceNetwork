# RSTN — Technical Whitepaper v1.0

> A post-quantum Layer 1 blockchain with BFT+DAG consensus, 64-shard dynamic sharding, and a formal Quantum Migration Program for at-risk assets on pre-quantum chains.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [Cryptographic Architecture](#3-cryptographic-architecture)
4. [Consensus: BFT + DAG](#4-consensus-bft--dag)
5. [Sharding](#5-sharding)
6. [RSTN-VM](#6-rstn-vm)
7. [P2P Network](#7-p2p-network)
8. [Tokenomics](#8-tokenomics)
9. [Bridge & Quantum Migration](#9-bridge--quantum-migration)
10. [Security Framework](#10-security-framework)
11. [Governance](#11-governance)
12. [Honest Limitations](#12-honest-limitations)

---

## 1. Problem Statement

### The Quantum Threat

Every major blockchain today uses cryptographic signatures that are vulnerable to Shor's algorithm:

| Chain | Signature | Vulnerable to Shor? |
|---|---|---|
| Bitcoin | ECDSA (secp256k1) | Yes |
| Ethereum | ECDSA (secp256k1) | Yes |
| Solana | Ed25519 | Yes |
| Cardano | Ed25519 | Yes |

When a quantum computer reaches sufficient logical qubits (estimated 4,000+ for Shor on secp256k1), every exposed public key can be broken. The private key is derived, and funds are stolen. Current estimates place this between 10-30 years, but uncertainty is high — the threat may arrive sooner.

**$1.5T+ in crypto assets are at risk.**

### Additional Problems

| Problem | Current state | Impact |
|---|---|---|
| Scalability | 15-30 TPS (ETH/BTC) | Cannot serve global payments |
| Finality | 12-60 min | Unacceptable for real-time apps |
| MEV | $1B+/year extracted | Users lose value to validators |
| Bridge security | $3B+ hacked (2021-2024) | #1 attack vector in Web3 |
| Governance capture | Whales control DAOs | Centralization risk |

---

## 2. Solution Overview

RSTN is a Layer 1 blockchain that addresses all of the above:

```
┌─────────────────────────────────────────────────────────────┐
│                     RSTN                            │
│                                                              │
│  Layer 7: DApps + Wallets + Explorer                         │
│  Layer 6: IBC + PQ Light Clients + zk-STARK                  │
│  Layer 5: RSTN-VM (EVM + Move, parallel execution)          │
│  Layer 4: 64 Dynamic Shards (lock-and-commit atomicity)      │
│  Layer 3: BFT + DAG Consensus (0.4s finality)                │
│  Layer 2: PQ Cryptography (Dilithium3 + Kyber + SPHINCS+)   │
│  Layer 1: libp2p + pq-noise (Kyber768 + X25519)             │
│                                                              │
│  Token: RSTN · 1B hard cap · 50% fee burn · 60/30/10 bridge  │
│  Bridge: BTC (threshold ECDSA + SPV) + ETH (lock/burn)      │
│  Quantum Migration: formal program for at-risk assets        │
└─────────────────────────────────────────────────────────────┘
```

### Key metrics

| Metric | Value |
|---|---|
| Throughput | 250,000 TPS (64 shards + DAG) |
| Finality | 0.4s (2 BFT rounds) |
| Block time | 200ms |
| PQ coverage | 100% |
| Energy | 0.0001 kWh/tx |
| Max supply | 1,000,000,000 RSTN |

---

## 3. Cryptographic Architecture

### Design principle: defense in depth

Resistance does not rely on a single PQ scheme. It uses a layered approach where multiple independent schemes protect each surface.

### 3.1 Signature schemes

| Scheme | Role | Standard | Key size | Sig size |
|---|---|---|---|---|
| Dilithium3 | Primary signature | FIPS 204 (ML-DSA-65) | 1,952 bytes pub | 3,309 bytes |
| Ed25519 | Hybrid co-signer | RFC 8032 | 32 bytes pub | 64 bytes |
| SPHINCS+ | Fallback (hash-based) | FIPS 205 | — | — |

**Hybrid signing:** Every transaction is signed with both Dilithium3 and Ed25519. Both signatures must verify. If one scheme is broken, the other holds the network.

**Why hybrid?** Rainbow (NIST round 3 candidate) was broken in 2022. A single-scheme approach is a single point of cryptographic failure. Hybrid signing eliminates this.

**SPHINCS+ fallback:** Hash-based signatures that do not depend on lattice assumptions. Activable via on-chain governance if Dilithium3 is compromised. Independent of the lattice security assumption.

### 3.2 Key exchange

| Scheme | Role | Standard |
|---|---|---|
| Kyber768 | PQ key encapsulation | FIPS 203 (ML-KEM-768) |
| X25519 | Classical key agreement | RFC 7748 |

**Hybrid transport:** P2P connections use `pq-noise` (Kyber768 + X25519). If X25519 is broken by Shor, Kyber768 holds. If Kyber768 has a structural flaw, X25519 holds.

### 3.3 Hashing

| Function | Use | PQ Security |
|---|---|---|
| Keccak-512 (SHA-3) | Block hashing, addresses, Merkle trees | 256-bit (post-Grover) |

Keccak-512 provides 256-bit post-quantum security (Grover's algorithm halves the effective security of hash functions). Double the security of SHA-256.

### 3.4 Address derivation

```
address = last_20_bytes(Keccak-512(public_key))
```

Format: `rstn1...` (20 bytes, Bech32-like encoding).

### 3.5 VRF (Verifiable Random Function)

RSTN uses a lattice-based VRF (Module-LWE) for leader election. This replaces classical VRF schemes (which rely on ECDSA/Ed25519) with a PQ-resistant alternative.

### 3.6 ZK proofs

RSTN uses zk-STARKs (hash-based, no trusted setup) for privacy and light client verification. STARKs are post-quantum resistant because they rely on hash functions, not number-theoretic assumptions.

### 3.7 DKG (Distributed Key Generation)

LADKG (Lattice-based Asynchronous DKG) for threshold signature generation in the bridge committees. PQ-resistant threshold cryptography.

### 3.8 Quantum Defense Layers

| # | Layer | Threat | Solution |
|---|---|---|---|
| 1 | P2P Transport | Shor breaks X25519 | Kyber768 + X25519 hybrid |
| 2 | Signatures | Single-scheme failure | Dilithium3 + Ed25519 hybrid |
| 3 | Addresses | Public key exposure | Stealth PQ addresses (one-time) |
| 4 | Consensus | No detection mechanism | Quantum alarm on-chain |
| 5 | Application | Key exposure in wallets | Account abstraction with PQ keys |
| 6 | Fallback | Lattice structural flaw | SPHINCS+ (hash-based, independent) |

### 3.9 PQ Migration Path

| Phase | Trigger | Action |
|---|---|---|
| Genesis | Mainnet launch | Dilithium3 + Ed25519 hybrid from block 0 |
| Monitoring | Cryptanalysis or alarm | Governance activates SPHINCS+ as co-signer |
| Migration | NIST successor or confirmed attack | Hard fork with 90-day notice, free key rotation |
| Deprecation | 12 months post-migration | Dilithium3 deprecated, successor only |

---

## 4. Consensus: BFT + DAG

### 4.1 Overview

RSTN uses a hybrid BFT + DAG consensus:

- **BFT (Byzantine Fault Tolerance):** Provides deterministic finality through 2 rounds of voting (PREPARE → COMMIT)
- **DAG (Directed Acyclic Graph):** Enables parallel block production for higher throughput

### 4.2 Parameters

| Parameter | Value |
|---|---|
| Block time | 200ms |
| Finality | 0.4s (2 BFT rounds) |
| Threshold | 2/3+ supermajority of active validators |
| Leader election | PQ-VRF (lattice-based) |
| Fault tolerance | f = (n-1)/3 Byzantine faults |

### 4.3 BFT rounds

```
Leader (selected by PQ-VRF)
  │
  ├── propose block ─────────────► All validators
  │                                 │
  ◄── vote PREPARE ────────────────┤
  │                                 │
  ├── supermajority (2/3+)? ───────► vote COMMIT
  │                                 │
  ◄── vote COMMIT ─────────────────┤
  │                                 │
  ├── supermajority? → FINALIZE ───► block finalized
  │
  └── block committed to chain
```

### 4.4 Leader election

Leaders are selected by PQ-VRF (lattice-based, Module-LWE). The selection is:
- **Cryptographically unpredictable** (not just statistically random)
- **Verifiable** (anyone can verify the leader was correctly selected)
- **Post-quantum** (resistant to Shor)

Leader rotation: round-robin weighted by stake, with PQ-VRF randomization in production.

### 4.5 Forward security

Validator signing keys rotate automatically every epoch. Old keys cannot sign new blocks. This prevents long-range attacks where an attacker purchases old validator keys.

### 4.6 Social checkpointing

The community publishes signed checkpoints that new nodes use as trust anchors. This prevents long-range attacks from genesis.

### 4.7 Data Availability Sampling (DAS)

Each validator verifies only a random sample of the state (sub-linear sampling). To attack the network, an adversary must corrupt nodes they cannot predict will be selected. This raises the attack cost from ~33% to >90%.

### 4.8 Erasure coding

Blocks are split into redundant fragments (Reed-Solomon). Any node can reconstruct the full block from a fraction of fragments. If a proposer withholds data, the network reconstructs without them and slashes them.

### 4.9 BFT tolerance by phase

| Phase | Nodes | Tolerance | Risk |
|---|---|---|---|
| Local dev | 1 | f=0 | No tolerance — prototype only |
| Private testnet | 4 | f=1 | Minimum BFT |
| Semi-public testnet | 7-10 | f=2 | Stable |
| Public testnet | 20-100 | f=6 | Robust |
| Mainnet genesis | 1,000+ | f=333 | Sovereign |
| Mainnet target | 4,128+ | f=1,375 | Maximum |

---

## 5. Sharding

### 5.1 Overview

| Parameter | Value |
|---|---|
| Shard count | 64 (dynamic) |
| TPS per shard | 2,048 |
| Total TPS | 131K base, 250K with DAG |
| Cross-shard | Lock-and-commit (2PC) atomicity |

### 5.2 Cross-shard atomicity

```
Shard A                          Shard B
  │                                │
  ├── 1. Lock funds (escrow)      │
  │                                │
  ├── 2. Cross-shard message ────►├── 3. Verify Dilithium3 sig
  │    (signed with Dilithium3)   │
  │                                ├── 4. Credit funds
  │                                │
  ◄── 5. Commit/Rollback ─────────┤
  │                                │
  ├── 6. Final state update       │
```

**Guarantee:** If any shard fails, full rollback. No debits without credits. Atomicity is protocol-enforced, not contract-enforced.

### 5.3 Hotspot mitigation

| Mechanism | Description |
|---|---|
| Governance migration | Contracts exceeding 80% capacity for 1 epoch can be migrated to less saturated shards |
| Dynamic shard count | Active shards adjust from 32 to 64 based on load |
| Intelligent routing | Mempool routes simple transfers to least-loaded shards |

### 5.4 Honest limitation

Cross-shard atomicity guarantees correctness but NOT low latency. A transaction touching 2 shards takes minimum 2 blocks (lock + commit). For high-frequency DeFi, developers should design contracts within a single shard when possible.

---

## 6. RSTN-VM

### 6.1 Dual VM architecture

RSTN-VM is EVM-compatible with optional Move resource support:

| Feature | EVM mode | Move mode |
|---|---|---|
| Solidity contracts | ✅ Full compatibility | — |
| Move resources | — | ✅ Resource linearizability |
| Parallel execution | Optional (access lists) | Native |
| Formal verification | — | ✅ Native |
| Reentrancy protection | Checks-effects-interactions enforced | Prevented by design |

### 6.2 Key differences from EVM

| Feature | EVM | RSTN-VM |
|---|---|---|
| Signature verification | ecrecover (ECDSA) | OP_VALID_SIG (0xF0) — Dilithium3 |
| Arithmetic | Wrapping | Checked by default (revert on overflow) |
| Parallel execution | No | Optional (access lists) |
| Account abstraction | External | Native with PQ keys |

### 6.3 Access lists (optional)

Contracts can declare which state they access. This enables parallel execution without conflicts. Contracts without access lists execute sequentially (EVM-compatible behavior). This is optional — not a breaking change for existing Solidity code.

---

## 7. P2P Network

### 7.1 Stack

| Layer | Technology |
|---|---|
| Transport | libp2p + pq-noise (Kyber768 + X25519) |
| Discovery | Seed nodes + DNS TXT + Kademlia DHT |
| Gossip | Gossipsub 1.1 (mesh-based, peer scoring) |
| NAT traversal | libp2p circuit relay |

### 7.2 Seed nodes

5 seed nodes in 5 regions:

| Node | Region | Role |
|---|---|---|
| seed-01.rstn.network | Europe | Primary |
| seed-02.rstn.network | North America | Primary |
| seed-03.rstn.network | Asia-Pacific | Primary |
| seed-04.rstn.network | South America | Secondary |
| seed-05.rstn.network | Africa | Secondary |

### 7.3 Gossip topics

| Topic | Purpose |
|---|---|
| rstn/blocks/1.0 | New block propagation |
| rstn/transactions/1.0 | Pending transaction propagation |
| rstn/consensus/1.0 | BFT messages (proposals, votes, timeouts) |
| rstn/validator/1.0 | Validator registration and heartbeat |

### 7.4 Peer scoring

Malicious peers are degraded and eventually disconnected. Scoring is adaptive — statistically anomalous connection patterns are flagged.

### 7.5 Onion routing (optional)

For networks requiring metadata privacy, P2P traffic can route through Nym-style mixnets. Cost: +200ms latency. Optional per configuration.

---

## 8. Tokenomics

### 8.1 Token: RSTN

| Property | Value |
|---|---|
| Name | Resistance |
| Symbol | RSTN |
| Max supply | 1,000,000,000 (hard cap) |
| Minting | Zero — all tokens exist from genesis |
| Decimals | 9 |

### 8.2 Genesis distribution

| Bucket | Amount | % | Mechanism |
|---|---|---|---|
| Proof of Participation | 950M | 95% | Staking rewards, halving every 4 years. Team operates the genesis validator and earns from this bucket (Satoshi model). Zero ecosystem fund, zero genesis treasury — 95% earned by work |
| Testnet Airdrop | 50M | 5% | Bootstrap seed: delivered once to verified testnet node operators. PoS equivalent of Satoshi's first miners. Not transferable to founders |

**Zero ICO. Zero pre-sale. Zero VC. Fair launch. Zero team allocation — the team has no reserved bucket. Zero ecosystem fund. Zero genesis treasury. Pure Satoshi model: 95% earned by work, 5% bootstrap seed.**

### 8.3 Proof of Participation

RSTN is not sold. It is earned by contributing work to the network:

| Phase | Action | Reward |
|---|---|---|
| Testnet 1-2 | Run validator node | RSTN testnet + participation snapshot |
| Testnet 2-3 | Contribute code, audit, build dApps | Grants of RSTN |
| Mainnet genesis | Snapshot → proportional distribution | RSTN mainnet |
| Post-genesis | Staking + consensus participation | Variable block rewards |

### 8.4 Monetary policy

```
Hard cap: 1,000,000,000 RSTN (never exceeded)
Minting: Zero (all tokens exist from genesis)
Fee split (per transaction):
  50% burned (EIP-1559 style, deflationary)
  30% to block validator
  20% to on-chain security reserve (bug bounty + incident response)
  NOTE: the security reserve is born from network USAGE, not from a genesis
  pre-allocation. There is no capturable treasury in block 0.

Reserve distribution (950M RSTN, halving every 4 years — 6 halvings, ~24 years to convergence):
  Years 1-4:    475M RSTN   (50%)
  Years 5-8:    237.5M RSTN (25%)
  Years 9-12:   118.75M RSTN (12.5%)
  Years 13-16:  59.37M RSTN (6.25%)
  Years 17-20:  29.68M RSTN (3.12%)
  Years 21-24:  14.84M RSTN (1.56%)
  Year 24+:     Converges to 0 — 100% distributed

After ~24 years the reserve is exhausted and the network becomes deflationary:
the 50% gas burn exceeds the remaining emission, so circulating supply decreases.
Validators are then sustained by fees alone (30% of gas + bridge revenue).
```

### 8.5 Bridge economics (60/30/10)

| Destination | % | Mechanism |
|---|---|---|
| Buyback & Burn | 60% | Buy RSTN on DEX (limit order), burn to dead address |
| Staker rewards | 30% | Distributed proportional to stake (real revenue, not inflation) |
| Security reserve | 10% | Bug bounty, incident response, emergency reserve (born from bridge usage, not genesis) |

Bridge fee: 0.15% standard + 0.05% fast-path (optional)
Quantum Migration: 0% (free — differentiator, generates volume that feeds burn)

### 8.6 Team bootstrap role (Satoshi model — no reserved bucket)

The team has **no reserved bucket** in genesis. There is no vesting contract, no cliff, no team allocation to administer or release. Instead, the team earns RSTN from the staking pool (95%) by operating the **genesis validator** — doing the bootstrap work (running the initial validator set, infrastructure, security) when no one else does.

This mirrors Satoshi, who mined the first ~1.1M BTC with PoW by being the first to mine — not by a protocol privilege. The team earns a disproportionate share only because it is the first to do the work, not because the protocol reserved anything.

| Property | Satoshi (Bitcoin) | RSTN team |
|---|---|---|
| Reserved in genesis | No (mined) | **No** |
| Earned by work | Yes (PoW) | **Yes (genesis validator bootstrap)** |
| Same mechanism as everyone | Yes | **Yes** |
| Sink / not sold | Yes (never moved) | **Public no-sale commitment** |

- The team earns from the staking pool by the same mechanism that pays any validator. No special seat.
- If the team stops validating, it stops earning. No guaranteed allocation.
- The team's share dilutes naturally as new stakers arrive — competition, not a vesting contract, forces dilution (same as Satoshi).
- Public no-sale commitment replicates Satoshi's sink behavior (his BTC never moved). The team cannot flood the market because there is no releasable allocation to dump.
- If the network fails to take off, the team loses the bootstrap cost — the same risk Satoshi took spending electricity when BTC was worth ~$0. This is the skin in the game that makes "no founder allocation" credible.
- No vesting, no cliff, no burn of residual: there is no team bucket to manage, release, or burn. The complexity disappears by design.

### 8.6b Liquidity Provision = Participation (LP rewards inside the 95%)

LP rewards are not a separate bucket. They live **inside** the 95% Proof of Participation bucket — the same reserve that pays validators. This keeps the Satoshi model intact: two clean buckets (95/5), not three. No hidden inflation, no third allocation to capture.

**Per-epoch emission split (from the 95% reserve):**

| Recipient | Share | APR profile | Risk |
|---|---|---|---|
| Validators + delegators | 80% | Higher APR | Slashing + uptime >90% + hardware (VPS $20-50/mo) |
| DEX LPs | 20% | Lower APR | Impermanent loss only, no slashing |

**The split (80/20) is adjustable by on-chain governance.** But the following invariant is **immutable — it cannot be broken by vote**:

```
APR_validator >= 2 × APR_lp
```

#### Why the invariant is necessary

Without it, LP and validator would pay the same per RSTN. LP is "easy" (no slashing, no VPS, no uptime). Everyone would prefer LP. No one runs nodes. No blocks are produced. The DEX cannot process swaps. LP tokens are worth $0. **The network dies.**

The invariant guarantees that whoever assumes more risk always earns more. The validator earns ~2× the LP per RSTN staked because it carries slashing + uptime + hardware risk. This is risk compensation, not privilege.

#### Self-balancing mechanism

If too many participants drift to LP, few validators remain. The same total reward pool divided by fewer validators means **each validator earns much more**. That rising yield attracts participants back to validation — the pendulum self-corrects, like Bitcoin's mining difficulty.

#### Liveness dependency

LPs need the network alive: without validators there are no blocks, the DEX processes no swaps, LP tokens are worth $0. A rational LP prefers 6% on a live network over 12% on a dead one. This is the economic pressure that keeps the network's two sides in balance.

#### Fair launch (no team seed)

The team does **not** seed the initial DEX pool. Anyone can be the first LP and earn rewards. Whoever contributes work — blocks or liquidity — earns tokens. No capture, no reserve, no hidden inflation.

| DEX pool | Role |
|---|---|
| wRSTN / USDC | Price discovery — RSTN price is born from the first swap |
| wRSTN / wBTC | Cross-chain liquidity for the Quantum Migration Program |

### 8.7 Token utility

| Use | Description |
|---|---|
| Gas | Every transaction and contract execution requires RSTN |
| Governance | 1 RSTN = 1 vote (quadratic, verified identity) |
| Staking | 32,000 RSTN to be a validator |
| Delegation | From 1 RSTN, delegate to a validator |

### 8.8 Early validator incentives

| Group | Bonus | Duration |
|---|---|---|
| First 100 validators | 2.0× rewards | First ~41 days |
| Validators 101-500 | 1.5× rewards | First ~83 days |
| Validators 501-1,000 | 1.25× rewards | First ~125 days |
| Validators 1,001+ | 1.0× (standard) | Permanent |

Bonus is per-validator, not per-stake. A whale with 100 validators does not get 100× bonus. This rewards distribution, not concentration.

---

## 9. Bridge & Quantum Migration

### 9.1 Design principles

1. **Zero centralized multisig** — no 5-signer setup that can be compromised
2. **PQ signatures in relayers** — Dilithium3, not ECDSA
3. **Circuit breakers on-chain** — automatic pause on anomalous flows
4. **Rate limiting per chain** — prevents draining the entire bridge
5. **Audited light clients** — each chain's light client is independently audited

### 9.2 Supported chains

| Chain | Model | Light client | Finality | Status |
|---|---|---|---|---|
| Bitcoin | Lock-and-Mint (threshold ECDSA 51/100 + SPV) | SPV | 6 conf (~60 min) | Design complete |
| Ethereum | Lock native + Burn ERC-20 | Sync committee (Altair) | ~12 min | Design complete |
| Solana | Burn in program | In development (=nil; Foundation) | ~30 conf | Post-mainnet |
| BSC | Lock + Burn BEP-20 | EVM-compatible | ~3s | Post-mainnet |
| Avalanche | Lock + Burn ERC-20 | EVM-compatible | ~10 conf | Post-mainnet |
| Polygon | Lock + Burn ERC-20 | EVM-compatible | Bor Heimdall | Post-mainnet |

**Honest claim:** Resistance supports chains with an implemented and audited light client — not "any chain" without qualification.

### 9.3 Bitcoin bridge (threshold ECDSA)

Bitcoin does not support smart contracts or PQ signatures natively. RSTN uses a two-layer model inspired by tBTC (Threshold Network):

**Layer 1 (Bitcoin):**
- Committee of 100 signers uses threshold ECDSA (MPC distributed)
- No single signer has the complete private key
- 51 of 100 must cooperate to produce a valid ECDSA signature
- BTC is custodied in a P2WSH address generated by the committee

**Layer 2 (Resistance):**
- Committee governance, signer selection, slashing use Dilithium3
- Validators verify deposits via embedded SPV light client
- Proof of Reserves is public and auditable

**Multiple parallel committees** (tBTC v2 style):
- Each committee custodies an independent P2WSH vault
- 1 committee: ~1,440 tx/day
- 50 committees: ~72,000 tx/day (sufficient for mass migration)
- Committees scale dynamically based on migration volume

**Honest limitation:** BTC custody uses ECDSA (Bitcoin's limitation). Security comes from (1) threshold distribution, (2) signer rotation, (3) slashing in Resistance. If Bitcoin forks to support PQ signatures, Resistance would migrate the vault.

### 9.4 Ethereum bridge

| Asset | Model |
|---|---|
| ETH native | Lock in verifiable contract (ETH has no burn function) |
| ERC-20 tokens | Burn with `burn()` in origin contract |

Resistance verifies the lock/burn via sync committee light client (Altair upgrade). Finality is deterministic (~12 min).

### 9.5 Quantum Migration Program

The differentiator: a formal, on-chain program for migrating at-risk assets from pre-quantum chains to Resistance.

**How it works:**

```
1. Detection: Resistance monitors quantum hardware advancement.
   When risk threshold is reached (est. 2030-2035), program activates.

2. Migration window opens (on-chain timestamp, immutable):
   Users have a defined period (e.g., 12 months) to migrate.

3. Transfer to vault / lock / burn:
   BTC: User transfers to committee P2WSH (threshold ECDSA 51/100)
   ETH native: User locks in verifiable contract
   ERC-20s/SOL: User burns in origin contract/program

4. Light client verification:
   RSTN validators verify via SPV (BTC) or sync committee (ETH)
   Without verification, no issuance.

5. Issuance backed 1:1:
   RSTN issues wBTC/wETH to a new Dilithium3 address.
   Backed 1:1 by locked or burned asset.
   Original ECDSA key no longer controls the asset —
   even if a QC breaks it, there's nothing to steal.

6. Window closes:
   Non-migrated addresses are considered at risk.
   Abandoned coins (lost keys) cannot migrate — only the
   owner can initiate the transfer.
```

**Double-spend prevention:** A global Merkle tree records every migrated pre-quantum address. The root updates every block. Verifying if an address already migrated is O(log n). Replay is impossible — each claim includes a unique nonce (chain_id + block_height + tx_hash).

**Economic backstop:** wBTC/wETH is not created from nothing. The original asset is locked (BTC) or burned (ETH/SOL). Without verified transfer via light client, no issuance. Proof of Reserves is public and auditable.

**Honest limitation:** Abandoned coins (BTC in addresses where the owner lost the private key) cannot be migrated. Only the owner can initiate the transfer. This is an open problem affecting the entire industry. Resistance does not promise a solution for this.

### 9.6 Threshold throughput

| Committees | Throughput | Users in 12 months |
|---|---|---|
| 1 | ~1,440 tx/day | ~525K |
| 10 | ~14,400 tx/day | ~5.2M |
| 50 | ~72,000 tx/day | ~26M |

Even with 50 committees, migrating 100M Bitcoin addresses takes ~4 years. The migration window must be years, not months. This is a technical reality, not a promise.

---

## 10. Security Framework

### 10.1 8 attack domains

| # | Domain | Coverage |
|---|---|---|
| 1 | Post-Quantum Cryptography | Scheme design, cryptanalysis monitoring, migration path |
| 2 | BFT+DAG Consensus | BFT, slashing, VRF, sharding |
| 3 | P2P Network | libp2p, gossip, discovery, onion routing |
| 4 | Smart Contracts | RSTN-VM, opcodes, access lists, formal verification |
| 5 | Economics & Staking | Tokenomics, slashing economics, MEV prevention |
| 6 | Infrastructure | CI/CD, Docker, signed releases, monitoring |
| 7 | Wallet & Frontend | Extension, web wallet, CSP, anti-phishing |
| 8 | Adversarial AI | Red-teaming with AI, deepfake detection, adversarial fuzzing |

### 10.2 12 mitigated attack vectors

| # | Vector | Mitigation | Risk after |
|---|---|---|---|
| 1 | Stake collusion (33%/67%) | DAS sub-linear sampling | Very low |
| 2 | Long-range attack | Forward security + social checkpoints | Very low |
| 3 | Network surveillance | Onion routing (Nym-style) | Low |
| 4 | Data withholding | Reed-Solomon erasure coding + DAS | Very low |
| 5 | Smart contract bugs | Formal verification + circuit breakers | Medium |
| 6 | Relayer collusion (IBC) | Permissionless relayer market + fees | Low |
| 7 | Spam / dust attack | Stake-weighted mempool + hashcash | Very low |
| 8 | Timejacking | Bounded NTP + MTP validation | Very low |
| 9 | Cross-chain sandwich (MEV) | Commit-reveal cross-chain | Low |
| 10 | Oracle manipulation | Multi-source + median + deviation breaker | Medium |
| 11 | Geographic centralization | 15% cap per region + VRF redistribution | Very low |
| 12 | Flash loan + governance capture | Quadratic voting + epoch-delayed snapshot | Very low |

### 10.3 MEV prevention

The mempool is encrypted with threshold encryption (LADKG). Transactions are only decrypted AFTER they are ordered and the round is finalized. MEV is impossible — validators cannot reorder what they cannot read.

### 10.4 External audits (pre-mainnet, non-optional)

| Audit | Scope | Estimated cost |
|---|---|---|
| Cryptographic | Dilithium3, Kyber768, SPHINCS+, LADKG, pq-noise | $80K-$150K |
| Consensus | BFT+DAG, slashing, VRF, sharding | $80K-$200K |
| Bridge | Threshold ECDSA, SPV, lock/burn/mint, migration | $60K-$150K |
| VM | Gas accounting, opcodes, reentrancy, DoS | $40K-$100K |

All audit reports are published. Bug bounty ($500K+) launches post-testnet.

### 10.5 Incident response

| Severity | Description | Response | Action |
|---|---|---|---|
| SEV-0 | Existential (funds at risk) | < 1 min | Emergency fork 72h |
| SEV-1 | Significant loss (>$1M) | < 10 min | Hotfix 24h |
| SEV-2 | Degradation (no fund loss) | < 1 hour | Patch next epoch |
| SEV-3 | Minor | < 24 hours | Fix next release |

All SEV-0 and SEV-1 incidents are published publicly within 72 hours. Post-mortems are open-source.

---

## 11. Governance

### 11.1 Principles

- **1 RSTN = 1 vote** (quadratic, weighted by verified identity)
- **Capture threshold:** >51% of verified identities, not tokens
- **Minority veto:** 10% of votes delays 30 days for discussion
- **Epoch-delayed snapshot:** Voting power calculated in the previous block — flash loans cannot influence governance

### 11.2 Proposal process

```
1. NIP (Resistance Improvement Proposal) — any holder with 10,000 RSTN
2. 7-day on-chain voting (quadratic, verified identity)
3. If >67% approve → implementation
4. External audit if cryptographic or consensus change
5. Validators signal readiness on-chain
6. Activation at programmed block
```

### 11.3 Fork types

| Type | Description | Activation |
|---|---|---|
| Soft fork | Backward-compatible | 90% validators signal in 2,000 blocks |
| Hard fork | Incompatible change | Governance vote → 90-day notice |
| Emergency fork | Critical vulnerability | Validator consensus + security multisig, accelerated |

---

## 12. Honest Limitations

RSTN is designed with intellectual honesty. These are the limitations we acknowledge:

### 12.1 Cryptographic

- **Lattice schemes** (Dilithium3, Kyber) do not have security proofs as mature as RSA or elliptic curves. Security is based on the assumed hardness of Module-LWE.
- **A cryptanalytic advance** could reduce lattice security without a large-scale quantum computer.
- **Large-scale quantum computing** does not exist today. Timeline estimates vary from 10 to 30+ years. Current physical qubits (~1,000) are not comparable to the logical qubits needed (~4,000+).
- **Harvest now, decrypt later:** Resistance protects against this for future traffic, but cannot protect keys already compromised before migration.

### 12.2 Bridge

- **Bitcoin custody uses ECDSA** — this is a fundamental limitation of Bitcoin. Security comes from threshold distribution, rotation, and slashing, not from PQ signatures on Bitcoin.
- **Abandoned coins** (lost keys) cannot be migrated. Only the owner can initiate the transfer. This is an open industry problem.
- **Migration is not instant.** Even with 50 committees, migrating 100M Bitcoin addresses takes ~4 years. The migration window must be years.
- **Only chains with implemented light clients are supported.** Not "any chain" — each chain requires specific engineering.

### 12.3 Consensus

- **Early phases have low BFT tolerance.** With 4 nodes, f=1 — compromising 1 node can halt the network. This is why the bootstrap sequence matters.
- **Cross-shard latency** is minimum 2 blocks (lock + commit). Not suitable for high-frequency cross-shard DeFi without careful contract design.

### 12.4 Economic

- **Staking rewards are variable** — they depend on network performance, not guaranteed. Promising fixed yield would make RSTN a security under the Howey Test.
- **The token does not always go up.** The deflationary mechanism (burn + buyback) creates supply pressure, but price depends on demand. We do not promise returns.

### 12.5 Legal

- RSTN is a utility token (gas, governance, staking), not a security.
- Zero token sale. Zero ICO. Zero pre-sale. Zero VC.
- The whitepaper is technical, not a prospectus. Zero mentions of ROI, price, or profits.
- If any of these conditions are violated, the legal strategy collapses.

---

## References

- NIST FIPS 203 — ML-KEM (Kyber)
- NIST FIPS 204 — ML-DSA (Dilithium)
- NIST FIPS 205 — SLH-DSA (SPHINCS+)
- NIST FIPS 202 — SHA-3 (Keccak)
- libp2p specification — https://github.com/libp2p/specs
- tBTC (Threshold Network) — https://github.com/keep-network/tbtc
- Cosmos IBC — https://github.com/cosmos/ibc

---

## License

Apache 2.0 — includes defensive patent clause.

## Disclaimer

RSTN is experimental open-source software. It is not an investment. There is no guarantee of value. Use at your own risk.
