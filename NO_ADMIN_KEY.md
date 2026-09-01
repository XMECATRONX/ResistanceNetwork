# NO_ADMIN_KEY.md — Nadie tiene poder unilateral

> **Propósito:** Documentar, con evidencia del código, que ninguna persona
> (incluido el fundador) tiene una clave de administrador, un botón de pausa
> unilateral, o la capacidad de cambiar las reglas del protocolo después de
> que el bloque génesis se valida.
>
> Este es el principio de Satoshi: el creador lanza el sistema y luego **no
> tiene poder para cambiarlo**. La confianza no depende de quién lo escribió
> — depende de que nadie, ni el creador, pueda alterarlo unilateralmente.

---

## 1. No hay clave de administrador

**Verifica tú mismo:**
```bash
grep -ri "admin\|owner\|superuser\|root_key\|master_key\|pause_key" crates/
```

**Resultado:** No hay ningún campo `admin`, `owner`, o `superuser` en el
protocolo. No existe una clave que pueda pausar la red, mover fondos, o
cambiar parámetros del consenso.

La única excepción es el **circuit breaker global** (`crates/rstn-core/src/circuit_breaker.rs`),
que tiene una función `pause_global()`. Pero esa función es llamada por
**gobernanza on-chain** (votación cuadrática con snapshot), no por una
clave privada de administrador. Cualquiera puede proponer, pero se necesita
la supermajoría de la gobernanza para ejecutar.

---

## 2. El bloque génesis es inmutable

**Código:** `crates/rstn-core/src/genesis.rs`

El bloque génesis se construye desde `GenesisConfig`. Una vez validado:

- Las allocaciones de tokens están en transacciones de sistema del bloque génesis
- El vesting del team está hardcoded (4 años, 12 meses cliff)
- Los validadores iniciales están registrados
- El hash del bloque génesis es determinístico (pubkey fija = all zeros)

**Después del lanzamiento, nadie puede:**
- Cambiar las allocaciones de tokens
- Acelerar el vesting del team
- Añadir o quitar validadores sin consenso
- Re-mintear tokens (no existe función de minting)

**Verifica:**
```bash
grep -ri "mint\|increase_supply\|mint_token" crates/rstn-core/src/
```
No hay función de minting. Las 1B RSTN existen desde el bloque 0. Punto.

---

## 3. Las reglas del consenso no se pueden cambiar unilateralmente

**Código:** `crates/rstn-core/src/consensus.rs`

Los parámetros del consenso (threshold 2/3+, rotación de líder, slashing)
están en el código compilado. Cambiarlos requiere:

1. Un **hard fork** — todos los nodos deben actualizar su binario
2. El binario nuevo debe ser adoptado por la supermajoría de validadores
3. Si la minoría no actualiza, se queda en la chain vieja

**No hay upgrade proxy.** No hay un contrato que el fundador pueda llamar
para cambiar la lógica del consenso. El consenso es el binario que cada
validador corre. Cambiarlo requiere que la mayoría de la red acuerde
actualizar — exactamente como Bitcoin.

---

## 4. El fundador no tiene poder especial después del lanzamiento

Después de que el bloque génesis se valida:

| Poder | ¿El fundador lo tiene? | Por qué no |
|---|---|---|
| Pausar la red | ❌ No | Requiere gobernanza on-chain (supermajoría) |
| Mover fondos de tesorería | ❌ No | La tesorería se gobierna on-chain |
| Acelerar su vesting | ❌ No | Hardcoded en el bloque génesis |
| Añadir validadores | ❌ No | Requiere registro on-chain + stake |
| Cambiar parámetros de consenso | ❌ No | Requiere hard fork + adopción de mayoría |
| Re-mintear tokens | ❌ No | No existe función de minting |
| Cambiar las reglas del VM | ❌ No | Requiere hard fork + adopción de mayoría |

El fundador es, después del lanzamiento, **un participante más**. Su stake
le da poder de voto como a cualquier otro. Nada más.

---

## 5. Comparación con Satoshi

Satoshi lanzó Bitcoin y luego **desapareció**. No porque no quisiera gobernar,
sino porque **no podía**. Bitcoin no tiene una clave de administrador. Satoshi
minaba con su computadora como cualquier otro minero. Si hubiera querido
cambiar las reglas, habría tenido que convencer a la mayoría de la red de
actualizar — el mismo poder que cualquier otro minero.

Resistance sigue el mismo principio:

1. **Lanzamiento:** el fundador publica el binario y el bloque génesis
2. **Descentralización:** validadores independientes se unen desde el génesis
3. **Walk away:** el fundador reduce su rol a un participante más
4. **Sin poder residual:** no hay clave de administrador, no hay upgrade proxy

La diferencia con Bitcoin: Bitcoin usa PoW (energía), Resistance usa BFT (stake).
Pero el principio de "el creador no tiene poder después de lanzar" es idéntico.

---

## 6. Lo que SÍ puede hacer la gobernanza (con supermajoría)

La gobernanza on-chain (votación cuadrática, snapshot anti-flash-loan, veto
de minoría) puede:

- Activar SPHINCS+ como co-firmante (cuando se implemente)
- Migrar la tesorería (con delay de 1 época)
- Pausar contratos específicos vía circuit breakers
- Aprobar grants de la comunidad

**Pero la gobernanza no puede:**
- Mover fondos sin supermajoría
- Saltarse el timelock de 1 época
- Ignorar el veto de minoría (10% retrasa 30 días)
- Cambiar el hard cap de tokens
- Acelerar el vesting del team

---

## 7. Verificación independiente

Para verificar que no hay puerta trasera:

```bash
# 1. No hay admin/owner
grep -ri "admin\|owner\|superuser" crates/rstn-core/src/ crates/rstn-node/src/

# 2. No hay minting
grep -ri "fn mint\|increase_supply\|mint_token" crates/rstn-core/src/

# 3. No hay upgrade proxy
grep -ri "upgrade\|proxy\|delegate_call" crates/rstn-core/src/

# 4. El génesis es determinístico
cargo test -p rstn-core --release  # incluye test de génesis

# 5. El vesting está hardcoded
cat crates/rstn-core/src/genesis.rs | grep -A5 "vesting"
```

Si alguno de estos muestra algo inesperado, es un bug de seguridad. Repórtalo.

---

## Compromiso

Este documento es una promesa verificable: **nadie, incluido el fundador,
tiene poder unilateral sobre el protocolo después del lanzamiento.** Si el
código alguna vez contradice esto, es una vulnerabilidad crítica que debe
ser corregida antes de cualquier mainnet.
