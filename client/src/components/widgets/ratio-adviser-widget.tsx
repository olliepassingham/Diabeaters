import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Syringe, ArrowRight, AlertCircle, Pill, ThermometerSun, ThermometerSnowflake } from "lucide-react";
import { Link } from "wouter";
import { storage, UserSettings, ScenarioState } from "@/lib/storage";

function parseRatio(ratio?: string): number | null {
  if (!ratio) return null;
  const match = ratio.match(/1\s*:\s*(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function getScenarioFactor(scenarioState: ScenarioState): { factor: number; label: string; icon: typeof Pill } | null {
  if (scenarioState.sickDayActive) {
    const severity = scenarioState.sickDaySeverity || "moderate";
    const factor = severity === "mild" ? 0.9 : severity === "severe" ? 0.8 : 0.85;
    return { factor, label: "Sick Day", icon: Pill };
  }
  if (scenarioState.travelModeActive) {
    const plan = storage.getTravelPlan();
    if (plan?.weatherChange === "warmer") {
      const intensity = plan.weatherIntensity || "moderate";
      const factor = intensity === "extreme" ? 1.15 : intensity === "significant" ? 1.1 : 1.05;
      return { factor, label: "Hot Climate", icon: ThermometerSun };
    }
    if (plan?.weatherChange === "colder") {
      const intensity = plan.weatherIntensity || "moderate";
      const factor = intensity === "extreme" ? 0.85 : intensity === "significant" ? 0.9 : 0.95;
      return { factor, label: "Cold Climate", icon: ThermometerSnowflake };
    }
  }
  return null;
}

export function RatioAdviserWidget({ compact = false }: { compact?: boolean }) {
  const [settings, setSettings] = useState<UserSettings>({});
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });

  useEffect(() => {
    setSettings(storage.getSettings());
    setScenarioState(storage.getScenarioState());
  }, []);

  const hasRatios = settings.breakfastRatio || settings.lunchRatio || settings.dinnerRatio;
  const scenario = getScenarioFactor(scenarioState);

  const ratios = [
    { label: "Breakfast", value: settings.breakfastRatio },
    { label: "Lunch", value: settings.lunchRatio },
    { label: "Dinner", value: settings.dinnerRatio },
    { label: "Snack", value: settings.snackRatio },
  ].filter(r => r.value);

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-ratio-adviser">
      <CardHeader className="pb-2">
        <Link href="/ratios">
          <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
            <Syringe className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Your Ratios</CardTitle>
            {scenario && (
              <Badge variant="secondary" className="text-xs gap-1">
                <scenario.icon className="h-3 w-3" />
                {scenario.label}
              </Badge>
            )}
          </div>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasRatios ? (
          <div className="grid grid-cols-2 gap-2">
            {ratios.map((r) => {
              const baseGrams = parseRatio(r.value);
              const adjusted = scenario && baseGrams ? `1:${Math.round(baseGrams * scenario.factor)}` : null;
              return (
                <div key={r.label} className="p-2 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  {scenario && adjusted ? (
                    <div>
                      <p className="text-xs text-muted-foreground line-through">{r.value}</p>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{adjusted}</p>
                    </div>
                  ) : (
                    <p className="text-sm font-medium">{r.value}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              No ratios set yet
            </p>
          </div>
        )}
        
        <Link href="/ratios">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-view-ratios">
            {hasRatios ? "View & Edit Ratios" : "Set Up Ratios"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
        
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Not medical advice
        </p>
      </CardContent>
    </Card>
  );
}
