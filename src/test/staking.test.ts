import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api";

// Mock RPC_MODE to false so we use mock data
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    RPC_MODE: false,
  };
});

describe("Staking API — mock mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns staking info for an address", async () => {
    const info = await api.getStakingInfo("rstn1test");
    expect(info.address).toBe("rstn1test");
    expect(parseFloat(info.balance)).toBeGreaterThan(0);
    expect(parseFloat(info.staked)).toBeGreaterThan(0);
    expect(info.activeValidators).toBeGreaterThan(0);
  });

  it("stake returns a transaction hash", async () => {
    const result = await api.stake("rstn1test", 100);
    expect(result.hash).toMatch(/^0x/);
    expect(result.amount).toBe(100);
    expect(result.type).toBe("stake");
  });

  it("unstake returns a transaction hash", async () => {
    const result = await api.unstake("rstn1test", 50);
    expect(result.hash).toMatch(/^0x/);
    expect(result.amount).toBe(50);
    expect(result.type).toBe("unstake");
  });

  it("delegate returns a transaction hash", async () => {
    const result = await api.delegate("rstn1delegator", "rstn1validator", 200);
    expect(result.hash).toMatch(/^0x/);
    expect(result.amount).toBe(200);
    expect(result.type).toBe("delegate");
  });

  it("claimRewards returns a transaction hash and amount", async () => {
    const result = await api.claimRewards("rstn1test");
    expect(result.hash).toMatch(/^0x/);
    expect(result.amount).toBeGreaterThan(0);
    expect(result.type).toBe("claim");
  });

  it("returns staking validators list", async () => {
    const validators = await api.getStakingValidators();
    expect(validators.length).toBeGreaterThan(0);
    validators.forEach((v) => {
      expect(v.address).toMatch(/^rstn1/);
      expect(parseFloat(v.stake)).toBeGreaterThan(0);
      expect(parseFloat(v.commission)).toBeGreaterThanOrEqual(0);
    });
  });

  it("returns governance proposals", async () => {
    const proposals = await api.getGovernanceProposals();
    expect(proposals.length).toBeGreaterThan(0);
    proposals.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.status).toBeTruthy();
      expect(p.votesFor).toBeGreaterThanOrEqual(0);
      expect(p.votesAgainst).toBeGreaterThanOrEqual(0);
    });
  });
});
