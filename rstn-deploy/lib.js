// rstn-deploy -- core library
// Native Dilithium3 (ML-DSA-65 / FIPS 204) transaction signing for RSTN Network.
// Mirrors the canonical encoding in rstn-core/src/lib.rs (Rust node) exactly.
//
// Canonical tx encoding (little-endian, fixed field order):
//   from (1952 bytes pubkey) | to (20 bytes) | value (16 LE) | nonce (8 LE)
//   | gas_price (16 LE) | gas_limit (8 LE) | tx_type (1 byte) | payload
//
// Signature: Dilithium3 over keccak_512(canonical_encode).

import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { keccak_512 } from "@noble/hashes/sha3.js";

export const PUBKEY_SIZE = 1952;
export const SIG_SIZE = 3309;
export const ADDRESS_SIZE = 20;

export const TX_TYPE_TO_U8 = {
  Transfer: 0, Stake: 1, Unstake: 2, Delegate: 3, Undelegate: 4,
  Claim: 5, Governance: 6, Contract: 7, ContractDeploy: 8,
};

// -- Byte helpers --
export function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  return bytes;
}

function u128ToLeBytes(val) {
  const buf = new Uint8Array(16);
  let v = BigInt(val);
  for (let i = 0; i < 16; i++) { buf[i] = Number(v & 0xffn); v >>= 8n; }
  return buf;
}

function u64ToLeBytes(val) {
  const buf = new Uint8Array(8);
  let v = BigInt(val);
  for (let i = 0; i < 8; i++) { buf[i] = Number(v & 0xffn); v >>= 8n; }
  return buf;
}

// -- Address derivation (matches Rust: keccak_512(pubkey)[..20]) --
export function deriveAddress(publicKey) {
  const hash = keccak_512(publicKey);
  return "rstn1" + toHex(hash.slice(hash.length - ADDRESS_SIZE));
}

export function addressToBytes(addr) {
  return hexToBytes(addr.startsWith("rstn1") ? addr.slice(6) : addr);
}

// -- Keypair --
export function generateKeypair() {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const kp = ml_dsa65.keygen(seed);
  const publicKey = new Uint8Array(kp.publicKey);
  const secretKey = new Uint8Array(kp.secretKey);
  return { publicKey, secretKey, address: deriveAddress(publicKey) };
}

// -- Canonical encoding (matches Rust node) --
export function canonicalEncodeTx(tx) {
  const fromBytes = tx.from;                       // 1952-byte pubkey
  const toBytes = addressToBytes(tx.to);           // 20-byte address
  const valueBytes = u128ToLeBytes(BigInt(tx.value));
  const nonceBytes = u64ToLeBytes(BigInt(tx.nonce));
  const gasPriceBytes = u128ToLeBytes(BigInt(tx.gas_price));
  const gasLimitBytes = u64ToLeBytes(BigInt(tx.gas_limit));
  const txTypeByte = TX_TYPE_TO_U8[tx.tx_type] ?? 0;
  const payloadBytes = tx.payload || new Uint8Array(0);

  const total = fromBytes.length + toBytes.length + 16 + 8 + 16 + 8 + 1 + payloadBytes.length;
  const buf = new Uint8Array(total);
  let off = 0;
  buf.set(fromBytes, off); off += fromBytes.length;
  buf.set(toBytes, off); off += toBytes.length;
  buf.set(valueBytes, off); off += 16;
  buf.set(nonceBytes, off); off += 8;
  buf.set(gasPriceBytes, off); off += 16;
  buf.set(gasLimitBytes, off); off += 8;
  buf[off] = txTypeByte; off += 1;
  buf.set(payloadBytes, off);
  return buf;
}

export function hashTransaction(tx) {
  return keccak_512(canonicalEncodeTx(tx));
}

export function signTransaction(tx, secretKey) {
  return new Uint8Array(ml_dsa65.sign(hashTransaction(tx), secretKey));
}

// -- Build the JSON tx object the node expects (arrays of bytes) --
export function buildNodeTx(tx, signature) {
  return {
    from: Array.from(tx.from),
    to: Array.from(addressToBytes(tx.to)),
    value: String(BigInt(tx.value)),
    nonce: Number(tx.nonce),
    gas_price: String(BigInt(tx.gas_price)),
    gas_limit: Number(tx.gas_limit),
    tx_type: tx.tx_type,
    payload: Array.from(tx.payload || new Uint8Array(0)),
    signature: Array.from(signature),
  };
}

// -- Deterministic contract address (matches Rust runner) --
// address = keccak_512(from_addr(20) || nonce_le(8))[0..20]
export function computeContractAddress(fromAddress, nonce) {
  const fromAddrBytes = addressToBytes(fromAddress); // 20 bytes
  const nonceBytes = u64ToLeBytes(BigInt(nonce));    // 8 bytes
  const input = new Uint8Array(20 + 8);
  input.set(fromAddrBytes, 0);
  input.set(nonceBytes, 20);
  const hash = keccak_512(input);
  return "rstn1" + toHex(hash.slice(0, 20));
}

// -- RPC --
export async function rpcCall(rpcUrl, method, params = []) {
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await resp.json();
  if (json.error) throw new Error(`RPC error ${method}: ${json.error.message}`);
  return json.result;
}

export async function getBalance(rpcUrl, address) {
  return rpcCall(rpcUrl, "rstn_getBalance", [address]);
}

export async function getNonce(rpcUrl, address) {
  const r = await rpcCall(rpcUrl, "rstn_getNonce", [address]);
  return typeof r === "number" ? r : Number(r) || 0;
}

export async function faucetClaim(rpcUrl, address) {
  return rpcCall(rpcUrl, "rstn_faucetClaim", [address]);
}

export async function sendTransaction(rpcUrl, nodeTx) {
  return rpcCall(rpcUrl, "rstn_sendTransaction", [nodeTx]);
}

// Read-only contract call via eth_call (EVM compat layer)
export async function ethCall(rpcUrl, to, calldata) {
  return rpcCall(rpcUrl, "eth_call", [
    { to, data: calldata },
    "latest",
  ]);
}

export async function getStorageAt(rpcUrl, address, key) {
  return rpcCall(rpcUrl, "rstn_getStorageAt", [address, key]);
}
