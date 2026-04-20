import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  describeAuthErrorForDisplay,
  describeAuthNetworkError,
  isUserVerified,
  login,
} from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { navigateAfterLoginSuccess } from "@/lib/auth-post-login";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/layout";
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
  const { user, loading: authLoading } = useAuth();
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
        title: "Sign in failed",
        description: decodeURIComponent(err),
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
      if (authLoading) return;
      if (user && isUserVerified(user)) {
        void navigateAfterLoginSuccess(setLocation);
        return;
      }
      window.history.replaceState({}, "", "/login");
    }
  }, [toast, authLoading, user, setLocation]);

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
    await navigateAfterLoginSuccess(setLocation);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background text-foreground">
      <PageShell variant="narrow" className="w-full max-w-md">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Log in to Diabeaters</CardTitle>
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
                  className="min-h-11 px-2 -mx-2 text-xs underline text-muted-foreground hover:text-foreground"
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
                <Link href="/reset-request">
                  <button
                    type="button"
                    className="min-h-11 px-2 -mx-2 text-xs underline text-muted-foreground hover:text-foreground"
                  >
                    Forgot your password?
                  </button>
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
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup">
              <span className="underline underline-offset-2 cursor-pointer">
                Create account
              </span>
            </Link>
          </p>
          <p className="text-xs text-center pt-2">
            <Link href="/welcome">
              <span className="underline underline-offset-2 cursor-pointer text-muted-foreground hover:text-foreground">
                Choose Family Member / Supporter on the welcome screen
              </span>
            </Link>
          </p>
        </CardContent>
      </Card>
      </PageShell>
    </div>
  );
}

