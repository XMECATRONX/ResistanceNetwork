import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, Cpu, Atom } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Quantum Threat Timeline
 * Visualizes the quantum threat progressing over time.
 * Traditional blockchains (ECDSA/Ed25519) visually "break".
 * RSTN remains intact thanks to Dilithium3 (NIST FIPS 204).
 *
 * IMPORTANT NOTE: The qubits listed are estimates of LOGICAL qubits
 * (with error correction), not physical. IBM Condor (2023) has 1,121
 * physical qubits but only ~10-50 logical. Breaking RSA-2048 requires
 * ~4,000 logical qubits (~millions of physical). Timeline estimates
 * are from the research field and vary widely (2030-2050+).
 * NIST published FIPS 203/204/205 in August 2024.
 */

type Milestone = {
  year: string;
  qubits: string;
  title: string;
  desc: string;
  affected: string[];
  status: "safe" | "warning" | "critical" | "broken";
};

const TIMELINE: Milestone[] = [
  {
    year: "2024",
    qubits: "~50",
    title: "NIST estandariza PQ",
    desc: "FIPS 203/204/205 publicados. La criptografía post-cuántica es oficial. Qubits lógicos estimados: ~50.",
    affected: [],
    status: "safe",
  },
  {
    year: "2026",
    qubits: "~100",
    title: "RSTN Mainnet",
    desc: "Resistance Network lanza con Dilithium3 desde el bloque génesis. Resistente por diseño.",
    affected: [],
    status: "safe",
  },
  {
    year: "2030",
    qubits: "~1,000",
    title: "ECDSA se debilita",
    desc: "Estimaciones del campo sugieren que las computadoras cuánticas podrían acercarse al umbral de riesgo para firmas ECDSA.",
    affected: ["ETH", "SOL", "BSC"],
    status: "warning",
  },
  {
    year: "2035",
    qubits: "~4,000",
    title: "RSA-2048 en riesgo",
    desc: "El consenso académico estima que ~4,000 qubits lógicos podrían romper RSA-2048. Las claves privadas expuestas serían vulnerables.",
    affected: ["BTC", "ETH", "SOL", "ADA", "DOT"],
    status: "critical",
  },
  {
    year: "2040+",
    qubits: "¿?",
    title: "Criptografía clásica obsoleta",
    desc: "Si las estimaciones se cumplen, toda blockchain sin migración post-cuántica sería vulnerable. El timeline exacto es incierto.",
    affected: ["BTC", "ETH", "SOL", "BSC", "AVAX", "ADA", "DOT", "NEAR"],
    status: "broken",
  },
];

const STATUS_CONFIG = {
  safe: {
    color: "hsl(150 100% 45%)",
    bg: "hsl(150 100% 45% / 0.08)",
    border: "hsl(150 100% 45% / 0.25)",
    icon: ShieldCheck,
    label: "Seguro",
  },
  warning: {
    color: "hsl(150 70% 50%)",
    bg: "hsl(150 70% 50% / 0.08)",
    border: "hsl(150 70% 50% / 0.25)",
    icon: AlertTriangle,
    label: "Vulnerable",
  },
  critical: {
    color: "hsl(150 100% 55%)",
    bg: "hsl(150 100% 55% / 0.08)",
    border: "hsl(150 100% 55% / 0.25)",
    icon: AlertTriangle,
    label: "Crítico",
  },
  broken: {
    color: "hsl(0 80% 55%)",
    bg: "hsl(0 80% 55% / 0.08)",
    border: "hsl(0 80% 55% / 0.25)",
    icon: AlertTriangle,
    label: "Comprometido",
  },
};

export const QuantumTimeline = () => {
  const { t } = useTranslation();

  return (
    <div className="mt-12 sm:mt-20">
      <div className="text-left">
        <div className="flex items-center gap-2 mb-2">
          <Atom className="h-4 w-4 text-primary" />
          <span className="font-mono text-[10px] text-primary font-bold tracking-wider uppercase">
            {t("animations.timeline.title")}
          </span>
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground">
          {t("animations.timeline.heading")}
        </h3>
        <p className="mt-2 max-w-2xl font-body text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {t("animations.timeline.description")}
        </p>
      </div>

      {/* Timeline track */}
      <div className="relative mt-10 sm:mt-12">
        {/* Horizontal line — hidden on mobile (grid doesn't align to a single row) */}
        <div className="absolute left-0 right-0 top-[27px] h-px bg-border hidden lg:block" />
        {/* Animated gradient line */}
        <motion.div
          className="absolute left-0 top-[27px] h-px hidden lg:block"
          style={{
            background:
              "linear-gradient(90deg, hsl(150 100% 45%), hsl(150 70% 50%), hsl(0 80% 55%))",
          }}
          initial={{ width: "0%" }}
          whileInView={{ width: "100%" }}
          viewport={{ once: true }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        {/* Milestones — flex-wrap on mobile (centers partial rows), grid on desktop */}
        <div className="flex flex-wrap justify-center gap-4 lg:grid lg:grid-cols-5 lg:gap-3">
          {TIMELINE.map((m, i) => {
            const cfg = STATUS_CONFIG[m.status];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={m.year}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative flex w-[45%] flex-col items-center text-center sm:w-[30%] lg:w-auto"
              >
                {/* Node dot on the line */}
                <div
                  className="relative z-10 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border-2 bg-background"
                  style={{
                    borderColor: cfg.color,
                    boxShadow:
                      m.status === "safe" ? `0 0 12px ${cfg.color}44` : "none",
                  }}
                >
                  <Icon
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    style={{ color: cfg.color }}
                  />
                  {m.status !== "safe" && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2"
                      style={{ borderColor: cfg.color }}
                      animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.3,
                      }}
                    />
                  )}
                </div>

                {/* Year + qubits */}
                <span className="mt-3 font-mono text-sm font-bold text-foreground">
                  {m.year}
                </span>
                <span className="font-mono text-[8px] sm:text-[9px] text-muted-foreground">
                  {m.qubits} qubits lógicos
                </span>

                {/* Card */}
                <motion.div
                  className="mt-3 w-full rounded-lg border p-2.5 sm:p-3 min-h-[160px] lg:min-h-[180px] flex flex-col items-center text-center"
                  style={{ borderColor: cfg.border, background: cfg.bg }}
                  whileHover={{
                    scale: 1.02,
                    boxShadow: `0 0 20px ${cfg.color}22`,
                    borderColor: cfg.color,
                    transition: { duration: 0.2 },
                  }}
                >
                  <h4
                    className="font-display text-[11px] sm:text-xs font-semibold"
                    style={{ color: cfg.color }}
                  >
                    {m.title}
                  </h4>
                  <p className="mt-1.5 font-body text-[10px] sm:text-[11px] leading-relaxed text-muted-foreground flex-1">
                    {m.desc}
                  </p>

                  {/* Affected chains */}
                  {m.affected.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1 justify-center">
                      {m.affected.map((chain) => (
                        <span
                          key={chain}
                          className="font-mono text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded line-through"
                          style={{
                            color: cfg.color,
                            background: `${cfg.color}11`,
                          }}
                        >
                          {chain}
                        </span>
                      ))}
                    </div>
                  )}

                  {m.affected.length === 0 && m.status === "safe" && (
                    <div className="mt-2.5 flex items-center justify-center gap-1">
                      <ShieldCheck
                        className="h-3 w-3"
                        style={{ color: cfg.color }}
                      />
                      <span
                        className="font-mono text-[9px] font-bold"
                        style={{ color: cfg.color }}
                      >
                        RESISTENCIA INMUNE
                      </span>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* RSTN safe bar — bottom callout */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 }}
        className="mt-10 sm:mt-12 flex flex-col items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6 sm:flex-row sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <h4 className="font-display text-xs sm:text-sm font-semibold text-foreground">
              Resistance Network permanece seguro en toda la línea temporal
            </h4>
            <p className="font-body text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              Dilithium3 (NIST FIPS 204) es resistente al algoritmo de Shor. Sin
              migración necesaria.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Cpu className="h-4 w-4 text-primary" />
          <span className="font-mono text-[10px] text-muted-foreground">
            FIPS 204 · Level 3
          </span>
        </div>
      </motion.div>
    </div>
  );
};
