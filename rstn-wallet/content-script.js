/**
 * RSTN Wallet — Content Script
 *
 * Se inyecta en cada página. Actúa como bridge entre la dApp y el background:
 *   dApp → window.rstn → content-script → background → wallet
 *
 * Inyecta el script inpage.js en el contexto de la página para exponer window.rstn.
 */

// Inyectar inpage.js en el contexto de la página
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inpage.js");
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// ── Bridge: página → background ──
window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "rstn-dapp") return;

  const { id, type, payload } = event.data;

  // Reenviar al background
  chrome.runtime.sendMessage({ type, ...payload }, (response) => {
    // W7: restrict the reply to the page's own origin (not "*")
    window.postMessage(
      {
        source: "rstn-wallet",
        id,
        response,
      },
      location.origin,
    );
  });
});
