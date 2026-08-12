import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Syringe,
  ArrowRight,
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
import {
  applyStarterRatios,
  STARTER_ICR_MEALS,
  starterRatioDisplayValues,
} from "@/lib/starter-ratios";
import { useToast } from "@/hooks/use-toast";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { cn } from "@/lib/utils";
import { HomeCardEmpty } from "@/components/home/home-ui";

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

/** Dashboard / deep links: open Meal & ratios with the meal slot pre-selected. */
export function adviserMealPlannerHref(mealLabel: string): string {
  const key = mealLabel.toLowerCase();
  if (key === "breakfast" || key === "lunch" || key === "dinner" || key === "snack") {
    return `/adviser?tab=meal&mealTime=${key}`;
  }
  return "/adviser?tab=meal";
}

export function RatioAdviserWidget(_props: DashboardWidgetLayoutProps) {
  const { toast } = useToast();
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

  const handleUseStarterRatios = () => {
    try {
      const next = applyStarterRatios(settings ?? undefined);
      setSettings(next);
      toast({
        title: "Starter ratios saved",
        description: "Typical clinic starting point — confirm with your diabetes team.",
      });
    } catch {
      toast({
        title: "Could not save ratios",
        description: "Try Set up ratios and enter them manually.",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-ratio-adviser">
        <CardHeader className="space-y-0 p-3 pb-1.5 sm:p-4 sm:pb-2">
          <div className="flex items-center gap-2">
            <Syringe className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <CardTitle className="text-base font-semibold leading-tight text-foreground">Your ratios</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (settings === null || scenarioState === null) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-ratio-adviser">
        <CardContent className="p-3 sm:p-4">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </WidgetCard>
    );
  }

  const hasRatios = settings.breakfastRatio || settings.lunchRatio || settings.dinnerRatio;
  const scenario = getScenarioFactor(scenarioState);
  const starterDisplays = hasRatios ? null : starterRatioDisplayValues(ratioFormat, cpSize);

  const ratios = [
    { label: "Breakfast", value: settings.breakfastRatio },
    { label: "Lunch", value: settings.lunchRatio },
    { label: "Dinner", value: settings.dinnerRatio },
    { label: "Snack", value: settings.snackRatio },
  ].filter((r) => r.value);

  const lastRatioSpansFullRow = ratios.length % 2 === 1;

  return (
    <WidgetCard className="overflow-visible" data-testid="widget-ratio-adviser">
      <CardHeader className="space-y-0 p-3 pb-1.5 sm:p-4 sm:pb-2">
        <Link href="/settings/ratios">
          <div className="flex flex-wrap items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer">
            <Syringe className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <CardTitle className="text-base font-semibold leading-tight text-foreground">Your ratios</CardTitle>
            {scenario && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-px text-[0.65rem] font-medium leading-tight",
                  scenario.label === "Sick day"
                    ? "border-amber-200/90 bg-amber-50/95 text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100"
                    : "border-sky-200/80 bg-sky-50/90 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-100",
                )}
              >
                <scenario.icon className="h-2.5 w-2.5 shrink-0 opacity-90" aria-hidden />
                {scenario.label}
              </span>
            )}
          </div>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-3 pt-0 sm:p-4 sm:pt-0">
        {hasRatios ? (
          <div className="grid grid-cols-2 gap-1.5">
            {ratios.map((r, idx) => {
              const { base, adjusted } = displayRatio(r.value, ratioFormat, scenario?.factor, cpSize);
              const RowIcon = ratioRowIcon(r.label);
              const mt = r.label.toLowerCase();
              const wideLast = lastRatioSpansFullRow && idx === ratios.length - 1;

              return (
                <Link
                  key={r.label}
                  href={adviserMealPlannerHref(r.label)}
                  className={cn("block min-w-0", wideLast && "col-span-2")}
                  title={`${r.label} meal planner`}
                  data-testid={`link-dashboard-meal-planner-${mt}`}
                >
                  <div
                    className={cn(
                      "pressable flex min-h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5 text-left transition-colors",
                      "hover:border-sky-500/35 hover:bg-sky-500/[0.06] dark:hover:border-sky-500/25 dark:hover:bg-sky-950/25",
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/10 dark:bg-sky-500/15">
                      <RowIcon className="h-3 w-3 text-sky-600 dark:text-sky-400" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-none text-muted-foreground">
                      {r.label}
                    </span>
                    {scenario && adjusted ? (
                      <span className="shrink-0 text-right leading-none">
                        <span className="mr-1 text-[0.6rem] tabular-nums text-muted-foreground line-through opacity-70">
                          {base}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                          {adjusted}
                        </span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm font-bold tabular-nums leading-none tracking-tight text-foreground">
                        {base}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2" data-testid="widget-ratio-starter-suggestion">
            <HomeCardEmpty
              compact
              icon={Syringe}
              title="No ratios set yet"
              description="Starter example — not your prescription. Confirm with your diabetes team."
            />
            <div className="grid grid-cols-2 gap-1.5">
              {STARTER_ICR_MEALS.map(({ key, label }) => {
                const RowIcon = ratioRowIcon(label);
                const display = starterDisplays?.[key] ?? "";
                return (
                  <div
                    key={key}
                    className="flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-border/80 bg-muted/20 px-2 py-1.5"
                    data-testid={`starter-ratio-preview-${key}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/10 dark:bg-sky-500/15">
                      <RowIcon className="h-3 w-3 text-sky-600 dark:text-sky-400" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-none text-muted-foreground">
                      {label}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums leading-none text-foreground/90">
                      {display}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!hasRatios && (
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-9 w-full gap-1 text-xs font-medium"
              onClick={handleUseStarterRatios}
              data-testid="button-use-starter-ratios"
            >
              Use starter ratios
            </Button>
            <div className="grid grid-cols-2 gap-1.5">
              <Link href="/settings/ratios">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 w-full gap-1 text-xs font-medium shadow-sm border border-border/80"
                  data-testid="button-view-ratios"
                >
                  Set up
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Button>
              </Link>
              <Link href="/adviser?tab=meal">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full gap-1 text-xs font-medium"
                  data-testid="button-dashboard-quick-meal-planner"
                >
                  Meal planner
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </WidgetCard>
  );
}
