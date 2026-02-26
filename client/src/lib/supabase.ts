import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.trim() || "";
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim() || "";

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey);

if (!hasSupabaseEnv) {
  console.warn(
    "Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env",
  );
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
