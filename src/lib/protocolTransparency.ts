// ─── Bilingual variants (EN) for transparency data ──────────────────────────
// Spanish remains the default (in protocol.ts). These EN variants let the
// terminal render the same data in English, matching the i18n landing terminology.
import {
  BRIDGE_ECONOMICS,
  BRIDGE_TRANSPARENCY,
  SUPPLY_HISTORY,
  BUYBACK_EVENTS,
  REVENUE_SOURCES,
} from "./protocol";

export const BRIDGE_ECONOMICS_EN = {
  ...BRIDGE_ECONOMICS,
  model: "Hybrid 60/30/10 — Buyback & Burn + Stakers + Security Reserve",
  principle:
    "Every bridge fee splits into 3 on-chain verifiable destinations. Not a promise — executable code in the bridge contract.",
  feeStructure: {
    ...BRIDGE_ECONOMICS.feeStructure,
    standardRate: "0.15% of transferred value",
    fastPathRate: "+0.05% extra (optional, priority confirmation)",
    quantumMigrationRate: "0% — free (differentiator, drives volume)",
    rationale:
      "0.15% is the industry standard. It doesn't exploit the user. Migration is free to maximize volume — volume feeds the burn.",
  },
  revenueSplit: [
    {
      destination: "RSTN Buyback & Burn",
      percentage: 60,
      color: "hsl(150 100% 45%)",
      detail:
        "Buys RSTN on the DEX (limit order, not market) and burns it by sending to a dead address. On-chain verifiable event. Reduces circulating supply.",
    },
    {
      destination: "Staker Rewards",
      percentage: 30,
      color: "hsl(150 100% 45%)",
      detail:
        "Distributed to stakers proportional to stake. Not inflation — real bridge revenue. Creates a virtuous circle: more usage → more fees → more yield → more staking → more security.",
    },
    {
      destination: "Security Reserve (bug bounty + incidents)",
      percentage: 10,
      color: "hsl(150 70% 50%)",
      detail:
        "Emergency fund to compensate users if a bug occurs. Annual audits. Bug bounty. Wormhole didn't have this — it took months to compensate.",
    },
  ],
  deflationaryPressure: {
    eip1559:
      "Every RSTN transaction burns 50% of base gas (like Ethereum EIP-1559)",
    bridgeBurn: "60% of every bridge fee buys and burns RSTN",
    scarcityMechanism:
      "Two simultaneous technical scarcity sources: gas burn + bridge revenue burn. Supply decreases with real usage.",
    notGuaranteed:
      "Supply reduction depends on real bridge volume. If volume is low, burn is minimal. We don't promise price appreciation — it's a technical scarcity effect.",
  },
  transparency: {
    principle: "Every burn is verifiable on-chain. Zero opacity.",
    dashboard: [
      {
        metric: "Bridge volume (24h)",
        source: "Bridge contract — sum of transfers",
        verifiable: true,
      },
      {
        metric: "Fees collected (24h)",
        source: "Bridge contract — on-chain accumulator",
        verifiable: true,
      },
      {
        metric: "RSTN bought in buyback",
        source: "DEX swap events — verifiable hash",
        verifiable: true,
      },
      {
        metric: "Total RSTN burned",
        source: "Dead address balance — public",
        verifiable: true,
      },
      {
        metric: "Distributed to stakers",
        source: "Staking contract — transfer events",
        verifiable: true,
      },
      {
        metric: "Accumulated Security Reserve",
        source: "Security reserve address — public balance",
        verifiable: true,
      },
    ],
    cadence:
      "Weekly buyback. Each week the contract executes: accumulates fees → buys RSTN on DEX → burns → emits on-chain event. The community can audit every execution.",
    antiFraud:
      "If the team tries to divert fees, the contract prevents it — the 60/30/10 split is hardcoded. Governance can adjust the split, but requires >67% of verified identities and a 30-day delay.",
  },
  legal: {
    notSecurity:
      "RSTN does not guarantee yield. It does not promise the token will appreciate. The burn is a technical scarcity mechanism, not a profit promise. Consult independent legal advice on token classification in your jurisdiction.",
    noGuaranteedYield:
      "Staker yield is VARIABLE and depends on real bridge volume. It is not a guaranteed fixed APY. Staking rewards are compensation for the validation service, not investment profit.",
    howeyTest:
      "RSTN is distributed by work and participation (Proof of Participation), not by money investment. There is no token sale in any form. The final legal classification depends on each jurisdiction and must be assessed by a specialized lawyer.",
  },
} as const;

export const BRIDGE_TRANSPARENCY_EN = {
  ...BRIDGE_TRANSPARENCY,
  title: "Transparency Dashboard — Bridge Economics",
  subtitle: "Every metric is verifiable on-chain. Zero opacity.",
  stats: [
    {
      label: "Bridge volume (24h)",
      value: "$10.2M",
      note: "Simulated — real data on mainnet",
      color: "hsl(150 100% 45%)",
    },
    {
      label: "Fees collected (24h)",
      value: "$15,300",
      note: "0.15% × $10.2M",
      color: "hsl(150 100% 45%)",
    },
    {
      label: "RSTN burned (buyback)",
      value: "234,567",
      note: "60% of fees → buyback → burn",
      color: "hsl(150 100% 55%)",
    },
    {
      label: "Distributed to stakers",
      value: "$4,590",
      note: "30% of fees",
      color: "hsl(150 70% 50%)",
    },
  ],
  weeklyBurns: BRIDGE_TRANSPARENCY.weeklyBurns.map((w, i) => ({
    ...w,
    week: `Week ${47 - i}`,
  })),
  note: "Simulated data for demonstration. On mainnet, every value is read from the bridge contract and the DEX in real time. Any node can verify.",
} as const;

export const SUPPLY_HISTORY_EN = {
  ...SUPPLY_HISTORY,
  burnRate: "~234K RSTN/week (average)",
  epochs: SUPPLY_HISTORY.epochs.map((e) => ({
    ...e,
    epoch:
      e.epoch === "Génesis"
        ? "Genesis"
        : e.epoch === "Actual"
          ? "Current"
          : e.epoch,
  })),
} as const;

export const BUYBACK_EVENTS_EN: {
  id: number;
  week: string;
  feesUsd: number;
  resistPurchased: number;
  resistBurned: number;
  resistPrice: number;
  txHash: string | null;
  status: string;
  timestamp: string;
}[] = BUYBACK_EVENTS.map((evt) => ({
  id: evt.id,
  week: evt.week.replace(/^Semana\s+/, "Week "),
  feesUsd: evt.feesUsd,
  resistPurchased: evt.resistPurchased,
  resistBurned: evt.resistBurned,
  resistPrice: evt.resistPrice,
  txHash: evt.txHash,
  status: evt.status === "ejecutado" ? "executed" : "pending",
  timestamp: evt.timestamp,
}));

export const REVENUE_SOURCES_EN = [
  {
    source: "Bridge fees (asset crossing)",
    monthlyUsd: 450000,
    annualUsd: 5400000,
    share: 72,
    color: "hsl(150 100% 45%)",
  },
  {
    source: "Gas fees (on-chain transactions)",
    monthlyUsd: 95000,
    annualUsd: 1140000,
    share: 15,
    color: "hsl(150 100% 45%)",
  },
  {
    source: "Staking slashing rewards",
    monthlyUsd: 48000,
    annualUsd: 576000,
    share: 8,
    color: "hsl(150 70% 50%)",
  },
  {
    source: "MEV extraction (proposer tips)",
    monthlyUsd: 32000,
    annualUsd: 384000,
    share: 5,
    color: "hsl(150 100% 55%)",
  },
] as const;

export function getBridgeEconomics(lang: string) {
  return lang === "es" ? BRIDGE_ECONOMICS : BRIDGE_ECONOMICS_EN;
}
export function getBridgeTransparency(lang: string) {
  return lang === "es" ? BRIDGE_TRANSPARENCY : BRIDGE_TRANSPARENCY_EN;
}
export function getSupplyHistory(lang: string) {
  return lang === "es" ? SUPPLY_HISTORY : SUPPLY_HISTORY_EN;
}
export function getBuybackEvents(lang: string) {
  return lang === "es" ? BUYBACK_EVENTS : BUYBACK_EVENTS_EN;
}
export function getRevenueSources(lang: string) {
  return lang === "es" ? REVENUE_SOURCES : REVENUE_SOURCES_EN;
}
