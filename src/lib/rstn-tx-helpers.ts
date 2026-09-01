import { keccak_512 } from "@noble/hashes/sha3.js";

// ─── Hex helpers ──────────────────────────────────────────────

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a hex string to a Uint8Array.
 * Validates even length and hex-only characters — an odd-length or
 * non-hex string would silently produce a corrupted byte array, which
 * is catastrophic for signature payloads (the signed message would
 * differ from what the node re-derives, causing verification failure
 * or, worse, signing of unintended data).
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error(`hexToBytes: odd-length hex (${clean.length} chars)`);
  }
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error("hexToBytes: invalid hex characters");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2)
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  return bytes;
}

// ─── Little-endian encoders ────────────────────────────────────

export function u128ToLeBytes(val: bigint): Uint8Array {
  const buf = new Uint8Array(16);
  let v = val;
  for (let i = 0; i < 16; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

export function u64ToLeBytes(val: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  let v = val;
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

// ─── Transaction encoding ─────────────────────────────────────

export interface UnsignedTransaction {
  to: string;
  value: string;
  nonce: number;
  gasPrice: string;
  gasLimit: number;
  txType: string;
  payload: string;
}

export const TX_TYPE_TO_U8: Record<string, number> = {
  transfer: 0,
  stake: 1,
  unstake: 2,
  delegate: 3,
  undelegate: 4,
  claim: 5,
  governance: 6,
  contract_call: 7,
  contract_deploy: 8,
};

export const TX_TYPE_TO_PASCAL: Record<string, string> = {
  transfer: "Transfer",
  stake: "Stake",
  unstake: "Unstake",
  delegate: "Delegate",
  undelegate: "Undelegate",
  claim: "Claim",
  governance: "Governance",
  contract_call: "Contract",
  contract_deploy: "ContractDeploy",
};

export function canonicalEncodeTx(
  tx: UnsignedTransaction,
  fromPubKey: Uint8Array,
): Uint8Array {
  const fromBytes = fromPubKey;
  const rawTo = tx.to.startsWith("rstn1") ? tx.to.slice(5) : tx.to;
  const toAddrHex = rawTo.length % 2 !== 0 ? `0${rawTo}` : rawTo || "00";
  const toBytes = hexToBytes(toAddrHex);
  const valueBytes = u128ToLeBytes(BigInt(tx.value));
  const nonceBytes = u64ToLeBytes(BigInt(tx.nonce));
  const gasPriceBytes = u128ToLeBytes(BigInt(tx.gasPrice));
  const gasLimitBytes = u64ToLeBytes(BigInt(tx.gasLimit));
  const txTypeByte = TX_TYPE_TO_U8[tx.txType] ?? 0;
  const payloadBytes = tx.payload.startsWith("0x")
    ? hexToBytes(tx.payload.slice(2))
    : hexToBytes(tx.payload);

  const total =
    fromBytes.length +
    toBytes.length +
    valueBytes.length +
    nonceBytes.length +
    gasPriceBytes.length +
    gasLimitBytes.length +
    1 +
    payloadBytes.length;
  const buf = new Uint8Array(total);
  let off = 0;
  buf.set(fromBytes, off);
  off += fromBytes.length;
  buf.set(toBytes, off);
  off += toBytes.length;
  buf.set(valueBytes, off);
  off += valueBytes.length;
  buf.set(nonceBytes, off);
  off += nonceBytes.length;
  buf.set(gasPriceBytes, off);
  off += gasPriceBytes.length;
  buf.set(gasLimitBytes, off);
  off += gasLimitBytes.length;
  buf[off] = txTypeByte;
  off += 1;
  buf.set(payloadBytes, off);
  return buf;
}

export function hashTransaction(
  tx: UnsignedTransaction,
  fromPubKey: Uint8Array,
): Uint8Array {
  return keccak_512(canonicalEncodeTx(tx, fromPubKey));
}
