import { useEffect } from "react";
import { useLocation } from "wouter";
import { establishAuthSessionFromEmailLink } from "@/lib/auth";
import { nextPathAfterAuthConfirm } from "@/lib/auth-app-url";
import { isCapacitorNativeShell } from "@/lib/native-platform";

/** Handles Supabase email links that use `?token_hash=…&type=…` (PKCE-safe across browsers). */
export default function AuthConfirm() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const search = window.location.search;
      const next = nextPathAfterAuthConfirm(search);

      const result = await establishAuthSessionFromEmailLink();
      if (cancelled) return;

      if (result.ok) {
        if (next === "/verified-return" && isCapacitorNativeShell()) {
          setLocation("/welcome?verified=1");
          return;
        }
        setLocation(next);
        return;
      }

      const message = result.message ?? "Invalid or expired link";
      if (next === "/reset-password" || next.includes("reset-password")) {
        setLocation(`/reset-password?error=${encodeURIComponent(message)}`);
        return;
      }
      if (next === "/verified-return") {
        setLocation("/check-email");
        return;
      }
      setLocation(`/login?error=${encodeURIComponent(message)}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-background text-foreground"
      data-testid="auth-confirm-loading"
    >
      <div
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"
        aria-hidden
      />
      <p className="mt-4 text-sm text-muted-foreground">Confirming your link…</p>
    </div>
  );
}
