# RSTN Smart Contract Deployment — Native Post-Quantum

This project validates **EVM bytecode compatibility** on RSTN.

## Important: Hardhat compiles, `rstn-deploy` deploys

Hardhat/ethers.js signs transactions with **ECDSA (secp256k1)**, which is broken by
quantum computers. RSTN requires **Dilithium3 (FIPS 204)** signatures. The two
schemes are incompatible, so Hardhat cannot sign a valid RSTN deploy transaction.

The correct workflow is:
1. **Hardhat compiles** the Solidity contract → bytecode (this works, no changes needed)
2. **`rstn-deploy` deploys** the bytecode with a native Dilithium3 signature

## Prerequisites
- Node.js 18+
- The RSTN testnet running on `localhost:9944` (4 nodes)
- `rstn-deploy` installed (sibling directory)

## Steps

### 1. Compile the contract (Hardhat — compile only)
```bash
cd rstn-hardhat-test
npm install
npx hardhat compile
# → artifacts/contracts/RstnStorage.sol/RstnStorage.json
```

### 2. Generate a post-quantum deployer keypair
```bash
cd ../rstn-deploy
npm install
node cli.js init
# → creates rstn-key.json, prints your rstn1... address
```

### 3. Fund the deployer from the faucet
```bash
node cli.js faucet
# → claims 1000 RSTN
```

### 4. Deploy with a post-quantum signature
```bash
node cli.js deploy ../rstn-hardhat-test/artifacts/contracts/RstnStorage.sol/RstnStorage.json
# → signs ContractDeploy tx with Dilithium3
# → submits via rstn_sendTransaction
# → prints the deterministic contract address
```

### 5. Read the contract (read-only)
```bash
# get() selector = 0x6d4ce63c
node cli.js call rstn1<contract-address> 0x6d4ce63c
# → 0x000000000000000000000000000000000000000000000000000000000000002a (42)
```

## What this validates

| Capability | Method | Status |
|---|---|---|
| Solidity compilation | Hardhat `compile` | ✅ |
| Contract deployment | `rstn-deploy` (Dilithium3) | ✅ |
| Read-only calls | `eth_call` (EVM compat layer) | ✅ |
| Persistent storage | `rstn_getStorageAt` | ✅ |
| PQ signature verification | on-chain precompile | ✅ |

## Why not `npx hardhat run scripts/deploy.js`?

That script uses ethers.js, which signs with ECDSA. The RSTN node rejects ECDSA
transactions in `eth_sendRawTransaction` because they are not post-quantum secure.
Use `rstn-deploy` instead — it signs natively with Dilithium3.
