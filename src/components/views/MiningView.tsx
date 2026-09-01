import { motion } from "framer-motion";
import {
  Server,
  Users,
  Smartphone,
  Zap,
  Terminal,
  ArrowRight,
  Leaf,
  CheckCircle2,
  XCircle,
  Rocket,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  PARTICIPATION_TIERS,
  PARTICIPATION_STEPS,
  ENERGY_COMPARISON,
  MINING_MODEL,
  COLD_START_BOOTSTRAP,
} from "@/lib/protocol";
import { Panel } from "@/components/dashboard/Panel";
import { alpha } from "@/lib/utils";

const ICON_MAP: Record<string, typeof Server> = {
  Server,
  Users,
  Smartphone,
};

export const MiningView = () => {
  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="panel bg-mesh bg-noise relative overflow-hidden p-8"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="perspective-grid absolute -bottom-8 left-0 right-0 h-36" />
        </div>
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/[0.05] blur-3xl" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
            <span className="label">
              Proof of Stake Post-Cuántico · Participación
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold leading-tight text-foreground">
            No se mina. <span className="gradient-text">Se participa.</span>
          </h2>
          <p className="mt-4 max-w-2xl font-body text-sm leading-relaxed text-muted-foreground">
            RSTN elimina la minería PoW. Sin GPUs, sin ASICs, sin desperdicio
            energético. La seguridad de la red proviene del stake y la
            criptografía post-cuántica, no de trabajo computacional. 15,000× más
            eficiente.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="tag tag-primary">0.0001 kWh/tx</span>
            <span className="tag tag-accent">Sin hardware especializado</span>
            <span className="tag">Recompensas variables</span>
          </div>
        </div>
      </motion.div>

      {/* 3 Participation Tiers */}
      <Panel
        title="3 Formas de Participar"
        description="Cualquiera puede ser parte de RSTN. Sin permisos, sin KYC obligatorio, sin barreras de entrada. Solo necesitas un VPS de $20/mes o incluso tu teléfono."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {PARTICIPATION_TIERS.map((tier, i) => {
            const Icon = ICON_MAP[tier.icon] || Server;
            return (
              <motion.div
                key={tier.tier}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-sig relative overflow-hidden p-5"
              >
                <div
                  className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-[0.04] blur-2xl"
                  style={{ background: tier.color }}
                />
                <div className="relative">
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-lg"
                      style={{
                        background: alpha(tier.color, 0.1),
                        border: `1px solid ${alpha(tier.color, 0.25)}`,
                      }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: tier.color }}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h4 className="font-display text-base font-semibold text-foreground">
                      {tier.tier}
                    </h4>
                  </div>
                  <p className="mb-4 font-body text-sm text-muted-foreground">
                    {tier.role}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <p className="label-muted text-[10px]">Stake requerido</p>
                      <p
                        className="mt-0.5 font-mono text-sm font-bold"
                        style={{ color: tier.color }}
                      >
                        {tier.stake}
                      </p>
                    </div>
                    <div>
                      <p className="label-muted text-[10px]">Hardware</p>
                      <p className="mt-0.5 font-body text-xs text-foreground">
                        {tier.hardware}
                      </p>
                    </div>
                    <div>
                      <p className="label-muted text-[10px]">Recompensas</p>
                      <p className="mt-0.5 font-body text-xs text-muted-foreground">
                        {tier.rewards}
                      </p>
                    </div>
                    <div>
                      <p className="label-muted text-[10px]">Slashing</p>
                      <p className="mt-0.5 font-body text-xs text-muted-foreground">
                        {tier.slashing}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Panel>

      {/* ¿Cualquiera puede ser validador? */}
      <Panel
        title="¿Cualquiera puede ser validador?"
        description="Sí. Sin permisos, sin aprobación, sin KYC. El protocolo es sin permisos (permissionless) por diseño."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-sig p-5"
          >
            <h4 className="font-display text-sm font-semibold text-foreground mb-3">
              Lo que SÍ necesitas
            </h4>
            <div className="space-y-2.5">
              {[
                {
                  req: "Un VPS de 4 cores y 8GB RAM",
                  cost: "$20-$50/mes (Hetzner, DigitalOcean, AWS)",
                },
                {
                  req: "100GB de almacenamiento SSD",
                  cost: "Incluido en el VPS",
                },
                {
                  req: "32,000 RSTN en stake",
                  cost: "Se adquieren por participación, no por compra",
                },
                {
                  req: "Conexión estable a internet",
                  cost: "Puerto 31402 abierto",
                },
                {
                  req: "Claves Dilithium3 generadas",
                  cost: "Un comando: rstn keys generate",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                    strokeWidth={1.5}
                  />
                  <div>
                    <p className="font-body text-xs font-medium text-foreground">
                      {item.req}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {item.cost}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="card-sig p-5"
            style={{ background: "hsl(150 100% 45% / 0.03)" }}
          >
            <h4 className="font-display text-sm font-semibold text-foreground mb-3">
              Lo que NO necesitas
            </h4>
            <div className="space-y-2.5">
              {[
                "No necesitas GPUs ni ASICs — no hay PoW",
                "No necesitas permiso de nadie — es permissionless",
                "No necesitas KYC — el protocolo no identifica usuarios",
                "No necesitas ser parte del equipo — el equipo no tiene poder especial",
                "No necesitas hardware especializado — un VPS normal sirve",
                "No necesitas ser técnico avanzado — Docker lo simplifica a 1 comando",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <XCircle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
                    strokeWidth={1.5}
                  />
                  <p className="font-body text-xs text-muted-foreground">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Comparativa de barreras de entrada */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 card-sig p-5"
        >
          <h4 className="font-display text-sm font-semibold text-foreground mb-4">
            Barrera de entrada — RSTN vs PoW
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                label: "Hardware inicial",
                rstn: "$0 (VPS existente)",
                pow: "$5,000-$15,000 (ASIC)",
                color: "hsl(150 100% 45%)",
              },
              {
                label: "Energía mensual",
                rstn: "$20-$50 (VPS)",
                pow: "$200-$800 (electricidad)",
                color: "hsl(185 100% 55%)",
              },
              {
                label: "Conocimiento técnico",
                rstn: "Docker básico",
                pow: "Configuración de rigs + cooling",
                color: "hsl(150 100% 45%)",
              },
            ].map((row, i) => (
              <div key={i} className="card-hover p-3">
                <p className="label-muted text-[10px] mb-2">{row.label}</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-mono text-[10px] font-bold"
                      style={{ color: row.color }}
                    >
                      RSTN
                    </span>
                    <span className="font-body text-[11px] text-foreground">
                      {row.rstn}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-destructive/70">
                      PoW
                    </span>
                    <span className="font-body text-[11px] text-muted-foreground">
                      {row.pow}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </Panel>

      {/* How it works — 4 steps */}
      <Panel
        title="Cómo Participar — 4 Pasos"
        description="De cero a producir bloques en minutos. Sin minería, sin hardware caro."
      >
        <div className="relative">
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-border lg:block" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {PARTICIPATION_STEPS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="relative"
              >
                <div className="relative z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-primary/15 bg-surface-2">
                  <span className="font-display text-lg font-bold text-primary">
                    {step.step}
                  </span>
                </div>
                <h4 className="font-display text-sm font-semibold text-foreground">
                  {step.title}
                </h4>
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  {step.description}
                </p>
                <div className="code-block mt-3 p-2.5">
                  <div className="flex items-center gap-2">
                    <Terminal
                      className="h-3.5 w-3.5 shrink-0 text-primary"
                      strokeWidth={1.5}
                    />
                    <code className="font-mono text-[11px] text-primary/80">
                      {step.command}
                    </code>
                  </div>
                </div>
                {i < PARTICIPATION_STEPS.length - 1 && (
                  <ArrowRight
                    className="absolute -right-3 top-5 hidden h-4 w-4 text-border lg:block"
                    strokeWidth={1.5}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Energy + Philosophy + Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title="Eficiencia Energética"
          description="RSTN consume 15,000× menos energía que PoW."
          accent
        >
          <div className="space-y-4">
            {ENERGY_COMPARISON.map((item, i) => (
              <motion.div
                key={item.network}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-body text-sm font-medium text-foreground">
                    {item.network}
                  </span>
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: item.color }}
                  >
                    {item.energy}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-1">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: i === 0 ? "100%" : "0.1%" }}
                    transition={{
                      delay: i * 0.08 + 0.2,
                      duration: 0.6,
                      ease: "easeOut",
                    }}
                    className="h-full rounded-full"
                    style={{ background: item.color }}
                  />
                </div>
              </motion.div>
            ))}
            <div className="flex items-center gap-2 rounded-lg border border-success/15 bg-success/[0.04] p-3">
              <Leaf
                className="h-4 w-4 shrink-0 text-success"
                strokeWidth={1.5}
              />
              <p className="font-body text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {MINING_MODEL.comparison}.
                </span>{" "}
                Una transacción RSTN consume lo mismo que cargar tu teléfono 0.5
                segundos.
              </p>
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <div
            className="panel accent-bar bg-mesh p-5"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-start gap-3">
              <Zap
                className="h-5 w-5 shrink-0 text-primary"
                strokeWidth={1.5}
              />
              <div>
                <h4 className="font-display text-sm font-semibold text-foreground">
                  La diferencia fundamental
                </h4>
                <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
                  En PoW, gastas electricidad para competir. En RSTN-PoS,{" "}
                  <span className="font-semibold text-foreground">
                    stakeas para colaborar
                  </span>
                  . La seguridad proviene del valor comprometido, no del trabajo
                  desperdiciado. Las recompensas son{" "}
                  <span className="font-semibold text-primary">
                    variables según el rendimiento real de la red
                  </span>{" "}
                  — no un yield garantizado. Esto hace que RSTN sea un utility
                  token, no un security.
                </p>
              </div>
            </div>
          </div>

          <Panel
            title="Métricas del Modelo"
            description="Parámetros clave del consenso RSTN-PoS."
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Tipo", value: MINING_MODEL.rewardType },
                { label: "Slashing", value: MINING_MODEL.slashingModel },
                {
                  label: "Rotación VRF",
                  value: MINING_MODEL.validatorRotation,
                },
                { label: "Delegación", value: MINING_MODEL.delegation },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="card-hover p-3"
                >
                  <p className="label-muted text-[10px]">{item.label}</p>
                  <p className="mt-1 font-body text-xs font-medium text-foreground">
                    {item.value}
                  </p>
                </motion.div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Cold Start Bootstrap — Cómo nace la red */}
      <Panel
        title="Arranque en Frío — Cómo nace la red"
        description={COLD_START_BOOTSTRAP.principle}
      >
        {/* Core problem callout */}
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber/20 bg-amber/[0.05] p-4">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber"
            strokeWidth={1.5}
          />
          <div>
            <p className="font-body text-xs font-semibold text-foreground">
              El problema del nodo 1
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
              {COLD_START_BOOTSTRAP.coreProblem}
            </p>
          </div>
        </div>

        {/* 6 phases timeline */}
        <div className="relative">
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-border lg:block" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COLD_START_BOOTSTRAP.phases.map((phase, i) => (
              <motion.div
                key={phase.phase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="card-sig relative overflow-hidden p-4"
              >
                <div
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.04] blur-2xl"
                  style={{ background: phase.color }}
                />
                <div className="relative">
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{
                        background: phase.color.replace(")", " / 0.10)"),
                        border: `1px solid ${phase.color.replace(")", " / 0.25)")}`,
                      }}
                    >
                      <span
                        className="font-display text-sm font-bold"
                        style={{ color: phase.color }}
                      >
                        {phase.phase}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-semibold text-foreground">
                        {phase.name}
                      </h4>
                      <span
                        className="tag tag-xs"
                        style={{
                          color: phase.color,
                          borderColor: phase.color.replace(")", " / 0.30)"),
                          background: phase.color.replace(")", " / 0.06)"),
                        }}
                      >
                        {phase.label}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="label-muted text-[10px]">Nodos</p>
                      <p className="mt-0.5 font-mono text-xs font-bold text-foreground">
                        {phase.nodes}
                      </p>
                    </div>
                    <div>
                      <p className="label-muted text-[10px]">Tolerancia BFT</p>
                      <p
                        className="mt-0.5 font-body text-[11px]"
                        style={{
                          color: phase.canTransact
                            ? "hsl(150 100% 45%)"
                            : "hsl(150 100% 45%)",
                        }}
                      >
                        {phase.bftTolerance}
                      </p>
                    </div>
                    <div>
                      <p className="label-muted text-[10px]">Propósito</p>
                      <p className="mt-0.5 font-body text-[11px] leading-relaxed text-muted-foreground">
                        {phase.purpose}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    {phase.canTransact ? (
                      <CheckCircle2
                        className="h-3 w-3 text-success"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <XCircle
                        className="h-3 w-3 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                    )}
                    <span className="font-body text-[10px] text-muted-foreground">
                      {phase.canTransact
                        ? "Transacciones reales"
                        : "Solo desarrollo"}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Key insight */}
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/[0.04] p-4">
          <Rocket
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            strokeWidth={1.5}
          />
          <p className="font-body text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              Insight clave:
            </span>{" "}
            {COLD_START_BOOTSTRAP.keyInsight}
          </p>
        </div>
      </Panel>

      {/* Early validator incentives */}
      <Panel
        title="Incentivos para Validadores Early"
        description={COLD_START_BOOTSTRAP.earlyValidatorIncentives.principle}
        accent
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="tag tag-primary">
            {COLD_START_BOOTSTRAP.earlyValidatorIncentives.program}
          </span>
        </div>
        <div className="space-y-3">
          {COLD_START_BOOTSTRAP.earlyValidatorIncentives.rewards.map(
            (reward, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-hover p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-body text-xs font-semibold text-foreground">
                    {reward.group}
                  </p>
                  <span className="font-mono text-xs font-bold text-primary">
                    {reward.bonus}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {reward.duration}
                  </span>
                  <span className="font-body text-[10px] text-muted-foreground">
                    · {reward.condition}
                  </span>
                </div>
              </motion.div>
            ),
          )}
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] p-3">
            <CheckCircle2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
              strokeWidth={1.5}
            />
            <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
              {COLD_START_BOOTSTRAP.earlyValidatorIncentives.rationale}
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-success/10 bg-success/[0.03] p-3">
            <Lock
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
              strokeWidth={1.5}
            />
            <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
              {COLD_START_BOOTSTRAP.earlyValidatorIncentives.antiWhale}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
};
