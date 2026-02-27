import { FormEvent, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { logout, isUserVerified } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import {
  getProfile,
  upsertProfile,
  uploadAvatar,
  getSignedAvatarUrl,
} from "@/lib/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const SUPPORT_EMAIL = "support@yourdomain.com";

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [signedAvatarUrl, setSignedAvatarUrl] = useState<string | null>(null);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((profile) => {
      if (profile) {
        setFullName(profile.full_name ?? "");
        setAvatarPath(profile.avatar_url);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!avatarPath) {
      setSignedAvatarUrl(null);
      return;
    }
    getSignedAvatarUrl(avatarPath).then((url) => setSignedAvatarUrl(url));
  }, [avatarPath]);

  if (!user) return null;

  const verified = isUserVerified(user);
  const email = user.email ?? "";

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaveSubmitting(true);
    const { error } = await upsertProfile(user.id, { full_name: fullName.trim() || null });
    setSaveSubmitting(false);
    if (error) {
      toast({
        title: "Could not save",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Changes saved",
      description: "Your profile has been updated.",
    });
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadSubmitting(true);
    const result = await uploadAvatar(user.id, file);
    setUploadSubmitting(false);
    if ("error" in result) {
      toast({
        title: "Upload failed",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }
    const { path } = result;
    const { error } = await upsertProfile(user.id, { avatar_url: path });
    if (error) {
      toast({
        title: "Profile update failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setAvatarPath(path);
    toast({ title: "Avatar updated", description: "Your photo has been saved." });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleLogout() {
    await logout();
    setLocation("/login");
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-8">
      <h1 className="text-xl font-semibold">Account</h1>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {!verified && (
        <Alert data-testid="banner-unverified" className="border-amber-500/50 bg-amber-500/5">
          <AlertDescription>
            Please verify your email to continue. You can resend on the{" "}
            <Link href="/check-email" className="underline font-medium hover:no-underline">
              Check email page
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signed-in email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground" aria-readonly>{email}</p>
          <p className="text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            <span
              data-testid="status-verified"
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                verified
                  ? "bg-green-500/20 text-green-700 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {verified ? "Verified" : "Not verified"}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="input-full-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar-file">Avatar</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  {signedAvatarUrl ? (
                    <img
                      src={signedAvatarUrl}
                      alt="Your avatar"
                      className="w-full h-full object-cover"
                      data-testid="avatar-img"
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">No photo</span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  id="avatar-file"
                  onChange={handleAvatarUpload}
                  disabled={uploadSubmitting}
                  aria-label="Choose avatar image"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="avatar-upload"
                >
                  {uploadSubmitting ? "Uploading…" : "Upload"}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saveSubmitting}
              data-testid="profile-save"
            >
              {saveSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link href="/reset-request">
            <Button type="button" variant="outline" className="w-full" data-testid="btn-reset-password">
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

          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`}
            className="block"
          >
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-destructive"
              data-testid="account-delete-link"
            >
              Request account deletion
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
