import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountPublicProfileTab } from "@/pages/account/account-public-tab";
import { ChevronDown } from "lucide-react";
import { isUserVerified, logout } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
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
import { FollowListDialog, type FollowListPerson } from "@/components/community/follow-list-dialog";
import { SettingsEmergencySection } from "@/pages/settings/shared";
import { isCommunityAccountProfile, storage } from "@/lib/storage";
import { clearCarerClientSessionKeys, getActiveAppMode, getPrimaryAppRole, type ActiveAppMode, canSwitchAppMode } from "@/lib/carer-session";
import { useSupporterSession } from "@/hooks/use-supporter-session";
import { isCommunityEnabled } from "@/lib/flags";
import { getFollowCounts, listFollowers, listFollowing } from "@/lib/community";
import { AccountCommunityProfileFields } from "@/components/account-community-profile-fields";
import { BecomeSupporterCta } from "@/components/become-supporter-cta";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  accountDeletionSubmitUnavailableDescription,
  buildAccountDeletionMailtoHref,
  buildAccountDeletionRequestText,
  buildGmailWebComposeUrl,
  getSupportEmail,
  isAccountDeletionTableUnavailableMessage,
} from "@/lib/support";
import { formatLivingWithDiabetesLine, getProfilesByIds } from "@/lib/profile";
import { resolveUserDisplayName } from "@/lib/user-display-name";
import { isOnline } from "@/lib/offline";

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
  const { hasCarerLink, inSupporterSession, loading: carerLinkLoading } = useSupporterSession();
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
  const [accountDeletionAlternativesOpen, setAccountDeletionAlternativesOpen] = useState(false);
  const [accountDeletionSubmitBusy, setAccountDeletionSubmitBusy] = useState(false);
  const [publicCounts, setPublicCounts] = useState<{ followers: number; following: number } | null>(null);
  const [followListKind, setFollowListKind] = useState<"followers" | "following" | null>(null);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListError, setFollowListError] = useState<string | null>(null);
  const [followListRows, setFollowListRows] = useState<FollowListPerson[]>([]);
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
    if (avatarResolveError && isOnline() && !avatarLoadErrorToastShown.current) {
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
    if (!inSupporterSession) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#account-emergency") return;
    setLocation("/carer-view#carer-emergency");
  }, [user, inSupporterSession, setLocation]);

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
      description: `We'll process your deletion request for ${email}. Contact ${supportEmail} if you need to follow up.`,
    });
    setAccountDeletionOpen(false);
    setAccountDeletionAlternativesOpen(false);
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
  const resolvedName = resolveUserDisplayName({
    cloudFullName: profile?.full_name,
    localName: settingsName,
  });
  const displayName = resolvedName || "Your account";
  const nameForInitials = resolvedName;
  const showAvatarImage = Boolean(avatarDisplayUrl && !avatarImgFailed);
  const showPublicProfileTab = isCommunityEnabled;
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
  const canOpenModeChooser = hasCarerLink && canSwitchAppMode();
  const modeSwitchLabel =
    activeMode === "carer" ? "Switch to User Mode" : "Switch to Supporter Mode";

  useEffect(() => {
    const syncTabFromHash = () => {
      setAccountTab(accountTabFromHash(typeof window !== "undefined" ? window.location.hash : ""));
    };
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#profile") return;
    if (profileLoading) return;
    window.setTimeout(() => {
      document.getElementById("profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [location, profileLoading]);

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
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadSubmitting}
              busy={uploadSubmitting}
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
              className="col-span-2"
              disabled
              data-testid="link-change-view"
              aria-busy="true"
              title="Loading supporter link…"
            >
              Change mode
            </Button>
          ) : canOpenModeChooser ? (
            <Button variant="outline" size="sm" className="col-span-2" asChild data-testid="link-change-view">
              <Link href="/mode">{modeSwitchLabel}</Link>
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

          {!inSupporterSession && !isCommunityAccount && (
            <Button variant="outline" size="sm" className="col-span-2" asChild>
              <Link href="/family-carers" data-testid="link-manage-carers">
                Manage supporters
              </Link>
            </Button>
          )}
        </ProfileActionGrid>
      </div>
    </ProfileHeroCard>
  );

  const accountTabPanel = (
    <>
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

      {!inSupporterSession && !isCommunityAccount && (
        <ProfileMutedCard id="account-emergency" testId="account-emergency-card">
          <SettingsEmergencySection variant="embedded" showSyncButton={false} />
        </ProfileMutedCard>
      )}

      {!inSupporterSession ? <BecomeSupporterCta /> : null}

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
            inSupporterSession
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
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/45 p-1 dark:bg-muted/30">
            <TabsTrigger
              value="account"
              className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="account-tab-account"
            >
              Account
            </TabsTrigger>
            <TabsTrigger
              value="public"
              className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
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
              diabetesOnsetDate={profile?.diabetes_onset_date ?? null}
              isPublic={isPublicProfile}
              followers={publicCounts?.followers ?? 0}
              following={publicCounts?.following ?? 0}
              onOpenFollowers={() => void openFollowList("followers")}
              onOpenFollowing={() => void openFollowList("following")}
              onEditProfile={goToAccountProfileEditor}
              supporterMode={inSupporterSession}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">{accountTabPanel}</div>
      )}

      <AlertDialog
        open={accountDeletionOpen}
        onOpenChange={(open) => {
          setAccountDeletionOpen(open);
          if (!open) setAccountDeletionAlternativesOpen(false);
        }}
      >
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Request account deletion</AlertDialogTitle>
            <AlertDialogDescription>
              We&apos;ll queue a deletion request for our team. This usually includes your profile, logs, and other data
              tied to <span className="font-medium text-foreground">{email}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm text-left text-muted-foreground">
            <p>
              Tap submit below and we&apos;ll take it from there. You don&apos;t need to write an email unless you
              prefer to.
            </p>
            {!supportEmail.trim() && import.meta.env.DEV ? (
              <Alert>
                <AlertDescription>
                  Add <code className="text-xs">VITE_SUPPORT_EMAIL=info@diabeaters.world</code> to{" "}
                  <code className="text-xs">.env.local</code> for email fallbacks in dev. Submit still works without it.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col items-stretch">
            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-full"
              data-testid="account-delete-submit"
              disabled={accountDeletionSubmitBusy}
              onClick={() => void submitAccountDeletionRequest()}
            >
              {accountDeletionSubmitBusy ? "Submitting…" : "Submit deletion request"}
            </Button>
            <Collapsible open={accountDeletionAlternativesOpen} onOpenChange={setAccountDeletionAlternativesOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between text-muted-foreground"
                  data-testid="account-delete-alternatives-trigger"
                >
                  Other ways to contact support
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      accountDeletionAlternativesOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-1">
                {supportEmail.trim() ? (
                  <p className="text-xs text-muted-foreground px-1">
                    Support: <span className="font-medium text-foreground">{supportEmail}</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground px-1">
                    Copy the message below and email whoever published this app (for example your clinic).
                  </p>
                )}
                <pre className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs whitespace-pre-wrap break-words max-h-32 overflow-y-auto text-foreground">
                  {deletionRequestText}
                </pre>
                <Button
                  type="button"
                  variant="outline"
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
                      On Windows this may open Outlook even if you usually use Gmail in the browser.
                    </p>
                  </div>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
            <AlertDialogCancel className="w-full sm:w-full m-0">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FollowListDialog
        open={followListKind !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFollowListKind(null);
            setFollowListError(null);
            setFollowListRows([]);
            setFollowListLoading(false);
          }
        }}
        kind={followListKind ?? "followers"}
        onKindChange={(next) => void openFollowList(next)}
        counts={publicCounts ?? undefined}
        people={followListRows}
        loading={followListLoading}
        error={followListError}
      />
    </PageShell>
  );
}
