import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { describeAuthErrorForDisplay, describeAuthNetworkError, sendPasswordResetEmail } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { authInlineLinkClass, authMutedNavLinkClass } from "@/components/auth/auth-link-styles";
import { AuthCaptcha, useTurnstileCaptcha } from "@/components/auth/Turnstile";

export default function ResetRequest() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useTurnstileCaptcha();
  const {
    required: captchaRequired,
    token: captchaToken,
    reset: resetCaptcha,
  } = captcha;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (captchaRequired && !captchaToken) return;
    setSubmitting(true);
    setError(null);

    const { error } = await sendPasswordResetEmail(email, captchaToken ?? undefined);
    setSubmitting(false);

    if (error) {
      resetCaptcha();
      const styled = describeAuthErrorForDisplay(error);
      setError(describeAuthNetworkError(styled.message));
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <Card className="w-full rounded-2xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Check your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p
              className="text-sm text-muted-foreground"
              data-testid="reset-request-success"
            >
              If an account exists for that email, we&apos;ve sent a reset link.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn&apos;t receive it? Check your spam folder or{" "}
              <Link href="/reset-request" className={authInlineLinkClass}>
                try again
              </Link>
              .
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Back to log in
              </Button>
            </Link>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
      <Card className="w-full rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to reset your
            password.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            data-testid="form-reset-request"
          >
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-reset-email"
              />
            </div>
            <AuthCaptcha captcha={captcha} />
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || (captchaRequired && !captchaToken)}
              data-testid="btn-send-reset-link"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Check junk and spam if it does not arrive within a few minutes.
          </p>
          <p className="text-center">
            <Link href="/login" className={authMutedNavLinkClass}>
              Back to log in
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
