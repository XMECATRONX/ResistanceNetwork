# RSTN — Equipo de Blockchain: Roles Integrados y Faltantes

> Fecha: 2026-09-01
> Estado: **CONFIDENCIAL — USO INTERNO**

---

## 1. Roles "integrados" (cubiertos por el desarrollo actual)

El desarrollo hasta la fecha ha cubierto los siguientes roles mediante el
trabajo del asistente de IA. Estos roles están **codificados** pero **no
tienen un humano detrás**.

| # | Rol | Lo que está hecho | Lo que falta |
|---|-----|------------------|--------------|
| 1 | **Arquitecto de protocolo** | Diseño de 7 capas, consenso BFT+DAG, sharding de 64 fragmentos, tokenómica Satoshi (0% team, 95% fair launch, 5% semilla), IBC, DAS, forced-inclusion, threshold mempool, zk-STARK foundation | — |
| 2 | **Criptógrafo PQ (parcial)** | Stack Dilithium3 (FIPS 204 ML-DSA-65) + Kyber768 + SPHINCS+ + NoiseHandshake híbrido + forward security + quantum alarm + account abstraction. Tamaños wire FIPS canónicos (pk=1952, sk=4032, sig=3309) | **Auditoría criptográfica formal externa** — ninguna firma humana ha revisado el stack |
| 3 | **Ingeniero Rust (nodo)** | rstn-node con 15 crates: core, crypto, p2p, bridge, VM, storage, rpc, node, ledger, sol-transpiler, vm, consensus, sharding, ibc, onion, zk_stark | Fork de libp2p para gossipsub PQ |
| 4 | **Ingeniero Solidity (DEX/bridge)** | Contratos DEX (RstnDexPool, RstnDexFactory, WRSTN) + bridge lock-and-mint + ERC20Mock. 85/85 tests pasan | Auditoría externa de Solidity |
| 5 | **Ingeniero frontend (React/TS)** | Landing page, DevPortal, terminal, 25+ views, wallet adapter, i18n ES/EN, design tokens, animaciones framer-motion | — |
| 6 | **Ingeniero de seguridad (parcial)** | Auditoría interna completa (C1, C1-prod, C2, A1-A3, M1-M5), fuzz targets (protocol + VM + consensus), remediación, SPV real (double-SHA256 Bitcoin, Keccak-256 Ethereum) | **Auditor externo** (Trail of Bits, OpenZeppelin, Certik, Halborn), **penetration tester / red team** |
| 7 | **Diseñador UX/UI** | Sistema de design tokens, componentes shadcn, paleta coherente (un solo verde), animaciones, responsive | — |
| 8 | **Redactor técnico** | Whitepaper, whitepaper legal, SECURITY_AUDIT_FULL, READMEs, docs de deploy, whitepaper de tokenómica | — |

---

## 2. Roles humanos REALES que faltan (no reemplazables por IA)

Estos son los profesionales que **deben contratarse/integrarse** antes de
mainnet. La IA no puede firmar con reputación legal ni certificar criptografía.

### P0 — Crítico para mainnet

| # | Rol | Por qué es irremplazable | Referencia |
|---|-----|--------------------------|-----------|
| 1 | **Criptógrafo post-cuántico con PhD** | Auditar formalmente el stack PQ (Dilithium3, Kyber768, SPHINCS+, NoiseHandshake). Ningún inversor serio confía en criptografía no auditada por humanos. El stack usa `@noble/post-quantum` y `fips204` (librerías auditadas), pero la **composición** y los **parámetros** deben revisarse. | NIST PQC, Trail of Bits, Quarkslab |
| 2 | **Auditor de contratos inteligentes (firma registrada)** | Auditoría externa del DEX (Solidity) y del bridge (Rust + Solidity). Los 85 tests pasan, pero los tests no son una auditoría. Wormhole perdió $320M por un bug que los tests no cubrieron. | Trail of Bits, OpenZeppelin, Certik, Halborn, Spearbit |
| 3 | **Ingeniero DevOps/SRE blockchain** | Operar la testnet pública, monitorear nodos, infraestructura de seed nodes en 6 continentes. Los scripts de deploy existen pero **nadie está operando la red**. | — |
| 4 | **Abogado cripto / regulatory counsel** | Clasificación del token (security vs utility) por jurisdicción, compliance AML/KYC del bridge, términos legales reales (no plantillas). | — |

### P1 — Alto para adopción

| # | Rol | Por qué | |
|---|-----|---------|--|
| 5 | **Community manager + dev relations** | Onboarding de validadores, docs para node operators, Discord/Telegram, programas de bug bounty. | — |
| 6 | **Economista tokenómico** | Validación del modelo de emisión (1B RSTN, 95% fair launch), simulación de escasez (EIP-1559 + bridge burn), game theory del staking (32K mínimo, slashing 5%). | — |
| 7 | **Penetration tester / red team** | Ataque real al nodo (RPC, p2p, gossipsub), al bridge (SPV, committee), al wallet (XSS, phishing), a la web (CORS, CSP) antes de mainnet. | — |
| 8 | **Ingeniero de Ledger firmware (BOLOS)** | Escribir la app on-device (Rust + BOLOS SDK) que firma Dilithium3 en el secure element. El spec está en `LEDGER_BOLOS_FIRMWARE.md`. | Ledger's security team review |

### P2 — Medio para escala

| # | Rol | Por qué | |
|---|-----|---------|--|
| 9 | **Ingeniero de consenso / distributed systems** | Revisión del BFT+DAG, slashing, finalidad, view-changes. Especialistas en consenso son escasos. | — |
| 10 | **Ingeniero de libp2p (fork)** | Implementar `PqNoiseConfig` en el fork de libp2p para gossipsub PQ wire-level. Plan en `GOSSIPSUB_PQ_BROADCAST.md` (~4 semanas). | — |

---

## 3. Presupuesto estimado (pre-mainnet, 6 meses)

| Rol | FTE | Costo estimado (USD/año) | Total (6 meses) |
|-----|-----|--------------------------|-----------------|
| Criptógrafo PQ (PhD) | 0.5 | $180K | $90K |
| Auditor Solidity (externo, una auditoría) | contrato | $80K–$150K | $100K |
| Auditor Rust (externo, una auditoría) | contrato | $80K–$150K | $100K |
| DevOps/SRE | 1.0 | $140K | $70K |
| Abogado cripto | 0.3 | $200K | $30K |
| Community manager | 1.0 | $80K | $40K |
| Economista tokenómico | 0.3 | $150K | $22K |
| Pen tester (una auditoría) | contrato | $40K | $40K |
| Ledger firmware | 0.5 | $160K | $80K |
| **Total** | | | **~$572K** |

---

## 4. Veredicto honesto

Tienen el **producto técnico** (código + docs + tests + fuzz + design specs)
pero **cero equipo humano**. Para mainnet, el mínimo no negociable es:

1. **1 criptógrafo PQ** (auditoría formal del stack)
2. **1 auditor externo de Solidity** (DEX + bridge)
3. **1 auditor externo de Rust** (nodo + consenso)
4. **1 DevOps** (operar la testnet pública)
5. **1 abogado cripto** (clasificación del token)

Sin esos cinco, el proyecto **no es lanzable con credibilidad**, por más que
el código compile, los 85 tests pasen, y el build esté limpio. La diferencia
entre "código que funciona" y "protocolo en el que alguien deposita $1M" es
exactamente estos cinco roles.

---

## 5. Estado de mainnet — checklist

| Ítem | Estado | Bloqueado por |
|------|--------|---------------|
| Código del nodo (Rust) | ✅ Compila + tests | — |
| Contratos (Solidity) | ✅ 85/85 tests | — |
| Frontend (React/TS) | ✅ Build limpio | — |
| Wallet extension | ✅ Funcional | — |
| Bridge SPV (BTC double-SHA256 + ETH Keccak) | ✅ Implementado + testeado | — |
| Forced-inclusion pool | ✅ Cableado en propose_block + vote_prepare | — |
| Threshold mempool (MEV) | ✅ Habilitado en main.rs | — |
| DAS + erasure coding | ✅ Implementado | — |
| Forward security (anti long-range) | ✅ Implementado | — |
| Fuzz targets (protocol + VM + consensus) | ✅ Listos | Corridas 24h+ en CI |
| Ledger firmware spec | ✅ Diseñado | App on-device (BOLOS) |
| Gossipsub PQ plan | ✅ Diseñado | Fork de libp2p (~4 sem) |
| **Auditoría criptográfica externa** | ⬜ Pendiente | Criptógrafo PQ |
| **Auditoría Solidity externa** | ⬜ Pendiente | Auditor Solidity |
| **Auditoría Rust externa** | ⬜ Pendiente | Auditor Rust |
| **Testnet pública operada** | ⬜ Pendiente | DevOps/SRE |
| **Clasificación legal del token** | ⬜ Pendiente | Abogado cripto |
| **Firmware Ledger on-device** | ⬜ Pendiente | Ingeniero BOLOS |
| **Fork de libp2p (gossipsub PQ)** | ⬜ Pendiente | Ingeniero libp2p |
