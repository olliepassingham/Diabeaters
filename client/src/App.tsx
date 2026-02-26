// client/src/App.tsx
import { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DevBanner } from "@/components/DevBanner";
import { StagingBanner } from "@/components/StagingBanner";
import { isStaging } from "@/lib/flags";

import { BottomNav } from "@/components/bottom-nav";
import { Link } from "wouter";
import { ProfileMenu } from "@/components/profile-menu";
import { FaceLogo } from "@/components/face-logo";
import { NotificationBell } from "@/components/notification-bell";
import { MessagesIcon } from "@/components/messages-icon";
import { OfflineBanner } from "@/components/offline-banner";
import { SickDayBanner } from "@/components/sick-day-banner";
import { TravelBanner } from "@/components/travel-banner";
import { ActiveExerciseBanner } from "@/components/active-exercise-banner";

import { ThemeProvider } from "@/hooks/use-theme";
import { ErrorBoundary } from "@/components/error-boundary";
import { useReleaseMode } from "@/lib/release-mode";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { logout, requireVerified } from "@/lib/auth";

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import AuthCallback from "@/pages/auth-callback";
import ResetRequest from "@/pages/reset-request";
import ResetPassword from "@/pages/reset-password";
import CheckEmail from "@/pages/check-email";
import Account from "@/pages/account";
import Dashboard from "@/pages/dashboard";
import Supplies from "@/pages/supplies";
import Scenarios from "@/pages/scenarios";
import Adviser from "@/pages/adviser";
import AICoach from "@/pages/ai-coach";
import Settings from "@/pages/settings";
import HelpNow from "@/pages/help-now";
import Community from "@/pages/community";
import Appointments from "@/pages/appointments";
import EmergencyCard from "@/pages/emergency-card";
import Onboarding from "@/pages/onboarding";
import Shop from "@/pages/shop";
import FamilyCarers from "@/pages/family-carers";
import CarerView from "@/pages/carer-view";
import Ratios from "@/pages/ratios";
import NotFound from "@/pages/not-found";
import ShotsPage from "@/pages/shots";
import Privacy from "@/pages/privacy";
import Support from "@/pages/support";

/** Protects the main app layout: redirects to /login when not authenticated, /check-email when not verified. */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user && !requireVerified(user, setLocation)) {
      return;
    }
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Checking session...
        </div>
      </div>
    );
  }

  if (!user || !requireVerified(user, setLocation)) {
    return null;
  }

  return <>{children}</>;
}

/** Requires user only (not verification). Used for /account so unverified users can resend verification. */
function AuthOnlyLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Checking session...
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

function InnerRouter() {
  const { isBetaVisible } = useReleaseMode();

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/supplies" component={Supplies} />
      <Route path="/scenarios" component={Scenarios} />
      <Route path="/adviser" component={Adviser} />
      {isBetaVisible && <Route path="/ai-coach" component={AICoach} />}
      {isBetaVisible && <Route path="/community" component={Community} />}
      <Route path="/appointments" component={Appointments} />
      <Route path="/emergency-card" component={EmergencyCard} />
      <Route path="/settings" component={Settings} />
      <Route path="/help-now" component={HelpNow} />
      {isBetaVisible && <Route path="/shop" component={Shop} />}
      {isBetaVisible && <Route path="/family-carers" component={FamilyCarers} />}
      {isBetaVisible && <Route path="/carer-view" component={CarerView} />}
      <Route path="/ratios" component={Ratios} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedShell() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <div className="flex flex-col h-screen w-full">
      <OfflineBanner />
      <SickDayBanner />
      <TravelBanner />
      <ActiveExerciseBanner />
      <header className="flex items-center justify-between p-4 border-b transition-colors duration-200 glass-surface sticky top-0 z-30">
        <button
          onClick={() => {
            if (location !== "/") {
              setLocation("/");
            }
          }}
          className={`flex items-center gap-3 transition-all duration-200 ${
            location === "/"
              ? "cursor-default"
              : "cursor-pointer hover:opacity-80 active:opacity-60 active:scale-[0.98]"
          }`}
          data-testid="button-home-brand"
        >
          <FaceLogo size={40} />
          <span className="font-semibold text-xl">Diabeaters</span>
        </button>
        <div className="flex items-center gap-2">
          <MessagesIcon />
          <NotificationBell />
          <ProfileMenu />
          {user && (
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              Log out
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
        <div key={location} className="animate-fade-in-up">
          <InnerRouter />
        </div>
      </main>
      <footer className="border-t py-3 px-6 text-center text-xs text-muted-foreground mb-12">
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

  return (
    <div className="flex flex-col h-screen w-full">
      <header className="flex items-center justify-between p-4 border-b transition-colors duration-200 glass-surface sticky top-0 z-30">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-3 cursor-pointer hover:opacity-80"
          data-testid="button-home-brand"
        >
          <FaceLogo size={40} />
          <span className="font-semibold text-xl">Diabeaters</span>
        </button>
      </header>
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
        <Account />
      </main>
    </div>
  );
}

function MainRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/reset-request" component={ResetRequest} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/check-email" component={CheckEmail} />
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
  const [location, setLocation] = useLocation();
  const [hasChecked, setHasChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem("diabeater_onboarding_completed");
    setOnboardingCompleted(completed === "true");
    setHasChecked(true);
  }, []);

  useEffect(() => {
    const skipOnboardingRedirect = [
      "/_shots",
      "/privacy",
      "/support",
      "/auth/callback",
      "/reset-request",
      "/reset-password",
      "/check-email",
      "/account",
    ].some((p) => location === p || location.startsWith(p + "/"));
    if (skipOnboardingRedirect) return;
    if (hasChecked && !onboardingCompleted && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [hasChecked, onboardingCompleted, location, setLocation]);

  if (location.startsWith("/_shots")) {
    return <ShotsPage />;
  }

  if (location === "/privacy" || location === "/support") {
    return <MainRouter />;
  }

  if (location === "/onboarding") {
    return (
      <Onboarding
        onComplete={() => {
          setOnboardingCompleted(true);
          const struggle = localStorage.getItem("diabeater_onboarding_struggle");
          const routes: Record<string, string> = {
            supplies: "/supplies",
            meals: "/adviser?tab=meal",
            exercise: "/adviser?tab=exercise",
            overview: "/",
          };
          setLocation(struggle && routes[struggle] ? routes[struggle] : "/");
        }}
      />
    );
  }

  if (!hasChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!onboardingCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Redirecting...</div>
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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js", { updateViaCache: "none" })
        .then((registration) => {
          console.log("SW registered:", registration.scope);
          registration.update();
        })
        .catch((error) => {
          console.log("SW registration failed:", error);
        });
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
            <Toaster />
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
