# RSTN — Plan de Marketing y Distribución de Tokens

## Principio fundamental: NO hay venta de tokens

```
┌─────────────────────────────────────────────────────┐
│  RSTN NO SE VENDE. RSTN SE GANA.                       │
│                                                       │
│  Sin ICO. Sin pre-venta. Sin whitelist de compra.     │
│  Sin precio de venta. Sin "early bird". Sin "presale".│
│  Esto NO es negociable — es la base legal del token. │
└─────────────────────────────────────────────────────┘
```

**¿Por qué?** Si vendes tokens, es un security bajo el Howey Test. Si los distribuyes por participación, es un utility token. La diferencia es ir a la cárcel o no.

---

## Distribución de Tokens — 1,000,000,000 RSTN

### Modelo: Fair Launch con Recompensas por Participación

```
Distribución Total: 1,000,000,000 RSTN (1 Billón)
├── 0%    Fundadores / Equipo           → $0 (SIN asignación)
├── 0%    Inversores / VCs              → $0 (SIN venta privada)
├── 0%    ICO / Pre-venta              → $0 (NO existe)
│
├── 45%   Block Rewards (Staking)      → 450M RSTN — emitidos gradualmente en 20 años
├── 20%   Comunidad & Airdrops         → 200M RSTN — distribuidos en 3 años
├── 15%   Ecosistema & Grants          → 150M RSTN — dev grants, hackathons, partnerships
├── 10%   Liquidez & Market Making    → 100M RSTN — DEX/CEX liquidity pools
├── 5%    Tesorería de la Fundación   → 50M RSTN — gobernanza, operaciones, auditorías
└── 5%    Reserva de Seguridad        → 50M RSTN — bug bounty, slashing protection, emergencias
```

### Vesting (Bloqueo progresivo)

| Bucket | Vesting | Razón |
|--------|---------|-------|
| Block Rewards | Emitido por bloques en 20 años | Igual que Bitcoin — sin pre-mining |
| Airdrops | 25% al claim, 75% en 12 meses | Previene dump inmediato |
| Grants | Por hito (milestone-based) | Solo se libera al entregar |
| Liquidez | 50% en TGE, 50% en 6 meses | Asegura liquidez continua |
| Fundación | 4 años, linear monthly | Sin acceso a capital grande de golpe |
| Reserva | 2 años, liberado por gobernanza | La comunidad decide cuándo usar |

### TGE (Token Generation Event)

**NO es un "lanzamiento de token" tradicional.** Es la creación del genesis block.

```
Genesis Block:
├── Tesorería Fundación: 50M RSTN (locked 4 años)
├── Reserva Seguridad: 50M RSTN (locked 2 años, gobernanza)
├── Liquidez inicial: 50M RSTN (50% inmediato, 50% en 6 meses)
├── Airdrop Wave 1: 30M RSTN (disponible al claim)
└── Resto: 820M RSTN (emitidos via block rewards en 20 años)
```

---

## Whitelist — SÍ, pero para AIRDROP, no para venta

### Aclaración crítica

**NO hay whitelist de compra.** No vendemos tokens a nadie.

**SÍ hay whitelist de airdrop.** Los usuarios se registran para RECIBIR tokens gratis por participación temprana.

### Criterios de Airdrop (Sybil-resistant)

| Actividad | Puntos | Verificación |
|-----------|--------|-------------|
| Unirse a Discord + verificación | 100 pts | Roles de Discord |
| Seguir en X/Twitter | 50 pts | API de Twitter |
| Retweet + like del anuncio principal | 50 pts | API de Twitter |
| Completar tutorial de testnet | 500 pts | On-chain: tx verificada |
| Ejecutar un nodo de testnet 7+ días | 2,000 pts | On-chain: uptime verificado |
| Validar bloques en testnet | 3,000 pts | On-chain: bloques firmados |
| Reportar bugs (bug bounty testnet) | 500-10,000 pts | GitHub issues verified |
| Contribuir código (PRs merged) | 5,000-50,000 pts | GitHub PRs merged |
| Crear contenido educativo | 1,000-5,000 pts | Review manual |
| Traducir documentación | 2,000 pts | PR merged |

### Distribución del Airdrop

```
Wave 1 (Genesis):    30M RSTN — Top participantes de testnet
Wave 2 (Mes 3):      50M RSTN — Comunidad ampliada
Wave 3 (Mes 6):      40M RSTN — Nuevos contribuidores
Wave 4 (Mes 9):      30M RSTN — Ecosistema en expansión
Wave 5 (Mes 12):     25M RSTN — Recompensa continua
Wave 6 (Mes 24):     25M RSTN — Long-term community
```

### Anti-Sybil (prevenir bots)

1. **Proof of Humanity opcional** — no obligatorio, pero bonus 2x
2. **On-chain activity required** — no solo social, debe haber tx reales en testnet
3. **Análisis de patrones** — clustering de wallets, timing de txs
4. **CAP de Discord** — máximo 50K puntos por cuenta social
5. **Múltiples snapshots** — promedio de varios puntos en el tiempo, no un solo snapshot

---

## Plan de Marketing — 5 Fases

### FASE 0: Stealth + Tech Credibility (Mes -3 a 0)

**Objetivo:** Construir credibilidad técnica ANTES de cualquier marketing masivo.

| Acción | Detalle | Costo |
|--------|---------|-------|
| Whitepaper publicado | Ya hecho (`WHITEPAPER.md`) | $0 |
| GitHub público | Código open-source, commits regulares | $0 |
| Documentación técnica | Ya hecho (README, AUDIT_FINAL, etc.) | $0 |
| Twitter/X tech account | Threads sobre PQC, lattice crypto, NIST | $0 |
| Blog técnico (Medium/Mirror) | Artículos profundos: "Por qué BTC morirá sin PQC" | $0 |
| Discord técnico | Canales: #cryptography, #consensus, #dev | $0 |
| Presencia en foros | Bitcointalk, Reddit r/cryptocurrency, r/CryptoCurrency | $0 |

**KPIs Fase 0:**
- 500 miembros en Discord
- 2,000 followers en X
- 10 contribuidores en GitHub
- 5 artículos técnicos publicados

### FASE 1: Testnet Launch (Mes 1-3)

**Objetivo:** Activar desarrolladores y validadores tempranos.

| Acción | Detalle | Costo |
|--------|---------|-------|
| Testnet pública | 4-8 nodos, faucet activo | $2K/mes hosting |
| Developer docs | Guías de integración SDK, RPC, wallet | $0 |
| Hackathon #1 | "Build on Resistance" — $50K en grants | $50K |
| Bug bounty testnet | Recompensas en RSTN (testnet) | $0 (testnet tokens) |
| Validator program | Guías de setup, incentives | $0 |
| AMAs técnicos | Semanal en Discord/Twitter Spaces | $0 |
| Partnerships técnicos | Charlas con wallets, explorers, infra | $0 |

**Marketing de Fase 1 — Mensaje:**
```
"No invertimos en marketing. Invertimos en tecnología.
Si la tecnología es buena, la comunidad viene sola.
Si la tecnología es mala, ningún marketing la salva."
```

**KPIs Fase 1:**
- 5,000 miembros en Discord
- 15,000 followers en X
- 50 validadores en testnet
- 100 desarrolladores activos
- 10,000 transacciones en testnet
- 5 dApps construidas

### FASE 2: Pre-Mainnet Hype (Mes 3-5)

**Objetivo:** Construir expectativa genuina sin prometer ROI.

| Acción | Detalle | Costo |
|--------|---------|-------|
| Auditoría externa anunciada | Trail of Bits / Halborn | $40K-$150K |
| Airdrop Wave 1 anunciado | Criterios públicos, transparentes | $0 |
| Exchange listing negotiation | Mínimo 1 tier-2 CEX | $10K-$50K |
| PR campaign | PR Newswire / Bitcoin Magazine | $10K-$20K |
| Influencer outreach | Solo tech KOLs, no "shillers" | $5K-$15K |
| Mainnet countdown | Transparencia total del progreso | $0 |
| Community contests | Mejor dApp, mejor validador, mejor contenido | $10K en RSTN |

**Regla de oro de comunicación:**
```
NUNCA prometer precio.
NUNCA prometer ROI.
NUNCA decir "to the moon".
NUNCA comparar con BTC/ETH en términos de precio.
SIEMPRE hablar de tecnología, seguridad, decentralización.
```

**KPIs Fase 2:**
- 25,000 miembros en Discord
- 50,000 followers en X
- 200 validadores registrados
- 500 desarrolladores
- 50,000 wallets en testnet
- 3 dApps en producción

### FASE 3: Mainnet Launch (Mes 6)

**Objetivo:** Lanzar con máxima transparencia y cero hype artificial.

| Acción | Detalle | Costo |
|--------|---------|-------|
| Mainnet genesis block | Fair launch, sin pre-mining | $5K hosting |
| Airdrop Wave 1 distribuido | 30M RSTN a comunidad | $0 (on-chain) |
| Exchange listing live | CEX + DEX liquidity | $10K-$50K |
| Block explorer público | Live desde día 1 | $0 (ya construido) |
| Wallet Chrome publicada | Chrome Web Store | $0 |
| Press release | "First post-quantum blockchain goes live" | $5K |
| Mainnet monitoring | Dashboard público 24/7 | $0 (ya construido) |
| Validator onboarding | Programa activo de validadores | $0 |

**Estrategia de listing:**

```
Día 1:  DEX (Uniswap v3 / su propio DEX) — liquidez propia
Día 7:  CEX tier-3 (MEXC, Gate.io) — accesibilidad
Día 30: CEX tier-2 (KuCoin, Bybit) — volumen
Día 90: CEX tier-1 (Binance, Coinbase) — legitimidad
```

**KPIs Fase 3:**
- 100,000 miembros en Discord
- 100,000 followers en X
- 500 validadores activos
- 1,000 holders de RSTN
- $5M volumen diario
- 100,000 transacciones en mainnet

### FASE 4: Growth & Ecosystem (Mes 6+)

**Objetivo:** Construir el ecosistema, no solo la cadena.

| Acción | Detalle | Costo |
|--------|---------|-------|
| Grants program activo | $5K-$50K por proyecto en RSTN | 150M RSTN reservados |
| Hackathon #2 | "Post-Quantum DeFi" | $100K en premios |
| Partnerships | Wallets, explorers, oracles, bridges | $0 |
| Developer evangelism | Conferencias, workshops, cursos | $20K/año |
| Ecosystem fund | Inversiones en proyectos Resistance | 150M RSTN |
| Cross-chain expansion | Más bridges, más interoperabilidad | $0 |
| Community DAO | Gobernanza on-chain activa | $0 |

---

## Presupuesto de Marketing

| Item | Costo (USD) | Fase |
|------|------------|------|
| Hosting testnet/mainnet | $2K-$5K/mes | 0-4 |
| Hackathon #1 | $50K | 1 |
| Hackathon #2 | $100K | 4 |
| PR campaign | $10K-$20K | 2 |
| Influencer (tech KOLs) | $5K-$15K | 2 |
| Exchange listing | $10K-$50K | 2-3 |
| Developer evangelism | $20K/año | 4 |
| Community contests | $10K en RSTN | 2 |
| Grants program | 150M RSTN (no USD) | 4 |
| **TOTAL USD** | **$107K-$210K** | |

**Comparación con proyectos que gastan $5M-$20M en marketing:**
Nosotros gastamos 10x menos porque la tecnología habla por sí sola. Si la PQC es real y la amenaza cuántica es inminente, la narrativa se vende sola.

---

## Narrativa de Marketing — El Pitch

### Elevator Pitch (30 segundos)

```
"Bitcoin, Ethereum y Solana usan criptografía que una computadora 
cuántica puede romper en minutos. Cuando esa computadora llegue 
—y IBM/Google dicen 2029-2033— toda la riqueza en blockchain 
desaparece. RSTN es la primera blockchain Layer 1 
construida desde cero con criptografía post-cuántica certificada 
por el NIST. No es un upgrade. Es la única opción."
```

### Mensajes clave (use estos, no otros)

| ✅ Usar | ❌ NO usar |
|---------|-----------|
| "Post-quantum security" | "Quantum-proof" (no existe proof 100%) |
| "NIST FIPS 203/204/205 certified" | "Unbreakable" / "hacker-proof" |
| "Fair launch, sin ICO" | "Get in early" / "don't miss out" |
| "Utility token for gas & staking" | "Investment opportunity" |
| "Built from scratch for the quantum era" | "Better than Bitcoin" |
| "1B supply, transparent distribution" | "Limited supply, price will moon" |

### Canales de comunicación

| Canal | Propósito | Tono |
|-------|-----------|------|
| X/Twitter (@resistancenetwork) | Anuncios, threads técnicos | Técnico, serio |
| Discord | Comunidad, soporte, dev chat | Colaborativo |
| GitHub | Código, issues, PRs | Transparente |
| Blog (Mirror/Medium) | Artículos profundos | Educativo |
| YouTube | Tutoriales, demos, AMAs | Didáctico |
| Telegram | Comunidad internacional | Accesible |
| Reddit | Discusión técnica | Analítico |

---

## Roadmap de Comunicación

```
Mes -3:  Whitepaper + GitHub público + Discord técnico
Mes -2:  Primeros threads en X sobre PQC
Mes -1:  Testnet privada (invitados)
Mes  0:  Testnet pública + faucet + docs
Mes  1:  Hackathon #1 + bug bounty
Mes  2:  Airdrop criterios anunciados
Mes  3:  Auditoría externa anunciada
Mes  4:  Airdrop Wave 1 snapshot
Mes  5:  Mainnet countdown + exchange teasers
Mes  6:  MAINNET LIVE + Airdrop Wave 1 + Listing
Mes  7:  Airdrop Wave 2 + Grants program
Mes  9:  Airdrop Wave 3
Mes 12:  Airdrop Wave 4 + Ecosystem expansion
```

---

## Anti-Patrones — Lo que NUNCA haremos

1. **NUNCA pagar "shillers"** — influencers que solo bombean tokens
2. **NUNCA prometer precio** — "RSTN will hit $10" = demanda de la SEC
3. **NUNCA hacer "presale"** — ni disfrazado de "early access"
4. **NUNCA comprar listings** — pagando exchanges con tokens no registrados
5. **NUNCA ocultar riesgos** — slashing, bugs, irreversibilidad son reales
6. **NUNCA comparar con BTC en precio** — comparar en tecnología, sí
7. **NUNCA decir "quantum-proof"** — decir "quantum-resistant"
8. **NUNCA lanzar sin auditoría** — ni aunque la presión de la comunidad lo exija
9. **NUNCA custodiar fondos de usuarios** — el bridge es no-custodial
10. **NUNCA tener una "private sale"** — ni a "amigos" ni a "familia"

---

## Métricas de Éxito (no son precio)

| Métrica | Objetivo Mes 6 | Objetivo Mes 12 |
|---------|---------------|----------------|
| Validadores activos | 500 | 1,000+ |
| TPS promedio | 10,000 | 50,000 |
| dApps en mainnet | 10 | 50 |
| Desarrolladores activos | 500 | 2,000 |
| Wallets únicas | 100,000 | 500,000 |
| Transacciones diarias | 50,000 | 500,000 |
| TVL en DeFi | $10M | $100M |
| Nodos geodistribucionados | 20 países | 50 países |
| Uptime | 99.9% | 99.99% |
| Bug bounty claims | 0 críticos | 0 críticos |

**El precio del token NO es una métrica de éxito.** La adopción, la seguridad y la decentralización sí lo son.

---

## Nota

Este plan es orientativo. La decisión final de distribución corresponde a la gobernanza on-chain.

**Versión:** 1.0 · Estado: borrador interno — confidencial, no público.
