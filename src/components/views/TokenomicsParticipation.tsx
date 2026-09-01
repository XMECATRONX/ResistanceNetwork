import { motion } from "framer-motion";
import { Award, ShieldCheck, Lock, Layers, Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getGenesisDistribution, getGenesisDetail } from "@/lib/protocol";
import { Panel } from "@/components/dashboard/Panel";

/**
 * Proof of Participation + Genesis Detail sections.
 */
export const TokenomicsParticipation = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isEs = lang === "es";
  const tk = (k: string) => t(`views.tokenomicsView.${k}`);
  const GENESIS_DISTRIBUTION = getGenesisDistribution(lang);
  const GENESIS_DETAIL = getGenesisDetail(lang);

  return (
    <>
      {/* Proof of Participation */}
      <Panel title={tk("popTitle")} description={tk("popDesc")}>
        <div
          className="mb-6 flex items-center gap-3 rounded-lg border border-border p-4"
          style={{ background: "hsl(150 100% 45% / 0.04)" }}
        >
          <Award className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
          <div>
            <p className="font-body text-sm font-semibold text-foreground">
              {GENESIS_DISTRIBUTION.mechanism}
            </p>
            <p className="mt-0.5 font-body text-xs text-muted-foreground">
              {GENESIS_DISTRIBUTION.principle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-display text-sm font-semibold text-foreground">
              {tk("popHowTitle")}
            </h4>
            {GENESIS_DISTRIBUTION.howItWorks.map((step, i) => (
              <motion.div
                key={step.phase}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-3 rounded-lg border border-border bg-surface-1 p-4"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/[0.06]">
                  <span className="font-mono text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-body text-xs font-semibold text-foreground">
                    {step.phase}
                  </p>
                  <p className="mt-1 font-body text-xs text-muted-foreground">
                    {step.action}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-medium text-primary">
                      {step.reward}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="card-hover p-5">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck
                  className="h-4 w-4 text-primary"
                  strokeWidth={1.5}
                />
                <h4 className="font-display text-sm font-semibold text-foreground">
                  {tk("popAntiWhaleTitle")}
                </h4>
              </div>
              <p className="font-body text-xs leading-relaxed text-muted-foreground">
                {GENESIS_DISTRIBUTION.antiWhale}
              </p>
            </div>
            <div className="card-hover p-5">
              <div className="mb-2 flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <h4 className="font-display text-sm font-semibold text-foreground">
                  {tk("popFairTitle")}
                </h4>
              </div>
              <p className="font-body text-xs leading-relaxed text-muted-foreground">
                {GENESIS_DISTRIBUTION.legalShield}
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
              <p className="font-mono text-xs font-bold text-primary">
                {GENESIS_DISTRIBUTION.noSale}
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {/* Genesis Detail */}
      <Panel title={tk("genesisTitle")} description={tk("genesisDesc")}>
        <div className="mb-5 rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
          <p className="font-body text-sm font-semibold text-foreground">
            {GENESIS_DETAIL.principle}
          </p>
          <p className="mt-2 font-mono text-xs font-bold text-primary">
            {GENESIS_DETAIL.noIco}
          </p>
        </div>

        <div className="space-y-3">
          {GENESIS_DETAIL.allocations.map((alloc, i) => (
            <motion.div
              key={alloc.bucket}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-hover p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-display text-sm font-semibold text-foreground">
                    {alloc.bucket}
                  </h4>
                  <p className="mt-1 font-mono text-xs font-bold text-primary">
                    {alloc.amount}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <p className="font-body text-xs leading-relaxed text-muted-foreground">
                  {alloc.mechanism}
                </p>
                <div className="flex items-start gap-2">
                  <ShieldCheck
                    className="mt-0.5 h-3 w-3 shrink-0 text-accent"
                    strokeWidth={1.5}
                  />
                  <p className="font-body text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {isEs ? "Naturaleza: " : "Nature: "}
                    </span>
                    {alloc.legal}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-hover p-5">
            <div className="mb-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("genesisAuditTitle")}
              </h4>
            </div>
            <p className="font-body text-xs leading-relaxed text-muted-foreground">
              {GENESIS_DETAIL.genesisBlock.description}
            </p>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              {GENESIS_DETAIL.genesisBlock.auditability}
            </p>
          </div>
          <div className="card-hover p-5">
            <div className="mb-2 flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("genesisNoIcoTitle")}
              </h4>
            </div>
            <p className="font-body text-xs leading-relaxed text-muted-foreground">
              {tk("genesisNoIcoBody")}
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
};
