import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Shield,
  Cpu,
  Network,
  Map,
  Coins,
  Server,
  Zap,
  Search,
  BookOpen,
  Wallet,
  Menu,
  X,
  ShieldAlert,
  ArrowLeftRight,
  Droplet,
  Droplets,
  Eye,
  RadioTower,
  Sparkles,
  Monitor,
  Users,
  FileCode2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RstnLogo } from "@/components/ui/RstnLogo";

export type ViewId =
  | "overview"
  | "architecture"
  | "cryptography"
  | "consensus"
  | "nodes"
  | "mining"
  | "roadmap"
  | "tokenomics"
  | "explorer"
  | "docs"
  | "staking"
  | "security"
  | "bridge"
  | "dex"
  | "faucet"
  | "contracts"
  | "transparency"
  | "network"
  | "onboarding"
  | "monitoring"
  | "community";

interface NavItem {
  id: ViewId;
  labelKey: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  // Onboarding & overview
  { id: "onboarding", labelKey: "sidebar.nav.onboarding", icon: Sparkles },
  { id: "overview", labelKey: "sidebar.nav.overview", icon: LayoutDashboard },
  // User actions — explorer, staking, faucet
  { id: "explorer", labelKey: "sidebar.nav.explorer", icon: Search },
  { id: "staking", labelKey: "sidebar.nav.staking", icon: Wallet },
  { id: "faucet", labelKey: "sidebar.nav.faucet", icon: Droplet },
  { id: "contracts", labelKey: "sidebar.nav.contracts", icon: FileCode2 },
  // Technical — architecture, crypto, consensus, nodes, mining
  { id: "architecture", labelKey: "sidebar.nav.architecture", icon: Cpu },
  { id: "cryptography", labelKey: "sidebar.nav.cryptography", icon: Shield },
  { id: "consensus", labelKey: "sidebar.nav.consensus", icon: Network },
  { id: "nodes", labelKey: "sidebar.nav.nodes", icon: Server },
  { id: "mining", labelKey: "sidebar.nav.mining", icon: Zap },
  // Economics — tokenomics, bridge, transparency
  { id: "tokenomics", labelKey: "sidebar.nav.tokenomics", icon: Coins },
  { id: "bridge", labelKey: "sidebar.nav.bridge", icon: ArrowLeftRight },
  { id: "dex", labelKey: "sidebar.nav.dex", icon: Droplets },
  { id: "transparency", labelKey: "sidebar.nav.transparency", icon: Eye },
  { id: "network", labelKey: "sidebar.nav.network", icon: RadioTower },
  { id: "monitoring", labelKey: "sidebar.nav.monitoring", icon: Monitor },
  // Security — security, audits
  { id: "security", labelKey: "sidebar.nav.security", icon: ShieldAlert },
  { id: "roadmap", labelKey: "sidebar.nav.roadmap", icon: Map },
  // Reference
  { id: "docs", labelKey: "sidebar.nav.docs", icon: BookOpen },
  { id: "community", labelKey: "sidebar.nav.community", icon: Users },
];

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
}

export const Sidebar = ({ activeView, onViewChange }: SidebarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      {/* Mobile toggle button — aligned with header content, left-aligned */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-sidebar-background/95 backdrop-blur-sm transition-colors hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-sidebar-border bg-[#0a0a14] shadow-2xl shadow-black/60 lg:hidden"
          >
            <SidebarContent
              activeView={activeView}
              onViewChange={(v) => {
                onViewChange(v);
                setMobileOpen(false);
              }}
              onClose={() => setMobileOpen(false)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="relative hidden w-72 flex-col border-r border-sidebar-border bg-sidebar-background lg:flex">
        <SidebarContent activeView={activeView} onViewChange={onViewChange} />
      </aside>
    </>
  );
};

interface SidebarContentProps extends SidebarProps {
  onClose?: () => void;
}

const SidebarContent = ({
  activeView,
  onViewChange,
  onClose,
}: SidebarContentProps) => {
  const { t } = useTranslation();
  return (
    <>
      {/* Logo */}
      <div className="relative flex h-20 items-center gap-3 border-b border-sidebar-border px-6">
        <RstnLogo size="md" />
        <div className="sidebar-logo-text">
          <h1 className="font-display text-base font-bold tracking-tight text-foreground">
            RSTN
          </h1>
          <p className="label-muted mt-0.5">{t("sidebar.tagline")}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
            aria-label={t("sidebar.closeMenu")}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Nav — clean labels only, no descriptions */}
      <nav
        className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto"
        aria-label="Navegación del terminal"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar-background ${
                isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
              }`}
              style={isActive ? { boxShadow: "var(--shadow-xs)" } : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-r-full bg-primary"
                  style={{ boxShadow: "0 0 8px hsl(150 100% 45% / 0.40)" }}
                />
              )}
              <Icon
                className="h-[18px] w-[18px] shrink-0 transition-all duration-200"
                style={{
                  color: isActive
                    ? "var(--primary)"
                    : "var(--sidebar-foreground)",
                }}
                strokeWidth={1.5}
              />
              <span
                className="font-body text-[13px] font-medium transition-colors truncate"
                style={{
                  color: isActive
                    ? "var(--foreground)"
                    : "var(--sidebar-foreground)",
                }}
              >
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer status */}
      <div className="border-t border-sidebar-border p-4">
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <span
              className="dot"
              style={{
                background: "hsl(150 70% 50%)",
                boxShadow: "0 0 6px hsl(150 70% 50% / 0.40)",
              }}
            />
            <span className="font-body text-[11px] font-medium text-foreground">
              {t("sidebar.phase")}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
            {t("sidebar.phaseSub")}
          </p>
        </div>
        <p className="mt-2 px-1 font-body text-[9px] leading-relaxed text-muted-foreground/40">
          {t("sidebar.disclaimer")}
        </p>
      </div>
    </>
  );
};
