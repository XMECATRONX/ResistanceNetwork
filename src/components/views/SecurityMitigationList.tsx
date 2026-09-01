import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { alpha } from "@/lib/utils";
import {
  HONEST_SECURITY_MITIGATIONS,
  type ClaimStatus,
} from "@/lib/protocolClaims";

const STATUS_STYLE: Record<
  ClaimStatus,
  { color: string; label: string; Icon: typeof CheckCircle2 }
> = {
  implementado: {
    color: "hsl(150 100% 45%)",
    label: "Mitigado",
    Icon: CheckCircle2,
  },
  testnet: {
    color: "hsl(185 100% 55%)",
    label: "Testnet",
    Icon: CheckCircle2,
  },
  parcial: {
    color: "hsl(150 70% 50%)",
    label: "Parcial",
    Icon: AlertCircle,
  },
  roadmap: {
    color: "hsl(150 100% 45%)",
    label: "Roadmap",
    Icon: AlertCircle,
  },
  "no-implementado": {
    color: "hsl(5 80% 55%)",
    label: "No implementado",
    Icon: XCircle,
  },
};

export const SecurityMitigationList = () => {
  return (
    <div className="space-y-3">
      {HONEST_SECURITY_MITIGATIONS.map((v, i) => {
        const style = STATUS_STYLE[v.realStatus as ClaimStatus];
        const Icon = style.Icon;
        return (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="card-hover p-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
              {/* ID + vector + layer */}
              <div className="flex items-start gap-3 lg:w-72 shrink-0">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold"
                  style={{
                    background: alpha(style.color, 0.1),
                    border: `1px solid ${alpha(style.color, 0.25)}`,
                    color: style.color,
                  }}
                >
                  {v.id}
                </div>
                <div>
                  <h4 className="font-display text-sm font-semibold text-foreground">
                    {v.vector}
                  </h4>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {v.layer}
                  </p>
                </div>
              </div>

              {/* Threat + mitigation + claimed solution */}
              <div className="flex-1 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    style={{ color: alpha("hsl(5 80% 55%)", 0.6) }}
                    strokeWidth={1.5}
                  />
                  <p className="font-body text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-destructive/80">
                      Amenaza:
                    </span>{" "}
                    {v.threat}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Shield
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    style={{ color: alpha(style.color, 0.6) }}
                    strokeWidth={1.5}
                  />
                  <p className="font-body text-xs leading-relaxed text-muted-foreground">
                    <span
                      className="font-medium"
                      style={{ color: style.color }}
                    >
                      Mitigación real:
                    </span>{" "}
                    {v.realMitigation}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                  <p className="font-body text-[11px] leading-relaxed text-muted-foreground/80">
                    <span className="font-medium">Plan original:</span>{" "}
                    {v.claimedSolution}
                  </p>
                </div>

                {/* Coverage bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="label-muted text-[9px]">Cobertura</span>
                    <span
                      className="font-mono text-[10px] font-bold"
                      style={{ color: style.color }}
                    >
                      {v.coverage}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-1">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${v.coverage}%`,
                        background: style.color,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                    <span
                      className="font-mono"
                      style={{ color: "hsl(5 80% 55%)" }}
                    >
                      Antes: {v.riskBefore}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span
                      className="font-mono font-bold"
                      style={{ color: style.color }}
                    >
                      Después: {v.riskAfter}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex shrink-0 flex-col items-end gap-1.5 lg:w-36">
                <span
                  className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[9px] font-bold"
                  style={{
                    color: style.color,
                    background: alpha(style.color, 0.08),
                    border: `1px solid ${alpha(style.color, 0.2)}`,
                  }}
                >
                  <Icon className="h-3 w-3" strokeWidth={2} />
                  {style.label}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
