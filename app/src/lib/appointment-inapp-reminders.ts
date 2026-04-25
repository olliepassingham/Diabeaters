import { format } from "date-fns";

import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import { getSupabase } from "@/lib/supabase";
import { getAppointmentsStorageKeyForUserId, storage, type Appointment } from "@/lib/storage";
import { showIosSystemNotificationNow } from "@/lib/ios-system-notifications";

const SENT_KEYS_STORAGE = "diabeater_appt_inapp_reminder_sent_v1";
const MAX_KEYS = 400;

function parseScheduledAt(a: Appointment): Date | null {
  if (!a.date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a.date);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  let hh = 12;
  let mm = 0;
  const t = (a.time || "09:00").trim();
  const tm = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (tm) {
    hh = Number(tm[1]);
    mm = Number(tm[2]);
  }
  const d = new Date(year, month - 1, day, hh, mm, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dedupeKey(a: Appointment): string {
  return `${a.id}|${a.date}|${a.time ?? ""}`;
}

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

/**
 * Inserts one in-app notification per upcoming appointment when inside the 24h-before window * (matches local iOS reminder intent). Deduped per appointment date/time. Requires notifications INSERT RLS.
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

  for (const a of appointments) {
    if (a.isCompleted || a.deletedAt) continue;
    const scheduledAt = parseScheduledAt(a);
    if (!scheduledAt || scheduledAt <= now) continue;

    const remindAt = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    if (now < remindAt) continue;

    const key = dedupeKey(a);
    if (sent.has(key)) continue;

    const dateLabel = format(scheduledAt, "EEE d MMM");
    const timePart = a.time?.trim() ? ` · ${a.time.trim()}` : "";
    const title = "Appointment reminder";
    const body = `${a.title} · ${dateLabel}${timePart}`;

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      title,
      body,
      data: {
        kind: "appointment_reminder",
        appointment_id: a.id,
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
    saveSentKeys(sent);
    notifyInAppNotificationsChanged({ skipPageRefresh: true });
  }
}
