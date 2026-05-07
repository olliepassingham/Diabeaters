import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  LayoutGrid,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Bell,
  X,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  storage,
  DIABEATER_SETTINGS_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  dismissSoftSetupNudge,
  isCommunityAccountProfile,
  isSoftSetupNudgeDismissed,
  isWithinOnboardingPostFinishGracePeriod,
  Supply as LocalSupply,
  ScenarioState,
  UserProfile,
  HypoTreatment,
} from "@/lib/storage";
import { getActiveAppMode } from "@/lib/carer-session";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { WelcomeWidget } from "@/components/widgets/welcome-widget";
import { StagingChip } from "@/components/StagingChip";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { DashboardWidgetSettings } from "@/components/dashboard/DashboardWidgetSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile";
import { getSupabase } from "@/lib/supabase";
import { repairSickDayCloudIfLocalInactive } from "@/lib/scenarios-supabase";
import { insertHypoLog } from "@/lib/hypo-logs-supabase";
import { invokeNotifyCarersOnHypo } from "@/lib/invoke-notify-carers-hypo";
import { NOTIFY_EDGE_FAILURE_TITLE, notifyEdgeFailureDescription } from "@/lib/notify-toast-messages";
import { PageHeader, PageSectionLabel, PageShell } from "@/components/layout";
import { SupplyTrackerTodaySection } from "@/components/dashboard/SupplyTrackerTodaySection";
import { isCommunityEnabled } from "@/lib/flags";
import { CoachEntryCard } from "@/components/dashboard/CoachEntryCard";
import { useAskAnything } from "@/components/ai-coach/ask-anything-context";
import { getHealthStatus, type HealthStatus } from "@/lib/dashboard-health-status";

const VERIFIED_WELCOME_PENDING_KEY = "diabeater_verified_welcome_pending";
const VERIFIED_WELCOME_DISMISSED_AT_KEY = "diabeater_verified_welcome_dismissed_at";
const VERIFIED_WELCOME_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type ToastLike = ReturnType<typeof useToast>["toast"];

async function runHypoTreatmentPipeline(
  fields: { glucoseInput: string; treatment: string; notes: string },
  ctx: {
    userId: string | undefined;
    toast: ToastLike;
    onAfterLocalSave?: () => void;
  },
): Promise<void> {
  const glucoseLevel = fields.glucoseInput.trim() ? parseFloat(fields.glucoseInput) : undefined;
  const treatment = fields.treatment.trim() || undefined;
  const notes = fields.notes.trim() || undefined;

  const created = storage.addHypoTreatment({
    timestamp: new Date().toISOString(),
    glucoseLevel,
    treatment,
    notes,
    carerNotified: false,
  });

  ctx.onAfterLocalSave?.();

  let description = "Your hypo treatment has been recorded.";
  let notifyInvokeFailed = false;
  let notifyFailure: { detail?: string; error?: string } | null = null;

  if (ctx.userId && getSupabase()) {
    const cloud = await insertHypoLog({
      blood_glucose: created.glucoseLevel ?? null,
      treatment: created.treatment ?? null,
      notes: created.notes ?? null,
    });

    if (cloud.data) {
      storage.patchHypoTreatment(created.id, { supabaseHypoLogId: cloud.data.id });
      const notify = await invokeNotifyCarersOnHypo({
        hypoId: cloud.data.id,
        userId: ctx.userId,
      });

      if (!notify.success) {
        notifyInvokeFailed = true;
        notifyFailure = notify;
      } else {
        const eligible = notify.eligible_carers ?? 0;
        const delivered = (notify.delivered_push ?? 0) + (notify.delivered_inapp ?? 0);

        if (eligible > 0 && delivered > 0) {
          storage.updateHypoTreatmentCarerNotified(created.id, true);
          description =
            eligible === 1 ? "Your supporter has been notified." : "Your supporters have been notified.";
        } else if (eligible > 0 && delivered === 0) {
          description =
            "Hypo logged. No alerts were delivered — check push API env or in-app supporter user IDs in Family & supporters.";
        }
      }
    }
  }

  ctx.toast({
    title: "Hypo treatment logged",
    description,
  });
  if (notifyInvokeFailed && notifyFailure) {
    ctx.toast({
      title: NOTIFY_EDGE_FAILURE_TITLE,
      description: notifyEdgeFailureDescription(notifyFailure),
      variant: "destructive",
    });
  }
}

function StatusPill({ status }: { status: HealthStatus }) {
  const config = {
    stable: {
      text: "Stable",
      textColor: "text-green-700 dark:text-green-400",
      stroke: "#22c55e",
      trackStroke: "hsl(142 71% 45% / 0.2)",
      fill: "hsl(142 71% 45% / 0.08)",
      arc: 1,
    },
    watch: {
      text: "Watch",
      textColor: "text-amber-700 dark:text-amber-400",
      stroke: "#f59e0b",
      trackStroke: "hsl(38 92% 50% / 0.2)",
      fill: "hsl(38 92% 50% / 0.08)",
      arc: 0.6,
    },
    action: {
      text: "Action needed",
      textColor: "text-red-700 dark:text-red-400",
      stroke: "#ef4444",
      trackStroke: "hsl(0 72% 52% / 0.2)",
      fill: "hsl(0 72% 52% / 0.08)",
      arc: 0.3,
    },
  };

  const { text, textColor, stroke, trackStroke, fill, arc } = config[status];
  const pillRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (pillRef.current) {
      const { offsetWidth, offsetHeight } = pillRef.current;
      setDims({ w: offsetWidth, h: offsetHeight });
    }
  }, [text]);

  const sw = 2.5;
  const rx = dims.h / 2;
  const ry = dims.h / 2;
  const innerW = dims.w - sw;
  const innerH = dims.h - sw;
  const innerRx = Math.max(0, rx - sw / 2);
  const innerRy = Math.max(0, ry - sw / 2);

  const getPerimeter = () => {
    if (innerW <= 0 || innerH <= 0) return 0;
    const straightH = innerW - 2 * innerRx;
    const straightV = innerH - 2 * innerRy;
    const curveApprox = Math.PI * (3 * (innerRx + innerRy) - Math.sqrt((3 * innerRx + innerRy) * (innerRx + 3 * innerRy))) / 2;
    return 2 * straightH + 2 * straightV + 2 * curveApprox;
  };

  const perimeter = getPerimeter();
  const dashOffset = perimeter * (1 - arc);
  const pulseClass = status === "action" ? "animate-pulse" : "";

  return (
    <div className={`relative inline-flex ${pulseClass}`} data-testid="status-indicator">
      <div
        ref={pillRef}
        className="relative inline-flex min-w-[5.5rem] items-center justify-center whitespace-nowrap px-4 py-1 sm:min-w-[6rem] sm:px-4"
        style={{ background: fill, borderRadius: `${rx}px` }}
      >
        <span className={`text-xs font-semibold ${textColor}`} data-testid="text-status">
          {text}
        </span>
        {dims.w > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={dims.w}
            height={dims.h}
            viewBox={`0 0 ${dims.w} ${dims.h}`}
          >
            <rect
              x={sw / 2}
              y={sw / 2}
              width={innerW}
              height={innerH}
              rx={innerRx}
              ry={innerRy}
              fill="none"
              stroke={trackStroke}
              strokeWidth={sw}
            />
            <rect
              x={sw / 2}
              y={sw / 2}
              width={innerW}
              height={innerH}
              rx={innerRx}
              ry={innerRy}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={perimeter}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
        )}
      </div>
    </div>
  );
}

function DashboardInfoDialog() {
  return (
    <PageInfoDialog
      title="About Your Dashboard"
      description="Your personal diabetes command centre"
    >
      <InfoSection title="Customise your view">
        <p>Tap the layout button to edit widgets. You can show or hide cards and drag them into the order you prefer. Your layout is saved on this device.</p>
      </InfoSection>
      <InfoSection title="Reordering">
        <p>In the widget editor, drag the handle beside each row to change order. On tablets and larger screens, you can also switch some widgets between full and half width.</p>
      </InfoSection>
      <InfoSection title="Status Indicator">
        <p>The status shows your overall diabetes situation. Green means stable, amber means watch, and red means action is needed.</p>
      </InfoSection>
      <InfoSection title="Quick Navigation">
        <p>Click the Diabeaters logo in the navigation bar to return to the dashboard from any page.</p>
      </InfoSection>
      <InfoSection title="Help Now Button">
        <p>The red Help Now button gives you instant access to emergency resources, contacts, and guidance for urgent situations.</p>
      </InfoSection>
    </PageInfoDialog>
  );
}

function HeroCard({
  status,
  profile,
  cloudFullName,
  onEditWidgets,
}: {
  status: HealthStatus;
  profile: UserProfile | null;
  cloudFullName: string | null;
  onEditWidgets: () => void;
}) {
  const { user } = useAuth();
  const isUrgent = status === "action";
  const { toast } = useToast();
  const [hypoDialogOpen, setHypoDialogOpen] = useState(false);
  const [hypoGlucose, setHypoGlucose] = useState("");
  const [hypoTreatment, setHypoTreatment] = useState("");
  const [hypoNotes, setHypoNotes] = useState("");
  const [showHypoHistory, setShowHypoHistory] = useState(false);
  const [hypoHistory, setHypoHistory] = useState<HypoTreatment[]>([]);
  const [quickHypoConfirmOpen, setQuickHypoConfirmOpen] = useState(false);
  const bgUnitsLabel: "mmol/L" | "mg/dL" =
    profile?.bgUnits === "mg/dL" ? "mg/dL" : "mmol/L";
  const glucoseStep = bgUnitsLabel === "mg/dL" ? "1" : "0.1";
  const glucosePlaceholder = bgUnitsLabel === "mg/dL" ? "e.g., 58" : "e.g., 3.2";

  useEffect(() => {
    if (hypoDialogOpen) {
      setHypoHistory(storage.getHypoTreatments());
      setShowHypoHistory(false);
    }
  }, [hypoDialogOpen]);

  const handleLogHypo = () => {
    void runHypoTreatmentPipeline(
      { glucoseInput: hypoGlucose, treatment: hypoTreatment, notes: hypoNotes },
      {
        userId: user?.id,
        toast,
        onAfterLocalSave: () => {
          setHypoDialogOpen(false);
          setHypoGlucose("");
          setHypoTreatment("");
          setHypoNotes("");
          setHypoHistory(storage.getHypoTreatments());
        },
      },
    );
  };

  const handleTreatedHypoClick = () => {
    if (storage.getNotificationSettings().hypoDashboardQuickNotify === true) {
      setQuickHypoConfirmOpen(true);
      return;
    }
    setHypoDialogOpen(true);
  };

  const confirmQuickHypo = () => {
    setQuickHypoConfirmOpen(false);
    void runHypoTreatmentPipeline(
      { glucoseInput: "", treatment: "", notes: "" },
      { userId: user?.id, toast },
    );
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const displayName = cloudFullName?.trim() || profile?.name?.trim() || "";
  const firstName = displayName.split(" ")[0] || "";

  return (
    <>
      <Card
        variant="glass-strong"
        className="dashboard-card-hover animate-soft-in overflow-hidden border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent shadow-md ring-1 ring-border/25 hover:shadow-lg hover:ring-primary/10 dark:border-primary/18 dark:from-primary/[0.09] dark:via-transparent dark:to-transparent dark:ring-border/35"
        data-testid="card-hero"
      >
        <CardContent className="p-4 md:p-6 space-y-4 md:space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="font-display text-lg font-semibold tracking-tight text-foreground text-balance sm:text-xl"
                  data-testid="text-greeting"
                >
                  {greeting()}
                  {firstName ? `, ${firstName}` : ""}
                </span>
                <StagingChip />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DashboardInfoDialog />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onEditWidgets}
                  className="min-h-10 min-w-10 sm:min-h-11 sm:min-w-11 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-200"
                  data-testid="button-customize"
                  aria-label="Customise dashboard widgets"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <p className="min-w-0 flex-1 truncate text-sm leading-relaxed text-muted-foreground">
                Here&apos;s your diabetes today
              </p>
              <div className="shrink-0" data-testid="wrap-dashboard-status-pill">
                <StatusPill status={status} />
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-nowrap items-stretch gap-2">
            <Link href="/help-now" className="min-w-0 flex-1">
              <Button
                variant="destructive"
                size="sm"
                className={[
                  "min-h-11 w-full min-w-0 rounded-2xl px-3 text-sm",
                  "bg-gradient-to-r from-red-600 to-red-500 dark:from-red-700 dark:to-red-600",
                  "shadow-sm shadow-red-600/10 ring-1 ring-red-500/25 hover:shadow-md hover:ring-red-500/35 active:translate-y-[0.5px]",
                  "transition-all",
                  isUrgent ? "glow-pulse-critical" : "",
                ].join(" ")}
                data-testid="button-help-now"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/15">
                  <Phone className="h-4 w-4 shrink-0" />
                </span>
                <span className="ml-2 font-semibold tracking-tight">Help Now</span>
              </Button>
            </Link>
            <Button
              size="sm"
              className={[
                "min-h-11 min-w-0 flex-1 rounded-2xl px-3 text-sm text-white",
                "bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-700 dark:to-green-700",
                "shadow-sm shadow-emerald-600/10 ring-1 ring-emerald-500/25 hover:shadow-md hover:ring-emerald-500/35 active:translate-y-[0.5px]",
                "transition-all",
              ].join(" ")}
              onClick={handleTreatedHypoClick}
              data-testid="button-dashboard-treated-hypo"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/15">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              </span>
              <span className="ml-2 font-semibold tracking-tight">Treated a Hypo</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={hypoDialogOpen} onOpenChange={setHypoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Log Hypo Treatment
            </DialogTitle>
            <DialogDescription>
              Record details about your hypo treatment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="dash-hypo-glucose">{`Blood glucose (${bgUnitsLabel}) — optional`}</Label>
              <Input
                id="dash-hypo-glucose"
                type="number"
                step={glucoseStep}
                placeholder={glucosePlaceholder}
                value={hypoGlucose}
                onChange={(e) => setHypoGlucose(e.target.value)}
                data-testid="input-dashboard-hypo-glucose"
              />
            </div>
            <div className="space-y-2">
              <Label>What did you take?</Label>
              <Select value={hypoTreatment} onValueChange={setHypoTreatment}>
                <SelectTrigger data-testid="select-dashboard-hypo-treatment">
                  <SelectValue placeholder="Select treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Glucose tablets">Glucose tablets</SelectItem>
                  <SelectItem value="Juice">Juice</SelectItem>
                  <SelectItem value="Sweets">Sweets</SelectItem>
                  <SelectItem value="Sugary drink">Sugary drink</SelectItem>
                  <SelectItem value="Gel">Glucose gel</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dash-hypo-notes">Notes (optional)</Label>
              <Input
                id="dash-hypo-notes"
                placeholder="e.g., Felt shaky before lunch"
                value={hypoNotes}
                onChange={(e) => setHypoNotes(e.target.value)}
                data-testid="input-dashboard-hypo-notes"
              />
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
              <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                Your hypo treatment is saved locally. When you are signed in with cloud enabled, we also save to your
                account and notify any linked supporters (push / in-app).
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 w-full gap-2 text-muted-foreground"
              onClick={() => setShowHypoHistory(!showHypoHistory)}
              data-testid="button-toggle-hypo-history"
            >
              <History className="h-4 w-4" />
              Previous Treatments ({hypoHistory.length})
              {showHypoHistory ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </Button>
            {showHypoHistory && (
              <div className="max-h-48 overflow-y-auto space-y-2" data-testid="list-hypo-history">
                {hypoHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">No treatments logged yet.</p>
                ) : (
                  hypoHistory.map((entry) => {
                    const date = new Date(entry.timestamp);
                    const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                    const dateStr = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                    return (
                      <div key={entry.id} className="flex items-start gap-3 p-2 rounded-md bg-muted/30 text-sm" data-testid={`item-hypo-${entry.id}`}>
                        <div className="text-muted-foreground text-xs whitespace-nowrap pt-0.5">
                          <div>{dateStr}</div>
                          <div>{timeStr}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.treatment && <Badge variant="secondary" className="text-xs">{entry.treatment}</Badge>}
                            {entry.glucoseLevel !== undefined && (
                              <span className="text-xs text-muted-foreground">{entry.glucoseLevel} {bgUnitsLabel}</span>
                            )}
                          </div>
                          {entry.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{entry.notes}</p>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHypoDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLogHypo} className="bg-green-600 dark:bg-green-700 gap-2" data-testid="button-dashboard-confirm-hypo">
              <CheckCircle2 className="h-4 w-4" />
              Log Treatment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={quickHypoConfirmOpen} onOpenChange={setQuickHypoConfirmOpen}>
        <AlertDialogContent data-testid="dialog-quick-hypo-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Log treated hypo and tell supporters?</AlertDialogTitle>
            <AlertDialogDescription>
              This logs a hypo treatment now and notifies any linked supporters. You can turn off
              quick-notify in Settings → Notifications if you would rather add details first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-quick-hypo-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              onClick={confirmQuickHypo}
              data-testid="button-quick-hypo-confirm"
            >
              Log + tell supporters
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <PageShell variant="wide" density="compact" className="animate-fade-in">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-56 skeleton-shimmer" />
              <Skeleton className="h-3 w-40 skeleton-shimmer" />
            </div>
            <Skeleton className="h-7 w-20 rounded-full skeleton-shimmer" />
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 flex-1 rounded-full skeleton-shimmer" />
        <Skeleton className="h-8 w-[7.5rem] rounded-full skeleton-shimmer" />
        <Skeleton className="h-8 w-8 rounded-full skeleton-shimmer" />
        <Skeleton className="h-8 w-8 rounded-md skeleton-shimmer" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 skeleton-shimmer" />
        <Card className="border-border/70 shadow-sm">
          <CardContent className="space-y-2 p-3">
            <Skeleton className="h-14 w-full rounded-md skeleton-shimmer" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="space-y-2 p-3">
              <Skeleton className="h-4 w-28 skeleton-shimmer" />
              <Skeleton className="h-12 w-full rounded-md skeleton-shimmer" />
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardContent className="space-y-2 p-3">
              <Skeleton className="h-4 w-28 skeleton-shimmer" />
              <Skeleton className="h-12 w-full rounded-md skeleton-shimmer" />
            </CardContent>
          </Card>
        </div>
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
      className="animate-fade-in-up rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5 sm:px-4"
      data-testid="banner-soft-setup-nudge"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
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
            className="h-8 w-8"
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

function SetupPromptCard({ completion }: { completion: { percentage: number; completed: number; total: number } }) {
  return (
    <Card className="dashboard-card-hover rounded-xl border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/30 glow-warning shadow-sm hover:shadow-md transition-shadow duration-200" data-testid="card-setup-prompt">
      <CardContent className="space-y-3 p-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h3 className="font-display text-h3 font-semibold tracking-tight">Complete Your Setup</h3>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {completion.completed}/{completion.total}
          </Badge>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Setup progress</span>
            <span className="font-medium">{completion.percentage}%</span>
          </div>
          <Progress value={completion.percentage} className="h-2" />
        </div>

        <p className="text-sm text-muted-foreground">
          Complete your settings to unlock all features and get personalized recommendations.
        </p>
        
        <Link href="/settings">
          <Button className="w-full gradient-primary border-primary-border" data-testid="button-complete-setup">
            Complete Settings
            <ArrowRight className="h-4 w-4 ml-2" />
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

    refreshData();
    if (getSupabase()) {
      void repairSickDayCloudIfLocalInactive();
    }
    const timer = setTimeout(() => setIsLoading(false), 400);

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

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onSettingsChanged);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(DIABEATER_SETTINGS_CHANGED_EVENT, onSettingsChanged);
      window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onSettingsChanged);
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

  const mode = getActiveAppMode();
  const isCommunityDash =
    isCommunityAccountProfile(profile) && mode !== "patient" && mode !== "carer";

  const inOnboardingSetupGrace = isWithinOnboardingPostFinishGracePeriod(ONBOARDING_SETUP_GRACE_DAYS);
  const showSoftSetupNudge =
    !isCommunityDash && !isSettingsComplete && inOnboardingSetupGrace && !softSetupNudgeDismissed;
  const showFullSetupPrompt =
    !isCommunityDash && !isSettingsComplete && !inOnboardingSetupGrace;

  // SetupPromptCard covers incomplete setup; never show the settings-completion widget in the grid (avoids empty slot when complete).
  const showCommunityQuickPostWidget =
    isCommunityEnabled && !cloudProfileLoading && cloudProfile?.is_public === true;
  const communityDashWidgetAllow = new Set(["community-quick-post", "tip-of-day", "pharmacy"]);
  const widgetsToRender = activeWidgets
    .filter((w) => w.type !== "settings-completion")
    .filter((w) => w.type !== "community-quick-post" || showCommunityQuickPostWidget)
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
            {isCommunityDash ? "Explore education and the community" : "Your daily overview"}
          </span>
        }
      />
      {/* Today: high-signal cluster (reads as one section) */}
      <section className="space-y-4" data-testid="dashboard-today">
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
                className="h-8 w-8 -mt-1 -mr-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-200"
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
          <div className="animate-fade-in" style={{ animationDelay: "30ms" }}>
            <HeroCard
              status={healthStatus}
              profile={profile}
              cloudFullName={cloudProfile?.full_name ?? null}
              onEditWidgets={() => setWidgetsDialogOpen(true)}
            />
          </div>
        ) : null}

        {!isCommunityDash ? (
          <section className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
            <WelcomeWidget />
          </section>
        ) : null}

        <CoachEntryCard />

        {!isCommunityDash ? <SupplyTrackerTodaySection /> : null}

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
        placements={placements}
        toggleWidget={toggleWidget}
        setWidgetSize={setWidgetSize}
        reorderWidgets={reorderWidgets}
        resetWidgets={resetWidgets}
        isSettingsComplete={isSettingsComplete}
        allowResize={!isMobile}
      />

      <section className="animate-stagger space-y-4 pt-2" data-testid="dashboard-widgets">
        {widgetsToRender.length > 0 ? <PageSectionLabel>Your widgets</PageSectionLabel> : null}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {widgetsToRender.map((w) => {
            const Comp = w.Component;
            if (!Comp) return null;
            return (
              <div
                key={w.id}
                data-testid={`widget-container-${w.type}`}
                className={isMobile || w.size === "full" ? "md:col-span-2" : undefined}
              >
                <Comp layoutSize={isMobile ? "full" : w.size} />
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
