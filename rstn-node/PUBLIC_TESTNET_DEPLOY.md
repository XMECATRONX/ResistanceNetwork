# Resistance Public Testnet — Deployment Guide

This guide covers the operational steps to take the RSTN node from a local
4-node testnet to a **public testnet** open to external validators and users.

## Status

- Local testnet (4 nodes): **operational** (consensus + bridge E2E green)
- VM: 33 opcode tests green, Solidity deploy verified (=42)
- Consensus: 23 BFT tests green
- Bridge: 8/8 E2E steps green (lock/mint/burn/release)
- Wallet: Chrome MV3, network selector with Local/Public presets

## Prerequisites

- Rust toolchain (stable, 1.75+)
- A public VPS (or bare metal) with:
  - Static public IP
  - Open ports: 9944 (RPC), 9945 (P2P)
  - 4 vCPU / 8 GB RAM minimum
- Domain name pointing to the VPS (for TLS termination)
- TLS certificate (Let's Encrypt / Caddy / nginx reverse proxy)

## 1. Build the node

```bash
cd rstn-node
cargo build --release
# Binary: target/release/rstn-node
```

## 2. Generate genesis with public validators

Generate keypairs for each public validator and build genesis:

```bash
./scripts/generate-genesis.sh 4   # 4 validators
```

Distribute the genesis.json and each validator's keypair securely (out of
band). Each validator operator runs their own node with their own keypair.

## 3. Launch a seed node (node 0)

```bash
rstn-node \
  --genesis genesis.json \
  --validator-index 0 \
  --port 9944 \
  --p2p-port 9945 \
  --testnet
```

The `--testnet` flag enables:
- Bridge auto-execute (threshold = 1, single-validator committee)
- Faucet (1000 RSTN / 24h per address)
- Relaxed rate limits

## 4. Launch additional validators

Each subsequent node connects to the seed:

```bash
rstn-node \
  --genesis genesis.json \
  --validator-index 1 \
  --port 9946 \
  --p2p-port 9947 \
  --peers /ip4/<SEED_IP>/tcp/9945 \
  --testnet
```

## 5. Sync for joining nodes (S2)

A new node that joins later (no local blocks) syncs from peers via the
`resist_getBlocksByRange(from, to)` RPC method:

```bash
# Ask a peer for missing blocks, capped at 500 per call
curl -X POST http://<PEER>:9944 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"rstn_getBlocksByRange","params":[0,500]}'
```

Sync status is reported by `resist_getSyncStatus`:

```bash
curl -X POST http://<NODE>:9944 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"rstn_getSyncStatus","params":[]}'
# { "localHeight": 0, "latestKnownHeight": 5000, "catchingUp": true }
```

## 6. Public RPC endpoint

Front the RPC with a TLS-terminating reverse proxy (Caddy recommended):

```caddy
rpc.rstn.network {
  reverse_proxy localhost:9944
}
```

Apply CORS + rate limiting at the proxy layer. The node already enforces:
- 50 requests/sec per IP
- 500 requests/min per IP
- Optional API key auth (`resist_setApiKey`)

## 7. Faucet

The faucet is built into the node RPC (`resist_faucetClaim`). Expose it via
the public RPC. Each address can claim 1000 RSTN once per 24h.

## 8. Block explorer

The frontend terminal at `/terminal` already functions as a live explorer
(blocks, txs, validators, bridge). Point it at the public RPC by setting
the RPC URL in `src/lib/api.ts` (or via the wallet network selector).

## 9. Status page & monitoring

- `resist_health` -> bool (node liveness)
- `resist_getNetworkStats` -> height, validators, TPS, shard count
- `resist_getSyncStatus` -> local vs known height, catchingUp flag

Wire these into a Grafana dashboard (the terminal's Monitoring view shows
the layout). For production, scrape these via a poller and feed Prometheus.

## 10. Known limitations (testnet)

- **P2P transport is classical Noise (X25519)**, not post-quantum. The PQ
  hybrid handshake (Kyber768 + X25519 + Dilithium3) is implemented in
  `rstn-crypto` and used at the application/consensus layer, but the
  libp2p wire transport is still classical. Upgrading to a custom PQ
  `Transport` is tracked as a mainnet prerequisite.
- **State sync is block-by-block** (no snapshots/pruning). A Sparse Merkle
  Tree is a mainnet prerequisite for scale.
- **No WebSocket subscriptions** — the frontend polls.

## Checklist before opening to public

- [ ] Genesis generated with public validator keypairs
- [ ] Seed node running with `--testnet` on public IP
- [ ] TLS reverse proxy in front of RPC (https://rpc.rstn.network)
- [ ] At least 3 additional validator nodes peered
- [ ] Faucet reachable via public RPC
- [ ] Explorer (terminal) pointed at public RPC
- [ ] Status page / Grafana monitoring the 4 health endpoints
- [ ] Firewall: only 9944 (RPC) and 9945 (P2P) exposed
