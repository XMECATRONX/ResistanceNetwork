// @ts-ignore
/**
 * RstnClient — JSON-RPC client for the RSTN node.
 *
 * Extracted from rstn-sdk.ts to keep modules focused. Handles transport
 * (fetch + retry + exponential backoff), connection-status events, and
 * exposes one typed method per RPC endpoint.
 */
import type {
  ConnectionStatus,
  NodeHealth,
  PeerInfo,
  ShardInfo,
  NetworkStats,
  BlockInfo,
  TxInfo,
  ValidatorInfo,
  BalanceInfo,
  GovernanceProposal,
} from "@/lib/rstn-sdk-types";

type EventCallback = (status: ConnectionStatus) => void;

export class RstnClient {
  private endpoint: string;
  private rpcId = 0;
  private timeout: number;
  private maxRetries: number;
  private status: ConnectionStatus = "disconnected";
  private listeners: Set<EventCallback> = new Set();
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    endpoint: string = "http://localhost:9944",
    timeout = 10_000,
    maxRetries = 3,
  ) {
    this.endpoint = endpoint;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  // ── Event system ──
  onStatusChange(cb: EventCallback): () => void {
    this.listeners.add(cb);
    cb(this.status);
    return () => this.listeners.delete(cb);
  }

  private setStatus(s: ConnectionStatus) {
    this.status = s;
    this.listeners.forEach((cb) => cb(s));
  }

  // ── Auto-reconnect with exponential backoff ──
  startHealthMonitor(intervalMs = 15_000): void {
    if (this.healthInterval) return;
    this.healthInterval = setInterval(async () => {
      const ok = await this.health();
      if (!ok && this.status === "connected") {
        this.setStatus("reconnecting");
        this.attemptReconnect();
      } else if (ok && this.status !== "connected") {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
      }
    }, intervalMs);
  }

  stopHealthMonitor(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  private async attemptReconnect() {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      await new Promise((r) => setTimeout(r, delay));
      const ok = await this.health();
      if (ok) {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        return;
      }
    }
    this.setStatus("error");
  }

  // ── Core RPC with retry ──
  private async rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        const res = await fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: ++this.rpcId,
            method,
            params,
          }),
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error.message || "RPC error");
        if (this.status !== "connected") {
          this.reconnectAttempts = 0;
          this.setStatus("connected");
        }
        return json.result as T;
      } catch (err) {
        lastErr = err as Error;
        if (attempt < this.maxRetries) {
          const delay = this.reconnectDelay * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    this.setStatus("error");
    throw lastErr || new Error("RPC call failed");
  }

  // ── Network ──
  async health(): Promise<boolean> {
    try {
      await this.rpcCall<boolean>("rstn_health");
      return true;
    } catch {
      return false;
    }
  }
  async getNetworkStats(): Promise<NetworkStats> {
    return this.rpcCall<NetworkStats>("rstn_getNetworkStats");
  }
  async getHealth(): Promise<NodeHealth> {
    return this.rpcCall<NodeHealth>("rstn_health");
  }
  async getPeers(): Promise<PeerInfo[]> {
    return this.rpcCall<PeerInfo[]>("rstn_getPeers");
  }
  async getShards(): Promise<ShardInfo[]> {
    return this.rpcCall<ShardInfo[]>("rstn_getShards");
  }

  // ── Blocks ──
  async getLatestBlocks(limit = 10): Promise<BlockInfo[]> {
    return this.rpcCall<BlockInfo[]>("rstn_getLatestBlocks", [limit]);
  }
  async getBlockByHeight(height: number): Promise<BlockInfo | null> {
    return this.rpcCall<BlockInfo | null>("rstn_getBlockByHeight", [height]);
  }
  async getBlockByHash(hash: string): Promise<BlockInfo | null> {
    return this.rpcCall<BlockInfo | null>("rstn_getBlockByHash", [hash]);
  }

  // ── Transactions ──
  async getLatestTransactions(limit = 12): Promise<TxInfo[]> {
    return this.rpcCall<TxInfo[]>("rstn_getLatestTransactions", [limit]);
  }
  async getTransactionByHash(hash: string): Promise<TxInfo | null> {
    return this.rpcCall<TxInfo | null>("rstn_getTransactionByHash", [hash]);
  }
  async getTransactionsByAddress(
    address: string,
    limit = 20,
  ): Promise<TxInfo[]> {
    return this.rpcCall<TxInfo[]>("rstn_getTransactionsByAddress", [
      address,
      limit,
    ]);
  }
  async getPendingTransactions(limit = 20): Promise<TxInfo[]> {
    return this.rpcCall<TxInfo[]>("rstn_getPendingTransactions", [limit]);
  }

  // ── Validators & Staking ──
  async getTopValidators(limit = 10): Promise<ValidatorInfo[]> {
    return this.rpcCall<ValidatorInfo[]>("rstn_getTopValidators", [limit]);
  }
  async getValidator(address: string): Promise<ValidatorInfo | null> {
    return this.rpcCall<ValidatorInfo | null>("rstn_getValidator", [address]);
  }
  async getStakingInfo(address: string): Promise<BalanceInfo> {
    return this.rpcCall<BalanceInfo>("rstn_getStakingInfo", [address]);
  }

  // ── Wallet ──
  async getBalance(address: string): Promise<BalanceInfo> {
    return this.rpcCall<BalanceInfo>("rstn_getBalance", [address]);
  }
  async getNonce(address: string): Promise<number> {
    return this.rpcCall<number>("rstn_getNonce", [address]);
  }

  // ── Governance ──
  async getProposals(): Promise<GovernanceProposal[]> {
    return this.rpcCall<GovernanceProposal[]>("rstn_getProposals");
  }
  async getProposal(id: string): Promise<GovernanceProposal | null> {
    return this.rpcCall<GovernanceProposal | null>("rstn_getProposal", [id]);
  }

  // ── Faucet ──
  async faucetClaim(
    address: string,
  ): Promise<{ hash: string; amount: number }> {
    return this.rpcCall<{ hash: string; amount: number }>("rstn_faucetClaim", [
      address,
    ]);
  }

  // ── Submit ──
  async sendTransaction(signedTx: unknown): Promise<string> {
    return this.rpcCall<string>("rstn_sendTransaction", [signedTx]);
  }

  // ── Utility ──
  getStatus(): ConnectionStatus {
    return this.status;
  }
  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
    this.setStatus("disconnected");
  }
}

export default RstnClient;
