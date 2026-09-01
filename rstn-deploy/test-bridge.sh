#!/usr/bin/env bash
# RSTN Bridge -- E2E Test Script
# Exercises the full lock/mint -> burn/release flow against the live testnet.
set -euo pipefail

RPC="http://localhost:9944"
# Use the deployer address (valid bech32 rstn address from rstn-deploy/rstn-key.json)
USER_ADDR="rstn1a42f029394e7abb955b5d3230ea7541200cca775"
CHAIN="Bitcoin"
AMOUNT=1000
SOURCE_TXID="a1b2c3d4e5f6789a"

rpc() {
  local method="$1"
  local params="$2"
  curl -s -X POST "$RPC" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$params}" \
    | python3 -m json.tool
}

echo "=========================================="
echo "  RSTN Bridge -- E2E Test"
echo "=========================================="
echo ""

echo "-- 1. Initial reserves (should be all zeros) --"
rpc "rstn_getBridgeReserves" "[]"
echo ""

echo "-- 2. Lock & Mint: $AMOUNT $CHAIN -> wBTC --"
rpc "rstn_bridgeSubmitLock" \
  "{\"chain\":\"$CHAIN\",\"sourceTxid\":\"$SOURCE_TXID\",\"amount\":$AMOUNT,\"userAddress\":\"$USER_ADDR\"}"
echo ""

echo "-- 3. Wrapped balance (should be $AMOUNT wBTC) --"
rpc "rstn_bridgeGetWrappedBalance" \
  "{\"chain\":\"$CHAIN\",\"userAddress\":\"$USER_ADDR\"}"
echo ""

echo "-- 4. Reserves after lock (locked=$AMOUNT, minted=$AMOUNT) --"
rpc "rstn_getBridgeReserves" "[]"
echo ""

echo "-- 5. Burn & Release: 500 wBTC --"
rpc "rstn_bridgeSubmitBurn" \
  "{\"chain\":\"$CHAIN\",\"amount\":500,\"userAddress\":\"$USER_ADDR\"}"
echo ""

echo "-- 6. Wrapped balance after burn (should be 500 wBTC) --"
rpc "rstn_bridgeGetWrappedBalance" \
  "{\"chain\":\"$CHAIN\",\"userAddress\":\"$USER_ADDR\"}"
echo ""

echo "-- 7. Reserves after burn (locked=500, minted=1000, burned=500) --"
rpc "rstn_getBridgeReserves" "[]"
echo ""

echo "-- 8. Operation history --"
rpc "rstn_bridgeGetOps" "{\"limit\":20}"
echo ""

echo "=========================================="
echo "  E2E Test Complete"
echo "=========================================="
