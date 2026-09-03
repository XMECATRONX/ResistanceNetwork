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
import { getLiquidityParticipation } from "@/lib/protocolLiquidity";
import { Panel } from "@/components/dashboard/Panel";

/**
 * LP Participation section — shows how LP rewards live INSIDE the 95%
 * Proof of Participation bucket (not a new bucket), with the immutable
 * invariant APR_validator >= 2 × APR_lp that prevents the network-death
 * scenario where everyone prefers LP over running validator nodes.
 *
 * Visual nesting: the 80/20 split is rendered INSIDE a container clearly
 * labeled "Dentro del 95%" so nobody adds 95+5+80+20 = 200%.
 */
export const LpParticipationSection = () => {
  const { i18n } = useTranslation();
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
      color: "hsl(150 100% 55%)",
      desc:
        lang === "es"
          ? "Menor APR · pasivo, sin slashing"
          : "Lower APR · passive, no slashing",
    },
  ];

  return (
    <Panel title={u.title} description={u.desc}>
      {/* Principle banner */}
      <div
        className="mb-6 flex items-start gap-3 rounded-lg border border-primary/20 p-4"
        style={{ background: "hsl(150 100% 45% / 0.04)" }}
      >
        <Droplets className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
        <div>
          <p className="font-body text-sm font-semibold text-foreground">
            {u.principle}
          </p>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            {u.noBucket}
          </p>
        </div>
      </div>

      {/* ── Layer 2 nesting: split INSIDE the 95% ── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-1.5">
          <ChevronRight
            className="h-3.5 w-3.5 text-primary/60"
            strokeWidth={2}
          />
          <span className="font-mono text-[10px] font-semibold text-primary">
            {u.layer2Label}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            · {u.layer2Sub}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Split visualization */}
          <div className="space-y-4">
            <div className="mb-1 flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {u.splitTitle}
              </h4>
            </div>

            {/* Split bar — stacked 80/20 (lives INSIDE the 95%) */}
            <div
              className="flex h-10 w-full overflow-hidden rounded-lg border border-border"
              style={{ background: "hsl(150 14% 6%)" }}
            >
              {splitData.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: `${s.pct}%`, opacity: 1 }}
                  transition={{ delay: i * 0.15, duration: 0.6 }}
                  className="flex items-center justify-center"
                  style={{ background: s.color }}
                >
                  <span className="font-mono text-xs font-bold text-black/80">
                    {s.pct}%
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Split legend */}
            <div className="space-y-3">
              {splitData.map((s) => (
                <div
                  key={s.label}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface-1 p-4"
                >
                  <span
                    className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                    style={{
                      background: s.color,
                      boxShadow: `0 0 6px ${s.color}`,
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-body text-xs font-semibold text-foreground">
                        {s.label}
                      </span>
                      <span
                        className="font-mono text-sm font-bold"
                        style={{ color: s.color }}
                      >
                        {s.pct}%
                      </span>
                    </div>
                    <p className="mt-1 font-body text-xs text-muted-foreground">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="font-body text-xs leading-relaxed text-muted-foreground">
              {u.splitBody}
            </p>
          </div>

          {/* Invariant + self-balancing */}
          <div className="space-y-4">
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
              animate={{ opacity: 1, y: 0 }}
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
    </Panel>
  );
};
