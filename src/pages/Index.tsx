import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Sidebar, type ViewId } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { ErrorBoundary, InlineErrorFallback } from "@/components/ErrorBoundary";
import { autoDetectRpc } from "@/lib/api";
import { OverviewView } from "@/components/views/OverviewView";
import { OnboardingView } from "@/components/views/OnboardingView";
import { ArchitectureView } from "@/components/views/ArchitectureView";
import { CryptographyView } from "@/components/views/CryptographyView";
import { ConsensusView } from "@/components/views/ConsensusView";
import { NodesView } from "@/components/views/NodesView";
import { MiningView } from "@/components/views/MiningView";
import { RoadmapView } from "@/components/views/RoadmapView";
import { TokenomicsView } from "@/components/views/TokenomicsView";
import { ExplorerView } from "@/components/views/ExplorerView";
import { DocsView } from "@/components/views/DocsView";
import { StakingView } from "@/components/views/StakingView";
import { SecurityView } from "@/components/views/SecurityView";
import { BridgeView } from "@/components/views/BridgeView";
import { DexView } from "@/components/views/DexView";
import { StablecoinView } from "@/components/views/StablecoinView";
import { BridgeLivePanel } from "@/components/views/BridgeLivePanel";
import { FaucetView } from "@/components/views/FaucetView";
import { ContractsView } from "@/components/views/ContractsView";
import { TransparencyView } from "@/components/views/TransparencyView";
import { NetworkVisualizerView } from "@/components/views/NetworkVisualizerView";
import { MonitoringView } from "@/components/views/MonitoringView";
import CommunityView from "@/components/views/CommunityView";

const VIEW_META: Record<ViewId, { titleKey: string; subtitleKey: string }> = {
  onboarding: {
    titleKey: "views.onboarding.title",
    subtitleKey: "views.onboarding.subtitle",
  },
  overview: {
    titleKey: "views.overview.title",
    subtitleKey: "views.overview.subtitle",
  },
  architecture: {
    titleKey: "views.architecture.title",
    subtitleKey: "views.architecture.subtitle",
  },
  cryptography: {
    titleKey: "views.cryptography.title",
    subtitleKey: "views.cryptography.subtitle",
  },
  consensus: {
    titleKey: "views.consensus.title",
    subtitleKey: "views.consensus.subtitle",
  },
  nodes: { titleKey: "views.nodes.title", subtitleKey: "views.nodes.subtitle" },
  mining: {
    titleKey: "views.mining.title",
    subtitleKey: "views.mining.subtitle",
  },
  roadmap: {
    titleKey: "views.roadmap.title",
    subtitleKey: "views.roadmap.subtitle",
  },
  tokenomics: {
    titleKey: "views.tokenomics.title",
    subtitleKey: "views.tokenomics.subtitle",
  },
  explorer: {
    titleKey: "views.explorer.title",
    subtitleKey: "views.explorer.subtitle",
  },
  docs: { titleKey: "views.docs.title", subtitleKey: "views.docs.subtitle" },
  staking: {
    titleKey: "views.staking.title",
    subtitleKey: "views.staking.subtitle",
  },
  security: {
    titleKey: "views.security.title",
    subtitleKey: "views.security.subtitle",
  },
  bridge: {
    titleKey: "views.bridge.title",
    subtitleKey: "views.bridge.subtitle",
  },
  dex: {
    titleKey: "views.dex.title",
    subtitleKey: "views.dex.subtitle",
  },
  stablecoin: {
    titleKey: "views.stablecoin.title",
    subtitleKey: "views.stablecoin.subtitle",
  },
  faucet: {
    titleKey: "views.faucet.title",
    subtitleKey: "views.faucet.subtitle",
  },
  contracts: {
    titleKey: "views.contracts.title",
    subtitleKey: "views.contracts.subtitle",
  },
  transparency: {
    titleKey: "views.transparency.title",
    subtitleKey: "views.transparency.subtitle",
  },
  network: {
    titleKey: "views.network.title",
    subtitleKey: "views.network.subtitle",
  },
  monitoring: {
    titleKey: "views.monitoring.title",
    subtitleKey: "views.monitoring.subtitle",
  },
  community: {
    titleKey: "views.community.title",
    subtitleKey: "views.community.subtitle",
  },
};

const Index = () => {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<ViewId>("onboarding");
  const meta = VIEW_META[activeView];

  useEffect(() => {
    autoDetectRpc();
    document.title =
      i18n.language === "es"
        ? "RSTN Terminal — Explorador de Red, Staking y Block Explorer"
        : "RSTN Terminal — Network Explorer, Staking & Block Explorer";
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        i18n.language === "es"
          ? "Terminal interactivo de Resistance Network: block explorer en vivo, staking, validadores, criptografía post-cuántica, puente cross-chain y dashboard de transparencia."
          : "Interactive Resistance Network terminal: live block explorer, staking, validators, post-quantum cryptography, cross-chain bridge and transparency dashboard.",
      );
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background bg-noise">
      <a href="#terminal-content" className="skip-link">
        Saltar al contenido
      </a>
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <main
        id="terminal-content"
        className="flex flex-1 flex-col overflow-hidden"
        aria-label="Terminal RSTN"
      >
        <Header
          title={t(meta.titleKey)}
          subtitle={t(meta.subtitleKey)}
          viewId={activeView}
        />
        <div className="flex-1 overflow-y-auto p-4 pt-6 lg:p-6 lg:pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <ErrorBoundary
                key={activeView}
                fallback={
                  <InlineErrorFallback
                    onReset={() => setActiveView("overview")}
                  />
                }
              >
                {activeView === "onboarding" && (
                  <OnboardingView onNavigate={setActiveView} />
                )}
                {activeView === "overview" && <OverviewView />}
                {activeView === "architecture" && <ArchitectureView />}
                {activeView === "cryptography" && <CryptographyView />}
                {activeView === "consensus" && <ConsensusView />}
                {activeView === "nodes" && <NodesView />}
                {activeView === "mining" && <MiningView />}
                {activeView === "roadmap" && <RoadmapView />}
                {activeView === "tokenomics" && <TokenomicsView />}
                {activeView === "explorer" && <ExplorerView />}
                {activeView === "docs" && <DocsView />}
                {activeView === "staking" && <StakingView />}
                {activeView === "security" && <SecurityView />}
                {activeView === "bridge" && (
                  <>
                    <BridgeView />
                    <BridgeLivePanel />
                  </>
                )}
                {activeView === "dex" && <DexView />}
                {activeView === "stablecoin" && <StablecoinView />}
                {activeView === "faucet" && <FaucetView />}
                {activeView === "contracts" && <ContractsView />}
                {activeView === "transparency" && <TransparencyView />}
                {activeView === "network" && <NetworkVisualizerView />}
                {activeView === "monitoring" && <MonitoringView />}
                {activeView === "community" && <CommunityView />}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Index;
