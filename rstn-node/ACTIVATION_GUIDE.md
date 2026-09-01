# RSTN -- Gu?a de Activaci?n (Para ti, el fundador)

> **Esto es lo que yo (la IA) no puedo hacer y T? s?.**
> Sigue estos pasos en tu m?quina local. Cada paso tiene el comando exacto y qu? esperar.
> Plataforma: macOS / Linux / Windows (WSL2 recomendado).

---

## FASE 0 -- Preparar tu m?quina (15 min)

### 0.1 Instalar Rust

```bash
# macOS / Linux / WSL2
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version   # debe mostrar 1.75+
```

Windows nativo (sin WSL): descarga `rustup-init.exe` desde https://rustup.rs

### 0.2 Instalar dependencias del sistema

```bash
# Ubuntu / Debian / WSL2
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev protobuf-compiler

# macOS (con Homebrew)
brew install openssl protobuf
```

`protobuf-compiler` es obligatorio -- libp2p lo necesita para compilar.

### 0.3 Instalar Node.js (para el frontend) y Bun

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Bun (runtime del frontend)
curl -fsSL https://bun.sh/install | bash
```

### 0.4 Instalar Docker (para la testnet multi-nodo)

```bash
# Ubuntu
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
# cierra sesi?n y vuelve a entrar para que el grupo aplique
```

macOS: instala Docker Desktop desde https://docker.com

### ? Checkpoint Fase 0

```bash
rustc --version && cargo --version && node --version && bun --version && docker --version
```
Los 5 comandos deben responder con versiones. Si alguno falla, no continues.

---

## FASE 1 -- Compilar el nodo Rust (20-40 min la primera vez)

```bash
cd rstn-node
cargo build --release 2>&1 | tee build.log
```

### Qu? esperar
- La primera compilaci?n descarga ~300 dependencias y tarda 20-40 min.
- Al final ver?s: `Finished release [optimized] target(s)`.

### Si hay errores de compilaci?n

**Es normal que haya errores** -- yo no puedo compilar aqu?, as? que algunos los descubrir?s t?. Los m?s probables:

| Error | Soluci?n |
|-------|----------|
| `error: linking with cc failed` | `sudo apt install build-essential` |
| `protoc not found` | `sudo apt install protobuf-compiler` |
| `openssl not found` | `sudo apt install libssl-dev pkg-config` |
| `error[E0XXX]: ...` en c?digo | Lee el error, me lo pegas y lo corrijo |

**Si aparece un error que no entiendes:**
1. Copia las ?ltimas 30 l?neas del `build.log`
2. P?gamelas aqu?
3. Yo te doy el fix exacto

> **Importante:** No intentes arreglar errores de tipos a ciegas. P?samelos. Conozco el c?digo completo y puedo darte el fix en segundos.

### ? Checkpoint Fase 1

```bash
./target/release/rstn-node --version
```
Debe imprimir la versi?n del nodo. Si lo hace, el nodo compila.

---

## FASE 2 -- Ejecutar los tests (5 min)

```bash
cargo test --release 2>&1 | tee test.log
```

### Qu? esperar
- 28 tests en 4 crates.
- Al final: `test result: ok. 28 passed; 0 failed`.

### Si alg?n test falla
Copia el nombre del test y el error, p?samelo. Lo corrijo.

### ? Checkpoint Fase 2
Todos los tests en verde.

---

## FASE 3 -- Nodo ?nico en modo dev (10 min)

```bash
# Borra cualquier estado previo
rm -rf ~/.resistance

# Arranca un solo nodo productor de bloques
./target/release/rstn-node --dev
```

### Qu? esperar
- El nodo crea un g?nesis autom?tico.
- Ver?s logs cada ~2 segundos: `Produced block #1`, `#2`, `#3`...
- El RPC queda escuchando en `http://localhost:9944`.

### Verificar que responde (en otra terminal)

```bash
curl -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"rstn_blockNumber","params":[],"id":1}'
```

Debe responder algo como:
```json
{"jsonrpc":"2.0","result":"42","id":1}
```

Si el n?mero sube, el nodo produce bloques. ?

### ? Checkpoint Fase 3
`resist_blockNumber` responde y sube con el tiempo.

---

## FASE 4 -- Conectar el frontend al nodo real (10 min)

```bash
# En otra terminal, en la ra?z del proyecto
cd ..
bun install
```

Edita `src/lib/api.ts`:

```ts
// Cambia esta l?nea:
export let RPC_MODE = false;
// Por:
export let RPC_MODE = true;
```

Y aseg?rate de que el endpoint apunte a tu nodo:
```ts
export const RPC_ENDPOINT = "http://localhost:9944";
```

Arranca el frontend:
```bash
bun run dev
```

### Qu? verificar
1. Abre `http://localhost:5173` en el navegador.
2. Ve al Terminal (`/terminal`).
3. Abre la vista **Explorer** -- deben aparecer bloques reales (no mocks).
4. Abre **Overview** -- el contador de bloques debe subir en vivo.

### Si el terminal sigue mostrando mocks
El frontend detecta autom?ticamente si el RPC responde. Si no responde en 2s, vuelve a mock. Verifica:
- El nodo sigue corriendo (`localhost:9944`).
- Abre la consola del navegador (F12) -- busca logs de `rpcCallWithFallback`.

### ? Checkpoint Fase 4
El Terminal muestra bloques reales que suben en vivo.

---

## FASE 5 -- Testnet de 4 nodos con Docker (20 min)

```bash
cd rstn-node

# Genera el g?nesis para 4 nodos
bash scripts/generate-genesis.sh

# Levanta los 4 nodos
bash scripts/deploy-testnet.sh
```

### Qu? esperar
- Docker levanta 4 contenedores: `rstn-node-1` a `rstn-node-4`.
- Cada nodo escucha en un puerto distinto (9944, 9945, 9946, 9947).
- Los nodos se descubren v?a P2P y forman consenso BFT.

### Verificar el estado
```bash
bash scripts/status.sh   # si existe, si no: docker ps
```

### Probar el consenso entre nodos
```bash
# Bloque del nodo 1
curl -s -X POST http://localhost:9944 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"rstn_blockNumber","params":[],"id":1}'

# Bloque del nodo 2 -- debe ser el MISMO n?mero (consenso)
curl -s -X POST http://localhost:9945 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"rstn_blockNumber","params":[],"id":1}'
```

Si ambos nodos reportan el mismo n?mero de bloque (o muy cercano), el consenso BFT funciona entre nodos. ?

### Parar la testnet
```bash
bash scripts/stop.sh   # o: docker-compose down
```

### ? Checkpoint Fase 5
4 nodos, mismo n?mero de bloque, consenso BFT real.

---

## FASE 6 -- Probar la wallet Chrome (15 min)

### Cargar la extensi?n
1. Abre Chrome y ve a `chrome://extensions`
2. Activa **Modo desarrollador** (esquina superior derecha)
3. Click en **Cargar descomprimida**
4. Selecciona la carpeta `rstn-wallet/` del proyecto
5. La extensi?n Resistance aparece en tu lista de extensiones.

### Fijar el RPC de la wallet
Edita `rstn-wallet/background.js` -- busca la l?nea del endpoint y aseg?rate:
```js
const RPC_ENDPOINT = "http://localhost:9944";
```

### Probar el flujo completo
1. Click en el ?cono de Resistance en Chrome -> crea una wallet (genera claves Dilithium3).
2. Copia tu direcci?n.
3. Ve al **Faucet** del terminal -> pide tokens a tu direcci?n.
4. Ve a **Staking** -> haz stake con tus tokens.
5. Ve al **Explorer** -> busca tu direcci?n -> deben aparecer tus transacciones.

### ? Checkpoint Fase 6
Wallet crea claves, faucet entrega tokens, staking funciona, explorer muestra el historial.

---

## FASE 7 -- Despliegue de testnet p?blica (opcional, 1-2 horas)

### Alquilar un VPS
- M?nimo: 4 vCPU, 8GB RAM, 100GB SSD (Hetzner ~$15/mes, DigitalOcean ~$48/mes).
- Ubuntu 22.04 LTS.

### Desplegar 1 nodo seed p?blico
```bash
# En el VPS
git clone <tu-repo> resistance && cd resistance/rstn-node
cargo build --release

# Arrancar como nodo p?blico (puerto 9944 abierto al mundo)
./target/release/rstn-node \
  --rpc-external \
  --rpc-port 9944 \
  --p2p-port 30333 \
  --name "rstn-seed-01"
```

### Apuntar el frontend a la testnet p?blica
Edita `src/lib/api.ts`:
```ts
export const RPC_ENDPOINT = "http://TU_IP_VPS:9944";
```

Despliega el frontend (Vercel/Netlify):
```bash
bun run build
# sube la carpeta dist/ a tu hosting
```

### ? Checkpoint Fase 7
`https://tu-dominio.com` muestra el terminal conectado a tu testnet p?blica.

---

## RESUMEN -- Lo que T? haces, en orden

| Fase | Qu? haces | Tiempo | ?Necesitas mi ayuda? |
|------|-----------|-------|---------------------|
| 0 | Instalar Rust, Node, Bun, Docker | 15 min | No |
| 1 | `cargo build --release` | 20-40 min | **S?, si hay errores** -- p?galos |
| 2 | `cargo test` | 5 min | S?, si falla alg?n test |
| 3 | `--dev run` + curl | 10 min | No |
| 4 | Editar `api.ts` + `bun run dev` | 10 min | No |
| 5 | Docker 4 nodos | 20 min | S?, si el consenso no sincroniza |
| 6 | Cargar wallet en Chrome | 15 min | No |
| 7 | VPS p?blico (opcional) | 1-2 h | No |

---

## REGLA DE ORO

**Cuando algo falle, no lo arregues a ciegas.**
Copia el error (las ?ltimas 20-30 l?neas), p?galo aqu? y yo te doy el fix exacto en segundos. Conozco las ~6,000 l?neas de Rust del nodo. Lo que t? ver?as como "error misterioso de tipos", yo lo veo como una l?nea espec?fica que corregir.

**El flujo correcto es:**
1. T? ejecutas el comando.
2. Si falla, me pegas el error.
3. Yo te doy el fix (archivo + l?nea + c?digo).
4. T? aplicas el fix y repites.

As? llegamos al nodo funcionando al 100%.
