/**
 * Calls the `ai_coach` Supabase Edge Function with the signed-in user's JWT.
 */

import { getBearerAuthHeadersForEdgeFunctions } from "@/lib/edge-function-invoke-auth";
import { getSupabase } from "@/lib/supabase";
import type { CoachAudience, CoachResponse, CoachTurn } from "./types";
import { buildAiCoachClientPayload } from "./contextSummary";

export class AiCoachHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "AiCoachHttpError";
    this.status = status;
    this.body = body;
  }
}

function isCoachResponseShape(o: Record<string, unknown>): o is Record<string, unknown> & CoachResponse {
  return typeof o.reply === "string" && Array.isArray(o.suggestedQuestions) && Array.isArray(o.suggestedNextActions);
}

export async function sendCoachMessage(args: {
  message: string;
  history: CoachTurn[];
  /** Defaults to `"patient"` when omitted (matches server default). */
  audience?: CoachAudience;
}): Promise<CoachResponse> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const auth = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!auth) {
    throw new Error("Not signed in");
  }

  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!url || !anonKey) {
    throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing");
  }

  const payload = buildAiCoachClientPayload();
  const audience: CoachAudience = args.audience === "supporter" ? "supporter" : "patient";
  const body = {
    message: args.message.trim(),
    history: args.history.slice(-12),
    lastFortnight: payload.lastFortnight,
    ratiosAreSet: payload.ratiosAreSet,
    bgUnits: payload.bgUnits,
    audience,
    ...(payload.dateOfBirth ? { dateOfBirth: payload.dateOfBirth } : {}),
  };

  const endpoint = `${url.replace(/\/$/, "")}/functions/v1/ai_coach`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: auth.Authorization,
      },
      body: JSON.stringify(body),
    });
  } catch {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      /* ignore */
    }
    throw new Error(
      [
        "Could not reach the coach API.",
        host ? `Supabase host in this build: ${host}.` : "",
        "Deploy Edge Function ai_coach on that Supabase project (same project as this URL).",
        "The store app loads diabeaters.vercel.app — set Vercel Production VITE_SUPABASE_URL to that project, redeploy Vercel, then rebuild/sync the native app.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === "object" && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    if (isCoachResponseShape(o)) {
      return {
        reply: o.reply,
        suggestedQuestions: o.suggestedQuestions as string[],
        suggestedNextActions: o.suggestedNextActions as CoachResponse["suggestedNextActions"],
        deferToTeam: Boolean(o.deferToTeam),
        category: (typeof o.category === "string" ? o.category : "llm") as CoachResponse["category"],
        postFilter: o.postFilter as CoachResponse["postFilter"],
      };
    }
  }

  let detail = text || res.statusText;
  if (parsed && typeof parsed === "object" && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    const msg = o.message;
    const det = o.detail;
    if (typeof msg === "string" && msg.trim().length > 0) {
      detail = msg.trim();
    } else if (typeof det === "string" && det.trim().length > 0) {
      detail = det.trim();
    } else if ("error" in o) {
      detail = String(o.error);
    }
  }
  throw new AiCoachHttpError(detail, res.status, parsed);
}
