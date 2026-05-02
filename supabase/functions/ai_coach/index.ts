/**
 * Supabase Edge Function: AI Coach (educational LLM + safety chain).
 *
 * Secrets (Dashboard → Edge Functions):
 *   - OPENAI_API_KEY — required when ENABLE_AI_COACH=true
 *   - ENABLE_AI_COACH — set to "true" only after DPIA sign-off
 *   - AI_COACH_MAX_PER_DAY — optional; default 50 calls per user per UTC day
 *
 * @see docs/regulatory/ai_coach_system_prompt.md
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { packContext, type LastFortnightInput } from "../_shared/ai-coach/contextPacker.ts";
import { intercept } from "../_shared/ai-coach/interceptor.ts";
import { callOpenAiChatJson } from "../_shared/ai-coach/llmClient.ts";
import { applyPostFilter } from "../_shared/ai-coach/postFilter.ts";
import { deterministicResponse } from "../_shared/ai-coach/responses.ts";
import type {
  AuditCategory,
  CoachReply,
  CoachResponse,
  CoachTurn,
  PostFilterStatus,
} from "../_shared/ai-coach/types.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONSENT_REQUIRED_REPLY: CoachReply = {
  reply:
    "To use the Diabeaters coach, please accept the consent screen in the app first. That tells you how your messages are processed and that this is educational support only, not medical advice.",
  suggestedQuestions: [],
  suggestedNextActions: [],
  deferToTeam: false,
};

const RATE_LIMIT_REPLY: CoachReply = {
  reply:
    "You have reached the daily limit for coach messages. Please try again tomorrow, or use Help Now or your diabetes team if you need urgent support.",
  suggestedQuestions: [],
  suggestedNextActions: [{ label: "Open Help Now", href: "/help-now" }],
  deferToTeam: true,
};

const INVALID_BODY_REPLY: CoachReply = {
  reply: "Something went wrong with that request. Please go back and try again.",
  suggestedQuestions: [],
  suggestedNextActions: [],
  deferToTeam: false,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isCoachTurn(x: unknown): x is CoachTurn {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (o.role === "user" || o.role === "assistant") && typeof o.content === "string";
}

function normalizeBgUnits(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (v === "mmol/L" || v.toLowerCase() === "mmol/l") return "mmol/L";
  if (v === "mg/dL" || v.toLowerCase() === "mg/dl") return "mg/dL";
  return null;
}

function normalizeLastFortnight(raw: unknown): LastFortnightInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (k: string) => {
    const v = r[k];
    return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0;
  };
  const pct = r.estimatedTimeInRangePct;
  const tir =
    pct === null || pct === undefined
      ? null
      : typeof pct === "number" && Number.isFinite(pct)
        ? pct
        : null;
  return {
    bgReadings: num("bgReadings"),
    estimatedTimeInRangePct: tir,
    hypoCount: num("hypoCount"),
    severeHypoCount: num("severeHypoCount"),
    highCount: num("highCount"),
    exerciseSessions: num("exerciseSessions"),
    sickDayActive: Boolean(r.sickDayActive),
    travelModeActive: Boolean(r.travelModeActive),
  };
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
    console.error("[ai_coach] audit insert failed", e);
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse(500, { success: false, error: "server_misconfigured" });
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
    const message = typeof b.message === "string" ? b.message.trim() : "";
    const historyRaw = b.history;
    const history: CoachTurn[] = Array.isArray(historyRaw)
      ? (historyRaw.filter(isCoachTurn) as CoachTurn[])
      : [];
    const lf = normalizeLastFortnight(b.lastFortnight);
    const ratiosAreSet = Boolean(b.ratiosAreSet);
    const bgUnitsClient = normalizeBgUnits(b.bgUnits ?? b.bg_units);

    if (!message || message.length > 8000 || !lf) {
      const out: CoachResponse = {
        ...INVALID_BODY_REPLY,
        category: "invalid_request",
        postFilter: "n/a",
      };
      await insertAudit(admin, {
        user_id: userId,
        category: "invalid_request",
        deferred: false,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: message.length || null,
      });
      return jsonResponse(200, { success: true, ...out });
    }

    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("ai_coach_consent_at, diabetes_onset_date, insulin_delivery_method")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      console.error("[ai_coach] profile select", profErr);
      return jsonResponse(503, {
        success: false,
        error: "profile_unavailable",
        message:
          "Could not read your profile for coach consent. Apply the AI coach migration on this project, then Dashboard → Settings → API → Reload schema, and try again.",
      });
    }

    const consentAt = profile?.ai_coach_consent_at ?? null;
    if (!consentAt) {
      const out: CoachResponse = {
        ...CONSENT_REQUIRED_REPLY,
        category: "consent_required",
        postFilter: "n/a",
      };
      await insertAudit(admin, {
        user_id: userId,
        category: "consent_required",
        deferred: false,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: message.length,
      });
      return jsonResponse(200, { success: true, ...out });
    }

    const maxPerDay = Number.parseInt(Deno.env.get("AI_COACH_MAX_PER_DAY") ?? "50", 10);
    const maxSafe = Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : 50;

    const { data: rateData, error: rateErr } = await admin.rpc("ai_coach_rate_increment", {
      p_user_id: userId,
      p_max_per_day: maxSafe,
    });
    if (rateErr) {
      console.error("[ai_coach] rate rpc", rateErr);
      return jsonResponse(500, { success: false, error: "rate_limit_rpc_failed" });
    }
    const rateRow = Array.isArray(rateData) ? rateData[0] : rateData;
    const allowed =
      rateRow && typeof rateRow === "object"
        ? Boolean((rateRow as { allowed?: unknown }).allowed)
        : true;

    if (!allowed) {
      const out: CoachResponse = {
        ...RATE_LIMIT_REPLY,
        category: "rate_limited",
        postFilter: "n/a",
      };
      await insertAudit(admin, {
        user_id: userId,
        category: "rate_limited",
        deferred: true,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: message.length,
      });
      return jsonResponse(429, { success: false, error: "rate_limited", ...out });
    }

    const hit = intercept(message);
    if (hit) {
      const det = deterministicResponse(hit.category);
      const out: CoachResponse = {
        ...det,
        category: hit.category,
        postFilter: "n/a",
      };
      await insertAudit(admin, {
        user_id: userId,
        category: hit.category,
        deferred: det.deferToTeam,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: null,
        prompt_chars: message.length,
      });
      return jsonResponse(200, { success: true, ...out });
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
        prompt_chars: message.length,
      });
      return jsonResponse(503, {
        success: false,
        error: "llm_disabled",
        detail: "ENABLE_AI_COACH is not set to true for this deployment.",
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
        prompt_chars: message.length,
      });
      return jsonResponse(503, { success: false, error: "openai_not_configured" });
    }

    const row = profile as Record<string, unknown> | null | undefined;
    const context = packContext({
      profile: {
        dateOfBirth: null,
        insulinDeliveryMethod:
          typeof row?.insulin_delivery_method === "string" ? row.insulin_delivery_method : null,
        bgUnits: bgUnitsClient,
        diabetesOnsetDate:
          typeof row?.diabetes_onset_date === "string" ? row.diabetes_onset_date : null,
      },
      lastFortnight: lf,
      ratiosAreSet,
    });

    let llmReply: CoachReply;
    let tokensIn = 0;
    let tokensOut = 0;
    try {
      const llm = await callOpenAiChatJson({
        apiKey,
        context,
        history,
        userMessage: message,
      });
      llmReply = llm.reply;
      tokensIn = llm.usage.prompt_tokens;
      tokensOut = llm.usage.completion_tokens;
    } catch (e) {
      console.error("[ai_coach] llm", e);
      await insertAudit(admin, {
        user_id: userId,
        category: "llm_error",
        deferred: true,
        post_filter_status: "n/a",
        latency_ms: Date.now() - t0,
        tokens_in: null,
        tokens_out: null,
        model: "gpt-4o-mini",
        prompt_chars: message.length,
      });
      return jsonResponse(503, {
        success: false,
        error: "llm_error",
        detail: String(e).slice(0, 200),
      });
    }

    const filtered = applyPostFilter(llmReply);
    const finalReply = filtered.reply;
    const cat: AuditCategory =
      filtered.status === "refused" ? "post_filter_refused" : "llm";

    const out: CoachResponse = {
      ...finalReply,
      category: cat,
      postFilter: filtered.status,
    };

    await insertAudit(admin, {
      user_id: userId,
      category: cat,
      deferred: finalReply.deferToTeam,
      post_filter_status: filtered.status,
      latency_ms: Date.now() - t0,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      model: "gpt-4o-mini",
      prompt_chars: message.length,
    });

    return jsonResponse(200, { success: true, ...out });
  } catch (e) {
    console.error("[ai_coach]", e);
    return jsonResponse(500, { success: false, error: "internal_error", detail: String(e) });
  }
});
