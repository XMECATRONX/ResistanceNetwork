// RSTN — Liquidity Provision = Participation
// LP rewards live INSIDE the 95% Proof of Participation bucket — not a new
// bucket. This keeps the Satoshi model intact (2 clean buckets, not 3) with no
// hidden inflation.
//
// CRITICAL INVARIANT (immutable — not a free governance parameter):
//   APR_validator >= 2 × APR_lp
// Without it, LP and validator pay the same, everyone prefers LP (no slashing,
// no VPS), no one runs nodes, the network dies. The validator always earns more
// per RSTN because it assumes slashing + uptime + hardware.

export const LIQUIDITY_PARTICIPATION = {
  // ── UI labels (es locale) ──
  ui: {
    title: "Liquidity Provision = Participación",
    desc: "Los LP rewards salen del 95% Proof of Participation — no de un bucket nuevo. Sin tercer bucket, sin inflación oculta. El modelo Satoshi se mantiene intacto.",
    principle:
      "Proveer liquidez = trabajo. Quien aporta bloques o liquidez gana tokens.",
    noBucket:
      "No se crea un bucket de liquidity mining aparte. Dos buckets limpios (95/5), no tres.",
    layer1Label: "Capa 1 — Distribución total (1B RSTN)",
    layer2Label: "Capa 2 — Dentro del 95%",
    layer2Sub: "Split de emisión por época",
    splitTitle: "Split de Emisión por Época",
    validators: "Validadores + Delegadores",
    lps: "LPs del DEX",
    splitBody:
      "80/20 vive DENTRO del 95%, no al lado. De cada época de emisión de la reserva (95%): 80% a validadores + delegadores (mayor APR, asume slashing + uptime + hardware), 20% a LPs del DEX (menor APR, pasivo). El split es ajustable por gobernanza on-chain.",
    invariantTitle: "Invariant Inmutable — Protección de Red",
    invariantRule: "APR_validador ≥ 2× APR_lp",
    invariantBody:
      "Sin este invariant, LP y validador pagarían lo mismo y todos preferirían LP (sin slashing, sin VPS). La red moriría sin nodos. El invariant garantiza que quien asume más riesgo siempre gana más. No se puede romper por votación.",
    selfBalanceTitle: "Auto-Equilibrio",
    selfBalanceBody:
      "Si todos van a LP, quedan pocos validadores. Mismo total de recompensas ÷ menos validadores = cada validador gana mucho más. Ese yield creciente atrae validadores de vuelta. El péndulo se auto-corrige, como la dificultad de minería en Bitcoin.",
    liveness:
      "Los LP necesitan que la red viva: sin validadores no hay bloques, el DEX no procesa swaps, los tokens LP valen $0. Un LP racional prefiere 6% en una red viva a 12% en una red muerta.",
    poolsTitle: "Pools del DEX",
    pair: "Pair",
    role: "Rol",
    apr: "APR",
    risk: "Riesgo",
    fairLaunchTitle: "Fair Launch Real",
    fairLaunchBody:
      "El equipo NO siembra el pool inicial. Cualquiera puede ser el primer LP y ganar recompensas. Quien aporta trabajo (bloques o liquidez) gana tokens — sin captura, sin reserva, sin inflación oculta.",
  },
  // ── Data ──
  principle:
    "Proveer liquidez = participación. Los LP rewards salen del 95% Proof of Participation, no de un bucket nuevo. Sin tercer bucket, sin inflación oculta — el modelo Satoshi se mantiene intacto.",
  noNewBucket:
    "No se crea un bucket de liquidity mining aparte. Los LP compiten por la misma emisión de reserva que los validadores. Dos buckets limpios (95/5), no tres.",
  split: {
    validators: 80,
    liquidityProviders: 20,
    description:
      "De cada época de emisión de la reserva (95%): 80% a validadores + delegadores (mayor APR, asume slashing + uptime + hardware), 20% a LPs del DEX (menor APR, pasivo).",
    governance:
      "El split 80/20 es ajustable por gobernanza on-chain, PERO el invariant APR_validador ≥ 2× APR_lp es inmutable — no se puede romper por votación.",
  },
  invariant: {
    rule: "APR_validador ≥ 2× APR_lp",
    protection:
      "Sin este invariant, LP y validador pagarían lo mismo y todos preferirían LP (sin slashing, sin VPS). La red moriría sin nodos. El invariant garantiza que quien asume más riesgo siempre gana más.",
    immutable: true,
  },
  selfBalancing: {
    mechanism:
      "Si todos van a LP, quedan pocos validadores. Mismo total de recompensas ÷ menos validadores = cada validador gana mucho más. Ese yield creciente atrae validadores de vuelta. El péndulo se auto-corrige, como la dificultad de minería en Bitcoin.",
    livenessDependency:
      "Los LP necesitan que la red viva: sin validadores, no hay bloques, el DEX no procesa swaps, los tokens LP valen $0. Un LP racional prefiere 6% en una red viva a 12% en una muerta.",
  },
  whyValidatorEarnsMore:
    "El validador asume slashing + uptime >90% + hardware (VPS $20-50/mes). El LP es pasivo (solo aporta capital). Por eso el validador gana más RSTN por RSTN — compensación por riesgo, no privilegio.",
  pools: [
    {
      pair: "wRSTN / USDC",
      role: "Price discovery — el precio de RSTN nace del primer swap",
      apr: "~6-8% (variable, depende del volumen y TVL)",
      risk: "Impermanent loss + sin slashing",
    },
    {
      pair: "wRSTN / wBTC",
      role: "Liquidez cross-chain para el Quantum Migration Program",
      apr: "~6-8% (variable)",
      risk: "Impermanent loss + sin slashing",
    },
  ],
  fairLaunch:
    "El equipo NO siembra el pool inicial. Cualquiera puede ser el primer LP y ganar recompensas. Eso es fair launch real — quien aporta trabajo (bloques o liquidez) gana tokens.",
} as const;

export const LIQUIDITY_PARTICIPATION_EN = {
  // ── UI labels (en) ──
  ui: {
    title: "Liquidity Provision = Participation",
    desc: "LP rewards come from the 95% Proof of Participation bucket — not a new bucket. No third bucket, no hidden inflation. The Satoshi model stays intact.",
    principle:
      "Providing liquidity = work. Whoever contributes blocks or liquidity earns tokens.",
    noBucket:
      "No separate liquidity-mining bucket is created. Two clean buckets (95/5), not three.",
    layer1Label: "Layer 1 — Total distribution (1B RSTN)",
    layer2Label: "Layer 2 — Inside the 95%",
    layer2Sub: "Per-epoch emission split",
    splitTitle: "Per-Epoch Emission Split",
    validators: "Validators + Delegators",
    lps: "DEX LPs",
    splitBody:
      "80/20 lives INSIDE the 95%, not beside it. Of each reserve emission epoch (95%): 80% to validators + delegators (higher APR, assumes slashing + uptime + hardware), 20% to DEX LPs (lower APR, passive). The split is adjustable by on-chain governance.",
    invariantTitle: "Immutable Invariant — Network Protection",
    invariantRule: "APR_validator ≥ 2× APR_lp",
    invariantBody:
      "Without this invariant, LP and validator would pay the same and everyone would prefer LP (no slashing, no VPS). The network would die without nodes. The invariant guarantees whoever assumes more risk always earns more. It cannot be broken by vote.",
    selfBalanceTitle: "Self-Balancing",
    selfBalanceBody:
      "If everyone goes to LP, few validators remain. Same total rewards ÷ fewer validators = each validator earns much more. That rising yield attracts validators back. The pendulum self-corrects, like Bitcoin's mining difficulty.",
    liveness:
      "LPs need the network alive: without validators there are no blocks, the DEX processes no swaps, LP tokens are worth $0. A rational LP prefers 6% on a live network over 12% on a dead one.",
    poolsTitle: "DEX Pools",
    pair: "Pair",
    role: "Role",
    apr: "APR",
    risk: "Risk",
    fairLaunchTitle: "True Fair Launch",
    fairLaunchBody:
      "The team does NOT seed the initial pool. Anyone can be the first LP and earn rewards. Whoever contributes work (blocks or liquidity) earns tokens — no capture, no reserve, no hidden inflation.",
  },
  // ── Data ──
  principle:
    "Providing liquidity = participation. LP rewards come from the 95% Proof of Participation bucket — not a new bucket. No third bucket, no hidden inflation — the Satoshi model stays intact.",
  noNewBucket:
    "No separate liquidity-mining bucket is created. LPs compete for the same reserve emission as validators. Two clean buckets (95/5), not three.",
  split: {
    validators: 80,
    liquidityProviders: 20,
    description:
      "Of each reserve emission epoch (95%): 80% to validators + delegators (higher APR, assumes slashing + uptime + hardware), 20% to DEX LPs (lower APR, passive).",
    governance:
      "The 80/20 split is adjustable by on-chain governance, BUT the invariant APR_validator ≥ 2× APR_lp is immutable — it cannot be broken by vote.",
  },
  invariant: {
    rule: "APR_validator ≥ 2× APR_lp",
    protection:
      "Without this invariant, LP and validator would pay the same and everyone would prefer LP (no slashing, no VPS). The network would die without nodes. The invariant guarantees that whoever assumes more risk always earns more.",
    immutable: true,
  },
  selfBalancing: {
    mechanism:
      "If everyone goes to LP, few validators remain. Same total rewards ÷ fewer validators = each validator earns much more. That rising yield attracts validators back. The pendulum self-corrects, like Bitcoin's mining difficulty.",
    livenessDependency:
      "LPs need the network alive: without validators there are no blocks, the DEX processes no swaps, LP tokens are worth $0. A rational LP prefers 6% on a live network over 12% on a dead one.",
  },
  whyValidatorEarnsMore:
    "The validator assumes slashing + uptime >90% + hardware (VPS $20-50/mo). The LP is passive (only provides capital). That is why the validator earns more RSTN per RSTN — risk compensation, not privilege.",
  pools: [
    {
      pair: "wRSTN / USDC",
      role: "Price discovery — RSTN price is born from the first swap",
      apr: "~6-8% (variable, depends on volume and TVL)",
      risk: "Impermanent loss + no slashing",
    },
    {
      pair: "wRSTN / wBTC",
      role: "Cross-chain liquidity for the Quantum Migration Program",
      apr: "~6-8% (variable)",
      risk: "Impermanent loss + no slashing",
    },
  ],
  fairLaunch:
    "The team does NOT seed the initial pool. Anyone can be the first LP and earn rewards. That is true fair launch — whoever contributes work (blocks or liquidity) earns tokens.",
} as const;

export function getLiquidityParticipation(lang: string) {
  return lang === "es" ? LIQUIDITY_PARTICIPATION : LIQUIDITY_PARTICIPATION_EN;
}
