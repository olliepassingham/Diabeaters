import { Component, ErrorInfo, ReactNode } from "react";
import { captureException } from "@/observability/sentry";
import { isOnline } from "@/lib/offline";
import { isLazyChunkLoadError } from "@/lib/chunk-error-recovery";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    componentStack: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    captureException(error);
    if (errorInfo?.componentStack) {
      this.setState({ componentStack: errorInfo.componentStack });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground"
          data-testid="app-error-fallback"
        >
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-lg font-semibold">Something went wrong. Please try again.</h1>
            <p className="text-sm text-muted-foreground">
              {isLazyChunkLoadError(this.state.error)
                ? !isOnline()
                  ? "This page is not available offline yet. Connect briefly, open Home or Guides once while online, then try again."
                  : import.meta.env.DEV
                    ? "This page failed to load after a dev-server update. Hard-refresh or restart npm run dev."
                    : "This page failed to load. Close and reopen the app, or connect briefly and try again."
                : "If the problem keeps happening, try closing and reopening the app."}
            </p>
            {import.meta.env.DEV && this.state.error ? (
              <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-muted/50 p-2 text-left text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
                {[
                  this.state.componentStack
                    ? `Component stack:\n${this.state.componentStack}\n\n`
                    : "Component stack:\n(loading…)\n\n",
                  this.state.error.stack ? this.state.error.stack : this.state.error.message,
                ].join("")}
              </pre>
            ) : null}
            <div className="flex justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
                data-testid="button-retry"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
