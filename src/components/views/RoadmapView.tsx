import { motion } from "framer-motion";
import { ShieldCheck, Bug, ExternalLink } from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";

export const RoadmapView = () => {
  return (
    <div className="space-y-6">
      {/* Security Audits */}
      <Panel
        title="Auditorías de Seguridad"
        description="3 auditorías independientes antes del mainnet. Cada primitivo criptográfico se audita por separado."
      >
        <div className="space-y-3">
          {[
            {
              firm: "Auditoría criptográfica",
              scope: "Suite post-cuántica (Dilithium3, Kyber, Lattice-VRF)",
              status: "Pendiente",
              phase: "Pre-testnet privada",
            },
            {
              firm: "Auditoría de consenso",
              scope: "BFT+DAG, VRF, slashing, sharding",
              status: "Pendiente",
              phase: "Pre-testnet pública",
            },
            {
              firm: "Auditoría de cliente",
              scope: "rstn-node, P2P, RPC, almacenamiento (RSTN)",
              status: "Pendiente",
              phase: "Pre-mainnet",
            },
          ].map((audit, i) => (
            <motion.div
              key={audit.scope}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-hover flex items-center justify-between gap-4 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
                  <ShieldCheck
                    className="h-4 w-4 text-primary"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <p className="font-display text-sm font-semibold text-foreground">
                    {audit.firm}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    {audit.scope}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="tag text-[10px]">{audit.status}</span>
                <p className="mt-1 label-muted text-[10px]">{audit.phase}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* Bug Bounty */}
      <Panel
        title="Programa de Bug Bounty"
        description="Recompensas por vulnerabilidades reportadas. Los montos se anunciarán antes del testnet público."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              level: "Crítico",
              desc: "Compromiso de claves, robo de fondos, romper consenso",
              color: "hsl(150 100% 55%)",
            },
            {
              level: "Alto",
              desc: "Censura, DoS, bypass de slashing",
              color: "hsl(150 70% 50%)",
            },
            {
              level: "Medio",
              desc: "Fugas de información, degradación de rendimiento",
              color: "hsl(150 100% 45%)",
            },
          ].map((tier, i) => (
            <motion.div
              key={tier.level}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-hover p-5"
            >
              <div className="flex items-center gap-2">
                <Bug
                  className="h-4 w-4"
                  style={{ color: tier.color }}
                  strokeWidth={1.5}
                />
                <h4
                  className="font-display text-sm font-semibold"
                  style={{ color: tier.color }}
                >
                  {tier.level}
                </h4>
              </div>
              <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
                {tier.desc}
              </p>
              <p className="mt-3 font-mono text-xs font-bold text-muted-foreground">
                Recompensa: A definir
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex items-start gap-3">
            <ExternalLink
              className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground"
              strokeWidth={1.5}
            />
            <p className="font-body text-xs leading-relaxed text-muted-foreground">
              El programa de bug bounty se publicará en plataformas
              especializadas antes del lanzamiento del testnet público. Los
              reportes responsables durante la fase de testnet privada se
              compensarán con RSTN de la asignación de ecosistema.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
};
