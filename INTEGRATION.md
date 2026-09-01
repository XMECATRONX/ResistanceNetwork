# RSTN — Frontend → Backend Integration Guide

## Overview

The frontend is architected with a **single data boundary**. All views consume data through `src/lib/api.ts` and `src/hooks/useApi.ts`. Today these read from mock data; tomorrow they'll read from `rstn-node` via JSON-RPC.

**To go live, you change 1 file (`api.ts`), not 11 views.**

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Views (ExplorerView, StakingView, OverviewView…) │
│         import from hooks/useApi.ts               │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  hooks/useApi.ts (React Query wrappers)           │
│  Caching, polling, error handling                 │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  lib/api.ts (THE data boundary)                   │
│  RPC_MODE = false → mock data (today)             │
│  RPC_MODE = true  → JSON-RPC to rstn-node        │
└──────────────────┬───────────────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
    ┌─────▼─────┐    ┌─────▼─────┐
    │ Mock Data │    │ rstn-node│
    │protocol.ts│    │ JSON-RPC  │
    └───────────┘    └───────────┘
```

---

## Step 1: Flip the switch

In `src/lib/api.ts`:

```typescript
export const RPC_MODE = false;  // ← change to true
```

That's it. Every view automatically starts hitting the RPC endpoint.

---

## Step 2: Implement the RPC methods in rstn-node

The frontend calls these JSON-RPC methods. Your Rust node must implement them:

### Network Stats
| Method | Params | Returns |
|--------|--------|---------|
| `resist_getNetworkStats` | none | `NetworkStats` object |
| `resist_getExplorerStats` | none | `ExplorerStats` object |
| `resist_health` | none | `{ status: "ok" }` |

### Blocks
| Method | Params | Returns |
|--------|--------|---------|
| `resist_getLatestBlocks` | `[limit: number]` | `Block[]` |
| `resist_getBlockByHeight` | `[height: number]` | `Block \| null` |

### Transactions
| Method | Params | Returns |
|--------|--------|---------|
| `resist_getLatestTransactions` | `[limit: number]` | `Transaction[]` |
| `resist_getTransactionByHash` | `[hash: string]` | `Transaction \| null` |
| `resist_sendTransaction` | `[signedTx: object]` | `txHash: string` |

### Validators
| Method | Params | Returns |
|--------|--------|---------|
| `resist_getTopValidators` | `[limit: number]` | `Validator[]` |

### Wallet & Staking
| Method | Params | Returns |
|--------|--------|---------|
| `resist_getBalance` | `[address: string]` | `WalletPortfolio` |
| `resist_getStakingValidators` | none | `StakingValidator[]` |
| `resist_getProposals` | none | `GovernanceProposal[]` |

---

## Step 3: Type contracts

The TypeScript interfaces in `api.ts` define the exact shape the frontend expects. Match these in your Rust serde structs:

```rust
// Example: Block struct in Rust
#[derive(Serialize, Deserialize)]
pub struct Block {
    pub height: u64,
    pub hash: String,
    pub validator: String,
    pub tx_count: u32,
    pub size: String,        // human-readable: "1.24 MB"
    pub age: String,         // human-readable: "2s"
    pub gas_used: String,
    pub gas_limit: String,
    pub shard: u32,
}
```

---

## Step 4: Wallet integration

In `src/lib/wallet.ts`, set:

```typescript
const WALLET_MODE = "resistance"; // was "mock"
```

Then implement `RstnWallet`:
1. Detect `window.rstn` (browser extension injection)
2. `connect()` → `window.rstn.connect()` returns address
3. `sign(params)` → `window.rstn.signTransaction(params)` returns `SignedTransaction`

The wallet must sign with **Dilithium3** post-quantum signatures.

---

## Step 5: RPC endpoint

Set the endpoint at runtime:

```javascript
// In browser console or bootstrap code:
window.__RSTN_RPC__ = "https://testnet.rstn.network:9944";
```

Or hardcode in `api.ts`:

```typescript
export const RPC_ENDPOINT = "https://testnet.rstn.network:9944";
```

---

## Polling intervals (defined in useApi.ts)

| Data | Interval | Reason |
|------|----------|--------|
| Blocks | 2s | New block every 200ms, but UI doesn't need every block |
| Explorer stats | 10s | Stats change slowly |
| Validators | 30s | Validator set changes per epoch |
| Staking | 60s | Prices/rewards update slowly |

These can be tuned. For WebSocket subscriptions (push instead of poll), replace `useQuery` with `useSubscription` when the node supports WS.

---

## Files to NEVER modify when going live

- `src/components/views/*.tsx` — they consume hooks, not API directly
- `src/components/dashboard/*.tsx` — same
- `src/pages/*.tsx` — same

## Files to modify when going live

1. `src/lib/api.ts` — flip `RPC_MODE`, set `RPC_ENDPOINT`
2. `src/lib/wallet.ts` — flip `WALLET_MODE`, implement `RstnWallet`
3. (Optional) `src/hooks/useApi.ts` — adjust polling intervals or add WS subscriptions
