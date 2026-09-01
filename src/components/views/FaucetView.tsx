import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplet,
  Wallet,
  Check,
  AlertCircle,
  Loader2,
  Clock,
  Copy,
  ExternalLink,
  Zap,
} from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { api, RPC_MODE } from "@/lib/api";

// ─── Faucet Config ──────────────────────────────────────────
const CLAIM_AMOUNT = 1000; // RSTN per claim
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h
const STORAGE_KEY = "rstn_faucet_last_claim";

interface ClaimHistory {
  hash: string;
  amount: number;
  timestamp: number;
  address: string;
}

export const FaucetView = () => {
  const wallet = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [lastClaim, setLastClaim] = useState<number | null>(null);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Load last claim from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setLastClaim(data.timestamp || null);
        setHistory(data.history || []);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Persist claim data
  const persistClaim = useCallback(
    (timestamp: number, newHistory: ClaimHistory[]) => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ timestamp, history: newHistory }),
      );
    },
    [],
  );

  // Cooldown remaining
  const cooldownRemaining = lastClaim
    ? Math.max(0, COOLDOWN_MS - (Date.now() - lastClaim))
    : 0;
  const canClaim =
    wallet.status === "connected" && cooldownRemaining === 0 && !claiming;

  // Format cooldown
  const formatCooldown = (ms: number) => {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  // Claim RSTN
  const handleClaim = async () => {
    if (!wallet.address || !canClaim) return;

    setClaiming(true);
    setMessage(null);

    try {
      // In RPC mode, the faucet endpoint credits the account directly
      // In mock mode, simulate the claim
      const result = RPC_MODE
        ? await api.faucetClaim(wallet.address)
        : await new Promise<{ hash: string; amount: number }>((resolve) => {
            setTimeout(
              () =>
                resolve({
                  hash:
                    "0x" +
                    Math.random().toString(16).slice(2, 18).padStart(16, "0"),
                  amount: CLAIM_AMOUNT,
                }),
              1500,
            );
          });

      const newClaim: ClaimHistory = {
        hash: result.hash,
        amount: result.amount,
        timestamp: Date.now(),
        address: wallet.address,
      };

      const newHistory = [newClaim, ...history].slice(0, 10);
      setHistory(newHistory);
      setLastClaim(Date.now());
      persistClaim(Date.now(), newHistory);

      // Trigger balance refresh on connected wallet
      wallet.refreshBalance();

      setMessage({
        type: "success",
        text: `${CLAIM_AMOUNT.toLocaleString()} RSTN reclamados exitosamente. Tu balance se ha actualizado en la red.`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Error al reclamar. Intenta de nuevo.",
      });
    } finally {
      setClaiming(false);
    }
  };

  // Copy address
  const copyAddress = () => {
    if (!wallet.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Disclaimer ── */}
      <div
        className="flex items-center gap-3 rounded-lg border border-border p-4"
        style={{ background: "hsl(150 70% 50% / 0.04)" }}
      >
        <span
          className="dot"
          style={{
            background: "hsl(150 70% 50%)",
            boxShadow: "0 0 6px hsl(150 70% 50% / 0.40)",
          }}
        />
        <p className="font-body text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold" style={{ color: "hsl(150 70% 50%)" }}>
            Testnet Faucet —{" "}
          </span>
          {RPC_MODE
            ? "Conectado a rstn-node. Los RSTN reclamados son tokens de testnet sin valor real."
            : "Modo demostración. Cuando la testnet esté activa, aquí podrás reclamar RSTN de testnet reales para desarrollo y testing."}
        </p>
      </div>

      {/* ── Faucet Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card-sig p-8"
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: "hsl(150 100% 45% / 0.12)",
              border: "1px solid hsl(150 100% 45% / 0.25)",
            }}
          >
            <Droplet
              className="h-8 w-8"
              style={{ color: "hsl(150 100% 45%)" }}
              strokeWidth={1.5}
            />
          </motion.div>

          <h2 className="mt-4 font-display text-2xl font-bold text-foreground">
            RSTN Testnet Faucet
          </h2>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Reclama{" "}
            <span
              className="font-mono font-semibold"
              style={{ color: "hsl(150 100% 45%)" }}
            >
              {CLAIM_AMOUNT.toLocaleString()} RSTN
            </span>{" "}
            de testnet gratis
          </p>
        </div>

        {/* Wallet Status */}
        <div className="mt-8">
          {wallet.status !== "connected" ? (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={wallet.connect}
              disabled={wallet.status === "connecting"}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-body text-sm font-semibold transition-all"
              style={{
                background: "hsl(150 100% 45%)",
                color: "hsl(150 50% 10%)",
                boxShadow: "0 4px 20px hsl(150 100% 45% / 0.25)",
              }}
            >
              {wallet.status === "connecting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Conectando...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" strokeWidth={2} /> Conectar Wallet
                  RSTN
                </>
              )}
            </motion.button>
          ) : (
            <div className="space-y-4">
              {/* Connected address */}
              <div
                className="flex items-center justify-between rounded-xl p-4"
                style={{
                  background: "hsl(150 14% 12%)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: "hsl(150 100% 45% / 0.12)" }}
                  >
                    <Wallet
                      className="h-4 w-4"
                      style={{ color: "hsl(150 100% 45%)" }}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <p className="label-muted text-[9px]">Wallet conectada</p>
                    <p className="font-mono text-xs font-medium text-foreground">
                      {wallet.address?.slice(0, 12)}...
                      {wallet.address?.slice(-8)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={copyAddress}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                  style={{ background: "hsl(150 14% 10%)" }}
                >
                  {copied ? (
                    <Check
                      className="h-3.5 w-3.5"
                      style={{ color: "hsl(150 100% 45%)" }}
                    />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* Balance preview */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "hsl(150 14% 12%)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p className="label-muted text-[9px]">Balance actual</p>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">
                    {parseFloat(
                      wallet.balance.replace(/,/g, ""),
                    ).toLocaleString()}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    RSTN
                  </p>
                </div>
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "hsl(150 100% 45% / 0.06)",
                    border: "1px solid hsl(150 100% 45% / 0.20)",
                  }}
                >
                  <p className="label-muted text-[9px]">Reclamar ahora</p>
                  <p
                    className="mt-1 font-mono text-lg font-bold"
                    style={{ color: "hsl(150 100% 45%)" }}
                  >
                    +{CLAIM_AMOUNT.toLocaleString()}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    RSTN de testnet
                  </p>
                </div>
              </div>

              {/* Claim button or cooldown */}
              {canClaim ? (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleClaim}
                  disabled={claiming}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-body text-sm font-bold transition-all disabled:opacity-50"
                  style={{
                    background: "hsl(150 100% 45%)",
                    color: "hsl(150 60% 4%)",
                    boxShadow: "0 4px 20px hsl(150 100% 45% / 0.35)",
                  }}
                >
                  {claiming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Firmando
                      transacción Dilithium3...
                    </>
                  ) : (
                    <>
                      <Droplet className="h-4 w-4" strokeWidth={2} /> Reclamar{" "}
                      {CLAIM_AMOUNT.toLocaleString()} RSTN
                    </>
                  )}
                </motion.button>
              ) : (
                <div
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-body text-sm"
                  style={{
                    background: "hsl(150 14% 12%)",
                    border: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  <Clock className="h-4 w-4" />
                  {claiming
                    ? "Procesando..."
                    : `Próximo reclamo en ${formatCooldown(cooldownRemaining)}`}
                </div>
              )}

              {/* Disconnect */}
              <button
                onClick={wallet.disconnect}
                className="w-full font-body text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Desconectar wallet
              </button>
            </div>
          )}
        </div>

        {/* Message */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 flex items-start gap-2 rounded-lg p-3"
              style={{
                background:
                  message.type === "success"
                    ? "hsl(150 100% 45% / 0.06)"
                    : "hsl(5 80% 55% / 0.06)",
                border: `1px solid ${message.type === "success" ? "hsl(150 100% 45% / 0.25)" : "hsl(5 80% 55% / 0.25)"}`,
              }}
            >
              {message.type === "success" ? (
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: "hsl(150 100% 45%)" }}
                />
              ) : (
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: "hsl(5 80% 55%)" }}
                />
              )}
              <p
                className="font-body text-xs leading-relaxed"
                style={{
                  color:
                    message.type === "success"
                      ? "hsl(150 100% 45%)"
                      : "hsl(5 80% 55%)",
                }}
              >
                {message.text}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Info Grid ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Droplet,
            label: "Por reclamo",
            value: `${CLAIM_AMOUNT.toLocaleString()} RSTN`,
            color: "hsl(150 100% 45%)",
          },
          {
            icon: Clock,
            label: "Cooldown",
            value: "24 horas",
            color: "hsl(150 70% 50%)",
          },
          {
            icon: Zap,
            label: "Firma",
            value: "Dilithium3",
            color: "hsl(150 100% 45%)",
          },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
              className="card-sig p-4"
            >
              <div className="flex items-center gap-2">
                <Icon
                  className="h-4 w-4"
                  style={{ color: item.color }}
                  strokeWidth={1.5}
                />
                <span className="label-muted text-[9px]">{item.label}</span>
              </div>
              <p className="mt-2 font-mono text-sm font-bold text-foreground">
                {item.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* ── Claim History ── */}
      {history.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="card-sig p-5"
        >
          <h3 className="font-display text-sm font-semibold text-foreground">
            Historial de reclamos
          </h3>
          <div className="mt-4 space-y-2">
            {history.map((claim, i) => (
              <div
                key={claim.hash + i}
                className="flex items-center justify-between rounded-lg p-3"
                style={{
                  background: "hsl(150 14% 10%)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "hsl(150 100% 45% / 0.12)" }}
                  >
                    <Check
                      className="h-3.5 w-3.5"
                      style={{ color: "hsl(150 100% 45%)" }}
                    />
                  </div>
                  <div>
                    <p className="font-mono text-xs font-medium text-foreground">
                      +{claim.amount.toLocaleString()} RSTN
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {new Date(claim.timestamp).toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>
                <code className="font-mono text-[10px] text-muted-foreground">
                  {claim.hash.slice(0, 16)}...
                </code>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Technical note ── */}
      <div
        className="flex items-start gap-3 rounded-lg p-4"
        style={{
          background: "hsl(150 14% 10%)",
          border: "1px solid var(--border)",
        }}
      >
        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-body text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              ¿Cómo funciona?
            </span>{" "}
            Al reclamar, tu wallet firma una transacción con Dilithium3
            (ML-DSA-65, FIPS 204). El nodo RSTN verifica la firma post-cuántica
            y acredita los RSTN a tu cuenta. La firma es resistente a
            computadoras cuánticas — incluso un atacante con un ordenador
            cuántico no puede falsificar tu reclamo.
          </p>
        </div>
      </div>
    </div>
  );
};
