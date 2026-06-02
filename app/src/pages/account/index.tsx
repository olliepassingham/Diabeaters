import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountPublicProfileTab } from "@/pages/account/account-public-tab";
import { ChevronRight } from "lucide-react";
import { isUserVerified, logout } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useLinkedPatient } from "@/lib/carers";
import { upsertProfile, updateProfile, useProfile } from "@/lib/profile";
import { getSupabase } from "@/lib/supabase";
import { uploadProfileAvatar } from "@/lib/storage-profile";
import {
  ProfileActionGrid,
  ProfileAvatarTile,
  ProfileDisplayName,
  ProfileHeroCard,
  ProfileHeroNameRow,
  ProfileHeroRow,
  ProfileMetaRow,
  ProfileMutedCard,
  ProfileSectionHeading,
  ProfileVerifiedBadge,
} from "@/components/profile/profile-ui";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, PageShell } from "@/components/layout";
import { cn } from "@/lib/utils";
import { CommunityAuthorAvatar } from "@/components/community-author-avatar";
import { SettingsEmergencySection } from "@/pages/settings/shared";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import { clearCarerClientSessionKeys, getActiveAppMode, getPrimaryAppRole, type ActiveAppMode } from "@/lib/carer-session";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { isCommunityEnabled } from "@/lib/flags";
import { getFollowCounts, listFollowers, listFollowing } from "@/lib/community";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCommunityProfileFields } from "@/components/account-community-profile-fields";
import { ScrollArea } from "@/components/ui/scroll-area";
import heic2any from "heic2any";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  accountDeletionSubmitUnavailableDescription,
  buildAccountDeletionMailtoHref,
  buildAccountDeletionRequestText,
  buildGmailWebComposeUrl,
  getSupportEmail,
  isAccountDeletionTableUnavailableMessage,
} from "@/lib/support";
import { formatLivingWithDiabetesLine, getProfilesByIds } from "@/lib/profile";
import { DobUnknownNotice } from "@/components/dob-unknown-notice";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function getInitial(email: string): string {
  const first = email.trim().charAt(0).toUpperCase();
  return first || "?";
}

type AccountPageTab = "account" | "public";

function accountTabFromHash(hash: string): AccountPageTab {
  const raw = hash.replace(/^#/, "");
  if (raw === "public" || raw === "posts") return "public";
  return "account";
}

export default function Account() {
  const { user } = useAuth();
  const { isCarer: hasCarerLink, loading: carerLinkLoading } = useLinkedCarer();
  const { data: linkedPatient } = useLinkedPatient();
  const isCarer = !!linkedPatient;
  const { profile, loading: profileLoading, refresh } = useProfile();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [accountTab, setAccountTab] = useState<AccountPageTab>(() =>
    typeof window !== "undefined" ? accountTabFromHash(window.location.hash) : "account",
  );
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [accountDeletionOpen, setAccountDeletionOpen] = useState(false);
  const [accountDeletionSubmitBusy, setAccountDeletionSubmitBusy] = useState(false);
  const [publicCounts, setPublicCounts] = useState<{ followers: number; following: number } | null>(null);
  const [followListKind, setFollowListKind] = useState<"followers" | "following" | null>(null);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListError, setFollowListError] = useState<string | null>(null);
  const [followListRows, setFollowListRows] = useState<
    { id: string; full_name: string; public_handle: string | null; avatar_url: string | null }[]
  >([]);
  const [activeMode, setActiveMode] = useState<ActiveAppMode | null>(() => {
    try {
      return getActiveAppMode();
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onMode = (ev: Event) => {
      const ce = ev as CustomEvent<{ mode?: ActiveAppMode | null }>;
      setActiveMode(ce.detail?.mode ?? getActiveAppMode());
    };
    window.addEventListener("diabeater:app-mode", onMode);
    return () => window.removeEventListener("diabeater:app-mode", onMode);
  }, []);

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

  useEffect(() => {
    if (!user) return;
    if (!isCarer) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#account-emergency") return;
    setLocation("/carer-view#carer-emergency");
  }, [user, isCarer, setLocation]);

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
    clearCarerClientSessionKeys();
    const { error } = await logout();
    if (error) {
      toast({ title: "Could not sign out", description: error.message, variant: "destructive" });
      return;
    }
    setLocation("/welcome");
  }

  const supportEmail = getSupportEmail();
  const deletionRequestText = buildAccountDeletionRequestText({
    userEmail: email,
    userId,
  });
  const accountDeletionMailtoHref =
    supportEmail.trim() !== ""
      ? buildAccountDeletionMailtoHref({
          supportEmail,
          userEmail: email,
          userId,
        })
      : null;
  const gmailComposeUrl =
    supportEmail.trim() !== ""
      ? buildGmailWebComposeUrl({
          supportEmail,
          userEmail: email,
          userId,
        })
      : null;

  async function submitAccountDeletionRequest() {
    const supabase = getSupabase();
    if (!supabase) {
      toast({
        title: "Could not submit",
        description: "Auth is not configured on this build.",
        variant: "destructive",
      });
      return;
    }
    setAccountDeletionSubmitBusy(true);
    const { error } = await supabase.from("account_deletion_requests").insert({
      user_id: userId,
      email,
    });
    setAccountDeletionSubmitBusy(false);
    if (error) {
      const missingTable = isAccountDeletionTableUnavailableMessage(error.message);
      toast({
        title: missingTable ? "Deletion request isn’t available here yet" : "Could not submit request",
        description: missingTable ? accountDeletionSubmitUnavailableDescription() : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Request received",
      description: "We’ll process your deletion request. You can follow up by email if needed.",
    });
    setAccountDeletionOpen(false);
  }

  async function copyAccountDeletionRequest() {
    try {
      await navigator.clipboard.writeText(deletionRequestText);
      toast({
        title: "Copied",
        description: "Paste into Gmail, Outlook on the web, or any mail app.",
      });
    } catch {
      toast({
        title: "Could not copy",
        description: "Select and copy the text in the dialog manually.",
        variant: "destructive",
      });
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadSubmitting(true);
    let toUpload: File = file;
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif");
    if (isHeic) {
      try {
        const converted = (await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        })) as Blob | Blob[];
        const blob = Array.isArray(converted) ? converted[0] : converted;
        if (!blob) throw new Error("No image data returned");

        const base = file.name.replace(/\.(heic|heif)$/i, "") || "avatar";
        toUpload = new File([blob], `${base}.jpg`, { type: "image/jpeg" });
      } catch (err) {
        setUploadSubmitting(false);
        toast({
          title: "Upload failed",
          description:
            err instanceof Error
              ? `Could not convert HEIC photo to JPEG. ${err.message}`
              : "Could not convert HEIC photo to JPEG.",
          variant: "destructive",
        });
        return;
      }
    }

    const uploadResult = await uploadProfileAvatar(toUpload);
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

  const settingsName = storage.getProfile()?.name?.trim() ?? "";
  const displayName = profile?.full_name?.trim() || settingsName || "Your account";
  const nameForInitials = profile?.full_name?.trim() || settingsName;
  const showAvatarImage = Boolean(avatarDisplayUrl && !avatarImgFailed);
  const showPublicProfileTab = isCommunityEnabled && !isCarer;
  const isPublicProfile = profile?.is_public === true;
  const publicHandle = (profile?.public_handle ?? "").replace(/^@/, "").trim();
  const bioPreview = profile?.bio?.trim() || "";
  const primaryRole = getPrimaryAppRole();
  const isCommunityAccount = isCommunityAccountProfile(storage.getProfile());
  const livingWithLine =
    !isCommunityAccount &&
    primaryRole !== "carer" &&
    (activeMode == null || activeMode === "patient")
      ? formatLivingWithDiabetesLine(profile?.diabetes_onset_date ?? null)
      : null;
  const canOpenModeChooser = hasCarerLink;

  useEffect(() => {
    setAccountTab(accountTabFromHash(typeof window !== "undefined" ? window.location.hash : ""));
  }, [location]);

  useEffect(() => {
    if (!showPublicProfileTab) {
      setPublicCounts(null);
      return;
    }
    let active = true;
    void (async () => {
      const res = await getFollowCounts(userId);
      if (!active) return;
      if (res.error) return;
      setPublicCounts({ followers: res.followers, following: res.following });
    })();
    return () => {
      active = false;
    };
  }, [showPublicProfileTab, userId]);

  const setAccountPageTab = useCallback(
    (tab: AccountPageTab) => {
      setAccountTab(tab);
      const hash = tab === "public" ? "#public" : "";
      setLocation(`/account${hash}`);
      if (tab === "account" && typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [setLocation],
  );

  const goToAccountProfileEditor = useCallback(() => {
    setAccountTab("account");
    setLocation("/account#profile");
    window.setTimeout(() => {
      document.getElementById("profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [setLocation]);

  async function openFollowList(kind: "followers" | "following") {
    setFollowListKind(kind);
    setFollowListLoading(true);
    setFollowListError(null);
    setFollowListRows([]);
    const { ids, error } = kind === "followers" ? await listFollowers(userId) : await listFollowing(userId);
    if (error) {
      setFollowListError(error.message);
      setFollowListLoading(false);
      return;
    }
    const map = await getProfilesByIds(ids);
    const rows = ids.map((id) => {
      const p = map.get(id);
      return {
        id,
        full_name: p?.full_name?.trim() || shortId(id),
        public_handle: p?.public_handle?.trim() || null,
        avatar_url: p?.avatar_url ?? null,
      };
    });
    setFollowListRows(rows);
    setFollowListLoading(false);
  }

  const accountHero = (
    <ProfileHeroCard testId="account-hero-card">
      <div className="flex flex-col gap-3">
        <ProfileHeroRow
          avatar={
            <ProfileAvatarTile
              size="md"
              imageUrl={showAvatarImage ? avatarDisplayUrl : null}
              initials={
                nameForInitials
                  ? nameForInitials
                      .split(/\s+/)
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : initial
              }
              alt="Profile photo"
              testId={showAvatarImage ? "avatar-preview" : "avatar-placeholder"}
              onImageError={() => setAvatarImgFailed(true)}
            />
          }
        >
          <ProfileHeroNameRow>
            <div className="min-w-0 flex-1">
              <ProfileDisplayName compact name={displayName} />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 min-h-8 h-8 px-3 rounded-full border-border/60 bg-background/70 text-xs shadow-sm backdrop-blur-sm"
              asChild
            >
              <Link href="/settings" data-testid="link-account-settings">
                Settings
              </Link>
            </Button>
          </ProfileHeroNameRow>
          <ProfileMetaRow>
            <ProfileVerifiedBadge compact verified={verified} />
          </ProfileMetaRow>
        </ProfileHeroRow>

        <ProfileActionGrid>
          {carerLinkLoading ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              data-testid="link-change-view"
              aria-busy="true"
              title="Loading supporter link…"
            >
              Change mode
            </Button>
          ) : canOpenModeChooser ? (
            <Button variant="outline" size="sm" asChild data-testid="link-change-view">
              <Link href="/mode">Change mode</Link>
            </Button>
          ) : null}

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
            data-testid="avatar-upload"
          >
            {uploadSubmitting ? "Uploading…" : "Upload photo"}
          </Button>

          {!isCarer && !isCommunityAccount && (
            <Button variant="outline" size="sm" className="col-span-2" asChild>
              <Link href="/family-carers" data-testid="link-manage-carers">
                Manage supporters
              </Link>
            </Button>
          )}

          {isCarer && (
            <Button variant="outline" size="sm" className="col-span-2" asChild>
              <Link href="/carer-view" data-testid="link-back-to-carer-view">
                Back to Supporter Mode
              </Link>
            </Button>
          )}
        </ProfileActionGrid>
      </div>
    </ProfileHeroCard>
  );

  const accountTabPanel = (
    <>
      <DobUnknownNotice hidden={isCarer || isCommunityAccount} testId="account-dob-unknown-notice" />
      {accountHero}

      {isCommunityEnabled && (
        <AccountCommunityProfileFields variant="standalone" cardId="profile" idPrefix="account" />
      )}

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

      {!isCarer && !isCommunityAccount && (
        <ProfileMutedCard id="account-emergency" testId="account-emergency-card">
          <SettingsEmergencySection variant="embedded" showSyncButton={false} />
        </ProfileMutedCard>
      )}

      <ProfileMutedCard testId="account-actions-card">
        <ProfileSectionHeading title="Account actions" subtitle="Sign-in and security" />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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

          <Button
            variant="ghost"
            size="default"
            className="min-h-11 w-full sm:w-auto text-muted-foreground hover:text-destructive"
            type="button"
            data-testid="account-delete-trigger"
            onClick={() => setAccountDeletionOpen(true)}
          >
            Request account deletion
          </Button>
        </div>
      </ProfileMutedCard>
    </>
  );

  return (
    <PageShell
      variant="narrow"
      density={showPublicProfileTab ? "compact" : "default"}
      className={cn(
        "md:max-w-2xl",
        showPublicProfileTab ? "pt-0 pb-4 md:pt-1 md:pb-6" : "space-y-6 py-4 md:py-8",
      )}
    >
      {!showPublicProfileTab ? (
        <PageHeader
          title="Account"
          description={
            isCarer
              ? "Your account and sign-in options. Open Supporter Mode to see the people you support."
              : isCommunityAccount
                ? "Your community profile and sign-in options."
                : "Your profile, emergency details, and sign-in options."
          }
          className="max-w-xl"
        />
      ) : null}

      {showPublicProfileTab ? (
        <Tabs
          value={accountTab}
          onValueChange={(v) => setAccountPageTab(v as AccountPageTab)}
          className="w-full -mt-0.5"
          data-testid="account-page-tabs"
        >
          <h1 className="sr-only">Account</h1>
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-full bg-muted/50 p-0.5 dark:bg-muted/35">
            <TabsTrigger
              value="account"
              className="rounded-full text-xs font-medium sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="account-tab-account"
            >
              Account
            </TabsTrigger>
            <TabsTrigger
              value="public"
              className="rounded-full text-xs font-medium sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="account-tab-public"
            >
              Public profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-5 space-y-6 focus-visible:outline-none">
            {accountTabPanel}
          </TabsContent>

          <TabsContent value="public" className="mt-5 focus-visible:outline-none">
            <AccountPublicProfileTab
              userId={userId}
              displayName={displayName}
              avatarDisplayUrl={showAvatarImage ? avatarDisplayUrl : null}
              avatarInitials={
                nameForInitials
                  ? nameForInitials
                      .split(/\s+/)
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : initial
              }
              publicHandle={publicHandle}
              bioPreview={bioPreview}
              livingWithLine={livingWithLine}
              isPublic={isPublicProfile}
              followers={publicCounts?.followers ?? 0}
              following={publicCounts?.following ?? 0}
              onOpenFollowers={() => void openFollowList("followers")}
              onOpenFollowing={() => void openFollowList("following")}
              onEditProfile={goToAccountProfileEditor}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">{accountTabPanel}</div>
      )}

      <AlertDialog open={accountDeletionOpen} onOpenChange={setAccountDeletionOpen}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Request account deletion</AlertDialogTitle>
            <AlertDialogDescription>
              We include your account email and user ID so support can verify your request. You can send a request in one
              tap (saved for our team), copy the text to paste anywhere, open Gmail in your browser, or use your
              device&apos;s default mail app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm text-left text-muted-foreground">
            {!supportEmail.trim() ? (
              <Alert>
                <AlertDescription>
                  {import.meta.env.DEV ? (
                    <>
                      Add{" "}
                      <code className="text-xs">VITE_SUPPORT_EMAIL=info@diabeaters.world</code> to repo{" "}
                      <code className="text-xs">.env.local</code> (then restart the dev server) for Gmail and default-mail
                      links. &quot;Send deletion request&quot; still works without it. You can still copy the text below.
                    </>
                  ) : (
                    <>
                      Copy the message below and send it from your email app to your Diabeaters support address. If you
                      don&apos;t have one, contact whoever gave you this app (for example your clinic or the publisher).
                    </>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <p>
                Support: <span className="font-medium text-foreground">{supportEmail}</span>
              </p>
            )}
            <pre className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs whitespace-pre-wrap break-words max-h-40 overflow-y-auto text-foreground">
              {deletionRequestText}
            </pre>
          </div>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col items-stretch">
            <Button
              type="button"
              variant="default"
              className="w-full sm:w-full"
              data-testid="account-delete-copy-request"
              onClick={() => void copyAccountDeletionRequest()}
            >
              Copy request text
            </Button>
            {gmailComposeUrl ? (
              <Button type="button" variant="outline" className="w-full sm:w-full" asChild>
                <a
                  href={gmailComposeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="account-delete-gmail"
                  onClick={() => setAccountDeletionOpen(false)}
                >
                  Open in Gmail (browser)
                </a>
              </Button>
            ) : null}
            {accountDeletionMailtoHref ? (
              <div className="w-full space-y-1">
                <Button type="button" variant="outline" className="w-full sm:w-full" asChild>
                  <a
                    href={accountDeletionMailtoHref}
                    data-testid="account-delete-link"
                    onClick={() => setAccountDeletionOpen(false)}
                  >
                    Open in default mail app
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground text-center px-1">
                  Uses your system mail handler (on Windows this is often Microsoft Outlook, even if you usually use Gmail
                  in the browser).
                </p>
              </div>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-full"
              data-testid="account-delete-submit"
              disabled={accountDeletionSubmitBusy}
              onClick={() => void submitAccountDeletionRequest()}
            >
              {accountDeletionSubmitBusy ? "Sending…" : "Send deletion request (no email app)"}
            </Button>
            <AlertDialogCancel className="w-full sm:w-full m-0">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={followListKind !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFollowListKind(null);
            setFollowListError(null);
            setFollowListRows([]);
            setFollowListLoading(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{followListKind === "following" ? "Following" : "Followers"}</DialogTitle>
            <DialogDescription className="sr-only">
              {followListKind === "following"
                ? "Accounts you follow on the Feed."
                : "Accounts that follow you on the Feed."}
            </DialogDescription>
          </DialogHeader>
          {followListLoading ? (
            <div className="space-y-2 py-2" role="status" aria-label="Loading list">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ) : followListError ? (
            <p className="text-sm text-destructive">{followListError}</p>
          ) : followListRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No one yet.</p>
          ) : (
            <ScrollArea className="flex-1 pr-1">
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden bg-card m-0 list-none p-0">
                {followListRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/community/profile/${encodeURIComponent(row.id)}`}
                      className="flex items-center gap-3 px-3 py-3 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                    >
                      <CommunityAuthorAvatar
                        displayName={row.full_name}
                        avatarPath={row.avatar_url}
                        size="sm"
                        className="h-9 w-9"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{row.full_name}</div>
                        {row.public_handle ? (
                          <div className="text-xs text-muted-foreground truncate">@{row.public_handle}</div>
                        ) : null}
                      </div>
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/70" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
