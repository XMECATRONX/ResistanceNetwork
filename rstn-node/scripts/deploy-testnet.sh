#!/usr/bin/env bash
#
# RSTN Testnet -- Deploy Script
#
# Deploys a 4-node private testnet locally using docker-compose.
#
# Usage:
#   ./scripts/deploy-testnet.sh          # deploy
#   ./scripts/deploy-testnet.sh --status  # check status
#   ./scripts/deploy-testnet.sh --stop    # stop testnet
#   ./scripts/deploy-testnet.sh --logs    # tail logs
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

ACTION="${1:-deploy}"

case "$ACTION" in
  --stop)
    echo "Stopping RSTN testnet..."
    docker-compose down
    echo "[OK] Testnet stopped. Data volumes preserved."
    ;;

  --status)
    echo "=========================================="
    echo "  RSTN Testnet Status"
    echo "=========================================="
    echo ""
    docker-compose ps
    echo ""
    echo "RPC endpoints:"
    echo "  Node 1: http://localhost:9944"
    echo "  Node 2: http://localhost:9946"
    echo "  Node 3: http://localhost:9948"
    echo "  Node 4: http://localhost:9950"
    echo ""
    echo "Health checks:"
    for port in 9944 9946 9948 9950; do
      result=$(curl -s -X POST "http://localhost:$port" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":0,"method":"rstn_health","params":[]}' 2>/dev/null || echo '{"error":"unreachable"}')
      echo "  Node :$port -> $result"
    done
    ;;

  --logs)
    NODE="${2:-rstn-node-1}"
    echo "Tailing logs for $NODE..."
    docker-compose logs -f "$NODE"
    ;;

  deploy|"")
    echo "=========================================="
    echo "  RSTN Testnet Deployment"
    echo "=========================================="
    echo ""

    # Check prerequisites
    if ! command -v docker &>/dev/null; then
      echo "[FAIL] Docker not installed. Install: https://docs.docker.com/get-docker"
      exit 1
    fi
    if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
      echo "[FAIL] docker-compose not installed."
      exit 1
    fi

    # Generate genesis if not present
    if [ ! -f "$PROJECT_ROOT/genesis.json" ]; then
      echo "genesis.json not found. Generating..."
      bash "$SCRIPT_DIR/generate-genesis.sh"
    fi

    echo "Building Docker image..."
    docker-compose build

    echo ""
    echo "Starting 4-node testnet..."
    docker-compose up -d

    echo ""
    echo "Waiting for nodes to start..."
    sleep 5

    echo ""
    bash "$SCRIPT_DIR/deploy-testnet.sh" --status

    echo ""
    echo "[OK] Testnet deployed!"
    echo ""
    echo "Frontend connection:"
    echo "  Set window.__RSTN_RPC__ = 'http://localhost:9944' in browser console"
    echo "  or update RPC_ENDPOINT in src/lib/api.ts"
    ;;

  *)
    echo "Usage: $0 [--stop|--status|--logs|deploy]"
    exit 1
    ;;
esac
