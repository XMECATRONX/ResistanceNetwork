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
    item: "Oracle payment / staking",
    status: "parcial",
    evidence:
      "oracle.rs — median+TWAP+circuit breaker, but no payment to sources (future)",
  },
  {
    item: "State rent (storage pricing)",
    status: "no-implementado",
    evidence: "no per-state pricing (future research, prevents state bloat)",
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
