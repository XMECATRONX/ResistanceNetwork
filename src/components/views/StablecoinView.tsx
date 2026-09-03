import { motion } from "framer-motion";
import {
  Coins,
  ShieldCheck,
  Lock,
  TrendingDown,
  Scale,
  Banknote,
  AlertTriangle,
  Info,
  Activity,
  Database,
} from "lucide-react";
import { Panel, StatCard } from "@/components/dashboard/Panel";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { getStablecoinState, type StablecoinState } from "@/lib/stablecoin-api";

const formatBig = (v: string) => {
  const n = BigInt(v || "0");
  // 18 decimals → divide by 1e18, show up to 4 decimals
  const whole = n / BigInt(1_000_000_000_000_000_000n);
  const frac = n % BigInt(1_000_000_000_000_000_000n);
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fracStr}`;
};

export const StablecoinView = () => {
  const { i18n } = useTranslation();
  const es = i18n.language === "es";
  const t = (esStr: string, enStr: string) => (es ? esStr : enStr);

  const [state, setState] = useState<StablecoinState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const s = await getStablecoinState();
        if (mounted) setState(s);
      } catch {
        /* fallback already in getStablecoinState */
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

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
              <Coins className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                {t(
                  "rUSD — Stablecoin Sobre-colateralizada",
                  "rUSD — Over-collateralized Stablecoin",
                )}
              </h2>
              <p className="font-body text-sm text-muted-foreground">
                {t(
                  "Modelo DAI: cada rUSD está respaldado por colateral cripto ≥150%. Sin custodia fiat, sin emisor central, sin admin.",
                  "DAI model: every rUSD is backed by crypto collateral ≥150%. No fiat custody, no central issuer, no admin.",
                )}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Live stats from RPC ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("Colateral mínimo", "Min collateral ratio")}
          value={`${((state?.minCollateralRatioBps ?? 15000) / 100).toFixed(0)}%`}
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="primary"
        />
        <StatCard
          label={t("Penalización liquidación", "Liquidation penalty")}
          value={`${((state?.liquidationPenaltyBps ?? 1300) / 100).toFixed(0)}%`}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label={t("Stability fee (APR)", "Stability fee (APR)")}
          value="2%"
          icon={<Banknote className="h-4 w-4" />}
        />
        <StatCard
          label={t("Guarda anti-stale", "Stale-price guard")}
          value={`${state?.maxStaleBlocks ?? 50}`}
          unit={t("bloques", "blocks")}
          icon={<Lock className="h-4 w-4" />}
        />
      </div>

      {/* ─── Live oracle feed ─── */}
      <Panel
        title={t("Feed del oráculo en vivo", "Live oracle feed")}
        description={t(
          "Precio mediano del oráculo de consenso (mediana de N fuentes independientes + TWAP). El nodo lo escribe on-chain cada bloque.",
          "Consensus oracle median price (median of N independent sources + TWAP). The node writes it on-chain every block.",
        )}
      >
        {loading ? (
          <div className="flex items-center gap-3 p-4">
            <div className="h-4 w-4 animate-pulse rounded-full bg-primary/30" />
            <span className="font-body text-sm text-muted-foreground">
              {t("Cargando estado del vault…", "Loading vault state…")}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="card-sig p-5">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="label">
                  {t("Precio mediana", "Median price")}
                </span>
              </div>
              <p className="font-mono text-2xl font-bold text-foreground">
                ${formatBig(state?.medianPrice ?? "0")}
              </p>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {t("TWAP", "TWAP")}: ${formatBig(state?.twap ?? "0")}
              </p>
            </div>
            <div className="card-sig p-5">
              <div className="mb-2 flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <span className="label">
                  {t("Fuentes confiables", "Trusted sources")}
                </span>
              </div>
              <p className="font-mono text-2xl font-bold text-foreground">
                {state?.trustedSources ?? 0}
                <span className="text-base text-muted-foreground">
                  {" "}
                  / {state?.totalSources ?? 0}
                </span>
              </p>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {t(
                  "Robusto hasta ⌊(N-1)/2⌋ fuentes comprometidas",
                  "Robust to up to ⌊(N-1)/2⌋ compromised sources",
                )}
              </p>
            </div>
            <div className="card-sig p-5">
              <div className="mb-2 flex items-center gap-2">
                {state?.priceStale ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-primary" />
                )}
                <span className="label">
                  {t("Estado del precio", "Price status")}
                </span>
              </div>
              <p
                className="font-mono text-lg font-bold"
                style={{
                  color: state?.priceStale
                    ? "hsl(45 90% 50%)"
                    : "hsl(150 70% 45%)",
                }}
              >
                {state?.priceStale
                  ? t("STALE — sin feed", "STALE — no feed")
                  : t("FRESH — en vivo", "FRESH — live")}
              </p>
              <p className="mt-1 font-body text-xs text-muted-foreground">
                {t("Altura actual", "Current height")}:{" "}
                {state?.currentHeight ?? 0} ·{" "}
                {t("última escritura", "last write")}:{" "}
                {state?.lastWriteHeight ?? 0}
              </p>
            </div>
          </div>
        )}
      </Panel>

      {/* ─── Supply + collateral ─── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card-sig p-5">
          <div className="mb-2 flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <span className="label">{t("Suministro rUSD", "rUSD supply")}</span>
          </div>
          <p className="font-mono text-2xl font-bold text-foreground">
            {formatBig(state?.totalSupply ?? "0")}{" "}
            <span className="text-sm text-muted-foreground">rUSD</span>
          </p>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            {t(
              "Acuñado solo contra deuda sobre-colateralizada",
              "Minted only against over-collateralized debt",
            )}
          </p>
        </div>
        <div className="card-sig p-5">
          <div className="mb-2 flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span className="label">
              {t("Colateral bloqueado", "Collateral locked")}
            </span>
          </div>
          <p className="font-mono text-2xl font-bold text-foreground">
            {formatBig(state?.totalCollateral ?? "0")}{" "}
            <span className="text-sm text-muted-foreground">wRSTN</span>
          </p>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            {t(
              "Bloqueado en el vault inmutable",
              "Locked in the immutable vault",
            )}
          </p>
        </div>
      </div>

      {/* ─── How it works ─── */}
      <Panel
        title={t("Cómo funciona rUSD", "How rUSD works")}
        description={t(
          "Un vault de posiciones de deuda colateralizadas (CDP). El usuario bloquea colateral y acuña rUSD. Si el ratio cae bajo 150%, cualquiera puede liquidar.",
          "A collateralized debt position (CDP) vault. The user locks collateral and mints rUSD. If the ratio drops below 150%, anyone can liquidate.",
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              icon: <Lock className="h-5 w-5" />,
              step: "1",
              title: t("Bloquear colateral", "Lock collateral"),
              desc: t(
                "El usuario deposita wRSTN (u otro ERC-20) en el vault. El colateral queda bloqueado en el contrato.",
                "The user deposits wRSTN (or any ERC-20) into the vault. The collateral is locked in the contract.",
              ),
            },
            {
              icon: <Coins className="h-5 w-5" />,
              step: "2",
              title: t("Acuñar rUSD", "Mint rUSD"),
              desc: t(
                "El usuario acuña rUSD hasta el máximo permitido (colateral / 1.5). El ratio debe ser ≥150%.",
                "The user mints rUSD up to the allowed maximum (collateral / 1.5). The ratio must be ≥150%.",
              ),
            },
            {
              icon: <Scale className="h-5 w-5" />,
              step: "3",
              title: t(
                "Liquidación permissionless",
                "Permissionless liquidation",
              ),
              desc: t(
                "Si el ratio cae bajo 150%, cualquiera puede liquidar. El liquidador paga la deuda y recibe colateral con 13% de descuento.",
                "If the ratio drops below 150%, anyone can liquidate. The liquidator repays the debt and receives collateral at a 13% discount.",
              ),
            },
          ].map((s) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 * Number(s.step) }}
              className="card-sig relative overflow-hidden p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/[0.06] text-primary">
                  {s.icon}
                </span>
                <span className="label-muted">
                  {t("Paso", "Step")} {s.step}
                </span>
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* ─── Why SEC-safe ─── */}
      <Panel
        title={t(
          "Por qué es seguro para el modelo 'lanzar y desaparecer'",
          "Why it's safe for the 'launch and disappear' model",
        )}
        description={t(
          "El desplegador no acuña nada para sí mismo. No hay emisor central. No hay flujo de ganancias a ningún operador.",
          "The deployer mints nothing to themselves. No central issuer. No profit stream to any operator.",
        )}
      >
        <div className="space-y-3">
          {[
            {
              icon: <ShieldCheck className="h-4 w-4 text-primary" />,
              text: t(
                "Sin custodia fiat: rUSD no promete respaldo en USD de un banco. Se respalda con colateral cripto sobre-collateralizado.",
                "No fiat custody: rUSD does not promise USD backing from a bank. It is backed by over-collateralized crypto.",
              ),
            },
            {
              icon: <Lock className="h-4 w-4 text-primary" />,
              text: t(
                "Sin admin key: el vault es inmutable. Nadie puede acuñar rUSD, congelar posiciones, o pausar liquidaciones.",
                "No admin key: the vault is immutable. No one can mint rUSD, freeze positions, or pause liquidations.",
              ),
            },
            {
              icon: <Banknote className="h-4 w-4 text-primary" />,
              text: t(
                "Sin ganancia del operador: el stability fee (2% APR) y la penalización de liquidación (13%) van al treasury comunitario (timelock), no a ninguna persona.",
                "No operator profit: the stability fee (2% APR) and liquidation penalty (13%) go to the community treasury (timelock), not to any person.",
              ),
            },
            {
              icon: <Scale className="h-4 w-4 text-primary" />,
              text: t(
                "Liquidación algorítmica: ningún humano decide. Si el ratio <150%, el contrato lo permite automáticamente.",
                "Algorítmic liquidation: no human decides. If the ratio <150%, the contract allows it automatically.",
              ),
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.05 * i }}
              className="flex items-start gap-3 rounded-lg border border-border bg-surface-1/50 p-4"
            >
              <span className="mt-0.5 flex-shrink-0">{item.icon}</span>
              <p className="font-body text-sm leading-relaxed text-foreground/90">
                {item.text}
              </p>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* ─── Contracts ─── */}
      <Panel
        title={t("Contratos EVM (inmutables)", "EVM contracts (immutable)")}
        description={t(
          "3 contratos desplegables en la RSTN L1. Sin owner, sin upgrade, sin pausa.",
          "3 contracts deployable on the RSTN L1. No owner, no upgrade, no pause.",
        )}
      >
        <div className="space-y-2">
          {[
            {
              name: "RSTNUSD.sol",
              desc: t(
                "Token ERC-20. Solo el vault puede mint/burn.",
                "ERC-20 token. Only the vault can mint/burn.",
              ),
            },
            {
              name: "RstnVault.sol",
              desc: t(
                "CDP vault. Depósito, mint, repay, liquidación.",
                "CDP vault. Deposit, mint, repay, liquidation.",
              ),
            },
            {
              name: "RstnOracleAdapter.sol",
              desc: t(
                "Adaptador on-chain del oráculo de consenso.",
                "On-chain adapter for the consensus oracle.",
              ),
            },
          ].map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-1/50 p-4"
            >
              <div>
                <code className="font-mono text-sm font-semibold text-foreground">
                  {c.name}
                </code>
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  {c.desc}
                </p>
              </div>
              <Lock className="h-4 w-4 flex-shrink-0 text-muted-foreground/40" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};
