import { isCommunityEnabled } from "@/lib/flags";

/** Default home for Community Member mode: feed when the feature is on, otherwise the tools hub. */
export function getCommunityMemberLandingPath(): string {
  return isCommunityEnabled ? "/community" : "/tools";
}
