import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

import { ActivityLogPanel } from "@/components/activity/activity-log-panel";
import { PageShell } from "@/components/layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HubLoadingSkeleton } from "@/components/empty-state";
import { useCarerActivityHistory } from "@/hooks/use-carer-activity-history";
import { listLinkedPatientsForCarer, normaliseScopes } from "@/lib/carers";
import { getActiveCarerPatientId, setActiveCarerPatientId } from "@/lib/carer-session";
import { useEffect, useState } from "react";
import type { LinkedPatientWithProfile } from "@/lib/carers.types";

export default function CarerActivityLogPage() {
  const [link, setLink] = useState<LinkedPatientWithProfile | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await listLinkedPatientsForCarer();
      if (!active) return;
      const rows = data ?? [];
      const remembered = getActiveCarerPatientId();
      const picked = rows.find((r) => r.patientId === remembered) ?? rows[0] ?? null;
      if (picked) setActiveCarerPatientId(picked.patientId);
      setLink(picked);
      setBooting(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const scopes = link ? normaliseScopes(link.scopes) : null;
  const { events, scenarioCalendarDays, loading, error } = useCarerActivityHistory(
    link?.patientId ?? null,
    scopes,
  );

  if (booting) {
    return (
      <PageShell variant="standard" className="mx-auto max-w-lg">
        <HubLoadingSkeleton />
      </PageShell>
    );
  }

  if (!link) {
    return (
      <PageShell variant="standard" className="mx-auto max-w-lg space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" asChild>
          <Link href="/carer-setup">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Supporter setup
          </Link>
        </Button>
        <Alert>
          <AlertDescription>Link to someone with type 1 diabetes to view their shared activity.</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const hasScope = scopes && (scopes.hypo_alerts || scopes.scenarios || scopes.appointments);

  return (
    <PageShell variant="standard" className="mx-auto max-w-lg space-y-4 pb-2">
      <div className="sticky top-0 z-20 -mx-2 rounded-2xl border border-border/45 bg-card/90 px-3 py-2 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">Supporter Mode</p>
            <p className="text-sm font-semibold text-foreground truncate">Read-only</p>
          </div>
          <Badge variant="secondary" className="rounded-full">
            Viewing shared activity
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-2 shrink-0" asChild>
          <Link href="/carer-view">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Supporter
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-h3 font-semibold text-foreground">Activity log</h1>
          <p className="text-xs text-muted-foreground">Shared activity only.</p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasScope ? (
        <Alert>
          <AlertDescription>
            Their sharing settings do not include activity you can view here. Ask them to allow hypo alerts, guides, or
            appointments in Family &amp; carers.
          </AlertDescription>
        </Alert>
      ) : loading && events.length === 0 ? (
        <HubLoadingSkeleton />
      ) : (
        <ActivityLogPanel
          events={events}
          variant="carer"
          linkable={false}
          persistFilter={false}
          emptyHomeHref="/carer-view"
          scenarioCalendarDays={scenarioCalendarDays}
        />
      )}
    </PageShell>
  );
}
