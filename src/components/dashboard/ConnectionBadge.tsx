/**
 * ConnectionBadge — Shows whether the frontend is running on
 * mock data or connected to a live rstn-node RPC.
 *
 * When RPC_MODE flips to true and the node is reachable,
 * the badge turns green. Otherwise it shows "Mock Data".
 *
 * Includes a clickable popover to change the RPC endpoint at runtime
 * (stored in localStorage) and re-run auto-detection.
 */

import { useEffect, useState } from "react";
import {
  RPC_MODE,
  checkRpcConnection,
  getRpcEndpoint,
  setRpcEndpoint,
  autoDetectRpc,
} from "@/lib/api";
import { motion } from "framer-motion";

export const ConnectionBadge = () => {
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState(getRpcEndpoint());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | "ok" | "fail">(null);

  useEffect(() => {
    setEndpoint(getRpcEndpoint());
  }, [open]);

  useEffect(() => {
    if (!RPC_MODE) return;
    let active = true;
    const check = async () => {
      const ok = await checkRpcConnection();
      if (active) setConnected(ok);
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const isLive = RPC_MODE && connected;
  const label = isLive ? "RPC Live" : "Mock Data";
  const color = isLive ? "hsl(150 100% 45%)" : "hsl(150 70% 50%)";

  const handleSave = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await setRpcEndpoint(endpoint.trim());
    setTesting(false);
    setTestResult(ok ? "ok" : "fail");
    if (ok) {
      // Re-check connection state for the badge
      const live = await checkRpcConnection();
      setConnected(live);
      setTimeout(() => setOpen(false), 800);
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] font-medium transition-opacity hover:opacity-80"
        style={{
          borderColor: color.replace(")", " / 0.3)"),
          background: color.replace(")", " / 0.06)"),
          color,
        }}
        aria-label="RPC connection status — click to configure"
      >
        <motion.span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        {label}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-surface-2 p-4 shadow-xl"
          role="dialog"
          aria-label="Configure RPC endpoint"
        >
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            RPC Endpoint
          </div>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="http://localhost:8545"
            className="w-full rounded-md border border-border bg-surface-1 px-2.5 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={testing}
              className="rounded-md bg-primary px-3 py-1.5 font-body text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {testing ? "Testing…" : "Save & Connect"}
            </button>
            <button
              type="button"
              onClick={async () => {
                setEndpoint("http://localhost:8545");
                await autoDetectRpc();
                const live = await checkRpcConnection();
                setConnected(live);
                setTestResult(live ? "ok" : "fail");
              }}
              className="rounded-md border border-border bg-surface-1 px-3 py-1.5 font-body text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              Reset
            </button>
          </div>
          {testResult === "ok" && (
            <p className="mt-2 font-mono text-[10px] text-[hsl(150_100%_45%)]">
              ✓ Connected to live node
            </p>
          )}
          {testResult === "fail" && (
            <p className="mt-2 font-mono text-[10px] text-[hsl(0 84% 60%)]">
              ✗ Node unreachable — check it's running and CORS is enabled
            </p>
          )}
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-muted-foreground">
            Start the node:{" "}
            <code className="text-foreground">
              cargo run --release -- --dev --port 8545
            </code>
          </p>
        </div>
      )}
    </div>
  );
};
