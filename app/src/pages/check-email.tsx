import { FormEvent, useState } from "react";
import { Link } from "wouter";
import {
  describeAuthErrorForDisplay,
  describeAuthNetworkError,
  resendVerification,
} from "@/lib/auth";
import { getSupportEmail } from "@/lib/support";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AuthCaptcha, useTurnstileCaptcha } from "@/components/auth/Turnstile";

export default function CheckEmail() {
  const { toast } = useToast();
  const initialEmail =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("email") ?? ""
      : "";
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useTurnstileCaptcha();
  const {
    required: captchaRequired,
    token: captchaToken,
    reset: resetCaptcha,
  } = captcha;

  const messageParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("message")
      : null;
  const bannerMessage =
    messageParam === "Please verify your email to continue."
      ? messageParam
      : null;

  async function handleResend(e: FormEvent) {
    e.preventDefault();
    if (captchaRequired && !captchaToken) return;
    setSubmitting(true);
    setError(null);

    const { error } = await resendVerification(email, captchaToken ?? undefined);
    setSubmitting(false);

    if (error) {
      resetCaptcha();
      const styled = describeAuthErrorForDisplay(error);
      const description = describeAuthNetworkError(styled.message);
      setError(description);
      toast({
        title: "Could not send email",
        description,
        variant: "destructive",
      });
      return;
    }

    resetCaptcha();
    toast({
      title: "Verification email sent",
      description:
        "If an account exists for that email, we've sent a new verification link. Check junk and spam too.",
    });
  }

  return (
    <div
      className={`min-h-screen bg-background text-foreground ${import.meta.env.DEV ? "pt-14" : ""}`}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
      {import.meta.env.DEV && (
        <div
          className="fixed top-0 left-0 right-0 bg-amber-500/90 text-amber-950 px-4 py-2 text-center text-xs font-medium z-50 space-y-1"
          role="status"
        >
          <p>
            Dev: In Supabase, enable <strong>Confirm email</strong> (Authentication → Providers → Email)
            and add your app URL to <strong>Redirect URLs</strong>. Set <code className="font-mono">VITE_PUBLIC_SITE_URL</code> to
            match.
          </p>
        </div>
      )}
      <Card className="w-full rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Check your email</CardTitle>
          {bannerMessage && (
            <Alert className="mt-3 rounded-2xl border-border/60 bg-muted/25">
              <AlertTitle>Verification required</AlertTitle>
              <AlertDescription>{bannerMessage}</AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a verification link to your email. Tap the link to confirm your address,
            then return to the Diabeaters app and log in.
          </p>
          <Alert className="rounded-2xl border-border/80 bg-muted/30">
            <AlertTitle className="text-sm">Not seeing the email?</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground space-y-2 pt-1">
              <ul className="list-disc pl-4 space-y-1.5">
                <li>
                  <strong className="font-medium text-foreground">Check junk, spam, and trash</strong>{" "}
                  — verification emails often land there.
                </li>
                <li>On Gmail, also check the Promotions tab.</li>
                <li>Wait a few minutes — delivery can take a little while.</li>
                <li>Confirm the email address above is correct, then tap resend if needed.</li>
              </ul>
              {getSupportEmail() ? (
                <p className="pt-1">
                  <a
                    href={`mailto:${getSupportEmail()}?subject=${encodeURIComponent("Diabeaters — email verification")}`}
                    className="text-foreground underline underline-offset-2 font-medium"
                  >
                    Contact support
                  </a>{" "}
                  if you still can&apos;t get the link.
                </p>
              ) : (
                <p className="pt-1">
                  If it never arrives, use{" "}
                  <Link href="/support" className="text-foreground underline underline-offset-2 font-medium">
                    Support
                  </Link>{" "}
                  in the app.
                </p>
              )}
            </AlertDescription>
          </Alert>
          <form onSubmit={handleResend} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="resend-email">Email address</Label>
              <Input
                id="resend-email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email address for resending verification"
              />
            </div>
            <AuthCaptcha captcha={captcha} />
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={submitting || (captchaRequired && !captchaToken)}
              aria-label="Resend verification email"
            >
              {submitting ? "Sending…" : "Resend verification email"}
            </Button>
          </form>
          <Link href="/login">
            <Button variant="ghost" className="w-full">
              Back to log in
            </Button>
          </Link>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
