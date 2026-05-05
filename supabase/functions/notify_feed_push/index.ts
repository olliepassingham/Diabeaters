/**
 * Supabase Edge Function: iOS push for community feed events.
 *
 * Covers events that already create in-app notifications via DB triggers:
 * - like/comment on your post (community_feed_notifications.sql)
 * - mentions on posts (community_posts_poll_event_mentions.sql)
 * - new follower (inapp_notifications_insert_follow_trigger.sql)
 *
 * The DB triggers can’t directly call APNs, so the client invokes this edge function
 * immediately after the write succeeds (mirrors notify_dm_push pattern).
 *
 * Secrets:
 * - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Push: APNs (APNS_*) or legacy PUSH_NOTIFICATION_API_URL — see ../_shared/deliver-ios-push.ts
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverIosPushToDevice, iosPushDeliveryConfigured } from "../_shared/deliver-ios-push.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body =
  | { kind: "feed_post_like"; post_id: string }
  | { kind: "feed_post_comment"; post_id: string; comment_id: string }
  | { kind: "feed_post_mention"; post_id: string; mentioned_user_id: string }
  | { kind: "new_follower"; followee_id: string };

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function shouldDeliverFeedPush(prefsRaw: unknown): boolean {
  const pr = (prefsRaw && typeof prefsRaw === "object" ? prefsRaw : {}) as Record<string, unknown>;
  if (pr.enabled === false) return false;
  if (pr.feed_alerts === false) return false;
  return pr.push === true;
}

function actorLabelFromProfile(profile: unknown): string {
  const p = (profile && typeof profile === "object" ? profile : {}) as Record<string, unknown>;
  const raw = typeof p.full_name === "string" ? p.full_name.trim() : "";
  return raw || "Someone";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    const callerId = String(userData.user.id);

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body || typeof (body as any).kind !== "string") {
      return new Response(JSON.stringify({ success: false, error: "invalid_body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!iosPushDeliveryConfigured()) {
      return new Response(JSON.stringify({ success: true, delivered_push: 0, detail: "push_not_configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", callerId).maybeSingle();
    const actor = actorLabelFromProfile(profile);

    let recipientId: string | null = null;
    let title = "Community";
    let bodyText = "New activity";
    let deepLink = "/community";
    let payload: Record<string, unknown> = { kind: (body as any).kind };

    if (body.kind === "new_follower") {
      const followeeId = body.followee_id?.trim() ?? "";
      if (!isUuid(followeeId) || followeeId === callerId) {
        return new Response(JSON.stringify({ success: false, error: "invalid_followee" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipientId = followeeId;
      title = "New follower";
      bodyText = `${actor} started following you.`;
      deepLink = `/community/profile/${callerId}`;
      payload = { kind: "new_follower", follower_user_id: callerId, deep_link: deepLink };
    } else if (body.kind === "feed_post_like") {
      const postId = body.post_id?.trim() ?? "";
      if (!isUuid(postId)) {
        return new Response(JSON.stringify({ success: false, error: "invalid_post_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: post } = await admin.from("community_posts").select("author_id").eq("id", postId).maybeSingle();
      const authorId = post ? String((post as any).author_id) : "";
      if (!isUuid(authorId) || authorId === callerId) {
        return new Response(JSON.stringify({ success: true, delivered_push: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipientId = authorId;
      title = "New like on your post";
      bodyText = `${actor} liked your post.`;
      deepLink = `/community/post/${postId}`;
      payload = { kind: "feed_post_like", post_id: postId, actor_user_id: callerId, deep_link: deepLink };
    } else if (body.kind === "feed_post_comment") {
      const postId = body.post_id?.trim() ?? "";
      const commentId = body.comment_id?.trim() ?? "";
      if (!isUuid(postId) || !isUuid(commentId)) {
        return new Response(JSON.stringify({ success: false, error: "invalid_ids" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: post } = await admin.from("community_posts").select("author_id").eq("id", postId).maybeSingle();
      const authorId = post ? String((post as any).author_id) : "";
      if (!isUuid(authorId) || authorId === callerId) {
        return new Response(JSON.stringify({ success: true, delivered_push: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: c } = await admin
        .from("community_post_comments")
        .select("body")
        .eq("id", commentId)
        .eq("post_id", postId)
        .maybeSingle();
      const raw = typeof (c as any)?.body === "string" ? String((c as any).body).trim() : "";
      let preview = raw.slice(0, 120);
      if (raw.length > 120) preview += "…";
      recipientId = authorId;
      title = "New comment on your post";
      bodyText = `${actor}: ${preview || "commented on your post."}`;
      deepLink = `/community/post/${postId}`;
      payload = { kind: "feed_post_comment", post_id: postId, actor_user_id: callerId, comment_id: commentId, deep_link: deepLink };
    } else if (body.kind === "feed_post_mention") {
      const postId = body.post_id?.trim() ?? "";
      const mentionedUserId = body.mentioned_user_id?.trim() ?? "";
      if (!isUuid(postId) || !isUuid(mentionedUserId) || mentionedUserId === callerId) {
        return new Response(JSON.stringify({ success: false, error: "invalid_ids" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipientId = mentionedUserId;
      title = "You were mentioned";
      bodyText = `${actor} mentioned you in a post.`;
      deepLink = `/community/post/${postId}`;
      payload = { kind: "feed_post_mention", post_id: postId, actor_user_id: callerId, deep_link: deepLink };
    }

    if (!recipientId || !isUuid(recipientId)) {
      return new Response(JSON.stringify({ success: false, error: "no_recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prefRow } = await admin
      .from("notification_preferences")
      .select("prefs")
      .eq("user_id", recipientId)
      .maybeSingle();
    const prefs = (prefRow as any)?.prefs ?? null;
    if (!shouldDeliverFeedPush(prefs)) {
      return new Response(JSON.stringify({ success: true, delivered_push: 0, gated: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenRows } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", recipientId)
      .eq("platform", "ios");
    const tokens = (tokenRows ?? []).map((t: any) => String(t.token)).filter(Boolean);
    let delivered = 0;
    for (const t of tokens) {
      const ok = await deliverIosPushToDevice(t, title, bodyText, payload);
      if (ok) delivered += 1;
    }

    return new Response(
      JSON.stringify({ success: true, delivered_push: delivered, recipient: recipientId, deep_link: deepLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify_feed_push]", e);
    return new Response(JSON.stringify({ success: false, error: "internal_error", detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

