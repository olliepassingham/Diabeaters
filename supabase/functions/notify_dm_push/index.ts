/**
 * Supabase Edge Function: iOS push for new DMs (recipients who opted into push + DM alerts).
 *
 * In-app inbox rows are created by DB trigger `notify_dm_thread_members_on_message`.
 * Call this from the client right after a successful `dm_messages` insert.
 *
 * Secrets:
 * - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Push: APNs (APNS_*) or legacy PUSH_NOTIFICATION_API_URL — see ../_shared/deliver-ios-push.ts
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "../_shared/deliver-push.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  thread_id?: string;
  message_id?: string;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

function dmBodyLine(actorLabel: string, rawBody: string, hasImage: boolean): string {
  const raw = rawBody.trim();
  let preview = raw.slice(0, 120);
  if (raw.length > 120) preview += "…";
  if (!preview) {
    return hasImage ? `${actorLabel} sent a photo` : `${actorLabel} sent a message`;
  }
  return `${actorLabel}: ${preview}`;
}

/** Push allowed when master + DM alerts on and user opted into push (matches hypo / supply pattern). */
function shouldDeliverDmPush(prefsRaw: unknown): boolean {
  const pr = (prefsRaw && typeof prefsRaw === "object" ? prefsRaw : {}) as Record<string, unknown>;
  if (pr.enabled === false) return false;
  if (pr.dm_alerts === false) return false;
  return pr.push === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ success: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ success: false, error: "invalid_jwt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as Body;
    const threadId = typeof body.thread_id === "string" ? body.thread_id.trim() : "";
    const messageId = typeof body.message_id === "string" ? body.message_id.trim() : "";

    if (!isUuid(threadId) || !isUuid(messageId)) {
      return new Response(JSON.stringify({ success: false, error: "invalid_ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: msgRow, error: msgErr } = await admin
      .from("dm_messages")
      .select("id, thread_id, sender_id, body, image_storage_path")
      .eq("id", messageId)
      .maybeSingle();

    if (msgErr) {
      return new Response(
        JSON.stringify({ success: false, error: "message_fetch_failed", detail: msgErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!msgRow) {
      return new Response(JSON.stringify({ success: false, error: "message_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const m = msgRow as {
      id: string;
      thread_id: string;
      sender_id: string;
      body: string | null;
      image_storage_path: string | null;
    };

    if (String(m.sender_id) !== callerId) {
      return new Response(JSON.stringify({ success: false, error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (String(m.thread_id) !== threadId) {
      return new Response(JSON.stringify({ success: false, error: "thread_mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", callerId)
      .maybeSingle();
    const actorLabel =
      (profile as { full_name?: string } | null)?.full_name?.trim() || "Someone";

    const imgPath = m.image_storage_path?.trim() ?? "";
    const hasImage = imgPath.length > 0;
    const bodyText = dmBodyLine(actorLabel, m.body ?? "", hasImage);
    const deepLink = `/community/messages/${threadId}`;
    const payload = {
      kind: "dm_message",
      thread_id: threadId,
      message_id: messageId,
      sender_user_id: callerId,
      deep_link: deepLink,
    };

    const { data: memberRows, error: memErr } = await admin
      .from("dm_thread_members")
      .select("user_id")
      .eq("thread_id", threadId)
      .neq("user_id", callerId);

    if (memErr) {
      return new Response(
        JSON.stringify({ success: false, error: "members_fetch_failed", detail: memErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const recipientIds = [...new Set((memberRows ?? []).map((r: { user_id: string }) => String(r.user_id)))].filter(
      isUuid,
    );
    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ success: true, delivered_push: 0, recipients: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prefsRows } = await admin
      .from("notification_preferences")
      .select("user_id, prefs")
      .in("user_id", recipientIds);
    const prefsById = new Map<string, unknown>(
      (prefsRows ?? []).map((r: { user_id: string; prefs: unknown }) => [String(r.user_id), r.prefs]),
    );

    // Per-user thread settings (mute/hide) override push delivery for this thread.
    const { data: settingsRows } = await admin
      .from("dm_thread_user_settings")
      .select("user_id, muted, hidden")
      .eq("thread_id", threadId)
      .in("user_id", recipientIds);
    const settingsByUserId = new Map<string, { muted: boolean; hidden: boolean }>(
      (settingsRows ?? []).map((r: { user_id: string; muted: boolean; hidden: boolean }) => [
        String(r.user_id),
        { muted: Boolean(r.muted), hidden: Boolean(r.hidden) },
      ]),
    );

    let pushDelivered = 0;

    for (const rid of recipientIds) {
      if (!shouldDeliverDmPush(prefsById.get(rid))) continue;
      const st = settingsByUserId.get(rid);
      if (st?.muted || st?.hidden) continue;
      if (!mobilePushDeliveryConfigured()) continue;

      const { data: tokenRows } = await admin
        .from("push_tokens")
        .select("platform, token")
        .eq("user_id", rid)
        .in("platform", ["ios", "android"]);
      const { delivered } = await deliverPushToTokenRows(tokenRows ?? [], "New message", bodyText, payload);
      pushDelivered += delivered;
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipients: recipientIds.length,
        delivered_push: pushDelivered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify_dm_push]", e);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
