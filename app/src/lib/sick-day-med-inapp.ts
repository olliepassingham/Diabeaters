import { formatDistanceToNowStrict } from "date-fns";

import { getSupabase } from "@/lib/supabase";
import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";

export async function createSickDayMedInAppNotification(params: {
  title: string;
  body: string;
  reminderId: string;
  dueAtIso: string;
  name: string;
  /** `due_time` = fired when a dose is due; default `event` = user actions (set/snooze/taken). */
  subtype?: "event" | "due_time";
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return { ok: false, error: "no_session" };

  const dueAt = new Date(params.dueAtIso);
  const dueLabel = Number.isNaN(dueAt.getTime()) ? null : formatDistanceToNowStrict(dueAt, { addSuffix: true });

  const subtype = params.subtype ?? "event";

  const { error } = await supabase.from("notifications").insert({
    user_id: uid,
    title: params.title,
    body: dueLabel ? `${params.body} (${dueLabel})` : params.body,
    data: {
      kind: "sick_day_med_reminder",
      subtype,
      reminder_id: params.reminderId,
      name: params.name,
      due_at: params.dueAtIso,
      deep_link: "/sick-day#sickday-checklist",
    },
    read: false,
  });

  if (error) {
    if (import.meta.env.DEV) console.warn("[sick-day-med-inapp] insert failed:", error.message);
    return { ok: false, error: error.message };
  }

  notifyInAppNotificationsChanged({ skipPageRefresh: true });
  return { ok: true };
}

