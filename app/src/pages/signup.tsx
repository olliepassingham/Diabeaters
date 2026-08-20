import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  describeAuthErrorForDisplay,
  describeAuthNetworkError,
  isUserVerified,
  signup,
} from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { completeAuthAndNavigate } from "@/lib/auth-post-login";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { getOnboardingAccountPath, hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";
import { Disclaimer } from "@/components/disclaimer";
import { PageShell } from "@/components/layout";
import { FaceLogo } from "@/components/face-logo";
import {
  authInlineLinkClass,
  authMutedNavLinkClass,
} from "@/components/auth/auth-link-styles";
import { TurnstileCaptcha, useTurnstileCaptcha } from "@/components/auth/Turnstile";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { PASSWORD_MIN_LENGTH, validatePassword } from "@/lib/password-policy";
import { Eye, EyeOff } from "lucide-react";

export default function Signup() {
  const { toast } = useToast();
  const { syncAuthSession } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const {
    siteKey: turnstileSiteKey,
    required: captchaRequired,
    token: captchaToken,
    setToken: setCaptchaToken,
    resetKey: captchaResetKey,
    reset: resetCaptcha,
  } = useTurnstileCaptcha();

  const communitySignup = useMemo(() => getOnboardingAccountPath() === "community", []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (captchaRequired && !captchaToken) return;
    if (communitySignup && !acceptedTerms) return;

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      setError(passwordCheck.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    const accountPath = getOnboardingAccountPath();
    const { data, error } = await signup(
      email,
      password,
      captchaToken ?? undefined,
      accountPath ? { onboarding_account_path: accountPath } : undefined,
    );
    setSubmitting(false);

    if (error) {
      resetCaptcha();
      const styled = describeAuthErrorForDisplay(error);
      if (styled.suggestCheckEmail) {
        setLocation(
          `/check-email?email=${encodeURIComponent(email)}&message=${encodeURIComponent("Please verify your email to continue.")}`,
        );
        return;
      }
      const description = describeAuthNetworkError(styled.message);
      setError(description);
      toast({ title: "Sign up failed", description, variant: "destructive" });
      return;
    }

    if (!data?.user) {
      const description =
        "We could not create an account with that email. It may already be registered — try logging in — or sign-ups may be blocked in your project (check Supabase Auth settings).";
      setError(description);
      toast({ title: "Sign up unsuccessful", description, variant: "destructive" });
      return;
    }

    if (data?.session && data.user) {
      if (!isUserVerified(data.user)) {
        const next = new URLSearchParams(window.location.search).get("next");
        const nextQ = next?.startsWith("/") && !next.startsWith("//") ? `&next=${encodeURIComponent(next)}` : "";
        setLocation(`/check-email?email=${encodeURIComponent(email)}${nextQ}`);
        return;
      }
      await completeAuthAndNavigate(setLocation, syncAuthSession, data.session);
      return;
    }

    if (hasCarerIntent() || hasPendingCarer()) {
      try {
        sessionStorage.setItem("diabeater_post_verify_next", "/carer-setup");
      } catch {
        // Ignore
      }
    }

    const next = new URLSearchParams(window.location.search).get("next");
    const nextQ = next?.startsWith("/") && !next.startsWith("//") ? `&next=${encodeURIComponent(next)}` : "";
    setLocation(`/check-email?email=${encodeURIComponent(email)}${nextQ}`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <PageShell variant="narrow" className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <FaceLogo size={56} />
            <div className="space-y-1">
              <h1 className="font-display text-3xl font-bold tracking-tight">Create your Diabeaters account</h1>
              <p className="text-sm text-muted-foreground">
                {communitySignup ? "Set up your Community Member account" : "One account for your tools and setup"}
              </p>
            </div>
          </div>

          <div className="space-y-5 rounded-[1.35rem] border border-border/60 bg-card/70 p-5 shadow-sm">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Sign up failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <PasswordRequirements password={password} />
            </div>
            {captchaRequired && (
              <TurnstileCaptcha
                key={captchaResetKey}
                siteKey={turnstileSiteKey}
                onToken={setCaptchaToken}
              />
            )}
            {communitySignup && (
              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                <Checkbox
                  id="community-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  data-testid="checkbox-community-signup-terms"
                />
                <div className="space-y-1">
                  <Label htmlFor="community-terms" className="cursor-pointer font-medium">
                    I understand and accept
                  </Label>
                  <Disclaimer />
                </div>
              </div>
            )}
            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-semibold"
              disabled={
                submitting ||
                (captchaRequired && !captchaToken) ||
                (communitySignup && !acceptedTerms)
              }
              data-testid="button-create-account"
            >
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
          </div>

          <p className="pt-5 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className={authInlineLinkClass}>
              Log in
            </Link>
          </p>
          <p className="pt-2 text-center">
            <Link href="/welcome" className={authMutedNavLinkClass}>
              Back to welcome
            </Link>
          </p>
        </PageShell>
      </div>
    </div>
  );
}

