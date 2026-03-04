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

function getInitial(email: string): string {
  const first = email.trim().charAt(0).toUpperCase();
  return first || "?";
}

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [signedAvatarUrl, setSignedAvatarUrl] = useState<string | null>(null);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<"saved" | "error" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then(async ({ profile }) => {
      if (profile) {
        setFullName(profile.full_name ?? "");
        setAvatarPath(profile.avatar_url ?? null);
      } else {
        const { error } = await upsertProfile({ id: user.id });
        if (!error) {
          setFullName("");
          setAvatarPath(null);
        }
      }
    });
  }, [user]);

  useEffect(() => {
    const trimmed = avatarPath?.trim();
    if (!trimmed) {
      setSignedAvatarUrl(null);
      return;
    }
    getSignedAvatarUrl(trimmed).then(({ url }) => setSignedAvatarUrl(url ?? null));
  }, [avatarPath]);

  if (!user) return null;

  const verified = isUserVerified(user);
  const email = user.email ?? "";
  const initial = getInitial(email);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaveSubmitting(true);
    setSaveMessage(null);
    const { data, error } = await upsertProfile({
      id: user.id,
      full_name: fullName.trim() || null,
    });
    setSaveSubmitting(false);
    if (error) {
      setSaveMessage("error");
      toast({
        title: "Could not save",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    if (data) {
      setFullName(data.full_name ?? "");
    }
    setSaveMessage("saved");
    toast({
      title: "Changes saved",
      description: "Your profile has been updated.",
    });
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadSubmitting(true);
    const uploadResult = await uploadAvatar(user.id, file);
    if (uploadResult.error) {
      setUploadSubmitting(false);
      toast({
        title: "Upload failed",
        description: uploadResult.error.message,
        variant: "destructive",
      });
      return;
    }
    const path = uploadResult.path;
    if (!path) {
      setUploadSubmitting(false);
      toast({
        title: "Upload failed",
        description: "No path returned.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await upsertProfile({ id: user.id, avatar_url: path });
    setUploadSubmitting(false);
    if (error) {
      toast({
        title: "Profile update failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setAvatarPath(path);
    getSignedAvatarUrl(path).then(({ url }) => setSignedAvatarUrl(url ?? null));
    toast({ title: "Avatar updated", description: "Your photo has been saved." });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleLogout() {
    const { error } = await logout();
    if (error) {
      toast({
        title: "Log out failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setLocation("/login");
  }

  return (
    <div className="max-w-lg md:max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-8 md:space-y-12 pb-24">
      <header className="animate-fade-in-up">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Your Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">{email}</p>
      </header>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {saveMessage === "saved" && "Saved"}
        {saveMessage === "error" && "Error saving"}
      </div>

      {!verified && (
        <Alert
          data-testid="banner-unverified"
          className="border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/20 dark:border-amber-500/30 animate-fade-in-up"
        >
          <AlertDescription>
            Your email is not verified. Please verify to secure all features.{" "}
            <Button variant="outline" size="sm" className="mt-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" asChild>
              <Link href="/check-email">Go to check email</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="animate-fade-in-up border-border dark:border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Profile summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground" aria-readonly>
            {email}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span
              data-testid={verified ? "status-verified" : "status-unverified"}
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                verified
                  ? "text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800/50"
                  : "text-muted-foreground bg-muted/60 dark:bg-muted/40 border-border dark:border-border"
              }`}
            >
              {verified ? "Verified" : "Unverified"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up border-border dark:border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Avatar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div
              className="w-20 h-20 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-muted/80 dark:bg-muted/50 border border-border dark:border-border avatar-hover-scale"
              data-testid={signedAvatarUrl ? "avatar-preview" : "avatar-placeholder"}
              {...(!signedAvatarUrl && {
                role: "img" as const,
                "aria-label": "No avatar",
              })}
            >
              {signedAvatarUrl ? (
                <img
                  src={signedAvatarUrl}
                  alt="Profile avatar"
                  className="w-full h-full object-cover"
                  data-testid="avatar-img"
                />
              ) : (
                <span className="text-muted-foreground text-xl font-medium" aria-hidden>
                  {fullName.trim()
                    ? fullName
                        .trim()
                        .split(/\s+/)
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : initial}
                </span>
              )}
            </div>
            <div className="space-y-2">
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
              <Label htmlFor="avatar-file" className="cursor-pointer block">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                  className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid="avatar-upload"
                >
                  {uploadSubmitting ? "Uploading…" : "Upload new photo"}
                </Button>
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up border-border dark:border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Display name</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name-input">Display name</Label>
              <Input
                id="name-input"
                type="text"
                autoComplete="name"
                placeholder="Your display name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="name-input"
              />
              <p className="text-xs text-muted-foreground">Shown across the app</p>
            </div>
            <Button
              type="submit"
              disabled={saveSubmitting}
              className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="profile-save"
            >
              {saveSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up border-border dark:border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" className="w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" asChild>
            <Link href="/reset-request" data-testid="btn-reset-password">
              Reset password
            </Link>
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleLogout}
            data-testid="btn-logout"
          >
            Log out
          </Button>

          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`}
            className="block text-sm text-muted-foreground hover:text-destructive dark:hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            data-testid="account-delete-link"
          >
            Request account deletion
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
