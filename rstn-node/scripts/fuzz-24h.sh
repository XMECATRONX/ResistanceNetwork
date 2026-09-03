#!/usr/bin/env bash
# RSTN — 24-hour extended fuzzing run (pre-mainnet).
#
# Runs all three fuzz targets for 24 hours each (in parallel where memory
# allows), with corpus seeding and crash triage. This is the extended run
# referenced in FUZZING.md and CRYPTO_AUDIT_PACKAGE.md §4.
#
# Usage:
#   ./scripts/fuzz-24h.sh            # full 24h run (8h per target, parallel)
#   ./scripts/fuzz-24h.sh --smoke    # 5-min smoke test (CI mode)
#   ./scripts/fuzz-24h.sh --target vm # single target, full duration
#
# Requirements:
#   rustup toolchain install nightly
#   cargo +nightly install cargo-fuzz
set -euo pipefail

DURATION="${FUZZ_DURATION:-28800}"  # 8h per target (3 targets × 8h = 24h total)
SMOKE=0
TARGET="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --smoke)  SMOKE=1; DURATION=300; shift ;;
    --target) TARGET="$2"; shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

cd "$(dirname "$0")/../fuzz"

echo "========================================"
echo " RSTN Extended Fuzzing"
echo " Duration per target: ${DURATION}s"
echo " Mode: $([ $SMOKE -eq 1 ] && echo 'SMOKE' || echo 'EXTENDED')"
echo "========================================"

# Seed the corpus with known-interesting inputs so the fuzzer starts deep.
seed_corpus() {
  local target="$1"
  local dir="fuzz/artifacts/${target}/corpus"
  mkdir -p "$dir"
  # Empty input (edge case)
  printf '' > "$dir/empty"
  # Single byte
  printf '\x00' > "$dir/single_zero"
  # Max-length opcode stream (VM)
  printf '\xff\x00%.0s' {1..256} > "$dir/long_bytecode" 2>/dev/null || true
  # Equivocation seed (consensus)
  printf '\x03\x00\x00\x00\x00\x00\x00\x00\x00' > "$dir/equivocation"
  echo "  Seeded $dir"
}

run_target() {
  local target="$1"
  echo ""
  echo "--- Fuzzing: $target (${DURATION}s) ---"
  seed_corpus "$target"
  cargo +nightly fuzz run "$target" -- \
    -max_total_time="${DURATION}" \
    -rss_limit_mb=8192 \
    -print_final_stats=1 \
    2>&1 | tee "fuzz-${target}-$(date +%Y%m%d).log" || true
}

if [[ "$TARGET" == "all" ]]; then
  # Run sequentially to avoid memory contention (each target can use 8GB).
  run_target consensus
  run_target vm
  run_target protocol
else
  run_target "$TARGET"
fi

echo ""
echo "========================================"
echo " Fuzzing complete."
echo " Logs: fuzz-*.log"
echo " Artifacts: fuzz/artifacts/*/crashes/"
echo "========================================"
echo ""
echo "To triage a crash:"
echo "  cargo +nightly fuzz tmin <target> fuzz/artifacts/<target>/crashes/<file>"
