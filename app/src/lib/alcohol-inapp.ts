import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import { getSupabase } from "@/lib/supabase";
import { showIosSystemNotificationNow } from "@/lib/ios-system-notifications";

export async function createAlcoholInAppNotification(params: {
  userId: string;
  title: string;
  body: string;
  kind: "bedtime_check" | "overnight_check" | "morning_review";
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
      kind: "alcohol_reminder",
      subtype: params.kind,
      session_id: params.sessionId,
      deep_link: "/scenarios/alcohol",
    },
    read: false,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[alcohol-inapp] insert failed:", error.message);
    }
    return { ok: false };
  }

  void showIosSystemNotificationNow({
    title: params.title,
    body: params.body,
    deepLink: "/scenarios/alcohol",
    tag: `inapp:alcohol:${params.kind}:${params.sessionId}`,
  });

  notifyInAppNotificationsChanged({ skipPageRefresh: true });
  return { ok: true };
}

