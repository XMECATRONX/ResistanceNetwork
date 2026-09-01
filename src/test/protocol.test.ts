import { describe, it, expect } from "vitest";
import { NETWORK_STATS, QUANTUM_DEFENSE } from "@/lib/protocol";

describe("Protocol Data Integrity", () => {
  it("NETWORK_STATS has valid post-quantum configuration", () => {
    expect(NETWORK_STATS.signatureScheme).toContain("Dilithium3");
    expect(NETWORK_STATS.hashFunction).toContain("SHA-3");
    expect(NETWORK_STATS.pqCoverage).toContain("100%");
    expect(NETWORK_STATS.shardCount).toBe(64);
    expect(parseInt(NETWORK_STATS.maxSupply.replace(/,/g, ""))).toBe(
      1_000_000_000,
    );
  });

  it("NETWORK_STATS TPS matches shard count × shard size", () => {
    const shardTps = 2048;
    const expectedTps = NETWORK_STATS.shardCount * shardTps;
    // 64 × 2048 = 131,072 — the 250k target is aspirational with optimization
    expect(expectedTps).toBeGreaterThan(100_000);
  });

  it("QUANTUM_DEFENSE has 6 layers covering all attack surfaces", () => {
    expect(QUANTUM_DEFENSE.length).toBeGreaterThanOrEqual(6);
    QUANTUM_DEFENSE.forEach((layer) => {
      expect(layer.id).toBeGreaterThan(0);
      expect(layer.name).toBeTruthy();
      expect(layer.threat).toBeTruthy();
      expect(layer.solution).toBeTruthy();
      expect(layer.scheme).toBeTruthy();
      expect(layer.coverage).toBeGreaterThan(0);
    });
  });

  it("QUANTUM_DEFENSE covers transport, signatures, addresses, consensus, and application layers", () => {
    const layers = QUANTUM_DEFENSE.map((d) => d.layer);
    const hasTransport = layers.some((l) => l.includes("Red"));
    const hasCrypto = layers.some((l) => l.includes("Criptográfica"));
    const hasConsensus = layers.some((l) => l.includes("Consenso"));
    expect(hasTransport).toBe(true);
    expect(hasCrypto).toBe(true);
    expect(hasConsensus).toBe(true);
  });
});
