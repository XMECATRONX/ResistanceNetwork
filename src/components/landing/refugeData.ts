export type ChainId = "btc" | "eth" | "sol" | "ada" | "dot" | "near";

export interface ChainInfo {
  id: ChainId;
  label: string;
  sig: string;
  color: string;
}

export const CHAINS: ChainInfo[] = [
  { id: "btc", label: "BTC", sig: "ECDSA", color: "hsl(150 70% 50%)" },
  { id: "eth", label: "ETH", sig: "ECDSA", color: "hsl(185 100% 55%)" },
  { id: "sol", label: "SOL", sig: "Ed25519", color: "hsl(150 100% 45%)" },
  { id: "ada", label: "ADA", sig: "Ed25519", color: "hsl(0 70% 55%)" },
  { id: "dot", label: "DOT", sig: "Ed25519", color: "hsl(150 100% 45%)" },
  { id: "near", label: "NEAR", sig: "Ed25519", color: "hsl(185 100% 55%)" },
];

export const OTHER_VULNERABLE = [
  "BSC",
  "AVAX",
  "Polygon",
  "Arbitrum",
  "Aptos",
  "Sui",
  "Cosmos",
  "Algorand",
  "Tron",
  "Tezos",
  "Optimism",
  "Base",
];

export const CYCLE_MS = 9000;
export const PHASE_MS = CYCLE_MS / 3; // 3 phases: vulnerable → vault → secure
