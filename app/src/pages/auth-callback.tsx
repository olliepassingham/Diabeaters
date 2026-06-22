import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { handleAuthCallback, isUserVerified } from "@/lib/auth";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { user } = await handleAuthCallback();
        if (!cancelled) {
          if (isUserVerified(user)) {
            setLocation("/welcome?verified=1");
          } else {
            setLocation("/check-email");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          const message = err instanceof Error ? err.message : "Sign in failed. Please try again.";
          setLocation(`/login?error=${encodeURIComponent(message)}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  if (status === "error") {
    return null;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-background text-foreground [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]"
      data-testid="auth-callback-loading"
    >
      <div
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"
        aria-hidden
      />
      <p className="mt-4 text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
