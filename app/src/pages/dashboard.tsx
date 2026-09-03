import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowRight, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  storage,
  DIABEATER_SETTINGS_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  dismissSoftSetupNudge,
  isCommunityAccountProfile,
  isSoftSetupNudgeDismissed,
  isWithinOnboardingPostFinishGracePeriod,
  Supply as LocalSupply,
  ScenarioState,
  SettingsCompletionItem,
  UserProfile,
} from "@/lib/storage";
import { getActiveAppMode } from "@/lib/carer-session";
import { seedPatientFirstRunDefaultsIfNeeded } from "@/lib/starter-patient-defaults";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WelcomeWidget, shouldOfferWelcomeWidget } from "@/components/widgets/welcome-widget";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { DashboardWidgetSettings } from "@/components/dashboard/DashboardWidgetSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProfile } from "@/lib/profile";
import { getSupabase } from "@/lib/supabase";
import { repairSickDayCloudIfLocalInactive } from "@/lib/scenarios-supabase";
import { PageHeader, PageShell } from "@/components/layout";
import { PendingHypoCheckInBanner } from "@/components/pending-hypo-check-in-banner";
import { isAiCoachEnabled, isCommunityEnabled } from "@/lib/flags";
import { useOffline } from "@/hooks/use-offline";
import { HomeMetaBadge, homeDataPanelClass, homeHeroPanelClass } from "@/components/home/home-ui";
import { HomeCommandHero } from "@/components/home/HomeCommandHero";
import { HomeTodayPulse } from "@/components/home/HomeTodayPulse";
import { HomeCgmGraph } from "@/components/home/HomeCgmGraph";
import { HomeMealMoment } from "@/components/home/HomeMealMoment";
import { HomeSupplyGraph } from "@/components/home/HomeSupplyGraph";
import { HomeTravelContext } from "@/components/home/HomeTravelContext";
import { getHealthStatus } from "@/lib/dashboard-health-status";
import { useAskAnything } from "@/components/ai-coach/ask-anything-context";
import { cn } from "@/lib/utils";

const VERIFIED_WELCOME_PENDING_KEY = "diabeater_verified_welcome_pending";
const VERIFIED_WELCOME_DISMISSED_AT_KEY = "diabeater_verified_welcome_dismissed_at";
const VERIFIED_WELCOME_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;


function DashboardSkeleton() {
  return (
    <PageShell variant="wide" density="compact" className="animate-fade-in">
      <div className={cn(homeHeroPanelClass, "p-4 space-y-4")}>
        <Skeleton className="h-3 w-36 skeleton-shimmer" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-12 w-32 rounded-full skeleton-shimmer" />
          <Skeleton className="h-16 w-24 rounded-xl skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Skeleton className="h-11 rounded-2xl skeleton-shimmer" />
          <Skeleton className="h-11 rounded-2xl skeleton-shimmer" />
          <Skeleton className="h-11 rounded-2xl skeleton-shimmer" />
          <Skeleton className="h-11 rounded-2xl skeleton-shimmer" />
        </div>
      </div>
      <div className={cn(homeDataPanelClass, "p-3")}>
        <Skeleton className="h-12 w-full rounded-lg skeleton-shimmer" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-4 w-28 skeleton-shimmer" />
            <Skeleton className="h-24 w-full rounded-md skeleton-shimmer" />
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-4 w-28 skeleton-shimmer" />
            <Skeleton className="h-24 w-full rounded-md skeleton-shimmer" />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

const ONBOARDING_SETUP_GRACE_DAYS = 5;

function SoftSettingsNudge({
  completion,
  onDismiss,
}: {
  completion: { completed: number; total: number };
  onDismiss: () => void;
}) {
  return (
    <div
      className="animate-fade-in-up px-1 py-4"
      data-testid="banner-soft-setup-nudge"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          When you are ready, add a few numbers in Settings for fuller suggestions ({completion.completed}/
          {completion.total} so far).
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/settings">
            <Button variant="outline" size="sm" data-testid="button-soft-setup-settings">
              Settings
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Dismiss setup reminder"
            onClick={onDismiss}
            data-testid="button-dismiss-soft-setup-nudge"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SetupPromptCard({
  completion,
}: {
  completion: { percentage: number; completed: number; total: number; missing: SettingsCompletionItem[] };
}) {
  return (
    <Card
      className="!rounded-none !border-y-0 !border-r-0 !border-l-[3px] !border-l-amber-500/55 !bg-transparent !shadow-none"
      data-testid="card-setup-prompt"
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4" aria-hidden />
            </div>
            <h3 className="font-display text-base font-semibold tracking-tight">Finish your setup</h3>
          </div>
          <HomeMetaBadge className="border-amber-400/35 bg-amber-100/80 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" testId="badge-setup-progress">
            {completion.completed}/{completion.total}
          </HomeMetaBadge>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Setup progress</span>
            <span className="font-medium tabular-nums">{completion.percentage}%</span>
          </div>
          <Progress value={completion.percentage} className="h-2" />
        </div>

        {completion.missing.length > 0 ? (
          <div className="space-y-1 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-1">
            {completion.missing.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground/90 transition-colors hover:bg-amber-500/10"
                data-testid={`link-home-setup-missing-${item.key}`}
              >
                <span className="min-w-0 truncate">Still missing: {item.label}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Add the basics in Settings to unlock the full app and more tailored suggestions.
          </p>
        )}

        <Link href="/settings">
          <Button className="w-full gradient-primary border-primary-border shadow-sm" data-testid="button-complete-setup">
            Open Settings
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { openAskModal } = useAskAnything();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { profile: cloudProfile, loading: cloudProfileLoading } = useProfile();
  const isOffline = useOffline();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [supplies, setSupplies] = useState<LocalSupply[]>([]);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [widgetsDialogOpen, setWidgetsDialogOpen] = useState(false);
  const {
    placements,
    activeWidgets,
    toggleWidget,
    setWidgetSize,
    reorderWidgets,
    resetWidgets,
  } = useDashboardWidgets();
  const [isSettingsComplete, setIsSettingsComplete] = useState(() => storage.isSettingsComplete());
  const [settingsCompletion, setSettingsCompletion] = useState(() => storage.getSettingsCompletion());
  const [softSetupNudgeDismissed, setSoftSetupNudgeDismissed] = useState(() => isSoftSetupNudgeDismissed());
  const [isLoading, setIsLoading] = useState(true);
  const [showVerifiedWelcome, setShowVerifiedWelcome] = useState(false);

  useEffect(() => {
    const refreshData = () => {
      setProfile(storage.getProfile());
      setSupplies(storage.getSupplies());
      setScenarioState(storage.getScenarioState());
      setIsSettingsComplete(storage.isSettingsComplete());
      setSettingsCompletion(storage.getSettingsCompletion());
    };

    seedPatientFirstRunDefaultsIfNeeded();
    refreshData();
    if (getSupabase()) {
      void repairSickDayCloudIfLocalInactive();
    }
    setIsLoading(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshData();
        if (getSupabase()) {
          void repairSickDayCloudIfLocalInactive();
        }
      }
    };

    const handleFocus = () => {
      refreshData();
    };

    const onSettingsChanged = () => refreshData();

    const onActiveUserChanged = () => refreshData();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onSettingsChanged);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, onActiveUserChanged);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettingsChanged);
      window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onSettingsChanged);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, onActiveUserChanged);
    };
  }, []);

  useEffect(() => {
    if (!isSettingsComplete) return;
    const row = placements.find((p) => p.id === "settings-completion" && p.enabled);
    if (row) toggleWidget("settings-completion", false);
  }, [isSettingsComplete, placements, toggleWidget]);

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

  useEffect(() => {
    const sp = new URLSearchParams(search);
    if (sp.get("ask") !== "1") return;
    openAskModal("checkin-notification");
    setLocation("/", { replace: true });
  }, [search, setLocation, openAskModal]);

  const healthStatus = getHealthStatus(supplies, scenarioState);

  const scenariosQuickHref = useMemo(() => {
    if (scenarioState.sickDayActive) return "/scenarios/sick-day";
    if (scenarioState.travelModeActive) return "/scenarios/travel";
    return "/scenarios";
  }, [scenarioState.sickDayActive, scenarioState.travelModeActive]);

  const showScenariosQuickLink = scenarioState.sickDayActive || scenarioState.travelModeActive;

  const mode = getActiveAppMode();
  const isCommunityDash =
    isCommunityAccountProfile(profile) && mode !== "patient" && mode !== "carer";

  const dashboardDisplayName = cloudProfile?.full_name?.trim() || profile?.name?.trim() || "";
  const dashboardFirstName = dashboardDisplayName.split(" ")[0] || "";
  const showWelcomeWidget =
    !isCommunityDash && shouldOfferWelcomeWidget() && !dashboardFirstName;

  const inOnboardingSetupGrace = isWithinOnboardingPostFinishGracePeriod(ONBOARDING_SETUP_GRACE_DAYS);
  const showSoftSetupNudge =
    !isCommunityDash && !isSettingsComplete && inOnboardingSetupGrace && !softSetupNudgeDismissed;
  const showFullSetupPrompt =
    !isCommunityDash && !isSettingsComplete && !inOnboardingSetupGrace;

  // SetupPromptCard covers incomplete setup; never show the settings-completion widget in the grid (avoids empty slot when complete).
  const showCommunityQuickPostWidget =
    !isOffline && isCommunityEnabled && !cloudProfileLoading && cloudProfile?.is_public === true;
  const communityDashWidgetAllow = new Set(["community-quick-post", "tip-of-day", "pharmacy"]);
  const widgetsToRender = activeWidgets
    .filter((w) => w.type !== "settings-completion")
    .filter((w) => w.type !== "community-quick-post" || showCommunityQuickPostWidget)
    .filter((w) => isCommunityDash || w.type !== "community-quick-post")
    .filter((w) => !isCommunityDash || communityDashWidgetAllow.has(w.type));

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <PageShell variant="wide" density="compact" data-testid="dashboard-page">
      <PageHeader
        screenReaderOnly
        title={<span data-testid="dashboard-title">Dashboard</span>}
        description={
          <span data-testid="dashboard-subtitle">
            {isCommunityDash ? "Explore education and the community" : "Today and activity calendar"}
          </span>
        }
      />
      {/* One continuous patient-home canvas: status, graphs, actions, today. */}
      <section
        className="home-flow-canvas animate-fade-in"
        data-testid="dashboard-today"
      >
        {showVerifiedWelcome && (
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
                className="h-9 w-9 -mt-1.5 -mr-1.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-200"
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
        )}

        {!isCommunityDash ? (
          <PendingHypoCheckInBanner />
        ) : null}

        {!isCommunityDash ? (
          <div style={{ animationDelay: "30ms" }}>
            <HomeCommandHero
              status={healthStatus}
              profile={profile}
              scenarioState={scenarioState}
              onEditWidgets={() => setWidgetsDialogOpen(true)}
              showCoach={isAiCoachEnabled && !isOffline}
              showGuides={showScenariosQuickLink}
              guidesHref={scenariosQuickHref}
            />
          </div>
        ) : null}

        {!isCommunityDash ? <HomeCgmGraph /> : null}

        {!isCommunityDash ? <HomeMealMoment healthStatus={healthStatus} /> : null}

        {!isCommunityDash ? <HomeTravelContext /> : null}

        {!isCommunityDash ? (
          <HomeTodayPulse healthStatus={healthStatus} suppressRunwayDuplicate />
        ) : null}

        {!isCommunityDash ? <HomeSupplyGraph supplies={supplies} /> : null}

        {showWelcomeWidget ? (
          <section className="py-4" style={{ animationDelay: "50ms" }}>
            <WelcomeWidget />
          </section>
        ) : null}

        {showSoftSetupNudge && (
          <section className="animate-fade-in-up" style={{ animationDelay: "70ms" }}>
            <SoftSettingsNudge
              completion={settingsCompletion}
              onDismiss={() => {
                dismissSoftSetupNudge();
                setSoftSetupNudgeDismissed(true);
              }}
            />
          </section>
        )}

        {showFullSetupPrompt && (
          <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
            <SetupPromptCard completion={settingsCompletion} />
          </section>
        )}
      </section>

      <DashboardWidgetSettings
        open={widgetsDialogOpen}
        onOpenChange={setWidgetsDialogOpen}
        placements={
          isCommunityDash
            ? placements
            : placements.filter((placement) => placement.type !== "community-quick-post")
        }
        toggleWidget={toggleWidget}
        setWidgetSize={setWidgetSize}
        reorderWidgets={reorderWidgets}
        resetWidgets={resetWidgets}
        isSettingsComplete={isSettingsComplete}
        allowResize={!isMobile}
      />

      <section className="home-widget-flow" data-testid="dashboard-widgets">
        <div className="animate-stagger grid grid-cols-1 items-start md:grid-cols-2">
          {widgetsToRender.map((w) => {
            const Comp = w.Component;
            if (!Comp) return null;
            return (
              <div
                key={w.id}
                data-testid={`widget-container-${w.type}`}
                className={cn(
                  "home-widget-section w-full self-start empty:hidden md:px-2",
                  (isMobile || w.size === "full") && "md:col-span-2",
                )}
              >
                <Comp layoutSize={isMobile ? "full" : w.size} widgetType={w.type} />
              </div>
            );
          })}
        </div>
      </section>

      {widgetsToRender.length === 0 && isSettingsComplete && (
        <Card variant="glass-muted" className="animate-fade-in border border-border/50 shadow-sm">
          <CardContent className="py-8 text-center md:py-10">
            <p className="mb-4 text-sm text-muted-foreground max-w-sm mx-auto">
              No widgets on your dashboard yet. Use the layout button above or tap below to pick what you want to see.
            </p>
            <Button
              variant="default"
              className="min-h-11 px-6"
              onClick={() => setWidgetsDialogOpen(true)}
              data-testid="button-add-widgets"
            >
              Edit widgets
            </Button>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
