#!/usr/bin/env bash
#
# RSTN Local Testnet -- Multi-node launcher (no Docker, no manual terminals)
#
# Launches N validator nodes in the background on localhost, each with its own
# RPC + P2P port and data directory. Node 0 is the seed; all other nodes dial
# node 0's P2P endpoint and bootstrap from it.
#
# Usage:
#   ./scripts/local-testnet.sh up 4        # launch a 4-node testnet (tolerates 1 fault)
#   ./scripts/local-testnet.sh status      # show RPC health + block height per node
#   ./scripts/local-testnet.sh mempool     # show pending tx count per node
#   ./scripts/local-testnet.sh logs 1      # tail node 1 logs
#   ./scripts/local-testnet.sh kill 2      # kill node 2 to test fault tolerance
#   ./scripts/local-testnet.sh rejoin 2    # restart node 2 -- it syncs from peers & rejoins
#   ./scripts/local-testnet.sh down        # stop & clean all nodes
#
# Port layout (per node i, 0-indexed):
#   RPC  = 9944 + i*2
#   P2P  = 9945 + i*2
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

NODE_BIN="$PROJECT_ROOT/target/release/rstn-node"
GENESIS_FILE="$PROJECT_ROOT/genesis.json"
RUN_DIR="$PROJECT_ROOT/.testnet"

ACTION="${1:-up}"
NUM_NODES="${2:-4}"

rpc_port() { echo $(( 9944 + $1 * 2 )); }
p2p_port() { echo $(( 9945 + $1 * 2 )); }

# Detect how many nodes were launched in the current testnet (by counting .pid files).
detect_num_nodes() {
  if [ -d "$RUN_DIR" ]; then
    ls "$RUN_DIR"/node*.pid 2>/dev/null | wc -l | tr -d ' '
  else
    echo 0
  fi
}

case "$ACTION" in
  up)
    if [ ! -x "$NODE_BIN" ]; then
      echo "[FAIL] Node binary not built. Run: cargo build --release"
      exit 1
    fi

    echo "=========================================="
    echo "  RSTN Local Testnet -- ${NUM_NODES} nodes"
    echo "=========================================="
    echo ""

    # Stop any previous run
    "$0" down >/dev/null 2>&1 || true

    mkdir -p "$RUN_DIR"

    # Generate genesis with the requested validator count
    echo "Generating genesis with ${NUM_NODES} validators..."
    "$NODE_BIN" genesis \
      --validators "$NUM_NODES" \
      --chain-id 1337 \
      --shard-count 4 \
      --output "$GENESIS_FILE"

    SEED_P2P=$(p2p_port 0)

    for i in $(seq 0 $((NUM_NODES - 1))); do
      RPC=$(rpc_port $i)
      P2P=$(p2p_port $i)
      DATA="$RUN_DIR/node$i"
      LOG="$RUN_DIR/node$i.log"
      mkdir -p "$DATA"

      PEERS=""
      if [ "$i" -gt 0 ]; then
        PEERS="--peers /ip4/127.0.0.1/tcp/${SEED_P2P}"
      fi

      echo "Starting node $i  (RPC :$RPC  P2P :$P2P)..."
      "$NODE_BIN" \
        --testnet \
        --genesis "$GENESIS_FILE" \
        --validator-index "$i" \
        --port "$RPC" \
        --p2p-port "$P2P" \
        --data-dir "$DATA" \
        $PEERS \
        > "$LOG" 2>&1 &
      echo $! > "$RUN_DIR/node$i.pid"
    done

    echo ""
    echo "Waiting for nodes to peer and produce blocks..."
    sleep 6

    echo ""
    "$0" status
    echo ""
    echo "[OK] Testnet running. Logs: $RUN_DIR/node*.log"
    echo "  Stop with: ./scripts/local-testnet.sh down"
    ;;

  status)
    DETECTED=$(detect_num_nodes)
    COUNT=${NUM_NODES:-$DETECTED}
    if [ "$COUNT" -eq 0 ] 2>/dev/null || [ -z "$COUNT" ]; then
      COUNT=$NUM_NODES
    fi
    echo "=========================================="
    echo "  RSTN Testnet Status  ($COUNT nodes)"
    echo "=========================================="
    ALIVE=0
    for i in $(seq 0 $((COUNT - 1))); do
      RPC=$(rpc_port $i)
      HEIGHT=$(curl -s -X POST "http://localhost:$RPC" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":0,"method":"rstn_getLatestBlocks","params":[1]}' \
        2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['height'])" 2>/dev/null || echo "DOWN")
      echo "  Node $i (:$RPC)  height=$HEIGHT"
      if [ "$HEIGHT" != "DOWN" ]; then ALIVE=$((ALIVE + 1)); fi
    done
    echo "------------------------------------------"
    echo "  Alive: $ALIVE / $COUNT"
    ;;

  kill)
    NODE="${2:-}"
    if [ -z "$NODE" ]; then
      echo "Usage: $0 kill <node-index>"
      echo "  Kills one node to test BFT fault tolerance."
      echo "  With n>=4 nodes, the chain keeps finalizing on the survivors (2f+1)."
      exit 1
    fi
    PIDFILE="$RUN_DIR/node$NODE.pid"
    if [ ! -f "$PIDFILE" ]; then
      echo "[FAIL] Node $NODE is not running (no pid file at $PIDFILE)"
      exit 1
    fi
    PID=$(cat "$PIDFILE")
    echo "Killing node $NODE (pid $PID, RPC :$(rpc_port $NODE))..."
    kill -9 "$PID" 2>/dev/null || true
    rm -f "$PIDFILE"
    echo "[OK] Node $NODE stopped. Check survivors with: $0 status"
    ;;

  rejoin)
    # Restart a previously killed node so it catches up with the survivors.
    # Proves the sync protocol works: a node that was down resyncs from peers
    # and rejoins consensus without manual intervention.
    NODE="${2:-}"
    if [ -z "$NODE" ]; then
      echo "Usage: $0 rejoin <node-index>"
      exit 1
    fi
    if [ ! -x "$NODE_BIN" ]; then
      echo "[FAIL] Node binary not built. Run: cargo build --release"
      exit 1
    fi
    PIDFILE="$RUN_DIR/node$NODE.pid"
    if [ -f "$PIDFILE" ]; then
      echo "[FAIL] Node $NODE is already running (pid $(cat "$PIDFILE")). Kill it first with: $0 kill $NODE"
      exit 1
    fi
    if [ ! -f "$GENESIS_FILE" ]; then
      echo "[FAIL] No genesis.json found. Launch a testnet first with: $0 up N"
      exit 1
    fi
    RPC=$(rpc_port $NODE)
    P2P=$(p2p_port $NODE)
    DATA="$RUN_DIR/node$NODE"
    LOG="$RUN_DIR/node$NODE.log"
    SEED_P2P=$(p2p_port 0)
    PEERS=""
    if [ "$NODE" -gt 0 ]; then
      PEERS="--peers /ip4/127.0.0.1/tcp/${SEED_P2P}"
    fi
    echo "Restarting node $NODE (RPC :$RPC  P2P :$P2P) -- it will sync from peers and rejoin consensus..."
    "$NODE_BIN" \
      --testnet \
      --genesis "$GENESIS_FILE" \
      --validator-index "$NODE" \
      --port "$RPC" \
      --p2p-port "$P2P" \
      --data-dir "$DATA" \
      $PEERS \
      > "$LOG" 2>&1 &
    echo $! > "$PIDFILE"
    echo "[OK] Node $NODE restarted (pid $(cat "$PIDFILE")). Wait a few seconds and check: $0 status"
    ;;

  logs)
    NODE="${2:-0}"
    echo "Tailing logs for node $NODE..."
    tail -f "$RUN_DIR/node$NODE.log"
    ;;

  mempool)
    # Show pending transaction count in each node's mempool.
    DETECTED=$(detect_num_nodes)
    COUNT=${NUM_NODES:-$DETECTED}
    if [ "$COUNT" -eq 0 ] 2>/dev/null || [ -z "$COUNT" ]; then
      COUNT=$NUM_NODES
    fi
    echo "=========================================="
    echo "  RSTN Mempool Status  ($COUNT nodes)"
    echo "=========================================="
    for i in $(seq 0 $((COUNT - 1))); do
      RPC=$(rpc_port $i)
      PENDING=$(curl -s -X POST "http://localhost:$RPC" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":0,"method":"rstn_getPendingTransactions","params":[100]}' \
        2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('result',[])))" 2>/dev/null || echo "DOWN")
      echo "  Node $i (:$RPC)  pending_txs=$PENDING"
    done
    ;;

  down)
    echo "Stopping RSTN testnet..."
    if [ -d "$RUN_DIR" ]; then
      for pf in "$RUN_DIR"/*.pid; do
        [ -f "$pf" ] || continue
        PID=$(cat "$pf")
        kill -9 "$PID" 2>/dev/null || true
      done
      rm -rf "$RUN_DIR"
    fi
    # Kill any stray rstn-node processes bound to our ports
    pkill -9 -f "target/release/rstn-node" 2>/dev/null || true
    echo "[OK] Testnet stopped and cleaned."
    ;;

  *)
    echo "Usage: $0 {up N|status|logs N|kill N|rejoin N|mempool|down}"
    exit 1
    ;;
esac
