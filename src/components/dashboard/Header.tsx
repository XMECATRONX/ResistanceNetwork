import { motion } from "framer-motion";
import { Zap, Clock, Activity, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";
import { ConnectionBadge } from "@/components/dashboard/ConnectionBadge";
import { SimulatedBadge } from "@/components/dashboard/SimulatedBadge";
import type { ViewId } from "@/components/dashboard/Sidebar";

// Views that display simulated/mock data (no live mainnet node running yet).
const SIMULATED_VIEWS: ViewId[] = [
  "overview",
  "explorer",
  "staking",
  "faucet",
  "network",
  "monitoring",
];

const HEADER_STAT_KEYS = [
  {
    labelKey: "header.stats.tps",
    value: 250,
    suffix: "K",
    icon: Zap,
    color: "var(--primary)",
  },
  {
    labelKey: "header.stats.finality",
    value: 0.4,
    suffix: "s",
    icon: Clock,
    color: "var(--accent)",
    decimals: 1,
  },
  {
    labelKey: "header.stats.validators",
    value: 4128,
    icon: Activity,
    color: "var(--violet)",
  },
  {
    labelKey: "header.stats.pqSecurity",
    value: 256,
    suffix: "bit",
    icon: ShieldCheck,
    color: "var(--primary)",
  },
];

interface HeaderProps {
  title: string;
  subtitle: string;
  viewId?: ViewId;
}

export const Header = ({ title, subtitle, viewId }: HeaderProps) => {
  const { t } = useTranslation();
  const isSimulated = viewId ? SIMULATED_VIEWS.includes(viewId) : false;
  return (
    <header
      className="glass relative flex flex-col gap-3 border-b border-border px-4 py-4 pl-14 lg:px-8 lg:pl-8 lg:py-5"
      role="banner"
      style={{ minHeight: "60px" }}
    >
      <div className="relative flex items-end justify-between">
        <div>
          <motion.div
            key={title}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <span className="dot dot-pulse" />
            <span className="label">{t("header.terminal")}</span>
            <ConnectionBadge />
            {isSimulated && <SimulatedBadge />}
          </motion.div>
          <motion.h2
            key={title + "-h"}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground"
          >
            {title}
          </motion.h2>
          <motion.p
            key={subtitle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.08 }}
            className="mt-1 font-body text-xs text-muted-foreground"
          >
            {subtitle}
          </motion.p>
        </div>

        <div className="header-stats hidden items-center gap-0 2xl:flex">
          {HEADER_STAT_KEYS.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.labelKey}
                className={`flex items-center gap-2.5 px-5 ${i === 0 ? "pl-0" : "border-l border-border"}`}
              >
                <Icon
                  className="h-3.5 w-3.5"
                  style={{ color: stat.color }}
                  strokeWidth={1.5}
                />
                <div className="flex flex-col">
                  <span className="font-mono text-sm font-bold leading-none text-foreground">
                    <AnimatedCounter
                      value={stat.value}
                      suffix={stat.suffix || ""}
                      decimals={stat.decimals || 0}
                      duration={1.5}
                    />
                  </span>
                  <span className="mt-0.5 label-muted">{t(stat.labelKey)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
};
