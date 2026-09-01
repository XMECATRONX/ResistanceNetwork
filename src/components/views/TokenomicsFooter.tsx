import { motion } from "framer-motion";
import { Code2, FileText, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getProtocolLicense, getTokenUtility } from "@/lib/protocol";
import { Panel } from "@/components/dashboard/Panel";

/**
 * OSS/License + Token Utility sections.
 */
export const TokenomicsFooter = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const tk = (k: string) => t(`views.tokenomicsView.${k}`);
  const PROTOCOL_LICENSE = getProtocolLicense(lang);
  const TOKEN_UTILITY = getTokenUtility(lang);

  return (
    <>
      <Panel title={tk("ossTitle")} description={tk("ossDesc")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel accent-bar bg-mesh p-5"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("ossLicenseTitle")}
              </h4>
            </div>
            <p className="font-body text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                {tk("ossRepoLabel")}
              </span>
              <span className="font-mono">{PROTOCOL_LICENSE.repository}</span>
            </p>
            <p className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                {tk("ossPatentLabel")}
              </span>
              {PROTOCOL_LICENSE.patentClause}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="card-hover p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <h4 className="font-display text-sm font-semibold text-foreground">
                {tk("ossDisclaimerTitle")}
              </h4>
            </div>
            <p className="font-body text-xs leading-relaxed text-muted-foreground">
              {PROTOCOL_LICENSE.disclaimer}
            </p>
          </motion.div>
        </div>
      </Panel>

      <Panel title={tk("utilityTitle")} description={tk("utilityDesc")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {TOKEN_UTILITY.map((item, i) => (
            <motion.div
              key={item.use}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card-hover flex items-start gap-3 p-5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.06]">
                <Coins className="h-4 w-4 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="font-display text-sm font-semibold text-foreground">
                  {item.use}
                </h4>
                <p className="mt-1.5 font-body text-xs leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>
    </>
  );
};
