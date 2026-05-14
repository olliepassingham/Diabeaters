import { useMemo } from "react";
import { Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { storage, type Supply } from "@/lib/storage";
import { GradientMarkerBar } from "@/components/visualizations/gradient-marker-bar";
import { cn } from "@/lib/utils";

type Props = {
  supplies: Supply[];
  onSupplyClick?: (id: string) => void;
  className?: string;
};

/**
 * Single “tightest runway” strip using the same marker-bar language as meal absorption — illustrative forecast only.
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
  const markerPosition = unknown ? 0.5 : Math.min(0.97, Math.max(0.03, actualDays / 36));

  const daysLabel = unknown ? "Set usage to estimate" : `${actualDays} day${actualDays === 1 ? "" : "s"} left`;

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-border/70 bg-gradient-to-br from-muted/35 via-card to-muted/15 shadow-sm",
        className,
      )}
      data-testid="card-supply-runway-at-glance"
    >
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold tracking-tight">Shortest runway</CardTitle>
              <CardDescription className="truncate text-xs sm:text-sm">{supply.name}</CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => onSupplyClick?.(supply.id)}
            data-testid="button-supply-runway-jump"
          >
            Open
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {unknown ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add daily usage on this supply to see a depletion forecast — the bar is hidden until then.
          </p>
        ) : (
          <GradientMarkerBar
            markerPosition={markerPosition}
            endLeftLabel="Reorder soon"
            endRightLabel="Comfortable buffer"
            trackGradientClassName="from-amber-900/90 via-emerald-700 to-emerald-400 dark:from-amber-950 dark:via-emerald-800 dark:to-emerald-300"
            header={
              <>
                <span className="text-sm text-muted-foreground">Forecast buffer</span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    status === "critical" && "text-red-600 dark:text-red-400",
                    status === "low" && "text-amber-700 dark:text-amber-300",
                    status === "ok" && "text-muted-foreground",
                  )}
                >
                  {daysLabel}
                </span>
              </>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
