import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { lazy, Suspense } from "react";
import { SECURITY_MITIGATIONS } from "@/lib/protocol";

const QuantumTimeline = lazy(() =>
  import("@/components/landing/QuantumTimeline").then((m) => ({
    default: m.QuantumTimeline,
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
 * Landing page — Security & Defense in Depth section.
 * 12 attack vectors mitigated + Quantum Threat Timeline.
 */
export const SecuritySection = () => {
  const { t, i18n } = useTranslation();

  return (
    <section
      id="security"
      className="relative border-t border-border py-12 bg-surface-1 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <motion.span
          className="label"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          {t("sections.security.label")}
        </motion.span>
        <motion.h2
          className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {t("sections.security.title")}
        </motion.h2>
        <p className="mt-4 max-w-2xl mx-auto font-body text-xs leading-relaxed text-muted-foreground sm:text-sm px-2">
          {t("sections.security.desc")}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4 text-left sm:mt-16">
          {SECURITY_MITIGATIONS.map((mit, i) => (
            <motion.div
              key={mit.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              className="card-sig w-full p-5 sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="badge-num">{mit.id}</span>
                <span
                  className="tag"
                  style={{
                    borderColor: `${mit.color}33`,
                    color: mit.color,
                  }}
                >
                  {mit.layer}
                </span>
              </div>
              <h3 className="font-display text-sm font-semibold">
                {mit.vector}
              </h3>
              <p className="mt-2 font-body text-xs text-muted-foreground">
                {mit.threat}
              </p>
              <div className="mt-3 rounded-md border border-border p-3 bg-primary/5">
                <p className="font-body text-xs text-foreground">
                  <span className="font-semibold" style={{ color: mit.color }}>
                    {i18n.language === "en" ? "Mitigation: " : "Mitigación: "}
                  </span>
                  {mit.solution}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {mit.mechanism}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted-foreground line-through">
                    {mit.riskBefore}
                  </span>
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <span
                    className="font-mono text-[10px] font-bold"
                    style={{ color: mit.color }}
                  >
                    {mit.riskAfter}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <div className="data-bar-track">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${mit.coverage}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.05 }}
                    className="data-bar-fill"
                    style={{ background: mit.color }}
                  />
                </div>
                <span className="mt-1 block font-mono text-[9px] text-muted-foreground text-right">
                  {mit.coverage}% cobertura
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quantum Threat Timeline */}
        <Lazy3D>
          <QuantumTimeline />
        </Lazy3D>
      </div>
    </section>
  );
};

export default SecuritySection;
