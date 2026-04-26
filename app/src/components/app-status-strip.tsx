import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, Plane, Thermometer, WifiOff, Power, ChevronRight, Dumbbell, Syringe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { storage, type ScenarioState, type ActiveExerciseSession } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { calculateExercisePlan } from "@/lib/exercise-plan";
import { getExerciseReadinessVerdict, getReadinessToneClasses } from "@/lib/exercise-readiness";

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function daysRemaining(endIsoOrDate: string | undefined): number | null {
  if (!endIsoOrDate) return null;
  const end = new Date(endIsoOrDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Compact status strip shown under the top bar.
 * One row per active context so actions are unambiguous on phones.
 */
export function AppStatusStrip() {
  const { toast } = useToast();
  const online = useOnline();
  const [sc, setSc] = useState<ScenarioState>(() => storage.getScenarioState());
  const [ex, setEx] = useState<ActiveExerciseSession | null>(() => storage.getActiveExercise());
  const exercisedRecently24h = storage.didExerciseRecently(24);
  const [exerciseExpanded, setExerciseExpanded] = useState(false);
  const [exerciseBgInput, setExerciseBgInput] = useState<string>("");

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSc(storage.getScenarioState());
      setEx(storage.getActiveExercise());
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!ex) {
      setExerciseExpanded(false);
      setExerciseBgInput("");
      return;
    }
    if (ex.phase !== "pre") {
      setExerciseExpanded(false);
    }
    if (typeof ex.preBg === "number" && Number.isFinite(ex.preBg)) {
      setExerciseBgInput(String(ex.preBg));
    } else if (exerciseBgInput === "") {
      setExerciseBgInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex?.id, ex?.phase]);

  const travelDays = useMemo(() => daysRemaining(sc.travelEndDate), [sc.travelEndDate]);
  const show =
    sc.sickDayActive || sc.travelModeActive || Boolean(ex) || exercisedRecently24h || sc.pumpFailureActive || !online;
  if (!show) return null;

  const sickTone =
    sc.sickDaySeverity === "severe"
      ? "bg-red-500/15 text-red-700 dark:bg-red-500/15 dark:text-red-200 border-red-500/25"
      : sc.sickDaySeverity === "moderate"
        ? "bg-orange-500/15 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200 border-orange-500/25"
        : "bg-amber-500/15 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200 border-amber-500/25";

  const handleEndSick = () => {
    storage.deactivateSickDay();
    try {
      localStorage.removeItem("diabeater_sick_day_session");
    } catch {
      // ignore
    }
    toast({ title: "Sick Day Mode Deactivated", description: "Glad you're feeling better!" });
  };

  const handleEndTravel = () => {
    storage.deactivateTravelMode();
    try {
      localStorage.removeItem("diabeater_travel_session");
    } catch {
      // ignore
    }
    toast({ title: "Travel Mode Ended", description: "Welcome back home!" });
  };

  const handleEndExercise = () => {
    storage.endExerciseSession();
    toast({ title: "Exercise ended", description: "Session cleared." });
  };

  const handleEndPumpFailure = () => {
    try {
      storage.endPumpFailureMode();
    } catch {
      // ignore
    }
    toast({ title: "Pump failure mode ended", description: "Session cleared." });
  };

  const rowClass =
    "flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/55 px-3 py-2 backdrop-blur [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]";
  const btnClass = "h-7 px-2 text-xs";

  const bgUnits = storage.getProfile?.()?.bgUnits || "mg/dL";
  const readiness = useMemo(() => {
    if (!ex) return null;
    if (ex.phase !== "pre") return null;
    const bg = (() => {
      const raw = exerciseBgInput.trim().replace(",", ".");
      if (!raw) return null;
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : null;
    })();
    const plan = calculateExercisePlan({
      exerciseType: ex.exerciseType,
      durationMinutes: ex.durationMinutes,
      intensity: ex.intensity,
      minutesUntilStart: 0,
      bgUnits,
      currentBg: bg ?? undefined,
      bgTrend: ex.preTrend ?? undefined,
      hourOfDay: new Date().getHours(),
    });
    return {
      verdict: getExerciseReadinessVerdict({
        exercisePlanResult: plan,
        currentBg: bg,
        bgUnits,
        sickDayActive: sc.sickDayActive,
        sickDaySeverity: sc.sickDaySeverity,
        exerciseType: ex.exerciseType,
        intensity: ex.intensity,
        bgTrend: ex.preTrend ?? null,
        phase: "pre",
      }),
      plan,
      bg,
    };
  }, [bgUnits, ex, exerciseBgInput, sc.sickDayActive, sc.sickDaySeverity]);

  return (
    <div className="relative z-40 -mt-2 mb-2 space-y-2" data-testid="app-status-strip">
      {!online ? (
        <div className={rowClass}>
          <Badge className={cn("chip border border-border/60 bg-muted/50 text-muted-foreground", "max-w-full")} variant="secondary">
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Offline
          </Badge>
        </div>
      ) : null}

      {sc.sickDayActive ? (
        <div className={rowClass}>
          <Badge className={cn("chip border", sickTone)} variant="secondary">
            <Thermometer className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Sick Day{sc.sickDaySeverity ? ` · ${sc.sickDaySeverity}` : ""}
          </Badge>
          <div className="flex items-center gap-2">
            <Link href="/scenarios/sick-day#sickday-checklist">
              <Button size="sm" variant="outline" className={btnClass} data-testid="status-sick-view">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </Link>
            <Button size="sm" variant="outline" className={btnClass} onClick={handleEndSick} data-testid="status-sick-end">
              <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
              End
            </Button>
          </div>
        </div>
      ) : null}

      {sc.travelModeActive ? (
        <div className={rowClass}>
          <Badge className="chip border border-blue-500/25 bg-blue-500/15 text-blue-900 dark:text-blue-200" variant="secondary">
            <Plane className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Travel{sc.travelDestination ? ` · ${sc.travelDestination}` : ""}
            {travelDays != null && travelDays >= 0 ? ` · ${travelDays}d` : ""}
          </Badge>
          <div className="flex items-center gap-2">
            <Link href="/scenarios?tab=travel">
              <Button size="sm" variant="outline" className={btnClass} data-testid="status-travel-view">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </Link>
            <Button size="sm" variant="outline" className={btnClass} onClick={handleEndTravel} data-testid="status-travel-end">
              <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
              End
            </Button>
          </div>
        </div>
      ) : null}

      {ex ? (
        <div className="space-y-2" data-testid="status-exercise">
          <div className={rowClass}>
            <Badge
              className={cn(
                "chip border border-emerald-500/25 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
                ex.phase === "pre" && readiness?.verdict ? getReadinessToneClasses(readiness.verdict.verdict) : null,
              )}
              variant="secondary"
            >
              <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Exercise · {ex.phase}
            </Badge>
            <div className="flex items-center gap-2">
              {ex.phase === "pre" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className={btnClass}
                  onClick={() => setExerciseExpanded((v) => !v)}
                  data-testid="status-exercise-check"
                >
                  {exerciseExpanded ? "Hide" : "Check"}
                </Button>
              ) : (
                <Link href="/scenarios/exercise?sync=active" data-testid="status-exercise-view">
                  <Button size="sm" variant="outline" className={btnClass}>
                    View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
                  </Button>
                </Link>
              )}
              <Button size="sm" variant="outline" className={btnClass} onClick={handleEndExercise} data-testid="status-exercise-end">
                <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
                End
              </Button>
            </div>
          </div>

          {ex.phase === "pre" && exerciseExpanded ? (
            <div
              className={cn(
                "rounded-2xl border border-border/60 bg-background/55 px-3 py-3 backdrop-blur space-y-2",
                readiness?.verdict ? getReadinessToneClasses(readiness.verdict.verdict) : null,
              )}
              data-testid="status-exercise-expanded"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{ex.exerciseName}</p>
                  <p className="text-xs text-muted-foreground">
                    {ex.durationMinutes}min · {ex.intensity} · {ex.exerciseType}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Current BG</p>
                  <Input
                    inputMode="decimal"
                    placeholder={bgUnits === "mmol/L" ? "e.g. 7.2" : "e.g. 130"}
                    value={exerciseBgInput}
                    onChange={(e) => setExerciseBgInput(e.target.value)}
                    className="h-9"
                    data-testid="status-exercise-bg"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Trend</p>
                  <div className="flex flex-wrap gap-2">
                    {(["flat", "rising", "falling", "not_sure"] as const).map((t) => (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant={ex.preTrend === t || (!ex.preTrend && t === "not_sure") ? "default" : "outline"}
                        className={btnClass}
                        onClick={() => {
                          const next = t === "not_sure" ? null : t;
                          storage.updateActiveExercise({ preTrend: next ?? undefined });
                          setEx(storage.getActiveExercise());
                        }}
                        data-testid={`status-exercise-trend-${t}`}
                      >
                        {t === "not_sure" ? "Not sure" : t}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={ex.preChecklist.bgChecked ? "default" : "outline"}
                  className={btnClass}
                  onClick={() => {
                    storage.updateActiveExercise({ preChecklist: { ...ex.preChecklist, bgChecked: !ex.preChecklist.bgChecked } });
                    setEx(storage.getActiveExercise());
                  }}
                >
                  BG checked
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={ex.preChecklist.carbsConsidered ? "default" : "outline"}
                  className={btnClass}
                  onClick={() => {
                    storage.updateActiveExercise({
                      preChecklist: { ...ex.preChecklist, carbsConsidered: !ex.preChecklist.carbsConsidered },
                    });
                    setEx(storage.getActiveExercise());
                  }}
                >
                  Carbs planned
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={ex.preChecklist.basalAdjusted ? "default" : "outline"}
                  className={btnClass}
                  onClick={() => {
                    storage.updateActiveExercise({ preChecklist: { ...ex.preChecklist, basalAdjusted: !ex.preChecklist.basalAdjusted } });
                    setEx(storage.getActiveExercise());
                  }}
                >
                  Basal checked
                </Button>
              </div>

              {readiness?.verdict ? (
                <div className="pt-1">
                  <p className="text-sm font-semibold text-foreground">{readiness.verdict.title}</p>
                  <p className="text-xs text-muted-foreground">{readiness.verdict.detail}</p>
                </div>
              ) : null}

              <p className="text-[11px] text-muted-foreground pt-1">
                Quick check only. For the full planner, use the Exercise page.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {!ex && exercisedRecently24h ? (
        <div className={rowClass}>
          <Badge className="chip border border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200" variant="secondary">
            <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Post‑exercise · 24h
          </Badge>
        </div>
      ) : null}

      {sc.pumpFailureActive ? (
        <div className={rowClass}>
          <Badge className="chip border border-red-500/25 bg-red-500/15 text-red-900 dark:text-red-200" variant="secondary">
            <Syringe className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Pump failure
          </Badge>
          <div className="flex items-center gap-2">
            <Link href="/scenarios/pump-failure">
              <Button size="sm" variant="outline" className={btnClass} data-testid="status-pumpfailure-view">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </Link>
            <Button size="sm" variant="outline" className={btnClass} onClick={handleEndPumpFailure} data-testid="status-pumpfailure-end">
              <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
              End
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

