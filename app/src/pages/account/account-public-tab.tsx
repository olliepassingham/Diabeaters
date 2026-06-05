import { Pencil, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FeedPostList } from "@/components/community/feed-post-list";
import { AchievementsPanel } from "@/components/achievements/achievements-panel";
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
  isPublic,
  followers,
  following,
  onOpenFollowers,
  onOpenFollowing,
  onEditProfile,
}: {
  userId: string;
  displayName: string;
  avatarDisplayUrl: string | null;
  avatarInitials: string;
  publicHandle: string;
  bioPreview: string;
  livingWithLine: string | null;
  isPublic: boolean;
  followers: number;
  following: number;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onEditProfile: () => void;
}) {
  const { toast } = useToast();
  const publicProfileHref = `/community/profile/${encodeURIComponent(userId)}`;

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
              <ProfileAvatarTile
                size="md"
                imageUrl={avatarDisplayUrl}
                initials={avatarInitials}
                alt={displayName}
                href={publicProfileHref}
                testId="link-my-public-profile-avatar"
              />
            }
          >
            <ProfileHeroNameRow>
              <div className="min-w-0 flex-1">
                <ProfileDisplayName
                  compact
                  name={displayName}
                  href={publicProfileHref}
                  testId="link-my-public-profile-name"
                />
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

            <ProfileMetaRow>
              <ProfileHandle handle={publicHandle || null} />
              {!isPublic ? (
                <span className="text-[11px] font-medium text-muted-foreground">Not visible on Feed</span>
              ) : null}
            </ProfileMetaRow>

            <ProfileFollowStats
              followers={followers}
              following={following}
              onFollowersClick={onOpenFollowers}
              onFollowingClick={onOpenFollowing}
              followersTestId="link-my-public-profile-followers"
              followingTestId="link-my-public-profile-following"
            />

            <ProfileBioPreview compact bio={bioPreview} livingWithLine={livingWithLine} />
          </ProfileHeroRow>

          {isPublic ? (
            <ProfileActionGrid>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-2"
                data-testid="share-public-profile"
                onClick={() => void handleShareProfile()}
              >
                <Share2 className="h-4 w-4 mr-2 shrink-0" aria-hidden />
                Share profile
              </Button>
            </ProfileActionGrid>
          ) : null}
        </div>
      </ProfileHeroCard>

      <AchievementsPanel showProfileToggles userId={userId} />

      <div className="space-y-3">
        <ProfileSectionHeading title="Your posts" subtitle="What others see when they visit your profile" />
        {!isPublic ? (
          <ProfileMutedCard>
            <p className="text-sm text-muted-foreground">
              Posts stay private until you turn on your public profile. You can still draft from the Feed composer.
            </p>
          </ProfileMutedCard>
        ) : (
          <FeedPostList
            viewerId={userId}
            scopeKey={`account-public:${userId}`}
            pageSize={20}
            showRefreshButton
            emptyStateTitle="No posts yet"
            emptyStateDescription="Share something on the Feed — it will show up here."
            fetchPage={(limit, cursor) => fetchCommunityPostsByAuthorPage(userId, limit, cursor, null)}
          />
        )}
      </div>
    </div>
  );
}
