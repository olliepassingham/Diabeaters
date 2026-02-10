import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";

export function useAIStatus() {
  return useQuery<{ available: boolean }>({
    queryKey: ["/api/ai-status"],
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

export function AIStatusBanner() {
  const { data, isLoading } = useAIStatus();

  if (isLoading || data?.available) return null;

  return (
    <div className="mb-4 p-3 rounded-md border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20 flex items-start gap-3" data-testid="banner-ai-unavailable">
      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">AI features are currently running in offline mode</p>
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          Personalised AI recommendations are unavailable right now. You'll still get helpful guidance based on your settings, but responses won't be as detailed. Everything else works normally.
        </p>
      </div>
    </div>
  );
}

export function AIStatusInline() {
  const { data, isLoading } = useAIStatus();

  if (isLoading || data?.available) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400" data-testid="inline-ai-unavailable">
      <Sparkles className="h-3 w-3" />
      <span>Offline mode - basic guidance only</span>
    </div>
  );
}
