import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, History } from "lucide-react";

import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { storage, type HypoTreatment, type UserProfile } from "@/lib/storage";

function sortTreatmentsNewestFirst(rows: HypoTreatment[]): HypoTreatment[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
}

export default function HypoHistoryPage() {
  const [profile, setProfile] = useState<UserProfile | null>(() => storage.getProfile() ?? null);
  const [entries, setEntries] = useState<HypoTreatment[]>(() => sortTreatmentsNewestFirst(storage.getHypoTreatments()));

  const refresh = useCallback(() => {
    setProfile(storage.getProfile() ?? null);
    setEntries(sortTreatmentsNewestFirst(storage.getHypoTreatments()));
  }, []);

  useEffect(() => {
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const bgUnitsLabel: "mmol/L" | "mg/dL" = profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";

  const subtitle = useMemo(
    () =>
      "Treatments you log from the dashboard (including quick “treated a hypo”) are stored on this device. When you are signed in with cloud enabled, copies are also saved for linked supporters where sharing allows.",
    [],
  );

  return (
    <PageShell variant="standard" className="mx-auto max-w-lg space-y-6">
      <PageHeader
        leading={<PageBackButton />}
        title="Hypo treatment history"
        actions={
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/tools/hypo-help">Hypo help</Link>
          </Button>
        }
      />

      <Card className="surface-card border-border/70 shadow-sm">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-h3 flex items-center gap-2 text-foreground">
            <History className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-500" aria-hidden />
            Your log
          </CardTitle>
          <CardDescription className="text-sm leading-snug">{subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No treatments yet"
              description="When you log a hypo from the home dashboard, it will appear here."
            >
              <Button asChild variant="default" size="sm">
                <Link href="/">Back to home</Link>
              </Button>
            </EmptyState>
          ) : (
            <ul className="max-h-[min(70vh,28rem)] space-y-2 overflow-y-auto pr-1" data-testid="list-hypo-history-page">
              {entries.map((entry) => {
                const date = new Date(entry.timestamp);
                const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                const dateStr = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                return (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-sm"
                    data-testid={`item-hypo-history-${entry.id}`}
                  >
                    <div className="whitespace-nowrap pt-0.5 text-xs text-muted-foreground">
                      <div>{dateStr}</div>
                      <div>{timeStr}</div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {entry.treatment ? (
                          <Badge variant="secondary" className="text-xs">
                            {entry.treatment}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Logged
                          </Badge>
                        )}
                        {entry.glucoseLevel !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {entry.glucoseLevel} {bgUnitsLabel}
                          </span>
                        )}
                        {entry.carerNotified ? (
                          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                            Supporters notified
                          </Badge>
                        ) : null}
                      </div>
                      {entry.notes?.trim() ? (
                        <p className="text-xs leading-snug text-muted-foreground">{entry.notes.trim()}</p>
                      ) : null}
                      {entry.followUpGlucose !== undefined && entry.followUpTime ? (
                        <p className="text-xs text-muted-foreground">
                          Recheck {new Date(entry.followUpTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}:{" "}
                          {entry.followUpGlucose} {bgUnitsLabel}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/tools/activity" className="font-medium text-primary underline-offset-4 hover:underline">
          View full activity log
        </Link>
        {" · "}
        Educational record only — not a substitute for clinic notes or downloads your team provides.
      </p>
    </PageShell>
  );
}
