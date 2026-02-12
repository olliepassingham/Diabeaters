import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, ShoppingCart, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { storage, Supply } from "@/lib/storage";

export function SupplySummaryWidget({ compact = false }: { compact?: boolean }) {
  const [supplies, setSupplies] = useState<Supply[]>([]);

  useEffect(() => {
    setSupplies(storage.getSupplies());
  }, []);

  const criticalSupplies = supplies.filter(s => storage.getSupplyStatus(s) === "critical");
  const lowSupplies = supplies.filter(s => storage.getSupplyStatus(s) === "low");
  
  const getMinDaysRemaining = () => {
    if (supplies.length === 0) return null;
    const allDays = supplies.map(s => storage.getDaysRemaining(s)).filter(d => d !== 999);
    return allDays.length > 0 ? Math.min(...allDays) : null;
  };

  const minDays = getMinDaysRemaining();
  const hasAlerts = criticalSupplies.length > 0 || lowSupplies.length > 0;

  return (
    <Card className={`${hasAlerts ? "border-yellow-500/50" : ""} ${compact ? "flex flex-col overflow-hidden" : ""}`} data-testid="widget-supply-summary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <Link href="/supplies">
            <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Supply Summary</CardTitle>
            </div>
          </Link>
          {criticalSupplies.length > 0 && (
            <Badge variant="destructive" data-testid="badge-critical-count">
              {criticalSupplies.length} critical
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {minDays !== null ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Supplies last at least</span>
            <span className={`text-lg font-semibold ${minDays <= 3 ? "text-red-600" : minDays <= 7 ? "text-yellow-600" : "text-green-600"}`} data-testid="text-min-days">
              {minDays} days
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No supplies tracked yet</p>
        )}

        {hasAlerts && (
          <div className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <span>
                {criticalSupplies.length > 0 
                  ? `${criticalSupplies.length} item${criticalSupplies.length > 1 ? "s" : ""} need restocking soon`
                  : `${lowSupplies.length} item${lowSupplies.length > 1 ? "s" : ""} running low`}
              </span>
            </div>
          </div>
        )}

        <div className={`flex gap-2 pt-1`}>
          <Link href="/supplies" className="flex-1">
            <Button variant="outline" size="sm" className="w-full" data-testid="button-view-supplies">
              {compact ? "Supplies" : "View Supplies"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          {!compact && (
            <Link href="/supplies">
              <Button size="sm" variant="ghost" data-testid="button-add-order">
                <ShoppingCart className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
