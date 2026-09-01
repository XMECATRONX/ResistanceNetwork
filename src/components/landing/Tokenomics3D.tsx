import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { TOKENOMICS, MONETARY_POLICY } from "@/lib/protocol";
import { RstnCoin3D } from "@/components/landing/RstnCoin3D";

/**
 * 3D Tokenomics Visualization — every element represents real economics:
 *
 * Extruded bars = token distribution (each allocation has real depth)
 * Floating coin = the RSTN token itself, rotating to show both faces:
 *   Front = "</>" Quantum Break (the protocol symbol)
 *   Back = "1B" (the hard cap — scarcity)
 *   Rim = extrusion = the token has real weight, not just a number
 *
 * Below the coin: the deflationary mechanism visualized as a
 * supply decay curve — halving every 4 years, supply shrinking.
 *
 * The coin rotates slowly (18s) = the token is stable, not volatile.
 */
export const Tokenomics3D = ({ coinOnly = false }: { coinOnly?: boolean }) => {
  const { t } = useTranslation();
  // Halving schedule for the deflation curve
  const halvings = [
    { epoch: 0, reward: 475, cumulative: 0 },
    { epoch: 1, reward: 237.5, cumulative: 475 },
    { epoch: 2, reward: 118.75, cumulative: 712.5 },
    { epoch: 3, reward: 59.37, cumulative: 831.25 },
    { epoch: 4, reward: 29.68, cumulative: 890.62 },
    { epoch: 5, reward: 14.84, cumulative: 920.3 },
    { epoch: 6, reward: 7.42, cumulative: 935.14 },
  ];

  return (
    <div
      className={
        coinOnly
          ? "flex justify-center"
          : "tokenomics-3d-grid grid items-center gap-8 lg:grid-cols-[1fr_320px]"
      }
    >
      {/* 3D extruded bars — token distribution (hidden when coinOnly) */}
      {!coinOnly && (
        <div
          className="card-sig p-6"
          style={{ transform: "perspective(800px) rotateX(2deg)" }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {t("animations.tokenomics.distribution")}
              </h3>
              <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
                {t("animations.tokenomics.fairLaunch")}
              </p>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              1,000,000,000 RSTN
            </span>
          </div>

          <div className="space-y-5">
            {TOKENOMICS.map((item, i) => (
              <motion.div
                key={item.allocation}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: item.color,
                        boxShadow: `0 0 6px ${item.color}`,
                      }}
                    />
                    <span className="font-body text-xs font-medium text-foreground">
                      {item.allocation}
                    </span>
                  </div>
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: item.color }}
                  >
                    {item.percentage}%
                  </span>
                </div>

                {/* Allocation bar */}
                <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-surface-2 border border-border/50">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: item.color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.percentage}%` }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.8,
                      delay: i * 0.08 + 0.2,
                      ease: "easeOut",
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Deflationary mechanism — supply decay curve */}
          <div
            className="mt-6 pt-4 border-t"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[9px] text-muted-foreground">
                {t("animations.tokenomics.deflation")}
              </span>
              <span
                className="font-mono text-[9px]"
                style={{ color: "hsl(150 100% 50%)" }}
              >
                {t("animations.tokenomics.burnFees")}
              </span>
            </div>
            {/* Decay curve — SVG showing supply approaching hard cap */}
            <svg
              width="100%"
              height="60"
              viewBox="0 0 300 60"
              className="overflow-visible"
            >
              <defs>
                <linearGradient id="decayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(150 100% 45% / 0.3)" />
                  <stop offset="100%" stopColor="hsl(150 100% 45% / 0)" />
                </linearGradient>
              </defs>
              {/* Filled area under curve */}
              <path
                d={`M 0 55 ${halvings
                  .map((h, i) => {
                    const x = (i / (halvings.length - 1)) * 300;
                    const y = 55 - (h.cumulative / 950) * 50;
                    return `L ${x} ${y}`;
                  })
                  .join(" ")} L 300 55 Z`}
                fill="url(#decayGrad)"
              />
              {/* Curve line */}
              <motion.path
                d={`M 0 55 ${halvings
                  .map((h, i) => {
                    const x = (i / (halvings.length - 1)) * 300;
                    const y = 55 - (h.cumulative / 950) * 50;
                    return `L ${x} ${y}`;
                  })
                  .join(" ")}`}
                fill="none"
                stroke="hsl(150 100% 50%)"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              {/* Halving markers */}
              {halvings.map((h, i) => {
                const x = (i / (halvings.length - 1)) * 300;
                const y = 55 - (h.cumulative / 950) * 50;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="2"
                    fill="hsl(150 100% 50%)"
                  />
                );
              })}
              {/* Hard cap line */}
              <line
                x1="0"
                y1="5"
                x2="300"
                y2="5"
                stroke="hsl(185 100% 55% / 0.3)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x="295"
                y="3"
                textAnchor="end"
                className="font-mono"
                fill="hsl(185 100% 55%)"
                fontSize="7"
              >
                {t("animations.tokenomics.hardCap")}
              </text>
            </svg>
            <div className="mt-1 flex justify-between">
              <span className="font-mono text-[8px] text-muted-foreground">
                {t("animations.tokenomics.genesis")}
              </span>
              <span className="font-mono text-[8px] text-muted-foreground">
                {t("animations.tokenomics.year24")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RSTN COIN — Quantum proof coin with dynamic lighting ═══ */}
      <div className="relative mx-auto flex flex-col items-center">
        <RstnCoin3D />
        {/* Label below coin — OUTSIDE the coin container to prevent overlap */}
        <div className="mt-4 text-center">
          <p className="font-display text-xl sm:text-2xl font-black tracking-tight text-foreground">
            RSTN
          </p>
          <p className="font-mono text-[8px] sm:text-[9px] tracking-[0.2em] mt-0.5 text-muted-foreground uppercase">
            {t("animations.tokenomics.deflationarySupply")}
          </p>
        </div>
      </div>
    </div>
  );
};
