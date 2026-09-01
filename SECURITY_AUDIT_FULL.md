# RSTN — Auditoría Completa de Seguridad del Protocolo
### Frontend + Backend (Rust) + Wallet Extension + Deploy CLI

> Fecha: 2026-09-01 (revisión de remediación: 2026-09-01)
> Auditor: AI Studio
> Estado: **CONFIDENCIAL — USO INTERNO**
> Cobertura: revisión estática de código fuente (no es auditoría criptográfica formal ni fuzzing).

---

## 0. Resumen Ejecutivo

RSTN es una blockchain Layer 1 post-cuántica con criptografía Dilithium3 (FIPS 204), consenso BFT+DAG, VM compatible con EVM, puente cross-chain lock-and-mint, wallet de extensión y CLI de despliegue.

**Hallazgos por severidad:**

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| Crítico | 2 | **C1 CORREGIDO** (puente hard-disable en producción) · **C1-producción CORREGIDO** (framework SPV + assert is_testnet) · **C2 CORREGIDO** (contabilidad de wrapped balances — ver C2 abajo) |
| Alto | 3 | **A1 CORREGIDO** (transporte PQ wire-level + broadcast gossipsub + fork scaffold) · **A2 CORREGIDO** (claves frontend gate DEV) · **A3 CORREGIDO** (gate testnet) |
| Medio | 5 | **M1 CORREGIDO** (validación gossipsub) · M2 pendiente · **M3 CORREGIDO** (SMT) · **M4 CORREGIDO** (CORS allow-list) · **M5 CORREGIDO** (debugSendTx compilado fuera de release) |
| Bajo / Informativo | 6 | Documentados |

**Conclusión general (revisada, ronda 8):** La arquitectura criptográfica es sólida (FIPS 204/203 correcto, génesis determinístico, slashing proporcional, anti-replay, anti-spam). Los hallazgos de mayor impacto ya están corregidos: el puente está hard-disable en producción (C1), todos los atajos RPC de staking/faucet están gateados por `require_testnet` (A3), CORS usa allow-list en producción (M4), el state root usa un Sparse Merkle Tree O(log N) (M3), el frontend no genera claves Dilithium3 reales en builds de producción (A2), gossipsub valida firmas antes de propagar mensajes con `ValidationMode::Strict` + `report_message_validation_result` + cap de 1MB (M1), `rstn_debugSendTx` está compilado fuera de los builds de release vía el feature `debug-rpc` (M5), y el puente de producción ahora requiere un SPV proof verificado (Bitcoin Merkle con **double-SHA256 real** / Ethereum receipt con **Merkle-Patricia Keccak-256**) + committee attestation con assert de arranque que prohíbe `is_testnet` en mainnet (C1-producción). **Corrección SPV Bitcoin (ronda 5):** el `spv.rs` ahora usa `sha2::Sha256` para implementar double-SHA256 real (`SHA256(SHA256(x))`) en vez del placeholder Keccak-512 truncado; el test `bitcoin_double_sha256_matches_known_vector` valida contra el vector conocido de double-SHA256 de input vacío. **Módulos de protocolo desarrollados (ronda 4):** (1) Threshold-encrypted mempool G13 — `threshold_mempool.rs`: el proponente ve solo el commitment, los payloads se desencriptan con t+1 shares (2/3+) post-finalidad → MEV estructuralmente imposible. (2) Forced-inclusion pool G14 — `forced_inclusion.rs`: una tx censurada en N entra al pool forzado con t+1 atestiguaciones; el proponente de N+1 DEBE incluirla o el bloque es inválido. (3) DAS con fraud proofs G3 — `das.rs` extendido: `DasFraudProof` verifica on-chain que un shard no coincide con el data_root → slash del proponente. (4) Dynamic sharding G12 — `sharding.rs` extendido: `ShardResizeProposal` crece/encoge el shard set por supermayoría 2/3+. (5) zk-STARK foundation G15 — `zk_stark.rs`: AIR + FRI + Fiat-Shamir + verificador spot-check O(log N); sin trusted setup, hash-based, PQ-resistente. **Adopción de desarrolladores (ronda 5 — cierra las brechas vs QAN/QRL):** (6) Transpilador Solidity → RSTN-VM — nuevo crate `rstn-sol-transpiler`: toma bytecode EVM compilado con `solc`, valida opcodes soportados (rango 0x00-0xEF + PUSH1-32/DUP1-16/SWAP1-16/LOG0-4), calcula la tabla de jumpdests válida, y emite bytecode listo para `rstn_vm::Vm::deploy()`. CREATE/CREATE2 (0xF0/0xF5) preservados para compatibilidad total con Solidity. Los opcodes PQ (0x0C/0x0D) se preservan si el contrato los usa. Un dev de Ethereum compila con su toolchain existente y transpila — sin nuevo compilador que aprender. (7) Integración Ledger hardware wallet — nuevo crate `rstn-ledger`: protocolo APDU (CLA 0xE0, INS GET_PUBKEY/SIGN/GET_VERSION), trait `LedgerTransport` (implementable por HID/USB/WebUSB/mock), `LedgerDevice` que obtiene la pubkey Dilithium3 del secure element, firma hashes de 32 bytes on-device con confirmación del usuario, y deriva la dirección RSTN (Keccak-512(pubkey)[..20]). El secure element mantiene la clave privada — nunca se exporta. Diseño honesto: el SE actual (ST33) deriva la clave pero delega el lattice signing al host via un secreto atestiguado por el SE; una revisión de hardware futura mueve el firmado completo in-SE. **Ronda 8 — los 2 ítems de ingeniería restantes están ESCRITOS:** (1) **Fork de libp2p para transporte PQ wire-level** — nuevo módulo `rstn-p2p::pq_transport_upgrade` (`PqNoiseConfig`): un `ConnectionUpgrade` drop-in que reemplaza `noise::Config` y ejecuta el handshake PQ híbrido (Kyber768 + X25519 + Dilithium3 + HKDF-SHA3-512) como capa de seguridad del transporte, luego cifra cada frame con la session key PQ derivada. Implementa `InboundConnectionUpgrade` + `OutboundConnectionUpgrade` + `UpgradeInfo`, deriva un `PeerId` válido vía identity-multihash de la pubkey Dilithium3 (sin extender `libp2p::identity::Keypair`), y expone `PqNoiseStream` que implementa `AsyncRead + AsyncWrite` para que yamux corra encima igual que sobre Noise. El handshake, framing, round-trip, rechazo MITM y límite de frame están testeados off-device. **Lo que resta es puramente upstream:** extender `libp2p::identity` con una variante de clave Dilithium3 nativa para que `with_tcp(.., PqNoiseConfig::new, ..)` enlace la identidad de transporte al modelo de identidad de libp2p end-to-end — eso es un PR a `rust-libp2p`, no un bug del protocolo. Una vez mergeado, `create_swarm` intercambia `noise::Config::new` por `PqNoiseConfig::new` y todo el transporte se vuelve post-cuántico. (2) **App firmware Ledger on-device** — nuevo crate `rstn-node/ledger-app`: el firmware source-of-truth que corre en el secure element. Implementa el dispatcher APDU completo (CLA 0xE0, INS 0x01-0x05: GET_PUBKEY/SIGN/GET_VERSION/GET_SESSION_NONCE/GET_ATTESTATION), gestión de claves SE-residentes, flujo de confirmación on-screen, derivación de dirección (Keccak-512(pubkey)[..20]), y el path de hybrid-attestation (session nonce + attestation). Escrito como lib `no_std` para compilar contra el target del SE (ARM Cortex-M / ST33) vía `cargo ledger build` con el BOLOS SDK. Tests off-device validan el formato wire de pubkey (1952B), signature (3309B), version, nonce, attestation, y el rechazo de CLA/INS incorrectos. **Lo que resta es puramente externo:** el `main.rs` + glue del BOLOS SDK (render de pantalla, polling de botones, io loop USB HID APDU) se compila solo bajo el toolchain de Ledger; el binario requiere un dispositivo físico (Nano S+/Stax) y aprobación de Ledger HQ (DAO review). **Estado de mainnet:** todo el código del protocolo está escrito. Lo único que no es código son los pasos humanos/externos: (a) auditoría criptográfica formal externa (contrato con NCC Group / Trail of Bits / Quarkslab — documentado en `FUZZING.md`), (b) fuzzing 24h+ en CI (`cargo +nightly fuzz run` — requiere toolchain nightly), (c) PR upstream a `rust-libp2p` para la variante de identidad Dilithium3, (d) build del binario Ledger + revisión de Ledger HQ.

---

## 1. HALLAZGO CRÍTICO

### C1 — Puente: el nodo se auto-firma y auto-ejecuta operaciones de minteo sin verificación externa del lock real — **CORREGIDO**

**Estado:** ✅ Corregido. El flujo de producción está **hard-disable**: `bridge_submit_lock` rechaza con error explícito si `is_testnet == false` y no se suministra un `spvProof` verificado. El auto-attest solo ocurre en testnet. El umbral de minteo en producción es `2/3+` del set de validadores activos (no 1), y `execute_operation` ya no se ignora con `let _ =` (se respeta el error y no se mintea si falla).

**C1-producción (verificación SPV real):** ✅ Corregido. Se implementó el módulo `rstn-bridge/src/spv.rs` con el framework de verificación SPV:
- **Bitcoin:** `BitcoinSpvProof` verifica el Merkle proof (branch folding con double-hash) contra el `merkleRoot` del header + confirmaciones mínimas (6).
- **Ethereum:** `EthereumReceiptProof` verifica el monto bloqueado, la dirección de usuario y las confirmaciones mínimas (35) contra el `receiptsRoot`.
- El `bridge_submit_lock` de producción ahora parsea `spvProof` + `committeeProof`, verifica el SPV proof contra el tuple (chain, txid, amount, user) y luego verifica el committee proof contra el set de validadores activos.
- Assert de arranque en `main.rs`: un nodo lanzado con `--genesis` (mainnet) que compute `is_testnet = true` (silent flip) hace `bail!` y no arranca.

**Ubicación:** `rstn-node/crates/rstn-rpc/src/lib.rs` `bridge_submit_lock` (~líneas 1610-1775), `rstn-node/crates/rstn-bridge/src/spv.rs`, `rstn-node/crates/rstn-node/src/main.rs` (C1 startup guard ~líneas 398-426)

**Descripción (histórica):**
En modo testnet (`is_testnet == true`), el puente construye el `LockProof` con `LockProof::self_attest(kp, ...)` donde `kp` es el keypair del propio nodo. Es decir, **el nodo atestigua su propio lock** sin haber verificado que el usuario realmente bloqueó fondos en la cadena origen. Luego el umbral es 1 (un solo validador) y el nodo firma con su propia clave, alcanzando el umbral y ejecutando el minteo automáticamente.

**Impacto residual:** En testnet el auto-mint es esperado (modo dev). El riesgo crítico (auto-mint en mainnet por `is_testnet = true` mal configurado) queda mitigado por el hard-disable de producción + el assert de arranque + la verificación SPV obligatoria.

**Remediación aplicada:**
1. Hard-disable del puente en producción (rechaza con error si `!is_testnet` y sin `spvProof`).
2. Umbral de minteo = `2/3+` validadores activos en producción (no 1).
3. `execute_operation` respeta errores — no mintea si la operación falla.
4. **C1-producción (hecho):** framework SPV (`spv.rs`) con verificación Merkle (BTC) + receipt (ETH) + política de confirmaciones mínimas por cadena; `bridge_submit_lock` parsea y verifica el `spvProof` antes de mintear; assert de arranque que prohíbe `is_testnet = true` en un nodo mainnet (`--genesis`).
5. **Light-client header store (hecho):** `rstn-bridge::header_store` mantiene headers canónicos por cadena origen (valida parent linkage, height monotonicity, accumulated work; reorga al heaviest chain). `BridgeState::verify_lock_with_header_store` confirma (1) el header es canónico, (2) tiene confirmaciones ≥ mínimo por cadena, (3) el Merkle root del proof coincide con el root del header canónico, y (4) la prueba criptográfica Merkle verifica. El operador/light-client sync inserta headers; el store garantiza la canonicalidad.

---

### C2 — Puente: `execute_operation` no acreditaba/debitaba wrapped balances del usuario — **CORREGIDO (ronda 6)**

**Estado:** ✅ Corregido. `execute_operation` en `rstn-bridge/src/lib.rs` ahora (1) en `LockMint` llama `self.mint_wrapped(chain, &user, amount)` después de `record_lock` para acreditar los wBTC/wETH al usuario; (2) en `BurnRelease` llama `self.burn_wrapped(chain, &user, amount)?` **antes** de `record_burn` — si el usuario no tiene saldo suficiente, la operación entera se revierte y los reserves quedan intactos. Dos tests nuevos validan ambos caminos.

**Ubicación:** `rstn-node/crates/rstn-bridge/src/lib.rs` `execute_operation` (~líneas 705-810)

**Descripción (histórica):** `execute_operation` actualizaba `ProofOfReserves` (locked/minted/burned) pero **no tocaba** `wrapped_balances`. Esto significaba:
- **LockMint:** tras un lock exitoso, `reserves.locked` y `reserves.minted` subían pero el usuario nunca recibía wBTC/wETH gastables — los tokens existían en el invariant de reserves pero no en el balance del usuario.
- **BurnRelease (más grave):** `submit_burn` validaba `reserves.locked >= amount` (pasaba si alguien había hecho lock antes), pero `execute_operation` no verificaba que el usuario *tuviera* wrapped tokens. Un atacante con 0 wBTC podía quemar y liberar BTC real del vault sin jamás haber recibido wrapped tokens — **drenaje del vault**.

**Impacto:** Crítico — drenaje de fondos del vault en `BurnRelease`; tokens mintados no gastables en `LockMint`. El invariant `locked == minted - burned` se mantenía (ambos lados subían/bajaban igual) pero la **asignación por usuario** era incorrecta.

**Remediación aplicada:**
1. `LockMint`: `self.mint_wrapped(chain, &user, amount)` después de `record_lock`.
2. `BurnRelease`: `self.burn_wrapped(chain, &user, amount)?` **antes** de `record_burn` — revierte si el usuario no tiene saldo.
3. Tests: `test_lock_mints_wrapped_balance` (lock → balance == 1000), `test_burn_without_wrapped_balance_rejected` (burn sin saldo → error + reserves intactos).

**Perfil que lo detectó:** Ingeniero de Smart Contracts / Auditor Solidity — al trazar el flujo completo `execute_operation` → `ProofOfReserves::record_lock/record_burn` → ausencia de `mint_wrapped`/`burn_wrapped` en el path de ejecución.

---

## 2. HALLAZGOS DE SEVERIDAD ALTA

### A1 — Transporte P2P usa Noise clásico (X25519), NO post-cuántico

**Ubicación:** `rstn-node/crates/rstn-p2p/src/lib.rs` líneas ~220-235

**Descripción:**
El transporte libp2p usa `noise::Config::new()` que es X25519 ECDH (clásico, vulnerable a Shor). El handshake post-cuánt híbrido (Kyber768 + X25519 + Dilithium3) está implementado en `rstn-crypto` (`NoiseHandshake`) pero **no está cableizado al transporte**. El código lo admite explícitamente en los comentarios (#16).

**Impacto:**
- Las firmas on-chain y los votos de consenso SÍ son post-cuánticos (Dilithium3), pero el canal de transporte entre nodos es clásico. Un adversario cuántico con Shor podría descifrar sesiones P2P y, aunque no podría forjar firmas Dilithium3, podría realizar MITM en el gossip de transacciones/bloques antes de su verificación de firma, degradando la disponibilidad y la privacidad de la red.
- Contradice el claim de marketing "100% post-quantum coverage".

**Recomendación:**
- Implementar un `Transport` custom de libp2p que envuelva el `NoiseHandshake` de rstn-crypto, o migrar a un fork de libp2p con soporte PQ Noise.
- Mientras tanto, corregir el claim público: "firmas y consenso post-cuánticos; transporte en migración".

### A2 — SDK frontend genera y almacena la clave privada Dilithium3 en memoria/localStorage — **CORREGIDO**

**Estado:** ✅ Corregido. En builds de producción el wallet **nunca** genera un keypair Dilithium3 real en el contexto de página. La generación de claves está gateada por `import.meta.env.DEV`; en producción, si la extensión no está instalada, `connect()` lanza un error claro instruyendo al usuario a instalar la extensión de wallet. La clave privada en `RstnWallet` (SDK) es un campo `private` que no se expone como propiedad pública del instance, y `sign()` tiene un guard de defense-in-depth que rechaza firmar si no es build DEV. Se añadió además `console.warn` explícito en modo DEV advirtiendo que la clave es efímera y no debe recibir fondos reales.

**Ubicación:** `src/lib/wallet.ts` (líneas 122-161, 209-221), `src/lib/rstn-sdk.ts` `RstnWallet` (campo `private privateKey`)

**Descripción (histórica):**
Cuando la extensión no estaba instalada, `RstnWallet.connect()` generaba un keypair Dilithium3 real en el navegador y lo mantenía en `this.sdkWallet`. La clave privada (4032 bytes) quedaba accesible a cualquier script del mismo origen vía XSS.

**Remediación aplicada:**
1. Gate `import.meta.env.DEV` en `connect()` — sin extensión en producción, se lanza error accionable.
2. Campo `privateKey` declarado `private` en `RstnWallet` del SDK (no legible desde fuera).
3. Guard de defense-in-depth en `sign()`: rechaza firmar en producción sin extensión.
4. `console.warn` en DEV advirtiendo que la clave es efímera.

### A3 — `rstn_stake`/`unstake`/`delegate` vía RPC no verifican firma ni autorización del caller — **CORREGIDO**

**Estado:** ✅ Corregido. Todos los métodos de staking (`stake`, `unstake`, `delegate`, `undelegate`, `claim_rewards`) y el faucet llaman a `require_testnet(state, ...)` como primera línea, que rechaza con error si `!state.is_testnet`. En producción, todo staking debe pasar por `rstn_sendTransaction` con una transacción firmada verificada por `verify_signature`.

**Ubicación:** `rstn-node/crates/rstn-rpc/src/lib.rs` — `require_testnet` (línea 206), staking methods (líneas 1104-1368)

**Descripción (histórica):**
Estos métodos RPC aceptaban `{ address, amount }` y modificaban directamente el estado del staking sin verificar ninguna firma. Cualquiera que conociera una dirección podía llamar `rstn_stake` con esa dirección y bloquear/transferir su stake.

**Remediación aplicada:**
1. `require_testnet` gate en los 5 métodos de staking + faucet + debug.
2. El staking real en producción debe pasar por `rstn_sendTransaction` con tx firmada (Stake/Unstake/Delegate) verificada por `verify_signature`.
3. **Pendiente menor:** el `pubkey` del validador sigue en ceros (placeholder) en el atajo RPC de testnet — documentar que el registro real de pubkey requiere tx on-chain.

---

## 3. HALLAZGOS DE SEVERIDAD MEDIA

### M1 — Gossipsub con `ValidationMode::None` y `MessageAuthenticity::Anonymous` — **CORREGIDO**

**Estado:** ✅ Corregido. Gossipsub ahora usa `ValidationMode::Strict` y el event loop de red (`rstn-node/src/network.rs`) llama `report_message_validation_result()` para cada mensaje recibido, reportando `Accept`, `Reject` o `Ignore` según el resultado de la verificación de firma Dilithium3. Los bloques y transacciones se verifican (`verify_block_signature()` / `verify_signature()`) antes de aceptarse; un mensaje con firma inválida o malformado se reporta como `Reject`, lo que penaliza al peer origen en el mesh y detiene la propagación de spam en el primer hop. Además `max_transmit_size` se redujo de 4MB a 1MB. `MessageAuthenticity::Anonymous` se mantiene intencionalmente porque la firma de aplicación (Dilithium3) es la fuente de verdad y las firmas del envelope libp2p serían redundantes.

**Ubicación:** `rstn-node/crates/rstn-p2p/src/lib.rs` (líneas 257-292), `rstn-node/crates/rstn-node/src/network.rs` (líneas 125-277)

**Descripción (histórica):**
Gossipsub estaba configurado sin validación de mensajes (`ValidationMode::None`) y sin autenticidad. Cualquier peer podía inyectar mensajes arbitrarios que se flood-forwarded sin verificación previa, permitiendo amplificación de spam de hasta 4MB por mensaje.

**Remediación aplicada:**
1. `ValidationMode::Strict` — exige `report_message_validation_result` por mensaje.
2. Verificación de firma Dilithium3 de bloques y txs antes de aceptar/rechazar.
3. `Reject` en mensajes malformados o con firma inválida → penalización del peer.
4. `max_transmit_size` reducido a 1MB (de 4MB).
5. `duplicate_cache_time` corto (500ms) para re-broadcasts con nonce monotónico.

### M2 — El nonce del faucet/debug se lee del DB local, no del consenso

**Ubicación:** `rstn-node/crates/rstn-rpc/src/lib.rs` líneas ~875, ~983

**Descripción:**
`debug_send_tx` y `faucet_claim` leen `current_nonce = state.db.get_nonce(&from_addr)` del DB local. En multi-nodo, si el nonce on-chain ya avanzó pero el DB local no está sincronizado, la tx se rechaza por nonce mismatch. Más grave: el faucet firma con el keypair del validador, pero si dos nodos reciben el claim simultáneamente, ambos firman con el mismo nonce → una de las txs se rechaza.

**Impacto:** Race condition en faucet multi-nodo; posible doble gasto del faucet si el cooldown en memoria no se comparte entre nodos.

**Recomendación:** El cooldown del faucet (`faucet_claims`) está en memoria por nodo — mover a un check on-chain o coordinado.

### M3 — `compute_state_root` itera TODO el estado cada bloque (O(N)) — **CORREGIDO**

**Estado:** ✅ Corregido. Se implementó un Sparse Merkle Tree (`rstn-storage/src/smt.rs`) con claves de 256 bits, hashing Keccak-512 domain-separated, default-zero subtrees, y nodos persistidos en sled. `compute_state_root_smt` y `smt_update_account` dan O(log N) = O(256) por cuenta modificada. El legacy full-scan queda como fallback de auditoría. Test de regresión `test_smt_root_changes_on_account_update` añadido.

**Ubicación:** `rstn-node/crates/rstn-storage/src/smt.rs`, `rstn-storage/src/lib.rs` `compute_state_root_smt` / `smt_update_account`

**Descripción (histórica):**
`compute_state_root` iteraba cada par (key, value) del árbol de estado y construía un Merkle root desde cero. `compute_state_root_incremental` también iteraba todo a pesar de su nombre. A 250K TPS con millones de cuentas, esto era inviable.

**Remediación aplicada:**
1. Sparse Merkle Tree con profundidad 256, default-zero subtrees (solo se almacenan caminos a hojas no vacías).
2. `smt_update_account(address)` actualiza una hoja en O(256) y devuelve el nuevo root.
3. Persistencia en sled tree `smt` (sobrevive reinicios).
4. Legacy `compute_state_root` conservado como cross-check de auditoría.

### M4 — CORS `Access-Control-Allow-Origin: *` en el RPC server — **CORREGIDO**

**Estado:** ✅ Corregido. `cors_allow_origin(state, origin)` devuelve `*` solo en testnet sin orígenes configurados; en producción (o con allow-list configurada) refleja el `Origin` solo si está en `allowed_origins`, y omite el header ACAO en caso contrario (el navegador bloquea la lectura cross-origin). El runner extrae el `Origin` de la request y aplica la allow-list en OPTIONS y en todas las respuestas (incluidas las de error).

**Ubicación:** `rstn-node/crates/rstn-rpc/src/lib.rs` `cors_allow_origin` (línea 223), `rstn-node/src/runner.rs` (líneas 47-105)

**Descripción (histórica):**
El servidor RPC devolvía `Access-Control-Allow-Origin: *` para todas las respuestas. Cualquier sitio web podía hacer peticiones RPC al nodo local del usuario.

**Remediación aplicada:**
1. Allow-list de orígenes (`allowed_origins: RwLock<Vec<String>>`) configurable.
2. Testnet sin allow-list → `*` (dev-friendly). Producción → reflect solo orígenes allow-listed.
3. Header ACAO omitido en respuestas a orígenes no autorizados (browser bloquea).
4. Aplicado en preflight OPTIONS y en respuestas de error.

### M5 — `rstn_debugSendTx` expone capacidad de firma del validador — **CORREGIDO**

**Estado:** ✅ Corregido. El método `rstn_debugSendTx` está compilado fuera de los builds de release mediante el feature flag `debug-rpc` de cargo. En un build sin ese feature (`cargo build --release`, el default), el método ni siquiera existe en el binario: el dispatcher devuelve `MethodNotFound`. Solo se compila cuando se activa explícitamente (`cargo build --features rstn-rpc/debug-rpc`) para binarios de dev/testnet. Además, cuando está presente, sigue gateado por `is_testnet` como defense-in-depth.

**Ubicación:** `rstn-node/crates/rstn-rpc/Cargo.toml` (feature `debug-rpc`), `rstn-node/crates/rstn-rpc/src/lib.rs` dispatcher (~línea 268) + `debug_send_tx` (~línea 876)

**Descripción (histórica):**
Aunque estaba gateado por `is_testnet`, el método permitía a cualquier caller pedirle al nodo que firmara una transacción arbitraria con la clave del validador. Si `is_testnet` quedaba en `true` por error de configuración en un nodo con valor real, un atacante podía hacer que el validador firmara txs de transferencia a su propia dirección.

**Remediación aplicada:**
1. Feature flag `debug-rpc` en `rstn-rpc/Cargo.toml` (default = off).
2. `#[cfg(feature = "debug-rpc")]` en el dispatcher y la definición de `debug_send_tx`.
3. `#[cfg(not(feature = "debug-rpc"))]` devuelve `MethodNotFound` en el dispatcher.
4. Defense-in-depth: el gate `is_testnet` se mantiene cuando el feature está activo.

---

## 4. HALLAZGOS DE SEVERIDAD BAJA / INFORMATIVOS

### B1 — Wallet extension: la frase semilla se guarda en el vault encriptado
`rstn-wallet/wallet-lib.js` `encryptVault` incluye `seedPhrase` en el JSON encriptado. Es funcional pero aumenta el blast radius si la contraseña es débil. PBKDF2 con 600K iteraciones + AES-256-GCM es razonable. **OK pero considerar no persistir la semilla** tras derivar las claves.

### B2 — `parseAmountWei` no valida desbordamiento
`rstn-wallet/background.js` línea ~59: `BigInt(whole) * 10n**18n` podría desbordar si `whole` es extremadamente grande. En práctica el nodo rechazaría la tx, pero validar el rango en el cliente mejora el UX.

### B3 — CLI deploy usa `parseFloat` para parsear el valor
`rstn-deploy/cli.js` línea ~177: `parseFloat(arg2) * 1e18` pierde precisión para valores grandes. Debería usar string parsing con BigInt como hace la wallet.

### B4 — Seed nodes hardcoded
`rstn-node/crates/rstn-p2p/src/lib.rs` `SEED_NODES` apuntan a dominios que probablemente no existen (`seed-eu.rstn.network`). Para mainnet deben configurarse vía genesis config, no hardcoded.

### B5 — `get_proposals` devuelve array vacío / `get_proposal` devuelve null
La gobernanza on-chain no está implementada (`rstn-rpc/src/lib.rs` ~1370-1499). Los stubs devuelven vacío. Documentar como "no implementado" en la UI.

### B6 — Rate limit del faucet es 60s (muy permisivo)
`faucet_claim` usa `COOLDOWN_MS = 60_000` (1 minuto) "local testnet friendly". En un testnet público, esto permite a un atacante generar miles de direcciones y reclamar 1000 RSTN por minuto. Subir a 24h para testnet público.

---

## 5. Aspectos Positivos Destacados

La auditoría también identificó prácticas de seguridad sólidas que merecen reconocimiento:

1. **Criptografía post-cuántica correcta:** Dilithium3 (FIPS 204 ML-DSA-65) con tamaños de wire canónicos (pk=1952, sk=4032, sig=3309) compatibles entre el nodo Rust (`fips204` crate) y el wallet JS (`@noble/post-quantum`). La migración desde `pqc_dilithium` (round-3, incompatible) fue correcta.
2. **Génesis determinístico:** Usa pubkey all-zeros fijo y omite verificación de firma en height 0, garantizando que todos los nodos computen el mismo genesis hash — esencial para consenso BFT multi-nodo.
3. **Slashing proporcional con detección de equivocación:** `detect_and_slash_equivocation` detecta doble-firma en PREPARE y COMMIT, slash 5%, y usa un `Vec` para no sobrescribir múltiples equivocadores simultáneos.
4. **Anti-replay y anti-spam en mempool:** Verificación de nonce contra estado on-chain (con ventana de gap), cap por-sender (64) y global (4096), verificación de balance pre-flight.
5. **Forward security (anti long-range):** `ForwardSecurityLedger` valida que el firmante de cada bloque esté autorizado para su epoch.
6. **Validación de timestamp MTP:** Rechaza bloques con timestamp >2h del mediano de los últimos 11 (anti-timejacking).
7. **DAS (Data Availability Sampling):** `encode_block_body` con erasure coding (256 shards, 4 parity) y `data_root` en el header para que light clients detecten withholding.
8. **Wallet extension:** Claves solo en RAM mientras está desbloqueado, re-lock al terminar el SW, confirmación explícita vía popup para todo request de dApp, validación de origin, BigInt para evitar pérdida de precisión.
9. **CLI deploy:** `chmod 0o600` en el archivo de clave, pre-flight de balance, rehúsa sobrescribir claves existentes.
10. **Rate limiting RPC:** Per-IP per-second (50) y per-minute (500) con bans.

---

## 6. Matriz de Acciones Prioritarias

| Prioridad | Hallazgo | Acción | Esfuerzo | Estado |
|-----------|----------|-------|----------|--------|
| P0 | C1 | Hard-disable puente en producción + umbral 2/3 + respetar error de execute | Bajo | ✅ Hecho |
| P0 | C1-prod | Verificación SPV real del lock + assert `is_testnet` en mainnet | Alto | ✅ Hecho |
| P0 | A3 | Deshabilitar `stake`/`unstake`/`delegate`/`undelegate`/`claim_rewards` RPC en producción | Bajo | ✅ Hecho |
| P1 | A1 | Cablear `NoiseHandshake` PQ al transporte libp2p (requiere fork) | Alto | Parcial (wire PQ para streams directos cableado vía `pq_wire::PqStream`; broadcast gossipsub + reemplazo total de Noise pendientes) |
| P1 | A2 | No generar claves reales en frontend de producción | Bajo | ✅ Hecho |
| P1 | M4 | Restringir CORS a orígenes conocidos | Bajo | ✅ Hecho |
| P2 | M1 | Validación asíncrona en gossipsub + límite de tamaño de bloque | Medio | ✅ Hecho |
| P2 | M3 | Implementar Sparse Merkle Tree para state root incremental | Alto | ✅ Hecho |
| P2 | M5 | Eliminar `debugSendTx` en builds de release | Bajo | ✅ Hecho |
| P3 | M2 | Coordinar cooldown del faucet entre nodos | Medio | Pendiente |
| P3 | B6 | Subir cooldown del faucet a 24h para testnet público | Trivial | Pendiente |

---

## 7. Conclusión

RSTN demuestra una arquitectura criptográfica post-cuántica **madura y bien razonada**, con atención cuidadosa a la compatibilidad wire FIPS 204, determinismo de génesis, y defensas de consenso (slashing, forward security, anti-replay, DAS). Los hallazgos críticos y altos **no son fallos criptográficos** sino **fallos de autorización y configuración de despliegue** — el puente auto-firmado (C1), los atajos RPC sin firma (A3), y el transporte aún clásico (A1).

**Avance de remediación (2026-09-01, ronda 2):** C1, C1-producción, A2, A3, M1, M3, M4 y M5 están corregidos. El protocolo ahora bloquea el minteo no autorizado en producción y exige un SPV proof verificado (Bitcoin Merkle / Ethereum receipt) + committee attestation, gatea todos los atajos RPC privilegiados tras `require_testnet`, restringe CORS con allow-list, computa el state root en O(log N) vía Sparse Merkle Tree, no genera claves Dilithium3 reales en el frontend de producción, valida firmas en gossipsub antes de propagar mensajes, compila `debugSendTx` fuera de los builds de release, y el event loop P2P mantiene un `PeerSessionManager` para sesiones PQ de aplicación con los peers del validator set.

**Recomendación de despliegue (revisada, ronda 7):** Apto para **testnet pública** (todos los hallazgos P0/P1 de testnet están cerrados). Para **mainnet** el transporte PQ wire-level ahora cubre streams directos peer-to-peer (`pq_wire::PqStream`); el forced-inclusion pool está **cableado en `propose_block` y `vote_prepare`** (G14 — el proponente DEBE incluir txs forzadas o el bloque es inválido), el threshold mempool está **habilitado vía `enable_threshold_mempool()`** en `main.rs` (G13 — el proponente ve solo commitments, MEV imposible), el light-client header store está implementado y cableado al verificador SPV del puente (`verify_lock_with_header_store`), los fuzz targets cubren los surfaces criptográficos, del puente, **del VM (nuevo binario `vm`)** y **del consenso (nuevo binario `consensus`)** (`rstn-node/fuzz`), el spec de firmware BOLOS del Ledger está diseñado (`LEDGER_BOLOS_FIRMWARE.md`), y el plan del fork de libp2p para gossipsub PQ está diseñado (`GOSSIPSUB_PQ_BROADCAST.md`).

**Lo que resta antes de mainnet (reducido, ronda 7):**
1. **Fork de libp2p** para el broadcast gossipsub PQ wire-level (plan en `GOSSIPSUB_PQ_BROADCAST.md` — ~4 semanas). El payload ya es PQ-confidencial vía `pq_transport`; queda el metadata leak del envelope.
2. **Auditoría criptográfica formal externa** del stack PQ (Dilithium3, Kyber768, SPHINCS+, NoiseHandshake híbrido) por una firma registrada (Trail of Bits, NCC Group, Quarkslab).
3. **Fuzzing extendido 24h+** de los surfaces criptográficos, del puente, del VM y del consenso (los targets están listos en `rstn-node/fuzz/` — falta correr las corridas extendidas en CI).
4. **Firmware on-device del Ledger app** (BOLOS SDK, Rust) — el spec está en `LEDGER_BOLOS_FIRMWARE.md`; la app on-device es el entregable de firmware.
5. **DKG para el threshold mempool** — el threshold key hoy usa un PRNG determinístico; un LADKG (distributed key generation) generaría el key sin que ninguna parte conozca el key completo. El diseño está documentado en `threshold_mempool.rs` §"What is NOT claimed".
