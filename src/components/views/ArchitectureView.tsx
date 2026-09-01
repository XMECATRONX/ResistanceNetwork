import { motion } from "framer-motion";
import { Layers, ArrowDown, ShieldCheck } from "lucide-react";
import { ARCHITECTURE_LAYERS, SECURITY_MITIGATIONS } from "@/lib/protocol";
import { Panel } from "@/components/dashboard/Panel";

export const ArchitectureView = () => {
  return (
    <div className="space-y-6">
      <Panel
        title="Arquitectura de 7 Capas"
        description="Cada capa del protocolo, sus componentes técnicos y tecnologías subyacentes."
      >
        <div className="space-y-2">
          {ARCHITECTURE_LAYERS.map((layer, i) => (
            <motion.div
              key={layer.layer}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                className="card-hover flex items-center gap-4 p-4 md:ml-[calc((7-var(--layer))*16px)]"
                style={{ boxShadow: "var(--shadow-xs)" }}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
                  <span className="font-display text-base font-bold text-primary">
                    {layer.layer}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Layers
                      className="h-3.5 w-3.5 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <h4 className="font-display text-sm font-semibold text-foreground">
                      {layer.name}
                    </h4>
                  </div>
                  <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                    {layer.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {layer.tech.map((tech) => (
                      <span key={tech} className="tag text-[10px]">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
                {i < ARCHITECTURE_LAYERS.length - 1 && (
                  <ArrowDown
                    className="absolute -bottom-2.5 right-6 h-3.5 w-3.5 text-border"
                    strokeWidth={1.5}
                  />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* Security surfaces summary */}
      <Panel
        title="Superficies de Seguridad — Defensa en Profundidad"
        description="19 capas de defensa: 6 post-cuánticas + 12 vectores económicos/de red + 1 dominio de IA adversarial. Cada superficie con su mecanismo de mitigación."
      >
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4 text-center">
            <ShieldCheck
              className="mx-auto h-5 w-5 text-primary"
              strokeWidth={1.5}
            />
            <p className="mt-2 font-mono text-xl font-bold text-primary">6</p>
            <p className="label-muted mt-0.5 text-[10px]">Capas PQ</p>
          </div>
          <div className="card p-4 text-center">
            <ShieldCheck
              className="mx-auto h-5 w-5 text-accent"
              strokeWidth={1.5}
            />
            <p className="mt-2 font-mono text-xl font-bold text-accent">12</p>
            <p className="label-muted mt-0.5 text-[10px]">Vectores mitigados</p>
          </div>
          <div className="card p-4 text-center">
            <ShieldCheck
              className="mx-auto h-5 w-5 text-primary"
              strokeWidth={1.5}
            />
            <p className="mt-2 font-mono text-xl font-bold text-primary">19</p>
            <p className="label-muted mt-0.5 text-[10px]">Defensas totales</p>
          </div>
          <div className="card p-4 text-center">
            <ShieldCheck
              className="mx-auto h-5 w-5 text-accent"
              strokeWidth={1.5}
            />
            <p className="mt-2 font-mono text-xl font-bold text-accent">~12%</p>
            <p className="label-muted mt-0.5 text-[10px]">Riesgo residual</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {SECURITY_MITIGATIONS.map((mit, i) => (
            <motion.div
              key={mit.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card-hover flex items-start gap-3 p-3"
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-mono font-bold"
                style={{
                  background: `${mit.color}15`,
                  color: mit.color,
                  border: `1px solid ${mit.color}30`,
                }}
              >
                {mit.id}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-xs font-bold text-foreground">
                    {mit.vector}
                  </h4>
                  <span
                    className="font-mono text-[9px] font-bold"
                    style={{ color: mit.color }}
                  >
                    {mit.coverage}%
                  </span>
                </div>
                <p className="mt-0.5 font-body text-[11px] leading-relaxed text-muted-foreground">
                  {mit.mechanism}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>
    </div>
  );
};
