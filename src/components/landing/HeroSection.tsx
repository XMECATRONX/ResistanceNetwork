import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Zap, ShieldCheck, Clock, Activity } from "lucide-react";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";
import { HeroVisual } from "@/components/landing/HeroVisual";

const HERO_STATS = [
  {
    labelKey: "hero.stats.tps",
    value: 250,
    suffix: "K",
    icon: Zap,
    color: "hsl(150 100% 45%)",
  },
  {
    labelKey: "hero.stats.finality",
    value: 0.4,
    suffix: "s",
    icon: Clock,
    color: "hsl(185 100% 55%)",
    decimals: 1,
  },
  {
    labelKey: "hero.stats.pqCoverage",
    value: 10,
    suffix: "/10",
    icon: ShieldCheck,
    color: "hsl(150 100% 45%)",
  },
  {
    labelKey: "hero.stats.shards",
    value: 64,
    icon: Activity,
    color: "hsl(150 100% 45%)",
  },
];

/**
 * Landing page — Hero section.
 * Badge, headline, CTA, 3D visual and animated stats grid.
 */
export const HeroSection = () => {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-radial" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:py-16 lg:py-28">
        <div className="hero-grid grid items-center gap-6 sm:gap-12 lg:grid-cols-[1.2fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 bg-surface-1 sm:px-4">
              <span className="dot dot-pulse shrink-0" />
              <span className="label-muted text-[9px] sm:text-[10px]">
                {t("hero.badge")}
              </span>
            </div>
            <h1
              className="hero-heading font-display text-[26px] font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-4xl sm:leading-[1.05] lg:text-6xl"
              dangerouslySetInnerHTML={{ __html: t("hero.title") }}
            />
            <p className="mt-5 max-w-xl font-body text-sm leading-relaxed text-muted-foreground sm:text-lg">
              {t("hero.subtitle")}
            </p>
            <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:mt-10">
              <Link
                to="/terminal"
                className="group inline-flex items-center gap-2 rounded-lg px-6 py-3 font-body text-sm font-semibold transition-all bg-primary text-primary-foreground hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              >
                {t("hero.cta")}
              </Link>
            </div>
          </motion.div>
          <HeroVisual />
        </div>
        <div className="mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:mt-16 lg:grid-cols-4">
          {HERO_STATS.map((stat, i) => (
            <motion.div
              key={stat.labelKey}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ y: -2 }}
              className="group relative flex flex-col items-center gap-2 p-3 sm:p-6 bg-surface-1 transition-colors hover:bg-surface-2 cursor-default"
            >
              <stat.icon
                className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 group-hover:scale-110"
                style={{ color: stat.color }}
              />
              <span className="font-mono text-lg sm:text-2xl font-bold text-foreground">
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix || ""}
                  decimals={stat.decimals || 0}
                />
              </span>
              <span className="label-muted text-[9px] sm:text-[10px]">
                {t(stat.labelKey)}
              </span>
              <span
                className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 ease-out"
                style={{
                  background: stat.color,
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
