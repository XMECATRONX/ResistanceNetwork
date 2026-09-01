import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimationFrame } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/dashboard/Panel";
import { SkeletonBlock } from "@/components/dashboard/Skeleton";
import { api, type ExplorerStats } from "@/lib/api";
import { NETWORK_STATS } from "@/lib/protocol";
import {
  Activity,
  Network,
  Zap,
  Clock,
  Server,
  Layers,
  Radio,
  ArrowRight,
} from "lucide-react";

// ─── BFT Consensus phases ─────────────────────────────────
type BftPhase = "propose" | "prepare" | "commit";
const PHASE_COLORS: Record<BftPhase, string> = {
  propose: "#00C8FF",
  prepare: "#12A55C",
  commit: "#00E673",
};
const PHASE_LABELS: Record<BftPhase, string> = {
  propose: "Propose",
  prepare: "Prepare",
  commit: "Commit",
};

// ─── Shard cluster definitions ─────────────────────────────
// 8 shard clusters arranged radially — each represents 8 shards (64 total)
type ShardCluster = {
  id: number;
  label: string;
  angle: number;
  color: string;
  nodeCount: number;
  phaseOffset: number; // each shard has independent consensus timing
};

const SHARD_CLUSTERS: ShardCluster[] = [
  {
    id: 0,
    label: "Shard 0-7",
    angle: 0,
    color: "#00E673",
    nodeCount: 8,
    phaseOffset: 0.0,
  },
  {
    id: 1,
    label: "Shard 8-15",
    angle: 45,
    color: "#00E673",
    nodeCount: 7,
    phaseOffset: 0.12,
  },
  {
    id: 2,
    label: "Shard 16-23",
    angle: 90,
    color: "#00C8FF",
    nodeCount: 9,
    phaseOffset: 0.25,
  },
  {
    id: 3,
    label: "Shard 24-31",
    angle: 135,
    color: "#00C8FF",
    nodeCount: 6,
    phaseOffset: 0.38,
  },
  {
    id: 4,
    label: "Shard 32-39",
    angle: 180,
    color: "#12A55C",
    nodeCount: 8,
    phaseOffset: 0.5,
  },
  {
    id: 5,
    label: "Shard 40-47",
    angle: 225,
    color: "#12A55C",
    nodeCount: 7,
    phaseOffset: 0.63,
  },
  {
    id: 6,
    label: "Shard 48-55",
    angle: 270,
    color: "#00E673",
    nodeCount: 9,
    phaseOffset: 0.76,
  },
  {
    id: 7,
    label: "Shard 56-63",
    angle: 315,
    color: "#00C8FF",
    nodeCount: 6,
    phaseOffset: 0.88,
  },
];

// ─── Generate nodes within each cluster (deterministic) ────
type NetNode = {
  id: number;
  cluster: number;
  baseAngle: number;
  baseRadius: number;
  phase: number;
  color: string;
  isLeader: boolean;
};

// Deterministic pseudo-random for reproducible layout
const detRand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const generateNodes = (): NetNode[] => {
  const nodes: NetNode[] = [];
  let id = 0;
  for (const cluster of SHARD_CLUSTERS) {
    for (let i = 0; i < cluster.nodeCount; i++) {
      const spread = 30;
      const localAngle =
        cluster.angle + (i / cluster.nodeCount) * spread - spread / 2;
      const localRadius = 125 + detRand(cluster.id * 100 + i) * 45;
      nodes.push({
        id: id++,
        cluster: cluster.id,
        baseAngle: localAngle,
        baseRadius: localRadius,
        phase: detRand(cluster.id * 50 + i * 7) * Math.PI * 2,
        color: cluster.color,
        isLeader: i === 0, // first node in each cluster is the round leader
      });
    }
  }
  return nodes;
};

const NODES = generateNodes();

// ─── Transaction packets flowing through the network ──────
type TxPacket = {
  id: number;
  fromNode: number;
  toNode: number;
  progress: number;
  speed: number;
  color: string;
  type: "transfer" | "cross-shard" | "gossip";
};

// ─── Cross-shard commit flows ──────────────────────────────
type CrossShardFlow = {
  from: number;
  to: number;
  speed: number;
  offset: number;
};

const CROSS_SHARD_FLOWS: CrossShardFlow[] = [
  { from: 0, to: 2, speed: 0.3, offset: 0.0 },
  { from: 1, to: 4, speed: 0.25, offset: 0.15 },
  { from: 3, to: 6, speed: 0.35, offset: 0.3 },
  { from: 5, to: 0, speed: 0.28, offset: 0.45 },
  { from: 2, to: 7, speed: 0.32, offset: 0.6 },
  { from: 7, to: 4, speed: 0.22, offset: 0.75 },
  { from: 6, to: 1, speed: 0.3, offset: 0.9 },
];

// ─── Gossip connections (intra-cluster mesh) ───────────────
type GossipLink = {
  from: number;
  to: number;
};

const generateGossipLinks = (): GossipLink[] => {
  const links: GossipLink[] = [];
  for (const cluster of SHARD_CLUSTERS) {
    const clusterNodes = NODES.filter((n) => n.cluster === cluster.id);
    for (let i = 0; i < clusterNodes.length - 1; i++) {
      links.push({ from: clusterNodes[i].id, to: clusterNodes[i + 1].id });
    }
    // Connect last to first for ring topology
    if (clusterNodes.length > 2) {
      links.push({
        from: clusterNodes[clusterNodes.length - 1].id,
        to: clusterNodes[0].id,
      });
    }
  }
  return links;
};

const GOSSIP_LINKS = generateGossipLinks();

// ─── Helper: polar to cartesian ─────────────────────────────
const polar = (angleDeg: number, radius: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
};

// ─── Per-shard BFT phase (independent consensus) ───────────
const BFT_CYCLE_MS = 3000;
const getShardPhase = (
  time: number,
  phaseOffset: number,
): { phase: BftPhase; progress: number } => {
  const offsetTime = time + phaseOffset * BFT_CYCLE_MS;
  const t = (offsetTime % BFT_CYCLE_MS) / BFT_CYCLE_MS;
  if (t < 0.33) return { phase: "propose", progress: t / 0.33 };
  if (t < 0.66) return { phase: "prepare", progress: (t - 0.33) / 0.33 };
  return { phase: "commit", progress: (t - 0.66) / 0.34 };
};

// ─── Block finalization wave ───────────────────────────────
// When a shard enters commit phase, emit a wave
const getFinalizationWave = (time: number, phaseOffset: number): number => {
  const offsetTime = time + phaseOffset * BFT_CYCLE_MS;
  const t = (offsetTime % BFT_CYCLE_MS) / BFT_CYCLE_MS;
  if (t < 0.66) return 0; // no wave during propose/prepare
  const commitProgress = (t - 0.66) / 0.34;
  return commitProgress; // 0 → 1 during commit
};

// ─── Component ──────────────────────────────────────────────
export const NetworkVisualizerView = () => {
  const { t } = useTranslation();
  const timeRef = useRef(0);

  const [stats, setStats] = useState<ExplorerStats | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [packets, setPackets] = useState<TxPacket[]>([]);
  const packetIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);

  // Pause animations when the view scrolls out of viewport (CPU savings)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Load stats
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const s = await api.getExplorerStats();
        if (active) setStats(s);
      } catch {
        /* mock mode */
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Spawn transaction packets periodically
  useEffect(() => {
    const spawnInterval = setInterval(() => {
      setPackets((prev) => {
        const newPackets = [...prev];
        // Spawn 2-4 new packets
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const isCrossShard = Math.random() < 0.3;
          if (isCrossShard) {
            const flow =
              CROSS_SHARD_FLOWS[
                Math.floor(Math.random() * CROSS_SHARD_FLOWS.length)
              ];
            const fromClusterNodes = NODES.filter(
              (n) => n.cluster === flow.from,
            );
            const toClusterNodes = NODES.filter((n) => n.cluster === flow.to);
            if (fromClusterNodes.length && toClusterNodes.length) {
              newPackets.push({
                id: packetIdRef.current++,
                fromNode:
                  fromClusterNodes[
                    Math.floor(Math.random() * fromClusterNodes.length)
                  ].id,
                toNode:
                  toClusterNodes[
                    Math.floor(Math.random() * toClusterNodes.length)
                  ].id,
                progress: 0,
                speed: 0.4 + Math.random() * 0.3,
                color: "#12A55C",
                type: "cross-shard",
              });
            }
          } else {
            // Intra-cluster gossip packet
            const cluster =
              SHARD_CLUSTERS[Math.floor(Math.random() * SHARD_CLUSTERS.length)];
            const clusterNodes = NODES.filter((n) => n.cluster === cluster.id);
            if (clusterNodes.length >= 2) {
              const from =
                clusterNodes[Math.floor(Math.random() * clusterNodes.length)]
                  .id;
              let to =
                clusterNodes[Math.floor(Math.random() * clusterNodes.length)]
                  .id;
              while (to === from)
                to =
                  clusterNodes[Math.floor(Math.random() * clusterNodes.length)]
                    .id;
              newPackets.push({
                id: packetIdRef.current++,
                fromNode: from,
                toNode: to,
                progress: 0,
                speed: 0.6 + Math.random() * 0.4,
                color: cluster.color,
                type: "gossip",
              });
            }
          }
        }
        // Keep max 40 packets, remove completed
        return newPackets.filter((p) => p.progress < 1).slice(-40);
      });
    }, 400);
    return () => clearInterval(spawnInterval);
  }, []);

  // Animate packets + node positions — PAUSED when off-screen (CPU savings)
  useAnimationFrame((_t, delta) => {
    if (!visibleRef.current) return; // skip work when not visible
    timeRef.current += delta;
    setPackets((prev) =>
      prev.map((p) => ({
        ...p,
        progress: p.progress + (p.speed * delta) / 1000,
      })),
    );
  });

  const time = timeRef.current;

  // Compute node positions with breathing
  const animatedNodes = useMemo(() => {
    return NODES.map((node) => {
      const breathe = Math.sin(time * 0.6 + node.phase) * 3;
      const radius = node.baseRadius + breathe;
      const pos = polar(node.baseAngle, radius);
      return { ...node, x: pos.x, y: pos.y };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(time / 40)]);

  const nodeMap = new Map(animatedNodes.map((n) => [n.id, n]));

  // Cluster center positions
  const clusterCenters = useMemo(() => {
    return SHARD_CLUSTERS.map((c) => {
      const pos = polar(c.angle, 155);
      return { ...c, cx: pos.x, cy: pos.y };
    });
  }, []);

  // Per-shard BFT phases
  const shardPhases = useMemo(() => {
    return SHARD_CLUSTERS.map((c) => ({
      ...c,
      bft: getShardPhase(time, c.phaseOffset),
      wave: getFinalizationWave(time, c.phaseOffset),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(time / 40)]);

  const svgSize = 440;
  const center = svgSize / 2;

  // Live metrics
  const activeValidators = stats?.activeValidators ?? NETWORK_STATS.validators;
  const tps = stats?.tps ?? 18456;
  const shardCount = stats?.shardCount ?? NETWORK_STATS.shardCount;
  const blockHeight = stats?.blockHeight ?? 8471203;
  const latency = NETWORK_STATS.latency;
  const finality = NETWORK_STATS.finality;

  // Global phase summary (most common phase across shards)
  const globalPhase = useMemo(() => {
    const counts: Record<BftPhase, number> = {
      propose: 0,
      prepare: 0,
      commit: 0,
    };
    shardPhases.forEach((s) => counts[s.bft.phase]++);
    const max = Math.max(...Object.values(counts));
    return (Object.entries(counts).find(([, v]) => v === max)?.[0] ??
      "propose") as BftPhase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shardPhases]);

  const handleClusterClick = useCallback((clusterId: number) => {
    setSelectedCluster((prev) => (prev === clusterId ? null : clusterId));
  }, []);

  const selectedClusterData =
    selectedCluster !== null ? shardPhases[selectedCluster] : null;

  return (
    <div ref={containerRef} className="space-y-6">
      {/* ── Topology visualization ── */}
      <Panel
        title={t("views.network.topologyTitle")}
        description={t("views.network.topologyDesc")}
      >
        <div className="flex flex-col items-center gap-6">
          {/* BFT Phase indicator — shows global consensus state */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              {(["propose", "prepare", "commit"] as BftPhase[]).map((p, i) => {
                const activeShards = shardPhases.filter(
                  (s) => s.bft.phase === p,
                ).length;
                const isActive = globalPhase === p;
                return (
                  <div key={p} className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-300"
                      style={{
                        background: isActive
                          ? `${PHASE_COLORS[p]}20`
                          : "transparent",
                        border: `1px solid ${isActive ? PHASE_COLORS[p] : "#1a3a2a60"}`,
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full transition-all"
                        style={{
                          background: PHASE_COLORS[p],
                          boxShadow: isActive
                            ? `0 0 8px ${PHASE_COLORS[p]}`
                            : "none",
                          opacity: activeShards > 0 ? 1 : 0.3,
                        }}
                      />
                      <span
                        className="font-mono text-[10px] uppercase tracking-wider transition-colors"
                        style={{
                          color: isActive ? PHASE_COLORS[p] : "#5a7a6a",
                        }}
                      >
                        {PHASE_LABELS[p]}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground/60">
                        {activeShards}/8
                      </span>
                    </div>
                    {i < 2 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="font-mono text-[9px] text-muted-foreground">
              {t("views.network.bftRound")} ·{" "}
              {t("views.network.phaseProgress", {
                pct: Math.round(shardPhases[0]?.bft.progress * 100) || 0,
              })}
            </p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: "#00E673",
                  boxShadow: "0 0 6px #00E67380",
                }}
              />
              <span className="label-muted text-[10px] uppercase tracking-wider">
                {t("views.network.legendActive")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: "#00C8FF",
                  boxShadow: "0 0 6px #00C8FF80",
                }}
              />
              <span className="label-muted text-[10px] uppercase tracking-wider">
                {t("views.network.legendSyncing")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: "#12A55C",
                  boxShadow: "0 0 6px #12A55C80",
                }}
              />
              <span className="label-muted text-[10px] uppercase tracking-wider">
                {t("views.network.legendBeacon")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1 w-6 rounded-full bg-violet/60" />
              <span className="label-muted text-[10px] uppercase tracking-wider">
                {t("views.network.legendCrossShard")}
              </span>
            </div>
          </div>

          {/* SVG topology */}
          <div className="relative w-full max-w-[480px]">
            <svg
              width={svgSize}
              height={svgSize}
              viewBox={`0 0 ${svgSize} ${svgSize}`}
              className="mx-auto h-auto w-full"
              style={{ overflow: "visible", maxWidth: `${svgSize}px` }}
            >
              <defs>
                <filter
                  id="net-node-glow"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter
                  id="net-packet-glow"
                  x="-100%"
                  y="-100%"
                  width="300%"
                  height="300%"
                >
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="net-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#12A55C" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="#12A55C" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#12A55C" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="net-bg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0a1a14" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#020a06" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Background glow */}
              <circle cx={center} cy={center} r={200} fill="url(#net-bg)" />

              {/* Core glow — beacon chain */}
              <circle cx={center} cy={center} r={60} fill="url(#net-core)" />

              {/* Concentric rings (shard boundaries) */}
              {[80, 130, 180].map((r, i) => (
                <circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="#1a3a2a"
                  strokeWidth={0.5}
                  strokeOpacity={0.15}
                  strokeDasharray="2 6"
                />
              ))}

              {/* Finalization waves — emitted when each shard commits */}
              {shardPhases.map((shard) => {
                if (shard.wave <= 0) return null;
                const pos = polar(shard.angle, 155);
                const waveRadius = 20 + shard.wave * 60;
                const opacity = (1 - shard.wave) * 0.4;
                return (
                  <circle
                    key={`wave-${shard.id}`}
                    cx={pos.x + center}
                    cy={pos.y + center}
                    r={waveRadius}
                    fill="none"
                    stroke={PHASE_COLORS.commit}
                    strokeWidth={1}
                    strokeOpacity={opacity}
                  />
                );
              })}

              {/* Intra-cluster gossip links */}
              {GOSSIP_LINKS.map((link, i) => {
                const n1 = nodeMap.get(link.from);
                const n2 = nodeMap.get(link.to);
                if (!n1 || !n2) return null;
                return (
                  <line
                    key={`gossip-${i}`}
                    x1={n1.x + center}
                    y1={n1.y + center}
                    x2={n2.x + center}
                    y2={n2.y + center}
                    stroke={n1.color}
                    strokeWidth={0.5}
                    strokeOpacity={0.12}
                  />
                );
              })}

              {/* Cross-shard flow paths */}
              {CROSS_SHARD_FLOWS.map((flow, i) => {
                const fromCluster = clusterCenters[flow.from];
                const toCluster = clusterCenters[flow.to];
                if (!fromCluster || !toCluster) return null;

                const x1 = fromCluster.cx + center;
                const y1 = fromCluster.cy + center;
                const x2 = toCluster.cx + center;
                const y2 = toCluster.cy + center;

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                const cx = center + (midX - center) * 0.15;
                const cy = center + (midY - center) * 0.15;

                const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

                return (
                  <path
                    key={`xshard-path-${i}`}
                    d={path}
                    fill="none"
                    stroke="#12A55C"
                    strokeWidth={0.8}
                    strokeOpacity={0.2}
                    strokeDasharray="3 4"
                  />
                );
              })}

              {/* Transaction packets — animated data flowing through network */}
              {packets.map((pkt) => {
                const n1 = nodeMap.get(pkt.fromNode);
                const n2 = nodeMap.get(pkt.toNode);
                if (!n1 || !n2) return null;

                const x1 = n1.x + center;
                const y1 = n1.y + center;
                const x2 = n2.x + center;
                const y2 = n2.y + center;

                let px: number, py: number;

                if (pkt.type === "cross-shard") {
                  // Curved path for cross-shard
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;
                  const cx = center + (midX - center) * 0.15;
                  const cy = center + (midY - center) * 0.15;
                  const tt = pkt.progress;
                  px =
                    (1 - tt) * (1 - tt) * x1 +
                    2 * (1 - tt) * tt * cx +
                    tt * tt * x2;
                  py =
                    (1 - tt) * (1 - tt) * y1 +
                    2 * (1 - tt) * tt * cy +
                    tt * tt * y2;
                } else {
                  // Straight path for gossip
                  px = x1 + (x2 - x1) * pkt.progress;
                  py = y1 + (y2 - y1) * pkt.progress;
                }

                const fadeOpacity =
                  pkt.progress < 0.1
                    ? pkt.progress * 10
                    : pkt.progress > 0.9
                      ? (1 - pkt.progress) * 10
                      : 1;

                return (
                  <circle
                    key={`pkt-${pkt.id}`}
                    cx={px}
                    cy={py}
                    r={pkt.type === "cross-shard" ? 2.5 : 1.8}
                    fill={pkt.color}
                    filter="url(#net-packet-glow)"
                    opacity={fadeOpacity * 0.9}
                  />
                );
              })}

              {/* Shard cluster labels & click targets */}
              {clusterCenters.map((c) => {
                const shard = shardPhases[c.id];
                const isSelected = selectedCluster === c.id;
                return (
                  <g
                    key={`cluster-${c.id}`}
                    onClick={() => handleClusterClick(c.id)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Invisible click area */}
                    <circle
                      cx={c.cx + center}
                      cy={c.cy + center}
                      r={35}
                      fill="transparent"
                    />
                    {/* Selection highlight */}
                    {isSelected && (
                      <circle
                        cx={c.cx + center}
                        cy={c.cy + center}
                        r={40}
                        fill="none"
                        stroke={c.color}
                        strokeWidth={1}
                        strokeOpacity={0.4}
                        strokeDasharray="3 3"
                      />
                    )}
                    <text
                      x={c.cx + center}
                      y={c.cy + center + 95}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize={7}
                      fill={isSelected ? c.color : "#5a7a6a"}
                      opacity={isSelected ? 0.9 : 0.5}
                    >
                      {c.label}
                    </text>
                    {/* Phase indicator dot on cluster */}
                    <circle
                      cx={c.cx + center}
                      cy={c.cy + center - 85}
                      r={3}
                      fill={PHASE_COLORS[shard.bft.phase]}
                      opacity={0.7}
                      filter="url(#net-node-glow)"
                    />
                  </g>
                );
              })}

              {/* Nodes — colored by their shard's current BFT phase */}
              {animatedNodes.map((node) => {
                const isHovered = hoveredNode === node.id;
                const shard = shardPhases[node.cluster];
                const nodeColor = PHASE_COLORS[shard.bft.phase];
                const pulse = Math.sin(time * 1.5 + node.phase) * 0.3 + 0.7;
                const r = (node.isLeader ? 3.5 : 2.5) + pulse * 1;
                const glowR = (node.isLeader ? 12 : 8) + pulse * 3;

                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Glow halo */}
                    <circle
                      cx={node.x + center}
                      cy={node.y + center}
                      r={glowR}
                      fill={nodeColor}
                      opacity={isHovered ? 0.3 : 0.08}
                      style={{ filter: "blur(2px)" }}
                    />
                    {/* Core */}
                    <circle
                      cx={node.x + center}
                      cy={node.y + center}
                      r={isHovered ? r + 1.5 : r}
                      fill={nodeColor}
                      opacity={0.85}
                      filter="url(#net-node-glow)"
                      stroke={isHovered ? "#ffffff" : "none"}
                      strokeWidth={isHovered ? 0.8 : 0}
                      strokeOpacity={0.6}
                    />
                    {/* Leader ring */}
                    {node.isLeader && (
                      <circle
                        cx={node.x + center}
                        cy={node.y + center}
                        r={r + 3}
                        fill="none"
                        stroke={nodeColor}
                        strokeWidth={0.5}
                        strokeOpacity={0.5}
                        strokeDasharray="1 2"
                      />
                    )}
                  </g>
                );
              })}

              {/* Central hub — Beacon Chain */}
              <circle
                cx={center}
                cy={center}
                r={14}
                fill="#0a1a14"
                stroke="#12A55C"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              <circle
                cx={center}
                cy={center}
                r={6}
                fill="#12A55C"
                opacity={0.8}
                filter="url(#net-node-glow)"
              />
              <text
                x={center}
                y={center + 1}
                textAnchor="middle"
                className="font-mono"
                fontSize={6}
                fill="#020a06"
                fontWeight="bold"
              >
                RSTN
              </text>
            </svg>

            {/* Hovered node tooltip */}
            {hoveredNode !== null && (
              <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-primary/20 bg-surface-2/95 px-3 py-1.5 backdrop-blur">
                <p className="font-mono text-[10px] text-primary">
                  {t("views.network.node", {
                    id: hoveredNode.toString().padStart(3, "0"),
                    shard: `${NODES[hoveredNode].cluster * 8}-${NODES[hoveredNode].cluster * 8 + 7}`,
                  })}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground">
                  {t("views.network.latency", {
                    ms: Math.round(8 + Math.sin(time + hoveredNode) * 4 + 4),
                  })}
                </p>
                <p
                  className="font-mono text-[9px]"
                  style={{
                    color:
                      PHASE_COLORS[
                        shardPhases[NODES[hoveredNode].cluster].bft.phase
                      ],
                  }}
                >
                  {
                    PHASE_LABELS[
                      shardPhases[NODES[hoveredNode].cluster].bft.phase
                    ]
                  }{" "}
                  · {NODES[hoveredNode].isLeader ? "Leader" : "Validator"}
                </p>
              </div>
            )}

            {/* Selected cluster detail */}
            <AnimatePresence>
              {selectedClusterData && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-lg border border-primary/20 bg-surface-2/95 px-4 py-2.5 backdrop-blur"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        background: selectedClusterData.color,
                        boxShadow: `0 0 6px ${selectedClusterData.color}`,
                      }}
                    />
                    <div>
                      <p className="font-mono text-[11px] font-semibold text-foreground">
                        {selectedClusterData.label}
                      </p>
                      <p className="font-mono text-[9px] text-muted-foreground">
                        {selectedClusterData.nodeCount}{" "}
                        {t("views.network.activeNodes")} · Phase:{" "}
                        {PHASE_LABELS[selectedClusterData.bft.phase]} (
                        {Math.round(selectedClusterData.bft.progress * 100)}%)
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Live metrics row */}
          <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card-hover p-3 text-center">
                    <SkeletonBlock className="mx-auto h-3.5 w-3.5 rounded-full mb-1.5" />
                    <SkeletonBlock className="mx-auto h-4 w-12" />
                    <SkeletonBlock className="mx-auto mt-1 h-2 w-16" />
                  </div>
                ))
              : [
                  {
                    icon: Server,
                    label: t("views.network.validators"),
                    value: activeValidators.toLocaleString(),
                    color: "#00E673",
                  },
                  {
                    icon: Zap,
                    label: t("views.network.tps"),
                    value: tps.toLocaleString(),
                    color: "#00C8FF",
                  },
                  {
                    icon: Layers,
                    label: t("views.network.shards"),
                    value: shardCount.toString(),
                    color: "#12A55C",
                  },
                  {
                    icon: Clock,
                    label: t("views.network.finality"),
                    value: finality,
                    color: "#00E673",
                  },
                ].map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="card-hover p-3 text-center"
                    >
                      <Icon
                        className="mx-auto h-3.5 w-3.5 mb-1.5"
                        style={{ color: m.color }}
                        strokeWidth={1.5}
                      />
                      <p className="font-mono text-base font-bold text-foreground">
                        {m.value}
                      </p>
                      <p className="label-muted mt-0.5 text-[9px] uppercase tracking-wider">
                        {m.label}
                      </p>
                    </motion.div>
                  );
                })}
          </div>
        </div>
      </Panel>

      {/* ── Network layers explained ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title={t("views.network.transportTitle")}
          description={t("views.network.transportDesc")}
        >
          <div className="space-y-3">
            {[
              {
                layer: t("views.network.l4Layer"),
                tech: "QUIC + TCP fallback",
                desc: t("views.network.l4Desc"),
                icon: Radio,
              },
              {
                layer: t("views.network.l3Layer"),
                tech: "pq-noise (Kyber768 + X25519)",
                desc: t("views.network.l3Desc"),
                icon: Network,
              },
              {
                layer: t("views.network.l2Layer"),
                tech: "Gossipsub v1.2 (scored)",
                tech2: t("views.network.l2Tech2"),
                desc: t("views.network.l2Desc"),
                icon: Activity,
              },
              {
                layer: t("views.network.l1Layer"),
                tech: "Kademlia DHT + DNS + Seed Nodes",
                desc: t("views.network.l1Desc"),
                icon: Server,
              },
            ].map((l, i) => {
              const Icon = l.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="card-hover flex items-start gap-3 p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
                    <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-sm font-semibold text-foreground">
                        {l.layer}
                      </h4>
                      <code className="font-mono text-[10px] text-primary/70">
                        {l.tech}
                      </code>
                    </div>
                    <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                      {l.desc}
                    </p>
                    {l.tech2 && (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {l.tech2}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title={t("views.network.metricsTitle")}
          description={t("views.network.metricsDesc")}
          accent
        >
          <div className="space-y-3">
            {[
              {
                label: t("views.network.mBlockHeight"),
                value: `#${blockHeight.toLocaleString()}`,
                icon: Layers,
                color: "#00E673",
              },
              {
                label: t("views.network.mTpsSustained"),
                value: `${tps.toLocaleString()} / ${NETWORK_STATS.tps.toLocaleString()}`,
                icon: Zap,
                color: "#00C8FF",
              },
              {
                label: t("views.network.mLatency"),
                value: latency,
                icon: Clock,
                color: "#00E673",
              },
              {
                label: t("views.network.mFinality"),
                value: finality,
                icon: Activity,
                color: "#12A55C",
              },
              {
                label: t("views.network.mNodesTotal"),
                value: NETWORK_STATS.nodes.toLocaleString(),
                icon: Server,
                color: "#00E673",
              },
              {
                label: t("views.network.mShardsActive"),
                value: `${shardCount} ${t("views.network.shardsUnit")} · 2,048 TPS/${t("views.network.shardUnit")}`,
                icon: Network,
                color: "#00C8FF",
              },
              {
                label: t("views.network.mTransport"),
                value: "libp2p + pq-noise",
                icon: Radio,
                color: "#12A55C",
              },
              {
                label: t("views.network.mTxCost"),
                value: NETWORK_STATS.txCost,
                icon: Zap,
                color: "#00E673",
              },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 p-3"
                >
                  <Icon
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: m.color }}
                    strokeWidth={1.5}
                  />
                  <span className="font-body text-xs text-muted-foreground">
                    {m.label}
                  </span>
                  <span className="ml-auto font-mono text-xs font-semibold text-foreground">
                    {m.value}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ── Shard distribution ── */}
      <Panel
        title={t("views.network.shardDistTitle")}
        description={t("views.network.shardDistDesc")}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {SHARD_CLUSTERS.map((cluster, i) => {
            const nodesInCluster = NODES.filter(
              (n) => n.cluster === cluster.id,
            );
            const shard = shardPhases[cluster.id];
            return (
              <motion.div
                key={cluster.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleClusterClick(cluster.id)}
                className="card-hover cursor-pointer p-3"
                style={{
                  borderColor:
                    selectedCluster === cluster.id ? cluster.color : undefined,
                  boxShadow:
                    selectedCluster === cluster.id
                      ? `0 0 12px ${cluster.color}30`
                      : undefined,
                }}
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full transition-colors"
                    style={{
                      background: PHASE_COLORS[shard.bft.phase],
                      boxShadow: `0 0 4px ${PHASE_COLORS[shard.bft.phase]}`,
                    }}
                  />
                  <span className="font-mono text-[10px] font-semibold text-foreground">
                    {cluster.label}
                  </span>
                </div>
                <p
                  className="font-mono text-lg font-bold"
                  style={{ color: cluster.color }}
                >
                  {cluster.nodeCount}
                </p>
                <p className="label-muted text-[9px]">
                  {t("views.network.activeNodes")}
                </p>
                <div className="mt-2 h-1 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(cluster.nodeCount / 9) * 100}%`,
                      background: cluster.color,
                    }}
                  />
                </div>
                <p className="mt-1.5 font-mono text-[8px] text-muted-foreground/60">
                  {PHASE_LABELS[shard.bft.phase]} ·{" "}
                  {Math.round(shard.bft.progress * 100)}%
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg border border-primary/15 bg-primary/[0.03] p-4">
          <div className="flex items-start gap-3">
            <Network
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              strokeWidth={1.5}
            />
            <div>
              <h4 className="font-display text-sm font-semibold text-foreground">
                {t("views.network.crossShardTitle")}
              </h4>
              <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                {t("views.network.crossShardDesc")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="tag">{t("views.network.tagCrossShard")}</span>
                <span className="tag">{t("views.network.tagAtomic")}</span>
                <span className="tag">{t("views.network.tagMerkle")}</span>
                <span className="tag">{t("views.network.tagNoLock")}</span>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
};
