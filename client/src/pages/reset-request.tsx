import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { sendPasswordResetEmail } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ResetRequest() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error } = await sendPasswordResetEmail(email);
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
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
              <Link href="/reset-request">
                <span className="underline cursor-pointer hover:text-foreground">
                  try again
                </span>
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
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
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
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              data-testid="btn-send-reset-link"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground">
            <Link href="/login">
              <span className="underline cursor-pointer hover:text-foreground">
                Back to log in
              </span>
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
