import { motion } from "framer-motion";
import {
  TrendingDown,
  Flame,
  Eye,
  CheckCircle2,
  Clock,
  DollarSign,
  Coins,
  Activity,
  ExternalLink,
  Lock,
  BarChart3,
} from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";
import {
  BRIDGE_ECONOMICS,
  BRIDGE_TRANSPARENCY,
  SUPPLY_HISTORY,
  BUYBACK_EVENTS,
  REVENUE_SOURCES,
} from "@/lib/protocol";

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtUsd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n}`;

export const TransparencyView = () => {
  const maxBar = Math.max(...SUPPLY_HISTORY.epochs.map((e) => e.burned));

  return (
    <div className="space-y-6">
      {/* ─── Hero ─── */}
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
              <Eye className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Dashboard de Transparencia
              </h2>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                Volumen del puente, fees, buyback & burn y supply decreciente —
                cada métrica verificable on-chain
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4 text-center">
              <DollarSign
                className="mx-auto h-5 w-5 text-primary"
                strokeWidth={1.5}
              />
              <p className="mt-2 font-mono text-xl font-bold text-primary">
                <AnimatedCounter
                  value={10.2}
                  suffix="M"
                  prefix="$"
                  decimals={1}
                />
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                Volumen puente 24h
              </p>
            </div>
            <div className="card p-4 text-center">
              <Flame
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(185 100% 55%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(185 100% 55%)" }}
              >
                <AnimatedCounter value={SUPPLY_HISTORY.totalBurned} />
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                RSTN quemado total
              </p>
            </div>
            <div className="card p-4 text-center">
              <TrendingDown
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(150 70% 50%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(150 70% 50%)" }}
              >
                <AnimatedCounter value={SUPPLY_HISTORY.currentCirculating} />
              </p>
              <p className="label-muted mt-0.5 text-[10px]">
                Supply circulante
              </p>
            </div>
            <div className="card p-4 text-center">
              <Clock
                className="mx-auto h-5 w-5"
                style={{ color: "hsl(150 100% 45%)" }}
                strokeWidth={1.5}
              />
              <p
                className="mt-2 font-mono text-xl font-bold"
                style={{ color: "hsl(150 100% 45%)" }}
              >
                7d
              </p>
              <p className="label-muted mt-0.5 text-[10px]">Cadencia buyback</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Supply decreciente ─── */}
      <Panel
        title="Supply Circulante — Decreciente"
        description="El supply total baja con cada buyback. Cada barra representa el RSTN quemado acumulado por epoch."
      >
        <div className="flex items-end justify-between gap-1.5 h-48 mb-4">
          {SUPPLY_HISTORY.epochs.map((epoch, i) => {
            const heightPct = (epoch.burned / maxBar) * 100;
            return (
              <motion.div
                key={epoch.epoch}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(heightPct, 2)}%` }}
                transition={{ duration: 0.5, delay: i * 0.03 }}
                className="group relative flex-1 flex flex-col items-center justify-end"
              >
                <motion.div
                  className="w-full rounded-t-sm"
                  style={{
                    background: `linear-gradient(to top, hsl(150 100% 45%), hsl(150 100% 50%))`,
                    opacity: 0.7 + (i / SUPPLY_HISTORY.epochs.length) * 0.3,
                  }}
                />
                <div className="absolute -top-6 hidden group-hover:block z-10 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 shadow-lg">
                  <p className="font-mono text-[9px] text-foreground">
                    {epoch.label}
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground">
                    {fmt(epoch.burned)} quemado
                  </p>
                </div>
                <span className="mt-1.5 font-mono text-[7px] text-muted-foreground/60 -rotate-45 origin-left whitespace-nowrap">
                  {epoch.epoch}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <span className="label-muted text-[9px]">Supply máximo</span>
            <p className="mt-1 font-mono text-lg font-bold text-foreground">
              {fmt(SUPPLY_HISTORY.maxSupply)}
            </p>
            <p className="mt-1 font-body text-[10px] text-muted-foreground">
              Hard cap — nunca se acuña más
            </p>
          </div>
          <div
            className="card p-4"
            style={{
              borderColor: "hsl(150 70% 50% / 0.2)",
              background: "hsl(150 70% 50% / 0.04)",
            }}
          >
            <span className="label-muted text-[9px]">
              Supply circulante actual
            </span>
            <p
              className="mt-1 font-mono text-lg font-bold"
              style={{ color: "hsl(150 70% 50%)" }}
            >
              {fmt(SUPPLY_HISTORY.currentCirculating)}
            </p>
            <p className="mt-1 font-body text-[10px] text-muted-foreground">
              {(
                (SUPPLY_HISTORY.totalBurned / SUPPLY_HISTORY.maxSupply) *
                100
              ).toFixed(2)}
              % reducción
            </p>
          </div>
          <div
            className="card p-4"
            style={{
              borderColor: "hsl(185 100% 55% / 0.2)",
              background: "hsl(185 100% 55% / 0.04)",
            }}
          >
            <span className="label-muted text-[9px]">Total quemado</span>
            <p
              className="mt-1 font-mono text-lg font-bold"
              style={{ color: "hsl(185 100% 55%)" }}
            >
              {fmt(SUPPLY_HISTORY.totalBurned)}
            </p>
            <p className="mt-1 font-body text-[10px] text-muted-foreground">
              {SUPPLY_HISTORY.burnRate}
            </p>
          </div>
        </div>
      </Panel>

      {/* ─── Revenue Split 60/30/10 ─── */}
      <Panel
        title="Distribución de Ingresos — Modelo 60/30/10"
        description={BRIDGE_ECONOMICS.principle}
      >
        {/* Visual donut-like bars */}
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          {BRIDGE_ECONOMICS.revenueSplit.map((split) => (
            <motion.div
              key={split.destination}
              initial={{ width: 0 }}
              animate={{ width: `${split.percentage}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ background: split.color }}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
      </Panel>

      {/* ─── Fuentes de ingreso ─── */}
      <Panel
        title="Fuentes de Ingreso de la Red"
        description="No solo el puente genera ingresos. Cuatro fuentes alimentan el modelo económico."
      >
        <div className="space-y-3">
          {REVENUE_SOURCES.map((src, i) => (
            <motion.div
              key={src.source}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="flex items-center gap-4"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  borderColor: `${src.color}33`,
                  background: `${src.color}0d`,
                }}
              >
                <BarChart3
                  className="h-4 w-4"
                  style={{ color: src.color }}
                  strokeWidth={1.5}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-body text-xs font-medium text-foreground">
                    {src.source}
                  </p>
                  <p
                    className="font-mono text-xs font-bold"
                    style={{ color: src.color }}
                  >
                    {fmtUsd(src.monthlyUsd)}/mes
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${src.share}%` }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    className="h-full rounded-full"
                    style={{ background: src.color }}
                  />
                </div>
                <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                  {src.share}% del total · {fmtUsd(src.annualUsd)}/año
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* ─── Buyback feed en vivo ─── */}
      <Panel
        title="Feed de Buybacks — Verificable On-Chain"
        description="Cada semana el contrato acumula fees, compra RSTN en DEX y lo quema. Cada evento tiene un hash verificable."
      >
        <div className="space-y-2.5">
          {BUYBACK_EVENTS.map((evt, i) => {
            const isPending = evt.status === "pendiente";
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  isPending
                    ? "border-dashed border-border bg-muted/20"
                    : "border-border bg-card"
                }`}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: isPending
                      ? "hsl(150 70% 50% / 0.1)"
                      : "hsl(185 100% 55% / 0.1)",
                  }}
                >
                  {isPending ? (
                    <Clock
                      className="h-4 w-4"
                      style={{ color: "hsl(150 70% 50%)" }}
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Flame
                      className="h-4 w-4"
                      style={{ color: "hsl(185 100% 55%)" }}
                      strokeWidth={1.5}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {evt.week}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[8px] ${
                        isPending
                          ? "border border-amber/20 text-amber bg-amber/[0.06]"
                          : "border border-primary/20 text-primary bg-primary/[0.06]"
                      }`}
                    >
                      {isPending ? "PENDIENTE" : "EJECUTADO"}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {isPending
                      ? "Esperando acumulación de fees — ejecuta el lunes"
                      : `${fmt(evt.resistBurned)} RSTN quemados @ $${evt.resistPrice}`}
                  </p>
                </div>

                {!isPending && (
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Fees
                      </p>
                      <p className="font-mono text-[11px] font-semibold text-foreground">
                        {fmtUsd(evt.feesUsd)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Quemado
                      </p>
                      <p
                        className="font-mono text-[11px] font-bold"
                        style={{ color: "hsl(185 100% 55%)" }}
                      >
                        {fmt(evt.resistBurned)}
                      </p>
                    </div>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-primary/30"
                      title={`Tx: ${evt.txHash}`}
                    >
                      <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    </a>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </Panel>

      {/* ─── Métricas verificables ─── */}
      <Panel
        title="Métricas Verificables"
        description={BRIDGE_TRANSPARENCY.subtitle}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BRIDGE_ECONOMICS.transparency.dashboard.map((item, i) => (
            <motion.div
              key={item.metric}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="card p-4"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="font-body text-[11px] font-medium text-foreground">
                    {item.metric}
                  </p>
                  <p className="mt-1 font-body text-[10px] text-muted-foreground">
                    {item.source}
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/[0.06] px-1.5 py-0.5 font-mono text-[8px] text-primary">
                    <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                    On-chain
                  </span>
                </div>
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

        <div
          className="mt-3 flex items-start gap-2 rounded-md border p-4"
          style={{
            borderColor: "hsl(185 100% 55% / 0.2)",
            background: "hsl(185 100% 55% / 0.03)",
          }}
        >
          <Activity
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "hsl(185 100% 55%)" }}
            strokeWidth={1.5}
          />
          <div>
            <h3
              className="font-display text-xs font-semibold"
              style={{ color: "hsl(185 100% 55%)" }}
            >
              Cadencia de ejecución
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.transparency.cadence}
            </p>
          </div>
        </div>

        <p className="mt-3 text-center font-body text-[10px] text-muted-foreground italic">
          {BRIDGE_TRANSPARENCY.note}
        </p>
      </Panel>

      {/* ─── Compliance ─── */}
      <Panel
        title="Compliance Legal"
        description="Honestidad regulatoria — no prometemos lo que no podemos garantizar"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <Coins className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h3 className="mt-2 font-display text-xs font-semibold text-foreground">
              No es un security
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.legal.notSecurity}
            </p>
          </div>
          <div className="card p-4">
            <TrendingDown
              className="h-4 w-4"
              style={{ color: "hsl(150 70% 50%)" }}
              strokeWidth={1.5}
            />
            <h3 className="mt-2 font-display text-xs font-semibold text-foreground">
              Rendimiento variable
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.legal.noGuaranteedYield}
            </p>
          </div>
          <div className="card p-4">
            <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h3 className="mt-2 font-display text-xs font-semibold text-foreground">
              Clasificación legal
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.legal.howeyTest}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
};
