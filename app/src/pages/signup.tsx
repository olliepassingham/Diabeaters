import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  describeAuthErrorForDisplay,
  describeAuthNetworkError,
  isUserVerified,
  signup,
} from "@/lib/auth";
import { navigateAfterLoginSuccess } from "@/lib/auth-post-login";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { hasCarerIntent, hasPendingCarer } from "@/lib/carer-session";
import { PageShell } from "@/components/layout";

export default function Signup() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error } = await signup(email, password);
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
      await navigateAfterLoginSuccess(setLocation);
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-background text-foreground">
      <PageShell variant="narrow" className="w-full max-w-md">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Create your Diabeaters account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Sign up failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login">
              <span className="underline underline-offset-2 cursor-pointer">
                Log in
              </span>
            </Link>
          </p>
          <p className="text-xs text-center pt-2">
            <Link href="/welcome">
              <span className="underline underline-offset-2 cursor-pointer text-muted-foreground hover:text-foreground">
                Choose Family Member / Carer on the welcome screen
              </span>
            </Link>
          </p>
        </CardContent>
      </Card>
      </PageShell>
    </div>
  );
}

