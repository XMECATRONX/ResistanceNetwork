// RSTN — Shared protocol data
// All metrics are architectural specifications, not live data.

export const NETWORK_STATS = {
  tps: 250000,
  finality: "0.4s",
  blockTime: "200ms",
  latency: "12ms",
  validators: 4128,
  nodes: 18947,
  quantumSecurity: "256-bit",
  signatureScheme:
    "CRYSTAL-Dilithium3 (NIST FIPS 204, ML-DSA-65) — híbrido Ed25519 diseñado, no cableado",
  hashFunction: "SHA-3 / Keccak-512",
  vrfScheme: "Lattice-based VRF (Module-LWE)",
  transport:
    "libp2p Noise (X25519) + PQ wire-level para streams directos (Kyber768/Dilithium3) — broadcast gossipsub PQ pendiente (A1)",
  zkProofSystem: "zk-STARK (hash-based, PQ-resistente)",
  dkgScheme:
    "Threshold encryption (DKG de producción en roadmap — actualmente PRNG determinístico)",
  lightClientAccumulator: "Merkle Mountain Ranges (Keccak-512)",
  shardCount: 64,
  shardSize: "2,048 TPS / shard",
  storage: "2.4 PB (proyección mainnet)",
  uptime: "99.998% (objetivo mainnet)",
  energyEfficiency: "0.0001 kWh/tx",
  txCost: "$0.0002",
  pqCoverage:
    "Firmas: 100% (Dilithium3) · Streams directos: PQ wire-level · Broadcast gossipsub: pendiente",
  genesisDate: "Q2 2028",
  token: "RSTN",
  maxSupply: "1,000,000,000",
};

// ─── Quantum Defense — 6 post-quantum defense layers ──────────────────────
export const QUANTUM_DEFENSE = [
  {
    id: 1,
    name: "Transporte P2P post-cuántico",
    layer: "Capa de Red (L1)",
    threat:
      "libp2p usa Noise (X25519) para cifrar conexiones entre nodos. Shor rompe X25519. Un atacante cuántico intercepta tráfico, descifra conexiones y manipula propagación de bloques.",
    solution:
      "Transporte híbrido Kyber + X25519 (draft libp2p/pq-noise). Cifrado post-cuántico en cada conexión P2P. Si rompen X25519, Kyber sostiene. Si rompen Kyber, X25519 sostiene.",
    scheme: "Kyber768 + X25519",
    status:
      "PQ wire-level para streams directos (pq_wire) · broadcast gossipsub PQ pendiente (fork libp2p)",
    coverage: 75,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 2,
    name: "Firmas híbridas (doble verificación)",
    layer: "Capa Criptográfica (L2)",
    threat:
      "Dilithium3 puro: si se descubre un flaw en el esquema (como pasó con Rainbow en 2022), toda la red cae. Un solo punto de fallo criptográfico.",
    solution:
      "Cada transacción se firma con Dilithium3 + Ed25519. Ambas firmas deben validar. Si rompen una, la otra sostiene la red. Costo: +1.9KB por firma — trivial.",
    scheme: "Dilithium3 + Ed25519",
    status: "diseñado · Dilithium3 puro activo (campo híbrido pendiente)",
    coverage: 80,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 3,
    name: "Direcciones stealth post-cuánticas",
    layer: "Capa Criptográfica (L2)",
    threat:
      "Al gastar RSTN, la clave pública Dilithium3 queda visible en la blockchain. Un computador cuántico futuro usa Shor sobre esa clave pública y deriva la privada. Si queda saldo, lo roban.",
    solution:
      "Esquema de direcciones stealth: la clave pública solo se revela al gastar el saldo completo. Re-uso de direcciones desincentivado a nivel de protocolo. Cada transacción deriva una nueva dirección one-time.",
    scheme: "Stealth PQ (Dilithium3 + Kyber)",
    status: "implementado en diseño",
    coverage: 100,
    color: "hsl(150 100% 55%)",
  },
  {
    id: 4,
    name: "Quantum Alarm — rotación de emergencia",
    layer: "Capa de Consenso (L3)",
    threat:
      "Sin mecanismo para detectar que un computador cuántico está operativo. Para cuando se sepa, ya será tarde — las claves expuestas ya estarán comprometidas.",
    solution:
      "Quantum alarm on-chain: si se detecta una firma válida producida por un método clásicamente imposible (firma sobre mensaje sin conocer privkey), la red entra en estado de emergencia y fuerza migración masiva a esquema superior.",
    scheme: "On-chain quantum alarm + auto-rotation",
    status: "implementado en diseño",
    coverage: 100,
    color: "hsl(150 70% 50%)",
  },
  {
    id: 5,
    name: "Account Abstraction post-cuántica",
    layer: "Capa de Aplicación (L7)",
    threat:
      "Las wallets actuales exponen claves públicas en cada transacción. Un atacante cuántico puede derivar claves privadas de claves públicas expuestas y robar fondos de cuentas que ya usaron su clave.",
    solution:
      "Account abstraction con claves Dilithium3. Las cuentas son smart contracts que validan firmas post-cuánticas. La clave pública solo se revela al gastar. Rotación de claves sin cambiar la dirección on-chain.",
    scheme: "Dilithium3 Account Abstraction",
    status: "implementado en diseño",
    coverage: 100,
    color: "hsl(150 60% 50%)",
  },
  {
    id: 6,
    name: "SPHINCS+ — Fallback hash-based",
    layer: "Capa Criptográfica (L2)",
    threat:
      "Dilithium3 es lattice-based (Module-LWE). Si se descubre un flaw estructural en los schemes de retículos (como pasó con Rainbow en 2022), toda la red caería sin fallback.",
    solution:
      "SPHINCS+ (NIST FIPS 205) como esquema de firmas hash-based de respaldo. No depende de retículos — usa hashes Keccak-512 con árboles Merkle. Resistente a Shor y Grover. Activable por gobernanza on-chain si Dilithium3 se compromete.",
    scheme: "SPHINCS+ (hash-based, NIST FIPS 205)",
    status: "implementado en diseño",
    coverage: 100,
    color: "hsl(150 60% 40%)",
  },
] as const;

// ─── PQ Migration Path — formal cryptographic evolution ──────────────────────
export const PQ_MIGRATION_PATH = [
  {
    id: 1,
    phase: "Génesis",
    scheme: "Dilithium3 + Ed25519 (híbrido)",
    trigger: "Lanzamiento de mainnet",
    action:
      "Firmas híbridas desde el bloque 0. Dilithium3 como primario, Ed25519 como ancla clásica. SPHINCS+ disponible pero inactivo.",
    status: "activo",
    color: "hsl(150 100% 45%)",
  },
  {
    id: 2,
    phase: "Monitoreo continuo",
    scheme: "Dilithium3 + Ed25519 + SPHINCS+",
    trigger: "Análisis criptanalítico o quantum alarm",
    action:
      "El protocolo monitorea publicaciones criptanalíticas. Si se detecta un avance contra Module-LWE, la gobernanza activa SPHINCS+ como co-firmante en 2 bloques.",
    status: "pasivo",
    color: "hsl(150 70% 50%)",
  },
  {
    id: 3,
    phase: "Migración de esquema",
    scheme: "Nuevo estándar NIST + SPHINCS+",
    trigger: "NIST publica FIPS 204 sucesor o ataque confirmado a Dilithium3",
    action:
      "Hard fork programado con 90 días de antelación. Las nuevas transacciones usan el esquema sucesor. Las direcciones existentes migran con transacción de rotación sin costo de gas.",
    status: "condicional",
    color: "hsl(150 100% 45%)",
  },
  {
    id: 4,
    phase: "Deprecación",
    scheme: "Solo esquema sucesor",
    trigger: "12 meses post-migración exitosa",
    action:
      "Dilithium3 deja de aceptarse en nuevas transacciones. Las UTXOs no migradas tienen 6 meses adicionales para reclamar. Posteriormente, las claves no migradas se consideran abandonadas.",
    status: "condicional",
    color: "hsl(150 100% 55%)",
  },
] as const;

// ─── Quantum Readiness Framework ────────────────────────────────────────────
export const QUANTUM_READINESS = {
  stance: "Resistencia post-cuántica, no inmunidad",
  principle:
    "RSTN está diseñado con criptografía post-cuántica basada en candidatos del NIST (FIPS 203/204/205). Estos esquemas reducen significativamente el riesgo de ataques cuánticos, pero no lo eliminan. La criptografía post-cuántica es un campo en evolución — los estándares pueden actualizarse.",
  commitments: [
    "RSTN no afirma ser 'inmune' a la computación cuántica. Afirma estar diseñado con resistencia post-cuántica.",
    "Los esquemas criptográficos son candidatos del NIST, no verdades absolutas. Rainbow (NIST round 3) cayó en 2022 — RSTN asume que Dilithium3 podría necesitar reemplazo.",
    "El protocolo incluye un migration path formal para reemplazar Dilithium3 si el NIST publica un sucesor o si se descubre un ataque.",
    "SPHINCS+ (hash-based) actúa como fallback independiente de retículos. Si los esquemas lattice fallan, SPHINCS+ sostiene la red.",
    "El quantum alarm detecta actividad clásicamente imposible y fuerza migración de emergencia. Es un mecanismo de diseño, no una garantía.",
    "RSTN se compromete a actualizar sus esquemas criptográficos cuando la investigación lo justifique, vía gobernanza on-chain y hard forks programados.",
  ],
  limitations: [
    "Los esquemas lattice (Dilithium3, Kyber) no tienen pruebas de seguridad tan maduras como RSA o curvas elípticas. La seguridad se basa en la dificultad asumida de Module-LWE.",
    "Un avance criptanalítico podría reducir la seguridad de los esquemas lattice sin un computador cuántico a gran escala.",
    "La computación cuántica a gran escala (suficiente qubits lógicos para Shor) no existe hoy. Las estimaciones de timeline varían ampliamente, de 10 a 30+ años. Los qubits físicos actuales (~1,000) no son comparables a los qubits lógicos necesarios (~4,000+).",
    "RSTN protege contra el escenario de 'harvest now, decrypt later' — pero no puede proteger claves ya comprometidas antes de la migración.",
  ],
} as const;

// ─── Security Hardening — 12 vectores de ataque mitigados ───────────────────
export const SECURITY_MITIGATIONS = [
  {
    id: 1,
    vector: "Colusión de stake (33%/67%)",
    layer: "Consenso",
    threat:
      "Si un atacante acumula 33% del stake total, puede detener la finalidad (liveness attack). Con 67%, puede censurar y reorganizar la chain. El slashing disuade pero no previene la acumulación.",
    solution:
      "Muestreo sub-lineal de validadores (DAS — Data Availability Sampling). Cada validador solo verifica una muestra aleatoria del estado. Para atacar necesitas corromper nodos que no sabes cuáles serán seleccionados. Eleva el costo del ataque de ~33% a >90%.",
    mechanism: "DAS + sub-linear sampling",
    riskBefore: "Crítico",
    riskAfter: "Muy bajo",
    coverage: 95,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 2,
    vector: "Ataque de largo alcance (Long-Range)",
    layer: "Consenso",
    threat:
      "Un atacante compra claves privadas de validadores antiguos (que ya no participan) y construye una chain alternativa desde génesis. En PoS no hay energía gastada que dificulte esto.",
    solution:
      "Checkpointing social + forward security. Los validadores firman con claves que se rotan automáticamente cada época. Las claves viejas no pueden firmar bloques nuevos. La comunidad publica checkpoints firmados que los nodos nuevos usan como ancla de confianza.",
    mechanism: "Forward security + social checkpoints",
    riskBefore: "Alto",
    riskAfter: "Muy bajo",
    coverage: 95,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 3,
    vector: "Vigilancia de red (Network-level surveillance)",
    layer: "Red P2P",
    threat:
      "Aunque el contenido está cifrado (pq-noise), un ISP o gobierno puede observar qué IPs se conectan con cuáles y construir un grafo de la topología de la red. Revela qué nodos son validadores y patrones de tráfico.",
    solution:
      "Mixnets / onion routing entre nodos. El tráfico P2P pasa por relés intermedios que mezclan paquetes temporalmente. Imposible correlacionar emisor con receptor. Costo: +200ms latencia, opcional por configuración.",
    mechanism: "Onion routing P2P (Nym-style)",
    riskBefore: "Alto",
    riskAfter: "Bajo",
    coverage: 85,
    color: "hsl(150 100% 55%)",
  },
  {
    id: 4,
    vector: "Retención de datos (Data Withholding)",
    layer: "Disponibilidad",
    threat:
      "Un validador malicioso propone un bloque pero no publica todos los datos (solo el header). Los nodos no pueden verificar el estado. La red se detiene.",
    solution:
      "Erasure coding (Reed-Solomon) + DAS con fraud proofs (G3). El bloque se divide en fragmentos redundantes. Cualquier nodo puede reconstruir el bloque completo con solo una fracción. Si el proponente retiene datos o publica shards inconsistentes con el data_root, un honest node construye un DasFraudProof que verifica on-chain (el shard falla Merkle verification contra el root) → slash. Muestreo aleatorio de light clients detecta withholding con alta probabilidad.",
    mechanism: "Reed-Solomon erasure coding + DAS + fraud proofs",
    riskBefore: "Alto",
    riskAfter: "Muy bajo",
    coverage: 95,
    color: "hsl(150 70% 50%)",
  },
  {
    id: 5,
    vector: "Bugs en smart contracts (RSTN-VM)",
    layer: "Ejecución",
    threat:
      "El 90% de los hacks en blockchain no son al protocolo, son a los contratos. Un bug en un dApp puede perder millones. La verificación manual no es suficiente.",
    solution:
      "Formal verification nativa en RSTN-VM (estilo Move). Los contratos críticos pueden ser matemáticamente probados correctos antes del deploy. Circuit breakers on-chain: si un contrato pierde >X% de fondos en Y minutos, se pausa automáticamente.",
    mechanism: "Formal verification + on-chain circuit breakers",
    riskBefore: "Alto",
    riskAfter: "Medio",
    coverage: 80,
    color: "hsl(150 100% 55%)",
  },
  {
    id: 6,
    vector: "Colusión de relayers (IBC)",
    layer: "Interoperabilidad",
    threat:
      "Aunque IBC usa ZK light clients, los relayers que transportan mensajes entre chains pueden coludir para censurar o retrasar mensajes cross-chain.",
    solution:
      "Relayers sin permiso + incentivos económicos. Cualquiera puede ser relayer. Los relayers ganan fees por entregar mensajes. Si uno censura, otro entrega. La competición económica elimina la censura.",
    mechanism: "Permissionless relayer market + fee incentives",
    riskBefore: "Medio",
    riskAfter: "Bajo",
    coverage: 85,
    color: "hsl(150 60% 40%)",
  },
  {
    id: 7,
    vector: "Spam / Dust Attack",
    layer: "Mempool",
    threat:
      "Un atacante envía millones de transacciones de 1 RSTN para saturar el mempool y encarecer el gas para todos los usuarios legítimos.",
    solution:
      "Mempool con prioridad por stake histórico + rate limiting criptográfico. Los usuarios con stake histórico tienen prioridad. Transacciones sin stake requieren proof-of-work ligero (hashcash anti-spam). Imposible saturar sin coste real.",
    mechanism: "Stake-weighted mempool + hashcash anti-spam",
    riskBefore: "Medio",
    riskAfter: "Muy bajo",
    coverage: 90,
    color: "hsl(150 60% 50%)",
  },
  {
    id: 8,
    vector: "Timejacking — manipulación de reloj de red",
    layer: "Red P2P",
    threat:
      "Un atacante conecta múltiples nodos con timestamps falsos. Los nodos ajustan su reloj de red y aceptan una chain alternativa. Bitcoin ha sido históricamente vulnerable a esto.",
    solution:
      "NTP hardened con bounded time offset (±70s). Los nodos no confían en timestamps de peers — usan su reloj local con mediana robusta. Reject de bloques con timestamp fuera del rango MTP (Median Time Past) ±2 horas. Validación de timestamps en consenso BFT.",
    mechanism: "Bounded NTP + MTP validation + local clock priority",
    riskBefore: "Alto",
    riskAfter: "Muy bajo",
    coverage: 92,
    color: "hsl(150 100% 55%)",
  },
  {
    id: 9,
    vector: "Cross-chain sandwich attack (MEV cross-domain)",
    layer: "Interoperabilidad",
    threat:
      "Un atacante observa un swap pendiente en un bridge IBC y ejecuta un sandwich attack en la chain destino ANTES de que la transacción arrive. Los mempools cifrados no protegen contra cross-chain MEV — el leak ocurre antes del mempool.",
    solution:
      "Commit-reveal cross-chain: el mensaje IBC incluye un hash commit, no el swap directo (G7). El swap se revela solo después de que el bloque destino está finalizado. Los relayers no pueden reordenar. Combinado con threshold encryption del mempool nativo (G13): el proponente no puede leer el payload antes del orden → MEV cross-domain se mitiga estructuralmente (requiere colusión de 2/3+ del comité; la versión de producción necesita DKG real).",
    mechanism:
      "Cross-chain commit-reveal + IBC sealed messages + threshold mempool",
    riskBefore: "Alto",
    riskAfter: "Bajo",
    coverage: 85,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 10,
    vector: "Oracle manipulation (price feed spoofing)",
    layer: "Aplicación",
    threat:
      "Un atacante manipula un price oracle (TWAP, spot price) inflando el precio de un colateral de baja liquidez. Deposita el colateral inflado, toma un préstamo grande, retira. $15M+ perdido en ataques reales (Lodestar, BonqDAO, Mango).",
    solution:
      "Oracle aggregation con N fuentes independientes + mediana robusta. Circuit breaker on-chain: si el precio se desvía >5% de la mediana, el contrato se pausa. Time-weighted average price (TWAP) con ventana mínima de 30 min. Prohibición de usar oracles de baja liquidez como referencia.",
    mechanism:
      "Multi-source oracle + median + deviation circuit breaker + TWAP minimum",
    riskBefore: "Alto",
    riskAfter: "Medio",
    coverage: 80,
    color: "hsl(150 100% 55%)",
  },
  {
    id: 11,
    vector: "Centralización geográfica de validadores",
    layer: "Consenso",
    threat:
      "Si >40% de validadores están en una región (ej: Solana tiene 40% en Norteamérica), un desastre natural, corte de internet regional o regulación gubernamental puede detener la red. Correlación de fallos geográficos.",
    solution:
      "Shard assignment geográficamente distribuido por VRF. Máximo 15% de validadores por región. Monitoreo on-chain de distribución geográfica. Si una región supera 15%, el VRF redistribuye shards automáticamente. Seed nodes en 5+ regiones.",
    mechanism:
      "Geographic cap 15%/región + VRF redistribution + on-chain monitoring",
    riskBefore: "Alto",
    riskAfter: "Muy bajo",
    coverage: 90,
    color: "hsl(150 70% 50%)",
  },
  {
    id: 12,
    vector: "Flash loan + governance capture",
    layer: "Economía",
    threat:
      "Un atacante toma un flash loan, compra tokens de gobernanza, aprueba una propuesta maliciosa, ejecuta el ataque y devuelve el loan — todo en un bloque. $50M+ perdido en ataques reales (Beanstalk).",
    solution:
      "Votación cuadrática con identidad verificada (no tokens). Snapshot de votación con delay de 1 época entre propuesta y ejecución. Flash loans no pueden influir porque el poder de voto se calcula en el bloque ANTERIOR, no en el actual. Veto de minoría (10%) retrasa 30 días.",
    mechanism:
      "Quadratic voting + verified identity + epoch-delayed snapshot + minority veto",
    riskBefore: "Crítico",
    riskAfter: "Muy bajo",
    coverage: 95,
    color: "hsl(0 75% 60%)",
  },
  {
    id: 13,
    vector: "Validador génesis con poder absoluto",
    layer: "Consenso",
    threat:
      "El validador génesis es el único validador al lanzar. Tiene poder absoluto — puede censurar cada transacción.",
    solution:
      "Salida gradual del validador génesis (reducción automática de stake). genesis_effective_stake reduce el stake del génesis linealmente desde 100% hasta 10% sobre 10,000 épocas, comenzando en la época 1,000. El peso de gobernanza disminuye automáticamente — sin unstake manual.",
    mechanism: "Genesis exit schedule — linear stake reduction over 10K epochs",
    riskBefore: "Alto",
    riskAfter: "Muy bajo",
    coverage: 90,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 14,
    vector: "Multisig controlada por el equipo",
    layer: "Gobernanza",
    threat:
      "Si el equipo controla la multisig del vault del bridge, puede coludir para liberar los BTC bloqueados y robar los fondos.",
    solution:
      "Multisig pública con firmantes independientes (no del equipo). MultisigConfig exige M-of-N firmas de un conjunto INDEPENDIENTE (auditors, validadores comunitarios, custodios). Cualquier firma de un miembro del EQUIPO es RECHAZADA. 3-of-5 para el vault del bridge, 2-of-3 para operaciones no críticas.",
    mechanism: "Independent-signer multisig — team signers explicitly rejected",
    riskBefore: "Crítico",
    riskAfter: "Muy bajo",
    coverage: 90,
    color: "hsl(150 100% 45%)",
  },
  {
    id: 15,
    vector: "Sin escape hatch (fondos rehenes)",
    layer: "Interoperabilidad",
    threat:
      "Si todos los validadores van rogue, los usuarios no pueden recuperar sus fondos — están rehenes del set de validadores.",
    solution:
      "Escape hatch unilateral con delay (24h). El usuario escrowa sus wrapped tokens y, después de 216,000 bloques (~24h), reclama una parte proporcional de las reservas bloqueadas — SIN permiso de validadores. Liberación proporcional: (escrowed / total_circulation) * locked_reserves.",
    mechanism:
      "Unilateral escape hatch — proportional reserve claim after 24h delay",
    riskBefore: "Crítico",
    riskAfter: "Muy bajo",
    coverage: 95,
    color: "hsl(150 100% 45%)",
  },
] as const;

export const DISEASES = [
  {
    id: 1,
    name: "Vulnerabilidad cuántica",
    problem:
      "Las firmas digitales actuales (ECDSA, secp256k1, Ed25519) serán rotas por el algoritmo de Shor cuando las computadoras cuánticas alcancen suficiente qubits lógicos.",
    solution:
      "Firmas CRYSTAL-Dilithium3 (NIST FIPS 204, ML-DSA-65) basadas en retículos. Resistencia demostrada contra ataques cuánticos. Clave pública: 1,952 bytes. Firma: 3,309 bytes.",
    severity: "crítico",
    status: "resuelto",
    category: "Criptografía",
  },
  {
    id: 2,
    name: "Escalabilidad (trilema)",
    problem:
      "Las blockchains actuales procesan 15-30 TPS. Los sistemas de pago globales necesitan 24,000+ TPS. Escalar sin sacrificar descentralización o seguridad es el desafío histórico.",
    solution:
      "Sharding dinámico de 64 fragmentos + DAG paralelo + ejecución asíncrona. Throughput: 2,048 TPS/shard × 64 = 131K base, hasta 250K con DAG paralelo.",
    severity: "crítico",
    status: "resuelto",
    category: "Escalabilidad",
  },
  {
    id: 3,
    name: "Finalidad lenta",
    problem:
      "Las blockchains actuales tardan entre 12 y 60 minutos para confirmación irreversible. Los usuarios esperan minutos para una transacción final.",
    solution:
      "Consenso híbrido BFT+DAG con finalidad determinista en 0.4s. Un bloque queda finalizado en 2 rondas de votación, no en épocas.",
    severity: "alto",
    status: "resuelto",
    category: "Consenso",
  },
  {
    id: 4,
    name: "MEV (Maximal Extractable Value)",
    problem:
      "Los validadores pueden reordenar, insertar o censurar transacciones para extraer valor de los usuarios. Las blockchains pierden $1B+/año en MEV.",
    solution:
      "Mempool con threshold encryption (G13): las transacciones se cifran antes de broadcast; solo el commitment (hash) es visible al proponente. Los payloads se desencriptan con t+1 shares (2/3+ del comité) DESPUÉS de finalizada la ronda. El proponente no puede leer el payload antes del orden → reordenar para MEV se mitiga estructuralmente (la versión de producción requiere DKG real).",
    severity: "alto",
    status: "resuelto",
    category: "Economía",
  },
  {
    id: 5,
    name: "Privacidad inexistente",
    problem:
      "Todas las transacciones son públicas. Saldo, historial y metadatos son visibles para cualquier nodo. Zero-knowledge es opcional y costoso.",
    solution:
      "zk-STARKs nativos en el protocolo (G15): AIR (Algebraic Intermediate Representation) + FRI (low-degree test, Keccak-512) + Fiat-Shamir. Sin trusted setup, hash-based, post-cuántico. El verificador lee O(log N) filas del trace — Succinct. El testigo no se revela — Zero-Knowledge.",
    severity: "alto",
    status: "resuelto",
    category: "Privacidad",
  },
  {
    id: 6,
    name: "Gobernanza capturable",
    problem:
      "Las DAOs con gobernanza por tokens son capturables por ballenas. Un atacante con 33% del supply puede controlar la red.",
    solution:
      "Gobernanza cuadrática + identidad verificada + delegación líquida con veto de minoría. Umbral de captura: >51% de identidades verificadas, no tokens.",
    severity: "medio",
    status: "resuelto",
    category: "Gobernanza",
  },
  {
    id: 7,
    name: "Custodia de claves",
    problem:
      "Si pierdes tu frase seed, pierdes todo. No hay recuperación. Los usuarios pierden $100M/año en claves perdidas.",
    solution:
      "Recuperación social criptográfica con guardianes. Umbral 3-de-5. Los guardianes firman colectivamente para rotar claves sin exponer el privkey.",
    severity: "medio",
    status: "resuelto",
    category: "UX",
  },
  {
    id: 8,
    name: "Interoperabilidad rota",
    problem:
      "Los bridges entre chains son el vector de ataque #1. Miles de millones hackeados en bridges por custodia centralizada.",
    solution:
      "Protocolo IBC nativo (G7) + light clients post-cuánticos con Merkle Mountain Ranges (Keccak-512) + zk-STARK del estado de origen (G15). Sin custodia centralizada. Packet commitments con replay protection; el light client verifica membership proofs contra el state root de la chain origen.",
    severity: "alto",
    status: "resuelto",
    category: "Interoperabilidad",
  },
  {
    id: 9,
    name: "Sostenibilidad energética",
    problem:
      "Las blockchains PoW consumen 150 TWh/año. PoS reduce consumo pero la verificación de nodos sigue siendo costosa a escala.",
    solution:
      "PoS eficiente + validación ligera con clientes sin estado (stateless clients). Consumo: 0.0001 kWh/tx — 15,000× más eficiente que PoW.",
    severity: "medio",
    status: "resuelto",
    category: "Sostenibilidad",
  },
  {
    id: 10,
    name: "Censura y resistencia",
    problem:
      "En PoS, un validador puede censurar transacciones. En redes actuales, el 51% de los validadores están en 3 proveedores de hosting.",
    solution:
      "Forced-inclusion pool (G14): una tx censurada en el bloque N entra al pool forzado cuando t+1 validadores (2/3+) atestiguan su exclusión. El proponente del bloque N+1 DEBE incluirla (hasta el gas budget) o el bloque es inválido. La censura de una tx forzada es una violación de protocolo que el siguiente proponente no puede cometer.",
    severity: "alto",
    status: "resuelto",
    category: "Consenso",
  },
] as const;

export const ARCHITECTURE_LAYERS = [
  {
    layer: 7,
    name: "Capa de Aplicación",
    description:
      "Smart contracts, wallets, dApps. Compatible con tooling EVM vía RSTN-VM.",
    tech: ["RSTN-VM", "Solidity+", "Move-style resources", "WebAssembly"],
  },
  {
    layer: 6,
    name: "Capa de Interoperabilidad",
    description:
      "Comunicación entre chains con IBC y light clients post-cuánticos (zk-STARK + Merkle Mountain Ranges).",
    tech: [
      "IBC",
      "zk-STARK Light Clients",
      "Dilithium relayers",
      "MMR (Keccak-512)",
    ],
  },
  {
    layer: 5,
    name: "Capa de Ejecución",
    description:
      "Subconjunto EVM (opcodes 0x00–0xEF) con ejecución paralela. Access lists opcionales para paralelismo sin overhead obligatorio.",
    tech: [
      "Subconjunto EVM + extensiones PQ",
      "Parallel Execution",
      "DAG",
      "Access Lists (opcional)",
    ],
  },
  {
    layer: 4,
    name: "Capa de Sharding",
    description:
      "64 fragmentos dinámicos. Cross-shard con lock-and-commit (atomicidad garantizada) + migración de hotspots por gobernanza.",
    tech: [
      "Dynamic Sharding",
      "Lock-and-Commit Atomicity",
      "Cross-shard Receipts",
      "Hotspot Migration",
      "State Proofs",
    ],
  },
  {
    layer: 3,
    name: "Capa de Consenso",
    description:
      "BFT híbrido + DAG con finalidad determinista en 0.4s. Muestreo sub-lineal (DAS), forward security y erasure coding.",
    tech: [
      "BFT+DAG",
      "VRF",
      "Pipelined Voting",
      "DAS",
      "Forward Security",
      "Erasure Coding",
    ],
  },
  {
    layer: 2,
    name: "Capa Criptográfica",
    description:
      "Suite post-cuántica completa. Firmas, VRF, hashes, ZK y DKG resistentes a Shor.",
    tech: [
      "Dilithium3",
      "SPHINCS+ (fallback)",
      "Lattice-VRF",
      "Keccak-512",
      "zk-STARK",
      "Threshold encryption (DKG en roadmap)",
    ],
  },
  {
    layer: 1,
    name: "Capa de Red",
    description:
      "Gossip protocol con transporte post-cuántico (pq-noise). Descubrimiento de pares y propagación de bloques resistente a Shor.",
    tech: ["libp2p", "Gossipsub", "Discv5", "pq-noise (Kyber+X25519)"],
  },
] as const;

export const ROADMAP = [
  {
    phase: "Fase 0",
    title: "Investigación y Especificación",
    period: "Q3 2026 — Q1 2027",
    status: "en progreso",
    items: [
      "Whitepaper técnico v1.0",
      "Especificación de consenso BFT+DAG",
      "Diseño de suite criptográfica post-cuántica",
      "Prototipo de Dilithium en Rust",
    ],
  },
  {
    phase: "Fase 1",
    title: "Testnet Privada",
    period: "Q2 2027 — Q3 2027",
    status: "planificado",
    items: [
      "Cliente de referencia en Rust (rstn-core)",
      "12 nodos validadores iniciales",
      "Integración de Dilithium en consenso",
      "Auditoría criptográfica por firma especializada",
    ],
  },
  {
    phase: "Fase 2",
    title: "Testnet Pública",
    period: "Q4 2027 — Q1 2028",
    status: "planificado",
    items: [
      "Apertura a validadores externos",
      "Faucet y block explorer público",
      "Programa de bug bounty",
      "Implementación de sharding dinámico",
    ],
  },
  {
    phase: "Fase 3",
    title: "Mainnet Génesis",
    period: "Q2 2028",
    status: "planificado",
    items: [
      "Génesis con 500+ validadores (bootstrap desde testnet)",
      "Distribución de token RSTN por Proof of Participation",
      "Activación de IBC",
      "Crecimiento hacia 4,128 validadores objetivo",
    ],
  },
  {
    phase: "Fase 4",
    title: "Escalado y Ecosistema",
    period: "Q3 2028 — Q4 2028",
    status: "planificado",
    items: [
      "Activación de 64 shards",
      "SDK para desarrolladores",
      "Grants por Proof of Participation (sin fondo reservado)",
      "Integración con wallets principales",
    ],
  },
] as const;

// ─── Genesis Distribution — Proof of Participation ─────────────────────────
// 95% of supply is distributed without a sale. Mechanism: Proof of Participation.
// You contribute real work to the network → you receive RSTN. It is not investment, it is reward.
export const GENESIS_DISTRIBUTION = {
  mechanism: "Proof of Participation (PoP)",
  principle:
    "No vendes tokens. Recompensas trabajo. Si nunca vendes nada, no hay nada que regular.",
  noSale: "Cero venta de tokens. Cero ICO. Cero pre-venta. Cero VCs.",
  howItWorks: [
    {
      phase: "Testnet Fase 1-2",
      action: "Ejecutar nodo validador en testnet",
      reward: "RSTN testnet + snapshot de participación",
    },
    {
      phase: "Testnet Fase 2-3",
      action: "Contribuir código, auditar, construir dApps, documentar",
      reward: "Grants de RSTN por contribución verificada",
    },
    {
      phase: "Mainnet génesis",
      action:
        "Snapshot de participación testnet → distribución proporcional de RSTN mainnet",
      reward: "RSTN mainnet proporcional al trabajo contribuido",
    },
    {
      phase: "Post-génesis",
      action: "Staking continuo + participación en consenso",
      reward: "Recompensas de bloque variables según rendimiento de red",
    },
  ],
  antiWhale:
    "Sin acumulación inicial. La distribución es proporcional al trabajo, no al capital. Un participante que ejecutó un nodo 6 meses recibe más que uno que llegó 1 semana antes del snapshot.",
  legalShield:
    "Proof of Participation recompensa trabajo real verificable, no inversión de capital. Las recompensas son resultado de contribución a la red, no de expectativa de ganancias.",
} as const;

export const TOKENOMICS = [
  {
    allocation: "Staking y Validadores (Fair Launch)",
    percentage: 95,
    color: "hsl(150 100% 45%)",
    description:
      "Distribuido por Proof of Participation desde génesis. Sin pre-venta. Contribuyes trabajo (nodo, código, auditoría) → recibes RSTN. El equipo NO tiene bucket reservado: opera el validador génesis y gana RSTN desde este bucket por ser el primero en hacer el trabajo de bootstrap, como Satoshi minó los primeros BTC. Modelo Satoshi puro: 0% reservado, 100% se gana por trabajo.",
  },
  {
    allocation: "Airdrop Testnet (Semilla de arranque)",
    percentage: 5,
    color: "hsl(150 60% 40%)",
    description:
      "Único bucket pre-asignado: semilla de arranque entregada una sola vez a quienes corrieron nodos de testnet (trabajo verificado). Equivalente PoS a los primeros mineros de Satoshi. No transferible a fundadores. Sin ecosystem fund, sin treasury capturable: el 95% restante se gana por trabajo.",
  },
] as const;

// ─── Team Bootstrap Role — Satoshi model (no reserved bucket) ──────────────
// The team has NO reserved allocation in genesis. It operates the genesis
// validator and earns RSTN from the staking bucket (95%) for being the first to
// do the bootstrap work — just as Satoshi mined the first BTC with PoW for being
// the first to mine. No vesting, no cliff, no burn: there is no bucket to
// manage. The team only earns if it does the work; if it stops validating,
// it stops earning. Its share dilutes only as new stakers arrive.
// Public long-term no-sell commitment = Satoshi's sink behavior.
export const TEAM_BOOTSTRAP_ROLE = {
  model: "Genesis Validator Operator (modelo Satoshi)",
  genesisReservation: "0% — el equipo NO tiene bucket reservado en génesis.",
  howTeamEarns:
    "El equipo opera el validador génesis (infraestructura, seguridad, bootstrap de la cadena) y gana RSTN desde el bucket de staking (95%) por ser el primero en hacer el trabajo. Igual que Satoshi minó los primeros BTC: cobró desproporcionado por ser el primero en minar, no por un privilegio de protocolo.",
  sameMechanismAsEveryone:
    "El equipo cobra por el mismo mecanismo que cualquier validador. No hay asiento especial. Si deja de validar, deja de cobrar.",
  dilution:
    "El share del equipo se diluye solo a medida que llegan nuevos stakers — igual que el share de Satoshi se diluyó cuando llegaron más mineros. La competencia, no un contrato de vesting, fuerza la dilución.",
  satoshiSink:
    "Compromiso público de no-venta a largo plazo que replica el comportamiento sink de Satoshi (sus ~1.1M BTC jamás se movieron). El equipo no inunda el mercado porque no hay asignación liberable que descargar.",
  risk: "Sin bucket garantizado, si la red no despega el equipo no cobra — el mismo riesgo que asumió Satoshi gastando electricidad cuando BTC valía ~$0. Es el skin inthe-game que hace creíble el 'no founder allocation'.",
  noVestingNoCliffNoBurn:
    "Sin vesting, sin cliff, sin quema de residuo. No existe un bucket Team que administrar, liberar o quemar. La complejidad desaparece por diseño.",
  walletsPublic: true,
} as const;

export const TEAM_BOOTSTRAP_GUARANTEES = [
  {
    guarantee: "Cero asignación reservada en génesis",
    detail:
      "El equipo no tiene bucket Team en el contrato de génesis. No hay tokens reservados que administrar, liberar o quemar.",
  },
  {
    guarantee: "Gana por trabajo, no por privilegio",
    detail:
      "El equipo cobra RSTN desde el bucket de staking (95%) por operar el validador génesis. El mismo mecanismo que paga a cualquier validador. Si deja de validar, deja de cobrar.",
  },
  {
    guarantee: "Dilución natural por competencia",
    detail:
      "El share del equipo se diluye solo cuando llegan nuevos stakers. Igual que Satoshi: la competencia, no un vesting, fuerza la dilución.",
  },
  {
    guarantee: "Comportamiento sink (no-venta a largo plazo)",
    detail:
      "Compromiso público de no-venta que replica el comportamiento de Satoshi (sus BTC jamás se movieron). El equipo no inunda el mercado porque no hay asignación liberable.",
  },
  {
    guarantee: "Skin in the game real",
    detail:
      "Sin bucket garantizado, si la red no despega el equipo pierde el costo del bootstrap. El mismo riesgo que Satoshi asumió gastando electricidad cuando BTC valía ~$0.",
  },
  {
    guarantee: "Transparencia total",
    detail:
      "Las wallets del equipo son públicas y auditables. La comunidad puede verificar que el equipo gana solo por validación, no por asignación reservada.",
  },
] as const;

// ─── RSTN-Node Architecture ───────────────────────────────────────────────
export const NODE_STACK = [
  {
    layer: 7,
    name: "DApps + Wallets + Explorer",
    tech: "React · SDK TypeScript · SDK Rust",
    role: "Interfaz de usuario y herramientas de desarrollo",
  },
  {
    layer: 6,
    name: "RPC + API Gateway",
    tech: "JSON-RPC 2.0 · REST · WebSocket subscriptions",
    role: "Punto de entrada para clientes y dApps",
  },
  {
    layer: 5,
    name: "RSTN-VM",
    tech: "Subconjunto EVM (0x00–0xEF) + extensiones PQ · ejecución paralela · access lists opcionales",
    role: "Ejecución de smart contracts (subconjunto EVM con firmas post-cuánticas)",
  },
  {
    layer: 4,
    name: "Sharding Manager",
    tech: "64 shards dinámicos · XCMP post-cuántico",
    role: "Escalado horizontal y comunicación cross-shard",
  },
  {
    layer: 3,
    name: "Consenso BFT + DAG",
    tech: "BFT + DAG paralelo · VRF post-cuántico · DAS · forward security · erasure coding · circuit breakers",
    role: "Acuerdo sobre el orden y finalidad de transacciones",
  },
  {
    layer: 2,
    name: "Criptografía Post-Cuántica",
    tech: "Dilithium3 (firmas) · SPHINCS+ (fallback hash-based) · Lattice-VRF · Kyber (KEM) · Keccak-512 · zk-STARK · Threshold encryption (DKG en roadmap)",
    role: "Firmas, VRF, hashing, ZK y DKG resistentes a Shor. Fallback hash-based si Dilithium3 se compromete.",
  },
  {
    layer: 1,
    name: "P2P + Almacenamiento",
    tech: "libp2p (gossip, Kademlia DHT) · onion routing opcional · sled / RocksDB",
    role: "Networking descentralizado y persistencia del ledger",
  },
] as const;

export const RUST_CRATES = [
  {
    name: "libp2p",
    purpose: "Networking P2P (gossip, discovery, Kademlia DHT)",
    status: "stable",
  },
  {
    name: "pqcrypto-dilithium",
    purpose: "Firmas post-cuánticas CRYSTAL-Dilithium3",
    status: "stable",
  },
  {
    name: "pqcrypto-sphincsplus",
    purpose: "Firmas hash-based de respaldo (NIST FIPS 205)",
    status: "stable",
  },
  {
    name: "pqcrypto-kyber",
    purpose: "Intercambio de claves post-cuántico (KEM)",
    status: "stable",
  },
  {
    name: "sha3",
    purpose: "Hashing Keccak-512 resistente a Grover",
    status: "stable",
  },
  {
    name: "winterfell",
    purpose: "zk-STARK prover/verifier (hash-based, PQ-resistente)",
    status: "planned",
  },
  {
    name: "sled",
    purpose: "Almacenamiento persistente del ledger (Rust-native)",
    status: "stable",
  },
  {
    name: "tokio",
    purpose: "Runtime asíncrono para concurrencia masiva",
    status: "stable",
  },
  {
    name: "serde",
    purpose: "Serialización binaria eficiente (borsh)",
    status: "stable",
  },
  {
    name: "tracing",
    purpose: "Logging estructurado y observabilidad",
    status: "stable",
  },
  {
    name: "clap",
    purpose: "CLI del nodo (rstn-node --mainnet)",
    status: "planned",
  },
] as const;

export const NODE_DEPLOY = {
  binary: "rstn-node",
  formats: ["Docker image", "Binario nativo Linux", "Binario macOS"],
  command: "docker run rstn/node:latest --mainnet",
  requirements: {
    cpu: "4 cores mínimo",
    ram: "8GB mínimo (16GB recomendado)",
    storage: "100GB+ SSD",
    network: "Estable, puerto 31402 abierto",
    gpu: "No requerido (no hay PoW)",
  },
} as const;

// ─── Network Discovery — how nodes find the network ───────────────────────
export const NETWORK_DISCOVERY = {
  bootstrapMethod: "Seed nodes + DNS discovery + Kademlia DHT",
  seedNodes: [
    {
      host: "seed-01.rstn.network",
      port: 31402,
      region: "Europa",
      role: "Seed primario",
    },
    {
      host: "seed-02.rstn.network",
      port: 31402,
      region: "América del Norte",
      role: "Seed primario",
    },
    {
      host: "seed-03.rstn.network",
      port: 31402,
      region: "Asia-Pacífico",
      role: "Seed primario",
    },
    {
      host: "seed-04.rstn.network",
      port: 31402,
      region: "Sudamérica",
      role: "Seed secundario",
    },
    {
      host: "seed-05.rstn.network",
      port: 31402,
      region: "África",
      role: "Seed secundario",
    },
  ],
  dnsDiscovery:
    "boot.rstn.network (DNS TXT records con multiaddr de seed nodes)",
  dhtProtocol: "Kademlia DHT (libp2p)",
  peerExchange: "Gossipsub 1.1 (mesh-based, peer scoring)",
  transportSecurity: "PQ-noise (Kyber768 + X25519 hybrid handshake)",
  topics: [
    { name: "rstn/blocks/1.0", purpose: "Propagación de bloques nuevos" },
    {
      name: "rstn/transactions/1.0",
      purpose: "Propagación de transacciones pendientes",
    },
    {
      name: "rstn/consensus/1.0",
      purpose: "Mensajes de consenso BFT (propuestas, votos, timeouts)",
    },
    {
      name: "rstn/validator/1.0",
      purpose: "Registro y heartbeat de validadores",
    },
  ],
  peerScoring:
    "Sistema de reputación: peers maliciosos son degradados y eventualmente desconectados",
  natTraversal: "Relay nodes (libp2p circuit relay) para nodos detrás de NAT",
} as const;

export const NODE_CONNECTION_FLOW = [
  {
    step: 1,
    title: "Preparar hardware",
    command: "ssh root@tu-vps",
    detail:
      "Comprar VPS en Hetzner, DigitalOcean o AWS ($20-$50/mes). 4 cores, 8GB RAM, 100GB SSD. SSH al servidor.",
    icon: "Server",
  },
  {
    step: 2,
    title: "Instalar el nodo",
    command:
      "docker pull rstn/node:latest && docker run -d --name rstn-node -p 31402:31402 -v ./rstn-data:/data rstn/node:latest --mainnet",
    detail:
      "Un comando. Docker descarga la imagen oficial y arranca el nodo. El nodo lee los seed nodes del config y comienza el descubrimiento.",
    icon: "Package",
  },
  {
    step: 3,
    title: "Descubrir la red",
    command: "→ boot.rstn.network → seed-01..05.rstn.network → Kademlia DHT",
    detail:
      "El nodo resuelve boot.rstn.network (DNS TXT), obtiene 5 seed nodes, se conecta vía PQ-noise (Kyber+X25519) al puerto 31402, y Kademlia DHT descubre el resto de la red automáticamente.",
    icon: "Network",
  },
  {
    step: 4,
    title: "Generar claves post-cuánticas",
    command: "rstn keys generate --dilithium3",
    detail:
      "Genera par de claves Dilithium3 + Ed25519 (híbrido). La clave pública es tu dirección RSTN. Guarda la seed phrase de 12 palabras. Las claves nunca salen de tu máquina.",
    icon: "Key",
  },
  {
    step: 5,
    title: "Registrar como validador",
    command: "resistance validator register --stake 32000",
    detail:
      "Envía transacción de registro on-chain. Bloquea 32,000 RSTN como stake. El nodo empieza a ser seleccionado por el VRF post-cuántico para producir bloques.",
    icon: "ShieldCheck",
  },
  {
    step: 6,
    title: "Mantener y monitorear",
    command: "rstn status && rstn logs -f",
    detail:
      "El nodo sincroniza automáticamente, produce bloques cuando el VRF lo selecciona, recibe recompensas variables. Monitoreo vía rstn status + Prometheus metrics en :9090/metrics.",
    icon: "Activity",
  },
] as const;

// ─── Node deployment roadmap ───────────────────────────────────────────────
export const NODE_ROADMAP = [
  {
    phase: "Fase 1",
    title: "Nodo de Referencia",
    period: "Meses 1-6",
    deliverable: "1 nodo produciendo bloques localmente",
    items: [
      "Escribir rstn-core en Rust",
      "P2P con libp2p",
      "Consenso BFT básico (sin DAG aún)",
      "Criptografía Dilithium3 + Keccak-512",
      "Almacenamiento sled (Rust-native)",
    ],
    hardware: "4 cores · 8GB RAM · 100GB SSD",
  },
  {
    phase: "Fase 2",
    title: "Testnet Privada",
    period: "Meses 6-12",
    deliverable: "Red funcional cerrada de 10-20 nodos",
    items: [
      "Desplegar 10-20 nodos en VPS (Hetzner/DigitalOcean)",
      "Implementar DAG paralelo",
      "Sharding dinámico (4 shards iniciales)",
      "RPC JSON-RPC para interactuar",
      "Explorador de bloques web",
    ],
    hardware: "20 VPS · $300/mes total",
  },
  {
    phase: "Fase 3",
    title: "Testnet Pública",
    period: "Meses 12-18",
    deliverable: "Red abierta — cualquiera puede unirse",
    items: [
      "Docker image pública (rstn/node)",
      "Documentación de instalación completa",
      "Incentivos para node operators (RSTN testnet)",
      "Meta: 100-500 nodos distribuidos",
      "App móvil de staking ligero",
    ],
    hardware: "100-500 nodos comunitarios",
  },
  {
    phase: "Fase 4",
    title: "Auditorías + Bug Bounty",
    period: "Meses 18-24",
    deliverable: "Certificación de seguridad",
    items: [
      "Auditoría criptográfica (firma especializada)",
      "Auditoría de consenso (firma especializada)",
      "Bug bounty (monto a anunciarse)",
      "Pruebas de estrés: 100K TPS sostenido",
    ],
    hardware: "Infraestructura de prueba dedicada",
  },
  {
    phase: "Fase 5",
    title: "Mainnet",
    period: "Meses 24-30",
    deliverable: "Red en producción",
    items: [
      "Génesis con distribución inicial (500+ validadores)",
      "4,128 validadores objetivo (crecimiento orgánico)",
      "Listado en exchanges DEX",
      "SDK para desarrolladores dApps",
      "Bridges cross-chain post-cuánticos",
    ],
    hardware: "4,128+ nodos globales",
  },
] as const;

// ─── Mining & Participation Model ────────────────────────────────────────
// Extracted to src/lib/protocolMining.ts (honest PoS/PoP narrative + 3
// post-genesis paths). Re-exported here for backwards-compatible imports.
export {
  PARTICIPATION_TIERS,
  MINING_MODEL,
  POST_GENESIS_PATHS,
  PARTICIPATION_STEPS,
  ENERGY_COMPARISON,
} from "./protocolMining";

// ─── Monetary Policy v3 — EIP-1559 with floor + dynamic inflation ───────────
// Extracted to src/lib/protocolMonetary.ts (superior model that fixes the 3
// serious errors of Ethereum/Solana/Cosmos). Re-exported here for backwards-
// compatible imports.
import { MONETARY_POLICY } from "./protocolMonetary";
export { MONETARY_POLICY } from "./protocolMonetary";

// PARTICIPATION_STEPS and ENERGY_COMPARISON now live in protocolMining.ts
// (re-exported above). Kept this comment as a marker.

// ─── Block Explorer — Mock testnet preview data ─────────────────────────────
// NOTE: Simulated data for UI demonstration. Real data comes from rstn-node RPC.

export const EXPLORER_STATS = {
  blockHeight: 8471203,
  avgBlockTime: "0.4s",
  tps: 18456,
  tpsTarget: 250000,
  activeValidators: 4128, // target mainnet (genesis starts with 500+)
  pendingTxs: 1284,
  avgFee: "0.0002 RSTN",
  totalTxCount: "1.84B",
  shardCount: 64,
} as const;

export const MOCK_BLOCKS = [
  {
    height: 8471203,
    hash: "0x7f3a9b2c4e8d1f6a",
    validator: "rstn-val-0042",
    txCount: 182,
    size: "1.24 MB",
    age: "2s",
    gasUsed: "12.4M",
    gasLimit: "30M",
    shard: 12,
  },
  {
    height: 8471202,
    hash: "0x3c8e1d5a7b9f0024",
    validator: "rstn-val-0188",
    txCount: 94,
    size: "0.82 MB",
    age: "2s",
    gasUsed: "6.1M",
    gasLimit: "30M",
    shard: 7,
  },
  {
    height: 8471201,
    hash: "0xa1b2c3d4e5f60081",
    validator: "rstn-val-0291",
    txCount: 156,
    size: "1.05 MB",
    age: "2s",
    gasUsed: "9.8M",
    gasLimit: "30M",
    shard: 24,
  },
  {
    height: 8471200,
    hash: "0xf0e1d2c3b4a50072",
    validator: "rstn-val-0103",
    txCount: 203,
    size: "1.38 MB",
    age: "2s",
    gasUsed: "14.2M",
    gasLimit: "30M",
    shard: 45,
  },
  {
    height: 8471199,
    hash: "0x9a8b7c6d5e4f0063",
    validator: "rstn-val-0367",
    txCount: 67,
    size: "0.61 MB",
    age: "2s",
    gasUsed: "4.2M",
    gasLimit: "30M",
    shard: 3,
  },
  {
    height: 8471198,
    hash: "0x1234567890ab0054",
    validator: "rstn-val-0214",
    txCount: 118,
    size: "0.94 MB",
    age: "2s",
    gasUsed: "7.7M",
    gasLimit: "30M",
    shard: 18,
  },
  {
    height: 8471197,
    hash: "0x5678abcdef010045",
    validator: "rstn-val-0489",
    txCount: 245,
    size: "1.52 MB",
    age: "2s",
    gasUsed: "16.8M",
    gasLimit: "30M",
    shard: 56,
  },
  {
    height: 8471196,
    hash: "0xabcdef1234560036",
    validator: "rstn-val-0067",
    txCount: 89,
    size: "0.73 MB",
    age: "2s",
    gasUsed: "5.5M",
    gasLimit: "30M",
    shard: 31,
  },
  {
    height: 8471195,
    hash: "0x9876543210fe0027",
    validator: "rstn-val-0152",
    txCount: 134,
    size: "0.98 MB",
    age: "2s",
    gasUsed: "8.4M",
    gasLimit: "30M",
    shard: 9,
  },
  {
    height: 8471194,
    hash: "0x0fedcba987650018",
    validator: "rstn-val-0333",
    txCount: 167,
    size: "1.12 MB",
    age: "2s",
    gasUsed: "10.6M",
    gasLimit: "30M",
    shard: 42,
  },
] as const;

export const MOCK_TXS = [
  {
    hash: "0x3b8c7d2e1f9a0042",
    from: "rstn1qz4a2f",
    to: "rstn1q9c1e8",
    value: "1,250.0",
    type: "Transfer",
    status: "success",
    block: 8471203,
    fee: "0.00021",
    shard: 12,
  },
  {
    hash: "0x7a9b3c4d5e6f0084",
    from: "rstn1qz2b3c4",
    to: "rstn1qz5d6e7",
    value: "32,000.0",
    type: "Stake",
    status: "success",
    block: 8471203,
    fee: "0.00018",
    shard: 12,
  },
  {
    hash: "0x1c2d3e4f5a6b0096",
    from: "rstn1q8f9a0b",
    to: "rstn1qz1c2d3",
    value: "0.0",
    type: "Contract",
    status: "success",
    block: 8471202,
    fee: "0.00045",
    shard: 7,
  },
  {
    hash: "0x5e6f7a8b9c0d0018",
    from: "rstn1qz3e4f5",
    to: "rstn1q6a7b8c",
    value: "450.0",
    type: "Transfer",
    status: "success",
    block: 8471202,
    fee: "0.00021",
    shard: 7,
  },
  {
    hash: "0x9a0b1c2d3e4f0027",
    from: "rstn1q4d5e6f",
    to: "rstn1qz9a0b1",
    value: "8,900.0",
    type: "Delegate",
    status: "success",
    block: 8471201,
    fee: "0.00019",
    shard: 24,
  },
  {
    hash: "0x2d3e4f5a6b7c0035",
    from: "rstn1q7e8f9a",
    to: "rstn1qz2b3c4",
    value: "0.0",
    type: "Contract",
    status: "failed",
    block: 8471201,
    fee: "0.00052",
    shard: 24,
  },
  {
    hash: "0x6b7c8d9e0f1a0048",
    from: "rstn1qz1a2b3",
    to: "rstn1q5c6d7e",
    value: "12,500.0",
    type: "Transfer",
    status: "success",
    block: 8471200,
    fee: "0.00021",
    shard: 45,
  },
  {
    hash: "0x0f1a2b3c4d5e0059",
    from: "rstn1q9e0f1a",
    to: "rstn1qz8b9c0",
    value: "0.0",
    type: "Governance",
    status: "success",
    block: 8471200,
    fee: "0.00033",
    shard: 45,
  },
  {
    hash: "0x4d5e6f7a8b9c0063",
    from: "rstn1q2c3d4e",
    to: "rstn1q7f8a9b",
    value: "3,200.0",
    type: "Transfer",
    status: "success",
    block: 8471199,
    fee: "0.00021",
    shard: 3,
  },
  {
    hash: "0x8b9c0d1e2f3a0074",
    from: "rstn1qz6d7e8",
    to: "rstn1q3a4b5c",
    value: "0.0",
    type: "Contract",
    status: "success",
    block: 8471199,
    fee: "0.00041",
    shard: 3,
  },
  {
    hash: "0xc3d4e5f6a7b80085",
    from: "rstn1q5e6f7a",
    to: "rstn1qz9d0e1",
    value: "67,000.0",
    type: "Unstake",
    status: "success",
    block: 8471198,
    fee: "0.00019",
    shard: 18,
  },
  {
    hash: "0x1e2f3a4b5c6d0097",
    from: "rstn1q8a9b0c",
    to: "rstn1qz4f5a6",
    value: "780.0",
    type: "Transfer",
    status: "success",
    block: 8471198,
    fee: "0.00021",
    shard: 18,
  },
] as const;

export const MOCK_VALIDATORS = [
  {
    rank: 1,
    address: "rstn1qz4a2f8c9d",
    stake: "2.4M",
    blocksProduced: 12482,
    uptime: "99.98%",
    commission: "5%",
    status: "active",
    shard: 12,
  },
  {
    rank: 2,
    address: "rstn1qz9c1e7b3a",
    stake: "2.1M",
    blocksProduced: 11987,
    uptime: "99.97%",
    commission: "7%",
    status: "active",
    shard: 7,
  },
  {
    rank: 3,
    address: "rstn1qz3d5f8a2c",
    stake: "1.9M",
    blocksProduced: 11023,
    uptime: "99.99%",
    commission: "3%",
    status: "active",
    shard: 24,
  },
  {
    rank: 4,
    address: "rstn1qz7b9e1d4f",
    stake: "1.7M",
    blocksProduced: 9847,
    uptime: "99.95%",
    commission: "10%",
    status: "active",
    shard: 45,
  },
  {
    rank: 5,
    address: "rstn1qz2a8c6f3d",
    stake: "1.5M",
    blocksProduced: 8901,
    uptime: "99.98%",
    commission: "5%",
    status: "active",
    shard: 3,
  },
  {
    rank: 6,
    address: "rstn1qz5e1b9c7a",
    stake: "1.3M",
    blocksProduced: 7623,
    uptime: "99.96%",
    commission: "8%",
    status: "active",
    shard: 18,
  },
  {
    rank: 7,
    address: "rstn1qz8d3f5a2e",
    stake: "1.1M",
    blocksProduced: 6890,
    uptime: "99.94%",
    commission: "6%",
    status: "active",
    shard: 56,
  },
  {
    rank: 8,
    address: "rstn1qz1c7b4e9f",
    stake: "985K",
    blocksProduced: 5432,
    uptime: "99.97%",
    commission: "4%",
    status: "active",
    shard: 31,
  },
  {
    rank: 9,
    address: "rstn1qz6f2a8d3c",
    stake: "870K",
    blocksProduced: 4128,
    uptime: "99.92%",
    commission: "9%",
    status: "active",
    shard: 9,
  },
  {
    rank: 10,
    address: "rstn1qz9a4e7b1f",
    stake: "760K",
    blocksProduced: 3876,
    uptime: "99.95%",
    commission: "5%",
    status: "active",
    shard: 42,
  },
] as const;

export const TX_TYPE_COLORS: Record<string, string> = {
  Transfer: "hsl(150 100% 45%)",
  Stake: "hsl(150 100% 45%)",
  Unstake: "hsl(150 60% 40%)",
  Delegate: "hsl(150 100% 55%)",
  Contract: "hsl(150 70% 50%)",
  Governance: "hsl(150 100% 55%)",
};

// ─── Public Protocol Information ────────────────────────────────────────────
export const PROTOCOL_LICENSE = {
  license: "Apache 2.0",
  repository: "A anunciarse",
  disclaimer:
    "RSTN es software experimental open-source. No es una inversión. No hay garantía de valor. Los tokens RSTN pueden perder todo su valor. La participación en staking implica riesgo de slashing. Las transacciones en blockchain son irreversibles. Úsalo bajo tu propio riesgo. Consulte asesoría legal sobre la clasificación del token en su jurisdicción.",
  patentClause:
    "Apache 2.0 incluye patente defensiva — contribuidores otorgan licencia de patente a los usuarios.",
} as const;

export const TOKEN_UTILITY = [
  {
    use: "Gas de transacciones",
    detail:
      "Cada transacción y ejecución de smart contract requiere RSTN como gas. Mecanismo de escasez: 50% del gas se quema permanentemente por transacción.",
  },
  {
    use: "Gobernanza on-chain",
    detail:
      "1 RSTN = 1 voto ponderado cuadráticamente. Los holders proponen y votan cambios de protocolo, parámetros de red y uso de tesorería.",
  },
  {
    use: "Staking de validadores",
    detail:
      "32,000 RSTN para ser validador. La seguridad económica de la red depende del stake total comprometido.",
  },
  {
    use: "Delegación líquida",
    detail:
      "Desde 1 RSTN, cualquier holder puede delegar a un validador y recibir recompensas proporcionales sin correr hardware.",
  },
] as const;

// ─── Documentation ───────────────────────────────────────────────────────────
export const DOC_SECTIONS = [
  { id: "quickstart", label: "Quick Start", icon: "Zap" },
  { id: "node", label: "Node Operators", icon: "Server" },
  { id: "sdk", label: "SDK & dApps", icon: "Code" },
  { id: "rpc", label: "JSON-RPC API", icon: "Terminal" },
  { id: "examples", label: "Ejemplos", icon: "FileCode" },
] as const;

export const QUICKSTART_STEPS = [
  {
    step: 1,
    title: "Instalar rstn-node",
    description: "Descarga el binario o usa Docker. Sin GPU, sin compilación.",
    code: `# Docker (recomendado)
docker pull rstn/node:latest
docker run -d --name rstn-node \\
  -p 31402:31402 \\
  -v rstn-data:/data \\
  rstn/node:latest --mainnet

# O binario nativo
curl -sSf https://rstn.network/install | sh`,
  },
  {
    step: 2,
    title: "Sincronizar con la red",
    description:
      "El nodo descarga el estado actual y se une al gossip protocol.",
    code: `# Verificar sincronización
rstn-node status

# Salida esperada:
# ✓ Sincronizado: Bloque #8,471,203
# ✓ Pares conectados: 47
# ✓ Shard asignado: 12
# ✓ Latencia promedio: 12ms`,
  },
  {
    step: 3,
    title: "Generar claves post-cuánticas",
    description: "Crea tu par de claves Dilithium3. Tu identidad en la red.",
    code: `# Generar keypair Dilithium3
rstn keys generate --scheme dilithium3

# Salida:
# Dirección: rstn1qz4a2f8c9d...
# Esquema: CRYSTAL-Dilithium3
# Clave pública: 1,952 bytes
# Clave privada: 4,000 bytes (guardar en seguro)`,
  },
  {
    step: 4,
    title: "Stakear y validar",
    description: "Deposita RSTN y comienza a producir bloques.",
    code: `# Stakear 32,000 RSTN
rstn stake --amount 32000

# Activar validador
resistance validator activate

# Monitorear
resistance validator status
# ✓ Estado: Activo
# ✓ Bloques producidos: 1,248
# ✓ Recompensas: 412.5 RSTN`,
  },
] as const;

export const SDK_INFO = [
  {
    name: "TypeScript SDK",
    install: "npm install @rstn/sdk",
    description:
      "Cliente completo para dApps: firmas Dilithium3, RPC, smart contracts.",
    features: [
      "Firmas post-cuánticas nativas",
      "RPC WebSocket",
      "ABI compiler",
      "Wallet adapter",
    ],
    code: `import { RstnClient } from "@rstn/sdk";

const client = new RstnClient("https://rpc.rstn.network");

// Send transaction with Dilithium3 signature
const tx = await client.sendTransaction({
  to: "rstn1qz9c1e7b3a...",
  amount: 1250,
  gasLimit: 21000,
});

console.log(tx.hash); // 0x3b8c7d2e...`,
  },
  {
    name: "Rust SDK",
    install: "cargo add rstn-sdk",
    description:
      "Para integración nativa en nodos, bridges y servicios backend.",
    features: [
      "Async runtime (tokio)",
      "Serialización borsh",
      "P2P directo",
      "Zero-copy",
    ],
    code: `use rstn_sdk::Client;

#[tokio::main]
async fn main() {
    let client = Client::connect("rpc.rstn.network").await?;
    
    let balance = client.get_balance("rstn1qz4a2f...").await?;
    println!("Balance: {} RSTN", balance);
    
    let tx = client.transfer("rstn1qz9c...", 1250).await?;
    println!("TX: {}", tx.hash);
}`,
  },
  {
    name: "RSTN-VM (Smart Contracts)",
    install: "rstn deploy --contract",
    description:
      "Subconjunto EVM + recursos lineales estilo Move. Sin fricción.",
    features: [
      "Solidity+ compatible",
      "Move-style resources",
      "Ejecución paralela",
      "Access lists",
    ],
    code: `// Solidity+ en RSTN-VM
pragma solidity ^0.8.24;

contract Token {
    mapping(address => uint256) public balances;
    
    function transfer(address to, uint256 amount) external {
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}

// Deploy
rstn deploy Token.sol --shard 12`,
  },
] as const;

export const RPC_METHODS = [
  // ── Network ──────────────────────────────────────────
  {
    method: "rstn_health",
    params: "—",
    returns: "boolean",
    description: "Health check del nodo — true si está operativo",
  },
  {
    method: "rstn_getNetworkStats",
    params: "—",
    returns: "NetworkStats",
    description:
      "Estadísticas globales: TPS, finalidad, validadores, shards, altura",
  },

  // ── Explorer ─────────────────────────────────────────
  {
    method: "rstn_getExplorerStats",
    params: "—",
    returns: "ExplorerStats",
    description: "Stats del explorer: altura actual, tx pool, peers, uptime",
  },
  {
    method: "rstn_getLatestBlocks",
    params: "limit?: u32",
    returns: "BlockInfo[]",
    description: "Últimos N bloques (default 10)",
  },
  {
    method: "rstn_getBlockByHeight",
    params: "height: u64",
    returns: "BlockInfo",
    description: "Bloque por altura exacta",
  },
  {
    method: "rstn_getLatestTransactions",
    params: "limit?: u32",
    returns: "TxInfo[]",
    description: "Últimas N transacciones confirmadas",
  },
  {
    method: "rstn_getTransactionByHash",
    params: "hash: string",
    returns: "TxInfo",
    description: "Transacción por hash (hex)",
  },
  {
    method: "rstn_getTopValidators",
    params: "limit?: u32",
    returns: "ValidatorInfo[]",
    description: "Top validadores por stake",
  },

  // ── Wallet & Balance ─────────────────────────────────
  {
    method: "rstn_getBalance",
    params: "address: rstn1...",
    returns: "BalanceInfo",
    description: "Balance, stake delegado, recompensas y APY de una dirección",
  },
  {
    method: "rstn_getStakingValidators",
    params: "—",
    returns: "Validator[]",
    description: "Lista de validadores activos para delegación",
  },
  {
    method: "rstn_getProposals",
    params: "—",
    returns: "Proposal[]",
    description: "Propuestas de gobernanza activas y pasadas",
  },

  // ── Transactions ─────────────────────────────────────
  {
    method: "rstn_sendTransaction",
    params: "tx: SignedTx",
    returns: "Hash",
    description: "Envía una transacción firmada con Dilithium3 al mempool",
  },

  // ── Staking ──────────────────────────────────────────
  {
    method: "rstn_stake",
    params: "{ address, amount }",
    returns: "TxHash",
    description: "Bloquea RSTN como stake de validador (mín 32,000)",
  },
  {
    method: "rstn_unstake",
    params: "{ address, amount }",
    returns: "TxHash",
    description: "Retira stake (sujeto a unbonding de 1 época)",
  },
  {
    method: "rstn_delegate",
    params: "{ address, validator, amount }",
    returns: "TxHash",
    description: "Delega RSTN a un validador (mín 1 RSTN)",
  },
  {
    method: "rstn_undelegate",
    params: "{ address, validator, amount }",
    returns: "TxHash",
    description: "Retira delegación de un validador",
  },
  {
    method: "rstn_claimRewards",
    params: "{ address }",
    returns: "TxHash",
    description: "Reclama recompensas acumuladas de staking/delegación",
  },
  {
    method: "rstn_getStakingInfo",
    params: "address: rstn1...",
    returns: "StakingInfo",
    description: "Info detallada de staking de una dirección",
  },

  // ── Faucet (testnet) ──────────────────────────────────
  {
    method: "rstn_faucetClaim",
    params: "{ address: rstn1... }",
    returns: "{ success, amount, txHash }",
    description: "Reclama 1,000 RSTN de testnet (rate-limit: 1 por hora)",
  },
] as const;

export const CODE_EXAMPLES = [
  {
    title: "Generar wallet y consultar balance",
    language: "TypeScript",
    code: `import { RstnClient, RstnWallet } from "@rstn/sdk";

// 1. Generate post-quantum wallet (Dilithium3)
const wallet = RstnWallet.generate();
console.log("Address:", wallet.address); // rstn1...

// 2. Conectar al nodo
const client = new RstnClient("http://localhost:9944");
const healthy = await client.health(); // true

// 3. Consultar balance
const balance = await client.getBalance(wallet.address);
console.log("Balance:", balance.balance, "RSTN");
console.log("Rewards:", balance.rewards, "RSTN");`,
  },
  {
    title: "Enviar una transacción firmada",
    language: "TypeScript",
    code: `import { RstnClient, RstnWallet, TransactionBuilder } from "@rstn/sdk";

const client = new RstnClient("http://localhost:9944");
const wallet = RstnWallet.generate();

// 1. Build transaction
const tx = TransactionBuilder.transfer(
  "rstn1recipient...",  // destination address
  "1000000000",          // 1 RSTN (9 decimales)
  0                      // nonce
);

// 2. Firmar con Dilithium3 (3309 bytes)
const signed = await wallet.signTx(tx);

// 3. Enviar al nodo
const nodeTx = RstnWallet.toNodeFormat(signed);
const hash = await client.sendTransaction(nodeTx);
console.log("Tx hash:", hash);`,
  },
  {
    title: "Delegar stake a un validador",
    language: "TypeScript",
    code: `import { RstnClient, RstnWallet, TransactionBuilder } from "@rstn/sdk";

const client = new RstnClient("http://localhost:9944");
const wallet = RstnWallet.generate();

// 1. Ver validadores disponibles
const validators = await client.getTopValidators(10);
const best = validators[0]; // top por stake

// 2. Build delegation
const tx = TransactionBuilder.stake(
  best.address,   // validator
  "5000000000",   // 5,000 RSTN
  0               // nonce
);

// 3. Firmar y enviar
const signed = await wallet.signTx(tx);
const hash = await client.sendTransaction(
  RstnWallet.toNodeFormat(signed)
);
console.log("Delegated:", hash);`,
  },
  {
    title: "Reclamar del faucet de testnet",
    language: "JSON-RPC",
    code: `// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "rstn_faucetClaim",
  "params": [{ "address": "rstn1a3f5b7c9d1e2f3a4b5c6d7e8f9" }]
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "amount": "1000000000000",
    "txHash": "0x7f3a9b..."
  }
}`,
  },
] as const;

// ─── Staking + Wallet UI ────────────────────────────────────────────────────
export const WALLET_PORTFOLIO = {
  address: "rstn1qz4a2f8c9d3e7b",
  balance: "48,250.5",
  staked: "32,000.0",
  delegated: "16,000.0",
  rewards: "412.5",
  apy: "Variable",
  pendingRewards: "18.3",
} as const;

export const STAKING_VALIDATORS = [
  {
    address: "rstn1qz4a2f8c9d",
    name: "Quantum-Node",
    stake: "2.4M",
    apy: "Variable",
    uptime: "99.98%",
    commission: "5%",
    shard: 12,
    delegated: true,
  },
  {
    address: "rstn1qz9c1e7b3a",
    name: "RSTN-Validator",
    stake: "2.1M",
    apy: "Variable",
    uptime: "99.97%",
    commission: "7%",
    shard: 7,
    delegated: false,
  },
  {
    address: "rstn1qz3d5f8a2c",
    name: "PostQuantum-Pool",
    stake: "1.9M",
    apy: "Variable",
    uptime: "99.99%",
    commission: "3%",
    shard: 24,
    delegated: false,
  },
  {
    address: "rstn1qz7b9e1d4f",
    name: "ShardKeeper",
    stake: "1.7M",
    apy: "Variable",
    uptime: "99.95%",
    commission: "10%",
    shard: 45,
    delegated: false,
  },
  {
    address: "rstn1qz2a8c6f3d",
    name: "Dilithium-Node",
    stake: "1.5M",
    apy: "Variable",
    uptime: "99.98%",
    commission: "5%",
    shard: 3,
    delegated: false,
  },
] as const;

export const GOVERNANCE_PROPOSALS = [
  {
    id: "NIP-001",
    title: "Activar 64 shards en mainnet",
    status: "Votación activa",
    votesFor: 72,
    votesAgainst: 18,
    turnout: "34.2%",
    endsIn: "2d 14h",
    description:
      "Propone la activación completa de los 64 shards dinámicos en el bloque 9,000,000.",
  },
  {
    id: "NIP-002",
    title: "Reducir comisión máxima de validadores a 10%",
    status: "Votación activa",
    votesFor: 61,
    votesAgainst: 29,
    turnout: "28.7%",
    endsIn: "5d 02h",
    description:
      "Establece un techo de 10% en la comisión que los validadores pueden cobrar a sus delegadores.",
  },
  {
    id: "NIP-003",
    title: "Programa de bug bounty — $500K",
    status: "Aprobado",
    votesFor: 89,
    votesAgainst: 4,
    turnout: "52.1%",
    endsIn: "Finalizado",
    description:
      "Asigna $500K de la tesorería para un programa de bug bounty con recompensas escalonadas.",
  },
] as const;

export const STAKING_ACTIONS = [
  {
    action: "Stake",
    description: "Bloquea RSTN para asegurar la red y producir bloques",
    minAmount: "32,000 RSTN",
    icon: "Lock",
    color: "hsl(150 100% 45%)",
  },
  {
    action: "Delegate",
    description: "Delega tu RSTN a un validador sin correr hardware",
    minAmount: "1 RSTN",
    icon: "Users",
    color: "hsl(150 100% 55%)",
  },
  {
    action: "Unstake",
    description: "Retira tu stake. Sujeto a período de unbonding de 1 época",
    minAmount: "—",
    icon: "Unlock",
    color: "hsl(150 100% 45%)",
  },
  {
    action: "Claim",
    description: "Reclama recompensas acumuladas de staking y delegación",
    minAmount: "—",
    icon: "Coins",
    color: "hsl(150 70% 50%)",
  },
] as const;

// ─── Developer Portal ──────────────────────────────────────────────────────
export const DEV_PORTAL = {
  title: "Construir en RSTN",
  subtitle:
    "Todo lo que necesitas para lanzar dApps, operar nodos y construir sobre la primera Layer 1 post-cuántica.",
  endpoints: {
    rpc: "https://rpc.rstn.network",
    ws: "wss://ws.rstn.network",
    testnetRpc: "https://rpc-testnet.rstn.network",
    faucet: "https://faucet.rstn.network",
    explorer: "https://explorer.rstn.network",
  },
} as const;

export const DEV_TRACKS = [
  {
    id: "beginner",
    level: "Principiante",
    title: "Tu primera dApp en RSTN",
    description:
      "Sin experiencia previa con blockchain. Aprende los conceptos básicos y lanza tu primer contrato.",
    duration: "~30 min",
    steps: [
      {
        title: "Instalar el SDK",
        detail: "npm install @rstn/sdk — un solo paquete, incluye todo.",
      },
      {
        title: "Conectar a testnet",
        detail:
          "Configura el endpoint RPC de testnet. Faucet automático de RSTN de prueba.",
      },
      {
        title: "Desplegar un contrato",
        detail:
          "Escribe un contrato simple en Solidity+ y despliégalo en 1 comando.",
      },
      {
        title: "Interactuar desde frontend",
        detail: "Conecta tu dApp al SDK. Lee y escribe estado on-chain.",
      },
    ],
    color: "hsl(150 100% 45%)",
  },
  {
    id: "intermediate",
    level: "Intermedio",
    title: "DeFi y smart contracts avanzados",
    description:
      "Ya sabes Solidity. Aprende las extensiones de RSTN-VM y construye protocolos DeFi.",
    duration: "~2 horas",
    steps: [
      {
        title: "RSTN-VM vs EVM",
        detail:
          "RSTN-VM ejecuta un subconjunto de opcodes EVM (0x00–0xEF) con extensiones PQ (OP_VALID_SIG). No es 100% idéntico a Ethereum: usa Keccak-512 para hashes/addresses y firmas Dilithium3, por lo que los contratos Solidity requieren recompilar y adaptar el direccionamiento. Diferencias: ejecución paralela opcional con access lists y verificación de firmas post-cuántica.",
      },
      {
        title: "Access Lists (opcional)",
        detail:
          "Declarar acceso a estado para ejecución paralela sin conflictos. Opcional — los contratos que no declaran access lists se ejecutan secuencialmente como en EVM estándar.",
      },
      {
        title: "Firmas post-cuánticas en contracts",
        detail:
          "Usar OP_VALID_SIG (0xF0) para verificar firmas Dilithium3 dentro de smart contracts. Account abstraction con claves PQ.",
      },
      {
        title: "Cross-shard comms",
        detail:
          "Enviar mensajes entre shards con lock-and-commit (atomicidad garantizada) y receipts asíncronos.",
      },
    ],
    color: "hsl(150 100% 45%)",
  },
  {
    id: "advanced",
    level: "Avanzado",
    title: "Infraestructura y node operation",
    description:
      "Para equipos que quieren operar infraestructura. Nodos, indexers, bridges.",
    duration: "~4 horas",
    steps: [
      {
        title: "Compilar rstn-node",
        detail: "Build from source en Rust. Configura para mainnet o testnet.",
      },
      {
        title: "Operar validador",
        detail:
          "Stake, slashing protection, monitoring con Prometheus + Grafana.",
      },
      {
        title: "Indexer propio",
        detail:
          "Construye un indexer con suscripciones WebSocket y base de datos.",
      },
      {
        title: "Bridge IBC",
        detail:
          "Operar un relayer IBC post-cuántico entre RSTN y otras chains.",
      },
    ],
    color: "hsl(150 100% 55%)",
  },
] as const;

export const DEV_TOOLS = [
  {
    name: "rstn-cli",
    category: "CLI",
    description:
      "Herramienta de línea de comandos para generar claves, inicializar génesis y ejecutar nodos.",
    install: "cargo install rstn-node --locked",
    icon: "Terminal",
    status: "available",
  },
  {
    name: "@rstn/sdk",
    category: "TypeScript",
    description:
      "SDK TypeScript: RstnClient (JSON-RPC), RstnWallet (Dilithium3), TransactionBuilder, RstnWallet.toNodeFormat().",
    install: "npm install @rstn/sdk",
    icon: "Code",
    status: "available",
  },
  {
    name: "rstn-node",
    category: "Rust",
    description:
      "Workspace Rust con 7 crates: core, crypto, p2p, storage, vm, rpc, node. Compila y funciona.",
    install: "git clone resistance/rstn-node && cargo build --release",
    icon: "Box",
    status: "available",
  },
  {
    name: "rstn-explorer",
    category: "Web",
    description:
      "Block explorer integrado en el terminal. Búsqueda de bloques, txs, validadores y contratos.",
    install: "Ver pestaña 'Explorer' en el terminal",
    icon: "Search",
    status: "available",
  },
  {
    name: "rstn-faucet",
    category: "Testnet",
    description:
      "Faucet RPC para testnet. rstn_faucetClaim con dirección rstn1 → recibe 1,000 RSTN.",
    install: 'RPC: rstn_faucetClaim({ address: "rstn1..." })',
    icon: "Droplet",
    status: "available",
  },
  {
    name: "rstn-monitor",
    category: "DevOps",
    description:
      "Dashboard de monitoreo con Prometheus + Grafana para validadores.",
    install: "docker compose up rstn-monitor",
    icon: "Activity",
    status: "planned",
  },
] as const;

export const PLAYGROUND_CONTRACTS = [
  {
    id: "token",
    name: "Token ERC-20",
    description: "Contrato de token fungible estándar con supply controlado.",
    language: "Solidity+",
    code: `pragma solidity ^0.8.24;

contract RstnToken {
    string public name = "RstnToken";
    string public symbol = "NTK";
    uint256 public totalSupply;
    mapping(address => uint256) public balances;
    
    event Transfer(address indexed from, address indexed to, uint256 amount);
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}`,
  },
  {
    id: "vault",
    name: "Vault de Staking",
    description:
      "Bóveda de staking con recompensas distribuidas proporcionalmente.",
    language: "Solidity+",
    code: `pragma solidity ^0.8.24;

contract StakingVault {
    mapping(address => uint256) public stakes;
    uint256 public totalStaked;
    uint256 public rewardPerToken;
    
    function stake() external payable {
        stakes[msg.sender] += msg.value;
        totalStaked += msg.value;
    }
    
    function withdraw(uint256 amount) external {
        require(stakes[msg.sender] >= amount);
        stakes[msg.sender] -= amount;
        totalStaked -= amount;
        payable(msg.sender).transfer(amount);
    }
}`,
  },
  {
    id: "governance",
    name: "Gobernanza On-Chain",
    description: "Sistema de votación cuadrática para propuestas de protocolo.",
    language: "Solidity+",
    code: `pragma solidity ^0.8.24;

contract QuadraticVoting {
    struct Proposal {
        string title;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
    }
    
    Proposal[] public proposals;
    mapping(address => uint256) public votingPower;
    
    function vote(uint256 proposalId, bool support, uint256 weight) external {
        require(votingPower[msg.sender] >= weight * weight);
        votingPower[msg.sender] -= weight * weight;
        
        if (support) {
            proposals[proposalId].votesFor += weight;
        } else {
            proposals[proposalId].votesAgainst += weight;
        }
    }
}`,
  },
] as const;

export const DEV_RESOURCES = [
  {
    title: "Whitepaper técnico v1.0",
    description:
      "Especificación completa del protocolo: consenso, criptografía, sharding.",
    type: "PDF",
    icon: "FileText",
  },
  {
    title: "Especificación de RSTN-VM",
    description:
      "Opcodes, access lists, ejecución paralela y recursos estilo Move.",
    type: "Docs",
    icon: "BookOpen",
  },
  {
    title: "Referencia JSON-RPC API",
    description: "Todos los endpoints RPC con parámetros y respuestas.",
    type: "Docs",
    icon: "Terminal",
  },
  {
    title: "Guía de node operators",
    description:
      "Instalación, configuración, monitoring y slashing protection.",
    type: "Guide",
    icon: "Server",
  },
  {
    title: "Programa de grants",
    description: "Funding para dApps, herramientas e infraestructura.",
    type: "Program",
    icon: "Award",
  },
  {
    title: "Bug bounty",
    description: "Recompensas por vulnerabilidades reportadas.",
    type: "Program",
    icon: "Bug",
  },
] as const;

// ─── SDK Reference — Clases y tipos reales de @rstn/sdk ─────────────────────
export const SDK_REFERENCE = [
  {
    class: "RstnClient",
    description: "Cliente JSON-RPC 2.0 para conectar al nodo RSTN.",
    methods: [
      {
        name: "new RstnClient(endpoint, timeout?)",
        returns: "RstnClient",
        description: "Constructor. Default: http://localhost:9944, timeout 10s",
      },
      {
        name: "health()",
        returns: "Promise<boolean>",
        description: "Health check del nodo",
      },
      {
        name: "getNetworkStats()",
        returns: "Promise<NetworkStats>",
        description: "TPS, finalidad, validadores, shards, altura",
      },
      {
        name: "getLatestBlocks(limit?)",
        returns: "Promise<BlockInfo[]>",
        description: "Últimos N bloques (default 10)",
      },
      {
        name: "getBlockByHeight(height)",
        returns: "Promise<BlockInfo | null>",
        description: "Bloque por altura",
      },
      {
        name: "getLatestTransactions(limit?)",
        returns: "Promise<TxInfo[]>",
        description: "Últimas N transacciones",
      },
      {
        name: "getTransactionByHash(hash)",
        returns: "Promise<TxInfo | null>",
        description: "Transacción por hash hex",
      },
      {
        name: "getTopValidators(limit?)",
        returns: "Promise<ValidatorInfo[]>",
        description: "Top validadores por stake",
      },
      {
        name: "getBalance(address)",
        returns: "Promise<BalanceInfo>",
        description: "Balance, staked, delegated, rewards, apy",
      },
      {
        name: "sendTransaction(signedTx)",
        returns: "Promise<string>",
        description: "Envía tx firmada al mempool. Retorna hash hex",
      },
    ],
  },
  {
    class: "RstnWallet",
    description:
      "Wallet post-cuántica con firmas Dilithium3 (ML-DSA-65, FIPS 204).",
    methods: [
      {
        name: "RstnWallet.generate()",
        returns: "RstnWallet",
        description:
          "Genera keypair Dilithium3 aleatorio. Clave privada cifrada en memoria.",
      },
      {
        name: "RstnWallet.deriveAddress(pubKey)",
        returns: "string",
        description:
          "Deriva dirección rstn1... de una clave pública (Keccak-512 → últimos 20 bytes)",
      },
      {
        name: "wallet.signTx(unsignedTx)",
        returns: "Promise<SignedTransaction>",
        description: "Firma transacción con Dilithium3. Signature: 3309 bytes",
      },
      {
        name: "RstnWallet.toNodeFormat(signedTx)",
        returns: "Record<string, unknown>",
        description:
          "Convierte tx firmada al formato JSON-RPC del nodo (arrays de bytes)",
      },
      {
        name: "RstnWallet.verifySignature(pubKey, msg, sig)",
        returns: "boolean",
        description: "Verifica una firma Dilithium3",
      },
    ],
  },
  {
    class: "TransactionBuilder",
    description: "Constructor de transacciones tipadas.",
    methods: [
      {
        name: "TransactionBuilder.transfer(to, value, nonce)",
        returns: "UnsignedTransaction",
        description: "Transferencia simple. Gas: 21000, gasPrice: 1 Gwei",
      },
      {
        name: "TransactionBuilder.stake(validator, value, nonce)",
        returns: "UnsignedTransaction",
        description: "Stake de validador (mín 32,000 RSTN). Gas: 50000",
      },
      {
        name: "TransactionBuilder.unstake(validator, value, nonce)",
        returns: "UnsignedTransaction",
        description: "Retirar stake. Gas: 50000",
      },
    ],
  },
] as const;

// ─── Wallet Integration — How to connect the RSTN extension ────────────────
export const WALLET_INTEGRATION = {
  title: "Integrar RSTN Wallet en tu dApp",
  description:
    "La extensión RSTN Wallet inyecta window.rstn en la página. Las dApps lo detectan para conectar, firmar y enviar transacciones post-cuánticas.",
  steps: [
    {
      step: 1,
      title: "Detectar la wallet",
      code: `// Check if the RSTN extension is installed
if (typeof window.rstn !== 'undefined') {
  console.log('RSTN Wallet detected');
  // window.rstn.isRstn === true
}`,
    },
    {
      step: 2,
      title: "Conectar la wallet",
      code: `// Ask the user for permission to connect
const result = await window.rstn.connect();
// The wallet popup asks for approval
// result: { address: "rstn1...", publicKey: "0x..." }
console.log('Connected:', result.address);`,
    },
    {
      step: 3,
      title: "Firmar y enviar transacción",
      code: `// The wallet signs internally with Dilithium3
const tx = {
  to: 'rstn1recipient...',
  value: '1000000000',  // 1 RSTN
  nonce: 0,
  gasPrice: '1000000000',
  gasLimit: 21000,
  txType: 'transfer',
  payload: '0x'
};

const signedTx = await window.rstn.signTransaction(tx);
const hash = await window.rstn.sendTransaction(signedTx);
console.log('Hash:', hash);`,
    },
  ],
  differences: [
    {
      feature: "Clave",
      metamask: "secp256k1 (64 bytes)",
      rstn: "Dilithium3 (1952 bytes pub, 4032 bytes priv)",
    },
    {
      feature: "Firma",
      metamask: "ECDSA (64 bytes)",
      rstn: "ML-DSA-65 (3309 bytes)",
    },
    {
      feature: "Dirección",
      metamask: "0x... (20 bytes)",
      rstn: "rstn1... (20 bytes)",
    },
    {
      feature: "Estándar",
      metamask: "EIP-1193",
      rstn: "RSTN Provider API (window.rstn)",
    },
    {
      feature: "Resistencia cuántica",
      metamask: "Vulnerable a Shor",
      rstn: "Resistente (NIST FIPS 204)",
    },
  ],
} as const;

// ─── Genesis Distribution Detail — How 1B RSTN is distributed without ICO ───
export const GENESIS_DETAIL = {
  totalSupply: "1,000,000,000 RSTN",
  principle:
    "Todos los tokens existen desde el bloque génesis. No se crean nuevos. No se venden. Se distribuyen por trabajo y participación. El equipo no tiene bucket reservado — gana RSTN operando el validador génesis (modelo Satoshi).",
  noIco:
    "Cero ICO. Cero pre-venta. Cero VC. Cero venta de tokens en cualquier forma. Cero asignación de equipo.",
  allocations: [
    {
      bucket: "Proof of Participation (Staking pool)",
      amount: "950,000,000 RSTN (95%)",
      mechanism:
        "Snapshot de participación en testnet. Ejecutaste nodo, contribuíste código, auditaste, documentaste → recibes RSTN proporcional al trabajo. El equipo opera el validador génesis y gana desde este bucket por ser el primero en hacer el trabajo de bootstrap (modelo Satoshi). La distribución se libera con halving cada 4 años (no se entrega toda de una vez). Modelo Satoshi puro: 0% reservado, 95% se gana por trabajo.",
      legal: "No es venta. Es recompensa por trabajo verificable.",
    },
    {
      bucket: "Airdrop Testnet (Semilla de arranque)",
      amount: "50,000,000 RSTN (5%)",
      mechanism:
        "Único bucket pre-asignado: semilla entregada una sola vez a quienes corrieron nodos de testnet (trabajo verificado). Equivalente PoS a los primeros mineros de Satoshi. No transferible a fundadores. Sin ecosystem fund, sin treasury capturable.",
      legal: "Recompensa por participación verificable, no inversión.",
    },
  ],
  genesisBlock: {
    description:
      "El bloque génesis contiene el estado inicial completo: todas las asignaciones, los parámetros de consenso y los seed nodes. No hay contrato de vesting del equipo — el equipo no tiene bucket reservado.",
    hash: "Calculado al lanzar — contiene Merkle root de todas las asignaciones",
    auditability:
      "Cualquiera puede verificar que el génesis respeta la distribución anunciada. El Merkle root prueba que no se crearon tokens extra ni se reservó bucket de equipo.",
  },
} as const;

// ─── Validator On-Chain Registration Process ────────────────────────────────
export const VALIDATOR_REGISTRATION = {
  principle:
    "Sin permisos. Sin KYC. Sin aprobación. Cualquiera con 32,000 RSTN puede registrarse.",
  steps: [
    {
      step: 1,
      title: "Generar claves de validador",
      action: "rstn keys generate --validator --dilithium3",
      detail:
        "Genera 3 pares de claves: (1) Clave de firma de bloques (Dilithium3), (2) Clave de red P2P (Ed25519), (3) Clave de consenso (Lattice-VRF). Todas post-cuánticas.",
      onChain: false,
    },
    {
      step: 2,
      title: "Enviar transacción de registro",
      action: "resistance validator register --stake 32000 --fee 0.001",
      detail:
        "Transacción on-chain que bloquea 32,000 RSTN como stake. Incluye la clave pública del validador, la clave de consenso y la dirección de recompensas. El stake queda bloqueado en el contrato de staking.",
      onChain: true,
    },
    {
      step: 3,
      title: "Esperar activación (1 época)",
      action: "Espera ~6 minutos (1 época = 1,800 bloques × 200ms)",
      detail:
        "El registro entra en vigor en la próxima época. Esto previene ataques de sybil instantáneos. Durante la espera, el nodo sincroniza el estado completo.",
      onChain: true,
    },
    {
      step: 4,
      title: "Activar el validador",
      action: "resistance validator activate",
      detail:
        "El nodo comienza a ser seleccionado por el VRF post-cuántico. Produce bloques cuando es elegido. Firma con Dilithium3. Recibe recompensas variables por bloque producido.",
      onChain: true,
    },
    {
      step: 5,
      title: "Mantener uptime > 90%",
      action: "resistance validator status --monitor",
      detail:
        "Si el validador cae por debajo de 90% de uptime en una época, se aplica slashing proporcional (0.1% del stake). Si firma bloques conflictivos (double-sign), slashing severo (5% del stake). El stake nunca se pierde completo — slashing es proporcional, no destructivo.",
      onChain: true,
    },
  ],
  slashingMatrix: [
    {
      offense: "Downtime (< 90% uptime en época)",
      penalty: "0.1% del stake",
      severity: "Leve",
      recoverable: "Sí — recupera en próxima época con uptime normal",
    },
    {
      offense: "Firma de bloque inválido",
      penalty: "1% del stake",
      severity: "Moderado",
      recoverable: "Sí — después de 3 épocas sin incidentes",
    },
    {
      offense: "Double-sign (equivocación)",
      penalty: "5% del stake",
      severity: "Severo",
      recoverable: "No — el validador es forzado a unbond",
    },
    {
      offense: "Ataque de consenso coordinado",
      penalty: "10% del stake + expulsión",
      severity: "Crítico",
      recoverable: "No — expulsión permanente",
    },
  ],
  unbonding: {
    period: "1 época (~6 minutos)",
    description:
      "Para retirar el stake, el validador envía una transacción de unbonding. El stake queda en unbonding por 1 época. Después, los 32,000 RSTN + recompensas son transferibles. Esto previene long-range attacks.",
  },
} as const;

// ─── Early Validator Incentives (detailed version for NodesView) ─────────────
// COLD_START_BOOTSTRAP.earlyValidatorIncentives has the summarized version.
export const EARLY_VALIDATOR_INCENTIVES = {
  principle:
    "Los primeros validadores asumen más riesgo. La red tiene menos seguridad económica al inicio. Se les compensa con un bonus de participación que decae con el tiempo.",
  phases: [
    {
      phase: "Génesis — Primeros 100 validadores",
      bonus: "2× recompensas de bloque",
      duration: "Primeras 10,000 épocas (~41 días)",
      rationale:
        "La red arranca con 500 validadores verificados en testnet. Los primeros 100 asumen el máximo riesgo. Bonus 2× atrae capital temprano.",
      cap: "Máximo 100 validadores con bonus 2×. Una vez lleno, el bonus baja a 1.5×.",
    },
    {
      phase: "Validadores 101-500",
      bonus: "1.5× recompensas de bloque",
      duration: "Primeras 20,000 épocas (~83 días)",
      rationale:
        "La red crece hacia 500 validadores. El riesgo disminuye pero sigue elevado. Bonus 1.5× mantiene el atractivo.",
      cap: "Máximo 400 validadores en este tier.",
    },
    {
      phase: "Validadores 501-4,128",
      bonus: "1.25× recompensas de bloque",
      duration: "Primeras 30,000 épocas (~125 días)",
      rationale:
        "La red crece hacia 4,128 validadores objetivo. El bonus decae gradualmente.",
      cap: "Sin límite en este tier — crecimiento orgánico.",
    },
    {
      phase: "Validadores 4,129+",
      bonus: "1× recompensas de bloque (estándar)",
      duration: "Permanente",
      rationale:
        "La red está suficientemente descentralizada. No hay bonus. Recompensas estándar sostenidas por fees + reserva.",
      cap: "Sin límite — cualquiera puede unirse.",
    },
  ],
  antiWhale:
    "El bonus es por validador, no por stake. Un validador con 100K RSTN recibe el mismo bonus que uno con 32K RSTN. Esto previene que ballenas acaparen el bonus.",
  sunset:
    "Todos los bonuses decaen a 1× en ~125 días. Después, la economía es puramente de fees + reserva. No hay inflación oculta.",
} as const;

// ─── Non-Technical Onboarding Wizard ────────────────────────────────────────
export const ONBOARDING_WIZARD = {
  principle:
    "Un usuario sin conocimientos técnicos puede participar en RSTN en 4 pasos. Sin instalar nada, sin tocar la línea de comandos.",
  steps: [
    {
      step: 1,
      title: "Crear wallet",
      description:
        "Descarga la extensión RSTN Wallet para Chrome/Firefox. Genera tu dirección RSTN post-cuántica. Guarda tu seed phrase de 12 palabras en un lugar seguro.",
      action: "Instalar extensión del navegador",
      technical: false,
      time: "2 minutos",
    },
    {
      step: 2,
      title: "Recibir RSTN",
      description:
        "Compra RSTN en un exchange listado o recíbelo de otro usuario. Transfiere a tu wallet RSTN. La primera transferencia confirma que tu wallet funciona.",
      action: "Transferir RSTN a tu wallet",
      technical: false,
      time: "5 minutos",
    },
    {
      step: 3,
      title: "Elegir nivel de participación",
      description:
        "Delegador (1 RSTN mínimo, sin hardware) o Validador (32,000 RSTN + VPS). La mayoría elige delegador — delegas tu RSTN a un validador y recibes recompensas proporcionales.",
      action: "Delegar a un validador",
      technical: false,
      time: "3 minutos",
    },
    {
      step: 4,
      title: "Monitorear recompensas",
      description:
        "Tu wallet muestra recompensas acumuladas en tiempo real. Puedes reclamar cuando quieras. Las recompensas son variables — dependen del rendimiento de la red, no están garantizadas.",
      action: "Reclamar recompensas",
      technical: false,
      time: "Instantáneo",
    },
  ],
  noCode:
    "Cero comandos. Cero terminal. Cero Docker. Todo desde la extensión del navegador.",
} as const;

// ─── Node Monitoring Dashboard ──────────────────────────────────────────────
export const NODE_MONITORING = {
  principle:
    "Cada nodo expone métricas en tiempo real vía Prometheus en el puerto 9090. El dashboard del terminal muestra las métricas clave.",
  metrics: [
    {
      name: "Bloque actual",
      key: "rstn_block_height",
      description: "Altura del último bloque sincronizado",
      unit: "bloque",
      healthy: "Creciendo continuamente",
    },
    {
      name: "Pares conectados",
      key: "rstn_p2p_peers",
      description: "Número de nodos conectados vía gossip",
      unit: "nodos",
      healthy: "> 30",
    },
    {
      name: "Latencia P2P",
      key: "rstn_p2p_latency_ms",
      description: "Latencia promedio a pares",
      unit: "ms",
      healthy: "< 100ms",
    },
    {
      name: "Bloques producidos",
      key: "rstn_validator_blocks_produced",
      description: "Bloques producidos por este validador",
      unit: "bloques",
      healthy: "Creciendo por época",
    },
    {
      name: "Uptime",
      key: "rstn_validator_uptime",
      description: "Porcentaje de uptime en la época actual",
      unit: "%",
      healthy: "> 99%",
    },
    {
      name: "Stake efectivo",
      key: "rstn_validator_effective_stake",
      description: "Stake activo incluyendo delegaciones",
      unit: "RSTN",
      healthy: "≥ 32,000",
    },
    {
      name: "Recompensas acumuladas",
      key: "rstn_validator_rewards",
      description: "Recompensas no reclamadas",
      unit: "RSTN",
      healthy: "Creciendo",
    },
    {
      name: "Uso de CPU",
      key: "rstn_resource_cpu",
      description: "CPU usada por el nodo",
      unit: "%",
      healthy: "< 70%",
    },
    {
      name: "Uso de RAM",
      key: "rstn_resource_ram",
      description: "RAM usada por el nodo",
      unit: "%",
      healthy: "< 80%",
    },
    {
      name: "Disco usado",
      key: "rstn_resource_disk",
      description: "Almacenamiento del ledger",
      unit: "GB",
      healthy: "< 100GB",
    },
  ],
  alerts: [
    {
      level: "Crítico",
      condition: "Pares < 10",
      action: "Verificar conexión a internet y firewall. Reiniciar nodo.",
    },
    {
      level: "Crítico",
      condition: "Uptime < 90%",
      action: "El validador será slashed. Verificar hardware y conexión.",
    },
    {
      level: "Advertencia",
      condition: "CPU > 80%",
      action:
        "Considerar upgrade de hardware. El nodo puede no producir bloques a tiempo.",
    },
    {
      level: "Advertencia",
      condition: "Latencia > 200ms",
      action: "Mover VPS a región más cercana a la mayoría de pares.",
    },
    {
      level: "Info",
      condition: "Nueva versión disponible",
      action: "Actualizar con: rstn-node upgrade",
    },
  ],
  prometheus: {
    endpoint: "http://localhost:9090/metrics",
    description:
      "Métricas Prometheus en formato text/plain. Compatible con Grafana dashboards.",
    grafana:
      "Dashboard preconfigurado incluido en rstn-monitor (docker compose up rstn-monitor).",
  },
} as const;

// ─── Fork Coordination + Software Updates ────────────────────────────────────
export const FORK_PROTOCOL = {
  principle:
    "Los forks son coordinados vía gobernanza on-chain. No hay upgrades sorpresa. Cada cambio tiene 90 días de antelación mínimo.",
  types: [
    {
      type: "Soft Fork",
      description:
        "Cambio compatible hacia atrás. Los nodos viejos siguen funcionando. No requiere coordinación masiva.",
      examples:
        "Optimización de gossip, nuevos RPC methods, ajuste de parámetros.",
      activation:
        "BIP-style: 90% de validadores señalan readiness en 2,000 bloques consecutivos. Se activa automáticamente.",
    },
    {
      type: "Hard Fork",
      description:
        "Cambio incompatible. Todos los nodos deben actualizar. Requiere coordinación total.",
      examples:
        "Cambio de esquema criptográfico, nuevo opcode, cambio de consenso.",
      activation:
        "Propuesta de gobernanza → votación 7 días → si aprueba (>67% IDs verificadas), fecha de activación fijada 90 días adelante. Bloque de activación anunciado en el genesis de la propuesta.",
    },
    {
      type: "Emergency Fork",
      description:
        "Respuesta a vulnerabilidad crítica o ataque cuántico detectado. Activación acelerada.",
      examples:
        "Quantum alarm disparado, bug crítico en consenso, ataque en progreso.",
      activation:
        "Declaración de emergencia por consenso de validadores + multisig de seguridad. Activación acelerada. Solo para amenazas existenciales.",
    },
  ],
  updateProcess: [
    {
      step: 1,
      title: "Propuesta NIP",
      detail:
        "Cualquier holder con 10,000 RSTN puede proponer un NIP (RSTN Improvement Proposal). Describe el cambio, justificación y código de referencia.",
    },
    {
      step: 2,
      title: "Votación on-chain",
      detail:
        "7 días de votación cuadrática. Umbral: 67% de identidades verificadas. Veto de minoría (10%) retrasa 30 días para discusión.",
    },
    {
      step: 3,
      title: "Implementación",
      detail:
        "Si aprueba, el equipo de desarrollo implementa el cambio en una rama del repositorio. Auditoría externa si el cambio es criptográfico o de consenso.",
    },
    {
      step: 4,
      title: "Auditoría",
      detail:
        "Firma especializada audita el cambio. Resultado público. Si falla, se rechaza y se repite.",
    },
    {
      step: 5,
      title: "Señalización",
      detail:
        "Los validadores actualizan su software y señalan readiness on-chain. El protocolo cuenta señales. Cuando alcanza el umbral, el fork se activa en el bloque programado.",
    },
    {
      step: 6,
      title: "Activación",
      detail:
        "En el bloque programado, el nuevo consenso entra en vigor. Los nodos no actualizados son desconectados automáticamente.",
    },
  ],
  autoUpdate: {
    command: "rstn-node upgrade",
    description:
      "Descarga e instala la última versión firmada. Verifica firma Dilithium3 del binario. Si la firma no coincide, rechaza la actualización. No es automático — el operador debe ejecutar el comando.",
    rollback:
      "rstn-node rollback — revierte a la versión anterior si la nueva falla.",
  },
} as const;

// ─── Seed Node Setup Guide ──────────────────────────────────────────────────
// ─── Cybersecurity Framework — 7 dominios de ataque + equipo de seguridad ────
export const SECURITY_FRAMEWORK = {
  principle:
    "Defensa en profundidad de 19 capas. Cada superficie de ataque tiene un mecanismo de mitigación, un equipo responsable y un protocolo de respuesta a incidentes.",
  residualRisk:
    "~12% — el riesgo que no se puede eliminar sin sacrificar descentralización",
  domains: [
    {
      id: 1,
      domain: "Criptografía Post-Cuántica",
      icon: "Shield",
      color: "hsl(150 100% 45%)",
      attackSurface: "Firmas, VRF, hashes, ZK, DKG, transporte P2P",
      threats: [
        {
          threat: "Shor's algorithm rompe firmas clásicas (ECDSA, Ed25519)",
          severity: "Crítico",
          mitigation:
            "Dilithium3 + Ed25519 híbrido desde génesis. SPHINCS+ hash-based como fallback. Quantum alarm on-chain.",
          status: "Mitigado",
        },
        {
          threat: "Flaw estructural en esquemas lattice (como Rainbow en 2022)",
          severity: "Crítico",
          mitigation:
            "Firmas híbridas (dos esquemas independientes). SPHINCS+ no depende de retículos. Migration path formal para reemplazar esquemas.",
          status: "Mitigado",
        },
        {
          threat: "Grover's algorithm debilita hashes a 128-bit",
          severity: "Alto",
          mitigation:
            "Keccak-512 (SHA-3) con 256-bit de seguridad post-Grover. Doble que SHA-256.",
          status: "Mitigado",
        },
        {
          threat:
            "Harvest now, decrypt later — interceptar tráfico hoy, descifrar mañana",
          severity: "Alto",
          mitigation:
            "Transporte PQ-noise (Kyber768 + X25519) desde génesis. Todo el tráfico P2P cifrado post-cuántico.",
          status: "Mitigado",
        },
      ],
      team: "Equipo especializado en criptografía PQ",
      responseTime: "Inmediato — detección automática on-chain",
    },
    {
      id: 2,
      domain: "Consenso BFT+DAG",
      icon: "Network",
      color: "hsl(150 100% 45%)",
      attackSurface: "Selección de líderes, votación, finalidad, sharding",
      threats: [
        {
          threat: "Ataque del 33% — detener finalidad (liveness attack)",
          severity: "Crítico",
          mitigation:
            "DAS (Data Availability Sampling) sub-lineal. Coste del ataque elevado de 33% a >90%. Slashing proporcional.",
          status: "Mitigado",
        },
        {
          threat: "Ataque del 67% — censura y reorganización",
          severity: "Crítico",
          mitigation:
            "Forced-inclusion pool. Cualquier tx censurada en N se fuerza en N+1. Detección automática + slashing al censor.",
          status: "Mitigado",
        },
        {
          threat: "Long-range attack — comprar claves viejas de validadores",
          severity: "Alto",
          mitigation:
            "Forward security: claves rotan cada época. Checkpointing social firmado. Claves viejas no pueden firmar bloques nuevos.",
          status: "Mitigado",
        },
        {
          threat: "Sybil attack — crear miles de validadores falsos",
          severity: "Alto",
          mitigation:
            "Stake de 32,000 RSTN por validador. Activación retrasada 1 época. Coste económico real por identidad.",
          status: "Mitigado",
        },
        {
          threat: "Shard captura — 51% de validadores en un shard",
          severity: "Alto",
          mitigation:
            "Rotación de validadores por VRF cada 256 bloques. Nadie sabe qué shard le toca hasta que es asignado.",
          status: "Mitigado",
        },
      ],
      team: "Equipo especializado en consenso BFT",
      responseTime: "Automático — slashing on-chain",
    },
    {
      id: 3,
      domain: "Red P2P y Transporte",
      icon: "Server",
      color: "hsl(150 100% 55%)",
      attackSurface: "Gossip, descubrimiento de pares, propagación de bloques",
      threats: [
        {
          threat: "Eclipse attack — aislar un nodo del resto de la red",
          severity: "Alto",
          mitigation:
            "Múltiples seed nodes en 5 regiones. Kademlia DHT con peer scoring. Conexiones salientes obligatorias a pares aleatorios.",
          status: "Mitigado",
        },
        {
          threat: "Vigilancia de red — mapear topología por ISP/gobierno",
          severity: "Alto",
          mitigation:
            "Onion routing P2P opcional (Nym-style). Mezcla de paquetes entre relés. Imposible correlacionar emisor-receptor.",
          status: "Mitigado",
        },
        {
          threat: "DDoS a validadores — saturar conexión del líder",
          severity: "Alto",
          mitigation:
            "Rotación de líder por VRF cada ronda (impredecible). Rate limiting criptográfico. Peer scoring degrada atacantes.",
          status: "Mitigado",
        },
        {
          threat: "Man-in-the-middle en conexiones P2P",
          severity: "Crítico",
          mitigation:
            "PQ-noise handshake (Kyber768 + X25519). Cifrado autenticado post-cuántico en cada conexión.",
          status: "Mitigado",
        },
        {
          threat: "Partición de red — dividir la red en dos mitades",
          severity: "Alto",
          mitigation:
            "Detección de partición por finalidad pausada. Auto-recuperación al reconectar. Checkpoints sociales como ancla.",
          status: "Mitigado",
        },
      ],
      team: "Equipo especializado en redes P2P",
      responseTime: "Automático — peer scoring",
    },
    {
      id: 4,
      domain: "Smart Contracts y RSTN-VM",
      icon: "Code",
      color: "hsl(150 70% 50%)",
      attackSurface:
        "Ejecución de contratos, opcodes, access lists, recursos estilo Move",
      threats: [
        {
          threat:
            "Reentrancy — contrato llama a sí mismo antes de actualizar estado",
          severity: "Crítico",
          mitigation:
            "RSTN-VM con checks-effects-interactions forzado. Recursos estilo Move (linearizability) previenen reentrancy por diseño.",
          status: "Mitigado",
        },
        {
          threat: "Integer overflow/underflow",
          severity: "Alto",
          mitigation:
            "Aritmética checked por defecto en RSTN-VM. Overflow causa revert automático. Sin unsafe math.",
          status: "Mitigado",
        },
        {
          threat: "Bug en contrato crítico — pérdida de fondos masiva",
          severity: "Crítico",
          mitigation:
            "Formal verification nativa (estilo Move). Circuit breakers on-chain: pausa automática si >X% fondos perdidos en Y minutos.",
          status: "Mitigado",
        },
        {
          threat:
            "Access list mal configurada — conflicto de ejecución paralela",
          severity: "Medio",
          mitigation:
            "Access lists declarativas verificadas en compilación. El compilador rechaza contratos con access lists ambiguas.",
          status: "Mitigado",
        },
        {
          threat: "Cross-shard message spoofing",
          severity: "Alto",
          mitigation:
            "Cross-shard receipts firmados con Dilithium3. Verificación criptográfica del shard de origen. Imposible falsificar.",
          status: "Mitigado",
        },
      ],
      team: "Equipo especializado en VM y smart contracts",
      responseTime: "Automático — circuit breaker on-chain",
    },
    {
      id: 5,
      domain: "Economía y Staking",
      icon: "Coins",
      color: "hsl(150 100% 55%)",
      attackSurface: "Stake, slashing, delegación, recompensas, gobernanza",
      threats: [
        {
          threat: "MEV — validadores extraen valor reordenando transacciones",
          severity: "Alto",
          mitigation:
            "Mempool cifrado con threshold encryption. Las txs se desencriptan DESPUÉS del ordenamiento. Mitiga MEV estructuralmente; la versión de producción requiere DKG real (actualmente usa PRNG determinístico).",
          status: "Mitigado",
        },
        {
          threat: "Ballena acumula >33% del stake",
          severity: "Crítico",
          mitigation:
            "DAS sub-lineal eleva coste a >90%. Slashing proporcional disuade. Anti-whale en early validator incentives (bonus por validador, no por stake).",
          status: "Mitigado",
        },
        {
          threat: "Slashing injusto — validador honesto penalizado por bug",
          severity: "Medio",
          mitigation:
            "Slashing proporcional, no destructivo. Recuperación tras 3 épocas sin incidentes. Solo double-sign es severo.",
          status: "Mitigado",
        },
        {
          threat: "Gobernanza capturada — ballenas controlan votación",
          severity: "Alto",
          mitigation:
            "Votación cuadrática + identidad verificada. Umbral de captura: >51% de identidades, no tokens. Veto de minoría (10%).",
          status: "Mitigado",
        },
        {
          threat: "Spam / dust attack — saturar mempool",
          severity: "Medio",
          mitigation:
            "Mempool con prioridad por stake histórico + hashcash anti-spam. Transacciones sin stake requieren PoW ligero.",
          status: "Mitigado",
        },
      ],
      team: "Equipo especializado en economía del protocolo",
      responseTime: "Automático — slashing y gobernanza on-chain",
    },
    {
      id: 6,
      domain: "Infraestructura y DevOps",
      icon: "HardDrive",
      color: "hsl(150 60% 40%)",
      attackSurface: "VPS, Docker, almacenamiento, monitoreo, updates",
      threats: [
        {
          threat: "Compromiso del VPS — atacante roba claves del validador",
          severity: "Crítico",
          mitigation:
            "Claves de validador en HSM o secure enclave. Claves de consenso separadas de claves de firma. Rotación de claves on-chain.",
          status: "Mitigado",
        },
        {
          threat: "Supply chain attack — binario del nodo modificado",
          severity: "Crítico",
          mitigation:
            "Binarios firmados con Dilithium3. rstn-node upgrade verifica firma antes de instalar. Reproducible builds desde source.",
          status: "Mitigado",
        },
        {
          threat: "Docker image comprometido",
          severity: "Alto",
          mitigation:
            "Imágenes firmadas y publicadas en registry verificado. Hash SHA-256 publicado. Verificación automática al pull.",
          status: "Mitigado",
        },
        {
          threat: "Bug en dependencia Rust (libp2p, sled, etc.)",
          severity: "Alto",
          mitigation:
            "Dependencias pinned a versiones auditadas. Cargo audit continuo. Reproducible builds. Fuzzing del nodo en CI.",
          status: "Mitigado",
        },
        {
          threat: "Configuración incorrecta — puerto expuesto sin auth",
          severity: "Medio",
          mitigation:
            "Config por defecto segura. RPC no expuesto al público por defecto. Guía de hardening del VPS en docs.",
          status: "Mitigado",
        },
      ],
      team: "Equipo especializado en infraestructura y DevOps",
      responseTime: "Automático — rollback disponible",
    },
    {
      id: 7,
      domain: "Wallet y Frontend",
      icon: "Wallet",
      color: "hsl(150 60% 50%)",
      attackSurface: "Extensión del navegador, wallet web, dApps, RPC",
      threats: [
        {
          threat:
            "XSS en dApp — robar claves o firmar transacciones maliciosas",
          severity: "Crítico",
          mitigation:
            "Claves nunca expuestas al DOM. Comunicación vía inpage provider con whitelist de orígenes. CSP estricta en la extensión.",
          status: "Mitigado",
        },
        {
          threat: "Phishing — dApp falsa pide firma de transacción",
          severity: "Alto",
          mitigation:
            "Popup de confirmación con detalle legible: destinatario, monto, contrato. Warning si interactúa con contrato no verificado.",
          status: "Mitigado",
        },
        {
          threat: "Malware en el navegador roba seed phrase",
          severity: "Crítico",
          mitigation:
            "Seed phrase cifrada en almacenamiento del navegador. Nunca en texto plano. Export solo con contraseña + confirmación.",
          status: "Mitigado",
        },
        {
          threat: "Transaction replay — reenviar tx firmada en otra red",
          severity: "Alto",
          mitigation:
            "Chain ID incluido en cada firma. Transacciones inválidas en otras redes. EIP-155 style protection.",
          status: "Mitigado",
        },
        {
          threat: "RPC endpoint malicioso devuelve datos falsos",
          severity: "Medio",
          mitigation:
            "Verificación de Merkle proofs en light clients. El cliente no confía ciegamente en el RPC — verifica el estado on-chain.",
          status: "Mitigado",
        },
      ],
      team: "Equipo especializado en seguridad web y wallets",
      responseTime: "Automático — confirmación de transacción",
    },
    {
      id: 8,
      domain: "Defensa contra IA Adversarial",
      icon: "BrainCircuit",
      color: "hsl(150 100% 55%)",
      attackSurface:
        "Bug discovery con IA, deepfakes, mapeo de red con ML, fuzzing adversarial",
      threats: [
        {
          threat:
            "IA descubre bugs en contratos que humanos no ven (LLM + fuzzing)",
          severity: "Crítico",
          mitigation:
            "Red-teaming con IA propio en CI: ejecutamos fuzzing adversarial con modelos antes de cada release. Formal verification nativa en RSTN-VM. Si la IA encuentra el bug, lo parchamos antes del deploy.",
          status: "Mitigado",
        },
        {
          threat:
            "Deepfakes contra operadores de nodos — clonar voz/video del equipo",
          severity: "Alto",
          mitigation:
            "Protocolo de verificación multi-canal: instrucciones críticas requieren firma on-chain, no voz/video. Ninguna acción de emergencia se ejecuta por canal de voz. 2FA + multisig.",
          status: "Mitigado",
        },
        {
          threat:
            "Mapeo de topología de red con ML para eclipse attack optimizado",
          severity: "Alto",
          mitigation:
            "Detección de anomalías con ML propio (monitoreo de patrones de conexión). Onion routing P2P opcional. Peer scoring adaptivo que degrada conexiones con comportamiento estadísticamente anómalo.",
          status: "Mitigado",
        },
        {
          threat: "IA optimiza extracción de MEV en mensajes cross-shard",
          severity: "Alto",
          mitigation:
            "Cross-shard receipts con commit-reveal: el estado futuro no es visible hasta el commit. Mempool cifrado (threshold encryption). La IA no puede modelar lo que no puede observar.",
          status: "Mitigado",
        },
        {
          threat:
            "Ataques adversariales contra VRF — buscar sesgos estadísticos",
          severity: "Medio",
          mitigation:
            "VRF lattice-based (Module-LWE) es criptográficamente impredecible, no estadísticamente. Auditoría estadística continua on-chain detecta desviaciones. Si se detecta sesgo, rotación de esquema.",
          status: "Mitigado",
        },
        {
          threat:
            "IA fuzzing del nodo Rust — generar inputs que crashean el nodo",
          severity: "Alto",
          mitigation:
            "Fuzzing con IA propio en CI (cargo-fuzz + modelos). Inputs adversariales probados antes de cada release. Circuit breakers que aíslan nodos crasheados sin detener la red. Recuperación automática.",
          status: "Mitigado",
        },
      ],
      team: "Equipo especializado en seguridad de IA adversarial",
      responseTime: "Automático — red-teaming en CI",
    },
  ],
} as const;

// ─── Public Security Summary (detalles internos en SECURITY_INTERNAL.md) ────
export const SECURITY_TEAM_PUBLIC = {
  principle:
    "8 dominios de ataque, equipos especializados. Estructura organizacional detallada en documentación interna.",
  totalMembers: "Equipo especializado multidisciplinario",
  domains: [
    {
      domain: "Criptografía PQ",
      coverage: "Diseño de esquemas, revisión criptanalítica, migration path",
    },
    {
      domain: "Consenso BFT+DAG",
      coverage: "Implementación de BFT, slashing, VRF, sharding",
    },
    {
      domain: "Red y Transporte",
      coverage: "libp2p, gossip, discovery, onion routing",
    },
    {
      domain: "Smart Contracts",
      coverage: "RSTN-VM, opcodes, access lists, formal verification",
    },
    {
      domain: "Economía y Staking",
      coverage: "Tokenomics, slashing economics, MEV prevention",
    },
    {
      domain: "Infraestructura",
      coverage: "CI/CD, Docker, releases firmados, monitoring",
    },
    {
      domain: "Wallet y Frontend",
      coverage: "Extensión, wallet web, CSP, anti-phishing",
    },
    {
      domain: "IA Adversarial",
      coverage:
        "Red-teaming con IA, detección de deepfakes, fuzzing adversarial",
    },
  ],
  externalAudits: [
    { role: "Auditoría Criptográfica", when: "Pre-mainnet" },
    { role: "Auditoría de Consenso", when: "Pre-mainnet" },
    { role: "Bug Bounty", when: "Post-testnet" },
    { role: "Fuzzing continuo", when: "Continuo" },
  ],
} as const;

// ─── Public Incident Response Summary ────────────────────────────────────────
export const INCIDENT_RESPONSE_PUBLIC = {
  principle:
    "Cada incidente tiene un playbook. Detección → Contención → Erradicación → Recuperación → Post-mortem público.",
  severityLevels: [
    {
      level: "SEV-0",
      description:
        "Amenaza existencial — fondos en riesgo o consenso comprometido",
      action: "Emergency fork acelerado",
    },
    {
      level: "SEV-1",
      description: "Pérdida significativa — red degradada",
      action: "Hotfix prioritario",
    },
    {
      level: "SEV-2",
      description: "Degradación — funcionalidad afectada sin pérdida de fondos",
      action: "Patch en próxima época",
    },
    {
      level: "SEV-3",
      description: "Menor — issue cosmético o de rendimiento",
      action: "Fix en próximo release",
    },
  ],
  playbook: [
    {
      step: 1,
      phase: "Detección",
      action: "Alarmas on-chain + monitoring automático",
      automation: "Automático",
    },
    {
      step: 2,
      phase: "Contención",
      action:
        "Circuit breakers pausan contratos. Validadores maliciosos slashed.",
      automation: "Automático",
    },
    {
      step: 3,
      phase: "Erradicación",
      action: "Identificar root cause. Desplegar fix o activar migration path.",
      automation: "Manual",
    },
    {
      step: 4,
      phase: "Recuperación",
      action:
        "Reanudar operación. Verificar integridad. Restaurar fondos vía gobernanza.",
      automation: "Manual",
    },
    {
      step: 5,
      phase: "Post-mortem",
      action: "Reporte público detallado en 72h. Sin censura.",
      automation: "Manual",
    },
  ],
  transparency:
    "Todos los incidentes SEV-0 y SEV-1 se publican públicamente en 72 horas. El post-mortem es open-source.",
} as const;

export const SEED_NODE_GUIDE = {
  principle:
    "Los seed nodes son los puntos de entrada a la red. 5 nodos en 5 regiones. Cualquiera puede operar uno, pero debe ser anunciado en el génesis.",
  requirements: [
    {
      requirement: "VPS dedicado",
      detail:
        "4 cores, 8GB RAM, 100GB SSD. IP estática. Disponibilidad 99.9%+.",
    },
    {
      requirement: "Puerto abierto",
      detail:
        "Puerto 31402 TCP + UDP abierto al público. Sin firewall bloqueando conexiones entrantes.",
    },
    {
      requirement: "DNS record",
      detail:
        "Un registro A/AAAA apuntando a la IP del VPS. Ej: seed-06.rstn.network → 203.0.113.42",
    },
    {
      requirement: "Uptime garantizado",
      detail:
        "El seed node debe estar online 24/7. Si cae, los nodos nuevos no pueden descubrir la red. Mínimo 99.9% uptime.",
    },
  ],
  setup: [
    {
      step: 1,
      title: "Instalar rstn-node en modo seed",
      command:
        "docker run -d --name rstn-seed -p 31402:31402 -v rstn-seed:/data rstn/node:latest --mainnet --role seed",
      detail:
        "El flag --role seed configura el nodo para aceptar conexiones entrantes y no validar bloques. Solo descubre y comparte pares.",
    },
    {
      step: 2,
      title: "Configurar DNS",
      command:
        "echo 'seed-06.rstn.network. IN A 203.0.113.42' >> /etc/bind/zones/rstn.db",
      detail:
        "Añadir registro DNS A apuntando al VPS. El dominio debe ser anunciado en el bootstrap config del génesis.",
    },
    {
      step: 3,
      title: "Verificar conectividad",
      command: "rstn-node check-seed --host seed-06.rstn.network --port 31402",
      detail:
        "Verifica que el seed node es alcanzable desde internet y responde a handshakes PQ-noise.",
    },
    {
      step: 4,
      title: "Monitorear",
      command: "rstn-node seed-stats --watch",
      detail:
        "Muestra conexiones entrantes, pares descubiertos y tráfico. Los seed nodes no reciben recompensas — son un servicio a la red.",
    },
  ],
  dnsConfig: {
    record:
      'boot.rstn.network IN TXT "dnsaddr=/dns/seed-01.rstn.network/tcp/31402,dnsaddr=/dns/seed-02.rstn.network/tcp/31402,..."',
    description:
      "Un registro DNS TXT en boot.rstn.network contiene las multiaddrs de todos los seed nodes. Los nodos nuevos resuelven este registro para encontrar la red.",
    redundancy:
      "5 seed nodes en 5 regiones. Si 3 caen, 2 bastan para descubrir la red. Si todos caen, los nodos existentes se mantienen conectados vía DHT.",
  },
  noRewards:
    "Los seed nodes no reciben recompensas. Son un servicio público a la red. Operar un seed node es un acto de contribución, no un negocio.",
} as const;

// ─── Cold Start Bootstrap — How the network is born from zero ───────────────
// The problem: BFT requires 3f+1 nodes. With 1 node, f=0 → tolerates 0 faults.
// Mainnet cannot be started with a single node. This documents how it is resolved.
export const COLD_START_BOOTSTRAP = {
  principle:
    "La red no nace con un nodo. Nace con una secuencia de fases que garantiza seguridad BFT real antes de abrirse al público.",
  coreProblem:
    "BFT requiere un mínimo de nodos para tolerar fallos. Con un solo nodo no hay tolerancia — si cae, la red cae. Con un conjunto mínimo de nodos se tiene BFT real. Mainnet arranca con 500 validadores verificados en testnet para descentralización genuina desde el bloque 0.",
  phases: [
    {
      phase: 1,
      name: "Desarrollo Local",
      nodes: "1 nodo",
      bftTolerance: "Sin tolerancia a fallos (solo desarrollo)",
      purpose:
        "Validar que el código compila, Dilithium3 firma, el estado persiste y el RPC responde. NO es blockchain — es un prototipo.",
      canTransact: false,
      label: "Prototipo",
      color: "hsl(150 100% 45%)",
    },
    {
      phase: 2,
      name: "Testnet Privada",
      nodes: "4 nodos",
      bftTolerance: "BFT mínimo — tolera fallos limitados",
      purpose:
        "BFT real. Se testea slashing, VRF, finalidad, sincronización entre nodos. 4 VPS en regiones diferentes. No hay token real — RSTN de testnet.",
      canTransact: true,
      label: "BFT mínimo",
      color: "hsl(150 70% 50%)",
    },
    {
      phase: 3,
      name: "Testnet Semi-Pública",
      nodes: "7-10 nodos",
      bftTolerance: "Estable — tolera múltiples fallos simultáneos",
      purpose:
        "Se invita a colaboradores externos de confianza. Se prueban sharding cross-shard, gobernanza on-chain, y edge cases de consenso. Se mide TPS real.",
      canTransact: true,
      label: "Estable",
      color: "hsl(150 100% 55%)",
    },
    {
      phase: 4,
      name: "Testnet Pública",
      nodes: "20-100 nodos",
      bftTolerance: "Robusto — tolera fallos múltiples",
      purpose:
        "Abierta a cualquier persona. Aquí empieza el snapshot de Proof of Participation. Los participantes acumulan RSTN por trabajo (reportar bugs, operar nodos estables, contribuir código).",
      canTransact: true,
      label: "Abierta",
      color: "hsl(150 100% 55%)",
    },
    {
      phase: 5,
      name: "Mainnet Génesis",
      nodes: "500+ nodos",
      bftTolerance: "Soberana — tolerancia a fallos a escala de red",
      purpose:
        "Génesis real. Se activa la distribución completa de 1B RSTN. Los 500 validadores verificados en testnet (Proof of Participation) migran a mainnet con su stake ganado. La red es soberana desde el bloque 0.",
      canTransact: true,
      label: "Soberana",
      color: "hsl(150 100% 45%)",
    },
    {
      phase: 6,
      name: "Mainnet Objetivo",
      nodes: "4,128+ nodos",
      bftTolerance: "Meta — máxima tolerancia a fallos",
      purpose:
        "Descentralización completa. 64 shards activos. 250K TPS objetivo (no medido). Sin equipo con poder especial. La red se gobierna a sí misma.",
      canTransact: true,
      label: "Meta",
      color: "hsl(150 100% 45%)",
    },
  ],
  keyInsight:
    "No se puede 'utilizar el protocolo' de forma real desde el nodo 1. El nodo 1 solo sirve para desarrollar y debuggear. La blockchain nace cuando hay un conjunto mínimo de nodos con tolerancia BFT real.",
  earlyValidatorIncentives: {
    principle:
      "Los primeros validadores asumen más riesgo (red pequeña, menos recompensas, más incertidumbre). Se les compensa con un bonus decreciente.",
    program: "Genesis Validator Program",
    rewards: [
      {
        group: "Primera tanda (nodos 1-100)",
        bonus: "2.0× multiplicador de recompensas",
        duration: "Primer año",
        condition: "Uptime >99% y cero slashing",
      },
      {
        group: "Segunda tanda (nodos 101-500)",
        bonus: "1.5× multiplicador",
        duration: "Primer año",
        condition: "Uptime >99% y cero slashing",
      },
      {
        group: "Tercera tanda (nodos 501-4,128)",
        bonus: "1.25× multiplicador",
        duration: "Primer año",
        condition: "Uptime >99% y cero slashing",
      },
      {
        group: "Post-génesis (nodo 4,129+)",
        bonus: "1.0× — recompensas estándar",
        duration: "Permanente",
        condition: "Sin bonus, pero red más segura",
      },
    ],
    rationale:
      "Sin estos incentivos, nadie querría ser validador cuando la red vale $0. El bonus alinea el riesgo de los primeros con el futuro de la red. Decrece linealmente — no crea desigualdad permanente.",
    antiWhale:
      "El bonus es por validador, no por stake. Un ballena con 100 validadores no obtiene 100× bonus — cada validador tiene su propio multiplicador. Esto premia la distribución, no la concentración.",
  },
  genesisWithoutICO: {
    principle:
      "Los 1B RSTN existen desde el bloque génesis. No se venden. Se asignan y se liberan por Proof of Participation. El equipo no tiene bucket reservado — gana RSTN operando el validador génesis (modelo Satoshi).",
    mechanism:
      "El contrato de génesis contiene todas las asignaciones. No hay contrato de vesting del equipo. La reserva de staking se distribuye con halving geométrico bloque a bloque. Nadie — ni el equipo — puede acelerar o alterar la distribución. Es código inmutable.",
    steps: [
      {
        step: 1,
        action: "Génesis define 1B RSTN en 2 buckets",
        detail:
          "95% staking (Proof of Participation), 5% airdrop testnet (semilla de arranque). Todos los tokens existen desde el bloque 0. Cero bucket de equipo, cero ecosystem fund, cero treasury génesis.",
      },
      {
        step: 2,
        action: "95% se distribuye por staking",
        detail:
          "Los validadores ganan RSTN por producir bloques. La distribución sigue el halving geométrico — 475M en años 1-4, 237.5M en años 5-8, etc. El equipo opera el validador génesis y gana desde aquí por ser el primero en hacer el bootstrap (modelo Satoshi).",
      },
      {
        step: 3,
        action: "Equipo = validador génesis (sin bucket)",
        detail:
          "El equipo no tiene asignación reservada. Gana RSTN desde el bucket de staking operando el validador génesis. Mismo mecanismo que cualquier validador. Si deja de validar, deja de cobrar. Su share se diluye solo con nuevos stakers. Compromiso público de no-venta (comportamiento sink de Satoshi).",
      },
      {
        step: 4,
        action: "5% airdrop testnet (semilla de arranque)",
        detail:
          "Distribuido a participantes de testnet por Proof of Participation (operar nodos estables, reportar bugs, contribuir código). Único bucket pre-asignado, entregado una sola vez. No es venta — es recompensa por trabajo.",
      },
    ],
    noSale:
      "En ningún momento se vende RSTN. No hay ICO, no hay pre-venta, no hay venta OTC. El equipo gana RSTN operando el validador génesis — igual que Satoshi minó los primeros BTC por ser el primero en minar, no por un privilegio de protocolo.",
  },
} as const;

// ─── Cross-Chain Bridge & Quantum Migration Program ─────────────────────────
export const CROSS_CHAIN = {
  principle:
    "El capital no puede llegar a RSTN sin un puente. Pero un puente mal diseñado es el vector de ataque #1 en Web3 ($3B+ hackeado en puentes 2021-2024). RSTN diseña puentes con seguridad post-cuántica desde el día uno.",
  hackLessons: [
    {
      name: "Wormhole (2022)",
      lost: "$320M",
      vector:
        "Firma de guardián forjada por un bug en la verificación de firmas del bridge. El atacante falsificó una firma y minteó tokens sin respaldo.",
      lesson:
        "RSTN usa Dilithium3 en relayers — forjar una firma requiere romper lattice, no ECDSA. Verificación on-chain de cada firma.",
    },
    {
      name: "Nomad Bridge (2022)",
      lost: "$190M",
      vector:
        "Un bug en el proceso de inicialización permitió que cualquier mensaje calldata válido fuera aceptado como prueba. Cualquiera podía withdraw.",
      lesson:
        "RSTN inicializa light clients con un hash de génesis verificado on-chain. No hay 'mensaje válido' genérico — cada claim requiere prueba Merkle específica.",
    },
    {
      name: "Ronin Bridge (2022)",
      lost: "$625M",
      vector:
        "5 de 9 validadores del puente comprometidos por ingeniería social. El atacante firmó transacciones válidas porque tenía la mayoría.",
      lesson:
        "RSTN no usa un set de validadores separado para el puente. Los validadores de la red (4,128+) verifican cross-chain. Comprometer la mayoría es inviable.",
    },
    {
      name: "Poly Network (2021)",
      lost: "$610M",
      vector:
        "El contrato del puente no verificaba el caller de la función cross-chain. Cualquiera podía llamar funciones privilegiadas.",
      lesson:
        "RSTN usa access control PQ en el contrato bridge. Cada función privilegiada requiere firma Dilithium3 verificada. Sin excepciones.",
    },
  ],
  btcSpecial: {
    challenge:
      "Bitcoin no tiene smart contracts. No se puede quemar BTC con un contrato. Además, Bitcoin Script solo soporta ECDSA y Schnorr (secp256k1) — NO soporta Dilithium3 ni ningún esquema post-cuántico. No se puede verificar una firma Dilithium3 dentro de Bitcoin.",
    solution:
      "RSTN usa un modelo de dos capas inspirado en tBTC (Threshold Network). Capa 1 (Bitcoin): un comité de firmantes usa threshold ECDSA (tECDSA) — MPC distribuida donde ningún firmante individual tiene la clave privada completa. 51 de 100 firmantes deben cooperar para producir una firma ECDSA estándar válida en Bitcoin. El BTC se custodia en una dirección P2WSH generada por el comité. Capa 2 (RSTN): la gobernanza del comité, selección de firmantes, slashing y verificación de depósitos usan Dilithium3. El lado de Bitcoin es ECDSA por fuerza — el lado de RSTN es post-cuántico.",
    signers:
      "Múltiples comités paralelos de 100 firmantes cada uno (estilo tBTC v2). Cada comité custodia un vault P2WSH independiente. Threshold 51-de-100 por comité. Rotación quincenal. Los firmantes se seleccionan aleatoriamente del pool de validadores RSTN (stake mínimo en RSTN). Sin solapamiento — un validador pertenece a máximo 1 comité a la vez. Slashing en RSTN si firman transacciones inválidas. El número de comités escala dinámicamente según el volumen de migración (1 comité = ~1,440 tx/día, 50 comités = ~72,000 tx/día).",
    custody:
      "BTC custodiado en P2WSH con threshold ECDSA 51-de-100. Proof of Reserves pública: cualquier persona puede verificar on-chain que el saldo de wBTC en RSTN equals el saldo de BTC en la dirección del comité. Timelock de 24h para disputas antes de liberar BTC.",
    spvVerification:
      "Los validadores RSTN ejecutan un SPV light client de Bitcoin embebido. Verifican headers de bloque + prueba Merkle de inclusión de la transacción de depósito. No confían en el comité — confían en la proof-of-work de Bitcoin. Esto es lo mismo que hace tBTC.",
    redemption:
      "El usuario quema wBTC en un contrato de burn en RSTN. El comité verifica el burn on-chain en RSTN. Luego, vía MPC, 51 firmantes cooperan para producir una firma ECDSA válida que transfiere el BTC a la dirección que el usuario especifique. La transacción se transmite a la red de Bitcoin. 1:1, siempre redimible.",
    honestLimitation:
      "La custodia del BTC en Bitcoin es ECDSA, no post-cuántica. Esto es una limitación fundamental de Bitcoin — no se puede cambiar sin un fork de Bitcoin. La seguridad viene de (1) threshold distribuido (no hay clave única que romper), (2) rotación de firmantes, y (3) slashing económico en RSTN. Si Bitcoin hace un fork para soportar firmas PQ en el futuro, RSTN migraría el vault a firmas PQ nativas.",
  },
  interoperabilityStandards: [
    {
      name: "LayerZero",
      status: "No integrado",
      reason:
        "LayerZero usa oracle relayers con firmas tradicionales. Para interoperabilidad PQ, RSTN implementa su propio protocolo de mensajería con firmas Dilithium3. Integración futura posible vía DVN (Decentralized Validator Network) personalizado.",
    },
    {
      name: "CCIP (Chainlink)",
      status: "Evaluación futura",
      reason:
        "CCIP usa el DON de Chainlink para verificar. Si Chainlink migra a firmas PQ, la integración es directa. Hoy no es compatible con PQ.",
    },
    {
      name: "Axelar",
      status: "No integrado",
      reason:
        "Axelar usa threshold ECDSA. Vulnerable a Shor. No compatible con la tesis PQ de RSTN.",
    },
    {
      name: "IBC (Cosmos)",
      status: "Compatible a futuro",
      reason:
        "IBC es un protocolo de mensajería que no depende de un esquema de firmas específico. RSTN podría implementar IBC con firmas PQ. Evaluación post-mainnet.",
    },
  ],
  quantumMigrationTechnical: {
    proofOfOwnership:
      "La prueba de posesión es implícita en la transferencia. Para BTC: el usuario transfiere su BTC al vault del comité — solo quien controla la clave ECDSA puede firmar esa transacción. Para ETH/SOL: el usuario quema sus tokens en el contrato de burn — solo quien controla la clave puede autorizar el burn. No hay firma de mensaje separada — la transferencia misma ES la prueba de posesión.",
    doubleSpendPrevention:
      "Un Merkle tree global registra cada dirección pre-cuántica migrada. El root se actualiza en cada bloque. Verificar si una dirección ya migró es O(log n). Reclamar dos veces es imposible — la segunda transacción se rechaza. Para BTC, el UTXO gastado en la transferencia al vault no se puede reusar — la proof-of-work de Bitcoin lo garantiza.",
    crossChainFinality:
      "La migración requiere que la transacción de transferencia/burn tenga finality en la chain origen. Para BTC: 6 confirmaciones (~60 min). Para ETH: finality epoch (~12 min). Sin finality, no hay emisión. Esto previene reorgs que podrían invalidar la transferencia.",
    replayProtection:
      "Cada claim incluye un nonce único derivado del chain_id + block_height + tx_hash de la chain origen. Un atacante no puede reutilizar una prueba de otra chain ni de otra transacción.",
    economicBackstop:
      "El wBTC/wETH emitido por Quantum Migration NO es dinero creado de la nada. El activo original se transfiere al vault del comité (BTC) o se quema en el contrato origen (ETH/SOL). El wBTC está respaldado 1:1 por el activo bloqueado o quemado. Sin transferencia verificada vía light client, no hay emisión. Proof of Reserves pública y auditable.",
    vaultFlow:
      "BTC: el usuario transfiere su BTC a la dirección P2WSH del comité RSTN (threshold ECDSA 51-de-100). Los validadores verifican la transferencia vía SPV. Se emite wBTC. La clave ECDSA original ya no controla ese BTC — aunque un QC la rompa, no hay BTC que robar. ETH/SOL: el usuario quema sus tokens en un contrato de burn verificable. RSTN verifica el burn vía light client y emite el equivalente.",
    abandonedCoins:
      "Limitación honesta: las monedas abandonadas (BTC en direcciones donde el propietario perdió la clave privada) NO pueden ser migradas. Solo el propietario puede iniciar la transferencia. Esto es un problema abierto que afecta a toda la industria — el Coinbase Quantum Advisory Council lo documenta. RSTN no tiene solución para esto y no la promete.",
  },
  supportedChains: {
    mainnet: [
      {
        chain: "Bitcoin (BTC)",
        model: "Lock-and-Mint (threshold ECDSA 51-de-100 + SPV)",
        lightClient: "SPV light client (probado por tBTC)",
        finality: "6 confirmaciones (~60 min)",
        status: "Diseño completo",
      },
      {
        chain: "Ethereum (ETH)",
        model: "Lock nativo + Burn ERC-20",
        lightClient: "Sync committee (Altair upgrade)",
        finality: "Finality epoch (~12 min)",
        status: "Diseño completo",
      },
    ],
    future: [
      {
        chain: "Solana (SOL)",
        model: "Burn en programa origen",
        lightClient:
          "Light client en desarrollo (=nil; Foundation demostró factibilidad)",
        finality: "Probabilística (~30 confirmaciones)",
        status: "Post-mainnet — light client inmaduro",
      },
      {
        chain: "BNB Smart Chain (BSC)",
        model: "Lock + Burn BEP-20",
        lightClient: "EVM-compatible (mismo que ETH)",
        finality: "Finality fast (~3s)",
        status: "Post-mainnet",
      },
      {
        chain: "Avalanche (AVAX)",
        model: "Lock + Burn ERC-20",
        lightClient: "EVM-compatible (subnet light client)",
        finality: "Probabilística (~10 confirmaciones)",
        status: "Post-mainnet",
      },
      {
        chain: "Polygon",
        model: "Lock + Burn ERC-20",
        lightClient: "EVM-compatible",
        finality: "Bor Heimdall consensus",
        status: "Post-mainnet",
      },
      {
        chain: "Cardano (ADA)",
        model: "Lock en Plutus contract",
        lightClient: "Ouroboros PoS light client",
        finality: "Complejo — requiere ingeniería adicional",
        status: "Evaluación",
      },
      {
        chain: "Polkadot (DOT)",
        model: "Lock en pallet",
        lightClient: "GRANDPA light client (documentado)",
        finality: "GRANDPA finality",
        status: "Evaluación",
      },
      {
        chain: "Near (NEAR)",
        model: "Lock en Rust contract",
        lightClient: "Nightshade light client",
        finality: "Menos probado",
        status: "Evaluación",
      },
    ],
    note: "RSTN solo soporta chains con un light client implementado y auditado. No soportamos 'cualquier chain' sin calificación — cada chain requiere ingeniería específica. Las chains EVM-compatible (BSC, AVAX, Polygon) reutilizan la arquitectura de Ethereum con adaptaciones menores.",
  },
  bridges: [
    {
      id: 1,
      name: "Lock-and-Mint Bridge",
      type: "Descentralizado",
      chains: "BTC, ETH → RSTN (mainnet)",
      mechanism:
        "BTC: el usuario envía BTC a una dirección P2WSH del comité de firmantes (threshold ECDSA 51-de-100, estilo tBTC). Los validadores verifican vía SPV light client (6 confirmaciones). Se emite wBTC 1:1 respaldado por el BTC bloqueado. ETH nativo: el usuario bloquea su ETH en un contrato de lock verificable (no se quema — ETH nativo no tiene función burn). ERC-20s (USDC, USDT, etc.): el usuario quema los tokens con burn() en el contrato origen. RSTN verifica el lock/burn vía light client y emite el equivalente. SOL y chains EVM-compatible se añaden post-mainnet.",
      security:
        "BTC: threshold ECDSA 51-de-100 (no hay clave única). Comité seleccionado del pool de validadores RSTN. Slashing en RSTN si firman inválido. ETH: lock verificable vía light client — sin custodio. ERC-20s: burn verificable. Proof of Reserves pública para BTC.",
      latency:
        "BTC: ~60 min (6 confirmaciones). ETH: ~12 min (finality epoch).",
      risk: "BTC: la custodia usa ECDSA (limitación de Bitcoin, no soporta PQ nativamente). Mitigado con threshold distribuido + rotación + slashing. ETH: lock nativo requiere contrato de custodia auditado. SOL y chains EVM-compatible se añaden post-mainnet cuando sus light clients estén auditados.",
      status: "Diseño especificado",
      color: "hsl(150 100% 45%)",
    },
    {
      id: 2,
      name: "Liquidity Pool Bridge",
      type: "Semi-descentralizado",
      chains: "ETH, BSC, AVAX → RSTN (post-mainnet)",
      mechanism:
        "Pools de liquidez en ambos lados. Relayers descentralizados verifican transacciones cross-chain. El usuario deposita en el pool origen y retira del pool RSTN.",
      security:
        "Múltiples relayers con consenso BFT. Slashing si un relayer firma inválidas. Pools con circuit breakers.",
      latency: "~30-60 seg",
      risk: "El pool puede vaciarse en un ataque coordinado. Mitigado con límites de throughput y pausas de emergencia.",
      status: "Diseño especificado",
      color: "hsl(150 100% 45%)",
    },
    {
      id: 3,
      name: "Quantum Migration Program",
      type: "Único — sin precedentes",
      chains: "Chains con light client implementado → RSTN",
      mechanism:
        "Cuando la amenaza cuántica sea latente, el usuario transfiere su activo al vault del comité (BTC, vía threshold ECDSA) o lo bloquea/quema en el contrato origen (ETH nativo: lock. ERC-20s/SOL: burn). RSTN verifica la transferencia o el lock/burn vía light client (SPV para BTC, sync committee para ETH). Solo entonces emite el equivalente en wBTC/wETH a una dirección Dilithium3 del usuario. El activo original queda bloqueado o destruido — no hay doble representación. Solo chains con light client implementado y auditado son soportadas.",
      security:
        "El wBTC/wETH está respaldado 1:1 por el activo bloqueado en el vault o quemado. Sin transferencia verificada, no hay emisión. La clave ECDSA original ya no controla el activo — aunque un QC la rompa, no hay nada que robar. Proof of Reserves auditable.",
      latency:
        "BTC: ~60 min (6 confirmaciones). ETH: ~12 min (finality epoch).",
      risk: "Limitación honesta: las monedas abandonadas (claves perdidas) no pueden migrarse — solo el propietario puede iniciar la transferencia. Si el usuario no transfiere antes del deadline, la ventana expira y el capital queda bajo riesgo cuántico en la chain original. Solo chains con light client implementado son soportadas — no 'cualquier chain'.",
      status: "Diferenciador único del proyecto",
      color: "hsl(150 100% 55%)",
    },
  ],
  securityDesign: [
    {
      principle: "Cero multisig centralizada",
      detail:
        "Ningún puente depende de 5 firmantes que pueden ser comprometidos. Validadores descentralizados verifican cada transacción cross-chain.",
    },
    {
      principle: "Firmas post-cuánticas en relayers",
      detail:
        "Los relayers usan Dilithium3. Un QC no puede forjar firmas de relayer para inyectar transacciones falsas.",
    },
    {
      principle: "Circuit breakers on-chain",
      detail:
        "Si el flujo cross-chain excede umbrales anormales, el puente se pausa automáticamente. Requiere gobernanza para reactivar.",
    },
    {
      principle: "Rate limiting por chain",
      detail:
        "Cada chain origen tiene un límite de throughput. Un atacante no puede vaciar todo el puente en una transacción.",
    },
    {
      principle: "Auditoría de light clients",
      detail:
        "Los light clients de cada chain soportada son auditados independientemente. Un bug en un light client no afecta a los demás.",
    },
  ],
  quantumMigration: {
    why: "BTC, ETH, SOL y otras chains usan ECDSA o Ed25519 — vulnerables a Shor. Cuando una computadora cuántica con suficiente qubits lógicos sea operacional, cada clave pública expuesta puede ser rota. $1.5T+ en capital está en riesgo.",
    how: [
      {
        step: 1,
        action: "Detección temprana",
        detail:
          "RSTN monitorea el avance de hardware cuántico. Cuando se alcance el umbral de riesgo (estimado a 5-10 años), se activa el programa.",
      },
      {
        step: 2,
        action: "Ventana de migración on-chain",
        detail:
          "Se abre un período (ej. 12 meses) donde los usuarios pueden migrar. El timestamp se registra en la blockchain — es inmutable.",
      },
      {
        step: 3,
        action: "Transferencia al vault / lock / burn",
        detail:
          "BTC: el usuario transfiere su BTC a la dirección P2WSH del comité RSTN (threshold ECDSA 51-de-100). ETH nativo: el usuario bloquea su ETH en un contrato de lock verificable (no se quema — ETH nativo no tiene función burn). ERC-20s (USDC, USDT): el usuario quema los tokens con burn() en el contrato origen. SOL: el usuario quema sus tokens en un programa de burn. La transferencia/lock/burn es la prueba de posesión — solo quien controla la clave puede autorizarla.",
      },
      {
        step: 4,
        action: "Verificación vía light client",
        detail:
          "Los validadores RSTN verifican la transferencia usando light clients de la chain origen (SPV para BTC, sync committee para ETH). Para BTC: 6 confirmaciones. Para ETH: finality epoch. Sin verificación, no hay emisión.",
      },
      {
        step: 5,
        action: "Emisión respaldada 1:1",
        detail:
          "RSTN emite wBTC/wETH a una nueva dirección Dilithium3 del usuario. El token está respaldado 1:1 por el activo bloqueado en el vault o quemado. La clave ECDSA original ya no controla ese activo — aunque un QC la rompa, no hay nada que robar.",
      },
      {
        step: 6,
        action: "Cierre de ventana",
        detail:
          "Tras el período, las direcciones no migradas se consideran comprometidas. Limitación honesta: las monedas abandonadas (claves perdidas) no pueden migrarse — solo el propietario puede iniciar la transferencia. El vault sigue custodiando los activos migrados — siempre redimibles.",
      },
    ],
    uniqueness:
      "Ninguna otra blockchain ofrece un programa formal de migración cuántica. Bitcoin y Ethereum no tienen plan para esto. Cuando la amenaza sea real, RSTN será el refugio — y el puente ya estará construido.",
    timeline:
      "El programa se activa cuando la investigación cuántica alcance un nivel de riesgo crítico (estimado 2030-2035 por expertos del campo). La infraestructura del puente se construye desde el mainnet para estar lista.",
  },
} as const;

// ─── Cross-Shard Atomicity — Formal specification ───────────────────────────
export const CROSS_SHARD_SPEC = {
  model: "Lock-and-Commit de 2 fases (2PC) con rollback atómico",
  principle:
    "Si cualquier shard involucrado en una transacción cross-shard falla, se hace rollback completo. No hay débitos sin créditos. La atomicidad está garantizada por el protocolo, no por los contratos.",
  phases: [
    {
      phase: "1. Lock (Prepare)",
      detail:
        "Shard A recibe la transacción cross-shard. Bloquea los fondos en un escrow temporal (locked state). Genera un mensaje cross-shard firmado con Dilithium3 dirigido al Shard B. El estado bloqueado no es gastable por otras transacciones.",
    },
    {
      phase: "2. Commit/Rollback",
      detail:
        "Shard B recibe el mensaje cross-shard, verifica la firma Dilithium3, y acredita los fondos. Si Shard B confirma → commit (ambos shards actualizan estado definitivo). Si Shard B falla, rechaza, o timeout → rollback (Shard A libera el escrow). Atomicidad garantizada.",
    },
  ],
  hotspotProblem:
    "El hotspot problem ocurre cuando la mayoría del tráfico va a un solo shard (ej: el shard donde está el DEX más popular). Eso satura ese shard y desperdicia los otros 63.",
  hotspotSolution: [
    {
      mechanism: "Migración de hotspots por gobernanza",
      detail:
        "Si un shard supera el 80% de capacidad por más de 1 epoch, la gobernanza puede migrar contratos populares a shards menos saturados. El estado del contrato se transfiere vía cross-shard receipts atómicos.",
    },
    {
      mechanism: "Sharding dinámico",
      detail:
        "El número de shards activos se ajusta dinámicamente. Si hay poco tráfico, 32 shards activos. Si hay pico, 64. Los validadores se redistribuyen automáticamente.",
    },
    {
      mechanism: "Routing inteligente",
      detail:
        "El mempool enruta transacciones a shards con menos carga cuando es posible (ej: transfers simples van al shard menos saturado del destinatario). Los contratos populares no pueden cambiar de shard automáticamente — requiere gobernanza.",
    },
  ],
  contendedState:
    "Para DeFi con estado muy disputado (ej: un pool de liquidez con 1000 swaps/s), el shard del contrato se convierte en bottleneck. Solución: (1) migración a shard dedicado, (2) rollups internos que agregan transacciones off-chain y las settle on-chain, (3) access lists para paralelizar transacciones independientes dentro del mismo shard.",
  limitation:
    "Limitación honesta: el cross-shard atomicity garantiza que no hay débitos sin créditos, pero NO garantiza latencia baja para transacciones cross-shard. Una transacción que toca 2 shards tarda mínimo 2 bloques (lock + commit). Para DeFi de alta frecuencia, los devs deben diseñar contratos que operen dentro de un solo shard cuando sea posible.",
} as const;

// ─── Threshold ECDSA Throughput — Solution to the bottleneck ───────────────
export const THRESHOLD_THROUGHPUT = {
  problem:
    "Threshold ECDSA con 100 firmantes vía MPC produce ~1 firma por minuto. Si 1M usuarios quieren migrar BTC en 12 meses, eso es ~2,740/día. Un solo comité de 100 firmantes no soporta ese volumen.",
  solution:
    "Múltiples comités paralelos (estilo tBTC v2). En vez de 1 comité de 100 firmantes, RSTN usa N comités de 100 firmantes cada uno. Cada comité custodia un vault P2WSH independiente. Los depósitos se distribuyen round-robin entre comités activos.",
  capacity: [
    {
      committees: 1,
      throughput: "~1,440 tx/día",
      usersIn12Months: "~525K usuarios",
      note: "Insuficiente para migración masiva",
    },
    {
      committees: 10,
      throughput: "~14,400 tx/día",
      usersIn12Months: "~5.2M usuarios",
      note: "Suficiente para migración inicial",
    },
    {
      committees: 50,
      throughput: "~72,000 tx/día",
      usersIn12Months: "~26M usuarios",
      note: "Suficiente para migración masiva global",
    },
  ],
  scaling:
    "El número de comités se ajusta dinámicamente. Cuando el flujo de migración aumenta, la gobernanza activa más comités. Cada comité adicional añade ~1,440 tx/día de capacidad. Los firmantes se seleccionan aleatoriamente del pool de validadores con stake mínimo. No hay solapamiento entre comités — un validador pertenece a máximo 1 comité a la vez.",
  securityTradeoff:
    "Más comités = más superficie de ataque, pero cada comité es independiente. Comprometer 1 comité de 100 no compromete los otros. El threshold 51-de-100 se mantiene por comité. El riesgo de colusión no aumenta linealmente — cada comité es una isla.",
  honestLimitation:
    "Limitación honesta: incluso con 50 comités, migrar 100M direcciones de Bitcoin tomaría ~4 años. La migración cuántica no es instantánea — es un proceso gradual. La ventana de migración debe ser de varios años, no meses. Esto es una realidad técnica, no una promesa.",
} as const;

// ─── Bridge Economics — Modelo 60/30/10 + Transparencia ────────────────────
export const BRIDGE_ECONOMICS = {
  model: "Híbrido 60/30/10 — Buyback & Burn + Stakers + Reserva de Seguridad",
  principle:
    "Cada fee del puente se divide en 3 destinos verificables on-chain. No es promesa — es código ejecutable en el contrato del puente.",
  feeStructure: {
    standardRate: "0.15% del valor transferido",
    fastPathRate: "+0.05% adicional (opcional, confirmación prioritaria)",
    quantumMigrationRate: "0% — gratis (diferenciador, genera volumen)",
    rationale:
      "0.15% es el estándar de la industria. No explota al usuario. La migración es gratis para maximizar volumen — el volumen alimenta el burn.",
  },
  revenueSplit: [
    {
      destination: "Buyback & Burn de RSTN",
      percentage: 60,
      color: "hsl(150 100% 45%)",
      detail:
        "Compra RSTN en DEX (orden limitada, no market) y lo quema enviándolo a dead address. Evento on-chain verificable. Reduce supply circulante.",
    },
    {
      destination: "Recompensa a Stakers",
      percentage: 30,
      color: "hsl(150 100% 45%)",
      detail:
        "Distribuido a stakers proporcional al stake. No es inflación — es revenue real del puente. Crea círculo virtuoso: más uso → más fees → más yield → más staking → más seguridad.",
    },
    {
      destination: "Reserva de Seguridad (bug bounty + incidentes)",
      percentage: 10,
      color: "hsl(150 70% 50%)",
      detail:
        "Fondo de emergencia para compensar usuarios si hay un bug. Auditorías anuales. Bug bounty. Wormhole no tenía esto — tardó meses en compensar.",
    },
  ],
  deflationaryPressure: {
    eip1559:
      "Cada transacción en RSTN quema 50% del gas base (como Ethereum EIP-1559)",
    bridgeBurn: "60% de cada fee del puente compra y quema RSTN",
    scarcityMechanism:
      "Dos fuentes de escasez técnica simultáneas: burn de gas + burn de bridge revenue. El supply decrece con el uso real.",
    notGuaranteed:
      "La reducción de supply depende del volumen real del puente. Si el volumen es bajo, el burn es mínimo. No prometemos apreciación del precio — es un efecto técnico de escasez.",
  },
  transparency: {
    principle: "Cada burn es verificable on-chain. Cero opacidad.",
    dashboard: [
      {
        metric: "Volumen del puente (24h)",
        source: "Contrato del puente — suma de transferencias",
        verifiable: true,
      },
      {
        metric: "Fees recolectadas (24h)",
        source: "Contrato del puente — acumulador on-chain",
        verifiable: true,
      },
      {
        metric: "RSTN comprado en buyback",
        source: "DEX swap events — hash verificable",
        verifiable: true,
      },
      {
        metric: "RSTN quemado total",
        source: "Dead address balance — público",
        verifiable: true,
      },
      {
        metric: "Distribuido a stakers",
        source: "Staking contract — eventos de transfer",
        verifiable: true,
      },
      {
        metric: "Reserva de Seguridad acumulada",
        source: "Security reserve address — saldo público",
        verifiable: true,
      },
    ],
    cadence:
      "Buyback semanal. Cada semana el contrato ejecuta: acumula fees → compra RSTN en DEX → quema → emite evento on-chain. La comunidad puede auditar cada ejecución.",
    antiFraud:
      "Si el equipo intenta desviar fees, el contrato lo impide — el split 60/30/10 está hardcodeado. La gobernanza puede ajustar el split, pero requiere >67% de identidades verificadas y delay de 30 días.",
  },
  legal: {
    notSecurity:
      "RSTN no garantiza rendimiento. No promete que el token aprecie. El burn es un mecanismo de escasez técnica, no una promesa de ganancia. Consulte asesoría legal independiente sobre la clasificación del token en su jurisdicción.",
    noGuaranteedYield:
      "El rendimiento de stakers es VARIABLE y depende del volumen real del puente. No es un APY fijo garantizado. Las recompensas de staking son compensación por el servicio de validación, no una ganancia de inversión.",
    howeyTest:
      "RSTN se distribuye por trabajo y participación (Proof of Participation), no por inversión de dinero. No hay venta de tokens en ninguna forma. La clasificación legal definitiva depende de cada jurisdicción y debe ser evaluada por un abogado especializado.",
  },
} as const;

// ─── Bridge Transparency Dashboard Data ────────────────────────────────────
export const BRIDGE_TRANSPARENCY = {
  title: "Dashboard de Transparencia — Bridge Economics",
  subtitle: "Cada métrica es verificable on-chain. Cero opacidad.",
  stats: [
    {
      label: "Volumen puente (24h)",
      value: "$10.2M",
      note: "Simulado — datos reales en mainnet",
      color: "hsl(150 100% 45%)",
    },
    {
      label: "Fees recolectadas (24h)",
      value: "$15,300",
      note: "0.15% × $10.2M",
      color: "hsl(150 100% 45%)",
    },
    {
      label: "RSTN quemado (buyback)",
      value: "234,567",
      note: "60% de fees → buyback → burn",
      color: "hsl(150 100% 55%)",
    },
    {
      label: "Distribuido a stakers",
      value: "$4,590",
      note: "30% de fees",
      color: "hsl(150 70% 50%)",
    },
  ],
  weeklyBurns: [
    {
      week: "Semana 47",
      fees: "$48,200",
      resistBurned: "187,432",
      resistPrice: "$0.257",
      txHash: "0x7f3a9b2c4e8d1f6a...",
    },
    {
      week: "Semana 46",
      fees: "$42,100",
      resistBurned: "163,820",
      resistPrice: "$0.257",
      txHash: "0x3c8e1d5a7b9f0024...",
    },
    {
      week: "Semana 45",
      fees: "$51,400",
      resistBurned: "199,845",
      resistPrice: "$0.258",
      txHash: "0xa1b2c3d4e5f60081...",
    },
    {
      week: "Semana 44",
      fees: "$38,900",
      resistBurned: "151,354",
      resistPrice: "$0.257",
      txHash: "0xf0e1d2c3b4a50072...",
    },
  ],
  note: "Datos simulados para demostración. En mainnet, cada valor se lee del contrato del puente y del DEX en tiempo real. Cualquier nodo puede verificar.",
} as const;

// ─── Supply History — circulating supply evolution ──────────────────────────
export const SUPPLY_HISTORY = {
  maxSupply: 1_000_000_000,
  currentCirculating: 987_421_830,
  totalBurned: 12_578_170,
  burnRate: "~234K RSTN/semana (promedio)",
  epochs: [
    { epoch: "Génesis", supply: 1_000_000_000, burned: 0, label: "Q2 2028" },
    {
      epoch: "Epoch 1",
      supply: 999_812_547,
      burned: 187_453,
      label: "Q3 2028",
    },
    {
      epoch: "Epoch 2",
      supply: 999_598_201,
      burned: 401_799,
      label: "Q4 2028",
    },
    {
      epoch: "Epoch 3",
      supply: 999_341_875,
      burned: 658_125,
      label: "Q1 2029",
    },
    {
      epoch: "Epoch 4",
      supply: 999_034_210,
      burned: 965_790,
      label: "Q2 2029",
    },
    {
      epoch: "Epoch 5",
      supply: 998_672_098,
      burned: 1_327_902,
      label: "Q3 2029",
    },
    {
      epoch: "Epoch 6",
      supply: 998_251_640,
      burned: 1_748_360,
      label: "Q4 2029",
    },
    {
      epoch: "Epoch 7",
      supply: 997_768_321,
      burned: 2_231_679,
      label: "Q1 2030",
    },
    {
      epoch: "Epoch 8",
      supply: 997_216_503,
      burned: 2_783_497,
      label: "Q2 2030",
    },
    {
      epoch: "Epoch 9",
      supply: 996_590_847,
      burned: 3_409_153,
      label: "Q3 2030",
    },
    {
      epoch: "Epoch 10",
      supply: 995_884_930,
      burned: 4_115_070,
      label: "Q4 2030",
    },
    {
      epoch: "Epoch 11",
      supply: 995_093_654,
      burned: 4_906_346,
      label: "Q1 2031",
    },
    {
      epoch: "Epoch 12",
      supply: 994_211_030,
      burned: 5_788_970,
      label: "Q2 2031",
    },
    {
      epoch: "Epoch 13",
      supply: 993_230_875,
      burned: 6_769_125,
      label: "Q3 2031",
    },
    {
      epoch: "Epoch 14",
      supply: 992_146_403,
      burned: 7_853_597,
      label: "Q4 2031",
    },
    {
      epoch: "Epoch 15",
      supply: 990_949_821,
      burned: 9_050_179,
      label: "Q1 2032",
    },
    {
      epoch: "Epoch 16",
      supply: 989_632_540,
      burned: 10_367_460,
      label: "Q2 2032",
    },
    {
      epoch: "Epoch 17",
      supply: 988_187_305,
      burned: 11_812_695,
      label: "Q3 2032",
    },
    {
      epoch: "Actual",
      supply: 987_421_830,
      burned: 12_578_170,
      label: "Q4 2032",
    },
  ],
} as const;

// ─── Buyback Events Feed — eventos de buyback recientes ─────────────────────
export const BUYBACK_EVENTS = [
  {
    id: 1,
    week: "Semana 47",
    feesUsd: 48200,
    resistPurchased: 187432,
    resistBurned: 187432,
    resistPrice: 0.257,
    txHash: "0x7f3a9b2c4e8d1f6a",
    status: "ejecutado",
    timestamp: "2024-11-25T14:00:00Z",
  },
  {
    id: 2,
    week: "Semana 46",
    feesUsd: 42100,
    resistPurchased: 163820,
    resistBurned: 163820,
    resistPrice: 0.257,
    txHash: "0x3c8e1d5a7b9f0024",
    status: "ejecutado",
    timestamp: "2024-11-18T14:00:00Z",
  },
  {
    id: 3,
    week: "Semana 45",
    feesUsd: 51400,
    resistPurchased: 199845,
    resistBurned: 199845,
    resistPrice: 0.258,
    txHash: "0xa1b2c3d4e5f60081",
    status: "ejecutado",
    timestamp: "2024-11-11T14:00:00Z",
  },
  {
    id: 4,
    week: "Semana 44",
    feesUsd: 38900,
    resistPurchased: 151354,
    resistBurned: 151354,
    resistPrice: 0.257,
    txHash: "0xf0e1d2c3b4a50072",
    status: "ejecutado",
    timestamp: "2024-11-04T14:00:00Z",
  },
  {
    id: 5,
    week: "Semana 43",
    feesUsd: 44600,
    resistPurchased: 173541,
    resistBurned: 173541,
    resistPrice: 0.257,
    txHash: "0x9d8c7b6a5e4f0033",
    status: "ejecutado",
    timestamp: "2024-10-28T14:00:00Z",
  },
  {
    id: 6,
    week: "Semana 42",
    feesUsd: 35200,
    resistPurchased: 136965,
    resistBurned: 136965,
    resistPrice: 0.257,
    txHash: "0x2b3c4d5e6f70044",
    status: "ejecutado",
    timestamp: "2024-10-21T14:00:00Z",
  },
  {
    id: 7,
    week: "Semana 48",
    feesUsd: 0,
    resistPurchased: 0,
    resistBurned: 0,
    resistPrice: 0.258,
    txHash: null,
    status: "pendiente",
    timestamp: "2024-12-02T14:00:00Z",
  },
] as const;

// ─── Revenue Breakdown — desglose de ingresos por fuente ────────────────────
export const REVENUE_SOURCES = [
  {
    source: "Bridge fees (cruce de activos)",
    monthlyUsd: 450000,
    annualUsd: 5400000,
    share: 72,
    color: "hsl(150 100% 45%)",
  },
  {
    source: "Gas fees (transacciones on-chain)",
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

// ─── Bilingual variants (EN) for terminal views ─────────────────────────────
// Spanish remains the default (above). These EN variants let the terminal
// render the same data in English, matching the i18n landing terminology.

export const NETWORK_STATS_EN = {
  ...NETWORK_STATS,
  signatureScheme: "CRYSTAL-Dilithium3 + Ed25519 (hybrid)",
} as const;

export const TOKENOMICS_EN = [
  {
    allocation: "Staking & Validators (Fair Launch)",
    percentage: 95,
    color: "hsl(150 100% 45%)",
    description:
      "Distributed via Proof of Participation from genesis. No pre-sale. You contribute work (node, code, audit) → you receive RSTN. The team has NO reserved bucket: it operates the genesis validator and earns RSTN from this bucket for being the first to do the bootstrap work, just as Satoshi mined the first BTC. Pure Satoshi model: 0% reserved, 100% earned by work.",
  },
  {
    allocation: "Testnet Airdrop (Bootstrap seed)",
    percentage: 5,
    color: "hsl(150 60% 40%)",
    description:
      "The only pre-allocated bucket: a bootstrap seed delivered once to those who ran testnet nodes (verified work). The PoS equivalent of Satoshi's first miners. Not transferable to founders. No ecosystem fund, no capturable treasury: the remaining 95% is earned by work.",
  },
] as const;

export const GENESIS_DISTRIBUTION_EN = {
  mechanism: "Proof of Participation (PoP)",
  principle:
    "You don't sell tokens. You reward work. If you never sell anything, there is nothing to regulate.",
  noSale: "Zero token sale. Zero ICO. Zero pre-sale. Zero VCs.",
  howItWorks: [
    {
      phase: "Testnet Phase 1-2",
      action: "Run a validator node on testnet",
      reward: "Testnet RSTN + participation snapshot",
    },
    {
      phase: "Testnet Phase 2-3",
      action: "Contribute code, audit, build dApps, document",
      reward: "RSTN grants for verified contribution",
    },
    {
      phase: "Mainnet genesis",
      action:
        "Testnet participation snapshot → proportional mainnet RSTN distribution",
      reward: "Mainnet RSTN proportional to work contributed",
    },
    {
      phase: "Post-genesis",
      action: "Continuous staking + consensus participation",
      reward: "Variable block rewards based on network performance",
    },
  ],
  antiWhale:
    "No initial accumulation. Distribution is proportional to work, not capital. A participant who ran a node for 6 months receives more than one who arrived 1 week before the snapshot.",
  legalShield:
    "Proof of Participation rewards verifiable real work, not capital investment. Rewards are the result of network contribution, not expectation of profit.",
} as const;

export const GENESIS_DETAIL_EN = {
  totalSupply: "1,000,000,000 RSTN",
  principle:
    "All tokens exist from the genesis block. None are created. None are sold. They are distributed by work and participation. The team has no reserved bucket — it earns RSTN by operating the genesis validator (Satoshi model).",
  noIco:
    "Zero ICO. Zero pre-sale. Zero VC. Zero token sale in any form. Zero team allocation.",
  allocations: [
    {
      bucket: "Proof of Participation (Staking pool)",
      amount: "950,000,000 RSTN (95%)",
      mechanism:
        "Testnet participation snapshot. You ran a node, contributed code, audited, documented → you receive RSTN proportional to work. The team operates the genesis validator and earns from this bucket for being the first to do the bootstrap work (Satoshi model). Distribution is released with halving every 4 years (not all at once). Pure Satoshi model: 0% reserved, 95% earned by work.",
      legal: "Not a sale. A reward for verifiable work.",
    },
    {
      bucket: "Testnet Airdrop (Bootstrap seed)",
      amount: "50,000,000 RSTN (5%)",
      mechanism:
        "The only pre-allocated bucket: a bootstrap seed delivered once to those who ran testnet nodes (verified work). The PoS equivalent of Satoshi's first miners. Not transferable to founders. No ecosystem fund, no capturable treasury.",
      legal: "Reward for verifiable participation, not investment.",
    },
  ],
  genesisBlock: {
    description:
      "The genesis block contains the complete initial state: all allocations, consensus parameters and seed nodes. There is no team vesting contract — the team has no reserved bucket.",
    hash: "Calculated at launch — contains the Merkle root of all allocations",
    auditability:
      "Anyone can verify the genesis respects the announced distribution. The Merkle root proves no extra tokens were created and no team bucket was reserved.",
  },
} as const;

import { MONETARY_POLICY_EN } from "./protocolMonetary";
export { MONETARY_POLICY_EN } from "./protocolMonetary";

export const PROTOCOL_LICENSE_EN = {
  license: "Apache 2.0",
  repository: "To be announced",
  disclaimer:
    "RSTN is experimental open-source software. It is not an investment. There is no guarantee of value. RSTN tokens may lose all their value. Staking participation carries slashing risk. Blockchain transactions are irreversible. Use at your own risk. Consult legal advice regarding token classification in your jurisdiction.",
  patentClause:
    "Apache 2.0 includes defensive patent grant — contributors grant a patent license to users.",
} as const;

export const TOKEN_UTILITY_EN = [
  {
    use: "Transaction gas",
    detail:
      "Each transaction and smart contract execution requires RSTN as gas. Deflationary: 50% of gas is permanently burned per transaction.",
  },
  {
    use: "On-chain governance",
    detail:
      "1 RSTN = 1 quadratically weighted vote. Holders propose and vote on protocol changes, network parameters and treasury use.",
  },
  {
    use: "Validator staking",
    detail:
      "32,000 RSTN to become a validator. The network's economic security depends on the total stake committed.",
  },
  {
    use: "Liquid delegation",
    detail:
      "From 1 RSTN, any holder can delegate to a validator and receive proportional rewards without running hardware.",
  },
] as const;

// Language selector helpers for the terminal views
export function getTokenomics(lang: string) {
  return lang === "es" ? TOKENOMICS : TOKENOMICS_EN;
}
export function getGenesisDistribution(lang: string) {
  return lang === "es" ? GENESIS_DISTRIBUTION : GENESIS_DISTRIBUTION_EN;
}
export function getGenesisDetail(lang: string) {
  return lang === "es" ? GENESIS_DETAIL : GENESIS_DETAIL_EN;
}
export function getMonetaryPolicy(lang: string) {
  return lang === "es" ? MONETARY_POLICY : MONETARY_POLICY_EN;
}
export function getProtocolLicense(lang: string) {
  return lang === "es" ? PROTOCOL_LICENSE : PROTOCOL_LICENSE_EN;
}
export function getTokenUtility(lang: string) {
  return lang === "es" ? TOKEN_UTILITY : TOKEN_UTILITY_EN;
}
