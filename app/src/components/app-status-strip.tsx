import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, Plane, Thermometer, WifiOff, Power, ChevronRight, Dumbbell, Syringe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { storage, type ScenarioState, type ActiveExerciseSession } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
 * Consolidates Sick Day / Travel / Exercise / Offline into one row (wraps on very small screens).
 */
export function AppStatusStrip() {
  const { toast } = useToast();
  const online = useOnline();
  const [sc, setSc] = useState<ScenarioState>(() => storage.getScenarioState());
  const [ex, setEx] = useState<ActiveExerciseSession | null>(() => storage.getActiveExercise());

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSc(storage.getScenarioState());
      setEx(storage.getActiveExercise());
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  const travelDays = useMemo(() => daysRemaining(sc.travelEndDate), [sc.travelEndDate]);
  const show = sc.sickDayActive || sc.travelModeActive || Boolean(ex) || sc.pumpFailureActive || !online;
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

  return (
    <div
      className="relative z-40 -mt-2 mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/55 px-3 py-2 backdrop-blur [padding-left:max(0.75rem,env(safe-area-inset-left))] [padding-right:max(0.75rem,env(safe-area-inset-right))]"
      data-testid="app-status-strip"
    >
      {!online ? (
        <Badge className={cn("chip border border-border/60 bg-muted/50 text-muted-foreground", "max-w-full")} variant="secondary">
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Offline
        </Badge>
      ) : null}

      {sc.sickDayActive ? (
        <Badge className={cn("chip border", sickTone)} variant="secondary">
          <Thermometer className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Sick Day{sc.sickDaySeverity ? ` · ${sc.sickDaySeverity}` : ""}
        </Badge>
      ) : null}

      {sc.travelModeActive ? (
        <Badge className="chip border border-blue-500/25 bg-blue-500/15 text-blue-900 dark:text-blue-200" variant="secondary">
          <Plane className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Travel{sc.travelDestination ? ` · ${sc.travelDestination}` : ""}
          {travelDays != null && travelDays >= 0 ? ` · ${travelDays}d` : ""}
        </Badge>
      ) : null}

      {ex ? (
        <Badge className="chip border border-emerald-500/25 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200" variant="secondary">
          <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Exercise · {ex.phase}
        </Badge>
      ) : null}

      {sc.pumpFailureActive ? (
        <Badge className="chip border border-red-500/25 bg-red-500/15 text-red-900 dark:text-red-200" variant="secondary">
          <Syringe className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Pump failure
        </Badge>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {sc.sickDayActive ? (
          <>
            <Link href="/scenarios/sick-day#sickday-checklist">
              <Button size="sm" variant="outline" className="h-7 px-2" data-testid="status-sick-view">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </Link>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={handleEndSick} data-testid="status-sick-end">
              <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
              End
            </Button>
          </>
        ) : null}

        {sc.travelModeActive ? (
          <>
            <Link href="/scenarios?tab=travel">
              <Button size="sm" variant="outline" className="h-7 px-2" data-testid="status-travel-view">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </Link>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={handleEndTravel} data-testid="status-travel-end">
              <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
              End
            </Button>
          </>
        ) : null}

        {ex ? (
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={handleEndExercise} data-testid="status-exercise-end">
            <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
            End
          </Button>
        ) : null}

        {sc.pumpFailureActive ? (
          <>
            <Link href="/scenarios/pump-failure">
              <Button size="sm" variant="outline" className="h-7 px-2" data-testid="status-pumpfailure-view">
                View <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </Link>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={handleEndPumpFailure} data-testid="status-pumpfailure-end">
              <Power className="h-3.5 w-3.5 mr-1" aria-hidden />
              End
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

