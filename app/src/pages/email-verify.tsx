import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { handleEmailVerificationOnly } from "@/lib/auth";

/** Handles signup confirmation links at `/auth/email-verify` — verify only, no persistent login. */
export default function EmailVerify() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await handleEmailVerificationOnly();
      if (cancelled) return;
      if (result.verified) {
        setLocation("/verified-return");
        return;
      }
      setError(
        result.message ??
          "Could not verify your email. Open the Diabeaters app, request a new link, and try again.",
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  if (error) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-background text-foreground text-center"
        data-testid="email-verify-error"
      >
        <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
        <button
          type="button"
          className="mt-6 text-sm font-medium text-primary underline underline-offset-2"
          onClick={() => setLocation("/check-email")}
        >
          Resend verification email
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-background text-foreground [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]"
      data-testid="email-verify-loading"
    >
      <div
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"
        aria-hidden
      />
      <p className="mt-4 text-sm text-muted-foreground">Verifying your email…</p>
    </div>
  );
}
