import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, ArrowRight, Package, Syringe, Activity, Plug, Cylinder } from "lucide-react";
import { Link } from "wouter";
import { storage, Supply } from "@/lib/storage";
import { format } from "date-fns";

const typeIcons: Record<string, typeof Package> = {
  needle: Syringe,
  insulin: Package,
  cgm: Activity,
  infusion_set: Plug,
  reservoir: Cylinder,
  other: Package,
};

export function SupplyDepletionWidget({ compact = false }: { compact?: boolean }) {
  const [supplies, setSupplies] = useState<Supply[]>([]);

  useEffect(() => {
    setSupplies(storage.getSupplies());
  }, []);

  if (supplies.length === 0) {
    return (
      <Card data-testid="widget-supply-depletion">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Depletion Forecast</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Add supplies to see your depletion forecast</p>
          <Link href="/supplies" className="mt-2 block">
            <Button variant="outline" size="sm" className="w-full" data-testid="button-add-supplies-depletion">
              Add Supplies
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const supplyData = supplies.map(s => {
    const daysRemaining = storage.getDaysRemaining(s);
    const status = storage.getSupplyStatus(s);
    const runOutDate = storage.getRunOutDate(s);
    return { supply: s, daysRemaining: Math.min(daysRemaining, 90), actualDays: daysRemaining, status, runOutDate };
  }).sort((a, b) => a.actualDays - b.actualDays);

  const maxDays = Math.max(...supplyData.map(d => d.daysRemaining), 30);

  return (
    <Card data-testid="widget-supply-depletion">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Depletion Forecast</CardTitle>
          </div>
          <Link href="/supplies">
            <Button variant="ghost" size="sm" className="text-xs h-7" data-testid="button-depletion-edit">
              Edit
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {supplyData.slice(0, compact ? 4 : undefined).map(({ supply, daysRemaining, actualDays, status, runOutDate }) => {
          const barWidth = maxDays > 0 ? Math.max((daysRemaining / maxDays) * 100, 2) : 2;
          const barColor = status === "critical" ? "bg-red-500" : status === "low" ? "bg-yellow-500" : "bg-emerald-500";
          const Icon = typeIcons[supply.type] || Package;

          return (
            <div key={supply.id} className="space-y-1" data-testid={`depletion-row-${supply.id}`}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-xs">{supply.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium ${
                    status === "critical" ? "text-red-600 dark:text-red-400" : 
                    status === "low" ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"
                  }`}>
                    {actualDays >= 999 ? "N/A" : `${actualDays}d`}
                  </span>
                  {runOutDate && actualDays < 999 && (
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      {format(runOutDate, "d MMM")}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
          <span>Today</span>
          <span>{maxDays >= 90 ? "90+ days" : `${maxDays} days`}</span>
        </div>
      </CardContent>
    </Card>
  );
}
