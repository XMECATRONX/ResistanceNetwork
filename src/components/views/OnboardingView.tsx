import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Cpu,
  Boxes,
  Zap,
  Lock,
  Coins,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Terminal,
  ArrowUpRight,
  Play,
} from "lucide-react";
import type { ViewId } from "@/components/dashboard/Sidebar";

interface OnboardingViewProps {
  onNavigate: (view: ViewId) => void;
}

const GUIDES = [
  {
    id: "overview",
    title: "1. Conoce el Protocolo",
    subtitle: "Soberano, Post-Cuántico, Permissionless",
    description:
      "Resistance Network (RSTN) es una Layer 1 diseñada para resistir ataques de ordenadores cuánticos mediante criptografía de retículos (FIPS 204).",
    icon: ShieldCheck,
    color: "hsl(150 100% 45%)",
    targetView: "architecture" as ViewId,
    ctaLabel: "Ver Arquitectura",
  },
  {
    id: "faucet",
    title: "2. Obtén RSTN de Testnet",
    subtitle: "Gratis y sin KYC",
    description:
      "Usa el Faucet oficial para recibir RSTN de prueba directamente en tu wallet con firmas Dilithium3.",
    icon: Coins,
    color: "hsl(150 100% 45%)",
    targetView: "faucet" as ViewId,
    ctaLabel: "Ir al Faucet",
  },
  {
    id: "staking",
    title: "3. Delega o Opera un Nodo",
    subtitle: "Participación en PoS",
    description:
      "Participa en la seguridad de la red desde 1 RSTN delegando a validadores, o corre tu propio nodo con Docker.",
    icon: Cpu,
    color: "hsl(150 100% 45%)",
    targetView: "staking" as ViewId,
    ctaLabel: "Ver Staking",
  },
];

export const OnboardingView = ({ onNavigate }: OnboardingViewProps) => {
  const [activeGuide, setActiveGuide] = useState(0);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-sig relative overflow-hidden p-6 lg:p-8"
      >
        <div className="relative z-10 max-w-2xl">
          <span className="tag tag-primary mb-3">Guía de Inicio Rápido</span>
          <h2 className="font-display text-2xl font-bold text-foreground lg:text-3xl">
            Bienvenido a{" "}
            <span className="gradient-text">Resistance Network</span>
          </h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
            Sigue estos pasos interactivos para configurar tu wallet, obtener
            RSTN de testnet y participar en la primera blockchain post-cuántica.
          </p>
        </div>
      </motion.div>

      {/* Guide Selector */}
      <div className="grid gap-4 md:grid-cols-3">
        {GUIDES.map((guide, i) => {
          const Icon = guide.icon;
          const isActive = activeGuide === i;
          return (
            <button
              key={guide.id}
              onClick={() => setActiveGuide(i)}
              className="card-sig text-left p-5 transition-all"
              style={{
                borderColor: isActive ? guide.color : "var(--border)",
                background: isActive
                  ? "hsl(150 100% 45% / 0.04)"
                  : "hsl(150 14% 8%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    background: guide.color.replace(")", " / 0.12)"),
                  }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: guide.color }}
                    strokeWidth={1.5}
                  />
                </div>
                <span className="badge-num">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-sm font-semibold text-foreground">
                {guide.title}
              </h3>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {guide.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Guide Content */}
      <AnimatePresence mode="wait">
        {(() => {
          const guide = GUIDES[activeGuide];
          const Icon = guide.icon;
          return (
            <motion.div
              key={guide.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="card-sig p-6 lg:p-8"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3 max-w-xl">
                  <div className="flex items-center gap-3">
                    <Icon
                      className="h-6 w-6"
                      style={{ color: guide.color }}
                      strokeWidth={1.5}
                    />
                    <h3 className="font-display text-lg font-bold text-foreground">
                      {guide.title}
                    </h3>
                  </div>
                  <p className="font-body text-sm leading-relaxed text-muted-foreground">
                    {guide.description}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate(guide.targetView)}
                  className="flex items-center gap-2 rounded-xl px-6 py-3 font-body text-xs font-bold transition-all shrink-0"
                  style={{
                    background: "hsl(150 100% 45%)",
                    color: "hsl(150 60% 4%)",
                    boxShadow: "0 0 20px hsl(150 100% 45% / 0.35)",
                  }}
                >
                  {guide.ctaLabel}
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Bottom CTA Banner */}
      <div className="card-sig p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-display text-sm font-semibold text-foreground">
            ¿Listo para reclamar tokens?
          </h4>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Conecta tu wallet y prueba el Faucet de testnet en un clic.
          </p>
        </div>
        <button
          onClick={() => onNavigate("faucet")}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 font-body text-xs font-bold transition-all shrink-0"
          style={{
            background: "hsl(150 100% 45%)",
            color: "hsl(150 60% 4%)",
            boxShadow: "0 0 16px hsl(150 100% 45% / 0.35)",
          }}
        >
          Reclamar RSTN
        </button>
      </div>
    </div>
  );
};
