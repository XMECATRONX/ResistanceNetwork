# RSTN — Privacy Policy

**Last updated:** v1.0

---

## 1. Overview

RSTN is a decentralized, non-custodial blockchain protocol. This Privacy Policy describes how RSTN software handles data.

**Key principle: RSTN does not collect, store, or transmit personal data.**

## 2. Data We Do NOT Collect

RSTN software does **NOT** collect:
- Personal identification information (name, email, phone, address)
- Financial information (bank accounts, credit cards)
- Biometric data
- Browsing history
- Location data
- IP addresses (the software does not log or transmit your IP)

## 3. Data Stored Locally (On Your Device)

### 3.1 RSTN Wallet Extension
- **Encrypted private keys** — stored in browser's secure storage, encrypted with your password
- **Seed phrase** — stored encrypted, never in plaintext
- **Account addresses** — your public rstn1... addresses
- **Transaction history** — cached locally for display, sourced from the blockchain

**Your private keys never leave your device. RSTN does not have access to your keys.**

### 3.2 RSTN Terminal (Web)
- **Language preference** — stored in localStorage
- **Active view** — current terminal tab (session only)
- **RPC endpoint** — connection URL to a RSTN node

No personal data is stored in cookies or localStorage.

## 4. On-Chain Data (Public)

The RSTN blockchain is public and immutable. The following data is visible to anyone:

- **Transaction amounts and recipients** — public on the blockchain
- **Validator addresses and stake amounts** — public
- **Governance votes** — public
- **Smart contract code and state** — public
- **Public keys** — public (Dilithium3 public keys, 1952 bytes)

**This data cannot be deleted or modified once written to the blockchain.**

### 4.1 Your Responsibility
- Do not include personal data in transaction payloads
- Do not associate your real identity with your rstn1... address on public forums
- Use stealth addresses (supported by the protocol) to reduce linkability

## 5. Data We Process

### 5.1 RPC Node Communication
When you interact with a Resistance RPC node:
- **Your IP address** is visible to the node operator (standard internet behavior)
- **Your rstn1... address** is sent when querying balances or sending transactions
- **Signed transactions** are sent to the node for inclusion in blocks

**Recommendation:** Run your own node to avoid sharing your IP with third-party node operators.

### 5.2 Faucet (Testnet Only)
- **Your rstn1... address** is sent to claim testnet RSTN
- **Rate limiting** is applied per address (1 claim per hour)
- **No personal data** is collected
- Testnet tokens have **no monetary value**

## 6. Third-Party Services

RSTN software does not integrate third-party analytics, advertising, or tracking services.

The RSTN Wallet extension does not use:
- Google Analytics
- Facebook Pixel
- Mixpanel
- Sentry
- Any other tracking SDK

## 7. GDPR Rights (EU Users)

Under the General Data Protection Regulation (GDPR), you have rights regarding your personal data. However, since RSTN does not collect personal data:

- **Right to access** — RSTN has no personal data about you to access
- **Right to rectification** — RSTN has no personal data to correct
- **Right to erasure** — On-chain data cannot be deleted (blockchain immutability). Local data (keys) can be deleted by removing the wallet extension
- **Right to portability** — You can export your keys at any time
- **Right to object** — Resistance does not process personal data

### 7.1 On-Chain Data and GDPR
The blockchain is immutable. If you associate your identity with a rstn1... address, that association cannot be removed from the blockchain. **You are responsible for protecting your privacy on-chain.**

## 8. CCPA Rights (California Users)

Under the California Consumer Privacy Act (CCPA):
- RSTN does not sell personal data (we don't collect it)
- RSTN does not share personal data with third parties
- You have the right to know what data is collected (none)
- You have the right to delete data (delete the wallet extension)

## 9. Children's Privacy

RSTN software is not directed at children under 18. We do not knowingly collect data from children. If you believe a child has provided data, contact us (no data is collected, but we will investigate).

## 10. Data Security

### 10.1 Local Data
- Private keys are encrypted with AES-256 in browser storage
- Seed phrases are encrypted and require a password to view
- Keys are never transmitted in plaintext

### 10.2 On-Chain Data
- All transactions are signed with Dilithium3 (post-quantum resistant)
- Transport encryption uses Kyber768 + X25519 (hybrid post-quantum)
- The blockchain is secured by BFT consensus with 1,000+ validators

## 11. Changes to This Policy

This Privacy Policy may be updated. Changes will be posted in this document with an updated date.

## 12. Contact

For privacy inquiries: privacy@rstn.network (to be established)

---

*This Privacy Policy is provided as a template. It must be reviewed by a qualified attorney before any public launch.*
