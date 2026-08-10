// client/src/App.tsx
import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from "react";
import { Switch, Route, useLocation, useSearch, Redirect } from "wouter";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DevBanner } from "@/components/DevBanner";
import { DevSupabaseDiagnostics } from "@/components/DevSupabaseDiagnostics";
import { DevPerfDiagnostics } from "@/components/dev-perf-diagnostics";
import { StagingBanner } from "@/components/StagingBanner";
import { isAiCoachEnabled, isStaging } from "@/lib/flags";

import { BottomNav } from "@/components/bottom-nav";
import { Link } from "wouter";
import { AppTopBar } from "@/components/app-top-bar";
import { DmThreadSubheader } from "@/components/dm-thread-subheader";
import { AppStatusStrip } from "@/components/app-status-strip";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { KeyboardInsets } from "@/components/keyboard-insets";
import { AlcoholReminderPoller } from "@/components/alcohol-reminder-poller";
import { PumpFailureReminderPoller } from "@/components/pump-failure-reminder-poller";
import { ExerciseCgmAlertPoller } from "@/components/exercise-cgm-alert-poller";
import { ExerciseCgmServerMonitorSync } from "@/components/exercise-cgm-server-monitor-sync";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedLoadingSkeleton, HubLoadingSkeleton, PageLoadingSkeleton } from "@/components/empty-state";

import { ThemeProvider } from "@/hooks/use-theme";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { EmergencyProfileProvider } from "@/hooks/use-emergency-profile";
import { isUserVerified, logout } from "@/lib/auth";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { pathFromOpenedAppUrl } from "@/lib/native-app-open-url";
import {
  applyPushDeepLinkPath,
  setPushDeepLinkNavigationHandler,
  setPushDeepLinkNavigationReady,
} from "@/lib/push-notification-deep-link";
import { handleNotificationButtonAction } from "@/lib/notification-actions";
import { ensurePushDeepLinkListenersAttached } from "@/lib/push-tokens";
import Dashboard from "@/pages/dashboard";
import ToolsPage from "@/pages/tools/index";
import Bedtime from "@/pages/bedtime";
import SickDay from "@/pages/sick-day";
import Travel from "@/pages/travel";
import Scenarios from "@/pages/scenarios";
import ScenarioExercisePage from "@/pages/scenarios/exercise";
import AlcoholScenarioPage from "@/pages/scenarios/alcohol";
import DrivingScenarioPage from "@/pages/scenarios/driving";
import PumpFailurePage from "@/pages/scenarios/pump-failure";
import Supplies from "@/pages/supplies";

const Login = lazy(() => import("@/pages/login"));
const Signup = lazy(() => import("@/pages/signup"));
const AuthCallback = lazy(() => import("@/pages/auth-callback"));
const AuthConfirm = lazy(() => import("@/pages/auth-confirm"));
const EmailVerify = lazy(() => import("@/pages/email-verify"));
const ResetRequest = lazy(() => import("@/pages/reset-request"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const CheckEmail = lazy(() => import("@/pages/check-email"));
const VerifiedSuccess = lazy(() => import("@/pages/verified-success"));
const Welcome = lazy(() => import("@/pages/welcome"));
const VerifiedReturn = lazy(() => import("@/pages/verified-return"));
const FamilyCarers = lazy(() => import("@/pages/family-carers"));
const CarerView = lazy(() => import("@/pages/carer-view"));
const CarerActivityLogPage = lazy(() => import("@/pages/carer-view/activity-log"));
const CarerLiveGlucosePage = lazy(() => import("@/pages/carer-view/live-glucose"));
const CarerSetup = lazy(() => import("@/pages/carer-setup"));
const ModeChooser = lazy(() => import("@/pages/mode"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { useLinkedPatient } from "@/lib/carers";
import {
  invalidateLinkedPatientQuery,
  useLinkedPatientQuery,
} from "@/lib/carer-link-query";
import { getProfile, profileQueryKey, useProfile } from "@/lib/profile";
import { scheduleDemoRoutePrefetch } from "@/lib/demo-route-prefetch";
import {
  isPatientOnboardingSatisfied,
  readOnboardingCompleteFromLocalStorage,
  resolveAppGateReady,
} from "@/lib/offline-app-gate";
import { isOnline } from "@/lib/offline";
import { useOffline } from "@/hooks/use-offline";
import {
  OFFLINE_SUPPLY_QUEUED_TOAST,
  OFFLINE_SUPPLY_RETRY_TOAST,
  offlineReconcileToasts,
} from "@/lib/offline-messaging";
import { reconcileAfterBackOnline } from "@/lib/offline-reconcile";
import { isCommunityMemberSession, scheduleCommunityWarmup } from "@/lib/community-feed-cache";
import { resolvesAsCommunityMemberAccount } from "@/lib/community-member-session";
import {
  clearCarerClientSessionKeys,
  getActiveAppMode,
  applyActiveCarerPatientFromNotification,
  getPrimaryAppRole,
  hasCarerIntent,
  hasPendingCarer,
  isCarerSessionMode,
  isCommunityOnlyAccount,
  isCommunitySessionMode,
  isSupporterOnlyAccount,
  onboardingAccountPathFromUserMetadata,
  setActiveAppMode,
} from "@/lib/carer-session";
import { AnimatedRouteOutlet } from "@/components/animated-route-outlet";
import { CommunityFeatureGate } from "@/components/community-feature-gate";
import { PatientOnboardingGate } from "@/components/patient-onboarding-gate";
import { ClinicalPrefsCloudSync } from "@/components/clinical-prefs-cloud-sync";
import { SickDayCloudRepairSync } from "@/components/sick-day-cloud-repair-sync";
import { SickDayMedDuePoller } from "@/components/sick-day-med-due-poller";
import { AppointmentReminderPoller } from "@/components/appointment-reminder-poller";
import { BedtimeReminderPoller } from "@/components/bedtime-reminder-poller";
import { PumpChangeReminderPoller } from "@/components/pump-change-reminder-poller";
import { BedtimeReminderPromptDialog } from "@/components/bedtime-reminder-prompt-dialog";
import { HypoCheckInRespondHost } from "@/components/hypo-check-in-respond-host";
import { ExerciseModeOverlay } from "@/components/exercise-mode-overlay";
import { cancelAllBedtimeReminders, rescheduleBedtimeReminders } from "@/lib/bedtime-reminders";
import { useBedtimeReminderPromptAfterOnboarding } from "@/hooks/use-bedtime-reminder-prompt-after-onboarding";
import { SupplyLowNotifyPoller } from "@/components/supply-low-notify-poller";
import { NativeAppBadgeSync } from "@/components/native-app-badge-sync";
import { NativeNavBackHandler } from "@/components/native-nav-back-handler";
import { NativeOsSurfacesSync } from "@/components/native-os-surfaces-sync";
import { PostLoginToast } from "@/components/post-login-toast";
import { AchievementSync } from "@/components/achievement-sync";
import { DmInboxQuerySync } from "@/components/dm-inbox-query-sync";
import { NativePushForegroundSync } from "@/components/native-push-foreground-sync";
import { ensureNativeNotificationChannels } from "@/lib/native-local-notifications";
import {
  supportsNativeLocalNotifications,
  isCapacitorNativeShell,
  shouldRegisterServiceWorker,
} from "@/lib/native-platform";
import { AskAnythingProvider } from "@/components/ai-coach/ask-anything-context";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { getCommunityMemberLandingPath, resolveCommunityMemberLandingPath } from "@/lib/community-landing";
import NotFound from "@/pages/not-found";
import ShotsPage from "@/pages/shots";
import Privacy from "@/pages/privacy";
import Support from "@/pages/support";
import MedicalSourcesPage from "@/pages/medical-sources";
const Account = lazy(() => import("@/pages/account"));
const CommunityHome = lazy(() => import("@/pages/community/index"));
const CommunitySetup = lazy(() => import("@/pages/community/setup"));
const CommunityPost = lazy(() => import("@/pages/community/post"));
const CommunityMessages = lazy(() => import("@/pages/community/messages"));
const CommunityThread = lazy(() => import("@/pages/community/thread"));
const CommunityProfile = lazy(() => import("@/pages/community/profile"));
const CommunityHandleResolve = lazy(() => import("@/pages/community/handle-resolve"));

const CoachPage = lazy(() => import("@/pages/coach"));
const HypoHelpPage = lazy(() => import("@/pages/tools/hypo-help"));
const HypoHistoryPage = lazy(() => import("@/pages/tools/hypo-history"));
const PatternsPage = lazy(() => import("@/pages/tools/patterns"));
const ActivityLogPage = lazy(() => import("@/pages/tools/activity-log"));
const AchievementsPage = lazy(() => import("@/pages/tools/achievements"));
const CorrectionHelpPage = lazy(() => import("@/pages/tools/correction-help"));
const CgmLivePage = lazy(() => import("@/pages/tools/cgm-live"));
const TipsPage = lazy(() => import("@/pages/tools/tips"));
const GlucoseConverterPage = lazy(() => import("@/pages/tools/glucose-converter"));
const GlossaryIndex = lazy(() => import("@/pages/education/index"));
const GlossaryDetail = lazy(() => import("@/pages/education/[slug]"));

const Adviser = lazy(() => import("@/pages/adviser"));
const Routines = lazy(() => import("@/pages/routines"));
const HelpNow = lazy(() => import("@/pages/help-now"));
const Appointments = lazy(() => import("@/pages/appointments"));
const EmergencyCard = lazy(() => import("@/pages/emergency-card"));

const SettingsPage = lazy(() => import("@/pages/settings"));
const SettingsEmergencyPage = lazy(() => import("@/pages/settings/emergency"));
const SettingsPharmacyPage = lazy(() => import("@/pages/settings/pharmacy"));
const SettingsCarbSourcesPage = lazy(() => import("@/pages/settings/carb-sources"));

/** Single bottom inset above fixed BottomNav + home-indicator safe area. PageShell adds content rhythm only — no second nav-height pad. */
const MAIN_BOTTOM_SCROLL_PADDING =
  "calc(var(--bottom-nav-height, 7.5rem) + env(safe-area-inset-bottom, 0px) + 1rem)";

/** When BottomNav is hidden (e.g. unverified `/account` slim shell). */
const MAIN_BOTTOM_SCROLL_PADDING_NO_NAV =
  "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)";

function RouteFallback() {
  // Hold the skeleton back briefly: fast chunk loads render nothing (feels instant),
  // only genuinely slow loads show a shell-matched placeholder instead of a spinner flash.
  const [location] = useLocation();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), 180);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return <div className="min-h-[40vh]" aria-hidden />;

  const path = location.split("?")[0] || "/";
  let body: ReactNode;
  if (
    path === "/tools" ||
    path === "/scenarios" ||
    path === "/education" ||
    path.startsWith("/education/")
  ) {
    body = <HubLoadingSkeleton tiles={6} />;
  } else if (path === "/community" || path.startsWith("/community/post")) {
    body = <FeedLoadingSkeleton rows={4} />;
  } else if (path.startsWith("/community/messages")) {
    body = <PageLoadingSkeleton rows={5} />;
  } else if (path.startsWith("/tools/") || path.startsWith("/scenarios/")) {
    body = <PageLoadingSkeleton rows={4} />;
  } else if (path === "/account" || path.startsWith("/settings") || path === "/notifications") {
    body = <PageLoadingSkeleton rows={5} />;
  } else if (path.startsWith("/carer-view")) {
    body = <PageLoadingSkeleton rows={4} />;
  } else {
    body = <PageLoadingSkeleton rows={3} />;
  }

  return (
    <div className="animate-in fade-in duration-200 py-2" role="status" aria-live="polite">
      {body}
    </div>
  );
}

/** Soft gradient mesh behind app content (calm, Flo-like atmosphere). */
function AppShellBackdrop({ tone = "rich" }: { tone?: "quiet" | "rich" }) {
  const isQuiet = tone === "quiet";
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className={
          "absolute -top-28 -right-[12%] h-[min(32rem,90vw)] w-[min(32rem,90vw)] rounded-full blur-3xl " +
          (isQuiet ? "bg-primary/[0.09] dark:bg-primary/[0.12]" : "bg-primary/[0.22] dark:bg-primary/[0.18]")
        }
      />
      <div
        className={
          "absolute top-[38%] -left-[18%] h-[min(26rem,85vw)] w-[min(26rem,85vw)] rounded-full blur-3xl " +
          (isQuiet
            ? "bg-primary/[0.08] dark:bg-[hsl(280_40%_48%_/_0.11)]"
            : "bg-primary/[0.16] dark:bg-[hsl(280_40%_48%_/_0.14)]")
        }
      />
      <div
        className={
          "absolute bottom-[-10%] left-1/2 h-40 w-[min(140%,48rem)] -translate-x-1/2 rounded-[100%] bg-gradient-to-t to-transparent " +
          (isQuiet ? "from-primary/[0.06] dark:from-primary/[0.08]" : "from-primary/[0.14] dark:from-primary/[0.12]")
        }
      />
    </div>
  );
}

function getSafeNext(pathname: string, search: string): string {
  const p = pathname?.startsWith("/") ? pathname : `/${pathname || ""}`;
  const qs = search ? `?${search.replace(/^\?/, "")}` : "";
  const next = `${p}${qs}`;
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function useNativeDeepLinks() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;

    const applyOpenedUrl = (rawUrl: string) => {
      const safe = pathFromOpenedAppUrl(rawUrl);
      if (safe) setLocation(safe);
    };

    void CapacitorApp.getLaunchUrl()
      .then((info: unknown) => {
        const url =
          info && typeof (info as { url?: unknown }).url === "string" ? String((info as { url: string }).url).trim() : "";
        if (url) applyOpenedUrl(url);
      })
      .catch(() => {
        // ignore
      });

    let removed = false;
    let handle: { remove: () => Promise<void> } | null = null;

    void CapacitorApp.addListener("appUrlOpen", (event: { url: string }) => {
      applyOpenedUrl(event.url);
    }).then((h: { remove: () => Promise<void> }) => {
      if (removed) {
        void h.remove();
      } else {
        handle = h;
      }
    });

    return () => {
      removed = true;
      if (handle) void handle.remove();
    };
  }, [setLocation]);
}

function useNativeLocalNotificationDeepLinks() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;

    let removed = false;
    let handle: { remove: () => Promise<void> } | null = null;

    void LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (event: { actionId?: string; notification?: { extra?: Record<string, unknown> } }) => {
        const extra = event?.notification?.extra ?? null;
        const actionId = typeof event?.actionId === "string" ? event.actionId : "";

        const followDeepLink = () => {
          const raw = extra && typeof extra.deep_link === "string" ? extra.deep_link : "";
          const next = raw.trim();
          if (!next) return;
          if (!next.startsWith("/") || next.startsWith("//")) return;
          applyActiveCarerPatientFromNotification(extra, next);
          applyPushDeepLinkPath(next, setLocation);
        };

        if (actionId && actionId !== "tap") {
          void handleNotificationButtonAction(actionId, extra).then((handled) => {
            if (!handled) followDeepLink();
          });
          return;
        }
        followDeepLink();
      },
    ).then((h: { remove: () => Promise<void> }) => {
      if (removed) void h.remove();
      else handle = h;
    });

    return () => {
      removed = true;
      if (handle) void handle.remove();
    };
  }, [setLocation]);
}

function useNativePushDeepLinks(authLoading: boolean, userId: string | undefined) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isCapacitorNativeShell()) return;
    ensurePushDeepLinkListenersAttached();
  }, []);

  useEffect(() => {
    setPushDeepLinkNavigationHandler((path) => applyPushDeepLinkPath(path, setLocation));
    return () => setPushDeepLinkNavigationHandler(null);
  }, [setLocation]);

  useEffect(() => {
    const ready = !authLoading && Boolean(userId);
    setPushDeepLinkNavigationReady(ready);
    return () => setPushDeepLinkNavigationReady(false);
  }, [authLoading, userId]);
}

/** Mirrors signed-in shell (backdrop, top bar, content, bottom nav) while auth/session resolves. */
function SessionLoadingSkeleton() {
  const navTabCount = 4;

  return (
    <div
      className="relative flex min-h-dvh w-full min-w-0 flex-col app-canvas text-foreground"
      aria-busy="true"
      aria-label="Loading app"
    >
      <AppShellBackdrop tone="rich" />
      <header className="surface-chrome relative z-[1] sticky top-0 flex min-h-14 items-center border-b border-border/40 px-4 pt-[env(safe-area-inset-top)] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <div className="relative flex w-full min-w-0 items-center">
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full skeleton-shimmer" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md skeleton-shimmer" />
          </div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full skeleton-shimmer" />
            <Skeleton className="h-5 w-24 max-w-[40vw] rounded-md skeleton-shimmer" />
          </div>
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full skeleton-shimmer" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-full skeleton-shimmer" />
          </div>
        </div>
      </header>
      <main
        id="app-scroll-main"
        className="relative z-[1] min-h-0 w-full min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-4 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] sm:space-y-4 md:p-6"
        style={{
          paddingBottom: MAIN_BOTTOM_SCROLL_PADDING,
          scrollPaddingBottom: MAIN_BOTTOM_SCROLL_PADDING,
        }}
      >
        <Skeleton className="h-36 w-full rounded-2xl skeleton-shimmer" />
        <Skeleton className="h-11 w-full rounded-2xl skeleton-shimmer" />
        <Skeleton className="h-11 w-full rounded-2xl skeleton-shimmer" />
        <Skeleton className="h-40 w-full rounded-2xl skeleton-shimmer" />
        <Skeleton className="h-32 w-full rounded-2xl skeleton-shimmer" />
      </main>
      <nav
        className="bottom-nav-vt surface-chrome pointer-events-none fixed bottom-[var(--keyboard-inset-bottom,0px)] inset-x-0 z-[100] grid place-items-center border-t border-border/35 px-1 pb-[env(safe-area-inset-bottom)] pt-2 [padding-left:max(0.25rem,env(safe-area-inset-left))] [padding-right:max(0.25rem,env(safe-area-inset-right))]"
        style={{ gridTemplateColumns: `repeat(${navTabCount}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {Array.from({ length: navTabCount }, (_, i) => (
          <div key={i} className="flex min-h-11 w-full min-w-0 flex-col items-center justify-center gap-1 py-2">
            <Skeleton className="h-6 w-6 rounded-lg skeleton-shimmer" />
            <Skeleton className="h-2.5 w-10 max-w-full rounded skeleton-shimmer" />
          </div>
        ))}
      </nav>
    </div>
  );
}

/**
 * Protects the main app layout: redirects to /login when not authenticated.
 * Unverified users are sent to /check-email except on `/account`, where they can resend verification.
 * `/account` uses `AuthenticatedShell` with a slimmer inner shell (no bottom nav) until verified.
 */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { loading: linkedPatientLoading, isFetched: linkedPatientFetched } = useLinkedPatient();
  const [pathname, setLocation] = useLocation();
  const search = useSearch();
  const pathOnly = (pathname || "/").split("?")[0] ?? pathname;

  useEffect(() => {
    if (!loading && !user) {
      const next = getSafeNext(pathname, search);
      setLocation(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!loading && user && !isUserVerified(user)) {
      if (pathOnly === "/account") {
        return;
      }
      const next = getSafeNext(pathname, search);
      try {
        sessionStorage.setItem("diabeater_post_verify_next", next);
      } catch {
        // ignore
      }
      setLocation(`/check-email?message=${encodeURIComponent("Please verify your email to continue.")}`);
    }
  }, [loading, user, pathname, search, setLocation, pathOnly]);

  const mayNeedCarerLinkGate =
    hasCarerIntent() ||
    hasPendingCarer() ||
    getPrimaryAppRole() === "carer" ||
    isSupporterOnlyAccount() ||
    getActiveAppMode() === "carer";

  const waitingOnCarerLink =
    isOnline() && mayNeedCarerLinkGate && linkedPatientLoading && !linkedPatientFetched;

  if (loading || waitingOnCarerLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-muted-foreground">
          Checking session...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isUserVerified(user)) {
    if (pathOnly === "/account") {
      return <>{children}</>;
    }
    return null;
  }

  return <>{children}</>;
}

function bypassesOnboardingGate(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  const prefixes = [
    "/_shots",
    "/privacy",
    "/support",
    "/welcome",
    "/login",
    "/signup",
    "/carer-setup",
    "/auth/callback",
    "/auth/confirm",
    "/auth/email-verify",
    "/verified-success",
    "/verified-return",
    "/reset-request",
    "/reset-password",
    "/check-email",
  ];
  return prefixes.some((x) => p === x || p.startsWith(`${x}/`));
}

/** Community routes work in Supporter Mode (signed-in user’s own profile/DMs). */
function isCommunityPath(pathOnly: string): boolean {
  const p = (pathOnly || "/").split("?")[0] ?? "/";
  return p === "/community" || p.startsWith("/community/");
}

/** /coach is allowed in Supporter Mode (with `?audience=supporter` for prompt fork). */
function isCoachPath(pathOnly: string): boolean {
  const p = (pathOnly || "/").split("?")[0] ?? "/";
  return p === "/coach";
}

/** Community Member session: learn, feed, coach, account; no clinical tools. */
function isCommunityMemberAllowedPath(pathOnly: string): boolean {
  const p = (pathOnly || "/").split("?")[0] ?? "/";
  if (p === "/") return true;
  if (p === "/tools" || p.startsWith("/tools/")) return true;
  if (p === "/education" || p.startsWith("/education/")) return true;
  if (p === "/coach") return true;
  if (p === "/notifications") return true;
  if (p === "/account") return true;
  if (p === "/settings") return true;
  if (p === "/settings/appearance") return true;
  if (p === "/settings/notifications") return true;
  if (p === "/settings/about") return true;
  if (p === "/settings/feedback") return true;
  if (p === "/privacy" || p === "/support") return true;
  if (p === "/community/setup") return true;
  if (isCommunityPath(p)) return true;
  return false;
}

function resolveCommunityMode(
  hasCarerLink: boolean,
  activeMode: ReturnType<typeof getActiveAppMode>,
): boolean {
  return isCommunitySessionMode(hasCarerLink, activeMode, {
    localCommunityProfile: isCommunityAccountProfile(storage.getProfile()),
  });
}

function PatientRouteGuard({ children }: { children: React.ReactNode }) {
  const isOffline = useOffline();
  const { user } = useAuth();
  const { isCarer: hasCarerLink, loading } = useLinkedCarer();
  const [location, setLocation] = useLocation();
  const pathOnly = location.split("?")[0] ?? location;
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = isCarerSessionMode(hasCarerLink, activeMode);
  const isCommunityMode = resolveCommunityMode(hasCarerLink, activeMode);

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (isCommunityMode) {
      if (pathOnly === "/" || pathOnly === "") {
        void resolveCommunityMemberLandingPath(user?.id).then((dest) => {
          setLocation(dest);
        });
        return;
      }
      if (!isCommunityMemberAllowedPath(pathOnly)) {
        void resolveCommunityMemberLandingPath(user?.id).then((dest) => {
          setLocation(dest);
        });
        return;
      }
    }
    if (isCarerMode && !isCommunityPath(pathOnly) && !isCoachPath(pathOnly)) {
      setLocation("/carer-view");
      return;
    }
    if (!isCarerMode && !isCommunityMode && (hasCarerIntent() || hasPendingCarer())) {
      setLocation("/carer-setup");
    }
  }, [loading, isCarerMode, isCommunityMode, pathOnly, setLocation, user?.id]);

  if (loading && !isOffline) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading…</div>
    );
  }
  if (isCommunityMode && !isCommunityMemberAllowedPath(pathOnly)) return null;
  if (isCarerMode && !isCommunityPath(pathOnly) && !isCoachPath(pathOnly)) return null;
  if (!isCommunityMode && (hasCarerIntent() || hasPendingCarer())) return null;
  return <>{children}</>;
}

function isCarerAllowedPath(pathOnly: string): boolean {
  const p = (pathOnly || "/").split("?")[0] ?? "/";
  if (p === "/carer-view" || p.startsWith("/carer-view/")) return true;
  if (p === "/tools" || p.startsWith("/tools/")) return true;
  if (p === "/education" || p.startsWith("/education/")) return true;
  if (p === "/coach") return true;
  if (p === "/notifications") return true;
  if (p === "/account") return true;
  if (p === "/settings") return true;
  if (p === "/settings/appearance") return true;
  if (p === "/settings/notifications") return true;
  if (p === "/settings/about") return true;
  if (p === "/settings/feedback") return true;
  if (p === "/settings/emergency") return true;
  if (p === "/privacy" || p === "/support") return true;
  if (isCommunityPath(p)) return true;
  return false;
}

/** Allows linked carers and patients; redirects pending carer signup to /carer-setup. */
function CarerSetupIntentGuard({ children }: { children: React.ReactNode }) {
  const { data: linkedPatient, loading } = useLinkedPatient();
  const [, setLocation] = useLocation();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const isCarerMode = Boolean(linkedPatient);
  const isCommunityMode = resolveCommunityMode(hasCarerLink, activeMode);

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isCarerMode && !isCommunityMode && (hasCarerIntent() || hasPendingCarer())) {
      setLocation("/carer-setup");
    }
  }, [loading, isCarerMode, isCommunityMode, setLocation]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading…</div>
    );
  }
  if (!isCarerMode && !isCommunityMode && (hasCarerIntent() || hasPendingCarer())) return null;
  return <>{children}</>;
}

function FamilyCarersGate() {
  const { isCarer: hasCarerLink, loading } = useLinkedCarer();
  const [, setLocation] = useLocation();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = isCarerSessionMode(hasCarerLink, activeMode);
  const isCommunityMode = resolveCommunityMode(hasCarerLink, activeMode);

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (isCommunityMode) {
      setLocation(getCommunityMemberLandingPath());
      return;
    }
    if (isCarerMode) {
      setLocation("/carer-view");
      return;
    }
    if (hasCarerIntent() || hasPendingCarer()) {
      setLocation("/carer-setup");
    }
  }, [loading, isCarerMode, isCommunityMode, setLocation]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading…</div>
    );
  }
  if (isCommunityMode || isCarerMode || hasCarerIntent() || hasPendingCarer()) return null;
  return (
    <Suspense fallback={<RouteFallback />}>
      <FamilyCarers />
    </Suspense>
  );
}

/**
 * Authenticated shell — wouter <Switch> inside ProtectedLayout (same branch as Dashboard).
 * Single app-level <Router> is in main.tsx (wouter; not react-router BrowserRouter).
 * NotFound * last.
 */
function InnerRouter() {
  return (
    <Switch>
      <Route path="/mode">
        <Suspense fallback={<RouteFallback />}>
          <ModeChooser />
        </Suspense>
      </Route>
      <Route path="/carer-view/activity">
        <Suspense fallback={<RouteFallback />}>
          <CarerActivityLogPage />
        </Suspense>
      </Route>
      <Route path="/carer-view/glucose">
        <Suspense fallback={<RouteFallback />}>
          <CarerLiveGlucosePage />
        </Suspense>
      </Route>
      <Route path="/carer-view/:section">
        <Suspense fallback={<RouteFallback />}>
          <CarerView />
        </Suspense>
      </Route>
      <Route path="/carer-view">
        <Suspense fallback={<RouteFallback />}>
          <CarerView />
        </Suspense>
      </Route>
      <Route path="/supporter-profile">
        <Redirect to="/account" replace />
      </Route>
      <Route path="/account">
        <Suspense fallback={<RouteFallback />}>
          <Account />
        </Suspense>
      </Route>
      <Route path="/family-carers" component={FamilyCarersGate} />
      <Route path="/notifications">
        <Suspense fallback={<RouteFallback />}>
          <NotificationsPage />
        </Suspense>
      </Route>
      <Route path="/community/messages/:threadId">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <Suspense fallback={<RouteFallback />}>
              <CommunityThread />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/messages">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <Suspense fallback={<RouteFallback />}>
              <CommunityMessages />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/settings">
        <Redirect to="/community/setup" replace />
      </Route>
      <Route path="/community/setup">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <Suspense fallback={<RouteFallback />}>
              <CommunitySetup />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/u/:handle">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <Suspense fallback={<RouteFallback />}>
              <CommunityHandleResolve />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/profile/:userId">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <Suspense fallback={<RouteFallback />}>
              <CommunityProfile />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/post/:postId">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <Suspense fallback={<RouteFallback />}>
              <CommunityPost />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <Suspense fallback={<RouteFallback />}>
              <CommunityHome />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/medical-sources">
        <PatientRouteGuard>
          <MedicalSourcesPage />
        </PatientRouteGuard>
      </Route>
      <Route path="/">
        <PatientRouteGuard>
          <Dashboard />
        </PatientRouteGuard>
      </Route>
      <Route path="/supplies">
        <PatientRouteGuard>
          <Supplies />
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/exercise">
        <PatientRouteGuard>
          <ScenarioExercisePage />
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/bedtime">
        <PatientRouteGuard>
          <Bedtime />
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/sick-day">
        <PatientRouteGuard>
          <SickDay />
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/travel">
        <PatientRouteGuard>
          <Travel />
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/alcohol">
        <PatientRouteGuard>
          <AlcoholScenarioPage />
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/driving">
        <PatientRouteGuard>
          <DrivingScenarioPage />
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/pump-failure">
        <PatientRouteGuard>
          <PumpFailurePage />
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios">
        <PatientRouteGuard>
          <Scenarios />
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/hypo-help">
        <Suspense fallback={<RouteFallback />}>
          <HypoHelpPage />
        </Suspense>
      </Route>
      <Route path="/tools/glucose-converter">
        <Suspense fallback={<RouteFallback />}>
          <GlucoseConverterPage />
        </Suspense>
      </Route>
      <Route path="/tools/hypo-history">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <HypoHistoryPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/patterns">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <PatternsPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/activity">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <ActivityLogPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/achievements">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <AchievementsPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/routines">
        <PatientRouteGuard>
          <Redirect to="/routines" replace />
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/cgm-live">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <CgmLivePage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/correction">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <CorrectionHelpPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/tips">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <TipsPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/education">
        <Redirect to="/education" replace />
      </Route>
      {isAiCoachEnabled ? (
        <Route path="/coach">
          <PatientRouteGuard>
            <Suspense fallback={<RouteFallback />}>
              <CoachPage />
            </Suspense>
          </PatientRouteGuard>
        </Route>
      ) : null}
      <Route path="/education/:slug">
        <Suspense fallback={<RouteFallback />}>
          <GlossaryDetail />
        </Suspense>
      </Route>
      <Route path="/education">
        <Suspense fallback={<RouteFallback />}>
          <GlossaryIndex />
        </Suspense>
      </Route>
      <Route path="/tools">
        <ToolsPage />
      </Route>
      <Route path="/adviser">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <Adviser />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/verified-success">
        <Suspense fallback={<RouteFallback />}>
          <VerifiedSuccess />
        </Suspense>
      </Route>
      <Route path="/appointments">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <Appointments />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/emergency-card">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <EmergencyCard />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/settings/about">
        <Suspense fallback={<RouteFallback />}>
          <SettingsPage />
        </Suspense>
      </Route>
      <Route path="/settings/feedback">
        <Suspense fallback={<RouteFallback />}>
          <SettingsPage />
        </Suspense>
      </Route>
      <Route path="/settings/emergency">
        <Suspense fallback={<RouteFallback />}>
          <SettingsEmergencyPage />
        </Suspense>
      </Route>
      <Route path="/settings/pharmacy">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <SettingsPharmacyPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/settings/carb-sources">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <SettingsCarbSourcesPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/settings/notifications">
        <Suspense fallback={<RouteFallback />}>
          <SettingsPage />
        </Suspense>
      </Route>
      <Route path="/settings/cgm">
        <Suspense fallback={<RouteFallback />}>
          <SettingsPage />
        </Suspense>
      </Route>
      <Route path="/settings/appearance">
        <Suspense fallback={<RouteFallback />}>
          <SettingsPage />
        </Suspense>
      </Route>
      <Route path="/settings/ratios">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <SettingsPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/settings/usage">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <SettingsPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/settings/account">
        <Redirect to="/account" replace />
      </Route>
      <Route path="/settings">
        <Suspense fallback={<RouteFallback />}>
          <SettingsPage />
        </Suspense>
      </Route>
      <Route path="/help-now">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <HelpNow />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/ratios">
        <Redirect to="/settings/ratios" replace />
      </Route>
      <Route path="/routines">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <Routines />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="*" component={NotFound} />
    </Switch>
  );
}

function useNativeLocalNotificationPermissionPrompt(visible: boolean) {
  const { toast } = useToast();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (!supportsNativeLocalNotifications()) return;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem("diabeater_native_local_notif_prompt_dismissed_v1") === "true";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;

    let cancelled = false;
    void (async () => {
      try {
        // Prefer checkPermissions so we don't trigger a system prompt just by opening the app.
        const perm = await (LocalNotifications as any).checkPermissions?.();
        if (cancelled) return;
        if (perm?.display === "granted") {
          try {
            localStorage.setItem("diabeater_native_local_notif_prompt_dismissed_v1", "true");
          } catch {
            // ignore
          }
          setShow(false);
          return;
        }
      } catch {
        // ignore
      }
      if (!cancelled) setShow(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const dismiss = () => {
    try {
      localStorage.setItem("diabeater_native_local_notif_prompt_dismissed_v1", "true");
    } catch {
      // ignore
    }
    setShow(false);
  };

  const enable = async () => {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === "granted") {
        toast({ title: "Notifications enabled", description: "You’ll now get reminder pop-ups and lock-screen alerts." });
        dismiss();
      } else {
        toast({
          title: "Notifications not enabled",
          description: "You can enable them later in your phone's Settings → Apps → Diabeaters → Notifications.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Could not request notifications",
        description: "Try again later, or enable in your phone's notification settings for Diabeaters.",
        variant: "destructive",
      });
    }
  };

  return { show, dismiss, enable };
}

/**
 * Mount children after first paint + idle so startup pollers do not compete with route content.
 */
function DeferredAfterFirstPaint({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idleId = 0;
    let timeoutId = 0;
    const run = () => setReady(true);
    const raf = window.requestAnimationFrame(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(run, { timeout: 2500 });
      } else {
        timeoutId = window.setTimeout(run, 800);
      }
    });
    return () => {
      window.cancelAnimationFrame(raf);
      if (idleId) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

/**
 * Minimal chrome for signed-in but unverified users on `/account` only (resend verification, profile basics).
 * Omits offline banner, status strip, supply/low-stock pollers, iOS notification upsell, and BottomNav
 * (other tabs would redirect unverified users to check-email).
 */
function UnverifiedAccountShell({
  isCarerMode,
  isCommunityMode,
  suppressClinicalPollers,
  onBrandClick,
  onLogout,
}: {
  isCarerMode: boolean;
  isCommunityMode: boolean;
  suppressClinicalPollers: boolean;
  onBrandClick: () => void;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <div className="relative flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden app-canvas text-foreground">
      <ClinicalPrefsCloudSync />
      <SickDayCloudRepairSync />
      {!suppressClinicalPollers ? <SickDayMedDuePoller /> : null}
      {!suppressClinicalPollers ? <AlcoholReminderPoller /> : null}
      {!suppressClinicalPollers ? <PumpFailureReminderPoller /> : null}
      {!suppressClinicalPollers ? <ExerciseCgmAlertPoller /> : null}
      {!suppressClinicalPollers ? <ExerciseCgmServerMonitorSync /> : null}
      <AppShellBackdrop tone="rich" />
      <AppTopBar
        isCarer={isCarerMode}
        isCommunityMode={isCommunityMode}
        pathOnly="/account"
        onBrandClick={onBrandClick}
        onLogout={onLogout}
      />
      <main
        id="app-scroll-main"
        className="relative z-[1] min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:p-6 [-webkit-overflow-scrolling:touch]"
        style={{
          paddingBottom: MAIN_BOTTOM_SCROLL_PADDING_NO_NAV,
          scrollPaddingBottom: MAIN_BOTTOM_SCROLL_PADDING_NO_NAV,
        }}
      >
        <Suspense fallback={<RouteFallback />}>
          <Account />
        </Suspense>
      </main>
    </div>
  );
}

function AuthenticatedShell() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const pathOnly = location.split("?")[0] ?? location;
  const isDmThreadView = /^\/community\/messages\/[^/]+$/.test(pathOnly);
  const isCoachChatView = pathOnly === "/coach";
  const isFillHeightChatView = isDmThreadView || isCoachChatView;
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = isCarerSessionMode(hasCarerLink, activeMode);
  const isCommunityMode = resolveCommunityMode(hasCarerLink, activeMode);
  const suppressClinicalPollers = isCarerMode || isCommunityMode;
  const iosNotifPrompt = useNativeLocalNotificationPermissionPrompt(!suppressClinicalPollers);
  const { bedtimeReminderPromptOpen, setBedtimeReminderPromptOpen } =
    useBedtimeReminderPromptAfterOnboarding(!suppressClinicalPollers);

  const handleLogout = async () => {
    clearCarerClientSessionKeys();
    await logout();
    setLocation("/welcome");
  };

  const goBrandHome = () => {
    if (isCarerMode) {
      if (location.split("?")[0] !== "/carer-view") setLocation("/carer-view");
      return;
    }
    if (isCommunityMode) {
      const home = getCommunityMemberLandingPath(profile ?? null);
      const homePath = home.split("#")[0] ?? home;
      if (location.split("?")[0] !== homePath) setLocation(home);
      return;
    }
    if (location.split("?")[0] !== "/") setLocation("/");
  };

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | "community" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    if (suppressClinicalPollers) {
      void cancelAllBedtimeReminders();
      return;
    }
    void rescheduleBedtimeReminders({
      hasCarerLink,
      cloudCommunityProfile: profile?.account_type === "community",
    });
  }, [suppressClinicalPollers, hasCarerLink, activeMode, profile?.account_type]);

  useEffect(() => {
    if (suppressClinicalPollers) return;
    if (!Capacitor.isNativePlatform?.() || Capacitor.getPlatform?.() !== "ios") return;
    void import("@/lib/ios-system-notifications").then((m) => {
      void m.cancelLegacyHelpfulCheckInNotification();
    });
  }, [suppressClinicalPollers]);

  useEffect(() => {
    if (!hasCarerLink) return;
    if (isSupporterOnlyAccount() && getActiveAppMode() !== "carer") {
      setActiveAppMode("carer");
    }
  }, [hasCarerLink]);

  useEffect(() => {
    if (!user?.id || !hasCarerLink) return;
    void import("@/lib/welcome-path-dual-role-reconcile").then((m) =>
      m.repairMisclassifiedDualRolePatientOnSession(user.id!),
    );
  }, [user?.id, hasCarerLink]);

  useEffect(() => {
    if (hasCarerLink) return;
    if (isCommunityOnlyAccount() && getActiveAppMode() !== "community") {
      setActiveAppMode("community");
    }
  }, [hasCarerLink]);

  useEffect(() => {
    if (!hasCarerLink) return;
    if (activeMode != null) return;
    if (pathOnly === "/mode") return;
    if (isSupporterOnlyAccount() || getPrimaryAppRole() === "carer") {
      setActiveAppMode("carer");
    } else {
      setActiveAppMode("patient");
    }
  }, [hasCarerLink, activeMode, pathOnly]);

  useEffect(() => {
    if (hasCarerLink) return;
    if (activeMode != null) return;
    if (pathOnly === "/mode") return;
    if (
      isCommunityOnlyAccount() ||
      getPrimaryAppRole() === "community" ||
      isCommunityAccountProfile(storage.getProfile())
    ) {
      setActiveAppMode("community");
    }
  }, [hasCarerLink, activeMode, pathOnly]);

  useEffect(() => {
    if (!hasCarerLink) return;
    if (pathOnly === "/mode" && isSupporterOnlyAccount()) {
      setLocation("/carer-view");
      return;
    }
    if (isCarerMode) {
      if (!isCarerAllowedPath(pathOnly) && pathOnly !== "/mode") setLocation("/carer-view");
      return;
    }
    if (!activeMode) return;
    if (pathOnly === "/carer-view" || pathOnly.startsWith("/carer-view/")) {
      setLocation("/");
    }
  }, [hasCarerLink, activeMode, isCarerMode, pathOnly, setLocation]);

  useEffect(() => {
    if (!isCommunityMode) return;
    let cancelled = false;
    const goHome = () => {
      void resolveCommunityMemberLandingPath(user?.id).then((dest) => {
        if (!cancelled) setLocation(dest);
      });
    };
    if (pathOnly === "/mode" && isCommunityOnlyAccount()) {
      goHome();
      return () => {
        cancelled = true;
      };
    }
    if (pathOnly === "/" || pathOnly === "") {
      goHome();
      return () => {
        cancelled = true;
      };
    }
    if (!isCommunityMemberAllowedPath(pathOnly) && pathOnly !== "/mode") {
      goHome();
      return () => {
        cancelled = true;
      };
    }
    return () => {
      cancelled = true;
    };
  }, [isCommunityMode, pathOnly, setLocation, user?.id]);

  useEffect(() => {
    const onSupplySyncToast = (ev: Event) => {
      const ce = ev as CustomEvent<{ kind?: string }>;
      const kind = ce.detail?.kind;
      if (kind === "queued") {
        toast(OFFLINE_SUPPLY_QUEUED_TOAST);
        return;
      }
      if (kind === "retry") {
        toast(OFFLINE_SUPPLY_RETRY_TOAST);
      }
    };
    window.addEventListener("diabeater:supply-sync-toast", onSupplySyncToast);
    return () => window.removeEventListener("diabeater:supply-sync-toast", onSupplySyncToast);
  }, [toast]);

  useEffect(() => {
    const flush = async () => {
      const { supplies } = await reconcileAfterBackOnline();
      for (const item of offlineReconcileToasts(supplies)) {
        toast(item);
      }
    };

    let idleId = 0;
    let timeoutId = 0;
    const run = () => void flush();
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(run, { timeout: 3000 });
      } else {
        timeoutId = window.setTimeout(run, 1200);
      }
    };
    schedule();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      if (idleId) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("online", onOnline);
    };
  }, [toast]);

  const slimUnverifiedAccount = Boolean(user && !isUserVerified(user) && pathOnly === "/account");

  return (
    <AskAnythingProvider defaultAudience={isCarerMode ? "supporter" : "patient"}>
      {slimUnverifiedAccount ? (
        <UnverifiedAccountShell
          isCarerMode={isCarerMode}
          isCommunityMode={isCommunityMode}
          suppressClinicalPollers={suppressClinicalPollers}
          onBrandClick={goBrandHome}
          onLogout={handleLogout}
        />
      ) : (
    // Always pin the shell to the viewport and scroll only inside `#app-scroll-main`.
    // Android Capacitor WebViews (especially with remote `server.url`) do not scroll the
    // document reliably when the shell grows with `min-h-screen` — content becomes stuck.
    <div className="relative flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden app-canvas text-foreground">
      <NativePushForegroundSync />
      <NativeNavBackHandler pathname={pathOnly} setLocation={setLocation} />
      <NativeOsSurfacesSync />
      <AchievementSync />
      <DmInboxQuerySync />
      <ClinicalPrefsCloudSync />
      <SickDayCloudRepairSync />
      <DeferredAfterFirstPaint>
        {!suppressClinicalPollers ? <SickDayMedDuePoller /> : null}
        {!suppressClinicalPollers ? (
          <>
            <AppointmentReminderPoller />
            <BedtimeReminderPoller />
            <PumpChangeReminderPoller />
            <SupplyLowNotifyPoller />
          </>
        ) : null}
        {!suppressClinicalPollers ? <AlcoholReminderPoller /> : null}
        {!suppressClinicalPollers ? <PumpFailureReminderPoller /> : null}
        {!suppressClinicalPollers ? <ExerciseCgmAlertPoller /> : null}
      {!suppressClinicalPollers ? <ExerciseCgmServerMonitorSync /> : null}
      </DeferredAfterFirstPaint>
      <AppShellBackdrop tone="rich" />
      <AppTopBar
        isCarer={isCarerMode}
        isCommunityMode={isCommunityMode}
        pathOnly={location.split("?")[0] ?? location}
        onBrandClick={goBrandHome}
        onLogout={handleLogout}
      />
      {isDmThreadView ? <DmThreadSubheader /> : null}
      {!suppressClinicalPollers && !isDmThreadView && iosNotifPrompt.show ? (
        <div className="relative z-40 -mt-1 mb-2 px-4 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:px-6">
          <Alert className="border-border/60 bg-background/55 backdrop-blur">
            <AlertDescription className="text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-foreground/90">
                Enable notifications to get medication and safety reminders as iPhone pop‑ups and on your lock screen.
              </span>
              <span className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void iosNotifPrompt.enable()}>
                  Enable
                </Button>
                <Button size="sm" variant="outline" onClick={iosNotifPrompt.dismiss}>
                  Not now
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {(!suppressClinicalPollers || isCarerMode) && !isDmThreadView ? (
        <div className="relative z-40 mx-auto w-full max-w-3xl px-4 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:max-w-4xl md:px-6">
          <AppStatusStrip />
        </div>
      ) : null}
      <main
        id="app-scroll-main"
        className={cn(
          "relative z-[1] min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]",
          isFillHeightChatView
            ? "flex flex-col overflow-hidden p-0 md:p-0"
            : "overflow-y-auto px-4 pb-4 pt-1.5 md:px-6 md:pb-6 md:pt-2",
        )}
        style={{
          paddingBottom: isFillHeightChatView ? 0 : MAIN_BOTTOM_SCROLL_PADDING,
          scrollPaddingBottom: isFillHeightChatView ? 0 : MAIN_BOTTOM_SCROLL_PADDING,
        }}
      >
        <AnimatedRouteOutlet fillHeight={isFillHeightChatView}>
          <InnerRouter />
        </AnimatedRouteOutlet>
      </main>
      {!isDmThreadView ? <BottomNav /> : null}
      {!suppressClinicalPollers ? (
        <BedtimeReminderPromptDialog
          open={bedtimeReminderPromptOpen}
          onOpenChange={setBedtimeReminderPromptOpen}
          variant="onboarding"
        />
      ) : null}
      {!suppressClinicalPollers ? <HypoCheckInRespondHost /> : null}
      {!suppressClinicalPollers ? <ExerciseModeOverlay /> : null}
    </div>
      )}
    </AskAnythingProvider>
  );
}

/**
 * Top-level shell (auth, public pages). The catch-all branches by auth state:
 * signed-in users land in the protected app shell; signed-out users see the
 * public `NotFound` page directly rather than being silently redirected to
 * `/login`. Legitimate authenticated routes (`/`, `/dashboard`, `/tools`, …)
 * still resolve through `InnerRouter` once the protected layout mounts.
 */
function RootCatchAll() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-muted-foreground">Checking session…</div>
      </div>
    );
  }
  if (!user) {
    return <NotFound />;
  }
  return (
    <ProtectedLayout>
      <AuthenticatedShell />
    </ProtectedLayout>
  );
}

function MainRouter() {
  return (
    <Switch>
      <Route path="/welcome">
        <Suspense fallback={<RouteFallback />}>
          <Welcome />
        </Suspense>
      </Route>
      <Route path="/login">
        <Suspense fallback={<RouteFallback />}>
          <Login />
        </Suspense>
      </Route>
      <Route path="/signup">
        <Suspense fallback={<RouteFallback />}>
          <Signup />
        </Suspense>
      </Route>
      <Route path="/auth/callback">
        <Suspense fallback={<RouteFallback />}>
          <AuthCallback />
        </Suspense>
      </Route>
      <Route path="/auth/confirm">
        <Suspense fallback={<RouteFallback />}>
          <AuthConfirm />
        </Suspense>
      </Route>
      <Route path="/auth/email-verify">
        <Suspense fallback={<RouteFallback />}>
          <EmailVerify />
        </Suspense>
      </Route>
      <Route path="/verified-return">
        <Suspense fallback={<RouteFallback />}>
          <VerifiedReturn />
        </Suspense>
      </Route>
      <Route path="/reset-request">
        <Suspense fallback={<RouteFallback />}>
          <ResetRequest />
        </Suspense>
      </Route>
      <Route path="/reset-password">
        <Suspense fallback={<RouteFallback />}>
          <ResetPassword />
        </Suspense>
      </Route>
      <Route path="/check-email">
        <Suspense fallback={<RouteFallback />}>
          <CheckEmail />
        </Suspense>
      </Route>
      <Route path="/carer-setup">
        <Suspense fallback={<RouteFallback />}>
          <CarerSetup />
        </Suspense>
      </Route>
      <Route path="/privacy" component={Privacy} />
      <Route path="/support" component={Support} />
      <Route path="*">
        <RootCatchAll />
      </Route>
    </Switch>
  );
}

function AppContent() {
  useNativeDeepLinks();
  useNativeLocalNotificationDeepLinks();
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  useNativePushDeepLinks(authLoading, user?.id);
  const queryClient = useQueryClient();
  const userId = user?.id;
  const linkQuery = useLinkedPatientQuery();
  const isOffline = useOffline();
  const online = !isOffline;
  const pathOnly = location.split("?")[0] ?? location;

  const carerPendingBlocksOnboarding =
    Boolean(userId) &&
    getPrimaryAppRole() !== "community" &&
    (hasCarerIntent() || hasPendingCarer());

  const skipProfileForGate = Boolean(linkQuery.data) || carerPendingBlocksOnboarding;
  const skipLinkForGate =
    !carerPendingBlocksOnboarding &&
    getPrimaryAppRole() !== "carer" &&
    !isSupporterOnlyAccount() &&
    getActiveAppMode() !== "carer";

  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { profile } = await getProfile(userId);
      return profile;
    },
    // Start as soon as we have a user id (parallel with carer link lookup — gate still waits when needed).
    enabled: Boolean(userId) && !authLoading && !skipProfileForGate,
    staleTime: 30_000,
    retry: false,
  });

  const linkedCarer = Boolean(linkQuery.data);

  const patientOnboardingSatisfied = useMemo(
    () =>
      isPatientOnboardingSatisfied({
        userId,
        linkedCarer,
        carerPendingBlocksOnboarding,
        profileQueryFetched: profileQuery.isFetched,
        onboardingCompleteFromDb: profileQuery.data?.onboarding_complete === true,
        onboardingCompleteFromLocalStorage: readOnboardingCompleteFromLocalStorage(),
        online,
        isCommunityMemberAccount: resolvesAsCommunityMemberAccount({
          profile: profileQuery.data ?? null,
          linkedCarer,
          primaryAppRole: getPrimaryAppRole(),
          metadataAccountPath: onboardingAccountPathFromUserMetadata(user),
        }),
      }),
    [
      userId,
      linkedCarer,
      carerPendingBlocksOnboarding,
      profileQuery.data,
      profileQuery.isFetched,
      online,
      user,
    ],
  );

  const appGateReady = useMemo(
    () =>
      resolveAppGateReady({
        authLoading,
        userId,
        online,
        linkQueryFetched: linkQuery.isFetched,
        profileQueryFetched: profileQuery.isFetched,
        skipProfileForGate,
        skipLinkForGate,
      }),
    [
      authLoading,
      userId,
      online,
      linkQuery.isFetched,
      profileQuery.isFetched,
      skipProfileForGate,
      skipLinkForGate,
    ],
  );

  useEffect(() => {
    if (authLoading) return;
    if (user?.id) return;
    if (pathOnly !== "/" && pathOnly !== "") return;
    setLocation("/welcome");
  }, [authLoading, user?.id, pathOnly, setLocation]);

  useEffect(() => {
    if (!userId) return;
    scheduleDemoRoutePrefetch();
  }, [userId]);

  useEffect(() => {
    if (!appGateReady || !userId || !isOnline()) return;
    const onCommunityPath = pathOnly === "/community" || pathOnly.startsWith("/community/");
    const isCommunityMember = isCommunityMemberSession({
      hasCarerLink: Boolean(linkQuery.data),
      cloudProfile: profileQuery.data ?? null,
    });
    if (!isCommunityMember && !onCommunityPath) return;
    scheduleCommunityWarmup(queryClient, userId, {
      prefetchFeedData: isCommunityMember || onCommunityPath,
    });
  }, [appGateReady, userId, pathOnly, linkQuery.data, profileQuery.data, queryClient]);

  useEffect(() => {
    const bumpLinkedCarer = () => {
      void invalidateLinkedPatientQuery(queryClient, userId);
    };
    window.addEventListener("diabeater:carer-link-updated", bumpLinkedCarer);
    return () => window.removeEventListener("diabeater:carer-link-updated", bumpLinkedCarer);
  }, [queryClient, userId]);

  const publicEntry = bypassesOnboardingGate(location);

  useEffect(() => {
    if (!appGateReady || authLoading) return;
    if (publicEntry) return;
    if (!user?.id) return;
    if (linkedCarer) return;
    if (getPrimaryAppRole() !== "community" && (hasCarerIntent() || hasPendingCarer())) return;
    if (patientOnboardingSatisfied) return;
    if (pathOnly === "/onboarding" || pathOnly === "/account") return;
    const role = getPrimaryAppRole();
    if (role === null) {
      if (pathOnly !== "/welcome") setLocation("/welcome");
      return;
    }
    setLocation("/onboarding");
  }, [
    appGateReady,
    authLoading,
    user?.id,
    linkedCarer,
    patientOnboardingSatisfied,
    pathOnly,
    publicEntry,
    location,
    setLocation,
  ]);

  if (location.startsWith("/_shots")) {
    return <ShotsPage />;
  }

  if (publicEntry || location === "/privacy" || location === "/support") {
    return (
      <div className={isStaging ? "pt-10" : ""}>
        <AppShellBackdrop tone="quiet" />
        <StagingBanner />
        <DevBanner />
        <MainRouter />
      </div>
    );
  }

  if (pathOnly === "/onboarding") {
    return (
      <PatientOnboardingGate
        onPatientComplete={() => {
          void queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
        }}
      />
    );
  }

  if (!appGateReady || authLoading) {
    return userId ? <SessionLoadingSkeleton /> : (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (
    user?.id &&
    !linkedCarer &&
    !carerPendingBlocksOnboarding &&
    !patientOnboardingSatisfied &&
    pathOnly !== "/onboarding" &&
    pathOnly !== "/account"
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-muted-foreground">Redirecting…</div>
      </div>
    );
  }

  return (
    <div className={isStaging ? "pt-10" : ""}>
      <StagingBanner />
      <DevBanner />
      <MainRouter />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (!import.meta.env.PROD || !shouldRegisterServiceWorker()) return;

    let reloadedForUpdate = false;
    const onControllerChange = () => {
      if (reloadedForUpdate || !isOnline()) return;
      reloadedForUpdate = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <AuthProvider>
              <PostLoginToast />
              <NativeAppBadgeSync />
              <EmergencyProfileProvider>
                {/*
                 * Mount once at the very top so the iOS keyboard helper covers
                 * public auth pages (`/login`, `/signup`, `/reset-request`,
                 * `/reset-password`, `/check-email`, `/welcome`) as well as the
                 * authenticated shells. Previously this was only inside the
                 * authed shells, which meant signup / login forms did not lift
                 * above the on-screen keyboard on iOS.
                 */}
                <KeyboardInsets />
                {import.meta.env.DEV ? <DevSupabaseDiagnostics /> : null}
                {import.meta.env.DEV ? <DevPerfDiagnostics /> : null}
                <AppContent />
              </EmergencyProfileProvider>
            </AuthProvider>
            <Toaster />
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
