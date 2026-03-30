import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, ArrowRight, Package, Syringe, Activity, Plug, Cylinder } from "lucide-react";
import { Link } from "wouter";
import { storage, Supply } from "@/lib/storage";
import { format } from "date-fns";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";

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

export function SupplyDepletionWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
  const [supplies, setSupplies] = useState<Supply[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const list = storage.getSupplies?.() ?? [];
      setSupplies(Array.isArray(list) ? list : []);
      setError(null);
    } catch {
      setError("Could not load supplies.");
      setSupplies([]);
    }
  }, []);

  if (error) {
    return (
      <WidgetCard data-testid="widget-supply-depletion">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-h3 text-foreground">Depletion forecast</CardTitle>
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
      <WidgetCard data-testid="widget-supply-depletion">
        <CardContent className="p-4 md:p-6">
          <p className="text-body text-muted-foreground">Loading…</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (supplies.length === 0) {
    return (
      <WidgetCard data-testid="widget-supply-depletion">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <Link href="/supplies">
            <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
              <TrendingDown className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-h3 text-foreground">
                {compact ? "Depletion" : "Depletion forecast"}
              </CardTitle>
            </div>
          </Link>
          <p className="text-tiny uppercase tracking-wide text-muted-foreground mt-1">Run-out timeline</p>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 md:px-6 md:pb-6">
          <p className="text-body text-muted-foreground">Add supplies to see your depletion forecast.</p>
          <Link href="/supplies" className="block">
            <Button variant="outline" size="sm" className="w-full" data-testid="button-add-supplies-depletion">
              Add supplies
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </WidgetCard>
    );
  }

  const supplyData = supplies
    .map((s) => {
      const daysRemaining = storage.getDaysRemaining(s);
      const status = storage.getSupplyStatus(s);
      const runOutDate = storage.getRunOutDate(s);
      return {
        supply: s,
        daysRemaining: Math.min(daysRemaining, 90),
        actualDays: daysRemaining,
        status,
        runOutDate,
      };
    })
    .sort((a, b) => a.actualDays - b.actualDays);

  const maxDays = Math.max(...supplyData.map((d) => d.daysRemaining), 30);

  return (
    <WidgetCard data-testid="widget-supply-depletion">
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/supplies">
            <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer min-w-0">
              <TrendingDown className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-h3 text-foreground truncate">
                {compact ? "Depletion" : "Depletion forecast"}
              </CardTitle>
            </div>
          </Link>
          {!compact && (
            <Link href="/supplies">
              <Button variant="ghost" size="sm" className="text-xs h-8 shrink-0" data-testid="button-depletion-edit">
                Edit
              </Button>
            </Link>
          )}
        </div>
        <p className="text-tiny uppercase tracking-wide text-muted-foreground mt-1">Estimated run-out</p>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0 md:px-6 md:pb-6">
        {supplyData.slice(0, compact ? 4 : undefined).map(({ supply, daysRemaining, actualDays, status, runOutDate }) => {
          const barWidth = maxDays > 0 ? Math.max((daysRemaining / maxDays) * 100, 2) : 2;
          const barColor =
            status === "critical" ? "bg-red-500" : status === "low" ? "bg-amber-500" : "bg-emerald-500";
          const Icon = typeIcons[supply.type] || Package;

          return (
            <div key={supply.id} className="space-y-1" data-testid={`depletion-row-${supply.id}`}>
              <div className="flex items-center justify-between gap-2 text-small">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate text-body text-foreground">{supply.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-small font-medium tabular-nums ${
                      status === "critical"
                        ? "text-red-600 dark:text-red-400"
                        : status === "low"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {actualDays >= 999 ? "N/A" : `${actualDays}d`}
                  </span>
                  {runOutDate && actualDays < 999 && (
                    <span className="text-tiny text-muted-foreground hidden sm:inline">{format(runOutDate, "d MMM")}</span>
                  )}
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barWidth}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </WidgetCard>
  );
}
