import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  ArrowRightLeft,
  Users,
  Activity,
  Box,
  Clock,
  ChevronRight,
  Radio,
} from "lucide-react";
import {
  api,
  RPC_MODE,
  checkRpcConnection,
  type ExplorerStats,
  type Block,
  type Transaction,
  type Validator,
} from "@/lib/api";
import { TX_TYPE_COLORS } from "@/lib/protocol";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";
import {
  SkeletonMetricCard,
  SkeletonTableRow,
  ErrorBanner,
} from "@/components/dashboard/Skeleton";

type Tab = "blocks" | "transactions" | "validators";

const TABS: { id: Tab; label: string; icon: typeof Box }[] = [
  { id: "blocks", label: "Bloques", icon: Box },
  { id: "transactions", label: "Transacciones", icon: ArrowRightLeft },
  { id: "validators", label: "Validadores", icon: Users },
];

export const ExplorerView = () => {
  const [activeTab, setActiveTab] = useState<Tab>("blocks");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<ExplorerStats | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // Check RPC connection status
    const checkConn = async () => {
      if (!RPC_MODE) {
        if (active) setIsLive(false);
        return;
      }
      const ok = await checkRpcConnection();
      if (active) setIsLive(ok);
    };
    checkConn();
    const connInterval = setInterval(checkConn, 10_000);

    const load = async () => {
      try {
        const [s, b, t, v] = await Promise.all([
          api.getExplorerStats(),
          api.getLatestBlocks(10),
          api.getLatestTransactions(12),
          api.getTopValidators(10),
        ]);
        if (active) {
          setStats(s);
          setBlocks(b);
          setTxs(t);
          setValidators(v);
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
    load();
    const interval = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(interval);
      clearInterval(connInterval);
    };
  }, []);

  // Filter data based on search query
  const filteredBlocks = useMemo(() => {
    if (!searchQuery.trim()) return blocks;
    const q = searchQuery.toLowerCase();
    return blocks.filter(
      (b) =>
        b.height.toString().includes(q) ||
        b.hash.toLowerCase().includes(q) ||
        b.validator.toLowerCase().includes(q),
    );
  }, [blocks, searchQuery]);

  const filteredTxs = useMemo(() => {
    if (!searchQuery.trim()) return txs;
    const q = searchQuery.toLowerCase();
    return txs.filter(
      (t) =>
        t.hash.toLowerCase().includes(q) ||
        t.from.toLowerCase().includes(q) ||
        t.to.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q),
    );
  }, [txs, searchQuery]);

  const filteredValidators = useMemo(() => {
    if (!searchQuery.trim()) return validators;
    const q = searchQuery.toLowerCase();
    return validators.filter(
      (v) =>
        v.address.toLowerCase().includes(q) ||
        v.stake.toLowerCase().includes(q),
    );
  }, [validators, searchQuery]);

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

  const EXPLORER_METRICS = [
    {
      label: "Altura de bloque",
      value: explorerStats.blockHeight,
      icon: Box,
      color: "hsl(150 100% 45%)",
      suffix: "",
    },
    {
      label: "TPS actual",
      value: explorerStats.tps,
      icon: Activity,
      color: "hsl(185 100% 55%)",
      suffix: "",
    },
    {
      label: "Validadores activos",
      value: explorerStats.activeValidators,
      icon: Users,
      color: "hsl(150 100% 45%)",
      suffix: "",
    },
    {
      label: "Txs pendientes",
      value: explorerStats.pendingTxs,
      icon: Clock,
      color: "hsl(185 100% 55%)",
      suffix: "",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Disclaimer ── */}
      <div
        className="flex items-center gap-3 rounded-lg border border-border p-4"
        style={{
          background: isLive
            ? "hsl(150 100% 45% / 0.04)"
            : "hsl(150 70% 50% / 0.04)",
        }}
      >
        {isLive ? (
          <Radio className="h-4 w-4" style={{ color: "hsl(150 100% 45%)" }} />
        ) : (
          <span
            className="dot"
            style={{
              background: "hsl(150 70% 50%)",
              boxShadow: "0 0 6px hsl(150 70% 50% / 0.40)",
            }}
          />
        )}
        <p className="font-body text-xs leading-relaxed text-muted-foreground">
          {isLive ? (
            <>
              <span
                className="font-semibold"
                style={{ color: "hsl(150 100% 45%)" }}
              >
                RPC Live —{" "}
              </span>
              Datos en tiempo real desde rstn-node. Bloques, transacciones y
              validadores se actualizan cada 3s.
            </>
          ) : (
            <>
              <span
                className="font-semibold"
                style={{ color: "hsl(150 70% 50%)" }}
              >
                Preview de Testnet —{" "}
              </span>
              Datos simulados para demostración de UI. Los datos reales
              provendrán del RPC de rstn-node tras el lanzamiento de testnet
              pública.
            </>
          )}
        </p>
      </div>

      {/* ── Search bar ── */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.5}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por altura de bloque, hash de transacción, o dirección..."
          className="w-full rounded-lg border border-border py-3 pl-12 pr-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          style={{ background: "hsl(150 14% 9%)" }}
        />
      </div>

      {/* ── Error banner ── */}
      {error && <ErrorBanner message={error} />}

      {/* ── Metrics row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <SkeletonMetricCard key={i} />
            ))
          : EXPLORER_METRICS.map((metric, i) => {
              const Icon = metric.icon;
              return (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="card-sig p-5"
                >
                  <div className="flex items-center justify-between">
                    <Icon
                      className="h-5 w-5"
                      style={{ color: metric.color }}
                      strokeWidth={1.5}
                    />
                    <span className="dot" />
                  </div>
                  <p className="mt-3 font-mono text-2xl font-bold text-foreground">
                    <AnimatedCounter value={metric.value} duration={1.5} />
                  </p>
                  <p className="label-muted mt-1 text-[10px]">{metric.label}</p>
                </motion.div>
              );
            })}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex items-center gap-2 px-4 py-3 font-body text-sm font-medium transition-colors"
              style={{
                color: isActive ? "hsl(150 100% 45%)" : "hsl(150 12% 56%)",
              }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="explorer-tab"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{
                    background: "hsl(150 100% 45%)",
                    boxShadow: "0 0 8px hsl(150 100% 45% / 0.40)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {activeTab === "blocks" && (
          <div
            className="overflow-hidden rounded-lg border border-border"
            style={{ background: "hsl(150 14% 9%)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b border-border"
                    style={{ background: "hsl(150 14% 7%)" }}
                  >
                    <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Bloque
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Hash
                    </th>
                    <th className="hidden px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                      Validador
                    </th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Txs
                    </th>
                    <th className="hidden px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                      Gas
                    </th>
                    <th className="hidden px-4 py-3 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Shard
                    </th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Edad
                    </th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBlocks.length === 0 ? (
                    loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonTableRow key={i} cols={8} />
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center font-body text-xs text-muted-foreground"
                        >
                          {searchQuery
                            ? `Sin resultados para "${searchQuery}"`
                            : "Sin bloques disponibles"}
                        </td>
                      </tr>
                    )
                  ) : (
                    filteredBlocks.map((block, i) => (
                      <motion.tr
                        key={block.height}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="border-b border-border/50 transition-colors hover:bg-surface-2"
                      >
                        <td className="px-4 py-3">
                          <span
                            className="font-mono text-sm font-bold"
                            style={{ color: "hsl(150 100% 45%)" }}
                          >
                            #{block.height.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {block.hash}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="font-mono text-xs text-foreground">
                            {block.validator}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-sm font-medium text-foreground">
                            {block.txCount}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-right lg:table-cell">
                          <div className="flex items-center justify-end gap-2">
                            <div
                              className="h-1.5 w-16 overflow-hidden rounded-full"
                              style={{ background: "hsl(150 14% 14%)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min((parseFloat(block.gasUsed) / 30) * 100, 100)}%`,
                                  background:
                                    parseFloat(block.gasUsed) > 15
                                      ? "hsl(185 100% 55%)"
                                      : "hsl(150 100% 45%)",
                                }}
                              />
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">
                              {block.gasUsed}
                            </span>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-center sm:table-cell">
                          <span className="tag text-[10px]">
                            S{block.shard}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-xs text-muted-foreground">
                            {block.age}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <ChevronRight
                            className="h-4 w-4 text-muted-foreground/50"
                            strokeWidth={1.5}
                          />
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "transactions" && (
          <div
            className="overflow-hidden rounded-lg border border-border"
            style={{ background: "hsl(150 14% 9%)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b border-border"
                    style={{ background: "hsl(150 14% 7%)" }}
                  >
                    <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Hash
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tipo
                    </th>
                    <th className="hidden px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                      De
                    </th>
                    <th className="hidden px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                      Para
                    </th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Estado
                    </th>
                    <th className="hidden px-4 py-3 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Shard
                    </th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Fee
                    </th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTxs.length === 0 ? (
                    loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonTableRow key={i} cols={9} />
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-8 text-center font-body text-xs text-muted-foreground"
                        >
                          {searchQuery
                            ? `Sin resultados para "${searchQuery}"`
                            : "Sin transacciones disponibles"}
                        </td>
                      </tr>
                    )
                  ) : (
                    filteredTxs.map((tx, i) => {
                      const typeColor =
                        TX_TYPE_COLORS[tx.type] || "hsl(150 12% 56%)";
                      return (
                        <motion.tr
                          key={tx.hash}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className="border-b border-border/50 transition-colors hover:bg-surface-2"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-muted-foreground">
                              {tx.hash}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="tag text-[10px]"
                              style={{
                                borderColor: typeColor.replace(")", " / 0.20)"),
                                background: typeColor.replace(")", " / 0.06)"),
                                color: typeColor,
                              }}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            <span className="font-mono text-xs text-foreground">
                              {tx.from}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            <span className="font-mono text-xs text-foreground">
                              {tx.to}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-sm font-medium text-foreground">
                              {tx.value}
                            </span>
                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                              RSTN
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {tx.status === "success" ? (
                              <span
                                className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold"
                                style={{ color: "hsl(150 100% 45%)" }}
                              >
                                <span className="dot" />
                                OK
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold"
                                style={{ color: "hsl(5 80% 55%)" }}
                              >
                                <span
                                  className="dot"
                                  style={{
                                    background: "hsl(5 80% 55%)",
                                    boxShadow: "0 0 6px hsl(5 80% 55% / 0.40)",
                                  }}
                                />
                                Fail
                              </span>
                            )}
                          </td>
                          <td className="hidden px-4 py-3 text-center sm:table-cell">
                            <span className="tag text-[10px]">S{tx.shard}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-xs text-muted-foreground">
                              {tx.fee}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <ChevronRight
                              className="h-4 w-4 text-muted-foreground/50"
                              strokeWidth={1.5}
                            />
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "validators" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {filteredValidators.slice(0, 3).map((val, i) => (
                <motion.div
                  key={val.address}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                  className="card-sig p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="badge-num">#{val.rank}</span>
                    <span className="dot live-badge" />
                  </div>
                  <p className="mt-3 font-mono text-sm font-medium text-foreground">
                    {val.address}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="label-muted text-[9px]">Stake</p>
                      <p
                        className="font-mono text-lg font-bold"
                        style={{ color: "hsl(150 100% 45%)" }}
                      >
                        {val.stake}
                      </p>
                    </div>
                    <div>
                      <p className="label-muted text-[9px]">Bloques</p>
                      <p className="font-mono text-lg font-bold text-foreground">
                        {val.blocksProduced.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="tag text-[10px]">Uptime {val.uptime}</span>
                    <span className="tag text-[10px]">
                      Com. {val.commission}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div
              className="overflow-hidden rounded-lg border border-border"
              style={{ background: "hsl(150 14% 9%)" }}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className="border-b border-border"
                      style={{ background: "hsl(150 14% 7%)" }}
                    >
                      <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Rank
                      </th>
                      <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Dirección
                      </th>
                      <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Stake
                      </th>
                      <th className="hidden px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                        Bloques
                      </th>
                      <th className="hidden px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                        Uptime
                      </th>
                      <th className="hidden px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                        Comisión
                      </th>
                      <th className="px-4 py-3 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Shard
                      </th>
                      <th className="px-4 py-3 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredValidators.length === 0 ? (
                      loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <SkeletonTableRow key={i} cols={8} />
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-8 text-center font-body text-xs text-muted-foreground"
                          >
                            {searchQuery
                              ? `Sin resultados para "${searchQuery}"`
                              : "Sin validadores disponibles"}
                          </td>
                        </tr>
                      )
                    ) : (
                      filteredValidators.map((val, i) => (
                        <motion.tr
                          key={val.address}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className="border-b border-border/50 transition-colors hover:bg-surface-2"
                        >
                          <td className="px-4 py-3">
                            <span className="badge-num">{val.rank}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-foreground">
                              {val.address}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className="font-mono text-sm font-bold"
                              style={{ color: "hsl(150 100% 45%)" }}
                            >
                              {val.stake}
                            </span>
                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                              RSTN
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-right md:table-cell">
                            <span className="font-mono text-sm text-foreground">
                              {val.blocksProduced.toLocaleString()}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-right lg:table-cell">
                            <span className="font-mono text-xs text-muted-foreground">
                              {val.uptime}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-right sm:table-cell">
                            <span className="font-mono text-xs text-muted-foreground">
                              {val.commission}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="tag text-[10px]">
                              S{val.shard}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold"
                              style={{ color: "hsl(150 100% 45%)" }}
                            >
                              <span className="dot live-badge" />
                              Active
                            </span>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// Tables removed - logic inlined in main component.
