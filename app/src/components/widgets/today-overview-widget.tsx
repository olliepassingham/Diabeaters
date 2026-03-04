import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, AlertCircle, ArrowRight, Moon } from "lucide-react";
import { Link } from "wouter";
import { storage, ScenarioState, Supply } from "@/lib/storage";

export function TodayOverviewWidget({ compact = false }: { compact?: boolean }) {
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [supplies, setSupplies] = useState<Supply[]>([]);

  useEffect(() => {
    setScenarioState(storage.getScenarioState());
    setSupplies(storage.getSupplies());
  }, []);

  const criticalSupplies = supplies.filter(s => storage.getSupplyStatus(s) === "critical");
  const hasActiveScenario = scenarioState.travelModeActive || scenarioState.sickDayActive;
  const hour = new Date().getHours();
  const isEvening = hour >= 19 || hour < 6;

  const getStatusMessage = () => {
    if (criticalSupplies.length > 0) {
      return { type: "warning", message: "Critical supplies need attention" };
    }
    if (scenarioState.sickDayActive) {
      return { type: "info", message: "Sick day mode active" };
    }
    if (scenarioState.travelModeActive) {
      return { type: "info", message: `Travel mode active${scenarioState.travelDestination ? ` - ${scenarioState.travelDestination}` : ""}` };
    }
    return { type: "ok", message: "All systems normal" };
  };

  const status = getStatusMessage();

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-today-overview">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Today</CardTitle>
          </div>
          <Badge variant={status.type === "warning" ? "destructive" : status.type === "info" ? "secondary" : "outline"}>
            {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {status.type === "warning" ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          <span className="text-sm" data-testid="text-today-status">{status.message}</span>
        </div>

        {hasActiveScenario && (
          <div className="space-y-2">
            {scenarioState.travelModeActive && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                Travel mode until {scenarioState.travelEndDate ? new Date(scenarioState.travelEndDate).toLocaleDateString("en-GB") : "unspecified"}
              </div>
            )}
            {scenarioState.sickDayActive && (
              <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-sm text-orange-800 dark:text-orange-200">
                Sick day active - {scenarioState.sickDaySeverity || "moderate"} severity
              </div>
            )}
          </div>
        )}

        {criticalSupplies.length > 0 && !compact && (
          <div className="space-y-1">
            {criticalSupplies.slice(0, 2).map(supply => (
              <div key={supply.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{supply.name}</span>
                <Badge variant="destructive" className="text-xs">
                  {storage.getDaysRemaining(supply)}d left
                </Badge>
              </div>
            ))}
          </div>
        )}

        {isEvening && !compact && (
          <Link href="/scenarios?tab=bedtime">
            <div className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-sm text-indigo-800 dark:text-indigo-200 hover-elevate cursor-pointer" data-testid="card-evening-bedtime">
              <Moon className="h-4 w-4" />
              <span>Time for your bedtime check</span>
              <ArrowRight className="h-3 w-3 ml-auto" />
            </div>
          </Link>
        )}

        <Link href="/adviser">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-view-today">
            {compact ? "Plan" : "Plan Today"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
