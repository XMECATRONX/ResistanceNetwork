#!/usr/bin/env bash
#
# RSTN E2E — Real transfer test (A3)
#
# Proves a signed RSTN transfer moves real balance between two addresses
# on a running node. Uses rstn_debugSendTx (testnet-only) to sign with the
# node's validator keypair, then verifies the recipient balance changed.
#
# Prerequisite: a node running in dev/testnet mode:
#   ./target/release/rstn-node --dev --port 9944
#
# Usage:
#   ./scripts/e2e-transfer.sh                 # default RPC :9944
#   ./scripts/e2e-transfer.sh 9946            # custom RPC port
#
set -euo pipefail

RPC_PORT="${1:-9944}"
RPC="http://localhost:${RPC_PORT}"
AMOUNT="5000000000000000000"   # 5 RSTN (18 decimals)

echo "=========================================="
echo "  RSTN E2E — Transfer Test (A3)"
echo "=========================================="
echo "  RPC:  ${RPC}"
echo "  Amount: 5 RSTN"
echo "=========================================="
echo ""

# --- 1. Health check -------------------------------------------------------
echo "[1/6] Health check..."
HEALTH=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":0,"method":"rstn_health","params":[]}' || echo "FAIL")
echo "  -> $HEALTH"
echo "$HEALTH" | grep -q '"result":true' || { echo "[FAIL] Node not healthy"; exit 1; }

# --- 2. Get validator (sender) address ------------------------------------
echo ""
echo "[2/6] Fetching sender (validator) address..."
SENDER=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":0,"method":"rstn_getTopValidators","params":[1]}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['address'])")
echo "  Sender: $SENDER"

# --- 3. Generate a fresh recipient address --------------------------------
# Use a fixed known test address (20 bytes). This is a throwaway dev address.
RECIPIENT="rstn1deadbeef00000000000000000000deadbeef00"
echo ""
echo "[3/6] Recipient: $RECIPIENT"

# --- 4. Record recipient balance BEFORE -----------------------------------
echo ""
echo "[4/6] Recipient balance BEFORE transfer..."
BAL_BEFORE=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":0,\"method\":\"rstn_getBalance\",\"params\":[\"$RECIPIENT\"]}" \
  | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('result',{}).get('balance','0'))" 2>/dev/null || echo "0")
echo "  Balance before: $BAL_BEFORE"

# --- 5. Submit signed transfer --------------------------------------------
echo ""
echo "[5/6] Submitting signed transfer (5 RSTN)..."
TX=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":0,\"method\":\"rstn_debugSendTx\",\"params\":[{\"to\":\"$RECIPIENT\",\"value\":\"$AMOUNT\",\"tx_type\":\"Transfer\"}]}")
echo "  -> $TX"
echo "$TX" | grep -q '"hash"' || { echo "[FAIL] Transaction rejected"; exit 1; }
TXHASH=$(echo "$TX" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['hash'])")
echo "  Tx hash: $TXHASH"

# --- 6. Wait for finalization + verify balance AFTER ----------------------
echo ""
echo "[6/6] Waiting for block finalization (8s)..."
sleep 8

BAL_AFTER=$(curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":0,\"method\":\"rstn_getBalance\",\"params\":[\"$RECIPIENT\"]}" \
  | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('result',{}).get('balance','0'))" 2>/dev/null || echo "0")
echo "  Balance after:  $BAL_AFTER"

if [ "$BAL_AFTER" != "$BAL_BEFORE" ]; then
  echo ""
  echo "=========================================="
  echo "  [PASS] Transfer finalized on-chain"
  echo "  Recipient balance changed: $BAL_BEFORE -> $BAL_AFTER"
  echo "=========================================="
  exit 0
else
  echo ""
  echo "[FAIL] Recipient balance unchanged — tx not finalized"
  exit 1
fi
