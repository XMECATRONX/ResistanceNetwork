import { motion } from "framer-motion";
import {
  Terminal,
  Cpu,
  HardDrive,
  Wifi,
  Server,
  Package,
  Network,
  Key,
  ShieldCheck,
  Activity,
  Globe,
  Lock,
  Radio,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GitBranch,
  RefreshCw,
  Users,
  Zap,
  Monitor,
  Eye,
} from "lucide-react";
import {
  NODE_STACK,
  NODE_DEPLOY,
  NETWORK_DISCOVERY,
  NODE_CONNECTION_FLOW,
  VALIDATOR_REGISTRATION,
  EARLY_VALIDATOR_INCENTIVES,
  ONBOARDING_WIZARD,
  NODE_MONITORING,
  FORK_PROTOCOL,
  SEED_NODE_GUIDE,
} from "@/lib/protocol";
import { Panel } from "@/components/dashboard/Panel";

const ICON_MAP: Record<string, typeof Server> = {
  Server,
  Package,
  Network,
  Key,
  ShieldCheck,
  Activity,
};

export const NodesView = () => {
  return (
    <div className="space-y-6">
      {/* Arquitectura del nodo */}
      <Panel
        title="Arquitectura de rstn-node"
        description="El software del nodo RSTN en Rust. 7 capas desde el P2P hasta el RPC. Binario único: rstn-node."
      >
        <div className="space-y-2">
          {NODE_STACK.map((layer, i) => (
            <motion.div
              key={layer.layer}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div
                className="card-hover flex items-center gap-4 p-4"
                style={{ marginLeft: `${(7 - layer.layer) * 14}px` }}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
                  <span className="font-display text-base font-bold text-primary">
                    {layer.layer}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="font-display text-sm font-semibold text-foreground">
                    {layer.name}
                  </h4>
                  <p className="mt-0.5 font-body text-xs text-muted-foreground">
                    {layer.role}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-primary/70">
                    {layer.tech}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* Connection flow — 6 steps */}
      <Panel
        title="Cómo conectarse a la red — Flujo completo"
        description="Desde cero hasta validar bloques. 6 pasos. Sin permisos, sin KYC, sin aprobaciones."
      >
        <div className="relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
          <div className="space-y-3">
            {NODE_CONNECTION_FLOW.map((step, i) => {
              const Icon = ICON_MAP[step.icon] || Server;
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="relative flex gap-4"
                >
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-surface-2">
                    <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 card-sig p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-primary/60">
                        PASO {step.step}
                      </span>
                      <h4 className="font-display text-sm font-semibold text-foreground">
                        {step.title}
                      </h4>
                    </div>
                    <p className="font-body text-xs text-muted-foreground mb-2">
                      {step.detail}
                    </p>
                    <code className="code-block block px-3 py-1.5 font-mono text-[11px] text-primary break-all">
                      {step.command}
                    </code>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* Non-technical onboarding */}
      <Panel
        title="Onboarding sin código — Para usuarios no técnicos"
        description="4 pasos. Cero comandos. Cero terminal. Todo desde la extensión del navegador."
      >
        <div className="mb-5 rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
          <p className="font-body text-sm font-semibold text-foreground">
            {ONBOARDING_WIZARD.noCode}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ONBOARDING_WIZARD.steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-hover p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
                <span className="font-mono text-sm font-bold text-primary">
                  {step.step}
                </span>
              </div>
              <h4 className="mt-3 font-display text-sm font-semibold text-foreground">
                {step.title}
              </h4>
              <p className="mt-1.5 font-body text-xs leading-relaxed text-muted-foreground">
                {step.description}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="tag">{step.action}</span>
              </div>
              <p className="mt-2 font-mono text-[10px] text-primary/60">
                ⏱ {step.time}
              </p>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* Registro de validador on-chain */}
      <Panel
        title="Registro de Validador — Proceso On-Chain"
        description={VALIDATOR_REGISTRATION.principle}
      >
        <div className="relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
          <div className="space-y-3">
            {VALIDATOR_REGISTRATION.steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative flex gap-4"
              >
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-surface-2">
                  <span className="font-mono text-xs font-bold text-primary">
                    {step.step}
                  </span>
                </div>
                <div className="flex-1 card-sig p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="font-display text-sm font-semibold text-foreground">
                      {step.title}
                    </h4>
                    {step.onChain && (
                      <span className="rounded-full border border-primary/20 bg-primary/[0.06] px-2 py-0.5 font-mono text-[9px] font-bold text-primary">
                        ON-CHAIN
                      </span>
                    )}
                  </div>
                  <p className="font-body text-xs text-muted-foreground mb-2">
                    {step.detail}
                  </p>
                  <code className="code-block block px-3 py-1.5 font-mono text-[11px] text-primary break-all">
                    {step.action}
                  </code>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Slashing matrix */}
        <div className="mt-6">
          <h4 className="font-display text-sm font-semibold text-foreground">
            Matriz de Slashing
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 font-body text-xs font-semibold text-muted-foreground">
                    Infracción
                  </th>
                  <th className="pb-2 font-body text-xs font-semibold text-muted-foreground">
                    Penalidad
                  </th>
                  <th className="pb-2 font-body text-xs font-semibold text-muted-foreground">
                    Severidad
                  </th>
                  <th className="pb-2 font-body text-xs font-semibold text-muted-foreground">
                    Recuperable
                  </th>
                </tr>
              </thead>
              <tbody>
                {VALIDATOR_REGISTRATION.slashingMatrix.map((row, i) => {
                  const sevColor =
                    row.severity === "Crítico"
                      ? "hsl(5 80% 55%)"
                      : row.severity === "Severo"
                        ? "hsl(150 100% 55%)"
                        : row.severity === "Moderado"
                          ? "hsl(150 70% 50%)"
                          : "hsl(150 100% 45%)";
                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-border/50"
                    >
                      <td className="py-3 font-body text-xs text-foreground">
                        {row.offense}
                      </td>
                      <td className="py-3 font-mono text-xs text-primary">
                        {row.penalty}
                      </td>
                      <td className="py-3">
                        <span
                          className="font-body text-xs font-semibold"
                          style={{ color: sevColor }}
                        >
                          {row.severity}
                        </span>
                      </td>
                      <td className="py-3 font-body text-xs text-muted-foreground">
                        {row.recoverable}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unbonding */}
        <div className="mt-4 rounded-lg border border-primary/15 bg-primary/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h4 className="font-display text-sm font-semibold text-foreground">
              Unbonding — {VALIDATOR_REGISTRATION.unbonding.period}
            </h4>
          </div>
          <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
            {VALIDATOR_REGISTRATION.unbonding.description}
          </p>
        </div>
      </Panel>

      {/* Incentivos para primeros validadores */}
      <Panel
        title="Incentivos para Validadores Early — Bonus Decreciente"
        description={EARLY_VALIDATOR_INCENTIVES.principle}
      >
        <div className="space-y-3">
          {EARLY_VALIDATOR_INCENTIVES.phases.map((phase, i) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-hover p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-display text-sm font-semibold text-foreground">
                    {phase.phase}
                  </h4>
                  <p className="mt-1 font-mono text-sm font-bold text-primary">
                    {phase.bonus}
                  </p>
                </div>
                <span className="tag">{phase.duration}</span>
              </div>
              <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
                {phase.rationale}
              </p>
              <p className="mt-2 font-body text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Cap: </span>
                {phase.cap}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-hover p-5">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                Anti-Ballena
              </h4>
            </div>
            <p className="font-body text-xs leading-relaxed text-muted-foreground">
              {EARLY_VALIDATOR_INCENTIVES.antiWhale}
            </p>
          </div>
          <div className="card-hover p-5">
            <div className="mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                Sunset
              </h4>
            </div>
            <p className="font-body text-xs leading-relaxed text-muted-foreground">
              {EARLY_VALIDATOR_INCENTIVES.sunset}
            </p>
          </div>
        </div>
      </Panel>

      {/* Dashboard de monitoreo del nodo */}
      <Panel
        title="Monitoreo del Nodo — Métricas en Tiempo Real"
        description={NODE_MONITORING.principle}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NODE_MONITORING.metrics.map((metric, i) => (
            <motion.div
              key={metric.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-hover p-4"
            >
              <div className="flex items-center gap-2">
                <Monitor
                  className="h-3.5 w-3.5 text-primary"
                  strokeWidth={1.5}
                />
                <h4 className="font-display text-xs font-semibold text-foreground">
                  {metric.name}
                </h4>
              </div>
              <p className="mt-1.5 font-body text-xs text-muted-foreground">
                {metric.description}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <code className="font-mono text-[10px] text-primary/70">
                  {metric.key}
                </code>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {metric.unit}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <CheckCircle2
                  className="h-3 w-3 text-primary"
                  strokeWidth={1.5}
                />
                <span className="font-body text-[10px] text-muted-foreground">
                  {metric.healthy}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Alerts */}
        <div className="mt-6">
          <h4 className="mb-3 font-display text-sm font-semibold text-foreground">
            Alertas Automáticas
          </h4>
          <div className="space-y-2">
            {NODE_MONITORING.alerts.map((alert, i) => {
              const Icon =
                alert.level === "Crítico"
                  ? XCircle
                  : alert.level === "Advertencia"
                    ? AlertTriangle
                    : Eye;
              const color =
                alert.level === "Crítico"
                  ? "hsl(5 80% 55%)"
                  : alert.level === "Advertencia"
                    ? "hsl(150 70% 50%)"
                    : "hsl(150 100% 55%)";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface-1 p-3"
                >
                  <Icon
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color }}
                    strokeWidth={1.5}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-body text-xs font-semibold"
                        style={{ color }}
                      >
                        {alert.level}
                      </span>
                      <code className="font-mono text-[10px] text-muted-foreground">
                        {alert.condition}
                      </code>
                    </div>
                    <p className="mt-1 font-body text-xs text-muted-foreground">
                      {alert.action}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Prometheus */}
        <div className="mt-5 rounded-lg border border-primary/15 bg-primary/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h4 className="font-display text-sm font-semibold text-foreground">
              Prometheus + Grafana
            </h4>
          </div>
          <p className="mt-2 font-body text-xs text-muted-foreground">
            {NODE_MONITORING.prometheus.description}
          </p>
          <code className="mt-2 code-block block px-3 py-1.5 font-mono text-[11px] text-primary">
            {NODE_MONITORING.prometheus.endpoint}
          </code>
          <p className="mt-2 font-body text-xs text-muted-foreground">
            {NODE_MONITORING.prometheus.grafana}
          </p>
        </div>
      </Panel>

      {/* Fork coordination + updates */}
      <Panel
        title="Forks Coordinados + Actualizaciones de Software"
        description={FORK_PROTOCOL.principle}
      >
        <div className="space-y-3">
          {FORK_PROTOCOL.types.map((fork, i) => (
            <motion.div
              key={fork.type}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-hover p-5"
            >
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" strokeWidth={1.5} />
                <h4 className="font-display text-sm font-semibold text-foreground">
                  {fork.type}
                </h4>
              </div>
              <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
                {fork.description}
              </p>
              <div className="mt-2 space-y-1">
                <p className="font-body text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Ejemplos:{" "}
                  </span>
                  {fork.examples}
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Activación:{" "}
                  </span>
                  {fork.activation}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Update process */}
        <div className="mt-6">
          <h4 className="mb-3 font-display text-sm font-semibold text-foreground">
            Proceso de Actualización (6 pasos)
          </h4>
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
            <div className="space-y-2">
              {FORK_PROTOCOL.updateProcess.map((step, i) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative flex gap-3"
                >
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-surface-2">
                    <span className="font-mono text-[10px] font-bold text-primary">
                      {step.step}
                    </span>
                  </div>
                  <div className="flex-1 card-sig p-3">
                    <h4 className="font-display text-xs font-semibold text-foreground">
                      {step.title}
                    </h4>
                    <p className="mt-1 font-body text-xs text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Auto-update */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-hover p-5">
            <div className="mb-2 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                Actualización Manual
              </h4>
            </div>
            <code className="code-block block px-3 py-2 font-mono text-xs text-primary">
              {FORK_PROTOCOL.autoUpdate.command}
            </code>
            <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
              {FORK_PROTOCOL.autoUpdate.description}
            </p>
          </div>
          <div className="card-hover p-5">
            <div className="mb-2 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                Rollback
              </h4>
            </div>
            <code className="code-block block px-3 py-2 font-mono text-xs text-foreground">
              {FORK_PROTOCOL.autoUpdate.rollback}
            </code>
            <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
              Revierte a la versión anterior si la nueva falla.
            </p>
          </div>
        </div>
      </Panel>

      {/* Descubrimiento de red */}
      <Panel
        title="Descubrimiento de red — Cómo los nodos se encuentran"
        description="Bootstrapping robusto con 3 mecanismos: seed nodes, DNS discovery y Kademlia DHT."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Seed nodes */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-sig p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                Seed Nodes — 5 regiones
              </h4>
            </div>
            <div className="space-y-2">
              {NETWORK_DISCOVERY.seedNodes.map((node, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/[0.03] px-3 py-2"
                >
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${node.role.includes("primario") ? "bg-primary" : "bg-primary/40"}`}
                  />
                  <code className="font-mono text-[11px] text-foreground">
                    {node.host}
                  </code>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    :{node.port}
                  </span>
                  <span className="font-body text-[10px] text-muted-foreground">
                    {node.region}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-primary/10 bg-surface-3 px-3 py-2">
              <p className="label-muted text-[10px] mb-1">DNS Discovery</p>
              <code className="font-mono text-[11px] text-primary">
                {NETWORK_DISCOVERY.dnsDiscovery}
              </code>
            </div>
          </motion.div>

          {/* Protocolos P2P */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="card-sig p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                Protocolos P2P
              </h4>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Radio
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="font-body text-xs font-medium text-foreground">
                    DHT
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {NETWORK_DISCOVERY.dhtProtocol}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Radio
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="font-body text-xs font-medium text-foreground">
                    Peer Exchange
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {NETWORK_DISCOVERY.peerExchange}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Lock
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="font-body text-xs font-medium text-foreground">
                    Transporte
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {NETWORK_DISCOVERY.transportSecurity}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="font-body text-xs font-medium text-foreground">
                    Peer Scoring
                  </p>
                  <p className="font-body text-[10px] text-muted-foreground">
                    {NETWORK_DISCOVERY.peerScoring}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Network
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="font-body text-xs font-medium text-foreground">
                    NAT Traversal
                  </p>
                  <p className="font-body text-[10px] text-muted-foreground">
                    {NETWORK_DISCOVERY.natTraversal}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Gossipsub topics */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 card-sig p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h4 className="font-display text-sm font-semibold text-foreground">
              Tópicos Gossipsub
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {NETWORK_DISCOVERY.topics.map((topic, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-primary/10 bg-surface-3 px-3 py-2"
              >
                <ArrowRight
                  className="h-3 w-3 shrink-0 text-primary/50"
                  strokeWidth={1.5}
                />
                <div>
                  <code className="font-mono text-[11px] text-primary">
                    {topic.name}
                  </code>
                  <p className="font-body text-[10px] text-muted-foreground">
                    {topic.purpose}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </Panel>

      {/* Seed node setup guide */}
      <Panel
        title="Guía de Seed Node — Cómo operar un punto de entrada"
        description={SEED_NODE_GUIDE.principle}
      >
        <div className="mb-5">
          <h4 className="mb-3 font-display text-sm font-semibold text-foreground">
            Requisitos
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SEED_NODE_GUIDE.requirements.map((req, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card-hover p-4"
              >
                <p className="font-body text-xs font-semibold text-foreground">
                  {req.requirement}
                </p>
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  {req.detail}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <h4 className="mb-3 font-display text-sm font-semibold text-foreground">
            Setup — 4 pasos
          </h4>
          <div className="space-y-2">
            {SEED_NODE_GUIDE.setup.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-sig p-4"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-primary/60">
                    PASO {step.step}
                  </span>
                  <h4 className="font-display text-sm font-semibold text-foreground">
                    {step.title}
                  </h4>
                </div>
                <p className="font-body text-xs text-muted-foreground mb-2">
                  {step.detail}
                </p>
                <code className="code-block block px-3 py-1.5 font-mono text-[11px] text-primary break-all">
                  {step.command}
                </code>
              </motion.div>
            ))}
          </div>
        </div>

        {/* DNS config */}
        <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h4 className="font-display text-sm font-semibold text-foreground">
              Configuración DNS
            </h4>
          </div>
          <p className="mt-2 font-body text-xs text-muted-foreground">
            {SEED_NODE_GUIDE.dnsConfig.description}
          </p>
          <code className="mt-2 code-block block px-3 py-2 font-mono text-[11px] text-primary break-all">
            {SEED_NODE_GUIDE.dnsConfig.record}
          </code>
          <p className="mt-2 font-body text-xs text-muted-foreground">
            {SEED_NODE_GUIDE.dnsConfig.redundancy}
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-accent/20 bg-accent/[0.04] p-4">
          <p className="font-body text-xs font-semibold text-foreground">
            {SEED_NODE_GUIDE.noRewards}
          </p>
        </div>
      </Panel>

      {/* Despliegue + Hardware */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title="Despliegue del Nodo"
          description="Instalación con 1 comando. Cualquier persona puede correr un nodo."
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2">
                <Terminal
                  className="h-3.5 w-3.5 text-primary"
                  strokeWidth={1.5}
                />
                <span className="label">Comando</span>
              </div>
              <code className="code-block block px-3 py-2 font-mono text-sm text-primary break-all">
                {NODE_DEPLOY.command}
              </code>
            </div>
            <div>
              <p className="mb-2 label-muted">Formatos</p>
              <div className="flex flex-wrap gap-2">
                {NODE_DEPLOY.formats.map((fmt) => (
                  <span key={fmt} className="tag">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 label-muted">Binario</p>
              <code className="code-block block px-3 py-2 font-mono text-sm text-foreground">
                {NODE_DEPLOY.binary}
              </code>
            </div>
          </div>
        </Panel>

        <Panel
          title="Requisitos de Hardware"
          description="Sin GPU, sin ASIC. Cualquier PC moderno puede ser validador."
          accent
        >
          <div className="space-y-2.5">
            {[
              { icon: Cpu, label: "CPU", value: NODE_DEPLOY.requirements.cpu },
              {
                icon: HardDrive,
                label: "RAM",
                value: NODE_DEPLOY.requirements.ram,
              },
              {
                icon: HardDrive,
                label: "Disco",
                value: NODE_DEPLOY.requirements.storage,
              },
              {
                icon: Wifi,
                label: "Red",
                value: NODE_DEPLOY.requirements.network,
              },
              { icon: Cpu, label: "GPU", value: NODE_DEPLOY.requirements.gpu },
            ].map((req) => {
              const Icon = req.icon;
              return (
                <div
                  key={req.label}
                  className="card-hover flex items-center gap-3 p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
                    <Icon
                      className="h-3.5 w-3.5 shrink-0 text-primary"
                      strokeWidth={1.5}
                    />
                  </div>
                  <span className="font-body text-sm font-medium text-foreground">
                    {req.label}
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {req.value}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
};
