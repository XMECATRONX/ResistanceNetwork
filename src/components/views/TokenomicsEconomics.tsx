import { motion } from "framer-motion";
import { Lock, Users, TrendingUp, Flame, Layers, Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getMonetaryPolicy } from "@/lib/protocol";
import { Panel } from "@/components/dashboard/Panel";

/**
 * Staking & Governance + Monetary Policy sections.
 */
export const TokenomicsEconomics = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isEs = lang === "es";
  const tk = (k: string) => t(`views.tokenomicsView.${k}`);
  const MONETARY_POLICY = getMonetaryPolicy(lang);

  return (
    <>
      {/* Staking & Governance */}
      <Panel title={tk("stakingTitle")} description={tk("stakingDesc")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card-hover p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("stakingStaking")}
              </h4>
            </div>
            <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
              {t("views.tokenomicsView.stakingStakingBody", {
                x: isEs
                  ? "variables según rendimiento de red"
                  : "variable based on network performance",
              })}{" "}
              {isEs
                ? "Slashing proporcional no destructivo."
                : "Proportional non-destructive slashing."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
                <span className="label-muted text-[10px]">
                  {tk("stakingMinStake")}
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                  32,000 RSTN
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
                <span className="label-muted text-[10px]">
                  {tk("stakingDelegation")}
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-primary">
                  1 RSTN
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
                <span className="label-muted text-[10px]">
                  {tk("stakingRewards")}
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                  {tk("stakingRewardsVal")}
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
                <span className="label-muted text-[10px]">
                  {tk("stakingUnbonding")}
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                  {tk("stakingUnbondingVal")}
                </p>
              </div>
            </div>
          </div>

          <div className="card-hover p-4">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("stakingGovernance")}
              </h4>
            </div>
            <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
              {tk("stakingGovernanceBody")}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
                <span className="label-muted text-[10px]">
                  {tk("stakingVoting")}
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                  {tk("stakingVotingVal")}
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
                <span className="label-muted text-[10px]">
                  {tk("stakingThreshold")}
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-accent">
                  {tk("stakingThresholdVal")}
                </p>
              </div>
            </div>
          </div>

          <div className="card-hover p-4">
            <div className="flex items-center gap-2">
              <TrendingUp
                className="h-3.5 w-3.5 text-primary"
                strokeWidth={1.5}
              />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("stakingMonetary")}
              </h4>
            </div>
            <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
              {tk("stakingMonetaryBody")}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
                <span className="label-muted text-[10px]">
                  {tk("stakingBurn")}
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-primary">
                  100%
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
                <span className="label-muted text-[10px]">
                  {tk("stakingValidators")}
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                  100%
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
                <span className="label-muted text-[10px]">
                  {tk("stakingMinting")}
                </span>
                <p className="mt-0.5 font-mono text-sm font-bold text-accent">
                  ≤2%
                </p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Monetary Policy */}
      <Panel title={tk("monetaryTitle")} description={tk("monetaryDesc")}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card-hover p-5">
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("monetaryFeeSplitTitle")}
              </h4>
            </div>
            <div className="space-y-3">
              {[
                {
                  label: tk("monetaryFeeBurn"),
                  pct: "100%",
                  color: "bg-primary",
                },
                {
                  label: tk("monetaryFeeValidators"),
                  pct: "100%",
                  color: "bg-foreground",
                },
              ].map((f) => (
                <div key={f.label}>
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs text-muted-foreground">
                      {f.label}
                    </span>
                    <span className="font-mono text-sm font-bold text-foreground">
                      {f.pct}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${f.color}`}
                      style={{ width: f.pct }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 font-body text-xs leading-relaxed text-muted-foreground">
              {tk("monetaryFeeSplitBody")}
            </p>
          </div>

          <div className="card-hover p-5">
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("monetaryHalvingTitle")}
              </h4>
            </div>
            <div className="space-y-2">
              {MONETARY_POLICY.reserveDistribution.schedule.map((epoch, i) => (
                <motion.div
                  key={epoch.epoch}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2"
                >
                  <div>
                    <p className="font-mono text-[11px] font-medium text-foreground">
                      {epoch.epoch}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {epoch.amount}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-primary">
                    {epoch.percentage}%
                  </span>
                </motion.div>
              ))}
            </div>
            <p className="mt-3 font-body text-xs leading-relaxed text-muted-foreground">
              {tk("monetaryHalvingBody")}
            </p>
          </div>

          <div className="card-hover p-5">
            <div className="mb-3 flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("monetaryZeroMintTitle")}
              </h4>
            </div>
            <div className="space-y-3">
              <div className="rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2.5">
                <p className="font-mono text-[11px] font-bold text-primary">
                  {tk("monetaryZeroMintHardCap")}
                </p>
                <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                  {tk("monetaryZeroMintHardCapBody")}
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface-1 px-3 py-2.5">
                <p className="font-mono text-[11px] font-bold text-foreground">
                  {tk("monetaryZeroMintMint")}
                </p>
                <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                  {tk("monetaryZeroMintMintBody")}
                </p>
              </div>
              <div className="rounded-md border border-destructive/20 bg-destructive/[0.04] px-3 py-2.5">
                <p className="font-mono text-[11px] font-bold text-destructive">
                  {tk("monetaryZeroMintBurn")}
                </p>
                <p className="mt-0.5 font-body text-[11px] text-muted-foreground">
                  {tk("monetaryZeroMintBurnBody")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
};
