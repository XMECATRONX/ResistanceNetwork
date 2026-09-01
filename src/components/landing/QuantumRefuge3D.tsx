import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { CHAINS, OTHER_VULNERABLE, CYCLE_MS, PHASE_MS } from "./refugeData";

/**
 * Quantum Refuge 3D Animation
 *
 * Visualizes the Quantum Migration Program flow:
 *
 *  [BTC][ETH][SOL][ADA][DOT][NEAR] → VAULT (lock/burn + SPV) → RSTN (Dilithium3 shield)
 *
 * - Left: 6 vulnerable chains (rotating) with red quantum threat waves
 * - Center: Vault that locks/burns the original asset and verifies via SPV light client
 * - Right: RSTN shield (green) — the quantum refuge, Dilithium3 signatures
 * - Particles flow left → right, changing from red (vulnerable) to green (secure)
 * - Bottom: badge grid showing ALL vulnerable chains (not just the 6 animated)
 *
 * The cycle repeats ~9s (3 phases × 3s, cycling through 6 chains).
 */

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
};

const SECURE_GREEN = "hsl(150 100% 45%)";
const VAULT_GREEN = "hsl(150 70% 50%)";
const THREAT_RED = "hsl(0 80% 55%)";

export const QuantumRefuge3D = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [phase, setPhase] = useState(0); // 0=vulnerable, 1=vault, 2=secure
  const [chainIndex, setChainIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => {
        const next = (prev + 1) % 3;
        // Advance the active chain at the start of each full cycle (phase wraps to 0)
        if (next === 0) setChainIndex((c) => (c + 1) % CHAINS.length);
        return next;
      });
    }, PHASE_MS);
    return () => clearInterval(interval);
  }, []);

  const activeChain = CHAINS[chainIndex];

  return (
    <div className="mt-10 sm:mt-16">
      <div className="relative mx-auto max-w-5xl px-2 sm:px-4">
        {/* ── Main flow layout ── */}
        <div
          className="relative flex flex-col items-center gap-8 sm:gap-4 lg:grid lg:items-center"
          style={{ gridTemplateColumns: isMobile ? undefined : "1fr auto 1fr" }}
        >
          {/* ════════ LEFT: Vulnerable chains ════════ */}
          <div className="relative">
            <div className="mb-4 text-center">
              <span className="font-mono text-[10px] font-bold tracking-wider text-destructive uppercase">
                {t("animations.refuge.vulnerableChains")}
              </span>
              <p className="mt-1 font-mono text-[8px] sm:text-[9px] text-muted-foreground">
                {t("animations.refuge.breakableByShor")}
              </p>
            </div>

            {/* Quantum threat waves — pulsing red rings */}
            <div className="relative flex flex-wrap items-center justify-center gap-2 py-4 sm:gap-2.5">
              {CHAINS.map((chain) => {
                const isActive = activeChain.id === chain.id && phase === 0;
                return (
                  <motion.div
                    key={chain.id}
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl border bg-surface-1 sm:h-14 sm:w-14"
                    animate={{
                      borderColor: isActive ? THREAT_RED : "hsl(150 14% 18%)",
                      scale: isActive ? 1.15 : 1,
                    }}
                    transition={{ duration: 0.4 }}
                    style={{
                      borderColor: isActive ? THREAT_RED : "hsl(150 14% 18%)",
                    }}
                  >
                    <span
                      className="font-mono text-xs font-bold transition-colors duration-300"
                      style={{
                        color: isActive ? chain.color : "hsl(150 8% 45%)",
                      }}
                    >
                      {chain.label}
                    </span>

                    {/* Quantum threat pulse ring */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-xl"
                        style={{ border: `1.5px solid ${THREAT_RED}` }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          ease: "easeOut",
                        }}
                      />
                    )}

                    {/* Chain label below */}
                    <span
                      className="absolute -bottom-5 font-mono text-[8px] font-bold transition-colors duration-300"
                      style={{
                        color: isActive ? chain.color : "hsl(150 8% 40%)",
                      }}
                    >
                      {chain.sig}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Threat description */}
            <motion.div
              key={activeChain.id + phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 sm:mt-6 rounded-lg border px-3 py-2 sm:px-4 sm:py-2.5 text-center"
              style={{
                borderColor: "hsl(0 80% 55% / 0.25)",
                background: "hsl(0 80% 50% / 0.05)",
              }}
            >
              <p className="font-mono text-[10px] text-muted-foreground">
                {t("animations.refuge.chainUsesSig", {
                  chain: activeChain.label,
                  sig: activeChain.sig,
                })}
              </p>
              <p className="mt-0.5 font-body text-[9px] sm:text-[10px] text-destructive">
                {t("animations.refuge.quantumThreat")}
              </p>
            </motion.div>
          </div>

          {/* ════════ CENTER: Vault (flow arrows + vault box) ════════ */}
          {isMobile ? (
            <div className="flex flex-row items-center justify-center gap-4 py-4">
              <motion.div
                animate={{ x: [0, 4, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="shrink-0"
              >
                <ArrowRight
                  className="h-5 w-5"
                  style={{ color: VAULT_GREEN }}
                  strokeWidth={1.5}
                />
              </motion.div>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-surface-1 shrink-0"
                style={{
                  borderColor: phase === 1 ? VAULT_GREEN : "hsl(150 14% 18%)",
                }}
              >
                <Lock
                  className="h-5 w-5"
                  style={{
                    color: phase === 1 ? VAULT_GREEN : "hsl(150 8% 45%)",
                  }}
                  strokeWidth={1.5}
                />
              </div>
              <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                {t("animations.refuge.lockBurn")}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4">
              {/* Flow arrows */}
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      opacity: phase >= 1 ? [0.3, 1, 0.3] : 0.2,
                      x: phase >= 1 ? [0, 4, 0] : 0,
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  >
                    <ArrowRight
                      className="h-4 w-4"
                      style={{
                        color:
                          phase >= 1 ? "hsl(150 100% 50%)" : "hsl(150 8% 30%)",
                      }}
                      strokeWidth={1.5}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Vault box */}
              <motion.div
                className="relative flex h-20 w-20 items-center justify-center rounded-2xl border bg-surface-1"
                animate={{
                  borderColor: phase === 1 ? VAULT_GREEN : "hsl(150 14% 18%)",
                  scale: phase === 1 ? 1.1 : 1,
                  boxShadow:
                    phase === 1
                      ? `0 0 24px ${VAULT_GREEN} / 0.25)`
                      : "0 0 0px transparent",
                }}
                transition={{ duration: 0.4 }}
                style={{
                  borderColor: phase === 1 ? VAULT_GREEN : "hsl(150 14% 18%)",
                }}
              >
                <Lock
                  className="h-7 w-7 transition-colors duration-300"
                  style={{
                    color: phase === 1 ? VAULT_GREEN : "hsl(150 8% 45%)",
                  }}
                  strokeWidth={1.5}
                />

                {/* Active pulse */}
                {phase === 1 && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl"
                    style={{ border: `1px solid ${VAULT_GREEN}` }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                )}
              </motion.div>

              <span className="font-mono text-[9px] text-muted-foreground">
                {t("animations.refuge.lockBurn")}
              </span>
              <span className="font-mono text-[8px] text-muted-foreground">
                {t("animations.refuge.lightClient")}
              </span>
            </div>
          )}

          {/* ════════ RIGHT: RSTN shield (quantum refuge) ════════ */}
          <div className="relative">
            <div className="mb-4 text-center">
              <span className="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
                {t("animations.refuge.refuge")}
              </span>
              <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                {t("animations.refuge.shorResistant")}
              </p>
            </div>

            {/* Shield */}
            <div className="relative flex items-center justify-center py-3">
              <motion.div
                className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl border bg-surface-1"
                animate={{
                  borderColor: phase === 2 ? SECURE_GREEN : "hsl(150 14% 18%)",
                  scale: phase === 2 ? 1.1 : 1,
                  boxShadow:
                    phase === 2
                      ? `0 0 28px ${SECURE_GREEN} / 0.3), 0 0 56px ${SECURE_GREEN} / 0.1)`
                      : "0 0 0px transparent",
                }}
                transition={{ duration: 0.4 }}
                style={{
                  borderColor: phase === 2 ? SECURE_GREEN : "hsl(150 14% 18%)",
                }}
              >
                <ShieldCheck
                  className="h-6 w-6 sm:h-8 sm:w-8 transition-colors duration-300"
                  style={{
                    color:
                      phase === 2 ? "hsl(150 100% 50%)" : "hsl(150 8% 45%)",
                  }}
                  strokeWidth={1.5}
                />

                {/* Shield pulse ring */}
                {phase === 2 && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl"
                    style={{ border: `1.5px solid ${SECURE_GREEN}` }}
                    animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                )}
              </motion.div>

              {/* Quantum waves bouncing off shield */}
              {phase === 2 && !isMobile && (
                <motion.div
                  className="absolute right-full top-1/2 -translate-y-1/2"
                  initial={{ x: 0, opacity: 0.8 }}
                  animate={{ x: [-10, -30, -10], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <div className="flex items-center gap-1 text-[9px] font-mono text-destructive whitespace-nowrap">
                    <span>⚡ Shor</span>
                    <span className="text-primary">
                      {t("animations.refuge.shorBounces")}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Secure status */}
            <motion.div
              animate={{ opacity: phase === 2 ? 1 : 0.4 }}
              transition={{ duration: 0.4 }}
              className="mt-4 sm:mt-6 rounded-lg border px-3 py-2 sm:px-4 sm:py-2.5 text-center"
              style={{
                borderColor: "hsl(150 100% 45% / 0.25)",
                background: "hsl(150 100% 45% / 0.05)",
              }}
            >
              <p className="font-mono text-[10px] text-muted-foreground">
                {t("animations.refuge.backed", { chain: activeChain.label })}{" "}
                <span className="font-bold text-primary">1:1</span>
              </p>
              <p className="mt-0.5 font-body text-[10px] text-primary">
                {t("animations.refuge.nothingToSteal")}
              </p>
            </motion.div>
          </div>
        </div>

        {/* ════════ Particle flow line ════════ */}
        {!isMobile && (
          <div className="relative mt-8">
            {/* Base line */}
            <div className="absolute left-0 right-0 top-0 h-px bg-border" />

            {/* Progress fill — red → green gradient */}
            <motion.div
              className="absolute left-0 top-0 h-px"
              animate={{ width: `${(phase / 2) * 100}%` }}
              transition={{ duration: PHASE_MS / 1000, ease: "easeInOut" }}
            >
              <div
                className="h-full w-full"
                style={{
                  background: `linear-gradient(90deg, ${THREAT_RED}, ${VAULT_GREEN}, ${SECURE_GREEN})`,
                  boxShadow: `0 0 8px ${SECURE_GREEN} / 0.4)`,
                }}
              />
            </motion.div>

            {/* Traveling particle */}
            <motion.div
              className="absolute top-0 pointer-events-none"
              animate={{ left: `${(phase / 2) * 100}%` }}
              transition={{ duration: PHASE_MS / 1000, ease: "easeInOut" }}
            >
              <div
                className="h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background:
                    phase === 0
                      ? THREAT_RED
                      : phase === 1
                        ? VAULT_GREEN
                        : "hsl(150 100% 50%)",
                  boxShadow: `0 0 12px ${phase === 0 ? THREAT_RED : phase === 1 ? VAULT_GREEN : "hsl(150 100% 50%)"}44`,
                }}
              />
            </motion.div>

            {/* Phase labels */}
            <div className="relative mt-5 flex justify-between">
              {[
                {
                  label: t("animations.refuge.phaseVulnerable"),
                  color: THREAT_RED,
                  active: phase === 0,
                },
                {
                  label: t("animations.refuge.phaseLockBurn"),
                  color: VAULT_GREEN,
                  active: phase === 1,
                },
                {
                  label: t("animations.refuge.phaseRefuge"),
                  color: "hsl(150 100% 50%)",
                  active: phase === 2,
                },
              ].map((p) => (
                <div key={p.label} className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full transition-all duration-300"
                    style={{
                      background: p.active ? p.color : "hsl(150 14% 20%)",
                      boxShadow: p.active ? `0 0 6px ${p.color}` : "none",
                    }}
                  />
                  <span
                    className="font-mono text-[9px] transition-colors duration-300"
                    style={{ color: p.active ? p.color : "hsl(150 8% 38%)" }}
                  >
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════ Bottom info bar ════════ */}
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-8 sm:mt-10 flex items-center justify-center"
        >
          <div
            className="flex items-center gap-3 rounded-lg border px-4 py-3 sm:px-5"
            style={{
              borderColor:
                phase === 0
                  ? "hsl(0 80% 55% / 0.25)"
                  : phase === 1
                    ? "hsl(150 70% 50% / 0.25)"
                    : "hsl(150 100% 45% / 0.25)",
              background:
                phase === 0
                  ? "hsl(0 80% 50% / 0.05)"
                  : phase === 1
                    ? "hsl(150 70% 50% / 0.05)"
                    : "hsl(150 100% 45% / 0.05)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  phase === 0
                    ? THREAT_RED
                    : phase === 1
                      ? VAULT_GREEN
                      : "hsl(150 100% 50%)",
                boxShadow: `0 0 6px ${phase === 0 ? THREAT_RED : phase === 1 ? VAULT_GREEN : "hsl(150 100% 50%)"}`,
              }}
            />
            <span className="font-mono text-[10px] sm:text-xs text-muted-foreground text-center">
              {phase === 0 && (
                <span className="font-bold text-destructive">
                  {t("animations.refuge.phase1Threat", {
                    chain: activeChain.label,
                    sig: activeChain.sig,
                  })}
                </span>
              )}
              {phase === 1 && (
                <span className="font-bold" style={{ color: VAULT_GREEN }}>
                  {t("animations.refuge.phase2Lock")}
                </span>
              )}
              {phase === 2 && (
                <span className="font-bold text-primary">
                  {t("animations.refuge.phase3Refuge", {
                    chain: activeChain.label,
                  })}
                </span>
              )}
            </span>
          </div>
        </motion.div>

        {/* ════════ Other vulnerable chains badge grid ════════ */}
        <div className="mt-6 sm:mt-8">
          <p className="mb-3 text-center font-mono text-[10px] text-muted-foreground">
            {t("animations.refuge.alsoVulnerable")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {CHAINS.map((c) => (
              <span
                key={c.id}
                className="rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold"
                style={{
                  borderColor: "hsl(0 80% 55% / 0.2)",
                  background: "hsl(0 80% 50% / 0.04)",
                  color: "hsl(0 70% 65%)",
                }}
              >
                {c.label}
              </span>
            ))}
            <span className="font-mono text-[10px] text-muted-foreground">
              +
            </span>
            {OTHER_VULNERABLE.map((label) => (
              <span
                key={label}
                className="rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold text-muted-foreground"
                style={{
                  borderColor: "hsl(150 14% 22%)",
                  background: "hsl(150 14% 12%)",
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-center font-body text-[10px] text-muted-foreground">
            <span className="font-bold text-destructive">
              {t("animations.refuge.pctNoProtection")}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
