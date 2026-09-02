#!/usr/bin/env bash
#
# RSTN E2E — Real staking test (A4)
#
# Proves a validator can stake real RSTN and the staked balance is reflected
# in the on-chain validator set. Uses rstn_stake (testnet-only shortcut that
# signs a Stake tx with the node keypair), then verifies the staked amount.
#
# Prerequisite: a node running in dev/testnet mode:
#   ./target/release/rstn-node --dev --port 9944
#
# Usage:
#   ./scripts/e2e-stake.sh                 # default RPC :9944
#   ./scripts/e2e-stake.sh 9946            # custom RPC port
#
set -euo pipefail

RPC_PORT="${1:-9944}"
RPC="http://localhost:${RPC_PORT}"
STAKE_AMOUNT="1000000000000000000"   # 1 RSTN (18 decimals)

echo "=========================================="
echo "  RSTN E2E — Staking Test (A4)"
echo "=========================================="
echo "  RPC:  ${RPC}"
echo "  Stake: 1 RSTN"
echo "=========================================="
echo ""

# --- 1. Health check -------------------------------------------------------
echo "[1/5] Health check..."
HEALTH=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":0,"method":"rstn_health","params":[]}' || echo "FAIL")
echo "$HEALTH" | grep -q '"result":true' || { echo "[FAIL] Node not healthy"; exit 1; }
echo "  -> healthy"

# --- 2. Get validator address + staked BEFORE -----------------------------
echo ""
echo "[2/5] Fetching validator staking info BEFORE..."
VALIDATORS_BEFORE=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":0,"method":"rstn_getStakingValidators","params":[]}')
STAKED_BEFORE=$(echo "$VALIDATORS_BEFORE" | python3 -c "
import sys,json
r=json.load(sys.stdin)
vs=r.get('result',[])
print(vs[0].get('staked','0') if vs else '0')
" 2>/dev/null || echo "0")
echo "  Staked before: $STAKED_BEFORE"

# --- 3. Submit stake -------------------------------------------------------
echo ""
echo "[3/5] Submitting stake (1 RSTN)..."
# Get the validator's own address
VAL_ADDR=$(echo "$VALIDATORS_BEFORE" | python3 -c "
import sys,json
r=json.load(sys.stdin)
vs=r.get('result',[])
print(vs[0].get('address','') if vs else '')
" 2>/dev/null || echo "")

if [ -z "$VAL_ADDR" ]; then
  echo "[FAIL] Could not determine validator address"
  exit 1
fi
echo "  Validator: $VAL_ADDR"

STAKE_TX=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":0,\"method\":\"rstn_stake\",\"params\":[{\"address\":\"$VAL_ADDR\",\"amount\":\"$STAKE_AMOUNT\"}]}")
echo "  -> $STAKE_TX"
echo "$STAKE_TX" | grep -q '"hash"' || { echo "[FAIL] Stake rejected"; exit 1; }

# --- 4. Wait for finalization ----------------------------------------------
echo ""
echo "[4/5] Waiting for block finalization (8s)..."
sleep 8

# --- 5. Verify staked AFTER ------------------------------------------------
echo ""
echo "[5/5] Fetching validator staking info AFTER..."
STAKED_AFTER=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":0,"method":"rstn_getStakingValidators","params":[]}' \
  | python3 -c "
import sys,json
r=json.load(sys.stdin)
vs=r.get('result',[])
print(vs[0].get('staked','0') if vs else '0')
" 2>/dev/null || echo "0")
echo "  Staked after:  $STAKED_AFTER"

if [ "$STAKED_AFTER" != "$STAKED_BEFORE" ]; then
  echo ""
  echo "=========================================="
  echo "  [PASS] Stake finalized on-chain"
  echo "  Staked changed: $STAKED_BEFORE -> $STAKED_AFTER"
  echo "=========================================="
  exit 0
else
  echo ""
  echo "[FAIL] Staked amount unchanged — stake not applied"
  exit 1
fi
