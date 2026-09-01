import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  Lock,
  Flame,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  WifiOff,
} from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { RPC_MODE } from "@/lib/api";
import {
  getBridgeReserves,
  bridgeSubmitLock,
  bridgeSubmitBurn,
  bridgeGetWrappedBalance,
  bridgeGetOps,
  type BridgeReservesResponse,
  type BridgeOpsResponse,
  type WrappedBalance,
} from "@/lib/bridge-api";

const CHAIN_OPTIONS = [
  { value: "Bitcoin", label: "Bitcoin", symbol: "wBTC" },
  { value: "Ethereum", label: "Ethereum", symbol: "wETH" },
  { value: "Solana", label: "Solana", symbol: "wSOL" },
  { value: "BSC", label: "BSC", symbol: "wBNB" },
  { value: "Avalanche", label: "Avalanche", symbol: "wAVAX" },
];

export const BridgeLivePanel = () => {
  const [reserves, setReserves] = useState<BridgeReservesResponse | null>(null);
  const [ops, setOps] = useState<BridgeOpsResponse>({
    pending: [],
    completed: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Form state
  const [mode, setMode] = useState<"lock" | "burn">("lock");
  const [chain, setChain] = useState("Bitcoin");
  const [amount, setAmount] = useState("1000");
  const [sourceTxid, setSourceTxid] = useState("a1b2c3d4e5f6");
  const [userAddress, setUserAddress] = useState("");
  const [wrappedBalance, setWrappedBalance] = useState<WrappedBalance | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([getBridgeReserves(), bridgeGetOps(20)]);
      setReserves(r);
      setOps(o);
    } catch {
      // silent — mock fallback handles it
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  const checkWrappedBalance = useCallback(async () => {
    if (!userAddress) return;
    try {
      const b = await bridgeGetWrappedBalance({ chain, userAddress });
      setWrappedBalance(b);
    } catch {
      // silent
    }
  }, [chain, userAddress]);

  useEffect(() => {
    checkWrappedBalance();
  }, [checkWrappedBalance]);

  const handleSubmit = async () => {
    if (!userAddress) {
      setMessage({ type: "error", text: "Ingresa tu dirección RSTN" });
      return;
    }
    // Validate RSTN address format: "rstn1" + 40 hex chars (20 bytes)
    if (!/^rstn1[0-9a-fA-F]{40}$/.test(userAddress.trim())) {
      setMessage({
        type: "error",
        text: "Dirección inválida: debe ser rstn1 + 40 caracteres hex",
      });
      return;
    }
    // Amount is in the smallest unit (satoshis/wei) and MUST be a positive
    // integer. Reject decimals ("0.5") and non-numeric input so a user can't
    // accidentally submit 0 (#19).
    if (!/^\d+$/.test(amount.trim())) {
      setMessage({
        type: "error",
        text: "Cantidad inválida: debe ser un entero positivo (unidad mínima, ej. satoshis/wei)",
      });
      return;
    }
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) {
      setMessage({ type: "error", text: "Cantidad inválida" });
      return;
    }
    // Validate source txid is hex (lock mode only)
    if (
      mode === "lock" &&
      (!/^[0-9a-fA-F]+$/.test(sourceTxid.trim()) ||
        sourceTxid.trim().length === 0 ||
        sourceTxid.trim().length > 128)
    ) {
      setMessage({
        type: "error",
        text: "Source TxID inválido: debe ser hexadecimal (máx 128 chars)",
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "lock") {
        const result = await bridgeSubmitLock({
          chain,
          sourceTxid,
          amount: amt,
          userAddress,
        });
        setMessage({
          type: result.status === "executed" ? "success" : "info",
          text: `Lock ${result.status}: ${amt} ${result.wrappedSymbol} minted a ${userAddress.slice(0, 12)}... (op: ${result.opId.slice(0, 18)}...)`,
        });
      } else {
        const result = await bridgeSubmitBurn({
          chain,
          amount: amt,
          userAddress,
        });
        setMessage({
          type: result.status === "executed" ? "success" : "info",
          text: `Burn ${result.status}: ${amt} ${result.wrappedSymbol} quemados (op: ${result.opId.slice(0, 18)}...)`,
        });
      }
      await refresh();
      await checkWrappedBalance();
    } catch (e) {
      setMessage({
        type: "error",
        text: `Error: ${e instanceof Error ? e.message : "desconocido"}`,
      });
    }
    setBusy(false);
  };

  const currentSymbol =
    CHAIN_OPTIONS.find((c) => c.value === chain)?.symbol || "wBTC";

  return (
    <Panel
      title="Bridge Live — Lock & Mint / Burn & Release"
      description="Operaciones reales contra el nodo RSTN. En testnet, el validador auto-firma y auto-ejecuta (threshold 1). En mainnet, 2/3+ validadores deben firmar."
    >
      {/* Live vs Mock indicator (#18) -- make the data source visible */}
      {!RPC_MODE && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2">
          <WifiOff className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-[10px] text-amber-400">
            MOCK DATA — no hay nodo RSTN conectado. Inicia el nodo
            (./scripts/local-testnet.sh up) y recarga para datos reales.
          </span>
        </div>
      )}

      {/* Status bar */}
      {reserves && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5"
            style={{ background: "hsl(150 14% 9%)" }}
          >
            {reserves.paused ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span className="font-mono text-[10px] text-red-400">
                  PAUSED
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[10px] text-primary">
                  ACTIVE
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="label-muted text-[10px]">Pending:</span>
            <span className="font-mono text-[10px] text-foreground">
              {reserves.pending_ops}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="label-muted text-[10px]">Completed:</span>
            <span className="font-mono text-[10px] text-foreground">
              {reserves.completed_ops}
            </span>
          </div>
          <button
            onClick={refresh}
            className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-surface-2"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Reserves table */}
      {reserves && (
        <div className="mb-5 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 font-mono text-[10px] text-muted-foreground">
                  Chain
                </th>
                <th className="pb-2 font-mono text-[10px] text-muted-foreground">
                  Locked
                </th>
                <th className="pb-2 font-mono text-[10px] text-muted-foreground">
                  Minted
                </th>
                <th className="pb-2 font-mono text-[10px] text-muted-foreground">
                  Burned
                </th>
                <th className="pb-2 font-mono text-[10px] text-muted-foreground">
                  Circulating
                </th>
              </tr>
            </thead>
            <tbody>
              {reserves.reserves.map((r) => (
                <tr key={r.chain} className="border-b border-border/50">
                  <td className="py-2 font-mono text-[11px] font-semibold text-foreground">
                    {r.chain}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-foreground">
                    {r.locked}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-foreground">
                    {r.minted}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-foreground">
                    {r.burned}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-primary">
                    {r.circulating}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Operation form */}
      <div
        className="rounded-md border border-border p-4"
        style={{ background: "hsl(150 14% 9%)" }}
      >
        {/* Mode toggle */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setMode("lock")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${
              mode === "lock"
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-surface-2"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            Lock & Mint
          </button>
          <button
            onClick={() => setMode("burn")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${
              mode === "burn"
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-surface-2"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Burn & Release
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label-muted mb-1 block text-[10px]">
              Source Chain
            </label>
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground"
            >
              {CHAIN_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-muted mb-1 block text-[10px]">
              Amount (smallest unit)
            </label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground"
            />
          </div>
          {mode === "lock" && (
            <div>
              <label className="label-muted mb-1 block text-[10px]">
                Source TxID (hex)
              </label>
              <input
                type="text"
                value={sourceTxid}
                onChange={(e) => setSourceTxid(e.target.value)}
                placeholder="a1b2c3d4e5f6"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground"
              />
            </div>
          )}
          <div>
            <label className="label-muted mb-1 block text-[10px]">
              RSTN Address
            </label>
            <input
              type="text"
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              placeholder="rstn1..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground"
            />
          </div>
        </div>

        {/* Wrapped balance display */}
        {wrappedBalance && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/[0.06] px-3 py-2">
            <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[11px] text-foreground">
              Tu balance {wrappedBalance.symbol}:{" "}
              <span className="font-bold text-primary">
                {wrappedBalance.balance}
              </span>
            </span>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 font-mono text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : mode === "lock" ? (
            <>
              <Lock className="h-4 w-4" />
              Lock & Mint {amount} {currentSymbol}
            </>
          ) : (
            <>
              <Flame className="h-4 w-4" />
              Burn & Release {amount} {currentSymbol}
            </>
          )}
        </button>

        {/* Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 ${
              message.type === "success"
                ? "border-primary/20 bg-primary/[0.06]"
                : message.type === "error"
                  ? "border-red-500/20 bg-red-500/[0.06]"
                  : "border-border bg-surface-2"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            ) : message.type === "error" ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
            ) : (
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="font-mono text-[10px] leading-relaxed text-foreground">
              {message.text}
            </span>
          </motion.div>
        )}
      </div>

      {/* Operation history */}
      {(ops.pending.length > 0 || ops.completed.length > 0) && (
        <div className="mt-5">
          <h4 className="mb-2 font-display text-xs font-semibold text-foreground">
            Historial de operaciones
          </h4>
          <div className="space-y-1.5">
            {ops.completed.slice(0, 10).map((op, i) => (
              <motion.div
                key={op.opId}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-1.5"
                style={{ background: "hsl(150 14% 9%)" }}
              >
                <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {op.direction}
                </span>
                <span className="font-mono text-[10px] text-foreground">
                  {op.amount}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {op.chain}
                </span>
                <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                  #{op.height}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
};
