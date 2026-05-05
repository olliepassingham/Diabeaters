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
import { createClient } from "jsr:@supabase/supabase-js@2";
import { packContext } from "../_shared/ai-coach/contextPacker.ts";
import { intercept } from "../_shared/ai-coach/interceptor.ts";
import { callOpenAiChatJson } from "../_shared/ai-coach/llmClient.ts";
import { applyPostFilter } from "../_shared/ai-coach/postFilter.ts";
import { deterministicResponse } from "../_shared/ai-coach/responses.ts";
import {
  deriveServerAudience,
  serverPlaceholderLastFortnight,
} from "../_shared/ai-coach/serverInputs.ts";
import type {
  AuditCategory,
  CoachAudience,
  CoachReply,
  CoachResponse,
  CoachTurn,
  PostFilterStatus,
} from "../_shared/ai-coach/types.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Must match `AI_COACH_CONSENT_VERSION` in `app/src/lib/ai-coach/consent.ts`. */
const AI_COACH_CONSENT_VERSION = "2026-05-03";

const CONSENT_REQUIRED_REPLY: CoachReply = {
  reply:
    "To chat with Coach, please accept the consent screen in the app first. That tells you how your messages are processed and that this is educational support only, not medical advice.",
  suggestedQuestions: [],
  suggestedNextActions: [],
  deferToTeam: false,
};

const RATE_LIMIT_REPLY: CoachReply = {
  reply:
    "You have reached the daily message limit for Coach. Please try again tomorrow, or use Help Now or your diabetes team if you need urgent support.",
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

/** PostgREST / Postgres when a selected column is not in the exposed schema or table. */
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

/** Consent gate only — never selects clinical columns so partial migrations cannot break the coach. */
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

  const legacy = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();

  if (!legacy.error && legacy.data) {
    return {
      data: null,
      error: {
        code: "coach_columns_missing",
        message:
          "AI Coach columns are missing on public.profiles. In SQL Editor, run the full contents of supabase/migrations/20260501120000_ai_coach.sql for this project, then run: NOTIFY pgrst, 'reload schema';",
      },
    };
  }

  return { data: null, error: narrow.error };
}

/** Optional clinical fields for LLM context — fetched separately so missing columns never 503 the coach. */
async function loadCoachClinicalExtras(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{
  diabetes_onset_date: string | null;
  insulin_delivery_method: string | null;
  date_of_birth: string | null;
}> {
  const out = {
    diabetes_onset_date: null as string | null,
    insulin_delivery_method: null as string | null,
    date_of_birth: null as string | null,
  };

  const combined = await admin
    .from("profiles")
    .select("diabetes_onset_date, insulin_delivery_method, date_of_birth")
    .eq("id", userId)
    .maybeSingle();

  if (!combined.error && combined.data) {
    const d = combined.data as Record<string, unknown>;
    out.diabetes_onset_date = typeof d.diabetes_onset_date === "string" ? d.diabetes_onset_date : null;
    out.insulin_delivery_method =
      typeof d.insulin_delivery_method === "string" ? d.insulin_delivery_method : null;
    out.date_of_birth = typeof d.date_of_birth === "string" ? d.date_of_birth : null;
    return out;
  }

  const dOnly = await admin.from("profiles").select("diabetes_onset_date").eq("id", userId).maybeSingle();
  if (!dOnly.error && dOnly.data) {
    const v = (dOnly.data as { diabetes_onset_date?: unknown }).diabetes_onset_date;
    out.diabetes_onset_date = typeof v === "string" ? v : null;
  }

  const iOnly = await admin.from("profiles").select("insulin_delivery_method").eq("id", userId).maybeSingle();
  if (!iOnly.error && iOnly.data) {
    const v = (iOnly.data as { insulin_delivery_method?: unknown }).insulin_delivery_method;
    out.insulin_delivery_method = typeof v === "string" ? v : null;
  }

  const dobOnly = await admin.from("profiles").select("date_of_birth").eq("id", userId).maybeSingle();
  if (!dobOnly.error && dobOnly.data) {
    const v = (dobOnly.data as { date_of_birth?: unknown }).date_of_birth;
    out.date_of_birth = typeof v === "string" ? v : null;
  }

  return out;
}

function isCoachTurn(x: unknown): x is CoachTurn {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (o.role === "user" || o.role === "assistant") && typeof o.content === "string";
}

function normalizeAudience(raw: unknown): CoachAudience {
  if (typeof raw !== "string") return "patient";
  return raw.trim().toLowerCase() === "supporter" ? "supporter" : "patient";
}

function normalizeBgUnits(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (v === "mmol/L" || v.toLowerCase() === "mmol/l") return "mmol/L";
  if (v === "mg/dL" || v.toLowerCase() === "mg/dl") return "mg/dL";
  return null;
}

function normalizePharmacyStatus(raw: unknown): {
  configured: boolean;
  openNow: boolean | null;
  nextOpensInMinutes: number | null;
  closesInMinutes: number | null;
  todaySummary: string | null;
  tomorrowSummary: string | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const configured = Boolean(o.configured);
  const openNow = typeof o.openNow === "boolean" ? o.openNow : o.openNow == null ? null : null;
  const clampMins = (v: unknown): number | null => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    if (v < 0) return 0;
    // Cap to 14 days to prevent abuse / huge numbers.
    if (v > 14 * 24 * 60) return 14 * 24 * 60;
    return Math.round(v);
  };
  const nextOpensInMinutes = clampMins(o.nextOpensInMinutes);
  const closesInMinutes = clampMins(o.closesInMinutes);
  const clampSummary = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (!t) return null;
    // Keep this short so the coach context stays compact.
    return t.slice(0, 140);
  };
  const todaySummary = clampSummary(o.todaySummary);
  const tomorrowSummary = clampSummary(o.tomorrowSummary);
  return { configured, openNow, nextOpensInMinutes, closesInMinutes, todaySummary, tomorrowSummary };
}

function isPharmacyHoursQuestion(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (!m) return false;
  if (!m.includes("pharmacy") && !m.includes("chemist")) return false;
  return (
    m.includes("open") ||
    m.includes("opening") ||
    m.includes("hours") ||
    m.includes("time") ||
    m.includes("tomorrow") ||
    m.includes("today")
  );
}

/**
 * Returns true when the caller has at least one row in `public.carer_links`
 * where they are the carer (i.e. they support someone). The Edge Function uses
 * this to derive the trusted audience server-side rather than trusting the
 * body's `audience` field.
 */
async function callerHasCarerLink(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  try {
    const res = await admin
      .from("carer_links")
      .select("patient_id")
      .eq("carer_id", userId)
      .limit(1)
      .maybeSingle();
    if (res.error) {
      console.warn("[ai_coach] carer_links lookup failed", res.error);
      return false;
    }
    return Boolean(res.data);
  } catch (e) {
    console.warn("[ai_coach] carer_links lookup threw", e);
    return false;
  }
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
    /**
     * Server hardening (Phase 3): we no longer trust `lastFortnight`,
     * `dateOfBirth`, or `audience` from the request body. They are either
     * derived from server-trusted state (profile / carer_links) or replaced
     * with a zeroed placeholder so the model cannot be steered by client-
     * supplied "history".
     */
    const ratiosAreSet = Boolean(b.ratiosAreSet);
    const bgUnitsClient = normalizeBgUnits(b.bgUnits ?? b.bg_units);
    const requestedAudience: CoachAudience = normalizeAudience(b.audience);
    const pharmacyStatus = normalizePharmacyStatus(b.pharmacyStatus);

    if (!message || message.length > 8000) {
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

    const { data: consentRow, error: profErr } = await loadCoachConsentProfile(admin, userId);

    if (profErr) {
      console.error("[ai_coach] profile select", profErr);
      const hint =
        typeof profErr.message === "string" && profErr.message.trim().length > 0
          ? profErr.message.trim()
          : "Profile lookup failed. Apply supabase/migrations/20260501120000_ai_coach.sql, then run NOTIFY pgrst, 'reload schema'; in the SQL Editor.";
      return jsonResponse(503, {
        success: false,
        error: "profile_unavailable",
        message: hint,
      });
    }

    const consentAt = consentRow?.ai_coach_consent_at ?? null;
    const consentVer =
      typeof consentRow?.ai_coach_consent_version === "string"
        ? consentRow.ai_coach_consent_version.trim()
        : "";
    if (!consentAt || consentVer !== AI_COACH_CONSENT_VERSION) {
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

    if (isPharmacyHoursQuestion(message) && pharmacyStatus?.configured) {
      const bits: string[] = [];
      if (pharmacyStatus.todaySummary) bits.push(pharmacyStatus.todaySummary);
      if (pharmacyStatus.tomorrowSummary) bits.push(pharmacyStatus.tomorrowSummary);
      const summary = bits.filter(Boolean).join("\n");
      const reply: CoachResponse = {
        reply:
          summary ||
          "I can see you have a pharmacy saved, but I don't have its opening hours. Add them under Settings → Your pharmacy, then ask me again.",
        suggestedQuestions: [],
        suggestedNextActions: summary ? [] : [{ label: "Open Supplies", href: "/supplies" }],
        deferToTeam: false,
        category: "llm",
        postFilter: "n/a",
      };
      return jsonResponse(200, { success: true, ...reply });
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

    const clinical = await loadCoachClinicalExtras(admin, userId);
    /**
     * DOB is *only* read from the authenticated user's `profiles` row. When the
     * row has no DOB on file, the context packer returns the `unknown` band and
     * the system prompt treats the user as default-deny under-18 for adult-only
     * routes (see Phase 2).
     */
    const dateOfBirth =
      typeof clinical.date_of_birth === "string" && clinical.date_of_birth.trim().length > 0
        ? clinical.date_of_birth.trim()
        : null;
    /**
     * Audience is derived from `carer_links`: a caller who has not been linked
     * as a carer for any patient cannot run as `supporter` even if they ask to.
     */
    const hasCarerLink = await callerHasCarerLink(admin, userId);
    const audience = deriveServerAudience(requestedAudience, hasCarerLink);
    /**
     * `lastFortnight` is *not* read from the body. The model sees the zero
     * placeholder and is instructed (system prompt) to admit when data is
     * sparse rather than invent patterns.
     */
    const lastFortnight = serverPlaceholderLastFortnight();
    const context = packContext({
      profile: {
        dateOfBirth,
        insulinDeliveryMethod: clinical.insulin_delivery_method,
        bgUnits: bgUnitsClient,
        diabetesOnsetDate: clinical.diabetes_onset_date,
      },
      lastFortnight,
      ratiosAreSet,
      ...(pharmacyStatus ? { pharmacyStatus } : {}),
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
        audience,
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

    const filtered = applyPostFilter(llmReply, context.profile);
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
