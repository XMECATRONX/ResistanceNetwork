// RSTN — Monetary Policy v3 (EIP-1559 con piso + inflación dinámica)
// Extraído de protocol.ts para mantener archivos enfocados.

// ─── Política Monetaria v3 — EIP-1559 con piso + inflación dinámica ──────────────
// Modelo superior a Solana/Ethereum/Cosmos:
// (1) Base fee EIP-1559 con PISO de 1 gwei — el burn nunca muere al escalar
//     (error de Ethereum: base fee sin piso → burn colapsó 96.5% en 2026).
// (2) Tip (priority fee) 100% al validador, stream SEPARADO del burn — el
//     burn nunca compite con el ingreso del validador (error de Solana:
//     50% burn mató a los validadores, revirtieron en SIMD-96 Feb 2025).
// (3) Inflación dinámica con techo de 2%, target 66% staked — no 20% como
//     Cosmos original (que diluyó a los holders).
export const MONETARY_POLICY = {
  maxSupply: "1,000,000,000 RSTN",
  hardCap: "Fijo — jamás se supera. Todos los tokens existen desde génesis.",
  minting:
    "Cero. No se crean tokens nuevos. La reserva se distribuye, no se emite.",
  feeModel: {
    name: "EIP-1559 con piso de 1 gwei",
    baseFee: {
      rate: "Base fee ajustada por bloque (EIP-1559)",
      floor: "1 gwei — piso mínimo, el burn nunca llega a cero",
      destination: "100% quemado — destruido permanentemente",
      description:
        "El base fee se ajusta según el llenado del bloque (12.5% por bloque). Cuando el bloque está lleno, sube; cuando está vacío, baja — pero nunca por debajo de 1 gwei. Esto corrige el error de Ethereum: sin piso, el burn murió al escalar (revenue colapsó 96.5% en enero 2026). Con piso, el burn siempre vive.",
    },
    priorityFee: {
      rate: "Tip (priority fee) — pagado por demanda",
      destination: "100% al validador del bloque",
      description:
        "El tip va 100% al validador, en un stream SEPARADO del burn. Esto corrige el error de Solana: su 50% burn competía directamente con el ingreso del validador → los validadores murieron de hambre → revirtieron en SIMD-96 (feb 2025). En RSTN el burn toma el base fee, el tip va al validador — ni uno reduce al otro.",
    },
    split: {
      burn: "Base fee × gas_limit → 100% quemado",
      validator: "Tip × gas_limit → 100% al validador",
      noCompetition:
        "El burn y el tip son streams independientes. El burn no reduce el ingreso del validador, y el tip no reduce el burn. Cada uno cumple su función: el burn crea escasez, el tip incentiva la inclusión.",
    },
    comparison: [
      {
        network: "Ethereum",
        theirMistake: "Base fee sin piso → burn murió al escalar",
        rstnFix: "Piso de 1 gwei → el burn nunca llega a cero",
      },
      {
        network: "Solana",
        theirMistake: "50% burn competía con el validador → murieron de hambre",
        rstnFix: "Burn y tip en streams separados → no compiten",
      },
      {
        network: "Cosmos",
        theirMistake: "Inflación hasta 20% → dilución masiva",
        rstnFix: "Inflación dinámica con techo de 2%, target 66% staked",
      },
    ],
  },
  dynamicInflation: {
    target: "66% staked (como Cosmos, pero con techo bajo)",
    cap: "2% — máximo ajuste sobre el schedule base",
    mechanism:
      "La distribución de reserva sigue el halving geométrico (schedule base). Un multiplicador dinámico ajusta: si staking < 66%, distribuye hasta +2% más (incentiva staking, refuerza seguridad); si ≥ 66%, distribuye el schedule base sin bonus. El techo es 2% — nunca el 20% que dolió a Cosmos.",
    schedule: [
      { epoch: "Años 1-4", amount: "475M RSTN", percentage: 50 },
      { epoch: "Años 5-8", amount: "237.5M RSTN", percentage: 25 },
      { epoch: "Años 9-12", amount: "118.75M RSTN", percentage: 12.5 },
      { epoch: "Años 13-16", amount: "59.37M RSTN", percentage: 6.25 },
      { epoch: "Años 17-20", amount: "29.68M RSTN", percentage: 3.12 },
      { epoch: "Años 21-24", amount: "14.84M RSTN", percentage: 1.56 },
      {
        epoch: "Año 24+",
        amount: "Converge a 0 — 100% distribuido",
        percentage: 0,
      },
    ],
  },
  reserveDistribution: {
    total: "950,000,000 RSTN (95% del supply)",
    model: "Halving geométrico cada 4 años + inflación dinámica (techo 2%)",
    schedule: [
      { epoch: "Años 1-4", amount: "475M RSTN", percentage: 50 },
      { epoch: "Años 5-8", amount: "237.5M RSTN", percentage: 25 },
      { epoch: "Años 9-12", amount: "118.75M RSTN", percentage: 12.5 },
      { epoch: "Años 13-16", amount: "59.37M RSTN", percentage: 6.25 },
      { epoch: "Años 17-20", amount: "29.68M RSTN", percentage: 3.12 },
      { epoch: "Años 21-24", amount: "14.84M RSTN", percentage: 1.56 },
      {
        epoch: "Año 24+",
        amount: "Converge a 0 — 100% distribuido",
        percentage: 0,
      },
    ],
    principle:
      "La reserva (95% del supply) se distribuye a stakers por participación en consenso. No es minting — son tokens pre-existentes asignados desde génesis. El equipo gana desde esta reserva operando el validador génesis (modelo Satoshi), sin bucket reservado. La distribución sigue el halving geométrico ajustado por inflación dinámica (techo 2%, target 66% staked).",
  },
  burnMechanism: {
    rate: "Base fee × gas_limit de cada transacción (con piso de 1 gwei)",
    floor:
      "1 gwei — el base fee nunca baja de este piso. El burn siempre vive.",
    permanent:
      "Destruido permanentemente — el base fee se envía a null address verificable on-chain.",
    scarcityMechanism:
      "Cuando burn > distribución de reserva → supply circulante decrece — mecanismo de escasez técnica. No garantiza apreciación del precio.",
    superiorTo: [
      {
        network: "Ethereum",
        difference:
          "Ethereum no tiene piso → el base fee decae a cero al escalar → el burn muere. RSTN tiene piso de 1 gwei → el burn sobrevive al escalamiento.",
      },
    ],
    trigger:
      "Ocurre naturalmente cuando la red tiene uso real. El piso garantiza que incluso con bajo volumen, cada tx quema el base fee (mínimo 1 gwei × gas_limit).",
  },
  validatorRevenue: {
    sources: "Dos fuentes: tip (priority fee) + distribución de reserva",
    streams:
      "Tip: 100% del priority fee va al validador. Reserva: distribución con halving + inflación dinámica.",
    sustainability:
      "Cuando la reserva se agota (~24 años, 6 halvings), los tips sostienen a los validadores solos. La red se vuelve deflacionaria: el burn del base fee supera la distribución restante → supply decrece, no crece.",
    noCompetition:
      "El burn (base fee) y el ingreso del validador (tip + reserva) son streams SEPARADOS. El burn no reduce lo que gana el validador. Esto corrige el error de Solana donde el 50% burn competía con el validador.",
    mevElimination:
      "El MEV está estructuralmente eliminado por el threshold-encrypted mempool (G13): el proponente no puede leer el payload antes de finalizar el bloque → reordenar para extraer MEV es imposible sin colusión 2/3+. Por lo tanto el MEV NO es una fuente de ingreso — es un problema que el protocolo resuelve, no una rentabilidad.",
    governance:
      "La gobernanza on-chain puede ajustar el piso del base fee (con delay de 30 días y >67% de identidades verificadas), pero el piso nunca puede ser cero.",
  },
  comparison: {
    rstn: "Hard cap 1B. Cero minting. EIP-1559 con piso de 1 gwei. Inflación dinámica con techo 2%. Burn y tip en streams separados. Validadores con doble ingreso (tip + reserva). MEV estructuralmente eliminado por threshold mempool.",
    principle:
      "La economía de RSTN corrige los 3 errores graves de las blockchains más grandes: el burn muere al escalar (Ethereum), el burn mata al validador (Solana), la inflación diluye sin control (Cosmos). Cada error tiene su corrección en el diseño v3.",
  },
} as const;

// ─── EN variant ──────────────────────────────────────────────────────────────
export const MONETARY_POLICY_EN = {
  maxSupply: "1,000,000,000 RSTN",
  hardCap: "Fixed — never exceeded. All tokens exist from genesis.",
  minting:
    "Zero. No new tokens are created. The reserve is distributed, not minted.",
  feeModel: {
    name: "EIP-1559 with 1 gwei floor",
    baseFee: {
      rate: "Base fee adjusted per block (EIP-1559)",
      floor: "1 gwei — minimum floor, the burn never reaches zero",
      destination: "100% burned — permanently destroyed",
      description:
        "The base fee adjusts based on block fullness (12.5% per block). When the block is full, it rises; when empty, it falls — but never below 1 gwei. This fixes Ethereum's mistake: without a floor, the burn died at scale (revenue collapsed 96.5% in January 2026). With a floor, the burn always lives.",
    },
    priorityFee: {
      rate: "Tip (priority fee) — paid by demand",
      destination: "100% to the block validator",
      description:
        "The tip goes 100% to the validator, in a SEPARATE stream from the burn. This fixes Solana's mistake: their 50% burn competed directly with validator income → validators starved → reverted in SIMD-96 (Feb 2025). In RSTN the burn takes the base fee, the tip goes to the validator — neither reduces the other.",
    },
    split: {
      burn: "Base fee × gas_limit → 100% burned",
      validator: "Tip × gas_limit → 100% to validator",
      noCompetition:
        "The burn and tip are independent streams. The burn does not reduce validator income, and the tip does not reduce the burn. Each serves its purpose: the burn creates scarcity, the tip incentivizes inclusion.",
    },
    comparison: [
      {
        network: "Ethereum",
        theirMistake: "Base fee without floor → burn died at scale",
        rstnFix: "1 gwei floor → the burn never reaches zero",
      },
      {
        network: "Solana",
        theirMistake: "50% burn competed with validator → starved",
        rstnFix: "Burn and tip in separate streams → no competition",
      },
      {
        network: "Cosmos",
        theirMistake: "Inflation up to 20% → massive dilution",
        rstnFix: "Dynamic inflation with 2% cap, 66% staking target",
      },
    ],
  },
  dynamicInflation: {
    target: "66% staked (like Cosmos, but with a low cap)",
    cap: "2% — maximum adjustment above the base schedule",
    mechanism:
      "The reserve distribution follows the geometric halving (base schedule). A dynamic multiplier adjusts: if staking < 66%, distribute up to +2% more (incentivizes staking, boosts security); if ≥ 66%, distribute the base schedule without bonus. The cap is 2% — never the 20% that hurt Cosmos.",
    schedule: [
      { epoch: "Years 1-4", amount: "475M RSTN", percentage: 50 },
      { epoch: "Years 5-8", amount: "237.5M RSTN", percentage: 25 },
      { epoch: "Years 9-12", amount: "118.75M RSTN", percentage: 12.5 },
      { epoch: "Years 13-16", amount: "59.37M RSTN", percentage: 6.25 },
      { epoch: "Years 17-20", amount: "29.68M RSTN", percentage: 3.12 },
      { epoch: "Years 21-24", amount: "14.84M RSTN", percentage: 1.56 },
      {
        epoch: "Year 24+",
        amount: "Converges to 0 — 100% distributed",
        percentage: 0,
      },
    ],
  },
  reserveDistribution: {
    total: "950,000,000 RSTN (95% of supply)",
    model: "Geometric halving every 4 years + dynamic inflation (2% cap)",
    schedule: [
      { epoch: "Years 1-4", amount: "475M RSTN", percentage: 50 },
      { epoch: "Years 5-8", amount: "237.5M RSTN", percentage: 25 },
      { epoch: "Years 9-12", amount: "118.75M RSTN", percentage: 12.5 },
      { epoch: "Years 13-16", amount: "59.37M RSTN", percentage: 6.25 },
      { epoch: "Years 17-20", amount: "29.68M RSTN", percentage: 3.12 },
      { epoch: "Years 21-24", amount: "14.84M RSTN", percentage: 1.56 },
      {
        epoch: "Year 24+",
        amount: "Converges to 0 — 100% distributed",
        percentage: 0,
      },
    ],
    principle:
      "The reserve (95% of supply) is distributed to stakers for consensus participation. It is not minting — it is pre-existing tokens allocated from genesis. The team earns from this reserve by operating the genesis validator (Satoshi model), with no reserved bucket. Distribution follows the geometric halving adjusted by dynamic inflation (2% cap, 66% staking target).",
  },
  burnMechanism: {
    rate: "Base fee × gas_limit per transaction (with 1 gwei floor)",
    floor:
      "1 gwei — the base fee never drops below this floor. The burn always lives.",
    permanent:
      "Permanently destroyed — the base fee is sent to a null address verifiable on-chain.",
    scarcityMechanism:
      "When burn > reserve distribution → circulating supply decreases — a technical scarcity mechanism. Does not guarantee price appreciation.",
    superiorTo: [
      {
        network: "Ethereum",
        difference:
          "Ethereum has no floor → the base fee decays to zero at scale → the burn dies. RSTN has a 1 gwei floor → the burn survives scaling.",
      },
    ],
    trigger:
      "Occurs naturally when the network has real usage. The floor guarantees that even with low volume, each tx burns the base fee (minimum 1 gwei × gas_limit).",
  },
  validatorRevenue: {
    sources: "Two sources: tip (priority fee) + reserve distribution",
    streams:
      "Tip: 100% of the priority fee goes to the validator. Reserve: distribution with halving + dynamic inflation.",
    sustainability:
      "When the reserve is depleted (~24 years, 6 halvings), tips sustain validators alone. The network becomes deflationary: the base fee burn exceeds the remaining distribution → supply decreases, it does not grow.",
    noCompetition:
      "The burn (base fee) and validator income (tip + reserve) are SEPARATE streams. The burn does not reduce what the validator earns. This fixes Solana's mistake where the 50% burn competed with the validator.",
    mevElimination:
      "MEV is structurally eliminated by the threshold-encrypted mempool (G13): the proposer cannot read the payload before the block is finalized → reordering for MEV extraction is impossible without 2/3+ collusion. Therefore MEV is NOT a revenue source — it is a problem the protocol solves, not a yield.",
    governance:
      "On-chain governance can adjust the base fee floor (with a 30-day delay and >67% of verified identities), but the floor can never be zero.",
  },
  comparison: {
    rstn: "Hard cap 1B. Zero minting. EIP-1559 with 1 gwei floor. Dynamic inflation with 2% cap. Burn and tip in separate streams. Validators with dual income (tip + reserve). MEV structurally eliminated by threshold mempool.",
    principle:
      "RSTN's economy fixes the 3 grave errors of the largest blockchains: the burn dies at scale (Ethereum), the burn starves the validator (Solana), inflation dilutes without control (Cosmos). Each error has its correction in the v3 design.",
  },
} as const;
