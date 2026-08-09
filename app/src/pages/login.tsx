import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  describeAuthErrorForDisplay,
  describeAuthNetworkError,
  isUserVerified,
  login,
} from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { completeAuthAndNavigate } from "@/lib/auth-post-login";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/layout";
import {
  authFieldActionClass,
  authMutedNavLinkClass,
} from "@/components/auth/auth-link-styles";
import { Eye, EyeOff } from "lucide-react";

const LAST_LOGIN_EMAIL_KEY = "diabeater_last_login_email";

function readLastLoginEmail(): string | null {
  try {
    const raw = localStorage.getItem(LAST_LOGIN_EMAIL_KEY);
    const v = (raw ?? "").trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

function writeLastLoginEmail(email: string): void {
  try {
    localStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    // ignore
  }
}

function clearLastLoginEmail(): void {
  try {
    localStorage.removeItem(LAST_LOGIN_EMAIL_KEY);
  } catch {
    // ignore
  }
}

export default function Login() {
  const { toast } = useToast();
  const { syncAuthSession } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifiedToastShown = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    const verified = params.get("verified") === "1";
    const next = params.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      try {
        sessionStorage.setItem("diabeater_post_verify_next", next);
      } catch {
        // ignore
      }
    }
    if (err) {
      toast({
        title: "Login failed",
        description: describeAuthNetworkError(decodeURIComponent(err)),
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/login");
      return;
    }

    if (verified) {
      if (!verifiedToastShown.current) {
        verifiedToastShown.current = true;
        toast({
          title: "Email verified",
          description: "You can log in with your email and password.",
        });
      }
      window.history.replaceState({}, "", "/login");
    }
  }, [toast, setLocation]);

  useEffect(() => {
    // Prefill remembered email for returning users (email only, never password).
    if (email.trim()) return;
    const remembered = readLastLoginEmail();
    if (remembered) setEmail(remembered);
    // intentionally runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error } = await login(email, password);
    setSubmitting(false);

    if (error) {
      const styled = describeAuthErrorForDisplay(error);
      if (styled.suggestCheckEmail) {
        setLocation(
          `/check-email?email=${encodeURIComponent(email)}&message=${encodeURIComponent("Please verify your email to continue.")}`,
        );
        return;
      }
      const description = describeAuthNetworkError(styled.message);
      setError(description);
      toast({ title: "Login failed", description, variant: "destructive" });
      return;
    }

    if (data?.user && !isUserVerified(data.user)) {
      setLocation("/check-email?message=Please verify your email to continue.");
      return;
    }

    writeLastLoginEmail(email);
    await completeAuthAndNavigate(setLocation, syncAuthSession, data?.session);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        <PageShell variant="narrow" className="w-full max-w-md">
      <Card className="w-full rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-xl">Log in to Diabeaters</CardTitle>
          <p className="text-sm text-muted-foreground">Welcome back — enter your email and password.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Login failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="email">Email</Label>
                <button
                  type="button"
                  className={authFieldActionClass}
                  onClick={() => {
                    clearLastLoginEmail();
                    setEmail("");
                    setPassword("");
                  }}
                >
                  Clear saved email
                </button>
              </div>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/reset-request" className={authFieldActionClass}>
                  Forgot your password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
            </div>
            <Button
              type="submit"
              className="min-h-11 w-full rounded-xl"
              disabled={submitting}
            >
              {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-card px-2 text-muted-foreground">New to Diabeaters?</span>
            </div>
          </div>

          <Button asChild variant="outline" className="min-h-12 w-full rounded-xl text-base font-semibold">
            <Link
              href={(() => {
                const next = new URLSearchParams(window.location.search).get("next");
                return next?.startsWith("/") && !next.startsWith("//")
                  ? `/signup?next=${encodeURIComponent(next)}`
                  : "/signup";
              })()}
              data-testid="login-create-account"
            >
              Create account
            </Link>
          </Button>

          <p className="pt-1 text-center">
            <Link href="/welcome" className={authMutedNavLinkClass}>
              Back to welcome
            </Link>
          </p>
        </CardContent>
      </Card>
      </PageShell>
    </div>
    </div>
  );
}

