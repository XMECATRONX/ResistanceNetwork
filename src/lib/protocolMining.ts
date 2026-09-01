// ─── Mining & Participation Model ────────────────────────────────────────
// Extracted from protocol.ts to keep that file focused.
//
// HONEST NARRATIVE (per engineering team verdict):
// RSTN consensus is Proof-of-Stake (PoS) with post-quantum Dilithium3 signatures.
// "Proof of Participation" (PoP) is NOT the consensus mechanism — it is the
// DISTRIBUTION mechanism (how RSTN enters circulation: earned by work, not
// sold). Conflating the two is technically inaccurate and the crypto community
// would discredit it. PoS = security; PoP = distribution.
//
// In PoS there is no way to "mine from zero" like in PoW: the stake is internal
// to the system. We accept this honestly rather than pretending it's PoW. The
// real participation barrier is 1 RSTN (delegation), not 32,000 — the validator
// stake is accumulated over time, not a prerequisite you must buy.

export const PARTICIPATION_TIERS = [
  {
    tier: "Validador",
    role: "Produce bloques y finaliza transacciones",
    stake: "32,000 RSTN",
    hardware: "4 cores · 8GB RAM · 100GB SSD",
    rewards: "Recompensas de bloque + fees",
    slashing: "Sí — proporcional, no destructivo",
    icon: "Server",
    color: "hsl(150 100% 45%)",
  },
  {
    tier: "Delegador",
    role: "Delega stake a un validador sin correr hardware",
    stake: "1 RSTN mínimo",
    hardware: "Ninguno — solo una wallet",
    rewards: "Proporcional al stake delegado",
    slashing: "Solo si el validador delegado es slashed",
    icon: "Users",
    color: "hsl(185 100% 55%)",
  },
  {
    tier: "Light Node",
    role: "Verifica cabeceras de bloques desde el móvil",
    stake: "0 RSTN",
    hardware: "Cualquier smartphone",
    rewards: "Sin recompensas directas — seguridad de la red",
    slashing: "No aplica",
    icon: "Smartphone",
    color: "hsl(150 100% 45%)",
  },
] as const;

export const MINING_MODEL = {
  consensusType: "Proof of Stake Post-Cuántico (RSTN-PoS)",
  consensusHonest:
    "RSTN es PoS. No hay forma de 'minar desde cero' en PoS como en PoW: el stake es interno al sistema. Proof of Participation es el mecanismo de DISTRIBUCIÓN (cómo los RSTN entran en circulación — se ganan por trabajo, no se venden), NO el mecanismo de consenso.",
  miningType:
    "No hay minado PoW. La participación reemplaza el trabajo computacional.",
  energyPerTx: "0.0001 kWh/tx",
  comparison: "15,000× más eficiente que PoW tradicional",
  rewardType:
    "Compensación variable por servicio de validación — NO es ganancia de inversión. NO garantizado.",
  slashingModel:
    "Proporcional — se pierde solo la fracción correspondiente, no todo el stake",
  validatorRotation:
    "Selección por Lattice-based VRF (Module-LWE). Rotación cada ronda.",
  delegation:
    "Delegación líquida desde 1 RSTN. Sin lock-up obligatorio. Retiro en 1 época.",
} as const;

// Los 3 caminos para obtener RSTN post-génesis — honesto, sin prometer "no
// comprar" como si fuera PoW. En PoS el capital entra tarde o temprano; ser
// honestos al respecto es más fuerte que negarlo. La barrera REAL de
// participación es 1 RSTN (delegación), no 32,000. El stake de validador se
// acumula con el tiempo, no se compra por adelantado.
export const POST_GENESIS_PATHS = [
  {
    path: "Delegar desde 1 RSTN",
    barrier: "1 RSTN — barrera real de participación",
    detail:
      "Participa desde el día 1 sin correr hardware. Delegas a un validador y recibes recompensas proporcionales. Es la forma en que el 99% de los usuarios participa. No necesitas 32,000 RSTN para empezar.",
    icon: "Users",
    color: "hsl(185 100% 55%)",
  },
  {
    path: "Acumular recompensas hasta 32,000",
    barrier: "Tiempo, no capital previo",
    detail:
      "Delegas, acumulas recompensas de staking, y cuando llegas a 32,000 RSTN puedes convertirte en validador solo. El stake de validador se GANA con el tiempo — no es un requisito previo que debas comprar.",
    icon: "Server",
    color: "hsl(150 100% 45%)",
  },
  {
    path: "Comprar en DEX cuando haya liquidez",
    barrier: "Mercado abierto — legítimo y transparente",
    detail:
      "Post-mainnet, RSTN cotiza en el DEX nativo (wRSTN/USDC). Comprar es legítimo — no lo ocultamos. El fair launch significa que NADIE tuvo precio preferente pre-venta: todos compran al mismo precio de mercado. La diferencia vs. una ICO es la ausencia de asignación privilegiada, no la ausencia de mercado.",
    icon: "Rocket",
    color: "hsl(150 100% 45%)",
  },
] as const;

export const PARTICIPATION_STEPS = [
  {
    step: 1,
    title: "Instalar rstn-node",
    description: "Un comando Docker. Sin GPU, sin ASIC, sin minería.",
    command: "docker run rstn/node:latest --mainnet",
  },
  {
    step: 2,
    title: "Stakear RSTN",
    description: "32,000 RSTN para validador, o delega desde 1 RSTN.",
    command: "rstn stake --amount 32000",
  },
  {
    step: 3,
    title: "Producir bloques",
    description: "El VRF te selecciona como líder. Firmas con Dilithium3.",
    command: "resistance validator status",
  },
  {
    step: 4,
    title: "Recibir recompensas",
    description:
      "Recompensas variables acreditadas automáticamente por bloque.",
    command: "rstn rewards --claim",
  },
] as const;

export const ENERGY_COMPARISON = [
  {
    network: "PoW tradicional",
    energy: "150 TWh/año",
    color: "hsl(5 80% 55%)",
  },
  {
    network: "RSTN PoS",
    energy: "0.01 TWh/año",
    color: "hsl(150 100% 45%)",
  },
] as const;
