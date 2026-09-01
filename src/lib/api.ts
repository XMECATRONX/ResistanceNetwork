/**
 * RSTN — Unified API Client
 * ──────────────────────────────────────────────────────────
 * Single entry point for ALL data access in the frontend.
 *
 * Today: reads from mock data (protocol.ts).
 * Tomorrow: reads from rstn-node via JSON-RPC.
 *
 * When the backend is ready, flip `RPC_MODE` to true
 * and implement the RPC calls. No view component changes needed.
 */

import {
  NETWORK_STATS,
  EXPLORER_STATS,
  MOCK_BLOCKS,
  MOCK_TXS,
  MOCK_VALIDATORS,
  WALLET_PORTFOLIO,
  STAKING_VALIDATORS,
  GOVERNANCE_PROPOSALS,
  TX_TYPE_COLORS,
} from "@/lib/protocol";

// ─── Configuration ──────────────────────────────────────────

/**
 * RPC_MODE = true  → uses JSON-RPC calls to rstn-node (default).
 * RPC_MODE = false → uses mock data (fallback when node is unreachable).
 *
 * Auto-detection runs on app load; if the node is unreachable it flips
 * back to false and uses mock data transparently.
 */
export let RPC_MODE = true;

/** Flip RPC mode at runtime (e.g., when a node is detected). */
export function setRpcMode(enabled: boolean) {
  if (enabled !== RPC_MODE) {
    RPC_MODE = enabled;
    if (enabled) {
      console.info(
        "%c[RSTN] RPC mode enabled — connected to live node",
        "color: #00E673",
      );
    } else {
      console.info(
        "%c[RSTN] RPC mode disabled — using mock data",
        "color: #00C8FF",
      );
    }
  }
}

/**
 * Auto-detect if a rstn-node is reachable. If so, flip RPC_MODE to true.
 * Called once on app load. Silent failure if node is not running.
 */
export async function autoDetectRpc(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(getRpcEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 0,
        method: "rstn_health",
        params: [],
      }),
    });
    clearTimeout(timeout);
    if (res.ok) {
      const json = await res.json();
      if (json.result === true) {
        setRpcMode(true);
        return true;
      }
    }
  } catch {
    // Node not running — stay in mock mode (silent, no console error)
  }
  return false;
}

/**
 * localStorage key for the user-configurable RPC endpoint.
 */
const RPC_ENDPOINT_KEY = "rstn_rpc_endpoint";

/**
 * Default rstn-node RPC endpoint.
 * The multi-node testnet runs node 0 on port 9944
 * (`./scripts/local-testnet.sh up 4`).
 * Single-node dev mode uses port 8545 (`--dev --port 8545`).
 */
const DEFAULT_RPC_ENDPOINT = "http://localhost:9944";

/**
 * The rstn-node RPC endpoint.
 *
 * Resolution order (checked on every call so runtime changes take effect):
 *   1. window.__RSTN_RPC__ (hard override)
 *   2. localStorage "rstn_rpc_endpoint" (user-configurable from UI)
 *   3. default http://localhost:9944 (matches rstn-node --port default)
 */
export function getRpcEndpoint(): string {
  if (typeof window !== "undefined") {
    if ((window as any).__RSTN_RPC__) return (window as any).__RSTN_RPC__;
    try {
      const stored = localStorage.getItem(RPC_ENDPOINT_KEY);
      if (stored) return stored;
    } catch {
      /* localStorage unavailable */
    }
  }
  return DEFAULT_RPC_ENDPOINT;
}

/**
 * Backwards-compatible alias. Reads the current endpoint at module-eval time;
 * prefer getRpcEndpoint() inside async functions for live values.
 */
export const RPC_ENDPOINT = DEFAULT_RPC_ENDPOINT;

/**
 * Persist a user-chosen RPC endpoint and re-run auto-detection.
 */
export async function setRpcEndpoint(url: string): Promise<boolean> {
  try {
    localStorage.setItem(RPC_ENDPOINT_KEY, url);
  } catch {
    /* ignore */
  }
  // Re-detect against the new endpoint
  return autoDetectRpc();
}

/**
 * Request timeout for RPC calls (ms).
 */
export const RPC_TIMEOUT = 10_000;

/**
 * RPC call with automatic fallback to mock data on failure.
 * Logs the error clearly so the dev backend knows what's broken.
 */
export async function rpcCallWithFallback<T>(
  method: string,
  params: unknown[] = [],
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await rpcCall<T>(method, params);
  } catch (err) {
    console.warn(
      `%c[RSTN] RPC "${method}" failed — falling back to mock data for ${label}`,
      "color: #f87171",
      err instanceof Error ? err.message : err,
    );
    // Auto-disable RPC mode if the node is unreachable
    setRpcMode(false);
    return fallback;
  }
}

// ─── Types ──────────────────────────────────────────────────

export interface NetworkStats {
  tps: number;
  finality: string;
  blockTime: string;
  latency: string;
  validators: number;
  nodes: number;
  quantumSecurity: string;
  signatureScheme: string;
  hashFunction: string;
  vrfScheme: string;
  transport: string;
  shardCount: number;
  shardSize: string;
  storage: string;
  uptime: string;
  energyEfficiency: string;
  txCost: string;
  pqCoverage: string;
  genesisDate: string;
  token: string;
  maxSupply: string;
}

export interface ExplorerStats {
  blockHeight: number;
  avgBlockTime: string;
  tps: number;
  tpsTarget: number;
  activeValidators: number;
  pendingTxs: number;
  avgFee: string;
  totalTxCount: string;
  shardCount: number;
}

export interface Block {
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

export interface Transaction {
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

export interface Validator {
  rank: number;
  address: string;
  stake: string;
  blocksProduced: number;
  uptime: string;
  commission: string;
  status: string;
  shard: number;
}

export interface WalletPortfolio {
  address: string;
  balance: string;
  staked: string;
  delegated: string;
  rewards: string;
  apy: string;
  pendingRewards: string;
  nonce?: number;
}

export interface StakingValidator {
  address: string;
  name: string;
  stake: string;
  apy: string;
  uptime: string;
  commission: string;
  shard: number;
  delegated: boolean;
}

export interface GovernanceProposal {
  id: string;
  title: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  turnout: string;
  endsIn: string;
  description: string;
}

// ─── Smart Contract Types ───────────────────────────────────

/** Read-only contract call result (eth_call equivalent). */
export interface ContractCallResult {
  success: boolean;
  gasUsed: number;
  output: string; // 0x-prefixed hex
  error?: string;
}

/** Predicted contract address for a deployer + nonce. */
export interface ContractAddressResult {
  address: string;
}

// ─── RPC Transport (for future use) ────────────────────────

let rpcIdCounter = 0;

async function rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT);

  try {
    const res = await fetch(getRpcEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++rpcIdCounter,
        method,
        params,
      }),
    });

    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || "RPC error");
    return json.result as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── API Surface ───────────────────────────────────────────
// Each function has two paths: mock (now) and rpc (future).
// Views import from here — never from protocol.ts directly.

export const api = {
  // ── Network Stats ──────────────────────────────────────
  async getNetworkStats(): Promise<NetworkStats> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getNetworkStats",
        [],
        NETWORK_STATS as unknown as NetworkStats,
        "network stats",
      );
    }
    return NETWORK_STATS as unknown as NetworkStats;
  },

  // ── Explorer Stats ──────────────────────────────────────
  async getExplorerStats(): Promise<ExplorerStats> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getExplorerStats",
        [],
        EXPLORER_STATS as unknown as ExplorerStats,
        "explorer stats",
      );
    }
    return EXPLORER_STATS as unknown as ExplorerStats;
  },

  // ── Blocks ──────────────────────────────────────────────
  async getLatestBlocks(limit = 10): Promise<Block[]> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getLatestBlocks",
        [limit],
        MOCK_BLOCKS as unknown as Block[],
        "blocks",
      );
    }
    return MOCK_BLOCKS as unknown as Block[];
  },

  async getBlockByHeight(height: number): Promise<Block | null> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getBlockByHeight",
        [height],
        null,
        "block",
      );
    }
    const block = (MOCK_BLOCKS as unknown as Block[]).find(
      (b) => b.height === height,
    );
    return block || null;
  },

  // ── Transactions ────────────────────────────────────────
  async getLatestTransactions(limit = 12): Promise<Transaction[]> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getLatestTransactions",
        [limit],
        MOCK_TXS as unknown as Transaction[],
        "transactions",
      );
    }
    return MOCK_TXS as unknown as Transaction[];
  },

  async getTransactionByHash(hash: string): Promise<Transaction | null> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getTransactionByHash",
        [hash],
        null,
        "transaction",
      );
    }
    const tx = (MOCK_TXS as unknown as Transaction[]).find(
      (t) => t.hash === hash,
    );
    return tx || null;
  },

  // ── Validators ──────────────────────────────────────────
  async getTopValidators(limit = 10): Promise<Validator[]> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getTopValidators",
        [limit],
        MOCK_VALIDATORS as unknown as Validator[],
        "validators",
      );
    }
    return MOCK_VALIDATORS as unknown as Validator[];
  },

  // ── Wallet ──────────────────────────────────────────────
  async getWalletPortfolio(address: string): Promise<WalletPortfolio> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getBalance",
        [address],
        WALLET_PORTFOLIO as unknown as WalletPortfolio,
        "wallet",
      );
    }
    return WALLET_PORTFOLIO as unknown as WalletPortfolio;
  },

  // ── Staking ─────────────────────────────────────────────
  async getStakingValidators(): Promise<StakingValidator[]> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getStakingValidators",
        [],
        STAKING_VALIDATORS as unknown as StakingValidator[],
        "staking validators",
      );
    }
    return STAKING_VALIDATORS as unknown as StakingValidator[];
  },

  // ── Governance ──────────────────────────────────────────
  async getGovernanceProposals(): Promise<GovernanceProposal[]> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getProposals",
        [],
        GOVERNANCE_PROPOSALS as unknown as GovernanceProposal[],
        "governance",
      );
    }
    return GOVERNANCE_PROPOSALS as unknown as GovernanceProposal[];
  },

  // ── Transaction Type Colors (static, no RPC needed) ─────
  getTxTypeColors(): Record<string, string> {
    return TX_TYPE_COLORS;
  },

  // ── Submit Transaction (future) ─────────────────────────
  async submitTransaction(_signedTx: unknown): Promise<string> {
    if (RPC_MODE) {
      try {
        return await rpcCall<string>("rstn_sendTransaction", [_signedTx]);
      } catch (err) {
        console.warn(
          "%c[RSTN] RPC submitTransaction failed",
          "color: #f87171",
          err,
        );
        setRpcMode(false);
        throw err; // Don't fallback for write operations — user needs to know it failed
      }
    }
    return "0x" + Math.random().toString(16).slice(2, 18).padStart(16, "0");
  },

  // ── Faucet (testnet) ────────────────────────────────────
  async faucetClaim(
    address: string,
  ): Promise<{ hash: string; amount: number }> {
    if (RPC_MODE) {
      try {
        return await rpcCall<{ hash: string; amount: number }>(
          "rstn_faucetClaim",
          [address],
        );
      } catch (err) {
        console.warn("%c[RSTN] RPC faucetClaim failed", "color: #f87171", err);
        setRpcMode(false);
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
    return {
      hash: "0x" + Math.random().toString(16).slice(2, 18).padStart(16, "0"),
      amount: 1000,
    };
  },

  // ── Staking Actions ─────────────────────────────────────
  async stake(
    address: string,
    amount: number,
  ): Promise<{ hash: string; amount: number; type: string }> {
    if (RPC_MODE) {
      try {
        return await rpcCall("rstn_stake", [{ address, amount }]);
      } catch (err) {
        console.warn("%c[RSTN] RPC stake failed", "color: #f87171", err);
        setRpcMode(false);
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    return {
      hash: "0x" + Math.random().toString(16).slice(2, 18).padStart(16, "0"),
      amount,
      type: "stake",
    };
  },

  async unstake(
    address: string,
    amount: number,
  ): Promise<{ hash: string; amount: number; type: string }> {
    if (RPC_MODE) {
      try {
        return await rpcCall("rstn_unstake", [{ address, amount }]);
      } catch (err) {
        console.warn("%c[RSTN] RPC unstake failed", "color: #f87171", err);
        setRpcMode(false);
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    return {
      hash: "0x" + Math.random().toString(16).slice(2, 18).padStart(16, "0"),
      amount,
      type: "unstake",
    };
  },

  async delegate(
    delegator: string,
    validator: string,
    amount: number,
  ): Promise<{ hash: string; amount: number; type: string }> {
    if (RPC_MODE) {
      try {
        return await rpcCall("rstn_delegate", [
          { delegator, validator, amount },
        ]);
      } catch (err) {
        console.warn("%c[RSTN] RPC delegate failed", "color: #f87171", err);
        setRpcMode(false);
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    return {
      hash: "0x" + Math.random().toString(16).slice(2, 18).padStart(16, "0"),
      amount,
      type: "delegate",
    };
  },

  async undelegate(
    delegator: string,
    validator: string,
    amount: number,
  ): Promise<{ hash: string; amount: number; type: string }> {
    if (RPC_MODE) {
      try {
        return await rpcCall("rstn_undelegate", [
          { delegator, validator, amount },
        ]);
      } catch (err) {
        console.warn("%c[RSTN] RPC undelegate failed", "color: #f87171", err);
        setRpcMode(false);
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    return {
      hash: "0x" + Math.random().toString(16).slice(2, 18).padStart(16, "0"),
      amount,
      type: "undelegate",
    };
  },

  async claimRewards(
    address: string,
  ): Promise<{ hash: string; amount: number; type: string }> {
    if (RPC_MODE) {
      try {
        return await rpcCall("rstn_claimRewards", [{ address }]);
      } catch (err) {
        console.warn("%c[RSTN] RPC claimRewards failed", "color: #f87171", err);
        setRpcMode(false);
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    return {
      hash: "0x" + Math.random().toString(16).slice(2, 18).padStart(16, "0"),
      amount: 12.5,
      type: "claim",
    };
  },

  async getStakingInfo(address: string): Promise<{
    address: string;
    balance: string;
    staked: string;
    delegated: string;
    rewards: string;
    pendingRewards: string;
    apy: string;
    totalNetworkStaked: string;
    activeValidators: number;
  }> {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getStakingInfo",
        [{ address }],
        {
          address,
          balance: "1250.00",
          staked: "5000.00",
          delegated: "2000.00",
          rewards: "12.50",
          pendingRewards: "12.50",
          apy: "8.42%",
          totalNetworkStaked: "412800000",
          activeValidators: 128,
        },
        "staking info",
      );
    }
    return {
      address,
      balance: "1250.00",
      staked: "5000.00",
      delegated: "2000.00",
      rewards: "12.50",
      pendingRewards: "12.50",
      apy: "8.42%",
      totalNetworkStaked: "412800000",
      activeValidators: 128,
    };
  },

  // ── Bridge ──────────────────────────────────────────────
  async getBridgeReserves(): Promise<
    { chain: string; locked: string; minted: string; burned: string }[]
  > {
    if (RPC_MODE) {
      return rpcCallWithFallback(
        "rstn_getBridgeReserves",
        [],
        [],
        "bridge reserves",
      );
    }
    return [
      { chain: "Bitcoin", locked: "0", minted: "0", burned: "0" },
      { chain: "Ethereum", locked: "0", minted: "0", burned: "0" },
      { chain: "Solana", locked: "0", minted: "0", burned: "0" },
    ];
  },

  // ── Smart Contracts ────────────────────────────────────
  async getCode(address: string): Promise<string | null> {
    if (RPC_MODE) {
      return rpcCallWithFallback<string | null>(
        "rstn_getCode",
        [address],
        null,
        "contract code",
      );
    }
    return null;
  },

  async callContract(
    to: string,
    data: string,
    from?: string,
    value?: string,
    gas?: number,
  ): Promise<ContractCallResult> {
    if (RPC_MODE) {
      return rpcCallWithFallback<ContractCallResult>(
        "rstn_call",
        [{ to, data, from, value, gas }],
        { success: false, gasUsed: 0, output: "0x", error: "mock" },
        "contract call",
      );
    }
    return { success: false, gasUsed: 0, output: "0x", error: "mock" };
  },

  getContractAddress(
    from: string,
    nonce: number,
  ): Promise<ContractAddressResult> {
    if (RPC_MODE) {
      return rpcCallWithFallback<ContractAddressResult>(
        "rstn_getContractAddress",
        [{ from, nonce }],
        { address: "rstn1mock" },
        "contract address",
      );
    }
    return Promise.resolve({ address: "rstn1mock" });
  },

  // ── Testnet Multi-Node Monitoring ──────────────────────
  // Queries the local 4-node testnet (ports 9944/9946/9948/9950).
  // Each node is polled for health + latest block height.
  async getTestnetNodes(): Promise<TestnetNode[]> {
    const ports = [9944, 9946, 9948, 9950];
    const results = await Promise.all(
      ports.map(async (port, i) => {
        const base = `http://localhost:${port}`;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(base, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: port,
              method: "rstn_getLatestBlocks",
              params: [1],
            }),
          });
          clearTimeout(timeout);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const height = json.result?.[0]?.height ?? 0;
          const validator = json.result?.[0]?.validator ?? "";
          return {
            id: `node-${i}`,
            index: i,
            port,
            online: true,
            blockHeight: height,
            validator,
          } as TestnetNode;
        } catch {
          return {
            id: `node-${i}`,
            index: i,
            port,
            online: false,
            blockHeight: 0,
            validator: "",
          } as TestnetNode;
        }
      }),
    );
    return results;
  },
};

// ─── Testnet Multi-Node Types ───────────────────────────────

export interface TestnetNode {
  id: string;
  index: number;
  port: number;
  online: boolean;
  blockHeight: number;
  validator: string;
}

// ─── Health Check (for connection status indicator) ────────

export async function checkRpcConnection(): Promise<boolean> {
  if (!RPC_MODE) return false;
  try {
    await rpcCall("rstn_health");
    return true;
  } catch {
    setRpcMode(false);
    return false;
  }
}
