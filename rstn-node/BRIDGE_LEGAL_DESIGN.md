# RSTN Bridge -- Decisi?n Arquitect?nica

> **Versión:** 1.0
> **Decisi?n:** Bridge descentralizado puro (protocol-pure), sin operador central
> **Estado:** Aprobado -- implementado en `rstn-bridge` crate

---

## Resumen

El bridge de RSTN es un **protocolo descentralizado puro**, no un servicio
operado por una entidad. Esta decisi?n reduce dr?sticamente el riesgo legal de
money transmitter licensing y AML/KYC compliance.

---

## Por qu? esta decisi?n

### El problema

Un bridge cross-chain transfiere valor real (BTC, ETH) entre blockchains. Bajo
ley federal de EE.UU. (BSA/FinCEN), esto califica como **money transmission**:

- Requiere licencia de money transmitter en 49 de 50 estados
- Requiere programa AML con KYC
- Requiere SAR/CTR reporting
- Costo: $5M-$15M + 12-24 meses

### La soluci?n: Protocolo puro

Si el bridge es **c?digo ejecutado por validadores** (no un servicio operado por
una entidad), el riesgo legal cambia fundamentalmente:

| Aspecto | Bridge Operado | Bridge Protocolo Puro |
|---------|---------------|----------------------|
| Quien custodia | La entidad operadora | El conjunto de validadores (2/3+ BFT) |
| Quien transmite | La entidad | El protocolo (c?digo neutral) |
| Money transmitter? | S? | Probablemente NO (ver Thorchain) |
| KYC requerido? | S? | No a nivel protocolo |
| Licencia estatal? | S? | Probablemente NO |
| Riesgo legal | ALTO | MEDIO-BAJO |

### Precedente: Thorchain

Thorchain (RUNE) opera un bridge descentralizado BTC<->ETH<->BNB sin KYC. Su modelo
legal se basa en:

1. El protocolo es c?digo neutral, no una entidad
2. Los validadores ejecutan c?digo, no custodian fondos
3. No hay empresa que "opera" el bridge
4. La SEC no ha tomado acci?n contra Thorchain (hasta 2026)

Resistance sigue este modelo, mejor?ndolo con:
- **Firmas post-cu?nticas** (Dilithium3 en lugar de ECDSA threshold)
- **Proof of Reserves on-chain** (invariante `locked == minted - burned`)
- **Slashing autom?tico** para validadores fraudulentos
- **Emergency pause** si se viola el invariante

---

## C?mo funciona el protocolo

### Lock-and-Mint (Source -> Resistance)

```text
1. Usuario bloquea BTC en vault address (P2WSH multisig 2/3+)
2. Usuario env?a lock proof a Resistance via bridge tx
3. Validadores verifican el lock proof (SPV o committee attestation)
4. 2/3+ validadores firman autorizaci?n de mint
5. VM de Resistance mintea wBTC al usuario
6. Proof of Reserves: locked += amount, minted += amount
7. Invariante verificada: locked == minted - burned
```

### Burn-and-Release (Resistance -> Source)

```text
1. Usuario quema wBTC en Resistance via bridge tx
2. Validadores verifican el burn (on-chain, determinista)
3. 2/3+ validadores firman autorizaci?n de release
4. Vault en source chain libera BTC al usuario
5. Proof of Reserves: locked -= amount, burned += amount
6. Invariante verificada: locked == minted - burned
```

### Seguridad

- **No single point of failure**: 2/3+ BFT threshold para toda operaci?n
- **Replay prevention**: cada source txid solo puede reclamarse una vez
- **Proof of Reserves**: invariante on-chain verificable por cualquiera
- **Slashing**: validadores que firman fraudulenamente son slashed
- **Emergency pause**: si la invariante se viola, el bridge se pausa

---

## Compliance: qu? queda fuera del protocolo

El protocolo es **neutral**. No implementa KYC porque:

1. **El protocolo no es una entidad** -- es c?digo. No puede tener un programa AML.
2. **Los validadores no son VASPs** -- ejecutan c?digo, no custodian fondos de usuarios.
3. **La wallet no es VASP** -- es non-custodial, el usuario tiene sus claves.

### Responsabilidad de compliance

| Componente | Responsable | Compliance |
|-----------|------------|------------|
| Protocolo (bridge code) | Nadie -- es c?digo neutral | N/A |
| Validadores | Cada operador individual | Depende de jurisdicci?n |
| Wallet Chrome | Non-custodial -- no VASP | No requiere KYC |
| Frontend/dApp | El operador del frontend | Puede implementar geo-block |
| Exchange integrado | El exchange | KYC/AML completo |

### Recomendaci?n para mainnet

1. **No implementar KYC en el protocolo** -- mantiene el dise?o neutral
2. **Geo-block opcional en el frontend** -- el operador del frontend puede bloquear jurisdicciones
3. **Proof of Reserves p?blico** -- transparencia total para reguladores
4. **Opini?n legal formal** antes de mainnet con bridge activo

---

## Implementaci?n

El crate `rstn-bridge` implementa:

- `BridgeState` -- estado global del bridge (reservas, operaciones pendientes)
- `BridgeOperation` -- operaci?n lock-mint o burn-release
- `ProofOfReserves` -- reservas por chain con invariante verificable
- `BridgeSignature` -- firma Dilithium3 de validador autorizando operaci?n
- Tests unitarios: replay prevention, threshold, invariant, duplicate sigs

### Integraci?n con el nodo

El bridge se integra como un **built-in contract** en la VM de Resistance:

```rust
// En rstn-vm, el bridge es un contract predeployed en address 0xbridge
// Las bridge txs usan tx_type = Contract con payload codificado
// El VM llama a BridgeState::execute_operation() cuando procesa la tx
```

---

## Riesgo residual

Esta decisi?n **reduce** el riesgo pero no lo elimina:

1. **FinCEN puede reclamar jurisdicci?n** -- argumentando "control de facto"
2. **Estados individuales pueden interpretar diferente** -- especialmente NY (BitLicense)
3. **MiCA en EU puede requerir compliance** -- para VASPs que interact?an con el bridge
4. **Opini?n legal formal es necesaria** antes de mainnet

### Mitigaciones

- Documentar que el bridge es protocolo puro (este documento)
- Proof of Reserves p?blico y auditable
- No operar el frontend desde EE.UU. inicialmente
- Obtener No-Action Letter de FinCEN antes de activar bridge en mainnet

---

## Conclusi?n

**Decisi?n: Bridge descentralizado puro, sin KYC a nivel protocolo.**

- Implementado en `rstn-bridge` crate
- Reduce riesgo de money transmitter
- Mantiene el protocolo neutral
- Compliance es responsabilidad del frontend, no del protocolo
- Opini?n legal formal requerida antes de mainnet
