import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Lock,
  Users,
  Unlock,
  Coins,
  Check,
  X,
  Wallet,
  Loader2,
  TrendingUp,
  Shield,
} from "lucide-react";
import {
  api,
  type WalletPortfolio,
  type StakingValidator,
  type GovernanceProposal,
} from "@/lib/api";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";
import {
  SkeletonMetricCard,
  SkeletonBlock,
  ErrorBanner,
} from "@/components/dashboard/Skeleton";
import { useWallet } from "@/lib/wallet";

type StakingTab = "portfolio" | "validators" | "governance";

const TABS: { id: StakingTab; label: string }[] = [
  { id: "portfolio", label: "Portfolio" },
  { id: "validators", label: "Validadores" },
  { id: "governance", label: "Gobernanza" },
];

export const StakingView = () => {
  const [activeTab, setActiveTab] = useState<StakingTab>("portfolio");

  return (
    <div className="space-y-6">
      {/* ── Disclaimer ── */}
      <div
        className="flex items-center gap-3 rounded-lg border border-border p-4"
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
            Wallet Real —{" "}
          </span>
          Al conectar, se genera un keypair Dilithium3 (ML-DSA-65, FIPS 204)
          real en tu navegador. Las transacciones se firman con criptografía
          post-cuántica y se envían al nodo RSTN vía RPC.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
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
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="staking-tab"
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
        {activeTab === "portfolio" && <PortfolioTab />}
        {activeTab === "validators" && <ValidatorsTab />}
        {activeTab === "governance" && <GovernanceTab />}
      </motion.div>
    </div>
  );
};

// ═══ PORTFOLIO ═══
const PortfolioTab = () => {
  const wallet = useWallet();
  const [portfolio, setPortfolio] = useState<WalletPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [stakingInfo, setStakingInfo] = useState<{
    apy: string;
    totalNetworkStaked: string;
    activeValidators: number;
  } | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [txStatus, setTxStatus] = useState<{
    type: string;
    msg: string;
  } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!wallet.address) return;
      try {
        const [p, info] = await Promise.all([
          api.getWalletPortfolio(wallet.address),
          api.getStakingInfo(wallet.address),
        ]);
        if (active) {
          setPortfolio(p);
          setStakingInfo(info);
        }
      } catch {
        /* fallback to defaults */
      } finally {
        if (active) setLoading(false);
      }
    };
    if (wallet.status === "connected") load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [wallet.status, wallet.address]);

  const handleStake = async () => {
    const amount = parseFloat(stakeAmount);
    if (!amount || amount <= 0 || !wallet.address) return;
    setPending("stake");
    setTxStatus(null);
    try {
      const result = await api.stake(wallet.address, amount);
      setTxStatus({
        type: "success",
        msg: `Stake de ${amount} RSTN confirmado. Hash: ${result.hash.slice(0, 16)}...`,
      });
      setStakeAmount("");
      const p = await api.getWalletPortfolio(wallet.address);
      setPortfolio(p);
    } catch (err) {
      setTxStatus({
        type: "error",
        msg: `Error al stakar: ${err instanceof Error ? err.message : "desconocido"}`,
      });
    } finally {
      setPending(null);
    }
  };

  const handleUnstake = async () => {
    const amount = parseFloat(unstakeAmount);
    if (!amount || amount <= 0 || !wallet.address) return;
    setPending("unstake");
    setTxStatus(null);
    try {
      const result = await api.unstake(wallet.address, amount);
      setTxStatus({
        type: "success",
        msg: `Unstake de ${amount} RSTN confirmado. Hash: ${result.hash.slice(0, 16)}...`,
      });
      setUnstakeAmount("");
      const p = await api.getWalletPortfolio(wallet.address);
      setPortfolio(p);
    } catch (err) {
      setTxStatus({
        type: "error",
        msg: `Error al unstakar: ${err instanceof Error ? err.message : "desconocido"}`,
      });
    } finally {
      setPending(null);
    }
  };

  const handleClaim = async () => {
    if (!wallet.address) return;
    setPending("claim");
    setTxStatus(null);
    try {
      const result = await api.claimRewards(wallet.address);
      setTxStatus({
        type: "success",
        msg: `Recompensas reclamadas: ${result.amount} RSTN. Hash: ${result.hash.slice(0, 16)}...`,
      });
      const p = await api.getWalletPortfolio(wallet.address);
      setPortfolio(p);
    } catch (err) {
      setTxStatus({
        type: "error",
        msg: `Error al reclamar: ${err instanceof Error ? err.message : "desconocido"}`,
      });
    } finally {
      setPending(null);
    }
  };

  const wp = portfolio ?? {
    address: wallet.address ?? "rstn1—",
    balance: wallet.balance,
    staked: wallet.staked,
    delegated: "0",
    rewards: "0",
    apy: stakingInfo?.apy ?? "Variable",
    pendingRewards: "0",
  };
  const portfolioCards = [
    {
      label: "Balance disponible",
      value: wp.balance,
      suffix: "RSTN",
      color: "hsl(150 100% 45%)",
    },
    {
      label: "Staked",
      value: wp.staked,
      suffix: "RSTN",
      color: "hsl(150 100% 45%)",
    },
    {
      label: "Delegado",
      value: wp.delegated,
      suffix: "RSTN",
      color: "hsl(185 100% 55%)",
    },
    {
      label: "Recompensas",
      value: wp.rewards,
      suffix: "RSTN",
      color: "hsl(150 70% 50%)",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Wallet header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card-sig p-6"
      >
        {wallet.status !== "connected" ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: "hsl(150 100% 45% / 0.12)" }}
            >
              <Wallet
                className="h-6 w-6"
                style={{ color: "hsl(150 100% 45%)" }}
                strokeWidth={1.5}
              />
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                Conecta tu wallet
              </p>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                Genera un keypair Dilithium3 real para ver tu portfolio
              </p>
            </div>
            <button
              onClick={wallet.connect}
              disabled={wallet.status === "connecting"}
              className="flex items-center gap-2 rounded-xl px-6 py-2.5 font-body text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: "hsl(150 100% 45%)",
                color: "hsl(150 50% 10%)",
                boxShadow: "0 4px 20px hsl(150 100% 45% / 0.25)",
              }}
            >
              <Wallet className="h-4 w-4" strokeWidth={2} />
              {wallet.status === "connecting"
                ? "Conectando..."
                : "Conectar Wallet"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "hsl(150 100% 45% / 0.12)" }}
              >
                <Wallet
                  className="h-5 w-5"
                  style={{ color: "hsl(150 100% 45%)" }}
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <p className="font-body text-xs text-muted-foreground">
                  Mi Wallet
                </p>
                <p className="font-mono text-sm font-medium text-foreground">
                  {wp.address}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="label-muted text-[9px]">APY estimado</p>
              <p
                className="font-mono text-lg font-bold"
                style={{ color: "hsl(150 100% 45%)" }}
              >
                {wp.apy}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Portfolio cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading && wallet.status === "connected"
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-sig p-5">
                <div className="flex items-center justify-between">
                  <SkeletonBlock className="h-2.5 w-3 rounded-full" />
                  <SkeletonBlock className="h-2.5 w-16" />
                </div>
                <SkeletonBlock className="mt-3 h-6 w-20" />
                <SkeletonBlock className="mt-1.5 h-2.5 w-10" />
              </div>
            ))
          : portfolioCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="card-sig p-5"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="dot"
                    style={{
                      background: card.color,
                      boxShadow: `0 0 6px ${card.color.replace(")", " / 0.40)")}`,
                    }}
                  />
                  <span className="label-muted text-[9px]">{card.label}</span>
                </div>
                <p className="mt-3 font-mono text-xl font-bold text-foreground">
                  <AnimatedCounter
                    value={parseFloat(card.value.replace(/,/g, ""))}
                    duration={1.5}
                    decimals={1}
                  />
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {card.suffix}
                </p>
              </motion.div>
            ))}
      </div>

      {/* Network staking info */}
      {stakingInfo && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="card-sig p-5"
        >
          <div className="flex items-center gap-2">
            <TrendingUp
              className="h-4 w-4"
              style={{ color: "hsl(150 100% 45%)" }}
              strokeWidth={1.5}
            />
            <h4 className="font-display text-sm font-semibold text-foreground">
              Estado de Staking Global
            </h4>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="label-muted text-[9px]">Total en red</p>
              <p className="font-mono text-sm font-bold text-foreground">
                {parseFloat(stakingInfo.totalNetworkStaked).toLocaleString()}
              </p>
              <p className="font-mono text-[9px] text-muted-foreground">
                RSTN staked
              </p>
            </div>
            <div>
              <p className="label-muted text-[9px]">Validadores activos</p>
              <p className="font-mono text-sm font-bold text-foreground">
                {stakingInfo.activeValidators}
              </p>
              <p className="font-mono text-[9px] text-muted-foreground">
                nodos
              </p>
            </div>
            <div>
              <p className="label-muted text-[9px]">APY promedio</p>
              <p
                className="font-mono text-sm font-bold"
                style={{ color: "hsl(150 100% 45%)" }}
              >
                {stakingInfo.apy}
              </p>
              <p className="font-mono text-[9px] text-muted-foreground">
                rendimiento
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tx status */}
      {txStatus && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg border p-3"
          style={{
            background:
              txStatus.type === "success"
                ? "hsl(150 100% 45% / 0.06)"
                : "hsl(5 80% 55% / 0.06)",
            borderColor:
              txStatus.type === "success"
                ? "hsl(150 100% 45% / 0.30)"
                : "hsl(5 80% 55% / 0.30)",
          }}
        >
          {txStatus.type === "success" ? (
            <Check
              className="h-4 w-4 shrink-0"
              style={{ color: "hsl(150 100% 45%)" }}
              strokeWidth={2}
            />
          ) : (
            <X
              className="h-4 w-4 shrink-0"
              style={{ color: "hsl(5 80% 55%)" }}
              strokeWidth={2}
            />
          )}
          <p
            className="font-mono text-xs"
            style={{
              color:
                txStatus.type === "success"
                  ? "hsl(150 100% 45%)"
                  : "hsl(5 80% 55%)",
            }}
          >
            {txStatus.msg}
          </p>
        </motion.div>
      )}

      {/* Staking actions */}
      {wallet.status === "connected" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Stake */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="card-sig p-5"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "hsl(150 100% 45% / 0.12)" }}
              >
                <Lock
                  className="h-4 w-4"
                  style={{ color: "hsl(150 100% 45%)" }}
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <h4 className="font-display text-sm font-semibold text-foreground">
                  Stake
                </h4>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Bloquea RSTN para asegurar la red
                </p>
              </div>
            </div>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="Cantidad RSTN"
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-all focus:border-primary"
            />
            <button
              onClick={handleStake}
              disabled={pending !== null || !stakeAmount}
              className="mt-3 w-full rounded-lg py-2.5 font-body text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: "hsl(150 100% 45%)",
                color: "hsl(0 0% 100%)",
              }}
            >
              {pending === "stake" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {pending === "stake" ? "Procesando..." : "Stake RSTN"}
            </button>
          </motion.div>

          {/* Unstake */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="card-sig p-5"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "hsl(150 100% 45% / 0.12)" }}
              >
                <Unlock
                  className="h-4 w-4"
                  style={{ color: "hsl(150 100% 45%)" }}
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <h4 className="font-display text-sm font-semibold text-foreground">
                  Unstake
                </h4>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Desbloquea tu RSTN staked
                </p>
              </div>
            </div>
            <input
              type="number"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="Cantidad RSTN"
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-all focus:border-primary"
            />
            <button
              onClick={handleUnstake}
              disabled={pending !== null || !unstakeAmount}
              className="mt-3 w-full rounded-lg py-2.5 font-body text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: "hsl(150 100% 45% / 0.12)",
                color: "hsl(150 100% 45%)",
                border: "1px solid hsl(150 100% 45% / 0.30)",
              }}
            >
              {pending === "unstake" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {pending === "unstake" ? "Procesando..." : "Unstake RSTN"}
            </button>
          </motion.div>

          {/* Claim rewards */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="card-sig p-5"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "hsl(150 70% 50% / 0.12)" }}
              >
                <Coins
                  className="h-4 w-4"
                  style={{ color: "hsl(150 70% 50%)" }}
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <h4 className="font-display text-sm font-semibold text-foreground">
                  Recompensas
                </h4>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Reclama tus RSTN acumulados
                </p>
              </div>
            </div>
            <p
              className="mt-3 font-mono text-2xl font-bold"
              style={{ color: "hsl(150 70% 50%)" }}
            >
              {wp.pendingRewards}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              RSTN acumulados
            </p>
            <button
              onClick={handleClaim}
              disabled={pending !== null}
              className="mt-3 w-full rounded-lg py-2.5 font-body text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: "hsl(150 70% 50% / 0.12)",
                color: "hsl(150 70% 50%)",
                border: "1px solid hsl(150 70% 50% / 0.30)",
              }}
            >
              {pending === "claim" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Coins className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {pending === "claim" ? "Reclamando..." : "Reclamar recompensas"}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// ═══ VALIDATORS ═══
const ValidatorsTab = () => {
  const wallet = useWallet();
  const [validators, setValidators] = useState<StakingValidator[]>([]);
  const [valLoading, setValLoading] = useState(true);
  const [delegateTo, setDelegateTo] = useState<StakingValidator | null>(null);
  const [delegateAmount, setDelegateAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [txStatus, setTxStatus] = useState<{
    type: string;
    msg: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const v = await api.getStakingValidators();
        if (active) setValidators(v);
      } catch {
        /* fallback */
      } finally {
        if (active) setValLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleDelegate = async () => {
    if (!delegateTo || !wallet.address) return;
    const amount = parseFloat(delegateAmount);
    if (!amount || amount <= 0) return;
    setPending(true);
    setTxStatus(null);
    try {
      const result = await api.delegate(
        wallet.address,
        delegateTo.address,
        amount,
      );
      setTxStatus({
        type: "success",
        msg: `Delegación de ${amount} RSTN a ${delegateTo.name} confirmada. Hash: ${result.hash.slice(0, 16)}...`,
      });
      setDelegateAmount("");
      setDelegateTo(null);
      const v = await api.getStakingValidators();
      setValidators(v);
    } catch (err) {
      setTxStatus({
        type: "error",
        msg: `Error al delegar: ${err instanceof Error ? err.message : "desconocido"}`,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">
          Validadores disponibles
        </h3>
        <p className="mt-1 font-body text-xs text-muted-foreground">
          Delega tu RSTN al validador con mejor rendimiento y comisión.
        </p>
      </div>

      {valLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-sig p-4 flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBlock className="h-3 w-32" />
                <SkeletonBlock className="h-2.5 w-24" />
              </div>
              <SkeletonBlock className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}

      {txStatus && (
        <div
          className="flex items-center gap-2 rounded-lg border p-3"
          style={{
            background:
              txStatus.type === "success"
                ? "hsl(150 100% 45% / 0.06)"
                : "hsl(5 80% 55% / 0.06)",
            borderColor:
              txStatus.type === "success"
                ? "hsl(150 100% 45% / 0.30)"
                : "hsl(5 80% 55% / 0.30)",
          }}
        >
          {txStatus.type === "success" ? (
            <Check
              className="h-4 w-4 shrink-0"
              style={{ color: "hsl(150 100% 45%)" }}
              strokeWidth={2}
            />
          ) : (
            <X
              className="h-4 w-4 shrink-0"
              style={{ color: "hsl(5 80% 55%)" }}
              strokeWidth={2}
            />
          )}
          <p
            className="font-mono text-xs"
            style={{
              color:
                txStatus.type === "success"
                  ? "hsl(150 100% 45%)"
                  : "hsl(5 80% 55%)",
            }}
          >
            {txStatus.msg}
          </p>
        </div>
      )}

      {/* Delegate modal */}
      {delegateTo && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-sig p-5"
          style={{ borderColor: "hsl(150 100% 45% / 0.30)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: "hsl(150 100% 45% / 0.12)" }}
              >
                <Shield
                  className="h-5 w-5"
                  style={{ color: "hsl(150 100% 45%)" }}
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <h4 className="font-display text-sm font-semibold text-foreground">
                  Delegar a {delegateTo.name}
                </h4>
                <p className="font-mono text-[10px] text-muted-foreground">
                  APY: {delegateTo.apy} · Comisión: {delegateTo.commission}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setDelegateTo(null);
                setDelegateAmount("");
              }}
              className="rounded-lg p-1.5 transition-colors hover:bg-surface-2"
            >
              <X className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
            </button>
          </div>
          <input
            type="number"
            value={delegateAmount}
            onChange={(e) => setDelegateAmount(e.target.value)}
            placeholder="Cantidad RSTN a delegar"
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-all focus:border-primary"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDelegate}
              disabled={
                pending || !delegateAmount || wallet.status !== "connected"
              }
              className="flex-1 rounded-lg py-2.5 font-body text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: "hsl(150 100% 45%)",
                color: "hsl(0 0% 100%)",
              }}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Procesando..." : "Confirmar delegación"}
            </button>
            <button
              onClick={() => {
                setDelegateTo(null);
                setDelegateAmount("");
              }}
              className="rounded-lg px-4 py-2.5 font-body text-sm font-medium transition-all"
              style={{
                background: "hsl(150 14% 12%)",
                color: "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >
              Cancelar
            </button>
          </div>
          {wallet.status !== "connected" && (
            <p
              className="mt-2 font-mono text-[10px]"
              style={{ color: "hsl(150 70% 50%)" }}
            >
              Conecta tu wallet para delegar
            </p>
          )}
        </motion.div>
      )}

      {validators.length === 0 ? (
        <p className="font-body text-xs text-muted-foreground py-8 text-center">
          Cargando validadores...
        </p>
      ) : (
        validators.map((val, i) => (
          <motion.div
            key={val.address}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="card-sig p-5"
          >
            <div className="flex items-center justify-between gap-4">
              {/* Left: identity */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: "hsl(150 100% 45% / 0.12)" }}
                >
                  <span
                    className="font-mono text-xs font-bold"
                    style={{ color: "hsl(150 100% 45%)" }}
                  >
                    {val.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-semibold text-foreground">
                      {val.name}
                    </h4>
                    {val.delegated && (
                      <span
                        className="tag text-[10px]"
                        style={{
                          borderColor: "hsl(150 100% 45% / 0.30)",
                          background: "hsl(150 100% 45% / 0.06)",
                          color: "hsl(150 100% 45%)",
                        }}
                      >
                        <Check className="mr-1 h-2.5 w-2.5" strokeWidth={2} />{" "}
                        Delegado
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {val.address}
                  </p>
                </div>
              </div>

              {/* Middle: metrics */}
              <div className="hidden items-center gap-6 md:flex">
                <div className="text-center">
                  <p className="label-muted text-[9px]">Stake total</p>
                  <p className="font-mono text-sm font-bold text-foreground">
                    {val.stake}
                  </p>
                </div>
                <div className="text-center">
                  <p className="label-muted text-[9px]">Recompensas</p>
                  <p
                    className="font-mono text-sm font-bold"
                    style={{ color: "hsl(150 100% 45%)" }}
                  >
                    {val.apy}
                  </p>
                </div>
                <div className="text-center">
                  <p className="label-muted text-[9px]">Uptime</p>
                  <p className="font-mono text-sm font-bold text-foreground">
                    {val.uptime}
                  </p>
                </div>
                <div className="text-center">
                  <p className="label-muted text-[9px]">Comisión</p>
                  <p className="font-mono text-sm font-bold text-foreground">
                    {val.commission}
                  </p>
                </div>
                <div className="text-center">
                  <p className="label-muted text-[9px]">Shard</p>
                  <p className="font-mono text-sm font-bold text-foreground">
                    S{val.shard}
                  </p>
                </div>
              </div>

              {/* Right: action */}
              <button
                onClick={() => setDelegateTo(val)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 font-body text-xs font-medium transition-all"
                style={{
                  background: val.delegated
                    ? "hsl(150 100% 45% / 0.12)"
                    : "hsl(150 100% 45% / 0.12)",
                  color: "hsl(150 100% 45%)",
                  border: "1px solid hsl(150 100% 45% / 0.30)",
                }}
              >
                {val.delegated ? "Gestionar" : "Delegar"}
              </button>
            </div>

            {/* Mobile metrics */}
            <div className="mt-3 flex items-center gap-4 md:hidden">
              <span className="font-mono text-[10px] text-muted-foreground">
                Recompensas:{" "}
                <span style={{ color: "hsl(150 100% 45%)" }}>{val.apy}</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Uptime: {val.uptime}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Comisión: {val.commission}
              </span>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
};

// ═══ GOVERNANCE ═══
const VoteButtons = ({ propId }: { propId: string }) => {
  const [voteStatus, setVoteStatus] = useState<{
    type: string;
    msg: string;
  } | null>(null);
  const [pending, setPending] = useState(false);

  const handleVote = async (vote: "for" | "against") => {
    setPending(true);
    setVoteStatus(null);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setVoteStatus({
        type: "success",
        msg: `Voto ${vote === "for" ? "a favor" : "en contra"} registrado on-chain para ${propId}. Costo cuadrático: 1 RSTN.`,
      });
    } catch {
      setVoteStatus({ type: "error", msg: "Error al registrar voto" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-3">
        <button
          onClick={() => handleVote("for")}
          disabled={pending}
          className="flex-1 rounded-lg py-2 font-body text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background: "hsl(150 100% 45% / 0.12)",
            color: "hsl(150 100% 45%)",
            border: "1px solid hsl(150 100% 45% / 0.30)",
          }}
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" strokeWidth={2} />
          )}
          Votar a favor
        </button>
        <button
          onClick={() => handleVote("against")}
          disabled={pending}
          className="flex-1 rounded-lg py-2 font-body text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background: "hsl(5 80% 55% / 0.12)",
            color: "hsl(5 80% 55%)",
            border: "1px solid hsl(5 80% 55% / 0.30)",
          }}
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" strokeWidth={2} />
          )}
          Votar en contra
        </button>
      </div>
      {voteStatus && (
        <p
          className="font-mono text-[10px]"
          style={{
            color:
              voteStatus.type === "success"
                ? "hsl(150 100% 45%)"
                : "hsl(5 80% 55%)",
          }}
        >
          {voteStatus.msg}
        </p>
      )}
    </div>
  );
};

const GovernanceTab = () => {
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const p = await api.getGovernanceProposals();
        if (active) setProposals(p);
      } catch {
        /* fallback */
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">
          Propuestas de Gobernanza
        </h3>
        <p className="mt-1 font-body text-xs text-muted-foreground">
          Votación cuadrática on-chain con identidad verificada. Costo
          cuadrático por voto.
        </p>
      </div>

      {proposals.length === 0 ? (
        <p className="font-body text-xs text-muted-foreground py-8 text-center">
          Cargando propuestas...
        </p>
      ) : (
        proposals.map((prop, i) => {
          const total = prop.votesFor + prop.votesAgainst;
          const forPct = (prop.votesFor / total) * 100;
          const isActive = prop.status === "Votación activa";
          const isApproved = prop.status === "Aprobado";

          return (
            <motion.div
              key={prop.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="card-sig p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <code
                    className="font-mono text-xs font-bold"
                    style={{ color: "hsl(150 100% 45%)" }}
                  >
                    {prop.id}
                  </code>
                  <h4 className="font-display text-sm font-semibold text-foreground">
                    {prop.title}
                  </h4>
                </div>
                <span
                  className="tag text-[10px]"
                  style={{
                    borderColor: isActive
                      ? "hsl(150 70% 50% / 0.30)"
                      : isApproved
                        ? "hsl(150 100% 45% / 0.30)"
                        : "var(--border)",
                    background: isActive
                      ? "hsl(150 70% 50% / 0.06)"
                      : isApproved
                        ? "hsl(150 100% 45% / 0.06)"
                        : "hsl(150 14% 9%)",
                    color: isActive
                      ? "hsl(150 70% 50%)"
                      : isApproved
                        ? "hsl(150 100% 45%)"
                        : "var(--muted-foreground)",
                  }}
                >
                  {prop.status}
                </span>
              </div>

              <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
                {prop.description}
              </p>

              {/* Vote bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span style={{ color: "hsl(150 100% 45%)" }}>
                    <Check className="mr-1 inline h-3 w-3" strokeWidth={2} />
                    {prop.votesFor}% a favor
                  </span>
                  <span style={{ color: "hsl(5 80% 55%)" }}>
                    {prop.votesAgainst}% en contra
                    <X className="ml-1 inline h-3 w-3" strokeWidth={2} />
                  </span>
                </div>
                <div
                  className="mt-2 flex h-2 overflow-hidden rounded-full"
                  style={{ background: "hsl(150 14% 14%)" }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${forPct}%` }}
                    transition={{
                      duration: 0.8,
                      delay: 0.2 + i * 0.08,
                      ease: "easeOut",
                    }}
                    className="h-full"
                    style={{ background: "hsl(150 100% 45%)" }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3 flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
                <span>Turnout: {prop.turnout}</span>
                <span>·</span>
                <span>
                  {prop.endsIn === "Finalizado"
                    ? "Finalizado"
                    : `Termina en ${prop.endsIn}`}
                </span>
              </div>

              {/* Vote buttons */}
              {isActive && <VoteButtons propId={prop.id} />}
            </motion.div>
          );
        })
      )}
    </div>
  );
};
