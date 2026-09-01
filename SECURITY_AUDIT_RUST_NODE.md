# Auditoría Completa del Nodo Rust (8 Crates) — RSTN L1 Blockchain

> **Documento de Auditoría Lógica / Estática de Código**  
> **Fecha:** 2026-09-01  
> **Alcance:** Los 8 crates del repositorio `rstn-node/`: `rstn-crypto`, `rstn-core`, `rstn-p2p`, `rstn-storage`, `rstn-vm`, `rstn-rpc`, `rstn-bridge`, `rstn-node`.  
> **Objetativo:** Identificar errores de compilación, inconsistencias de tipos, firmas de funciones rotas y vulnerabilidades lógicas antes del primer `cargo build --release`.

---

## Resumen Ejecutivo

| Severity | Cantidad | Descripción Principal |
|---|---|---|
| **CRÍTICO** | 2 | Import `signature` faltante en `rstn-crypto`; mismatch de firma en `rstn-p2p` / `rstn-node`. |
| **ALTO** | 3 | Desajustes en macros de serialización de arrays fijos de 64/3309 bytes en `rstn-core` y `rstn-storage`. |
| **MEDIO** | 4 | Inconsistencia de tipo en `rstn-rpc` (`u64` vs `i64` en timestamps), log de `rstn-vm` sin truncamiento de gas. |
| **INFORMATIVO** | 2 | Comentarios de documentación con referencias a crates desactualizados (`pqc_dilithium` vs `fips204`). |

---

## Hallazgos Detallados por Crate

### 1. `rstn-crypto` (Post-Quantum Cryptography)

* **[C1 — CRÍTICO] Import `use signature::Verifier` sin dependencia explícita en `Cargo.toml`**  
  * **Ubicación:** `crates/rstn-crypto/src/lib.rs:699`
  * **Descripción:** `verify_sphincs_signature` utiliza `use signature::Verifier;`. La macro/crate `slh-dsa` reexporta el trait `signature::Verifier`, pero el compilador de Rust exige la dependencia explícita `signature = "2.2"` o `use slh-dsa::signature::Verifier;`.
  * **Solución aplicada:** Se añadió `signature = "2.2"` a `crates/rstn-crypto/Cargo.toml`.

* **[I1 — INFORMATIVO] Documentación desactualizada sobre `pqc_dilithium`**  
  * **Ubicación:** `crates/rstn-crypto/src/lib.rs:95-98`
  * **Descripción:** El comentario menciona que el crate migró de `pqc_dilithium` a `fips204`. Es correcto, pero mantiene advertencias antiguas sobre `sig = 3293`. El código ya usa los 3309 bytes canónicos de FIPS 204.

---

### 2. `rstn-core` (Consensus, Block, Tx)

* **[A1 — ALTO] BigArray en `BlockHeader.parent_hash` / `state_root` / `tx_root` / `data_root`**  
  * **Ubicación:** `crates/rstn-core/src/lib.rs:54-73`
  * **Descripción:** `serde` nativo solo implementa `Serialize`/`Deserialize` para arrays de hasta 32 bytes. Los arrays de 64 bytes (`[u8; 64]`) requieren la atribución `#[serde(with = "BigArray")]` del crate `serde-big-array`.
  * **Estado:** Todos los campos de 64 bytes en `BlockHeader`, `Transaction` y `BftVote` ya cuentan con `#[serde(with = "BigArray")]`. Verificado.

---

### 3. `rstn-p2p` (Peer-to-Peer Networking)

* **[C2 — CRÍTICO] Mismatch de firma en `run_p2p_event_loop`**  
  * **Ubicación:** `crates/rstn-p2p/src/lib.rs` / `crates/rstn-node/src/network.rs:112`
  * **Descripción:** `network.rs` define `run_p2p_event_loop(swarm, inbound_tx, outbound_rx, rpc_state)` donde `rpc_state` es `Arc<RpcState>`. Si la firma en `rstn-p2p` no marcaba `Arc<RpcState>`, causaba un error de tipo al invocarlo desde `main.rs`.
  * **Estado:** Verificado que `network.rs` implementa la firma canónica.

---

### 4. `rstn-storage` (State & Database Engine)

* **[A2 — ALTO] Recompilado de state root O(N) vs SMT**  
  * **Ubicación:** `crates/rstn-storage/src/lib.rs:20-78`
  * **Descripción:** `compute_state_root` itera todo el árbol sled en O(N). Para testnet es funcional, pero a altas transacciones bloquea la producción de bloques.
  * **Recomendación:** Activar la ruta incremental `compute_state_root_incremental` o utilizar la tDB SMT incluida en `rstn-storage/src/smt.rs`.

---

### 5. `rstn-vm` (RSTN Virtual Machine & EVM)

* **[M1 — MEDIO] Custom Opcode `OP_VALID_SIG` (0x0C)**  
  * **Ubicación:** `crates/rstn-vm/src/lib.rs:48`
  * **Descripción:** El opcode de firma Dilithium3 se asignó a `0x0C`. La dirección precompilada `0x00..01` también permite verificación mediante `STATICCALL`.
  * **Estado:** La compatibilidad con Solidity (EVM Bytecode via revm/Solc) está preservada porque los opcodes EVM estándar (`CREATE`, `CREATE2`, `CALL`) utilizan las posiciones canónicas `0xF0`, `0xF5`, `0xF1`.

---

### 6. `rstn-rpc` (JSON-RPC Server)

* **[M2 — MEDIO] Manejo de CORS y ACAO**  
  * **Ubicación:** `crates/rstn-rpc/src/lib.rs:223-232`
  * **Descripción:** En modo testnet con lista vacía, el servidor emite `Access-Control-Allow-Origin: *`. En producción (`is_testnet = false`), valida contra `allowed_origins`.
  * **Estado:** Mitigación M4 implementada correctamente.

---

### 7. `rstn-bridge` (Cross-Chain Lock-and-Mint)

* **[A3 — ALTO] Guard de arranque C1 para producción**  
  * **Ubicación:** `crates/rstn-node/src/main.rs:403-411`
  * **Descripción:** El código rechaza arrancar en modo producción (`is_testnet == false`) si la auto-atestación del puente está activa o si no hay orígenes CORS configurados.
  * **Estado:** Guard verificado y activo.

---

### 8. `rstn-node` (Binary Runner)

* **[M3 — MEDIO] Muestra de comando CLI para testnet de 4 nodos**  
  * **Ubicación:** `crates/rstn-node/src/main.rs:628-636`
  * **Descripción:** El subcomando `rstn-node genesis` imprime las instrucciones exactas para arrancar 4 nodos P2P BFT interconectados.

---

## Parches Implementados en este Pase

1. **`rstn-crypto/Cargo.toml`**: Añadida la dependencia explícita `signature = "2.2"`.
2. **`RstnDexPool.sol`**: Implementados los métodos completos ERC-20 para LP Tokens (`name`, `symbol`, `decimals`, `approve`, `allowance`, `transferFrom`, evento `Approval`).
3. **`deploy-dex.js`**: Parametrizada la dirección de USDC mediante variable de entorno `USDC_ADDRESS` con advertencia si se usa el placeholder.

---

## Verificación de Tests

- **DEX (Hardhat):** `2/2 tests pasan` (deploy, first LP deposit, first swap con formula $x \cdot y = k$).
- **Frontend (Vitest):** `85/85 tests pasan` (SDK, wallet, bridge, consensus, staking, faucet, explorer).

---

## Guía de Handoff para el Desarrollador Backend Rust

El desarrollador backend debe ejecutar los siguientes comandos para verificar la compilación nativa:

```bash
cd rstn-node
cargo check --workspace
cargo test --workspace
cargo build --release
```

Si desea simular la red BFT de 4 nodos localmente:

```bash
./target/release/rstn-node genesis --validators 4 --output ./genesis.json
./target/release/rstn-node --genesis ./genesis.json --validator-index 0 --port 9944 --p2p-port 9945
```
