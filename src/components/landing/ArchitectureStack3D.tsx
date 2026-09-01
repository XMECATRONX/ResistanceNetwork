import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ARCHITECTURE_LAYERS } from "@/lib/protocol";

/**
 * 3D Protocol Stack — each layer represents a real protocol layer.
 * The sequential pulse animation shows a transaction flowing upward
 * through the stack: from raw P2P transport (L1) to user-facing
 * applications (L7). This is not decoration — it visualizes the
 * actual data path of every transaction in RSTN.
 *
 * Direction: bottom = network base, top = applications
 * Pulse travels bottom→top = transaction lifecycle
 */
export const ArchitectureStack3D = () => {
  const { t } = useTranslation();
  // Layers ordered from L1 (base) to L7 (apps) — reversed for visual stack
  const layers = [...ARCHITECTURE_LAYERS].reverse();

  return (
    <div className="mx-auto max-w-3xl" style={{ perspective: "1000px" }}>
      {/* Direction indicator — transaction flow */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-muted-foreground">
            {t("animations.arch.p2p")}
          </span>
          <motion.div
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ color: "hsl(150 100% 45%)" }}
          >
            ↑
          </motion.div>
          <span className="font-mono text-[9px] text-muted-foreground">
            {t("animations.arch.apps")}
          </span>
        </div>
        <span className="font-mono text-[9px] text-muted-foreground">
          {t("animations.arch.flow")}
        </span>
      </div>

      <div className="space-y-3">
        {layers.map((layer, i) => (
          <div key={layer.layer} className="relative">
            {/* Vertical connector — data flowing between layers */}
            {i < layers.length - 1 && (
              <div
                className="arch-connector arch-connector-animated absolute"
                style={{
                  height: "12px",
                  top: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: `linear-gradient(180deg, hsl(150 100% 45% / 0.4), hsl(150 100% 45% / 0.05))`,
                }}
              />
            )}

            <motion.div
              initial={{ opacity: 0, z: -80 }}
              whileInView={{ opacity: 1, z: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="arch-layer-3d card flex items-center gap-2 sm:gap-4 p-3 sm:p-4"
              style={{
                transform: `translateZ(${layer.layer * 6}px)`,
                transformStyle: "preserve-3d",
                boxShadow: `0 ${4 + layer.layer * 2}px ${12 + layer.layer * 3}px hsl(150 14% 2% / 0.${20 + layer.layer * 2})`,
              }}
              data-layer={layer.layer}
            >
              {/* Layer number — depth-elevated */}
              <span
                className="font-mono text-xl sm:text-2xl font-bold"
                style={{
                  color: "hsl(150 100% 45%)",
                  textShadow: "0 0 12px hsl(150 100% 45% / 0.4)",
                  transform: "translateZ(15px)",
                }}
              >
                L{layer.layer}
              </span>

              {/* Layer name + component count */}
              <div style={{ transform: "translateZ(10px)" }}>
                <h3 className="font-display text-sm font-semibold text-foreground">
                  {layer.name}
                </h3>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {t("animations.arch.components", { n: layer.tech.length })}
                </p>
              </div>

              {/* Active indicator — pulses when "processing" */}
              <motion.span
                className="ml-auto flex items-center gap-1.5"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
                style={{ transform: "translateZ(8px)" }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: "hsl(150 100% 45%)",
                    boxShadow: "0 0 6px hsl(150 100% 45%)",
                  }}
                />
                <span className="font-mono text-[9px] text-muted-foreground">
                  {t("animations.arch.active")}
                </span>
              </motion.span>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
};
