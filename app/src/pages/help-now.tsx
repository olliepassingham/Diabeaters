import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BookOpen, HeartPulse, Phone, ShieldAlert, User } from "lucide-react";
import { Link } from "wouter";
import { storage, UserProfile, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { useProfile } from "@/lib/profile";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { emergencyDetailsEditHref } from "@/lib/emergency-details-edit-href";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { toLegacyPrimaryContact } from "@/lib/emergency-sync";
import { PageShell } from "@/components/layout";
import { getEffectiveEmergencyNumber, getProfileRegion, getRegionDefaultsForProfile } from "@/lib/region";

export default function HelpNow() {
  const { data: linkedPatient } = useLinkedPatient();
  const isCarer = !!linkedPatient;
  const emergencyEditHref = emergencyDetailsEditHref(isCarer);
  const { profile: cloudProfile } = useProfile();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<"awake" | "unconscious">("awake");
  const { data: emergency, syncGeneration } = useEmergencyProfile();

  useEffect(() => {
    setProfile(storage.getProfile());
  }, []);

  useEffect(() => {
    const onProfile = () => setProfile(storage.getProfile());
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  const primaryContact = toLegacyPrimaryContact(emergency);
  const displayName = cloudProfile?.full_name?.trim() || profile?.name?.trim() || "";

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const callEmergencyServices = () => {
    handleCall(getEffectiveEmergencyNumber(profile));
  };

  const regionDefaults = getRegionDefaultsForProfile(profile);
  const emergencyLabel = `Call ${getEffectiveEmergencyNumber(profile)}`;

  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);

  const quickSymptoms = useMemo(
    () => ["Shaking", "Sweating", "Confused", "Slurred speech", "Drowsy", "Pale"],
    [],
  );

  /** Space for fixed emergency bar above bottom nav (nav height is measured at runtime). */
  const emergencyDockClearance =
    "calc(var(--bottom-nav-height, 7.5rem) + var(--keyboard-inset-bottom, 0px) + 7.25rem)";

  return (
    <PageShell
      variant="standard"
      className="min-h-[calc(100vh-8rem)] space-y-4"
      style={{ paddingBottom: emergencyDockClearance }}
    >
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-red-600 via-rose-600 to-red-800 text-white shadow-[0_20px_50px_-12px_rgba(185,28,28,0.55)] ring-1 ring-white/10 dark:from-red-700 dark:via-rose-700 dark:to-red-950 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)]"
        role="alert"
        aria-live="polite"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/15 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.06)_50%,transparent_60%)]"
          aria-hidden
        />
        <div className="relative flex gap-0 sm:gap-1">
          <div className="w-1 shrink-0 rounded-l-3xl bg-gradient-to-b from-white/50 via-white/25 to-white/10" aria-hidden />
          <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <span className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/12 shadow-inner shadow-black/10 ring-1 ring-white/20 backdrop-blur-sm sm:mx-0">
                <ShieldAlert className="h-7 w-7 text-white drop-shadow-sm" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <p className="inline-flex items-center justify-center rounded-full bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-red-50 ring-1 ring-white/15 sm:justify-start">
                    Type 1 diabetes · Emergency
                  </p>
                  <h1 className="mt-3 text-balance text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl sm:leading-tight">
                    This person needs urgent help
                  </h1>
                </div>
                {displayName ? (
                  <p className="text-base font-semibold text-white sm:text-lg">
                    <span className="text-red-100/90">Name · </span>
                    <span className="whitespace-normal break-words">{displayName}</span>
                  </p>
                ) : null}
                <p className="text-base font-medium leading-snug text-white sm:text-lg">
                  <strong className="font-bold text-white">Type 1 diabetes</strong> — blood sugar can drop fast.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-amber-500/35 bg-gradient-to-b from-amber-500/[0.08] to-card shadow-sm ring-1 ring-amber-500/15 dark:from-amber-500/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm dark:bg-amber-600">
              <AlertCircle className="h-5 w-5" aria-hidden />
            </span>
            <span>Low blood sugar — common signs</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickSymptoms.map((s) => (
              <div
                key={s}
                className="rounded-xl border border-amber-500/20 bg-background/80 px-2 py-2.5 text-center text-sm font-semibold text-foreground shadow-sm"
              >
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
            What should you do?
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
              <p className="text-base font-semibold text-foreground">Awake &amp; can swallow — do this</p>
              <ol className="mt-3 space-y-2.5 text-base text-foreground">
                <li>
                  <strong>Fast sugar:</strong> juice, regular (not diet) cola, glucose tablets, or sweets.
                </li>
                <li>
                  <strong>Stay</strong> — wait <strong>10–15 minutes</strong>.
                </li>
                <li>
                  <strong>Repeat</strong> fast sugar if no better.
                </li>
                <li>
                  <strong>Worse or unsure</strong> — red button below.
                </li>
              </ol>
            </div>
          ) : null}

          {mode === "unconscious" ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4">
              <p className="text-base font-semibold text-foreground">Severe emergency — red button below</p>
              <div className="mt-3 space-y-2 text-base text-foreground">
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
          <CardContent className="space-y-3 pt-0 text-base font-medium text-foreground">
            <p>
              Low sugar: <strong>do not disconnect the pump</strong> — treat the hypo first.
            </p>
            <p>
              Unconscious: <strong>do not remove the pump</strong> — say they use a pump to paramedics.
            </p>
          </CardContent>
        </Card>
      ) : null}

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
                <p className="text-sm text-muted-foreground">{primaryContact.phone}</p>
              </div>
              <Button size="sm" onClick={() => handleCall(primaryContact.phone)} data-testid="button-call-primary-synced">
                <Phone className="h-4 w-4 mr-1.5" />
                Call
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/40 p-3">
              <p className="text-sm font-semibold text-foreground">No contact saved</p>
              <Button size="sm" variant="outline" className="mt-3" asChild data-testid="button-call-contact">
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

      <div
        className="fixed left-0 right-0 z-[95] px-4 pb-2 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]"
        style={{
          bottom: "calc(var(--bottom-nav-height, 7.5rem) + var(--keyboard-inset-bottom, 0px) + 0.5rem)",
        }}
      >
        <div className="mx-auto max-w-md rounded-2xl border border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-stretch gap-2">
            <Button size="lg" className="flex-1 rounded-xl bg-red-600 dark:bg-red-700" onClick={callEmergencyServices} data-testid="button-call-emergency">
              <Phone className="h-5 w-5 mr-2" />
              {emergencyLabel}
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
