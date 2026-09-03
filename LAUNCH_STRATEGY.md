# RSTN — Legal Launch Strategy

## Decision: Option C — Foundation (Legal Entity, not a person)

```
Resistance Foundation (Switzerland or Singapore)
├── Legal entity without a visible personal owner
├── Foundation Board (appointed members)
├── KYC/AML compliance at the entity level
├── Audits contracted by the Foundation
├── Token issued by the Foundation, not by individuals
└── The development team is "core contributor", not "token owner"
```

---

## Why NOT to launch anonymously in 2026

| Factor | Consequence |
|--------|-------------|
| FinCEN | Bridge = money transmitter. Without an MSB license = illegal in the US |
| SEC | Token without a legal entity = not listed on serious exchanges |
| MiCA (EU) | Without a registered entity = you do not operate in Europe |
| Audits | Trail of Bits/Quantstamp do not work with anonymous parties |
| Exchanges | Binance, Coinbase, Kraken require team KYC |
| Tax risk | Anonymous + bridge + token = evasion pattern for a prosecutor |

**Satoshi could do it in 2009. You cannot in 2026. The rules changed.**

---

## Launch Plan — 7 Phases

### PHASE 1: Legal Foundation (Month 1-2)

#### Option A: Switzerland (Zug) — RECOMMENDED

**Why Switzerland:**
- Clearest crypto legal framework in the world
- Ethereum Foundation, Cardano, Polkadot are there
- Foundation (Stiftung) has no owner — protects your personal identity
- Recognizes tokens as utility, not security, if structured correctly
- Does not require revealing identity to the public, only to authorities

**Steps:**
1. Hire a Swiss crypto lawyer (see contacts below)
2. Register a Stiftung (Foundation) in Zug
3. Define the bylaws: purpose = open-source blockchain infrastructure development
4. Appoint a Foundation Board (minimum 2 members)
5. Open a corporate bank account (requires board KYC)
6. Total cost: $15K-$30K

**Required documents:**
- Board passports (appointed members)
- Proof of address
- Professional CV
- Source of funds declaration
- Foundation business plan

#### Option B: Singapore

**Why Singapore:**
- Clearest crypto regulatory framework in Asia
- Cardano Foundation is there
- Company Limited by Guarantee (CLG) — structure similar to a foundation
- MAS (Monetary Authority of Singapore) has a regulatory sandbox

**Steps:**
1. Hire a crypto lawyer in Singapore
2. Register a Company Limited by Guarantee (CLG)
3. Apply to the MAS sandbox if applicable
4. Total cost: $10K-$25K

#### Option C: Panama (economic alternative)

**Why Panama:**
- More affordable ($3K-$8K)
- Private Interest Foundation — flexible structure
- No specific crypto regulation yet
- Less prestige than Switzerland/Singapore

**Steps:**
1. Hire a Panamanian lawyer specialized in crypto
2. Register a Private Interest Foundation
3. Total cost: $3K-$8K

---

### PHASE 2: Token Structure (Month 2)

**Goal:** RSTN is NOT a security

#### How to achieve it:
1. **Do not sell tokens** — fair launch / airdrop / staking rewards only
2. **Do not promise ROI** — the disclaimers are already in the code
3. **Real utility** — RSTN is used for gas, staking, governance
4. **No pre-sale** — already in the design (no ICO)
5. **Progressive decentralization** — the Foundation gradually relinquishes control

#### Legal document:
- **Token Legal Opinion** — a lawyer issues an opinion that RSTN is a utility token
- Cost: $5K-$15K
- Required for exchanges to list you

---

### PHASE 3: Bridge Compliance (Month 2-3)

**The bridge is the highest legal risk.**

#### Architectural decision: Pure protocol without KYC

| Approach | Risk | Status |
|---------|--------|--------|
| Bridge with a central operator | HIGH — money transmitter | NO |
| Pure protocol bridge (lock-mint/burn-release) | MEDIUM — protocol, not operator | YES |
| Bridge with integrated KYC | LOW but adds UX friction | Pending |

**Our decision:** Pure protocol (documented in `BRIDGE_LEGAL_DESIGN.md`)

#### Real compliance:
1. **Do not custody funds** — the lock-mint protocol is non-custodial
2. **Do not transfer value** — the user executes the transaction, not the Foundation
3. **Do not charge bridge fees** — or if charged, they go to the on-chain treasury
4. **AML monitoring** — monitoring of suspicious transactions at the protocol level
5. **Sanctions screening** — verify addresses against OFAC/SDN lists

**Required documents:**
- Bridge legal memorandum (lawyer)
- AML policy document
- Sanctions compliance policy
- Cost: $8K-$20K

---

### PHASE 4: External Audit (Month 3-4)

**Do NOT launch mainnet without an external audit. This is not optional.**

#### Recommended firms (in order of preference):

1. **Trail of Bits** — top tier, audited Compound, Aave
   - Web: trailofbits.com
   - Cost: $50K-$150K
   - Time: 6-10 weeks

2. **Quantstamp** — specialized in blockchain
   - Web: quantstamp.com
   - Cost: $40K-$120K
   - Time: 6-8 weeks

3. **Halborn** — specialized in L1/L2
   - Web: halborn.com
   - Cost: $30K-$100K
   - Time: 6-8 weeks

4. **Cure53** — specialized in cryptography
   - Web: cure53.de
   - Cost: $20K-$60K
   - Time: 4-6 weeks

#### What to audit:
- [ ] Post-quantum cryptography (Dilithium3, Kyber768, PQ-noise)
- [ ] BFT+DAG consensus
- [ ] Bridge protocol (lock-mint/burn-release)
- [ ] VM and smart contracts
- [ ] Storage and state transitions
- [ ] P2P networking
- [ ] RPC API

#### Bug Bounty (post-audit):
- Immunefi (immunefi.com) — standard platform for crypto bug bounties
- Tiers: $1K (low) → $100K+ (critical)
- Minimum recommended budget: $50K in reserves

---

### PHASE 5: Public Testnet (Month 4-5)

**Requirements before public testnet:**
1. Legal foundation registered
2. Token legal opinion obtained
3. Bridge compliance documented
4. External audit contracted (can be in progress)
5. Bug bounty program active
6. Terms of service and privacy policy published (already done)
7. Domain and hosting under Foundation control

**Testnet launch:**
- 4-8 initial validator nodes
- Active faucet for testnet tokens (no real value)
- Public block explorer
- Documentation for validators
- Support channel (Discord/Telegram)

---

### PHASE 6: Pre-Mainnet (Month 5-6)

**Requirements before mainnet:**
1. External audit completed — 0 critical issues
2. Bug bounty executed minimum 30 days on testnet
3. 16+ independent validators
4. Foundation has functional on-chain governance
5. Team KYC with target exchanges
6. Listing agreements negotiated (minimum 1 tier-2 exchange)
7. Initial liquidity secured
8. Decentralization plan published

---

### PHASE 7: Mainnet (Month 6+)

**Only if ALL of the above is complete.**

1. Genesis block with fair launch distribution
2. No allocation to founders (already in design)
3. Bridge activated with initial capacity limits
4. 24/7 node monitoring
5. Active community support
6. Decentralization roadmap in execution

---

## Total Estimated Budget

| Item | Cost (USD) | Optional? |
|------|------------|-----------|
| Foundation (Switzerland) | $15K-$30K | NO |
| Crypto lawyer (retainer) | $10K-$25K | NO |
| Token legal opinion | $5K-$15K | NO |
| Bridge legal memo + AML | $8K-$20K | NO |
| External audit | $40K-$150K | NO |
| Bug bounty reserves | $50K | Recommended |
| Exchange listing (tier-2) | $10K-$50K | Recommended |
| Hosting/infrastructure | $2K-$5K/month | NO |
| Marketing/community | $5K-$20K | Optional |
| **MINIMUM TOTAL** | **$130K-$315K** | |

---

## Recommended Crypto Lawyers

### Switzerland
1. **MME Legal** (Zug) — audited the Ethereum Foundation
   - Web: mme.ch
   - Specialty: crypto foundations, token opinions
    
2. **Lenz & Staehelin** — top Swiss firm
   - Web: lenzstaehelin.ch
   - Specialty: regulatory, fintech

3. **Bär & Karrer** — top Swiss firm
   - Web: baerkarrer.ch
   - Specialty: corporate, fintech

### Singapore
1. **Drew & Napier** — top Singapore firm
   - Web: drewnapier.com
   - Specialty: MAS regulatory, crypto

2. **Rajah & Tann** — specialized in fintech
   - Web: rajahandtann.com
   - Specialty: crypto, blockchain

### United States (if you operate in the US)
1. **Cooley LLP** — top crypto law firm
   - Web: cooley.com
   - Clients: Coinbase, OpenSea, Polygon

2. **Perkins Coie** — specialized in blockchain
   - Web: perkinscoie.com
   - Clients: Filecoin, Tezos

3. **a16z crypto legal** — Andreessen Horowitz
   - Web: a16z.com
   - Specialty: token structuring

### Panama (economic alternative)
1. **Morgan & Morgan** — top Panamanian firm
   - Web: morgan.com.pa
   - Specialty: private interest foundations

---

## Timeline Summary

```
Month 1-2:  Legal foundation + lawyer retainer
Month 2:    Token legal opinion + bridge compliance
Month 3-4:  External audit (contract + execute)
Month 4-5:  Public testnet + bug bounty
Month 5-6:  Pre-mainnet + exchange listings
Month 6+:   Mainnet launch
```

---

## Final Pre-Mainnet Checklist

- [ ] Foundation registered (Switzerland/Singapore/Panama)
- [ ] Crypto lawyer with active retainer
- [ ] Token legal opinion: "RSTN is a utility token"
- [ ] Bridge: pure protocol documented
- [ ] AML policy + sanctions screening implemented
- [ ] External audit completed (0 critical issues)
- [ ] Bug bounty executed 30+ days
- [ ] 16+ independent validators
- [ ] Team KYC with exchanges
- [ ] Listing agreement signed (minimum 1 exchange)
- [ ] Terms of service published (✅ done)
- [ ] Privacy policy published (✅ done)
- [ ] Disclaimers visible on landing (✅ done)
- [ ] Disclaimers in terminal (✅ done)
- [ ] Decentralization plan published
- [ ] Initial liquidity secured
- [ ] 24/7 monitoring infrastructure
- [ ] Community support (Discord/Telegram)

---

## Non-Negotiable Rules

1. **DO NOT launch mainnet without an external audit**
2. **DO NOT sell tokens as investment contracts**
3. **DO NOT operate the bridge as a money transmitter without a license**
4. **DO NOT promise ROI or guaranteed returns**
5. **DO NOT launch anonymously in 2026**
6. **DO NOT use the PQ-noise placeholder in production**
7. **DO NOT ignore bridge AML/KYC**

**If you follow these 7 rules, the legal risk is close to zero.**

---

## Legal disclaimer

This document is guidance and does not constitute legal advice. Before any public launch, it must be reviewed by a lawyer specialized in cryptoassets licensed in the jurisdiction of operation.

---

**Version:** 1.0 · Status: internal draft — confidential, not public.
