import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Code2, ArrowUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RstnLogo } from "@/components/ui/RstnLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ROADMAP } from "@/lib/protocol";
import { TokenomicsSection } from "@/components/landing/TokenomicsSection";
import { EconomicsSection } from "@/components/landing/EconomicsSection";
import { MigrationSection } from "@/components/landing/MigrationSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProtocolSections } from "@/components/landing/ProtocolSections";

const NAV_LINKS = [
  { labelKey: "nav.vision", href: "#vision" },
  { labelKey: "nav.architecture", href: "#architecture" },
  { labelKey: "nav.flow", href: "#flow" },
  { labelKey: "nav.crypto", href: "#crypto" },
  { labelKey: "nav.global", href: "#global" },
  { labelKey: "nav.security", href: "#security" },
  { labelKey: "nav.migration", href: "#migration" },
  { labelKey: "nav.economics", href: "#economics" },
  { labelKey: "nav.tokenomics", href: "#tokenomics" },
  { labelKey: "nav.roadmap", href: "#roadmap" },
];

const SECTION_IDS = [
  "vision",
  "architecture",
  "flow",
  "crypto",
  "global",
  "security",
  "migration",
  "economics",
  "tokenomics",
  "roadmap",
];

const Landing = () => {
  const { t, i18n } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 600);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    const el = document.getElementById(href.replace("#", ""));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileNavOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-noise">
      <a href="#main-content" className="skip-link">
        {t("mobile.skipToContent")}
      </a>
      <main id="main-content">
        {/* Scroll progress bar */}
        <div className="fixed top-0 left-0 right-0 z-[60] h-0.5 bg-transparent pointer-events-none">
          <div
            className="h-full transition-all duration-150 ease-out"
            style={{
              width: `${scrollProgress}%`,
              background:
                "linear-gradient(90deg, hsl(150 100% 45%), hsl(185 100% 55%))",
              boxShadow: "0 0 4px hsl(150 100% 45% / 0.3)",
            }}
          />
        </div>
        <nav
          className="glass sticky top-0 z-50 border-b border-border"
          aria-label="Navegación principal"
        >
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6 sm:py-3">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2.5"
              aria-label="Resistance Network — home"
            >
              <RstnLogo size="md" />
              <span className="hidden font-display text-base font-bold tracking-tight text-foreground sm:inline">
                Resistance Network
              </span>
            </Link>

            <nav
              className="hidden flex-1 items-center justify-center gap-1 xl:flex"
              aria-label="Navegación de secciones"
            >
              {NAV_LINKS.map((link) => {
                const isActive = activeSection === link.href.replace("#", "");
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="relative rounded-md px-2.5 py-1.5 font-body text-xs font-medium transition-colors whitespace-nowrap group focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    style={
                      isActive ? { color: "hsl(150 100% 45%)" } : undefined
                    }
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span
                      className={
                        isActive
                          ? ""
                          : "text-muted-foreground group-hover:text-foreground transition-colors"
                      }
                    >
                      {t(link.labelKey)}
                    </span>
                    <span
                      className="absolute -bottom-0.5 left-2.5 right-2.5 h-px transition-all duration-300 ease-out"
                      style={{
                        width: isActive ? "calc(100% - 1.25rem)" : "0%",
                        background: "hsl(150 100% 45%)",
                        boxShadow: isActive
                          ? "0 0 6px hsl(150 100% 45% / 0.5)"
                          : "none",
                      }}
                    />
                    <span
                      className="absolute -bottom-0.5 left-2.5 right-2.5 h-px w-0 group-hover:w-[calc(100%-1.25rem)] transition-all duration-300 ease-out"
                      style={{ background: "hsl(var(--foreground-tertiary))" }}
                    />
                  </a>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground xl:hidden focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                aria-label={
                  mobileNavOpen ? t("mobile.closeMenu") : t("mobile.openMenu")
                }
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-nav"
              >
                {mobileNavOpen ? (
                  <X className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Menu className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
              <Link
                to="/dev"
                className="hidden items-center gap-1.5 font-body text-xs font-medium text-muted-foreground hover:text-foreground 2xl:flex"
              >
                <Code2 className="h-4 w-4" strokeWidth={1.5} />
                <span>{t("nav.build")}</span>
              </Link>
              <LanguageSwitcher />
              <Link
                to="/terminal"
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-body text-sm font-bold transition-all bg-primary text-primary-foreground hover:shadow-glow-primary hover:scale-[1.03] active:scale-[0.97] sm:px-4"
              >
                {t("nav.terminal")}
              </Link>
            </div>
          </div>

          {/* Mobile nav panel */}
          <AnimatePresence>
            {mobileNavOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="xl:hidden overflow-hidden border-t border-border bg-background shadow-xl shadow-black/40"
                id="mobile-nav"
                role="navigation"
                aria-label="Navegación móvil"
              >
                <div className="grid grid-cols-2 gap-1 px-4 py-4 sm:px-6 lg:grid-cols-3">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className="rounded-lg px-3 py-2.5 font-body text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors"
                    >
                      {t(link.labelKey)}
                    </a>
                  ))}
                  <Link
                    to="/dev"
                    className="col-span-2 lg:col-span-3 mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2.5 font-body text-sm font-medium text-primary hover:bg-surface-1 transition-colors"
                  >
                    <Code2 className="h-4 w-4" strokeWidth={1.5} />
                    <span>{t("nav.build")}</span>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        <HeroSection />

        <ProtocolSections />

        <SecuritySection />

        <MigrationSection />

        <EconomicsSection />

        <TokenomicsSection />

        {/* Roadmap */}
        <section
          id="roadmap"
          className="relative border-t border-border py-12 bg-surface-1 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
            <motion.span
              className="label"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              {t("sections.roadmap.label")}
            </motion.span>
            <motion.h2
              className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              {t("sections.roadmap.title")}
            </motion.h2>
            <div className="mt-10 flex flex-wrap justify-center gap-4 sm:mt-16">
              {ROADMAP.map((phase, i) => (
                <motion.div
                  key={phase.phase}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -3 }}
                  className="card-sig w-full p-5 sm:w-[calc(50%-0.5rem)] lg:w-[calc(20%-0.8rem)]"
                >
                  <span className="font-mono text-[10px] text-primary font-bold">
                    {phase.phase}
                  </span>
                  <h3 className="mt-2 font-display text-sm font-semibold">
                    {phase.title}
                  </h3>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {phase.period}
                  </p>
                  <p className="mt-4 font-body text-[11px] text-muted-foreground">
                    {phase.items.length} {t("sections.roadmap.deliverables")}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-10 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 flex flex-col items-center gap-6 sm:gap-6 sm:px-6 py-4">
            <div className="flex items-center gap-2.5">
              <RstnLogo size="sm" />
              <span className="font-display text-sm font-bold">
                Resistance Network
              </span>
            </div>
            <p
              className="max-w-xl text-center font-body text-[10px] sm:text-[11px] text-muted-foreground/70 px-4"
              dangerouslySetInnerHTML={{ __html: t("footer.description") }}
            />
            <p className="max-w-2xl text-center font-body text-[9px] sm:text-[10px] text-muted-foreground/50 px-4 leading-relaxed">
              {i18n.language === "es"
                ? "RSTN es software experimental. Los tokens RSTN no tienen valor garantizado y pueden perder todo su valor. La participación en staking implica riesgo de slashing. Las transacciones en blockchain son irreversibles. No inviertas más de lo que puedes permitirte perder. Consulte asesoría legal sobre la clasificación del token en su jurisdicción."
                : "RSTN is experimental software. RSTN tokens have no guaranteed value and may lose all value. Staking participation carries slashing risk. Blockchain transactions are irreversible. Do not invest more than you can afford to lose. Consult legal advice regarding token classification in your jurisdiction."}
            </p>
            <nav
              aria-label="Navegación del pie de página"
              className="flex gap-6"
            >
              <Link
                to="/terminal"
                className="text-xs text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
              >
                {t("footer.terminal")}
              </Link>
              <Link
                to="/dev"
                className="text-xs text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
              >
                {t("footer.devPortal")}
              </Link>
            </nav>
          </div>
        </footer>

        <AnimatePresence>
          {showBackToTop && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label={t("footer.backToTop")}
              className="fixed bottom-4 right-4 p-2.5 rounded-full bg-primary text-primary-foreground shadow-glow-primary z-50 sm:bottom-6 sm:right-6 sm:p-3"
            >
              <ArrowUp className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Landing;
