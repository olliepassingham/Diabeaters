import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";

import { ActivityLogPanel } from "@/components/activity/activity-log-panel";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { collectAllActivityEvents, type ActivityEvent } from "@/lib/activity-history";
import { syncAchievementsFromActivity } from "@/lib/user-achievements";
import { DIABEATER_SCENARIO_STATE_CHANGED_EVENT } from "@/lib/storage";

export default function ActivityLogPage() {
  const [events, setEvents] = useState<ActivityEvent[]>(() => collectAllActivityEvents());

  const refresh = useCallback(() => {
    setEvents(collectAllActivityEvents());
    syncAchievementsFromActivity({ showToasts: true });
  }, []);

  useEffect(() => {
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return (
    <PageShell variant="standard" className="mx-auto max-w-lg space-y-4 pb-2 sm:space-y-5">
      <PageHeader
        leading={<PageBackButton />}
        title="Activity log"
        description="Hypos, guides, checks, and more — by day."
        className="space-y-1"
      />

      <ActivityLogPanel events={events} variant="patient" persistFilter />

      <p className="px-1 text-center text-[11px] leading-snug text-muted-foreground">
        Educational record only — not a substitute for clinic notes.{" "}
        <Link href="/tools/hypo-history" className="text-primary underline-offset-4 hover:underline">
          Hypo history
        </Link>
      </p>
    </PageShell>
  );
}
