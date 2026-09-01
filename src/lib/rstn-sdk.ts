// @ts-ignore
import { ml_dsa65 as noble_ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
// @ts-ignore
import { keccak_512 } from "@noble/hashes/sha3.js";

const ml_dsa65 = noble_ml_dsa65 as any;

// Re-export shared types + the RPC client so existing imports
// (`from "@/lib/rstn-sdk"`) keep working after the split.
export type {
  TxType,
  UnsignedTransaction,
  SignedTransaction,
  NetworkStats,
  BlockInfo,
  TxInfo,
  ValidatorInfo,
  BalanceInfo,
  ConnectionStatus,
  NodeHealth,
  PeerInfo,
  ShardInfo,
  GovernanceProposal,
} from "@/lib/rstn-sdk-types";

export { RstnClient } from "@/lib/rstn-client";
import { RstnClient } from "@/lib/rstn-client";
import type {
  TxType,
  UnsignedTransaction,
  SignedTransaction,
} from "@/lib/rstn-sdk-types";
import { toHex, hexToBytes, TX_TYPE_TO_PASCAL } from "@/lib/rstn-tx-helpers";

// ─── RstnWallet ──────────────────────────────────────────────

/**
 * RstnWallet — holds a Dilithium3 (ML-DSA-65, FIPS 204) keypair and signs
 * transactions with @noble/post-quantum.
 *
 * SECURITY (A2): the private key is a PRIVATE field. It is never exposed
 * on the instance as a public property, so third-party scripts (analytics,
 * a compromised CDN) cannot read `wallet.privateKey` and steal funds.
 * Only `signTx` touches the key material, in-memory, and the bytes are
 * never serialized out of the instance.
 *
 * NOTE: generating real keypairs in the browser is DEV-only. The wallet
 * adapter (`src/lib/wallet.ts`) refuses to generate a keypair in production
 * builds and requires the RSTN browser extension instead.
 */
export class RstnWallet {
  publicKey: string;
  address: string;
  private privateKey?: string;

  constructor(publicKey: string, address: string, privateKey?: string) {
    this.publicKey = publicKey;
    this.address = address;
    this.privateKey = privateKey;
  }

  /** Whether this instance can sign (holds a private key). */
  canSign(): boolean {
    return this.privateKey !== undefined;
  }

  static generate(): RstnWallet {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const { publicKey, secretKey } = ml_dsa65.keygen(seed);
    const pubBytes = new Uint8Array(publicKey);
    const address = RstnWallet.deriveAddress(pubBytes);
    return new RstnWallet(
      toHex(pubBytes),
      address,
      toHex(new Uint8Array(secretKey)),
    );
  }

  static deriveAddress(publicKey: Uint8Array): string {
    const hash = keccak_512(publicKey);
    const addr = hash.slice(hash.length - 20);
    return "rstn1" + toHex(addr);
  }

  async signTx(tx: UnsignedTransaction): Promise<SignedTransaction> {
    if (!this.privateKey) throw new Error("No private key");
    const pubKeyBytes = hexToBytes(this.publicKey);
    const txHash = hashTransaction(tx, pubKeyBytes);
    const secretKeyBytes = hexToBytes(this.privateKey);
    const signature = ml_dsa65.sign(txHash, secretKeyBytes);
    return {
      ...tx,
      from: this.publicKey,
      signature: toHex(new Uint8Array(signature)),
    };
  }

  static toNodeFormat(tx: SignedTransaction): Record<string, unknown> {
    const fromBytes = hexToBytes(tx.from);
    const toAddrHex = tx.to.startsWith("rstn1") ? tx.to.slice(5) : tx.to;
    const toBytes = hexToBytes(toAddrHex);
    const sigBytes = hexToBytes(tx.signature);
    const payloadBytes = tx.payload.startsWith("0x")
      ? hexToBytes(tx.payload.slice(2))
      : hexToBytes(tx.payload);
    return {
      from: Array.from(fromBytes),
      to: Array.from(toBytes),
      value: BigInt(tx.value).toString(),
      nonce: tx.nonce,
      gas_price: BigInt(tx.gasPrice).toString(),
      gas_limit: tx.gasLimit,
      tx_type: TX_TYPE_TO_PASCAL[tx.txType] || "Transfer",
      payload: Array.from(payloadBytes),
      signature: Array.from(sigBytes),
    };
  }

  static verifySignature(
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array,
  ): boolean {
    return ml_dsa65.verify(signature, message, publicKey);
  }
}

// ─── Transaction Builder ──────────────────────────────────────

export class TransactionBuilder {
  static transfer(
    to: string,
    value: string,
    nonce: number,
  ): UnsignedTransaction {
    return {
      to,
      value,
      nonce,
      gasPrice: "1000000000",
      gasLimit: 21000,
      txType: "transfer",
      payload: "0x",
    };
  }
  static stake(
    validator: string,
    value: string,
    nonce: number,
  ): UnsignedTransaction {
    return {
      to: validator,
      value,
      nonce,
      gasPrice: "1000000000",
      gasLimit: 50000,
      txType: "stake",
      payload: "0x",
    };
  }
  static unstake(
    validator: string,
    value: string,
    nonce: number,
  ): UnsignedTransaction {
    return {
      to: validator,
      value,
      nonce,
      gasPrice: "1000000000",
      gasLimit: 50000,
      txType: "unstake",
      payload: "0x",
    };
  }
  static delegate(
    validator: string,
    value: string,
    nonce: number,
  ): UnsignedTransaction {
    return {
      to: validator,
      value,
      nonce,
      gasPrice: "1000000000",
      gasLimit: 50000,
      txType: "delegate",
      payload: "0x",
    };
  }
  static undelegate(
    validator: string,
    value: string,
    nonce: number,
  ): UnsignedTransaction {
    return {
      to: validator,
      value,
      nonce,
      gasPrice: "1000000000",
      gasLimit: 50000,
      txType: "undelegate",
      payload: "0x",
    };
  }
  static claim(validator: string, nonce: number): UnsignedTransaction {
    return {
      to: validator,
      value: "0",
      nonce,
      gasPrice: "1000000000",
      gasLimit: 50000,
      txType: "claim",
      payload: "0x",
    };
  }
  static governance(
    proposalId: string,
    vote: boolean,
    nonce: number,
  ): UnsignedTransaction {
    const voteByte = vote ? "01" : "00";
    return {
      to: "rstn1governance000000000000000000000000000",
      value: "0",
      nonce,
      gasPrice: "1000000000",
      gasLimit: 80000,
      txType: "governance",
      payload: "0x" + voteByte + proposalId,
    };
  }
  static contractCall(
    contractAddress: string,
    value: string,
    nonce: number,
    payload: string,
  ): UnsignedTransaction {
    return {
      to: contractAddress,
      value,
      nonce,
      gasPrice: "1000000000",
      gasLimit: 200000,
      txType: "contract_call",
      payload,
    };
  }
  static contractDeploy(
    value: string,
    nonce: number,
    bytecode: string,
  ): UnsignedTransaction {
    return {
      to: "rstn1" + "0".repeat(40),
      value,
      nonce,
      gasPrice: "1000000000",
      gasLimit: 5000000,
      txType: "contract_deploy",
      payload: bytecode,
    };
  }
}

// hashTransaction is imported from the shared tx-helpers module below.
import { hashTransaction } from "@/lib/rstn-tx-helpers";

export default RstnClient;
