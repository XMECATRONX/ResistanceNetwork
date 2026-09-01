#!/usr/bin/env bash
#
# RSTN Testnet -- Genesis Generator
#
# Generates the genesis.json with 4 validator keypairs.
# Each validator gets a Dilithium3 keypair (post-quantum).
#
# Usage: ./scripts/generate-genesis.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GENESIS_FILE="$PROJECT_ROOT/genesis.json"

echo "=========================================="
echo "  RSTN Testnet -- Genesis Generator"
echo "=========================================="
echo ""

# Check if genesis already exists
if [ -f "$GENESIS_FILE" ]; then
  echo "?  genesis.json already exists at $GENESIS_FILE"
  read -p "  Overwrite? [y/N] " -n 1 -r
  echo ""
  [[ $REPLY =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

echo "Generating 4 validator keypairs (Dilithium3 / ML-DSA-65)..."
echo ""

# Generate genesis using the node binary if available
NODE_BIN="$PROJECT_ROOT/target/release/rstn-node"

if [ -x "$NODE_BIN" ]; then
  echo "Using node binary to generate genesis..."
  "$NODE_BIN" genesis \
    --validators 4 \
    --chain-id 1337 \
    --shard-count 4 \
    --output "$GENESIS_FILE"
else
  echo "?  Node binary not found at $NODE_BIN"
  echo "  Building node first (this may take a few minutes)..."
  echo ""
  cd "$PROJECT_ROOT"
  cargo build --release
  echo ""
  echo "Generating genesis..."
  ./target/release/rstn-node genesis \
    --validators 4 \
    --chain-id 1337 \
    --shard-count 4 \
    --output "$GENESIS_FILE"
fi

echo ""
echo "[OK] Genesis written to $GENESIS_FILE"
echo ""
echo "Validator keys:"
cat "$GENESIS_FILE" | jq '.validators[] | {id: .id, address: .address}' 2>/dev/null || true
echo ""
echo "Next steps:"
echo "  1. docker-compose up -d"
echo "  2. Check node health: curl -X POST localhost:9944 -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":0,\"method\":\"rstn_health\",\"params\":[]}'"
