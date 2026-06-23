import {
  getActiveAppMode,
  getCachedCloudPrimaryAppRole,
  getOnboardingAccountPath,
  getPrimaryAppRole,
  isCarerSessionMode,
  isCommunityOnlyAccount,
  isCommunitySessionMode,
  isSupporterOnlyAccount,
} from "@/lib/carer-session";
import { isCommunityAccountProfile, storage } from "@/lib/storage";

export type BedtimeReminderEligibilityOptions = {
  /** Whether the signed-in user has an active supporter link to someone. */
  hasCarerLink?: boolean;
  /** Cloud profile marks this account as community-only. */
  cloudCommunityProfile?: boolean;
};

function isCommunityBedtimeSession(
  hasCarerLink: boolean,
  activeMode: ReturnType<typeof getActiveAppMode>,
  options: BedtimeReminderEligibilityOptions,
): boolean {
  const cloudCommunity =
    options.cloudCommunityProfile === true || getCachedCloudPrimaryAppRole() === "community";
  return isCommunitySessionMode(hasCarerLink, activeMode, {
    localCommunityProfile: isCommunityAccountProfile(storage.getProfile()),
    cloudCommunityProfile: cloudCommunity,
  });
}

function isExplicitUserModeSession(
  hasCarerLink: boolean,
  activeMode: ReturnType<typeof getActiveAppMode>,
): boolean {
  if (activeMode === "patient") return true;
  if (activeMode === "carer" || activeMode === "community") return false;

  if (isSupporterOnlyAccount() || isCommunityOnlyAccount()) return false;

  const path = getOnboardingAccountPath();
  if (path === "community" || path === "supporter") return false;

  if (path === "patient" || path === "both") {
    return !isCarerSessionMode(hasCarerLink, activeMode);
  }

  const role = getPrimaryAppRole();
  if (role === "community" || role === "carer") return false;
  if (role === "patient") {
    return !isCarerSessionMode(hasCarerLink, activeMode);
  }

  const cloud = getCachedCloudPrimaryAppRole();
  if (cloud === "community" || cloud === "carer") return false;
  if (cloud === "patient") {
    return !isCarerSessionMode(hasCarerLink, activeMode);
  }

  return false;
}

/**
 * Bedtime check reminders are for User Mode patients only — not supporters or community members.
 */
export function shouldReceiveBedtimeCheckReminders(
  options: BedtimeReminderEligibilityOptions = {},
): boolean {
  const hasCarerLink = options.hasCarerLink ?? false;
  const activeMode = getActiveAppMode();

  if (isSupporterOnlyAccount()) return false;
  if (isCarerSessionMode(hasCarerLink, activeMode)) return false;
  if (isCommunityBedtimeSession(hasCarerLink, activeMode, options)) return false;

  return isExplicitUserModeSession(hasCarerLink, activeMode);
}
