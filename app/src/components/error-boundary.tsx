import { Component, ErrorInfo, ReactNode } from "react";
import { captureException } from "@/observability/sentry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isClearing: boolean;
}

async function clearAllCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }
  } catch (e) {
    console.error("Cache clearing failed:", e);
  }

  window.location.reload();
}

function isCacheRelatedError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || '';
  const stack = error.stack || '';
  return (msg.includes("useRef") || msg.includes("useState") || msg.includes("useEffect") || msg.includes("useContext")) &&
    (stack.includes('.vite/deps') || stack.includes('chunk-'));
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isClearing: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    captureException(error);

    if (isCacheRelatedError(error)) {
      this.setState({ isClearing: true });
      clearAllCachesAndReload();
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
