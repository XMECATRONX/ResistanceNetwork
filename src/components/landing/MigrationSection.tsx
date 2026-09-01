import { motion } from "framer-motion";
import { ArrowLeftRight, CheckCircle2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { lazy, Suspense } from "react";
import { CROSS_CHAIN } from "@/lib/protocol";

const QuantumRefuge3D = lazy(() =>
  import("@/components/landing/QuantumRefuge3D").then((m) => ({
    default: m.QuantumRefuge3D,
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
 * Landing page — Migration & Quantum Refuge section.
 * Bridge types, hack lessons, quantum migration steps and supported chains.
 */
export const MigrationSection = () => {
  const { t } = useTranslation();

  return (
    <section
      id="migration"
      className="relative border-t border-border py-12 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <motion.span
          className="label"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          {t("sections.migration.label")}
        </motion.span>
        <motion.h2
          className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {t("sections.migration.title")}
        </motion.h2>
        <p className="mt-4 max-w-2xl mx-auto font-body text-xs leading-relaxed text-muted-foreground sm:text-sm px-2">
          {CROSS_CHAIN.principle}
        </p>

        {/* Quantum Refuge Animation */}
        <Lazy3D>
          <QuantumRefuge3D />
        </Lazy3D>

        {/* 3 Bridge types */}
        <div className="mt-10 flex flex-wrap justify-center gap-4 text-left sm:mt-16">
          {CROSS_CHAIN.bridges.map((bridge, i) => (
            <motion.div
              key={bridge.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="card-sig w-full p-4 sm:w-[calc(50%-0.5rem)] sm:p-5 lg:w-[calc(33.333%-0.667rem)]"
            >
              <div className="flex items-center gap-2 mb-3">
                <ArrowLeftRight
                  className="h-5 w-5 shrink-0"
                  style={{ color: bridge.color }}
                />
                <h3 className="font-display text-sm font-semibold">
                  {bridge.name}
                </h3>
              </div>
              <span
                className="tag"
                style={{
                  borderColor: `${bridge.color}33`,
                  color: bridge.color,
                }}
              >
                {bridge.type}
              </span>
              <p className="mt-3 font-body text-xs text-muted-foreground">
                {bridge.mechanism}
              </p>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="label-muted text-[9px]">
                    {t("sections.migration.bridgeChains")}
                  </span>
                  <span className="font-mono text-[10px] text-foreground">
                    {bridge.chains}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="label-muted text-[9px]">
                    {t("sections.migration.bridgeLatency")}
                  </span>
                  <span className="font-mono text-[10px] text-foreground">
                    {bridge.latency}
                  </span>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-border p-2.5 bg-primary/5">
                <p className="font-body text-[11px] text-foreground">
                  <span className="font-semibold text-primary">
                    {t("sections.migration.bridgeSecurity")}{" "}
                  </span>
                  {bridge.security}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Hack lessons */}
        <div className="mt-12">
          <h3 className="font-display text-base sm:text-lg font-semibold mb-4 sm:mb-6">
            {t("sections.migration.hackLessonsTitle")}
          </h3>
          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
            {CROSS_CHAIN.hackLessons.map((hack, i) => (
              <motion.div
                key={hack.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-destructive">
                    {hack.name}
                  </span>
                  <span className="font-mono text-sm font-bold text-destructive">
                    {hack.lost}
                  </span>
                </div>
                <p className="font-body text-[11px] text-muted-foreground">
                  {hack.vector}
                </p>
                <div className="mt-2 rounded border border-success/20 bg-success/5 p-2">
                  <p className="font-body text-[11px] text-foreground">
                    <span className="font-semibold text-success">RSTN: </span>
                    {hack.lesson}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quantum Migration steps */}
        <div className="mt-10 sm:mt-12 max-w-4xl mx-auto text-left">
          <h3 className="font-display text-base sm:text-lg font-semibold mb-2 text-center">
            {t("sections.migration.migrationTitle")}
          </h3>
          <p className="text-center font-body text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8">
            {CROSS_CHAIN.quantumMigration.why}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CROSS_CHAIN.quantumMigration.how.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex gap-3"
              >
                <span className="badge-num shrink-0">{step.step}</span>
                <div>
                  <h4 className="font-display text-xs font-semibold">
                    {step.action}
                  </h4>
                  <p className="mt-1 font-body text-[11px] text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-5 text-center">
            <p className="font-body text-sm text-foreground">
              <span className="font-semibold text-primary">
                {t("sections.migration.uniquenessLabel")}{" "}
              </span>
              {CROSS_CHAIN.quantumMigration.uniqueness}
            </p>
          </div>
        </div>

        {/* Supported chains — honest tier */}
        <div className="mt-12 max-w-4xl mx-auto text-left">
          <h3 className="font-display text-base sm:text-lg font-semibold mb-2 text-center">
            {t("sections.migration.supportedChainsTitle")}
          </h3>
          <p className="text-center font-body text-[11px] sm:text-xs text-muted-foreground mb-4 sm:mb-6">
            {t("sections.migration.supportedChainsDesc")}
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card-sig p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2
                  className="h-4 w-4 text-primary"
                  strokeWidth={1.5}
                />
                <span className="font-display text-xs font-semibold text-primary">
                  {t("sections.migration.mainnetLabel")}
                </span>
              </div>
              <div className="space-y-2">
                {CROSS_CHAIN.supportedChains.mainnet.map((c) => (
                  <div
                    key={c.chain}
                    className="flex items-center justify-between"
                  >
                    <span className="font-mono text-xs text-foreground">
                      {c.chain}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {c.model.split("(")[0].trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card-sig p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock
                  className="h-4 w-4 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="font-display text-xs font-semibold text-muted-foreground">
                  {t("sections.migration.futureLabel")}
                </span>
              </div>
              <div className="space-y-1.5">
                {CROSS_CHAIN.supportedChains.future.map((c) => (
                  <div
                    key={c.chain}
                    className="flex items-center justify-between"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.chain}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MigrationSection;
