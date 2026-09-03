// RSTN — Economic audit (verified against Rust code)
// Each item reflects the REAL state of the fee/reward/slashing code.
// States mirror protocolClaims.ts: implementado | parcial | no-implementado
import type { ClaimStatus } from "./protocolClaims";

export interface EconomicAuditItem {
  item: string;
  status: ClaimStatus;
  evidence: string;
}

export const ECONOMIC_AUDIT: EconomicAuditItem[] = [
  {
    item: "EIP-1559 fee market (base fee burned + tip to validator)",
    status: "implementado",
    evidence: "fee_market.rs — split_fee, update_after_block, 1 gwei floor",
  },
  {
    item: "Gas refund on unused gas (charge gas_used, not gas_limit)",
    status: "implementado",
    evidence:
      "runner.rs — apply_block_transactions accumulates block_total_tip; post-execution settlement refunds (gas_limit-gas_used)*gas_price to sender; tx.gas_used set by VM after contract execution",
  },
  {
    item: "Slashing destination → protocol treasury (not vanished)",
    status: "implementado",
    evidence:
      "lib.rs — slash_validator credits self.treasury; spend_treasury releases via executed critical governance proposal (48h timelock)",
  },
  {
    item: "Validator commission applied to ALL rewards (tips + block reward)",
    status: "implementado",
    evidence:
      "runner.rs — apply_block_transactions returns block_total_tip; runner passes (tip + block_reward) to distribute_rewards which applies commission% to leader, rest owed to delegators via pending_rewards; consensus.rs no longer double-counts",
  },
  {
    item: "Dynamic inflation targeting 66% staked, capped at 2%",
    status: "implementado",
    evidence: "fee_market.rs — DynamicInflation::rate_multiplier",
  },
  {
    item: "Reserve distribution (Satoshi model, NOT minting) — block reward debited from 950M pre-funded reserve, geometric halving every 4 years, hard cap 1B enforced",
    status: "implementado",
    evidence:
      "reserve.rs — ReserveDistribution: 950M pre-funded, distribute_block_reward debits remaining + enforces cap, halving_rate_divisor (2^epoch), burned_total burn ledger; runner.rs — compute_block_reward_from_reserve replaces old hardcoded 0.1 RSTN minting in all 4 reward sites (dev catch-up, dev propose, multi-node propose, multi-node finalize)",
  },
  {
    item: "Stake dominance cap (20%, redistributes excess)",
    status: "implementado",
    evidence: "fee_market.rs — capped_stake, MAX_STAKE_DOMINANCE_BPS",
  },
  {
    item: "DEX swap fee (0.30%, 100% to LPs)",
    status: "implementado",
    evidence: "RstnDexPool.sol:34 — immutable 30 bps fee",
  },
  {
    item: "Bridge protocol fee",
    status: "no-implementado",
    evidence:
      "bridge/lib.rs — no fee extracted (intentional: refugio cuántico = free bridge)",
  },
  {
    item: "Oracle payment / staking (sources paid from treasury)",
    status: "implementado",
    evidence:
      "oracle.rs — ORACLE_PAYMENT_PER_SUBMISSION accrued per valid submission; claim_payment releases from treasury (community-governed, not operator); total_payment_owed for budgeting",
  },
  {
    item: "State rent (storage pricing, anti state-bloat)",
    status: "implementado",
    evidence:
      "state_rent.rs — StateRentManager: SLOT_RENT_PER_BLOCK per slot, collect_rent per block, charge_rent_from_balance freezes accounts with insufficient balance, burned (deflationary); runner.rs — sync_g15_state calls collect_rent per finalized block; rstn_getStateRent RPC",
  },
  {
    item: "Genesis validator gradual exit (anti-centralization)",
    status: "implementado",
    evidence:
      "genesis_exit.rs — genesis_effective_stake: linear reduction from 100% to 10% floor over 10,000 epochs; runner.rs — compute_staking_ratio_bps applies genesis_effective_stake to validator 0 so its inflation influence shrinks automatically",
  },
  {
    item: "Bridge escape hatch (unilateral user exit, 24h delay)",
    status: "implementado",
    evidence:
      "bridge/lib.rs — submit_escape_hatch escrows wrapped tokens; claim_escape releases proportional share after ESCAPE_DELAY_BLOCKS; validators CANNOT prevent",
  },
  {
    item: "Multisig 3/5 independent (non-team) signers",
    status: "implementado",
    evidence:
      "multisig.rs — MultisigConfig::three_of_five rejects team signers (TeamSignerRejected), enforces independent set, unique signers",
  },
  {
    item: "Critical timelock on governance (48h)",
    status: "implementado",
    evidence:
      "lib.rs — CRITICAL_TIMELOCK_BLOCKS = 432,000 (~48h at 400ms/block)",
  },
  {
    item: "IBC relayer market (permissionless, bond slashing)",
    status: "implementado",
    evidence:
      "relayer_market.rs — Relayer registration with bond, fee bidding, bond slashing on invalid delivery; rstn_getRelayerMarket RPC",
  },
];

export const ECONOMIC_AUDIT_SUMMARY = {
  total: ECONOMIC_AUDIT.length,
  implementado: ECONOMIC_AUDIT.filter((i) => i.status === "implementado")
    .length,
  parcial: ECONOMIC_AUDIT.filter((i) => i.status === "parcial").length,
  noImplementado: ECONOMIC_AUDIT.filter((i) => i.status === "no-implementado")
    .length,
};
