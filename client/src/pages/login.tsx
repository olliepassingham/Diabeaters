import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { login, signInWithProvider, isUserVerified } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      toast({
        title: "Sign in failed",
        description: decodeURIComponent(err),
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/login");
    }
  }, [toast]);

  async function handleOAuth(provider: "apple" | "google" | "azure") {
    const { data, error } = await signInWithProvider(provider);
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    if (data?.url) window.location.href = data.url;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error } = await login(email, password);
    setSubmitting(false);

    if (error) {
      setError(error.message);
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return;
    }

    if (data?.user && !isUserVerified(data.user)) {
      setLocation("/check-email?message=Please verify your email to continue.");
      return;
    }

    setLocation("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/reset-request">
                  <span className="text-xs underline cursor-pointer hover:text-foreground text-muted-foreground">
                    Forgot your password?
                  </span>
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
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
              {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">
                or continue with
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("apple")}
              aria-label="Continue with Apple"
              data-testid="btn-oauth-apple"
            >
              Continue with Apple
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("google")}
              aria-label="Continue with Google"
              data-testid="btn-oauth-google"
            >
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth("azure")}
              aria-label="Continue with Microsoft"
              data-testid="btn-oauth-azure"
            >
              Continue with Microsoft
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup">
              <span className="underline underline-offset-2 cursor-pointer">
                Create account
              </span>
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

