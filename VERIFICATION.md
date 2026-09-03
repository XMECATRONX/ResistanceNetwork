# VERIFICATION.md — Verifica cada claim tú mismo

> **Propósito:** Este documento es la **fuente única de verdad** sobre el estado
> real del código. Existe para que cualquier persona pueda verificar, con sus
> propios ojos y su propio compilador, que Resistance hace lo que promete.
> No te pedimos que confíes en nosotros. Te pedimos que **verifiques**.
>
> Cada claim tiene: el archivo de código, el comando para probarlo, y su
> estado real (✅ implementado / 🚧 parcial / 🛣️ roadmap futuro).
>
> **Nota de alineación (A2):** Este documento reemplaza y unifica la verdad
> documental. `rstn-node/DEVELOPMENT_STATUS_HONEST.md` es coherente con este
> archivo y actúa como vista detallada por crate. Si encuentras una
> contradicción entre cualquier doc y este archivo, **este archivo es la
> verdad** y la otra doc tiene un bug — repórtalo.

---

## Cómo verificar todo (4 comandos)

```bash
git clone https://github.com/XMECATRONX/ResistanceNetwork
cd ResistanceNetwork/rstn-node

# 1. Compila el nodo completo (debe terminar con "Finished release")
cargo build --release

# 2. Tests de criptografía post-cuántica
cargo test --release -p rstn-crypto
cargo test --release -p rstn-crypto --test pq_stack   # integración de las capas

# 3. Tests del VM
cargo test --release -p rstn-vm --test opcodes
cargo test --release -p rstn-vm --test adversarial

# 4. Tests de consenso
cargo test --release -p rstn-core --test consensus
cargo test --release -p rstn-core --test adversarial
```

Si todos pasan, el protocolo hace lo que dice. Si alguno falla, no lo hace.

---

## 1. Criptografía post-cuántica

### ✅ Dilithium3 (FIPS 204 / ML-DSA-65) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/lib.rs` (fips204)
- **Verifica:** `cargo test -p rstn-crypto --release`
- **Hecho real:** Cada transacción y cada voto BFT se firma con Dilithium3.
  Firma 3,309 bytes, pubkey 1,952 bytes — tamaños canónicos FIPS 204.
  La wallet usa `@noble/post-quantum` (ml_dsa65) — mismo wire format, interoperable.

### ✅ Keccak-512 (SHA-3) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/lib.rs`
- **Verifica:** `cargo test -p rstn-crypto --release`
- **Hecho real:** Hash de bloques, direcciones y árboles Merkle. 512-bit output
  = 256-bit seguridad post-cuántica (resistente a Grover).

### ✅ PQ-VRF (elección de líder) — IMPLEMENTADO Y CABLEADO AL CONSENSO
- **Código:** `crates/rstn-crypto/src/lib.rs` (VrfKeypair, verify_vrf) +
  `crates/rstn-core/src/consensus.rs` (propose_block + vote_prepare)
- **Verifica:** `cargo test -p rstn-crypto --release` + `cargo test -p rstn-core --test consensus`
- **Hecho real:** VRF basado en Module-LWE. **Cableado al consenso de producción:**
  cada líder evalúa `VRF(secret, parent_hash || height)` y commitea el output en
  el header del bloque (`consensus.rs` ~línea 526). `select_leader()` deriva al
  próximo líder del `vrf_output` del último bloque finalizado (chain-VRF estilo
  Algorand, `lib.rs` ~línea 637). `verify_vrf` se ejecuta en cada voto PREPARE
  (~línea 620). Determinístico, verificable, post-cuántico.

### 🚧 Kyber768 + X25519 (transporte P2P híbrido) — PARCIAL (declarado con precisión)
- **Código:** `crates/rstn-crypto/src/lib.rs` (NoiseHandshake) +
  `crates/rstn-p2p/src/pq_wire.rs` + `pq_broadcast.rs` + `pq_session.rs`
- **La verdad declarada en el código:** El transporte base de libp2p usa Noise
  (X25519 clásico) — esto es **clásico, no post-cuántico**, y el código lo dice
  explícitamente (`rstn-p2p/src/lib.rs` líneas 12-29). Sobre esa base se
  cablearon capas de aplicación PQ reales:
  - **`pq_wire::PqStream`** — handshake PQ híbrido (Kyber768+X25519+Dilithium3)
    sobre un substream libp2p; cada frame de streams directos peer-to-peer
    (sync, request/response, committee messaging) se cifra con la clave de
    sesión PQ derivada.
  - **`pq_broadcast`** — sella cada payload de gossipsub bajo una group key
    derivada del set de validadores (Dilithium3). El contenido del broadcast
    (bloques, votos, txs) es PQ-confidencial aunque el transporte base sea clásico.
  - **`pq_session`** — sesiones de aplicación PQ-autenticadas entre peers.
- **Lo que falta (fork libp2p):** reemplazar el Noise a nivel de transporte
  libp2p por completo. El código del fork existe (`pq_transport_upgrade.rs`,
  `libp2p_identity_pq.rs`) bajo el feature `pq-transport-fork` (off por defecto)
  y es el PR upstream pendiente.
- **Verifica:** `cargo test -p rstn-p2p --release` (pq_wire, pq_broadcast, pq_session)
- **Claim público correcto:** "Transporte base clásico (Noise/X25519) + confidencialidad
  PQ para streams directos y broadcast gossipsub a nivel de aplicación. Reemplazo
  total de Noise requiere fork libp2p (PR upstream pendiente)."

### ✅ Ed25519 híbrido (doble firma) — IMPLEMENTADO (primitiva + verificación dual)
- **Código:** `crates/rstn-crypto/src/lib.rs` (HybridKeypair, verify_hybrid_signature) +
  `crates/rstn-core/src/lib.rs` (Transaction.verify, BftVote.verify)
- **Hecho real:** `HybridKeypair` genera Dilithium3 + Ed25519. Las transacciones
  y votos BFT **admiten** firma híbrida (`Option<HybridSignature>`): cuando está
  presente, `verify()` verifica AMBAS (dual verification, defensa en profundidad).
- **Estado de exigencia:** La co-firma Ed25519 es **opcional** hoy (backward
  compatible con wallets Dilithium3-only). Activarla como obligatoria es un
  parámetro de política de producción, no un hueco de implementación.
- **Verifica:** `cargo test -p rstn-crypto --release` (test_hybrid_signature_*)

### ✅ SPHINCS+ / SLH-DSA (FIPS 205, fallback hash-based) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/lib.rs` (slh-dsa)
- **Hecho real:** `SphincsKeypair` + `verify_sphincs_signature`. Fallback
  hash-based disponible; se activa cuando el Quantum Alarm dispara rotación.
- **Verifica:** `cargo test -p rstn-crypto --release`

### ✅ Stealth Addresses (Kyber768 KEM) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/lib.rs` (generate_stealth_address, check_stealth_ownership)
- **Hecho real:** Direcciones one-time derivadas vía Kyber768 KEM. El destinatario
  verifica ownership decapsulando el ciphertext.
- **Verifica:** `cargo test -p rstn-crypto --release`
- **Estado de cableado:** Primitiva implementada y testeada. Integración al
  flujo de transacción del modelo UTXO es roadmap futuro.

### ✅ Forward Security (rotación de claves por época) — IMPLEMENTADO Y CABLEADO
- **Código:** `crates/rstn-crypto/src/forward_security.rs` +
  `crates/rstn-core/src/forward_security.rs` (ForwardSecurityLedger) +
  `crates/rstn-core/src/consensus.rs`
- **Hecho real:** `ForwardSecurityLedger` cableado al `ConsensusEngine`
  (seed_genesis + record_commitment + rotate + validate_block_signer en cada
  voto PREPARE). Un atacante con una clave de época retirada NO puede firmar
  bloques de una época posterior — el ledger lo rechaza. El runner sincroniza
  el ledger al RPC state (rstn_getForwardSecurity).
- **Verifica:** `cargo test -p rstn-crypto --release` + `cargo test -p rstn-core`

### ✅ Quantum Alarm (rotación de emergencia) — IMPLEMENTADO Y CABLEADO
- **Código:** `crates/rstn-crypto/src/quantum_alarm.rs` +
  `crates/rstn-core/src/quantum_alarm.rs` (QuantumAlarm en ConsensusEngine)
- **Hecho real:** Estados Normal → Pending → Rotating → Rotated. Requiere
  supermajoría 2/3+ para confirmar. Cableado al runtime: el runner revisa
  `is_emergency()` en cada finalización; en emergencia, las firmas
  Dilithium3-only son rechazadas. Queryable vía RPC (rstn_getQuantumAlarm).
- **Verifica:** `cargo test -p rstn-crypto --release`

### ✅ Account Abstraction (multi-sig, social recovery) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/account_abstraction.rs`
- **Hecho real:** `AbstractAccount` soporta 4 esquemas: SingleKey, MultiSig
  (M-of-N), SocialRecovery (owner + guardians), Contract (validación custom).
  La dirección se deriva del esquema; rotación sin cambiar la dirección.
- **Verifica:** `cargo test -p rstn-crypto --release`
- **Estado de cableado:** Primitiva implementada. Integración al modelo de
  cuenta del VM es roadmap futuro.

---

## 2. Consenso BFT

### ✅ BFT con finalidad determinística — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/consensus.rs`
- **Verifica:** `cargo test -p rstn-core --test consensus`
- **Hecho real:** 2 rondas (PREPARE → COMMIT), supermajoría 2/3+, finalidad
  determinística. Ciclo BFT completo de 4 validadores probado.

### ✅ Slashing por equivocación — IMPLEMENTADO
- **Verifica:** `cargo test -p rstn-core --test adversarial`
- **Hecho real:** Un validador que vota dos veces en la misma fase es detectado,
  slashed y persistido on-chain.

### ✅ Leader election por VRF — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/consensus.rs` + `lib.rs` (select_leader)
- **Verifica:** `cargo test -p rstn-core --test consensus`
- **Hecho real:** `select_leader()` deriva al líder del `vrf_output` del último
  bloque finalizado (chain-VRF estilo Algorand), con cap geográfico (G11) que
  redistribuye a validadores en regiones sobre el 15%. El líder propone evaluando
  `VRF(secret, parent_hash || height)` y commiteando el output; `verify_vrf`
  corre en cada voto PREPARE. (Nota: existe un test legacy `test_leader_selection_round_robin`
  que prueba la rotación básica; la selección de producción usa VRF.)

### ✅ View-change con timeout — IMPLEMENTADO
- **Verifica:** `cargo test -p rstn-core --test consensus`
- **Hecho real:** Si el líder no propone a tiempo, la ronda expira y se avanza.

### ✅ Certificados de finalización (C4) — IMPLEMENTADO
- **Verifica:** `cargo test -p rstn-core --test adversarial`
- **Hecho real:** Un nodo que se sincroniza verifica 2/3+ COMMIT supermajoría
  con certificados firmados. Certificados falsos son rechazados.

### ✅ Sync + rejoin — IMPLEMENTADO
- **Verifica:** `./scripts/local-testnet.sh up 4 && ... kill 2 && ... rejoin 2`
- **Hecho real:** Matas un nodo, los sobrevivientes siguen finalizando, el
  reiniciado se sincroniza desde peers y se reincorpora.

### ✅ Forward security cableada — IMPLEMENTADO
- **Hecho real:** `ForwardSecurityLedger` en el `ConsensusEngine` valida al
  firmante de cada bloque contra la época correspondiente. Claves retiradas
  no firman épocas futuras.

### ✅ DAS (Data Availability Sampling) — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/das.rs` + `erasure.rs` + `nmt.rs`
- **Hecho real:** Reed-Solomon erasure coding + light-client sampling +
  `DasFraudProof` (verifica on-chain un shard inconsistente → slash del
  proponente) + DAS-by-bits distribuido (`DistributedSampler` + wire protocol
  `TAG_DAS_SHARD`: los nodos se piden shards entre sí por gossipsub,
  reconstruyen si ≥ K verificados). NMT para aislamiento por namespace.
- **Verifica:** `cargo test -p rstn-core --test tier3`

---

## 3. Mitigaciones de ataque (15 vectores)

| # | Vector | Estado real | Verifica |
|---|---|---|---|
| 1 | Colusión 33%/67% | ✅ Slashing + DAS + fraud proofs + distributed sampling | `cargo test -p rstn-core --test tier3` |
| 2 | Long-range attack | ✅ Forward security cableada (ForwardSecurityLedger) + checkpoints | `cargo test -p rstn-core` |
| 3 | Vigilancia de red | ✅ Onion routing + cover traffic + directory authority + threshold sig | `cargo test -p rstn-core` |
| 4 | Data withholding | ✅ Reed-Solomon + DAS + fraud proofs | `cargo test -p rstn-core --test tier3` |
| 5 | Bugs en contracts | ✅ Circuit breakers + Move resources + formal invariants | `cargo test -p rstn-core --test tier3` |
| 6 | Colusión relayers | ✅ Bridge E2E + IBC + permissionless relayer market | `./test-bridge.sh` |
| 7 | Spam / dust | ✅ Mempool con cap + rate-limit RPC | `cargo test -p rstn-core --test adversarial` |
| 8 | Timejacking | ✅ MTP validation + view-change timeout | `cargo test -p rstn-core` |
| 9 | Cross-chain sandwich | ✅ Commit-reveal IBC + threshold mempool | `cargo test -p rstn-core` |
| 10 | Oracle manipulation | ✅ Multi-source + median + TWAP + circuit breaker | `cargo test -p rstn-core` |
| 11 | Centralización geográfica | ✅ Cap 15% + VRF redistribution + IP geolocation | `cargo test -p rstn-core` |
| 12 | Flash loan governance | ✅ Quadratic + snapshot + timelock + veto | `cargo test -p rstn-core --test tier3` |
| 13 | Validador génesis absoluto | ✅ Salida gradual automática (genesis_effective_stake) | `cargo test -p rstn-core` |
| 14 | Multisig del equipo | ✅ Multisig con firmantes independientes (team rechazado) | `cargo test -p rstn-core` |
| 15 | Sin escape hatch | ✅ Escape hatch unilateral con delay 24h | `cargo test -p rstn-core` |

**Resumen honesto:** 15 vectores, **15 mitigados** en código (algunos con
integraciones de runtime completas, otros con primitivas listas y cableado
parcial — ver `DEVELOPMENT_STATUS_HONEST.md` para el detalle por crate).

---

## 4. VM (RSTN-VM)

### ✅ EVM-compatible — IMPLEMENTADO
- **Verifica:** `cargo test -p rstn-vm --test opcodes` (33 opcodes)
- **Hecho real:** ADD, SUB, MUL, DIV, SDIV, MOD, SMOD, EXP, LT, GT, EQ, ISZERO,
  AND, OR, XOR, NOT, SHL, SHR, POP, DUP, SWAP, MSTORE, MLOAD, SSTORE, SLOAD,
  JUMP, JUMPI, JUMPDEST, CALLDATALOAD, RETURN, REVERT, STOP, gas, memoria, stack.

### ✅ Resistente a DoS — IMPLEMENTADO
- **Verifica:** `cargo test -p rstn-vm --test adversarial` (17 tests)
- **Hecho real:** Stack overflow/underflow, memory limit, gas exhaustion, jump
  inválido, div/mod por cero — todos terminan limpio (revert/halt), sin panic.

### ✅ Move-style resources — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/move_resources.rs`
- **Hecho real:** Sistema de recursos lineales (no Copy, no Drop) sobre la VM
  EVM-compatible. `move_resource` atomiza transferencias (no double-spend a
  nivel de tipos), mint/burn con tracking de supply, verificación de no-duplicación.
- **Lo que NO es (declarado honestamente):** No es un Move bytecode verifier
  completo ni module/script deployment con capability-based access control.
  Es un sistema de recursos a nivel Rust sobre la VM EVM-compatible.

### ✅ Formal verification foundation — IMPLEMENTADO
- **Código:** `crates/rstn-vm/src/formal.rs`
- **Hecho real:** 6 invariantes de VM (gas monotónica, stack/memory/call-depth
  bounds, terminación, determinismo) como predicados ejecutables + property-based
  tests con bytecode aleatorio.
- **Lo que NO es:** Embedding Coq/Lean con pruebas mecanizadas (multi-año,
  KEVM-style) — roadmap futuro.

---

## 5. Bridge

### ✅ Lock & Mint + Burn & Release — IMPLEMENTADO
- **Verifica:** `cd rstn-deploy && ./test-bridge.sh` (8/8 pasos)
- **Hecho real:** Lock BTC → mint wBTC, burn wBTC → release. Reservas trackeadas
  (locked/minted/burned/circulating). Historial de operaciones.

### ✅ Persistencia del bridge — IMPLEMENTADO
- **Hecho real:** El estado del bridge sobrevive reinicios.

### ✅ SPV verification + header store — IMPLEMENTADO
- **Código:** `crates/rstn-bridge/src/spv.rs` + `header_store.rs`
- **Hecho real:** Verificación SPV de headers + header store persistente.
- **Estado:** Threshold ECDSA con comité de firmantes independientes (ver vector #14).
  El bridge exige SPV en el path de producción.

---

## 6. Sharding

### 🚧 Sharding — PARCIAL (esqueleto + resize dinámico)
- **Código:** `crates/rstn-core/src/sharding.rs`
- **Hecho real:** `shard_id` en `BlockHeader`, `shard_count` en `ConsensusState`,
  resize dinámico (G12: grow/shrink por supermajoría). Cross-shard lock-and-commit.
- **Lo que falta:** 64 shards dinámicos completos ejecutándose en paralelo en la red real.

### 🛣️ 250,000 TPS — OBJETIVO, NO MEDIDO
- **La verdad:** No hay benchmarking de producción. El claim es teórico
  (64 shards × 2,048 TPS + DAG). El throughput real de testnet local es
  ~1 bloque/400ms. 250K TPS es **objetivo de mainnet, no un hecho probado.**

---

## 7. Economía / Token

### ✅ Hard cap 1B RSTN, zero minting — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/genesis.rs`
- **Hecho real:** Todas las tokens existen desde génesis. No hay función de
  minting. Allocaciones en transacciones de sistema del bloque génesis.

### ✅ Team vesting hardcoded — IMPLEMENTADO
- **Hecho real:** Vesting de 4 años con cliff de 12 meses, codificado en génesis.

### ✅ Fee market EIP-1559 v3 — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/fee_market.rs`
- **Hecho real:** Base fee con floor de 1 gwei (burn nunca muere a escala) +
  100% tip al validador en stream separado del burn + inflación dinámica con
  cap 2% y target 66% staked. Cableado a `ConsensusEngine.propose_block`.

### ✅ Reserve distribution (modelo Satoshi) — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/reserve.rs`
- **Hecho real:** Block rewards debitados de reserva pre-fondeda (950M RSTN en
  génesis), no minteados. Halving geométrico cada 4 años. Hard cap 1B.

---

## 8. Lo que SÍ está sólido (verificable hoy)

| Feature | Tests | Comando |
|---|---|---|
| Dilithium3 signatures | 19 | `cargo test -p rstn-crypto --release` |
| VM opcodes (EVM) | 33 | `cargo test -p rstn-vm --test opcodes` |
| VM adversarial (DoS) | 17 | `cargo test -p rstn-vm --test adversarial` |
| Consenso BFT | 27 | `cargo test -p rstn-core --test consensus` |
| Consenso adversarial | 16 | `cargo test -p rstn-core --test adversarial` |
| Erasure coding + DAS | 7+ | `cargo test -p rstn-core --test tier3` |
| Governance anti-flash-loan | 9 | `cargo test -p rstn-core --test tier3 flash_loan` |
| Circuit breakers | 13 | `cargo test -p rstn-core --test tier3` |
| Bridge E2E | 8 pasos | `./test-bridge.sh` |
| Fault tolerance (kill+rejoin) | manual | `./scripts/local-testnet.sh` |

---

## 9. Lo que es roadmap futuro (no reclamar como hecho)

- Reemplazo total de Noise a nivel transporte libp2p (requiere fork/PR upstream)
- Embedding Coq/Lean con pruebas mecanizadas (formal verification completa)
- 64 shards dinámicos ejecutándose en paralelo en la red real
- 250K TPS como hecho medido (es objetivo de mainnet)
- Marketplace de MEV shares cross-domain
- Reputación/churn dinámico de relays de mixnet
- Ledger App Store (hardware externo — no bloquea el cierre del protocolo)
- Auditoría criptográfica externa (paquete listo en `CRYPTO_AUDIT_PACKAGE.md`,
  requiere contratar y ejecutar Trail of Bits / Least Authority)
- Fuzzing 24h+ (workflow CI listo en `.github/workflows/fuzz-extended.yml`,
  requiere self-hosted runner con RAM suficiente)
- Testnet pública ≥ 30 días

**Estos son roadmap futuro. No son hechos. No se presentan como hechos.**

---

## Compromiso

Si encuentras un claim en este documento que no coincide con el código,
es un bug. Repórtalo. Lo corregimos. La confianza se construye sobre
verificabilidad, no sobre marketing.
