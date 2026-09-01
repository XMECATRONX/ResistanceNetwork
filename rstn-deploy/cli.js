#!/usr/bin/env node
// rstn-deploy -- Native post-quantum contract deployment CLI for Resistance Network.
// Signs transactions with Dilithium3 (FIPS 204 ML-DSA-65) -- no ECDSA, no relayer.
//
// Usage:
//   node cli.js init                              Generate a new PQ keypair -> rstn-key.json
//   node cli.js address                           Print the keypair's RSTN address
//   node cli.js balance                           Show balance + nonce
//   node cli.js faucet                            Claim 1000 RSTN from the faucet
//   node cli.js deploy <bytecode-file>            Deploy a contract (bytecode hex or Hardhat artifact JSON)
//   node cli.js call <address> <calldata-hex>     Read-only contract call (eth_call)
//   node cli.js send <to-address> <value-rstn>     Send a native transfer
//
// Env:
//   RSTN_RPC  -- RPC endpoint (default http://localhost:9944)
//   RSTN_KEY  -- keypair file path (default ./rstn-key.json)

import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import {
  generateKeypair, deriveAddress, toHex, hexToBytes,
  buildNodeTx, signTransaction, computeContractAddress,
  getBalance, getNonce, faucetClaim, sendTransaction, ethCall,
} from "./lib.js";

const RPC = process.env.RSTN_RPC || "http://localhost:9944";
const KEY_FILE = process.env.RSTN_KEY || resolve(process.cwd(), "rstn-key.json");

function loadKey() {
  if (!existsSync(KEY_FILE)) {
    console.error(`[FAIL] No keypair found at ${KEY_FILE}`);
    console.error(`  Run: node cli.js init`);
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(KEY_FILE, "utf8"));
  return {
    publicKey: new Uint8Array(raw.publicKey),
    secretKey: new Uint8Array(raw.secretKey),
    address: raw.address,
  };
}

function saveKey(kp) {
  writeFileSync(KEY_FILE, JSON.stringify({
    publicKey: Array.from(kp.publicKey),
    secretKey: Array.from(kp.secretKey),
    address: kp.address,
  }, null, 2));
  // Restrict permissions on the key file
  try { chmodSync(KEY_FILE, 0o600); } catch {}
}

// Extract bytecode from a file: raw hex, 0x-hex, or Hardhat artifact JSON.
function readBytecode(file) {
  const content = readFileSync(file, "utf8").trim();
  // Hardhat artifact JSON: { "bytecode": "0x..." }
  if (content.startsWith("{")) {
    const art = JSON.parse(content);
    const bc = art.bytecode || art.evm?.bytecode?.object || art.deployedBytecode;
    if (!bc) throw new Error("Hardhat artifact has no bytecode field");
    return hexToBytes(bc);
  }
  return hexToBytes(content);
}

const cmd = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

async function main() {
  switch (cmd) {
    case "init": {
      if (existsSync(KEY_FILE)) {
        console.error(`[FAIL] Key already exists at ${KEY_FILE}. Move it first if you want a new one.`);
        process.exit(1);
      }
      const kp = generateKeypair();
      saveKey(kp);
      console.log("[OK] New post-quantum keypair generated (Dilithium3 / ML-DSA-65)");
      console.log("  Address:", kp.address);
      console.log(`  Saved to: ${KEY_FILE}`);
      console.log("\nNext: claim testnet funds with `node cli.js faucet`");
      break;
    }

    case "address": {
      const kp = loadKey();
      console.log(kp.address);
      break;
    }

    case "balance": {
      const kp = loadKey();
      const bal = await getBalance(RPC, kp.address);
      const nonce = await getNonce(RPC, kp.address);
      console.log("Address:", kp.address);
      console.log("Balance:", bal.balance, "RSTN");
      console.log("Nonce:  ", nonce);
      break;
    }

    case "faucet": {
      const kp = loadKey();
      console.log("Claiming from faucet for", kp.address, "...");
      const res = await faucetClaim(RPC, kp.address);
      console.log("[OK] Faucet claim successful");
      console.log("  Amount:", res.amount, "RSTN");
      console.log("  Tx hash:", res.hash);
      break;
    }

    case "deploy": {
      if (!arg1) { console.error("Usage: node cli.js deploy <bytecode-file>"); process.exit(1); }
      const kp = loadKey();
      const bytecode = readBytecode(resolve(arg1));
      console.log("Deploying contract with post-quantum signature (Dilithium3)...");
      console.log("  Deployer:", kp.address);
      console.log("  Bytecode:", bytecode.length, "bytes");

      // -- Pre-flight: verify the deployer has enough balance for gas --
      // gas_fee = gas_price * gas_limit = 1e9 * 5e6 = 5e15 wei = 0.005 RSTN
      const bal = await getBalance(RPC, kp.address);
      const balanceWei = BigInt(Math.floor(Number(bal.balance))) * 10n ** 18n;
      const gasFee = 1000000000n * 5000000n;
      if (balanceWei < gasFee) {
        console.error(`[FAIL] Insufficient balance for gas.`);
        console.error(`  Balance: ${bal.balance} RSTN (need >= 0.005 RSTN for gas)`);
        console.error(`  Run: node cli.js faucet`);
        process.exit(1);
      }
      console.log("  Balance:", bal.balance, "RSTN [OK]");

      const nonce = await getNonce(RPC, kp.address);
      const contractAddr = computeContractAddress(kp.address, nonce);
      console.log("  Predicted contract address:", contractAddr);

      const tx = {
        from: kp.publicKey,
        to: "rstn1" + "0".repeat(40),   // zero address (20 bytes) -- deploy ignores `to`
        value: "0",
        nonce,
        gas_price: "1000000000",
        gas_limit: 5000000,
        tx_type: "ContractDeploy",
        payload: bytecode,
      };

      const sig = signTransaction(tx, kp.secretKey);
      const nodeTx = buildNodeTx(tx, sig);
      const txHash = await sendTransaction(RPC, nodeTx);

      console.log("[OK] Contract deployment transaction submitted");
      console.log("  Tx hash:", txHash);
      console.log("  Contract address:", contractAddr);
      console.log("\nThe contract will be deployed when the next block is finalized.");
      console.log("Verify with: node cli.js call " + contractAddr + " <calldata-hex>");
      break;
    }

    case "call": {
      if (!arg1 || !arg2) {
        console.error("Usage: node cli.js call <contract-address> <calldata-hex>");
        process.exit(1);
      }
      const data = arg2.startsWith("0x") ? arg2 : "0x" + arg2;
      const result = await ethCall(RPC, arg1, data);
      console.log("Result:", result);
      break;
    }

    case "send": {
      if (!arg1 || !arg2) {
        console.error("Usage: node cli.js send <to-address> <value-rstn>");
        process.exit(1);
      }
      const kp = loadKey();
      const valueWei = String(BigInt(Math.floor(parseFloat(arg2) * 1e18)));
      const nonce = await getNonce(RPC, kp.address);
      console.log("Sending", arg2, "RSTN to", arg1, "...");

      const tx = {
        from: kp.publicKey,
        to: arg1,
        value: valueWei,
        nonce,
        gas_price: "1000000000",
        gas_limit: 21000,
        tx_type: "Transfer",
        payload: new Uint8Array(0),
      };
      const sig = signTransaction(tx, kp.secretKey);
      const nodeTx = buildNodeTx(tx, sig);
      const txHash = await sendTransaction(RPC, nodeTx);
      console.log("[OK] Transfer submitted -- tx hash:", txHash);
      break;
    }

    default:
      console.log("RSTN Deploy -- Native post-quantum contract deployment (Dilithium3)");
      console.log("");
      console.log("Commands:");
      console.log("  init                          Generate a new PQ keypair");
      console.log("  address                       Print the keypair address");
      console.log("  balance                       Show balance + nonce");
      console.log("  faucet                        Claim 1000 RSTN from faucet");
      console.log("  deploy <bytecode-file>        Deploy a contract (PQ-signed)");
      console.log("  call <addr> <calldata-hex>    Read-only contract call (eth_call)");
      console.log("  send <addr> <value-rstn>       Send a native transfer");
      console.log("");
      console.log("Env:");
      console.log("  RSTN_RPC   RPC endpoint (default http://localhost:9944)");
      console.log("  RSTN_KEY   keypair file (default ./rstn-key.json)");
  }
}

main().catch((e) => { console.error("[FAIL] Error:", e.message); process.exit(1); });
