import { useMemo, useState } from "react";
import { Pencil, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FeedPostList } from "@/components/community/feed-post-list";
import { ProfilePostMediaGrid } from "@/components/community/profile-post-media-grid";
import { StoryAvatarRing } from "@/components/community/story-avatar-ring";
import { StoryCreateSheet } from "@/components/community/story-create-sheet";
import { StoryViewerDialog } from "@/components/community/story-viewer-dialog";
import { AccountPublicAchievementsSummary } from "@/components/achievements/achievements-panel";
import {
  ProfilePostsViewTabs,
  persistProfilePostsView,
  readStoredProfilePostsView,
  type ProfilePostsView,
} from "@/components/profile/profile-posts-view-tabs";
import {
  ProfileActionGrid,
  ProfileAvatarTile,
  ProfileBioPreview,
  ProfileDisplayName,
  ProfileFollowStats,
  ProfileHandle,
  ProfileHeroCard,
  ProfileHeroNameRow,
  ProfileHeroRow,
  ProfileMetaRow,
  ProfileMutedCard,
  ProfileSectionHeading,
} from "@/components/profile/profile-ui";
import { fetchCommunityPostsByAuthorPage } from "@/lib/community";
import { useCommunityStories } from "@/hooks/use-community-stories";
import { canEngageWithCommunityFeed, useProfile } from "@/lib/profile";
import { sharePublicProfile } from "@/lib/share-public-profile";
import { useToast } from "@/hooks/use-toast";

export function AccountPublicProfileTab({
  userId,
  displayName,
  avatarDisplayUrl,
  avatarInitials,
  publicHandle,
  bioPreview,
  livingWithLine,
  diabetesOnsetDate,
  isPublic,
  followers,
  following,
  onOpenFollowers,
  onOpenFollowing,
  onEditProfile,
  supporterMode = false,
}: {
  userId: string;
  displayName: string;
  avatarDisplayUrl: string | null;
  avatarInitials: string;
  publicHandle: string;
  bioPreview: string;
  livingWithLine: string | null;
  diabetesOnsetDate?: string | null;
  isPublic: boolean;
  followers: number;
  following: number;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onEditProfile: () => void;
  /** When true (Supporter Mode), hide patient habit streaks — they are not earned in this mode. */
  supporterMode?: boolean;
}) {
  const { toast } = useToast();
  const { profile: viewerProfile, loading: viewerProfileLoading } = useProfile();
  const canEngageWithFeed = !viewerProfileLoading && canEngageWithCommunityFeed(viewerProfile);
  const publicProfileHref = `/community/profile/${encodeURIComponent(userId)}`;
  const [postsView, setPostsView] = useState<ProfilePostsView>(() => readStoredProfilePostsView());
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyCreateOpen, setStoryCreateOpen] = useState(false);
  const storyAuthorIds = useMemo(() => [userId], [userId]);
  const { storiesByAuthor, refresh: refreshStories, ringState } = useCommunityStories(userId, storyAuthorIds);
  const authorStories = storiesByAuthor.get(userId) ?? [];
  const storyRing = ringState(userId);
  const hasActiveStory = storyRing !== "none" && authorStories.length > 0;

  const avatarTile = (
    <ProfileAvatarTile
      size="md"
      imageUrl={avatarDisplayUrl}
      initials={avatarInitials}
      alt={displayName}
      href={hasActiveStory ? undefined : publicProfileHref}
      shape={hasActiveStory ? "circle" : "rounded"}
      framed={!hasActiveStory}
      testId="link-my-public-profile-avatar"
    />
  );

  async function handleShareProfile() {
    const result = await sharePublicProfile({
      userId,
      displayName,
      publicHandle,
    });
    if (result === "copied") {
      toast({ title: "Link copied", description: "Paste to share your public profile." });
    } else if (result === "failed") {
      toast({
        title: "Could not share",
        description: "Try again or copy your profile link from your browser.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4 animate-soft-in">
      {!isPublic ? (
        <Alert className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20">
          <AlertDescription className="text-sm">
            Your public profile is turned off — others cannot find you on the Feed. Turn on{" "}
            <strong className="font-medium text-foreground">Public profile</strong> in Account to share posts and appear
            in search.
            <Button type="button" variant="outline" size="sm" className="mt-3 w-full sm:w-auto" onClick={onEditProfile}>
              Edit profile settings
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <ProfileHeroCard testId="account-public-profile-hero">
        <div className="flex flex-col gap-3">
          <ProfileHeroRow
            avatar={
              hasActiveStory ? (
                <StoryAvatarRing
                  prominent
                  state={storyRing}
                  onClick={() => setStoryViewerOpen(true)}
                  label={
                    authorStories.every((s) => s.viewed_by_me) ? "Rewatch your stories" : "Your stories"
                  }
                >
                  {avatarTile}
                </StoryAvatarRing>
              ) : (
                avatarTile
              )
            }
          >
            <ProfileHeroNameRow>
              <div className="min-w-0 flex-1 space-y-0.5">
                <ProfileDisplayName
                  compact
                  name={displayName}
                  href={publicProfileHref}
                  testId="link-my-public-profile-name"
                />
                <ProfileMetaRow>
                  <ProfileHandle handle={publicHandle || null} />
                  {!isPublic ? (
                    <span className="text-[11px] font-medium text-muted-foreground">Not visible on Feed</span>
                  ) : null}
                </ProfileMetaRow>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 min-h-8 h-8 px-3 rounded-full text-xs"
                onClick={onEditProfile}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden />
                Edit
              </Button>
            </ProfileHeroNameRow>

            <ProfileFollowStats
              followers={followers}
              following={following}
              onFollowersClick={onOpenFollowers}
              onFollowingClick={onOpenFollowing}
              followersTestId="link-my-public-profile-followers"
              followingTestId="link-my-public-profile-following"
            />

            {!supporterMode ? <AccountPublicAchievementsSummary onsetDate={diabetesOnsetDate} /> : null}

            <ProfileBioPreview compact bio={bioPreview} livingWithLine={livingWithLine} />
          </ProfileHeroRow>

          <ProfileActionGrid>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={isPublic ? undefined : "col-span-2"}
              onClick={() => setStoryCreateOpen(true)}
              data-testid="button-account-add-story"
            >
              <Plus className="h-4 w-4 mr-2 shrink-0" aria-hidden />
              Add story
            </Button>
            {isPublic ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="share-public-profile"
                onClick={() => void handleShareProfile()}
              >
                <Share2 className="h-4 w-4 mr-2 shrink-0" aria-hidden />
                Share profile
              </Button>
            ) : null}
          </ProfileActionGrid>
        </div>
      </ProfileHeroCard>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <ProfileSectionHeading title="Your posts" />
          {isPublic ? (
            <ProfilePostsViewTabs
              value={postsView}
              onChange={(view) => {
                setPostsView(view);
                persistProfilePostsView(view);
              }}
            />
          ) : null}
        </div>
        {!isPublic ? (
          <ProfileMutedCard>
            <p className="text-sm text-muted-foreground">
              Posts stay private until you turn on your public profile. You can still draft from the Feed composer.
            </p>
          </ProfileMutedCard>
        ) : postsView === "photos" ? (
          <ProfilePostMediaGrid
            authorId={userId}
            emptyTitle="No photos yet"
            emptyDescription="Posts with photos or videos will show up here."
          />
        ) : (
          <FeedPostList
            viewerId={userId}
            canEngageWithFeed={canEngageWithFeed}
            scopeKey={`account-public:${userId}`}
            pageSize={20}
            showRefreshButton
            emptyStateTitle="No posts yet"
            emptyStateDescription="Share something on the Feed — it will show up here."
            fetchPage={(limit, cursor) => fetchCommunityPostsByAuthorPage(userId, limit, cursor, null)}
          />
        )}
      </div>

      <StoryViewerDialog
        open={storyViewerOpen}
        onOpenChange={setStoryViewerOpen}
        viewerId={userId}
        entries={
          hasActiveStory
            ? authorStories.map((story) => ({
                authorId: userId,
                story,
                authorDisplayName: displayName,
                authorAvatarUrl: avatarDisplayUrl,
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
    </div>
  );
}
