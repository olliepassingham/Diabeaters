import { getSupabase } from "@/lib/supabase";

/** Dev-only banner when Supabase env vars are missing. Never shown in production. */
export function EnvBanner() {
  if (import.meta.env.PROD) return null;
  if (import.meta.env.DEV && getSupabase()) return null;

  return (
    <div
      className="bg-amber-500/90 text-amber-950 px-4 py-2 text-center text-sm font-medium"
      role="alert"
    >
      Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
      in .env.local (preferred) or .env, then restart the dev server.
    </div>
  );
}
