import { motion } from "framer-motion";
import {
  Droplets,
  ArrowLeftRight,
  Activity,
  Lock,
  ShieldCheck,
  TrendingUp,
  FileCode2,
  ExternalLink,
} from "lucide-react";
import { Panel, StatCard } from "@/components/dashboard/Panel";
import { useTranslation } from "react-i18next";

export const DexView = () => {
  const { i18n } = useTranslation();
  const es = i18n.language === "es";

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
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
              <Droplets className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                {es
                  ? "DEX — Pool de Descubrimiento de Precio"
                  : "DEX — Price Discovery Pool"}
              </h2>
              <p className="font-body text-sm text-muted-foreground">
                {es
                  ? "AMM constant-product (x·y=k). El precio de RSTN nace del primer swap, no de una venta."
                  : "Constant-product AMM (x·y=k). RSTN price is born from the first swap, not a sale."}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Price discovery status ─── */}
      <Panel
        title={
          es ? "Estado del descubrimiento de precio" : "Price discovery status"
        }
        description={
          es
            ? "El pool canónico wRSTN/USDC es donde nace el precio de mercado de RSTN. CoinGecko y CoinMarketCap leen las reservas de este pool vía VWAP."
            : "The canonical wRSTN/USDC pool is where RSTN's market price is born. CoinGecko and CoinMarketCap read this pool's reserves via VWAP."
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={es ? "Estado del pool" : "Pool status"}
            value={es ? "Pre-mainnet" : "Pre-mainnet"}
            icon={<Activity className="h-4 w-4" />}
            accent="primary"
          />
          <StatCard
            label={es ? "Par canónico" : "Canonical pair"}
            value="wRSTN/USDC"
            icon={<ArrowLeftRight className="h-4 w-4" />}
          />
          <StatCard
            label={es ? "Fee" : "Fee"}
            value="0.30%"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label={es ? "Precio de mercado" : "Market price"}
            value={es ? "Pendiente" : "Pending"}
            icon={<Activity className="h-4 w-4" />}
            accent="accent"
          />
        </div>
        <p className="mt-4 font-body text-xs leading-relaxed text-muted-foreground">
          {es
            ? "El precio es null hasta el primer swap. RSTN no tiene venta, ICO ni precio fijado por el equipo. El precio nace del descubrimiento de mercado en el primer intercambio del pool (modelo Satoshi)."
            : "Price is null until the first swap. RSTN has no sale, no ICO, no team-set price. Price is born from market discovery at the pool's first swap (Satoshi model)."}
        </p>
      </Panel>

      {/* ─── Architecture diagram ─── */}
      <Panel
        title={es ? "Arquitectura del pool" : "Pool architecture"}
        description={
          es
            ? "RSTN nativo se envuelve como wRSTN (ERC-20) para operar en el AMM. Sin owner, sin admin key, sin upgradeabilidad."
            : "Native RSTN is wrapped as wRSTN (ERC-20) to operate in the AMM. No owner, no admin key, no upgradeability."
        }
      >
        <div className="space-y-3">
          {[
            {
              step: "1",
              title: es ? "Wrap RSTN → wRSTN" : "Wrap RSTN → wRSTN",
              desc: es
                ? "RSTN nativo (gas token) se envuelve 1:1 como wRSTN ERC-20 via WRSTN.sol. Igual que WETH en Ethereum."
                : "Native RSTN (gas token) is wrapped 1:1 as wRSTN ERC-20 via WRSTN.sol. Same as WETH on Ethereum.",
              icon: <ArrowLeftRight className="h-4 w-4" />,
            },
            {
              step: "2",
              title: es ? "Añadir liquidez" : "Add liquidity",
              desc: es
                ? "El primer LP deposita wRSTN + USDC. La proporción fija el precio inicial. MINIMUM_LIQUIDITY bloqueado anti-inflation-attack."
                : "First LP deposits wRSTN + USDC. The ratio sets the initial price. MINIMUM_LIQUIDITY locked anti-inflation-attack.",
              icon: <Droplets className="h-4 w-4" />,
            },
            {
              step: "3",
              title: es
                ? "Primer swap = nacimiento del precio"
                : "First swap = price birth",
              desc: es
                ? "El primer intercambio establece el precio de mercado observable on-chain. price = reserve_USDC / reserve_wRSTN."
                : "The first swap establishes the observable on-chain market price. price = reserve_USDC / reserve_wRSTN.",
              icon: <TrendingUp className="h-4 w-4" />,
            },
            {
              step: "4",
              title: es ? "Agregadores leen VWAP" : "Aggregators read VWAP",
              desc: es
                ? "CoinGecko/CoinMarketCap leen reservas y cumulative price del pool. TWAP on-chain evita manipulación por flash loans."
                : "CoinGecko/CoinMarketCap read reserves and cumulative price from the pool. On-chain TWAP prevents flash-loan manipulation.",
              icon: <Activity className="h-4 w-4" />,
            },
          ].map((s) => (
            <div
              key={s.step}
              className="flex items-start gap-3 rounded-lg border border-border bg-surface-1/50 p-4"
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                {s.step}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/60">{s.icon}</span>
                  <span className="font-body text-sm font-semibold text-foreground">
                    {s.title}
                  </span>
                </div>
                <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* ─── Security ─── */}
      <Panel
        title={
          es
            ? "Seguridad — sin owner, sin admin"
            : "Security — no owner, no admin"
        }
        description={
          es
            ? "El pool es inmutable. No hay palanca central. Coherente con la narrativa Satoshi del protocolo."
            : "The pool is immutable. No central lever. Consistent with the protocol's Satoshi narrative."
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <Lock className="h-4 w-4" />,
              title: es ? "Sin admin key" : "No admin key",
              desc: es
                ? "Nadie puede pausar, cambiar fee o redirigir. Bytecode inmutable."
                : "Nobody can pause, change fee or redirect. Immutable bytecode.",
            },
            {
              icon: <ShieldCheck className="h-4 w-4" />,
              title: es ? "Invariante x·y≥k" : "Invariant x·y≥k",
              desc: es
                ? "Cada swap verifica el producto post-swap. Imposible vaciar el pool."
                : "Every swap verifies post-swap product. Impossible to drain the pool.",
            },
            {
              icon: <Activity className="h-4 w-4" />,
              title: es ? "TWAP oracle on-chain" : "On-chain TWAP oracle",
              desc: es
                ? "Cumulative price acumulado por bloque. Resistente a flash loans."
                : "Cumulative price accumulated per block. Flash-loan resistant.",
            },
            {
              icon: <Lock className="h-4 w-4" />,
              title: es ? "MINIMUM_LIQUIDITY" : "MINIMUM_LIQUIDITY",
              desc: es
                ? "1000 LP bloqueados en 0xdead. Previene inflation attack en primer LP."
                : "1000 LP locked at 0xdead. Prevents inflation attack on first LP.",
            },
            {
              icon: <ShieldCheck className="h-4 w-4" />,
              title: es ? "Fee inmutable" : "Immutable fee",
              desc: es
                ? "0.30% (30 bps) es constant. No se puede cambiar. Sin feeToSetter."
                : "0.30% (30 bps) is constant. Cannot be changed. No feeToSetter.",
            },
            {
              icon: <FileCode2 className="h-4 w-4" />,
              title: es ? "Factory sin permisos" : "Permissionless factory",
              desc: es
                ? "Cualquiera puede crear pools. Sin whitelist, sin owner de factory."
                : "Anyone can create pools. No whitelist, no factory owner.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-border bg-surface-1/50 p-4"
            >
              <div className="flex items-center gap-2 text-primary">
                {f.icon}
                <span className="font-body text-sm font-semibold text-foreground">
                  {f.title}
                </span>
              </div>
              <p className="mt-1.5 font-body text-xs leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* ─── Contracts ─── */}
      <Panel
        title={es ? "Contratos del DEX" : "DEX contracts"}
        description={
          es
            ? "Solidity 0.8.20. Compilados con Hardhat + viaIR. Listos para desplegar en la L1 de RSTN (subconjunto EVM vía transpiler)."
            : "Solidity 0.8.20. Compiled with Hardhat + viaIR. Ready to deploy on the RSTN L1 (EVM subset via transpiler)."
        }
      >
        <div className="space-y-2">
          {[
            {
              name: "WRSTN.sol",
              path: "rstn-hardhat-test/contracts/WRSTN.sol",
              desc: es
                ? "Wrapper ERC-20 del RSTN nativo. Deposit/withdraw 1:1."
                : "ERC-20 wrapper for native RSTN. Deposit/withdraw 1:1.",
            },
            {
              name: "RstnDexFactory.sol",
              path: "rstn-hardhat-test/contracts/RstnDexFactory.sol",
              desc: es
                ? "Fábrica sin permisos. Crea pools para cualquier par ERC-20."
                : "Permissionless factory. Creates pools for any ERC-20 pair.",
            },
            {
              name: "RstnDexPool.sol",
              path: "rstn-hardhat-test/contracts/RstnDexPool.sol",
              desc: es
                ? "AMM constant-product. LP tokens, TWAP oracle, fee 0.30%."
                : "Constant-product AMM. LP tokens, TWAP oracle, 0.30% fee.",
            },
            {
              name: "deploy-dex.js",
              path: "rstn-hardhat-test/scripts/deploy-dex.js",
              desc: es
                ? "Script de bootstrap: despliega WRSTN, factory y pool canónico."
                : "Bootstrap script: deploys WRSTN, factory and canonical pool.",
            },
          ].map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-1/50 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm font-semibold text-primary">
                    {c.name}
                  </code>
                </div>
                <p className="mt-0.5 truncate font-body text-xs text-muted-foreground">
                  {c.desc}
                </p>
              </div>
              <code className="ml-3 flex-none font-mono text-[10px] text-muted-foreground/60">
                {c.path}
              </code>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/stats"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 font-body text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {es ? "Endpoint /stats" : "/stats endpoint"}
          </a>
        </div>
      </Panel>
    </div>
  );
};
