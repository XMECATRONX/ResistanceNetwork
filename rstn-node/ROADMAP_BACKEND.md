# RSTN -- Roadmap Backend: De Prototipo a Mainnet

> Este documento es el paso a paso exacto para llevar el nodo Rust, la wallet y el puente de prototipo a producto real con dinero real. Cada fase tiene criterios de salida verificables. No avanzar a la siguiente fase sin cumplir todos los criterios.

---

## FASE 0 -- Verificaci?n local (1-2 semanas)

### Objetivo
Compilar y ejecutar el nodo Rust localmente con el c?digo que ya tenemos escrito.

### Pasos

```bash
# 1. Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable

# 2. Compilar el nodo
cd rstn-node
cargo build --release

# 3. Ejecutar nodo ?nico (dev mode)
cargo run --release -- --dev --rpc-port 9944

# 4. Verificar que responde
curl -X POST http://localhost:9944 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"rstn_getStatus","params":[]}'
```

### Criterios de salida
- [ ] `cargo build --release` compila sin errores ni warnings
- [ ] El nodo arranca y produce bloques g?nesis
- [ ] `resist_getStatus` responde con height, peers, validators
- [ ] `resist_getBalance` responde para cuentas g?nesis
- [ ] La wallet Chrome se conecta y firma transacciones que aparecen en el explorer
- [ ] El faucet entrega RSTN de testnet

### Lo que falta en el c?digo Rust (corregir antes de compilar)

| Componente | Estado | Lo que falta |
|---|---|---|
| `rstn-crypto` | ? Dilithium3 + Kyber768 + Keccak | Verificar que `verify()` usa el mismo hash que `sign()` |
| `rstn-core` | ? Consenso BFT + transacciones | Implementar reorg handling y conflict resolution |
| `rstn-storage` | ? RocksDB + state | Implementar snapshotting y pruning de estado |
| `rstn-vm` | ? EVM-compatible b?sico | Implementar gas accounting completo y opcodes faltantes |
| `rstn-p2p` | ? libp2p gossip | Implementar peer discovery con Kademlia DHT |
| `rstn-rpc` | ? 19 m?todos | Implementar WebSocket subscriptions (newHeads, pendingTx) |
| `rstn-node` | ? Runner + config | Implementar graceful shutdown y checkpoint recovery |

---

## FASE 1 -- Testnet privada (2-4 semanas)

### Objetivo
Desplegar 4-7 nodos en servidores VPS y probar consenso multi-nodo, sincronizaci?n y tolerancia a fallos.

### Infraestructura necesaria

```
M?NIMO: 4 nodos VPS
  Nodo 1: 4 vCPU / 8GB RAM / 100GB SSD   (validator + seed)
  Nodo 2: 4 vCPU / 8GB RAM / 100GB SSD   (validator)
  Nodo 3: 2 vCPU / 4GB RAM / 80GB SSD    (validator)
  Nodo 4: 2 vCPU / 4GB RAM / 80GB SSD    (full node + RPC p?blico)

RECOMENDADO: 7 nodos (tolera 2 fallos con BFT 5-de-7)
  5 validators + 2 full nodes en 3 regiones distintas
```

### Proveedores recomendados
- **Hetzner** (Europa) -- ?15-30/mes por nodo, mejor precio
- **DigitalOcean** (USA/Europa) -- $24-48/mes por nodo
- **Vultr** (Asia/Europa/USA) -- $24-40/mes por nodo
- **Distribuci?n geogr?fica obligatoria** -- al menos 3 regiones

### Pasos de despliegue

```bash
# En cada VPS:

# 1. Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Clonar el repo
git clone https://github.com/resistance/rstn-node.git
cd rstn-node

# 3. Compilar
cargo build --release

# 4. Generar keypair de validador
./target/release/rstn-node generate-key --output validator.key

# 5. Configurar el nodo
cp config.example.toml config.toml
# Editar: rpc_port, p2p_port, validator_key, seed_nodes, region

# 6. Arrancar
./target/release/rstn-node --config config.toml

# 7. Registrar como servicio systemd
sudo tee /etc/systemd/system/resistance.service << 'EOF'
[Unit]
Description=Resistance Node
After=network.target

[Service]
Type=simple
User=resistance
ExecStart=/home/resistance/rstn-node/target/release/rstn-node --config /home/resistance/rstn-node/config.toml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable resistance
sudo systemctl start resistance
```

### Pruebas cr?ticas

```
TEST 1 -- Sincronizaci?n:
  Arrancar nodo 4 desde cero -> debe sincronizar todo el historial
  Verificar: altura coincide con nodo 1

TEST 2 -- Tolerancia a fallos (BFT):
  Detener 2 de 7 nodos -> la red sigue produciendo bloques
  Reiniciar -> se reincorporan y sincronizan

TEST 3 -- Partici?n de red:
  Dividir la red en 2 grupos -> el grupo con mayor?a sigue
  Reunir -> los nodos minoritarios se sincronizan

TEST 4 -- Transacciones reales:
  Enviar 1000 transacciones desde la wallet
  Verificar: todas confirmadas en <2s
  Verificar: fees quemadas (EIP-1559)
  Verificar: nonce incremental correcto

TEST 5 -- Staking y slashing:
  Delegar RSTN a un validador
  Validador hace doble firma -> slashing autom?tico
  Verificar: saldo reducido, validador removido

TEST 6 -- Bridge simulator:
  Ejecutar el bridge simulator contra nodos reales
  Verificar: lock -> SPV verify -> mint
  Verificar: redeem -> burn wBTC -> unlock BTC (simulado)
```

### Criterios de salida
- [ ] 7 nodos produciendo bloques en 3 regiones
- [ ] Sincronizaci?n desde cero en <30 min
- [ ] Tolerancia a 2 fallos sin interrupci?n
- [ ] 1000 TPS sostenidos sin degradaci?n
- [ ] Staking y slashing funcionando on-chain
- [ ] Bridge simulator E2E contra nodos reales
- [ ] Uptime >99% durante 7 d?as consecutivos

---

## FASE 2 -- Testnet p?blica (4-8 semanas)

### Objetivo
Abrir la testnet al p?blico. Cualquiera puede correr un nodo, usar el faucet y probar la wallet.

### Pasos

```
1. DOCUMENTACI?N P?BLICA
   ?-- Gu?a de instalaci?n de nodo (docs.rstn.network/run-a-node)
   ?-- Gu?a de wallet (docs.rstn.network/wallet)
   ?-- API reference completa (docs.rstn.network/api)
   ?-- Tutoriales en video (YouTube)

2. INFRAESTRUCTURA P?BLICA
   ?-- RPC p?blico: rpc.testnet.rstn.network:9944
   ?-- Block explorer: explorer.testnet.rstn.network
   ?-- Faucet: faucet.testnet.rstn.network
   ?-- Status page: status.rstn.network

3. INCENTIVACI?N
   ?-- Bug bounty para testnet (pagado en RSTN mainnet futuro)
   ?-- Programa de node operators (top 10 operadores reciben NFT)
   ?-- Hackathon con premios para primeras dApps

4. MONITOREO
   ?-- Grafana + Prometheus para m?tricas de red
   ?-- Alertas autom?ticas (Telegram/Discord) si:
   |   ?-- Un nodo se cae
   |   ?-- Latencia >5s
   |   ?-- TPS cae <50% del promedio
   |   ?-- Fork detectado
   ?-- Dashboard p?blico en tiempo real
```

### M?tricas a monitorear

```
SALUD DE RED:
  ?-- Nodos activos (meta: >20)
  ?-- Distribuci?n geogr?fica (meta: >5 pa?ses)
  ?-- TPS promedio (meta: >500)
  ?-- Latencia P99 (meta: <2s)
  ?-- Tiempo de finalidad (meta: <1s)
  ?-- Uptime (meta: >99.5%)

SEGURIDAD:
  ?-- Intentos de doble gasto (debe ser 0)
  ?-- Forks detectados (debe ser 0)
  ?-- Transacciones inv?lidas rechazadas (debe ser 100%)
  ?-- Ataques de spam (debe ser mitigado por gas)

ADOPCI?N:
  ?-- Wallets creadas (meta: >1000)
  ?-- Transacciones diarias (meta: >500)
  ?-- dApps desplegadas (meta: >5)
  ?-- TVL en staking (meta: >1M RSTN testnet)
```

### Criterios de salida
- [ ] 20+ nodos comunitarios activos
- [ ] 1000+ wallets creadas
- [ ] 500+ transacciones diarias
- [ ] 5+ dApps desplegadas por la comunidad
- [ ] Uptime >99.5% durante 30 d?as
- [ ] Cero forks, cero doble gastos
- [ ] Bug bounty activo con al menos 10 reportes resueltos

---

## FASE 3 -- Auditor?as externas (8-12 semanas)

### Objetivo
Auditor?as profesionales de criptograf?a, consenso y puentes antes de manejar dinero real.

### Auditor?as requeridas (NO OPCIONAL)

```
1. AUDITOR?A CRIPTOGR?FICA -- $50K-$150K
   Firma recomendada: Trail of Bits, NCC Group, Quarkslab
   Alcance:
   ?-- Implementaci?n de Dilithium3 (ML-DSA-65)
   ?-- Implementaci?n de Kyber768 (ML-KEM-768)
   ?-- Hashing Keccak-512 (canonical encoding)
   ?-- Derivaci?n de direcciones
   ?-- Verificaci?n de firmas (timing attacks, side channels)
   Entregable: Reporte p?blico + fixes verificados

2. AUDITOR?A DE CONSENSO -- $80K-$200K
   Firma recomendada: Gauntlet, Informal Systems, Least Authority
   Alcance:
   ?-- Protocolo BFT (liveness, safety, fault tolerance)
   ?-- Manejo de reorgs y conflictos
   ?-- Slashing logic (no false positives)
   ?-- Sincronizaci?n y bootstrapping
   ?-- Ataques de Sybil, Eclipse, Long-Range
   ?-- Sharding din?mico (cross-shard communication)
   Entregable: Reporte p?blico + pruebas formales

3. AUDITOR?A DE PUENTES -- $60K-$150K
   Firma recomendada: Certora, OpenZeppelin, ChainSecurity
   Alcance:
   ?-- Threshold ECDSA (MPC distribuida)
   ?-- SPV light clients (BTC, ETH, SOL)
   ?-- Lock/burn/mint logic
   ?-- Quantum Migration Program
   ?-- Reentrancy y overflow
   ?-- Manejo de emergencia (pause, upgrade, recovery)
   Entregable: Reporte p?blico + verificaci?n formal

4. AUDITOR?A DE VM -- $40K-$100K
   Firma recomendada: OpenZeppelin, ConsenSys Diligence
   Alcance:
   ?-- Gas accounting
   ?-- Opcodes (completitud y seguridad)
   ?-- Reentrancy protection
   ?-- DoS vectors
   Entregable: Reporte p?blico + fuzzing
```

### Timeline de auditor?as

```
Semanas 1-2:  Selecci?n de firmas + NDA + scope
Semanas 3-6:  Auditor?a criptogr?fica (paralela con consenso)
Semanas 3-8:  Auditor?a de consenso (m?s larga)
Semanas 6-10: Auditor?a de puentes (despu?s de consenso)
Semanas 8-12: Fixes + re-auditor?a de correcciones
Semana 12:    Reportes p?blicos publicados
```

### Criterios de salida
- [ ] 4 reportes de auditor?a publicados
- [ ] Todos los bugs cr?ticos y altos corregidos
- [ ] Re-auditor?a confirma fixes
- [ ] Bug bounty p?blico lanzado ($100K+ en premios)
- [ ] 30 d?as de bug bounty sin bugs cr?ticos nuevos

---

## FASE 4 -- Preparaci?n de mainnet (4-6 semanas)

### Objetivo
Preparar todo lo necesario para mainnet: g?nesis final, validadores iniciales, par?metros econ?micos.

### Pasos

```
1. G?NESIS DEFINITIVO
   ?-- Snapshot de testnet (saldos, staking, gobernanza)
   ?-- Validadores iniciales (m?nimo 21, ideal 64)
   ?-- Par?metros econ?micos finales:
   |   ?-- Supply total: 1,000,000,000 RSTN
   |   ?-- Inflaci?n inicial: 8% con halving cada 2 a?os
   |   ?-- Bridge fee: 0.15% est?ndar + 0.05% fast-path
   |   ?-- Revenue split: 60% burn / 30% stakers / 10% treasury
   |   ?-- EIP-1559: fee base quemada, priority fee al validador
   |   ?-- Quantum Migration: gratis
   ?-- Contratos de puente desplegados en BTC, ETH, SOL

2. SELECCI?N DE VALIDADORES INICIALES
   ?-- 21-64 validadores seleccionados de testnet
   ?-- Distribuci?n geogr?fica obligatoria (m?nimo 5 pa?ses)
   ?-- Ninguna entidad controla >20% de los validadores
   ?-- KYC/AML de operadores (si requiere jurisdicci?n)
   ?-- Acuerdo de???? (SLA) firmado

3. SMART CONTRACTS DE PUENTE
   ?-- BTC vault (P2WSH multi-sig threshold)
   ?-- ETH lock contract (burn para ERC-20, lock para ETH nativo)
   ?-- SOL bridge program
   ?-- Buyback & burn contract en Resistance
   ?-- Auditor?a de cada contrato (Fase 3)

4. WALLET PUBLICACI?N
   ?-- Chrome Web Store (extensi?n)
   ?-- Firefox Add-ons (extensi?n)
   ?-- App m?vil iOS (React Native o nativo)
   ?-- App m?vil Android (React Native o nativo)
   ?-- SDK p?blico (npm: @resistance/sdk)

5. INFRAESTRUCTURA MAINNET
   ?-- RPC p?blico: rpc.rstn.network
   ?-- Explorer: explorer.rstn.network
   ?-- Faucet: NO (mainnet no tiene faucet)
   ?-- Bridge UI: bridge.rstn.network
   ?-- Status: status.rstn.network
```

### Criterios de salida
- [ ] G?nesis final generado y verificado
- [ ] 21+ validadores iniciales confirmados
- [ ] Contratos de puente desplegados y auditados
- [ ] Wallet publicada en Chrome Web Store
- [ ] Infraestructura mainnet lista
- [ ] Plan de comunicaci?n y lanzamiento preparado

---

## FASE 5 -- Mainnet (d?a del lanzamiento)

### Objetivo
Lanzar mainnet con dinero real, transiciones seguras y respuesta a incidentes.

### Checklist del d?a del lanzamiento

```
T-72 horas:
  ?-- Congelar c?digo (code freeze)
  ?-- Backup completo de testnet
  ?-- Notificaci?n p?blica del g?nesis hash
  ?-- Validadores confirman readiness

T-24 horas:
  ?-- Validadores arrancan con g?nesis final
  ?-- Verificar sincronizaci?n entre todos
  ?-- Monitoreo activo 24/7
  ?-- Canal de emergencia abierto (Signal/Telegram)

T-0 (LANZAMIENTO):
  ?-- Bloque g?nesis producido
  ?-- Verificar: 21+ validadores activos
  ?-- Verificar: consenso BFT funcionando
  ?-- Abrir RPC p?blico
  ?-- Anuncio p?blico (Twitter, Discord, Blog)
  ?-- Bridge abierto (con l?mites iniciales)

T+1 hora:
  ?-- Primeras transacciones reales
  ?-- Verificar: fees quemadas correctamente
  ?-- Verificar: explorer muestra bloques en tiempo real
  ?-- Verificar: wallet conecta y firma

T+24 horas:
  ?-- Primer buyback & burn ejecutado
  ?-- Verificar: supply decreci?
  ?-- Dashboard de transparencia actualizado
  ?-- Reporte de salud p?blica

T+7 d?as:
  ?-- Auditor?a post-lanzamiento
  ?-- Review de incidentes
  ?-- Ajustes de par?metros si necesario (v?a gobernanza)
  ?-- Plan de escalado de validadores
```

### Plan de respuesta a incidentes

```
SEVERIDAD 1 -- CR?TICA (fondo en peligro):
  ?-- Pausar el puente inmediatamente
  ?-- Notificar a todos los validadores
  ?-- Comunicaci?n p?blica en <1 hora
  ?-- Investigaci?n con firma de auditor?a
  ?-- Recovery plan con treasury

SEVERIDAD 2 -- ALTA (consenso comprometido):
  ?-- Coordinar validadores para pausar
  ?-- Fork de emergencia si necesario
  ?-- Comunicaci?n p?blica en <4 horas
  ?-- Fix + re-auditor?a

SEVERIDAD 3 -- MEDIA (bug no cr?tico):
  ?-- Bug bounty reward
  ?-- Fix en pr?ximo upgrade
  ?-- Comunicaci?n en <24 horas
  ?-- Sin pausa necesaria

SEVERIDAD 4 -- BAJA (mejora):
  ?-- Documentar
  ?-- Fix en roadmap
  ?-- Sin urgencia
```

---

## FASE 6 -- Post-mainnet (continuo)

### Objetivo
Mantener, escalar y mejorar la red continuamente.

```
MENSUAL:
  ?-- Reporte de transparencia (buyback, burn, supply)
  ?-- Review de salud de red
  ?-- Review de seguridad
  ?-- Gobernanza: propuestas y votaciones

TRIMESTRAL:
  ?-- Auditor?a de seguridad continua
  ?-- Upgrade de protocolo si necesario
  ?-- Expansi?n de validadores
  ?-- Nuevas chains en el puente

ANUAL:
  ?-- Auditor?a criptogr?fica completa
  ?-- Review de la amenaza cu?ntica (?Shor es viable?)
  ?-- Halving de inflaci?n
  ?-- Reporte anual p?blico
```

---

## Presupuesto estimado

```
FASE 0 -- Local:           $0 (tu tiempo)
FASE 1 -- Testnet privada: $200-500/mes (VPS)
FASE 2 -- Testnet p?blica: $500-1500/mes (VPS + monitoring)
FASE 3 -- Auditor?as:      $230K-$600K total
FASE 4 -- Pre-mainnet:     $1000-3000/mes (infra)
FASE 5 -- Mainnet:         $2000-5000/mes (infra + monitoring)
FASE 6 -- Post-mainnet:    $3000-8000/mes (infra + team)

TOTAL A?O 1:              $300K-$700K
  (Auditor?as son el 60-80% del presupuesto)
```

---

## Equipo m?nimo necesario

```
ROLES CR?TICOS (no se puede lanzar sin estos):
  ?-- 1 L?der de protocolo (Rust, consenso, criptograf?a)
  ?-- 1 Ingeniero de puentes (cross-chain, SPV, MPC)
  ?-- 1 Ingeniero frontend (React, wallet, explorer)
  ?-- 1 DevOps (infraestructura, monitoreo, CI/CD)
  ?-- 1 Community manager (Discord, docs, soporte)

ROLES RECOMENDADOS:
  ?-- 1 Cript?grafo?? (part-time, revisi?n)
  ?-- 1 Legal?? (compliance, jurisdicci?n)
  ?-- 1 Dise?ador (UX/UI, branding)

TAMA?O M?NIMO: 5 personas
TAMA?O IDEAL: 8-10 personas
```

---

## Lo que NO debes hacer

```
? Lanzar mainnet sin auditor?as externas completas
? Lanzar mainnet sin bug bounty de 30+ d?as
? Lanzar el puente con dinero real sin auditor?a de contratos
? Controlar >33% de los validadores (rompe BFT)
? Prometer rendimiento garantizado (250K TPS) sin probarlo
? Prometer yield fijo (es un security bajo Howey Test)
? Lanzar sin plan de respuesta a incidentes
? Usar el treasury para fines personales
? Saltarse la testnet p?blica (la comunidad encuentra bugs que t? no ves)
? Tener prisa -- un bug en mainnet cuesta millones, no tiempo
```

---

## Resumen ejecutivo

```
FASE 0: Local          -> 1-2 semanas   -> $0
FASE 1: Testnet privada-> 2-4 semanas   -> $200-500/mes
FASE 2: Testnet p?blica-> 4-8 semanas   -> $500-1500/mes
FASE 3: Auditor?as     -> 8-12 semanas  -> $230K-$600K
FASE 4: Pre-mainnet    -> 4-6 semanas   -> $1000-3000/mes
FASE 5: Mainnet        -> 1 d?a         -> $2000-5000/mes
FASE 6: Post-mainnet   -> continuo      -> $3000-8000/mes

TIEMPO TOTAL: 6-9 meses (sin atajos)
PRESUPUESTO A?O 1: $300K-$700K
EQUIPO M?NIMO: 5 personas
RIESGO CR?TICO: Auditor?as (no saltar, no acortar)
```

> **Regla de oro:** Si no puedes permitirte las auditor?as, no lances mainnet. Un protocolo sin auditar con dinero real es negligencia, no innovaci?n.
