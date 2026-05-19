import {
  getBearerAuthHeadersForEdgeFunctions,
  invokeEdgeFunctionPost,
} from "@/lib/edge-function-invoke-auth";
import type { CommunityPostCommentRow } from "@/lib/community/types";
import { getSupabase } from "@/lib/supabase";

export type AiFeedReplyResult =
  | { ok: true; comment: CommunityPostCommentRow }
  | { ok: false; code: string; message?: string; httpStatus: number };

function mapComment(row: Record<string, unknown>): CommunityPostCommentRow | null {
  const id = typeof row.id === "string" ? row.id : "";
  const post_id = typeof row.post_id === "string" ? row.post_id : "";
  const author_id = typeof row.author_id === "string" ? row.author_id : "";
  const body = typeof row.body === "string" ? row.body : "";
  const created_at = typeof row.created_at === "string" ? row.created_at : "";
  const is_reported = Boolean(row.is_reported);
  if (!id || !post_id || !author_id || !body || !created_at) return null;
  return { id, post_id, author_id, body, created_at, is_reported };
}

/**
 * Invokes Edge Function `ai_feed_reply` (OP-only, consent + rate limits, service-role insert).
 */
export async function requestAiFeedReply(postId: string, signal?: AbortSignal): Promise<AiFeedReplyResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, code: "not_configured", message: "Supabase is not configured.", httpStatus: 0 };
  }

  const auth = await getBearerAuthHeadersForEdgeFunctions(supabase);
  if (!auth) {
    return { ok: false, code: "not_signed_in", message: "Sign in to ask Beatie.", httpStatus: 401 };
  }

  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!url || !anonKey) {
    return { ok: false, code: "env_missing", message: "Missing Supabase URL or anon key.", httpStatus: 0 };
  }

  const { data, error } = await invokeEdgeFunctionPost<Record<string, unknown>>(
    "ai_feed_reply",
    { post_id: postId },
    { url: url.replace(/\/$/, ""), anonKey },
    auth,
    signal ? { signal } : undefined,
  );

  if (error) {
    const msg = error.message;
    const m = /^(\d{3}):\s*(.*)$/.exec(msg);
    const httpStatus = m ? Number(m[1]) : 0;
    const tail = (m ? m[2] : msg).trim();
    const colon = tail.indexOf(":");
    const code = colon >= 0 ? tail.slice(0, colon).trim() : tail;
    const message = colon >= 0 ? tail.slice(colon + 1).trim() : undefined;
    return { ok: false, code: code || "request_failed", message: message || undefined, httpStatus };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, code: "invalid_response", httpStatus: 0 };
  }

  const success = Boolean((data as { success?: unknown }).success);
  if (!success) {
    const code = typeof (data as { error?: unknown }).error === "string"
      ? String((data as { error: string }).error)
      : "failed";
    const message =
      typeof (data as { message?: unknown }).message === "string"
        ? String((data as { message: string }).message)
        : undefined;
    return { ok: false, code, message, httpStatus: 200 };
  }

  const raw = (data as { comment?: unknown }).comment;
  if (!raw || typeof raw !== "object") {
    return { ok: false, code: "missing_comment", httpStatus: 200 };
  }
  const comment = mapComment(raw as Record<string, unknown>);
  if (!comment) {
    return { ok: false, code: "invalid_comment_shape", httpStatus: 200 };
  }
  return { ok: true, comment };
}
