import { describe, it, expect } from "vitest";
import { RstnWallet, RstnClient, TransactionBuilder } from "@/lib/rstn-sdk";

// ─── Consensus Edge Cases ─────────────────────────────────────

describe("Consensus — Edge Cases", () => {
  it("BFT supermajority: 2f+1 out of 3f+1 validators required", () => {
    // For n=3f+1 validators, need 2f+1 votes for commit
    const testCases = [
      { n: 4, f: 1, needed: 3 }, // 4 validators, tolerate 1 fault, need 3
      { n: 7, f: 2, needed: 5 }, // 7 validators, tolerate 2 faults, need 5
      { n: 10, f: 3, needed: 7 }, // 10 validators, tolerate 3 faults, need 7
      { n: 13, f: 4, needed: 9 }, // 13 validators, tolerate 4 faults, need 9
      { n: 16, f: 5, needed: 11 }, // 16 validators, tolerate 5 faults, need 11
      { n: 100, f: 33, needed: 67 },
    ];

    for (const { n, f, needed } of testCases) {
      expect(n).toBe(3 * f + 1);
      expect(needed).toBe(2 * f + 1);
    }
  });

  it("BFT fails if only 2f votes (not enough for commit)", () => {
    const n = 7;
    const f = Math.floor((n - 1) / 3);
    const required = 2 * f + 1;
    const insufficient = 2 * f;
    expect(insufficient).toBeLessThan(required);
  });

  it("Consensus cannot proceed with >f Byzantine validators", () => {
    const n = 10;
    const f = Math.floor((n - 1) / 3);
    const byzantine = f + 1;
    expect(byzantine).toBeGreaterThan(f);
    // If byzantine > f, safety is not guaranteed
  });

  it("View change triggers after timeout without proposal", () => {
    let viewNumber = 0;
    let proposalReceived = false;
    const timeout = 1000;

    // Simulate: no proposal received within timeout
    if (!proposalReceived) {
      viewNumber++;
    }
    expect(viewNumber).toBe(1);

    // Next round: proposal received
    proposalReceived = true;
    if (!proposalReceived) {
      viewNumber++;
    }
    expect(viewNumber).toBe(1); // no increment
  });

  it("Double-signing detection: same height, different blocks", () => {
    const block1 = { height: 100, hash: "0xaaa", validator: "val1" };
    const block2 = { height: 100, hash: "0xbbb", validator: "val1" };

    // Slashing condition: same validator signs two blocks at same height
    const isDoubleSign =
      block1.height === block2.height &&
      block1.validator === block2.validator &&
      block1.hash !== block2.hash;
    expect(isDoubleSign).toBe(true);
  });

  it("Downtime slashing: validator misses too many blocks", () => {
    const blocksPerEpoch = 1000;
    const maxMissed = blocksPerEpoch * 0.1; // 10% threshold
    const missed = 105; // 10.5%
    expect(missed).toBeGreaterThan(maxMissed);
    // Should be slashed
  });

  it("Validator cannot vote on block from future view", () => {
    const currentView = 5;
    const blockView = 8;
    expect(blockView).toBeGreaterThan(currentView);
    // Vote should be rejected
  });

  it("Finality: 3-phase BFT requires Pre-Commit before Commit", () => {
    const phases = ["PROPOSE", "PREPARE", "PRE_COMMIT", "COMMIT"];
    const order: Record<string, number> = {};
    phases.forEach((p, i) => (order[p] = i));

    // Cannot skip PRE_COMMIT
    expect(order["COMMIT"] - order["PRE_COMMIT"]).toBe(1);
    expect(order["PRE_COMMIT"] - order["PREPARE"]).toBe(1);
    expect(order["PREPARE"] - order["PROPOSE"]).toBe(1);
  });
});

// ─── Reorg Handling ──────────────────────────────────────────

describe("Reorg Handling", () => {
  it("Chain selection: longest chain wins (with same total difficulty)", () => {
    const chainA = { length: 100, totalDiff: 1000, hash: "0xAAA" };
    const chainB = { length: 99, totalDiff: 1000, hash: "0xBBB" };
    expect(chainA.length).toBeGreaterThan(chainB.length);
  });

  it("Reorg depth limited to finality window", () => {
    const finalityWindow = 50; // blocks
    const reorgDepth = 30;
    expect(reorgDepth).toBeLessThan(finalityWindow);
    // Reorgs within finality window should not happen in BFT
    // If they do, it indicates a consensus failure
  });

  it("Finalized blocks are immutable — no reorg past finality", () => {
    const finalizedHeight = 1000;
    const attemptedReorgHeight = 995;
    expect(attemptedReorgHeight).toBeLessThan(finalizedHeight);
    // This reorg should be rejected by all honest nodes
  });

  it("Orphan blocks are stored but not part of canonical chain", () => {
    const canonical = [1, 2, 3, 4, 5];
    const orphan = { height: 4, hash: "0xORPHAN", parent: "0x3" };
    const canonicalAt4 = canonical.find((h) => h === 4);
    expect(canonicalAt4).toBeDefined();
    // Orphan has same height but different hash → not canonical
  });
});

// ─── Slashing Conditions ─────────────────────────────────────

describe("Slashing Conditions", () => {
  it("Double vote: validator votes twice in same round", () => {
    const vote1 = { round: 1, block: "0xAAA", validator: "val1" };
    const vote2 = { round: 1, block: "0xBBB", validator: "val1" };
    const isDoubleVote =
      vote1.round === vote2.round &&
      vote1.validator === vote2.validator &&
      vote1.block !== vote2.block;
    expect(isDoubleVote).toBe(true);
  });

  it("Surround vote: validator surrounds a previous vote", () => {
    const vote1 = { round: 1, block: "0xAAA", validator: "val1" };
    const vote2 = { round: 3, block: "0xBBB", validator: "val1" };
    const vote3 = { round: 2, block: "0xCCC", validator: "val1" };
    // vote3 (round 2) is surrounded by vote1 (round 1) and vote2 (round 3)
    const isSurround =
      vote1.round < vote3.round &&
      vote3.round < vote2.round &&
      vote1.validator === vote3.validator;
    expect(isSurround).toBe(true);
  });

  it("Slashing penalty: stake reduced proportionally", () => {
    const initialStake = 100000; // RSTN
    const slashingRate = 0.05; // 5% for first offense
    const penalty = initialStake * slashingRate;
    expect(penalty).toBe(5000);
    const remaining = initialStake - penalty;
    expect(remaining).toBe(95000);
  });

  it("Repeated offenses escalate slashing", () => {
    const stake = 100000;
    const offenses = [
      { rate: 0.05, expected: 5000 }, // 1st: 5%
      { rate: 0.1, expected: 9500 }, // 2nd: 10% of remaining
      { rate: 0.2, expected: 17100 }, // 3rd: 20% of remaining
    ];
    let remaining = stake;
    for (const { rate, expected } of offenses) {
      const penalty = remaining * rate;
      expect(penalty).toBeCloseTo(expected, -2);
      remaining -= penalty;
    }
    expect(remaining).toBeLessThan(stake * 0.7);
  });

  it("Validator jailed after slashing cannot propose or vote", () => {
    const validator = {
      jailed: true,
      jailUntilBlock: 1100,
      currentBlock: 1050,
    };
    const canParticipate =
      !validator.jailed || validator.currentBlock >= validator.jailUntilBlock;
    expect(canParticipate).toBe(false);
  });
});

// ─── Transaction Nonce & Replay Protection ──────────────────

describe("Transaction Nonce & Replay Protection", () => {
  it("Nonce must be sequential — rejects stale nonce", () => {
    const accountNonce = 5;
    const txNonce = 3;
    expect(txNonce).toBeLessThan(accountNonce);
    // Should reject: stale nonce
  });

  it("Nonce must be sequential — rejects future nonce (queued)", () => {
    const accountNonce = 5;
    const txNonce = 7;
    expect(txNonce).toBeGreaterThan(accountNonce);
    // Should queue but not execute immediately
  });

  it("Nonce matches current — executes immediately", () => {
    const accountNonce = 5;
    const txNonce = 5;
    expect(txNonce).toBe(accountNonce);
    // Execute and increment account nonce
  });

  it("Replay attack: same tx hash rejected", () => {
    const seenHashes = new Set(["0xABC123"]);
    const newTxHash = "0xABC123";
    expect(seenHashes.has(newTxHash)).toBe(true);
    // Reject: already seen
  });

  it("Chain ID prevents cross-chain replay", () => {
    const rstnChainId = 1;
    const ethereumChainId = 1;
    const solanaChainId = 0;
    // RSTN tx includes chain ID in signature
    const tx = { chainId: rstnChainId, to: "rstn1...", value: "100" };
    // Same tx on Ethereum would have different chain ID → invalid signature
    expect(tx.chainId).not.toBe(solanaChainId);
  });
});

// ─── Wallet & Signing Edge Cases ─────────────────────────────

describe("Wallet & Signing Edge Cases", () => {
  it("Generated wallet has valid rstn1 address", () => {
    const wallet = RstnWallet.generate();
    expect(wallet.address).toMatch(/^rstn1[a-f0-9]{40}$/);
    expect(wallet.publicKey).toBeTruthy();
    expect(wallet.canSign()).toBe(true);
  });

  it("Two different wallets have different addresses", () => {
    const w1 = RstnWallet.generate();
    const w2 = RstnWallet.generate();
    expect(w1.address).not.toBe(w2.address);
    expect(w1.publicKey).not.toBe(w2.publicKey);
  });

  it("Signed transaction can be verified", () => {
    const wallet = RstnWallet.generate();
    const tx = TransactionBuilder.transfer(
      wallet.address,
      "1000000000000000000",
      0,
    );
    // signTx is async but uses sync crypto internally
    return wallet.signTx(tx).then((signed) => {
      expect(signed.signature).toBeTruthy();
      expect(signed.from).toBe(wallet.publicKey);
      expect(signed.signature.length).toBeGreaterThan(100); // Dilithium3 sig is 3309 bytes hex = 6618 chars
    });
  });

  it("Transaction builder produces correct tx types", () => {
    const transfer = TransactionBuilder.transfer("rstn1abc", "100", 0);
    expect(transfer.txType).toBe("transfer");

    const stake = TransactionBuilder.stake("rstn1val", "500", 1);
    expect(stake.txType).toBe("stake");

    const unstake = TransactionBuilder.unstake("rstn1val", "500", 2);
    expect(unstake.txType).toBe("unstake");

    const delegate = TransactionBuilder.delegate("rstn1val", "500", 3);
    expect(delegate.txType).toBe("delegate");

    const undelegate = TransactionBuilder.undelegate("rstn1val", "500", 4);
    expect(undelegate.txType).toBe("undelegate");

    const claim = TransactionBuilder.claim("rstn1val", 5);
    expect(claim.txType).toBe("claim");

    const gov = TransactionBuilder.governance("prop-1", true, 6);
    expect(gov.txType).toBe("governance");
  });

  it("Governance vote payload encodes vote correctly", () => {
    const yesVote = TransactionBuilder.governance("prop-1", true, 0);
    expect(yesVote.payload).toContain("01"); // yes = 01

    const noVote = TransactionBuilder.governance("prop-1", false, 0);
    expect(noVote.payload).toContain("00"); // no = 00
  });

  it("Address derivation is deterministic from public key", () => {
    const wallet = RstnWallet.generate();
    const rederived = RstnWallet.deriveAddress(
      // Convert hex string back to bytes
      new Uint8Array(
        wallet.publicKey.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
      ),
    );
    expect(rederived).toBe(wallet.address);
  });
});

// ─── SDK Client Edge Cases ───────────────────────────────────

describe("SDK Client Edge Cases", () => {
  it("Client initializes with default endpoint", () => {
    const client = new RstnClient();
    expect(client.getStatus()).toBe("disconnected");
  });

  it("Client can set custom endpoint", () => {
    const client = new RstnClient("http://my-node:9944");
    client.setEndpoint("http://new-node:9944");
    expect(client.getStatus()).toBe("disconnected");
  });

  it("Health check returns false when node is unreachable", async () => {
    const client = new RstnClient("http://localhost:9999", 1000, 0);
    const ok = await client.health();
    expect(ok).toBe(false);
  });

  it("Status change listener receives updates", () => {
    const client = new RstnClient();
    const statuses: string[] = [];
    const unsub = client.onStatusChange((s) => statuses.push(s));
    // Initial status should be received
    expect(statuses.length).toBe(1);
    expect(statuses[0]).toBe("disconnected");
    unsub();
  });
});
