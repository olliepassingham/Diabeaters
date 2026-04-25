// client/src/App.tsx
import { Suspense, lazy, useEffect, useState } from "react";
import { Switch, Route, useLocation, useSearch, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DevBanner } from "@/components/DevBanner";
import { DevSupabaseDiagnostics } from "@/components/DevSupabaseDiagnostics";
import { StagingBanner } from "@/components/StagingBanner";
import { isStaging } from "@/lib/flags";

import { BottomNav } from "@/components/bottom-nav";
import { Link } from "wouter";
import { AppTopBar } from "@/components/app-top-bar";
import { OfflineBanner } from "@/components/offline-banner";
import { AppStatusStrip } from "@/components/app-status-strip";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { KeyboardInsets } from "@/components/keyboard-insets";
import { AlcoholReminderPoller } from "@/components/alcohol-reminder-poller";
import { PumpFailureReminderPoller } from "@/components/pump-failure-reminder-poller";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import { ThemeProvider } from "@/hooks/use-theme";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { EmergencyProfileProvider } from "@/hooks/use-emergency-profile";
import { isUserVerified, logout } from "@/lib/auth";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import AuthCallback from "@/pages/auth-callback";
import ResetRequest from "@/pages/reset-request";
import ResetPassword from "@/pages/reset-password";
import CheckEmail from "@/pages/check-email";
import Dashboard from "@/pages/dashboard";
import VerifiedSuccess from "@/pages/verified-success";
import Welcome from "@/pages/welcome";
import VerifiedReturn from "@/pages/verified-return";
import FamilyCarers from "@/pages/family-carers";
import CarerView from "@/pages/carer-view";
import CarerSetup from "@/pages/carer-setup";
import ModeChooser from "@/pages/mode";
import NotificationsPage from "@/pages/notifications";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getLinkedPatientForCarer, useLinkedPatient } from "@/lib/carers";
import {
  clearCarerClientSessionKeys,
  getActiveAppMode,
  getPrimaryAppRole,
  hasCarerIntent,
  hasPendingCarer,
  setActiveAppMode,
} from "@/lib/carer-session";
import { AnimatedRouteOutlet } from "@/components/animated-route-outlet";
import { CommunityFeatureGate } from "@/components/community-feature-gate";
import { PatientOnboardingGate } from "@/components/patient-onboarding-gate";
import { ClinicalPrefsCloudSync } from "@/components/clinical-prefs-cloud-sync";
import { SickDayMedDuePoller } from "@/components/sick-day-med-due-poller";
import { getProfile } from "@/lib/profile";
import NotFound from "@/pages/not-found";
import ShotsPage from "@/pages/shots";
import Privacy from "@/pages/privacy";
import Support from "@/pages/support";
import MedicalSourcesPage from "@/pages/medical-sources";
const Account = lazy(() => import("@/pages/account"));
const CommunityHome = lazy(() => import("@/pages/community/index"));
const CommunityPost = lazy(() => import("@/pages/community/post"));
const CommunityMessages = lazy(() => import("@/pages/community/messages"));
const CommunityThread = lazy(() => import("@/pages/community/thread"));
const CommunityProfile = lazy(() => import("@/pages/community/profile"));
const CommunitySettings = lazy(() => import("@/pages/community/settings"));
const CommunityHandleResolve = lazy(() => import("@/pages/community/handle-resolve"));

const ToolsPage = lazy(() => import("@/pages/tools/index"));
const HypoHelpPage = lazy(() => import("@/pages/tools/hypo-help"));
const CorrectionHelpPage = lazy(() => import("@/pages/tools/correction-help"));
const TipsPage = lazy(() => import("@/pages/tools/tips"));
const GlossaryIndex = lazy(() => import("@/pages/education/index"));
const GlossaryDetail = lazy(() => import("@/pages/education/[slug]"));

const Supplies = lazy(() => import("@/pages/supplies"));
const Adviser = lazy(() => import("@/pages/adviser"));
const Ratios = lazy(() => import("@/pages/ratios"));
const Routines = lazy(() => import("@/pages/routines"));
const HelpNow = lazy(() => import("@/pages/help-now"));
const Appointments = lazy(() => import("@/pages/appointments"));
const EmergencyCard = lazy(() => import("@/pages/emergency-card"));

const Bedtime = lazy(() => import("@/pages/bedtime"));
const SickDay = lazy(() => import("@/pages/sick-day"));
const Travel = lazy(() => import("@/pages/travel"));

const SettingsPage = lazy(() => import("@/pages/settings"));
const SettingsEmergencyPage = lazy(() => import("@/pages/settings/emergency"));

const Scenarios = lazy(() => import("@/pages/scenarios"));
const ScenarioExercisePage = lazy(() => import("@/pages/scenarios/exercise"));
const AlcoholScenarioPage = lazy(() => import("@/pages/scenarios/alcohol"));
const DrivingScenarioPage = lazy(() => import("@/pages/scenarios/driving"));
const PumpFailurePage = lazy(() => import("@/pages/scenarios/pump-failure"));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
      Loading…
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
          (isQuiet ? "bg-primary/[0.09] dark:bg-primary/[0.12]" : "bg-primary/[0.14] dark:bg-primary/[0.18]")
        }
      />
      <div
        className={
          "absolute top-[38%] -left-[18%] h-[min(26rem,85vw)] w-[min(26rem,85vw)] rounded-full blur-3xl " +
          (isQuiet
            ? "bg-[hsl(210_70%_74%_/_0.10)] dark:bg-[hsl(280_40%_48%_/_0.11)]"
            : "bg-[hsl(210_70%_74%_/_0.16)] dark:bg-[hsl(280_40%_48%_/_0.14)]")
        }
      />
      <div
        className={
          "absolute bottom-[-10%] left-1/2 h-40 w-[min(140%,48rem)] -translate-x-1/2 rounded-[100%] bg-gradient-to-t to-transparent " +
          (isQuiet ? "from-primary/[0.06] dark:from-primary/[0.08]" : "from-primary/[0.09] dark:from-primary/[0.12]")
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

/** Map an opened URL (custom scheme or http(s)) to an in-app path for wouter. */
function pathFromOpenedAppUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const isHttp = url.protocol === "https:" || url.protocol === "http:";
    const nextPath = isHttp
      ? `${url.pathname}${url.search}${url.hash}`
      : `/${url.hostname || url.host || ""}${url.pathname || ""}${url.search}${url.hash}`.replace(/\/{2,}/g, "/");

    const safe = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
    return safe;
  } catch {
    return null;
  }
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
      (event: { notification?: { extra?: Record<string, unknown> } }) => {
        const extra = event?.notification?.extra ?? null;
        const raw = extra && typeof extra.deep_link === "string" ? extra.deep_link : "";
        const next = raw.trim();
        if (!next) return;
        if (!next.startsWith("/") || next.startsWith("//")) return;
        setLocation(next);
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

/** Mirrors signed-in shell (backdrop, top bar, content, bottom nav) while auth/session resolves. */
function SessionLoadingSkeleton() {
  return (
    <div
      className="relative flex min-h-screen w-full min-w-0 flex-col bg-background text-foreground"
      aria-busy="true"
      aria-label="Loading app"
    >
      <AppShellBackdrop tone="rich" />
      <header className="relative z-[1] border-b border-border/50 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4 md:px-6">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full skeleton-shimmer" />
          <Skeleton className="h-6 flex-1 rounded-md skeleton-shimmer sm:max-w-[12rem]" />
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-9 w-9 rounded-full skeleton-shimmer" />
            <Skeleton className="h-9 w-9 rounded-full skeleton-shimmer" />
          </div>
        </div>
      </header>
      <main
        className="relative z-[1] flex-1 space-y-4 overflow-x-hidden p-4 md:p-6"
        style={{ paddingBottom: "calc(var(--bottom-nav-height, 7.5rem) + 0.5rem)" }}
      >
        <Skeleton className="h-8 w-52 max-w-full rounded-lg skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-2xl skeleton-shimmer" />
          <Skeleton className="h-40 w-full rounded-2xl skeleton-shimmer" />
        </div>
        <Skeleton className="h-28 w-full rounded-2xl skeleton-shimmer" />
      </main>
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-background/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-2 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-end justify-between gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-10 shrink-0 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Protects the main app layout: redirects to /login when not authenticated, /check-email when not verified. */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { loading: linkedPatientLoading } = useLinkedPatient();
  const [pathname, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    if (!loading && !user) {
      const next = getSafeNext(pathname, search);
      setLocation(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!loading && user && !isUserVerified(user)) {
      const next = getSafeNext(pathname, search);
      try {
        sessionStorage.setItem("diabeater_post_verify_next", next);
      } catch {
        // ignore
      }
      setLocation(`/check-email?message=${encodeURIComponent("Please verify your email to continue.")}`);
    }
  }, [loading, user, pathname, search, setLocation]);

  if (loading || linkedPatientLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-muted-foreground">
          Checking session...
        </div>
      </div>
    );
  }

  if (!user || !isUserVerified(user)) {
    return null;
  }

  return <>{children}</>;
}

/** Requires user only (not verification). Used for /account so unverified users can resend verification. */
function AuthOnlyLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [pathname, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    if (!loading && !user) {
      const next = getSafeNext(pathname, search);
      setLocation(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, pathname, search, setLocation]);

  if (loading) {
    return <SessionLoadingSkeleton />;
  }

  if (!user) return null;

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

function PatientRouteGuard({ children }: { children: React.ReactNode }) {
  const { isCarer: hasCarerLink, loading } = useLinkedCarer();
  const [location, setLocation] = useLocation();
  const pathOnly = location.split("?")[0] ?? location;
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = Boolean(hasCarerLink && activeMode === "carer");

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (isCarerMode && !isCommunityPath(pathOnly)) {
      setLocation("/carer-view");
      return;
    }
    if (!isCarerMode && (hasCarerIntent() || hasPendingCarer())) {
      setLocation("/carer-setup");
    }
  }, [loading, isCarerMode, pathOnly, setLocation]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading…</div>
    );
  }
  if (isCarerMode && !isCommunityPath(pathOnly)) return null;
  if (hasCarerIntent() || hasPendingCarer()) return null;
  return <>{children}</>;
}

function isCarerAllowedPath(pathOnly: string): boolean {
  const p = (pathOnly || "/").split("?")[0] ?? "/";
  if (p === "/carer-view" || p.startsWith("/carer-view/")) return true;
  if (p === "/tools" || p.startsWith("/tools/")) return true;
  if (p === "/education" || p.startsWith("/education/")) return true;
  if (p === "/notifications") return true;
  if (p === "/account") return true;
  if (p === "/settings") return true;
  if (p === "/settings/appearance") return true;
  if (p === "/settings/notifications") return true;
  if (p === "/settings/about") return true;
  if (p === "/settings/emergency") return true;
  if (p === "/privacy" || p === "/support") return true;
  if (isCommunityPath(p)) return true;
  return false;
}

/** Allows linked carers and patients; redirects pending carer signup to /carer-setup. */
function CarerSetupIntentGuard({ children }: { children: React.ReactNode }) {
  const { data: linkedPatient, loading } = useLinkedPatient();
  const [, setLocation] = useLocation();
  const isCarerMode = Boolean(linkedPatient);

  useEffect(() => {
    if (loading) return;
    if (!isCarerMode && (hasCarerIntent() || hasPendingCarer())) {
      setLocation("/carer-setup");
    }
  }, [loading, isCarerMode, setLocation]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading…</div>
    );
  }
  if (!isCarerMode && (hasCarerIntent() || hasPendingCarer())) return null;
  return <>{children}</>;
}

function FamilyCarersGate() {
  const { isCarer: hasCarerLink, loading } = useLinkedCarer();
  const [, setLocation] = useLocation();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = Boolean(hasCarerLink && activeMode === "carer");

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (isCarerMode) {
      setLocation("/carer-view");
      return;
    }
    if (hasCarerIntent() || hasPendingCarer()) {
      setLocation("/carer-setup");
    }
  }, [loading, isCarerMode, setLocation]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading…</div>
    );
  }
  if (isCarerMode || hasCarerIntent() || hasPendingCarer()) return null;
  return <FamilyCarers />;
}

/**
 * Authenticated shell — wouter <Switch> inside ProtectedLayout (same branch as Dashboard).
 * Single app-level <Router> is in main.tsx (wouter; not react-router BrowserRouter).
 * NotFound * last.
 */
function InnerRouter() {
  return (
    <Switch>
      <Route path="/mode" component={ModeChooser} />
      <Route path="/carer-view/:section" component={CarerView} />
      <Route path="/carer-view" component={CarerView} />
      <Route path="/supporter-profile">
        <Redirect to="/account" replace />
      </Route>
      <Route path="/family-carers" component={FamilyCarersGate} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/community/messages/:threadId">
        <PatientRouteGuard>
          <CommunityFeatureGate>
            <Suspense fallback={<RouteFallback />}>
              <CommunityThread />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/messages">
        <PatientRouteGuard>
          <CommunityFeatureGate>
            <Suspense fallback={<RouteFallback />}>
              <CommunityMessages />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/settings">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <Suspense fallback={<RouteFallback />}>
              <CommunitySettings />
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
          <CommunityFeatureGate>
            <Suspense fallback={<RouteFallback />}>
              <CommunityPost />
            </Suspense>
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community">
        <PatientRouteGuard>
          <CommunityFeatureGate>
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
          <Suspense fallback={<RouteFallback />}>
            <Supplies />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/exercise">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <ScenarioExercisePage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/bedtime">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <Bedtime />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/sick-day">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <SickDay />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/travel">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <Travel />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/alcohol">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <AlcoholScenarioPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/driving">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <DrivingScenarioPage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios/pump-failure">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <PumpFailurePage />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/scenarios">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <Scenarios />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/tools/hypo-help">
        <Suspense fallback={<RouteFallback />}>
          <HypoHelpPage />
        </Suspense>
      </Route>
      <Route path="/tools/routines">
        <PatientRouteGuard>
          <Redirect to="/routines" replace />
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
        <Suspense fallback={<RouteFallback />}>
          <ToolsPage />
        </Suspense>
      </Route>
      <Route path="/adviser">
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <Adviser />
          </Suspense>
        </PatientRouteGuard>
      </Route>
      <Route path="/verified-success" component={VerifiedSuccess} />
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
      <Route path="/settings/emergency">
        <Suspense fallback={<RouteFallback />}>
          <SettingsEmergencyPage />
        </Suspense>
      </Route>
      <Route path="/settings/notifications">
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
        <PatientRouteGuard>
          <Suspense fallback={<RouteFallback />}>
            <Ratios />
          </Suspense>
        </PatientRouteGuard>
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

function useIosLocalNotificationPermissionPrompt(visible: boolean) {
  const { toast } = useToast();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (!Capacitor.isNativePlatform?.() || Capacitor.getPlatform?.() !== "ios") return;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem("diabeater_ios_local_notif_prompt_dismissed_v1") === "true";
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
            localStorage.setItem("diabeater_ios_local_notif_prompt_dismissed_v1", "true");
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
      localStorage.setItem("diabeater_ios_local_notif_prompt_dismissed_v1", "true");
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
          description: "You can enable them later in iPhone Settings → Notifications → Diabeaters.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Could not request notifications",
        description: "Try again later, or enable in iPhone Settings → Notifications → Diabeaters.",
        variant: "destructive",
      });
    }
  };

  return { show, dismiss, enable };
}

function AuthenticatedShell() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const pathOnly = location.split("?")[0] ?? location;
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = Boolean(hasCarerLink && activeMode === "carer");
  const iosNotifPrompt = useIosLocalNotificationPermissionPrompt(!isCarerMode);

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
    if (location.split("?")[0] !== "/") setLocation("/");
  };

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  useEffect(() => {
    if (!hasCarerLink) return;
    if (activeMode != null) return;
    if (pathOnly === "/mode") return;
    if (getPrimaryAppRole() === "carer") {
      setActiveAppMode("carer");
    } else {
      setActiveAppMode("patient");
    }
  }, [hasCarerLink, activeMode, pathOnly]);

  useEffect(() => {
    if (!hasCarerLink) return;
    if (!activeMode) return;
    if (activeMode === "carer") {
      if (!isCarerAllowedPath(pathOnly) && pathOnly !== "/mode") setLocation("/carer-view");
      return;
    }
    if (pathOnly === "/carer-view" || pathOnly.startsWith("/carer-view/")) {
      setLocation("/");
    }
  }, [hasCarerLink, activeMode, pathOnly, setLocation]);

  useEffect(() => {
    const onSupplySyncToast = (ev: Event) => {
      const ce = ev as CustomEvent<{ kind?: string }>;
      const kind = ce.detail?.kind;
      if (kind === "queued") {
        toast({
          title: "Change queued",
          description: "Change queued; will sync when you're back online.",
        });
        return;
      }
      if (kind === "retry") {
        toast({
          title: "Couldn't sync",
          description: "Couldn't sync now; will retry automatically.",
          variant: "destructive",
        });
      }
    };
    window.addEventListener("diabeater:supply-sync-toast", onSupplySyncToast);
    return () => window.removeEventListener("diabeater:supply-sync-toast", onSupplySyncToast);
  }, [toast]);

  useEffect(() => {
    const flush = async () => {
      const { flushSuppliesOfflineQueue } = await import("@/lib/supplies");
      const { flushed, skippedNewer, failed } = await flushSuppliesOfflineQueue();
      if (flushed > 0) {
        toast({
          title: "Queued changes synced",
          description: `${flushed} change${flushed === 1 ? "" : "s"} sent to the server.`,
        });
      }
      if (skippedNewer > 0) {
        toast({
          title: "Skipped newer server version",
          description: `${skippedNewer} change${skippedNewer === 1 ? "" : "s"} were skipped because a newer server version exists.`,
        });
      }
      if (failed > 0) {
        toast({
          title: "Sync incomplete",
          description: "Some queued changes could not be synced yet. We'll retry when you're online.",
          variant: "destructive",
        });
      }
    };

    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [toast]);

  return (
    <div className="relative flex min-h-screen w-full min-w-0 flex-col bg-background text-foreground">
      <ClinicalPrefsCloudSync />
      <KeyboardInsets />
      {!isCarerMode ? <SickDayMedDuePoller /> : null}
      {!isCarerMode ? <AlcoholReminderPoller /> : null}
      {!isCarerMode ? <PumpFailureReminderPoller /> : null}
      <AppShellBackdrop tone="rich" />
      <OfflineBanner />
      <AppTopBar
        isCarer={isCarerMode}
        pathOnly={location.split("?")[0] ?? location}
        onBrandClick={goBrandHome}
        onLogout={handleLogout}
      />
      {!isCarerMode && iosNotifPrompt.show ? (
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
      {!isCarerMode ? <AppStatusStrip /> : null}
      <main
        className="relative z-[1] w-full min-w-0 flex-1 overflow-x-hidden p-4 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:p-6"
        style={{
          paddingBottom: "calc(var(--bottom-nav-height, 7.5rem) + 10rem)",
          scrollPaddingBottom: "calc(var(--bottom-nav-height, 7.5rem) + 10rem)",
        }}
      >
        <AnimatedRouteOutlet>
          <InnerRouter />
        </AnimatedRouteOutlet>
      </main>
      <BottomNav />
    </div>
  );
}

function AccountShell() {
  const [, setLocation] = useLocation();
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = Boolean(hasCarerLink && activeMode === "carer");

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: "patient" | "carer" | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

  const handleLogout = async () => {
    clearCarerClientSessionKeys();
    await logout();
    setLocation("/welcome");
  };

  return (
    <div className="relative flex min-h-screen w-full min-w-0 flex-col bg-background text-foreground">
      <ClinicalPrefsCloudSync />
      <KeyboardInsets />
      {!isCarerMode ? <SickDayMedDuePoller /> : null}
      {!isCarerMode ? <AlcoholReminderPoller /> : null}
      {!isCarerMode ? <PumpFailureReminderPoller /> : null}
      <AppShellBackdrop tone="rich" />
      <AppTopBar
        isCarer={isCarerMode}
        pathOnly="/account"
        onBrandClick={() => setLocation(isCarerMode ? "/carer-view" : "/")}
        onLogout={handleLogout}
      />
      <main
        className="relative z-[1] w-full min-w-0 flex-1 overflow-x-hidden p-4 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:p-6"
        style={{
          paddingBottom: "calc(var(--bottom-nav-height, 7.5rem) + 10rem)",
          scrollPaddingBottom: "calc(var(--bottom-nav-height, 7.5rem) + 10rem)",
        }}
      >
        <Suspense fallback={<RouteFallback />}>
          <Account />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

/**
 * Top-level shell (auth, public pages). Catch-all path="*" → ProtectedLayout + app chrome.
 * Login, signup, account, privacy, etc. are matched before *.
 */
function MainRouter() {
  return (
    <AnimatedRouteOutlet>
    <Switch>
      <Route path="/welcome" component={Welcome} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/auth/email-verify" component={AuthCallback} />
      <Route path="/verified-return" component={VerifiedReturn} />
      <Route path="/reset-request" component={ResetRequest} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/check-email" component={CheckEmail} />
      <Route path="/carer-setup" component={CarerSetup} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/support" component={Support} />
      <Route path="/account">
        <AuthOnlyLayout>
          <AccountShell />
        </AuthOnlyLayout>
      </Route>
      <Route path="*">
        <ProtectedLayout>
          <AuthenticatedShell />
        </ProtectedLayout>
      </Route>
    </Switch>
    </AnimatedRouteOutlet>
  );
}

function AppContent() {
  useNativeDeepLinks();
  useNativeLocalNotificationDeepLinks();
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [appGateReady, setAppGateReady] = useState(false);
  const [linkedCarer, setLinkedCarer] = useState(false);
  const [patientOnboardingSatisfied, setPatientOnboardingSatisfied] = useState(true);
  const pathOnly = location.split("?")[0] ?? location;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (authLoading) return;
      if (!user?.id) {
        setLinkedCarer(false);
        setPatientOnboardingSatisfied(true);
        setAppGateReady(true);
        return;
      }
      const link = await getLinkedPatientForCarer();
      if (cancelled) return;
      if (link.data) {
        setLinkedCarer(true);
        setPatientOnboardingSatisfied(true);
        setAppGateReady(true);
        return;
      }
      if (hasCarerIntent() || hasPendingCarer()) {
        setLinkedCarer(false);
        setPatientOnboardingSatisfied(true);
        setAppGateReady(true);
        return;
      }
      const { profile } = await getProfile(user.id);
      if (cancelled) return;
      const fromDb = profile?.onboarding_complete === true;
      let fromLs = false;
      try {
        fromLs = localStorage.getItem("diabeater_onboarding_completed") === "true";
      } catch {
        fromLs = false;
      }
      setPatientOnboardingSatisfied(fromDb || fromLs);
      setLinkedCarer(false);
      setAppGateReady(true);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    const bumpLinkedCarer = () => {
      void (async () => {
        if (!user?.id) return;
        const link = await getLinkedPatientForCarer();
        if (link.data) setLinkedCarer(true);
      })();
    };
    window.addEventListener("diabeater:carer-link-updated", bumpLinkedCarer);
    return () => window.removeEventListener("diabeater:carer-link-updated", bumpLinkedCarer);
  }, [user?.id]);

  const publicEntry = bypassesOnboardingGate(location);

  useEffect(() => {
    if (!appGateReady || authLoading) return;
    if (publicEntry) return;
    if (!user?.id) return;
    if (linkedCarer) return;
    if (hasCarerIntent() || hasPendingCarer()) return;
    if (patientOnboardingSatisfied) return;
    if (pathOnly === "/onboarding") return;
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
          setPatientOnboardingSatisfied(true);
        }}
      />
    );
  }

  if (!appGateReady || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (
    user?.id &&
    !linkedCarer &&
    !hasCarerIntent() &&
    !hasPendingCarer() &&
    !patientOnboardingSatisfied &&
    pathOnly !== "/onboarding"
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
    if (!(import.meta.env.PROD && "serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update();
      })
      .catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <AuthProvider>
              <EmergencyProfileProvider>
                {import.meta.env.DEV ? <DevSupabaseDiagnostics /> : null}
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
