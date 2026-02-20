import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Clock, ArrowRight, Apple, Syringe, Package, Heart, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { storage, UpcomingExercise, ExerciseType } from "@/lib/storage";

const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  cardio: "Cardio",
  strength: "Strength",
  hiit: "HIIT",
  yoga: "Yoga",
  walking: "Walking",
  sports: "Sports",
  swimming: "Swimming",
};

const TIP_ICONS = {
  carb: Apple,
  insulin: Syringe,
  supply: Package,
  recovery: Heart,
};

function formatTimeUntil(minutesUntil: number): string {
  if (minutesUntil < 60) return `${minutesUntil}min`;
  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}d`;
    return `${days}d ${remainingHours}h`;
  }
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function getDayName(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "long" });
}

export function ComingUpWidget({ compact = false }: { compact?: boolean }) {
  const [upcoming, setUpcoming] = useState<UpcomingExercise[]>([]);

  useEffect(() => {
    setUpcoming(storage.getUpcomingExercises(3));
    const interval = setInterval(() => {
      setUpcoming(storage.getUpcomingExercises(3));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const next = upcoming.length > 0 ? upcoming[0] : null;

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-coming-up">
      <CardHeader className="pb-2">
        <Link href="/adviser?tab=routines">
          <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
            <Dumbbell className="h-5 w-5 text-green-600 dark:text-green-400" />
            <CardTitle className="text-base">Coming Up</CardTitle>
          </div>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {next ? (
          <>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20" data-testid="coming-up-next">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Dumbbell className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <p className="text-sm font-medium truncate" data-testid="text-coming-up-name">{next.routine.name}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs" data-testid="badge-coming-up-time">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTimeUntil(next.minutesUntil)}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{getDayName(next.nextOccurrence)}</span>
                <span>{next.nextOccurrence.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                <Badge variant="outline" className="text-xs">
                  {EXERCISE_TYPE_LABELS[next.routine.exerciseType]}
                </Badge>
                <span>{next.routine.durationMinutes}min</span>
              </div>
            </div>

            {next.prepTips.length > 0 && (
              <div className="space-y-1.5" data-testid="coming-up-tips">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prep Tips</p>
                {next.prepTips.slice(0, compact ? 2 : 4).map((tip, i) => {
                  const Icon = TIP_ICONS[tip.type];
                  return (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30" data-testid={`prep-tip-${i}`}>
                      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs">{tip.message}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {upcoming.length > 1 && !compact && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Also Scheduled</p>
                {upcoming.slice(1).map((item) => (
                  <div key={item.routine.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30" data-testid={`upcoming-${item.routine.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Dumbbell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate">{item.routine.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {getDayName(item.nextOccurrence)} {item.nextOccurrence.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Not medical advice — always consult your diabetes team</span>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">No scheduled exercises yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add exercise routines with a schedule to see prep tips here
            </p>
          </div>
        )}

        <Link href="/adviser?tab=routines">
          <Button variant="outline" size="sm" className="w-full gap-1" data-testid="button-view-routines">
            {next ? "View Routines" : "Set Up Routines"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
