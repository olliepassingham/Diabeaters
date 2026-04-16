import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, ArrowRight, Clock, Star, Utensils, Coffee, Sun, Moon, Cookie } from "lucide-react";
import { Link } from "wouter";
import { storage, Routine, RoutineMealType } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";
import { WidgetCard } from "./WidgetCard";
import type { DashboardWidgetLayoutProps } from "./types";
import { isCompactLayout } from "./types";

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
      <WidgetCard data-testid="widget-routines">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Routines</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:px-6 md:pb-6">
          <p className="text-base text-gray-700 dark:text-muted-foreground">{error}</p>
        </CardContent>
      </WidgetCard>
    );
  }

  if (routines === null) {
    return (
      <WidgetCard data-testid="widget-routines">
        <CardContent className="p-4 md:p-6">
          <p className="text-base text-gray-700 dark:text-muted-foreground">Loading…</p>
        </CardContent>
      </WidgetCard>
    );
  }

  const displayRoutines = recentRoutines.length > 0 ? recentRoutines : topRoutines;
  const hasRoutines = routines.length > 0;
  const limit = compact ? 2 : 3;

  return (
    <WidgetCard data-testid="widget-routines">
      <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
        <Link href="/routines">
          <div className="flex flex-wrap items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
            <Repeat className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <CardTitle className="text-h3 text-foreground">Routines</CardTitle>
            {hasRoutines && (
              <span className="chip border-emerald-200/70 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                {routines.length}
              </span>
            )}
          </div>
        </Link>
        <p className="text-sm text-gray-500 uppercase tracking-wide mt-1">Saved meals</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 md:px-6 md:pb-6">
        {hasRoutines ? (
          <div className="space-y-2">
            {displayRoutines.slice(0, limit).map((routine) => (
              <Link key={routine.id} href="/routines">
                <div
                  className="pressable card-interactive rounded-xl border border-gray-100 dark:border-border bg-gray-50/90 dark:bg-muted/30 px-3 py-2.5 cursor-pointer"
                  data-testid={`routine-item-${routine.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-emerald-600 dark:text-emerald-400">{getMealIcon(routine.mealType)}</div>
                    <p className="text-base font-medium text-gray-900 dark:text-foreground truncate flex-1">{routine.name}</p>
                    {routine.timesUsed > 0 && (
                      <div className="flex items-center gap-0.5 text-sm text-gray-500 shrink-0">
                        <Star className="h-3.5 w-3.5" />
                        {routine.timesUsed}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    {routine.carbEstimate != null && <span>{routine.carbEstimate}g carbs</span>}
                    {routine.insulinDose != null && <span>{routine.insulinDose}u</span>}
                    {routine.lastUsed && (
                      <span className="flex items-center gap-1 ml-auto">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(routine.lastUsed), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {routines.length > limit && (
              <p className="text-sm text-gray-500 text-center">
                +{routines.length - limit} more routine{routines.length - limit !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-2 space-y-1">
            <p className="text-base text-gray-700 dark:text-muted-foreground">No routines saved yet.</p>
            <p className="text-sm text-gray-500">Save your regular meals for quick reference.</p>
          </div>
        )}

        <Link href="/routines">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-view-routines">
            {hasRoutines ? "View all routines" : "Create a routine"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </WidgetCard>
  );
}
