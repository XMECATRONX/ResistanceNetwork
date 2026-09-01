import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api";

describe("Faucet API — mock mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims testnet RSTN and returns a hash + amount", async () => {
    const result = await api.faucetClaim("rstn1testaddress");
    expect(result.hash).toMatch(/^0x/);
    expect(result.amount).toBe(1000);
  });

  it("generates unique hashes for each claim", async () => {
    const result1 = await api.faucetClaim("rstn1test1");
    const result2 = await api.faucetClaim("rstn1test2");
    expect(result1.hash).not.toBe(result2.hash);
  });

  it("returns 1000 RSTN per claim (testnet standard)", async () => {
    const result = await api.faucetClaim("rstn1test");
    expect(result.amount).toBe(1000);
  });
});
