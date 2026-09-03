import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BRIDGE_ECONOMICS, BRIDGE_TRANSPARENCY } from "@/lib/protocol";

/**
 * Landing page — Bridge Economics section.
 * 60/30/10 revenue split, fee structure, double deflation and transparency stats.
 */
export const EconomicsSection = () => {
  const { t } = useTranslation();

  return (
    <section
      id="economics"
      className="relative border-t border-border py-12 bg-surface-1 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <motion.span
          className="label"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          {t("sections.economics.label")}
        </motion.span>
        <motion.h2
          className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {t("sections.economics.title")}
        </motion.h2>
        <p className="mt-4 max-w-2xl mx-auto font-body text-xs leading-relaxed text-muted-foreground sm:text-sm px-2">
          {BRIDGE_ECONOMICS.principle}
        </p>

        {/* 60/30/10 split */}
        <div className="mt-10 grid grid-cols-1 gap-4 text-left sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
          {BRIDGE_ECONOMICS.revenueSplit.map((split, i) => (
            <motion.div
              key={split.destination}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="card-sig p-4 sm:p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="font-mono text-2xl sm:text-3xl font-bold"
                  style={{ color: split.color }}
                >
                  {split.percentage}%
                </span>
                <div
                  className="h-10 w-10 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: `${split.color}33` }}
                >
                  <div
                    className="h-6 w-6 rounded-full"
                    style={{ background: split.color, opacity: 0.2 }}
                  />
                </div>
              </div>
              <h3 className="font-display text-sm font-semibold">
                {split.destination}
              </h3>
              <p className="mt-2 font-body text-xs text-muted-foreground">
                {split.detail}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Fee structure */}
        <div className="mt-8 grid grid-cols-1 gap-3 max-w-3xl mx-auto sm:grid-cols-3">
          <div className="card p-3 sm:p-4 text-center">
            <span className="label-muted text-[8px] sm:text-[9px]">
              {t("sections.economics.standardFee")}
            </span>
            <p className="mt-1 font-mono text-base sm:text-lg font-bold text-foreground">
              {BRIDGE_ECONOMICS.feeStructure.standardRate}
            </p>
          </div>
          <div className="card p-3 sm:p-4 text-center">
            <span className="label-muted text-[8px] sm:text-[9px]">
              {t("sections.economics.fastPath")}
            </span>
            <p className="mt-1 font-mono text-base sm:text-lg font-bold text-foreground">
              {BRIDGE_ECONOMICS.feeStructure.fastPathRate}
            </p>
          </div>
          <div
            className="card p-3 sm:p-4 text-center"
            style={{
              borderColor: "hsl(150 100% 45% / 0.2)",
              background: "hsl(150 100% 45% / 0.04)",
            }}
          >
            <span className="label-muted text-[8px] sm:text-[9px]">
              {t("sections.economics.quantumMigration")}
            </span>
            <p className="mt-1 font-mono text-base sm:text-lg font-bold text-primary">
              {BRIDGE_ECONOMICS.feeStructure.quantumMigrationRate}
            </p>
          </div>
        </div>

        {/* Double deflation */}
        <div
          className="mt-8 max-w-3xl mx-auto rounded-lg border border-border p-5 text-left"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <h3 className="font-display text-sm font-semibold text-center mb-3 sm:mb-4">
            {t("sections.economics.deflationTitle")}
          </h3>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <span className="font-body text-xs font-medium text-foreground">
                  EIP-1559 (gas burn)
                </span>
              </div>
              <p className="font-body text-[11px] text-muted-foreground">
                {BRIDGE_ECONOMICS.deflationaryPressure.eip1559}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: "hsl(150 100% 55%)" }}
                />
                <span className="font-body text-xs font-medium text-foreground">
                  Bridge buyback burn
                </span>
              </div>
              <p className="font-body text-[11px] text-muted-foreground">
                {BRIDGE_ECONOMICS.deflationaryPressure.bridgeBurn}
              </p>
            </div>
          </div>
          <p className="mt-3 font-body text-[11px] text-muted-foreground italic text-center">
            {BRIDGE_ECONOMICS.deflationaryPressure.notGuaranteed}
          </p>
        </div>

        {/* Transparency stats */}
        <div className="mt-8 max-w-4xl mx-auto">
          <h3 className="font-display text-base sm:text-lg font-semibold mb-4 sm:mb-6">
            {t("sections.economics.transparencyTitle")}
          </h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {BRIDGE_TRANSPARENCY.stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -2 }}
                className="card p-3 sm:p-4 text-center transition-colors hover:bg-surface-2"
              >
                <span className="label-muted text-[8px] sm:text-[9px]">
                  {stat.label}
                </span>
                <p
                  className="mt-1 font-mono text-lg sm:text-xl font-bold"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </p>
                <p className="mt-1 font-body text-[9px] sm:text-[10px] text-muted-foreground">
                  {stat.note}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Legal disclaimer */}
        <div
          className="mt-8 max-w-3xl mx-auto flex items-start gap-2 rounded-md border p-3 sm:p-4 text-left"
          style={{
            borderColor: "hsl(150 100% 55% / 0.2)",
            background: "hsl(150 100% 55% / 0.03)",
          }}
        >
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "hsl(150 100% 55%)" }}
            strokeWidth={1.5}
          />
          <div className="space-y-1">
            <p className="font-body text-[11px] leading-relaxed text-foreground">
              {BRIDGE_ECONOMICS.legal.notSecurity}
            </p>
            <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.legal.noGuaranteedYield}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EconomicsSection;
