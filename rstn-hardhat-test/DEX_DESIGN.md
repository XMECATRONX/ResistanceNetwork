# RSTN DEX — Diseño del Pool de Descubrimiento de Precio

> **Versión:** 1.0
> **Estado:** Contrato escrito, sin desplegar (pre-mainnet)
> **Principio:** El precio de RSTN nace del primer swap, no de una venta. Modelo Satoshi.

---

## Por qué existe este documento

CoinGecko y CoinMarketCap no listan un token sin mercado. El mercado de RSTN
es un pool de liquidez **RSTN/USDC** en la propia L1 de RSTN. Este documento
define cómo se construye, cómo nace el precio y cómo lo leen los agregadores.

---

## Arquitectura

```
Native RSTN (gas token)
       │
       │  wrap 1:1
       ▼
    wRSTN  (ERC-20, WRSTN.sol)
       │
       │  deposit en pool
       ▼
┌──────────────────────────┐
│   RstnDexPool (wRSTN/USDC)  │  ← AMM constant-product x·y=k
│   - reserve_wRSTN          │
│   - reserve_USDC          │
│   - price = reserve_USDC  │
│             / reserve_wRSTN│
└──────────────────────────┘
       │
       │  VWAP de reservas
       ▼
CoinGecko / CoinMarketCap
```

### Componentes

| Contrato | Archivo | Rol |
|----------|---------|-----|
| `WRSTN` | `contracts/WRSTN.sol` | Wrapper ERC-20 del RSTN nativo. Deposit = wrap, withdraw = unwrap. 1:1. |
| `RstnDexFactory` | `contracts/RstnDexFactory.sol` | Fábrica sin permisos. Crea pools para cualquier par. Sin owner. |
| `RstnDexPool` | `contracts/RstnDexPool.sol` | AMM constant-product (x·y=k). Fee 0.30%. LP tokens. TWAP oracle. |

---

## Cómo nace el precio (modelo Satoshi)

1. **No hay precio de venta.** RSTN no tuvo ICO, pre-venta ni asignación de equipo.
2. **Primer LP deposita liquidez.** El primer proveedor deposita wRSTN + USDC.
   La proporción que deposita **fija el precio inicial**. Esto es el equivalente
   PoS a los primeros mineros de Bitcoin que vendieron BTC por primera vez.
3. **Primer swap = nacimiento del precio.** El primer intercambio en el pool
   establece el precio de mercado observable on-chain.
4. **El precio vive en las reservas.** `price = reserve_USDC / reserve_wRSTN`.
   Cada swap lo mueve según x·y=k.

### Por qué esto es honestamente Satoshi

Satoshi no fijó el precio de BTC. El precio nació cuando alguien intercambió
BTC por primera vez (10.000 BTC por 2 pizzas, 2010). RSTN replica esto: el
precio nace del primer swap, no de una decisión del equipo.

---

## Cómo lo lee CoinGecko / CoinMarketCap

Los agregadores **no leen `price_usd` de `/stats.json`** (ese campo es `null`).
Leen el pool on-chain:

```
precio = reserve_USDC / reserve_wRSTN   (spot)
precio TWAP = (price1CumulativeLast - price0CumulativeLast) / tiempo
```

- **Spot:** lectura directa de `reserve0` y `reserve1`.
- **TWAP:** el pool acumula `price0CumulativeLast` y `price1CumulativeLast`
  en cada bloque. El agregador toma dos snapshots y promedia. Esto evita
  manipulación por flash loans.

El endpoint `/stats.json` provee `supply` (circulante, total, max). El precio
viene del pool. CoinGecko/CoinMarketCap combinan ambos.

---

## Seguridad

| Riesgo | Mitigación |
|--------|------------|
| Inflation attack en primer LP | `MINIMUM_LIQUIDITY = 1000` LP bloqueados en `0xdead` (patrón Uniswap V2) |
| Manipulación de precio (flash loan) | TWAP oracle on-chain (`price0CumulativeLast`) |
| Invariante rota | Check `adjusted0 * adjusted1 >= reserve0 * reserve1` post-swap |
| Rug pull del owner | **No hay owner.** Factory y pool son inmutables. Sin `setFeeTo`, sin `setOwner`. |
| Fee cambiado | `FEE_BPS = 30` es `constant`. Inmutable. |

### Lo que NO tiene el pool (a propósito)

- **No admin key.** Nadie puede pausar, cambiar fee, o redirigir.
- **No fee recipient.** El 0.30% se queda en el pool (crece para los LPs).
- **No upgradeability.** Bytecode inmutable.
- **No governance switch.** A diferencia de Uniswap V2, no hay `feeToSetter`.

Esto es coherente con la narrativa Satoshi del protocolo: sin dueño, sin
reserva capturable, sin palanca central.

---

## Parámetros

| Parámetro | Valor | Razón |
|-----------|-------|-------|
| Fee | 0.30% (30 bps) | Estándar Uniswap V2. Suficiente para LPs, bajo para traders. |
| Decimales wRSTN | 9 | RSTN nativo usa 9 decimales. |
| Par canónico | wRSTN/USDC | USDC es el quote más líquido y estable. |
| MINIMUM_LIQUIDITY | 1000 LP | Anti-inflation-attack. |

---

## Flujo de despliegue (post-mainnet)

```bash
# 1. Desplegar contratos
cd rstn-hardhat-test
npx hardhat run scripts/deploy-dex.js --network rstn

# 2. Registrar direcciones en /stats.json
#    dex.pool_address = <dirección del pool>
#    dex.status = "live"

# 3. Añadir liquidez inicial (tx pública, observable)
#    - Aprobar wRSTN y USDC al pool
#    - Llamar pool.mint(to)
#    - La proporción fija el precio inicial

# 4. Primer swap = nacimiento del precio
#    - Cualquiera puede swappear
#    - El precio queda registrado on-chain

# 5. Solicitar listing en CoinGecko
#    - Proveer: contract address, pool address, /stats.json URL
#    - CoinGecko lee supply de /stats.json, precio del pool
```

---

## Estado actual

- [x] Contrato `RstnDexPool.sol` escrito
- [x] Contrato `WRSTN.sol` escrito
- [x] Contrato `RstnDexFactory.sol` escrito
- [x] Script de deploy `deploy-dex.js`
- [x] Compilar con Hardhat (`npx hardhat compile`)
- [x] **Auditado** (`DEX_AUDIT.md`) — bugs críticos C-DEX-1/C-DEX-2 corregidos
- [x] Test end-to-end de swap (`test/dex-swap.test.js`) — precio nace del primer swap
- [ ] Completar ERC-20 de LP tokens (H-DEX-2)
- [ ] Parametrizar USDC real en `deploy-dex.js` (M-DEX-1)
- [ ] Desplegar en mainnet
- [ ] Añadir liquidez inicial
- [ ] Primer swap (nacimiento del precio)
- [ ] Actualizar `/stats.json` con `pool_address` real
- [ ] Solicitar listing CoinGecko

---

## Conclusión

El pool DEX es el eslabón que crea el precio. Sin él, RSTN es un token sin
mercado. Con él, el precio nace del primer swap — sin venta, sin dueño, sin
precio fijado por el equipo. Es la pieza que cierra la narrativa Satoshi.
