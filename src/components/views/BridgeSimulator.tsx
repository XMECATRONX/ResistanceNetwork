import { useState, useEffect, useRef } from "react";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bitcoin,
  Coins,
  Shield,
  Clock,
  CheckCircle2,
  ArrowRight,
  Flame,
  Lock,
  Eye,
  Vote,
  Sparkles,
  RotateCcw,
  Zap,
} from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";

type ChainId = "BTC" | "ETH";

interface Step {
  id: number;
  label: string;
  icon: typeof Bitcoin;
  detail: string;
  duration: number; // ms
}

const CHAIN_CONFIG: Record<
  ChainId,
  {
    name: string;
    icon: typeof Bitcoin;
    color: string;
    model: string;
    finalityLabel: string;
    finalityMs: number;
    steps: Step[];
  }
> = {
  BTC: {
    name: "Bitcoin",
    icon: Bitcoin,
    color: "hsl(150 70% 50%)",
    model: "Lock-and-Mint (threshold ECDSA 51-de-100 + SPV)",
    finalityLabel: "6 confirmaciones (~60 min en mainnet)",
    finalityMs: 3000,
    steps: [
      {
        id: 1,
        label: "Transferir BTC al vault P2WSH",
        icon: Lock,
        detail:
          "El usuario envía BTC a la dirección del comité de firmantes (threshold ECDSA 51-de-100). Solo quien controla la clave ECDSA puede firmar esta transferencia — es la prueba de posesión.",
        duration: 2200,
      },
      {
        id: 2,
        label: "Esperar finality (6 confirmaciones)",
        icon: Clock,
        detail:
          "Los validadores RSTN esperan 6 confirmaciones de Bitcoin (~60 min en mainnet). Sin finality, no hay emisión — previene reorgs.",
        duration: 2800,
      },
      {
        id: 3,
        label: "SPV light client verifica",
        icon: Eye,
        detail:
          "El SPV light client embebido verifica el header del bloque + prueba Merkle de inclusión. No confía en el comité — confía en la proof-of-work de Bitcoin.",
        duration: 2400,
      },
      {
        id: 4,
        label: "Validadores verifican + votan",
        icon: Vote,
        detail:
          "Los validadores RSTN (4,128+) verifican la prueba SPV y votan con firmas Dilithium3. Supermajority BFT (2/3+) confirma la transferencia.",
        duration: 2200,
      },
      {
        id: 5,
        label: "Mint wBTC 1:1 respaldado",
        icon: Sparkles,
        detail:
          "RSTN emite wBTC a una dirección Dilithium3 del usuario. Respaldado 1:1 por el BTC bloqueado en el vault. La clave ECDSA original ya no controla ese BTC — aunque un QC la rompa, no hay nada que robar.",
        duration: 2000,
      },
    ],
  },
  ETH: {
    name: "Ethereum",
    icon: Coins,
    color: "hsl(150 100% 45%)",
    model: "Lock nativo + Burn ERC-20",
    finalityLabel: "Finality epoch (~12 min en mainnet)",
    finalityMs: 2500,
    steps: [
      {
        id: 1,
        label: "Lock ETH / Burn ERC-20",
        icon: Flame,
        detail:
          "ETH nativo: el usuario bloquea su ETH en un contrato de lock verificable (no se quema — ETH nativo no tiene función burn). ERC-20s (USDC, USDT): el usuario quema los tokens con burn() en el contrato origen. Solo quien controla la clave puede autorizarlo.",
        duration: 2200,
      },
      {
        id: 2,
        label: "Esperar finality epoch",
        icon: Clock,
        detail:
          "Los validadores esperan el finality epoch de Ethereum (~12 min en mainnet). Finality determinista — sin reorgs posibles después de este punto.",
        duration: 2500,
      },
      {
        id: 3,
        label: "Sync committee light client",
        icon: Eye,
        detail:
          "El light client de Ethereum (sync committee, Altair upgrade) verifica el header + prueba de inclusión del lock/burn. Verificación on-chain, sin custodio.",
        duration: 2400,
      },
      {
        id: 4,
        label: "Validadores verifican + votan",
        icon: Vote,
        detail:
          "Los validadores RSTN verifican la prueba del light client y votan con firmas Dilithium3. Supermajority BFT (2/3+) confirma el lock/burn.",
        duration: 2200,
      },
      {
        id: 5,
        label: "Mint wETH 1:1 respaldado",
        icon: Sparkles,
        detail:
          "RSTN emite wETH a una dirección Dilithium3 del usuario. Respaldado 1:1 por el ETH bloqueado o los tokens quemados. Sin transferencia verificada, no hay emisión.",
        duration: 2000,
      },
    ],
  },
};

export const BridgeSimulator = () => {
  const [chain, setChain] = useState<ChainId>("BTC");
  const [amount, setAmount] = useState("1.0");
  const [activeStep, setActiveStep] = useState(-1); // -1 = idle, 0..4 = running, 5 = done
  const [isRunning, setIsRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const config = CHAIN_CONFIG[chain];

  // Clear all timers on unmount or reset
  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const reset = () => {
    clearTimers();
    setActiveStep(-1);
    setIsRunning(false);
    setLog([]);
  };

  const start = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    reset();
    setIsRunning(true);
    setActiveStep(0);
    const amt = parseFloat(amount);
    setLog([
      `[${new Date().toLocaleTimeString()}] Iniciando puente: ${amt} ${chain} → RSTN`,
      `[${new Date().toLocaleTimeString()}] Modelo: ${config.model}`,
    ]);

    let elapsed = 0;
    config.steps.forEach((step, idx) => {
      // Start step
      const startTimer = setTimeout(() => {
        setActiveStep(idx);
        setLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Paso ${step.id}: ${step.label}...`,
        ]);
      }, elapsed);
      timersRef.current.push(startTimer);

      elapsed += step.duration;

      // Complete step
      const completeTimer = setTimeout(() => {
        setLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✓ ${step.label} — completado`,
        ]);
        if (idx === config.steps.length - 1) {
          setActiveStep(5); // done
          setIsRunning(false);
          setLog((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] ✅ Puente completado: ${amt} ${chain} → ${amt} w${chain} en RSTN`,
            `[${new Date().toLocaleTimeString()}] Dirección destino: clave Dilithium3 (resistente a cuántica)`,
            `[${new Date().toLocaleTimeString()}] Respaldado 1:1 — Proof of Reserves auditable on-chain`,
          ]);
        }
      }, elapsed);
      timersRef.current.push(completeTimer);

      elapsed += 200; // small gap between steps
    });
  };

  const switchChain = (newChain: ChainId) => {
    if (isRunning) return;
    setChain(newChain);
    reset();
  };

  return (
    <Panel
      title="Simulador de Puente Cross-Chain"
      description="Ejecuta el flujo real paso a paso: transferencia/lock/burn → finality → verificación vía light client → mint. Así funciona el puente en mainnet."
    >
      {/* Controls */}
      <div className="space-y-4">
        {/* Chain selector */}
        <div className="flex items-center gap-2">
          <span className="label-muted text-[10px] shrink-0">
            Chain origen:
          </span>
          <div className="flex gap-2">
            {(Object.keys(CHAIN_CONFIG) as ChainId[]).map((id) => {
              const cfg = CHAIN_CONFIG[id];
              const Icon = cfg.icon;
              const isActive = chain === id;
              return (
                <button
                  key={id}
                  onClick={() => switchChain(id)}
                  disabled={isRunning}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs font-semibold transition-all ${
                    isActive
                      ? "border-transparent text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/20"
                  } ${isRunning ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  style={
                    isActive
                      ? {
                          background: `${cfg.color}15`,
                          border: `1px solid ${cfg.color}40`,
                        }
                      : {}
                  }
                >
                  <Icon
                    className="h-4 w-4"
                    style={{ color: isActive ? cfg.color : undefined }}
                    strokeWidth={1.5}
                  />
                  {cfg.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount input + action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label-muted text-[10px]">Cantidad a cruzar</label>
            <div
              className="mt-1 flex items-center gap-2 rounded-md border border-border px-3 py-2"
              style={{ background: "hsl(150 14% 9%)" }}
            >
              <input
                type="number"
                value={amount}
                onChange={(e) => !isRunning && setAmount(e.target.value)}
                disabled={isRunning}
                className="w-full bg-transparent font-mono text-sm text-foreground outline-none disabled:opacity-50"
                placeholder="1.0"
                min="0"
                step="0.1"
              />
              <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                {chain}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={start}
              disabled={isRunning || !amount || parseFloat(amount) <= 0}
              className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 font-mono text-xs font-semibold text-primary transition-all hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
              {isRunning ? "Ejecutando..." : "Iniciar puente"}
            </button>
            <button
              onClick={reset}
              disabled={isRunning}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 font-mono text-xs text-muted-foreground transition-all hover:border-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Flow summary */}
        <div
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <span className="font-mono text-[10px] text-muted-foreground">
            Flujo:
          </span>
          <span
            className="font-mono text-[10px] font-semibold"
            style={{ color: config.color }}
          >
            {config.model}
          </span>
        </div>
      </div>

      {/* Step flow visualization */}
      <div className="mt-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          {config.steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            const isDone = activeStep > idx || activeStep === 5;
            const isPending = activeStep < idx && activeStep !== -1;
            const isIdle = activeStep === -1;

            return (
              <div key={step.id} className="flex flex-1 flex-col">
                {/* Step card */}
                <motion.div
                  initial={{ opacity: 0.4 }}
                  animate={{
                    opacity: isIdle ? 0.4 : isActive ? 1 : isDone ? 0.85 : 0.5,
                    scale: isActive ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className="relative flex flex-col gap-2 rounded-lg border p-3"
                  style={{
                    borderColor: isActive
                      ? config.color
                      : isDone
                        ? `${config.color}40`
                        : "hsl(150 14% 20%)",
                    background: isActive
                      ? `${config.color}08`
                      : "hsl(150 14% 9%)",
                  }}
                >
                  {/* Step number + icon */}
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-all"
                      style={{
                        background: isDone
                          ? `${config.color}20`
                          : isActive
                            ? `${config.color}30`
                            : "hsl(150 14% 14%)",
                        color:
                          isDone || isActive
                            ? config.color
                            : "hsl(150 14% 50%)",
                        border: `1px solid ${isDone || isActive ? `${config.color}50` : "hsl(150 14% 20%)"}`,
                      }}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        step.id
                      )}
                    </div>
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{
                        color:
                          isActive || isDone
                            ? config.color
                            : "hsl(150 14% 40%)",
                      }}
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Label */}
                  <p
                    className="font-display text-[11px] font-semibold leading-tight"
                    style={{
                      color:
                        isActive || isDone
                          ? "hsl(0 0% 90%)"
                          : "hsl(150 14% 55%)",
                    }}
                  >
                    {step.label}
                  </p>

                  {/* Active pulse */}
                  {isActive && (
                    <motion.div
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full"
                      style={{ background: config.color }}
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}

                  {/* Progress bar (when active) */}
                  {isActive && (
                    <motion.div
                      className="absolute bottom-0 left-0 h-0.5 rounded-full"
                      style={{ background: config.color }}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{
                        duration: step.duration / 1000,
                        ease: "linear",
                      }}
                    />
                  )}
                </motion.div>

                {/* Arrow between steps */}
                {idx < config.steps.length - 1 && (
                  <div className="flex items-center justify-center py-1 lg:py-0 lg:px-0 lg:flex-1 lg:self-center">
                    <ArrowRight
                      className="h-4 w-4"
                      style={{
                        color: isDone ? config.color : "hsl(150 14% 25%)",
                      }}
                      strokeWidth={1.5}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Active step detail */}
        <AnimatePresence mode="wait">
          {activeStep >= 0 && activeStep < 5 && (
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 rounded-md border p-4"
              style={{
                borderColor: `${config.color}30`,
                background: `${config.color}06`,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${config.color}20` }}
                >
                  {(() => {
                    const Icon = config.steps[activeStep].icon;
                    return (
                      <Icon
                        className="h-4 w-4"
                        style={{ color: config.color }}
                        strokeWidth={1.5}
                      />
                    );
                  })()}
                </div>
                <div>
                  <h4 className="font-display text-xs font-semibold text-foreground">
                    Paso {config.steps[activeStep].id}:{" "}
                    {config.steps[activeStep].label}
                  </h4>
                  <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
                    {config.steps[activeStep].detail}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completion banner */}
        <AnimatePresence>
          {activeStep === 5 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 flex items-center gap-3 rounded-md border p-4"
              style={{
                borderColor: "hsl(150 100% 45% / 0.3)",
                background: "hsl(150 100% 45% / 0.06)",
              }}
            >
              <CheckCircle2
                className="h-6 w-6 shrink-0 text-primary"
                strokeWidth={1.5}
              />
              <div>
                <h4 className="font-display text-sm font-semibold text-primary">
                  Puente completado
                </h4>
                <p className="mt-1 font-mono text-xs text-foreground">
                  {amount} {chain} → {amount} w{chain} en RSTN
                </p>
                <p className="mt-1 font-body text-[11px] text-muted-foreground">
                  Respaldado 1:1 · Dirección Dilithium3 · Proof of Reserves
                  auditable on-chain
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transaction log */}
      {log.length > 0 && (
        <div className="mt-4">
          <h4 className="font-display text-xs font-semibold text-foreground mb-2">
            Log de transacción
          </h4>
          <div
            className="max-h-40 overflow-y-auto rounded-md border border-border p-3 font-mono text-[10px] leading-relaxed"
            style={{ background: "hsl(150 14% 6%)" }}
          >
            {log.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={
                  line.includes("✅")
                    ? "text-primary font-semibold"
                    : line.includes("✓")
                      ? "text-accent"
                      : "text-muted-foreground"
                }
              >
                {line}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Security badges */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <Shield className="h-3 w-3 text-primary" strokeWidth={1.5} />
          <span className="font-mono text-[9px] text-muted-foreground">
            Firmas Dilithium3
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <Eye className="h-3 w-3 text-accent" strokeWidth={1.5} />
          <span className="font-mono text-[9px] text-muted-foreground">
            Light client on-chain
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <Vote className="h-3 w-3 text-violet" strokeWidth={1.5} />
          <span className="font-mono text-[9px] text-muted-foreground">
            BFT supermajority 2/3+
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <CheckCircle2 className="h-3 w-3 text-primary" strokeWidth={1.5} />
          <span className="font-mono text-[9px] text-muted-foreground">
            Respaldo 1:1 verificable
          </span>
        </div>
      </div>
    </Panel>
  );
};
