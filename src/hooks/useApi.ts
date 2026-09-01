/**
 * RSTN — React Query hooks for API data
 * ──────────────────────────────────────────────────────────
 * Thin wrappers around `api.*` with caching, polling, and error handling.
 * Views use these hooks — they never call `api` directly.
 *
 * When RPC_MODE flips to true, these automatically start hitting the node.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Polling intervals ──────────────────────────────────────
const BLOCK_POLL = 2_000; // 2s — blocks arrive every 200ms but we poll slower
const STATS_POLL = 10_000; // 10s
const VALIDATOR_POLL = 30_000; // 30s
const STAKING_POLL = 60_000; // 60s

// ── Network Stats ──────────────────────────────────────────
export function useNetworkStats() {
  return useQuery({
    queryKey: ["networkStats"],
    queryFn: () => api.getNetworkStats(),
    refetchInterval: STATS_POLL,
    staleTime: STATS_POLL / 2,
  });
}

// ── Explorer Stats ──────────────────────────────────────────
export function useExplorerStats() {
  return useQuery({
    queryKey: ["explorerStats"],
    queryFn: () => api.getExplorerStats(),
    refetchInterval: STATS_POLL,
    staleTime: STATS_POLL / 2,
  });
}

// ── Blocks ──────────────────────────────────────────────────
export function useLatestBlocks(limit = 10) {
  return useQuery({
    queryKey: ["blocks", limit],
    queryFn: () => api.getLatestBlocks(limit),
    refetchInterval: BLOCK_POLL,
    staleTime: BLOCK_POLL / 2,
  });
}

export function useBlockByHeight(height: number | null) {
  return useQuery({
    queryKey: ["block", height],
    queryFn: () => api.getBlockByHeight(height!),
    enabled: height !== null,
  });
}

// ── Transactions ────────────────────────────────────────────
export function useLatestTransactions(limit = 12) {
  return useQuery({
    queryKey: ["transactions", limit],
    queryFn: () => api.getLatestTransactions(limit),
    refetchInterval: BLOCK_POLL,
    staleTime: BLOCK_POLL / 2,
  });
}

export function useTransactionByHash(hash: string | null) {
  return useQuery({
    queryKey: ["tx", hash],
    queryFn: () => api.getTransactionByHash(hash!),
    enabled: !!hash,
  });
}

// ── Validators ──────────────────────────────────────────────
export function useTopValidators(limit = 10) {
  return useQuery({
    queryKey: ["validators", limit],
    queryFn: () => api.getTopValidators(limit),
    refetchInterval: VALIDATOR_POLL,
    staleTime: VALIDATOR_POLL / 2,
  });
}

// ── Wallet ──────────────────────────────────────────────────
export function useWalletPortfolio(address: string | null) {
  return useQuery({
    queryKey: ["wallet", address],
    queryFn: () => api.getWalletPortfolio(address!),
    enabled: !!address,
    refetchInterval: STATS_POLL,
  });
}

// ── Staking ─────────────────────────────────────────────────
export function useStakingValidators() {
  return useQuery({
    queryKey: ["stakingValidators"],
    queryFn: () => api.getStakingValidators(),
    refetchInterval: STAKING_POLL,
  });
}

// ── Governance ──────────────────────────────────────────────
export function useGovernanceProposals() {
  return useQuery({
    queryKey: ["governanceProposals"],
    queryFn: () => api.getGovernanceProposals(),
    refetchInterval: STAKING_POLL,
  });
}
