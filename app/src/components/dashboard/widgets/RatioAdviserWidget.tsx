import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Syringe,
  ArrowRight,
  AlertCircle,
  Pill,
  ThermometerSun,
  ThermometerSnowflake,
  Coffee,
  Sun,
  Moon,
  Cookie,
} from "lucide-react";
import { Link } from "wouter";
import { storage, UserSettings, ScenarioState, RatioFormat } from "@/lib/storage";
import { parseRatioToGramsPerUnit, formatRatioForDisplay } from "@/lib/ratio-utils";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { cn } from "@/lib/utils";
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

function ratioRowIcon(label: string) {
  const L = label.toLowerCase();
  if (L.includes("breakfast")) return Coffee;
  if (L.includes("lunch")) return Sun;
  if (L.includes("dinner")) return Moon;
  if (L.includes("snack")) return Cookie;
  return Syringe;
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
      <WidgetCard className="overflow-visible" data-testid="widget-ratio-adviser">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <div className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Your ratios</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:px-6 md:pb-6">
          <p className="text-body text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (settings === null || scenarioState === null) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-ratio-adviser">
        <CardContent className="p-4 md:p-6">
          <p className="text-body text-muted-foreground">Loading…</p>
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
    <WidgetCard className="overflow-visible" data-testid="widget-ratio-adviser">
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <Link href="/ratios">
          <div className="flex flex-wrap items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
            <Syringe className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Your ratios</CardTitle>
            {scenario && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium",
                  scenario.label === "Sick day"
                    ? "border-amber-200/90 bg-amber-50/95 text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100"
                    : "border-sky-200/80 bg-sky-50/90 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-100",
                )}
              >
                <scenario.icon className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                {scenario.label}
              </span>
            )}
          </div>
        </Link>
        <p className="text-small text-muted-foreground uppercase tracking-wide mt-1">Insulin to carbs</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-0 md:px-6 md:pb-6">
        {hasRatios ? (
          <div className="flex flex-col gap-2">
            {ratios.map((r) => {
              const { base, adjusted } = displayRatio(r.value, ratioFormat, scenario?.factor, cpSize);
              const RowIcon = ratioRowIcon(r.label);
              return (
                <Link key={r.label} href="/ratios" className="block">
                  <div
                    className={cn(
                      "pressable card-interactive flex w-full min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors",
                      "hover:border-sky-500/35 hover:bg-sky-500/[0.06] dark:hover:border-sky-500/25 dark:hover:bg-sky-950/25"
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 dark:bg-sky-500/15">
                        <RowIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block text-sm font-semibold text-foreground">{r.label}</span>
                        {scenario && adjusted ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            <span className="line-through opacity-80">{base}</span>
                            <span className="mx-1 text-muted-foreground/70">→</span>
                            <span className="font-medium text-amber-700 dark:text-amber-400">{adjusted}</span>
                            <span className="ml-1 text-muted-foreground">({scenario.label})</span>
                          </span>
                        ) : (
                          <span className="block text-xs text-muted-foreground tabular-nums">{base}</span>
                        )}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-2 space-y-1">
            <p className="text-body text-muted-foreground">No ratios set yet.</p>
            <p className="text-small text-muted-foreground">Set breakfast, lunch, and dinner ratios in one place.</p>
          </div>
        )}

        {!hasRatios && (
          <Link href="/ratios" className="mt-auto">
            <Button
              variant="secondary"
              size="sm"
              className="w-full min-h-10 gap-1.5 font-medium shadow-sm border border-border/80"
              data-testid="button-view-ratios"
            >
              Set up ratios
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </Link>
        )}

        {!compact && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            <span>Not medical advice — always follow your care team.</span>
          </div>
        )}
      </CardContent>
    </WidgetCard>
  );
}
