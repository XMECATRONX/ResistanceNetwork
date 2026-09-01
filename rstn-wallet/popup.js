/**
 * RSTN Wallet — Popup Logic v4
 *
 * Multi-account, real transaction history, settings, seed backup,
 * change password, network config, pending badge.
 * Crypto: Dilithium3 (ML-DSA-65, FIPS 204) — post-quantum.
 *
 * Security: QR codes are generated locally (qr.js) — the address is
 * never sent to a third-party API (W5).
 */

// ── Views ──
const views = {
  locked: document.getElementById("lockedView"),
  onboarding: document.getElementById("onboardingView"),
  import: document.getElementById("importView"),
  dashboard: document.getElementById("dashboardView"),
  receive: document.getElementById("receiveView"),
  send: document.getElementById("sendView"),
  confirm: document.getElementById("confirmView"),
  backup: document.getElementById("backupView"),
  settings: document.getElementById("settingsView"),
  changePw: document.getElementById("changePwView"),
};

function showView(name) {
  Object.values(views).forEach((v) => v?.classList.add("hidden"));
  views[name]?.classList.remove("hidden");
  document.getElementById("accountDropdown")?.classList.add("hidden");
}

// ── State ──
let currentAccount = 0;
let pendingTx = null;
let activeTab = "activity";

// ── Utils ──
// A3/A4: escape untrusted strings before injecting into innerHTML.
// The popup runs in the extension context with chrome.* access, so
// unescaped HTML from on-chain or user-controlled data is a critical XSS vector.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortenAddress(addr) {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast("Copied"));
}

function showToast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--bg-card);color:var(--primary);padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;border:1px solid var(--border);z-index:999;";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function setLoading(btn, loading, text) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> ' + (text || "Loading...");
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || btn.textContent;
  }
}

// ── Connection status ──
async function checkConnection() {
  const dot = document.getElementById("connDot");
  const text = document.getElementById("connText");
  dot.className = "conn-dot";
  text.textContent = "Checking connection...";
  // W10: use the configured RPC URL, not a hardcoded localhost
  const net = await sendMessage({ type: "WALLET_GET_NETWORK" });
  const rpcUrl = net.rpcUrl || "http://localhost:9944";
  try {
    const resp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "rstn_health", params: [] }),
      signal: AbortSignal.timeout(2000),
    });
    if (resp.ok) {
      dot.className = "conn-dot connected";
      text.textContent = "Connected to RSTN";
      document.getElementById("networkBadge").textContent = rpcUrl.includes("localhost") ? "Testnet" : "Custom";
    } else { throw new Error("Not ok"); }
  } catch {
    dot.className = "conn-dot error";
    text.textContent = "Offline — demo mode";
    document.getElementById("networkBadge").textContent = "Demo";
  }
}

// ── Init ──
async function init() {
  await checkConnection();
  setInterval(checkConnection, 15000);
  const resp = await sendMessage({ type: "WALLET_GET_STATE" });
  if (!resp.exists) showView("onboarding");
  else if (resp.locked) showView("locked");
  else await loadDashboard();
}

// ── Onboarding: create wallet ──
document.getElementById("createBtn")?.addEventListener("click", async () => {
  const pw = document.getElementById("createPassword").value;
  const confirmPw = document.getElementById("confirmPassword").value;
  const errEl = document.getElementById("createError");
  const btn = document.getElementById("createBtn");
  if (pw.length < 8) { errEl.textContent = "Password must be at least 8 characters"; return; }
  if (pw !== confirmPw) { errEl.textContent = "Passwords do not match"; return; }
  errEl.textContent = "";
  setLoading(btn, true, "Generating keys...");
  const resp = await sendMessage({ type: "WALLET_CREATE", password: pw });
  if (resp.success) {
    document.getElementById("createPassword").value = "";
    document.getElementById("confirmPassword").value = "";
    // Show seed phrase backup immediately after creation
    if (resp.seedPhrase) {
      renderSeedPhrase(resp.seedPhrase);
      showToast("Save your backup phrase!");
      showView("backup");
    } else {
      await loadDashboard();
    }
  } else { errEl.textContent = resp.error || "Failed to create wallet"; }
  setLoading(btn, false);
});

// ── Seed phrase rendering ──
function renderSeedPhrase(phrase) {
  const grid = document.getElementById("seedGrid");
  const words = phrase.split(/\s+/).filter(Boolean);
  grid.innerHTML = words.map((w, i) =>
    `<div class="seed-word"><span class="seed-word-num">${i + 1}</span>${w}</div>`
  ).join("");
}

// ── Import ──
document.getElementById("importBtn")?.addEventListener("click", () => showView("import"));
document.getElementById("importConfirmBtn")?.addEventListener("click", async () => {
  const seed = document.getElementById("seedPhrase").value.trim();
  const pw = document.getElementById("importPassword").value;
  const confirmPw = document.getElementById("importConfirmPassword").value;
  const errEl = document.getElementById("importError");
  const words = seed.split(/\s+/).filter(Boolean);
  if (words.length !== 12 && words.length !== 24) { errEl.textContent = "Seed phrase must be 12 or 24 words"; return; }
  if (pw.length < 8) { errEl.textContent = "Password must be at least 8 characters"; return; }
  if (pw !== confirmPw) { errEl.textContent = "Passwords do not match"; return; }
  errEl.textContent = "";
  const resp = await sendMessage({ type: "WALLET_IMPORT", seedPhrase: seed, password: pw });
  if (resp.success) {
    document.getElementById("seedPhrase").value = "";
    document.getElementById("importPassword").value = "";
    document.getElementById("importConfirmPassword").value = "";
    await loadDashboard();
  } else { errEl.textContent = resp.error || "Failed to import wallet"; }
});
document.getElementById("importBackBtn")?.addEventListener("click", () => showView("onboarding"));

// ── Unlock ──
document.getElementById("unlockBtn")?.addEventListener("click", async () => {
  const pw = document.getElementById("unlockPassword").value;
  const errEl = document.getElementById("unlockError");
  const btn = document.getElementById("unlockBtn");
  setLoading(btn, true, "Unlocking...");
  const resp = await sendMessage({ type: "WALLET_UNLOCK", password: pw });
  if (resp.success) {
    document.getElementById("unlockPassword").value = "";
    await loadDashboard();
  } else { errEl.textContent = "Incorrect password"; }
  setLoading(btn, false);
});

// ── Dashboard ──
async function loadDashboard() {
  const state = await sendMessage({ type: "WALLET_GET_STATE" });
  if (!state.address) { showView("locked"); return; }
  currentAccount = state.accountIndex || 0;
  document.getElementById("addressValue").textContent = shortenAddress(state.address);
  document.getElementById("accountName").textContent = state.accountName || "Account 1";
  document.getElementById("accountAvatar").textContent = String(currentAccount + 1);
  document.getElementById("balanceValue").textContent = `${state.balance || "0.00"} RSTN`;
  document.getElementById("balanceUsd").textContent = `≈ $${state.balanceUsd || "0.00"}`;
  await loadTxs();
  showView("dashboard");
}

// ── Render transactions ──
function renderTxs(txs) {
  const list = document.getElementById("txList");
  if (!txs.length) {
    list.innerHTML = '<span class="tx-empty">No transactions yet</span>';
    updatePendingBadge([]);
    return;
  }
  list.innerHTML = txs.map((tx) => {
    const isIn = tx.type === "in";
    const statusClass = esc(tx.status || "confirmed");
    const time = tx.timestamp ? new Date(tx.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const label = isIn ? "Received" : "Sent";
    const hash = esc(tx.hash || (isIn ? tx.from : tx.to) || "—");
    const amount = esc(tx.amount);
    return `
    <div class="tx-item ${isIn ? "in" : "out"} ${tx.status === "pending" ? "pending" : ""}" data-hash="${hash}">
      <div class="tx-item-left">
        <div class="tx-item-hash">${label} · ${shortenAddress(hash)}</div>
        <div class="tx-item-date">${time}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
        <div class="tx-item-amount">${isIn ? "+" : "-"}${amount} RSTN</div>
        <span class="tx-status ${statusClass}">${statusClass}</span>
      </div>
    </div>`;
  }).join("");
  list.querySelectorAll(".tx-item").forEach((el) => {
    el.addEventListener("click", () => {
      const hash = el.dataset.hash;
      if (hash && hash !== "—") window.open(`http://localhost:8080/terminal?tx=${hash}`, "_blank");
    });
  });
  updatePendingBadge(txs);
}

function updatePendingBadge(txs) {
  const badge = document.getElementById("pendingBadge");
  const pendingCount = txs.filter((t) => t.status === "pending").length;
  if (pendingCount > 0) { badge.textContent = pendingCount; badge.style.display = "inline-block"; }
  else { badge.style.display = "none"; }
}

// ── Tab switching ──
document.getElementById("tabActivity")?.addEventListener("click", () => {
  activeTab = "activity";
  document.getElementById("tabActivity").classList.add("active");
  document.getElementById("tabPending").classList.remove("active");
  loadTxs();
});
document.getElementById("tabPending")?.addEventListener("click", () => {
  activeTab = "pending";
  document.getElementById("tabPending").classList.add("active");
  document.getElementById("tabActivity").classList.remove("active");
  loadTxs();
});

async function loadTxs() {
  const txResp = await sendMessage({ type: "WALLET_GET_TXS" });
  let txs = txResp.txs || [];
  if (activeTab === "pending") txs = txs.filter((t) => t.status === "pending");
  renderTxs(txs);
}

// ── Account switcher ──
document.getElementById("accountSwitchBtn")?.addEventListener("click", async () => {
  const dropdown = document.getElementById("accountDropdown");
  dropdown.classList.toggle("hidden");
  if (!dropdown.classList.contains("hidden")) await renderAccountList();
});

async function renderAccountList() {
  const resp = await sendMessage({ type: "WALLET_GET_ACCOUNTS" });
  const accounts = resp.accounts || [];
  const list = document.getElementById("accountList");
  if (!accounts.length) {
    list.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--text-muted);">No accounts</div>';
    return;
  }
  list.innerHTML = accounts.map((acc, i) => `
    <div class="account-item ${i === currentAccount ? "active" : ""}" data-index="${i}">
      <span class="account-avatar">${i + 1}</span>
      <div class="account-info">
        <span class="account-name">${esc(acc.name || "Account " + (i + 1))}</span>
        <span class="account-address">${shortenAddress(esc(acc.address))}</span>
      </div>
    </div>`).join("");
  list.querySelectorAll(".account-item").forEach((el) => {
    el.addEventListener("click", async () => {
      const idx = parseInt(el.dataset.index);
      const switchResp = await sendMessage({ type: "WALLET_SWITCH_ACCOUNT", index: idx });
      if (switchResp.success) {
        currentAccount = idx;
        document.getElementById("accountDropdown").classList.add("hidden");
        await loadDashboard();
      }
    });
  });
}

document.getElementById("addAccountBtn")?.addEventListener("click", async () => {
  const resp = await sendMessage({ type: "WALLET_ADD_ACCOUNT" });
  if (resp.success) {
    currentAccount = resp.index;
    document.getElementById("accountDropdown").classList.add("hidden");
    await loadDashboard();
  }
});

// ── Copy address ──
document.getElementById("copyBtn")?.addEventListener("click", async () => {
  const state = await sendMessage({ type: "WALLET_GET_STATE" });
  if (state.address) copyToClipboard(state.address);
});

// ── Lock ──
document.getElementById("lockBtn")?.addEventListener("click", async () => {
  await sendMessage({ type: "WALLET_LOCK" });
  showView("locked");
});

// ── Faucet ──
document.getElementById("faucetBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("faucetBtn");
  setLoading(btn, true, "Claiming...");
  const resp = await sendMessage({ type: "WALLET_FAUCET" });
  if (resp.success) {
    showToast(`Faucet: +${resp.amount} RSTN credited`);
    await loadDashboard();
  } else { showToast(resp.error || "Faucet failed"); }
  setLoading(btn, false);
});

// ── Receive ──
document.getElementById("receiveBtn")?.addEventListener("click", async () => {
  const state = await sendMessage({ type: "WALLET_GET_STATE" });
  const addr = state.address || "—";
  document.getElementById("receiveAddress").textContent = addr;
  // W5: render QR locally so the address never leaves the device
  const oldImg = document.getElementById("qrCode");
  if (oldImg) oldImg.style.display = "none";
  rstnPopupQR.render(addr, "qrCanvas");
  showView("receive");
});
document.getElementById("receiveBackBtn")?.addEventListener("click", () => showView("dashboard"));
document.getElementById("copyReceiveBtn")?.addEventListener("click", async () => {
  const state = await sendMessage({ type: "WALLET_GET_STATE" });
  if (state.address) copyToClipboard(state.address);
});

// ── Send ──
document.getElementById("sendBtn")?.addEventListener("click", async () => {
  const state = await sendMessage({ type: "WALLET_GET_STATE" });
  document.getElementById("sendAvailable").textContent = state.balance || "0.00";
  showView("send");
});
document.getElementById("sendBackBtn")?.addEventListener("click", () => showView("dashboard"));
document.getElementById("sendMaxBtn")?.addEventListener("click", () => {
  const available = parseFloat(document.getElementById("sendAvailable").textContent) || 0;
  document.getElementById("sendAmount").value = Math.max(0, available - 0.001).toFixed(4);
});
document.getElementById("sendConfirmBtn")?.addEventListener("click", async () => {
  const to = document.getElementById("sendTo").value.trim();
  const amount = document.getElementById("sendAmount").value;
  const errEl = document.getElementById("sendError");
  if (!to || !to.startsWith("rstn1")) { errEl.textContent = "Invalid recipient address (must start with rstn1)"; return; }
  if (!amount || parseFloat(amount) <= 0) { errEl.textContent = "Invalid amount"; return; }
  const available = parseFloat(document.getElementById("sendAvailable").textContent) || 0;
  if (parseFloat(amount) + 0.001 > available) { errEl.textContent = "Insufficient balance"; return; }
  errEl.textContent = "";
  const state = await sendMessage({ type: "WALLET_GET_STATE" });
  const gas = 0.001, total = parseFloat(amount) + gas;
  document.getElementById("confirmFrom").textContent = shortenAddress(state.address);
  document.getElementById("confirmTo").textContent = shortenAddress(to);
  document.getElementById("confirmAmount").textContent = `${amount} RSTN`;
  document.getElementById("confirmGas").textContent = `~${gas} RSTN`;
  document.getElementById("confirmTotal").textContent = `${total.toFixed(4)} RSTN`;
  // A6: keep the amount as a string (not parseFloat) so BigInt parsing in
  // the SW preserves full precision for large values.
  pendingTx = { to, amount: String(amount) };
  showView("confirm");
});

// ── Confirm & send ──
document.getElementById("confirmSendBtn")?.addEventListener("click", async () => {
  const errEl = document.getElementById("confirmError");
  const btn = document.getElementById("confirmSendBtn");
  if (!pendingTx) { errEl.textContent = "No pending transaction"; return; }
  errEl.textContent = "";
  setLoading(btn, true, "Signing with Dilithium3...");
  let resp;
  try {
    resp = await sendMessage({ type: "WALLET_SEND", to: pendingTx.to, amount: String(pendingTx.amount) });
  } catch (err) {
    errEl.textContent = "Wallet error: " + (err.message || err);
    setLoading(btn, false); return;
  }
  if (!resp) { errEl.textContent = "No response from wallet (reopen popup)"; setLoading(btn, false); return; }
  if (!resp.success) { errEl.textContent = resp.error || "Failed to send"; setLoading(btn, false); return; }
  document.getElementById("sendTo").value = "";
  document.getElementById("sendAmount").value = "";
  pendingTx = null;
  setLoading(btn, true, "Broadcasting...");
  const stateBefore = await sendMessage({ type: "WALLET_GET_STATE" });
  const nonceBefore = typeof stateBefore.nonce === "number" ? stateBefore.nonce : 0;
  let confirmed = false;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const st = await sendMessage({ type: "WALLET_GET_STATE" });
    const nonceNow = typeof st.nonce === "number" ? st.nonce : 0;
    setLoading(btn, true, `Confirming... (${i + 1}/12)`);
    if (nonceNow > nonceBefore) { confirmed = true; break; }
  }
  setLoading(btn, false);
  showToast(confirmed ? "Transaction confirmed ✓" : "Sent — confirmation pending");
  await loadDashboard();
});
document.getElementById("confirmBackBtn")?.addEventListener("click", () => { pendingTx = null; showView("send"); });

// ── Stake (links to terminal) ──
document.getElementById("stakeBtn")?.addEventListener("click", () => {
  window.open("http://localhost:8080/terminal", "_blank");
});

// ── Settings ──
const NET_DEFAULT = "http://localhost:9944";
const syncPresets = (cur) => document.querySelectorAll(".network-preset").forEach((b) => { b.style.borderColor = (b.dataset.rpc === cur) ? "var(--primary, #00d97e)" : ""; });
document.querySelectorAll(".network-preset").forEach((btn) => btn.addEventListener("click", () => { document.getElementById("rpcUrlInput").value = btn.dataset.rpc; syncPresets(btn.dataset.rpc); }));
document.getElementById("settingsBtn")?.addEventListener("click", async () => {
  const cur = (await sendMessage({ type: "WALLET_GET_NETWORK" })).rpcUrl || NET_DEFAULT;
  document.getElementById("rpcUrlInput").value = cur; syncPresets(cur); showView("settings");
});
document.getElementById("settingsBackBtn")?.addEventListener("click", () => showView("dashboard"));
document.getElementById("saveNetworkBtn")?.addEventListener("click", async () => {
  const url = document.getElementById("rpcUrlInput").value.trim();
  if (!url) return; await sendMessage({ type: "WALLET_SET_NETWORK", rpcUrl: url }); showToast("Network saved");
});
document.getElementById("revealSeedBtn")?.addEventListener("click", async () => {
  const resp = await sendMessage({ type: "WALLET_GET_SEED" });
  if (resp.success && resp.seedPhrase) {
    renderSeedPhrase(resp.seedPhrase);
    showView("backup");
  } else { showToast(resp.error || "No backup phrase available"); }
});
document.getElementById("copySeedBtn")?.addEventListener("click", async () => {
  const resp = await sendMessage({ type: "WALLET_GET_SEED" });
  if (resp.success && resp.seedPhrase) copyToClipboard(resp.seedPhrase);
});
document.getElementById("backupBackBtn")?.addEventListener("click", () => showView("settings"));
document.getElementById("resetWalletBtn")?.addEventListener("click", async () => {
  if (confirm("This will erase ALL wallet data including keys. This cannot be undone. Continue?")) {
    await sendMessage({ type: "WALLET_RESET" });
    showView("onboarding");
    showToast("Wallet reset");
  }
});

// ── Change password ──
document.getElementById("changePasswordBtn")?.addEventListener("click", () => showView("changePw"));
document.getElementById("changePwBackBtn")?.addEventListener("click", () => showView("settings"));
document.getElementById("changePwConfirmBtn")?.addEventListener("click", async () => {
  const oldPw = document.getElementById("oldPassword").value;
  const newPw = document.getElementById("newPassword").value;
  const confirmPw = document.getElementById("confirmNewPassword").value;
  const errEl = document.getElementById("changePwError");
  if (newPw.length < 8) { errEl.textContent = "New password must be at least 8 characters"; return; }
  if (newPw !== confirmPw) { errEl.textContent = "New passwords do not match"; return; }
  errEl.textContent = "";
  const resp = await sendMessage({ type: "WALLET_CHANGE_PASSWORD", oldPassword: oldPw, newPassword: newPw });
  if (resp.success) {
    document.getElementById("oldPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmNewPassword").value = "";
    showToast("Password updated");
    showView("settings");
  } else { errEl.textContent = resp.error || "Failed to change password"; }
});

// ── Messaging ──
function sendMessage(msg) {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ success: false, error: "Wallet service worker timeout (reopen popup)" }); }
    }, 15000);
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (resolved) return;
        resolved = true; clearTimeout(timer);
        if (chrome.runtime.lastError) { resolve({ success: false, error: chrome.runtime.lastError.message }); return; }
        resolve(resp || {});
      });
    } catch (err) {
      if (!resolved) { resolved = true; clearTimeout(timer); resolve({ success: false, error: err.message }); }
    }
  });
}

init();
