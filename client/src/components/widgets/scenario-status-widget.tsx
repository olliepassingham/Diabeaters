import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Thermometer, Moon, X, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { storage, ScenarioState } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

export function ScenarioStatusWidget({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });

  useEffect(() => {
    setScenarioState(storage.getScenarioState());
  }, []);

  const refreshState = () => {
    setScenarioState(storage.getScenarioState());
  };

  const handleExitTravelMode = () => {
    storage.deactivateTravelMode();
    refreshState();
    toast({
      title: "Travel Mode Ended",
      description: "Welcome back! Travel mode has been deactivated.",
    });
  };

  const handleExitSickDay = () => {
    storage.deactivateSickDay();
    refreshState();
    toast({
      title: "Sick Day Ended",
      description: "Glad you're feeling better! Normal settings restored.",
    });
  };

  const hasActiveScenario = scenarioState.travelModeActive || scenarioState.sickDayActive;
  const hour = new Date().getHours();
  const isEvening = hour >= 19 || hour < 6;

  if (!hasActiveScenario) {
    return (
      <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-scenario-status">
        <CardHeader className="pb-2">
          <Link href="/scenarios">
            <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
              <CardTitle className="text-base">Scenarios</CardTitle>
            </div>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span data-testid="text-no-scenarios">No active modes</span>
          </div>

          {isEvening && !compact && (
            <Link href="/scenarios?tab=bedtime">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg hover-elevate cursor-pointer" data-testid="card-bedtime-prompt">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Bedtime Check</p>
                    <p className="text-xs text-muted-foreground">Check you're ready for a steady night</p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </Link>
          )}

          <div className={`flex gap-2 ${compact ? "flex-col" : ""}`}>
            <Link href="/scenarios?tab=sick-day" className="flex-1">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-start-sick-day">
                <Thermometer className="h-4 w-4 mr-1" />
                Sick Day
              </Button>
            </Link>
            <Link href="/scenarios?tab=travel" className="flex-1">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-start-travel">
                <Plane className="h-4 w-4 mr-1" />
                Travel
              </Button>
            </Link>
            {!compact && (
              <Link href="/scenarios?tab=bedtime" className="flex-1">
                <Button variant="outline" size="sm" className="w-full" data-testid="button-start-bedtime">
                  <Moon className="h-4 w-4 mr-1" />
                  Bedtime
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-primary/50 glow-warning ${compact ? "flex flex-col overflow-hidden" : ""}`} data-testid="widget-scenario-status">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <Link href="/scenarios">
            <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
              <CardTitle className="text-base">Active Scenarios</CardTitle>
            </div>
          </Link>
          <Badge variant="secondary">
            {[scenarioState.travelModeActive && "Travel", scenarioState.sickDayActive && "Sick Day"].filter(Boolean).join(" + ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {scenarioState.travelModeActive && (
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Travel Mode</p>
                <p className="text-xs text-muted-foreground">
                  {scenarioState.travelDestination || "Active"} 
                  {scenarioState.travelEndDate && ` until ${new Date(scenarioState.travelEndDate).toLocaleDateString()}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/scenarios?tab=travel">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-view-travel">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={handleExitTravelMode}
                data-testid="button-exit-travel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {scenarioState.sickDayActive && (
          <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Sick Day Mode</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {scenarioState.sickDaySeverity || "Moderate"} severity
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/scenarios?tab=sick-day">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-view-sick-day">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={handleExitSickDay}
                data-testid="button-exit-sick-day"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {isEvening && (
          <Link href="/scenarios?tab=bedtime">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg hover-elevate cursor-pointer" data-testid="card-bedtime-prompt">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Bedtime Check</p>
                  <p className="text-xs text-muted-foreground">Check you're ready for a steady night</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
