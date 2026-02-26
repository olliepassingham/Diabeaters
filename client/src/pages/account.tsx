import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  resendVerification,
  updateEmail,
  logout,
  isUserVerified,
} from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [newEmail, setNewEmail] = useState("");
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [changeEmailSubmitting, setChangeEmailSubmitting] = useState(false);
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);

  if (!user) return null;

  const verified = isUserVerified(user);
  const email = user.email ?? "";

  async function handleResendVerify() {
    setResendSubmitting(true);
    const { error } = await resendVerification(email);
    setResendSubmitting(false);
    if (error) {
      const msg = error.message.toLowerCase();
      const isRateLimited =
        msg.includes("rate") || msg.includes("limit") || msg.includes("60");
      toast({
        title: isRateLimited ? "Too many requests" : "Something went wrong",
        description: isRateLimited
          ? "Please wait a few minutes before trying again."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Verification email sent",
      description: "Check your inbox for the verification link.",
    });
  }

  async function handleChangeEmail(e: FormEvent) {
    e.preventDefault();
    setChangeEmailError(null);
    if (!newEmail.trim()) return;
    setChangeEmailSubmitting(true);
    const { error } = await updateEmail(newEmail.trim());
    setChangeEmailSubmitting(false);
    if (error) {
      setChangeEmailError(error.message);
      return;
    }
    toast({
      title: "Email updated",
      description:
        "We've updated your email. Verification may be required again.",
    });
    setNewEmail("");
  }

  async function handleLogout() {
    await logout();
    setLocation("/login");
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-8">
      <h1 className="text-xl font-semibold">Account</h1>

      {!verified && (
        <Alert data-testid="banner-unverified">
          <AlertTitle>Verification required</AlertTitle>
          <AlertDescription>
            Please verify your email to continue. You can resend the
            verification email below.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signed-in email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="text-sm">
            <span className="text-muted-foreground">Status: </span>
            <span
              data-testid="status-verified"
              className={verified ? "text-green-600 dark:text-green-400" : ""}
            >
              {verified ? "Verified" : "Not verified"}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!verified && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendVerify}
              disabled={resendSubmitting}
              data-testid="btn-resend-verify"
            >
              {resendSubmitting ? "Sending…" : "Resend verification email"}
            </Button>
          )}

          <form onSubmit={handleChangeEmail} className="space-y-2">
            <Label htmlFor="new-email">Change email</Label>
            <div className="flex gap-2">
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                placeholder="New email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                data-testid="input-new-email"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={!newEmail.trim() || changeEmailSubmitting}
                data-testid="btn-change-email"
              >
                {changeEmailSubmitting ? "Updating…" : "Update"}
              </Button>
            </div>
            {changeEmailError && (
              <p className="text-sm text-destructive">{changeEmailError}</p>
            )}
          </form>

          <Link href="/reset-request">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              data-testid="btn-reset-password"
            >
              Reset password
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={handleLogout}
            data-testid="btn-logout"
          >
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
