import { isCommunityEnabled } from "@/lib/flags";
import {
  getProfile,
  needsCommunityProfileSetup,
  type ProfileRow,
} from "@/lib/profile";

export type CommunityLandingProfile = Pick<
  ProfileRow,
  "full_name" | "public_handle" | "is_public"
>;

/** Focused first-run public profile setup for Community Members. */
export const COMMUNITY_PROFILE_SETUP_PATH = "/community/setup";

/**
 * Default home for Community Member mode.
 *
 * - No profile arg → `/community` (in-app home / nav when profile isn't loaded yet)
 * - `false` → setup path (legacy incomplete signal)
 * - `true` → `/community`
 * - profile object / null → setup until display name + @handle + public are set,
 *   otherwise `/community`
 */
export function getCommunityMemberLandingPath(
  profileOrIsPublic?: CommunityLandingProfile | boolean | null,
): string {
  if (!isCommunityEnabled) return "/tools";
  if (typeof profileOrIsPublic === "boolean") {
    return profileOrIsPublic === false ? COMMUNITY_PROFILE_SETUP_PATH : "/community";
  }
  if (profileOrIsPublic === undefined) {
    return "/community";
  }
  return needsCommunityProfileSetup(profileOrIsPublic) ? COMMUNITY_PROFILE_SETUP_PATH : "/community";
}

/** Where community onboarding / first-run should send users to finish feed access. */
export function getCommunityMemberOnboardingCompletePath(): string {
  return COMMUNITY_PROFILE_SETUP_PATH;
}

/**
 * Resolve landing from the signed-in cloud profile.
 * Incomplete public profiles (name + handle) go to community setup first.
 */
export async function resolveCommunityMemberLandingPath(
  userId: string | null | undefined,
): Promise<string> {
  if (!isCommunityEnabled) return "/tools";
  if (!userId?.trim()) return getCommunityMemberOnboardingCompletePath();
  const { profile } = await getProfile(userId);
  return getCommunityMemberLandingPath(profile ?? null);
}
