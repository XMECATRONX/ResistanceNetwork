# RSTN — Howey Analysis Memorandum (for external securities counsel)

> **Purpose:** This is a focused, standalone memo for a U.S. securities lawyer
> (Cooley, Latham & Watkins, WilmerHale, or similar). It applies the four-prong
> Howey test to the RSTN token and documents the factual basis for each element.
> It is **not** legal advice — it is the factual record the lawyer needs to
> issue a formal "no-security" opinion or No-Action Letter request.
>
> **Status:** Internal analysis. Requires external counsel sign-off pre-mainnet.

---

## 1. The Howey Test — 4 prongs

A transaction is an "investment contract" (a security) **only if ALL four
prongs are met**. Failing any single prong means RSTN is **not** a security
under Howey.

| # | Prong | RSTN meets it? | Confidence |
|---|-------|----------------|------------|
| 1 | Investment of money | **Disputable** | MEDIUM |
| 2 | Common enterprise | **No** | HIGH |
| 3 | Expectation of profits | **Disputable** | MEDIUM |
| 4 | Efforts of others (promoter) | **No** | HIGH |

**Bottom line:** Prongs 2 and 4 fail. Even if 1 and 3 are arguable, the
conjunction of all four is not satisfied. This is the basis for a "no-security"
opinion.

---

## 2. Prong 1 — Investment of money

### The test
Is there an investment of money (or other consideration) in a common venture?

### RSTN facts
- **No ICO, no pre-sale, no token sale.** The token distribution model is
  documented in `src/lib/protocol.ts` and `src/lib/protocolMonetary.ts`:
  0% team, 0% treasury, 0% pre-sale. This is a "Satoshi pure" fair launch.
- **No investment required to acquire RSTN.** Tokens are distributed via:
  - Block production rewards (validator fees)
  - Staking rewards (compensation for validation service)
  - Governance participation
- **Staking is not an "investment."** The SEC's 2025-2026 guidance clarifies
  that protocol-level staking (self-staking, delegated staking where the user
  retains custody) is generally **not** an investment contract — it is
  compensation for a service (validation).

### Risk factors
- A user who **buys** RSTN on a secondary market (exchange) has invested money.
  But this is a secondary-market purchase, not a sale by the issuer. The Howey
  analysis focuses on the **issuer's** transaction, not secondary trading.
- The "fair launch" must be documented with on-chain evidence: no genesis
  allocation to any party, no pre-mine, no founder wallet.

### Evidence to provide counsel
- `src/lib/protocolMonetary.ts` — the monetary policy (0% team/treasury/pre-sale)
- `rstn-node/crates/rstn-core/src/genesis.rs` — the genesis block (no allocation)
- `WHITEPAPER.md` — the distribution model

---

## 3. Prong 2 — Common enterprise

### The test
Is there a common enterprise where the fortunes of investors are tied to the
efforts of a promoter or third party? (Horizontal commonality = investors
pool; vertical commonality = investor fortunes tied to promoter.)

### RSTN facts
- **No promoter entity.** RSTN has no foundation, no company, no treasury
  wallet, no team allocation. The protocol is open-source under Apache 2.0.
- **No pooled funds.** Stakers do not pool capital — each validator stakes
  independently and earns independently. There is no shared pool of investor
  money managed by a central party.
- **No vertical commonality.** There is no promoter whose fortunes are tied
  to the investors. The "team" receives 0% — there is no team wallet.
- **Decentralized governance.** Protocol changes require on-chain governance
  (supermajority vote). No single party controls the protocol.

### Conclusion
**Prong 2 fails.** There is no common enterprise. This is the strongest
argument against security classification.

### Evidence to provide counsel
- `NO_ADMIN_KEY.md` — documents that no admin key exists
- `src/lib/protocol.ts` — governance model (on-chain, supermajority)
- `rstn-node/crates/rstn-core/src/governance.rs` — governance implementation

---

## 4. Prong 3 — Expectation of profits

### The test
Did investors invest with the expectation of profits derived from the efforts
of others?

### RSTN facts
- **Staking rewards are service compensation, not profit.** Validators earn
  fees for performing validation work (block production, attestation). This is
  compensation for labor, not a return on investment.
- **No "yield" or "APY" guarantees.** The frontend uses "Variable" (not a
  fixed APY) and explicitly states rewards are not guaranteed.
- **Burn mechanism is a scarcity feature, not a profit promise.** The EIP-1559
  base-fee burn reduces supply, but the protocol does not promise token price
  appreciation. The whitepaper describes it as "scarcity," not "profit."

### Risk factors (must be addressed)
1. **Marketing language.** Any public communication that implies price
   appreciation ("deflationary," "moon," "100x") creates an expectation of
   profits. **All marketing must be audited** before launch.
2. **"Deflationary" framing.** The term "deflationary" implies the token will
   increase in value. **Recommendation:** replace with "scarcity mechanism"
   in all public-facing copy.
3. **Staking APY display.** Showing an APY (even "Variable") implies a return.
   **Recommendation:** frame as "validator compensation" not "staking yield."

### Evidence to provide counsel
- `src/lib/protocolMonetary.ts` — fee model (burn + validator tip, no yield promise)
- `src/lib/locales/en.ts` and `es.ts` — all marketing copy (must be audited)
- `MARKETING_TOKEN_PLAN.md` — marketing plan (must be audited for profit language)

---

## 5. Prong 4 — Efforts of others

### The test
Are the expected profits derived from the entrepreneurial or managerial
efforts of others (a promoter)?

### RSTN facts
- **No promoter.** 0% team allocation means there is no party whose
  "managerial efforts" drive the value of the token. The "team" is not a
  team — it is anonymous open-source contributors.
- **Decentralized validation.** The network's security and value derive from
  the decentralized set of validators, not from a central promoter.
- **No vesting.** There is no team vesting schedule (because there is no team
  allocation). This eliminates the "efforts of the team" argument entirely.

### Risk factors
- **If a "team" emerges post-launch** and is publicly identified as driving
  development, the SEC may argue their efforts drive token value. Mitigation:
  development must remain decentralized/anonymous, or a foundation must be
  structured carefully (like the Ethereum Foundation, which did not receive a
  token allocation that vests).
- **The founder's public identity.** If the founder is publicly known and
  perceived as the driving force, prong 4 is stronger. **Recommendation:**
  operate under a pseudonym (like Satoshi) or structure any foundation to
  receive no token allocation.

### Conclusion
**Prong 4 fails.** No promoter, no team allocation, no vesting. This is the
second-strongest argument against security classification.

### Evidence to provide counsel
- `src/lib/protocolMonetary.ts` — 0% team allocation
- `NO_ADMIN_KEY.md` — no admin key, no centralized control
- `rstn-node/crates/rstn-core/src/genesis.rs` — genesis with no team wallet

---

## 6. SEC 2026 Taxonomy — Digital Commodity

In March 2026, the SEC-CFTC joint interpretation established a 5-category
taxonomy. RSTN's best classification is **Digital Commodity**:

| Category | RSTN? | Why |
|----------|-------|-----|
| Digital Commodity | **Yes** | Value derives from supply/demand + network usage, not from managerial efforts of a promoter |
| Digital Security | No | Fails Howey (prongs 2 and 4) |
| Digital Collectible | No | Not an NFT |
| Digital Tool | Partial | Has utility, but value is not purely utility-based |
| Stablecoin | No | Not backed 1:1 by fiat |

**Recommendation:** Pursue a formal "digital commodity" classification with
the SEC via a No-Action Letter request. The factual record in this memo
supports that request.

---

## 7. Pre-mainnet action items for counsel

1. **Review this memo** and confirm the Howey analysis.
2. **Audit all marketing copy** (`src/lib/locales/en.ts`, `es.ts`,
   `MARKETING_TOKEN_PLAN.md`, `WHITEPAPER.md`) for profit-promise language.
3. **Issue a formal "no-security" opinion letter** or file a No-Action Letter
   request with the SEC.
4. **Confirm the fair-launch record** — verify on-chain that the genesis block
   has no team/treasury allocation.
5. **Advise on founder anonymity** — whether operating under a pseudonym
   strengthens or weakens the prong-4 argument.
6. **Review the bridge structure** — the cross-chain bridge (if it custodies
   BTC) may trigger separate money-transmitter/VASP issues (see
   `LEGAL_AUDIT.md` §2-4). This is a **separate** legal question from Howey.

---

## 8. What this memo is NOT

- This is **not** a legal opinion. Only external counsel can issue one.
- This does **not** address money-transmitter licensing, AML/KYC, MiCA, or
  other regulatory issues — those are in `LEGAL_AUDIT.md`.
- This does **not** guarantee the SEC will agree. The SEC's enforcement
  approach is fact-specific and unpredictable. This memo documents the
  **strongest factual basis** for a "no-security" argument.
