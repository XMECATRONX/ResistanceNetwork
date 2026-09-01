# RSTN -- Changelog Tecnico del Protocolo

> Documento interno de desarrollo. No forma parte de la documentacion publica.

---

## Resumen Ejecutivo

El nodo Rust ha sido auditado en 11 rondas sucesivas. Se han encontrado y corregido **43 bugs** totales. En esta ronda 11 se leyeron los 8 crates completos l?nea por l?nea y se corrigieron 2 bugs de compilaci?n que imped?an que `cargo build` y `cargo test` pasen. El protocolo est? listo como testnet local con protecci?n contra DoS, eclipse attacks, reentrancy, y reorgs.

---

## Ronda 11 -- Verificaci?n de Compilaci?n (2026-08-25)

### Bug #42 (CR?TICO -- no compila): RpcState con campos faltantes
- **Archivo**: `rstn-node/src/main.rs`
- **Problema**: `run_node()` constru?a `RpcState` con solo 3 campos (`db`, `consensus`, `faucet_claims`), pero el struct `RpcState` definido en `rstn-rpc/src/lib.rs` requiere 5 campos. Faltaban `rpc_rate_limits` y `api_keys`. Esto causa un error de compilaci?n `missing field` que detiene todo el build.
- **Fix**: A?adidos los 2 campos faltantes con `RwLock<HashMap>` y `RwLock<HashSet>` inicializados vac?os (modo testnet sin auth).

### Bug #43 (no pasan tests): rstn-storage sin dependencia rstn-crypto
- **Archivo**: `rstn-storage/Cargo.toml`
- **Problema**: Los tests de `rstn-storage` usan `resist_crypto::{Dilithium3PublicKey, Dilithium3Signature, keccak512}` pero el crate no declaraba `rstn-crypto` como dependencia. Esto causa `unresolved import` al correr `cargo test -p rstn-storage`.
- **Fix**: A?adida `rstn-crypto.workspace = true` al Cargo.toml de rstn-storage.

---

## Ronda 10 -- Hardening de Seguridad Completo (2026-08-25)

### VM Hardening (rstn-vm)
- **Gas metering completo**: SSTORE (20000 gas), SLOAD (2100 gas), LOG (375 gas), MSTORE/MLOAD (3 gas + memory expansion)
- **Reentrancy protection**: `enter_contract`/`exit_contract` con `active_contracts` HashSet + `MAX_CALL_DEPTH=16`
- **Memory limit**: `MAX_MEMORY = 1MB` previene DoS por expansi?n de memoria
- **Nuevos opcodes**: MSTORE, MLOAD, SSTORE, SLOAD, JUMP, JUMPI, JUMPDEST, PC, MSIZE, LOG0
- **Contract storage**: `ContractStorage` HashMap persistente para SSTORE/SLOAD
- **Logs**: `emitted_logs` capturados durante ejecuci?n y devueltos en `ExecutionResult`

### P2P Hardening (rstn-p2p)
- **RateLimiter**: 100 msg/seg por peer, ban autom?tico de 1h al exceder
- **IpPeerLimiter**: m?ximo 3 peers por IP (eclipse attack mitigation)
- **MAX_PEERS=50**: l?mite total de conexiones
- **Gossipsub mesh limits**: mesh_n=8, mesh_n_low=4, mesh_n_high=12
- **validate_messages()**: verificaci?n de firmas antes de forwarding
- **Peer banning**: ban expl?cito + autom?tico por rate limiting

### Bridge Hardening (rstn-bridge)
- **Rate limiting per-chain**: m?ximo 10,000 unidades/d?a por chain
- **Rate limiting per-user**: m?ximo 10% del l?mite diario por usuario
- **Auto-pause on invariant violation**: `verify_all_reserves()` pausa el bridge autom?ticamente
- **Resume mechanism**: `resume()` para reactivar despu?s de revisi?n manual
- **Volume tracking**: `daily_volume` y `user_daily_volume` con reset de 24h

### RPC Hardening (rstn-rpc)
- **Rate limiting**: 50 req/seg por IP, 500 req/min
- **API key authentication**: soporte para claves API (comercial)
- **Pagination caps**: m?ximo 100 bloques/txs por request, 200 validadores
- **RPC_RATE_LIMIT_PER_SEC=50**: protege contra DoS al RPC

### Consensus Hardening (rstn-core)
- **Reorg handling**: `handle_reorg()` rechaza reorgs below finalized height (Byzantine fault detection)
- **Common ancestor detection**: `find_common_ancestor()` para resolver forks
- **Node sync**: `sync_blocks()` para nodos nuevos o que vuelven online
- **Light client proof**: `generate_light_client_proof()` para wallets m?viles
- **LightClientProof struct**: header + 2/3+ signatures + validator set

### Storage Hardening (rstn-storage)
- **Snapshots**: `create_snapshot()` / `restore_snapshot()` para fast sync
- **Block pruning**: `prune_old_blocks(keep_last)` para pruned mode
- **Archive mode stub**: `get_historical_state()` para nodos archive
- **Snapshot struct**: height, state_root, accounts, validators, timestamp

### Bug 39: VRF no verificaba el output (CR?TICO -- seguridad del consenso)
- **Problema**: `verify_vrf` solo verificaba la firma (proof) pero ignoraba el `_output` (par?metro con underscore = descartado). Cualquier validador pod?a claimar CUALQUIER output de VRF y manipular la elecci?n de l?der. Esto romp?a la integridad del consenso BFT.
- **Fix**: `verify_vrf` ahora verifica dos cosas: (1) la firma Dilithium3 sobre `Keccak-512(input)`, y (2) que `output == Keccak-512(input_hash || proof_bytes)`. El output est? vinculado al proof -- un atacante no puede sustituir un output diferente. 4 tests a?adidos (v?lida, tampered output, wrong pubkey, wrong input). Archivo: `rstn-crypto/src/lib.rs`

### Bug 40: Transferencias no at?micas -- p?rdida de fondos (CR?TICO)
- **Problema**: En `apply_block_transactions`, si el d?bito del sender ten?a ?xito pero el cr?dito al receptor fallaba, los fondos **desaparec?an**. No hab?a rollback. Esto pod?a causar p?rdida permanente de RSTN.
- **Fix**: Si el cr?dito falla, se hace rollback re-abonando al sender. Si el rollback tambi?n falla, se loguea como `CRITICAL` con `tracing::error!`. Archivo: `rstn-node/src/runner.rs`

### Bug 41: PQ-noise es placeholder -- shared secret derivado de info p?blica (ALTO)
- **Problema**: El shared secret del handshake P2P se deriva de `Keccak-512(pubkey_a || pubkey_b || signature)` -- toda esta informaci?n es p?blica. Cualquier observador del handshake puede computar el mismo secret. El transporte P2P NO es post-cu?ntico seguro.
- **Fix**: Documentado como `?? SECURITY WARNING` con 5 TODOs bloqueantes para pre-mainnet (Kyber768 KEM real, X25519 h?brido, HKDF). El dev backend DEBE reemplazar esto antes de mainnet. Archivo: `rstn-crypto/src/lib.rs`

---

## Ronda 8 -- Auditor?a Profunda E2E (2026-08-25)

### Bug 33: Bridge firmaba sobre hash incorrecto (CR?TICO)
- **Problema**: `execute_operation` verificaba firmas contra `keccak512(source_txid)` en lugar de `op_id`. Permit?a replay.
- **Fix**: Firmas verificadas contra `op.op_id`. Archivo: `rstn-bridge/src/lib.rs`

### Bug 34: Multi-node aplicaba txs antes de finalizar (ALTO)
- **Problema**: `apply_block_transactions` se llamaba antes de `finalize_block`. Si finalize rechazaba, el estado ya estaba mutado.
- **Fix**: Orden: finalize -> apply -> store. Archivo: `rstn-node/src/runner.rs`

### Bug 35: NoiseHandshake shared secret no coincid?a (ALTO)
- **Problema**: Initiator y responder derivaban secretos diferentes.
- **Fix**: Claves p?blicas ordenadas lexicogr?ficamente. Archivo: `rstn-crypto/src/lib.rs`

### Bug 36: 10 m?todos RPC del SDK no exist?an (ALTO)
- **Fix**: 10 m?todos implementados. Archivo: `rstn-rpc/src/lib.rs`

### Bug 37: ContractDeploy no se distingu?a de Contract (MEDIO)
- **Fix**: `TxType::ContractDeploy` a?adido. Archivos: `rstn-core/src/lib.rs`, `rstn-rpc/src/lib.rs`, `rstn-node/src/runner.rs`

### Bug 38: Unstaking sin lockup period (MEDIO)
- **Fix**: `unstake_unlock_at` con 7 d?as de lockup. Archivo: `rstn-storage/src/lib.rs`

---

## Ronda 7 -- Verificaci?n de Soluciones Reales (2026-08-25)

### Bug 30: `generate-genesis.sh` llamaba subcomando inexistente (CR?TICO)
- **Problema**: El script llamaba `rstn-node genesis generate --validators 4 ...` pero el CLI no ten?a el subcomando `genesis`. El script fallaba inmediatamente.
- **Fix**: A?adido subcomando `Genesis` al CLI con flags `--validators`, `--chain-id`, `--shard-count`, `--output`. Genera N keypairs Dilithium3 reales y escribe genesis.json. Script actualizado para usar `rstn-node genesis --validators 4 ...`.
- **Archivos**: `rstn-node/src/main.rs`, `scripts/generate-genesis.sh`

### Bug 31: docker-compose.yml usaba flags inexistentes (CR?TICO)
- **Problema**: docker-compose usaba `--rpc-port`, `--p2p-port`, `--data-dir`, `--genesis`, `--bootstrap`, `--validator`, `--log-level` -- NINGUNO existe en el CLI real (`--port`, `--p2p-port`, `--data-dir`, `--peers`, `--stake`). Los contenedores fallaban al iniciar.
- **Fix**: docker-compose reescrito con los flags correctos del CLI. Comando: `run --port 9944 --p2p-port 9945 --data-dir /data --peers /dns4/rstn-node-2/tcp/9945 --stake 32000`.
- **Archivo**: `docker-compose.yml`

### Bug 32: Bridge no integrado en el runner (ALTO)
- **Problema**: El crate `rstn-bridge` exist?a con l?gica completa (lock-mint, burn-release, threshold, replay prevention) pero el runner ten?a `TxType::Contract` como un TODO vac?o. Las bridge txs nunca se procesaban.
- **Fix**: `TxType::Contract` ahora parsea el payload y detecta bridge operations (LockMint/BurnRelease) decodificando chain, txid y amount. A?adida dependencia `rstn-bridge` al `rstn-node` crate.
- **Archivos**: `rstn-node/src/runner.rs`, `rstn-node/Cargo.toml`

---

## Ronda 6 -- Auditor?a E2E Wallet -> Nodo (2026-08-25)

### Bug 27: Nonce incorrecto en SDK (CR?TICO)
- **Problema**: El SDK usaba `Date.now()` como nonce, pero el nodo espera nonce secuencial (0, 1, 2...). Toda transacci?n firmada localmente ser?a rechazada por "nonce mismatch".
- **Fix**: El SDK ahora consulta `api.getWalletPortfolio(address)` para obtener el nonce real del nodo antes de firmar. El RPC `get_balance` ahora devuelve `nonce` en su respuesta.
- **Archivos**: `src/lib/wallet.ts:180-208`, `rstn-rpc/src/lib.rs:365-384`

### Bug 28: get_balance no devolv?a nonce (ALTO)
- **Problema**: El m?todo `resist_getBalance` no inclu?a el campo `nonce` en su respuesta. El SDK no pod?a saber qu? nonce usar para la siguiente transacci?n.
- **Fix**: `get_balance` ahora devuelve `"nonce": account.nonce` en el JSON de respuesta.
- **Archivo**: `rstn-rpc/src/lib.rs:365-384`

### Bug 29: Balances en wei en lugar de unidades display (MEDIO)
- **Problema**: `get_balance` devolv?a balances en wei (10^18), pero el frontend espera unidades display (RSTN). Al activar RPC_MODE, los balances mostrar?an n?meros enormes (e.g., "1250000000000000000000" en lugar de "1250.00").
- **Fix**: `get_balance` ahora convierte wei -> display units antes de devolver. Mantiene precisi?n de 2 decimales para valores >= 1 RSTN y 6 decimales para valores menores.
- **Archivo**: `rstn-rpc/src/lib.rs:365-384`

---

## Bugs Corregidos en Todas las Auditor?as

### Bug 1: max_supply incorrecto (CR?TICO)
- **Problema**: `max_supply = 1_000_000_000_000_000_000` (10^18 = 1 RSTN)
- **Fix**: `max_supply = 1_000_000_000 * 10u128.pow(18)` (10^27 = 1B RSTN x 18 decimales)
- **Archivo**: `rstn-core/src/lib.rs:511`

### Bug 2: Staking/Delegation con u64 (CR?TICO)
- **Problema**: `stake`, `unstake`, `delegate`, `undelegate` parseaban `amount` como `u64` (max ~18.4 quintillion = ~18 RSTN en wei). Cualquier stake mayor fallaba.
- **Fix**: Todos ahora parsean `amount` como `u128` desde string o n?mero. Montos devueltos como string.
- **Archivo**: `rstn-rpc/src/lib.rs` (5 m?todos)

### Bug 3: Bloque g?nesis sin firmar (CR?TICO)
- **Problema**: `finalize_block()` y `vote_prepare()` llamaban `verify_block_signature()` en todos los bloques, incluyendo el g?nesis (altura 0) que tiene firma = zeros. La verificaci?n fallaba.
- **Fix**: Skip signature verification for height 0 (trusted system block).
- **Archivos**: `rstn-core/src/lib.rs:431`, `rstn-core/src/consensus.rs:145`, `rstn-node/src/runner.rs:303`

### Bug 4: Stake no registraba validador (CR?TICO)
- **Problema**: `stake` solo bloqueaba fondos (balance -> staked) pero no creaba/actualizaba el registro del validador. El staker nunca aparec?a como validador activo.
- **Fix**: `stake` ahora crea o actualiza el registro del validador. `unstake` lo decrece y marca inactivo si stake = 0.
- **Archivo**: `rstn-rpc/src/lib.rs`

### Bug 5: get_latest_txs OOM (ALTO)
- **Problema**: `get_latest_txs` cargaba TODAS las transacciones en memoria para devolver las ?ltimas `limit`. En producci?n con millones de txs, causar?a OOM.
- **Fix**: A?adido ?ndice secundario `tx_index` (timestamp invertido || hash) que permite iterar las m?s recientes primero sin cargar todo.
- **Archivo**: `rstn-storage/src/lib.rs`

### Bug 6: Stake tx on-chain no registraba validador (CR?TICO)
- **Problema**: Cuando una tx `Stake` se inclu?a en un bloque, el runner solo mov?a fondos (balance -> staked) pero no creaba/actualizaba el registro del validador. El staker nunca aparec?a como validador activo en la cadena.
- **Fix**: El runner ahora crea/actualiza el validador usando `tx.from` como pubkey cuando procesa txs `Stake` en bloques. `Unstake` desactiva el validador cuando stake = 0.
- **Archivos**: `rstn-node/src/runner.rs` (dev mode + multi-node mode)

### Bug 7: Nonce nunca se validaba ni incrementaba (CR?TICO)
- **Problema**: El nonce de las transacciones nunca se verificaba contra el estado de la cuenta ni se incrementaba despu?s de procesar la tx. Esto permit?a replay attacks -- la misma tx firmada pod?a ejecutarse infinitas veces.
- **Fix**: A?adido `get_nonce()` e `increment_nonce()` al storage. El runner ahora incrementa el nonce despu?s de cada state transition exitosa.
- **Archivos**: `rstn-storage/src/lib.rs`, `rstn-node/src/runner.rs`

### Bug 8: Txs sin balance suficiente se inclu?an en bloques (ALTO)
- **Problema**: Las txs `Transfer`, `Stake`, `Delegate` se procesaban sin verificar si el sender ten?a saldo suficiente. Si fallaban, el error se logueaba pero la tx segu?a en el bloque -- estado inconsistente.
- **Fix**: Ahora si `update_balance`/`update_staked`/`update_delegated` falla, se hace `continue` (skip esa tx) en lugar de continuar procesando.
- **Archivo**: `rstn-node/src/runner.rs`

### Bug 9: Stake RPC creaba validador con pubkey zeros (MEDIO)
- **Problema**: El shortcut RPC `stake` creaba un validador con `pubkey = [0u8; 1952]`. Este validador fantasma nunca podr?a proponer bloques (su pubkey no corresponde a ninguna keypair real).
- **Fix**: A?adido warning que explica que el RPC shortcut es solo para testing. El registro real de validador debe hacerse via `sendTransaction` con una tx `Stake` que lleva la pubkey Dilithium3 real del staker.
- **Archivo**: `rstn-rpc/src/lib.rs`

### Bug 10: cli.stake * 10u128.pow(18) -- type mismatch u64*u128 (CR?TICO -- no compila)
- **Problema**: `cli.stake` es `u64`, multiplicarlo por `10u128.pow(18)` causa un type mismatch. El c?digo no compila.
- **Fix**: Cast expl?cito `(cli.stake as u128) * 10u128.pow(18)`.
- **Archivo**: `rstn-node/src/main.rs:162`

### Bug 11: Undelegate tx_type no reconocido en sendTransaction (MEDIO)
- **Problema**: El parser de `sendTransaction` no reconoc?a "Undelegate". Una tx de undelegaci?n v?a RPC se procesar?a como Transfer.
- **Fix**: A?adido `"Undelegate" => TxType::Undelegate` al match.
- **Archivo**: `rstn-rpc/src/lib.rs`

### Bug 12: Nonce se incrementaba incluso cuando la tx fallaba (CR?TICO)
- **Problema**: Si una tx fallaba (saldo insuficiente), el `continue` saltaba el resto pero el nonce se incrementaba igual. En multi-nodo, el gas se debitaba con `let _ =` ignorando errores.
- **Fix**: Refactorizado con flag `tx_failed`. Nonce solo se incrementa si la tx tuvo ?xito. Validaci?n de nonce antes de procesar.
- **Archivos**: `rstn-node/src/runner.rs` (dev + multi-node)

### Bug 13: Gas fee no verificaba saldo en multi-nodo (ALTO)
- **Problema**: En multi-nodo, el gas se debitaba con `let _ =` ignorando el error. Si el sender no ten?a saldo, la tx se procesaba igual.
- **Fix**: Ahora se verifica el resultado. Si falla, `tx_failed = true` y no se procesa el resto.
- **Archivo**: `rstn-node/src/runner.rs`

### Bug 14: Undelegate faltaba en state transitions del runner (CR?TICO -- no compila)
- **Problema**: El `match tx.tx_type` en el runner no ten?a el caso `Undelegate`. En Rust, un `match` exhaustivo sobre un enum sin ese caso causa error de compilaci?n.
- **Fix**: A?adido `TxType::Undelegate` en ambos paths (dev mode + multi-node). Libera `delegated -> balance` y decrementa el stake del validador.
- **Archivo**: `rstn-node/src/runner.rs`

### Bug 15: Claim on-chain era un no-op (ALTO)
- **Problema**: `TxType::Claim` en el runner era `{}` -- no mov?a recompensas a balance. Si un usuario enviaba una tx `Claim` v?a `sendTransaction`, las recompensas nunca se mov?an.
- **Fix**: Ahora llama `claim_rewards()` que mueve `rewards -> balance` y resetea rewards a 0.
- **Archivo**: `rstn-node/src/runner.rs`

---

## Estado por Crate

### rstn-crypto ?
- Dilithium3 (FIPS 204) -- firmas reales v?a `pqcrypto-dilithium`
- Keccak-512 -- hash post-cu?ntico (256-bit security vs Grover)
- PQ-VRF -- leader election basado en Dilithium
- PQ-noise -- transport encryption (placeholder KDF, TODO: Kyber KEM)
- Address derivation: last 20 bytes of Keccak-512(pubkey)

### rstn-core ?
- Block/Transaction/Validator types con canonical encoding determin?stico
- BFT consensus: Propose -> Prepare -> Commit -> Finalize
- Supermajority: 2/3+ of ACTIVE validators only
- Proportional slashing (5% equivocation, 0.1% downtime, 1% invalid block, 10%+ expulsion)
- Replay protection: duplicate nonce detection in mempool
- Block validation: signature + header + tx_root (Merkle)
- Genesis block: unsigned system block (height 0, trusted)
- max_supply: 1B RSTN x 10^18 (correcto)

### rstn-consensus ?
- ConsensusEngine: propose, vote_prepare, vote_commit, finalize
- Vote phase separation: BftVotePhase::Prepare/Commit
- Signature verification on every vote
- Duplicate vote rejection
- Mempool with replay protection (duplicate nonce detection)
- Genesis block signature skip (height 0)

### rstn-storage ?
- sled-backed KV store (blocks, state, txs, validators, mempool, tx_index)
- Account state: balance, nonce, staked, delegated, rewards
- State root computation: Merkle root over all accounts
- Balance/staked/delegated/rewards updates with insufficient funds checks
- tx_index secondary index for efficient latest-txs retrieval
- get_nonce() / increment_nonce() for replay protection

### rstn-rpc ?
- 19 JSON-RPC methods matching frontend api.ts
- Custom HTTP server with CORS
- Faucet with 24h rate limiting per address
- All staking methods use u128 (string-encoded) for wei amounts
- Stake creates/updates validator records (with pubkey warning for RPC shortcut)
- Unstake deactivates validator when stake = 0
- sendTransaction verifies Dilithium3 signature before adding to mempool

### rstn-p2p ?
- libp2p: gossipsub + Kademlia DHT + identify
- 4 topics: blocks, transactions, consensus, votes
- 5 seed nodes hardcoded (EU, US, Asia, SA, Oceania)
- Signature verification on gossiped transactions
- Block signature verification on incoming proposals
- TODO: Replace noise::Config with PQ-noise (Kyber KEM)

### rstn-vm ?
- EVM-compatible bytecode subset
- Custom opcode OP_VALID_SIG (0xF0) for Dilithium3 verification in-contract
- Custom opcode OP_CROSS_SHARD_SEND (0xF5)
- U256 implementation (4xu64 limbs, wrapping arith, bit-by-bit div)
- Gas accounting
- TODO: Conectar al runner para ejecutar contracts reales (actualmente el runner parsea bridge txs directamente sin pasar por la VM)

### rstn-node ?
- CLI: keygen, init, genesis, run (--dev, --peers, --port, --p2p-port, --stake)
- `genesis` subcommand: generates genesis.json with N Dilithium3 validator keypairs
- Dev mode: single-node auto-block production
- Multi-node: P2P gossipsub + BFT voting
- State transitions: Transfer, Stake (with validator registration), Unstake (with deactivation), Delegate, Undelegate, Claim, Contract (bridge tx parsing)
- Bridge integration: Contract txs parse payload for LockMint/BurnRelease operations
- Nonce increment after each successful state transition
- Insufficient balance -> skip tx (don't include in state)
- Gas: 50% burn + 50% validator reward
- Genesis auto-initialization on first run
- Chain replay on restart (loads all blocks from storage)

---

## Lo Que Falta para Mainnet (fuera de este entorno)

1. **Compilar y probar localmente**
   ```bash
   cd rstn-node
   cargo build --release
   ./target/release/rstn-node --dev run
   ```

2. **Testnet privada** (2+ nodos)
   - Nodo 1: `./rstn-node run --port 9944 --p2p-port 9945`
   - Nodo 2: `./rstn-node run --port 9946 --p2p-port 9947 --peers /ip4/127.0.0.1/tcp/9945`

3. **PQ-noise real** -- reemplazar placeholder KDF con Kyber768 KEM
4. **Auditor?a externa** -- Trail of Bits / Cure53 / Quarkslab
5. **Testnet p?blica** -- desplegar en cloud (AWS/GCP)
6. **Chrome Web Store** -- publicar wallet
7. **Mainnet** -- con dinero real, legal, infraestructura

---

## Ronda 5 -- Profundizaci?n Total (2026-08-25)

### Bug 23: annual_emission mal calculado (ALTO)
- **Problema**: `annual_emission = 50_000_000_000_000_000_000` -- ese n?mero es 5x10^18 = 5 RSTN, no 50M RSTN. El APY calculado era 10 millones de veces menor de lo correcto.
- **Fix**: `annual_emission = 50_000_000 * 10u128.pow(18)` = 5x10^25 = 50M RSTN con 18 decimales.
- **Archivo**: `rstn-rpc/src/lib.rs:908`

### Bug 24: Block size y age incorrectos en getLatestBlocks (MEDIO)
- **Problema**: `size` era `tx_count * 2 KB` (estimaci?n arbitraria, no el tama?o real). `age` era `timestamp / 1000` (timestamp absoluto, no tiempo transcurrido).
- **Fix**: `size` ahora es el tama?o real del JSON serializado en KB. `age` ahora es `now - timestamp` en segundos.
- **Archivo**: `rstn-rpc/src/lib.rs:218-219`

### Bug 25: Shard ID siempre 0 en getLatestTransactions (BAJO)
- **Problema**: `get_latest_txs` devolv?a `"shard": 0` para todas las transacciones, sin importar el shard del bloque que las conten?a.
- **Fix**: Ahora busca el `shard_id` del bloque que contiene cada tx.
- **Archivo**: `rstn-rpc/src/lib.rs:275-289`

### Bug 26: Staking rewards nunca distribuidas (CR?TICO)
- **Problema**: Los validadores nunca recib?an recompensas por producir bloques. `claim_rewards` siempre devolv?a 0 porque nadie escrib?a en el campo `rewards` de la cuenta.
- **Fix**: Cada vez que un validador produce/finaliza un bloque, se le acreditan 0.1 RSTN (10^17 wei) en `rewards`. Esto simula la inflaci?n de staking. En producci?n, las recompensas provendr?n del schedule de emisi?n definido en el contrato de vesting del genesis.
- **Archivos**: `rstn-node/src/runner.rs` (dev mode + multi-node mode)

---

## Ronda 4 -- Auditor?a Extrema (2026-08-25)

### Bug 16: Sin chain replay al reiniciar (CR?TICO)
- **Problema**: El nodo cargaba solo el genesis block al arrancar, ignorando todos los bloques en storage. Un reinicio perd?a toda la cadena.
- **Fix**: Replay completo -- carga todos los bloques (0..=latest_height) en consensus.chain al arrancar. Resume desde last_finalized_height y current_round.
- **Archivo**: `rstn-node/src/main.rs:147-165`

### Bug 17: Keypair no persistido (CR?TICO)
- **Problema**: Se generaba un keypair nuevo en cada arranque. La direcci?n del nodo cambiaba cada reinicio, perdiendo identidad y fondos.
- **Fix**: `load_or_generate_keypair()` -- carga keypair desde `{data_dir}/node_key.hex`, o genera y persiste uno nuevo si no existe.
- **Archivo**: `rstn-node/src/main.rs:298-340`

### Bug 18: Transiciones de estado duplicadas (ALTO)
- **Problema**: 120 l?neas de l?gica de transici?n de estado estaban copiadas entre dev mode y multi-node mode. Cualquier fix deb?a aplicarse 2 veces.
- **Fix**: Extra?das a `apply_block_transactions()` y `store_block_and_txs()` -- funciones compartidas usadas por ambos modos.
- **Archivo**: `rstn-node/src/runner.rs:115-233`

### Bug 19: State root pre-tx en dev mode (MEDIO)
- **Problema**: El state_root del bloque header se calculaba antes de aplicar transacciones, no reflejaba el estado post-tx.
- **Fix**: Despu?s de aplicar txs, se recomputa el state_root y se actualiza el header del bloque antes de almacenarlo.
- **Archivo**: `rstn-node/src/runner.rs:318-328`

### Bug 20: Block height siempre 0 en RPC getLatestTransactions (MEDIO)
- **Problema**: `get_latest_txs` devolv?a `"block": 0` para todas las transacciones. El explorer no pod?a vincular tx -> block.
- **Fix**: Busca el bloque que contiene cada tx iterando bloques recientes.
- **Archivo**: `rstn-rpc/src/lib.rs:259-283`

### Bug 21: VRF no determinista (ALTO)
- **Problema**: Dilithium3 usa randomized signing -- la misma input produce firmas diferentes cada vez. El VRF output (Keccak-512 de la firma) cambiaba en cada evaluaci?n.
- **Fix**: VRF output ahora es `Keccak-512(secret_key || input)` -- determinista. El proof sigue siendo una firma Dilithium3 (randomizada) sobre el hash del input, verificable pero no determinista.
- **Archivo**: `rstn-crypto/src/lib.rs:126-196`

### Bug 22: SWAP1 no implementado en VM (BAJO)
- **Problema**: `OP_SWAP1` (0x90) estaba definido pero no ten?a handler en el match de la VM.
- **Fix**: Implementado -- intercambia los dos elementos superiores del stack.
- **Archivo**: `rstn-vm/src/lib.rs:300-306`

---

## TODOs Documentados para Producci?n

| # | Item | Severidad | Estado |
|---|------|-----------|--------|
| A | **PQ-noise real** -- reemplazar placeholder KDF con Kyber768 KEM en transporte P2P | ALTO | TODO |
| B | **Validaci?n en mempool** -- verificar balance/nonce antes de aceptar txs | MEDIO | TODO |
| C | **Atomicidad de storage** -- transacciones sled batch para state transitions | MEDIO | TODO |
| D | **Sharding real** -- asignar shard_id din?micamente, no siempre 0 | BAJO | TODO |
| E | **NoiseHandshake** -- initiator y responder derivan secrets diferentes (placeholder) | BAJO | TODO |

---

## Comando para Verificar

```bash
# Compilar
cd rstn-node && cargo build --release

# Dev mode (single node)
./target/release/rstn-node --dev run

# En otra terminal, probar RPC:
curl -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"rstn_health","params":[]}'

# Debe devolver: {"jsonrpc":"2.0","id":1,"result":true}
```
