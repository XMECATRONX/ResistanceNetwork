import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  Shield,
  Clock,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Zap,
  Bitcoin,
  Network,
  Lock,
  Layers,
} from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import {
  CROSS_CHAIN,
  BRIDGE_ECONOMICS,
  BRIDGE_TRANSPARENCY,
  THRESHOLD_THROUGHPUT,
} from "@/lib/protocol";
import { BridgeSimulator } from "@/components/views/BridgeSimulator";
export const BridgeView = () => {
  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
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
              <ArrowLeftRight
                className="h-6 w-6 text-primary"
                strokeWidth={1.5}
              />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Cross-Chain Bridge & Quantum Migration
              </h2>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {CROSS_CHAIN.principle}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4 text-center">
              <ArrowLeftRight
                className="mx-auto h-5 w-5 text-primary"
                strokeWidth={1.5}
              />
              <p className="mt-2 font-mono text-xl font-bold text-primary">3</p>
              <p className="label-muted mt-0.5 text-[10px]">Tipos de puente</p>
            </div>
            <div className="card p-4 text-center">
              <Shield
                className="mx-auto h-5 w-5 text-accent"
                strokeWidth={1.5}
              />
              <p className="mt-2 font-mono text-xl font-bold text-accent">5</p>
              <p className="label-muted mt-0.5 text-[10px]">
                Principios de seguridad
              </p>
            </div>
            <div className="card p-4 text-center">
              <Sparkles
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(185 100% 55%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(185 100% 55%)" }}
              >
                6
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                Pasos migración cuántica
              </p>
            </div>
            <div className="card p-4 text-center">
              <Zap className="mx-auto h-5 w-5 text-primary" strokeWidth={1.5} />
              <p className="mt-2 font-mono text-xl font-bold text-primary">
                PQ
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                Firmas post-cuánticas
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Bridge Types ─── */}
      <Panel
        title="Puentes Cross-Chain"
        description="3 arquitecturas de interoperabilidad — cada una con un trade-off distinto entre seguridad, velocidad y complejidad"
      >
        <div className="space-y-4">
          {CROSS_CHAIN.bridges.map((bridge, i) => (
            <motion.div
              key={bridge.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="card-sig p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="flex items-center gap-3 lg:w-64 lg:shrink-0">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold"
                    style={{
                      background: `${bridge.color}15`,
                      color: bridge.color,
                      border: `1px solid ${bridge.color}30`,
                    }}
                  >
                    {bridge.id}
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      {bridge.name}
                    </h3>
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: bridge.color }}
                    >
                      {bridge.type}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <p className="label-muted text-[10px]">Chains soportadas</p>
                    <p className="mt-1 font-mono text-xs text-foreground">
                      {bridge.chains}
                    </p>
                  </div>
                  <div>
                    <p className="label-muted text-[10px]">Mecanismo</p>
                    <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                      {bridge.mechanism}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div
                      className="rounded-md border border-border p-3"
                      style={{ background: "hsl(150 14% 9%)" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <Shield
                          className="h-3.5 w-3.5"
                          style={{ color: bridge.color }}
                          strokeWidth={1.5}
                        />
                        <p className="label-muted text-[10px]">Seguridad</p>
                      </div>
                      <p className="mt-1.5 font-body text-[11px] leading-relaxed text-foreground">
                        {bridge.security}
                      </p>
                    </div>
                    <div
                      className="rounded-md border border-border p-3"
                      style={{ background: "hsl(150 14% 9%)" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <Clock
                          className="h-3.5 w-3.5"
                          style={{ color: bridge.color }}
                          strokeWidth={1.5}
                        />
                        <p className="label-muted text-[10px]">Latencia</p>
                      </div>
                      <p className="mt-1.5 font-body text-[11px] leading-relaxed text-foreground">
                        {bridge.latency}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-start gap-2 rounded-md border border-border p-3"
                    style={{ background: `${bridge.color}08` }}
                  >
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: "hsl(150 70% 50%)" }}
                      strokeWidth={1.5}
                    />
                    <div>
                      <p className="label-muted text-[10px]">Riesgo residual</p>
                      <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground">
                        {bridge.risk}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="dot"
                      style={{
                        background: bridge.color,
                        boxShadow: `0 0 6px ${bridge.color}40`,
                      }}
                    />
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: bridge.color }}
                    >
                      {bridge.status}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* ─── Bridge Simulator ─── */}
      <BridgeSimulator />

      {/* ─── Supported Chains ─── */}
      <Panel
        title="Chains Soportadas — Mainnet vs Futuro"
        description="RSTN solo soporta chains con un light client implementado y auditado. No soportamos 'cualquier chain' — cada chain requiere ingeniería específica."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Mainnet */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2
                className="h-4 w-4 text-primary"
                strokeWidth={1.5}
              />
              <h3 className="font-display text-xs font-semibold text-primary">
                Mainnet — Diseño completo
              </h3>
            </div>
            <div className="space-y-3">
              {CROSS_CHAIN.supportedChains.mainnet.map((chain, i) => (
                <motion.div
                  key={chain.chain}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="card-sig p-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-mono text-xs font-bold text-foreground">
                      {chain.chain}
                    </h4>
                    <span className="rounded-full px-2 py-0.5 font-mono text-[9px] text-primary border border-primary/20 bg-primary/[0.06]">
                      {chain.status}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <p className="font-body text-[11px] text-muted-foreground">
                      <span className="label-muted">Modelo:</span> {chain.model}
                    </p>
                    <p className="font-body text-[11px] text-muted-foreground">
                      <span className="label-muted">Light client:</span>{" "}
                      {chain.lightClient}
                    </p>
                    <p className="font-body text-[11px] text-muted-foreground">
                      <span className="label-muted">Finality:</span>{" "}
                      {chain.finality}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Future */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Clock
                className="h-4 w-4 text-muted-foreground"
                strokeWidth={1.5}
              />
              <h3 className="font-display text-xs font-semibold text-muted-foreground">
                Futuro — Post-mainnet / Evaluación
              </h3>
            </div>
            <div className="space-y-2">
              {CROSS_CHAIN.supportedChains.future.map((chain, i) => (
                <motion.div
                  key={chain.chain}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="card p-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-mono text-xs font-semibold text-muted-foreground">
                      {chain.chain}
                    </h4>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[9px] border ${
                        chain.status === "Evaluación"
                          ? "text-accent border-accent/20 bg-accent/[0.06]"
                          : "text-muted-foreground border-border bg-muted/30"
                      }`}
                    >
                      {chain.status}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-[11px] text-muted-foreground">
                    {chain.model} · {chain.finality}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="mt-4 flex items-start gap-2 rounded-md border border-border p-4"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-accent"
            strokeWidth={1.5}
          />
          <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
            {CROSS_CHAIN.supportedChains.note}
          </p>
        </div>
      </Panel>

      <Panel
        title="Seguridad de Puentes"
        description="5 principios que hacen que nuestros puentes sean diferentes a los que han perdido $3B+"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {CROSS_CHAIN.securityDesign.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="card-sig flex items-start gap-3 p-4"
            >
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                strokeWidth={1.5}
              />
              <div>
                <h3 className="font-display text-xs font-semibold text-foreground">
                  {item.principle}
                </h3>
                <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* ─── Quantum Migration Program ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="panel relative overflow-hidden p-6"
        style={{
          boxShadow: "var(--shadow-md)",
          borderColor: "hsl(185 100% 55% / 0.25)",
        }}
      >
        <div
          className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-[0.05] blur-3xl"
          style={{ background: "hsl(185 100% 55%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg"
              style={{
                background: "hsl(185 100% 55% / 0.10)",
                border: "1px solid hsl(185 100% 55% / 0.20)",
              }}
            >
              <Sparkles
                className="h-6 w-6"
                style={{ color: "hsl(185 100% 55%)" }}
                strokeWidth={1.5}
              />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Quantum Migration Program
              </h2>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                El diferenciador único de RSTN — sin precedentes en la industria
              </p>
            </div>
          </div>

          <div
            className="mt-5 rounded-md border p-4"
            style={{
              borderColor: "hsl(185 100% 55% / 0.20)",
              background: "hsl(185 100% 55% / 0.04)",
            }}
          >
            <p className="font-body text-sm leading-relaxed text-foreground">
              {CROSS_CHAIN.quantumMigration.why}
            </p>
          </div>

          <div className="mt-6">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Proceso de migración — 6 pasos
            </h3>
            <div className="mt-4 space-y-3">
              {CROSS_CHAIN.quantumMigration.how.map((step) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: step.step * 0.06 }}
                  className="flex items-start gap-3 rounded-md border border-border p-4"
                  style={{ background: "hsl(150 14% 9%)" }}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold"
                    style={{
                      background: "hsl(185 100% 55% / 0.15)",
                      color: "hsl(185 100% 55%)",
                      border: "1px solid hsl(185 100% 55% / 0.30)",
                    }}
                  >
                    {step.step}
                  </div>
                  <div>
                    <h4 className="font-display text-xs font-semibold text-foreground">
                      {step.action}
                    </h4>
                    <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div
              className="rounded-md border border-border p-4"
              style={{ background: "hsl(150 14% 9%)" }}
            >
              <h3 className="font-display text-xs font-semibold text-foreground">
                Por qué somos únicos
              </h3>
              <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                {CROSS_CHAIN.quantumMigration.uniqueness}
              </p>
            </div>
            <div
              className="rounded-md border p-4"
              style={{
                borderColor: "hsl(185 100% 55% / 0.20)",
                background: "hsl(185 100% 55% / 0.04)",
              }}
            >
              <h3
                className="font-display text-xs font-semibold"
                style={{ color: "hsl(185 100% 55%)" }}
              >
                Timeline de activación
              </h3>
              <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground">
                {CROSS_CHAIN.quantumMigration.timeline}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Hack Lessons ─── */}
      <Panel
        title="Lecciones de Hacks Históricos"
        description="$1.7B+ perdido en puentes 2021-2022 — esto es lo que aprendimos y cómo RSTN evita cada vector"
      >
        <div className="space-y-3">
          {CROSS_CHAIN.hackLessons.map((hack, i) => (
            <motion.div
              key={hack.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="card-sig p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <div className="lg:w-56 lg:shrink-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-sm font-bold"
                      style={{ color: "hsl(0 75% 60%)" }}
                    >
                      {hack.lost}
                    </span>
                  </div>
                  <h3 className="mt-1 font-display text-sm font-semibold text-foreground">
                    {hack.name}
                  </h3>
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="label-muted text-[10px]">Vector de ataque</p>
                    <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
                      {hack.vector}
                    </p>
                  </div>
                  <div
                    className="flex items-start gap-2 rounded-md border border-primary/15 p-3"
                    style={{ background: "hsl(150 100% 45% / 0.04)" }}
                  >
                    <Shield
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                      strokeWidth={1.5}
                    />
                    <div>
                      <p className="label-muted text-[10px]">
                        Cómo RSTN lo previene
                      </p>
                      <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground">
                        {hack.lesson}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* ─── BTC Special Handling ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="panel relative overflow-hidden p-6"
        style={{
          boxShadow: "var(--shadow-md)",
          borderColor: "hsl(150 70% 50% / 0.20)",
        }}
      >
        <div
          className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-[0.05] blur-3xl"
          style={{ background: "hsl(150 70% 50%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg"
              style={{
                background: "hsl(150 70% 50% / 0.10)",
                border: "1px solid hsl(150 70% 50% / 0.20)",
              }}
            >
              <Bitcoin
                className="h-6 w-6"
                style={{ color: "hsl(150 70% 50%)" }}
                strokeWidth={1.5}
              />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                BTC — El Caso Especial
              </h2>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                Bitcoin no tiene smart contracts — el puente requiere un
                protocolo de custodia diferente
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div
              className="rounded-md border border-border p-4"
              style={{ background: "hsl(150 14% 9%)" }}
            >
              <p className="label-muted text-[10px]">El desafío</p>
              <p className="mt-1 font-body text-sm leading-relaxed text-foreground">
                {CROSS_CHAIN.btcSpecial.challenge}
              </p>
            </div>

            <div
              className="rounded-md border border-primary/15 p-4"
              style={{ background: "hsl(150 100% 45% / 0.04)" }}
            >
              <p className="label-muted text-[10px] text-primary">
                La solución RSTN (inspirada en tBTC)
              </p>
              <p className="mt-1 font-body text-sm leading-relaxed text-foreground">
                {CROSS_CHAIN.btcSpecial.solution}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="card-sig p-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  <h3 className="font-display text-xs font-semibold text-foreground">
                    Comité de firmantes
                  </h3>
                </div>
                <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                  {CROSS_CHAIN.btcSpecial.signers}
                </p>
              </div>
              <div className="card-sig p-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  <h3 className="font-display text-xs font-semibold text-foreground">
                    Modelo de custodia
                  </h3>
                </div>
                <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                  {CROSS_CHAIN.btcSpecial.custody}
                </p>
              </div>
              <div className="card-sig p-4">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  <h3 className="font-display text-xs font-semibold text-foreground">
                    Verificación SPV
                  </h3>
                </div>
                <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                  {CROSS_CHAIN.btcSpecial.spvVerification}
                </p>
              </div>
              <div className="card-sig p-4">
                <div className="flex items-center gap-2">
                  <Bitcoin className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  <h3 className="font-display text-xs font-semibold text-foreground">
                    Redención de wBTC
                  </h3>
                </div>
                <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                  {CROSS_CHAIN.btcSpecial.redemption}
                </p>
              </div>
            </div>

            <div
              className="mt-3 flex items-start gap-2 rounded-md border p-4"
              style={{
                borderColor: "hsl(150 70% 50% / 0.25)",
                background: "hsl(150 70% 50% / 0.04)",
              }}
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: "hsl(150 70% 50%)" }}
                strokeWidth={1.5}
              />
              <div>
                <h3
                  className="font-display text-xs font-semibold"
                  style={{ color: "hsl(150 70% 50%)" }}
                >
                  Limitación honesta
                </h3>
                <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground">
                  {CROSS_CHAIN.btcSpecial.honestLimitation}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Interoperability Standards ─── */}
      <Panel
        title="Estándares de Interoperabilidad"
        description="Por qué integramos o no integramos cada protocolo — alineado con la tesis post-cuántica"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {CROSS_CHAIN.interoperabilityStandards.map((std, i) => (
            <motion.div
              key={std.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="card-sig p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network
                    className="h-4 w-4 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    {std.name}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                    std.status.includes("Compatible") ||
                    std.status.includes("Evaluación")
                      ? "text-primary border border-primary/20 bg-primary/[0.06]"
                      : "text-muted-foreground border border-border bg-muted/30"
                  }`}
                >
                  {std.status}
                </span>
              </div>
              <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                {std.reason}
              </p>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* ─── Quantum Migration Technical Detail ─── */}
      <Panel
        title="Quantum Migration — Detalle Técnico"
        description="Cómo funciona la migración a nivel criptográfico — respaldo económico, verificación SPV, anti-doble-gasto"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div
            className="card-sig p-4"
            style={{
              borderColor: "hsl(185 100% 55% / 0.20)",
              background: "hsl(185 100% 55% / 0.04)",
            }}
          >
            <div className="flex items-center gap-2">
              <Shield
                className="h-4 w-4"
                style={{ color: "hsl(185 100% 55%)" }}
                strokeWidth={1.5}
              />
              <h3 className="font-display text-xs font-semibold text-foreground">
                Respaldo económico 1:1
              </h3>
            </div>
            <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
              {CROSS_CHAIN.quantumMigrationTechnical.economicBackstop}
            </p>
          </div>
          <div
            className="card-sig p-4"
            style={{
              borderColor: "hsl(185 100% 55% / 0.20)",
              background: "hsl(185 100% 55% / 0.04)",
            }}
          >
            <div className="flex items-center gap-2">
              <Lock
                className="h-4 w-4"
                style={{ color: "hsl(185 100% 55%)" }}
                strokeWidth={1.5}
              />
              <h3 className="font-display text-xs font-semibold text-foreground">
                Flujo del vault/burn
              </h3>
            </div>
            <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
              {CROSS_CHAIN.quantumMigrationTechnical.vaultFlow}
            </p>
          </div>
          <div className="card-sig p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h3 className="font-display text-xs font-semibold text-foreground">
                Prueba de posesión
              </h3>
            </div>
            <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
              {CROSS_CHAIN.quantumMigrationTechnical.proofOfOwnership}
            </p>
          </div>
          <div className="card-sig p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h3 className="font-display text-xs font-semibold text-foreground">
                Anti doble-gasto
              </h3>
            </div>
            <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
              {CROSS_CHAIN.quantumMigrationTechnical.doubleSpendPrevention}
            </p>
          </div>
          <div className="card-sig p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h3 className="font-display text-xs font-semibold text-foreground">
                Finality cross-chain
              </h3>
            </div>
            <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
              {CROSS_CHAIN.quantumMigrationTechnical.crossChainFinality}
            </p>
          </div>
          <div className="card-sig p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className="h-4 w-4 text-primary"
                strokeWidth={1.5}
              />
              <h3 className="font-display text-xs font-semibold text-foreground">
                Replay protection
              </h3>
            </div>
            <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
              {CROSS_CHAIN.quantumMigrationTechnical.replayProtection}
            </p>
          </div>
        </div>

        <div
          className="mt-3 flex items-start gap-2 rounded-md border p-4"
          style={{
            borderColor: "hsl(150 70% 50% / 0.25)",
            background: "hsl(150 70% 50% / 0.04)",
          }}
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "hsl(150 70% 50%)" }}
            strokeWidth={1.5}
          />
          <div>
            <h3
              className="font-display text-xs font-semibold"
              style={{ color: "hsl(150 70% 50%)" }}
            >
              Monedas abandonadas — limitación honesta
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground">
              {CROSS_CHAIN.quantumMigrationTechnical.abandonedCoins}
            </p>
          </div>
        </div>
      </Panel>

      {/* ─── Bridge Economics — Modelo 60/30/10 ─── */}
      <Panel
        title="Economía del Puente — Modelo 60/30/10"
        description={BRIDGE_ECONOMICS.principle}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {BRIDGE_ECONOMICS.revenueSplit.map((split, i) => (
            <motion.div
              key={split.destination}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="card-sig p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="font-mono text-3xl font-bold"
                  style={{ color: split.color }}
                >
                  {split.percentage}%
                </span>
                <div
                  className="h-12 w-12 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: `${split.color}33` }}
                >
                  <div
                    className="h-8 w-8 rounded-full"
                    style={{ background: split.color, opacity: 0.15 }}
                  />
                </div>
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {split.destination}
              </h3>
              <p className="mt-2 font-body text-[11px] leading-relaxed text-muted-foreground">
                {split.detail}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Fee structure */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <span className="label-muted text-[9px]">Fee estándar</span>
            <p className="mt-1 font-mono text-lg font-bold text-foreground">
              {BRIDGE_ECONOMICS.feeStructure.standardRate}
            </p>
            <p className="mt-1 font-body text-[10px] text-muted-foreground">
              {BRIDGE_ECONOMICS.feeStructure.rationale}
            </p>
          </div>
          <div className="card p-4">
            <span className="label-muted text-[9px]">Fast-path</span>
            <p className="mt-1 font-mono text-lg font-bold text-foreground">
              {BRIDGE_ECONOMICS.feeStructure.fastPathRate}
            </p>
            <p className="mt-1 font-body text-[10px] text-muted-foreground">
              Confirmación prioritaria opcional
            </p>
          </div>
          <div
            className="card p-4"
            style={{
              borderColor: "hsl(150 100% 45% / 0.2)",
              background: "hsl(150 100% 45% / 0.04)",
            }}
          >
            <span className="label-muted text-[9px]">Quantum Migration</span>
            <p className="mt-1 font-mono text-lg font-bold text-primary">
              {BRIDGE_ECONOMICS.feeStructure.quantumMigrationRate}
            </p>
            <p className="mt-1 font-body text-[10px] text-muted-foreground">
              Gratis — diferenciador único
            </p>
          </div>
        </div>

        {/* Double deflation */}
        <div
          className="mt-4 rounded-lg border border-border p-5"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <h3 className="font-display text-sm font-semibold text-foreground mb-3">
            Doble mecanismo de escasez
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="font-body text-xs font-medium text-foreground">
                  EIP-1559 Burn
                </span>
              </div>
              <p className="font-body text-[11px] text-muted-foreground">
                {BRIDGE_ECONOMICS.deflationaryPressure.eip1559}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: "hsl(185 100% 55%)" }}
                />
                <span className="font-body text-xs font-medium text-foreground">
                  Bridge Buyback Burn
                </span>
              </div>
              <p className="font-body text-[11px] text-muted-foreground">
                {BRIDGE_ECONOMICS.deflationaryPressure.bridgeBurn}
              </p>
            </div>
          </div>
          <p className="mt-3 font-body text-[11px] text-muted-foreground italic">
            {BRIDGE_ECONOMICS.deflationaryPressure.notGuaranteed}
          </p>
        </div>

        {/* Legal */}
        <div
          className="mt-4 flex items-start gap-2 rounded-md border p-4"
          style={{
            borderColor: "hsl(185 100% 55% / 0.2)",
            background: "hsl(185 100% 55% / 0.03)",
          }}
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "hsl(185 100% 55%)" }}
            strokeWidth={1.5}
          />
          <div className="space-y-1">
            <h3
              className="font-display text-xs font-semibold"
              style={{ color: "hsl(185 100% 55%)" }}
            >
              Compliance — No es un security
            </h3>
            <p className="font-body text-[11px] leading-relaxed text-foreground">
              {BRIDGE_ECONOMICS.legal.notSecurity}
            </p>
            <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.legal.noGuaranteedYield}
            </p>
          </div>
        </div>
      </Panel>

      {/* ─── Transparency Dashboard ─── */}
      <Panel
        title={BRIDGE_TRANSPARENCY.title}
        description={BRIDGE_TRANSPARENCY.subtitle}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BRIDGE_TRANSPARENCY.stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="card p-4"
            >
              <span className="label-muted text-[9px]">{stat.label}</span>
              <p
                className="mt-1 font-mono text-xl font-bold"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>
              <p className="mt-1 font-body text-[10px] text-muted-foreground">
                {stat.note}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Weekly burns table */}
        <div className="mt-4">
          <h3 className="font-display text-xs font-semibold text-foreground mb-3">
            Historial de buyback semanal — verificable on-chain
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 font-mono text-[9px] text-muted-foreground">
                    Semana
                  </th>
                  <th className="pb-2 font-mono text-[9px] text-muted-foreground">
                    Fees
                  </th>
                  <th className="pb-2 font-mono text-[9px] text-muted-foreground">
                    RSTN quemado
                  </th>
                  <th className="pb-2 font-mono text-[9px] text-muted-foreground">
                    Precio
                  </th>
                  <th className="pb-2 font-mono text-[9px] text-muted-foreground">
                    Tx Hash
                  </th>
                </tr>
              </thead>
              <tbody>
                {BRIDGE_TRANSPARENCY.weeklyBurns.map((burn) => (
                  <tr key={burn.week} className="border-b border-border/50">
                    <td className="py-2.5 font-mono text-[11px] text-foreground">
                      {burn.week}
                    </td>
                    <td className="py-2.5 font-mono text-[11px] text-foreground">
                      {burn.fees}
                    </td>
                    <td className="py-2.5 font-mono text-[11px] font-bold text-primary">
                      {burn.resistBurned}
                    </td>
                    <td className="py-2.5 font-mono text-[11px] text-muted-foreground">
                      {burn.resistPrice}
                    </td>
                    <td className="py-2.5 font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {burn.txHash}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transparency principles */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BRIDGE_ECONOMICS.transparency.dashboard.map((item, i) => (
            <motion.div
              key={item.metric}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="flex items-start gap-2.5"
            >
              <CheckCircle2
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                strokeWidth={1.5}
              />
              <div>
                <p className="font-body text-[11px] font-medium text-foreground">
                  {item.metric}
                </p>
                <p className="font-body text-[10px] text-muted-foreground">
                  {item.source}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <div
          className="mt-4 flex items-start gap-2 rounded-md border border-border p-4"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <Lock
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            strokeWidth={1.5}
          />
          <div>
            <h3 className="font-display text-xs font-semibold text-foreground">
              Anti-fraude
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.transparency.antiFraud}
            </p>
          </div>
        </div>

        <p className="mt-3 text-center font-body text-[10px] text-muted-foreground italic">
          {BRIDGE_TRANSPARENCY.note}
        </p>
      </Panel>

      {/* ─── Threshold ECDSA Throughput ─── */}
      <Panel
        title="Capacidad de Migración — Comités Paralelos"
        description={THRESHOLD_THROUGHPUT.solution}
      >
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber/20 bg-amber/[0.04] p-3">
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber"
            strokeWidth={1.5}
          />
          <p className="font-body text-[11px] leading-relaxed text-amber">
            {THRESHOLD_THROUGHPUT.problem}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {THRESHOLD_THROUGHPUT.capacity.map((cap, i) => (
            <motion.div
              key={cap.committees}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="card p-4"
            >
              <div className="flex items-center gap-2">
                <Layers
                  className="h-3.5 w-3.5 text-primary"
                  strokeWidth={1.5}
                />
                <span className="font-display text-lg font-bold text-primary">
                  {cap.committees}
                </span>
                <span className="font-body text-[10px] text-muted-foreground">
                  comités
                </span>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-foreground">
                {cap.throughput}
              </p>
              <p className="mt-1 font-body text-[10px] text-muted-foreground">
                {cap.usersIn12Months}
              </p>
              <p className="mt-2 font-body text-[10px] italic text-muted-foreground">
                {cap.note}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <h4 className="font-display text-xs font-semibold text-foreground">
              Escalado dinámico
            </h4>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {THRESHOLD_THROUGHPUT.scaling}
            </p>
          </div>
          <div>
            <h4 className="font-display text-xs font-semibold text-foreground">
              Tradeoff de seguridad
            </h4>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {THRESHOLD_THROUGHPUT.securityTradeoff}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber/20 bg-amber/[0.04] p-3">
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber"
            strokeWidth={1.5}
          />
          <p className="font-body text-[11px] leading-relaxed text-amber">
            {THRESHOLD_THROUGHPUT.honestLimitation}
          </p>
        </div>
      </Panel>
    </div>
  );
};
