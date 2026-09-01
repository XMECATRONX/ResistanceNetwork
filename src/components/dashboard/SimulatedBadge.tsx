import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Honest "SIMULATED · Pre-mainnet" badge.
 *
 * RSTN is in Phase 0 (Specification). There is no live mainnet/testnet node
 * running, so several views (Explorer, Network Visualizer, Monitoring,
 * Faucet, Staking, Overview) display mock/preview data. This badge makes that
 * explicit so the project never presents simulated data as real.
 */
export const SimulatedBadge = ({ className = "" }: { className?: string }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/[0.06] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber ${className}`}
    >
      <AlertTriangle className="h-3 w-3" strokeWidth={2} />
      {t("common.simulated")}
    </span>
  );
};
