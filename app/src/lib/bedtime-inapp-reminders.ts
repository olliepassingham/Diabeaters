import { format, startOfDay } from "date-fns";

import {
  bedtimeInAppDedupeKey,
  bedtimeReminderCopy,
  DEFAULT_BEDTIME_REMINDER_TIME,
  isBedtimeReminderDueNow,
} from "@/lib/bedtime-reminder-schedule";
import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import { showIosSystemNotificationNow } from "@/lib/ios-system-notifications";
import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";

const SENT_KEYS_STORAGE = "diabeater_bedtime_inapp_reminder_sent_v1";
const MAX_KEYS = 120;

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

/** In-app (+ optional iOS banner) reminder once per evening after the chosen time. */
export async function ensureBedtimeInAppRemindersForUser(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUid = sessionData.session?.user?.id;
  if (!sessionUid || sessionUid !== userId) return;

  const settings = storage.getNotificationSettings();
  if (!settings.enabled || settings.bedtimeCheckReminders !== true) return;

  const time = settings.bedtimeReminderTime || DEFAULT_BEDTIME_REMINDER_TIME;
  const now = new Date();
  if (!isBedtimeReminderDueNow(time, now)) return;

  const dayKey = format(startOfDay(now), "yyyy-MM-dd");
  const key = bedtimeInAppDedupeKey(dayKey);
  const sent = loadSentKeys();
  if (sent.has(key)) return;

  const { title, body } = bedtimeReminderCopy();

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title,
    body,
    data: {
      kind: "bedtime_reminder",
      deep_link: "/scenarios/bedtime",
      day_key: dayKey,
    },
    read: false,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[bedtime-inapp-reminders] insert failed:", error.message);
    }
    return;
  }

  void showIosSystemNotificationNow({
    title,
    body,
    deepLink: "/scenarios/bedtime",
    tag: `inapp:bedtime:${key}`,
  });

  sent.add(key);
  saveSentKeys(sent);
  notifyInAppNotificationsChanged({ skipPageRefresh: true });
}
