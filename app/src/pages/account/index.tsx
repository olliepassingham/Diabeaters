import { FormEvent, useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { isUserVerified } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { redeemInvite, useLinkedPatient } from "@/lib/carers";
import { getSupabase } from "@/lib/supabase";
import { upsertProfile, updateProfile, useProfile } from "@/lib/profile";
import { uploadProfileAvatar } from "@/lib/storage-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";
import { useToast } from "@/hooks/use-toast";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { SettingsEmergencySection } from "@/pages/settings/shared";
import { storage } from "@/lib/storage";

const SUPPORT_EMAIL = "support@yourdomain.com";

function getInitial(email: string): string {
  const first = email.trim().charAt(0).toUpperCase();
  return first || "?";
}

export default function Account() {
  const { user } = useAuth();
  const { data: linkedPatient } = useLinkedPatient();
  const isCarer = !!linkedPatient;
  const { profile, loading: profileLoading, refresh } = useProfile();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const {
    displayUrl: avatarDisplayUrl,
    resolveError: avatarResolveError,
    isPending: avatarUrlPending,
  } = useResolvedProfileImageUrl(avatarPath);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const avatarLoadErrorToastShown = useRef(false);

  useEffect(() => {
    avatarLoadErrorToastShown.current = false;
  }, [avatarPath]);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [devInviteCode, setDevInviteCode] = useState("");
  const [devRedeeming, setDevRedeeming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id || profileLoading) return;
    if (profile) {
      setAvatarPath(profile.avatar_url ?? null);
    } else {
      void upsertProfile({ id: user.id }).then(({ error }) => {
        if (!error) void refresh();
      });
    }
  }, [user?.id, profile, profileLoading, refresh]);

  useEffect(() => {
    setAvatarImgFailed(false);
  }, [avatarPath, avatarDisplayUrl]);

  const showAvatarLoadErrorToast = useCallback(
    (description: string) => {
      toast({
        title: "Photo can't be displayed",
        description,
        variant: "destructive",
      });
    },
    [toast],
  );

  useEffect(() => {
    if (!avatarPath?.trim()) {
      return;
    }
    if (avatarUrlPending || avatarDisplayUrl) {
      return;
    }
    if (avatarResolveError && !avatarLoadErrorToastShown.current) {
      avatarLoadErrorToastShown.current = true;
      showAvatarLoadErrorToast(
        `${avatarResolveError} Check Storage policies for bucket "profile_pictures" (authenticated SELECT).`,
      );
    }
  }, [
    avatarPath,
    avatarDisplayUrl,
    avatarResolveError,
    avatarUrlPending,
    showAvatarLoadErrorToast,
  ]);

  if (!user) return null;

  const verified = isUserVerified(user);
  const email = user.email ?? "";
  const initial = getInitial(email);
  const userId = user.id;

  async function handleSignOut() {
    const supabase = getSupabase();
    if (!supabase) {
      toast({
        title: "Could not sign out",
        description: "Auth is not configured on this build.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Could not sign out", description: error.message, variant: "destructive" });
      return;
    }
    setLocation("/login");
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadSubmitting(true);
    const uploadResult = await uploadProfileAvatar(file);
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
    const { error } = await updateProfile({ id: userId, avatar_url: path });
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
    void refresh();
    toast({ title: "Avatar updated", description: "Your photo has been saved." });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDevRedeem(e: FormEvent) {
    e.preventDefault();
    if (!import.meta.env.DEV) return;
    setDevRedeeming(true);
    const { data, error } = await redeemInvite(devInviteCode);
    setDevRedeeming(false);
    if (error || !data) {
      toast({
        title: "Could not redeem",
        description: error?.message ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    setDevInviteCode("");
    toast({ title: "Linked", description: "Opening Carer View." });
    setLocation("/carer-view");
  }

  const settingsName = storage.getProfile()?.name?.trim() ?? "";
  const displayName = profile?.full_name?.trim() || settingsName || "Your account";
  const nameForInitials = profile?.full_name?.trim() || settingsName;
  const showAvatarImage = Boolean(avatarDisplayUrl && !avatarImgFailed);

  return (
    <PageShell variant="narrow" className="md:max-w-2xl space-y-6 py-4 md:py-8">
      <PageHeader
        leading={<PageBackButton />}
        title="Account"
        description="Your profile, emergency details, and sign-in options."
        className="max-w-xl"
      />
      <Card className="animate-fade-in-up rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div
              className="mx-auto flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/80 dark:bg-muted/50 avatar-hover-scale sm:mx-0 sm:h-24 sm:w-24"
              data-testid={showAvatarImage ? "avatar-preview" : "avatar-placeholder"}
              {...(!showAvatarImage && {
                role: "img" as const,
                "aria-label": "No avatar",
              })}
            >
              {showAvatarImage ? (
                <img
                  src={avatarDisplayUrl!}
                  alt="Profile avatar"
                  className="w-full h-full object-cover"
                  data-testid="avatar-img"
                  onError={() => setAvatarImgFailed(true)}
                />
              ) : (
                <span className="text-xl font-medium text-muted-foreground sm:text-2xl" aria-hidden>
                  {nameForInitials
                    ? nameForInitials
                        .split(/\s+/)
                        .map((s) => s[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : initial}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{displayName}</h1>
              <p className="text-sm text-muted-foreground break-all">{email}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
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
              <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto pb-0.5 pt-2 [-webkit-overflow-scrolling:touch] sm:justify-start [&_a]:shrink-0 [&_button]:shrink-0">
                {!isCarer && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      id="avatar-file"
                      onChange={handleAvatarUpload}
                      disabled={uploadSubmitting}
                      aria-label="Choose profile photo"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadSubmitting}
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      data-testid="avatar-upload"
                    >
                      {uploadSubmitting ? "Uploading…" : "Upload new photo"}
                    </Button>
                  </>
                )}
                {!isCarer && (
                  <Button variant="outline" size="sm" className="min-h-11" asChild>
                    <Link href="/family-carers" data-testid="link-manage-carers">
                      Manage carers
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="min-h-11" asChild>
                  <Link href="/settings" data-testid="link-account-settings">
                    Settings
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <Card
        id="account-emergency"
        className="animate-fade-in-up scroll-mt-24 rounded-2xl border-border/60 shadow-sm ring-1 ring-border/40"
      >
        <CardContent className="p-6">
          <SettingsEmergencySection variant="embedded" />
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            size="default"
            className="min-h-11 w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleSignOut}
            data-testid="btn-sign-out"
          >
            Sign out
          </Button>
          <Button
            variant="outline"
            size="default"
            className="min-h-11 w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            asChild
          >
            <Link href="/reset-request" data-testid="btn-reset-password">
              Reset password
            </Link>
          </Button>

          <Button variant="ghost" size="default" className="min-h-11 w-full sm:w-auto text-muted-foreground hover:text-destructive" asChild>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`}
              data-testid="account-delete-link"
            >
              Request account deletion
            </a>
          </Button>
        </CardContent>
      </Card>

      {import.meta.env.DEV && !isCarer && (
        <Card className="animate-fade-in-up shadow-md border-0 bg-amber-50/90 dark:bg-amber-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold text-amber-900 dark:text-amber-100">
              Dev: link as carer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!getSupabase() ? (
              <p className="text-sm text-muted-foreground">
                Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use this.
              </p>
            ) : (
              <form onSubmit={handleDevRedeem} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Paste a patient invite code to redeem the link (available in staging).
                </p>
                <div className="space-y-2">
                  <Label htmlFor="dev-invite-code">Invite code</Label>
                  <Input
                    id="dev-invite-code"
                    value={devInviteCode}
                    onChange={(e) => setDevInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AB12CD34"
                    autoComplete="off"
                    className="font-mono tracking-wider"
                  />
                </div>
                <Button type="submit" disabled={devRedeeming || !devInviteCode.trim()} variant="secondary" size="sm">
                  {devRedeeming ? "Linking…" : "Redeem invite"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
