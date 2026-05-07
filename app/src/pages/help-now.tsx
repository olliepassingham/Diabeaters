import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BookOpen, HeartPulse, Phone, ShieldAlert, User } from "lucide-react";
import { Link } from "wouter";
import { storage, UserProfile } from "@/lib/storage";
import { useProfile } from "@/lib/profile";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { emergencyDetailsEditHref } from "@/lib/emergency-details-edit-href";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { toLegacyPrimaryContact } from "@/lib/emergency-sync";
import { PageShell } from "@/components/layout";
import { MedicalSourcesLink } from "@/components/medical-sources-link";

export default function HelpNow() {
  const { data: linkedPatient } = useLinkedPatient();
  const isCarer = !!linkedPatient;
  const emergencyEditHref = emergencyDetailsEditHref(isCarer);
  const { profile: cloudProfile } = useProfile();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<"awake" | "unconscious" | null>(null);
  const { data: emergency, syncGeneration } = useEmergencyProfile();

  useEffect(() => {
    setProfile(storage.getProfile());
  }, []);

  const primaryContact = toLegacyPrimaryContact(emergency);
  const displayName = cloudProfile?.full_name?.trim() || profile?.name?.trim() || "";

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const callEmergencyServices = () => {
    handleCall("999");
  };

  const isPumpUser = profile?.insulinDeliveryMethod === "pump";

  const quickSymptoms = useMemo(
    () => ["Shaking", "Sweating", "Confused", "Slurred speech", "Drowsy", "Pale"],
    [],
  );

  return (
    <PageShell variant="standard" className="min-h-[calc(100vh-8rem)] space-y-4 pb-24">
      <Card className="overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.12] via-background to-background">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600 text-white shadow-sm shadow-red-600/20">
                  <ShieldAlert className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">Help Now</h1>
                  <p className="text-sm text-muted-foreground">
                    Emergency steps for someone with Type 1 diabetes
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Person</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{displayName || "Unknown name"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  If you’re unsure what’s happening, call <strong>999</strong>.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <MedicalSourcesLink anchor="helpnow" compact />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card key={syncGeneration} className="rounded-2xl border-border/70 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
            Emergency contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {primaryContact ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{primaryContact.name}</p>
                <p className="text-xs text-muted-foreground">{primaryContact.phone}</p>
              </div>
              <Button size="sm" onClick={() => handleCall(primaryContact.phone)} data-testid="button-call-primary-synced">
                <Phone className="h-4 w-4 mr-1.5" />
                Call
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/40 p-3">
              <p className="text-sm font-medium text-foreground">No emergency contact saved</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add an emergency contact so a helper can quickly call someone who knows the person.
              </p>
              <Button size="sm" variant="outline" className="mt-2" asChild data-testid="button-call-contact">
                <Link href={emergencyEditHref}>
                  <User className="h-4 w-4 mr-1.5" />
                  Add contact
                </Link>
              </Button>
            </div>
          )}

          {emergency?.phoneSecondary?.trim() ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => handleCall(emergency.phoneSecondary.trim())}
              data-testid="button-call-secondary-synced"
            >
              Call secondary contact
            </Button>
          ) : null}

          <Button variant="secondary" size="sm" className="w-full" asChild>
            <Link href={emergencyEditHref}>Edit emergency details</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
            Quick check
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            Low blood sugar can look like shaking, sweating, confusion, slurred speech, drowsiness, pale skin.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {quickSymptoms.map((s) => (
              <div key={s} className="rounded-lg border border-border/70 bg-background/60 px-2 py-1.5 text-muted-foreground">
                {s}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="h-4 w-4 text-primary" aria-hidden />
            What is happening right now?
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={mode === "awake" ? "default" : "outline"}
              className="min-h-12 justify-start rounded-xl px-4 text-left"
              onClick={() => setMode("awake")}
              data-testid="button-toggle-awake"
            >
              Awake &amp; can swallow
            </Button>
            <Button
              type="button"
              variant={mode === "unconscious" ? "destructive" : "outline"}
              className="min-h-12 justify-start rounded-xl px-4 text-left"
              onClick={() => setMode("unconscious")}
              data-testid="button-toggle-unconscious"
            >
              Unconscious / seizure / can’t swallow
            </Button>
          </div>

          {mode === "awake" ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
              <p className="text-sm font-semibold text-foreground">Do this now</p>
              <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Give fast sugar</strong> (juice, regular non‑diet cola, glucose tablets, sweets).
                </li>
                <li>
                  <strong className="text-foreground">Stay with them</strong> and wait <strong className="text-foreground">10–15 minutes</strong>.
                </li>
                <li>
                  If they don’t improve, <strong className="text-foreground">repeat fast sugar</strong>.
                </li>
                <li>
                  If they get worse or you are unsure, <strong className="text-foreground">call 999</strong>.
                </li>
              </ol>
            </div>
          ) : null}

          {mode === "unconscious" ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4">
              <p className="text-sm font-semibold text-foreground">Call 999 immediately</p>
              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                  <p>
                    <strong className="text-foreground">Do not</strong> give food or drink.
                  </p>
                  <p className="mt-1">
                    <strong className="text-foreground">Do not</strong> put anything in their mouth.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                  <p>
                    <strong className="text-foreground">Turn them on their side</strong> and stay with them until help arrives.
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="mt-3 w-full rounded-xl bg-red-600 dark:bg-red-700"
                onClick={callEmergencyServices}
                data-testid="button-call-999-unconscious"
              >
                <Phone className="h-5 w-5 mr-2" />
                Call 999 now
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isPumpUser ? (
        <Card className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.05]" data-testid="card-pump-emergency">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-indigo-900 dark:text-indigo-100">
              <AlertCircle className="h-4 w-4 text-indigo-700 dark:text-indigo-300" aria-hidden />
              Pump user note
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
            <p>
              If their blood sugar is low, <strong className="text-foreground">do not disconnect the pump</strong>. Treat the hypo first.
            </p>
            <p>
              If unconscious, <strong className="text-foreground">do not remove the pump</strong>. Tell paramedics they use a pump.
            </p>
            <MedicalSourcesLink anchor="sickday" compact />
          </CardContent>
        </Card>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Emergency guidance only — call <strong>999</strong> if unsure.
      </p>

      <div className="fixed bottom-[env(safe-area-inset-bottom)] left-0 right-0 z-[60] px-4 pb-4">
        <div className="mx-auto max-w-md rounded-2xl border border-border/70 bg-background/85 p-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex items-stretch gap-2">
            <Button size="lg" className="flex-1 rounded-xl bg-red-600 dark:bg-red-700" onClick={callEmergencyServices} data-testid="button-call-999">
              <Phone className="h-5 w-5 mr-2" />
              Call 999
            </Button>
            {primaryContact ? (
              <Button
                size="lg"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => handleCall(primaryContact.phone)}
                data-testid="button-call-contact"
              >
                <User className="h-5 w-5 mr-2" />
                Call {primaryContact.name}
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="flex-1 rounded-xl" asChild data-testid="button-call-contact">
                <Link href={emergencyEditHref}>
                  <User className="h-5 w-5 mr-2" />
                  Add contact
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
