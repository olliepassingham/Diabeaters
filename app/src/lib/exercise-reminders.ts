import { LocalNotifications } from "@capacitor/local-notifications";

import { ensureNativeLocalNotificationPermission } from "@/lib/native-local-notifications";
import { androidNotificationChannel, supportsNativeLocalNotifications } from "@/lib/native-platform";
import { getWorkoutElapsedMs } from "@/lib/exercise-session-timing";
import { storage, type ActiveExerciseSession } from "@/lib/storage";

export type ExerciseReminderKind =
  | "start_soon"
  | "start_now"
  | "mid_check"
  | "finish_now"
  | "recovery_check_30m";

function notificationId(sessionId: string, kind: ExerciseReminderKind): number {
  const hex = (sessionId + kind).replace(/-/g, "").slice(0, 8);
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? (n % 2_000_000_000) : Math.floor(Math.random() * 1_000_000_000);
}

function copyFor(kind: ExerciseReminderKind, exerciseName: string): { title: string; body: string } {
  if (kind === "start_soon") {
    return {
      title: "Exercise: starting soon",
      body: `${exerciseName} — do a quick glucose check and have fast carbs ready.`,
    };
  }
  if (kind === "start_now") {
    return {
      title: "Exercise: start",
      body: `${exerciseName} — start when ready. Keep fast carbs and your hypo treatment nearby.`,
    };
  }
  if (kind === "mid_check") {
    return {
      title: "Exercise: check in",
      body: "Quick mid-session check: how do you feel? If you can, recheck glucose.",
    };
  }
  if (kind === "finish_now") {
    return {
      title: "Exercise: finishing",
      body: "Workout time is up — consider a glucose check and start your recovery window.",
    };
  }
  return {
    title: "Exercise: recovery check",
    body: "Recovery check: delayed lows can happen. Consider a glucose check and a carb/protein snack if needed.",
  };
}

function exerciseAndroidChannel(): { channelId?: string } {
  return androidNotificationChannel("diabeaters_exercise");
}

const EXERCISE_DEEP_LINK = "/scenarios/exercise";

function exerciseReminderExtra(sessionId: string, kind: ExerciseReminderKind) {
  return {
    exercise_session_id: sessionId,
    kind,
    deep_link: EXERCISE_DEEP_LINK,
  };
}

async function ensureReminderPermission(): Promise<boolean> {
  return ensureNativeLocalNotificationPermission();
}

const ALL_REMINDER_KINDS: ExerciseReminderKind[] = [
  "start_soon",
  "start_now",
  "mid_check",
  "finish_now",
  "recovery_check_30m",
];

const ACTIVE_PHASE_REMINDER_KINDS: ExerciseReminderKind[] = ["start_soon", "start_now", "mid_check", "finish_now"];

async function cancelReminderKinds(sessionId: string, kinds: ExerciseReminderKind[]): Promise<void> {
  if (!supportsNativeLocalNotifications()) return;
  try {
    await LocalNotifications.cancel({
      notifications: kinds.map((kind) => ({ id: notificationId(sessionId, kind) })),
    });
  } catch {
    // ignore
  }
}

/** Cancels every reminder for a session — used when a session ends entirely. */
export async function cancelExerciseReminders(sessionId: string): Promise<void> {
  await cancelReminderKinds(sessionId, ALL_REMINDER_KINDS);
}

/**
 * Cancels only the pre/active-phase reminders (start, mid-check, finish), leaving the
 * recovery check alone. Use this on finish/auto-finish, then call
 * {@link scheduleExerciseRecoveryReminder} to (re)anchor the recovery check to the real
 * end time — previously `cancelExerciseReminders` wiped out the recovery reminder too,
 * so it silently never fired for sessions that finished early or late.
 */
export async function cancelExerciseActiveReminders(sessionId: string): Promise<void> {
  await cancelReminderKinds(sessionId, ACTIVE_PHASE_REMINDER_KINDS);
}

export async function scheduleExercisePreReminders(session: ActiveExerciseSession, minutesUntilStart: number): Promise<void> {
  const ok = await ensureReminderPermission();
  if (!ok) return;

  const nowMs = Date.now();
  const startMs = nowMs + Math.max(0, minutesUntilStart) * 60_000;
  const soonMs = startMs - 10 * 60_000;

  const notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date }; extra: any }> = [];

  if (soonMs > nowMs + 60_000) {
    const c = copyFor("start_soon", session.exerciseName);
    notifications.push({
      id: notificationId(session.id, "start_soon"),
      title: c.title,
      body: c.body,
      schedule: { at: new Date(soonMs) },
      extra: exerciseReminderExtra(session.id, "start_soon"),
      ...exerciseAndroidChannel(),
    });
  }

  if (startMs > nowMs + 30_000) {
    const c = copyFor("start_now", session.exerciseName);
    notifications.push({
      id: notificationId(session.id, "start_now"),
      title: c.title,
      body: c.body,
      schedule: { at: new Date(startMs) },
      extra: exerciseReminderExtra(session.id, "start_now"),
      ...exerciseAndroidChannel(),
    });
  }

  if (notifications.length === 0) return;
  try {
    await cancelExerciseReminders(session.id);
    await LocalNotifications.schedule({ notifications });
  } catch {
    // Native plugin failures must not surface as unhandled rejections from void fire-and-forget callers.
  }
}

export async function scheduleExerciseActiveReminders(session: ActiveExerciseSession): Promise<void> {
  const ok = await ensureReminderPermission();
  if (!ok) return;
  if (!session.exerciseStartedAt) return;
  // Don't schedule while paused — resume will re-anchor from remaining effective time.
  if (session.pausedAt) return;

  const nowMs = Date.now();
  const durationMs = session.durationMinutes * 60_000;
  const elapsedMs = getWorkoutElapsedMs(session, nowMs);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const midTargetMs = Math.floor(durationMs * 0.5);
  const midRemainingMs = midTargetMs - elapsedMs;

  const finishMs = nowMs + remainingMs;
  const recoveryMs = finishMs + 30 * 60_000;

  const toSchedule: Array<{ kind: ExerciseReminderKind; atMs: number }> = [
    { kind: "finish_now", atMs: finishMs },
    { kind: "recovery_check_30m", atMs: recoveryMs },
  ];
  if (midRemainingMs > 30_000) {
    toSchedule.unshift({ kind: "mid_check", atMs: nowMs + midRemainingMs });
  }

  const notifications = toSchedule
    .filter((x) => x.atMs > nowMs + 30_000)
    .map((x) => {
      const c = copyFor(x.kind, session.exerciseName);
      return {
        id: notificationId(session.id, x.kind),
        title: c.title,
        body: c.body,
        schedule: { at: new Date(x.atMs) },
        extra: exerciseReminderExtra(session.id, x.kind),
        ...exerciseAndroidChannel(),
      };
    });

  // Cancel-before-schedule keeps this idempotent — calling it twice for the same
  // session (e.g. a re-render re-triggering the "Start" handler) must not leave stale
  // reminders anchored to the previous call's timestamps.
  await cancelReminderKinds(session.id, ["mid_check", "finish_now", "recovery_check_30m"]);

  if (notifications.length === 0) return;
  try {
    await LocalNotifications.schedule({ notifications });
  } catch {
    // ignore
  }
}

/**
 * (Re)anchors the recovery check to the real end time rather than the originally
 * planned finish time — a workout that ends early or late (or is auto-finished) should
 * still get a recovery reminder 30 minutes after it *actually* ended. When bedtime is
 * sooner than that, the reminder is pulled in so it still lands before sleep.
 */
export async function scheduleExerciseRecoveryReminder(
  session: ActiveExerciseSession,
  endedAtMs: number,
  bedtimeInHours?: number | null,
): Promise<void> {
  const ok = await ensureReminderPermission();
  if (!ok) return;

  const nowMs = Date.now();
  const defaultDelayMs = 30 * 60_000;
  const bedtimeDelayMs =
    typeof bedtimeInHours === "number" && Number.isFinite(bedtimeInHours) && bedtimeInHours >= 0
      ? Math.max(5, bedtimeInHours * 60) * 60_000
      : null;
  const delayMs = bedtimeDelayMs != null ? Math.min(defaultDelayMs, bedtimeDelayMs) : defaultDelayMs;
  const atMs = endedAtMs + delayMs;

  await cancelReminderKinds(session.id, ["recovery_check_30m"]);
  if (atMs <= nowMs + 30_000) return;

  const c = copyFor("recovery_check_30m", session.exerciseName);
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId(session.id, "recovery_check_30m"),
          title: c.title,
          body: c.body,
          schedule: { at: new Date(atMs) },
          extra: exerciseReminderExtra(session.id, "recovery_check_30m"),
          ...exerciseAndroidChannel(),
        },
      ],
    });
  } catch {
    // ignore
  }
}

