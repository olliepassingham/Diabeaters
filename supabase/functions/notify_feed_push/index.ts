/**
 * Supabase Edge Function: iOS push for community feed events.
 *
 * Covers events that already create in-app notifications via DB triggers:
 * - like/comment on your post (community_feed_notifications.sql)
 * - like on your comment (community_comment_likes.sql)
 * - mentions on posts (community_posts_poll_event_mentions.sql)
 * - new follower (inapp_notifications_insert_follow_trigger.sql)
 * - opted-in followed posts (user_follows_notify_posts.sql)
 *
 * The DB triggers can’t directly call APNs, so the client invokes this edge function
 * immediately after the write succeeds (mirrors notify_dm_push pattern).
 *
 * Secrets:
 * - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Push: APNs (APNS_*) or legacy PUSH_NOTIFICATION_API_URL — see ../_shared/deliver-ios-push.ts
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "../_shared/deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "../_shared/push-token-query.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body =
  | { kind: "feed_post_like"; post_id: string }
  | { kind: "feed_post_comment"; post_id: string; comment_id: string }
  | { kind: "feed_comment_like"; post_id: string; comment_id: string }
  | { kind: "feed_post_mention"; post_id: string; mentioned_user_id: string }
  | { kind: "feed_comment_mention"; post_id: string; comment_id: string; mentioned_user_id: string }
  | { kind: "feed_followed_post"; post_id: string }
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

    if (!mobilePushDeliveryConfigured()) {
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
        .select("body, image_storage_path")
        .eq("id", commentId)
        .eq("post_id", postId)
        .maybeSingle();
      const raw = typeof (c as any)?.body === "string" ? String((c as any).body).trim() : "";
      const hasImage = typeof (c as any)?.image_storage_path === "string" && String((c as any).image_storage_path).trim().length > 0;
      let preview = raw.slice(0, 120);
      if (raw.length > 120) preview += "…";
      if (!preview) preview = hasImage ? "sent a photo" : "commented on your post.";
      recipientId = authorId;
      title = "New comment on your post";
      bodyText = `${actor}: ${preview}`;
      deepLink = `/community/post/${postId}`;
      payload = { kind: "feed_post_comment", post_id: postId, actor_user_id: callerId, comment_id: commentId, deep_link: deepLink };
    } else if (body.kind === "feed_comment_like") {
      const postId = body.post_id?.trim() ?? "";
      const commentId = body.comment_id?.trim() ?? "";
      if (!isUuid(postId) || !isUuid(commentId)) {
        return new Response(JSON.stringify({ success: false, error: "invalid_ids" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: c } = await admin
        .from("community_post_comments")
        .select("author_id, body, image_storage_path")
        .eq("id", commentId)
        .eq("post_id", postId)
        .maybeSingle();
      const authorId = c ? String((c as any).author_id) : "";
      if (!isUuid(authorId) || authorId === callerId) {
        return new Response(JSON.stringify({ success: true, delivered_push: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const raw = typeof (c as any)?.body === "string" ? String((c as any).body).trim() : "";
      const hasImage = typeof (c as any)?.image_storage_path === "string" && String((c as any).image_storage_path).trim().length > 0;
      let preview = raw.slice(0, 80);
      if (raw.length > 80) preview += "…";
      if (!preview && hasImage) preview = "photo";
      recipientId = authorId;
      title = "New like on your comment";
      bodyText = preview ? `${actor} liked your comment: ${preview}` : `${actor} liked your comment.`;
      deepLink = `/community/post/${postId}`;
      payload = {
        kind: "feed_comment_like",
        post_id: postId,
        comment_id: commentId,
        actor_user_id: callerId,
        deep_link: deepLink,
      };
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
    } else if (body.kind === "feed_comment_mention") {
      const postId = body.post_id?.trim() ?? "";
      const commentId = body.comment_id?.trim() ?? "";
      const mentionedUserId = body.mentioned_user_id?.trim() ?? "";
      if (!isUuid(postId) || !isUuid(commentId) || !isUuid(mentionedUserId) || mentionedUserId === callerId) {
        return new Response(JSON.stringify({ success: false, error: "invalid_ids" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipientId = mentionedUserId;
      title = "You were mentioned";
      bodyText = `${actor} mentioned you in a comment.`;
      deepLink = `/community/post/${postId}`;
      payload = {
        kind: "feed_comment_mention",
        post_id: postId,
        comment_id: commentId,
        actor_user_id: callerId,
        deep_link: deepLink,
      };
    } else if (body.kind === "feed_followed_post") {
      const postId = body.post_id?.trim() ?? "";
      if (!isUuid(postId)) {
        return new Response(JSON.stringify({ success: false, error: "invalid_post_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: post } = await admin
        .from("community_posts")
        .select("author_id, body, image_urls, video_url, mentioned_user_ids")
        .eq("id", postId)
        .maybeSingle();
      const authorId = post ? String((post as any).author_id ?? "") : "";
      if (!isUuid(authorId) || authorId !== callerId) {
        return new Response(JSON.stringify({ success: false, error: "not_author" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rawBody = typeof (post as any)?.body === "string" ? String((post as any).body).trim() : "";
      let preview = rawBody.slice(0, 120);
      if (rawBody.length > 120) preview += "…";
      const imageUrls = Array.isArray((post as any)?.image_urls) ? (post as any).image_urls : [];
      const hasVideo =
        typeof (post as any)?.video_url === "string" && String((post as any).video_url).trim().length > 0;
      const hasMedia = imageUrls.length > 0 || hasVideo;
      const followedBody =
        preview.length > 0
          ? `${actor}: ${preview}`
          : hasMedia
            ? `${actor} shared a new post.`
            : `${actor} posted.`;
      const followedDeepLink = `/community/post/${postId}`;
      const followedPayload: Record<string, unknown> = {
        kind: "feed_followed_post",
        post_id: postId,
        actor_user_id: callerId,
        deep_link: followedDeepLink,
      };

      const mentioned = Array.isArray((post as any)?.mentioned_user_ids)
        ? new Set(
            ((post as any).mentioned_user_ids as unknown[])
              .map((id) => String(id ?? ""))
              .filter((id) => isUuid(id)),
          )
        : new Set<string>();

      const { data: followRows } = await admin
        .from("user_follows")
        .select("follower_id")
        .eq("followee_id", callerId)
        .eq("notify_posts", true)
        .limit(500);

      let deliveredTotal = 0;
      for (const row of followRows ?? []) {
        const rid = String((row as any)?.follower_id ?? "");
        if (!isUuid(rid) || rid === callerId || mentioned.has(rid)) continue;

        const { data: prefRow } = await admin
          .from("notification_preferences")
          .select("prefs")
          .eq("user_id", rid)
          .maybeSingle();
        if (!shouldDeliverFeedPush((prefRow as any)?.prefs ?? null)) continue;

        const tokenRows = await fetchLatestPushTokensForUserId(admin, rid);
        const { delivered } = await deliverPushToTokenRows(tokenRows, "New post", followedBody, followedPayload, {
          recipientUserId: rid,
          admin,
        });
        deliveredTotal += delivered;
      }

      return new Response(
        JSON.stringify({
          success: true,
          delivered_push: deliveredTotal,
          recipients: (followRows ?? []).length,
          deep_link: followedDeepLink,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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

    const tokenRows = await fetchLatestPushTokensForUserId(admin, recipientId);
    const { delivered } = await deliverPushToTokenRows(tokenRows, title, bodyText, payload, {
      recipientUserId: recipientId,
      admin,
    });

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

