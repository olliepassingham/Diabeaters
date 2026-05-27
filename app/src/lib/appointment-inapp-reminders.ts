import {
  appointmentReminderTimes,
  inAppReminderDedupeKey,
  parseAppointmentScheduledAt,
  reminderCopy,
  type AppointmentReminderKind,
} from "@/lib/appointment-reminder-schedule";
import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import { showIosSystemNotificationNow } from "@/lib/ios-system-notifications";
import { getSupabase } from "@/lib/supabase";
import { getAppointmentsStorageKeyForUserId, storage, type Appointment } from "@/lib/storage";

const SENT_KEYS_STORAGE = "diabeater_appt_inapp_reminder_sent_v2";
const MAX_KEYS = 400;

function loadSentKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SENT_KEYS_STORAGE);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveSentKeys(keys: Set<string>) {
  try {
    const arr = [...keys].slice(-MAX_KEYS);
    localStorage.setItem(SENT_KEYS_STORAGE, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

function reminderKindsDueNow(
  scheduledAt: Date,
  now: Date,
): AppointmentReminderKind[] {
  const { eveningBefore, twoHoursBefore } = appointmentReminderTimes(scheduledAt);
  const due: AppointmentReminderKind[] = [];
  if (now >= eveningBefore && now < scheduledAt) {
    due.push("evening_before");
  }
  if (now >= twoHoursBefore && now < scheduledAt) {
    due.push("two_hours_before");
  }
  return due;
}

/**
 * Inserts in-app notifications for appointment reminders (evening before + 2h before)
 * when the app is open and each window has started. Deduped per appointment, kind, and date/time.
 */
export async function ensureAppointmentInAppRemindersForUser(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUid = sessionData.session?.user?.id;
  if (!sessionUid || sessionUid !== userId) return;

  const settings = storage.getNotificationSettings();
  if (!settings.enabled || !settings.appointmentReminders) return;

  const apptKey = getAppointmentsStorageKeyForUserId(userId);
  const raw = (() => {
    try {
      return localStorage.getItem(apptKey);
    } catch {
      return null;
    }
  })();
  const appointments: Appointment[] = raw ? (JSON.parse(raw) as Appointment[]) : [];

  const now = new Date();
  const sent = loadSentKeys();
  let anyInserted = false;

  for (const a of appointments) {
    if (a.isCompleted || a.deletedAt) continue;
    const scheduledAt = parseAppointmentScheduledAt(a.date, a.time);
    if (!scheduledAt || scheduledAt <= now) continue;

    const kinds = reminderKindsDueNow(scheduledAt, now);

    for (const kind of kinds) {
      const key = inAppReminderDedupeKey(a, kind);
      if (sent.has(key)) continue;

      const { title, body } = reminderCopy(a, kind);

      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title,
        body,
        data: {
          kind: "appointment_reminder",
          appointment_id: a.id,
          reminder_kind: kind,
          deep_link: "/appointments",
        },
        read: false,
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.warn("[appointment-inapp-reminders] insert failed:", error.message);
        }
        continue;
      }

      void showIosSystemNotificationNow({
        title,
        body,
        deepLink: "/appointments",
        tag: `inapp:appointment:${key}`,
      });

      sent.add(key);
      anyInserted = true;
    }
  }

  if (anyInserted) {
    saveSentKeys(sent);
    notifyInAppNotificationsChanged({ skipPageRefresh: true });
  }
}
