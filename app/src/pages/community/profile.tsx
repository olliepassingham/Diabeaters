import { useCallback, useEffect, useMemo, useState } from "react";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { Link, useLocation, useRoute } from "wouter";
import { MessageCircle, MoreHorizontal, Plus, UserCheck, UserPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ProfileAvatarTile,
  ProfileBioPreview,
  ProfileDisplayName,
  ProfileFollowStats,
  ProfileHandle,
  ProfileHeroCard,
  ProfileMutedCard,
  ProfileSectionHeading,
  ProfileSupportedPersonBadge,
} from "@/components/profile/profile-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageBackButton, PageShell } from "@/components/layout";
import { FeedPostList } from "@/components/community/feed-post-list";
import { FollowListDialog, type FollowListPerson } from "@/components/community/follow-list-dialog";
import { ProfilePostMediaGrid } from "@/components/community/profile-post-media-grid";
import { StoryAvatarRing } from "@/components/community/story-avatar-ring";
import { StoryCreateSheet } from "@/components/community/story-create-sheet";
import { StoryViewerDialog } from "@/components/community/story-viewer-dialog";
import { ProfileStreakBadges } from "@/components/achievements/achievements-panel";
import { fetchPublicProfileStreaks, USER_ACHIEVEMENTS_CHANGED_EVENT } from "@/lib/user-achievements";
import { useResolvedProfileImageUrl } from "@/hooks/use-resolved-profile-image-url";
import { useCommunityStories } from "@/hooks/use-community-stories";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { getPrimaryAppRole } from "@/lib/carer-session";
import {
  blockUser,
  fetchCommunityPostsByAuthorPage,
  getBlockStatus,
  getFollowCounts,
  getOrCreateDmThread,
  isFollowing,
  listFollowers,
  listFollowing,
  submitContentReport,
  unfollowUser,
  followUser,
  unblockUser,
} from "@/lib/community";
import {
  canEngageWithCommunityFeed,
  formatLivingWithDiabetesLine,
  getProfile,
  getPublicCommunityProfile,
  getPublicProfileSupportedPerson,
  getProfilesByIds,
  useProfile,
  type PublicCommunityProfile,
} from "@/lib/profile";
import {
  ProfilePostsViewTabs,
  persistProfilePostsView,
  readStoredProfilePostsView,
  type ProfilePostsView,
} from "@/components/profile/profile-posts-view-tabs";
import {
  BEATIE_FEED_AVATAR_FALLBACK_SRC,
  BEATIE_FEED_BOT_DEFAULT_BIO,
  getBeatieFeedBotUserIdFromEnv,
} from "@/lib/ai-feed-reply/config";
import { isSupabaseConfigured } from "@/lib/supabase";

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

type ListKind = "followers" | "following";

export default function CommunityProfilePage() {
  const [, params] = useRoute("/community/profile/:userId");
  const userId = params?.userId ?? null;
  const { user, loading: authLoading } = useAuth();
  const { profile: viewerProfile, loading: viewerProfileLoading } = useProfile();
  const canEngageWithFeed = !viewerProfileLoading && canEngageWithCommunityFeed(viewerProfile);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [profile, setProfile] = useState<PublicCommunityProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [followingThem, setFollowingThem] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [blockStatus, setBlockStatus] = useState({ iBlockedThem: false, theyBlockedMe: false });

  const [listOpen, setListOpen] = useState(false);
  const [listKind, setListKind] = useState<ListKind>("followers");
  const [listRows, setListRows] = useState<FollowListPerson[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [postsView, setPostsView] = useState<ProfilePostsView>(() => readStoredProfilePostsView());
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyCreateOpen, setStoryCreateOpen] = useState(false);

  const profileStoryAuthorIds = useMemo(() => (userId ? [userId] : []), [userId]);
  const { storiesByAuthor, refresh: refreshStories, ringState: profileRingState } = useCommunityStories(
    user?.id,
    profileStoryAuthorIds,
  );
  const authorStories = userId ? storiesByAuthor.get(userId) ?? [] : [];
  const storyRing = profileRingState(userId ?? "");

  const isSelf = Boolean(user?.id && userId && user.id === userId);
  const canViewStory = Boolean(isSelf || followingThem);
  /** Diabetes journey line: show to others when present; on your own profile only if you use the app as a patient. */
  const onset = profile?.diabetes_onset_date?.trim() ?? "";
  const showDiabetesJourneyLine = Boolean(
    onset && formatLivingWithDiabetesLine(onset) && (!isSelf || getPrimaryAppRole() === "patient"),
  );

  const loginNextHref = useMemo(() => {
    if (!userId) return "/community";
    return `/login?next=${encodeURIComponent(`/community/profile/${userId}`)}`;
  }, [userId]);

  const loadProfile = useCallback(async () => {
    if (!userId || authLoading) return;
    setLoading(true);
    setLoadError(null);
    const viewingSelf = user?.id === userId;
    try {
      if (viewingSelf) {
        const [{ profile: full }, supportedRes] = await Promise.all([
          getProfile(userId),
          getPublicProfileSupportedPerson(userId),
        ]);
        if (!full) {
          setProfile(null);
          setLoadError("Could not load profile.");
        } else {
          const streaks = await fetchPublicProfileStreaks(
            userId,
            full.pinned_achievement_ids,
            full.public_streak_counts,
          );
          setProfile({
            id: full.id,
            full_name: full.full_name,
            avatar_url: full.avatar_url,
            bio: full.bio,
            public_handle: full.public_handle,
            is_public: full.is_public,
            diabetes_onset_date: full.diabetes_onset_date ?? null,
            streaks,
            achievements: streaks,
            supported_person: supportedRes.data,
          });
        }
      } else {
        const { profile: pub, error } = await getPublicCommunityProfile(userId);
        if (error) {
          setLoadError(error.message);
          setProfile(null);
        } else {
          setProfile(pub);
          if (!pub) setLoadError("This profile is private or not available.");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id, authLoading]);

  const refreshSocial = useCallback(async () => {
    if (!userId) return;
    const [{ followers, following, error: cErr }, fol, blk] = await Promise.all([
      getFollowCounts(userId),
      user?.id && user.id !== userId ? isFollowing(userId) : Promise.resolve({ value: false, error: null }),
      user?.id && user.id !== userId ? getBlockStatus(userId) : Promise.resolve({ status: { iBlockedThem: false, theyBlockedMe: false }, error: null }),
    ]);
    if (!cErr) setCounts({ followers, following });
    if (fol.error == null) setFollowingThem(fol.value);
    if (blk.error == null) setBlockStatus(blk.status);
  }, [userId, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void loadProfile();
  }, [loadProfile, authLoading]);

  useEffect(() => {
    if (authLoading || !userId || user?.id !== userId) return;
    const refresh = () => void loadProfile();
    window.addEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(USER_ACHIEVEMENTS_CHANGED_EVENT, refresh);
  }, [authLoading, userId, user?.id, loadProfile]);

  useEffect(() => {
    if (authLoading || !userId) return;
    void refreshSocial();
  }, [refreshSocial, authLoading, userId]);

  const displayName = profile?.full_name?.trim() || (userId ? shortId(userId) : "Member");
  const { displayUrl: avatarDisplayUrl } = useResolvedProfileImageUrl(profile?.avatar_url ?? null);
  const beatieFeedBotUserId = useMemo(() => getBeatieFeedBotUserIdFromEnv(), []);
  const isBeatieProfile = Boolean(beatieFeedBotUserId && userId === beatieFeedBotUserId);
  const profileHeaderImageSrc =
    avatarDisplayUrl ?? (isBeatieProfile ? BEATIE_FEED_AVATAR_FALLBACK_SRC : null);

  async function openList(kind: ListKind) {
    if (!userId) return;
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Sign in to see who follows this profile.",
      });
      return;
    }
    setListKind(kind);
    setListOpen(true);
    setListLoading(true);
    setListRows([]);
    const res = kind === "followers" ? await listFollowers(userId) : await listFollowing(userId);
    if (res.error) {
      setListLoading(false);
      toast({ title: "Could not load list", description: res.error.message, variant: "destructive" });
      return;
    }
    const map = await getProfilesByIds(res.ids);
    const botId = getBeatieFeedBotUserIdFromEnv();
    setListRows(
      res.ids.map((id) => {
        const p = map.get(id);
        return {
          id,
          full_name: p?.full_name?.trim() || shortId(id),
          public_handle: p?.public_handle?.trim() || null,
          avatar_url: p?.avatar_url ?? null,
          fallbackSrc: botId && id === botId ? BEATIE_FEED_AVATAR_FALLBACK_SRC : null,
        };
      }),
    );
    setListLoading(false);
  }

  async function toggleFollow() {
    if (!userId || !user?.id || isSelf) return;
    if (blockStatus.iBlockedThem || blockStatus.theyBlockedMe) return;
    setFollowBusy(true);
    if (followingThem) {
      const { error } = await unfollowUser(userId);
      if (error) {
        toast({ title: "Unfollow failed", description: error.message, variant: "destructive" });
      } else {
        setFollowingThem(false);
        setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
      }
    } else {
      const { error } = await followUser(userId);
      if (error) {
        toast({ title: "Follow failed", description: error.message, variant: "destructive" });
      } else {
        setFollowingThem(true);
        setCounts((c) => ({ ...c, followers: c.followers + 1 }));
      }
    }
    setFollowBusy(false);
  }

  async function openMessages() {
    if (!userId || !user?.id || isSelf) return;
    if (isBeatieProfile) {
      setLocation(buildCoachHref({ from: "beatie_profile" }));
      return;
    }
    const { data, error } = await getOrCreateDmThread(userId);
    if (error) {
      const msg = error.message.toLowerCase().includes("dm_not_allowed") || error.message.includes("blocked")
        ? "Messaging is not available (blocked)."
        : error.message;
      toast({ title: "Messages", description: msg, variant: "destructive" });
      return;
    }
    if (data) setLocation(`/community/messages/${data}`);
  }

  async function confirmBlock() {
    if (!userId) return;
    setBlockConfirmOpen(false);
    const { error } = await blockUser(userId);
    if (error) {
      toast({ title: "Block failed", description: error.message, variant: "destructive" });
      return;
    }
    setBlockStatus((s) => ({ ...s, iBlockedThem: true }));
    setFollowingThem(false);
    toast({ title: "Blocked", description: "You will not see each other’s posts or messages." });
    setLocation("/community");
  }

  async function handleUnblock() {
    if (!userId) return;
    const { error } = await unblockUser(userId);
    if (error) {
      toast({ title: "Unblock failed", description: error.message, variant: "destructive" });
      return;
    }
    setBlockStatus((s) => ({ ...s, iBlockedThem: false }));
    void refreshSocial();
    toast({ title: "Unblocked" });
  }

  async function submitReport() {
    if (!userId) return;
    setReportBusy(true);
    const { error } = await submitContentReport({
      targetType: "profile",
      targetId: userId,
      reason: reportReason.trim() || null,
    });
    setReportBusy(false);
    if (error) {
      toast({ title: "Report failed", description: error.message, variant: "destructive" });
      return;
    }
    setReportOpen(false);
    setReportReason("");
    toast({ title: "Thanks", description: "Your report was submitted." });
  }

  if (!isSupabaseConfigured()) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-3">
        <PageBackButton />
        <p className="text-sm text-muted-foreground">Connect Supabase to view public profiles.</p>
      </PageShell>
    );
  }

  if (!userId) {
    return (
      <PageShell variant="standard" className="max-w-lg mx-auto space-y-3">
        <PageBackButton />
        <p className="text-sm text-muted-foreground">Invalid link.</p>
      </PageShell>
    );
  }

  const profileBio =
    profile?.bio?.trim() ||
    (isBeatieProfile ? BEATIE_FEED_BOT_DEFAULT_BIO : "");
  const livingWithLine =
    showDiabetesJourneyLine && profile
      ? formatLivingWithDiabetesLine(profile.diabetes_onset_date)
      : null;

  return (
    <PageShell variant="standard" className="max-w-lg mx-auto space-y-3 pb-4">
      <div className="flex items-center justify-between gap-2">
        <PageBackButton />
        {isSelf && profile ? (
          <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" asChild>
            <Link href="/account#profile">Edit</Link>
          </Button>
        ) : null}
      </div>
      <h1 className="sr-only">{profile ? displayName : "Profile"}</h1>

      {loading || authLoading ? (
        <ProfileMutedCard>
          <p className="text-sm text-muted-foreground">Loading profile…</p>
        </ProfileMutedCard>
      ) : !profile ? (
        <ProfileMutedCard>
          <p className="text-sm text-muted-foreground">{loadError ?? "Profile not found."}</p>
        </ProfileMutedCard>
      ) : (
        <ProfileHeroCard testId="public-profile-hero" compact flat>
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="shrink-0">
                {storyRing !== "none" && authorStories.length > 0 && canViewStory ? (
                  <StoryAvatarRing
                    prominent
                    state={storyRing}
                    onClick={() => setStoryViewerOpen(true)}
                    label={
                      isSelf
                        ? authorStories.every((s) => s.viewed_by_me)
                          ? "Rewatch your stories"
                          : "Your stories"
                        : `Watch ${displayName}'s stories`
                    }
                  >
                    <ProfileAvatarTile
                      imageUrl={profileHeaderImageSrc}
                      initials={profileInitials(displayName)}
                      alt={displayName}
                      size="md"
                      shape="circle"
                      framed={false}
                    />
                  </StoryAvatarRing>
                ) : (
                  <ProfileAvatarTile
                    imageUrl={profileHeaderImageSrc}
                    initials={profileInitials(displayName)}
                    alt={displayName}
                    size="md"
                    shape="circle"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <div className="min-w-0">
                      <ProfileDisplayName size="sm" name={displayName} />
                    </div>
                    {profile.public_handle ? <ProfileHandle handle={profile.public_handle} /> : null}
                    {isSelf && !profile.is_public ? (
                      <span className="inline-flex rounded-full border border-amber-500/35 bg-amber-500/[0.08] px-1.5 py-0 text-[10px] font-medium text-amber-950 dark:text-amber-100">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                  {!isSelf && user ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground"
                          aria-label="Profile options"
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {blockStatus.iBlockedThem ? (
                          <DropdownMenuItem onSelect={() => void handleUnblock()}>Unblock</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => setBlockConfirmOpen(true)}>Block</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setReportOpen(true)}>Report</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                <ProfileFollowStats
                  followers={counts.followers}
                  following={counts.following}
                  onFollowersClick={() => void openList("followers")}
                  onFollowingClick={() => void openList("following")}
                />
                <ProfileStreakBadges
                  streaks={profile.streaks ?? profile.achievements ?? []}
                  size="sm"
                  className="gap-1"
                />
              </div>
            </div>

            {profileBio || livingWithLine ? (
              <ProfileBioPreview
                compact
                bio={profileBio}
                livingWithLine={livingWithLine}
                emptyLabel={isBeatieProfile ? BEATIE_FEED_BOT_DEFAULT_BIO : "No bio yet."}
              />
            ) : null}

            {profile.supported_person || user || !isSelf ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {profile.supported_person ? (
                  <ProfileSupportedPersonBadge person={profile.supported_person} subtle className="w-fit" />
                ) : null}
                {isSelf && user ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-fit gap-1 rounded-full px-2.5 text-xs"
                    onClick={() => setStoryCreateOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Add story
                  </Button>
                ) : null}
                {!isSelf && user ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={followingThem ? "secondary" : "default"}
                      disabled={followBusy || blockStatus.iBlockedThem || blockStatus.theyBlockedMe}
                      onClick={() => void toggleFollow()}
                      className="h-7 gap-1 rounded-full px-3 text-xs"
                    >
                      {followingThem ? (
                        <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                      {followingThem ? "Following" : "Follow"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={blockStatus.iBlockedThem || blockStatus.theyBlockedMe}
                      onClick={() => void openMessages()}
                      className="h-7 gap-1 rounded-full px-3 text-xs"
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Message
                    </Button>
                  </>
                ) : null}
                {!isSelf && !user ? (
                  <p className="text-xs text-muted-foreground">
                    <Link href={loginNextHref} className="font-medium text-primary underline-offset-4 hover:underline">
                      Sign in
                    </Link>{" "}
                    to follow or message.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </ProfileHeroCard>
      )}

      {!loading && !authLoading && profile ? (
        !user ? (
          <ProfileMutedCard>
            <ProfileSectionHeading title="Posts" subtitle="Sign in to view this member's posts" />
            <p className="mt-3 text-sm text-muted-foreground">
              <Link href={loginNextHref} className="font-medium text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>{" "}
              to see what they have shared on the Feed.
            </p>
          </ProfileMutedCard>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <ProfileSectionHeading
                title={isSelf ? "Your posts" : "Posts"}
                subtitle={isSelf ? "What you've shared on the Feed" : undefined}
              />
              <ProfilePostsViewTabs
                value={postsView}
                onChange={(view) => {
                  setPostsView(view);
                  persistProfilePostsView(view);
                }}
              />
            </div>
            {postsView === "photos" ? (
              <ProfilePostMediaGrid
                authorId={userId}
                emptyTitle={isSelf ? "No photos yet" : "No photos shared"}
                emptyDescription={
                  isSelf ? "Posts with photos will show up here." : "This member hasn't shared any photos yet."
                }
              />
            ) : (
              <FeedPostList
                viewerId={user.id}
                canEngageWithFeed={canEngageWithFeed}
                scopeKey={`profile:${userId}`}
                pageSize={20}
                showRefreshButton={false}
                emptyStateTitle="No posts yet"
                emptyStateDescription={isSelf ? "You haven’t posted yet." : "This member hasn’t posted yet."}
                fetchPage={(limit, cursor) => fetchCommunityPostsByAuthorPage(userId, limit, cursor, null)}
              />
            )}
          </div>
        )
      ) : null}

      <FollowListDialog
        open={listOpen}
        onOpenChange={(open) => {
          setListOpen(open);
          if (!open) {
            setListRows([]);
            setListLoading(false);
          }
        }}
        kind={listKind}
        onKindChange={(next) => void openList(next)}
        counts={counts}
        people={listRows}
        loading={listLoading}
      />

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report profile</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tell us briefly what is wrong. This is for safety review only, not medical advice.
          </p>
          <Textarea
            rows={4}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Optional details"
            maxLength={2000}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitReport()} disabled={reportBusy}>
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block this person?</AlertDialogTitle>
            <AlertDialogDescription>
              You will not see each other’s posts or comments, and you cannot message each other.
              You can unblock them anytime from Feed → ⋯ → Blocked users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmBlock()}>Block</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StoryViewerDialog
        open={storyViewerOpen}
        onOpenChange={setStoryViewerOpen}
        viewerId={user?.id}
        entries={
          authorStories.length > 0 && userId && canViewStory
            ? authorStories.map((story) => ({
                authorId: userId,
                story,
                authorDisplayName: displayName,
                authorAvatarUrl: profile?.avatar_url ?? null,
              }))
            : []
        }
        initialIndex={0}
        onViewed={() => refreshStories()}
      />
      <StoryCreateSheet
        open={storyCreateOpen}
        onOpenChange={setStoryCreateOpen}
        onPosted={() => refreshStories()}
      />
    </PageShell>
  );
}
