import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

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

async function ensureIosPerm(): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return false;
    const settings = storage.getNotificationSettings();
    if (!settings.enabled) return false;
    const perm = await LocalNotifications.requestPermissions();
    return perm.display === "granted";
  } catch {
    return false;
  }
}

export async function cancelExerciseReminders(sessionId: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: notificationId(sessionId, "start_soon") },
        { id: notificationId(sessionId, "start_now") },
        { id: notificationId(sessionId, "mid_check") },
        { id: notificationId(sessionId, "finish_now") },
        { id: notificationId(sessionId, "recovery_check_30m") },
      ],
    });
  } catch {
    // ignore
  }
}

export async function scheduleExercisePreReminders(session: ActiveExerciseSession, minutesUntilStart: number): Promise<void> {
  const ok = await ensureIosPerm();
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
      extra: { exercise_session_id: session.id, kind: "start_soon" },
    });
  }

  if (startMs > nowMs + 30_000) {
    const c = copyFor("start_now", session.exerciseName);
    notifications.push({
      id: notificationId(session.id, "start_now"),
      title: c.title,
      body: c.body,
      schedule: { at: new Date(startMs) },
      extra: { exercise_session_id: session.id, kind: "start_now" },
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
  const ok = await ensureIosPerm();
  if (!ok) return;
  if (!session.exerciseStartedAt) return;

  const startedMs = new Date(session.exerciseStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return;

  const nowMs = Date.now();
  const durationMs = session.durationMinutes * 60_000;
  const midMs = startedMs + Math.floor(durationMs * 0.5);
  const finishMs = startedMs + durationMs;
  const recoveryMs = finishMs + 30 * 60_000;

  const toSchedule: Array<{ kind: ExerciseReminderKind; atMs: number }> = [
    { kind: "mid_check", atMs: midMs },
    { kind: "finish_now", atMs: finishMs },
    { kind: "recovery_check_30m", atMs: recoveryMs },
  ];

  const notifications = toSchedule
    .filter((x) => x.atMs > nowMs + 30_000)
    .map((x) => {
      const c = copyFor(x.kind, session.exerciseName);
      return {
        id: notificationId(session.id, x.kind),
        title: c.title,
        body: c.body,
        schedule: { at: new Date(x.atMs) },
        extra: { exercise_session_id: session.id, kind: x.kind },
      };
    });

  if (notifications.length === 0) return;
  try {
    await LocalNotifications.schedule({ notifications });
  } catch {
    // ignore
  }
}

