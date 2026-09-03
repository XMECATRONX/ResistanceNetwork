import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wifi,
  RefreshCw,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { Panel, StatCard } from "@/components/dashboard/Panel";
import { useTranslation } from "react-i18next";
import { api, type TestnetNode } from "@/lib/api";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  node: string;
  message: string;
  timestamp: string;
}

const severityColors = {
  critical: {
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)",
    text: "hsl(0 84% 60%)",
  },
  warning: {
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
    text: "hsl(150 70% 50%)",
  },
  info: {
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.2)",
    text: "hsl(150 100% 55%)",
  },
};

export const MonitoringView = () => {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<TestnetNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [prevHeights, setPrevHeights] = useState<Record<string, number>>({});

  const fetchNodes = useCallback(async () => {
    const result = await api.getTestnetNodes();
    setPrevHeights((prev) => {
      const next: Record<string, number> = {};
      result.forEach((n) => {
        next[n.id] = prev[n.id] ?? 0;
      });
      return next;
    });
    setNodes(result);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchNodes, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchNodes]);

  const onlineCount = nodes.filter((n) => n.online).length;
  const offlineCount = nodes.filter((n) => !n.online).length;
  const maxBlockHeight = Math.max(0, ...nodes.map((n) => n.blockHeight));
  const totalNodes = nodes.length || 4;

  // BFT fault tolerance: with N validators, tolerates f = (N-1)/3 Byzantine faults
  const faultTolerance = Math.max(0, Math.floor((totalNodes - 1) / 3));
  const livenessThreshold = Math.ceil((2 * totalNodes + 1) / 3); // 2f+1
  const consensusHealthy = onlineCount >= livenessThreshold;

  // Generate alerts from real node state
  const alerts: Alert[] = [];
  nodes.forEach((n) => {
    if (!n.online) {
      alerts.push({
        id: `down-${n.id}`,
        severity: "critical",
        node: `Node ${n.index} (:${n.port})`,
        message: `Node is DOWN — RPC unreachable on port ${n.port}`,
        timestamp: "now",
      });
    }
    const prev = prevHeights[n.id] ?? n.blockHeight;
    if (n.online && n.blockHeight < prev) {
      alerts.push({
        id: `stall-${n.id}`,
        severity: "warning",
        node: `Node ${n.index}`,
        message: `Block height regressed (${prev} → ${n.blockHeight})`,
        timestamp: "now",
      });
    }
  });
  if (!consensusHealthy && totalNodes > 0) {
    alerts.unshift({
      id: "consensus-stalled",
      severity: "critical",
      node: "Consensus",
      message: `Liveness threshold not met — ${onlineCount}/${totalNodes} online, need ${livenessThreshold} (2f+1)`,
      timestamp: "now",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header bar with refresh control */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">
              {t("views.monitoring.title", "Node Monitoring")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Connecting to local testnet…"
                : `Last updated: ${lastUpdate?.toLocaleTimeString()} · Auto-refresh: ${autoRefresh ? "ON" : "OFF"}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-2"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${autoRefresh ? "animate-spin" : ""}`}
            style={{ animationDuration: "2s" }}
          />
          {autoRefresh ? "Pause" : "Resume"}
        </button>
      </div>

      {/* Top metrics row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Nodes Online"
          value={`${onlineCount}/${totalNodes}`}
          icon={<Server className="h-4 w-4" />}
          accent={consensusHealthy ? "primary" : undefined}
          delay={0}
        />
        <StatCard
          label="Fault Tolerance"
          value={String(faultTolerance)}
          unit={faultTolerance === 1 ? "node" : "nodes"}
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="primary"
          delay={0.05}
        />
        <StatCard
          label="Consensus"
          value={consensusHealthy ? "Healthy" : "Stalled"}
          icon={
            consensusHealthy ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )
          }
          accent={consensusHealthy ? "primary" : undefined}
          delay={0.1}
        />
        <StatCard
          label="Block Height"
          value={maxBlockHeight.toLocaleString()}
          icon={<Activity className="h-4 w-4" />}
          accent="primary"
          delay={0.15}
        />
      </div>

      {/* Status summary + Alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status summary */}
        <Panel title="Testnet Status" delay={0.1}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className="h-4 w-4"
                  style={{ color: "hsl(150 100% 45%)" }}
                />
                <span className="text-sm font-medium">Online</span>
              </div>
              <span
                className="font-mono text-lg font-bold"
                style={{ color: "hsl(150 100% 45%)" }}
              >
                {onlineCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle
                  className="h-4 w-4"
                  style={{ color: "hsl(0 84% 60%)" }}
                />
                <span className="text-sm font-medium">Offline</span>
              </div>
              <span
                className="font-mono text-lg font-bold"
                style={{ color: "hsl(0 84% 60%)" }}
              >
                {offlineCount}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Liveness (2f+1)
              </span>
              <span className="font-mono text-sm font-semibold">
                {livenessThreshold}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Byzantine Faults (f)
              </span>
              <span className="font-mono text-sm font-semibold">
                {faultTolerance}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-surface-1 p-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {totalNodes}-node BFT testnet tolerates{" "}
                <strong className="text-foreground">{faultTolerance}</strong>{" "}
                Byzantine fault{faultTolerance === 1 ? "" : "s"}. Consensus
                stays live while ≥{" "}
                <strong className="text-foreground">{livenessThreshold}</strong>{" "}
                nodes are online.
              </p>
            </div>
          </div>
        </Panel>

        {/* Alerts */}
        <Panel
          title="Alerts"
          description={`${alerts.length} active`}
          delay={0.15}
          className="lg:col-span-2"
        >
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                All systems operational — testnet finalizing blocks
              </div>
            ) : (
              alerts.map((alert) => {
                const colors = severityColors[alert.severity];
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 rounded-lg p-3"
                    style={{
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <AlertTriangle
                      className="h-4 w-4 flex-shrink-0 mt-0.5"
                      style={{ color: colors.text }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: colors.text }}
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {alert.node}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-foreground/80">
                        {alert.message}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      {/* Node table */}
      <Panel
        title="Testnet Nodes"
        description={`${totalNodes} validators · local BFT cluster`}
        delay={0.2}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Node</th>
                <th className="pb-2 pr-4 font-medium">RPC Port</th>
                <th className="pb-2 pr-4 font-medium">Block Height</th>
                <th className="pb-2 pr-4 font-medium">Validator</th>
              </tr>
            </thead>
            <tbody>
              {loading && nodes.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-muted-foreground"
                  >
                    <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                    Polling testnet nodes…
                  </td>
                </tr>
              ) : (
                nodes.map((node, i) => {
                  const statusColor = node.online
                    ? "hsl(150 100% 45%)"
                    : "hsl(0 84% 60%)";
                  const StatusIcon = node.online ? CheckCircle2 : XCircle;
                  return (
                    <motion.tr
                      key={node.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-surface-1/50"
                    >
                      <td className="py-2.5 pr-4">
                        <StatusIcon
                          className="h-4 w-4"
                          style={{ color: statusColor }}
                        />
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="font-mono text-xs font-semibold">
                          Node {node.index}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        :{node.port}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {node.online ? node.blockHeight.toLocaleString() : "—"}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-[10px] text-muted-foreground">
                        {node.validator
                          ? `${node.validator.slice(0, 18)}…`
                          : "—"}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Connection hint */}
      {nodes.length > 0 && onlineCount === 0 && (
        <div className="rounded-lg border border-border bg-surface-1 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Wifi className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">
                No testnet nodes detected
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start the local testnet to see live multi-node BFT monitoring:
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-surface-2 p-2 font-mono text-[11px] text-muted-foreground">
                {`cd rstn-node
chmod +x ./scripts/local-testnet.sh
./scripts/local-testnet.sh up 4`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringView;
