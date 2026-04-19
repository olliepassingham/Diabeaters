import { Redirect } from "wouter";
import { isCommunityEnabled } from "@/lib/flags";
import { useProfile } from "@/lib/profile";

type CommunityFeatureGateProps = {
  children: React.ReactNode;
  /** When false, only the build flag is required (e.g. `/community/settings`). Default true. */
  requirePublicProfile?: boolean;
};

/** Community routes: build flag; optionally `profiles.is_public` for feed and messaging. */
export function CommunityFeatureGate({
  children,
  requirePublicProfile = true,
}: CommunityFeatureGateProps) {
  const { profile, loading } = useProfile();

  if (!isCommunityEnabled) return <Redirect to="/" replace />;

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-sm text-muted-foreground" aria-busy="true">
        Loading…
      </div>
    );
  }

  if (requirePublicProfile && !profile?.is_public) return <Redirect to="/account#profile" replace />;

  return <>{children}</>;
}
