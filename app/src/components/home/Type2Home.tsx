import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { differenceInCalendarDays, format } from "date-fns";
import {
  ArrowRight,
  Calendar,
  MessageCircle,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/layout";
import { HomeSupplyGraph } from "@/components/home/HomeSupplyGraph";
import { useAuth } from "@/lib/auth-context";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { getCommunityMemberLandingPath } from "@/lib/community-landing";
import { isAiCoachEnabled, isCommunityEnabled } from "@/lib/flags";
import { hapticLight } from "@/lib/haptics";
import { useProfile } from "@/lib/profile";
import { ensureLocalType2Profile } from "@/lib/type2-session";
import { seedPatientFirstRunDefaultsIfNeeded } from "@/lib/starter-patient-defaults";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_APPOINTMENTS_CHANGED_EVENT,
  DIABEATER_SUPPLIES_CHANGED_EVENT,
  storage,
  type Appointment,
  type AppointmentType,
  type Supply,
  type UserProfile,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

const VERIFIED_WELCOME_PENDING_KEY = "diabeater_verified_welcome_pending";
const VERIFIED_WELCOME_DISMISSED_AT_KEY = "diabeater_verified_welcome_dismissed_at";
const VERIFIED_WELCOME_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const APPOINTMENT_TYPE_LABEL: Record<AppointmentType, string> = {
  clinic: "Clinic review",
  eye_check: "Eye check",
  foot_check: "Foot check",
  blood_test: "Blood test",
  pump_review: "Pump review",
  other: "Appointment",
};

function parseAppointmentDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function appointmentSubtitle(appointment: Appointment, today: Date): string {
  const d = parseAppointmentDate(appointment.date);
  if (!d) return "Date to confirm";
  const days = differenceInCalendarDays(d, today);
  const dateLabel = format(d, "EEE d MMM");
  if (days < 0) return `Overdue · ${dateLabel}`;
  if (days === 0) return `Today · ${dateLabel}`;
  if (days === 1) return `Tomorrow · ${dateLabel}`;
  if (days <= 7) return `This week · ${dateLabel}`;
  return dateLabel;
}

export function Type2Home({
  profile: profileProp,
  displayName,
}: {
  profile: UserProfile | null;
  displayName: string;
}) {
  const { user } = useAuth();
  const { profile: cloudProfile } = useProfile();
  const [profile, setProfile] = useState(profileProp);
  const [supplies, setSupplies] = useState<Supply[]>(() => storage.getSupplies());
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [showVerifiedWelcome, setShowVerifiedWelcome] = useState(false);
  const firstName = displayName.split(" ")[0] || "";
  const showCoach = isAiCoachEnabled;
  const showFeed = isCommunityEnabled;
  const coachHref = buildCoachHref({ topic: "community" });
  const feedHref = getCommunityMemberLandingPath(cloudProfile ?? null);
  const feedNeedsSetup = feedHref.includes("/setup");

  useEffect(() => {
    setProfile(ensureLocalType2Profile(profileProp));
  }, [profileProp]);

  useEffect(() => {
    seedPatientFirstRunDefaultsIfNeeded();
    const refreshSupplies = () => setSupplies(storage.getSupplies());
    const refreshAppointments = () => {
      const uid = user?.id;
      if (!uid) {
        setNextAppointment(null);
        return;
      }
      const upcoming = storage.getUpcomingAppointmentsForUser(uid);
      setNextAppointment(Array.isArray(upcoming) && upcoming.length > 0 ? upcoming[0]! : null);
    };
    refreshSupplies();
    refreshAppointments();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        refreshSupplies();
        refreshAppointments();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refreshSupplies);
    window.addEventListener("focus", refreshAppointments);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refreshSupplies);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refreshAppointments);
    window.addEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refreshSupplies);
    window.addEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, refreshAppointments);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refreshSupplies);
      window.removeEventListener("focus", refreshAppointments);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refreshSupplies);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refreshAppointments);
      window.removeEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refreshSupplies);
      window.removeEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, refreshAppointments);
    };
  }, [user?.id]);

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

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [nextAppointment?.id, nextAppointment?.date]);

  return (
    <PageShell variant="narrow" density="compact" className="max-w-[26.75rem]" data-testid="type2-home">
      <PageHeader
        screenReaderOnly
        title={<span data-testid="dashboard-title">Type 2 home</span>}
        description={<span data-testid="dashboard-subtitle">Feed, supplies, and care</span>}
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

        <Link
          href="/appointments"
          onClick={() => {
            void hapticLight();
          }}
          className={cn(
            "pressable group flex w-full items-center gap-3.5 rounded-2xl border border-border/50 bg-card/70 px-4 py-3.5 text-left",
            "active:scale-[0.99] hover:bg-muted/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          data-testid="type2-home-appointments"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Calendar className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug text-foreground">
              {nextAppointment
                ? nextAppointment.title?.trim() ||
                  APPOINTMENT_TYPE_LABEL[nextAppointment.type] ||
                  "Next appointment"
                : "Appointments"}
            </span>
            <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
              {nextAppointment
                ? appointmentSubtitle(nextAppointment, today)
                : "No visits yet — add a clinic or screening"}
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground/65 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>

        {showFeed ? (
          <Link
            href={feedHref}
            onClick={() => {
              void hapticLight();
            }}
            className={cn(
              "pressable group flex w-full items-center gap-3.5 rounded-[1.35rem] border border-border/50 bg-card/70 px-4 py-3.5 text-left",
              "active:scale-[0.99] hover:bg-muted/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="type2-home-feed"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-snug text-foreground">
                {feedNeedsSetup ? "Join the Feed" : "Open Feed"}
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                {feedNeedsSetup
                  ? "Set up your public profile to see posts and stories"
                  : "See what's new from others living with diabetes"}
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-muted-foreground/65 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ) : null}

        {showCoach ? (
          <Link
            href={coachHref}
            onClick={() => {
              void hapticLight();
            }}
            className={cn(
              "pressable group flex w-full items-center gap-3.5 rounded-[1.35rem] border px-4 py-3.5 text-left",
              "border-primary/25 bg-primary text-primary-foreground shadow-sm shadow-primary/20",
              "active:scale-[0.99] hover:bg-primary/92",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            data-testid="type2-home-ask-beatie"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-snug text-primary-foreground">
                {openAssistantCtaLabel()}
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-primary-foreground/80">
                AI helper for diabetes questions
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 opacity-80 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ) : null}

        <Link
          href="/help-now"
          onClick={() => {
            void hapticLight();
          }}
          className={cn(
            "pressable group flex w-full items-center gap-3.5 rounded-[1.35rem] border px-4 py-3.5 text-left",
            "border-red-500/30 bg-red-500/[0.08] hover:bg-red-500/[0.12]",
            "active:scale-[0.99]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          data-testid="type2-home-emergency"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-600 dark:text-red-400">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug text-foreground">Help Now</span>
            <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
              Emergency card for bystanders
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-red-600/70 transition-transform group-hover:translate-x-0.5 dark:text-red-400/80"
            aria-hidden
          />
        </Link>
      </section>
    </PageShell>
  );
}
