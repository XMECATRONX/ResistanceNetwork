import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { i18n } = useTranslation();

  useEffect(() => {
    document.title =
      i18n.language === "es"
        ? "404 — Página no encontrada | RSTN"
        : "404 — Page not found | RSTN";
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        i18n.language === "es"
          ? "La página solicitada no existe. Explora RSTN: blockchain Layer 1 con resistencia post-cuántica."
          : "The requested page does not exist. Explore RSTN: Layer 1 blockchain with post-quantum resistance.",
      );
    const robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      const r = document.createElement("meta");
      r.setAttribute("name", "robots");
      r.setAttribute("content", "noindex, follow");
      document.head.appendChild(r);
    } else {
      robots.setAttribute("content", "noindex, follow");
    }
  }, []);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background bg-noise px-4"
      role="main"
    >
      <div className="flex max-w-lg flex-col items-center text-center">
        {/* 404 big number with glow */}
        <div className="relative">
          <h1 className="font-display text-7xl font-extrabold tracking-tighter text-foreground sm:text-8xl">
            4<span className="gradient-text-primary">0</span>4
          </h1>
          <div className="absolute inset-0 -z-10 blur-2xl opacity-20 bg-primary/30 rounded-full" />
        </div>

        <div className="mt-6 h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <h2 className="mt-6 font-display text-xl font-semibold text-foreground sm:text-2xl">
          {i18n.language === "es" ? "Ruta no encontrada" : "Route not found"}
        </h2>
        <p className="mt-3 font-body text-sm text-muted-foreground max-w-sm">
          {i18n.language === "es" ? (
            <>
              La página{" "}
              <code className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-xs text-foreground">
                {location.pathname}
              </code>{" "}
              no existe o fue movida.
            </>
          ) : (
            <>
              The page{" "}
              <code className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-xs text-foreground">
                {location.pathname}
              </code>{" "}
              does not exist or was moved.
            </>
          )}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="rounded-md bg-primary px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {i18n.language === "es" ? "Volver al inicio" : "Back to home"}
          </Link>
          <Link
            to="/terminal"
            className="rounded-md border border-border bg-surface-1 px-5 py-2.5 font-body text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            {i18n.language === "es" ? "Abrir terminal" : "Open terminal"}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
