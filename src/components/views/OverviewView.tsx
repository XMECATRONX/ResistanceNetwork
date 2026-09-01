import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  Database,
  Server,
  Network,
  Cpu,
  HardDrive,
  CheckCircle2,
  Boxes,
  Clock,
  Gauge,
} from "lucide-react";
import { NETWORK_STATS } from "@/lib/protocol";
import { api, type ExplorerStats, type Block } from "@/lib/api";
import { Panel } from "@/components/dashboard/Panel";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";
import { NetworkActivityChart } from "@/components/dashboard/NetworkActivityChart";
import { ConnectionBadge } from "@/components/dashboard/ConnectionBadge";
import {
  SkeletonMetricCard,
  SkeletonBlockItem,
  ErrorBanner,
} from "@/components/dashboard/Skeleton";

const SYSTEM_HEALTH = [
  {
    label: "Consenso",
    status: "Operacional",
    icon: Network,
    color: "hsl(150 100% 45%)",
  },
  {
    label: "P2P Network",
    status: "Operacional",
    icon: Server,
    color: "hsl(150 100% 45%)",
  },
  {
    label: "Storage",
    status: "Operacional",
    icon: HardDrive,
    color: "hsl(185 100% 55%)",
  },
  {
    label: "Sync",
    status: "Sincronizado",
    icon: CheckCircle2,
    color: "hsl(150 60% 50%)",
  },
];

export const OverviewView = () => {
  const [stats, setStats] = useState<ExplorerStats | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [s, b] = await Promise.all([
        api.getExplorerStats(),
        api.getLatestBlocks(6),
      ]);
      setStats(s);
      setBlocks(b);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo conectar al nodo RSTN",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const [s, b] = await Promise.all([
          api.getExplorerStats(),
          api.getLatestBlocks(6),
        ]);
        if (active) {
          setStats(s);
          setBlocks(b);
          setError(null);
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo conectar al nodo RSTN",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const explorerStats = stats ?? {
    blockHeight: 0,
    avgBlockTime: "0.4s",
    tps: 0,
    tpsTarget: 250000,
    activeValidators: 0,
    pendingTxs: 0,
    avgFee: "0.0002 RSTN",
    totalTxCount: "0",
    shardCount: 64,
  };

  const QUICK_METRICS = [
    {
      label: "Throughput actual",
      numeric: explorerStats.tps,
      unit: "TPS",
      icon: Zap,
      color: "hsl(150 100% 45%)",
      decimals: 0,
    },
    {
      label: "Validadores activos",
      numeric: explorerStats.activeValidators,
      unit: "",
      icon: Server,
      color: "hsl(150 100% 45%)",
      decimals: 0,
    },
    {
      label: "Tx pendientes",
      numeric: explorerStats.pendingTxs,
      unit: "",
      icon: Activity,
      color: "hsl(185 100% 55%)",
      decimals: 0,
    },
    {
      label: "Shards activos",
      numeric: explorerStats.shardCount,
      unit: "",
      icon: Boxes,
      color: "hsl(150 70% 50%)",
      decimals: 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Disclaimer — simulated data */}
      <div
        className="flex items-center gap-3 rounded-lg border border-border p-3"
        style={{ background: "hsl(150 70% 50% / 0.04)" }}
      >
        <span
          className="dot"
          style={{
            background: "hsl(150 70% 50%)",
            boxShadow: "0 0 6px hsl(150 70% 50% / 0.40)",
          }}
        />
        <p className="font-body text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold" style={{ color: "hsl(150 70% 50%)" }}>
            Datos simulados —{" "}
          </span>
          RSTN está en Fase 0 (especificación). Las métricas mostradas son
          objetivos de diseño arquitectónicos, no datos en vivo de una red
          operativa.
        </p>
      </div>

      {/* Network status bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="panel relative overflow-hidden p-6"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
              <Cpu className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Estado de la Red
                </h2>
                <ConnectionBadge />
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Bloque #{explorerStats.blockHeight.toLocaleString()} · Época
                actual · Finalidad {explorerStats.avgBlockTime} · Bloque cada{" "}
                {NETWORK_STATS.blockTime}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {SYSTEM_HEALTH.map((sys) => {
              const Icon = sys.icon;
              return (
                <div
                  key={sys.label}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-2"
                >
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: sys.color }}
                    strokeWidth={1.5}
                  />
                  <div>
                    <p className="label-muted text-[9px]">{sys.label}</p>
                    <p
                      className="font-mono text-[11px] font-bold"
                      style={{ color: sys.color }}
                    >
                      {sys.status}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            load();
          }}
        />
      )}

      {/* Quick metrics grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <SkeletonMetricCard key={i} />
            ))
          : QUICK_METRICS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                  className="card-sig group relative overflow-hidden p-5"
                >
                  <div
                    className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.04] blur-2xl transition-opacity group-hover:opacity-[0.10]"
                    style={{ background: stat.color }}
                  />
                  <div className="relative">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="label-muted">{stat.label}</p>
                      <Icon
                        className="h-4 w-4 text-muted-foreground/40"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <AnimatedCounter
                        value={stat.numeric}
                        duration={1.5}
                        decimals={stat.decimals}
                        className="font-display text-2xl font-bold tracking-tight"
                        style={{ color: stat.color }}
                      />
                      {stat.unit && (
                        <span className="font-body text-xs text-muted-foreground">
                          {stat.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
      </div>

      {/* Performance chart + specs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Rendimiento de Red"
          description="Throughput en tiempo real — datos del nodo conectado"
          className="lg:col-span-2"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <NetworkActivityChart />
            </div>
            <div className="hidden shrink-0 flex-col gap-3 sm:flex">
              <div>
                <p className="label-muted text-[10px]">TPS actual</p>
                <p className="mt-1 font-mono text-xl font-bold text-primary">
                  {explorerStats.tps.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="label-muted text-[10px]">TPS objetivo</p>
                <p className="mt-1 font-mono text-xl font-bold text-accent">
                  {NETWORK_STATS.tps.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="label-muted text-[10px]">Fee promedio</p>
                <p className="mt-1 font-mono text-xl font-bold text-foreground">
                  {explorerStats.avgFee}
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Especificaciones Técnicas"
          description="Parámetros del protocolo"
        >
          <div className="space-y-3">
            {[
              {
                label: "Tiempo de bloque",
                value: NETWORK_STATS.blockTime,
                icon: Clock,
              },
              {
                label: "Finalidad",
                value: NETWORK_STATS.finality,
                icon: CheckCircle2,
              },
              {
                label: "Latencia P2P",
                value: NETWORK_STATS.latency,
                icon: Network,
              },
              { label: "Costo por tx", value: NETWORK_STATS.txCost, icon: Zap },
              {
                label: "Energía por tx",
                value: NETWORK_STATS.energyEfficiency,
                icon: Gauge,
              },
              {
                label: "Almacenamiento",
                value: NETWORK_STATS.storage,
                icon: Database,
              },
            ].map((spec) => {
              const Icon = spec.icon;
              return (
                <div
                  key={spec.label}
                  className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className="h-3.5 w-3.5 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <span className="label-muted text-[11px]">
                      {spec.label}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {spec.value}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Recent blocks feed */}
      <Panel
        title="Bloques Recientes"
        description="Últimos bloques producidos por la red"
      >
        <div className="space-y-2">
          {blocks.length > 0 ? (
            blocks.map((block, i) => (
              <motion.div
                key={block.height}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card-hover flex items-center gap-4 p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/[0.06]">
                  <span className="font-mono text-[10px] font-bold text-primary">
                    #{block.height.toString().slice(-4)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-foreground truncate">
                      {block.hash}
                    </span>
                    <span className="tag text-[9px]">Shard {block.shard}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {block.validator} · {block.txCount} txs · {block.size} ·{" "}
                    {block.age}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="label-muted text-[9px]">Gas usado</p>
                  <p className="font-mono text-[11px] font-bold text-foreground">
                    {block.gasUsed}
                  </p>
                </div>
              </motion.div>
            ))
          ) : loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlockItem key={i} />
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Database
                className="h-6 w-6 text-muted-foreground/30"
                strokeWidth={1.5}
              />
              <p className="font-body text-xs text-muted-foreground">
                Sin bloques recientes
              </p>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
};
