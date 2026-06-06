import { isCommunityEnabled } from "@/lib/flags";

/** Default home for Community Member mode: feed when the feature is on, otherwise the tools hub. */
export function getCommunityMemberLandingPath(isPublic?: boolean): string {
  if (!isCommunityEnabled) return "/tools";
  if (isPublic === false) return "/account#profile";
  return "/community";
}

/** Where community onboarding should send users to finish feed access. */
export function getCommunityMemberOnboardingCompletePath(): string {
  return "/account#profile";
}
