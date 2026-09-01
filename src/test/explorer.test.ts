import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api";

describe("Explorer API — mock mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns explorer stats with block height", async () => {
    const stats = await api.getExplorerStats();
    expect(stats.blockHeight).toBeGreaterThan(0);
    expect(stats.activeValidators).toBeGreaterThan(0);
    expect(stats.shardCount).toBeGreaterThan(0);
    expect(parseFloat(stats.avgFee)).toBeGreaterThanOrEqual(0);
  });

  it("returns latest blocks", async () => {
    const blocks = await api.getLatestBlocks(10);
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((b) => {
      expect(b.height).toBeGreaterThan(0);
      expect(b.hash).toMatch(/^0x/);
      expect(b.validator).toMatch(/^rstn/);
      expect(b.txCount).toBeGreaterThanOrEqual(0);
      expect(b.shard).toBeGreaterThanOrEqual(0);
    });
  });

  it("returns latest transactions", async () => {
    const txs = await api.getLatestTransactions(12);
    expect(txs.length).toBeGreaterThan(0);
    txs.forEach((t) => {
      expect(t.hash).toMatch(/^0x/);
      expect(t.from).toMatch(/^rstn1/);
      expect(t.to).toMatch(/^rstn1/);
      expect(t.type).toBeTruthy();
      expect(t.status).toBeTruthy();
    });
  });

  it("returns top validators", async () => {
    const validators = await api.getTopValidators(10);
    expect(validators.length).toBeGreaterThan(0);
    validators.forEach((v) => {
      expect(v.address).toMatch(/^rstn1/);
      expect(parseFloat(v.stake)).toBeGreaterThan(0);
      expect(v.uptime).toMatch(/%/);
    });
  });

  it("finds a block by height", async () => {
    const blocks = await api.getLatestBlocks(10);
    const firstHeight = blocks[0].height;
    const block = await api.getBlockByHeight(firstHeight);
    expect(block).not.toBeNull();
    expect(block!.height).toBe(firstHeight);
  });

  it("returns null for non-existent block height", async () => {
    const block = await api.getBlockByHeight(99999999);
    expect(block).toBeNull();
  });

  it("finds a transaction by hash", async () => {
    const txs = await api.getLatestTransactions(12);
    const firstHash = txs[0].hash;
    const tx = await api.getTransactionByHash(firstHash);
    expect(tx).not.toBeNull();
    expect(tx!.hash).toBe(firstHash);
  });

  it("returns null for non-existent transaction hash", async () => {
    const tx = await api.getTransactionByHash("0xnonexistent");
    expect(tx).toBeNull();
  });

  it("returns network stats with post-quantum fields", async () => {
    const stats = await api.getNetworkStats();
    expect(stats.quantumSecurity).toContain("256");
    expect(stats.signatureScheme).toContain("Dilithium");
    expect(stats.hashFunction).toContain("SHA-3");
    expect(stats.shardCount).toBe(64);
    expect(stats.pqCoverage).toContain("100%");
  });
});
