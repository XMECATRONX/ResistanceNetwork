import { motion } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  Crosshair,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import {
  HONEST_SECURITY_MITIGATIONS,
  MITIGATION_SUMMARY,
} from "@/lib/protocolClaims";
import { SecurityMitigationList } from "@/components/views/SecurityMitigationList";

export const SecurityView = () => {
  return (
    <div className="space-y-6">
      {/* ─── Honest Framework Overview ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="panel relative overflow-hidden p-6"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <div
          className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-[0.04] blur-3xl"
          style={{ background: "hsl(150 100% 45%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
              <Shield className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Estado real de seguridad — 12 vectores de ataque
              </h2>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                Cada vector mapeado contra el código Rust real. Sin marketing.
                Lo que está implementado, parcial, o sin mitigación.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4 text-center">
              <Crosshair
                className="mx-auto h-5 w-5 text-primary"
                strokeWidth={1.5}
              />
              <p className="mt-2 font-mono text-xl font-bold text-primary">
                {MITIGATION_SUMMARY.total}
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                Vectores de ataque
              </p>
            </div>
            <div className="card p-4 text-center">
              <ShieldCheck
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(150 100% 45%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(150 100% 45%)" }}
              >
                {MITIGATION_SUMMARY.implementado}
              </p>
              <p className="label-muted mt-0.5 text-[10px]">Mitigados</p>
            </div>
            <div className="card p-4 text-center">
              <AlertCircle
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(150 70% 50%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(150 70% 50%)" }}
              >
                {MITIGATION_SUMMARY.parcial}
              </p>
              <p className="label-muted mt-0.5 text-[10px]">Parciales</p>
            </div>
            <div className="card p-4 text-center">
              <XCircle
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(5 80% 55%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(5 80% 55%)" }}
              >
                {MITIGATION_SUMMARY.noImplementado}
              </p>
              <p className="label-muted mt-0.5 text-[10px]">Sin mitigación</p>
            </div>
          </div>

          <div
            className="mt-4 rounded-lg border p-3"
            style={{
              borderColor: "hsl(150 70% 50% / 0.25)",
              background: "hsl(150 70% 50% / 0.05)",
            }}
          >
            <p className="font-body text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                {MITIGATION_SUMMARY.verbatim}.
              </span>{" "}
              El riesgo residual real es{" "}
              <span
                className="font-semibold"
                style={{ color: "hsl(150 70% 50%)" }}
              >
                medio
              </span>
              : el protocolo protege dinero hoy (BFT slashing, governance
              anti-flash-loan, circuit breakers, erasure coding), pero 5
              vectores no tienen mitigación implementada. Ver{" "}
              <span className="font-mono">VERIFICATION.md</span> y{" "}
              <span className="font-mono">TIER3_STATUS.md</span> en el repo.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── 12 attack vectors — honest mitigation status ─── */}
      <Panel
        title="12 Vectores de Ataque — Estado Real de Mitigación"
        description="Cada vector mapeado contra el código Rust. Sin 'implementado en diseño' — solo implementado, parcial, o no existe."
      >
        <SecurityMitigationList />
      </Panel>

      {/* ─── What we're building next ─── */}
      <Panel
        title="Lo que falta construir"
        description="Los 5 vectores sin mitigación. Prioridad del equipo de protocolo."
      >
        <div className="space-y-3">
          {HONEST_SECURITY_MITIGATIONS.filter(
            (v) => v.realStatus === "no-implementado",
          ).map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card-hover p-3"
              style={{ borderColor: "hsl(5 80% 55% / 0.15)" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold"
                  style={{
                    background: "hsl(5 80% 55% / 0.12)",
                    color: "hsl(5 80% 55%)",
                    border: "1px solid hsl(5 80% 55% / 0.25)",
                  }}
                >
                  {v.id}
                </span>
                <div className="flex-1">
                  <h4 className="font-display text-xs font-bold text-foreground">
                    {v.vector}
                  </h4>
                  <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                    {v.realMitigation}
                  </p>
                </div>
                <span
                  className="font-mono text-[10px] font-bold"
                  style={{ color: "hsl(5 80% 55%)" }}
                >
                  {v.coverage}% · {v.riskAfter}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>
    </div>
  );
};
