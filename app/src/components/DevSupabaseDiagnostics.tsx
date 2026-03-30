import { useEffect, useRef } from "react";

let loggedSupabaseUrl = false;

function supabaseHostLabel(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (!raw) return "Supabase URL not set";
  try {
    const u = new URL(raw);
    return u.host;
  } catch {
    return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
  }
}

/**
 * DEV-only: one console line for which project the build targets, plus a slim UI hint (no secrets).
 */
export function DevSupabaseDiagnostics() {
  const didLog = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV || didLog.current) return;
    didLog.current = true;
    if (!loggedSupabaseUrl) {
      loggedSupabaseUrl = true;
      console.info("[DEV] Supabase URL:", import.meta.env.VITE_SUPABASE_URL ?? "(not set)");
    }
  }, []);

  if (!import.meta.env.DEV) return null;

  return (
    <div
      className="bg-slate-800 text-slate-100 px-3 py-1 text-[11px] font-mono border-b border-slate-600 z-[60] relative"
      data-testid="dev-supabase-diagnostics"
    >
      <span className="text-slate-400 mr-2">Dev · Supabase project</span>
      <span className="break-all">{supabaseHostLabel()}</span>
    </div>
  );
}
