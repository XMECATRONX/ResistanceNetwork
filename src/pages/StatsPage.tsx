import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Copy, Check } from "lucide-react";

type Stats = {
  name: string;
  symbol: string;
  decimals: number;
  logo: string;
  website: string;
  whitepaper: string;
  github: string;
  max_supply: number;
  total_supply: number;
  circulating_supply: number;
  circulating_supply_note: string;
  price_usd: null | number;
  price_usd_note: string;
  market_cap_usd: null | number;
  dex: {
    status: string;
    pool_address: string;
    pair: string;
    price_method: string;
  };
  genesis: {
    block_zero_supply: number;
    minting: number;
    team_allocation: number;
    ecosystem_fund: number;
    genesis_treasury: number;
    ico: number;
    pre_sale: number;
    vc: number;
    distribution: {
      bucket: string;
      amount: number;
      percentage: number;
      mechanism: string;
    }[];
  };
  monetary_policy: {
    hard_cap: number;
    minting_rate: number;
    gas_burn_rate_percent: number;
    reserve_halving_years: number;
    reserve_total: number;
    reserve_convergence_years: number;
  };
  updated_at: string;
  schema_version: string;
};

const fmt = (n: number) => n.toLocaleString("en-US");

const StatsPage = () => {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);
  const es = i18n.language === "es";

  useEffect(() => {
    document.title = es
      ? "RSTN Stats — Supply, Precio y Listing API | CoinGecko/CoinMarketCap"
      : "RSTN Stats — Supply, Price & Listing API | CoinGecko/CoinMarketCap";
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        es
          ? "Endpoint público de estadísticas de RSTN para CoinGecko y CoinMarketCap: supply circulante, total, max, precio y distribución génesis verificable on-chain."
          : "Public RSTN stats endpoint for CoinGecko and CoinMarketCap: circulating, total, max supply, price and verifiable on-chain genesis distribution.",
      );
    fetch("/stats.json")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, [es]);

  const endpointUrl = "/stats.json";

  const copyEndpoint = () => {
    navigator.clipboard.writeText(window.location.origin + endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-noise">
        <div className="font-body text-sm text-muted-foreground">
          {es ? "Cargando estadísticas..." : "Loading stats..."}
        </div>
      </div>
    );
  }

  const zeroFields = [
    { label: es ? "Minting" : "Minting", value: stats.genesis.minting },
    {
      label: es ? "Team allocation" : "Team allocation",
      value: stats.genesis.team_allocation,
    },
    {
      label: es ? "Ecosystem fund" : "Ecosystem fund",
      value: stats.genesis.ecosystem_fund,
    },
    {
      label: es ? "Genesis treasury" : "Genesis treasury",
      value: stats.genesis.genesis_treasury,
    },
    { label: "ICO", value: stats.genesis.ico },
    { label: es ? "Pre-sale" : "Pre-sale", value: stats.genesis.pre_sale },
    { label: "VC", value: stats.genesis.vc },
  ];

  return (
    <main className="min-h-screen bg-background bg-noise">
      {/* Hero */}
      <header className="border-b border-border bg-surface-1/50">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
              {es
                ? "LISTING API · COINGECKO / COINMARKETCAP"
                : "LISTING API · COINGECKO / COINMARKETCAP"}
            </span>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {es ? "Estadísticas públicas de " : "Public stats for "}
              <span className="gradient-text-primary">RSTN</span>
            </h1>
            <p className="mt-4 max-w-2xl font-body text-base text-muted-foreground">
              {es
                ? "Endpoint REST compatible con CoinGecko y CoinMarketCap. Supply, precio y distribución génesis — todo verificable on-chain. Sin ICO, sin pre-venta, sin asignación de equipo."
                : "REST endpoint compatible with CoinGecko and CoinMarketCap. Supply, price and genesis distribution — all verifiable on-chain. No ICO, no pre-sale, no team allocation."}
            </p>

            {/* Endpoint copy bar */}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 truncate rounded-md border border-border bg-surface-2 px-4 py-2.5 font-mono text-sm text-foreground">
                GET {endpointUrl}
              </code>
              <button
                onClick={copyEndpoint}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 font-body text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied
                  ? es
                    ? "Copiado"
                    : "Copied"
                  : es
                    ? "Copiar URL"
                    : "Copy URL"}
              </button>
            </div>
          </motion.div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Supply metrics */}
        <section aria-label={es ? "Métricas de supply" : "Supply metrics"}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            {es ? "Métricas de supply" : "Supply metrics"}
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                label: es ? "Circulating Supply" : "Circulating Supply",
                value: fmt(stats.circulating_supply),
                sub: "RSTN",
              },
              {
                label: es ? "Total Supply" : "Total Supply",
                value: fmt(stats.total_supply),
                sub: "RSTN",
              },
              {
                label: es ? "Max Supply" : "Max Supply",
                value: fmt(stats.max_supply),
                sub: "RSTN",
              },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-border bg-surface-1 p-5"
              >
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </div>
                <div className="mt-2 font-display text-3xl font-bold text-foreground">
                  {m.value}
                </div>
                <div className="mt-1 font-body text-sm text-muted-foreground">
                  {m.sub}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 font-body text-sm text-muted-foreground">
            {stats.circulating_supply_note}
          </p>
        </section>

        {/* Price */}
        <section className="mt-12" aria-label={es ? "Precio" : "Price"}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            {es ? "Precio" : "Price"}
          </h2>
          <div className="mt-5 rounded-xl border border-border bg-surface-1 p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {es ? "Precio (USD)" : "Price (USD)"}
              </span>
              <span className="font-display text-3xl font-bold text-foreground">
                {stats.price_usd === null
                  ? es
                    ? "Pendiente"
                    : "Pending"
                  : `$${stats.price_usd}`}
              </span>
            </div>
            <p className="mt-3 font-body text-sm text-muted-foreground">
              {stats.price_usd_note}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
                <div className="font-mono text-xs uppercase text-muted-foreground">
                  {es ? "Estado DEX" : "DEX status"}
                </div>
                <div className="mt-1 font-body text-sm text-foreground">
                  {stats.dex.status}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
                <div className="font-mono text-xs uppercase text-muted-foreground">
                  {es ? "Método de precio" : "Price method"}
                </div>
                <div className="mt-1 font-body text-sm text-foreground">
                  {stats.dex.price_method}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Genesis zeros */}
        <section
          className="mt-12"
          aria-label={
            es ? "Génesis — ceros verificables" : "Genesis — verifiable zeros"
          }
        >
          <h2 className="font-display text-2xl font-bold text-foreground">
            {es
              ? "Génesis — los ceros que importan"
              : "Genesis — the zeros that matter"}
          </h2>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            {es
              ? "Cada cero es una promesa criptográfica verificable on-chain desde el bloque 0."
              : "Each zero is a verifiable on-chain cryptographic promise from block 0."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {zeroFields.map((z) => (
              <div
                key={z.label}
                className="flex flex-col items-center rounded-xl border border-border bg-surface-1 p-4 text-center"
              >
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div className="mt-2 font-display text-2xl font-bold text-foreground">
                  {z.value}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {z.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Distribution */}
        <section
          className="mt-12"
          aria-label={es ? "Distribución génesis" : "Genesis distribution"}
        >
          <h2 className="font-display text-2xl font-bold text-foreground">
            {es ? "Distribución génesis" : "Genesis distribution"}
          </h2>
          <div className="mt-5 space-y-3">
            {stats.genesis.distribution.map((d) => (
              <div
                key={d.bucket}
                className="rounded-xl border border-border bg-surface-1 p-5"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-body font-semibold text-foreground">
                    {d.bucket}
                  </span>
                  <span className="font-display text-xl font-bold text-primary">
                    {d.percentage}%
                  </span>
                </div>
                <div className="mt-1 font-mono text-sm text-muted-foreground">
                  {fmt(d.amount)} RSTN
                </div>
                <p className="mt-2 font-body text-sm text-muted-foreground">
                  {d.mechanism}
                </p>
                {/* Bar */}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${d.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Monetary policy */}
        <section
          className="mt-12"
          aria-label={es ? "Política monetaria" : "Monetary policy"}
        >
          <h2 className="font-display text-2xl font-bold text-foreground">
            {es ? "Política monetaria" : "Monetary policy"}
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: es ? "Hard Cap" : "Hard Cap",
                value: fmt(stats.monetary_policy.hard_cap),
              },
              {
                label: es ? "Minting rate" : "Minting rate",
                value: `${stats.monetary_policy.minting_rate}%`,
              },
              {
                label: es ? "Gas burn" : "Gas burn",
                value: `${stats.monetary_policy.gas_burn_rate_percent}%`,
              },
              {
                label: es ? "Halving" : "Halving",
                value: `${stats.monetary_policy.reserve_halving_years} ${es ? "años" : "yrs"}`,
              },
              {
                label: es ? "Reserva total" : "Reserve total",
                value: fmt(stats.monetary_policy.reserve_total),
              },
              {
                label: es ? "Convergencia" : "Convergence",
                value: `${stats.monetary_policy.reserve_convergence_years} ${es ? "años" : "yrs"}`,
              },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-border bg-surface-1 p-4"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </div>
                <div className="mt-1 font-display text-lg font-bold text-foreground">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Listing instructions */}
        <section
          className="mt-12"
          aria-label={es ? "Cómo listar" : "How to list"}
        >
          <h2 className="font-display text-2xl font-bold text-foreground">
            {es
              ? "Cómo se lista RSTN en CoinGecko / CMC"
              : "How RSTN gets listed on CoinGecko / CMC"}
          </h2>
          <ol className="mt-5 space-y-3">
            {[
              es
                ? "CoinGecko/CoinMarketCap consultan este endpoint /stats.json para supply circulante, total y max."
                : "CoinGecko/CoinMarketCap query this /stats.json endpoint for circulating, total and max supply.",
              es
                ? "El precio NO viene de aquí. Los agregadores leen el pool DEX on-chain (RSTN/USDC) vía VWAP de las reservas."
                : "Price does NOT come from here. Aggregators read the DEX pool on-chain (RSTN/USDC) via VWAP of reserves.",
              es
                ? "Post-mainnet: se despliega el pool DEX, el primer swap fija el precio de mercado (nacimiento del precio en bloque 0, modelo Satoshi)."
                : "Post-mainnet: the DEX pool is deployed, the first swap sets the market price (price birth at block 0, Satoshi model).",
              es
                ? "Una vez hay volumen verificable, se solicita el listing en CoinGecko (gratis) y CoinMarketCap (requiere más tracción)."
                : "Once verifiable volume exists, listing is requested on CoinGecko (free) and CoinMarketCap (requires more traction).",
            ].map((step, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-border bg-surface-1 p-4"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="font-body text-sm text-foreground">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Links */}
        <section className="mt-12" aria-label={es ? "Enlaces" : "Links"}>
          <div className="flex flex-wrap gap-3">
            <a
              href={stats.whitepaper}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-1 px-4 py-2 font-body text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              <ExternalLink className="h-4 w-4" />
              {es ? "Whitepaper" : "Whitepaper"}
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {es ? "Volver al inicio" : "Back to home"}
            </Link>
          </div>
          <p className="mt-6 font-mono text-xs text-muted-foreground">
            {es ? "Última actualización" : "Last updated"}: {stats.updated_at} ·{" "}
            {es ? "Esquema" : "Schema"} v{stats.schema_version}
          </p>
        </section>
      </div>
    </main>
  );
};

export default StatsPage;
