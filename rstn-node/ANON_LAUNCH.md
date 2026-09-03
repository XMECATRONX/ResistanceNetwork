# RSTN — Anonymous Launch manual (Satoshi-style)

> Internal guide for the team. Do not publish this document. Its purpose is
> to allow the protocol to go public without linking it to an identifiable
> individual.

---

## Philosophy

Satoshi Nakamoto hid their **identity**, not their **methodology**. They
published the whitepaper, opened the code, and responded in public forums.
What they hid was *who they were*.

Resistance follows the same logic: the protocol is public, transparent and
auditable. The person who coordinates it does not need to be.

> Important: identity anonymity does NOT mean methodology opacity.
> Making false claims about how the protocol was built is a greater legal
> and reputational risk than honest transparency.

---

## Non-negotiable principles

1. **Do not claim individual authorship.** The protocol is signed "RSTN",
   not a person.
2. **Do not lie about the methodology.** Do not say "I built it all by hand."
   Tell the truth: "built with modern development tools."
3. **Total technical transparency.** Open code, public tests, public
   whitepaper, public roadmap.
4. **No personal data in the repository.** Not in commits, not in issues,
   not in docs, not in metadata.

---

## Pre-publication checklist (already met in the code)

- [x] README with no personal author
- [x] WHITEPAPER with no personal author
- [x] package.json without `author`/`homepage`/`repository` field
- [x] index.html with neutral metadata ("RSTN", not a person)
- [x] Internal docs without "Project Director" or signed dates
- [x] LICENSE Apache 2.0 (neutral, no name)
- [x] No personal emails in the code

---

## Infrastructure that does not expose you

### Commit identity (local configuration on your Mac)

Before any public push, configure git so commits do not carry your real
name/email:

```bash
cd ~/Desktop/RESISTANCE
git config user.name "RSTN"
git config user.email "noreply@rstn.network"
```

This makes every commit in the history say "RSTN" instead of your real
name. It is the only configuration you need to anonymize the git history.

> Note: earlier commits (if they already have your name) retain your name.
> For a clean launch, the history can be rewritten with `git filter-repo`
> before going public. Optional but recommended.

### Domain hosting

- **Domain**: register `rstn.network` (or similar) under a registrar that
  accepts WHOIS privacy (Namecheap, Cloudflare, Porkbun). WHOIS does not show
  your real name.
- **DNS**: Cloudflare (free, hides the server IP).
- **Frontend hosting**: Vercel/Netlify/Cloudflare Pages, deployed with a
  token from the "RSTN" account (not your personal GitHub account).

### Public testnet hosting

- **VPS**: Hetzner or OVH (they accept crypto payment, do not require
  operator KYC for small VPS).
- **Payments**: pay the VPS with crypto (BTC/ETH/XMR) via a provider that
  does not require KYC (Lunanode, CoinGate, or direct Monero).
- **Do NOT** use a VPS that requires a credit card in your name.

---

## Anonymous communication channels

### Discord / Telegram

1. Create an account with a burner email (ProtonMail or SimpleLogin).
2. Account name: "RSTN" (not your name).
3. Do not use the same account as for other projects (IP correlation).
4. Do not use a profile photo that identifies you.
5. Consider VPN/Tor to access (at least at the start).

### GitHub

1. New account: `rstn-network` (not your personal account).
2. Account email: `noreply@rstn.network` (via Cloudflare email routing).
3. 2FA with an authenticator app (not SMS — SMS reveals your number).
4. If you pay for GitHub Pro: pay with crypto via a provider that accepts XMR.

### Twitter/X

- "ResistanceNetwork" account with a burner email.
- Do not use the same IP as your personal account.
- Do not link to LinkedIn, personal GitHub, or any profile that identifies you.

---

## What NOT to do

1. **Do not** say "I built it all alone" — it is false and detectable.
2. **Do not** put your photo or real name in any channel.
3. **Do not** use the same device/network to access Resistance channels and
   your personal accounts (IP/browser fingerprint correlation).
4. **Do not** talk about the project in forums where you are already known by
   your real name.
5. **Do not** receive project payments in a wallet in your name.
6. **Do not** use a domain you registered in your name (use WHOIS privacy).

---

## Honest limitations (what CANNOT be guaranteed)

- **Git log development pattern**: hundreds of commits in days, uniform
  style. Forensic analysis of the history may infer there was a single
  developer assisted by tools. It cannot be eliminated without rewriting
  the entire history, and rewriting it leaves its own pattern.
- **Consistent code style**: it is analyzable but does not reveal identity,
  only methodology. Not a legal problem.
- **Browser fingerprint**: if you access public channels from your Mac
  without VPN, your IP is visible to the administrators of those channels.

These limitations are not legal vulnerabilities. They are the realistic cost
of anonymity in 2026. Promising otherwise would be deceptive.

---

## Public exposure plan (phases)

### Phase 1 — Public testnet (valueless tokens)

- Publish the node binary on GitHub (rstn-network account).
- Publish the README + WHITEPAPER (already neutral).
- Spin up 4-8 validators on VPS paid with crypto.
- Open Discord/Telegram with a burner account.
- Active faucet (valueless tokens, no KYC required).
- Block explorer at `explorer.rstn.network`.

> In this phase the legal risk is minimal because there is no real value.
> This is the time to build community and validators before mainnet.

### Phase 2 — External audit

- Hire Trail of Bits / Quantstamp / Halborn.
- They work with the "RSTN" entity, not with a person.
- The audit is published on GitHub. This generates credibility.
- Budget: $40K-$150K (pay via the Foundation treasury, not personal).

### Phase 3 — Legal entity (Foundation)

- Register a Foundation in Switzerland/Singapore/Panama.
- The lawyer knows your identity (legal KYC), but the public does not.
- The token becomes issued by the Foundation, not by "you".
- This is what differentiates an anonymous launch in 2026 from one in 2009:
  the rules require a legal entity for the bridge and the token.

### Phase 4 — Mainnet

- Only after: clean audit + Foundation registered + 16+ independent
  validators + bug bounty executed 30+ days.
- Genesis block with fair launch distribution (no allocation to founders).
- Bridge activated with initial capacity limits.

---

## Summary

| Item | Action | Who does it |
|------|--------|--------------|
| Commits | `git config user.name "RSTN"` | You, on your Mac |
| Domain | WHOIS privacy | You, via registrar |
| VPS | Pay with crypto, no KYC | You, via provider |
| GitHub | New rstn-network account | You |
| Discord | Burner account | You |
| Audit | Hire a firm | Foundation (Phase 3) |
| Token | Issue via Foundation | Foundation (Phase 3) |

**The golden rule**: the protocol's identity is "RSTN". Yours does not
appear on any public surface. The methodology is transparent (open code,
tests, whitepaper). That is what Satoshi did. That is what we replicate.

---

**Version:** 1.0 · Status: internal guide — confidential, do not publish.
