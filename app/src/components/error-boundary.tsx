import { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { captureException } from "@/observability/sentry";
import { isOnline } from "@/lib/offline";
import {
  clearChunkRecoveryAttempted,
  isLazyChunkLoadError,
  markChunkRecoveryAttempted,
  shouldReloadAfterChunkError,
} from "@/lib/chunk-error-recovery";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  /** True while we auto-reload after a stale-chunk miss (new deploy). */
  autoRefreshing: boolean;
}

function reloadApp() {
  clearChunkRecoveryAttempted();
  window.location.reload();
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    componentStack: null,
    autoRefreshing: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      autoRefreshing: shouldReloadAfterChunkError(error),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (!isLazyChunkLoadError(error)) {
      captureException(error);
    }
    if (errorInfo?.componentStack) {
      this.setState({ componentStack: errorInfo.componentStack });
    }
    if (shouldReloadAfterChunkError(error)) {
      markChunkRecoveryAttempted();
      window.location.reload();
    }
  }

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const chunkMiss = isLazyChunkLoadError(this.state.error);
    const online = isOnline();

    if (this.state.autoRefreshing) {
      return (
        <div
          className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
          data-testid="app-error-fallback"
          data-error-kind="updating"
        >
          <div className="max-w-sm space-y-3 text-center">
            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            <h1 className="text-base font-semibold tracking-tight">Getting the latest version…</h1>
            <p className="text-sm text-muted-foreground">Hang tight — this only takes a moment.</p>
          </div>
        </div>
      );
    }

    if (chunkMiss && online) {
      return (
        <div
          className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
          data-testid="app-error-fallback"
          data-error-kind="update"
        >
          <div className="max-w-sm space-y-4 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <RefreshCw className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold tracking-tight">Update ready</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                A newer version of Diabeaters is available. Refresh to continue — your data stays put.
              </p>
            </div>
            {import.meta.env.DEV && this.state.error?.message ? (
              <p className="break-words text-xs text-muted-foreground">{this.state.error.message}</p>
            ) : null}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={reloadApp}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="button-retry"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (chunkMiss && !online) {
      return (
        <div
          className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
          data-testid="app-error-fallback"
          data-error-kind="offline"
        >
          <div className="max-w-sm space-y-4 text-center">
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold tracking-tight">This page needs a quick connection</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                It isn’t available offline yet. Connect briefly, open Home or Guides once while online, then try
                again.
              </p>
            </div>
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={reloadApp}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="button-retry"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
        data-testid="app-error-fallback"
        data-error-kind="generic"
      >
        <div className="max-w-sm space-y-4 text-center">
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Let’s refresh and try again</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {import.meta.env.DEV
                ? "Something unexpected happened in development. Check the details below, then refresh."
                : "A quick refresh usually sorts this. If it keeps happening, close and reopen the app."}
            </p>
          </div>
          {this.state.error?.message ? (
            <p className="break-words text-xs text-muted-foreground">{this.state.error.message}</p>
          ) : null}
          {import.meta.env.DEV && this.state.error ? (
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/50 p-2 text-left text-[11px] text-muted-foreground">
              {[
                this.state.componentStack
                  ? `Component stack:\n${this.state.componentStack}\n\n`
                  : "Component stack:\n(loading…)\n\n",
                this.state.error.stack ? this.state.error.stack : this.state.error.message,
              ].join("")}
            </pre>
          ) : null}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={reloadApp}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="button-retry"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }
}
