import { Redirect } from "wouter";
import { FeedLoadingSkeleton } from "@/components/empty-state";
import { CommunityProfileSetupPrompt } from "@/components/community-profile-setup-prompt";
import { isCommunityEnabled } from "@/lib/flags";
import { useProfile } from "@/lib/profile";

type CommunityFeatureGateProps = {
  children: React.ReactNode;
  /** When false, only the build flag is required (e.g. `/community/settings`). Default true. */
  requirePublicProfile?: boolean;
};

/** Community routes: build flag; optionally `profiles.is_public` when participation requires it. */
export function CommunityFeatureGate({
  children,
  requirePublicProfile = true,
}: CommunityFeatureGateProps) {
  const { profile, loading } = useProfile();

  if (!isCommunityEnabled) return <Redirect to="/" replace />;

  if (loading) {
    return <FeedLoadingSkeleton rows={4} />;
  }

  // Soft-browse routes pass requirePublicProfile={false} so patients can read the Feed
  // before finishing a public profile. Engagement is gated separately in-page.
  if (requirePublicProfile && !profile?.is_public) {
    return <CommunityProfileSetupPrompt />;
  }

  return <>{children}</>;
}
