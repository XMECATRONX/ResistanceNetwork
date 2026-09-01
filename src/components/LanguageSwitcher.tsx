import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";

export const LanguageSwitcher = ({
  compact = false,
}: {
  compact?: boolean;
}) => {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("resist-lang", lang);
    document.documentElement.lang = lang;
    setOpen(false);
  };

  const current = i18n.language === "es" ? "es" : "en";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-body text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/30 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        aria-label={t("language")}
        aria-expanded={open}
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span className="font-mono text-[11px]">{current.toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg border border-border bg-surface-2 shadow-xl shadow-black/40 overflow-hidden">
          {[
            { code: "en", label: "English" },
            { code: "es", label: "Español" },
          ].map((opt) => (
            <button
              key={opt.code}
              onClick={() => changeLang(opt.code)}
              className={`flex w-full items-center justify-between px-3 py-2 font-body text-[13px] transition-colors hover:bg-surface-3 ${
                current === opt.code
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {opt.label}
              {current === opt.code && (
                <span className="text-primary text-[10px]">●</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
