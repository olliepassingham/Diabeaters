import { syncAccountTypeToCloud } from "@/lib/clinical-prefs-cloud-sync";
import { updateProfile } from "@/lib/profile";
import { isCommunityAccountProfile, storage } from "@/lib/storage";

/** Drop local/cloud community markers once the account becomes supporter-only. */
export async function clearCommunityProfileAfterSupporterLink(
  userId: string,
): Promise<{ error: Error | null }> {
  const localProfile = storage.getProfile();
  if (localProfile && isCommunityAccountProfile(localProfile)) {
    storage.saveProfile({ ...localProfile, accountType: undefined });
  }

  const { error } = await updateProfile({ id: userId, account_type: null });
  if (error) return { error: new Error(error.message) };

  const sync = await syncAccountTypeToCloud(userId);
  if (sync.error) return { error: sync.error };

  return { error: null };
}
