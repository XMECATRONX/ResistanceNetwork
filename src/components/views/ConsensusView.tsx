import { motion } from "framer-motion";
import {
  Network,
  Zap,
  Shield,
  GitBranch,
  Users,
  Gauge,
  Lock,
} from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { alpha } from "@/lib/utils";
import { CROSS_SHARD_SPEC } from "@/lib/protocol";

const CONSENSUS_FEATURES = [
  {
    title: "BFT + DAG Híbrido",
    description:
      "Byzantine Fault Tolerance combinado con un Directed Acyclic Graph para procesamiento paralelo. Los bloques fluyen como un DAG, no secuencialmente.",
    icon: GitBranch,
    color: "hsl(150 100% 45%)",
    details: [
      "Tolerancia: 33% validadores maliciosos",
      "Votación pipelined en 2 rondas",
      "Paralelismo nativo entre shards",
    ],
  },
  {
    title: "Finalidad Determinista en 0.4s",
    description:
      "Un bloque queda finalizado e irreversible en 2 rondas de votación BFT. No esperas épocas ni minutos para confirmación final.",
    icon: Zap,
    color: "hsl(150 100% 55%)",
    details: [
      "Ronda 1: Pre-commit (200ms)",
      "Ronda 2: Pre-vote (200ms)",
      "Finalidad: irreversible, no probabilística",
    ],
  },
  {
    title: "VRF Post-Cuántica",
    description:
      "La selección de líderes y asignación de shards usa Lattice-based VRF (Module-LWE). Aleatoriedad verificable, impredecible y resistente a Shor.",
    icon: Shield,
    color: "hsl(150 100% 45%)",
    details: [
      "Líder seleccionado por ronda",
      "Shards asignados con VRF",
      "Sin manipulación posible",
    ],
  },
  {
    title: "Anti-Censura Forced-Inclusion",
    description:
      "Si una transacción es censurada en el bloque N, cualquier validador puede forzarla al bloque N+1. La censura es detectable y punible.",
    icon: Users,
    color: "hsl(150 100% 55%)",
    details: [
      "Mempool público verificable",
      "Window de 1 bloque",
      "Slashing automático al censor",
    ],
  },
];

export const ConsensusView = () => {
  return (
    <div className="space-y-6">
      <Panel
        title="Flujo de Consenso BFT + DAG"
        description="Cómo una transacción viaja desde el mempool hasta la finalidad irreversible en 0.4 segundos."
      >
        <div className="flex flex-col items-center gap-3 lg:flex-row lg:justify-between">
          {[
            {
              step: "1",
              title: "Mempool cifrado",
              desc: "Tx entra cifrada con threshold encryption",
              color: "hsl(150 100% 45%)",
            },
            {
              step: "2",
              title: "DAG paralelo",
              desc: "Validador propone bloque en el DAG",
              color: "hsl(150 100% 45%)",
            },
            {
              step: "3",
              title: "Votación BFT",
              desc: "Ronda 1: pre-commit (200ms)",
              color: "hsl(150 100% 55%)",
            },
            {
              step: "4",
              title: "Finalidad",
              desc: "Ronda 2: pre-vote → finalizado (0.4s)",
              color: "hsl(150 100% 45%)",
            },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="flex w-full items-center gap-3 lg:flex-col lg:items-center"
            >
              <div className="flex flex-1 flex-col items-center lg:w-auto">
                <div
                  className="card flex h-14 w-14 items-center justify-center font-display text-lg font-bold"
                  style={{
                    color: s.color,
                    borderColor: alpha(s.color, 0.3),
                    background: alpha(s.color, 0.08),
                    boxShadow: `0 0 16px ${alpha(s.color, 0.1)}`,
                  }}
                >
                  {s.step}
                </div>
                <h4 className="mt-2 font-display text-xs font-semibold text-foreground">
                  {s.title}
                </h4>
                <p className="mt-0.5 text-center font-body text-[10px] text-muted-foreground">
                  {s.desc}
                </p>
              </div>
              {i < 3 && (
                <div className="hidden text-muted-foreground/30 lg:block">
                  <Network
                    className="h-4 w-4 animate-pulse-soft"
                    strokeWidth={1.5}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CONSENSUS_FEATURES.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-sig p-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{
                    background: alpha(feature.color, 0.1),
                    border: `1px solid ${alpha(feature.color, 0.25)}`,
                  }}
                >
                  <Icon
                    className="h-4 w-4"
                    style={{ color: feature.color }}
                    strokeWidth={1.5}
                  />
                </div>
                <h4 className="font-display text-sm font-semibold text-foreground">
                  {feature.title}
                </h4>
              </div>
              <p className="mt-3 font-body text-xs leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
              <ul className="mt-3 space-y-1.5">
                {feature.details.map((detail) => (
                  <li
                    key={detail}
                    className="flex items-center gap-2 font-body text-xs text-foreground"
                  >
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ background: feature.color }}
                    />
                    {detail}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      <Panel
        title="Sharding Dinámico"
        description="64 fragmentos que escalan linealmente. Cada shard procesa 2,048 TPS de forma independiente."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            className="card flex flex-col items-center justify-center p-5"
            style={{
              borderColor: "hsl(var(--primary) / 0.25)",
              background: "hsl(var(--primary) / 0.03)",
            }}
          >
            <Gauge className="h-7 w-7 text-primary" strokeWidth={1.5} />
            <span className="mt-2 font-display text-2xl font-bold text-primary">
              64
            </span>
            <span className="label-muted mt-1">Shards activos</span>
          </div>
          <div
            className="card flex flex-col items-center justify-center p-5"
            style={{
              borderColor: "hsl(var(--accent) / 0.25)",
              background: "hsl(var(--accent) / 0.03)",
            }}
          >
            <Zap className="h-7 w-7 text-accent" strokeWidth={1.5} />
            <span className="mt-2 font-display text-2xl font-bold text-accent">
              2,048
            </span>
            <span className="label-muted mt-1">TPS por shard</span>
          </div>
          <div className="card flex flex-col items-center justify-center p-5">
            <Network className="h-7 w-7 text-foreground" strokeWidth={1.5} />
            <span className="mt-2 font-display text-2xl font-bold text-foreground">
              131K–250K
            </span>
            <span className="label-muted mt-1">TPS (base → DAG)</span>
          </div>
        </div>
        <p className="mt-4 font-body text-xs leading-relaxed text-muted-foreground">
          Los shards usan cross-shard receipts para comunicación entre
          fragmentos. Las asignaciones de validadores a shards se rotan con VRF
          post-cuántica cada 256 bloques, evitando captura de shards
          individuales.
        </p>
      </Panel>

      <Panel
        title="Atomicidad Cross-Shard — Lock-and-Commit (2PC)"
        description={CROSS_SHARD_SPEC.model}
      >
        <p className="mb-4 font-body text-xs leading-relaxed text-muted-foreground">
          {CROSS_SHARD_SPEC.principle}
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {CROSS_SHARD_SPEC.phases.map((phase, i) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="card-sig p-4"
            >
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                <h4 className="font-display text-xs font-semibold text-foreground">
                  {phase.phase}
                </h4>
              </div>
              <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                {phase.detail}
              </p>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <h4 className="font-display text-xs font-semibold text-foreground">
            Hotspot Problem — Solución
          </h4>
          <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
            {CROSS_SHARD_SPEC.hotspotProblem}
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            {CROSS_SHARD_SPEC.hotspotSolution.map((sol) => (
              <div key={sol.mechanism} className="card p-3">
                <h5 className="font-display text-[11px] font-semibold text-primary">
                  {sol.mechanism}
                </h5>
                <p className="mt-1 font-body text-[10px] leading-relaxed text-muted-foreground">
                  {sol.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-amber/20 bg-amber/[0.04] p-3">
          <p className="font-body text-[11px] leading-relaxed text-amber">
            {CROSS_SHARD_SPEC.limitation}
          </p>
        </div>
      </Panel>
    </div>
  );
};
