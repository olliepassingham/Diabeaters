import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Thermometer, X, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { storage, ScenarioState } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

export function ScenarioStatusWidget() {
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

  if (!hasActiveScenario) {
    return (
      <Card data-testid="widget-scenario-status">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Active Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span data-testid="text-no-scenarios">No active scenarios</span>
          </div>
          <div className="flex gap-2 mt-3">
            <Link href="/scenarios" className="flex-1">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-start-travel">
                <Plane className="h-4 w-4 mr-1" />
                Travel
              </Button>
            </Link>
            <Link href="/scenarios" className="flex-1">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-start-sick-day">
                <Thermometer className="h-4 w-4 mr-1" />
                Sick Day
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/50" data-testid="widget-scenario-status">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Active Scenarios</CardTitle>
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
              <Link href="/scenarios">
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
              <Link href="/scenarios">
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
      </CardContent>
    </Card>
  );
}
