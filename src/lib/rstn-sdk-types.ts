/**
 * Shared SDK type definitions.
 *
 * Extracted from rstn-sdk.ts so both the wallet module (rstn-sdk.ts) and the
 * RPC client module (rstn-client.ts) can import a single source of truth
 * without a circular dependency.
 */

export type TxType =
  | "transfer"
  | "stake"
  | "unstake"
  | "delegate"
  | "undelegate"
  | "claim"
  | "governance"
  | "contract_call"
  | "contract_deploy";

export interface UnsignedTransaction {
  to: string;
  value: string;
  nonce: number;
  gasPrice: string;
  gasLimit: number;
  txType: TxType;
  payload: string;
}

export interface SignedTransaction extends UnsignedTransaction {
  from: string;
  signature: string;
}

export interface NetworkStats {
  tps: number;
  finality: string;
  blockTime: string;
  validators: number;
  nodes: number;
  quantumSecurity: string;
  signatureScheme: string;
  hashFunction: string;
  vrfScheme: string;
  transport: string;
  shardCount: number;
  uptime: string;
  energyEfficiency: string;
  txCost: string;
  pqCoverage: string;
  genesisDate: string;
  token: string;
  maxSupply: string;
  chainHeight: number;
}

export interface BlockInfo {
  height: number;
  hash: string;
  validator: string;
  txCount: number;
  size: string;
  age: string;
  gasUsed: string;
  gasLimit: string;
  shard: number;
}

export interface TxInfo {
  hash: string;
  from: string;
  to: string;
  value: string;
  type: string;
  status: string;
  block: number;
  fee: string;
  shard: number;
}

export interface ValidatorInfo {
  rank: number;
  address: string;
  stake: string;
  blocksProduced: number;
  uptime: string;
  commission: string;
  status: string;
  shard: number;
}

export interface BalanceInfo {
  address: string;
  balance: string;
  staked: string;
  delegated: string;
  rewards: string;
  apy: string;
  pendingRewards: string;
}

// ─── Events & Connection ──────────────────────────────────────

export type ConnectionStatus =
  "connected" | "disconnected" | "reconnecting" | "error";

export interface NodeHealth {
  connected: boolean;
  blockHeight: number;
  peers: number;
  uptime: number;
  version: string;
}

export interface PeerInfo {
  id: string;
  address: string;
  latency: number;
  shard: number;
  status: "active" | "syncing" | "disconnected";
}

export interface ShardInfo {
  id: number;
  validatorCount: number;
  txCount: number;
  tps: number;
  size: string;
  status: "active" | "syncing" | "empty";
}

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  status: "active" | "passed" | "rejected" | "executed";
  votesFor: number;
  votesAgainst: number;
  turnout: string;
  endsIn: string;
}
