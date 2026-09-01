import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { RstnLogo } from "@/components/ui/RstnLogo";
import {
  ArrowRight,
  ArrowLeft,
  Terminal,
  Code,
  Box,
  Search,
  Droplet,
  Activity,
  FileText,
  BookOpen,
  Server,
  Award,
  Bug,
  Copy,
  Check,
  Play,
  Zap,
  Shield,
  Sparkles,
  ChevronRight,
  Menu,
  X,
  Wallet,
  Layers,
} from "lucide-react";
import {
  DEV_PORTAL,
  DEV_TRACKS,
  DEV_TOOLS,
  PLAYGROUND_CONTRACTS,
  DEV_RESOURCES,
  RPC_METHODS,
  SDK_REFERENCE,
  WALLET_INTEGRATION,
} from "@/lib/protocol";
import { AnimatedCounter } from "@/components/dashboard/AnimatedCounter";

const ICON_MAP: Record<string, typeof Terminal> = {
  Terminal,
  Code,
  Box,
  Search,
  Droplet,
  Activity,
  FileText,
  BookOpen,
  Server,
  Award,
  Bug,
};

const NAV_LINKS = [
  { labelKey: "dev.nav.home", href: "#top" },
  { labelKey: "dev.nav.tracks", href: "#tracks" },
  { labelKey: "dev.nav.tools", href: "#tools" },
  { labelKey: "dev.nav.sdk", href: "#sdk" },
  { labelKey: "dev.nav.wallet", href: "#wallet" },
  { labelKey: "dev.nav.playground", href: "#playground" },
  { labelKey: "dev.nav.resources", href: "#resources" },
];

const DevPortal = () => {
  const { t, i18n } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    document.title =
      i18n.language === "es"
        ? "RSTN Dev Portal — SDK, RPC API y Guías para Desarrolladores"
        : "RSTN Dev Portal — SDK, RPC API & Developer Guides";
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        i18n.language === "es"
          ? "Documentación completa de Resistance Network: SDK TypeScript, JSON-RPC API, wallet integration, playground de contratos y guías para node operators y dApp developers."
          : "Complete Resistance Network documentation: TypeScript SDK, JSON-RPC API, wallet integration, contract playground and guides for node operators and dApp developers.",
      );
  }, []);

  return (
    <div className="min-h-screen bg-background bg-noise" id="top">
      <a href="#dev-content" className="skip-link">
        {t("mobile.skipToContent")}
      </a>
      <main id="dev-content" aria-label="Dev Portal RSTN">
        {/* ═══ NAVBAR ═══ */}
        <nav
          className="glass sticky top-0 z-50 border-b border-border"
          aria-label="Navegación Dev Portal"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
            <Link
              to="/"
              className="flex items-center gap-2.5"
              aria-label="Resistance Network — inicio"
            >
              <RstnLogo size="md" />
              <span className="font-display text-base font-bold tracking-tight text-foreground">
                Resistance Network
              </span>
              <span
                className="ml-2 rounded-md border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                style={{ background: "hsl(150 14% 9%)" }}
              >
                Dev
              </span>
            </Link>

            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="font-body text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 rounded-sm"
                >
                  {t(link.labelKey)}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground md:hidden focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                aria-label={
                  mobileNavOpen ? t("sidebar.closeMenu") : t("sidebar.openMenu")
                }
                aria-expanded={mobileNavOpen}
              >
                {mobileNavOpen ? (
                  <X className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Menu className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
              <LanguageSwitcher />
              <Link
                to="/"
                className="hidden items-center gap-1.5 font-body text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                <span>{t("dev.nav.home")}</span>
              </Link>
              <Link
                to="/terminal"
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-all"
                style={{
                  background: "hsl(150 100% 45%)",
                  color: "hsl(150 50% 10%)",
                  boxShadow: "0 0 24px hsl(150 100% 45% / 0.12)",
                }}
              >
                {t("nav.terminal")}
              </Link>
            </div>
          </div>
        </nav>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="glass border-b border-border overflow-hidden md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="font-body text-sm font-medium py-2 text-muted-foreground hover:text-foreground"
                >
                  {t(link.labelKey)}
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-radial" />
          <div
            className="absolute inset-0 perspective-grid opacity-30"
            style={{
              transform:
                "perspective(400px) rotateX(60deg) scale(1.8) translateY(20%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-32">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mx-auto max-w-4xl text-center"
            >
              <div
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5"
                style={{ background: "hsl(150 14% 9%)" }}
              >
                <Code
                  className="h-3 w-3"
                  style={{ color: "hsl(150 100% 45%)" }}
                  strokeWidth={1.5}
                />
                <span className="label-muted text-[10px]">
                  Developer Portal · Build on RSTN
                </span>
              </div>

              <h1 className="font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-7xl">
                Construye sobre la{" "}
                <span className="gradient-text">
                  primera Layer 1 post-cuántica
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl font-body text-lg leading-relaxed text-muted-foreground">
                {DEV_PORTAL.subtitle}
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href="#tracks"
                  className="inline-flex items-center gap-2 rounded-lg px-6 py-3 font-body text-sm font-semibold transition-all"
                  style={{
                    background: "hsl(150 100% 45%)",
                    color: "hsl(150 50% 10%)",
                    boxShadow: "0 0 24px hsl(150 100% 45% / 0.15)",
                  }}
                >
                  Empezar a construir
                </a>
                <a
                  href="#playground"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 font-body text-sm font-semibold text-foreground transition-colors hover:border-border-hover"
                  style={{ background: "hsl(150 14% 9%)" }}
                >
                  <Play className="h-4 w-4" strokeWidth={1.5} />
                  Playground
                </a>
              </div>
            </motion.div>

            {/* Endpoints bar */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-border sm:grid-cols-3"
              style={{ background: "hsl(150 14% 17%)" }}
            >
              {[
                {
                  label: "RPC Mainnet",
                  value: DEV_PORTAL.endpoints.rpc,
                  icon: Terminal,
                },
                {
                  label: "WebSocket",
                  value: DEV_PORTAL.endpoints.ws,
                  icon: Activity,
                },
                {
                  label: "Faucet Testnet",
                  value: DEV_PORTAL.endpoints.faucet,
                  icon: Droplet,
                },
              ].map((ep) => {
                const Icon = ep.icon;
                return (
                  <div
                    key={ep.label}
                    className="flex items-center gap-3 p-5"
                    style={{ background: "hsl(150 14% 9%)" }}
                  >
                    <Icon
                      className="h-5 w-5 shrink-0"
                      style={{ color: "hsl(150 100% 45%)" }}
                      strokeWidth={1.5}
                    />
                    <div className="min-w-0">
                      <p className="label-muted text-[9px]">{ep.label}</p>
                      <p className="truncate font-mono text-xs text-foreground">
                        {ep.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Quick stats */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mx-auto mt-6 grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4"
            >
              {[
                {
                  label: "TPS objetivo",
                  value: 250,
                  suffix: "K",
                  icon: Zap,
                  color: "hsl(150 100% 45%)",
                },
                {
                  label: "Finalidad",
                  value: 0.4,
                  suffix: "s",
                  decimals: 1,
                  icon: Activity,
                  color: "hsl(185 100% 55%)",
                },
                {
                  label: "Costo por tx",
                  value: 0.0002,
                  prefix: "$",
                  decimals: 4,
                  icon: Code,
                  color: "hsl(150 100% 45%)",
                },
                {
                  label: "Cobertura PQ",
                  value: 100,
                  suffix: "%",
                  icon: Shield,
                  color: "hsl(150 100% 45%)",
                },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="card p-5 text-center">
                    <Icon
                      className="mx-auto h-5 w-5"
                      style={{ color: stat.color }}
                      strokeWidth={1.5}
                    />
                    <p className="mt-2 font-mono text-2xl font-bold text-foreground">
                      {stat.prefix}
                      <AnimatedCounter
                        value={stat.value}
                        suffix={stat.suffix || ""}
                        decimals={stat.decimals || 0}
                        duration={2}
                      />
                    </p>
                    <p className="label-muted mt-1 text-[10px]">{stat.label}</p>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ═══ TRACKS ═══ */}
        <section
          id="tracks"
          className="relative border-t border-border py-16 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
              <span className="label">Learning tracks</span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Tres caminos para construir
              </h2>
              <p className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
                Elige tu nivel. Cada track es práctico: terminas con algo
                funcionando.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {DEV_TRACKS.map((track, i) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="card-sig p-6"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold"
                      style={{
                        borderColor: `${track.color}40`,
                        background: `${track.color}10`,
                        color: track.color,
                      }}
                    >
                      {track.level}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {track.duration}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-foreground">
                    {track.title}
                  </h3>
                  <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
                    {track.description}
                  </p>

                  <div className="mt-6 space-y-3">
                    {track.steps.map((step, j) => (
                      <div key={j} className="flex items-start gap-3">
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold"
                          style={{
                            background: `${track.color}12`,
                            color: track.color,
                          }}
                        >
                          {j + 1}
                        </div>
                        <div>
                          <p className="font-body text-xs font-semibold text-foreground">
                            {step.title}
                          </p>
                          <p className="font-body text-[11px] leading-relaxed text-muted-foreground">
                            {step.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TOOLS ═══ */}
        <section
          id="tools"
          className="relative border-t border-border py-16 sm:py-24"
          style={{ background: "hsl(150 14% 4%)" }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
              <span className="label">Herramientas</span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                El stack de desarrollo
              </h2>
              <p className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
                Todo lo que necesitas para compilar, desplegar, monitorizar e
                interactuar con Resistance Network.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {DEV_TOOLS.map((tool, i) => {
                const Icon = ICON_MAP[tool.icon] || Terminal;
                return (
                  <motion.div
                    key={tool.name}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="card-sig p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: "hsl(150 100% 45% / 0.10)",
                          border: "1px solid hsl(150 100% 45% / 0.20)",
                        }}
                      >
                        <Icon
                          className="h-5 w-5"
                          style={{ color: "hsl(150 100% 45%)" }}
                          strokeWidth={1.5}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono text-sm font-bold text-foreground">
                            {tool.name}
                          </h3>
                          {"status" in tool && tool.status === "planned" && (
                            <span className="rounded-full border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">
                              PRÓX.
                            </span>
                          )}
                          {"status" in tool && tool.status === "available" && (
                            <span className="rounded-full border border-primary/20 bg-primary/[0.06] px-1.5 py-0.5 font-mono text-[8px] text-primary">
                              LISTO
                            </span>
                          )}
                        </div>
                        <span className="tag text-[9px]">{tool.category}</span>
                      </div>
                    </div>
                    <p className="mt-3 font-body text-xs leading-relaxed text-muted-foreground">
                      {tool.description}
                    </p>
                    <div
                      className="mt-4 flex items-center gap-2 rounded-md border border-border p-2"
                      style={{ background: "hsl(150 14% 6%)" }}
                    >
                      <Terminal
                        className="h-3 w-3 shrink-0 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                      <code className="truncate font-mono text-[10px] text-muted-foreground">
                        {tool.install}
                      </code>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* SDK Quick Start */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="mt-10 card-sig overflow-hidden p-0"
            >
              <div
                className="flex items-center gap-2 border-b border-border px-5 py-3"
                style={{ background: "hsl(150 14% 6%)" }}
              >
                <Code className="h-4 w-4 text-primary" strokeWidth={1.5} />
                <span className="font-mono text-xs font-semibold text-foreground">
                  @rstn/sdk — Quick Start
                </span>
              </div>
              <pre
                className="overflow-x-auto p-5 font-mono text-[11px] leading-relaxed text-muted-foreground"
                style={{ background: "hsl(150 14% 4%)" }}
              >
                {`import { RstnClient, RstnWallet, TransactionBuilder } from '@rstn/sdk'

// 1. Conectar al nodo
const client = new RstnClient('http://localhost:9944')
const healthy = await client.health()  // true

// 2. Generar wallet post-cuántica (Dilithium3)
const wallet = RstnWallet.generate()
console.log(wallet.address)  // rstn1...

// 3. Consultar balance
const balance = await client.getBalance(wallet.address)

// 4. Construir y firmar transacción
const tx = TransactionBuilder.transfer(
  'rstn1recipient...',  // dirección destino
  '1000000000',          // 1 RSTN (9 decimales)
  0                      // nonce
)
const signed = await wallet.signTx(tx)

// 5. Enviar a la red (firma Dilithium3 de 3309 bytes)
const nodeTx = RstnWallet.toNodeFormat(signed)
const txHash = await client.sendTransaction(nodeTx)

// 6. Verificar en el explorer
const blocks = await client.getLatestBlocks(5)`}
              </pre>
            </motion.div>
          </div>
        </section>

        {/* ═══ PLAYGROUND ═══ */}
        <section
          id="playground"
          className="relative border-t border-border py-16 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <PlaygroundSection />
          </div>
        </section>

        {/* ═══ SDK REFERENCE ═══ */}
        <section
          id="sdk"
          className="relative border-t border-border py-16 sm:py-24"
          style={{ background: "hsl(150 14% 4%)" }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
              <span className="label">SDK Reference</span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                @rstn/sdk — API completa
              </h2>
              <p className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
                Tres clases exportadas:{" "}
                <code className="font-mono text-primary">RstnClient</code>,{" "}
                <code className="font-mono text-primary">RstnWallet</code>,{" "}
                <code className="font-mono text-primary">
                  TransactionBuilder
                </code>
                . Firmas Dilithium3 reales (NIST FIPS 204).
              </p>
            </div>
            <div className="space-y-8">
              {SDK_REFERENCE.map((cls, ci) => (
                <motion.div
                  key={cls.class}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: ci * 0.08 }}
                  className="card-sig overflow-hidden p-0"
                >
                  <div
                    className="flex items-center gap-2 border-b border-border px-5 py-3"
                    style={{ background: "hsl(150 14% 7%)" }}
                  >
                    <Code className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <span className="font-mono text-sm font-bold text-foreground">
                      {cls.class}
                    </span>
                    <span className="ml-2 font-body text-xs text-muted-foreground">
                      {cls.description}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr
                          className="border-b border-border/50"
                          style={{ background: "hsl(150 14% 6%)" }}
                        >
                          <th className="px-5 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Método
                          </th>
                          <th className="hidden px-5 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                            Retorna
                          </th>
                          <th className="px-5 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Descripción
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cls.methods.map((m, mi) => (
                          <tr
                            key={mi}
                            className="border-b border-border/30 transition-colors hover:bg-surface-2"
                          >
                            <td className="px-5 py-3">
                              <span
                                className="font-mono text-xs font-medium"
                                style={{ color: "hsl(150 100% 45%)" }}
                              >
                                {m.name}
                              </span>
                            </td>
                            <td className="hidden px-5 py-3 md:table-cell">
                              <span className="font-mono text-xs text-foreground">
                                {m.returns}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="font-body text-xs text-muted-foreground">
                                {m.description}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ WALLET INTEGRATION ═══ */}
        <section
          id="wallet"
          className="relative border-t border-border py-16 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
              <span className="label">Wallet Integration</span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Conecta RSTN Wallet a tu dApp
              </h2>
              <p className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
                {WALLET_INTEGRATION.description}
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {WALLET_INTEGRATION.steps.map((step, i) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                  className="card-sig p-5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold"
                      style={{
                        background: "hsl(150 100% 45% / 0.12)",
                        color: "hsl(150 100% 45%)",
                      }}
                    >
                      {step.step}
                    </div>
                    <h3 className="font-body text-sm font-semibold text-foreground">
                      {step.title}
                    </h3>
                  </div>
                  <pre
                    className="mt-4 overflow-x-auto rounded-lg border border-border p-4 font-mono text-[10px] leading-relaxed text-muted-foreground"
                    style={{ background: "hsl(150 14% 4%)" }}
                  >
                    <code>{step.code}</code>
                  </pre>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="mt-10 card-sig overflow-hidden p-0"
            >
              <div
                className="flex items-center gap-2 border-b border-border px-5 py-3"
                style={{ background: "hsl(150 14% 7%)" }}
              >
                <Wallet className="h-4 w-4 text-primary" strokeWidth={1.5} />
                <span className="font-mono text-sm font-bold text-foreground">
                  RSTN Wallet vs MetaMask
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className="border-b border-border/50"
                      style={{ background: "hsl(150 14% 6%)" }}
                    >
                      <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Característica
                      </th>
                      <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        MetaMask
                      </th>
                      <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        RSTN Wallet
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {WALLET_INTEGRATION.differences.map((d, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/30 transition-colors hover:bg-surface-2"
                      >
                        <td className="px-5 py-3">
                          <span className="font-body text-xs font-medium text-foreground">
                            {d.feature}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {d.metamask}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="font-mono text-xs"
                            style={{ color: "hsl(150 100% 45%)" }}
                          >
                            {d.rstn}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══ RPC API REFERENCE ═══ */}
        <section
          className="relative border-t border-border py-16 sm:py-24"
          style={{ background: "hsl(150 14% 4%)" }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
              <span className="label">API Reference</span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                JSON-RPC 2.0
              </h2>
              <p className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
                Endpoints disponibles en el RPC de rstn-node. Compatible con
                herramientas estándar.
              </p>
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
                        Método
                      </th>
                      <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Parámetros
                      </th>
                      <th className="hidden px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                        Retorna
                      </th>
                      <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Descripción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {RPC_METHODS.map((m, i) => (
                      <motion.tr
                        key={m.method}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="border-b border-border/50 transition-colors hover:bg-surface-2"
                      >
                        <td className="px-4 py-3">
                          <span
                            className="font-mono text-xs font-medium"
                            style={{ color: "hsl(150 100% 45%)" }}
                          >
                            {m.method}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {m.params}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="font-mono text-xs text-foreground">
                            {m.returns}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-body text-xs text-muted-foreground">
                            {m.description}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ RESOURCES ═══ */}
        <section
          id="resources"
          className="relative border-t border-border py-16 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
              <span className="label">Recursos</span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Documentación y programas
              </h2>
              <p className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
                Whitepapers, guías, grants y bug bounties. Todo lo que el equipo
                necesita.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {DEV_RESOURCES.map((res, i) => {
                const Icon = ICON_MAP[res.icon] || FileText;
                return (
                  <motion.div
                    key={res.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="card-sig group p-5"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{
                          background: "hsl(150 100% 45% / 0.10)",
                          border: "1px solid hsl(150 100% 45% / 0.20)",
                        }}
                      >
                        <Icon
                          className="h-5 w-5"
                          style={{ color: "hsl(150 100% 45%)" }}
                          strokeWidth={1.5}
                        />
                      </div>
                      <span className="tag text-[9px]">{res.type}</span>
                    </div>
                    <h3 className="mt-4 font-display text-sm font-semibold text-foreground">
                      {res.title}
                    </h3>
                    <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
                      {res.description}
                    </p>
                    <div className="mt-4 flex items-center gap-1 font-body text-xs font-medium text-muted-foreground transition-colors">
                      <span>Próximamente</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section
          className="relative overflow-hidden border-t border-border py-16 sm:py-24"
          style={{ background: "hsl(150 14% 4%)" }}
        >
          <div className="absolute inset-0 bg-mesh opacity-50" />
          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <span className="label">Terminal del protocolo</span>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Explora el protocolo completo
            </h2>
            <p className="mx-auto mt-4 max-w-2xl font-body text-base leading-relaxed text-muted-foreground">
              Arquitectura, consenso, criptografía, nodos y tokenomics. Todo en
              un dashboard interactivo.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/terminal"
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 font-body text-sm font-semibold transition-all"
                style={{
                  background: "hsl(150 100% 45%)",
                  color: "hsl(150 50% 10%)",
                  boxShadow: "0 0 24px hsl(150 100% 45% / 0.15)",
                }}
              >
                Abrir terminal
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 font-body text-sm font-semibold text-foreground transition-colors hover:border-border-hover"
                style={{ background: "hsl(150 14% 9%)" }}
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                Volver al inicio
              </Link>
            </div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-border py-10 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-2.5">
                <RstnLogo size="sm" />
                <span className="font-display text-sm font-bold text-foreground">
                  Resistance Network
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="font-body text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t(link.labelKey)}
                  </a>
                ))}
                <Link
                  to="/terminal"
                  className="font-body text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("nav.terminal")}
                </Link>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">
                Apache 2.0 · Software experimental · No es una inversión
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

// ═══ PLAYGROUND COMPONENT ═══
const PlaygroundSection = () => {
  const [activeContract, setActiveContract] = useState<string>(
    PLAYGROUND_CONTRACTS[0].id,
  );
  const [copied, setCopied] = useState(false);

  const contract =
    PLAYGROUND_CONTRACTS.find((c) => c.id === activeContract) ||
    PLAYGROUND_CONTRACTS[0];

  const copyCode = () => {
    navigator.clipboard.writeText(contract.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Contract selector */}
      <div className="space-y-2">
        {PLAYGROUND_CONTRACTS.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveContract(c.id)}
            className={`w-full rounded-lg border p-4 text-left transition-all ${
              activeContract === c.id
                ? "border-primary/30"
                : "border-border hover:border-border-hover"
            }`}
            style={{
              background:
                activeContract === c.id
                  ? "hsl(150 100% 45% / 0.06)"
                  : "hsl(150 14% 9%)",
            }}
          >
            <div className="flex items-center gap-2">
              <FileText
                className="h-4 w-4"
                style={{
                  color:
                    activeContract === c.id
                      ? "hsl(150 100% 45%)"
                      : "var(--muted-foreground)",
                }}
                strokeWidth={1.5}
              />
              <h4 className="font-body text-sm font-semibold text-foreground">
                {c.name}
              </h4>
            </div>
            <p className="mt-1.5 font-body text-[11px] leading-relaxed text-muted-foreground">
              {c.description}
            </p>
            <span className="mt-2 inline-block tag text-[9px]">
              {c.language}
            </span>
          </button>
        ))}
      </div>

      {/* Code viewer */}
      <div className="card-sig overflow-hidden p-0">
        {/* Editor header */}
        <div
          className="flex items-center justify-between border-b border-border px-4 py-3"
          style={{ background: "hsl(150 14% 7%)" }}
        >
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "hsl(5 80% 55%)" }}
              />
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "hsl(150 70% 50%)" }}
              />
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: "hsl(150 100% 45%)" }}
              />
            </div>
            <span className="ml-3 font-mono text-[10px] text-muted-foreground">
              {contract.name}.{contract.language === "Solidity+" ? "sol" : "rs"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-body text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              style={{ background: "hsl(150 14% 12%)" }}
            >
              {copied ? (
                <>
                  <Check
                    className="h-3 w-3"
                    style={{ color: "hsl(150 100% 45%)" }}
                    strokeWidth={2}
                  />
                  <span style={{ color: "hsl(150 100% 45%)" }}>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" strokeWidth={1.5} />
                  <span>Copiar</span>
                </>
              )}
            </button>
            <button
              disabled
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-body text-[11px] text-muted-foreground opacity-50"
              style={{ background: "hsl(150 14% 12%)" }}
              title="Disponible tras el lanzamiento de testnet"
            >
              <Play className="h-3 w-3" strokeWidth={1.5} />
              <span>Compilar</span>
            </button>
          </div>
        </div>

        {/* Code */}
        <div
          className="overflow-x-auto p-5"
          style={{ background: "hsl(150 14% 6%)" }}
        >
          <pre className="font-mono text-xs leading-relaxed text-foreground">
            <code>{contract.code}</code>
          </pre>
        </div>

        {/* Info bar */}
        <div
          className="flex items-center gap-3 border-t border-border px-4 py-3"
          style={{ background: "hsl(150 14% 7%)" }}
        >
          <Sparkles
            className="h-3.5 w-3.5"
            style={{ color: "hsl(150 70% 50%)" }}
            strokeWidth={1.5}
          />
          <p className="font-body text-[11px] text-muted-foreground">
            La compilación y simulación en el navegador estarán disponibles tras
            el lanzamiento de testnet pública.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DevPortal;
