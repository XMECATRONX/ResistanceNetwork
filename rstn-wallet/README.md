# RSTN Wallet — Extensión de Navegador Post-Cuántica

## Arquitectura

```
dApp (página web)
  └─ window.rstn (inpage.js — MAIN world)
       └─ content-script.js (bridge, ISOLATED world)
            └─ background.js (service worker, MV3)
                 ├─ Vault cifrado (AES-256-GCM en chrome.storage)
                 ├─ Keypair Dilithium3 (en RAM, nunca expuesto)
                 └─ RPC → rstn-node
```

## Estructura

```
rstn-wallet/
├── manifest.json          ← Manifest V3
├── popup.html             ← UI de la wallet (360×540px)
├── popup.css              ← Estilos (paleta RSTN cohesiva)
├── popup.js               ← Lógica del popup
├── background.js          ← Service worker: vault, keys, RPC, bridge
├── crypto.js              ← Dilithium3 (ML-DSA-65, FIPS 204) — implementación real
├── content-script.js      ← Bridge página → background
├── inpage.js              ← Expone window.rstn a las dApps
└── assets/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## Diferencia vs MetaMask

| Característica        | MetaMask              | RSTN Wallet                |
|-----------------------|-----------------------|-----------------------------|
| Algoritmo de firma    | secp256k1 (ECDSA)     | Dilithium3 (lattice-based)  |
| Resistencia cuántica  | NO (vulnerable a Shor)| SÍ                          |
| API inpage            | window.ethereum       | window.rstn                |
| Formato de dirección  | 0x... (20 bytes)      | rstn1... (20 bytes hash)     |
| Tamaño de firma       | 64 bytes              | 3309 bytes                  |
| Tamaño de clave pub   | 33 bytes              | 1952 bytes                  |
| Compatibilidad        | EVM                   | Resistance-VM                    |

## Cómo cargar la extensión (desarrollo)

1. Generar los íconos en `assets/` (16×16, 48×48, 128×128 PNG)
2. Abrir `chrome://extensions/`
3. Activar "Modo desarrollador"
4. Click "Cargar descomprimida"
5. Seleccionar la carpeta `rstn-wallet/`

## API para dApps

```javascript
// Detectar si RSTN Wallet está instalada
if (window.rstn?.isRstn) {
  // Conectar
  const { address } = await window.rstn.connect();
  console.log("Conectado:", address); // rstn1...

  // Firmar mensaje
  const { signature } = await window.rstn.sign("Hola RSTN");

  // Enviar transacción
  const { txHash } = await window.rstn.sendTransaction({
    to: "rstn1abc...",
    amount: 10.5,
  });

  // Escuchar cambios de cuenta
  window.rstn.onAccountChanged((newAddress) => {
    console.log("Cuenta cambió:", newAddress);
  });
}
```

## Implementado

- [x] Dilithium3 (ML-DSA-65, FIPS 204) — keypair generation + signing REAL (@noble/post-quantum)
- [x] Vault cifrado (AES-256-GCM, PBKDF2 600K iteraciones)
- [x] Importación desde seed phrase (12 o 24 palabras, derivación determinista PBKDF2)
- [x] API window.rstn para dApps (connect, sign, sendTransaction, getBalance)
- [x] Bridge content-script → background → wallet
- [x] QR code en pantalla de recibir
- [x] Firma canónica compatible con el nodo (Keccak-512(canonical_encode(tx)))
- [x] Transacciones reales on-chain (rstn_sendTransaction con verificación de firma)
- [x] Balance en vivo desde el nodo (rstn_getBalance)

## Pendiente de implementar

- [ ] Popup de confirmación visual para DAPP_CONNECT y DAPP_SIGN
- [ ] Soporte multi-cuenta completo (switch requiere re-unlock)
- [ ] Detección de red (testnet/mainnet) con switch automático
- [ ] Historial de transacciones con paginación
- [ ] Integración con hardware wallet (Ledger post-cuántico)
- [ ] Auditoría de seguridad antes de mainnet

## Seguridad

- La clave privada **nunca** sale del service worker
- El vault está cifrado con AES-256-GCM (PBKDF2 600K iteraciones)
- Las dApps reciben solo la dirección pública y firmas
- `wasm-unsafe-eval` habilitado en CSP para futuras optimizaciones WASM
- No se usa `eval` ni scripts remotos
- Dilithium3 via @noble/post-quantum (auditada, FIPS 204) — bundled en crypto.js

## Build de crypto.js

`crypto.js` es un bundle de `@noble/post-quantum` + `@noble/hashes` generado con esbuild.
Para regenerarlo (tras actualizar dependencias):

```bash
bun run build-wallet-crypto.mjs
```

El bundle expone `self.rstnCrypto = { ml_dsa65, keccak_512, PK_BYTES, SK_BYTES, SIG_BYTES }`,
cargado por `background.js` via `importScripts("crypto.js")`.
