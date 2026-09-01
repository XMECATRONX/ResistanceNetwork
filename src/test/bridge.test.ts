import { describe, it, expect } from "vitest";
import { TransactionBuilder, RstnWallet } from "@/lib/rstn-sdk";
import { hexToBytes as hexToBytesHelper } from "@/lib/rstn-tx-helpers";
import { keccak_512 } from "@noble/hashes/sha3.js";

// Local hexToBytes mirrors the SDK's internal encoder for verification tests.
// It is intentionally a separate (untrusted) implementation so a bug in the
// SDK helper cannot silently mask a signing/verification regression.
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2)
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  return bytes;
}

describe("Bridge Simulator — Transaction Building", () => {
  it("builds a transfer transaction with correct fields", () => {
    const tx = TransactionBuilder.transfer("rstn1dest", "1000", 1);
    expect(tx.to).toBe("rstn1dest");
    expect(tx.value).toBe("1000");
    expect(tx.nonce).toBe(1);
    expect(tx.txType).toBe("transfer");
    expect(tx.payload).toBe("0x");
    expect(tx.gasLimit).toBe(21000);
  });

  it("builds a stake transaction with higher gas limit", () => {
    const tx = TransactionBuilder.stake("rstn1validator", "5000", 2);
    expect(tx.to).toBe("rstn1validator");
    expect(tx.value).toBe("5000");
    expect(tx.txType).toBe("stake");
    expect(tx.gasLimit).toBe(50000);
  });

  it("builds an unstake transaction", () => {
    const tx = TransactionBuilder.unstake("rstn1validator", "3000", 3);
    expect(tx.to).toBe("rstn1validator");
    expect(tx.value).toBe("3000");
    expect(tx.txType).toBe("unstake");
    expect(tx.gasLimit).toBe(50000);
  });
});

describe("Bridge Simulator — Wallet Signing", () => {
  it("generates a Dilithium3 keypair with rstn1 address", () => {
    const wallet = RstnWallet.generate();
    expect(wallet.address).toMatch(/^rstn1/);
    expect(wallet.publicKey).toBeTruthy();
    expect(wallet.canSign()).toBe(true);
  });

  it("derives consistent address from same public key", () => {
    const wallet = RstnWallet.generate();
    const pubKeyBytes = hexToBytesHelper(wallet.publicKey);
    const derivedAddress = RstnWallet.deriveAddress(pubKeyBytes);
    expect(derivedAddress).toBe(wallet.address);
  });

  it("signs a transaction producing a Dilithium3 signature", async () => {
    const wallet = RstnWallet.generate();
    const dest = wallet.address;
    const tx = TransactionBuilder.transfer(dest, "100", 1);
    const signed = await wallet.signTx(tx);
    expect(signed.signature).toBeTruthy();
    expect(signed.from).toBe(wallet.publicKey);
    // Dilithium3 (ML-DSA-65) signature is 3309 bytes = 6618 hex chars
    expect(signed.signature.length).toBe(6618);
  });

  it("converts signed transaction to node format with byte arrays", () => {
    const wallet = RstnWallet.generate();
    const dest = wallet.address;
    const tx = TransactionBuilder.transfer(dest, "100", 1);
    return wallet.signTx(tx).then((signed) => {
      const nodeFormat = RstnWallet.toNodeFormat(signed);
      expect(Array.isArray(nodeFormat.from)).toBe(true);
      expect(Array.isArray(nodeFormat.to)).toBe(true);
      expect(Array.isArray(nodeFormat.signature)).toBe(true);
      expect(Array.isArray(nodeFormat.payload)).toBe(true);
      expect(nodeFormat.value).toBe("100");
      expect(nodeFormat.tx_type).toBe("Transfer");
    });
  });

  it("verifies its own signature (round-trip)", async () => {
    const wallet = RstnWallet.generate();
    const dest = wallet.address;
    const tx = TransactionBuilder.transfer(dest, "100", 1);
    const signed = await wallet.signTx(tx);

    // Verify the signature
    const pubKeyBytes = hexToBytes(wallet.publicKey);
    const sigBytes = hexToBytes(signed.signature);
    const txHash = hashTransactionForTest(tx, pubKeyBytes);
    const isValid = RstnWallet.verifySignature(pubKeyBytes, txHash, sigBytes);
    expect(isValid).toBe(true);
  });
});

// ─── Helpers (mirror SDK internals for testing) ──────────────

function hashTransactionForTest(tx: any, fromPubKey: Uint8Array): Uint8Array {
  // This mirrors the canonical encoding in the SDK
  const toAddrHex = tx.to.startsWith("rstn1") ? tx.to.slice(5) : tx.to;
  const toBytes = hexToBytes(toAddrHex);

  // u128 LE
  const valueBytes = new Uint8Array(16);
  let v = BigInt(tx.value);
  for (let i = 0; i < 16; i++) {
    valueBytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }

  // u64 LE
  const nonceBytes = new Uint8Array(8);
  let n = BigInt(tx.nonce);
  for (let i = 0; i < 8; i++) {
    nonceBytes[i] = Number(n & 0xffn);
    n >>= 8n;
  }

  const gasPriceBytes = new Uint8Array(16);
  let gp = BigInt(tx.gasPrice);
  for (let i = 0; i < 16; i++) {
    gasPriceBytes[i] = Number(gp & 0xffn);
    gp >>= 8n;
  }

  const gasLimitBytes = new Uint8Array(8);
  let gl = BigInt(tx.gasLimit);
  for (let i = 0; i < 8; i++) {
    gasLimitBytes[i] = Number(gl & 0xffn);
    gl >>= 8n;
  }

  const total =
    fromPubKey.length +
    toBytes.length +
    valueBytes.length +
    nonceBytes.length +
    gasPriceBytes.length +
    gasLimitBytes.length +
    1;
  const buf = new Uint8Array(total);
  let off = 0;
  buf.set(fromPubKey, off);
  off += fromPubKey.length;
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
  buf[off] = 0; // transfer = 0
  return keccak_512(buf);
}
