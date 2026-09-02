import { useMemo, useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, Syringe, Activity, Plug, Cylinder, Plus } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { getUnitsPerPen, storage, Supply } from "@/lib/storage";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { cn } from "@/lib/utils";
import { HomeCardEmpty } from "@/components/home/home-ui";
import { SupplyRunwayFill } from "@/components/visualizations/supply-runway-fill";
import { WidgetHeaderIcon, widgetContentClass, widgetHeaderClass } from "./widget-header";

const typeIcons: Record<string, typeof Package> = {
  needle: Syringe,
  insulin: Package,
  insulin_short: Package,
  insulin_long: Package,
  insulin_vial: Package,
  cgm: Activity,
  infusion_set: Plug,
  reservoir: Cylinder,
  other: Package,
};

function stockLabel(s: Supply): string {
  const stockNow = Math.floor(storage.getAdjustedQuantity(s));
  const showPens = s.type === "insulin" || s.type === "insulin_short" || s.type === "insulin_long";
  const unitsPerPen = showPens ? getUnitsPerPen(storage.getSettings()) : null;
  const pens = showPens && unitsPerPen ? Math.floor(stockNow / unitsPerPen) : null;
  if (showPens) return `${pens ?? 0} ${pens === 1 ? "pen" : "pens"}`;
  if (Number.isFinite(stockNow)) return String(stockNow);
  return "—";
}

/** Urgent items first; unknown runway last. */
function sortSuppliesByRunway(list: Supply[]): Supply[] {
  return [...list].sort((a, b) => {
    const da = storage.getDaysRemaining(a);
    const db = storage.getDaysRemaining(b);
    const na = da === 999 ? 50_000 : da;
    const nb = db === 999 ? 50_000 : db;
    if (na !== nb) return na - nb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function SupplySummaryWidget(_props: DashboardWidgetLayoutProps) {
  const [supplies, setSupplies] = useState<Supply[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      try {
        const list = storage.getSupplies?.() ?? [];
        setSupplies(Array.isArray(list) ? list : []);
        setError(null);
      } catch {
        setError("Could not load supplies.");
        setSupplies([]);
      }
    };

    refresh();
    const id = window.setInterval(refresh, 15000);
    return () => window.clearInterval(id);
  }, []);

  const sortedSupplies = useMemo(() => (supplies?.length ? sortSuppliesByRunway(supplies) : []), [supplies]);

  const maxDaysForBar = useMemo(() => {
    if (!sortedSupplies.length) return 30;
    const capped = sortedSupplies.map((s) => Math.min(storage.getDaysRemaining(s), 90));
    return Math.max(...capped, 30);
  }, [sortedSupplies]);

  if (error) {
    return (
      <WidgetCard accent="tracking" className="overflow-visible" data-testid="widget-supply-summary">
        <CardHeader className={widgetHeaderClass}>
          <div className="flex items-center gap-2">
            <WidgetHeaderIcon icon={Package} />
            <CardTitle className="text-h3 text-foreground">Supplies</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:px-6 md:pb-6">
          <p className="text-body text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (supplies === null) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-supply-summary">
        <CardContent className="p-4 md:p-6">
          <p className="text-body text-muted-foreground">Loading…</p>
        </CardContent>
      </WidgetCard>
    );
  }

  const criticalSupplies = supplies.filter((s) => storage.getSupplyStatus(s) === "critical");
  const lowSupplies = supplies.filter((s) => storage.getSupplyStatus(s) === "low");
  const minDays =
    supplies.length === 0
      ? null
      : (() => {
          const allDays = supplies.map((s) => storage.getDaysRemaining(s)).filter((d) => d !== 999);
          return allDays.length > 0 ? Math.min(...allDays) : null;
        })();
  const hasAlerts = criticalSupplies.length > 0 || lowSupplies.length > 0;

  return (
    <WidgetCard
      accent={criticalSupplies.length > 0 ? "urgent" : "tracking"}
      className={cn("overflow-visible", hasAlerts && !criticalSupplies.length && "ring-1 ring-amber-500/35 dark:ring-amber-400/25")}
      data-testid="widget-supply-summary"
    >
      <CardHeader className={widgetHeaderClass}>
        <div className="flex items-center justify-between gap-2">
          <Link href="/supplies">
            <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer min-w-0">
              <WidgetHeaderIcon icon={Package} />
              <CardTitle className="text-h3 text-foreground">Supplies</CardTitle>
            </div>
          </Link>
          {criticalSupplies.length > 0 && (
            <Badge variant="destructive" className="shrink-0" data-testid="badge-critical-count">
              {criticalSupplies.length} critical
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-2.5", widgetContentClass)}>
        {supplies.length === 0 ? (
          <HomeCardEmpty
            compact
            icon={Package}
            title="No supplies tracked yet"
            description="Add items in Supply Tracker to see stock and runway."
          >
            <Link href="/supplies" className="w-full">
              <Button
                variant="secondary"
                size="sm"
                className="w-full min-h-9 gap-1.5 text-xs font-medium shadow-sm border border-border/80"
                data-testid="button-add-supplies-widget"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add supplies
              </Button>
            </Link>
          </HomeCardEmpty>
        ) : minDays === null ? (
          <p className="text-small text-muted-foreground rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2">
            Add daily usage on the Supplies page to estimate days left and fill the runway bar.
          </p>
        ) : null}

        {sortedSupplies.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {sortedSupplies.map((s) => {
              const status = storage.getSupplyStatus(s);
              const Icon = typeIcons[s.type] || Package;
              const actualDays = storage.getDaysRemaining(s);
              const daysForBar = Math.min(actualDays, 90);
              const barWidth = maxDaysForBar > 0 ? Math.max((daysForBar / maxDaysForBar) * 100, 2) : 2;
              const runOutDate = storage.getRunOutDate(s);

              return (
                <Link
                  key={s.id}
                  href={`/supplies?supply=${encodeURIComponent(s.id)}`}
                  className={cn(
                    "block space-y-1.5 rounded-xl border border-border/50 bg-background/50 px-2.5 py-2 text-left no-underline transition-colors outline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    status === "critical" &&
                      "border-red-500/35 bg-red-500/[0.05] dark:border-red-500/25 dark:bg-red-950/20",
                    status === "low" &&
                      "border-amber-500/30 bg-amber-500/[0.04] dark:border-amber-400/20 dark:bg-amber-950/15",
                    status === "ok" &&
                      "hover:border-cyan-500/25 hover:bg-cyan-500/[0.04] dark:hover:border-cyan-500/20 dark:hover:bg-cyan-950/15"
                  )}
                  data-testid={`supply-summary-row-${s.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                        status === "critical" && "bg-red-500/15 dark:bg-red-500/20",
                        status === "low" && "bg-amber-500/15 dark:bg-amber-500/15",
                        status === "ok" && "bg-cyan-500/10 dark:bg-cyan-500/15"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          status === "critical" && "text-red-600 dark:text-red-400",
                          status === "low" && "text-amber-700 dark:text-amber-400",
                          status === "ok" && "text-cyan-600 dark:text-cyan-400"
                        )}
                        aria-hidden
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm leading-4 font-medium text-foreground">
                      {s.name}
                    </span>
                    <div className="flex shrink-0 flex-col items-end gap-0.5 leading-none">
                      <span className="text-[11px] font-semibold tabular-nums text-foreground">{stockLabel(s)}</span>
                      <div className="flex items-center gap-1.5">
                        {actualDays < 999 ? (
                          <span
                            className={cn(
                              "text-[10px] font-semibold tabular-nums",
                              status === "critical" && "text-red-600 dark:text-red-400",
                              status === "low" && "text-amber-700 dark:text-amber-400",
                              status === "ok" && "text-muted-foreground"
                            )}
                          >
                            {actualDays}d
                          </span>
                        ) : null}
                        {runOutDate && actualDays < 999 && (
                          <span className="hidden text-[10px] text-muted-foreground tabular-nums sm:inline">
                            {format(runOutDate, "d MMM")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <SupplyRunwayFill fillPercent={barWidth} status={status} className="h-1.5" />
                </Link>
              );
            })}
          </div>
        )}

        {hasAlerts && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 dark:border-amber-400/20 dark:bg-amber-950/35">
            <div className="flex items-center gap-2 text-small text-amber-950 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                {criticalSupplies.length > 0
                  ? `${criticalSupplies.length} item${criticalSupplies.length > 1 ? "s" : ""} need restocking soon`
                  : `${lowSupplies.length} item${lowSupplies.length > 1 ? "s" : ""} running low`}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </WidgetCard>
  );
}
