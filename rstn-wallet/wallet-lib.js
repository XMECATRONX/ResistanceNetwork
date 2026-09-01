/**
 * RSTN Wallet — Library module (loaded via importScripts in the SW).
 * Contains: vault encryption, keypair generation, RPC, tx history, utils.
 * Keeps background.js focused on the message handler.
 */
(function (self) {
  const PK_BYTES = 1952;
  const SK_BYTES = 4032;
  const ADDRESS_SIZE = 20;

  const TX_TYPE_TO_U8 = {
    Transfer: 0, Stake: 1, Unstake: 2, Delegate: 3, Undelegate: 4,
    Claim: 5, Governance: 6, Contract: 7, ContractDeploy: 8,
  };

  // ── Vault encryption (PBKDF2 + AES-256-GCM) ──
  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
      baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
    );
  }

  async function encryptVault(keypairs, password) {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const enc = new TextEncoder();
    const data = enc.encode(JSON.stringify(
      keypairs.map((kp) => ({
        publicKey: Array.from(kp.publicKey),
        secretKey: Array.from(kp.secretKey),
        address: kp.address,
        seedPhrase: kp.seedPhrase || null,
        name: kp.name || null,
      })),
    ));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    return { salt: Array.from(salt), iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) };
  }

  async function decryptVault(vault, password) {
    const salt = new Uint8Array(vault.salt);
    const iv = new Uint8Array(vault.iv);
    const ciphertext = new Uint8Array(vault.ciphertext);
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const arr = JSON.parse(new TextDecoder().decode(decrypted));
    return arr.map((obj) => ({
      publicKey: new Uint8Array(obj.publicKey),
      secretKey: new Uint8Array(obj.secretKey),
      address: obj.address,
      seedPhrase: obj.seedPhrase || null,
      name: obj.name || null,
    }));
  }

  // ── Keypair (Dilithium3 / ML-DSA-65) ──
  function deriveAddress(publicKey) {
    const hash = self.rstnCrypto.keccak_512(publicKey);
    return "rstn1" + toHex(hash.slice(hash.length - ADDRESS_SIZE));
  }

  async function generateKeypair() {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const kp = self.rstnCrypto.ml_dsa65.keygen(seed);
    return { publicKey: new Uint8Array(kp.publicKey), secretKey: new Uint8Array(kp.secretKey), address: deriveAddress(new Uint8Array(kp.publicKey)) };
  }

  async function generateKeypairFromSeed(seedPhrase) {
    const enc = new TextEncoder();
    const normalized = seedPhrase.toLowerCase().trim();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(normalized), "PBKDF2", false, ["deriveBits"]);
    const seedBits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode("rstn-wallet-seed"), iterations: 100000, hash: "SHA-256" },
      baseKey, 256,
    );
    const seed = new Uint8Array(seedBits);
    const kp = self.rstnCrypto.ml_dsa65.keygen(seed);
    return { publicKey: new Uint8Array(kp.publicKey), secretKey: new Uint8Array(kp.secretKey), address: deriveAddress(new Uint8Array(kp.publicKey)), seedPhrase: normalized };
  }

  // ── Transaction signing (canonical encoding matches Rust node) ──
  function canonicalEncodeTx(tx) {
    const fromBytes = tx.from, toBytes = tx.to;
    const valueBytes = u128ToLeBytes(BigInt(tx.value));
    const nonceBytes = u64ToLeBytes(BigInt(tx.nonce));
    const gasPriceBytes = u128ToLeBytes(BigInt(tx.gas_price));
    const gasLimitBytes = u64ToLeBytes(BigInt(tx.gas_limit));
    const txTypeByte = TX_TYPE_TO_U8[tx.tx_type] ?? 0;
    const payloadBytes = tx.payload || new Uint8Array(0);
    const total = fromBytes.length + toBytes.length + 16 + 8 + 16 + 8 + 1 + payloadBytes.length;
    const buf = new Uint8Array(total);
    let off = 0;
    buf.set(fromBytes, off); off += fromBytes.length;
    buf.set(toBytes, off); off += toBytes.length;
    buf.set(valueBytes, off); off += 16;
    buf.set(nonceBytes, off); off += 8;
    buf.set(gasPriceBytes, off); off += 16;
    buf.set(gasLimitBytes, off); off += 8;
    buf[off] = txTypeByte; off += 1;
    buf.set(payloadBytes, off);
    return buf;
  }

  function hashTransaction(tx) { return self.rstnCrypto.keccak_512(canonicalEncodeTx(tx)); }

  async function signTransaction(tx, secretKey) {
    return new Uint8Array(self.rstnCrypto.ml_dsa65.sign(hashTransaction(tx), secretKey));
  }

  // ── RPC ──
  async function rpcCall(rpcUrl, method, params = []) {
    try {
      const resp = await fetch(rpcUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      });
      const json = await resp.json();
      if (json.error) { console.warn("[RSTN Wallet] RPC error:", method, json.error); return null; }
      return json.result;
    } catch (err) { console.warn("[RSTN Wallet] RPC error:", method, err); return null; }
  }

  async function getBalance(rpcUrl, address) {
    const result = await rpcCall(rpcUrl, "rstn_getBalance", [address]);
    if (!result) return { balance: "0.00", balanceUsd: "0.00", nonce: 0 };
    return { balance: result.balance || "0.00", balanceUsd: result.balanceUsd || "0.00", nonce: typeof result.nonce === "number" ? result.nonce : 0 };
  }

  async function getNonce(rpcUrl, address) {
    const result = await rpcCall(rpcUrl, "rstn_getNonce", [address]);
    if (result == null) return 0;
    return typeof result === "number" ? result : 0;
  }

  async function broadcastTx(rpcUrl, nodeTx) { return rpcCall(rpcUrl, "rstn_sendTransaction", [nodeTx]); }
  async function faucetClaim(rpcUrl, address) { return rpcCall(rpcUrl, "rstn_faucetClaim", [address]); }

  // ── Local transaction history ──
  async function recordTx(tx) {
    const { txHistory } = await chrome.storage.local.get("txHistory");
    const history = txHistory || [];
    if (tx.hash && history.some((h) => h.hash === tx.hash)) return;
    history.unshift(tx);
    if (history.length > 200) history.length = 200;
    await chrome.storage.local.set({ txHistory: history });
  }

  async function mergeTxs(rpcUrl, address) {
    const { txHistory } = await chrome.storage.local.get("txHistory");
    const local = (txHistory || []).filter((t) => t.address === address);
    const onchain = await rpcCall(rpcUrl, "rstn_getTransactionsByAddress", [address, 50]);
    const onchainTxs = (onchain || []).map((t) => ({
      hash: t.hash || t.tx_hash || "",
      type: t.to && t.to.toLowerCase() === address.toLowerCase() ? "in" : "out",
      amount: t.amount || t.value || "0",
      status: "confirmed",
      timestamp: t.timestamp || t.block_time || Date.now(),
      address, to: t.to || "", from: t.from || "",
    }));
    const seen = new Set();
    const merged = [];
    for (const t of [...local, ...onchainTxs]) {
      const key = t.hash || `${t.to}-${t.amount}-${t.timestamp}`;
      if (seen.has(key)) continue;
      seen.add(key); merged.push(t);
    }
    return merged.slice(0, 50);
  }

  // ── Utils ──
  function toHex(bytes) { return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""); }
  function hexToBytes(hex) {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
    return bytes;
  }
  function u128ToLeBytes(val) { const buf = new Uint8Array(16); let v = val; for (let i = 0; i < 16; i++) { buf[i] = Number(v & 0xffn); v >>= 8n; } return buf; }
  function u64ToLeBytes(val) { const buf = new Uint8Array(8); let v = val; for (let i = 0; i < 8; i++) { buf[i] = Number(v & 0xffn); v >>= 8n; } return buf; }
  function addressToBytes(addr) { return hexToBytes(addr.startsWith("rstn1") ? addr.slice(4) : addr); }

  function buildNodeTx(fromPubKey, toAddress, valueStr, nonce, gasPriceStr, gasLimit, txType, payloadBytes) {
    return {
      from: Array.from(fromPubKey), to: Array.from(addressToBytes(toAddress)),
      value: String(valueStr), nonce, gas_price: String(gasPriceStr), gas_limit: gasLimit,
      tx_type: txType, payload: Array.from(payloadBytes || []), signature: null,
    };
  }

  self.rstnWalletLib = {
    PK_BYTES, SK_BYTES, TX_TYPE_TO_U8,
    encryptVault, decryptVault, generateKeypair, generateKeypairFromSeed, deriveAddress,
    canonicalEncodeTx, hashTransaction, signTransaction,
    rpcCall, getBalance, getNonce, broadcastTx, faucetClaim,
    recordTx, mergeTxs,
    toHex, hexToBytes, buildNodeTx,
  };
})(self);
