import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { lazy, Suspense } from "react";
import { DISEASES, QUANTUM_DEFENSE } from "@/lib/protocol";
import { TiltCard } from "@/components/landing/TiltCard";

const ArchitectureStack3D = lazy(() =>
  import("@/components/landing/ArchitectureStack3D").then((m) => ({
    default: m.ArchitectureStack3D,
  })),
);
const Globe3D = lazy(() =>
  import("@/components/landing/Globe3D").then((m) => ({ default: m.Globe3D })),
);
const TransactionFlow3D = lazy(() =>
  import("@/components/landing/TransactionFlow3D").then((m) => ({
    default: m.TransactionFlow3D,
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

const SectionLabel = ({ label, title }: { label: string; title: string }) => (
  <>
    <motion.span
      className="label"
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
    >
      {label}
    </motion.span>
    <motion.h2
      className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {title}
    </motion.h2>
  </>
);

/**
 * Landing page — Vision, Architecture, Flow, Crypto and Global sections.
 * Grouped together as they share the same label/title/3D pattern.
 */
export const ProtocolSections = () => {
  const { t } = useTranslation();

  return (
    <>
      {/* Vision Section */}
      <section
        id="vision"
        className="relative border-t border-border py-12 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <SectionLabel
            label={t("sections.vision.label")}
            title={t("sections.vision.title")}
          />
          <div className="mt-10 flex flex-wrap justify-center gap-4 text-left sm:mt-16">
            {DISEASES.map((disease, i) => (
              <motion.div
                key={disease.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                className="card-sig w-full p-5 sm:w-[calc(50%-0.5rem)] lg:w-[calc(20%-0.8rem)]"
              >
                <span className="badge-num">{disease.id}</span>
                <h3 className="mt-4 font-display text-sm font-semibold">
                  {disease.name}
                </h3>
                <p className="mt-2 font-body text-xs text-muted-foreground">
                  {disease.problem}
                </p>
                <div className="mt-3 rounded-md border border-border p-3 bg-primary/5">
                  <p className="font-body text-xs text-foreground">
                    <span className="font-semibold text-primary">
                      {t("sections.migration.solution")}{" "}
                    </span>
                    {disease.solution}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section
        id="architecture"
        className="relative border-t border-border py-12 bg-surface-1 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <SectionLabel
            label={t("sections.architecture.label")}
            title={t("sections.architecture.title")}
          />
          <Lazy3D>
            <ArchitectureStack3D />
          </Lazy3D>
        </div>
      </section>

      {/* Transaction Flow Section */}
      <section
        id="flow"
        className="relative border-t border-border py-12 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <SectionLabel
            label={t("sections.flow.label")}
            title={t("sections.flow.title")}
          />
          <p className="mt-4 max-w-2xl mx-auto font-body text-xs leading-relaxed text-muted-foreground sm:text-sm px-2">
            {t("sections.flow.desc")}
          </p>
          <Lazy3D>
            <TransactionFlow3D />
          </Lazy3D>
        </div>
      </section>

      {/* Crypto Section */}
      <section
        id="crypto"
        className="relative border-t border-border py-12 bg-surface-1 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <SectionLabel
            label={t("sections.crypto.label")}
            title={t("sections.crypto.title")}
          />
          <div className="mt-12 flex flex-wrap justify-center gap-4 text-left sm:mt-16">
            {QUANTUM_DEFENSE.map((defense, i) => (
              <motion.div
                key={defense.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
              >
                <TiltCard className="card-sig h-full p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2"
                      style={{ border: `1px solid ${defense.color}33` }}
                    >
                      <Lock
                        className="h-5 w-5"
                        style={{ color: defense.color }}
                      />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-semibold">
                        {defense.name}
                      </h3>
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: defense.color }}
                      >
                        {defense.scheme}
                      </span>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Global Network */}
      <section
        id="global"
        className="relative border-t border-border py-12 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <SectionLabel
            label={t("sections.global.label")}
            title={t("sections.global.title")}
          />
          <Lazy3D>
            <Globe3D />
          </Lazy3D>
        </div>
      </section>
    </>
  );
};

export default ProtocolSections;
