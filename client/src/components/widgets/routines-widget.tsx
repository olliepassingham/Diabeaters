import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Repeat, ArrowRight, Clock, Star, Utensils, Coffee, Sun, Moon, Cookie } from "lucide-react";
import { Link } from "wouter";
import { storage, Routine, RoutineMealType } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";

function getMealIcon(type: RoutineMealType) {
  switch (type) {
    case "breakfast": return <Coffee className="h-3.5 w-3.5" />;
    case "lunch": return <Sun className="h-3.5 w-3.5" />;
    case "dinner": return <Moon className="h-3.5 w-3.5" />;
    case "snack": return <Cookie className="h-3.5 w-3.5" />;
    default: return <Utensils className="h-3.5 w-3.5" />;
  }
}

export function RoutinesWidget({ compact = false }: { compact?: boolean }) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [recentRoutines, setRecentRoutines] = useState<Routine[]>([]);
  const [topRoutines, setTopRoutines] = useState<Routine[]>([]);

  useEffect(() => {
    const all = storage.getRoutines();
    setRoutines(all);
    setRecentRoutines(storage.getRecentRoutines(3));
    setTopRoutines(storage.getMostUsedRoutines(3));
  }, []);

  const displayRoutines = recentRoutines.length > 0 ? recentRoutines : topRoutines;
  const hasRoutines = routines.length > 0;

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-routines">
      <CardHeader className="pb-2">
        <Link href="/adviser?tab=routines">
          <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
            <Repeat className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-base">Routines</CardTitle>
            {hasRoutines && (
              <Badge variant="secondary" className="text-xs">{routines.length}</Badge>
            )}
          </div>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasRoutines ? (
          <div className="space-y-2">
            {displayRoutines.slice(0, compact ? 2 : 3).map((routine) => (
              <Link key={routine.id} href="/adviser?tab=routines">
                <div className="p-2.5 rounded-lg bg-muted/30 hover-elevate cursor-pointer" data-testid={`routine-item-${routine.id}`}>
                  <div className="flex items-center gap-2">
                    <div className="text-emerald-600 dark:text-emerald-400">
                      {getMealIcon(routine.mealType)}
                    </div>
                    <p className="text-sm font-medium truncate flex-1">{routine.name}</p>
                    {routine.timesUsed > 0 && (
                      <div className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                        <Star className="h-3 w-3" />
                        {routine.timesUsed}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {routine.carbEstimate && (
                      <span>{routine.carbEstimate}g carbs</span>
                    )}
                    {routine.insulinDose && (
                      <span>{routine.insulinDose}u</span>
                    )}
                    {routine.lastUsed && (
                      <span className="flex items-center gap-1 ml-auto">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(routine.lastUsed), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {routines.length > (compact ? 2 : 3) && (
              <p className="text-xs text-muted-foreground text-center">
                +{routines.length - (compact ? 2 : 3)} more routine{routines.length - (compact ? 2 : 3) !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              No routines saved yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Save your regular meals and activities for quick reference
            </p>
          </div>
        )}

        <Link href="/adviser?tab=routines">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-view-routines">
            {hasRoutines ? "View All Routines" : "Create a Routine"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
