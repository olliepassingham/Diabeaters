import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { handleAuthCallback, isUserVerified } from "@/lib/auth";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const pathOnly =
      typeof window !== "undefined" ? window.location.pathname.split("?")[0] ?? "" : "";
    const isEmailVerifyRoute = pathOnly === "/auth/email-verify";

    (async () => {
      try {
        const { user } = await handleAuthCallback();
        if (!cancelled) {
          if (isUserVerified(user)) {
            setLocation(isEmailVerifyRoute ? "/login?verified=1" : "/welcome?verified=1");
          } else {
            setLocation("/check-email");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          const message = err instanceof Error ? err.message : "Sign in failed. Please try again.";
          const isTimeout = message.toLowerCase().includes("could not complete sign in");
          if (isTimeout) {
            setLocation("/verified-return");
            return;
          }
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
      className="min-h-screen flex flex-col items-center justify-center px-4 bg-background text-foreground"
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
