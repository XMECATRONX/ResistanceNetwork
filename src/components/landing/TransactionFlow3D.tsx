import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Wallet,
  FileSignature,
  Boxes,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

/**
 * Transaction Flow Animation — visualizes the real path of a transaction:
 *
 * 1. WALLET     → User signs with Dilithium3 (post-quantum signature)
 * 2. MEMPOOL    → Transaction enters the mempool, waits for inclusion
 * 3. PROPOSE    → Leader proposes a block containing the tx
 * 4. VOTE       → Validators vote (BFT 2/3+ majority)
 * 5. FINALITY   → Block committed, finality in 0.4s
 *
 * A particle travels through each stage, lighting them up sequentially.
 * The total cycle takes ~4s (slowed from 0.4s for visibility).
 */

const STAGES = [
  {
    id: "wallet",
    icon: Wallet,
    labelKey: "animations.flow.wallet",
    subKey: "animations.flow.walletSub",
    color: "hsl(150 100% 45%)",
  },
  {
    id: "mempool",
    icon: FileSignature,
    labelKey: "animations.flow.mempool",
    subKey: "animations.flow.mempoolSub",
    color: "hsl(150 70% 50%)",
  },
  {
    id: "propose",
    icon: Boxes,
    labelKey: "animations.flow.propose",
    subKey: "animations.flow.proposeSub",
    color: "hsl(150 100% 45%)",
  },
  {
    id: "vote",
    icon: ShieldCheck,
    labelKey: "animations.flow.vote",
    subKey: "animations.flow.voteSub",
    color: "hsl(185 100% 55%)",
  },
  {
    id: "finality",
    icon: CheckCircle2,
    labelKey: "animations.flow.finality",
    subKey: "animations.flow.finalitySub",
    color: "hsl(150 100% 50%)",
  },
] as const;

const CYCLE_MS = 5000; // full cycle duration
const STAGE_MS = CYCLE_MS / STAGES.length; // time per stage

export const TransactionFlow3D = () => {
  const { t } = useTranslation();
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % STAGES.length);
    }, STAGE_MS);
    return () => clearInterval(interval);
  }, []);

  // Particle position: travels left → right across the flow
  const particleProgress = (activeStage / (STAGES.length - 1)) * 100;

  return (
    <div className="mt-8 sm:mt-16 px-2 sm:px-0">
      {/* Flow container */}
      <div className="relative mx-auto w-full sm:max-w-5xl">
        {/* Connection line — the "rail" the particle travels on (desktop only) */}
        <div
          className="absolute left-0 right-0 top-[44px] h-px bg-border hidden lg:block"
          style={{ zIndex: 0 }}
        />

        {/* Animated progress fill — lights up as the tx advances (desktop only) */}
        <motion.div
          className="absolute left-0 top-[44px] h-px hidden lg:block"
          style={{ zIndex: 1 }}
          animate={{ width: `${particleProgress}%` }}
          transition={{ duration: STAGE_MS / 1000, ease: "easeInOut" }}
        >
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(90deg, hsl(150 100% 45%), hsl(150 70% 50%), hsl(150 100% 45%), hsl(185 100% 55%), hsl(150 100% 50%))",
              boxShadow: "0 0 8px hsl(150 100% 45% / 0.5)",
            }}
          />
        </motion.div>

        {/* Traveling particle (desktop only) */}
        <motion.div
          className="absolute top-[44px] pointer-events-none hidden lg:block"
          style={{ zIndex: 2 }}
          animate={{ left: `${particleProgress}%` }}
          transition={{ duration: STAGE_MS / 1000, ease: "easeInOut" }}
        >
          <div
            className="h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: STAGES[activeStage].color,
              boxShadow: `0 0 12px ${STAGES[activeStage].color}, 0 0 24px ${STAGES[activeStage].color.replace(")", " / 0.3)")}`,
            }}
          />
        </motion.div>

        {/* Stage nodes — flex-wrap on mobile (centers partial rows), grid on desktop */}
        <div
          className="relative flex flex-wrap justify-center gap-y-5 gap-x-3 px-2 lg:grid lg:grid-cols-5 lg:gap-2 lg:px-0"
          style={{ zIndex: 3 }}
        >
          {STAGES.map((stage, i) => {
            const isActive = i === activeStage;
            const isPast = i < activeStage;
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className="flex w-[30%] flex-col items-center lg:w-auto"
              >
                {/* Icon circle */}
                <motion.div
                  className="relative flex h-[52px] w-[52px] items-center justify-center rounded-xl border bg-surface-1 sm:h-[88px] sm:w-[88px]"
                  animate={{
                    borderColor: isActive
                      ? `${stage.color}`
                      : isPast
                        ? `${stage.color}55`
                        : "hsl(150 14% 18%)",
                    scale: isActive ? 1.08 : 1,
                    boxShadow: isActive
                      ? `0 0 24px ${stage.color.replace(")", " / 0.25)")}, 0 0 48px ${stage.color.replace(")", " / 0.1)")}`
                      : "0 0 0px transparent",
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{
                    borderColor: isActive
                      ? stage.color
                      : isPast
                        ? `${stage.color}55`
                        : "hsl(150 14% 18%)",
                  }}
                >
                  <Icon
                    className="h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-300"
                    style={{
                      color: isActive
                        ? stage.color
                        : isPast
                          ? `${stage.color}99`
                          : "hsl(150 8% 45%)",
                    }}
                    strokeWidth={1.5}
                  />

                  {/* Active pulse ring */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-xl"
                      style={{ border: `1px solid ${stage.color}` }}
                      animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                    />
                  )}

                  {/* Step number badge */}
                  <span
                    className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full font-mono text-[8px] font-bold sm:h-5 sm:w-5 sm:text-[9px]"
                    style={{
                      background: isActive ? stage.color : "hsl(150 14% 16%)",
                      color: isActive ? "hsl(150 14% 8%)" : "hsl(150 8% 50%)",
                    }}
                  >
                    {i + 1}
                  </span>
                </motion.div>

                {/* Label */}
                <div className="mt-2 sm:mt-4 text-center">
                  <p
                    className="font-display text-[10px] sm:text-xs font-semibold transition-colors duration-300"
                    style={{
                      color:
                        isActive || isPast
                          ? "hsl(0 0% 95%)"
                          : "hsl(150 8% 45%)",
                    }}
                  >
                    {t(stage.labelKey)}
                  </p>
                  <p
                    className="mt-0.5 font-mono text-[7px] sm:text-[9px] leading-tight transition-colors duration-300"
                    style={{
                      color: isActive ? stage.color : "hsl(150 8% 38%)",
                    }}
                  >
                    {t(stage.subKey)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom info bar — shows current stage detail */}
        <motion.div
          key={activeStage}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-6 sm:mt-10 flex items-center justify-center px-2"
        >
          <div
            className="flex items-center gap-2.5 rounded-lg border px-3 py-2 sm:gap-3 sm:px-5 sm:py-3"
            style={{
              borderColor: `${STAGES[activeStage].color}33`,
              background: `${STAGES[activeStage].color.replace(")", " / 0.05)")}`,
            }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: STAGES[activeStage].color,
                boxShadow: `0 0 6px ${STAGES[activeStage].color}`,
              }}
            />
            <span className="font-mono text-[11px] sm:text-xs text-muted-foreground">
              {t("animations.flow.stage", {
                n: activeStage + 1,
                total: 5,
                label: t(STAGES[activeStage].labelKey),
                sub: t(STAGES[activeStage].subKey),
              })}
            </span>
          </div>
        </motion.div>

        {/* Finality timer — 3 metrics in a row, centered on all sizes */}
        <div className="mt-5 sm:mt-6 flex items-center justify-center gap-3 sm:gap-6">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground">
              {t("animations.flow.finalityLabel")}
            </span>
            <span className="font-mono text-sm font-bold text-primary">
              0.4s
            </span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground">
              {t("animations.flow.pqSignature")}
            </span>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: "hsl(150 100% 45%)" }}
            >
              Dilithium3
            </span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground">
              {t("animations.flow.consensus")}
            </span>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: "hsl(185 100% 55%)" }}
            >
              BFT 2/3+
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
