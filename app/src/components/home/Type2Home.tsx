import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Calendar,
  MessageCircle,
  Phone,
  ShieldAlert,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/layout";
import { HomeSectionHeading } from "@/components/home/home-ui";
import { HomeSupplyGraph } from "@/components/home/HomeSupplyGraph";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { AI_ASSISTANT_NAME, openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { isAiCoachEnabled } from "@/lib/flags";
import { hapticLight } from "@/lib/haptics";
import { ensureLocalType2Profile } from "@/lib/type2-session";
import { seedPatientFirstRunDefaultsIfNeeded } from "@/lib/starter-patient-defaults";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_SUPPLIES_CHANGED_EVENT,
  storage,
  type Supply,
  type UserProfile,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

const VERIFIED_WELCOME_PENDING_KEY = "diabeater_verified_welcome_pending";
const VERIFIED_WELCOME_DISMISSED_AT_KEY = "diabeater_verified_welcome_dismissed_at";
const VERIFIED_WELCOME_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function CareLink({
  href,
  icon: Icon,
  title,
  subtitle,
  testId,
  tone = "default",
}: {
  href: string;
  icon: typeof Calendar;
  title: string;
  subtitle: string;
  testId: string;
  tone?: "default" | "urgent" | "primary";
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        void hapticLight();
      }}
      className={cn(
        "pressable group flex w-full items-center gap-3.5 rounded-[1.35rem] border px-4 py-3.5 text-left",
        "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone === "urgent" && "border-red-500/25 bg-red-500/[0.06] hover:bg-red-500/[0.1]",
        tone === "primary" &&
          "border-primary/25 bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/92",
        tone === "default" && "border-border/50 bg-card/70 hover:bg-muted/30",
      )}
      data-testid={testId}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
          tone === "primary" && "bg-primary-foreground/15",
          tone === "urgent" && "bg-red-500/15 text-red-600 dark:text-red-400",
          tone === "default" && "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] font-semibold leading-snug",
            tone === "primary" ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-sm leading-snug",
            tone === "primary" ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </span>
      </span>
      <ArrowRight
        className={cn(
          "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
          tone === "primary" ? "opacity-80" : "text-muted-foreground/65",
        )}
        aria-hidden
      />
    </Link>
  );
}

export function Type2Home({
  profile: profileProp,
  displayName,
}: {
  profile: UserProfile | null;
  displayName: string;
}) {
  const [profile, setProfile] = useState(profileProp);
  const [supplies, setSupplies] = useState<Supply[]>(() => storage.getSupplies());
  const [showVerifiedWelcome, setShowVerifiedWelcome] = useState(false);
  const firstName = displayName.split(" ")[0] || "";
  const showCoach = isAiCoachEnabled;
  const coachHref = buildCoachHref({ topic: "community" });

  useEffect(() => {
    setProfile(ensureLocalType2Profile(profileProp));
  }, [profileProp]);

  useEffect(() => {
    seedPatientFirstRunDefaultsIfNeeded();
    const refresh = () => setSupplies(storage.getSupplies());
    refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    try {
      const pending = localStorage.getItem(VERIFIED_WELCOME_PENDING_KEY) === "true";
      if (!pending) return;
      const dismissedAt = localStorage.getItem(VERIFIED_WELCOME_DISMISSED_AT_KEY);
      const dismissedRecently =
        dismissedAt != null &&
        Date.now() - new Date(dismissedAt).getTime() < VERIFIED_WELCOME_DISMISS_TTL_MS;
      if (dismissedRecently) {
        localStorage.removeItem(VERIFIED_WELCOME_PENDING_KEY);
        return;
      }
      setShowVerifiedWelcome(true);
      localStorage.removeItem(VERIFIED_WELCOME_PENDING_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return (
    <PageShell variant="narrow" density="compact" className="max-w-[26.75rem]" data-testid="type2-home">
      <PageHeader
        screenReaderOnly
        title={<span data-testid="dashboard-title">Type 2 home</span>}
        description={<span data-testid="dashboard-subtitle">Supplies, appointments, and emergency details</span>}
      />

      <section className="home-flow-canvas animate-fade-in space-y-5" data-testid="type2-home-canvas">
        {showVerifiedWelcome ? (
          <Alert
            className="animate-fade-in-up border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20 dark:border-emerald-500/30"
            data-testid="banner-verified-welcome"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <AlertDescription className="text-sm">Welcome! Your email is verified.</AlertDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 -mt-1.5 -mr-1.5"
                aria-label="Dismiss verification welcome banner"
                onClick={() => {
                  try {
                    localStorage.setItem(VERIFIED_WELCOME_DISMISSED_AT_KEY, new Date().toISOString());
                  } catch {
                    // Ignore
                  }
                  setShowVerifiedWelcome(false);
                }}
                data-testid="button-dismiss-verified-welcome"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        ) : null}

        <header className="space-y-1 px-0.5 pt-0.5" data-testid="type2-home-greeting">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/75">Type 2</p>
          <h1 className="font-display text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
            {firstName ? `Hi ${firstName}` : "Welcome"}
          </h1>
          {!profile?.name?.trim() ? (
            <Link
              href="/settings/usage"
              className="inline-flex pt-0.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              data-testid="type2-home-add-name"
            >
              Add your name in Settings
            </Link>
          ) : null}
        </header>

        <HomeSupplyGraph supplies={supplies} />

        <div className="space-y-2.5">
          <HomeSectionHeading title="Care" subtitle="Appointments and emergency" />
          <div className="space-y-2" data-testid="type2-home-care-kit">
            <CareLink
              href="/appointments"
              icon={Calendar}
              title="Appointments"
              subtitle="Clinic visits and check-ups"
              testId="type2-home-appointments"
            />
            <CareLink
              href="/help-now"
              icon={ShieldAlert}
              title="Emergency details"
              subtitle="Help Now card for bystanders"
              testId="type2-home-emergency"
              tone="urgent"
            />
          </div>
        </div>

        {showCoach ? (
          <CareLink
            href={coachHref}
            icon={MessageCircle}
            title={openAssistantCtaLabel()}
            subtitle={`Ask ${AI_ASSISTANT_NAME} — education only, not dosing advice`}
            testId="type2-home-ask-beatie"
            tone="primary"
          />
        ) : null}

        <Link
          href="/account#account-emergency"
          onClick={() => {
            void hapticLight();
          }}
          className="flex items-center justify-center gap-2 px-1 py-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          data-testid="type2-home-edit-emergency"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden />
          Edit emergency contacts
        </Link>
      </section>
    </PageShell>
  );
}
