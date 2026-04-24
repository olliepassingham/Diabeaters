import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import { getSupabase } from "@/lib/supabase";

export async function createPumpFailureInAppNotification(params: {
  userId: string;
  title: string;
  body: string;
  kind: "bg_recheck_60m" | "bg_recheck_120m" | "ketone_recheck_120m" | "morning_review";
  sessionId: string;
}): Promise<{ ok: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false };

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUid = sessionData.session?.user?.id;
  if (!sessionUid || sessionUid !== params.userId) return { ok: false };

  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    body: params.body,
    data: {
      kind: "pump_failure_reminder",
      subtype: params.kind,
      session_id: params.sessionId,
      deep_link: "/scenarios/pump-failure",
    },
    read: false,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[pump-failure-inapp] insert failed:", error.message);
    }
    return { ok: false };
  }

  notifyInAppNotificationsChanged({ skipPageRefresh: true });
  return { ok: true };
}

