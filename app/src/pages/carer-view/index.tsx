import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, ArrowLeft, Package, Heart, Phone, Calendar, Plane, Thermometer, Info } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  getLinkedPatientForCarer,
  normaliseScopes,
  fetchSuppliesForLinkedPatient,
  fetchPatientProfileForCarer,
  fetchAppointmentsForLinkedPatient,
  fetchScenariosForLinkedPatient,
} from "@/lib/carers";
import type { CloudSupplyRow, LinkedPatientInfo } from "@/lib/carers.types";
import { resolveProfileImageUrl } from "@/lib/storage-profile";
import { getSupabase } from "@/lib/supabase";
import { consumeCarerLinkedBannerMessage } from "@/lib/carer-session";
import { DevNote } from "@/components/dev/DevNote";
import { PageShell } from "@/components/layout";

function appointmentSortTime(row: Record<string, unknown>): number {
  const keys = ["scheduled_at", "appointment_at", "starts_at", "date", "start_time", "datetime"];
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const t = new Date(String(v)).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const u = row.updated_at;
  if (u) return new Date(String(u)).getTime();
  return 0;
}

function pickNextAppointment(rows: Record<string, unknown>[]): Record<string, unknown> | null {
  if (rows.length === 0) return null;
  const now = Date.now();
  const scored = rows
    .map((r) => ({ r, t: appointmentSortTime(r) }))
    .filter((x) => x.t > 0);
  const future = scored.filter((x) => x.t >= now).sort((a, b) => a.t - b.t);
  if (future.length > 0) return future[0]!.r;
  scored.sort((a, b) => b.t - a.t);
  return scored[0]?.r ?? rows[0] ?? null;
}

function appointmentTitle(row: Record<string, unknown>): string {
  for (const k of ["title", "name", "summary", "notes"]) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "Appointment";
}

function formatAppointmentWhen(row: Record<string, unknown>): string | null {
  const keys = ["scheduled_at", "appointment_at", "starts_at", "date", "start_time", "datetime"];
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
  }
  return null;
}

function scenarioBannerLines(rows: Record<string, unknown>[]): string[] {
  const lines: string[] = [];
  for (const row of rows.slice(0, 8)) {
    if (typeof row.label === "string" && row.label.trim()) {
      lines.push(row.label.trim());
      continue;
    }
    if (typeof row.title === "string" && row.title.trim()) {
      lines.push(row.title.trim());
      continue;
    }
    if (typeof row.scenario_key === "string" && row.scenario_key.trim()) {
      lines.push(row.scenario_key.trim());
      continue;
    }
    const p = row.payload ?? row.state ?? row.data;
    if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      const bits: string[] = [];
      if (o.sick_day_active === true || o.sickDayActive === true) bits.push("Sick day mode");
      if (o.travel_active === true || o.travelActive === true) bits.push("Travel mode");
      if (o.bedtime_active === true) bits.push("Bedtime scenario");
      if (bits.length) {
        lines.push(bits.join(" · "));
        continue;
      }
    }
    const u = row.updated_at;
    if (u) {
      const d = new Date(String(u));
      if (!Number.isNaN(d.getTime())) {
        lines.push(`Updated ${d.toLocaleDateString()}`);
        continue;
      }
    }
    lines.push("Scenario record");
  }
  return lines;
}

function supplyTone(qty: number): "ok" | "low" | "critical" {
  if (qty <= 2) return "critical";
  if (qty <= 6) return "low";
  return "ok";
}

/** Wouter + `LinkedPatientInfo`: load link → optionally load patient bundle → ready. */
type CarerViewPhase = "loading_link" | "unlinked" | "loading_patient" | "ready";

export default function CarerViewPage() {
  const [location, setLocation] = useLocation();
  const [phase, setPhase] = useState<CarerViewPhase>("loading_link");
  const [link, setLink] = useState<LinkedPatientInfo | null>(null);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof fetchPatientProfileForCarer>>["data"]>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [supplies, setSupplies] = useState<CloudSupplyRow[]>([]);
  const [appointmentRows, setAppointmentRows] = useState<Record<string, unknown>[]>([]);
  const [scenarioRows, setScenarioRows] = useState<Record<string, unknown>[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkedBanner, setLinkedBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const devOverlay =
    import.meta.env.DEV ? (
      <DevNote note="carer-view" error={error ?? loadError ?? undefined} />
    ) : null;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
    if (!raw) {
      console.info("[DEV] Supabase host:", "(not set)");
      return;
    }
    try {
      console.info("[DEV] Supabase host:", new URL(raw).host);
    } catch {
      console.info("[DEV] Supabase host:", "(invalid URL)");
    }
  }, []);

  const scopes = useMemo(() => {
    if (!link) {
      return {
        supplies: false,
        appointments: false,
        scenarios: false,
        emergency_info: false,
      };
    }
    const n = normaliseScopes(link.scopes);
    return {
      supplies: !!n.supplies,
      appointments: !!n.appointments,
      scenarios: !!n.scenarios,
      emergency_info: !!n.emergency_info,
    };
  }, [link]);

  useEffect(() => {
    if (phase !== "ready") return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#carer-scenarios") return;
    requestAnimationFrame(() => {
      document.getElementById("carer-scenarios")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [phase, location]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error: linkErr } = await getLinkedPatientForCarer();
        if (!active) return;
        if (linkErr) {
          console.error("carer-view: link error", linkErr);
          setLink(null);
          setError("unlinked or load error");
          setPhase("unlinked");
          return;
        }
        if (!data?.patientId?.trim()) {
          console.warn("carer-view: missing patientId on link");
          setLink(null);
          setError("unlinked or load error");
          setPhase("unlinked");
          return;
        }
        setError(null);
        setLink(data);
        setPhase("loading_patient");
      } catch (e) {
        console.error("carer-view: link error", e);
        if (!active) return;
        setLink(null);
        setError("unlinked or load error");
        setPhase("unlinked");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== "loading_patient" || !link) return;
    let active = true;
    setLoadError(null);
    setAppointmentRows([]);
    setScenarioRows([]);
    (async () => {
      try {
        const patientId = link.patientId;
        const rawScopes = normaliseScopes(link.scopes);
        const [prof, sup, ap, sc] = await Promise.all([
          fetchPatientProfileForCarer(patientId),
          rawScopes.supplies
            ? fetchSuppliesForLinkedPatient(patientId)
            : Promise.resolve({ data: [], error: null }),
          rawScopes.appointments
            ? fetchAppointmentsForLinkedPatient(patientId)
            : Promise.resolve({ data: [], error: null }),
          rawScopes.scenarios
            ? fetchScenariosForLinkedPatient(patientId)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (active) {
          if (prof.error) setLoadError(prof.error.message);
          setProfile(prof.data);

          if (prof.data?.avatar_url) {
            const url = await resolveProfileImageUrl(prof.data.avatar_url);
            if (active) setAvatarUrl(url);
          } else {
            setAvatarUrl(null);
          }

          if (sup.error) setLoadError(sup.error.message);
          setSupplies(sup.data ?? []);

          if (ap.error) setLoadError(ap.error.message);
          setAppointmentRows(ap.data ?? []);

          if (sc.error) setLoadError(sc.error.message);
          setScenarioRows(sc.data ?? []);
        }
      } catch (e) {
        console.error("carer-view: patient data error", e);
        if (active) {
          setLoadError(e instanceof Error ? e.message : "Something went wrong");
          setSupplies([]);
          setAppointmentRows([]);
          setScenarioRows([]);
        }
      } finally {
        if (active) {
          setPhase("ready");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [phase, link]);

  useEffect(() => {
    if (phase === "unlinked") {
      setLocation("/carer-setup");
    }
  }, [phase, setLocation]);

  useEffect(() => {
    if (phase !== "ready" || !link) return;
    const msg = consumeCarerLinkedBannerMessage();
    if (msg) setLinkedBanner(msg);
  }, [phase, link]);

  const displayName = profile?.full_name?.trim() || "Linked person";
  const nextAppointment = pickNextAppointment(appointmentRows);
  const scenarioLines = scenarioBannerLines(scenarioRows);

  if (!getSupabase()) {
    return (
      <>
        {devOverlay}
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-4" aria-label="Back to home">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Carer View needs Supabase to be configured for this environment.</AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  if (phase === "loading_link") {
    return (
      <>
        {devOverlay}
        <div
          className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground text-sm"
          aria-busy="true"
        >
          Loading…
        </div>
      </>
    );
  }

  if (phase === "unlinked") {
    return (
      <>
        {devOverlay}
        <div
          className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground text-sm"
          data-testid="carer-view-redirecting"
        >
          Redirecting…
        </div>
      </>
    );
  }

  if (phase === "loading_patient" || !link) {
    return (
      <>
        {devOverlay}
        <div
          className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground text-sm"
          aria-busy="true"
        >
          Loading…
        </div>
      </>
    );
  }

  if (phase !== "ready" || !link) {
    return <>{devOverlay}</>;
  }

  return (
    <>
      {devOverlay}
      <PageShell variant="standard" className="max-w-2xl space-y-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <Link href="/account">
          <Button variant="ghost" size="icon" aria-label="Back" data-testid="button-back-from-carer-view" className="self-start">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-h1 text-foreground flex items-center gap-2 flex-wrap" data-testid="heading-carer-view">
            <Eye className="h-7 w-7 text-primary shrink-0" />
            Carer View
          </h1>
          <p className="text-body text-muted-foreground mt-1">Read-only — you cannot change their records from here.</p>
        </div>
        <Badge variant="secondary" className="gap-1 shrink-0" aria-label="Read only">
          <Eye className="h-3 w-3" />
          Read only
        </Badge>
      </div>

      {linkedBanner && (
        <Alert className="border-primary/30 bg-primary/5">
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              You are now linked as a carer for <strong className="font-medium">{linkedBanner}</strong>.
            </span>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setLinkedBanner(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-md" data-testid="carer-view-header">
        <CardContent className="pt-6 flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden"
            aria-hidden={!avatarUrl}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Heart className="h-7 w-7 text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold" data-testid="text-carer-view-name">
              {displayName}
            </h2>
            <p className="text-sm text-muted-foreground">You are viewing with their permission.</p>
          </div>
        </CardContent>
      </Card>

      {(scopes.supplies ?? false) && (
        <Card className="shadow-md" data-testid="carer-view-supplies">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Supplies summary
            </CardTitle>
            <CardDescription>Cloud stock figures they have chosen to share.</CardDescription>
          </CardHeader>
          <CardContent>
            {supplies.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No supply rows visible yet.</p>
            ) : (
              <ul className="space-y-2">
                {supplies.map((s) => {
                  const tone = supplyTone(s.quantity);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium truncate">{s.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground tabular-nums">{s.quantity}</span>
                        {tone === "critical" && (
                          <Badge variant="destructive" className="text-xs">
                            Low
                          </Badge>
                        )}
                        {tone === "low" && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                            Getting low
                          </Badge>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {(scopes.appointments ?? false) && (
        <Card className="shadow-md" data-testid="carer-view-appointments">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Next appointment
            </CardTitle>
            <CardDescription>Read-only — from their cloud appointments when columns are present.</CardDescription>
          </CardHeader>
          <CardContent>
            {!nextAppointment ? (
              <p className="text-sm text-muted-foreground py-2">No appointments visible yet.</p>
            ) : (
              <div className="rounded-md border border-border px-3 py-3 text-sm space-y-1">
                <p className="font-medium">{appointmentTitle(nextAppointment)}</p>
                {formatAppointmentWhen(nextAppointment) ? (
                  <p className="text-muted-foreground">{formatAppointmentWhen(nextAppointment)}</p>
                ) : (
                  <p className="text-muted-foreground text-xs">No scheduled time field on this row.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(scopes.scenarios ?? false) && (
        <Card id="carer-scenarios" className="shadow-md scroll-mt-24" data-testid="carer-view-scenarios">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Scenario status
            </CardTitle>
            <CardDescription>High-level flags from synced scenario rows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scenarioLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scenario data visible yet.</p>
            ) : (
              scenarioLines.map((line, i) => (
                <div
                  key={`${line}-${i}`}
                  className="flex items-start gap-2 text-sm rounded-md border border-border px-3 py-2 bg-muted/30"
                >
                  {line.toLowerCase().includes("sick") ? (
                    <Thermometer className="h-4 w-4 shrink-0 mt-0.5 text-orange-600" />
                  ) : line.toLowerCase().includes("travel") ? (
                    <Plane className="h-4 w-4 shrink-0 mt-0.5 text-purple-600" />
                  ) : (
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  )}
                  <span>{line}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {(scopes.emergency_info ?? false) && (
        <Card className="shadow-md" data-testid="carer-view-emergency">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Emergency details
            </CardTitle>
            <CardDescription>
              They entered this under Account or Settings. Use only as they intend — this is not emergency services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {profile?.emergency_contact_name ? (
              <p>
                <span className="text-muted-foreground">Name: </span>
                {profile.emergency_contact_name}
              </p>
            ) : null}
            {profile?.emergency_contact_phone ? (
              <p>
                <a
                  href={`tel:${profile.emergency_contact_phone.replace(/\s+/g, "")}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  aria-label={`Call ${profile.emergency_contact_phone}`}
                >
                  {profile.emergency_contact_phone}
                </a>
              </p>
            ) : (
              <p className="text-muted-foreground">No phone number saved.</p>
            )}
            {profile?.emergency_notes ? (
              <p className="text-muted-foreground whitespace-pre-wrap">{profile.emergency_notes}</p>
            ) : null}
            {!profile?.emergency_contact_name && !profile?.emergency_contact_phone && !profile?.emergency_notes && (
              <p className="text-muted-foreground">They have not added emergency details yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-center text-muted-foreground px-2">
        This screen is for peace of mind and coordination. It does not give medical advice or replace their care team.
      </p>
    </PageShell>
    </>
  );
}
