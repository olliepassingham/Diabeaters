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
import { SickDayBanner } from "@/components/sick-day-banner";
import { TravelBanner } from "@/components/travel-banner";
import { ActiveExerciseBanner } from "@/components/active-exercise-banner";
import { useToast } from "@/hooks/use-toast";

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
import Account from "@/pages/account";
import Dashboard from "@/pages/dashboard";
import VerifiedSuccess from "@/pages/verified-success";
import Welcome from "@/pages/welcome";
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
  hasCarerIntent,
  hasPendingCarer,
} from "@/lib/carer-session";
import { CommunityFeatureGate } from "@/components/community-feature-gate";
import { PatientOnboardingGate } from "@/components/patient-onboarding-gate";
import { getProfile } from "@/lib/profile";
import NotFound from "@/pages/not-found";
import ShotsPage from "@/pages/shots";
import Privacy from "@/pages/privacy";
import Support from "@/pages/support";
import CommunityHome from "@/pages/community/index";
import CommunityPost from "@/pages/community/post";
import CommunityMessages from "@/pages/community/messages";
import CommunityThread from "@/pages/community/thread";
import CommunityProfile from "@/pages/community/profile";
import CommunitySettings from "@/pages/community/settings";
import CommunityHandleResolve from "@/pages/community/handle-resolve";

const ToolsPage = lazy(() => import("@/pages/tools/index"));
const HypoHelpPage = lazy(() => import("@/pages/tools/hypo-help"));
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

    let removed = false;
    let handle: { remove: () => Promise<void> } | null = null;

    void CapacitorApp.addListener("appUrlOpen", (event: { url: string }) => {
      try {
        const url = new URL(event.url);
        const isHttp = url.protocol === "https:" || url.protocol === "http:";
        const nextPath = isHttp
          ? `${url.pathname}${url.search}${url.hash}`
          : `/${url.host || ""}${url.pathname}${url.search}${url.hash}`.replace(/\/{2,}/g, "/");

        const safe = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
        setLocation(safe);
      } catch {
        // ignore malformed URLs
      }
    }).then((h) => {
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
  }, [loading, user, setLocation]);

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
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-muted-foreground">
          Checking session...
        </div>
      </div>
    );
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
    "/verified-success",
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
      <Route path="/family-carers" component={FamilyCarersGate} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/community/messages/:threadId">
        <PatientRouteGuard>
          <CommunityFeatureGate>
            <CommunityThread />
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/messages">
        <PatientRouteGuard>
          <CommunityFeatureGate>
            <CommunityMessages />
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/settings">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <CommunitySettings />
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/u/:handle">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <CommunityHandleResolve />
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/profile/:userId">
        <PatientRouteGuard>
          <CommunityFeatureGate requirePublicProfile={false}>
            <CommunityProfile />
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community/post/:postId">
        <PatientRouteGuard>
          <CommunityFeatureGate>
            <CommunityPost />
          </CommunityFeatureGate>
        </PatientRouteGuard>
      </Route>
      <Route path="/community">
        <PatientRouteGuard>
          <CommunityFeatureGate>
            <CommunityHome />
          </CommunityFeatureGate>
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
          <Redirect to="/ratios" replace />
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
        <PatientRouteGuard>
          <Redirect to="/account" replace />
        </PatientRouteGuard>
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

function AuthenticatedShell() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { isCarer: hasCarerLink } = useLinkedCarer();
  const pathOnly = location.split("?")[0] ?? location;
  const [activeMode, setActiveMode] = useState(() => getActiveAppMode());
  const isCarerMode = Boolean(hasCarerLink && activeMode === "carer");

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
    if (!activeMode && pathOnly !== "/mode") {
      setLocation("/mode");
    }
  }, [hasCarerLink, activeMode, pathOnly, setLocation]);

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
    <div className="flex min-h-0 h-dvh w-full min-w-0 flex-col bg-background text-foreground">
      <OfflineBanner />
      {!isCarerMode && (
        <>
          <SickDayBanner />
          <TravelBanner />
          <ActiveExerciseBanner />
        </>
      )}
      <AppTopBar
        isCarer={isCarerMode}
        pathOnly={location.split("?")[0] ?? location}
        onBrandClick={goBrandHome}
        onLogout={handleLogout}
      />
      <main className="flex min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:p-6 md:pb-24">
        <InnerRouter />
      </main>
      <footer className="border-0 px-4 py-3 text-center text-xs text-gray-500 mb-12 dark:text-muted-foreground sm:px-6">
        <p>
          Copyright PassingTime Ltd {new Date().getFullYear()}{" "}
          · <Link href="/privacy"><span className="underline cursor-pointer hover:text-foreground">Privacy</span></Link>{" "}
          · <Link href="/support"><span className="underline cursor-pointer hover:text-foreground">Support</span></Link>{" "}
          · <Link href="/account"><span className="underline cursor-pointer hover:text-foreground">Account</span></Link>
        </p>
      </footer>
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
    <div className="flex min-h-0 h-dvh w-full min-w-0 flex-col bg-background text-foreground">
      <AppTopBar
        isCarer={isCarerMode}
        pathOnly="/account"
        onBrandClick={() => setLocation(isCarerMode ? "/carer-view" : "/")}
        onLogout={handleLogout}
      />
      <main className="flex min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:p-6 md:pb-24">
        <Account />
      </main>
      <footer className="border-0 px-4 py-3 text-center text-xs text-gray-500 mb-12 dark:text-muted-foreground sm:px-6">
        <p>
          Copyright PassingTime Ltd {new Date().getFullYear()}{" "}
          · <Link href="/privacy"><span className="underline cursor-pointer hover:text-foreground">Privacy</span></Link>{" "}
          · <Link href="/support"><span className="underline cursor-pointer hover:text-foreground">Support</span></Link>
        </p>
      </footer>
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
    <Switch>
      <Route path="/welcome" component={Welcome} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/auth/callback" component={AuthCallback} />
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
  );
}

function AppContent() {
  useNativeDeepLinks();
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

  const publicEntry = bypassesOnboardingGate(location);

  useEffect(() => {
    if (!appGateReady || authLoading) return;
    if (publicEntry) return;
    if (!user?.id) return;
    if (linkedCarer) return;
    if (hasCarerIntent() || hasPendingCarer()) return;
    if (patientOnboardingSatisfied) return;
    if (pathOnly === "/onboarding") return;
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
