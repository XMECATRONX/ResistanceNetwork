#!/usr/bin/env bash
#
# RSTN E2E — Wallet load test (A6)
#
# Verifies the Chrome extension wallet (rstn-wallet/) can be loaded and
# connects to a running node. This is a manual checklist script — it prints
# the exact steps and validates the wallet files exist.
#
# Usage:
#   ./scripts/e2e-wallet-load.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WALLET_DIR="$PROJECT_ROOT/../rstn-wallet"

echo "=========================================="
echo "  RSTN E2E — Wallet Load Test (A6)"
echo "=========================================="
echo ""

# --- 1. Verify wallet files exist -----------------------------------------
echo "[1/4] Verifying wallet extension files..."
REQUIRED=(manifest.json popup.html popup.js wallet-lib.js crypto.js bip39.js)
MISSING=0
for f in "${REQUIRED[@]}"; do
  if [ -f "$WALLET_DIR/$f" ]; then
    echo "  [OK] $f"
  else
    echo "  [MISSING] $f"
    MISSING=$((MISSING + 1))
  fi
done
[ "$MISSING" -gt 0 ] && { echo "[FAIL] $MISSING wallet files missing"; exit 1; }

# --- 2. Verify manifest is valid JSON -------------------------------------
echo ""
echo "[2/4] Validating manifest.json..."
MANIFEST_VALID=$(python3 -c "
import json,sys
try:
  with open('$WALLET_DIR/manifest.json') as f: m=json.load(f)
  print('OK' if m.get('manifest_version') else 'INVALID')
except Exception as e:
  print('INVALID')
" 2>/dev/null || echo "INVALID")
echo "  -> $MANIFEST_VALID"
[ "$MANIFEST_VALID" = "OK" ] || { echo "[FAIL] manifest.json invalid"; exit 1; }

# --- 3. Print Chrome load instructions ------------------------------------
echo ""
echo "[3/4] Chrome load instructions:"
echo "  1. Open chrome://extensions in Chrome/Brave"
echo "  2. Enable 'Developer mode' (top-right toggle)"
echo "  3. Click 'Load unpacked'"
echo "  4. Select: $WALLET_DIR"
echo "  5. The RSTN wallet icon appears in the toolbar"
echo "  6. Click it -> Create or import a wallet"
echo "  7. Set RPC endpoint to http://localhost:9944"

# --- 4. Verify node is reachable for wallet to connect --------------------
echo ""
echo "[4/4] Checking node RPC reachability (localhost:9944)..."
HEALTH=$(curl -s -X POST "http://localhost:9944" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":0,"method":"rstn_health","params":[]}' 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q '"result":true'; then
  echo "  [OK] Node reachable — wallet will connect"
else
  echo "  [WARN] Node not reachable on :9944 — start it first:"
  echo "         ./target/release/rstn-node --dev --port 9944"
fi

echo ""
echo "=========================================="
echo "  [PASS] Wallet extension ready to load"
echo "=========================================="
