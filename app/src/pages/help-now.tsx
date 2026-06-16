import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ChevronRight,
  HeartPulse,
  Phone,
  ShieldAlert,
  Syringe,
  User,
  UserRound,
} from "lucide-react";
import { Link } from "wouter";
import { storage, UserProfile, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { useProfile } from "@/lib/profile";
import { useSupporterSession } from "@/hooks/use-supporter-session";
import { emergencyDetailsEditHref } from "@/lib/emergency-details-edit-href";
import { useEmergencyProfile } from "@/hooks/use-emergency-profile";
import { toLegacyPrimaryContact } from "@/lib/emergency-sync";
import { PageShell } from "@/components/layout";
import { getEffectiveEmergencyNumber } from "@/lib/region";
import { resolveUserDisplayName } from "@/lib/user-display-name";
import { cn } from "@/lib/utils";

const AWAKE_STEPS = [
  "Give fast sugar — juice, regular cola, glucose tablets, or sweets.",
  "Stay with them for 10–15 minutes.",
  "Repeat fast sugar if they are not improving.",
  "Still unwell? Call emergency services using the button below.",
] as const;

const UNCONSCIOUS_STEPS = [
  "Tell paramedics this person has Type 1 Diabetes and uses insulin.",
  "Do not give food, drink, or put anything in their mouth.",
  "Turn them on their side and stay with them until help arrives.",
  "Call emergency services now using the button below.",
] as const;

function StepList({ steps, urgent }: { steps: readonly string[]; urgent?: boolean }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
              urgent
                ? "bg-red-600 text-white dark:bg-red-500"
                : "bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300",
            )}
            aria-hidden
          >
            {index + 1}
          </span>
          <p className="min-w-0 pt-0.5 text-base leading-snug text-foreground">{step}</p>
        </li>
      ))}
    </ol>
  );
}

export default function HelpNow() {
  const { inSupporterSession } = useSupporterSession();
  const emergencyEditHref = emergencyDetailsEditHref(inSupporterSession);
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
  const displayName = resolveUserDisplayName({
    cloudFullName: cloudProfile?.full_name,
    localName: profile?.name,
  });

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const callEmergencyServices = () => {
    handleCall(getEffectiveEmergencyNumber(profile));
  };

  const emergencyNumber = getEffectiveEmergencyNumber(profile);
  const emergencyLabel = `Call ${emergencyNumber}`;

  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);

  const quickSymptoms = useMemo(
    () => ["Shaking", "Sweating", "Confused", "Slurred speech", "Drowsy", "Pale"],
    [],
  );

  const emergencyDockClearance =
    "calc(var(--bottom-nav-height, 7.5rem) + var(--keyboard-inset-bottom, 0px) + 7rem)";

  return (
    <PageShell
      variant="standard"
      density="compact"
      className="min-h-[calc(100vh-8rem)]"
      style={{ paddingBottom: emergencyDockClearance }}
    >
      {/* Hero */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg shadow-red-600/20",
          "bg-gradient-to-br from-red-600 via-red-600 to-red-700",
          "ring-1 ring-red-500/30 dark:from-red-700 dark:via-red-700 dark:to-red-800",
        )}
        role="alert"
        aria-live="polite"
        data-testid="help-now-hero"
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        {/* Medical ID — first thing a bystander should see */}
        <div
          className="relative mb-4 rounded-2xl bg-white px-4 py-3.5 text-center shadow-md ring-2 ring-white/50"
          data-testid="help-now-diabetes-type"
        >
          <p className="font-display text-[1.65rem] font-black uppercase leading-none tracking-tight text-red-700 sm:text-3xl">
            Type 1 Diabetes
          </p>
          {profile?.usingInsulin || isPumpUser ? (
            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm font-bold uppercase tracking-wider text-red-600">
              <Syringe className="h-4 w-4 shrink-0" aria-hidden />
              Insulin dependent
            </p>
          ) : null}
        </div>

        <div className="relative flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide text-red-50">
              Low blood sugar emergency
            </p>
            {displayName ? (
              <div className="space-y-0.5">
                <p
                  className="font-display text-3xl font-bold leading-none tracking-tight"
                  data-testid="help-now-display-name"
                >
                  {displayName}
                </p>
                <p className="text-base font-medium text-red-50">may be having a severe hypo</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xl font-bold leading-tight">Someone needs help</p>
                <p className="text-sm text-red-50">
                  <Link
                    href="/settings/usage#settings-personal"
                    className="font-medium underline underline-offset-2 hover:text-white"
                  >
                    Add your name in Settings
                  </Link>{" "}
                  so helpers know who this is for.
                </p>
              </div>
            )}
            <p className="text-sm leading-relaxed text-red-100/90">
              For anyone helping — this is a <strong className="font-semibold text-white">Type 1</strong> low blood
              sugar emergency. Follow the steps below.
            </p>
          </div>
        </div>
      </div>

      {/* Situation + steps */}
      <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <HeartPulse className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />
              What is their situation?
            </p>
            <div
              className="grid grid-cols-1 gap-2 rounded-2xl bg-muted/50 p-1.5 sm:grid-cols-2"
              role="group"
              aria-label="Person's situation"
            >
              <button
                type="button"
                className={cn(
                  "flex min-h-12 items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-all",
                  mode === "awake"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMode("awake")}
                data-testid="button-toggle-awake"
              >
                <UserRound className="h-4 w-4 shrink-0" aria-hidden />
                Awake &amp; can swallow
              </button>
              <button
                type="button"
                className={cn(
                  "flex min-h-12 items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-all",
                  mode === "unconscious"
                    ? "bg-red-600 text-white shadow-sm ring-1 ring-red-500/40 dark:bg-red-700"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMode("unconscious")}
                data-testid="button-toggle-unconscious"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                Unconscious / can&apos;t swallow
              </button>
            </div>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4",
              mode === "unconscious"
                ? "border-red-500/30 bg-red-500/[0.07] dark:bg-red-950/30"
                : "border-border/60 bg-muted/20",
            )}
          >
            <p className="text-base font-semibold text-foreground">
              {mode === "awake" ? "Give fast sugar, then wait" : `Call ${emergencyNumber} now`}
            </p>
            <div className="mt-3">
              <StepList
                steps={mode === "awake" ? AWAKE_STEPS : UNCONSCIOUS_STEPS}
                urgent={mode === "unconscious"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Common signs
            </p>
            <div className="flex flex-wrap gap-1.5">
              {quickSymptoms.map((symptom) => (
                <span
                  key={symptom}
                  className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {symptom}
                </span>
              ))}
            </div>
          </div>

          {isPumpUser ? (
            <div
              className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] px-3.5 py-3 dark:bg-amber-950/25"
              data-testid="card-pump-emergency"
            >
              <Syringe className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
              <p className="text-sm leading-relaxed text-foreground">
                <strong>Pump user:</strong> treat the hypo first — do not disconnect the pump. If unconscious,
                tell paramedics they use an insulin pump.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Emergency contact */}
      <Card key={syncGeneration} className="rounded-3xl border-border/60 shadow-sm">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground">Emergency contact</p>
          {primaryContact ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 dark:bg-red-500/15">
                <User className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-foreground">{primaryContact.name}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{primaryContact.phone}</p>
                {primaryContact.relationship ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {primaryContact.relationship}
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 rounded-xl"
                onClick={() => handleCall(primaryContact.phone)}
                data-testid="button-call-primary-synced"
              >
                <Phone className="mr-1.5 h-4 w-4" />
                Call
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-center">
              <p className="text-sm text-muted-foreground">No emergency contact saved yet.</p>
              <Button size="sm" variant="link" className="mt-1 h-auto px-0" asChild data-testid="button-call-contact">
                <Link href={emergencyEditHref}>Add emergency contact</Link>
              </Button>
            </div>
          )}

          {emergency?.phoneSecondary?.trim() ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-auto w-full justify-between px-1 text-muted-foreground"
              onClick={() => handleCall(emergency.phoneSecondary.trim())}
              data-testid="button-call-secondary-synced"
            >
              Call secondary contact
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}

          <Button variant="ghost" size="sm" className="h-auto w-full justify-between px-1 text-muted-foreground" asChild>
            <Link href={emergencyEditHref}>
              Edit emergency details
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Fixed call dock */}
      <div
        className="pointer-events-none fixed inset-x-0 z-[95]"
        style={{
          bottom: "calc(var(--bottom-nav-height, 7.5rem) + var(--keyboard-inset-bottom, 0px))",
        }}
      >
        <div
          className="pointer-events-auto bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-2 pt-6 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]"
        >
          <div className="mx-auto max-w-md space-y-2">
            <Button
              size="lg"
              className={cn(
                "h-14 w-full rounded-2xl text-base font-semibold text-white shadow-lg shadow-red-600/25",
                "bg-gradient-to-r from-red-600 to-red-500 dark:from-red-700 dark:to-red-600",
                "ring-1 ring-red-500/30 hover:shadow-xl active:translate-y-px",
              )}
              onClick={callEmergencyServices}
              data-testid="button-call-emergency"
            >
              <span className="mr-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/15">
                <Phone className="h-5 w-5" />
              </span>
              {emergencyLabel}
            </Button>
            {primaryContact ? (
              <Button
                size="sm"
                variant="outline"
                className="h-11 w-full rounded-2xl border-border/80 bg-background/80 backdrop-blur-sm"
                onClick={() => handleCall(primaryContact.phone)}
                data-testid="button-call-contact-dock"
              >
                <User className="mr-2 h-4 w-4" />
                Call {primaryContact.name}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-11 w-full rounded-2xl border-border/80 bg-background/80 backdrop-blur-sm"
                asChild
                data-testid="button-call-contact"
              >
                <Link href={emergencyEditHref}>
                  <User className="mr-2 h-4 w-4" />
                  Add emergency contact
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
