import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Syringe, ArrowRight, AlertCircle, Pill, ThermometerSun, ThermometerSnowflake } from "lucide-react";
import { Link } from "wouter";
import { storage, UserSettings, ScenarioState, RatioFormat } from "@/lib/storage";
import { parseRatioToGramsPerUnit, formatRatioForDisplay } from "@/lib/ratio-utils";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
function getScenarioFactor(scenarioState: ScenarioState): { factor: number; label: string; icon: typeof Pill } | null {
  if (scenarioState.sickDayActive) {
    const severity = scenarioState.sickDaySeverity || "moderate";
    const factor = severity === "mild" ? 0.9 : severity === "severe" ? 0.8 : 0.85;
    return { factor, label: "Sick day", icon: Pill };
  }
  if (scenarioState.travelModeActive) {
    const plan = storage.getTravelPlan();
    if (plan?.weatherChange === "warmer") {
      const intensity = plan.weatherIntensity || "moderate";
      const f = intensity === "extreme" ? 1.15 : intensity === "significant" ? 1.1 : 1.05;
      return { factor: f, label: "Hot climate", icon: ThermometerSun };
    }
    if (plan?.weatherChange === "colder") {
      const intensity = plan.weatherIntensity || "moderate";
      const f = intensity === "extreme" ? 0.85 : intensity === "significant" ? 0.9 : 0.95;
      return { factor: f, label: "Cold climate", icon: ThermometerSnowflake };
    }
  }
  return null;
}

function displayRatio(
  storedRatio: string | undefined,
  ratioFormat: RatioFormat,
  scenarioFactor?: number,
  cpSize?: number
): { base: string; adjusted: string | null } {
  if (!storedRatio) return { base: "", adjusted: null };
  const gpu = parseRatioToGramsPerUnit(storedRatio);
  if (!gpu) return { base: storedRatio, adjusted: null };
  const baseDisplay = formatRatioForDisplay(gpu, ratioFormat, cpSize);
  if (scenarioFactor) {
    const adjustedGpu = gpu * scenarioFactor;
    const adjustedDisplay = formatRatioForDisplay(adjustedGpu, ratioFormat, cpSize);
    return { base: baseDisplay, adjusted: adjustedDisplay };
  }
  return { base: baseDisplay, adjusted: null };
}

export function RatioAdviserWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [scenarioState, setScenarioState] = useState<ScenarioState | null>(null);
  const [ratioFormat, setRatioFormat] = useState<RatioFormat>("per10g");
  const [cpSize, setCpSize] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSettings(storage.getSettings?.() ?? {});
      setScenarioState(storage.getScenarioState?.() ?? { travelModeActive: false, sickDayActive: false });
      const profile = storage.getProfile?.();
      if (profile?.ratioFormat) setRatioFormat(profile.ratioFormat);
      setCpSize(profile?.carbPortionSize);
      setError(null);
    } catch {
      setError("Could not load ratios.");
      setSettings({});
      setScenarioState({ travelModeActive: false, sickDayActive: false });
    }
  }, []);

  if (error) {
    return (
      <WidgetCard data-testid="widget-ratio-adviser">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <div className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-h3 text-foreground">Your ratios</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:px-6 md:pb-6">
          <p className="text-base text-gray-700 dark:text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (settings === null || scenarioState === null) {
    return (
      <WidgetCard data-testid="widget-ratio-adviser">
        <CardContent className="p-4 md:p-6">
          <p className="text-base text-gray-700 dark:text-muted-foreground">Loading…</p>
        </CardContent>
      </WidgetCard>
    );
  }

  const hasRatios = settings.breakfastRatio || settings.lunchRatio || settings.dinnerRatio;
  const scenario = getScenarioFactor(scenarioState);

  const ratios = [
    { label: "Breakfast", value: settings.breakfastRatio },
    { label: "Lunch", value: settings.lunchRatio },
    { label: "Dinner", value: settings.dinnerRatio },
    { label: "Snack", value: settings.snackRatio },
  ].filter((r) => r.value);

  return (
    <WidgetCard data-testid="widget-ratio-adviser">
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <Link href="/ratios">
          <div className="flex flex-wrap items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
            <Syringe className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-h3 text-foreground">Your ratios</CardTitle>
            {scenario && (
              <span className="chip border-blue-200/70 bg-blue-50/80 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                <scenario.icon className="h-3 w-3" />
                {scenario.label}
              </span>
            )}
          </div>
        </Link>
        <p className="text-sm text-gray-500 uppercase tracking-wide mt-1">Insulin to carbs</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 md:px-6 md:pb-6">
        {hasRatios ? (
          <div className={compact ? "space-y-2" : "grid grid-cols-2 gap-2"}>
            {ratios.map((r) => {
              const { base, adjusted } = displayRatio(r.value, ratioFormat, scenario?.factor, cpSize);
              return compact ? (
                <div key={r.label} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-muted/40 px-3 py-2">
                  <span className="text-sm text-gray-500 uppercase tracking-wide">{r.label}</span>
                  {scenario && adjusted ? (
                    <span className="text-base font-semibold text-amber-700 dark:text-amber-400">{adjusted}</span>
                  ) : (
                    <span className="text-base font-semibold text-gray-900 dark:text-foreground">{base}</span>
                  )}
                </div>
              ) : (
                <div key={r.label} className="rounded-lg bg-gray-50 dark:bg-muted/40 px-3 py-2 text-center">
                  <p className="text-sm text-gray-500 uppercase tracking-wide">{r.label}</p>
                  {scenario && adjusted ? (
                    <div>
                      <p className="text-xs text-gray-500 line-through">{base}</p>
                      <p className="text-base font-semibold text-amber-700 dark:text-amber-400">{adjusted}</p>
                    </div>
                  ) : (
                    <p className="text-base font-semibold text-gray-900 dark:text-foreground">{base}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-base text-gray-700 dark:text-muted-foreground text-center py-1">No ratios set yet.</p>
        )}

        <Link href="/ratios">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-view-ratios">
            {hasRatios ? "View & edit ratios" : "Set up ratios"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>

        {!compact && (
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Not medical advice
          </p>
        )}
      </CardContent>
    </WidgetCard>
  );
}
