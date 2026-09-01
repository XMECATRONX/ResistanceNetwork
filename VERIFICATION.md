# VERIFICATION.md — Verifica cada claim tú mismo

> **Propósito:** Este documento existe para que cualquier persona pueda verificar,
> con sus propios ojos y su propio compilador, que Resistance hace lo que promete.
> No te pedimos que confíes en nosotros. Te pedimos que **verifiques**.
>
> Cada claim tiene: el archivo de código, el comando para probarlo, y su
> estado real (✅ implementado / 🚧 parcial / ❌ no implementado).

---

## Cómo verificar todo (4 comandos)

```bash
git clone https://github.com/XMECATRONX/RESISTANCE
cd RESISTANCE/rstn-node

# 1. Compila el nodo completo (debe terminar con "Finished release")
cargo build --release

# 2. Tests de criptografía post-cuántica (6 capas: Dilithium3, Keccak, VRF,
#    hybrid sigs, SPHINCS+, stealth, forward security, quantum alarm, account abstraction)
cargo test --release -p rstn-crypto
cargo test --release -p rstn-crypto --test pq_stack   # integración de las 6 capas

# 3. Tests del VM (33 opcodes + 17 adversariales)
cargo test --release -p rstn-vm --test opcodes
cargo test --release -p rstn-vm --test adversarial

# 4. Tests de consenso (27 + 16 adversariales)
cargo test --release -p rstn-core --test consensus
cargo test --release -p rstn-core --test adversarial
```

Si todos pasan, el protocolo hace lo que dice. Si alguno falla, no lo hace.

---

## 1. Criptografía post-cuántica

### ✅ Dilithium3 (FIPS 204 / ML-DSA-65) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/lib.rs` líneas 47-140
- **Dependencia:** `fips204` (implementación oficial del estándar NIST FIPS 204)
- **Verifica:** `cargo test -p rstn-crypto --release` (19 tests de firma/verificación)
- **Hecho real:** Cada transacción y cada voto BFT se firma con Dilithium3.
  La firma (3309 bytes) y la pubkey (1952 bytes) son los tamaños canónicos FIPS 204.
  La wallet usa `@noble/post-quantum` (ml_dsa65) — mismo wire format, interoperable.

### ✅ Keccak-512 (SHA-3) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/lib.rs` líneas 31-45
- **Verifica:** `cargo test -p rstn-crypto --release`
- **Hecho real:** Hash de bloques, direcciones y árboles Merkle. 512-bit output
  = 256-bit seguridad post-cuántica (resistente a Grover).

### ✅ PQ-VRF (elección de líder) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/lib.rs` líneas 142-241
- **Verifica:** `cargo test -p rstn-crypto --release`
- **Hecho real:** VRF basado en Dilithium3 para elección de líder. Determinístico,
  verificable, post-cuántico. El output se deriva del proof (no se puede sustituir).

### 🚧 Kyber768 + X25519 (transporte P2P híbrido) — PARCIAL
- **Código:** `crates/rstn-crypto/src/lib.rs` líneas 243-330 (handshake implementado)
- **La verdad:** El handshake post-cuántico (Kyber768 KEM + X25519 ECDH + HKDF)
  **está implementado y es criptográficamente correcto**. PERO no está cableado al
  transporte libp2p — libp2p no expone un plugin de Noise post-cuántico. El
  transporte real usa libp2p Noise (X25519 clásico). El handshake PQ opera a
  nivel de aplicación/consenso.
- **Verifica:** `cargo test -p rstn-crypto --release` (tests del handshake pasan)
- **Lo que NO es:** No es pq-noise end-to-end en el wire. Es un follow-up técnico,
  no un claim de seguridad falso — el código lo dice explícitamente en
  `crates/rstn-p2p/src/lib.rs` líneas 12-19.

### ✅ Ed25519 híbrido (doble firma) — IMPLEMENTADO (primitiva)
- **Código:** `crates/rstn-crypto/src/lib.rs` líneas 553-626
- **Hecho real:** `HybridKeypair` genera Dilithium3 + Ed25519. `verify_hybrid_signature`
  verifica AMBAS firmas. Si cualquiera falla, la verificación falla.
- **Verifica:** `cargo test -p rstn-crypto --release` (test_hybrid_signature_sign_and_verify)
- **⚠️ NO cableado al consenso:** El consenso BFT usa solo Dilithium3 (no híbrido).
  La primitiva existe y es correcta, pero las transacciones reales no exigen co-firma
  Ed25519 todavía. Es defensa en profundidad disponible para activarse.

### ✅ SPHINCS+ / SLH-DSA (FIPS 205, fallback hash-based) — IMPLEMENTADO (primitiva)
- **Código:** `crates/rstn-crypto/src/lib.rs` líneas 628-698
- **Hecho real:** `SphincsKeypair` + `verify_sphincs_signature`. Firma de 17,088 bytes,
  pubkey de 32 bytes. Hash-based (no depende de lattice assumptions).
- **Verifica:** `cargo test -p rstn-crypto --release` (test_sphincs_signature_sign_and_verify)
- **⚠️ NO cableado al consenso:** Es un fallback disponible. Se activa cuando el
  Quantum Alarm dispara la rotación de esquema.

### ✅ Stealth Addresses (Kyber768 KEM) — IMPLEMENTADO (primitiva)
- **Código:** `crates/rstn-crypto/src/lib.rs` líneas 700-739
- **Hecho real:** `generate_stealth_address` encapsula contra Kyber768 pubkey del
  destinatario. La dirección one-time se deriva del shared secret. El destinatario
  verifica ownership con `check_stealth_ownership` (decapsula el ciphertext).
- **Verifica:** `cargo test -p rstn-crypto --release` (test_stealth_address_generation_and_ownership)
- **⚠️ NO cableado a transacciones:** Las transacciones actuales no usan stealth
  addresses. La primitiva existe para futura integración con el modelo UTXO.

### ✅ Forward Security (rotación de claves por época) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/forward_security.rs`
- **Hecho real:** `ForwardSecureKeypair` genera claves frescas por época. Las firmas
  se bindan a la época (sign(epoch || message)). Claves viejas no pueden firmar
  épocas nuevas → previene ataques de largo alcance.
- **Verifica:** `cargo test -p rstn-crypto --release` (6 tests de forward security)
- **⚠️ NO cableado al consenso:** El consenso actual rota líder por altura pero no
  rota claves por época. La primitiva está lista para integrarse.

### ✅ Quantum Alarm (rotación de emergencia) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/quantum_alarm.rs`
- **Hecho real:** `QuantumAlarm` con estados Normal → Pending → Rotating → Rotated.
  Requiere supermajoría (2/3+) para confirmar. Cualquier validador puede levantar
  la alarma. Una vez confirmada, la red entra en rotación de esquema.
- **Verifica:** `cargo test -p rstn-crypto --release` (7 tests del quantum alarm)
- **⚠️ NO cableado on-chain:** El estado del alarm no se persiste en bloques todavía.

### ✅ Account Abstraction (multi-sig, social recovery) — IMPLEMENTADO
- **Código:** `crates/rstn-crypto/src/account_abstraction.rs`
- **Hecho real:** `AbstractAccount` soporta 4 esquemas: SingleKey, MultiSig (M-of-N),
  SocialRecovery (owner + guardians), Contract (validación custom en VM). La dirección
  se deriva del esquema. Se puede rotar el esquema sin cambiar la dirección.
- **Verifica:** `cargo test -p rstn-crypto --release` (11 tests de account abstraction)
- **⚠️ NO cableado al VM:** Las cuentas actuales usan single-key. La abstracción
  está lista para integrarse con el modelo de cuenta del VM.
- **Acción requerida:** O implementar el fallback, o marcarlo como roadmap futuro.

### ❌ Stealth PQ addresses — NO IMPLEMENTADO
- **Claim del frontend:** "Direcciones stealth post-cuánticas (one-time)"
- **La verdad:** Las direcciones son `last_20_bytes(Keccak-512(pubkey))` —
  determinísticas de la pubkey, no stealth/one-time. No hay esquema stealth.
- **Verifica:** `crates/rstn-crypto/src/lib.rs` función `derive_address`

### ❌ Quantum Alarm — NO IMPLEMENTADO
- **Claim del frontend:** "On-chain quantum alarm + auto-rotation"
- **La verdad:** No hay código de quantum alarm. No hay estado de emergencia
  on-chain ni auto-rotación. Es diseño conceptual, no implementación.

### ❌ Account Abstraction post-cuántica — NO IMPLEMENTADO
- **Claim del frontend:** "Account abstraction con claves Dilithium3"
- **La verdad:** No hay account abstraction. Las cuentas son el modelo
  estándar (pubkey → address). No hay contratos-cuenta que validen firmas PQ.

---

## 2. Consenso BFT

### ✅ BFT con finalidad determinística — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/consensus.rs`
- **Verifica:** `cargo test --release -p rstn-core --test consensus` (27 tests)
- **Hecho real:** 2 rondas (PREPARE → COMMIT), supermajoría 2/3+, finalidad
  determinística. Ciclo BFT completo de 4 validadores probado.

### ✅ Slashing por equivocación — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/consensus.rs` `detect_and_slash_equivocation`
- **Verifica:** `cargo test --release -p rstn-core --test adversarial` (test_equivocation_*)
- **Hecho real:** Un validador que vota dos veces en la misma fase es detectado
  y slashed. El slashing se persiste on-chain.

### ✅ Rotación de líder — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/consensus.rs` `select_leader`
- **Verifica:** `cargo test --release -p rstn-core --test consensus` (test_leader_rotation)
- **Hecho real:** Rotación round-robin por altura. (Nota: el VRF está implementado
  en crypto pero la selección de líder actual usa round-robin, no VRF aleatorio.
  El VRF es para uso futuro en producción.)

### ✅ View-change con timeout — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/consensus.rs`
- **Verifica:** `cargo test --release -p rstn-core --test consensus` (test_view_timeout, test_advance_view_backoff)
- **Hecho real:** Si el líder no propone a tiempo, la ronda expira y se avanza.

### ✅ Certificados de finalización (C4) — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/lib.rs` `CommitCertificate`
- **Verifica:** `cargo test --release -p rstn-core --test adversarial` (test_commit_certificate_*)
- **Hecho real:** Un nodo que se sincroniza verifica 2/3+ COMMIT supermajoría
  con certificados firmados. Certificados falsos/firmados-mal son rechazados.

### ✅ Sync + rejoin — IMPLEMENTADO
- **Verifica:** `./scripts/local-testnet.sh up 4 && ./scripts/local-testnet.sh kill 2 && ./scripts/local-testnet.sh rejoin 2`
- **Hecho real:** Matas un nodo, los 3 sobrevivientes siguen finalizando, el
  nodo reiniciado se sincroniza desde peers y se reincorpora. Probado en vivo.

### 🚧 Forward security (rotación de claves por época) — PARCIAL
- **La verdad:** El consenso avanza por épocas, pero la rotación automática de
  claves de validador por época no está completamente cableada. Las claves
  de validador son estáticas desde génesis en la implementación actual.

### ❌ DAS (Data Availability Sampling) — NO IMPLEMENTADO
- **Claim:** "Muestreo sub-lineal de validadores"
- **La verdad:** No hay DAS. La base (erasure coding) sí está implementada
  (ver sección 3), pero el sampling aleatorio de light clients no.

### ❌ Social checkpointing — NO IMPLEMENTADO
- **Claim:** "Checkpoints firmados que los nodos nuevos usan como ancla"
- **La verdad:** No hay código de checkpointing social. Los nodos nuevos
  sincronizan desde génesis.

---

## 3. Mitigaciones de ataque (los 12 vectores)

| # | Vector | Claim | Estado real | Verifica |
|---|---|---|---|---|
| 1 | Colusión 33%/67% | DAS sub-linear | ❌ No hay DAS | — |
| 2 | Long-range attack | Forward security + checkpoints | 🚧 Forward security parcial, sin checkpoints | — |
| 3 | Vigilancia de red | Onion routing | ❌ No implementado | — |
| 4 | Data withholding | Reed-Solomon + DAS | 🚧 Erasure coding ✅, DAS ❌ | `cargo test -p rstn-core --test tier3 erasure_` |
| 5 | Bugs en contracts | Formal verification + circuit breakers | 🚧 Circuit breakers ✅, formal verif ❌ | `cargo test -p rstn-core --test tier3 drain_` |
| 6 | Colusión relayers | Permissionless relayer market | 🚧 El bridge funciona, mercado permissionless no | `./test-bridge.sh` |
| 7 | Spam / dust | Stake-weighted mempool + hashcash | 🚧 Mempool con cap ✅, hashcash ❌ | `cargo test --release -p rstn-core --test adversarial` (test_mempool_*) |
| 8 | Timejacking | Bounded NTP + MTP | 🚧 Validación de timestamp en consenso ✅, MTP ❌ | — |
| 9 | Cross-chain sandwich | Commit-reveal | ❌ No implementado | — |
| 10 | Oracle manipulation | Multi-source + median + breaker | 🚧 Circuit breaker de oráculo ✅, multi-source ❌ | `cargo test -p rstn-core --test tier3 oracle_` |
| 11 | Centralización geográfica | 15% cap + VRF | ❌ No implementado | — |
| 12 | Flash loan governance | Quadratic + snapshot + veto | ✅ Implementado | `cargo test -p rstn-core --test tier3 flash_loan` |

**Resumen honesto:** de 12 vectores, **1 está completamente mitigado** (flash loan),
**6 están parcialmente mitigados**, y **5 no tienen mitigación implementada**.

---

## 4. VM (RSTN-VM)

### ✅ EVM-compatible — IMPLEMENTADO
- **Código:** `crates/rstn-vm/src/lib.rs`
- **Verifica:** `cargo test --release -p rstn-vm --test opcodes` (33 opcodes)
- **Hecho real:** ADD, SUB, MUL, DIV, SDIV, MOD, SMOD, EXP, LT, GT, EQ, ISZERO,
  AND, OR, XOR, NOT, SHL, SHR, POP, DUP, SWAP, MSTORE, MLOAD, SSTORE, SLOAD,
  JUMP, JUMPI, JUMPDEST, CALLDATALOAD, RETURN, REVERT, STOP, gas, memoria, stack.

### ✅ Resistente a DoS — IMPLEMENTADO
- **Verifica:** `cargo test --release -p rstn-vm --test adversarial` (17 tests)
- **Hecho real:** Stack overflow, stack underflow, memory limit, gas exhaustion,
  jump inválido, div/mod por cero, calldataload fuera de rango — todos terminan
  limpio (revert o halt), sin panic. Fuzzing de bytecode aleatorio no crashea.

### ❌ Move resources — NO IMPLEMENTADO
- **Claim:** "EVM + Move resources, ejecución paralela"
- **La verdad:** La VM es EVM-compatible. No hay Move. No hay resources lineales.
  No hay ejecución paralela con access lists.

### ❌ Formal verification nativa — NO IMPLEMENTADO
- **Claim:** "Formal verification estilo Move"
- **La verdad:** No hay formal verification. Los circuit breakers son el
  sustituto práctico (limitan el daño de un bug).

---

## 5. Bridge

### ✅ Lock & Mint + Burn & Release — IMPLEMENTADO
- **Verifica:** `cd rstn-deploy && ./test-bridge.sh` (8/8 pasos)
- **Hecho real:** Lock BTC → mint wBTC, burn wBTC → release. Reservas
  trackeadas (locked/minted/burned/circulating). Historial de operaciones.

### ✅ Persistencia del bridge — IMPLEMENTADO
- **Código:** `crates/rstn-storage/src/lib.rs` `put_bridge_state` / `get_bridge_state`
- **Hecho real:** El estado del bridge sobrevive reinicios. Verificado: tras
  reiniciar el testnet, las reservas persisten (completed_ops se mantiene).

### ❌ Threshold ECDSA (51/100) — NO IMPLEMENTADO
- **Claim:** "Bitcoin bridge con threshold ECDSA 51/100 + SPV"
- **La verdad:** El bridge actual es un modelo de testnet (auto-ejecuta con
  1 firma en modo testnet). No hay threshold ECDSA, no hay SPV light client,
  no hay comité de 100 firmantes. Es diseño, no implementación.

### ❌ Light clients (SPV / sync committee) — NO IMPLEMENTADO
- **La verdad:** No hay verificación criptográfica de depósitos externos.
  El bridge confía en el operador en modo testnet.

---

## 6. Sharding

### 🚧 Sharding — PARCIAL
- **Código:** `shard_id` en `BlockHeader`, `shard_count` en `ConsensusState`
- **La verdad:** Los bloques tienen un `shard_id` y el estado trackea
  `shard_count`. Pero no hay 64 shards dinámicos, no hay cross-shard
  lock-and-commit atomicity, no hay ejecución paralela entre shards.
  Es el esqueleto, no la implementación.

### ❌ 250,000 TPS — NO VERIFICADO
- **Claim:** "250,000 TPS (64 shards × 2,048 TPS + DAG)"
- **La verdad:** No hay benchmarking. No hay DAG de bloques paralelos. El
  throughput real no se ha medido. El claim es teórico, no probado.

---

## 7. Economía / Token

### ✅ Hard cap 1B RSTN, zero minting — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/genesis.rs` (allocaciones hardcodeadas)
- **Hecho real:** Todas las tokens existen desde génesis. No hay función de
  minting. Las allocaciones están en transacciones de sistema del bloque génesis.

### ✅ Team vesting hardcoded — IMPLEMENTADO
- **Código:** `crates/rstn-core/src/genesis.rs` `encode_vesting_contract`
- **Hecho real:** Vesting de 4 años con cliff de 12 meses, codificado en el
  bloque génesis. No se puede alterar después de génesis.

### 🚧 Fee burn 50% — PARCIAL
- **La verdad:** La estructura de fee split (50/30/20) está en el diseño pero
  la quema real de gas no está completamente cableada en la ejecución.

### ❌ Staking 32,000 RSTN — NO VERIFICADO
- **La verdad:** El staking existe conceptualmente pero el mínimo de 32,000
  RSTN no está hardcodeado como requisito de validador en el código actual.

---

## 8. Lo que SÍ está sólido (verificable hoy)

| Feature | Tests | Comando |
|---|---|---|
| Dilithium3 signatures | 19 | `cargo test -p rstn-crypto --release` |
| VM opcodes (EVM) | 33 | `cargo test -p rstn-vm --test opcodes` |
| VM adversarial (DoS) | 17 | `cargo test -p rstn-vm --test adversarial` |
| Consenso BFT | 27 | `cargo test -p rstn-core --test consensus` |
| Consenso adversarial | 16 | `cargo test -p rstn-core --test adversarial` |
| Erasure coding | 7 | `cargo test -p rstn-core --test tier3 erasure_` |
| Governance anti-flash-loan | 9 | `cargo test -p rstn-core --test tier3 flash_loan` |
| Circuit breakers | 13 | `cargo test -p rstn-core --test tier3` |
| Bridge E2E | 8 pasos | `./test-bridge.sh` |
| Fault tolerance (kill+rejoin) | manual | `./scripts/local-testnet.sh` |

**Total: 141 tests automatizados + 8 pasos E2E + fault tolerance en vivo.**

---

## 9. Lo que NO está sólido (no reclamar como hecho)

- Ed25519 híbrido (doble firma)
- SPHINCS+ fallback
- Stealth addresses
- Quantum alarm
- Account abstraction
- DAS completo
- Social checkpointing
- Forward security completa
- Onion routing
- Formal verification
- Threshold ECDSA bridge
- Light clients (SPV/sync committee)
- 64 shards dinámicos
- Cross-shard atomicity
- 250K TPS (sin benchmark)
- Commit-reveal cross-chain
- 15% cap geográfico
- Hashcash anti-spam
- MTP validation

**Estos son roadmap futuro. No son hechos. No se presentan como hechos.**

---

## Compromiso

Si encuentras un claim en este documento que no coincide con el código,
es un bug. Repórtalo. Lo corregimos. La confianza se construye sobre
verificabilidad, no sobre marketing.
