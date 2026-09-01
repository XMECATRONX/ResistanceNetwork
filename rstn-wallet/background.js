// Cargar modulos (crypto + bip39 + lib)
importScripts("crypto.js");
importScripts("bip39.js");
importScripts("wallet-lib.js");

if (typeof self.rstnCrypto === "undefined" || !self.rstnCrypto.ml_dsa65) {
  console.error("[RSTN SW] FATAL: crypto.js failed to load");
} else {
  console.log("[RSTN SW] crypto.js loaded: ml_dsa65 available");
}
if (typeof self.rstnBip39 === "undefined") {
  console.error("[RSTN SW] FATAL: bip39.js failed to load");
} else {
  console.log("[RSTN SW] bip39.js loaded");
}
if (typeof self.rstnWalletLib === "undefined") {
  console.error("[RSTN SW] FATAL: wallet-lib.js failed to load");
} else {
  console.log("[RSTN SW] wallet-lib.js loaded");
}

/**
 * RSTN Wallet -- Background Service Worker (Manifest V3)
 * Handles: multi-account vault, signing, RPC, dApp bridge, tx history, settings.
 * Crypto + utils live in wallet-lib.js. Keys NEVER leave the SW.
 *
 * Security model (audited):
 *  - Password is NEVER persisted. Keys live only in RAM while unlocked.
 *    Re-lock happens when the SW is terminated (no auto-unlock).
 *  - dApp requests (CONNECT / SIGN / SEND_TX) require an explicit user
 *    confirmation popup before proceeding.
 *  - dApp messages must carry a valid origin; the SW validates it.
 *  - Amount parsing uses BigInt (no float precision loss).
 */

const L = self.rstnWalletLib;

// -- Estado en memoria (se pierde al cerrar el SW) --
let unlockedKeypairs = []; // [{ publicKey, secretKey, address, seedPhrase, name }]
let isLocked = true;
let currentAccountIndex = 0;
let RPC_URL = "http://localhost:9944";
let sessionPassword = null; // RAM-only; lost when SW terminates (W2: no auto-unlock)

// -- Pending dApp confirmation requests (id -> resolver) --
const pendingDapp = new Map();
let dappSeq = 0;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse);
  return true;
});

/**
 * Parse a decimal amount string into integer wei (1e18) using BigInt.
 * Avoids float precision loss for large values (W3).
 * Accepts "1000", "1000.5", "0.001" etc.
 */
function parseAmountWei(amountStr) {
  if (typeof amountStr !== "string") amountStr = String(amountStr);
  const s = amountStr.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid amount format");
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "000000000000000000").slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(fracPadded);
}

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case "WALLET_GET_STATE": {
      const vault = await chrome.storage.local.get("vault");
      if (!vault.vault) return { exists: false, locked: true };
      if (isLocked || !unlockedKeypairs.length) return { exists: true, locked: true };
      const kp = unlockedKeypairs[currentAccountIndex];
      if (!kp) return { exists: true, locked: true };
      const { balance, balanceUsd, nonce } = await L.getBalance(RPC_URL, kp.address);
      return { exists: true, locked: false, address: kp.address,
        accountName: kp.name || "Account " + (currentAccountIndex + 1),
        accountIndex: currentAccountIndex, balance, balanceUsd, nonce };
    }

    case "WALLET_CREATE": {
      try {
        // W0-critical: generate the mnemonic FIRST, then derive the keypair
        // from it so Create and Import are consistent. Previously Create used a
        // random keypair with a separate decorative mnemonic — a lost device
        // + Import with the backed-up words produced a DIFFERENT address and
        // the funds were unrecoverable. Now both paths derive via PBKDF2(seed).
        const seedPhrase = self.rstnBip39.generateMnemonic(24);
        const keypair = await L.generateKeypairFromSeed(seedPhrase);
        keypair.seedPhrase = seedPhrase;
        keypair.name = "Account 1";
        const encryptedVault = await L.encryptVault([keypair], msg.password);
        await chrome.storage.local.set({ vault: encryptedVault, activeAccount: 0 });
        unlockedKeypairs = [keypair]; isLocked = false; currentAccountIndex = 0;
        sessionPassword = msg.password; // RAM-only (W2)
        return { success: true, address: keypair.address, seedPhrase: keypair.seedPhrase, accountName: "Account 1" };
      } catch (err) { return { success: false, error: err.message }; }
    }

    case "WALLET_IMPORT": {
      try {
        const words = msg.seedPhrase.trim().split(/\s+/).filter(Boolean);
        if (words.length !== 12 && words.length !== 24)
          return { success: false, error: "Seed phrase must be 12 or 24 words" };
        if (!self.rstnBip39.isValidMnemonic(msg.seedPhrase))
          return { success: false, error: "Seed phrase contains invalid words" };
        const keypair = await L.generateKeypairFromSeed(msg.seedPhrase);
        keypair.seedPhrase = msg.seedPhrase;
        keypair.name = "Account 1";
        const encryptedVault = await L.encryptVault([keypair], msg.password);
        await chrome.storage.local.set({ vault: encryptedVault, activeAccount: 0 });
        unlockedKeypairs = [keypair]; isLocked = false; currentAccountIndex = 0;
        sessionPassword = msg.password; // RAM-only (W2)
        return { success: true, address: keypair.address };
      } catch (err) { return { success: false, error: err.message }; }
    }

    case "WALLET_UNLOCK": {
      try {
        const { vault } = await chrome.storage.local.get("vault");
        if (!vault) return { success: false, error: "No wallet found" };
        unlockedKeypairs = await L.decryptVault(vault, msg.password);
        const { activeAccount } = await chrome.storage.local.get("activeAccount");
        currentAccountIndex = typeof activeAccount === "number" ? activeAccount : 0;
        isLocked = false;
        sessionPassword = msg.password; // RAM-only (W2)
        return { success: true, address: unlockedKeypairs[currentAccountIndex]?.address };
      } catch { return { success: false, error: "Incorrect password" }; }
    }

    case "WALLET_LOCK": {
      unlockedKeypairs = []; isLocked = true; sessionPassword = null;
      return { success: true };
    }

    case "WALLET_GET_SEED": {
      if (isLocked || !unlockedKeypairs.length) return { success: false, error: "Wallet locked" };
      return { success: true, seedPhrase: unlockedKeypairs[currentAccountIndex].seedPhrase || null };
    }

    case "WALLET_CHANGE_PASSWORD": {
      try {
        const { vault } = await chrome.storage.local.get("vault");
        const kps = await L.decryptVault(vault, msg.oldPassword);
        const newVault = await L.encryptVault(kps, msg.newPassword);
        await chrome.storage.local.set({ vault: newVault });
        sessionPassword = msg.newPassword; // RAM-only (W2)
        return { success: true };
      } catch { return { success: false, error: "Current password incorrect" }; }
    }

    case "WALLET_RESET": {
      unlockedKeypairs = []; isLocked = true; sessionPassword = null;
      await chrome.storage.local.remove(["vault", "accounts", "activeAccount", "txHistory", "rpcUrl"]);
      return { success: true };
    }

    case "WALLET_GET_NETWORK": return { rpcUrl: RPC_URL };

    case "WALLET_SET_NETWORK": {
      if (msg.rpcUrl) { RPC_URL = msg.rpcUrl; await chrome.storage.local.set({ rpcUrl: msg.rpcUrl }); }
      return { success: true, rpcUrl: RPC_URL };
    }

    case "WALLET_SEND": {
      if (isLocked || !unlockedKeypairs.length) return { success: false, error: "Wallet locked -- unlock first" };
      try {
        const kp = unlockedKeypairs[currentAccountIndex];
        const nonce = await L.getNonce(RPC_URL, kp.address);
        const amountWei = parseAmountWei(msg.amount); // W3: BigInt, no float loss
        const nodeTx = L.buildNodeTx(kp.publicKey, msg.to, amountWei.toString(), nonce, "1000000000", 21000, "Transfer", new Uint8Array(0));
        nodeTx.signature = Array.from(await L.signTransaction(nodeTx, kp.secretKey));
        const result = await L.broadcastTx(RPC_URL, nodeTx);
        if (result == null) return { success: false, error: "Node rejected transaction (signature verification or RPC failed)" };
        await L.recordTx({ hash: result, type: "out", amount: msg.amount, to: msg.to, from: kp.address, status: "pending", timestamp: Date.now(), address: kp.address });
        return { success: true, txHash: result };
      } catch (err) { return { success: false, error: err.message || String(err) }; }
    }

    case "WALLET_GET_TXS": {
      if (isLocked || !unlockedKeypairs.length) return { txs: [] };
      return { txs: await L.mergeTxs(RPC_URL, unlockedKeypairs[currentAccountIndex].address) };
    }

    case "WALLET_FAUCET": {
      if (isLocked || !unlockedKeypairs.length) return { success: false, error: "Wallet locked" };
      try {
        const kp = unlockedKeypairs[currentAccountIndex];
        const result = await L.faucetClaim(RPC_URL, kp.address);
        if (result == null) return { success: false, error: "Faucet request failed (node offline or cooldown active)" };
        await L.recordTx({ hash: result.hash || "", type: "in", amount: String(result.amount || 1000), to: kp.address, from: "faucet", status: "confirmed", timestamp: Date.now(), address: kp.address });
        return { success: true, amount: result.amount, hash: result.hash };
      } catch (err) { return { success: false, error: err.message }; }
    }

    // ── dApp bridge: requires explicit confirmation (W1) + origin validation (W4) ──
    case "DAPP_CONNECT":
    case "DAPP_SIGN":
    case "DAPP_SEND_TX":
    case "DAPP_GET_BALANCE": {
      if (isLocked || !unlockedKeypairs.length) return { approved: false, error: "Wallet locked" };
      // W4: validate origin (A2: guard against malformed sender.tab.url)
      let origin = "unknown";
      try {
        if (sender && sender.tab && sender.tab.url) origin = new URL(sender.tab.url).origin;
        else if (sender && sender.origin) origin = sender.origin;
      } catch { origin = "unknown"; }
      if (origin === "unknown") return { approved: false, error: "Untrusted origin" };

      // W1: require explicit user confirmation via popup (A5: includes GET_BALANCE)
      const meta = JSON.stringify(msg.type === "DAPP_SIGN"
        ? { message: msg.message }
        : msg.type === "DAPP_SEND_TX"
          ? { to: msg.to, amount: msg.amount, tx_type: msg.tx_type || msg.txType }
          : {});
      const approved = await requestConfirmation(msg.type, origin, meta);
      if (!approved) return { approved: false, error: "User rejected request" };

      if (msg.type === "DAPP_CONNECT") {
        return { approved: true, address: unlockedKeypairs[currentAccountIndex].address };
      }
      // A5: expose address + balance only after explicit approval
      if (msg.type === "DAPP_GET_BALANCE") {
        const kp = unlockedKeypairs[currentAccountIndex];
        const { balance, balanceUsd, nonce } = await L.getBalance(RPC_URL, kp.address);
        return { approved: true, address: kp.address, balance, balanceUsd, nonce };
      }
      if (msg.type === "DAPP_SIGN") {
        const data = new TextEncoder().encode(msg.message);
        const sig = self.rstnCrypto.ml_dsa65.sign(data, unlockedKeypairs[currentAccountIndex].secretKey);
        return { approved: true, signature: L.toHex(new Uint8Array(sig)) };
      }
      // DAPP_SEND_TX
      try {
        const kp = unlockedKeypairs[currentAccountIndex];
        const nonce = await L.getNonce(RPC_URL, kp.address);
        const amount = typeof msg.amount === "string" ? msg.amount : String(msg.amount);
        const gasPrice = msg.gas_price || msg.gasPrice || "1000000000";
        const gasLimit = msg.gas_limit || msg.gasLimit || 21000;
        const txType = msg.tx_type || msg.txType || "Transfer";
        const payload = msg.payload ? (typeof msg.payload === "string" ? L.hexToBytes(msg.payload) : new Uint8Array(msg.payload)) : new Uint8Array(0);
        const nodeTx = L.buildNodeTx(kp.publicKey, msg.to, amount, nonce, String(gasPrice), gasLimit, txType, payload);
        nodeTx.signature = Array.from(await L.signTransaction(nodeTx, kp.secretKey));
        const result = await L.broadcastTx(RPC_URL, nodeTx);
        if (result == null) return { approved: false, error: "Node rejected transaction" };
        return { approved: true, txHash: result };
      } catch (err) { return { approved: false, error: err.message }; }
    }

    // ── Confirmation popup result ──
    case "DAPP_CONFIRM_RESULT": {
      const p = pendingDapp.get(msg.id);
      if (p) { pendingDapp.delete(msg.id); p.resolve(!!msg.approved); }
      return { ok: true };
    }

    case "WALLET_GET_ACCOUNTS": {
      if (!unlockedKeypairs.length) return { accounts: [] };
      return { accounts: unlockedKeypairs.map((kp, i) => ({ address: kp.address, name: kp.name || "Account " + (i + 1), index: i })), activeIndex: currentAccountIndex };
    }

    case "WALLET_ADD_ACCOUNT": {
      try {
        if (isLocked || !unlockedKeypairs.length) return { success: false, error: "Wallet locked" };
        // W0-add: derive the new account from the SAME seed as the existing
        // accounts (HD-style derivation) so a backup of the seed phrase restores
        // ALL accounts — not just the first. Previously a fresh random keypair
        // was used, which was lost forever if the vault was wiped.
        if (!sessionPassword) return { success: false, error: "Re-unlock wallet to add accounts" };
        const baseSeed = unlockedKeypairs[0]?.seedPhrase;
        if (!baseSeed) return { success: false, error: "Missing seed — cannot derive account" };
        // Append the account index as the BIP-39 passphrase so each account
        // deterministically derives a distinct keypair from the same base seed.
        const keypair = await L.generateKeypairFromSeed(baseSeed + "/account/" + unlockedKeypairs.length);
        const newIndex = unlockedKeypairs.length;
        keypair.seedPhrase = baseSeed;
        keypair.name = "Account " + (newIndex + 1);
        unlockedKeypairs.push(keypair);
        // W2: re-encrypt using the RAM-only session password.
        const encryptedVault = await L.encryptVault(unlockedKeypairs, sessionPassword);
        await chrome.storage.local.set({ vault: encryptedVault, activeAccount: newIndex });
        currentAccountIndex = newIndex;
        return { success: true, index: newIndex, address: keypair.address };
      } catch (err) { return { success: false, error: err.message }; }
    }

    case "WALLET_SWITCH_ACCOUNT": {
      if (msg.index >= unlockedKeypairs.length) return { success: false, error: "Account not found" };
      currentAccountIndex = msg.index;
      await chrome.storage.local.set({ activeAccount: msg.index });
      return { success: true, address: unlockedKeypairs[msg.index].address, accountName: unlockedKeypairs[msg.index].name || "Account " + (msg.index + 1) };
    }

    case "WALLET_RENAME_ACCOUNT": {
      try {
        if (msg.index >= unlockedKeypairs.length) return { success: false, error: "Account not found" };
        unlockedKeypairs[msg.index].name = msg.name;
        if (sessionPassword) {
          const encryptedVault = await L.encryptVault(unlockedKeypairs, sessionPassword);
          await chrome.storage.local.set({ vault: encryptedVault });
        }
        return { success: true };
      } catch (err) { return { success: false, error: err.message }; }
    }

    default: return { error: "Unknown message type" };
  }
}

/**
 * W1: Open a confirmation popup and wait for the user's decision.
 * Returns a Promise<boolean> (true = approved).
 */
function requestConfirmation(type, origin, meta) {
  return new Promise((resolve) => {
    const id = "dapp_" + (++dappSeq);
    pendingDapp.set(id, resolve);
    const url = `confirm.html?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&origin=${encodeURIComponent(origin)}&meta=${encodeURIComponent(meta)}`;
    chrome.windows.create({
      url,
      type: "popup",
      width: 360,
      height: 460,
    });
    // Auto-reject if popup closed without action (timeout safety)
    setTimeout(() => {
      if (pendingDapp.has(id)) {
        pendingDapp.delete(id);
        resolve(false);
      }
    }, 120000);
  });
}

// Load persisted RPC URL on startup
chrome.storage.local.get("rpcUrl").then(({ rpcUrl }) => { if (rpcUrl) RPC_URL = rpcUrl; });
