import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, ArrowRight, Clock, Star, Utensils, Coffee, Sun, Moon, Cookie, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { storage, Routine, RoutineMealType } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";
import { HomeCardEmpty } from "@/components/home/home-ui";

function getMealIcon(type: RoutineMealType) {
  switch (type) {
    case "breakfast":
      return <Coffee className="h-3.5 w-3.5" />;
    case "lunch":
      return <Sun className="h-3.5 w-3.5" />;
    case "dinner":
      return <Moon className="h-3.5 w-3.5" />;
    case "snack":
      return <Cookie className="h-3.5 w-3.5" />;
    default:
      return <Utensils className="h-3.5 w-3.5" />;
  }
}

export function RoutinesWidget(props: DashboardWidgetLayoutProps) {
  const compact = isCompactLayout(props);
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [recentRoutines, setRecentRoutines] = useState<Routine[]>([]);
  const [topRoutines, setTopRoutines] = useState<Routine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const all = storage.getRoutines?.() ?? [];
      const list = Array.isArray(all) ? all : [];
      setRoutines(list);
      setRecentRoutines(storage.getRecentRoutines?.(3) ?? []);
      setTopRoutines(storage.getMostUsedRoutines?.(3) ?? []);
      setError(null);
    } catch {
      setError("Could not load routines.");
      setRoutines([]);
    }
  }, []);

  if (error) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-routines">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Routines</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:px-6 md:pb-6">
          <p className="text-body text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (routines === null) {
    return (
      <WidgetCard className="overflow-visible" data-testid="widget-routines">
        <CardContent className="p-4 md:p-6">
          <p className="text-body text-muted-foreground">Loading…</p>
        </CardContent>
      </WidgetCard>
    );
  }

  const displayRoutines = recentRoutines.length > 0 ? recentRoutines : topRoutines;
  const hasRoutines = routines.length > 0;
  const limit = compact ? 2 : 3;

  return (
    <WidgetCard className="overflow-visible" data-testid="widget-routines">
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <Link href="/routines">
          <div className="flex flex-wrap items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
            <Repeat className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Routines</CardTitle>
            {hasRoutines && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-1.5 text-xs font-semibold text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100">
                {routines.length}
              </span>
            )}
          </div>
        </Link>
        <p className="text-small text-muted-foreground uppercase tracking-wide mt-1">
          {hasRoutines ? "Saved meals" : null}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-0 md:px-6 md:pb-6">
        {hasRoutines ? (
          <div className="flex flex-col gap-2">
            {displayRoutines.slice(0, limit).map((routine) => (
              <Link key={routine.id} href="/routines" className="block">
                <div
                  className={cn(
                    "pressable card-interactive flex w-full min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors cursor-pointer",
                    "hover:border-emerald-500/35 hover:bg-emerald-500/[0.06] dark:hover:border-emerald-500/25 dark:hover:bg-emerald-950/25"
                  )}
                  data-testid={`routine-item-${routine.id}`}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      {getMealIcon(routine.mealType)}
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="flex items-center gap-2">
                        <span className="block text-sm font-semibold text-foreground truncate">{routine.name}</span>
                        {routine.timesUsed > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-muted/60 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            <Star className="h-3 w-3" aria-hidden />
                            {routine.timesUsed}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {routine.carbEstimate != null && <span>{routine.carbEstimate}g carbs</span>}
                        {routine.insulinDose != null && <span>{routine.insulinDose}u</span>}
                        {routine.lastUsed && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                            {formatDistanceToNow(new Date(routine.lastUsed), { addSuffix: true })}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </div>
              </Link>
            ))}
            {routines.length > limit && (
              <p className="text-center text-xs text-muted-foreground">
                +{routines.length - limit} more routine{routines.length - limit !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        ) : (
          <HomeCardEmpty
            compact
            icon={Repeat}
            title="No routines saved yet"
            description="Save regular meals under Tools → Routines."
          >
            <Link href="/routines" className="w-full">
              <Button
                variant="secondary"
                size="sm"
                className="w-full min-h-9 gap-1.5 text-xs font-medium shadow-sm border border-border/80"
                data-testid="button-view-routines"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create a routine
              </Button>
            </Link>
          </HomeCardEmpty>
        )}

        {hasRoutines && (
        <Link href="/routines">
          <Button
            variant="secondary"
            size="sm"
            className="w-full min-h-10 gap-1.5 font-medium shadow-sm border border-border/80"
            data-testid="button-view-routines"
          >
            View all routines
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </Link>
        )}
      </CardContent>
    </WidgetCard>
  );
}
