/**
 * Ask Beatie on a community post — generates a **public** comment as the
 * dedicated feed bot user (service-role insert; RLS blocks normal clients).
 *
 * Secrets:
 *   - BEATIE_FEED_BOT_USER_ID — UUID of Auth user + profiles row for Beatie on feed
 *   - Same LLM gates as ai_coach: OPENAI_API_KEY, ENABLE_AI_COACH=true
 *   - AI_FEED_MAX_PER_DAY — optional; default 10 per user per UTC day (separate from coach)
 *
 * @see docs/operations/beatie_feed_bot_setup.md
 * @see docs/regulatory/ai_coach_system_prompt.md §1b
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AI_FEED_REPLY_SYSTEM_PROMPT } from "../_shared/ai-coach/feedReplyPrompt.ts";
import { intercept } from "../_shared/ai-coach/interceptor.ts";
import { callOpenAiStructuredCoachJson, type ChatMessage } from "../_shared/ai-coach/llmClient.ts";
import { applyPostFilter } from "../_shared/ai-coach/postFilter.ts";
import { packContext } from "../_shared/ai-coach/contextPacker.ts";
import { deterministicResponse } from "../_shared/ai-coach/responses.ts";
import type { AuditCategory, PostFilterStatus } from "../_shared/ai-coach/types.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Must match `AI_COACH_CONSENT_VERSION` in `app/src/lib/ai-coach/consent.ts`. */
const AI_COACH_CONSENT_VERSION = "2026-05-07";

/** Hard cap for stored feed comment body after post-filter (shorter than coach; DB max is 4000). */
const FEED_REPLY_BODY_MAX_CHARS = 480;

function clampFeedReplyBody(s: string, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  let bestEnd = -1;
  for (const sep of [". ", "! ", "? "] as const) {
    const i = slice.lastIndexOf(sep);
    if (i > bestEnd) bestEnd = i;
  }
  if (bestEnd >= Math.min(100, Math.floor(maxLen * 0.35))) {
    return slice.slice(0, bestEnd + 1).trim();
  }
  const sp = slice.lastIndexOf(" ");
  if (sp >= 50) return `${slice.slice(0, sp).trim()}…`;
  return `${slice.trimEnd()}…`;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingColumnOrSchemaCacheError(err: { message?: string; code?: string }): boolean {
  const m = (err.message ?? "").toLowerCase();
  const c = String(err.code ?? "");
  if (c === "PGRST204" || c === "42703") return true;
  if (m.includes("schema cache") && m.includes("column")) return true;
  if (m.includes("could not find") && m.includes("column")) return true;
  if (m.includes("column") && m.includes("does not exist")) return true;
  return false;
}

type CoachConsentRow = {
  ai_coach_consent_at?: string | null;
  ai_coach_consent_version?: string | null;
};

async function loadCoachConsentProfile(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ data: CoachConsentRow | null; error: { message?: string; code?: string } | null }> {
  const errMsg = (e: { message?: string } | null) => (e?.message ?? "").toLowerCase();

  const full = await admin
    .from("profiles")
    .select("ai_coach_consent_at, ai_coach_consent_version")
    .eq("id", userId)
    .maybeSingle();

  if (!full.error) {
    return { data: full.data as CoachConsentRow | null, error: null };
  }

  const tryNarrow =
    isMissingColumnOrSchemaCacheError(full.error) || errMsg(full.error).includes("ai_coach");
  if (!tryNarrow) {
    return { data: null, error: full.error };
  }

  const narrow = await admin
    .from("profiles")
    .select("ai_coach_consent_at")
    .eq("id", userId)
    .maybeSingle();

  if (!narrow.error) {
    const base = (narrow.data ?? {}) as CoachConsentRow;
    return {
      data: { ...base, ai_coach_consent_version: base.ai_coach_consent_version ?? null },
      error: null,
    };
  }

  return { data: null, error: narrow.error };
}

async function insertAudit(
  admin: ReturnType<typeof createClient>,
  row: {
    user_id: string;
    category: AuditCategory;
    deferred: boolean;
    post_filter_status: PostFilterStatus;
    latency_ms: number | null;
    tokens_in: number | null;
    tokens_out: number | null;
    model: string | null;
    prompt_chars: number | null;
  },
): Promise<void> {
  try {
    await admin.from("ai_coach_audit").insert(row);
  } catch (e) {
    console.error("[ai_feed_reply] audit insert failed", e);
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, { success: false, error: "method_not_allowed" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const botId = (Deno.env.get("BEATIE_FEED_BOT_USER_ID") ?? "").trim();

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse(500, { success: false, error: "server_misconfigured" });
    }
    if (!botId || !UUID_RE.test(botId)) {
      return jsonResponse(500, {
        success: false,
        error: "beatie_bot_not_configured",
        message: "Set Edge secret BEATIE_FEED_BOT_USER_ID to the feed bot Auth user UUID.",
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse(401, { success: false, error: "unauthorized" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user?.id) {
      return jsonResponse(401, { success: false, error: "invalid_jwt" });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const postId = typeof b.post_id === "string" ? b.post_id.trim() : "";
    if (!postId || !UUID_RE.test(postId)) {
      await insertAudit(admin, {
        user_id: userId,
        category: "invalid_request",
        deferred: false,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: null,
      });
      return jsonResponse(400, { success: false, error: "invalid_post_id" });
    }

    const { data: post, error: postErr } = await admin
      .from("community_posts")
      .select("id, author_id, body, topic")
      .eq("id", postId)
      .maybeSingle();

    if (postErr || !post) {
      return jsonResponse(404, { success: false, error: "post_not_found" });
    }
    const authorId = typeof post.author_id === "string" ? post.author_id : "";
    if (authorId !== userId) {
      return jsonResponse(403, {
        success: false,
        error: "forbidden",
        message: "Only the post author can ask Beatie on this thread.",
      });
    }

    const { count: botCount, error: botCountErr } = await admin
      .from("community_post_comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId)
      .eq("author_id", botId);

    if (botCountErr) {
      console.error("[ai_feed_reply] bot count", botCountErr);
      return jsonResponse(500, { success: false, error: "comment_check_failed" });
    }
    if ((botCount ?? 0) > 0) {
      return jsonResponse(409, {
        success: false,
        error: "beatie_already_replied",
        message: "Beatie has already commented on this post.",
      });
    }

    const { data: consentRow, error: profErr } = await loadCoachConsentProfile(admin, userId);
    if (profErr) {
      console.error("[ai_feed_reply] profile select", profErr);
      return jsonResponse(503, { success: false, error: "profile_unavailable" });
    }
    const consentAt = consentRow?.ai_coach_consent_at ?? null;
    const consentVer =
      typeof consentRow?.ai_coach_consent_version === "string"
        ? consentRow.ai_coach_consent_version.trim()
        : "";
    if (!consentAt || consentVer !== AI_COACH_CONSENT_VERSION) {
      await insertAudit(admin, {
        user_id: userId,
        category: "consent_required",
        deferred: false,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: null,
      });
      return jsonResponse(200, {
        success: false,
        error: "consent_required",
        message:
          "To ask Beatie here, accept the Beatie consent in the app first (same consent as private coach).",
      });
    }

    const maxPerDay = Number.parseInt(Deno.env.get("AI_FEED_MAX_PER_DAY") ?? "10", 10);
    const maxSafe = Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : 10;

    const { data: rateData, error: rateErr } = await admin.rpc("ai_feed_reply_rate_increment", {
      p_user_id: userId,
      p_max_per_day: maxSafe,
    });
    if (rateErr) {
      console.error("[ai_feed_reply] rate rpc", rateErr);
      return jsonResponse(500, { success: false, error: "rate_limit_rpc_failed" });
    }
    const rateRow = Array.isArray(rateData) ? rateData[0] : rateData;
    const allowed =
      rateRow && typeof rateRow === "object"
        ? Boolean((rateRow as { allowed?: unknown }).allowed)
        : true;
    if (!allowed) {
      await insertAudit(admin, {
        user_id: userId,
        category: "rate_limited",
        deferred: true,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: null,
      });
      return jsonResponse(429, {
        success: false,
        error: "rate_limited",
        message: "Daily limit for Ask Beatie on the feed reached. Try again tomorrow.",
      });
    }

    const { data: commentRows, error: comErr } = await admin
      .from("community_post_comments")
      .select("author_id, body, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (comErr) {
      console.error("[ai_feed_reply] comments", comErr);
      return jsonResponse(500, { success: false, error: "comments_load_failed" });
    }

    const topic = typeof post.topic === "string" ? post.topic : "general";
    const postBody = typeof post.body === "string" ? post.body : "";
    const lines: string[] = [
      `TOPIC: ${topic}`,
      "",
      "POST:",
      postBody,
      "",
      "THREAD (comments in order):",
    ];
    const rows = Array.isArray(commentRows) ? commentRows : [];
    if (rows.length === 0) {
      lines.push("(no comments yet)");
    } else {
      for (const r of rows) {
        const ab = typeof r.body === "string" ? r.body : "";
        lines.push(`- ${ab}`);
      }
    }
    const threadText = lines.join("\n");

    const hit = intercept(threadText);
    if (hit) {
      const det = deterministicResponse(hit.category);
      await insertAudit(admin, {
        user_id: userId,
        category: hit.category,
        deferred: det.deferToTeam,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: threadText.length,
      });
      return jsonResponse(200, {
        success: false,
        error: "interceptor",
        category: hit.category,
        message: det.reply,
      });
    }

    const enableLlm = (Deno.env.get("ENABLE_AI_COACH") ?? "").trim().toLowerCase() === "true";
    if (!enableLlm) {
      await insertAudit(admin, {
        user_id: userId,
        category: "llm_disabled",
        deferred: false,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: threadText.length,
      });
      return jsonResponse(503, {
        success: false,
        error: "llm_disabled",
        message: "Beatie replies are disabled in this environment.",
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
    if (!apiKey) {
      await insertAudit(admin, {
        user_id: userId,
        category: "llm_error",
        deferred: false,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: threadText.length,
      });
      return jsonResponse(503, { success: false, error: "openai_not_configured" });
    }

    const { data: opProfile } = await admin
      .from("profiles")
      .select("date_of_birth")
      .eq("id", authorId)
      .maybeSingle();

    const dob =
      opProfile && typeof (opProfile as { date_of_birth?: unknown }).date_of_birth === "string"
        ? (opProfile as { date_of_birth: string }).date_of_birth
        : null;

    const gateContext = packContext({
      profile: {
        dateOfBirth: dob,
        insulinDeliveryMethod: null,
        bgUnits: null,
        diabetesOnsetDate: null,
      },
      lastFortnight: {
        bgReadings: 0,
        estimatedTimeInRangePct: null,
        hypoCount: 0,
        severeHypoCount: 0,
        highCount: 0,
        exerciseSessions: 0,
        sickDayActive: false,
        travelModeActive: false,
      },
      ratiosAreSet: false,
    });

    const messages: ChatMessage[] = [
      { role: "system", content: AI_FEED_REPLY_SYSTEM_PROMPT },
      { role: "user", content: threadText.slice(0, 12000) },
    ];

    let tokensIn = 0;
    let tokensOut = 0;
    let finalBody: string;
    let postFilterStatus: PostFilterStatus = "n/a";
    let auditCategory: AuditCategory = "llm";

    try {
      const llm = await callOpenAiStructuredCoachJson({
        apiKey,
        messages,
        maxCompletionTokens: 420,
      });
      tokensIn = llm.usage.prompt_tokens;
      tokensOut = llm.usage.completion_tokens;
      const filtered = applyPostFilter(llm.reply, gateContext.profile);
      postFilterStatus = filtered.status;
      auditCategory = filtered.status === "refused" ? "post_filter_refused" : "llm";
      finalBody = clampFeedReplyBody(filtered.reply.reply.trim(), FEED_REPLY_BODY_MAX_CHARS);
    } catch (e) {
      console.error("[ai_feed_reply] llm", e);
      await insertAudit(admin, {
        user_id: userId,
        category: "llm_error",
        deferred: true,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: "gpt-4o-mini",
        prompt_chars: threadText.length,
      });
      return jsonResponse(503, {
        success: false,
        error: "llm_error",
        message: "Beatie could not generate a reply. Try again later.",
      });
    }

    if (finalBody.length < 1 || finalBody.length > 4000) {
      await insertAudit(admin, {
        user_id: userId,
        category: "invalid_request",
        deferred: false,
        post_filter_status: postFilterStatus,
        latency_ms: Date.now() - t0,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        model: "gpt-4o-mini",
        prompt_chars: threadText.length,
      });
      return jsonResponse(500, { success: false, error: "reply_invalid_length" });
    }

    const { data: inserted, error: insErr } = await admin
      .from("community_post_comments")
      .insert({ post_id: postId, author_id: botId, body: finalBody })
      .select("id, post_id, author_id, body, is_reported, created_at")
      .maybeSingle();

    if (insErr || !inserted) {
      console.error("[ai_feed_reply] insert", insErr);
      await insertAudit(admin, {
        user_id: userId,
        category: "llm_error",
        deferred: true,
        post_filter_status: postFilterStatus,
        latency_ms: Date.now() - t0,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        model: "gpt-4o-mini",
        prompt_chars: threadText.length,
      });
      return jsonResponse(500, { success: false, error: "comment_insert_failed" });
    }

    await insertAudit(admin, {
      user_id: userId,
      category: auditCategory,
      deferred: false,
      post_filter_status: postFilterStatus,
      latency_ms: Date.now() - t0,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      model: "gpt-4o-mini",
      prompt_chars: threadText.length,
    });

    return jsonResponse(200, { success: true, comment: inserted });
  } catch (e) {
    console.error("[ai_feed_reply]", e);
    return jsonResponse(500, { success: false, error: "internal_error", detail: String(e) });
  }
});
