import { motion } from "framer-motion";
import { Coins, TrendingUp, Ban, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NETWORK_STATS, getTokenomics } from "@/lib/protocol";

/**
 * Tokenomics stat cards + Quantum Chassis Frame with distribution bars.
 * Matches the Landing page tokenomics visual style.
 */
export const TokenomicsFrame = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const tk = (k: string) => t(`views.tokenomicsView.${k}`);
  const TOKENOMICS = getTokenomics(lang);

  const stats = [
    {
      label: tk("statToken"),
      value: NETWORK_STATS.token,
      icon: Coins,
      color: "hsl(150 100% 45%)",
    },
    {
      label: tk("statHardCap"),
      value: NETWORK_STATS.maxSupply,
      icon: TrendingUp,
      color: "hsl(150 100% 55%)",
    },
    {
      label: tk("statMinting"),
      value: tk("statMintingVal"),
      icon: Ban,
      color: "hsl(150 100% 45%)",
    },
    {
      label: tk("statBurn"),
      value: tk("statBurnVal"),
      icon: Flame,
      color: "hsl(150 70% 50%)",
    },
  ];

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card-sig p-5"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  background: `hsl(150 100% 45% / 0.1)`,
                  border: `1px solid hsl(150 100% 45% / 0.25)`,
                }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: stat.color }}
                  strokeWidth={1.5}
                />
              </div>
              <p className="mt-3 label-muted">{stat.label}</p>
              <p className="mt-1 font-display text-xl font-semibold text-foreground">
                {stat.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Quantum Chassis Frame */}
      <div
        className="relative overflow-hidden rounded-xl border border-primary/15"
        style={{
          background:
            "linear-gradient(145deg, hsl(150 14% 6%) 0%, hsl(150 14% 8%) 50%, hsl(150 14% 5%) 100%)",
          boxShadow:
            "inset 0 0 80px hsl(150 100% 45% / 0.03), 0 0 60px hsl(150 100% 45% / 0.05)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center gap-1 bg-gradient-to-b from-surface-1 to-transparent">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="h-3 w-[2px] rounded-full bg-primary/20"
                style={{ opacity: 0.3 + Math.random() * 0.4 }}
              />
            ))}
            <div className="absolute right-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(150_100%_45%)]" />
              <span className="font-mono text-[9px] text-primary/70 tracking-wider">
                Q-SYS ACTIVE
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-6 flex items-center justify-between px-4 bg-gradient-to-t from-surface-1 to-transparent">
            <span className="font-mono text-[9px] text-muted-foreground/50 tracking-widest">
              RSTN QUANTUM CORE v1.0
            </span>
            <span className="font-mono text-[9px] text-primary/40">
              TEMP: 15mK
            </span>
          </div>
          <div className="absolute left-2 top-16 bottom-8 w-6 flex flex-col items-center gap-1.5 py-4 opacity-30">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="group relative">
                <div
                  className="h-2 w-2 rounded-full border border-primary/40"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, hsl(150 100% ${50 + i * 5}%), transparent)`,
                    boxShadow: `0 0 ${4 + i}px hsl(150 100% 45% / ${0.2 + i * 0.08})`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="absolute right-2 top-16 bottom-8 w-5 flex flex-col-reverse items-center gap-0.5 py-4 opacity-40">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="h-1 w-full rounded-sm"
                style={{
                  background: i > 9 ? "hsl(150 100% 45%)" : "hsl(150 100% 45%)",
                  opacity: 0.4 + Math.random() * 0.6,
                }}
              />
            ))}
          </div>
          <div className="absolute top-3 left-3 w-4 h-4 border-l-2 border-t-2 border-primary/20" />
          <div className="absolute top-3 right-3 w-4 h-4 border-r-2 border-t-2 border-primary/20" />
          <div className="absolute bottom-7 left-3 w-4 h-4 border-l-2 border-b-2 border-primary/20" />
          <div className="absolute bottom-7 right-3 w-4 h-4 border-r-2 border-b-2 border-primary/20" />
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            animate={{ top: ["10%", "90%", "10%"], opacity: [0, 1, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ boxShadow: "0 0 10px hsl(150 100% 45% / 0.5)" }}
          />
        </div>

        {/* Content inside frame */}
        <div className="relative z-10 p-6 pt-12 pb-10 lg:p-8 lg:pt-14 lg:pb-12">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.04] px-4 py-1.5 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[10px] font-medium text-primary tracking-widest uppercase">
                {tk("verifiedBadge")}
              </span>
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">
              {tk("distributionTitle")}
            </h3>
            <p className="mt-1 font-body text-sm text-muted-foreground">
              {tk("distributionSub")}
            </p>
            <div className="mt-3 flex items-center justify-center gap-4">
              <span className="font-mono text-lg font-bold text-foreground">
                1,000,000,000 RSTN
              </span>
              <span className="text-xs text-muted-foreground">|</span>
              <span className="font-mono text-xs text-primary">
                {tk("hardCapImmutable")}
              </span>
            </div>
          </div>

          {/* Distribution bars */}
          <div className="space-y-5 max-w-3xl mx-auto">
            {TOKENOMICS.map((item, i) => (
              <motion.div
                key={item.allocation}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
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
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 + 0.2 }}
                  />
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Bottom metrics */}
          <div className="mt-8 grid grid-cols-4 gap-4 pt-6 border-t border-border/30">
            <div className="text-center">
              <p className="font-mono text-sm font-bold text-primary">
                1B RSTN
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {tk("metricHardCap")}
              </p>
            </div>
            <div className="text-center border-x border-border/30">
              <p className="font-mono text-sm font-bold text-violet">
                32,000 RSTN
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {tk("metricMinStake")}
              </p>
            </div>
            <div className="text-center border-r border-border/30">
              <p className="font-mono text-sm font-bold text-amber">
                {tk("stakingRewardsVal")}
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {tk("metricApr")}
              </p>
            </div>
            <div className="text-center">
              <p className="font-mono text-sm font-bold text-success">100%</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {tk("metricFairLaunch")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
