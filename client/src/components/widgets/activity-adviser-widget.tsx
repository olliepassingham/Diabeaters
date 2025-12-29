import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { storage, ActivityLog } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";

export function ActivityAdviserWidget() {
  const [recentActivity, setRecentActivity] = useState<ActivityLog | null>(null);

  useEffect(() => {
    const logs = storage.getActivityLogs();
    if (logs.length > 0) {
      setRecentActivity(logs[0]);
    }
  }, []);

  return (
    <Card data-testid="widget-activity-adviser">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Activity Adviser</CardTitle>
        </div>
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
        
        <Link href="/advisor">
          <Button variant="secondary" size="sm" className="w-full" data-testid="button-plan-activity">
            Plan Activity
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
