/**
 * Scheduled Edge Function: publish one educational community post per day as Beatie.
 *
 * Invoke with **service role** Authorization — e.g. schedule an HTTP POST from
 * **Integrations → Cron** (or `pg_cron` + `pg_net`), or manually with service role bearer.
 *
 * **Dashboard “Test” often overwrites `Authorization` / `apikey`.** Set Edge secret
 * **`BEATIE_FEED_POST_CRON_SECRET`** and send header **`x-beatie-feed-post-cron-secret`**;
 * **`apikey`** can be the **anon** key for the gateway.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BEATIE_FEED_BOT_USER_ID,
 * ENABLE_AI_COACH=true, OPENAI_API_KEY, optional BEATIE_FEED_POST_CRON_SECRET,
 * optional BEATIE_FEED_POST_CRON_MAX_PER_DAY (default 1).
 *
 * @see docs/operations/beatie_feed_bot_setup.md
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  AI_FEED_POST_SYSTEM_PROMPT,
  buildFeedPostRephraseUserMessage,
  clampFeedPostBody,
  FEED_POST_BODY_MAX_CHARS,
  selectFeedPostTemplateForUtcDate,
} from "../_shared/ai-coach/feedPostPrompt.ts";
import { intercept } from "../_shared/ai-coach/interceptor.ts";
import { callOpenAiStructuredCoachJson, type ChatMessage } from "../_shared/ai-coach/llmClient.ts";
import { applyPostFilter } from "../_shared/ai-coach/postFilter.ts";
import { packContext } from "../_shared/ai-coach/contextPacker.ts";
import type { AuditCategory, PostFilterStatus } from "../_shared/ai-coach/types.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-beatie-feed-post-cron-secret",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Skip posting if Beatie published within this window (UTC). */
const IDEMPOTENCY_WINDOW_MS = 20 * 60 * 60 * 1000;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function authorizeCron(req: Request, serviceKey: string): boolean {
  const sk = serviceKey.trim();
  const authHeader = (req.headers.get("Authorization") ?? "").trim();
  const apikeyHeader = (req.headers.get("apikey") ?? "").trim();
  const bearerBody = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim() ?? "";
  const cronSecretEnv = (Deno.env.get("BEATIE_FEED_POST_CRON_SECRET") ?? "").trim();
  const cronSecretHeader = (req.headers.get("x-beatie-feed-post-cron-secret") ?? "").trim();
  const authorizedByServiceKey =
    authHeader === `Bearer ${sk}` || bearerBody === sk || apikeyHeader === sk;
  const authorizedByCronSecret =
    cronSecretEnv.length >= 16 && cronSecretHeader === cronSecretEnv;
  return authorizedByServiceKey || authorizedByCronSecret;
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
    console.error("[beatie_feed_post_cron] audit insert failed", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, { success: false, error: "method_not_allowed" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const botId = (Deno.env.get("BEATIE_FEED_BOT_USER_ID") ?? "").trim();

    if (!supabaseUrl || !serviceKey) {
      console.error("[beatie_feed_post_cron] server_misconfigured");
      return jsonResponse(500, { success: false, error: "server_misconfigured" });
    }
    if (!authorizeCron(req, serviceKey)) {
      const authHeader = (req.headers.get("Authorization") ?? "").trim();
      const apikeyHeader = (req.headers.get("apikey") ?? "").trim();
      const cronSecretEnv = (Deno.env.get("BEATIE_FEED_POST_CRON_SECRET") ?? "").trim();
      console.warn(
        `[beatie_feed_post_cron] unauthorized (auth_len=${authHeader.length} apikey_len=${apikeyHeader.length} cron_secret_configured=${cronSecretEnv.length >= 16})`,
      );
      return jsonResponse(401, { success: false, error: "unauthorized" });
    }
    if (!botId || !UUID_RE.test(botId)) {
      console.error("[beatie_feed_post_cron] beatie_bot_not_configured");
      return jsonResponse(500, {
        success: false,
        error: "beatie_bot_not_configured",
        message: "Set Edge secret BEATIE_FEED_BOT_USER_ID to the feed bot Auth user UUID.",
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    console.log("[beatie_feed_post_cron] authorized; checking recent posts");

    const maxPerDay = Number.parseInt(Deno.env.get("BEATIE_FEED_POST_CRON_MAX_PER_DAY") ?? "1", 10);
    const maxSafe = Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : 1;

    const sinceIso = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString();
    const { count: recentCount, error: recentErr } = await admin
      .from("community_posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", botId)
      .gte("created_at", sinceIso);

    if (recentErr) {
      console.error("[beatie_feed_post_cron] recent posts", recentErr);
      return jsonResponse(500, { success: false, error: "recent_posts_check_failed" });
    }
    if ((recentCount ?? 0) >= maxSafe) {
      const payload = {
        success: true,
        skipped: true,
        reason: "already_posted_today",
        recent_count: recentCount ?? 0,
      };
      console.log("[beatie_feed_post_cron]", JSON.stringify(payload));
      return jsonResponse(200, payload);
    }

    const template = selectFeedPostTemplateForUtcDate(new Date());
    const templateText = template.body;

    const hit = intercept(templateText);
    if (hit) {
      await insertAudit(admin, {
        user_id: botId,
        category: "feed_scheduled_skipped",
        deferred: true,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: templateText.length,
      });
      return jsonResponse(200, {
        success: true,
        skipped: true,
        reason: "interceptor",
        category: hit.category,
      });
    }

    const enableLlm = (Deno.env.get("ENABLE_AI_COACH") ?? "").trim().toLowerCase() === "true";
    const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";

    const gateContext = packContext({
      profile: {
        dateOfBirth: null,
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

    let finalBody = clampFeedPostBody(templateText, FEED_POST_BODY_MAX_CHARS);
    let tokensIn: number | null = null;
    let tokensOut: number | null = null;
    let postFilterStatus: PostFilterStatus = "n/a";
    let usedLlm = false;

    if (enableLlm && apiKey) {
      const userMessage = buildFeedPostRephraseUserMessage(template);
      const messages: ChatMessage[] = [
        { role: "system", content: AI_FEED_POST_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ];
      try {
        const llm = await callOpenAiStructuredCoachJson({
          apiKey,
          messages,
          maxCompletionTokens: 520,
        });
        tokensIn = llm.usage.prompt_tokens;
        tokensOut = llm.usage.completion_tokens;
        const filtered = applyPostFilter(llm.reply, gateContext.profile);
        postFilterStatus = filtered.status;
        if (filtered.status !== "refused" && filtered.reply.reply.trim().length > 0) {
          finalBody = clampFeedPostBody(filtered.reply.reply.trim(), FEED_POST_BODY_MAX_CHARS);
          usedLlm = true;
        }
      } catch (e) {
        console.error("[beatie_feed_post_cron] llm rephrase failed; using template", e);
      }
    }

    const postHit = intercept(finalBody);
    if (postHit) {
      await insertAudit(admin, {
        user_id: botId,
        category: "feed_scheduled_skipped",
        deferred: true,
        post_filter_status: postFilterStatus,
        latency_ms: Date.now() - t0,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        model: usedLlm ? "gpt-4o-mini" : null,
        prompt_chars: templateText.length,
      });
      return jsonResponse(200, {
        success: true,
        skipped: true,
        reason: "interceptor_after_filter",
        category: postHit.category,
      });
    }

    if (finalBody.length < 1 || finalBody.length > 4000) {
      return jsonResponse(500, { success: false, error: "body_invalid_length" });
    }

    const { data: inserted, error: insErr } = await admin
      .from("community_posts")
      .insert({
        author_id: botId,
        body: finalBody,
        topic: template.topic,
        post_kind: "standard",
        post_extra: null,
        image_urls: [],
        video_url: null,
        mention_map: {},
        mentioned_user_ids: [],
      })
      .select("id, author_id, body, topic, created_at")
      .maybeSingle();

    if (insErr || !inserted) {
      console.error("[beatie_feed_post_cron] insert", insErr);
      await insertAudit(admin, {
        user_id: botId,
        category: "llm_error",
        deferred: true,
        post_filter_status: postFilterStatus,
        latency_ms: Date.now() - t0,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        model: usedLlm ? "gpt-4o-mini" : null,
        prompt_chars: templateText.length,
      });
      return jsonResponse(500, { success: false, error: "post_insert_failed" });
    }

    await insertAudit(admin, {
      user_id: botId,
      category: "feed_scheduled_post",
      deferred: false,
      post_filter_status: postFilterStatus,
      latency_ms: Date.now() - t0,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      model: usedLlm ? "gpt-4o-mini" : null,
      prompt_chars: templateText.length,
    });

    const payload = {
      success: true,
      skipped: false,
      post: inserted,
      used_llm: usedLlm,
      template_topic: template.topic,
    };
    console.log("[beatie_feed_post_cron]", JSON.stringify({ ...payload, post: { id: inserted.id } }));
    return jsonResponse(200, payload);
  } catch (e) {
    console.error("[beatie_feed_post_cron]", e);
    return jsonResponse(500, { success: false, error: "internal_error", detail: String(e) });
  }
});
