# RSTN — Tier 3: Estado real vs. roadmap futuro (honest)

Este documento registra qué feature Tier 3 (los más difíciles) está
**implementado y verificado** vs. qué es **investigación futura**.
No se presentan aspiraciones como hechos. Cada claim se puede verificar
contra el código.

---

## ✅ IMPLEMENTADO Y VERIFICADO (código real, tests adversariales)

### Reed-Solomon erasure coding (cimientos de DAS)
- **Archivo:** `crates/rstn-core/src/erasure.rs`
- **Qué hace:** divide los datos en K shards + M parity shards sobre GF(2^8).
  Cualquier K de (K+M) shards reconstruye el dato completo. Un proponente que
  retenga datos no puede parar la red — cualquier nodo con K shards reconstruye.
- **Tests:** `tests/tier3.rs` — sobrevive pérdida de cualquier 2 shards,
  rechaza número incorrecto de shards, roundtrip de 10 KB, padding cero.
- **Qué NO es:** NO es DAS completo (sampling aleatorio de light clients,
  NMT merkle trees, fraud proofs para extensión mala). Eso es investigación
  futura más abajo.

### Governance con protección anti-flash-loan
- **Archivo:** `crates/rstn-core/src/governance.rs`
- **Qué hace:** snapshot de poder de voto al crear la propuesta (los tokens
  adquiridos después del snapshot no cuentan), votación cuadrática (peso =
  sqrt(stake)), timelock de 1 época entre aprobación y ejecución, veto de
  minoría (10%).
- **Tests:** `tests/tier3.rs` — flash loan derrotado (poder 0 al snapshot),
  ballena no domina con votación cuadrática, timelock bloquea ejecución
  inmediata, veto de minoría bloquea, doble voto rechazado, snapshot futuro
  rechazado.
- **Defensa contra:** el ataque que le costó $50M a Beanstalk (flash loan →
  votar → devolver en un bloque).

### On-chain circuit breakers
- **Archivo:** `crates/rstn-core/src/circuit_breaker.rs`
- **Qué hace:** detecta drenaje anómalo (>X% del balance en Y bloques) y
  desviación de oráculo (>X% en Y bloques) y pausa el scope afectado.
  Pausa global manual para emergencias.
- **Tests:** `tests/tier3.rs` — drenaje tripa breaker, drenaje lento acumula,
  manipulación de oráculo (subida y bajada) tripa, ventana expira permite
  nuevo drenaje, pausa global bloquea todo, recuperación vía clear.

---

## 🚧 INVESTIGACIÓN FUTURA (no implementado — no reclamar como hecho)

### Onion routing P2P (estilo Nym)
- **Por qué no:** Reescribir toda la capa P2P con Sphinx packets, mix nodes
  y cover traffic. Es el producto entero de Nym. Vac/IFT tiene roadmap
  libp2p-mix para Q2 2025 pero no es production.
- **Estado:** investigación. El transporte P2P actual usa Noise (X25519).
  Implementar onion routing requiere +200ms de latencia y una red de mix
  nodes dedicada.

### Formal verification del EVM (Coq/Lean)
- **Por qué no:** Requiere años de trabajo de un equipo de formal methods
  (Nethermind + Ethereum Foundation siguen trabajando en esto en 2025/2026).
  Nuestra VM es EVM-compatible, no Move — Move Prover no aplica.
- **Estado:** investigación. Los circuit breakers son el sustituto práctico
  actual (limitan el daño de un bug sin requerir prueba formal).

### DAS completo (sampling de light clients + NMT + fraud proofs)
- **Por qué no:** DAS completo requiere rediseñar los headers de bloque con
  NMT merkle trees, un protocolo de sampling aleatorio, y fraud proofs para
  extensión incorrecta. Celestia lo construyó sobre Tendermint en años.
- **Estado:** la base (erasure coding) está implementada. El protocolo
  completo de sampling es investigación futura.

---

## Cómo verificar cada claim

| Claim | Comando de verificación |
|---|---|
| Erasure coding funciona | `cargo test -p rstn-core --test tier3 erasure_` |
| Governance anti-flash-loan | `cargo test -p rstn-core --test tier3 flash_loan_governance` |
| Circuit breakers | `cargo test -p rstn-core --test tier3 drain_attack` |
| El resto (onion, formal, DAS completo) | No existe código — es roadmap futuro |
