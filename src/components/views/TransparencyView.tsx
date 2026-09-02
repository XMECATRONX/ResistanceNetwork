import { motion } from "framer-motion";
import {
  TrendingDown,
  Flame,
  Eye,
  Clock,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/dashboard/Panel";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";
import {
  getBridgeEconomics,
  getSupplyHistory,
  getRevenueSources,
} from "@/lib/protocolTransparency";
import { TransparencyFeed } from "./TransparencyFeed";

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtUsd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n}`;

export const TransparencyView = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "es" ? "es" : "en";

  const SUPPLY_HISTORY = getSupplyHistory(lang);
  const BRIDGE_ECONOMICS = getBridgeEconomics(lang);
  const REVENUE_SOURCES = getRevenueSources(lang);

  const maxBar = Math.max(...SUPPLY_HISTORY.epochs.map((e) => e.burned));

  return (
    <div className="space-y-6">
      {/* ─── Hero ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="panel relative overflow-hidden p-6"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <div
          className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-[0.04] blur-3xl"
          style={{ background: "hsl(150 100% 45%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
              <Eye className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t("views.transparency.heroTitle")}
              </h2>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {t("views.transparency.heroDesc")}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4 text-center">
              <DollarSign
                className="mx-auto h-5 w-5 text-primary"
                strokeWidth={1.5}
              />
              <p className="mt-2 font-mono text-xl font-bold text-primary">
                <AnimatedCounter
                  value={10.2}
                  suffix="M"
                  prefix="$"
                  decimals={1}
                />
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                {t("views.transparency.statBridgeVolume")}
              </p>
            </div>
            <div className="card p-4 text-center">
              <Flame
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(150 100% 55%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(150 100% 55%)" }}
              >
                <AnimatedCounter value={SUPPLY_HISTORY.totalBurned} />
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                {t("views.transparency.statTotalBurned")}
              </p>
            </div>
            <div className="card p-4 text-center">
              <TrendingDown
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(150 70% 50%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(150 70% 50%)" }}
              >
                <AnimatedCounter value={SUPPLY_HISTORY.currentCirculating} />
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                {t("views.transparency.statCirculating")}
              </p>
            </div>
            <div className="card p-4 text-center">
              <Clock
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(150 100% 45%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(150 100% 45%)" }}
              >
                7d
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                {t("views.transparency.statBuybackCadence")}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Supply decreciente ─── */}
      <Panel
        title={t("views.transparency.supplyTitle")}
        description={t("views.transparency.supplyDesc")}
      >
        <div className="flex items-end justify-between gap-1.5 h-48 mb-4">
          {SUPPLY_HISTORY.epochs.map((epoch, i) => {
            const heightPct = (epoch.burned / maxBar) * 100;
            return (
              <motion.div
                key={epoch.epoch}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(heightPct, 2)}%` }}
                transition={{ duration: 0.5, delay: i * 0.03 }}
                className="group relative flex-1 flex flex-col items-center justify-end"
              >
                <motion.div
                  className="w-full rounded-t-sm"
                  style={{
                    background: `linear-gradient(to top, hsl(150 100% 45%), hsl(150 100% 50%))`,
                    opacity: 0.7 + (i / SUPPLY_HISTORY.epochs.length) * 0.3,
                  }}
                />
                <div className="absolute -top-6 hidden group-hover:block z-10 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 shadow-lg">
                  <p className="font-mono text-[9px] text-foreground">
                    {epoch.label}
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground">
                    {fmt(epoch.burned)} {t("views.transparency.supplyBurned")}
                  </p>
                </div>
                <span className="mt-1.5 font-mono text-[7px] text-muted-foreground/60 -rotate-45 origin-left whitespace-nowrap">
                  {epoch.epoch}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <span className="label-muted text-[9px]">
              {t("views.transparency.supplyMax")}
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-foreground">
              {fmt(SUPPLY_HISTORY.maxSupply)}
            </p>
            <p className="mt-1 font-body text-[10px] text-muted-foreground">
              {t("views.transparency.supplyMaxNote")}
            </p>
          </div>
          <div
            className="card p-4"
            style={{
              borderColor: "hsl(150 70% 50% / 0.2)",
              background: "hsl(150 70% 50% / 0.04)",
            }}
          >
            <span className="label-muted text-[9px]">
              {t("views.transparency.supplyCurrent")}
            </span>
            <p
              className="mt-1 font-mono text-lg font-bold"
              style={{ color: "hsl(150 70% 50%)" }}
            >
              {fmt(SUPPLY_HISTORY.currentCirculating)}
            </p>
            <p className="mt-1 font-body text-[10px] text-muted-foreground">
              {(
                (SUPPLY_HISTORY.totalBurned / SUPPLY_HISTORY.maxSupply) *
                100
              ).toFixed(2)}
              {t("views.transparency.supplyReduction")}
            </p>
          </div>
          <div
            className="card p-4"
            style={{
              borderColor: "hsl(150 100% 55% / 0.2)",
              background: "hsl(150 100% 55% / 0.04)",
            }}
          >
            <span className="label-muted text-[9px]">
              {t("views.transparency.supplyTotalBurned")}
            </span>
            <p
              className="mt-1 font-mono text-lg font-bold"
              style={{ color: "hsl(150 100% 55%)" }}
            >
              {fmt(SUPPLY_HISTORY.totalBurned)}
            </p>
            <p className="mt-1 font-body text-[10px] text-muted-foreground">
              {SUPPLY_HISTORY.burnRate}
            </p>
          </div>
        </div>
      </Panel>

      {/* ─── Revenue Split 60/30/10 ─── */}
      <Panel
        title={t("views.transparency.revenueTitle")}
        description={BRIDGE_ECONOMICS.principle}
      >
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          {BRIDGE_ECONOMICS.revenueSplit.map((split) => (
            <motion.div
              key={split.destination}
              initial={{ width: 0 }}
              animate={{ width: `${split.percentage}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ background: split.color }}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {BRIDGE_ECONOMICS.revenueSplit.map((split, i) => (
            <motion.div
              key={split.destination}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="card-sig p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="font-mono text-3xl font-bold"
                  style={{ color: split.color }}
                >
                  {split.percentage}%
                </span>
                <div
                  className="h-12 w-12 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: `${split.color}33` }}
                >
                  <div
                    className="h-8 w-8 rounded-full"
                    style={{ background: split.color, opacity: 0.15 }}
                  />
                </div>
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {split.destination}
              </h3>
              <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                {split.detail}
              </p>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* ─── Fuentes de ingreso ─── */}
      <Panel
        title={t("views.transparency.sourcesTitle")}
        description={t("views.transparency.sourcesDesc")}
      >
        <div className="space-y-3">
          {REVENUE_SOURCES.map((src, i) => (
            <motion.div
              key={src.source}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="flex items-center gap-4"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  borderColor: `${src.color}33`,
                  background: `${src.color}0d`,
                }}
              >
                <BarChart3
                  className="h-4 w-4"
                  style={{ color: src.color }}
                  strokeWidth={1.5}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-body text-xs font-medium text-foreground">
                    {src.source}
                  </p>
                  <p
                    className="font-mono text-xs font-bold"
                    style={{ color: src.color }}
                  >
                    {fmtUsd(src.monthlyUsd)}
                    {t("views.transparency.perMonth")}
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${src.share}%` }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    className="h-full rounded-full"
                    style={{ background: src.color }}
                  />
                </div>
                <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                  {src.share}
                  {t("views.transparency.shareOfTotal")}
                  {fmtUsd(src.annualUsd)}
                  {t("views.transparency.perYear")}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* ─── Buyback feed + metrics + compliance ─── */}
      <TransparencyFeed />
    </div>
  );
};
