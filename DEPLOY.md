# RSTN — Deployment Guide

> Step-by-step guide to deploy Resistance from local development to mainnet.

---

## Table of Contents

1. [Local Development](#1-local-development)
2. [Testnet Private (4-7 nodes)](#2-testnet-private)
3. [Testnet Public](#3-testnet-public)
4. [Wallet Extension](#4-wallet-extension)
5. [Mainnet Preparation](#5-mainnet-preparation)
6. [Monitoring](#6-monitoring)

---

## 1. Local Development

### Prerequisites

```bash
# Rust (for node)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable

# Node.js 18+ (for frontend)
node --version  # must be >= 18
```

### Start the node

```bash
cd rstn-node
cargo build --release

# Single node dev mode (no P2P, instant finality)
./target/release/rstn-node --dev run

# Verify it responds
curl -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"rstn_health","params":[]}'
# Expected: {"jsonrpc":"2.0","id":1,"result":true}
```

### Start the frontend

```bash
# In project root
npm install
npm run dev
# Frontend at http://localhost:8080
```

### Connect frontend to node

In `src/lib/api.ts`:
```typescript
export const RPC_MODE = true;
export const RPC_ENDPOINT = "http://localhost:9944";
```

In `src/lib/wallet.ts`:
```typescript
const WALLET_MODE = "resistance";
```

### Checklist (local)

- [ ] `cargo build --release` compiles without errors
- [ ] Node starts and produces genesis blocks
- [ ] `resist_health` returns `true`
- [ ] `resist_getBalance` responds for genesis accounts
- [ ] Wallet extension connects and signs transactions
- [ ] Faucet delivers testnet RSTN
- [ ] Transactions appear in the block explorer

---

## 2. Testnet Private

### Infrastructure

```
MINIMUM: 4 nodes (BFT tolerance: f=1)
RECOMMENDED: 7 nodes (BFT tolerance: f=2)

  Node 1: 4 vCPU / 8GB RAM / 100GB SSD  (validator + seed)
  Node 2: 4 vCPU / 8GB RAM / 100GB SSD  (validator)
  Node 3: 2 vCPU / 4GB RAM / 80GB SSD   (validator)
  Node 4: 2 vCPU / 4GB RAM / 80GB SSD   (full node + public RPC)

Distribute across 3+ geographic regions.
```

### Providers

| Provider | Region | Cost/month |
|---|---|---|
| Hetzner | Europe | €15-30/node |
| DigitalOcean | USA/Europe | $24-48/node |
| Vultr | Asia/Europe/USA | $24-40/node |

### Deploy each node

```bash
# 1. SSH into VPS
ssh root@your-vps

# 2. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 3. Clone and build
git clone https://github.com/resistance/rstn-node.git
cd rstn-node
cargo build --release

# 4. Generate validator keypair
./target/release/rstn-node keygen

# 5. Start node 1 (seed + validator)
./target/release/rstn-node run \
  --port 9944 \
  --p2p-port 9945 \
  --stake 32000

# 6. Start node 2 (connects to node 1)
./target/release/rstn-node run \
  --port 9946 \
  --p2p-port 9947 \
  --peers /ip4/127.0.0.1/tcp/9945 \
  --stake 32000

# 7. Start node 3 (connects to node 1)
./target/release/rstn-node run \
  --port 9948 \
  --p2p-port 9949 \
  --peers /ip4/127.0.0.1/tcp/9945 \
  --stake 32000
```

### systemd service

```bash
sudo tee /etc/systemd/system/resistance.service << 'EOF'
[Unit]
Description=Resistance Node
After=network.target

[Service]
Type=simple
User=resistance
ExecStart=/home/resistance/rstn-node/target/release/rstn-node --config /home/resistance/rstn-node/config.toml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable resistance
sudo systemctl start resistance
```

### Critical tests

```
TEST 1 — Sync: Start node 4 from scratch → must sync full history
TEST 2 — Fault tolerance: Stop 2 of 7 nodes → network keeps producing blocks
TEST 3 — Network partition: Split into 2 groups → majority group continues
TEST 4 — Real transactions: Send 1000 txs from wallet → all confirmed <2s
TEST 5 — Staking + slashing: Delegate RSTN → validator double-signs → auto slash
TEST 6 — Bridge simulator: Execute lock → SPV verify → mint E2E
```

### Checklist (private testnet)

- [ ] 7 nodes producing blocks across 3 regions
- [ ] Sync from scratch < 30 min
- [ ] Tolerates 2 node failures without interruption
- [ ] 1000 TPS sustained without degradation
- [ ] Staking and slashing working on-chain
- [ ] Bridge simulator E2E against real nodes
- [ ] Uptime >99% for 7 consecutive days

---

## 3. Testnet Public

### Public infrastructure

```
RPC public:    rpc.testnet.rstn.network:9944
Explorer:     explorer.testnet.rstn.network
Faucet:        faucet.testnet.rstn.network
Status page:  status.rstn.network
```

### Documentation to publish

- Node installation guide (docs.rstn.network/run-a-node)
- Wallet guide (docs.rstn.network/wallet)
- API reference (docs.rstn.network/api)
- Video tutorials (YouTube)

### Incentives

- Bug bounty (paid in future mainnet RSTN)
- Node operator program (top 10 operators receive NFT)
- Hackathon with prizes for first dApps

### Monitoring

```
Grafana + Prometheus for network metrics
Auto-alerts (Telegram/Discord) if:
  - Node goes down
  - Latency > 5s
  - TPS drops < 50% of average
  - Fork detected
Public real-time dashboard
```

### Metrics to track

```
Network health:
  Active nodes (target: >20)
  Geographic distribution (target: >5 countries)
  Average TPS (target: >500)
  P99 latency (target: <2s)
  Finality time (target: <1s)
  Uptime (target: >99.5%)

Security:
  Double-spend attempts (must be 0)
  Forks detected (must be 0)
  Invalid transactions rejected (must be 100%)

Adoption:
  Wallets created (target: >1000)
  Daily transactions (target: >500)
  dApps deployed (target: >5)
  TVL in staking (target: >1M RSTN testnet)
```

### Checklist (public testnet)

- [ ] 20+ community nodes active
- [ ] 1000+ wallets created
- [ ] 500+ daily transactions
- [ ] 5+ community-deployed dApps
- [ ] Uptime >99.5% for 30 days
- [ ] Zero forks, zero double-spends
- [ ] Bug bounty active with 10+ resolved reports

---

## 4. Wallet Extension

### Load in development

```bash
# 1. Generate icons in rstn-wallet/assets/ (16×16, 48×48, 128×128 PNG)
# 2. Open chrome://extensions/
# 3. Enable "Developer mode"
# 4. Click "Load unpacked"
# 5. Select rstn-wallet/ folder
```

### Publish to Chrome Web Store

```bash
# 1. Create developer account ($5 one-time fee)
# 2. Zip the extension:
cd rstn-wallet && zip -r rstn-wallet.zip . -x "*.git*"

# 3. Upload to Chrome Web Store Developer Dashboard
# 4. Fill metadata: name, description, screenshots, category
# 5. Submit for review (1-3 days)
```

### Firefox Add-on

```bash
# Same codebase, different manifest format
# Use web-ext tool:
npm install -g web-ext
cd rstn-wallet
web-ext build
web-ext sign --api-key=$AMO_KEY --api-secret=$AMO_SECRET
```

---

## 5. Mainnet Preparation

### Genesis final

```
1. Snapshot testnet (balances, staking, governance)
2. Select 21-64 initial validators from testnet
3. Final economic parameters:
   - Supply: 1,000,000,000 RSTN
   - Bridge fee: 0.15% standard + 0.05% fast-path
   - Revenue split: 60% burn / 30% stakers / 10% treasury
   - EIP-1559: 50% base fee burned, priority fee to validator
   - Quantum Migration: free
4. Deploy bridge contracts on BTC, ETH
5. Generate genesis block with Merkle root of all allocations
```

### Validator selection

```
- 21-64 validators selected from testnet
- Geographic distribution required (min 5 countries)
- No single entity controls >20% of validators
- KYC/AML if jurisdiction requires
- SLA agreement signed
```

### Infrastructure

```
RPC public:     rpc.rstn.network
Explorer:       explorer.rstn.network
Bridge UI:      bridge.rstn.network
Status:         status.rstn.network
Faucet:         NO (mainnet has no faucet)
```

### Launch day checklist

```
T-72h: Code freeze, backup testnet, publish genesis hash
T-24h: Validators start with final genesis, verify sync
T-0:    Genesis block produced, verify 21+ validators active
        Open public RPC, public announcement
T+1h:  First real transactions, verify fee burn
T+24h: First buyback & burn executed, verify supply decrease
T+7d:  Post-launch audit, incident review, parameter adjustments
```

---

## 6. Monitoring

### Prometheus metrics (port 9090)

| Metric | Key | Healthy |
|---|---|---|
| Block height | `resist_block_height` | Growing continuously |
| P2P peers | `resist_p2p_peers` | > 30 |
| P2P latency | `resist_p2p_latency_ms` | < 100ms |
| Blocks produced | `resist_validator_blocks_produced` | Growing per epoch |
| Uptime | `resist_validator_uptime` | > 99% |
| Effective stake | `resist_validator_effective_stake` | ≥ 32,000 |
| CPU usage | `resist_resource_cpu` | < 70% |
| RAM usage | `resist_resource_ram` | < 80% |
| Disk usage | `resist_resource_disk` | < 100GB |

### Grafana dashboard

```bash
# Preconfigured dashboard included
docker compose up rstn-monitor
# Access at http://localhost:3000
```

### Alert rules

| Level | Condition | Action |
|---|---|---|
| Critical | Peers < 10 | Check internet + firewall, restart node |
| Critical | Uptime < 90% | Validator will be slashed — check hardware |
| Warning | CPU > 80% | Consider hardware upgrade |
| Warning | Latency > 200ms | Move VPS closer to peers |
| Info | New version available | Run `rstn-node upgrade` |

---

## Incident Response

| Severity | Description | Response time | Action |
|---|---|---|---|
| SEV-0 | Existential threat (funds at risk) | < 1 min | Emergency fork in 72h |
| SEV-1 | Significant loss (>$1M at risk) | < 10 min | Hotfix in 24h |
| SEV-2 | Degradation (no fund loss) | < 1 hour | Patch next epoch |
| SEV-3 | Minor (cosmetic/performance) | < 24 hours | Fix next release |

All SEV-0 and SEV-1 incidents are published publicly within 72 hours.

---

## Budget Estimates

| Phase | Cost |
|---|---|
| Local development | $0 (your time) |
| Private testnet | $200-500/month (VPS) |
| Public testnet | $500-1500/month (VPS + monitoring) |
| External audits | $230K-$600K total |
| Pre-mainnet | $1000-3000/month (infra) |
| Mainnet | $2000-5000/month (infra + monitoring) |
| **Year 1 total** | **$300K-$700K** (audits are 60-80%) |
