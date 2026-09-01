/**
 * RSTN Wallet — Inpage Script
 *
 * Se ejecuta en el contexto de la página (MAIN world).
 * Expone window.rstn para que las dApps interactúen con la wallet.
 *
 * API pública:
 *   window.rstn.connect()           → { address }
 *   window.rstn.sign(message)       → { signature }
 *   window.rstn.sendTransaction(tx) → { txHash }
 *   window.rstn.getBalance()        → { balance }
 *   window.rstn.onAccountChanged(cb)
 *   window.rstn.onNetworkChanged(cb)
 *
 * Diferencia clave vs MetaMask:
 *   - window.rstn usa Dilithium3 (post-cuántico)
 *   - window.ethereum usa secp256k1 (vulnerable a Shor)
 *   - No son compatibles entre sí
 *   - Una dApp debe detectar window.rstn y usar esta API
 */

(function () {
  const PENDING = new Map();
  let nextId = 0;

  // ── Listener de respuestas del content-script ──
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "rstn-wallet") return;

    const { id, response } = event.data;
    const pending = PENDING.get(id);
    if (!pending) return;

    PENDING.delete(id);
    if (response.error) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response);
    }
  });

  // ── Enviar mensaje al content-script ──
  function sendRequest(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      // W8: timeout so pending requests don't hang forever
      const timer = setTimeout(() => {
        if (PENDING.has(id)) {
          PENDING.delete(id);
          reject(new Error("Resistance wallet request timed out"));
        }
      }, 60000);
      PENDING.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      window.postMessage({ source: "rstn-dapp", id, type, payload }, location.origin);
    });
  }

  // ── API pública window.rstn ──
  const rstnApi = {
    isResistance: true,
    version: "0.1.0",

    /** Conectar la wallet a la dApp. Retorna la dirección del usuario. */
    async connect() {
      const resp = await sendRequest("DAPP_CONNECT");
      return resp;
    },

    /** Firmar un mensaje arbitrario con la clave Dilithium3. */
    async sign(message) {
      return sendRequest("DAPP_SIGN", { message });
    },

    /** Enviar una transacción firmada a la red (desde dApp). */
    async sendTransaction(tx) {
      return sendRequest("DAPP_SEND_TX", tx);
    },

    /** Obtener el balance de la wallet conectada. */
    async getBalance() {
      // A5: route through the dApp confirmation path so the user must
      // approve address+balance exposure (no silent read).
      return sendRequest("DAPP_GET_BALANCE");
    },

    // ── Event listeners ──
    _listeners: { accountChanged: [], networkChanged: [] },

    onAccountChanged(cb) {
      this._listeners.accountChanged.push(cb);
    },

    onNetworkChanged(cb) {
      this._listeners.networkChanged.push(cb);
    },
  };

  // ── Exponer en window ──
  window.rstn = rstnApi;

  // ── Emitir evento de disponibilidad ──
  window.dispatchEvent(new CustomEvent("rstn#initialized", { detail: { version: "0.1.0" } }));
})();
