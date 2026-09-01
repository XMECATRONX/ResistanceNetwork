# RSTN — Estrategia de Lanzamiento Legal

## Decisión: Opción C — Fundación (Entidad Legal, no persona)

```
Fundación Resistance (Suiza o Singapur)
├── Entidad legal sin dueño personal visible
├── Consejo de la Fundación (miembros designados)
├── KYC/AML compliance a nivel entidad
├── Auditorías contratadas por la Fundación
├── Token emitido por la Fundación, no por personas
└── El equipo de desarrollo es "core contributor", no "dueño del token"
```

---

## Por qué NO lanzar anónimo en 2026

| Factor | Consecuencia |
|--------|-------------|
| FinCEN | Bridge = money transmitter. Sin licencia MSB = ilegal en EEUU |
| SEC | Token sin entidad legal = no se lista en exchanges serios |
| MiCA (UE) | Sin entidad registrada = no operas en Europa |
| Auditorías | Trail of Bits/Quantstamp no trabajan con anónimos |
| Exchanges | Binance, Coinbase, Kraken exigen KYC del equipo |
| Riesgo fiscal | Anónimo + bridge + token = patrón de evasión para un fiscal |

**Satoshi pudo hacerlo en 2009. Tú no puedes en 2026. Las reglas cambiaron.**

---

## Plan de Lanzamiento — 7 Fases

### FASE 1: Fundación Legal (Mes 1-2)

#### Opción A: Suiza (Zug) — RECOMENDADA

**Por qué Suiza:**
- Marco legal crypto más claro del mundo
- Ethereum Foundation, Cardano, Polkadot están ahí
- Fundación (Stiftung) no tiene dueño — protege tu identidad personal
- Reconoce tokens como utility, no security, si se estructura bien
- No exige revelar identidad al público, solo a las autoridades

**Pasos:**
1. Contratar abogado crypto suizo (ver contactos abajo)
2. Registrar Stiftung (Fundación) en Zug
3. Definir estatutos: propósito = desarrollo de infraestructura blockchain open-source
4. Nombrar Consejo de la Fundación (mínimo 2 miembros)
5. Abrir cuenta bancaria corporativa (requiere KYC del consejo)
6. Costo total: $15K-$30K

**Documentos necesarios:**
- Pasaporte del consejo (miembros designados)
- Proof of address
- CV profesional
- Source of funds declaration
- Plan de negocio de la Fundación

#### Opción B: Singapur

**Por qué Singapur:**
- Marco regulatorio crypto más claro de Asia
- Cardano Foundation está ahí
- Company Limited by Guarantee (CLG) — estructura similar a fundación
- MAS (Monetary Authority of Singapore) tiene sandbox regulatorio

**Pasos:**
1. Contratar abogado crypto en Singapur
2. Registrar Company Limited by Guarantee (CLG)
3. Postular a MAS sandbox si aplicas
4. Costo total: $10K-$25K

#### Opción C: Panamá (alternativa económica)

**Por qué Panamá:**
- Más económico ($3K-$8K)
- Fundación de Interés Privado — estructura flexible
- No hay regulación crypto específica todavía
- Menos prestigio que Suiza/Singapur

**Pasos:**
1. Contratar abogado panameño especializado en crypto
2. Registrar Fundación de Interés Privado
3. Costo total: $3K-$8K

---

### FASE 2: Estructura del Token (Mes 2)

**Objetivo:** RSTN NO es un security

#### Cómo lograrlo:
1. **No vender tokens** — fair launch / airdrop / staking rewards únicamente
2. **No prometer ROI** — los disclaimers ya están en el código
3. **Utility real** — RSTN se usa para gas, staking, gobernanza
4. **Sin pre-venta** — ya está en el diseño (sin ICO)
5. **Decentralización progresiva** — la Fundación renuncia control gradualmente

#### Documento legal:
- **Token Legal Opinion** — abogado emite opinión de que RSTN es utility token
- Costo: $5K-$15K
- Necesario para que exchanges te listen

---

### FASE 3: Compliance Bridge (Mes 2-3)

**El bridge es el riesgo legal más alto.**

#### Decisión arquitectónica: Protocolo puro sin KYC

| Enfoque | Riesgo | Estado |
|---------|--------|--------|
| Bridge con operador central | ALTO — money transmitter | NO |
| Bridge protocolo puro (lock-mint/burn-release) | MEDIO — protocolo, no operador | SÍ |
| Bridge con KYC integrado | BAJO pero fricciona UX | Pendiente |

**Nuestra decisión:** Protocolo puro (documentado en `BRIDGE_LEGAL_DESIGN.md`)

#### Compliance real:
1. **No custodiar fondos** — el protocolo lock-mint es no-custodial
2. **No transferir valor** — el usuario ejecuta la transacción, no la Fundación
3. **No cobrar fees del bridge** — o si se cobra, va a la tesorería on-chain
4. **AML monitoring** — monitoreo de transacciones sospechosas a nivel protocolo
5. **Sanctions screening** — verificar direcciones contra listas OFAC/SDN

**Documentos necesarios:**
- Memorando legal del bridge (abogado)
- AML policy document
- Sanctions compliance policy
- Costo: $8K-$20K

---

### FASE 4: Auditoría Externa (Mes 3-4)

**NO lanzar mainnet sin auditoría externa. Esto no es opcional.**

#### Firmas recomendadas (en orden de preferencia):

1. **Trail of Bits** — top tier, auditó Compound, Aave
   - Web: trailofbits.com
   - Costo: $50K-$150K
   - Tiempo: 6-10 semanas

2. **Quantstamp** — especializado en blockchain
   - Web: quantstamp.com
   - Costo: $40K-$120K
   - Tiempo: 6-8 semanas

3. **Halborn** — especializado en L1/L2
   - Web: halborn.com
   - Costo: $30K-$100K
   - Tiempo: 6-8 semanas

4. **Cure53** — especializado en criptografía
   - Web: cure53.de
   - Costo: $20K-$60K
   - Tiempo: 4-6 semanas

#### Qué auditar:
- [ ] Criptografía post-cuántica (Dilithium3, Kyber768, PQ-noise)
- [ ] Consenso BFT+DAG
- [ ] Bridge protocolo (lock-mint/burn-release)
- [ ] VM y smart contracts
- [ ] Storage y state transitions
- [ ] P2P networking
- [ ] RPC API

#### Bug Bounty (post-auditoría):
- Immunefi (immunefi.com) — plataforma estándar para bug bounties crypto
- Tiers: $1K (low) → $100K+ (critical)
- Presupuesto mínimo recomendado: $50K en reservas

---

### FASE 5: Testnet Pública (Mes 4-5)

**Requisitos antes de testnet pública:**
1. Fundación legal registrada
2. Token legal opinion obtenida
3. Bridge compliance documentado
4. Auditoría externa contratada (puede estar en progreso)
5. Bug bounty programa activo
6. Términos de servicio y privacy policy publicados (ya hechos)
7. Dominio y hosting bajo control de la Fundación

**Lanzamiento testnet:**
- 4-8 nodos validadores iniciales
- Faucet activo para testnet tokens (sin valor real)
- Block explorer público
- Documentación para validadores
- Canal de soporte (Discord/Telegram)

---

### FASE 6: Pre-Mainnet (Mes 5-6)

**Requisitos antes de mainnet:**
1. Auditoría externa completada — 0 issues críticos
2. Bug bounty ejecutado mínimo 30 días en testnet
3. 16+ validadores independientes
4. Fundación tiene gobernanza on-chain funcional
5. KYC del equipo ante exchanges objetivo
6. Listing agreements negociados (mínimo 1 exchange tier-2)
7. Liquidez inicial asegurada
8. Plan de descentralización publicado

---

### FASE 7: Mainnet (Mes 6+)

**Solo si TODO lo anterior está completo.**

1. Genesis block con distribución fair launch
2. Sin asignación a fundadores (ya en diseño)
3. Bridge activado con limits de capacidad iniciales
4. Monitoreo 24/7 de nodos
5. Soporte de comunidad activo
6. Roadmap de descentralización en ejecución

---

## Presupuesto Total Estimado

| Item | Costo (USD) | Opcional? |
|------|------------|-----------|
| Fundación (Suiza) | $15K-$30K | NO |
| Abogado crypto (retainer) | $10K-$25K | NO |
| Token legal opinion | $5K-$15K | NO |
| Bridge legal memo + AML | $8K-$20K | NO |
| Auditoría externa | $40K-$150K | NO |
| Bug bounty reservas | $50K | Recomendado |
| Exchange listing (tier-2) | $10K-$50K | Recomendado |
| Hosting/infraestructura | $2K-$5K/mes | NO |
| Marketing/comunidad | $5K-$20K | Opcional |
| **TOTAL MÍNIMO** | **$130K-$315K** | |

---

## Abogados Crypto Recommlendados

### Suiza
1. **MME Legal** (Zug) — auditó Ethereum Foundation
   - Web: mme.ch
   - Especialidad: fundaciones crypto, token opinions
   
2. **Lenz & Staehelin** — firma top de Suiza
   - Web: lenzstaehelin.ch
   - Especialidad: regulatory, fintech

3. **Bär & Karrer** — firma top de Suiza
   - Web: baerkarrer.ch
   - Especialidad: corporate, fintech

### Singapur
1. **Drew & Napier** — firma top de Singapur
   - Web: drewnapier.com
   - Especialidad: MAS regulatory, crypto

2. **Rajah & Tann** — especializado en fintech
   - Web: rajahandtann.com
   - Especialidad: crypto, blockchain

### EEUU (si operas en EEUU)
1. **Cooley LLP** — top crypto law firm
   - Web: cooley.com
   - Clientes: Coinbase, OpenSea, Polygon

2. **Perkins Coie** — especializado en blockchain
   - Web: perkinscoie.com
   - Clientes: Filecoin, Tezos

3. **a16z crypto legal** — Andreessen Horowitz
   - Web: a16z.com
   - Especialidad: token structuring

### Panamá (alternativa económica)
1. **Morgan & Morgan** — firma top de Panamá
   - Web: mororgan.com.pa
   - Especialidad: fundaciones de interés privado

---

## Timeline Resumido

```
Mes 1-2:  Fundación legal + abogado retainer
Mes 2:    Token legal opinion + bridge compliance
Mes 3-4:  Auditoría externa (contratar + ejecutar)
Mes 4-5:  Testnet pública + bug bounty
Mes 5-6:  Pre-mainnet + exchange listings
Mes 6+:   Mainnet launch
```

---

## Checklist Final Pre-Mainnet

- [ ] Fundación registrada (Suiza/Singapur/Panamá)
- [ ] Abogado crypto con retainer activo
- [ ] Token legal opinion: "RSTN es utility token"
- [ ] Bridge: protocolo puro documentado
- [ ] AML policy + sanctions screening implementados
- [ ] Auditoría externa completada (0 issues críticos)
- [ ] Bug bounty ejecutado 30+ días
- [ ] 16+ validadores independientes
- [ ] KYC del equipo ante exchanges
- [ ] Listing agreement firmado (mínimo 1 exchange)
- [ ] Términos de servicio publicados (✅ hecho)
- [ ] Privacy policy publicada (✅ hecho)
- [ ] Disclaimers visibles en landing (✅ hecho)
- [ ] Disclaimers en terminal (✅ hecho)
- [ ] Plan de descentralización publicado
- [ ] Liquidez inicial asegurada
- [ ] Infraestructura de monitoreo 24/7
- [ ] Soporte de comunidad (Discord/Telegram)

---

## Reglas No Negociables

1. **NO lances mainnet sin auditoría externa**
2. **NO vendas tokens como investment contracts**
3. **NO operes el bridge como money transmitter sin licencia**
4. **NO prometas ROI o rendimiento garantizado**
5. **NO lances anónimo en 2026**
6. **NO uses el PQ-noise placeholder en producción**
7. **NO ignores AML/KYC del bridge**

**Si cumples estas 7 reglas, el riesgo legal es cercano a cero.**

---

## Disclaimer legal

Este documento es orientativo y no constituye asesoría legal. Antes de cualquier lanzamiento público, debe ser revisado por un abogado especializado en criptoactivos licenciado en la jurisdicción de operación.

---

**Versión:** 1.0 · Estado: borrador interno — confidencial, no público.
