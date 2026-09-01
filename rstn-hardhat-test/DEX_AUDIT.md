# AUDITORÍA — DEX (Pool de Descubrimiento de Precio)

> **Fecha:** 2026-09-01
> **Alcance:** `RstnDexPool.sol`, `RstnDexFactory.sol`, `WRSTN.sol`, `deploy-dex.js`
> **Veredicto general:** **NO APTO PARA MAINNET.** Existe un bug crítico que hace que el DEX sea **completamente no funcional**: toda llamada a `swap()` revierte. El precio de RSTN no puede nacer. Esto rompe la pieza central de la narrativa Satoshi.

---

## 🔴 CRÍTICO

### C-DEX-1 — `swap()` revierte SIEMPRE (DEX no funcional)

**Archivo:** `RstnDexPool.sol`, función `swap()` (líneas 197–202).

**El bug:** El cálculo de `amount0In` / `amount1In` usa `balance0`/`balance1` (que **ya incluyen el input** que el caller transfirió antes de llamar `swap`) en lugar de `_reserve0`/`_reserve1`. Esto es una desviación del patrón Uniswap V2.

```solidity
// RSTN (ROTO):
uint256 amount0In = balance0After > balance0 - amount0Out
    ? balance0After - (balance0 - amount0Out)
    : 0;
```

Traza de un swap token0→token1 (input ya transferido, `amount0Out=0`, `amount1Out>0`):

```
balance0        = reserve0 + amount0In   (input ya dentro)
balance0After   = reserve0 + amount0In   (no se envió token0)
balance0 - amount0Out = reserve0 + amount0In   (== balance0After)
→ balance0After > (balance0 - amount0Out)  →  FALSE
→ amount0In = 0
```

Igual para `amount1In` → `0`. Entonces:

```solidity
require(amount0In > 0 || amount1In > 0, "RSTNDEX: insufficient input");  // REVIERTE SIEMPRE
```

**Impacto:** Ningún swap puede ejecutarse. El pool nunca mueve precio. El "primer swap = nacimiento del precio" **es imposible**. CoinGecko/CoinMarketCap no tendrán nada que leer. Toda la narrativa Satoshi del DEX queda vacía.

**Fix (patrón Uniswap V2 correcto):**

```solidity
require(amount0Out < _reserve0 && amount1Out < _reserve1, "RSTNDEX: insufficient liquidity");

uint256 amount0In = balance0After > _reserve0 - amount0Out
    ? balance0After - (_reserve0 - amount0Out)
    : 0;
uint256 amount1In = balance1After > _reserve1 - amount1Out
    ? balance1After - (_reserve1 - amount1Out)
    : 0;
```

---

### C-DEX-2 — Cálculo de fee / invariante incorrecto

**Archivo:** `RstnDexPool.sol`, líneas 207–209.

```solidity
uint256 adjusted0 = balance0After - ((balance0After - _reserve0 - amount0In) * FEE_BPS / BPS_DENOM);
uint256 adjusted1 = balance1After - ((balance1After - _reserve1 - amount1In) * FEE_BPS / BPS_DENOM);
require(adjusted0 * adjusted1 >= _reserve0 * _reserve1, "RSTNDEX: invariant violated");
```

Dos problemas:

1. **Underflow en el token de salida.** Para el token que sale (output), `balanceAfter - _reserve - amountIn` es **negativo** (se envió más de lo que entró). Al ser `uint256`, **underflow → revert**. Otro motivo por el que `swap` siempre revierte.
2. **Fórmula no equivalente a Uniswap V2.** Uniswap usa `balance * 1000 - amountIn * 3` y compara contra `reserve0 * reserve1 * 1000**2`. La fórmula de RSTN no replica la invariante `x·y≥k` con fee aplicado al input. Aun si se arreglara el underflow, el check no garantizaría que el fee se cobre correctamente.

**Fix (Uniswap V2 canónico, escalado a BPS):**

```solidity
uint256 balance0Adjusted = balance0After * BPS_DENOM - amount0In * FEE_BPS;
uint256 balance1Adjusted = balance1After * BPS_DENOM - amount1In * FEE_BPS;
require(
    balance0Adjusted * balance1Adjusted >= _reserve0 * _reserve1 * BPS_DENOM * BPS_DENOM,
    "RSTNDEX: K"
);
```

> ⚠️ Riesgo de overflow con `BPS_DENOM=10000` y reservas grandes. La forma segura es mantener el truco de Uniswap con `1000`/`3` (fee 30 bps = 3/1000) y comparar contra `reserve0 * reserve1 * 1000**2`. Recomendado.

---

## 🟠 ALTO

### H-DEX-1 — `mint()` rechaza depósitos asimétricos con exigencia de igualdad exacta

**Línea 141:** `require(lp0 == lp1, "RSTNDEX: asymmetric deposit");`

Uniswap V2 toma `min(lp0, lp1)` y **no** exige igualdad. Cualquier diferencia de polvo (rounding, decimales distintos entre wRSTN de 9 decimales y USDC de 6) hace revertir. En la práctica, añadir liquidez fallará con frecuencia porque wRSTN (9 decimales) y USDC (6 decimales) casi nunca producen `lp0 == lp1` exactos.

**Fix:** `lpMinted = lp0 < lp1 ? lp0 : lp1;` sin el `require` de igualdad (ya toma el mínimo).

### H-DEX-2 — LP tokens no son ERC-20 compliant

El pool emite "LP tokens" pero faltan `name`, `symbol`, `decimals`, `approve`, `allowance`, `transferFrom`. Muchos frontends, wallets y agregadores asumen ERC-20 completo y fallan al mostrar/transferir LP. Para un DEX que aspira a listing público, esto es un problema de UX e integración.

**Fix:** Implementar ERC-20 mínimo completo (o heredar de OZ ERC20).

### H-DEX-3 — `swap()` envía tokens antes del check de invariante (CEI violado) sin guard anti-reentrancia

`_safeTransfer(token, to, ...)` se ejecuta **antes** de validar la invariante y antes de `_update`. Si `to` es un contrato malicioso que reentra `swap`/`mint`, el estado (`reserve`) aún no se actualizó. Uniswap V2 tolera esto porque su invariante es robusta, pero aquí la invariante está rota (C-DEX-2), así que el vector de reentranía queda abierto. Tras arreglar C-DEX-2, evaluar agregar `nonReentrant` o asegurar el patrón CEI estricto.

---

## 🟡 MEDIO

### M-DEX-1 — `deploy-dex.js` crea el pool canónico con USDC placeholder inválido

`USDC_PLACEHOLDER = "0x" + "1".repeat(40)` — una dirección inexistente. El pool "canónico" que CoinGecko debe leer apunta a un token que no existe. En mainnet esto debe ser el USDC real (bridged o nativo de la L1). Si se despliega con placeholder, el pool canónico queda inutilizable y, aunque se cree otro con USDC real, el `DEX_DESIGN.md` y `stats.json` apuntarían al equivocado.

**Fix:** Parametrizar la dirección de USDC por entorno; fallar si no está definida en mainnet.

### M-DEX-2 — TWAP oracle: shift de 112 bits puede overflow silencioso

Líneas 106–107 (bloque `unchecked`):

```solidity
price0CumulativeLast += (reserve1 << 112) / reserve0 * timeElapsed;
```

Si `reserve1 > 2^144` (~2.2e43 unidades), `reserve1 << 112` desborda `uint256` silenciosamente y corrompe el oráculo TWAP. Con 9 decimales y liquidez muy alta es improbable pero no imposible. Uniswap V2 usa el mismo patrón UQ112x112 a propósito, pero conviene documentar el límite y/o usar `UQ112x112` explícito.

### M-DEX-3 — `onlyFactory` modifier definido pero nunca usado

Líneas 56–59. Código muerto. Eliminar o aplicar donde corresponda (no hay funciones que lo requieran hoy).

### M-DEX-4 — `mint()` primer depósito: `balance0 * balance1` puede overflow

Línea 136: `_sqrt(balance0 * balance1)`. Con reservas enormes el producto desborda. Usar `_sqrt(balance0) * _sqrt(balance1)` aproximación o `mulDiv`.

---

## 🟢 BAJO

- **B-DEX-1:** `WRSTN.withdraw` sigue CEI (descuenta antes de enviar) — correcto. Pero emite `Transfer` después del `call` externo; reentrancia no explotable porque el estado ya está actualizado. OK.
- **B-DEX-2:** `RstnDexFactory` sin owner, sin fee switch — coherente con narrativa. OK.
- **B-DEX-3:** `getAmountOut` usa la fórmula canónica de Uniswap — correcta.
- **B-DEX-4:** `price0Per1()` helper de spot — correcto y útil para agregadores.

---

## Resumen ejecutivo

| ID | Severidad | Componente | Estado |
|----|-----------|------------|--------|
| C-DEX-1 | 🔴 CRÍTICO | `swap()` siempre revierte | Roto |
| C-DEX-2 | 🔴 CRÍTICO | Fee/invariante incorrecto + underflow | Roto |
| H-DEX-1 | 🟠 Alto | `mint()` igualdad exacta | Frágil |
| H-DEX-2 | 🟠 Alto | LP tokens no ERC-20 | Incompleto |
| H-DEX-3 | 🟠 Alto | CEI violado en swap | Riesgo |
| M-DEX-1 | 🟡 Medio | USDC placeholder en deploy | Pendiente |
| M-DEX-2 | 🟡 Medio | Overflow TWAP silencioso | Pendiente |
| M-DEX-3 | 🟡 Medio | `onlyFactory` muerto | Limpieza |
| M-DEX-4 | 🟡 Medio | Overflow en `mint` | Pendiente |

## Veredicto del equipo de blockchain

**El DEX no funciona.** Los dos bugs críticos (C-DEX-1 y C-DEX-2) hacen que `swap()` revierta en el 100% de los casos. Esto significa:

1. **El precio de RSTN no puede nacer** — contradice `DEX_DESIGN.md` y toda la narrativa "primer swap = nacimiento del precio".
2. **CoinGecko/CoinMarketCap no tendrán precio que leer** — el pool TWAP nunca acumulará nada.
3. **El modelo Satoshi del DEX es, hoy, una afirmación sin respaldo técnico.**

Los contratos **no deben desplegarse en mainnet** hasta corregir C-DEX-1, C-DEX-2, H-DEX-1 y H-DEX-2, y re-auditar.

**Recomendación:** Aplicar los fixes de C-DEX-1 y C-DEX-2 (patrón Uniswap V2 canónico), suavizar H-DEX-1, completar ERC-20 de LP (H-DEX-2), y añadir un test Hardhat que ejecute un swap end-to-end antes de cualquier despliegue.
