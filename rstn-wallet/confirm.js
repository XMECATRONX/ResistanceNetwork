/**
 * rstn-wallet/confirm.js — dApp confirmation popup logic.
 *
 * Opens when a dApp requests CONNECT / SIGN / SEND_TX.
 * Shows the requesting origin + transaction details and requires
 * explicit user approval before the background proceeds.
 *
 * Loaded by confirm.html. Communicates with the background SW via
 * chrome.runtime messaging.
 *
 * Security: ALL values coming from the dApp (origin, message, tx fields)
 * are HTML-escaped before injection. The popup runs in the extension
 * context with access to chrome.* APIs, so unescaped HTML here would be
 * a critical XSS vector (A1).
 */

const params = new URLSearchParams(location.search);
const reqId = params.get("id");
const reqType = params.get("type");
const origin = params.get("origin") || "unknown";
const meta = params.get("meta");

// A1: escape any string before injecting into innerHTML.
// Use char-code replacements to avoid any entity-rendering ambiguity.
function esc(s) {
  return String(s)
    .replace(/&/g, String.fromCharCode(38) + "amp;")
    .replace(/</g, String.fromCharCode(38) + "lt;")
    .replace(/>/g, String.fromCharCode(38) + "gt;")
    .replace(/"/g, String.fromCharCode(38) + "quot;")
    .replace(/'/g, String.fromCharCode(38) + "#39;");
}

document.getElementById("origin").textContent = origin;

const titleEl = document.getElementById("confirmTitle");
const detailEl = document.getElementById("confirmDetail");
const approveBtn = document.getElementById("approveBtn");
const rejectBtn = document.getElementById("rejectBtn");
const errEl = document.getElementById("confirmError");

function renderDetail() {
  if (reqType === "DAPP_CONNECT") {
    titleEl.textContent = "Connect to dApp";
    detailEl.innerHTML = `<p class="detail-line">This site wants to <strong>view your Resistance address</strong>. No transaction will be sent.</p>`;
  } else if (reqType === "DAPP_GET_BALANCE") {
    titleEl.textContent = "Share Balance";
    detailEl.innerHTML = `<p class="detail-line">This site wants to <strong>view your Resistance address and balance</strong>. No transaction will be sent.</p>`;
  } else if (reqType === "DAPP_SIGN") {
    titleEl.textContent = "Sign Message";
    let msg = "";
    try { msg = JSON.parse(meta).message || ""; } catch { msg = meta || ""; }
    const safe = esc(msg).slice(0, 500);
    detailEl.innerHTML = `<p class="detail-line">This site asks you to <strong>sign a message</strong> with Dilithium3:</p><pre class="detail-pre">${safe}</pre>`;
  } else if (reqType === "DAPP_SEND_TX") {
    titleEl.textContent = "Send Transaction";
    let info = {};
    try { info = JSON.parse(meta); } catch { info = {}; }
    const to = esc(info.to || "—").slice(0, 60);
    const amt = esc(info.amount || "0");
    const tp = esc(info.tx_type || info.txType || "Transfer");
    detailEl.innerHTML = `
      <div class="detail-grid">
        <span class="detail-label">Type</span><span class="detail-val">${tp}</span>
        <span class="detail-label">To</span><span class="detail-val mono">${to}</span>
        <span class="detail-label">Amount</span><span class="detail-val">${amt} RSTN</span>
      </div>
      <p class="detail-warn">This will sign and broadcast a real transaction. It cannot be undone.</p>`;
  } else {
    titleEl.textContent = "Unknown Request";
    detailEl.textContent = "Unrecognized request type.";
  }
}

renderDetail();

function respond(approved) {
  chrome.runtime.sendMessage({ type: "DAPP_CONFIRM_RESULT", id: reqId, approved }, () => {
    window.close();
  });
}

approveBtn.addEventListener("click", () => {
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  respond(true);
});

rejectBtn.addEventListener("click", () => {
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  respond(false);
});
