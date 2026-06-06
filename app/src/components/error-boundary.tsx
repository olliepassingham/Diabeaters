import { Component, ErrorInfo, ReactNode } from "react";
import { captureException } from "@/observability/sentry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isClearing: boolean;
  componentStack: string | null;
}

const CACHE_RECOVERY_KEY = "diabeaters-cache-recovery-attempted";

async function clearAllCachesAndReload() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (e) {
    console.error("Cache clearing failed:", e);
  }

  window.location.reload();
}

function shouldAttemptCacheRecovery(error: Error | null): boolean {
  if (!error || import.meta.env.DEV) return false;
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(CACHE_RECOVERY_KEY) === "1") {
    return false;
  }
  return isCacheRelatedError(error);
}

function isCacheRelatedError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || "";
  const stack = error.stack || "";
  const looksLikeHookMismatch =
    msg.includes("Invalid hook call") ||
    (msg.includes("Cannot read properties of null") && msg.includes("use"));
  const mentionsHookName =
    msg.includes("useRef") ||
    msg.includes("useState") ||
    msg.includes("useEffect") ||
    msg.includes("useContext");
  const fromBundledChunk = stack.includes(".vite/deps") || stack.includes("chunk-");
  return (looksLikeHookMismatch || mentionsHookName) && fromBundledChunk;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isClearing: false,
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

    if (shouldAttemptCacheRecovery(error)) {
      try {
        sessionStorage.setItem(CACHE_RECOVERY_KEY, "1");
      } catch {
        // ignore quota / private mode
      }
      this.setState({ isClearing: true });
      void clearAllCachesAndReload();
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.isClearing) {
        return (
          <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
            <div className="max-w-md text-center">
              <h1 className="text-lg font-semibold mb-2">Refreshing…</h1>
              <p className="text-sm text-muted-foreground">
                Clearing cached data and reloading. One moment please.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div
          className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground"
          data-testid="app-error-fallback"
        >
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-lg font-semibold">Something went wrong. Please try again.</h1>
            <p className="text-sm text-muted-foreground">
              If the problem keeps happening, try closing and reopening the app.
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
