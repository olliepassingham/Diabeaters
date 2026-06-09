import { useMemo } from "react";
import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

  const { supply, actualDays } = row;
  const unknown = actualDays >= 999;
  const markerPosition = unknown ? 0.5 : Math.min(0.97, Math.max(0.03, actualDays / 36));

  const daysLabel = unknown ? "Set usage to estimate" : `${actualDays} day${actualDays === 1 ? "" : "s"} left`;

  return (
    <Card
      className={cn("overflow-hidden rounded-xl border-border/70", className)}
      data-testid="card-supply-runway-at-glance"
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{supply.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {unknown ? "Shortest runway — set usage to estimate" : `Shortest runway · ${daysLabel}`}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={() => onSupplyClick?.(supply.id)}
            data-testid="button-supply-runway-jump"
          >
            Open
          </Button>
        </div>
        {!unknown ? (
          <div className="mt-2">
            <GradientMarkerBar
              markerPosition={markerPosition}
              showEndLabels={false}
              trackGradientClassName="from-amber-900/90 via-emerald-700 to-emerald-400 dark:from-amber-950 dark:via-emerald-800 dark:to-emerald-300"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
