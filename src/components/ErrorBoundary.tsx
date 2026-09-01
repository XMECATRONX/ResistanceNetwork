import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches render errors in child components.
 * Shows a graceful fallback instead of a white screen crash.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="flex min-h-[400px] items-center justify-center p-8"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/5">
              <svg
                className="h-7 w-7 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Algo salió mal
            </h2>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              Se produjo un error inesperado. Puedes intentar recargar la vista.
            </p>
            {this.state.error?.message && (
              <code className="mt-4 max-w-full overflow-x-auto rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-muted-foreground">
                {this.state.error.message}
              </code>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={this.handleReset}
                className="rounded-md border border-border bg-surface-1 px-4 py-2 font-body text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
              >
                Reintentar
              </button>
              <a
                href="/"
                className="rounded-md bg-primary px-4 py-2 font-body text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Ir al inicio
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * InlineErrorFallback — compact fallback for lazy-loaded views inside the terminal.
 * Shows a small error card instead of crashing the whole dashboard.
 */
export const InlineErrorFallback = ({ onReset }: { onReset?: () => void }) => (
  <div
    className="flex min-h-[300px] items-center justify-center p-8"
    role="alert"
    aria-live="assertive"
  >
    <div className="flex max-w-sm flex-col items-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive/5">
        <svg
          className="h-6 w-6 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">
        Error al cargar esta vista
      </h3>
      <p className="mt-1.5 font-body text-sm text-muted-foreground">
        Intenta recargar o selecciona otra sección del terminal.
      </p>
      {onReset && (
        <button
          onClick={onReset}
          className="mt-4 rounded-md border border-border bg-surface-1 px-4 py-2 font-body text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
        >
          Reintentar
        </button>
      )}
    </div>
  </div>
);
