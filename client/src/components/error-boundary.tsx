import { Component, ErrorInfo, ReactNode } from "react";

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

    if (isCacheRelatedError(error)) {
      this.setState({ isClearing: true });
      clearAllCachesAndReload();
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.state.isClearing) {
        return (
          <div className="min-h-screen flex items-center justify-center p-4 bg-white">
            <div className="max-w-md text-center">
              <h1 className="text-xl font-semibold mb-2" style={{ color: '#333' }}>Refreshing...</h1>
              <p style={{ color: '#666' }}>Clearing cached data and reloading. One moment please.</p>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-white">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => clearAllCachesAndReload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                data-testid="button-clear-reload"
              >
                Clear Cache & Reload
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                data-testid="button-reload"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
