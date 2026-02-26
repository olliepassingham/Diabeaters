
// client/src/App.tsx
import { useState, useEffect, type ComponentType } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

// ✅ shadcn/ui: Toaster is a named export from ui/toast.tsx (not ui/toaster.tsx)
import { Toaster } from "@/components/ui/toaster";

// ✅ TooltipProvider is a named export
import { TooltipProvider } from "@/components/ui/tooltip";

import { BottomNav } from "@/components/bottom-nav";
import { ProfileMenu } from "@/components/profile-menu";
import { FaceLogo } from "@/components/face-logo";
import { NotificationBell } from "@/components/notification-bell";
import { MessagesIcon } from "@/components/messages-icon";
import { OfflineBanner } from "@/components/offline-banner";
import { SickDayBanner } from "@/components/sick-day-banner";
import { TravelBanner } from "@/components/travel-banner";
import { ActiveExerciseBanner } from "@/components/active-exercise-banner";

// ✅ Hooks — named exports
import { ThemeProvider } from "@/hooks/use-theme";

// Error boundary for production
import { ErrorBoundary } from "@/components/error-boundary";
import { useReleaseMode } from "@/lib/release-mode";

import { getCurrentUser, onAuthStateChange, logout } from "@/lib/auth";
import Login from "@/pages/login";
import Signup from "@/pages/signup";

// Pages — your pages appear to be default exports (based on your existing imports)
// If any are named, change imports accordingly.
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

function requireAuth<P>(Component: ComponentType<P>) {
  return function RequireAuth(props: P) {
    const [, setLocation] = useLocation();
    const [checking, setChecking] = useState(true);
    const [hasUser, setHasUser] = useState(false);

    useEffect(() => {
      let isMounted = true;

      (async () => {
        const { data } = await getCurrentUser();
        if (!isMounted) return;

        const userPresent = !!data?.user;
        setHasUser(userPresent);
        setChecking(false);

        if (!userPresent) {
          setLocation("/login");
        }
      })();

      const { data } = onAuthStateChange((event, session) => {
        if (!isMounted) return;
        const userPresent = !!session?.user;
        setHasUser(userPresent);
        if (!userPresent) {
          setLocation("/login");
        }
      });

      return () => {
        isMounted = false;
        data?.unsubscribe();
      };
    }, [setLocation]);

    if (checking) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            Checking session...
          </div>
        </div>
      );
    }

    if (!hasUser) {
      return null;
    }

    return <Component {...props} />;
  };
}

const ProtectedDashboard = requireAuth(Dashboard);

function Router() {
  const { isBetaVisible } = useReleaseMode();

  return (
    <Switch>
      <Route path="/" component={ProtectedDashboard} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
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

function AppContent() {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [hasChecked, setHasChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { data } = await getCurrentUser();
      if (!isMounted) return;
      setIsAuthenticated(!!data?.user);
    })();

    const { data } = onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      isMounted = false;
      data?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const completed = localStorage.getItem("diabeater_onboarding_completed");
    setOnboardingCompleted(completed === "true");
    setHasChecked(true);
  }, []);

  useEffect(() => {
    if (hasChecked && !onboardingCompleted && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [hasChecked, onboardingCompleted, location, setLocation]);

  if (location === "/onboarding") {
    return <Onboarding onComplete={() => {
      setOnboardingCompleted(true);
      const struggle = localStorage.getItem("diabeater_onboarding_struggle");
      const routes: Record<string, string> = {
        supplies: "/supplies",
        meals: "/adviser?tab=meal",
        exercise: "/adviser?tab=exercise",
        overview: "/",
      };
      setLocation(struggle && routes[struggle] ? routes[struggle] : "/");
    }} />;
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
          {isAuthenticated && (
            <button
              onClick={async () => {
                await logout();
                setLocation("/login");
              }}
              className="text-xs px-3 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              Log out
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
        <div key={location} className="animate-fade-in-up">
          <Router />
        </div>
      </main>
      <footer className="border-t py-3 px-6 text-center text-xs text-muted-foreground mb-12">
        <p>Copyright PassingTime Ltd {new Date().getFullYear()}</p>
      </footer>
      <BottomNav />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js", { updateViaCache: 'none' })
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
            <AppContent />
            <Toaster />
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

