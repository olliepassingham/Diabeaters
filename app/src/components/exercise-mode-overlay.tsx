import { useEffect, useMemo, useState } from "react";
import { Activity, CircleCheck, Droplet, Loader2, Minus, Pause, Play, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRAND_MARK_IMAGE_SRC } from "@/lib/brand-mark";
import {
  storage,
  DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT,
  type ActiveExerciseSession,
  type UserProfile,
} from "@/lib/storage";
import { EXERCISE_MODE_OPEN_EVENT } from "@/lib/exercise-mode-deep-link";
import { useExerciseSessionActions } from "@/hooks/use-exercise-session-actions";
import { useBgPrefill } from "@/hooks/use-bg-prefill";
import { EXERCISE_LIVE_CGM_POLL_MS } from "@/lib/exercise-live-cgm-sync";
import { readCgmPreferences, hasLiveCgmCredentials } from "@/lib/cgm/preferences";
import { cgmTrendForExercise } from "@/lib/cgm/apply-cgm-trend";
import { formatAgeMinutes } from "@/lib/cgm/staleness";
import { liveCgmConnectMessage } from "@/lib/cgm/live-cgm-source";
import { normalizeBgUnits } from "@/lib/alcohol-night-tool";
import { buildExercisePlanContextFromCoachSession } from "@/lib/exercise-coach-plan-context";
import { calculateExercisePlan } from "@/lib/exercise-plan";
import { computeExerciseHypoSuggestion } from "@/lib/exercise-hypo-auto";
import { formatExerciseElapsedShort } from "@/components/exercise-active-session-extras";
import { getWorkoutElapsedMs, isExercisePaused } from "@/lib/exercise-session-timing";

function trendIcon(trend: "rising" | "falling" | "flat" | undefined) {
  if (trend === "rising") return TrendingUp;
  if (trend === "falling") return TrendingDown;
  if (trend === "flat") return Minus;
  return null;
}

/**
 * Full-screen "glance" view for the active phase of a workout — duration, BG + direction
 * (when a near-live source is connected), and carbs-if-low guidance. Nothing else.
 *
 * Split into a thin always-mounted host (`ExerciseModeOverlay`) and this heavier content
 * component so live BG polling and the 1s timer only run while the overlay is actually open,
 * not for every authenticated user on every page.
 */
function ExerciseModeContent({
  session,
  onClose,
}: {
  session: ActiveExerciseSession;
  onClose: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const sessionActions = useExerciseSessionActions();

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Full-bleed takeover — lock the page behind it from scrolling while this is up.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const profile: Partial<UserProfile> = storage.getProfile() ?? {};
  const settings = storage.getSettings();
  const bgUnits = normalizeBgUnits(profile.bgUnits);

  const { prefill, loading } = useBgPrefill({ pollIntervalMs: EXERCISE_LIVE_CGM_POLL_MS });
  const nearLiveConnected = useMemo(() => hasLiveCgmCredentials(readCgmPreferences()), []);

  const reading = prefill?.fromCgm ? prefill.reading : undefined;
  const usableTrend = reading ? cgmTrendForExercise(reading.trend) : undefined;
  const showTrendArrow = nearLiveConnected && !!usableTrend;
  const TrendIcon = trendIcon(usableTrend);

  const hypoSuggestion = useMemo(() => {
    if (!reading) return null;
    try {
      const ctx = buildExercisePlanContextFromCoachSession({
        session,
        bgUnits,
        currentBg: reading.value,
        bgTrend: usableTrend ?? null,
      });
      const plan = calculateExercisePlan(ctx, settings);
      const lowThreshold = parseFloat(plan.pre.lowThreshold);
      return computeExerciseHypoSuggestion(reading.value, settings, bgUnits, profile, {
        trend: usableTrend ?? null,
        phase: "active",
        exerciseLowThreshold: Number.isFinite(lowThreshold) ? lowThreshold : undefined,
        carbsIfLow: plan.pre.carbsIfLow,
      });
    } catch {
      return null;
    }
    // profile/settings are cheap synchronous storage reads re-taken each render; only the
    // values that actually change what we compute need to be listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, bgUnits, reading, usableTrend]);

  const elapsedMs = getWorkoutElapsedMs(session, nowMs);
  const totalMs = Math.max(60_000, session.durationMinutes * 60_000);
  const pct = Math.min(100, (elapsedMs / totalMs) * 100);
  const isOvertime = elapsedMs > totalMs;
  const paused = isExercisePaused(session);
  const remainingMin = isOvertime
    ? Math.ceil((elapsedMs - totalMs) / 60_000)
    : Math.max(0, Math.ceil((totalMs - elapsedMs) / 60_000));

  const onFinish = () => {
    sessionActions.finishWorkout();
    onClose();
  };

  const onPauseToggle = () => {
    if (paused) sessionActions.resumeWorkout();
    else sessionActions.pauseWorkout();
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex flex-col overflow-hidden bg-neutral-950 text-white [padding-top:max(1.25rem,env(safe-area-inset-top))] [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-label="Exercise mode"
      data-testid="exercise-mode-overlay"
    >
      {/* Decorative only — a soft brand-coloured glow and grain-free gradient instead of flat black. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black"
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700",
          hypoSuggestion ? "bg-amber-500/[0.14]" : "bg-emerald-400/[0.12]",
        )}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/60 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
          <img
            src={BRAND_MARK_IMAGE_SRC}
            alt=""
            aria-hidden
            className="h-3 w-3 opacity-80"
            style={{ filter: "invert(1)" }}
          />
          Diabeaters
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 px-6 text-sm font-medium uppercase tracking-wide text-white/55">
          <Activity className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{session.exerciseName}</span>
          {paused ? (
            <span
              className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-200"
              data-testid="badge-exercise-mode-paused"
            >
              Paused
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-6">
          <div className="w-full max-w-xs space-y-3 text-center">
            <p
              className={cn(
                "text-6xl font-bold tabular-nums tracking-tight",
                paused
                  ? "text-white/70"
                  : "[text-shadow:0_0_32px_rgba(16,185,129,0.25)]",
              )}
              data-testid="text-exercise-mode-elapsed"
            >
              {formatExerciseElapsedShort(elapsedMs)}
            </p>
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    paused ? "bg-white/40" : isOvertime ? "bg-amber-400" : "bg-emerald-400",
                  )}
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  data-testid="progress-exercise-mode"
                />
              </div>
              <p
                className={cn(
                  "text-xs font-medium",
                  paused ? "text-amber-200/80" : isOvertime ? "text-amber-300" : "text-white/50",
                )}
              >
                {paused
                  ? "Timer paused"
                  : isOvertime
                    ? `+${remainingMin} min over planned`
                    : `~${remainingMin} min left of ${session.durationMinutes} min`}
              </p>
            </div>
          </div>

          <div
            className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-sm"
            data-testid="exercise-mode-bg-card"
          >
            {loading && !reading ? (
              <p className="flex items-center justify-center gap-2 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Checking BG…
              </p>
            ) : reading ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold tabular-nums tracking-tight">{reading.value}</span>
                  <span className="text-base font-medium text-white/50">{reading.units}</span>
                  {showTrendArrow && TrendIcon ? (
                    <TrendIcon className="h-6 w-6 text-white/70" aria-hidden />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-white/40">
                  {formatAgeMinutes(reading.ageMinutes)} ago{reading.sourceLabel ? ` · ${reading.sourceLabel}` : ""}
                </p>
                {!nearLiveConnected ? (
                  <p className="mt-2 text-[11px] leading-snug text-white/35">{liveCgmConnectMessage()}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-white/40">No recent reading</p>
            )}
          </div>

          {hypoSuggestion ? (
            <div
              className="w-full max-w-xs rounded-2xl border border-amber-400/30 bg-amber-500/15 px-5 py-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-sm"
              data-testid="exercise-mode-hypo-hint"
            >
              <div className="flex items-center justify-center gap-1.5 text-amber-200">
                <Droplet className="h-4 w-4" aria-hidden />
                <p className="text-sm font-semibold">
                  {hypoSuggestion.clinicalHypo ? "Reading looks low" : "Treat now"}
                </p>
              </div>
              <p className="mt-1 text-sm leading-snug text-amber-100/90">
                Take about <strong className="font-semibold">{hypoSuggestion.carbsGrams}g</strong> fast carbs now, then
                recheck.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 px-6">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12 w-full rounded-2xl border-white/20 bg-white/5 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
            onClick={onPauseToggle}
            data-testid={paused ? "button-exercise-mode-resume" : "button-exercise-mode-pause"}
          >
            {paused ? (
              <>
                <Play className="mr-2 h-5 w-5" aria-hidden />
                Resume
              </>
            ) : (
              <>
                <Pause className="mr-2 h-5 w-5" aria-hidden />
                Pause
              </>
            )}
          </Button>
          <Button
            type="button"
            size="lg"
            className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-neutral-950 hover:bg-white/90"
            onClick={onFinish}
            data-testid="button-exercise-mode-finish"
          >
            <CircleCheck className="mr-2 h-5 w-5" aria-hidden />
            Finish workout
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Always-mounted host — listens for {@link EXERCISE_MODE_OPEN_EVENT} and the active-exercise
 * change event, but renders nothing (and does no BG polling) unless a session is genuinely
 * `"active"` and the overlay has been opened. Auto-closes the moment the session leaves the
 * active phase (Finish → recovery, or End), matching the "only way out is finishing" design.
 */
export function ExerciseModeOverlay() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<ActiveExerciseSession | null>(() => storage.getActiveExercise());

  useEffect(() => {
    const onRequestOpen = () => setOpen(true);
    window.addEventListener(EXERCISE_MODE_OPEN_EVENT, onRequestOpen);
    return () => window.removeEventListener(EXERCISE_MODE_OPEN_EVENT, onRequestOpen);
  }, []);

  useEffect(() => {
    const sync = () => setSession(storage.getActiveExercise());
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (session?.phase !== "active") setOpen(false);
  }, [session?.phase]);

  if (!open || !session || session.phase !== "active") return null;

  return <ExerciseModeContent session={session} onClose={() => setOpen(false)} />;
}
