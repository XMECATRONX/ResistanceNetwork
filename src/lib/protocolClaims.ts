// RSTN — Honest protocol claims
// Cada claim refleja el estado REAL del código Rust (ver VERIFICATION.md).
// Estados: implementado | testnet | parcial | roadmap | no-implementado
// Nada aquí es aspiración disfrazada de hecho. Si dice "implementado", hay un test que lo prueba.

export type ClaimStatus =
  "implementado" | "testnet" | "parcial" | "roadmap" | "no-implementado";

export const STATUS_LABELS: Record<
  ClaimStatus,
  { label: string; short: string; color: string }
> = {
  implementado: {
    label: "Implementado",
    short: "Hecho",
    color: "hsl(150 100% 45%)",
  },
  testnet: { label: "Testnet", short: "Testnet", color: "hsl(185 100% 55%)" },
  parcial: { label: "Parcial", short: "Parcial", color: "hsl(150 70% 50%)" },
  roadmap: {
    label: "Roadmap",
    short: "Planificado",
    color: "hsl(150 100% 45%)",
  },
  "no-implementado": {
    label: "No implementado",
    short: "No existe",
    color: "hsl(5 80% 55%)",
  },
};

// ─── Network stats honestas (testnet real: 4 nodos, ~1 bloque/400ms) ────────
export const HONEST_NETWORK_STATS = {
  tps: "no medido (objetivo mainnet: 250,000)",
  tpsStatus: "roadmap" as ClaimStatus,
  finality: "≈400ms por bloque (testnet local)",
  finalityStatus: "testnet" as ClaimStatus,
  blockTime: "≈400ms (testnet local)",
  blockTimeStatus: "testnet" as ClaimStatus,
  validators: 4,
  validatorsStatus: "testnet" as ClaimStatus, // objetivo: 4,128
  nodes: 4,
  nodesStatus: "testnet" as ClaimStatus,
  quantumSecurity: "256-bit (Keccak-512)",
  signatureScheme: "Dilithium3 (FIPS 204 / ML-DSA-65)",
  signatureSchemeStatus: "implementado" as ClaimStatus,
  hashFunction: "Keccak-512 (SHA-3)",
  hashFunctionStatus: "implementado" as ClaimStatus,
  vrfScheme: "Lattice-based VRF (Module-LWE)",
  vrfSchemeStatus: "implementado" as ClaimStatus, // en crypto; selección de líder usa round-robin
  transport:
    "libp2p (Noise/X25519) + PQ wire-level para streams directos (pq_wire) + threshold encryption del mempool (G13)",
  transportStatus: "parcial" as ClaimStatus, // PQ wire-level para streams directos implementado; gossipsub broadcast PQ + reemplazo total de Noise requieren fork libp2p; threshold mempool implementado
  zkProofSystem:
    "zk-STARK foundation (AIR + FRI + Fiat-Shamir, Keccak-512, sin trusted setup) — G15",
  zkProofSystemStatus: "implementado" as ClaimStatus, // G15: AIR checker + FRI prove/verify + STARK spot-check verificador, todo testeado
  shardCount: 64,
  shardCountStatus: "testnet" as ClaimStatus, // esqueleto shard_id; dynamic resize (G12) implementado (crecer/encoger por supermayoría)
  storage: "sled (Rust-native)",
  storageStatus: "implementado" as ClaimStatus,
  pqCoverage:
    "10 de 10 primitivos PQ implementados · PQ wire-level + threshold mempool + zk-STARK foundation implementados · gossipsub broadcast PQ pendiente",
  pqCoverageStatus: "parcial" as ClaimStatus, // primitivos sí; PQ wire para streams directos sí; threshold mempool sí; zk-STARK foundation sí; broadcast gossipsub + reemplazo total de Noise NO
  maxSupply: "1,000,000,000 RSTN (hardcodeado en génesis, no circulando)",
  maxSupplyStatus: "implementado" as ClaimStatus,
};

// ─── 6 capas de defensa post-cuántica — estado real ────────────────────────
export const HONEST_QUANTUM_DEFENSE = [
  {
    id: 1,
    name: "Firmas Dilithium3 (FIPS 204)",
    layer: "Capa Criptográfica (L2)",
    threat:
      "Las firmas clásicas (ECDSA, Ed25519) serán rotas por el algoritmo de Shor cuando las computadoras cuánticas alcancen qubits lógicos suficientes.",
    solution:
      "Firmas CRYSTAL-Dilithium3 (ML-DSA-65). Cada transacción y cada voto BFT se firma con Dilithium3. Clave pública: 1,952 bytes. Firma: 3,309 bytes. Tamaños canónicos FIPS 204.",
    scheme: "Dilithium3 (NIST FIPS 204)",
    status: "implementado" as ClaimStatus,
    coverage: 100,
    color: "hsl(150 100% 45%)",
    verify: "cargo test -p rstn-crypto --release (19 tests)",
  },
  {
    id: 2,
    name: "Keccak-512 (SHA-3)",
    layer: "Capa Criptográfica (L2)",
    threat:
      "Grover's algorithm reduce la seguridad de hashes a 128-bit. SHA-256 queda débil post-cuántico.",
    solution:
      "Keccak-512 con 256-bit de seguridad post-Grover. Hash de bloques, direcciones y árboles Merkle. Doble seguridad que SHA-256.",
    scheme: "Keccak-512 (NIST FIPS 202)",
    status: "implementado" as ClaimStatus,
    coverage: 100,
    color: "hsl(150 100% 45%)",
    verify: "cargo test -p rstn-crypto --release",
  },
  {
    id: 3,
    name: "VRF post-cuántico (lattice)",
    layer: "Capa Criptográfica (L2)",
    threat:
      "La selección de líderes con VRF clásico es vulnerable a Shor. Un atacante cuántico podría predecir la selección.",
    solution:
      "VRF basado en Module-LWE. Determinístico, verificable, post-cuántico. El output se deriva del proof (no se puede sustituir). Nota: la selección de líder actual usa round-robin por altura; el VRF está implementado para uso futuro en producción.",
    scheme: "Lattice-based VRF (Module-LWE)",
    status: "implementado" as ClaimStatus,
    coverage: 90,
    color: "hsl(185 100% 55%)",
    verify: "cargo test -p rstn-crypto --release (test_vrf_*)",
  },
  {
    id: 4,
    name: "Handshake post-cuántico (Kyber+X25519)",
    layer: "Capa de Red (L1)",
    threat:
      "libp2p usa Noise (X25519) para cifrar conexiones. Shor rompe X25519. Un atacante cuántico intercepta tráfico P2P.",
    solution:
      "Handshake híbrido Kyber768 KEM + X25519 ECDH + HKDF. Implementado y criptográficamente correcto. Ahora cableado a nivel wire para streams directos peer-to-peer (pq_wire::PqStream): el handshake corre sobre un substream libp2p y cada frame se cifra con la clave de sesión PQ derivada. El transporte libp2p subyacente aún usa Noise/X25519 (defensa en profundidad). El broadcast gossipsub y el reemplazo total de Noise requieren el fork libp2p (pendiente).",
    scheme: "Kyber768 + X25519 (handshake + wire para streams directos)",
    status: "parcial" as ClaimStatus,
    coverage: 75,
    color: "hsl(150 70% 50%)",
    verify:
      "cargo test -p rstn-p2p --release (pq_wire: pq_stream_handshake_and_roundtrip, pq_stream_rejects_mitm)",
  },
  {
    id: 5,
    name: "Firmas híbridas (doble verificación)",
    layer: "Capa Criptográfica (L2)",
    threat:
      "Dilithium3 puro: si se descubre un flaw en el esquema (como pasó con Rainbow en 2022), toda la red cae.",
    solution:
      "Cada transacción y cada par de claves admite firma e identidad híbrida Dilithium3 + Ed25519. Ambas se verifican en dualidad. Si rompen una, la otra sostiene.",
    scheme: "Dilithium3 + Ed25519 (doble firma)",
    status: "implementado" as ClaimStatus,
    coverage: 100,
    color: "hsl(150 100% 45%)",
    verify:
      "cargo test -p rstn-crypto --release (test_full_pq_stack_layer2_hybrid_signatures)",
  },
  {
    id: 6,
    name: "SPHINCS+ / SLH-DSA — fallback hash-based",
    layer: "Capa Criptográfica (L2)",
    threat:
      "Dilithium3 es lattice-based. Si se descubre un flaw estructural en los esquemas de retículos, toda la red cae sin fallback.",
    solution:
      "SPHINCS+ (NIST FIPS 205 / SLH-DSA-Shake128f) implementado en rstn-crypto con la biblioteca oficial slh-dsa. Esquema hash-based de respaldo no dependiente de retículos.",
    scheme: "SPHINCS+ (hash-based, NIST FIPS 205 / slh-dsa)",
    status: "implementado" as ClaimStatus,
    coverage: 100,
    color: "hsl(150 100% 45%)",
    verify:
      "cargo test -p rstn-crypto --release (test_full_pq_stack_layer6_sphincs_fallback)",
  },
];

// ─── Capas adicionales post-cuánticas (Stealth, Quantum Alarm, Account Abstraction)
export const ADDITIONAL_CRYPTO_LAYERS = [
  {
    name: "Direcciones stealth post-cuánticas",
    claim: "One-time addresses derived via Kyber768 KEM",
    reality:
      "generate_stealth_address y check_stealth_ownership implementados con Kyber768 KEM.",
    status: "implementado" as ClaimStatus,
  },
  {
    name: "Quantum Alarm — rotación de emergencia",
    claim: "On-chain quantum alarm + auto-rotation",
    reality:
      "Modulo de alarma cuántica con supermayoría 2/3+ de validadores y rotación de esquema.",
    status: "implementado" as ClaimStatus,
  },
  {
    name: "Account Abstraction post-cuántica",
    claim: "Cuentas abstractas con soporte multi-sig y social recovery",
    reality:
      "AbstractAccount implementado con soporte para firma única, multi-sig y rotación de esquema.",
    status: "implementado" as ClaimStatus,
  },
  {
    name: "Forward Security (Rotación por época)",
    claim: "ForwardSecureKeypair para prevenir ataques de largo alcance",
    reality:
      "Derivación y verificación de claves forward-secure por época probadas.",
    status: "implementado" as ClaimStatus,
  },
  {
    name: "zk-STARKs nativos",
    claim: "zk-STARK hash-based, sin trusted setup, PQ-resistente",
    reality:
      "zk-STARK foundation implementada (AIR + FRI + Fiat-Shamir, Keccak-512, verificador spot-check O(log N)) — G15. Sin trusted setup, hash-based, PQ-resistente. Faltan: circuitos de privacidad de estado completo integrados al flujo de transacción.",
    status: "implementado" as ClaimStatus,
  },
];

// ─── Lo que NO existe en el código (aún) — claims originales vs realidad ────
// Usado por QuantumDefenseList para mostrar honestamente qué falta.
export const NOT_IMPLEMENTED_CRYPTO = ADDITIONAL_CRYPTO_LAYERS.filter(
  (layer) => layer.status !== "implementado",
).map((layer) => ({
  name: layer.name,
  claim: layer.claim,
  reality: layer.reality,
}));

// ─── 12 vectores de ataque — estado real de mitigación ─────────────────────
export const HONEST_SECURITY_MITIGATIONS = [
  {
    id: 1,
    vector: "Colusión de stake (33%/67%)",
    layer: "Consenso",
    threat:
      "Si un atacante acumula 33% del stake, detiene la finalidad. Con 67%, censura y reorganiza.",
    claimedSolution: "DAS sub-lineal + sloting aleatorio",
    realStatus: "parcial" as ClaimStatus,
    realMitigation:
      "Slashing por equivocación ✅. DAS con fraud proofs ✅ (G3): erasure coding + light-client sampling + DasFraudProof que verifica on-chain. El sampling aleatorio de light clients está implementado (light_client_sample). Faltan: DAS-by-bits distribuido en la red P2P + NMT para aislamiento por namespace.",
    riskBefore: "Crítico",
    riskAfter: "Bajo (DAS + fraud proofs implementados; falta DAS distribuido)",
    coverage: 70,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 2,
    vector: "Ataque de largo alcance (Long-Range)",
    layer: "Consenso",
    threat:
      "Un atacante compra claves privadas de validadores antiguos y construye una chain alternativa desde génesis.",
    claimedSolution: "Forward security + social checkpoints",
    realStatus: "parcial" as ClaimStatus,
    realMitigation:
      "Rotación de líder por altura ✅. Pero forward security (rotación automática de claves por época) NO está cableada. No hay social checkpoints firmados.",
    riskBefore: "Alto",
    riskAfter: "Medio",
    coverage: 40,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 3,
    vector: "Vigilancia de red (Network-level surveillance)",
    layer: "Red P2P",
    threat:
      "Un ISP/gobierno observa qué IPs se conectan y construye el grafo de la topología.",
    claimedSolution: "Onion routing P2P (Nym-style)",
    realStatus: "no-implementado" as ClaimStatus,
    realMitigation:
      "No hay onion routing. El tráfico P2P es directo. Es roadmap futuro.",
    riskBefore: "Alto",
    riskAfter: "Alto (sin mitigación)",
    coverage: 0,
    color: "hsl(185 100% 55%)",
  },
  {
    id: 4,
    vector: "Retención de datos (Data Withholding)",
    layer: "Disponibilidad",
    threat:
      "Un validador propone un bloque pero no publica todos los datos. La red se detiene.",
    claimedSolution: "Reed-Solomon erasure coding + DAS + fraud proofs",
    realStatus: "implementado" as ClaimStatus,
    realMitigation:
      "Reed-Solomon erasure coding ✅ (7 tests) + light-client sampling ✅ + DasFraudProof ✅ (G3): un honest node que detecta un shard inconsistente con el data_root construye una prueba que verifica on-chain (el shard falla Merkle verification) → slash del proponente. El sampling reconstruye desde cualquier k de k+m shards.",
    riskBefore: "Alto",
    riskAfter: "Muy bajo",
    coverage: 85,
    color: "hsl(150 70% 50%)",
  },
  {
    id: 5,
    vector: "Bugs en smart contracts (RSTN-VM)",
    layer: "Ejecución",
    threat:
      "Un bug en un dApp puede perder millones. El 90% de los hacks son a contratos.",
    claimedSolution: "Formal verification + circuit breakers",
    realStatus: "parcial" as ClaimStatus,
    realMitigation:
      "Circuit breakers on-chain ✅ (implementado + testeado, 13 tests). Formal verification estilo Move NO existe. La VM es EVM-compatible sin Move resources.",
    riskBefore: "Alto",
    riskAfter: "Medio",
    coverage: 50,
    color: "hsl(185 100% 55%)",
  },
  {
    id: 6,
    vector: "Colusión de relayers (IBC)",
    layer: "Interoperabilidad",
    threat:
      "Los relayers que transportan mensajes cross-chain pueden coludir para censurar.",
    claimedSolution: "Permissionless relayer market + fee incentives",
    realStatus: "parcial" as ClaimStatus,
    realMitigation:
      "El bridge funciona (lock&mint + burn&release, E2E verificado). Pero no hay IBC ni mercado permissionless de relayers. Es un bridge de testnet.",
    riskBefore: "Medio",
    riskAfter: "Medio",
    coverage: 45,
    color: "hsl(340 75% 65%)",
  },
  {
    id: 7,
    vector: "Spam / Dust Attack",
    layer: "Mempool",
    threat:
      "Un atacante envía millones de transacciones para saturar el mempool.",
    claimedSolution: "Stake-weighted mempool + hashcash anti-spam",
    realStatus: "implementado" as ClaimStatus,
    realMitigation:
      "Mempool con cap global (4096) + cap por remitente (64) + rate-limit RPC (50/sec + 500/min) ✅. Hashcash PoW puro NO existe (no se requiere para testnet; el cap por remitente ya previene saturación).",
    riskBefore: "Medio",
    riskAfter: "Muy bajo",
    coverage: 90,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 8,
    vector: "Timejacking — manipulación de reloj",
    layer: "Red P2P",
    threat:
      "Un atacante conecta nodos con timestamps falsos. Los nodos aceptan una chain alternativa.",
    claimedSolution: "Bounded NTP + MTP validation",
    realStatus: "implementado" as ClaimStatus,
    realMitigation:
      "MTP (Median Time Past) validation ✅ (±2h sobre mediana de últimos 11 bloques, implementado en finalize_block + sync_blocks). View-change timeout en consenso BFT ✅. NTP hardened daemon NO se usa (cada nodo usa reloj local + MTP robusta).",
    riskBefore: "Alto",
    riskAfter: "Muy bajo",
    coverage: 90,
    color: "hsl(185 100% 55%)",
  },
  {
    id: 9,
    vector: "Cross-chain sandwich attack (MEV cross-domain)",
    layer: "Interoperabilidad",
    threat:
      "Un atacante ejecuta un sandwich en la chain destino antes de que la tx arrive.",
    claimedSolution:
      "Cross-chain commit-reveal + IBC sealed messages + threshold mempool",
    realStatus: "parcial" as ClaimStatus,
    realMitigation:
      "Commit-reveal cross-chain via IBC packet commitments ✅ (G7). Threshold-encrypted mempool ✅ (G13): el proponente no puede leer el payload antes del orden → MEV imposible sin colusión 2/3+. Faltan: sealed messages IBC completos + cross-chain commit-reveal end-to-end integrado al bridge.",
    riskBefore: "Alto",
    riskAfter: "Bajo",
    coverage: 60,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 10,
    vector: "Oracle manipulation (price feed spoofing)",
    layer: "Aplicación",
    threat:
      "Un atacante infla el precio de un colateral de baja liquidez y toma un préstamo.",
    claimedSolution: "Multi-source oracle + median + deviation circuit breaker",
    realStatus: "parcial" as ClaimStatus,
    realMitigation:
      "Circuit breaker de oráculo ✅ (deviation pause, testeado). Multi-source oracle + mediana robusta + TWAP NO existen.",
    riskBefore: "Alto",
    riskAfter: "Medio",
    coverage: 45,
    color: "hsl(185 100% 55%)",
  },
  {
    id: 11,
    vector: "Centralización geográfica de validadores",
    layer: "Consenso",
    threat:
      "Si >40% de validadores están en una región, un desastre regional detiene la red.",
    claimedSolution: "15% cap por región + VRF redistribution",
    realStatus: "no-implementado" as ClaimStatus,
    realMitigation:
      "No hay cap geográfico ni monitoreo on-chain. Sin VRF redistribution regional.",
    riskBefore: "Alto",
    riskAfter: "Alto (sin mitigación)",
    coverage: 0,
    color: "hsl(150 70% 50%)",
  },
  {
    id: 12,
    vector: "Flash loan + governance capture",
    layer: "Economía",
    threat:
      "Un atacante toma un flash loan, compra tokens de gobernanza, aprueba una propuesta maliciosa.",
    claimedSolution: "Quadratic voting + snapshot + timelock + minority veto",
    realStatus: "implementado" as ClaimStatus,
    realMitigation:
      "✅ Implementado + testeado (9 tests). Votación cuadrática, snapshot anti-flash-loan (bloque anterior), timelock de 1 época, veto de minoría (10% retrasa 30 días). El ÚNICO vector completamente mitigado.",
    riskBefore: "Crítico",
    riskAfter: "Muy bajo",
    coverage: 95,
    color: "hsl(0 75% 60%)",
  },
];

// Resumen honesto de los 12 vectores
export const MITIGATION_SUMMARY = {
  total: 12,
  implementado: 4, // flash loan, spam, timejacking, data withholding (+DAS fraud proofs)
  parcial: 6, // long-range, colusión DAS, VM bugs, relayers, oracle, cross-chain MEV
  noImplementado: 2, // vigilancia (onion), geo
  verbatim:
    "4 completamente mitigados, 6 parcialmente, 2 sin mitigación implementada",
};
