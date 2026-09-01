import { rpcCallWithFallback, RPC_MODE } from "./api";

export interface BridgeReserve {
  chain: string;
  locked: string;
  minted: string;
  burned: string;
  circulating: string;
}

export interface BridgeReservesResponse {
  reserves: BridgeReserve[];
  paused: boolean;
  pending_ops: number;
  completed_ops: number;
}

export interface BridgeOpResult {
  opId: string;
  direction: string;
  status: string;
  chain: string;
  amount: string;
  wrappedSymbol: string;
}

export interface WrappedBalance {
  chain: string;
  symbol: string;
  balance: string;
}

export interface BridgeOpsResponse {
  pending: BridgeOpHistory[];
  completed: BridgeOpHistory[];
}

export interface BridgeOpHistory {
  opId: string;
  direction: string;
  chain: string;
  amount: string;
  signatures: number;
  executed: boolean;
  height: number;
}

const MOCK_RESERVES: BridgeReservesResponse = {
  reserves: [
    {
      chain: "Bitcoin",
      locked: "0",
      minted: "0",
      burned: "0",
      circulating: "0",
    },
    {
      chain: "Ethereum",
      locked: "0",
      minted: "0",
      burned: "0",
      circulating: "0",
    },
    {
      chain: "Solana",
      locked: "0",
      minted: "0",
      burned: "0",
      circulating: "0",
    },
    { chain: "Bsc", locked: "0", minted: "0", burned: "0", circulating: "0" },
    {
      chain: "Avalanche",
      locked: "0",
      minted: "0",
      burned: "0",
      circulating: "0",
    },
  ],
  paused: false,
  pending_ops: 0,
  completed_ops: 0,
};

export async function getBridgeReserves(): Promise<BridgeReservesResponse> {
  if (RPC_MODE) {
    return rpcCallWithFallback(
      "rstn_getBridgeReserves",
      [],
      MOCK_RESERVES,
      "bridge reserves",
    );
  }
  return MOCK_RESERVES;
}

export async function bridgeSubmitLock(params: {
  chain: string;
  sourceTxid: string;
  amount: number;
  userAddress: string;
}): Promise<BridgeOpResult> {
  const mock: BridgeOpResult = {
    opId: "0x",
    direction: "LockMint",
    status: "mock",
    chain: params.chain,
    amount: String(params.amount),
    wrappedSymbol: "wBTC",
  };
  if (RPC_MODE) {
    return rpcCallWithFallback(
      "rstn_bridgeSubmitLock",
      [params],
      mock,
      "bridge lock",
    );
  }
  return mock;
}

export async function bridgeSubmitBurn(params: {
  chain: string;
  amount: number;
  userAddress: string;
}): Promise<BridgeOpResult> {
  const mock: BridgeOpResult = {
    opId: "0x",
    direction: "BurnRelease",
    status: "mock",
    chain: params.chain,
    amount: String(params.amount),
    wrappedSymbol: "wBTC",
  };
  if (RPC_MODE) {
    return rpcCallWithFallback(
      "rstn_bridgeSubmitBurn",
      [params],
      mock,
      "bridge burn",
    );
  }
  return mock;
}

export async function bridgeGetWrappedBalance(params: {
  chain: string;
  userAddress: string;
}): Promise<WrappedBalance> {
  const mock: WrappedBalance = {
    chain: params.chain,
    symbol: "wBTC",
    balance: "0",
  };
  if (RPC_MODE) {
    return rpcCallWithFallback(
      "rstn_bridgeGetWrappedBalance",
      [params],
      mock,
      "bridge wrapped balance",
    );
  }
  return mock;
}

export async function bridgeGetOps(limit = 20): Promise<BridgeOpsResponse> {
  const mock: BridgeOpsResponse = { pending: [], completed: [] };
  if (RPC_MODE) {
    return rpcCallWithFallback(
      "rstn_bridgeGetOps",
      [{ limit }],
      mock,
      "bridge ops",
    );
  }
  return mock;
}
