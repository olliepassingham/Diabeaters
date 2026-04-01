import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, ShoppingCart, ArrowRight, Syringe, Activity, Plug, Cylinder } from "lucide-react";
import { Link } from "wouter";
import { getUnitsPerPen, storage, Supply } from "@/lib/storage";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { cn } from "@/lib/utils";

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

export function SupplySummaryWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
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

  if (error) {
    return (
      <WidgetCard data-testid="widget-supply-summary">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-h3 text-foreground">Supply summary</CardTitle>
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
      <WidgetCard data-testid="widget-supply-summary">
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
  const preview = supplies.slice(0, compact ? 3 : 5);

  return (
    <WidgetCard
      className={cn(hasAlerts && "ring-1 ring-amber-500/35 dark:ring-amber-400/25")}
      data-testid="widget-supply-summary"
    >
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/supplies">
            <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer min-w-0">
              <Package className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-h3 text-foreground">Supply summary</CardTitle>
            </div>
          </Link>
          {criticalSupplies.length > 0 && (
            <Badge variant="destructive" className="shrink-0" data-testid="badge-critical-count">
              {criticalSupplies.length} critical
            </Badge>
          )}
        </div>
        <p className="text-tiny uppercase tracking-wide text-muted-foreground mt-1">Stock levels</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 md:px-6 md:pb-6">
        {minDays !== null ? (
          <div className={cn("flex items-center justify-between gap-2 rounded-lg bg-muted/50 border border-border/60 px-3 py-2", compact && "flex-col text-center")}>
            <span className="text-sm text-muted-foreground uppercase tracking-wide">{compact ? "Lasts at least" : "Supplies last at least"}</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                compact ? "text-lg" : "text-xl",
                minDays <= 3
                  ? "text-red-600 dark:text-red-400"
                  : minDays <= 7
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-emerald-700 dark:text-emerald-400"
              )}
              data-testid="text-min-days"
            >
              {minDays} days
            </span>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">No supplies tracked yet.</p>
        )}

        {preview.length > 0 && (
          <div className="space-y-2">
            <p className="text-tiny uppercase tracking-wide text-muted-foreground">Items</p>
            {preview.map((s) => {
              const status = storage.getSupplyStatus(s);
              const Icon = typeIcons[s.type] || Package;
              const stockNow = Math.floor(storage.getAdjustedQuantity(s));
              const showPens = s.type === "insulin" || s.type === "insulin_short" || s.type === "insulin_long";
              const unitsPerPen = showPens ? getUnitsPerPen(storage.getSettings()) : null;
              const pens = showPens && unitsPerPen ? Math.floor(stockNow / unitsPerPen) : null;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2",
                    status === "critical" && "bg-red-500/10 border-red-500/25 dark:bg-red-950/35 dark:border-red-500/30",
                    status === "low" && "bg-amber-500/10 border-amber-500/25 dark:bg-amber-950/30 dark:border-amber-400/25",
                    status === "ok" && "bg-muted/40 border-border/50"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-body text-foreground truncate">{s.name}</span>
                  </div>
                  <span
                    className={cn(
                      "text-small font-semibold tabular-nums shrink-0",
                      status === "critical" && "text-red-700 dark:text-red-300",
                      status === "low" && "text-amber-800 dark:text-amber-200",
                      status === "ok" && "text-foreground"
                    )}
                  >
                    ×
                    {showPens ? (
                      <>
                        {pens ?? 0} {pens === 1 ? "pen" : "pens"}
                      </>
                    ) : Number.isFinite(stockNow) ? (
                      stockNow
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {hasAlerts && (
          <div className="rounded-lg bg-amber-500/10 dark:bg-amber-950/35 px-3 py-2 border border-amber-500/25 dark:border-amber-400/20">
            <div className="flex items-center gap-2 text-small text-amber-950 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {criticalSupplies.length > 0
                  ? `${criticalSupplies.length} item${criticalSupplies.length > 1 ? "s" : ""} need restocking soon`
                  : `${lowSupplies.length} item${lowSupplies.length > 1 ? "s" : ""} running low`}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Link href="/supplies" className="flex-1">
            <Button variant="outline" size="sm" className="w-full" data-testid="button-view-supplies">
              {compact ? "Supplies" : "View supplies"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          {!compact && (
            <Link href="/supplies">
              <Button size="sm" variant="secondary" data-testid="button-add-order">
                <ShoppingCart className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </WidgetCard>
  );
}
