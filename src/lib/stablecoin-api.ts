/**
 * rUSD Stablecoin API — over-collateralized stablecoin (DAI model).
 *
 * Live RPC: `rstn_getStablecoinState` returns the vault config, the
 * consensus-aggregated median price, TWAP, last price written on-chain,
 * total supply/collateral, and staleness. Falls back to defaults when
 * the node is unreachable.
 */

import { rpcCallWithFallback, RPC_MODE } from "@/lib/api";

export interface StablecoinState {
  minCollateralRatioBps: number;
  liquidationRatioBps: number;
  liquidationPenaltyBps: number;
  stabilityFeePerSec: string;
  maxStaleBlocks: number;
  medianPrice: string;
  twap: string;
  trustedSources: number;
  totalSources: number;
  lastWrittenPrice: string;
  lastWriteHeight: number;
  currentHeight: number;
  priceStale: boolean;
  totalSupply: string;
  totalCollateral: string;
  deployed: boolean;
}

const FALLBACK: StablecoinState = {
  minCollateralRatioBps: 15000,
  liquidationRatioBps: 15000,
  liquidationPenaltyBps: 1300,
  stabilityFeePerSec: "634195839",
  maxStaleBlocks: 50,
  medianPrice: "0",
  twap: "0",
  trustedSources: 0,
  totalSources: 0,
  lastWrittenPrice: "0",
  lastWriteHeight: 0,
  currentHeight: 0,
  priceStale: true,
  totalSupply: "0",
  totalCollateral: "0",
  deployed: false,
};

export async function getStablecoinState(): Promise<StablecoinState> {
  if (RPC_MODE) {
    return rpcCallWithFallback<StablecoinState>(
      "rstn_getStablecoinState",
      [],
      FALLBACK,
      "stablecoin state",
    );
  }
  return { ...FALLBACK };
}
