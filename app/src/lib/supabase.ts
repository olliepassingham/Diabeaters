import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);

if (!hasSupabaseEnv) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      "Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in app/.env (restart dev server after changes).",
    );
  }
}

let _client: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient | null {
  if (!hasSupabaseEnv) return null;
  if (_client) return _client;
  _client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}

/** Returns the Supabase client when env is configured; null otherwise. */
export function getSupabase(): SupabaseClient | null {
  return createSupabaseClient();
}

/** @deprecated Prefer getSupabase() and null-check. Kept for backward compat; may be null if env missing. */
export const supabase = createSupabaseClient();
