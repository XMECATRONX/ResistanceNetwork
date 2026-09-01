# SECURITY_INTERNAL.md — Documentación Confidencial del Equipo

> ⚠️ **NO DEPLOYAR** — Este archivo NO se compila, NO se incluye en el bundle del frontend,
> NO es accesible desde el navegador. Es documentación interna del equipo de RSTN.
> Si este archivo aparece en producción, es un incidente SEV-1.

---

## 1. Estructura del Equipo de Seguridad

**Principio:** 7 dominios de ataque, 7 equipos especializados. Cada equipo tiene un responsable,
protocolo de respuesta y métricas de cobertura.

**Total:** 12-15 especialistas

| Rol | Dominio | Responsabilidades | Reporta a |
|---|---|---|---|
| Criptógrafo Jefe | Criptografía PQ | Diseño de esquemas, revisión criptanalítica, migration path | Director Técnico |
| Investigador PQ (×2) | Criptografía PQ | Monitoreo de papers criptanalíticos, análisis de vulnerabilidades lattice | Criptógrafo Jefe |
| Ingeniero de Consenso | Consenso BFT+DAG | Implementación de BFT, slashing, VRF, sharding | Director Técnico |
| Investigador BFT (×2) | Consenso BFT+DAG | Modelado de game theory, análisis de ataques de colusión | Ingeniero de Consenso |
| Ingeniero de Red P2P | Red y Transporte | libp2p, gossip, discovery, onion routing | Director Técnico |
| Especialista en Networking | Red y Transporte | DDoS mitigation, peer scoring, NAT traversal | Ingeniero de Red P2P |
| Ingeniero de VM | Smart Contracts | RSTN-VM, opcodes, access lists, formal verification | Director Técnico |
| Auditor de Smart Contracts | Smart Contracts | Auditoría de contratos, circuit breakers, fuzzing | Ingeniero de VM |
| Economista del Protocolo | Economía y Staking | Tokenomics, slashing economics, MEV prevention | Director Técnico |
| Analista de Game Theory | Economía y Staking | Modelado de incentivos, análisis de captura | Economista del Protocolo |
| DevOps | Infraestructura | CI/CD, Docker, releases firmados, monitoring | Director Técnico |
| Ingeniero de Infraestructura | Infraestructura | Hardening de VPS, HSM, supply chain security | DevOps |
| Frontend Lead | Wallet y Frontend | Extensión, wallet web, CSP, anti-phishing | Director Técnico |
| Ingeniero de Seguridad Web | Wallet y Frontend | XSS prevention, RPC verification, transaction security | Frontend Lead |

### Auditorías Externas

| Rol | Firma | Scope | Cuándo | Costo |
|---|---|---|---|---|
| Auditoría Criptográfica | Firma especializada (a seleccionar) | Dilithium3, SPHINCS+, LADKG, pq-noise | Pre-mainnet | $80K-$150K |
| Auditoría de Consenso | Firma especializada (a seleccionar) | BFT+DAG, slashing, VRF, sharding | Pre-mainnet | $80K-$150K |
| Bug Bounty | Plataforma pública (HackerOne/Immunefi) | Todas las superficies | Post-testnet | $500K+ en recompensas |
| Fuzzing continuo | Equipo interno + OSS-Fuzz | RSTN-VM, consenso, P2P | Continuo | Interno |

---

## 2. Protocolo de Respuesta a Incidentes

**Principio:** Cada incidente tiene un playbook. Detección → Contención → Erradicación → Recuperación → Post-mortem público.

### Niveles de Severidad

| Nivel | Descripción | Tiempo de Respuesta | Escalación | Ejemplo |
|---|---|---|---|---|
| SEV-0 | Amenaza existencial — fondos en riesgo o consenso comprometido | Inmediato (< 1 min) | Emergency fork en 72h | Quantum alarm disparado, bug crítico en consenso |
| SEV-1 | Pérdida significativa — >$1M en riesgo o red degradada | < 10 min | Hotfix en 24h | Bug en smart contract, DDoS sostenido |
| SEV-2 | Degradación — funcionalidad afectada sin pérdida de fondos | < 1 hora | Patch en próxima época | Shard caído, latencia elevada |
| SEV-3 | Menor — issue cosmético o de rendimiento | < 24 horas | Fix en próximo release | Bug en UI, métrica incorrecta |

### Playbook de Respuesta

1. **Detección** — Quantum alarm, Prometheus alerts, bug bounty reports, community reports (Automático)
2. **Contención** — Circuit breakers on-chain pausan contratos. Validadores maliciosos slashed. Partición de red si SEV-0 (Automático)
3. **Erradicación** — Identificar root cause. Desplegar fix. Si criptográfico, activar migration path. Si consenso, emergency fork (Manual)
4. **Recuperación** — Reanudar operación. Verificar integridad. Restaurar fondos vía gobernanza (Manual)
5. **Post-mortem** — Reporte público detallado en 72h. Sin censura (Manual)

### Compromiso de Transparencia
Todos los incidentes SEV-0 y SEV-1 se publican públicamente en 72 horas. El post-mortem es open-source.

---

## 3. Fork de Emergencia — Multisig de Seguridad

**ACTIVACIÓN DE EMERGENCIA:**
- Requiere: 2/3 de validadores + **3 de 5 multisig de seguridad**
- Tiempo de activación: **72 horas**
- Solo para: amenazas existenciales (quantum alarm, bug crítico en consenso, ataque en progreso)

**Los 5 firmantes del multisig son confidenciales.** Sus identidades se revelan solo post-descentralización.

---

## 4. Análisis Legal Howey (Confidencial)

### Test Howey — 4 criterios de la SEC (1946)

| Criterio | Estado | Mitigación |
|---|---|---|
| **#1 Inversión de dinero** | FALLO | RSTN nunca se vende. Se distribuye por staking desde génesis. Sin ICO, sin pre-venta. Fair launch: cero venta de tokens. El equipo adquiere RSTN como cualquier participante. |
| **#2 Empresa común (common enterprise)** | FALLO | Team allocation 10% con vesting on-chain de 4 años. Wallets públicas. Cero venta pre-vesting. El equipo no tiene posición privilegiada ni liquidez ventajosa. Vesting hardcodeado en contrato de génesis. 12 meses cliff. Liberación lineal bloque a bloque. |
| **#3 Expectativa de ganancias** | FALLO | Whitepaper 100% técnico. Cero menciones de ROI, precio o ganancias. Whitepaper académico, no prospecto. Recompensas de staking son variables según rendimiento de red, no rendimiento garantizado. |
| **#4 Ganancias del esfuerzo de otros** | FALLO | Protocolo autónomo desde génesis. 1,000+ validadores distribuidos. Descentralización desde día 1. Sin validadores fundacionales con poder especial. Gobernanza on-chain. El equipo reduce rol post-génesis (walk away). |

### Análisis por bucket de génesis

- **Proof of Participation (55%)**: No es venta. Es recompensa por trabajo. Falla criterio #1 Howey.
- **Comunidad (20%)**: Gobernanza on-chain decide. No hay 'issuer' que controle los fondos.
- **Tesorería (10%)**: Sin control centralizado = sin 'common enterprise' (criterio #2 falla).
- **Team (10%)**: Vesting hardcodeado en contrato de génesis. No se puede alterar. Skin in the game sin dump.
- **Airdrop (5%)**: Recompensa por participación, no inversión. Falla criterio #1 Howey.

### Estrategia clave
El staking NO debe prometer yield fijo. Las recompensas son variables según el rendimiento de la red.
El token debe tener utilidad real (gas, gobernanza, no especulación). Esto convierte a RSTN en un utility token, no un security.

### Condiciones no negociables
- Cero venta de tokens
- Cero marketing de inversión
- Cero promesas de ROI
- Si se viola cualquiera de estas, la estrategia colapsa y RSTN se convierte en security

---

## 5. Ventanas de Vulnerabilidad del Bootstrap — Tolerancia BFT Exacta

| Fase | Nodos | Tolerancia BFT | Riesgo |
|---|---|---|---|
| Desarrollo Local | 1 nodo | f=0 — sin tolerancia (solo desarrollo) | Si cae, la red cae. NO es blockchain — es un prototipo. |
| Testnet Privada | 4 nodos | f=1 — tolera 1 fallo (BFT mínimo) | Con 4 nodos, comprometer 1 nodo detiene la red (f=1). |
| Testnet Semi-Pública | 7-10 nodos | f=2 — tolera 2 fallos simultáneos | Estable pero no production-ready. |
| Testnet Pública | 20-100 nodos | f=6 — tolera 6 fallos | Abierta. Aquí empieza el snapshot de PoP. |
| Mainnet Génesis | 1,000+ nodos | f=333 — tolera 333 nodos maliciosos | Soberana desde el bloque 0. |
| Mainnet Objetivo | 4,128+ nodos | f=1,375 — tolera 1,375 nodos maliciosos | Descentralización completa. |

**⚠️ Durante las fases tempranas (f=1 con 4 nodos), un atacante que comprometa 1 nodo puede detener la red.**

---

## 6. Amenazas con Probabilidades Estimadas (Confidencial)

### Dominio 1: Criptografía Post-Cuántica
- Shor's algorithm: severidad Crítico, probabilidad Medio (10-30 años)
- Flaw estructural lattice: severidad Crítico, probabilidad Bajo
- Grover's algorithm: severidad Alto, probabilidad Medio
- Harvest now, decrypt later: severidad Alto, probabilidad Alto

### Dominio 2: Consenso BFT+DAG
- Ataque 33%: severidad Crítico, probabilidad Bajo
- Ataque 67%: severidad Crítico, probabilidad Muy bajo
- Long-range attack: severidad Alto, probabilidad Medio
- Sybil attack: severidad Alto, probabilidad Medio
- Shard captura: severidad Alto, probabilidad Bajo

### Dominio 3: Red P2P
- Eclipse attack: severidad Alto, probabilidad Medio
- Vigilancia de red: severidad Alto, probabilidad Alto
- DDoS a validadores: severidad Alto, probabilidad Medio
- MITM P2P: severidad Crítico, probabilidad Bajo
- Partición de red: severidad Alto, probabilidad Bajo

### Dominio 4: Smart Contracts
- Reentrancy: severidad Crítico, probabilidad Medio
- Integer overflow: severidad Alto, probabilidad Medio
- Bug en contrato crítico: severidad Crítico, probabilidad Medio
- Access list mal configurada: severidad Medio, probabilidad Medio
- Cross-shard spoofing: severidad Alto, probabilidad Bajo

### Dominio 5: Economía
- MEV: severidad Alto, probabilidad Alto
- Ballena >33%: severidad Crítico, probabilidad Medio
- Slashing injusto: severidad Medio, probabilidad Bajo
- Gobernanza capturada: severidad Alto, probabilidad Medio
- Spam/dust: severidad Medio, probabilidad Alto

### Dominio 6: Infraestructura
- Compromiso VPS: severidad Crítico, probabilidad Medio
- Supply chain attack: severidad Crítico, probabilidad Bajo
- Docker image comprometido: severidad Alto, probabilidad Bajo
- Bug en dependencia: severidad Alto, probabilidad Medio
- Configuración incorrecta: severidad Medio, probabilidad Medio

### Dominio 7: Wallet y Frontend
- XSS en dApp: severidad Crítico, probabilidad Medio
- Phishing: severidad Alto, probabilidad Alto
- Malware roba seed: severidad Crítico, probabilidad Medio
- Transaction replay: severidad Alto, probabilidad Bajo
- RPC malicioso: severidad Medio, probabilidad Medio

### Tiempos de respuesta por dominio
1. Criptografía PQ: Inmediato — quantum alarm auto-activa migración
2. Consenso: 1 época (~6 min) — slashing automático
3. Red P2P: Segundos — peer scoring automático
4. Smart Contracts: Bloque — circuit breaker automático
5. Economía: Época — slashing y gobernanza automática
6. Infraestructura: Minutos — rollback automático disponible
7. Wallet: Inmediato — popup de confirmación bloquea tx
