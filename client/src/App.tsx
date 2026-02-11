
// client/src/App.tsx
import React, { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

// ✅ shadcn/ui: Toaster is a named export from ui/toast.tsx (not ui/toaster.tsx)
import { Toaster } from "@/components/ui/toaster";

// ✅ TooltipProvider is a named export
import { TooltipProvider } from "@/components/ui/tooltip";

// ✅ SidebarProvider / SidebarTrigger are named exports from ui/sidebar.tsx
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// ✅ App-level components — assumed named exports (adjust to default if your file uses `export default`)
import { AppSidebar } from "@/components/app-sidebar";
import { ProfileMenu } from "@/components/profile-menu";
import { FaceLogo } from "@/components/face-logo";
import { NotificationBell } from "@/components/notification-bell";
import { MessagesIcon } from "@/components/messages-icon";
import { OfflineBanner } from "@/components/offline-banner";
import { SickDayBanner } from "@/components/sick-day-banner";
import { TravelBanner } from "@/components/travel-banner";

// ✅ Hooks — named exports
import { ThemeProvider } from "@/hooks/use-theme";

// Error boundary for production
import { ErrorBoundary } from "@/components/error-boundary";

// Pages — your pages appear to be default exports (based on your existing imports)
// If any are named, change imports accordingly.
import Dashboard from "@/pages/dashboard";
import Supplies from "@/pages/supplies";
import Scenarios from "@/pages/scenarios";
import Advisor from "@/pages/advisor";
import AICoach from "@/pages/ai-coach";
import Settings from "@/pages/settings";
import HelpNow from "@/pages/help-now";
import Community from "@/pages/community";
import Appointments from "@/pages/appointments";
import EmergencyCard from "@/pages/emergency-card";
import Onboarding from "@/pages/onboarding";
import Shop from "@/pages/shop";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/supplies" component={Supplies} />
      <Route path="/scenarios" component={Scenarios} />
      <Route path="/advisor" component={Advisor} />
      <Route path="/ai-coach" component={AICoach} />
      <Route path="/community" component={Community} />
      <Route path="/appointments" component={Appointments} />
      <Route path="/emergency-card" component={EmergencyCard} />
            <Route path="/settings" component={Settings} />
      <Route path="/help-now" component={HelpNow} />
      <Route path="/shop" component={Shop} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [hasChecked, setHasChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

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
      setLocation("/");
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

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <OfflineBanner />
          <SickDayBanner />
          <TravelBanner />
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <button
              onClick={() => {
                if (location !== "/") {
                  setLocation("/");
                }
              }}
              className={`flex items-center gap-3 transition-opacity ${
                location === "/"
                  ? "cursor-default"
                  : "cursor-pointer hover:opacity-80 active:opacity-60"
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
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <div key={location} className="animate-page-enter">
              <Router />
            </div>
          </main>
          <footer className="border-t py-3 px-6 text-center text-xs text-muted-foreground">
            <p>Prototype - Copyright PassingTime Ltd {new Date().getFullYear()}</p>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope);
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

