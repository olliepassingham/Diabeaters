import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { BgPrefillResult } from "@/lib/cgm/prefill";

type CgmPrefillButtonProps = {
  prefill: BgPrefillResult | null;
  loading?: boolean;
  bgUnits: string;
  currentValue: string;
  onApply: (value: string) => void;
  onRefresh?: () => void;
  testId?: string;
};

export function CgmPrefillButton({
  prefill,
  loading,
  bgUnits,
  currentValue,
  onApply,
  onRefresh,
  testId = "button-cgm-prefill",
}: CgmPrefillButtonProps) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Checking for recent BG…
      </span>
    );
  }

  if (!prefill || currentValue.trim()) return null;

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => onApply(prefill.value)}
        data-testid={testId}
      >
        Use recent ({prefill.value} {bgUnits})
      </Button>
      <p className="text-[11px] leading-snug text-muted-foreground">{prefill.source}</p>
      {onRefresh ? (
        <button
          type="button"
          className="text-[11px] text-primary underline-offset-2 hover:underline"
          onClick={onRefresh}
        >
          Refresh
        </button>
      ) : null}
    </div>
  );
}
