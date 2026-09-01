# RSTN -- Backend Handoff Checklist

> Documento exacto para que el dev backend compile el nodo, despliegue la testnet y conecte el frontend.
> Cada paso tiene un comando verificable. No avanzar al siguiente hasta que el anterior pase.

---

## FASE 0 -- Prerequisitos

```bash
# Verificar Rust instalado
rustc --version    # debe ser >= 1.75.0
cargo --version

# Instalar Rust si no est?
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Herramientas adicionales
sudo apt install -y build-essential pkg-config libssl-dev  # Linux
# brew install openssl pkg-config                              # macOS
```

**? Checkpoint 0:** `rustc --version` responde.

---

## FASE 1 -- Compilar el nodo localmente

```bash
cd rstn-node

# Build en modo debug (r?pido, para verificar que compila)
cargo build

# Si compila sin errores, build en release (optimizado)
cargo build --release
```

**Errores comunes:**
- `error: unresolved import` -> revisar que todos los crates en `Cargo.toml` tengan el path correcto
- `error: link.exe not found` (Windows) -> instalar Visual Studio Build Tools
- `error: openssl` -> `export OPENSSL_DIR=/usr` o instalar `libssl-dev`

**? Checkpoint 1:** `cargo build --release` termina con `Finished release` sin errores.

---

## FASE 2 -- Ejecutar nodo local (testnet single-node)

```bash
# Iniciar nodo en modo dev (single-node, sin peers)
./target/release/rstn-node --dev

# El nodo debe mostrar:
#   "RSTN node starting..."
#   "RPC server listening on 127.0.0.1:9944"
#   "P2P listening on 127.0.0.1:9945"
```

**? Checkpoint 2:** El log muestra `RPC server listening on 127.0.0.1:9944`.

---

## FASE 3 -- Verificar RPC con curl

```bash
# Health check
curl -s -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"rstn_getNetworkStats","params":[]}' | jq

# Debe devolver: {"jsonrpc":"2.0","id":1,"result":{"chain_id":...,"block_height":1,...}}

# Verificar genesis
curl -s -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"rstn_getBlock","params":[1]}' | jq

# Verificar balance de cuenta genesis
curl -s -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"rstn_getBalance","params":["rstn1genesis0000000000000000000000000000"]}' | jq
```

**? Checkpoint 3:** Los 3 curl devuelven JSON v?lido con `result`.

---

## FASE 4 -- Conectar el frontend al nodo

```bash
# En otra terminal, iniciar el frontend
cd /path/to/rstn-frontend
npm install
npm run dev

# Abrir el navegador en http://localhost:8080
# Ir al terminal (http://localhost:8080/terminal)
# El badge de conexi?n debe mostrar "Connected" en verde
```

**Si el frontend no conecta:**
1. Verificar que el nodo est? corriendo en `localhost:9944`
2. Abrir DevTools -> Console -> buscar errores de fetch
3. Verificar que `src/lib/api.ts` tenga `RPC_URL = "http://localhost:9944"`
4. Si hay CORS errors, el nodo debe aceptar origins del frontend

**? Checkpoint 4:** El terminal muestra "Connected" y las m?tricas cargan datos reales.

---

## FASE 5 -- Probar el flujo E2E: Wallet -> Nodo

```bash
# 1. En el terminal, ir a "Wallet" o "Onboarding"
# 2. Crear wallet (genera keypair Dilithium3 real)
# 3. Copiar la direcci?n (rstn1...)
# 4. Ir a "Faucet" -> claim tokens
# 5. Ir a "Explorer" -> verificar que la tx aparece
# 6. Ir a "Staking" -> stakear
# 7. Verificar en "Explorer" que la tx de stake aparece
```

**? Checkpoint 5:** La tx del faucet aparece en el explorer con hash real.

---

## FASE 6 -- Cargar la wallet Chrome

```bash
# 1. Abrir chrome://extensions
# 2. Activar "Developer mode" (esquina superior derecha)
# 3. Click "Load unpacked"
# 4. Seleccionar la carpeta rstn-wallet/
# 5. La extensi?n debe aparecer sin errores
# 6. Click en el icono -> crear wallet
# 7. Conectar el frontend: ir a http://localhost:8080/terminal
# 8. Click "Conectar Wallet" -> debe detectar window.rstn
```

**Si la extensi?n no carga:**
1. `chrome://extensions` -> click "Errors" en la extensi?n
2. Verificar que no hay errores de `importScripts` (ya corregido)
3. Verificar que `manifest.json` no tiene `"type": "module"` en background
4. Recargar la extensi?n con el bot?n de refresh

**? Checkpoint 6:** La wallet crea una direcci?n `rstn1...` y el frontend la detecta.

---

## FASE 7 -- Testnet privada (2+ nodos)

```bash
# Nodo 1 (bootnode)
./target/release/rstn-node \
  --port 9944 \
  --p2p-port 9945 \
  --data-dir /tmp/rstn-node1 \
  --name "node1"

# Nodo 2 (se conecta al nodo 1)
./target/release/rstn-node \
  --port 9946 \
  --p2p-port 9947 \
  --data-dir /tmp/rstn-node2 \
  --name "node2" \
  --boot-nodes /ip4/127.0.0.1/tcp/9945

# Verificar que los nodos se descubren:
# En los logs debe aparecer "Connected to peer: ..."
```

**? Checkpoint 7:** Los logs de ambos nodos muestran `Connected to peer`.

---

## FASE 8 -- Testnet p?blica (cloud)

```bash
# Desplegar en un VPS (DigitalOcean, AWS, GCP)
# M?nimo: 4 vCPU, 8GB RAM, 100GB SSD

# 1. Compilar en release
cargo build --release

# 2. Copiar binario al VPS
scp target/release/rstn-node user@vps:/opt/rstn/

# 3. Configurar como servicio systemd
sudo tee /etc/systemd/system/rstn-node.service << 'EOF'
[Unit]
Description=Resistance Node
After=network.target

[Service]
Type=simple
User=resistance
ExecStart=/opt/rstn/rstn-node --port 9944 --p2p-port 9945 --data-dir /var/lib/rstn --name "rstn-public-1"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable rstn-node
sudo systemctl start rstn-node
sudo systemctl status rstn-node

# 4. Abrir puertos en el firewall
sudo ufw allow 9944/tcp  # RPC
sudo ufw allow 9945/tcp  # P2P
```

**? Checkpoint 8:** `curl http://VPS_IP:9944` responde desde otra m?quina.

---

## FASE 9 -- Actualizar frontend para testnet p?blica

```typescript
// src/lib/api.ts
// Cambiar RPC_URL de localhost a la IP del VPS
const RPC_URL = "http://VPS_IP:9944";

// Actualizar tambi?n en rstn-wallet/background.js
const RPC_URL = "http://VPS_IP:9944";
```

**? Checkpoint 9:** El frontend conecta al VPS y muestra datos reales.

---

## FASE 10 -- Auditor?a externa (pre-mainnet)

1. Contratar firma de auditor?a (Trail of Bits, Least Authority, Quarkslab)
2. Enviar el c?digo de `rstn-node/crates/` + `rstn-wallet/crypto.js`
3. Foco de auditor?a:
   - `rstn-crypto`: implementaci?n Keccak-512, derivaci?n de direcciones
   - `rstn-core/consensus.rs`: BFT consensus, supermajority, slashing
   - `rstn-vm`: execution sandbox, gas metering
   - `rstn-wallet/crypto.js`: Dilithium3 key generation, signing
4. Resolver todos los findings antes de mainnet

**? Checkpoint 10:** Reporte de auditor?a sin findings cr?ticos.

---

## Estructura de archivos del backend

```
rstn-node/
?-- Cargo.toml              # Workspace root
?-- docker-compose.yml      # 4-node testnet deployment
?-- Dockerfile              # Multi-stage build for production
?-- scripts/
|   ?-- generate-genesis.sh # Generate genesis with 4 validator keypairs
|   ?-- deploy-testnet.sh   # Deploy/status/stop/logs helper
?-- crates/
|   ?-- rstn-core/         # Tipos, estado, genesis, staking, governance
|   ?-- rstn-crypto/       # Keccak-512, Dilithium3, address derivation
|   ?-- rstn-storage/      # sled DB, accounts, blocks, txs, validators
|   ?-- rstn-vm/           # Smart contract VM (WASM sandbox)
|   ?-- rstn-p2p/          # libp2p networking, gossip, peer discovery
|   ?-- rstn-rpc/          # JSON-RPC server (18 methods)
|   ?-- rstn-bridge/       # Decentralized lock-and-mint bridge (protocol-pure)
|   ?-- rstn-node/         # Node runner, CLI, block production loop
?-- ROADMAP_BACKEND.md      # Roadmap detallado (7 fases)
?-- BRIDGE_LEGAL_DESIGN.md  # Decisi?n arquitect?nica del bridge
?-- AUDIT_FINAL.md          # 29 bugs corregidos documentados
```

## RPC Methods disponibles (18)

| Method | Descripci?n |
|--------|-------------|
| `resist_getNetworkStats` | Stats globales de la red |
| `resist_getBlock` | Bloque por n?mero |
| `resist_getBlockByHash` | Bloque por hash |
| `resist_getLatestBlock` | ?ltimo bloque |
| `resist_getTransaction` | TX por hash |
| `resist_getTransactions` | TXs por direcci?n |
| `resist_getBalance` | Balance + nonce de una direcci?n |
| `resist_sendTransaction` | Enviar TX firmada |
| `resist_getValidators` | Lista de validadores |
| `resist_getValidator` | Detalle de un validador |
| `resist_getStakingInfo` | Info de staking global |
| `resist_getFaucetInfo` | Info del faucet |
| `resist_faucetClaim` | Claim del faucet |
| `resist_getGovernanceProposals` | Propuestas activas |
| `resist_getGovernanceProposal` | Detalle de propuesta |
| `resist_getNodes` | Lista de nodos P2P |
| `resist_getNetworkTopology` | Topolog?a de la red |
| `resist_getShards` | Informaci?n de shards |

## Formato de transacci?n que el nodo espera

```json
{
  "from": "rstn1...",
  "to": "rstn1...",
  "amount": "1000000000000000000",
  "nonce": 0,
  "gas": "1000000000000000",
  "tx_type": "transfer",
  "signature": "hex-encoded 3309-byte Dilithium3 signature"
}
```

- `amount` y `gas` en **wei** (18 decimales)
- `nonce` es **secuencial** (0, 1, 2...) -- obtener de `resist_getBalance`
- `signature` es la firma Dilithium3 del JSON can?nico de la tx (sin el campo signature)
- `tx_type`: `transfer`, `stake`, `unstake`, `delegate`, `undelegate`, `claim`, `governance`

---

## Resumen de bugs corregidos (wallet Chrome)

| # | Bug | Fix |
|---|-----|-----|
| 1 | `importScripts` en module worker | Removido `"type": "module"` del manifest |
| 2 | `nonce: Date.now()` en WALLET_SEND | Ahora consulta `resist_getBalance` para nonce real |
| 3 | `getBalance` no manejaba errores | Devuelve defaults `{balance:"0.00", nonce:0}` |
| 4 | `WALLET_GET_STATE` no pasaba nonce | Ahora incluye `nonce` en la respuesta |
| 5 | `DAPP_SIGN` no documentaba formato | Comentado que msg.message es JSON string |
| 6 | `inpage.sendTransaction` usaba `WALLET_SEND` | Ahora usa `DAPP_SEND_TX` con handler propio |

---

## FASE 11 -- Tests unitarios (cargo test)

```bash
cd rstn-node

# Ejecutar todos los tests
cargo test

# Tests por crate
cargo test -p rstn-crypto        # Keccak, Dilithium3, address derivation
cargo test -p rstn-core          # BFT consensus, slashing, leader selection
cargo test -p rstn-storage       # CRUD blocks, mempool, accounts, nonce
cargo test -p rstn-bridge        # Replay prevention, threshold, reserves invariant

# Tests con output visible
cargo test -- --nocapture
```

**Tests disponibles:**

| Crate | Tests | Qu? validan |
|-------|-------|------------|
| `rstn-crypto` | 8 | Keccak determinismo, address derivation, Dilithium3 sign/verify |
| `rstn-core` | 7 | BFT threshold, slashing proporcional, leader selection, dup votes |
| `rstn-storage` | 7 | Block CRUD, mempool, account state, nonce increment, balance update |
| `rstn-bridge` | 6 | Reserves invariant, replay prevention, threshold, dup sigs, emergency pause |

**? Checkpoint 11:** `cargo test` termina con `test result: ok` en todos los crates.

---

## FASE 12 -- Bridge descentralizado

El bridge est? implementado en `rstn-bridge` como protocolo puro (sin operador central).
Ver `BRIDGE_LEGAL_DESIGN.md` para la decisi?n arquitect?nica.

```bash
# Verificar que el crate compila
cargo build -p rstn-bridge

# Tests del bridge
cargo test -p rstn-bridge

# Tests esperados:
#   test_proof_of_reserves_invariant ... ok
#   test_replay_prevention ... ok
#   test_threshold_logic ... ok
#   test_duplicate_signature_rejected ... ok
#   test_insufficient_reserves_for_burn ... ok
#   test_emergency_pause ... ok
```

**? Checkpoint 12:** El bridge compila y sus 6 tests pasan.

---

## FASE 13 -- Despliegue con Docker

```bash
# Generar genesis
bash scripts/generate-genesis.sh

# Desplegar 4 nodos
bash scripts/deploy-testnet.sh

# Verificar estado
bash scripts/deploy-testnet.sh --status

# Ver logs
bash scripts/deploy-testnet.sh --logs rstn-node-1

# Parar
bash scripts/deploy-testnet.sh --stop
```

**? Checkpoint 13:** Los 4 nodos responden a health checks y producen bloques.
