import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, Clock, Repeat } from "lucide-react";
import { Link } from "wouter";
import { storage, ActivityLog } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";

export function ActivityAdviserWidget({ compact = false }: { compact?: boolean }) {
  const [recentActivity, setRecentActivity] = useState<ActivityLog | null>(null);
  const [routineCount, setRoutineCount] = useState(0);

  useEffect(() => {
    const logs = storage.getActivityLogs();
    if (logs.length > 0) {
      setRecentActivity(logs[0]);
    }
    const routines = storage.getRoutines();
    setRoutineCount(routines.length);
  }, []);

  return (
    <Card className={compact ? "flex flex-col overflow-hidden" : ""} data-testid="widget-activity-adviser">
      <CardHeader className="pb-2">
        <Link href="/adviser">
          <div className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Activity Adviser</CardTitle>
          </div>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentActivity ? (
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-sm font-medium mb-1">{recentActivity.activityType}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {recentActivity.recommendation}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(recentActivity.createdAt), { addSuffix: true })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Plan your next activity to get personalised advice
          </p>
        )}

        {routineCount > 0 && !compact && (
          <Link href="/adviser?tab=routines">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 hover-elevate cursor-pointer" data-testid="card-routines-shortcut">
              <Repeat className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm text-emerald-800 dark:text-emerald-200">
                {routineCount} saved routine{routineCount !== 1 ? "s" : ""}
              </span>
              <ArrowRight className="h-3 w-3 ml-auto text-emerald-600 dark:text-emerald-400" />
            </div>
          </Link>
        )}
        
        <Link href="/adviser" className="w-full">
          <Button variant="secondary" size="sm" className="w-full" data-testid="button-plan-activity">
            {compact ? "Plan" : "Plan Activity"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
