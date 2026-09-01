# rstn-deploy -- Native Post-Quantum Contract Deployment

Deploy smart contracts to RSTN Network with **native Dilithium3 (FIPS 204 ML-DSA-65)** signatures.
No ECDSA, no relayer, no Hardhat network hack -- the deploy transaction is signed post-quantum end-to-end.

This is the honest path: RSTN is a post-quantum chain, so contract deployment is post-quantum.

## Why not Hardhat `deploy`?

Hardhat/ethers.js signs transactions with **ECDSA (secp256k1)**, which is broken by quantum computers
(Shor's algorithm). RSTN requires **Dilithium3** signatures on every transaction. The two schemes
are mathematically incompatible, so Hardhat cannot sign a valid RSTN deploy transaction.

`rstn-deploy` solves this by signing natively with Dilithium3 -- reusing the Solidity compiler
(`solc` / Hardhat `compile`) for bytecode generation, but signing the deployment with PQ cryptography.

## Install

```bash
cd rstn-deploy
npm install
```

## Workflow

### 1. Generate a post-quantum keypair
```bash
node cli.js init
# -> creates rstn-key.json (Dilithium3 keypair)
# -> prints your rstn1... address
```

### 2. Fund the deployer (testnet)
```bash
node cli.js faucet
# -> claims 1000 RSTN from the faucet
```

### 3. Compile your Solidity contract (with Hardhat or solc)
```bash
# Using Hardhat (compile only -- do NOT deploy via Hardhat):
cd ../rstn-hardhat-test && npx hardhat compile
# -> artifacts/contracts/RstnStorage.sol/RstnStorage.json
```

### 4. Deploy with a post-quantum signature
```bash
node cli.js deploy ../rstn-hardhat-test/artifacts/contracts/RstnStorage.sol/RstnStorage.json
# -> signs the ContractDeploy tx with Dilithium3
# -> submits via rstn_sendTransaction
# -> prints the deterministic contract address
```

### 5. Read contract state (read-only)
```bash
# eth_call against the deployed contract (EVM compat layer)
node cli.js call rstn1<contract-address> 0x6d4ce63c
# 0x6d4ce63c = get() selector for RstnStorage
```

## Commands

| Command | Description |
|---|---|
| `init` | Generate a new Dilithium3 keypair -> `rstn-key.json` |
| `address` | Print the keypair's RSTN address |
| `balance` | Show balance + nonce from the node |
| `faucet` | Claim 1000 RSTN from the testnet faucet |
| `deploy <file>` | Deploy a contract (bytecode hex or Hardhat artifact JSON) |
| `call <addr> <data>` | Read-only contract call via `eth_call` |
| `send <addr> <rstn>` | Send a native RSTN transfer |

## Environment

| Variable | Default | Description |
|---|---|---|
| `RSTN_RPC` | `http://localhost:9944` | RPC endpoint |
| `RSTN_KEY` | `./rstn-key.json` | Keypair file path |

## Contract address

The deployed contract address is deterministic and computed locally before submission:
```
address = keccak_512(deployer_address(20) || nonce_le(8))[0..20]
```
This matches the on-chain computation in the RSTN node, so the printed address is exact.

## Security

- The keypair (`rstn-key.json`) contains the Dilithium3 **secret key** -- never commit it.
- All signing happens locally; the secret key never leaves your machine.
- No relayer, no custodian, no ECDSA intermediate -- fully post-quantum.
