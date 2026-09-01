import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWallet } from "@/lib/wallet";
import { api } from "@/lib/api";

// Mock the API
vi.mock("@/lib/api", () => ({
  api: {
    submitTransaction: vi.fn().mockResolvedValue("0xabc123"),
    getWalletPortfolio: vi.fn().mockResolvedValue({
      address: "rstn1test",
      balance: "1000",
      staked: "500",
      delegated: "200",
      rewards: "12.5",
      apy: "8.42%",
      pendingRewards: "12.5",
    }),
  },
  autoDetectRpc: vi.fn().mockResolvedValue(false),
  setRpcMode: vi.fn(),
  RPC_MODE: false,
}));

// Mock the SDK to avoid heavy crypto in tests
vi.mock("@/lib/rstn-sdk", () => ({
  RstnWallet: {
    generate: () => ({
      publicKey: "deadbeef",
      address: "rstn1qtestaddress123",
      privateKey: "secret",
      signTx: vi.fn().mockResolvedValue({
        from: "deadbeef",
        signature: "sig_hex_3309_bytes",
        to: "rstn1dest",
        value: "100",
        nonce: 12345,
        gasPrice: "1000000000",
        gasLimit: 21000,
        txType: "transfer",
        payload: "0x",
      }),
    }),
    toNodeFormat: vi.fn().mockReturnValue({
      from: [0xde, 0xad],
      to: [0xbe, 0xef],
      value: "100",
      nonce: 12345,
      gas_price: "1000000000",
      gas_limit: 21000,
      tx_type: "Transfer",
      payload: [],
      signature: [0x01, 0x02],
    }),
  },
  TransactionBuilder: {
    transfer: vi.fn().mockReturnValue({
      to: "rstn1dest",
      value: "100",
      nonce: 12345,
      gasPrice: "1000000000",
      gasLimit: 21000,
      txType: "transfer",
      payload: "0x",
    }),
  },
}));

describe("Wallet Hook — useWallet", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the wallet singleton between tests so auto-connect does not
    // leak a stale session from a previous test.
    const { result } = renderHook(() => useWallet());
    await act(async () => {
      await result.current.disconnect();
    });
  });

  it("starts disconnected", () => {
    const { result } = renderHook(() => useWallet());
    expect(result.current.status).toBe("disconnected");
    expect(result.current.address).toBeNull();
    expect(result.current.balance).toBe("0");
  });

  it("connects and generates a Dilithium3 address", async () => {
    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.status).toBe("connected");
    expect(result.current.address).toBeTruthy();
    expect(result.current.address).toMatch(/^rstn1/);
  });

  it("signs a transfer transaction with Dilithium3", async () => {
    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    let signedTx;
    await act(async () => {
      signedTx = await result.current.sign({
        to: "rstn1dest",
        value: "100",
        type: "Transfer",
      });
    });

    expect(signedTx).toBeDefined();
    expect(signedTx.hash).toBeTruthy();
    expect(signedTx.signature).toBeTruthy();
    expect(signedTx.status).toBe("confirmed");
    expect(api.submitTransaction).toHaveBeenCalled();
  });

  it("throws when signing without connection", async () => {
    const { result } = renderHook(() => useWallet());

    // The hook's sign() checks React state (status === "disconnected"),
    // so it throws synchronously before reaching the wallet singleton.
    await expect(
      result.current.sign({
        to: "rstn1dest",
        value: "100",
        type: "Transfer",
      }),
    ).rejects.toThrow("Wallet not connected");
  });

  it("disconnects properly", async () => {
    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.status).toBe("connected");

    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.status).toBe("disconnected");
    expect(result.current.address).toBeNull();
  });

  it("reports isMock=false (using RstnWallet, not MockWallet)", () => {
    const { result } = renderHook(() => useWallet());
    expect(result.current.isMock).toBe(false);
  });
});
