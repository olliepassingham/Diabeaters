import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { resendVerification } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function CheckEmail() {
  const { toast } = useToast();
  const initialEmail =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("email") ?? ""
      : "";
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSubmitting(true);
    setError(null);

    const { error } = await resendVerification(email);
    setSubmitting(false);

    if (error) {
      const msg = error.message.toLowerCase();
      const isRateLimited =
        msg.includes("rate") ||
        msg.includes("limit") ||
        msg.includes("too many") ||
        msg.includes("60");
      if (isRateLimited) {
        toast({
          title: "Too many requests",
          description:
            "Please wait a few minutes before requesting another verification email.",
          variant: "destructive",
        });
      } else {
        setError(error.message);
      }
      return;
    }

    toast({
      title: "Verification email sent",
      description:
        "If an account exists for that email, we've sent a new verification link.",
    });
  }

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-4 ${import.meta.env.DEV ? "pt-14" : ""}`}
    >
      {import.meta.env.DEV && (
        <div
          className="fixed top-0 left-0 right-0 bg-amber-500/90 text-amber-950 px-4 py-2 text-center text-xs font-medium z-50"
          role="status"
        >
          To test email verification, enable &quot;Confirm email&quot; in Supabase
          Dashboard → Authentication → Providers → Email.
        </div>
      )}
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Check your email</CardTitle>
          {bannerMessage && (
            <Alert className="mt-2">
              <AlertTitle>Verification required</AlertTitle>
              <AlertDescription>{bannerMessage}</AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a verification link to your email. Click the link to
            verify your account. Once verified, return to the app.
          </p>
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
              disabled={submitting}
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
  );
}
