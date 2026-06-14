import {
  getActiveAppMode,
  isCarerSessionMode,
  isCommunityOnlyAccount,
  isCommunitySessionMode,
  isSupporterOnlyAccount,
} from "@/lib/carer-session";
import { isCommunityAccountProfile, storage } from "@/lib/storage";

export type BedtimeReminderEligibilityOptions = {
  /** Whether the signed-in user has an active supporter link to someone. */
  hasCarerLink?: boolean;
};

/**
 * Bedtime check reminders are for User Mode patients only — not supporters or community members.
 */
export function shouldReceiveBedtimeCheckReminders(
  options: BedtimeReminderEligibilityOptions = {},
): boolean {
  const hasCarerLink = options.hasCarerLink ?? false;
  const activeMode = getActiveAppMode();

  if (isSupporterOnlyAccount()) return false;
  if (isCommunityOnlyAccount()) return false;

  if (
    isCommunitySessionMode(hasCarerLink, activeMode, {
      localCommunityProfile: isCommunityAccountProfile(storage.getProfile()),
    })
  ) {
    return false;
  }

  if (isCarerSessionMode(hasCarerLink, activeMode)) return false;
  if (activeMode === "carer" || activeMode === "community") return false;

  return true;
}
