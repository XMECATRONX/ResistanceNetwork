import { motion } from "framer-motion";
import {
  Droplets,
  Scale,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { lazy, Suspense } from "react";
import { TOKENOMICS } from "@/lib/protocol";
import { getLiquidityParticipation } from "@/lib/protocolLiquidity";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";

const Tokenomics3D = lazy(() =>
  import("@/components/landing/Tokenomics3D").then((m) => ({
    default: m.Tokenomics3D,
  })),
);

const Lazy3D = ({ children }: { children: React.ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }
  >
    {children}
  </Suspense>
);

/**
 * Landing page — Tokenomics section.
 *
 * 2-LEVEL NESTING (so nobody adds 95+5+80+20=200%):
 *
 *   Layer 1 — Distribution total (1B RSTN):
 *     ├─ Staking & Validators (Fair Launch)  ........ 95%
 *     │    ├─ Validators + Delegators  ........ 80%  ← Layer 2 (inside the 95%)
 *     │    └─ DEX LPs                   ........ 20%  ← Layer 2 (inside the 95%)
 *     └─ Testnet Airdrop (Bootstrap seed)  .........  5%
 *
 * Layer 2 lives INSIDE the 95%, not beside it. The visual nesting makes this
 * unambiguous: the 80/20 bar is rendered inside a container that is clearly
 * a child of the 95% bar, with a connecting indent and a label that says
 * "Dentro del 95%".
 */
export const TokenomicsSection = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const lp = getLiquidityParticipation(lang);
  const u = lp.ui;

  const splitData = [
    {
      label: u.validators,
      pct: lp.split.validators,
      color: "hsl(150 100% 45%)",
      desc:
        lang === "es"
          ? "Mayor APR · slashing + uptime + hardware"
          : "Higher APR · slashing + uptime + hardware",
    },
    {
      label: u.lps,
      pct: lp.split.liquidityProviders,
      color: "hsl(185 100% 55%)",
      desc:
        lang === "es"
          ? "Menor APR · pasivo, sin slashing"
          : "Lower APR · passive, no slashing",
    },
  ];

  return (
    <section
      id="tokenomics"
      className="relative border-t border-border py-12 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <motion.span
          className="label"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          {t("sections.tokenomics.label")}
        </motion.span>
        <motion.h2
          className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {t("sections.tokenomics.title")}
        </motion.h2>

        <div className="grid items-center gap-8 grid-cols-1 lg:grid-cols-2 lg:gap-12">
          {/* ── Layer 1: Distribution total (95/5) ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-left"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground">
                  {t("sections.tokenomics.distributionTitle")}
                </h3>
                <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
                  {u.layer1Label}
                </p>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                1,000,000,000 RSTN
              </span>
            </div>

            {/* Layer 1 bars */}
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

                  {/* ── Layer 2: nested BELOW the 95% bar ── */}
                  {item.percentage === 95 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5, duration: 0.4 }}
                      className="mt-3 rounded-lg border border-primary/20 bg-surface-1 p-4"
                    >
                      <div className="mb-3 flex items-center gap-1.5">
                        <ChevronRight
                          className="h-3 w-3 text-primary/50"
                          strokeWidth={2}
                        />
                        <span className="font-mono text-[9px] font-semibold text-primary">
                          {u.layer2Label}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          · {u.layer2Sub}
                        </span>
                      </div>

                      {/* Layer 2 stacked bar — lives INSIDE the 95% */}
                      <div className="flex h-6 w-full overflow-hidden rounded-full border border-border/50 bg-surface-2">
                        {splitData.map((s, j) => (
                          <motion.div
                            key={s.label}
                            initial={{ width: 0, opacity: 0 }}
                            whileInView={{
                              width: `${s.pct}%`,
                              opacity: 1,
                            }}
                            viewport={{ once: true }}
                            transition={{
                              delay: 0.7 + j * 0.15,
                              duration: 0.6,
                            }}
                            className="flex items-center justify-center text-[10px] font-mono font-bold text-black/90"
                            style={{ background: s.color }}
                          >
                            {s.pct}%
                          </motion.div>
                        ))}
                      </div>

                      {/* Layer 2 legend */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {splitData.map((s) => (
                          <div key={s.label} className="flex items-start gap-2">
                            <span
                              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                background: s.color,
                                boxShadow: `0 0 4px ${s.color}`,
                              }}
                            />
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="font-body text-[11px] font-semibold text-foreground">
                                  {s.label}
                                </span>
                                <span
                                  className="font-mono text-[11px] font-bold"
                                  style={{ color: s.color }}
                                >
                                  {s.pct}%
                                </span>
                              </div>
                              <p className="font-body text-[10px] text-muted-foreground leading-tight">
                                {s.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 font-body text-[10px] text-muted-foreground leading-relaxed">
                        {u.splitBody}
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Key metrics */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
              {[
                {
                  label: t("sections.tokenomics.metrics.hardCap"),
                  value: "1B RSTN",
                  color: "hsl(150 100% 45%)",
                },
                {
                  label: t("sections.tokenomics.metrics.minStake"),
                  value: "32,000 RSTN",
                  color: "hsl(150 100% 45%)",
                },
                {
                  label: t("sections.tokenomics.metrics.apr"),
                  value: lang === "en" ? "Variable" : "Variable",
                  color: "hsl(185 100% 55%)",
                },
                {
                  label: t("sections.tokenomics.metrics.fairLaunch"),
                  value: "100%",
                  color: "hsl(150 70% 50%)",
                },
              ].map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -2 }}
                  className="rounded-lg border border-border bg-surface-1 p-3 sm:p-4 text-center transition-colors hover:bg-surface-2 hover:border-primary/30"
                >
                  <p
                    className="font-mono text-base sm:text-lg font-bold"
                    style={{ color: m.color }}
                  >
                    {m.value}
                  </p>
                  <p className="mt-1 label-muted text-[8px] sm:text-[9px]">
                    {m.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Animated coin */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex justify-center"
          >
            <Lazy3D>
              <Tokenomics3D coinOnly />
            </Lazy3D>
          </motion.div>
        </div>

        {/* ── LP Participation invariant + self-balancing (below the chart) ── */}
        <div className="mt-16 max-w-5xl mx-auto text-left">
          {/* Principle banner */}
          <div
            className="mb-6 flex items-start gap-3 rounded-lg border border-primary/20 p-4"
            style={{ background: "hsl(150 100% 45% / 0.04)" }}
          >
            <Droplets
              className="h-5 w-5 shrink-0 text-primary"
              strokeWidth={1.5}
            />
            <div>
              <p className="font-body text-sm font-semibold text-foreground">
                {u.principle}
              </p>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {u.noBucket}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Invariant */}
            <div
              className="rounded-lg border border-primary/30 p-5"
              style={{
                background: "hsl(150 100% 45% / 0.05)",
                boxShadow: "0 0 20px hsl(150 100% 45% / 0.06)",
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck
                  className="h-4 w-4 text-primary"
                  strokeWidth={1.5}
                />
                <h4 className="font-display text-sm font-semibold text-foreground">
                  {u.invariantTitle}
                </h4>
              </div>
              <div className="mb-3 rounded-md border border-primary/20 bg-surface-1 px-4 py-3 text-center">
                <p className="font-mono text-base font-bold text-primary">
                  {u.invariantRule}
                </p>
              </div>
              <p className="font-body text-xs leading-relaxed text-muted-foreground">
                {u.invariantBody}
              </p>
            </div>

            {/* Self-balancing */}
            <div className="rounded-lg border border-border bg-surface-1 p-5">
              <div className="mb-3 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <h4 className="font-display text-sm font-semibold text-foreground">
                  {u.selfBalanceTitle}
                </h4>
              </div>
              <p className="font-body text-xs leading-relaxed text-muted-foreground">
                {u.selfBalanceBody}
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-md border border-accent/20 bg-accent/[0.04] p-3">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                  strokeWidth={1.5}
                />
                <p className="font-body text-xs leading-relaxed text-muted-foreground">
                  {u.liveness}
                </p>
              </div>
            </div>
          </div>

          {/* DEX Pools table */}
          <div className="mt-6">
            <h4 className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
              <Scale className="h-4 w-4 text-primary" strokeWidth={1.5} />
              {u.poolsTitle}
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {lp.pools.map((pool, i) => (
                <motion.div
                  key={pool.pair}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="card-hover p-4"
                >
                  <p className="font-mono text-sm font-bold text-primary">
                    {pool.pair}
                  </p>
                  <p className="mt-1 font-body text-xs text-muted-foreground">
                    {pool.role}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="label-muted text-[10px]">{u.apr}</span>
                    <span className="font-mono text-xs font-bold text-foreground">
                      {pool.apr}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="label-muted text-[10px]">{u.risk}</span>
                    <span className="font-body text-xs text-muted-foreground">
                      {pool.risk}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Fair launch banner */}
          <div
            className="mt-6 rounded-lg border border-primary/20 p-5 text-center"
            style={{ background: "hsl(150 100% 45% / 0.04)" }}
          >
            <h4 className="font-display text-sm font-semibold text-primary">
              {u.fairLaunchTitle}
            </h4>
            <p className="mt-2 max-w-2xl mx-auto font-body text-xs leading-relaxed text-muted-foreground">
              {u.fairLaunchBody}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TokenomicsSection;
