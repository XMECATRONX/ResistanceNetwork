import { motion } from "framer-motion";
import {
  Flame,
  CheckCircle2,
  Clock,
  Coins,
  Activity,
  ExternalLink,
  Lock,
  TrendingDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/dashboard/Panel";
import {
  getBridgeEconomics,
  getBridgeTransparency,
  getBuybackEvents,
} from "@/lib/protocolTransparency";

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtUsd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n}`;

export const TransparencyFeed = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "es" ? "es" : "en";

  const BRIDGE_ECONOMICS = getBridgeEconomics(lang);
  const BRIDGE_TRANSPARENCY = getBridgeTransparency(lang);
  const BUYBACK_EVENTS = getBuybackEvents(lang);

  return (
    <>
      {/* ─── Buyback feed en vivo ─── */}
      <Panel
        title={t("views.transparency.buybackTitle")}
        description={t("views.transparency.buybackDesc")}
      >
        <div className="space-y-2.5">
          {BUYBACK_EVENTS.map((evt, i) => {
            const isPending =
              evt.status === "pending" || evt.status === "pendiente";
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  isPending
                    ? "border-dashed border-border bg-muted/20"
                    : "border-border bg-card"
                }`}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: isPending
                      ? "hsl(150 70% 50% / 0.1)"
                      : "hsl(150 100% 55% / 0.1)",
                  }}
                >
                  {isPending ? (
                    <Clock
                      className="h-4 w-4"
                      style={{ color: "hsl(150 70% 50%)" }}
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Flame
                      className="h-4 w-4"
                      style={{ color: "hsl(150 100% 55%)" }}
                      strokeWidth={1.5}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {evt.week}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[8px] ${
                        isPending
                          ? "border border-amber/20 text-amber bg-amber/[0.06]"
                          : "border border-primary/20 text-primary bg-primary/[0.06]"
                      }`}
                    >
                      {isPending
                        ? t("views.transparency.statusPending")
                        : t("views.transparency.statusExecuted")}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {isPending
                      ? t("views.transparency.buybackPending")
                      : t("views.transparency.buybackExecuted", {
                          amount: fmt(evt.resistBurned),
                          price: evt.resistPrice,
                        })}
                  </p>
                </div>

                {!isPending && (
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {t("views.transparency.buybackFees")}
                      </p>
                      <p className="font-mono text-[11px] font-semibold text-foreground">
                        {fmtUsd(evt.feesUsd)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {t("views.transparency.buybackBurned")}
                      </p>
                      <p
                        className="font-mono text-[11px] font-bold"
                        style={{ color: "hsl(150 100% 55%)" }}
                      >
                        {fmt(evt.resistBurned)}
                      </p>
                    </div>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-primary/30"
                      title={`Tx: ${evt.txHash}`}
                    >
                      <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    </a>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </Panel>

      {/* ─── Verifiable metrics ─── */}
      <Panel
        title={t("views.transparency.metricsTitle")}
        description={BRIDGE_TRANSPARENCY.subtitle}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BRIDGE_ECONOMICS.transparency.dashboard.map((item, i) => (
            <motion.div
              key={item.metric}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="card p-4"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="font-body text-[11px] font-medium text-foreground">
                    {item.metric}
                  </p>
                  <p className="mt-1 font-body text-[10px] text-muted-foreground">
                    {item.source}
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/[0.06] px-1.5 py-0.5 font-mono text-[8px] text-primary">
                    <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                    {t("views.transparency.onChain")}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div
          className="mt-4 flex items-start gap-2 rounded-md border border-border p-4"
          style={{ background: "hsl(150 14% 9%)" }}
        >
          <Lock
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            strokeWidth={1.5}
          />
          <div>
            <h3 className="font-display text-xs font-semibold text-foreground">
              {t("views.transparency.antiFraudTitle")}
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.transparency.antiFraud}
            </p>
          </div>
        </div>

        <div
          className="mt-3 flex items-start gap-2 rounded-md border p-4"
          style={{
            borderColor: "hsl(150 100% 55% / 0.2)",
            background: "hsl(150 100% 55% / 0.03)",
          }}
        >
          <Activity
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "hsl(150 100% 55%)" }}
            strokeWidth={1.5}
          />
          <div>
            <h3
              className="font-display text-xs font-semibold"
              style={{ color: "hsl(150 100% 55%)" }}
            >
              {t("views.transparency.cadenceTitle")}
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.transparency.cadence}
            </p>
          </div>
        </div>

        <p className="mt-3 text-center font-body text-[10px] text-muted-foreground italic">
          {BRIDGE_TRANSPARENCY.note}
        </p>
      </Panel>

      {/* ─── Compliance ─── */}
      <Panel
        title={t("views.transparency.complianceTitle")}
        description={t("views.transparency.complianceDesc")}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <Coins className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h3 className="mt-2 font-display text-xs font-semibold text-foreground">
              {t("views.transparency.complianceNotSecurity")}
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.legal.notSecurity}
            </p>
          </div>
          <div className="card p-4">
            <TrendingDown
              className="h-4 w-4"
              style={{ color: "hsl(150 70% 50%)" }}
              strokeWidth={1.5}
            />
            <h3 className="mt-2 font-display text-xs font-semibold text-foreground">
              {t("views.transparency.complianceVariableYield")}
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.legal.noGuaranteedYield}
            </p>
          </div>
          <div className="card p-4">
            <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h3 className="mt-2 font-display text-xs font-semibold text-foreground">
              {t("views.transparency.complianceLegalClass")}
            </h3>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-muted-foreground">
              {BRIDGE_ECONOMICS.legal.howeyTest}
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
};
