import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { storage, type Supply } from "@/lib/storage";
import { SupplyRunwayFill } from "@/components/visualizations/supply-runway-fill";
import { cn } from "@/lib/utils";

type Props = {
  supplies: Supply[];
  onSupplyClick?: (id: string) => void;
  className?: string;
};

/**
 * Compact “tightest runway” strip — illustrative forecast only.
 */
export function SupplyRunwayAtAGlance({ supplies, onSupplyClick, className }: Props) {
  const row = useMemo(() => {
    if (supplies.length === 0) return null;
    const mapped = supplies.map((s) => ({
      supply: s,
      actualDays: storage.getDaysRemaining(s),
      status: storage.getSupplyStatus(s) as "critical" | "low" | "ok",
    }));
    mapped.sort((a, b) => a.actualDays - b.actualDays);
    return mapped[0];
  }, [supplies]);

  if (!row) return null;

  const { supply, actualDays, status } = row;
  const unknown = actualDays >= 999;
  const fillPercent = unknown ? 0 : Math.min(100, Math.max(2, (actualDays / 30) * 100));
  const daysLabel = unknown ? "Set usage to estimate" : `${actualDays} day${actualDays === 1 ? "" : "s"} left`;

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[1.25rem] border-border/50 shadow-none",
        status === "critical" && "border-red-500/30 bg-red-500/[0.04] dark:bg-red-950/20",
        status === "low" && "border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-950/15",
        className,
      )}
      data-testid="card-supply-runway-at-glance"
    >
      <CardContent className="p-3.5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Shortest runway
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{supply.name}</p>
            {!unknown ? (
              <SupplyRunwayFill fillPercent={fillPercent} status={status} className="mt-2.5 h-1.5" />
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">{daysLabel}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            {unknown ? (
              <p className="text-sm font-medium text-muted-foreground">—</p>
            ) : (
              <p
                className={cn(
                  "text-[1.65rem] font-semibold tabular-nums leading-none tracking-tight",
                  status === "critical" && "text-red-600 dark:text-red-400",
                  status === "low" && "text-amber-700 dark:text-amber-400",
                  status === "ok" && "text-foreground",
                )}
              >
                {actualDays}
                <span className="ml-0.5 text-sm font-medium text-muted-foreground">d</span>
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 rounded-xl px-2.5 text-xs"
            onClick={() => onSupplyClick?.(supply.id)}
            data-testid="button-supply-runway-jump"
          >
            Open
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
