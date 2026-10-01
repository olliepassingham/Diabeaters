import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LayoutGrid, AlertCircle, Dumbbell, Minus, Moon, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StagingChip } from "@/components/StagingChip";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { LogHypoTreatmentSheet } from "@/components/log-hypo-treatment-sheet";
import { StatusPill } from "@/components/home/StatusPill";
import { HomeActionDock } from "@/components/home/HomeActionDock";
import { TodayActivityLink } from "@/components/dashboard/SupplyTrackerTodaySection";
import type { HealthStatus } from "@/lib/dashboard-health-status";
import {
  DIABEATER_OPEN_HYPO_DIALOG_EVENT,
  storage,
  type ScenarioState,
  type UserProfile,
} from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { listCarerLinksForPatient } from "@/lib/carers";
import { useToast } from "@/hooks/use-toast";
import { runHypoTreatmentPipeline } from "@/lib/dashboard-hypo-pipeline";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import type { HomeLiveGlucose } from "@/hooks/use-home-next-best-action";
import type { HomeNextBestAction } from "@/lib/home-next-best-action";
import { cn } from "@/lib/utils";

function DashboardInfoDialog() {
  return (
    <PageInfoDialog title="About Your Dashboard" description="Your personal diabetes command centre">
      <InfoSection title="Customise your view">
        <p>Tap the layout button to edit widgets. You can show or hide cards and drag them into the order you prefer. Your layout is saved on this device.</p>
      </InfoSection>
      <InfoSection title="Status">
        <p>
          With a live reading, the pill follows glucose: Low, Dropping, or High. In range, it goes back to supplies and guides — Stable, Watch, or Action needed.
        </p>
      </InfoSection>
      <InfoSection title="Next action">
        <p>One primary next step sits under status. When glucose is low or falling toward your low line, that step is Hypo help. Help Now and Treated a hypo stay visible.</p>
      </InfoSection>
      <InfoSection title="Quick Navigation">
        <p>Click the Diabeaters logo in the navigation bar to return to the dashboard from any page.</p>
      </InfoSection>
    </PageInfoDialog>
  );
}

export function HomeCommandHero({
  profile,
  scenarioState,
  onEditWidgets,
  showCoach,
  nextAction,
  pill,
  liveGlucose,
}: {
  profile: UserProfile | null;
  scenarioState: ScenarioState;
  onEditWidgets: () => void;
  showCoach: boolean;
  nextAction: HomeNextBestAction;
  pill: { status: HealthStatus; label: string };
  liveGlucose: HomeLiveGlucose | null;
}) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [hypoDialogOpen, setHypoDialogOpen] = useState(false);
  const [quickHypoConfirmOpen, setQuickHypoConfirmOpen] = useState(false);
  const [hasLinkedSupporters, setHasLinkedSupporters] = useState<boolean | null>(null);

  const isUrgent = pill.status === "action" || nextAction.id === "hypo_help";

  const openFamilySupporters = () => setLocation("/family-carers");

  const refreshLinkedSupporters = () => {
    if (!user?.id || !getSupabase()) {
      setHasLinkedSupporters(null);
      return;
    }
    void listCarerLinksForPatient().then((res) => {
      if (res.error) {
        setHasLinkedSupporters(null);
        return;
      }
      setHasLinkedSupporters((res.data?.length ?? 0) > 0);
    });
  };

  useEffect(() => {
    refreshLinkedSupporters();
  }, [user?.id]);

  useEffect(() => {
    const openHypo = () => setHypoDialogOpen(true);
    window.addEventListener(DIABEATER_OPEN_HYPO_DIALOG_EVENT, openHypo);
    return () => window.removeEventListener(DIABEATER_OPEN_HYPO_DIALOG_EVENT, openHypo);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("hypo_log") !== "1") return;
    setHypoDialogOpen(true);
    params.delete("hypo_log");
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, []);

  const handleLogHypo = (fields: { glucoseInput: string; treatment: string; notes: string }) => {
    void runHypoTreatmentPipeline(fields, {
      userId: user?.id,
      toast,
      onOpenFamilySupporters: openFamilySupporters,
      onAfterLocalSave: () => setHypoDialogOpen(false),
    }).then(() => refreshLinkedSupporters());
  };

  const handleTreatedHypoClick = () => {
    if (storage.getNotificationSettings().hypoDashboardQuickNotify === true) {
      refreshLinkedSupporters();
      setQuickHypoConfirmOpen(true);
      return;
    }
    setHypoDialogOpen(true);
  };

  const confirmQuickHypo = () => {
    setQuickHypoConfirmOpen(false);
    void runHypoTreatmentPipeline(
      { glucoseInput: "", treatment: "", notes: "" },
      { userId: user?.id, toast, onOpenFamilySupporters: openFamilySupporters },
    ).then(() => refreshLinkedSupporters());
  };

  const quickConfirmHasSupporters = hasLinkedSupporters !== false;

  const activeExercise = storage.getActiveExercise();
  const pumpFailureActive = scenarioState.pumpFailureActive === true;

  const glucose = liveGlucose;
  const hasLiveBg = glucose != null;
  const trendLabel = glucose?.trend ?? null;
  const TrendIcon =
    trendLabel === "rising" ? TrendingUp : trendLabel === "falling" ? TrendingDown : trendLabel === "flat" ? Minus : null;

  return (
    <>
      <header className="pb-3 pt-1" data-testid="card-hero">
        <div className="flex items-start justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="sr-only">Today</h1>
              <TodayActivityLink compact />
              <StagingChip />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2.5" data-testid="home-hero-status-row">
              <div data-testid="wrap-dashboard-status-pill">
                <StatusPill status={pill.status} label={pill.label} />
              </div>
              {hasLiveBg && glucose ? (
                <div
                  className="flex items-baseline gap-1.5"
                  data-testid="home-hero-bg"
                >
                  <span className="font-display text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-[1.75rem]">
                    {formatTargetBgInput(glucose.value, normalizeBgUnits(glucose.units))}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {glucose.units || profile?.bgUnits || ""}
                  </span>
                  {TrendIcon ? (
                    <TrendIcon className="h-4 w-4 text-muted-foreground" aria-label={trendLabel ?? undefined} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <DashboardInfoDialog />
            <Button
              variant="ghost"
              size="icon"
              onClick={onEditWidgets}
              className="h-10 w-10 rounded-full"
              data-testid="button-customize"
              aria-label="Customise dashboard widgets"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {(scenarioState.sickDayActive || Boolean(activeExercise) || pumpFailureActive || scenarioState.alcoholModeActive) && (
          <div
            className="mt-3 flex flex-wrap items-center gap-2 px-1"
            data-testid="home-active-scenario-chips"
          >
            {scenarioState.sickDayActive ? (
              <Button asChild variant="secondary" size="sm" className="h-8 rounded-full px-3 text-xs font-semibold shadow-none">
                <Link href="/scenarios/sick-day" data-testid="chip-active-sickday">
                  <AlertCircle className="mr-1.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  Sick day
                </Link>
              </Button>
            ) : null}
            {activeExercise ? (
              <Button asChild variant="secondary" size="sm" className="h-8 rounded-full px-3 text-xs font-semibold shadow-none">
                <Link href="/scenarios/exercise" data-testid="chip-active-exercise">
                  <Dumbbell className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Exercise
                </Link>
              </Button>
            ) : null}
            {pumpFailureActive ? (
              <Button asChild variant="secondary" size="sm" className="h-8 rounded-full px-3 text-xs font-semibold shadow-none">
                <Link href="/scenarios/pump-failure" data-testid="chip-active-pumpfailure">
                  <AlertCircle className="mr-1.5 h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  Pump failure
                </Link>
              </Button>
            ) : null}
            {scenarioState.alcoholModeActive ? (
              <Button asChild variant="secondary" size="sm" className="h-8 rounded-full px-3 text-xs font-semibold shadow-none">
                <Link href="/scenarios/alcohol" data-testid="chip-active-alcohol">
                  <Moon className="mr-1.5 h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  Night mode
                </Link>
              </Button>
            ) : null}
          </div>
        )}

        <div className={cn("mt-3.5", !(scenarioState.sickDayActive || activeExercise || pumpFailureActive || scenarioState.alcoholModeActive) && "mt-4")}>
          <HomeActionDock
            isUrgent={isUrgent}
            showCoach={showCoach}
            onTreatedHypo={handleTreatedHypoClick}
            primary={nextAction}
          />
        </div>
      </header>

      <LogHypoTreatmentSheet
        open={hypoDialogOpen}
        onOpenChange={setHypoDialogOpen}
        profile={profile}
        onSubmit={handleLogHypo}
      />

      <AlertDialog open={quickHypoConfirmOpen} onOpenChange={setQuickHypoConfirmOpen}>
        <AlertDialogContent data-testid="dialog-quick-hypo-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {quickConfirmHasSupporters ? "Log treated hypo and tell supporters?" : "Log treated hypo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {quickConfirmHasSupporters
                ? "This logs a hypo treatment now and notifies any linked supporters. You can turn off quick-notify in Settings → Notifications if you would rather add details first."
                : "This logs a hypo treatment to your history now. Link a supporter later if you want someone alerted next time. You can turn off quick-notify in Settings → Notifications if you would rather add details first."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-quick-hypo-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              onClick={confirmQuickHypo}
              data-testid="button-quick-hypo-confirm"
            >
              {quickConfirmHasSupporters ? "Log + tell supporters" : "Log hypo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
