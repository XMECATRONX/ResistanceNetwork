# RSTN — Análisis Legal Completo

> **Versión:** 1.0
> **Alcance:** Auditoría legal de todas las superficies del proyecto (frontend, terminal, SDK, wallet, nodo, documentación)
> **Disclaimer:** Este documento es un análisis interno de riesgos legales. NO constituye asesoría legal. Antes de cualquier lanzamiento público, contratar un abogado especializado en cripto/blockchain.

---

## Resumen Ejecutivo

| Área Legal | Riesgo | Estado | Acción Requerida |
|-----------|--------|--------|-----------------|
| Securities Law (SEC/Howey) | MEDIO | Bien encaminado | Reforzar disclaimers |
| Money Transmitter Licensing | ALTO | No abordado | Decisión arquitectónica crítica |
| AML/KYC/FinCEN | ALTO | No implementado | Diseñar antes de mainnet |
| Cross-chain Bridge Legal | ALTO | Parcialmente abordado | Estructura legal del comité |
| Wallet Extension Legal | MEDIO | Bien encaminado | Non-custodial confirmado |
| Post-Quantum Compliance | BAJO | Excelente | NIST FIPS alineado |
| International (MiCA/EU) | MEDIO | No abordado | Análisis jurisdiccional |
| IP/Patentes | BAJO | Bien encaminado | Apache 2.0 correcto |
| Privacidad de Datos | MEDIO | No abordado | GDPR + on-chain data |
| Protección al Consumidor | MEDIO | Parcial | Disclaimers incompletos |

---

## 1. SECURITIES LAW — Test Howey y Clasificación del Token RSTN

### 1.1 Marco regulatorio actual (2026)

En marzo de 2026, la SEC publicó una **Interpretación Conjunta SEC-CFTC** que establece una taxonomía de 5 categorías para criptoactivos:

1. **Digital Commodities** — NO es security. Valor derivado de oferta/demanda, no de esfuerzo gerencial de otros. Ej: BTC, ETH, SOL, ADA.
2. **Digital Securities** — ES security. Instrumentos financieros bajo definición estatutaria.
3. **Digital Collectibles** — NFTs.
4. **Digital Tools** — Tokens de utilidad pura.
5. **Stablecoins** — Respaldo 1:1.

### 1.2 Análisis Howey para RSTN

El test Howey tiene 4 elementos. Para ser security, debe cumplir TODOS:

| Elemento Howey | RSTN cumple? | Análisis |
|---------------|-------------|----------|
| **1. Inversión de dinero** | **NO claro** | Distribution model es "fair launch" — no hay venta de tokens. Pero el equipo recibe 10% (vesting). Staking requiere RSTN. |
| **2. Empresa común** | **NO** | No hay empresa central que controla los fondos. Gobernanza on-chain. Treasury controlado por votación. |
| **3. Expectativa de ganancias** | **RIESGO** | El marketing menciona "yield", "recompensas", "deflacionario", "burn reduce supply". Esto puede interpretarse como expectativa de ganancia. |
| **4. Esfuerzo gerencial de otros** | **RIESGO** | El equipo tiene 10% con vesting. El equipo desarrolla el protocolo. Los stakers dependen del trabajo del equipo para que la red funcione. |

### 1.3 Riesgos identificados en el código

**Problemas encontrados en `protocol.ts`:**

```typescript
// LÍNEA 2233: RIESGO — afirmación legal sin base
notSecurity: "RSTN no es un security. No garantizamos rendimiento..."

// LÍNEA 2235: RIESGO — análisis Howey automático
howeyTest: "El modelo pasa el Howey Test: (1) no hay inversión de dinero..."

// LÍNEA 821: RIESGO — lenguaje de rendimiento
rewardType: "Variable según rendimiento de red — NO garantizado"

// LÍNEA 1244: RIESGO — muestra APY
apy: "Variable"  // Bien que dice "Variable", pero mostrar APY implica rendimiento

// LÍNEA 1549: BIEN — claro
noIco: "Cero ICO. Cero pre-venta. Cero VC. Cero venta de tokens en cualquier forma."
```

### 1.4 Fortalezas del diseño actual

- **Fair launch**: No hay ICO, pre-venta, o venta OTC documentada
- **Distribution por trabajo**: Proof of Participation, no inversión
- **Airdrops retroactivos**: La SEC clarificó en 2026 que airdrops sin contraprestación NO son securities
- **Staking como servicio**: La SEC clarificó en 2025-2026 que protocol staking (self-staking, delegated staking) generalmente NO es security
- **"Variable" en vez de APY fijo**: Correcto — no garantiza rendimiento

### 1.5 Debilidades a corregir

1. **No afirmar "pasa el Howey Test"** — un abogado debe hacer ese análisis, no el código
2. **Remover lenguaje de "yield" y "recompensas"** donde implique ganancia garantizada
3. **El 10% al equipo con vesting** — la SEC puede ver esto como "esfuerzo gerencial de otros" (elemento 4 de Howey)
4. **"Deflacionario" como selling point** — implica que el token subirá de valor, lo que satisface el elemento 3 de Howey
5. **Agregar disclaimers más fuertes** en toda superficie visible

### 1.6 Recomendaciones

```
ANTES DE MAINNET:
1. Contratar abogado cripto (Cooley, Latham & Watkins, o WilmerHale)
2. Obtener opinion legal formal de "no-security" (No-Action Letter a la SEC)
3. Remover "pasa el Howey Test" del código — reemplazar con "consulte asesoría legal"
4. Cambiar "deflacionario" por "mecanismo de escasez" (sin implicar valor)
5. Documentar que staking rewards son compensación por servicio (validación), no ganancia
6. Considerar registrar RSTN como digital commodity (nueva vía SEC 2026)
```

---

## 2. MONEY TRANSMITTER LICENSING — Riesgo más alto

### 2.1 El problema

Casi todos los estados de EE.UU. requieren **licencia de money transmitter** para negocios que transmiten valor monetario, incluyendo criptomonedas. Esto aplica a:

- **Exchanges** (compra/venta cripto-fiat)
- **Custodios** (mantener cripto de otros)
- **Transmisores** (transferir cripto de A a B)
- **Bridges** (mover valor entre chains)

### 2.2 Análisis por componente de Resistance

| Componente | ¿Es money transmitter? | Riesgo |
|-----------|----------------------|--------|
| **Nodo (validador)** | NO — minado/staking está excluido en la mayoría de estados | BAJO |
| **Faucet (testnet)** | NO — tokens sin valor, no es valor monetario | BAJO |
| **Wallet Chrome (non-custodial)** | DEPENDE — si no custodia claves, no es MT | MEDIO |
| **Bridge cross-chain** | **SÍ** — transfiere valor entre chains | **ALTO** |
| **DEX integrado (buyback)** | **SÍ** — si ejecuta swaps cripto-cripto | **ALTO** |
| **Staking pool** | DEPENDE — si es protocol-level, generalmente NO | BAJO |

### 2.3 El bridge es el mayor riesgo legal

El Quantum Migration Program y el Lock-and-Mint Bridge realizan funciones que pueden calificar como money transmission:

- **Custodia de BTC** (threshold ECDSA committee) → potencialmente custodio regulado
- **Transferencia de valor cross-chain** → money transmitter
- **Emisión de tokens respaldados** (wBTC) → potencialmente money issuer

**Cada estado tiene reglas diferentes:**

| Estado | Tratamiento | Licencia requerida? |
|--------|------------|-------------------|
| **Nueva York** | BitLicense obligatoria | SÍ — costoso, complejo |
| **California** | Money Transmission Act | SÍ — para bridges/custodia |
| **Wyoming** | Exento para cripto puro | NO — estado amigable |
| **Texas** | Money Services Act | SÍ — para transmisión |
| **Florida** | Money Services Business | SÍ — para transmisión |

### 2.4 Recomendaciones

```
DECISIÓN ARQUITECTÓNICA CRÍTICA:

Opción A: Resistance NO opera el bridge directamente
- El bridge es un protocolo descentralizado
- Los validadores ejecutan el código, no "Resistance" la entidad
- Los comités de firmantes son independientes
- Esto reduce el riesgo de money transmitter
- PERO: la SEC/FinCEN puede aplicar "control de facto"

Opción B: Estructura legal separada para el bridge
- Spin-off del bridge como entidad separada
- Obtener licencias Money Transmitter en estados clave
- Costo: $5M-$15M en licencias + compliance
- Tiempo: 12-24 meses

Opción C: Excluir EE.UU. inicialmente
- Operar desde jurisdicción amigable (Suiza, Singapur, UAE)
- Geo-bloquear usuarios EE.UU.
- PERO: validadores EE.UU. aún pueden operar
- Riesgo residual: SEC puede reclamar jurisdicción

RECOMENDACIÓN: Opción A + opinión legal formal antes de mainnet
```

---

## 3. AML / KYC / FinCEN — Compliance Anti-Lavado de Dinero

### 3.1 Marco regulatorio

**FinCEN (federal):**
- BSA (Bank Secrecy Act) aplica a MSBs (Money Service Businesses)
- Cripto businesses que transmiten valor son MSBs
- Requisitos: registro FinCEN, AML program, KYC, SAR (Suspicious Activity Reports), CTR (Currency Transaction Reports)

**FATF Travel Rule (internacional):**
- Transacciones >$1,000 USD requieren información del originador y beneficiario
- VASPs (Virtual Asset Service Providers) deben implementar
- En vigor en muchas jurisdicciones desde 2023-2025

### 3.2 Análisis de Resistance

| Componente | AML/KYC aplica? | Estado |
|-----------|----------------|--------|
| **Validadores** | NO — minado/staking no es VASP | OK |
| **Wallet non-custodial** | NO — software no custodia fondos | OK |
| **Faucet** | NO — tokens sin valor | OK |
| **Bridge** | **SÍ** — transmite valor cross-chain | **NO IMPLEMENTADO** |
| **DEX (buyback)** | **SÍ** — ejecuta swaps | **NO IMPLEMENTADO** |
| **Staking delegado** | DEPENDE — si es protocol-level, generalmente no | OK |

### 3.3 El problema del bridge

El Quantum Migration Program transfiere valor real (BTC, ETH) entre blockchains. Esto es exactamente el tipo de actividad que FinCEN regula:

- **Custodia** de BTC en el comité threshold ECDSA
- **Transferencia** de valor de Bitcoin a Resistance
- **Emisión** de wBTC respaldado

Sin KYC/AML, el bridge puede ser usado para lavar dinero:
1. Actor malicioso obtiene BTC de actividad ilícita
2. Migra a Resistance vía bridge (sin KYC)
3. wBTC en Resistance es "limpio"
4. Transfiere de vuelta a otra chain

### 3.4 Recomendaciones

```
NIVEL 1 — Testnet (actual):
- No aplica (tokens sin valor)
- Documentar que testnet no requiere AML

NIVEL 2 — Mainnet sin bridge:
- Validadores no requieren KYC (no son VASPs)
- Wallet non-custodial no requiere KYC
- Faucet no aplica (sin valor)

NIVEL 3 — Mainnet con bridge (futuro):
- El bridge REQUIERE estructura de compliance
- Opciones:
  A) Bridge descentralizado puro (sin operador central) — reduce riesgo
  B) Bridge operado por entidad licenciada — costo alto
  C) Bridge con KYC integrado en smart contract — posible pero complejo
  D) Geo-restricción + proof-of-reserves — mitigación parcial

RECOMENDACIÓN: Diseñar el bridge como protocolo descentralizado puro.
El protocolo no es una entidad — es código. Los validadores ejecutan código.
Esto reduce (no elimina) el riesgo AML.
```

---

## 4. CROSS-CHAIN BRIDGE — Riesgo Legal Específico

### 4.1 Riesgos identificados

**4.1.1 Custodia de BTC (threshold ECDSA committee)**

El comité de 100 firmantes custodia BTC en una dirección P2WSH. Esto es:
- **Custodia calificada** en muchas jurisdicciones
- **Fiduciary duty** hacia los usuarios que migraron
- **Segregation of funds** requerida
- **Proof of Reserves** obligatoria

**4.1.2 Emisión de wBTC/wETH**

Emitir tokens respaldados 1:1 por activos custodiados puede calificar como:
- **Money issuance** en algunas jurisdicciones
- **Stablecoin** regulation (si se interpreta como stablecoin)
- **Security** si se interpreta como "receipt" con derechos

**4.1.3 Liability por hacks del bridge**

$3B+ hackeado en puentes 2021-2024. Si el puente de Resistance es hackeado:
- **Developer liability** — si el código tenía bugs conocidos
- **Fiduciary breach** — si no se siguió duty of care
- **Class action** — usuarios afectados pueden demandar
- **Regulatory enforcement** — SEC/CFTC puede investigar

### 4.2 Análisis del código actual

```typescript
// LÍNEA 2068: RIESGO — "estilo tBTC" sin estructura legal de tBTC
solution: "Resistance usa un modelo de dos capas inspirado en tBTC..."

// LÍNEA 2070: BIEN — Proof of Reserves pública
custody: "Proof of Reserves pública: cualquier persona puede verificar..."

// LÍNEA 2073: BIEN — limitación honesta documentada
honestLimitation: "La custodia del BTC en Bitcoin es ECDSA, no post-cuántica..."

// FALTA: Estructura legal del comité de firmantes
// FALTA: Seguro de custodia (insurance)
// FALTA: Acuerdo de términos de servicio del bridge
// FALTA: Proceso de disputas
// FALTA: Jurisdicción legal del comité
```

### 4.3 Recomendaciones

```
1. Estructura legal del comité de firmantes:
   - LLC o DAO-LLC en Wyoming
   - Acuerdo de firmantes (signer agreement)
   - Seguro de custodia ($10M+ coverage)
   - Audit trimestral de Proof of Reserves

2. Términos de servicio del bridge:
   - Aceptación de riesgos por el usuario
   - Limitación de liability
   - Jurisdicción y ley aplicable
   - Proceso de disputas (arbitraje)

3. Seguro:
   - Custody insurance (ej: Lloyd's of London crypto custody)
   - Smart contract insurance (ej: Nexus Mutual, InsurAce)
   - Bug bounty ($500K+ como ya está en gobernanza)

4. Compliance:
   - Si opera en EE.UU.: BitLicense o exención
   - Si opera en EU: MiCA compliance
   - Si opera globalmente: VASP registration por jurisdicción
```

---

## 5. WALLET CHROME EXTENSION — Análisis Legal

### 5.1 Estado actual

La wallet Resistance es **non-custodial** — las claves privadas nunca salen del dispositivo del usuario. Esto es la posición más segura legalmente.

### 5.2 Análisis

| Aspecto | Estado | Riesgo |
|---------|--------|--------|
| **Custodia de claves** | Non-custodial (claves en navegador) | BAJO |
| **Money transmitter** | No transmite (el usuario firma) | BAJO |
| **KYC/AML** | No aplica (software, no servicio) | BAJO |
| **Chrome Web Store** | Requiere developer account | MEDIO |
| **Privacy policy** | No existe | MEDIO |
| **Terms of service** | No existe | MEDIO |
| **Liability disclaimer** | No existe | ALTO |

### 5.3 Recomendaciones

```
ANTES DE PUBLICAR EN CHROME WEB STORE:

1. Privacy Policy (requerido por Chrome):
   - Qué datos se almacenan (solo claves cifradas localmente)
   - No se recopilan datos personales
   - No se envían datos a servidores
   - Cumple GDPR/CCPA

2. Terms of Service:
   - "Software proporcionado tal cual, sin garantía"
   - "El usuario es responsable de sus claves"
   - "Resistance no es custodio de fondos"
   - Limitación de liability

3. Chrome Web Store:
   - Cuenta de developer ($5 USD)
   - Revisión de seguridad de la extensión
   - Manifest V3 compatible (ya lo es)
   - No solicitar permisos innecesarios

4. Disclaimers en la UI:
   - "RSTN Wallet no custodia tus fondos"
   - "Tu clave privada nunca sale de tu dispositivo"
   - "Si pierdes tu seed phrase, no hay recuperación"
```

---

## 6. POST-QUANTUM COMPLIANCE — Alineación con NIST

### 6.1 Estado: EXCELENTE

Resistance usa exclusivamente algoritmos estandarizados por NIST:

| Algoritmo | Estándar NIST | Uso en Resistance | Estado |
|-----------|-------------|-------------|--------|
| **Dilithium3 (ML-DSA-65)** | FIPS 204 (agosto 2024) | Firmas de transacciones | ✅ Estandarizado |
| **Kyber768 (ML-KEM-768)** | FIPS 203 (agosto 2024) | Transporte P2P (KEM) | ✅ Estandarizado |
| **SHA-3 / Keccak-512** | FIPS 202 | Hashing | ✅ Estandarizado |
| **SPHINCS+ (SLH-DSA)** | FIPS 205 | Fallback de firmas | ✅ Estandarizado |
| **Ed25519** | RFC 8032 | Firma híbrida (transición) | ✅ Estándar IETF |

### 6.2 Cumplimiento regulatorio PQC

- **Quantum Computing Cybersecurity Preparedness Act** (ley federal): Aplica a agencias federales, no a privadas. Resistance no está obligado pero se adelanta.
- **NIST IR 8547**: Deprecación de algoritmos clásicos post-2030. Resistance ya no usa ECDSA/Ed25519 como esquema primario.
- **CNSA 2.0**: Requisitos para sistemas nacionales de seguridad. No aplica a Resistance directamente, pero alinea.
- **EU PQC Roadmap** (2025): Critical infrastructure PQ-resistant by 2030. Resistance cumple.

### 6.3 Riesgo residual

```
RIESGO BAJO en PQC compliance.

Único riesgo: si NIST actualiza o retira un estándar (como pasó con Rainbow en 2022),
Resistance debe tener un migration path. El código ya documenta esto:
- Firmas híbridas (Dilithium3 + Ed25519) — si uno cae, el otro sostiene
- Quantum alarm on-chain para detección
- Fork protocol para migración de esquemas

RECOMENDACIÓN: Mantener monitoreo de NIST publications. Suscribirse a NIST PQC mailing list.
```

---

## 7. INTERNACIONAL — MiCA, EU, y otras jurisdicciones

### 7.1 EU MiCA (Markets in Crypto-Assets Regulation)

MiCA entró en vigor completo en diciembre de 2024. Aplica a:

| Actividad de Resistance | MiCA aplica? | Requisito |
|-------------------|-------------|-----------|
| **Emisión de RSTN** | SÍ — token no respaldado | Whitepaper registration, transparencia |
| **Validadores** | NO — protocol-level | Exento |
| **Bridge (custodia)** | SÍ — custody service | Licencia CASP |
| **Wallet non-custodial** | NO — software | Exento |
| **Faucet** | NO — sin valor | Exento |

### 7.2 Otras jurisdicciones

| Jurisdicción | Requisito principal | Riesgo |
|--------------|-------------------|--------|
| **Suiza** | FINMA registration si hay emisión | MEDIO |
| **Singapur** | MAS Payment Services Act | MEDIO |
| **UAE (VARA)** | VASP license para servicios | MEDIO |
| **UK** | FCA crypto registration | ALTO |
| **Hong Kong** | VASP license (capital alto) | ALTO |
| **Japón** | FSA registration | ALTO |
| **Corea del Sur** | VASP registration | MEDIO |

### 7.3 Recomendaciones

```
1. Antes de mainnet público:
   - Decidir jurisdicción de operación (recomendado: Suiza o Singapur)
   - Registrar entidad legal (Foundation, LLC, o DAO-LLC)
   - Whitepaper MiCA-compliant si atiende EU

2. Geo-restricción inicial:
   - Excluir EE.UU., UK, y jurisdicciones restrictivas
   - Usar geo-IP blocking en frontend
   - ToS con lista de jurisdicciones excluidas

3. Post-mainnet expansión:
   - Obtener licencias jurisdicción por jurisdicción
   - Priorizar Wyoming (DAO-LLC), Suiza, Singapur
```

---

## 8. PROPIEDAD INTELECTUAL — Licencia Apache 2.0

### 8.1 Estado: BIEN

```typescript
// protocol.ts línea 972
license: "Apache 2.0"
patentClause: "Apache 2.0 incluye patente defensiva — contribuidores otorgan licencia de patente a los usuarios."
```

Apache 2.0 es la elección correcta para un proyecto blockchain open-source:
- Permite uso comercial
- Permite forks
- Incluye licencia de patente (defensiva)
- Compatible con la mayoría de ecosistemas

### 8.2 Riesgos

```
1. Verificar que TODOS los contribuidores firmen CLA (Contributor License Agreement)
   - Necesario para defender la licencia de patente
   - Sin CLA, un contribuidor puede reclamar patente después

2. Registrar marca "Resistance" y "RSTN"
   - USPTO (EE.UU.)
   - EUIPO (Europa)
   - WIPO (internacional)
   - Costo: ~$2,000-$5,000

3. Verificar que no se usa código con licencia incompatible
   - GPL/AGPL es incompatible con Apache 2.0
   - Revisar todas las dependencias Rust y TypeScript
```

---

## 9. PRIVACIDAD DE DATOS — GDPR y on-chain data

### 9.1 El problema

La blockchain es pública e inmutable. GDPR otorga el derecho a:
- **Rectificación** de datos personales
- **Eliminación** (derecho al olvido)
- **Portabilidad** de datos

Si una dirección de Resistance se asocia a una persona (ej: via KYC, faucet, o transacción identificable), los datos en la blockchain son inmutables y no pueden eliminarse.

### 9.2 Análisis

| Dato | Es personal? | Eliminable? | Riesgo |
|------|-------------|------------|--------|
| **Dirección rstn1...** | DEPENDE — si se asocia a identidad | NO (inmutable) | MEDIO |
| **Transacciones** | SÍ si se asocia a persona | NO | MEDIO |
| **Stake/delegación** | SÍ si se asocia a persona | NO | MEDIO |
| **Clave pública Dilithium3** | SÍ si se asocia | NO | MEDIO |
| **Votos de gobernanza** | SÍ | NO | MEDIO |

### 9.3 Recomendaciones

```
1. NO recolectar datos personales on-chain:
   - Sin KYC on-chain (si se requiere KYC, hacerlo off-chain)
   - Sin nombres en transacciones
   - Sin metadata identificable

2. Privacy Policy:
   - "Resistance no recopila datos personales"
   - "Las transacciones on-chain son públicas e inmutables"
   - "El usuario es responsable de no incluir datos personales en transacciones"

3. Direcciones stealth (ya implementado en diseño):
   - Cada transacción deriva una dirección one-time
   - Reduce asociación entre transacciones y identidad

4. Para usuarios EU:
   - Designar DPO (Data Protection Officer) si procesa datos EU
   - Registrar con autoridad de protección de datos
   - Mecanismo de ejercicio de derechos GDPR (off-chain)
```

---

## 10. PROTECCIÓN AL CONSUMIDOR — Disclaimers y riesgo

### 10.1 Estado actual

```typescript
// protocol.ts línea 974
disclaimer: "Resistance es software experimental open-source. No es una inversión. No hay garantía de valor. Úsalo bajo tu propio riesgo."
```

### 10.2 Disclaimers faltantes

**En la landing page:**
- No hay disclaimer visible de riesgo financiero
- No hay disclaimer de "no es inversión"
- No hay disclaimer de "pérdida total posible"

**En el terminal:**
- El faucet no advierte que los tokens no tienen valor
- El staking no advierte riesgo de slashing claramente
- El bridge no advierte riesgo de pérdida

**En la wallet:**
- No hay disclaimer de "si pierdes tu clave, pierdes tus fondos"
- No hay disclaimer de "software experimental"

### 10.3 Recomendaciones

```
1. Landing page — banner de disclaimer:
   "Resistance es software experimental. Los tokens RSTN no tienen valor garantizado.
    La participación en staking implica riesgo de slashing.
    Las transacciones en blockchain son irreversibles.
    No inviertes más de lo que puedes permitirte perder."

2. Terminal — disclaimer en cada vista de acción:
   - Faucet: "Los tokens de testnet no tienen valor monetario"
   - Staking: "El stake puede ser slashed. Riesgo de pérdida parcial"
   - Bridge: "El puente puede ser hackeado. Riesgo de pérdida total"
   - Wallet: "Si pierdes tu seed phrase, no hay recuperación"

3. Wallet — disclaimer en onboarding:
   - "RSTN Wallet es software experimental"
   - "Tus claves nunca salen de tu dispositivo"
   - "Si pierdes tu seed phrase, pierdes acceso a tus fondos"
   - "Resistance no puede recuperar tus claves"

4. Documentos legales requeridos:
   - Terms of Service (ToS)
   - Privacy Policy
   - Risk Disclosure
   - Cookie Policy (si usa cookies)
```

---

## 11. CHECKLIST DE COMPLIANCE PRE-MAINNET

### Fase 1 — Testnet (actual)
- [x] Código del nodo completo y auditado
- [x] Criptografía NIST FIPS alineada
- [x] Apache 2.0 license
- [x] Fair launch distribution (no ICO)
- [x] Disclaimers básicos en protocol.ts
- [ ] Privacy Policy de la wallet
- [ ] Terms of Service del terminal
- [ ] Disclaimer banner en landing

### Fase 2 — Testnet pública
- [ ] Registro de entidad legal (jurisdicción a decidir)
- [ ] Registro de marca "Resistance" y "RSTN"
- [ ] Privacy Policy completa (GDPR/CCPA)
- [ ] Terms of Service completos
- [ ] Risk Disclosure document
- [ ] Geo-restricción de jurisdicciones sancionadas
- [ ] AML monitoring en faucet (rate limiting ya existe)

### Fase 3 — Pre-mainnet
- [ ] Opinión legal formal de "no-security" (abogado cripto)
- [ ] Auditoría legal del bridge (estructura del comité)
- [ ] Seguro de custodia para el bridge
- [ ] Proof of Reserves auditada
- [ ] CLA de todos los contribuidores
- [ ] MiCA whitepaper (si atiende EU)
- [ ] VASP registration (jurisdicción seleccionada)

### Fase 4 — Mainnet
- [ ] Todas las licencias requeridas obtenidas
- [ ] AML/KYC program operacional (si el bridge está activo)
- [ ] Travel Rule compliance (si aplica)
- [ ] Bug bounty activo ($500K+)
- [ ] Incident response plan legal
- [ ] DPO designado (si atiende EU)
- [ ] Reportes regulatorios periódicos

---

## 12. CONCLUSIÓN Y PRIORIDADES

### Riesgo más alto: Money Transmitter Licensing + Bridge Legal

El Quantum Migration Program es el diferenciador único del proyecto, pero también es el componente con mayor riesgo legal. La custodia de BTC vía threshold ECDSA, la emisión de wBTC respaldado, y la transferencia cross-chain son actividades que requieren licencias y compliance en la mayoría de jurisdicciones.

### Riesgo medio: Securities Law (Howey)

El diseño "fair launch" reduce significativamente el riesgo, pero el lenguaje de marketing ("deflacionario", "yield", "recompensas") puede ser interpretado como expectativa de ganancia. Se necesita opinion legal formal y ajuste de lenguaje.

### Riesgo bajo: PQC Compliance

Resistance está excelentemente alineado con NIST FIPS 203/204/205. No hay riesgo regulatorio en criptografía post-cuántica — al contrario, es una ventaja competitiva.

### Prioridad de acción inmediata (lo que se puede hacer ahora):

1. **Agregar disclaimers visibles** en landing, terminal y wallet
2. **Crear Privacy Policy y Terms of Service** básicos
3. **Remover afirmaciones legales del código** ("pasa el Howey Test")
4. **Documentar que el bridge requiere estructura legal separada**
5. **Cambiar lenguaje de "deflacionario" a "mecanismo de escasez"**
6. **Agregar "no es inversión" en toda superficie visible**

### Prioridad post-testnet (requiere abogado):

1. Opinión legal formal de no-security
2. Estructura legal del comité de firmantes del bridge
3. Registro de marca
4. Decisión de jurisdicción
5. MiCA whitepaper si atiende EU

---

*Este documento debe ser revisado por un abogado especializado en cripto/blockchain antes de cualquier lanzamiento público. Las regulaciones cambian rápidamente — este análisis es válido a fecha de agosto 2026.*
