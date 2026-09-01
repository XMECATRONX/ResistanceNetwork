import { useTranslation } from "react-i18next";
import { TokenomicsFrame } from "@/components/views/TokenomicsFrame";
import { TokenomicsParticipation } from "@/components/views/TokenomicsParticipation";
import { LpParticipationSection } from "@/components/views/LpParticipationSection";
import { TokenomicsEconomics } from "@/components/views/TokenomicsEconomics";
import { TokenomicsFooter } from "@/components/views/TokenomicsFooter";

/**
 * Tokenomics view — composes the distribution frame, Proof of Participation,
 * LP Participation (with the immutable invariant), economics and footer
 * sections into a single scrollable layout that matches the Landing page.
 */
export const TokenomicsView = () => {
  const { t } = useTranslation();
  void t; // i18n ready for future per-view keys

  return (
    <div className="space-y-6">
      <TokenomicsFrame />
      <TokenomicsParticipation />
      <LpParticipationSection />
      <TokenomicsEconomics />
      <TokenomicsFooter />
    </div>
  );
};

export default TokenomicsView;
