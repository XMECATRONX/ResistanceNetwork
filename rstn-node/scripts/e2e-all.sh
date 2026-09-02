#!/usr/bin/env bash
#
# RSTN E2E — Master test suite (A3 + A4 + A5 + A6)
#
# Runs all end-to-end tests against a running node in sequence and reports
# a final pass/fail summary. This is the "does the whole stack work" gate.
#
# Prerequisite: a node running in dev/testnet mode:
#   ./target/release/rstn-node --dev --port 9944
#
# Usage:
#   ./scripts/e2e-all.sh                 # default RPC :9944
#   ./scripts/e2e-all.sh 9946            # custom RPC port
#
set -uo pipefail

RPC_PORT="${1:-9944}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "########################################################"
echo "#  RSTN FULL E2E TEST SUITE"
echo "#  RPC: http://localhost:${RPC_PORT}"
echo "########################################################"
echo ""

PASS=0
FAIL=0
RESULTS=()

run_test() {
  local name="$1"
  local script="$2"
  echo "────────────────────────────────────────────────────────"
  echo "  RUNNING: $name"
  echo "────────────────────────────────────────────────────────"
  if bash "$script" "$RPC_PORT"; then
    RESULTS+=("[PASS] $name")
    PASS=$((PASS + 1))
  else
    RESULTS+=("[FAIL] $name")
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

# A3 — Transfer
run_test "A3 Transfer (real signed tx)" "$SCRIPT_DIR/e2e-transfer.sh"

# A4 — Staking
run_test "A4 Staking (real stake tx)" "$SCRIPT_DIR/e2e-stake.sh"

# A5 — Contract deploy + transpile
run_test "A5 Contract (transpile + deploy)" "$SCRIPT_DIR/e2e-contract.sh"

# A6 — Wallet load (file check, no RPC port arg needed)
echo "────────────────────────────────────────────────────────"
echo "  RUNNING: A6 Wallet load (file check)"
echo "────────────────────────────────────────────────────────"
if bash "$SCRIPT_DIR/e2e-wallet-load.sh"; then
  RESULTS+=("[PASS] A6 Wallet load")
  PASS=$((PASS + 1))
else
  RESULTS+=("[FAIL] A6 Wallet load")
  FAIL=$((FAIL + 1))
fi
echo ""

# --- Summary ---------------------------------------------------------------
echo "########################################################"
echo "#  E2E TEST SUMMARY"
echo "########################################################"
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo ""
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "########################################################"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
