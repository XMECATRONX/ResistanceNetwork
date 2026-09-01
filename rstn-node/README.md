# rstn-node

Post-Quantum Layer 1 Blockchain Node -- Rust implementation.

## Crates

| Crate | Description | Status |
|---|---|---|
| `rstn-core` | Block, Transaction, Validator, BFT consensus, Chain | ? Functional |
| `rstn-crypto` | Dilithium3 (FIPS 204), Keccak-512, PQ-VRF, PQ-noise | ? Functional |
| `rstn-p2p` | libp2p gossipsub + Kademlia DHT + identify | ? Functional |
| `rstn-storage` | sled-backed blocks, state, txs, validators, mempool | ? Functional |
| `rstn-vm` | EVM-compatible + Move resources + PQ sig opcode | ? Scaffolded |
| `rstn-rpc` | JSON-RPC 2.0 server (12 methods matching frontend) | ? Functional |
| `rstn-node` | Binary entry point, wires all crates together | ? Functional |

## Build

```bash
cd rstn-node
cargo build --release
```

## Commands

```bash
# Generate a new Dilithium3 keypair
./target/release/rstn-node keygen

# Initialize genesis block
./target/release/rstn-node init

# Start the node (RPC + P2P + consensus)
./target/release/rstn-node run

# Dev mode (single node, no P2P)
./target/release/rstn-node --dev run

# Multi-node mode (P2P + BFT consensus)
# Node 1:
./target/release/rstn-node run --port 9944 --p2p-port 9945

# Node 2 (connects to Node 1):
./target/release/rstn-node run --port 9946 --p2p-port 9947 \
  --peers /ip4/127.0.0.1/tcp/9945

# Node 3 (connects to Node 1):
./target/release/rstn-node run --port 9948 --p2p-port 9949 \
  --peers /ip4/127.0.0.1/tcp/9945

# Custom stake amount
./target/release/rstn-node run --stake 64000
```

## Architecture

```
?-------------------------------------------------?
|                  rstn-node                       |
|  (binary: CLI + event loop + wiring)              |
?-------------------------------------------------?
|                                                   |
|  ?----------?  ?----------?  ?--------------?   |
|  | rstn-rpc |  | rstn-p2p|  |  rstn-core  |   |
|  | (JSON-   |<-->| (libp2p) |<-->|  (consensus)  |   |
|  |  RPC 2.0)|  | gossipsub|  |  BFT + DAG    |   |
|  ?----?-----?  ?----?-----?  ?------?-------?   |
|       |             |                |            |
|       ?             ?                ?            |
|  ?------------------------------------------?    |
|  |            rstn-storage (sled)           |    |
|  |  blocks | state | txs | validators | pool |    |
|  ?------------------------------------------?    |
|       |                                           |
|       ?                                           |
|  ?--------------?  ?--------------?              |
|  | rstn-crypto  |  |  rstn-vm    |              |
|  | Dilithium3    |  |  EVM + Move  |              |
|  | Keccak-512    |  |  PQ opcodes  |              |
|  ?--------------?  ?--------------?              |
?-------------------------------------------------?
```

## Consensus: BFT + DAG

- **Block time**: 400ms target
- **Finality**: 0.4s (2 BFT rounds: PREPARE -> COMMIT)
- **Threshold**: 2/3+ supermajority of active validators
- **Leader election**: PQ-VRF (Dilithium-based, replaces VRF)
- **Sharding**: 64 shards, cross-shard communication via receipts

## Multi-Node BFT Consensus

The node supports real multi-node BFT consensus via libp2p gossipsub:

```
Node 1 (leader)          Node 2 (validator)       Node 3 (validator)
    |                        |                        |
    ?-- propose block ------??-- vote PREPARE -------?|
    |                        |                        |
    ?-- vote PREPARE --------??-- vote PREPARE -------?
    |                        |                        |
    ?-- supermajority? ------?-- supermajority? ------?|
    |   YES -> vote COMMIT    |   YES -> vote COMMIT    |
    |                        |                        |
    ?-- vote COMMIT ---------??-- vote COMMIT ---------?
    |                        |                        |
    ?-- supermajority? ------?-- supermajority? ------?|
    |   YES -> FINALIZE       |   YES -> FINALIZE       |
    |                        |                        |
    ?-- block finalized -----?-- block finalized ------?
```

- **Threshold**: 2/3+ of active validators must sign for PREPARE and COMMIT
- **Leader rotation**: Round-robin weighted by stake (PQ-VRF in production)
- **Fault tolerance**: f = (n-1)/3 Byzantine faults tolerated
- **Block propagation**: gossipsub topic `rstn/blocks/1.0`
- **Vote propagation**: gossipsub topic `resistance/votes/1.0`

## Cryptography

All primitives are post-quantum (resist Shor + Grover):

| Primitive | Algorithm | Security |
|---|---|---|
| Hash | Keccak-512 | 256-bit quantum |
| Signatures | Dilithium3 (FIPS 204) | Category 2 (128-bit PQ) |
| VRF | PQ-VRF (Dilithium-based) | 128-bit PQ |
| Transport | PQ-noise (Kyber KEM + Dilithium) | 128-bit PQ |
| Addresses | Keccak-512(pubkey)[last 20 bytes] | 160-bit |

## RPC Methods

All methods match `src/lib/api.ts` in the frontend:

| Method | Returns |
|---|---|
| `resist_getNetworkStats` | NetworkStats |
| `resist_health` | bool |
| `resist_getExplorerStats` | ExplorerStats |
| `resist_getLatestBlocks` | Block[] |
| `resist_getBlockByHeight` | Block |
| `resist_getLatestTransactions` | Transaction[] |
| `resist_getTransactionByHash` | Transaction |
| `resist_getTopValidators` | Validator[] |
| `resist_getBalance` | WalletPortfolio |
| `resist_getStakingValidators` | StakingValidator[] |
| `resist_getProposals` | GovernanceProposal[] |
| `resist_sendTransaction` | Hash |

## Connecting the Frontend

1. Start the node: `./target/release/rstn-node run`
2. In `src/lib/api.ts`, set `RPC_MODE = true`
3. Set `RPC_ENDPOINT = "http://localhost:9944"`
4. The frontend will now read live data from the node

## License

Apache-2.0
