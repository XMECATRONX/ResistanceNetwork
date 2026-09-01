# RSTN Wallet Chrome — Guía de Testing E2E

> Esta guía es para el dev/QA que va a probar la wallet Chrome de RSTN
> en un navegador real. No se puede probar en este entorno.

---

## Prerrequisitos

1. **Nodo RSTN corriendo** en `localhost:9944`
   ```bash
   cd rstn-node && cargo run --release -- --rpc-port 9944 --validator
   ```
2. **Chrome** versión 114+ (soporta Manifest V3)
3. **Extensiones de desarrollador** habilitadas

---

## Paso 1: Cargar la extensión

```text
1. Abrir Chrome → chrome://extensions
2. Activar "Modo desarrollador" (toggle arriba a la derecha)
3. Click "Cargar descomprimida"
4. Seleccionar la carpeta rstn-wallet/
5. La extensión aparece con el icono de RSTN
6. Fijar el icono en la barra de herramientas (click → pin)
```

### Verificar que cargó

```text
✓ El icono de RSTN aparece en la barra
✓ Click en el icono abre el popup (360x600px)
✓ La consola de la extensión no muestra errores
```

Para abrir la consola de la extensión:
- Click derecho en el icono → "Inspeccionar popup"
- O: `chrome://extensions` → Details → "Inspect views: popup"

---

## Paso 2: Onboarding — Crear wallet nueva

```text
1. Click en el icono de RSTN
2. Debería mostrar "Welcome to RSTN" (onboarding view)
3. Click "Create New Wallet"
4. Debería mostrar:
   - 24 palabras de recuperación (mnemonic)
   - Botón "Copy" y "I've saved it"
5. Click "I've saved it"
6. Debería mostrar el dashboard con:
   - Dirección rstn1...
   - Balance: 0 RSTN
   - Tab "Activity" vacío
```

### Verificar

```javascript
// En la consola del popup:
console.log(await chrome.storage.local.get("accounts"));
// Debe mostrar: { accounts: [{ address: "rstn1...", name: "Account 1" }] }

console.log(await chrome.storage.local.get("vault"));
// Debe mostrar: { vault: { encrypted: "...", salt: "..." } }
```

---

## Paso 3: Importar wallet existente

```text
1. Click "Import Wallet"
2. Pegar 24 palabras de mnemonic
3. Click "Import"
4. Debería mostrar el dashboard con la misma dirección
```

---

## Paso 4: Recibir tokens (faucet integrado)

```text
1. En el dashboard, click "Claim 1,000 RSTN from Faucet" (botón bajo el balance)
2. Debería mostrar toast "Faucet: +1000 RSTN credited"
3. El balance debería actualizar a 1,000.00 RSTN
4. Click "Receive" para copiar la dirección rstn1... si quieres enviar desde otra wallet
```

### Verificar

```bash
# Verificar el balance on-chain vía RPC (desde terminal):
curl -s -X POST http://localhost:9944 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"rstn_getBalance","params":["<tu-dirección-rstn1>"]}' | python3 -m json.tool
# Debe mostrar "balance": "1000.00"
```

> Nota: El faucet tiene cooldown de 24h por dirección y crédita 1,000 RSTN (en wei: 1000 * 10^18).

---

## Paso 5: Enviar transacción

```text
1. En el dashboard, click "Send"
2. Ingresar dirección destino (ej: otra wallet o la misma)
3. Ingresar cantidad (ej: 100 RSTN)
4. Click "Continue"
5. Debería mostrar "Confirm Transaction" con:
   - From: tu dirección
   - To: dirección destino
   - Amount: 100 RSTN
   - Fee: estimada
6. Click "Confirm"
7. Debería:
   - Firmar con Dilithium3 (puede tardar 1-2s)
   - Enviar al nodo via RPC
   - Mostrar "Transaction sent" con el hash
   - Aparecer en "Activity" como "Pending"
   - Actualizar a "Confirmed" cuando el bloque se finalice
```

### Verificar firma Dilithium3

```javascript
// En la consola del background script:
// chrome://extensions → Details → "Inspect views: service worker"

// La transacción firmada debe contener:
// - from: publicKey (1952 bytes)
// - signature: Dilithium3 signature (3293 bytes)
// - La firma debe verificar correctamente en el nodo
```

---

## Paso 6: Inyección en dApp (inpage.js)

```text
1. Abrir cualquier página web (ej: localhost:5173)
2. Abrir la consola del navegador
3. Verificar que window.rstn existe:
   typeof window.rstn
   // Debe retornar "object"

4. Verificar métodos disponibles:
   window.rstn.connect()
   // Debe abrir el popup pidiendo conexión

5. Aceptar la conexión en el popup
6. La dApp debería recibir:
   window.rstn.address  // "rstn1..."
   window.rstn.publicKey  // Uint8Array(1952)
```

### Eventos esperados

```javascript
// La dApp puede escuchar:
window.addEventListener("resistance:connect", (e) => {
  console.log("Connected:", e.detail.address);
});

window.addEventListener("resistance:disconnect", () => {
  console.log("Disconnected");
});

window.addEventListener("resistance:accountChanged", (e) => {
  console.log("Account changed:", e.detail.address);
});
```

---

## Paso 7: Multi-cuenta

```text
1. Click en el nombre de la cuenta (dropdown)
2. Click "Create Account"
3. Ingresar nombre (ej: "Savings")
4. Debería crear nueva cuenta con dirección distinta
5. Cambiar entre cuentas → balance y historial cambian
6. Importar cuenta con otra mnemonic → debería añadirse
```

---

## Paso 8: Lock/unlock

```text
1. Click "Lock"
2. Debería mostrar la vista locked con campo de password
3. Ingresar password incorrecto → error
4. Ingresar password correcto → desbloquea
5. Cerrar y abrir popup → debería seguir locked hasta que ingrese password
```

---

## Checklist Final

| Test | Estado |
|------|--------|
| Extensión carga sin errores | ☐ |
| Onboarding crea wallet con 24 palabras | ☐ |
| Import recupera wallet correctamente | ☐ |
| Receive muestra dirección correcta | ☐ |
| Faucet envía tokens y balance actualiza | ☐ |
| Send firma con Dilithium3 y envía al nodo | ☐ |
| Transaction aparece en Activity | ☐ |
| window.rstn se inyecta en páginas web | ☐ |
| connect() abre popup y autoriza | ☐ |
| Multi-cuenta funciona | ☐ |
| Lock/unlock funciona | ☐ |
| Datos persisten tras cerrar popup | ☐ |
| No hay errores en consola del background | ☐ |
| No hay errores en consola del popup | ☐ |

---

## Errores Comunes

### "Cannot connect to RPC"

```text
Causa: El nodo no está corriendo o el puerto es incorrecto.
Fix:
  1. Verificar: curl -X POST localhost:9944 -d '{"jsonrpc":"2.0","id":0,"method":"rstn_health","params":[]}'
  2. Actualizar RPC_ENDPOINT en background.js si el puerto cambia
```

### "Signature verification failed"

```text
Causa: La firma Dilithium3 no coincide con la public key.
Fix:
  1. Verificar que crypto.js usa @noble/post-quantum correctamente
  2. Verificar que el nonce es correcto (consultar al nodo)
  3. Verificar que el canonical encoding coincide entre wallet y nodo
```

### "window.rstn is undefined"

```text
Causa: content-script.js no se inyecta.
Fix:
  1. Verificar manifest.json tiene "content_scripts" configurado
  2. Verificar que la URL coincide con el pattern (ej: "<all_urls>")
  3. Recargar la página después de instalar la extensión
```
