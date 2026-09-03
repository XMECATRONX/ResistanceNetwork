import { motion } from "framer-motion";
import {
  Shield,
  Network,
  Layers,
  EyeOff,
  Siren,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { alpha } from "@/lib/utils";
import {
  HONEST_QUANTUM_DEFENSE,
  NOT_IMPLEMENTED_CRYPTO,
  STATUS_LABELS,
} from "@/lib/protocolClaims";

const STATUS_BADGE: Record<string, string> = {
  implementado: "hsl(150 100% 45%)",
  testnet: "hsl(150 100% 55%)",
  parcial: "hsl(150 70% 50%)",
  roadmap: "hsl(150 100% 45%)",
  "no-implementado": "hsl(5 80% 55%)",
};

const ICONS: Record<number, typeof Network> = {
  1: Network,
  2: Layers,
  3: EyeOff,
  4: Siren,
  5: Wallet,
  6: Shield,
};

export const QuantumDefenseList = () => {
  return (
    <div className="space-y-3">
      {HONEST_QUANTUM_DEFENSE.map((defense, i) => {
        const Icon = ICONS[defense.id] || Shield;
        const badgeColor = STATUS_BADGE[defense.status] || "hsl(5 80% 55%)";
        return (
          <motion.div
            key={defense.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-sig p-4"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="flex items-start gap-3 lg:w-72">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: alpha(defense.color, 0.1),
                    border: `1px solid ${alpha(defense.color, 0.25)}`,
                  }}
                >
                  <Icon
                    className="h-4 w-4"
                    style={{ color: defense.color }}
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h4 className="font-display text-sm font-semibold text-foreground">
                    {defense.name}
                  </h4>
                  <p className="font-body text-xs text-muted-foreground">
                    {defense.layer}
                  </p>
                  <span
                    className="tag mt-1.5 inline-block text-[10px]"
                    style={{
                      borderColor: alpha(defense.color, 0.2),
                      color: defense.color,
                      background: alpha(defense.color, 0.08),
                    }}
                  >
                    {defense.scheme}
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive/60"
                    strokeWidth={1.5}
                  />
                  <p className="font-body text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-destructive/80">
                      Amenaza:
                    </span>{" "}
                    {defense.threat}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Shield
                    className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60"
                    strokeWidth={1.5}
                  />
                  <p className="font-body text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-primary/80">
                      Solución:
                    </span>{" "}
                    {defense.solution}
                  </p>
                </div>

                {/* Status + coverage + verify command */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[9px] font-bold"
                    style={{
                      color: badgeColor,
                      background: alpha(badgeColor, 0.08),
                      border: `1px solid ${alpha(badgeColor, 0.2)}`,
                    }}
                  >
                    {STATUS_LABELS[defense.status as keyof typeof STATUS_LABELS]
                      ?.label || defense.status}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {defense.coverage}% cobertura
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground/70">
                    ${defense.verify}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* What does NOT exist */}
      <div className="mt-6">
        <h4 className="mb-3 font-display text-sm font-semibold text-foreground">
          Lo que NO existe en el código (aún)
        </h4>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {NOT_IMPLEMENTED_CRYPTO.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-hover p-3"
              style={{ borderColor: "hsl(5 80% 55% / 0.12)" }}
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold"
                  style={{
                    background: "hsl(5 80% 55% / 0.1)",
                    color: "hsl(5 80% 55%)",
                  }}
                >
                  ✕
                </span>
                <div>
                  <h5 className="font-display text-xs font-bold text-foreground">
                    {item.name}
                  </h5>
                  <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                    <span className="text-muted-foreground/60">
                      Claim original:
                    </span>{" "}
                    {item.claim}
                  </p>
                  <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-destructive/80">
                      Realidad:
                    </span>{" "}
                    {item.reality}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
