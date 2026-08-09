import {
  getPrimaryAppRole,
  isCommunityMemberAccount,
  isCommunityOnlyAccount,
  isPersistedCommunityAccount,
  setActiveAppMode,
  type OnboardingAccountPath,
  type PrimaryAppRole,
} from "@/lib/carer-session";
import { syncAccountTypeToCloud } from "@/lib/clinical-prefs-cloud-sync";
import { profileIndicatesExistingPatientAccount } from "@/lib/community-path-patient-reconcile";
import { getProfile, upsertProfile, type ProfileRow } from "@/lib/profile";
import { applyRegionUnitDefaults } from "@/lib/region";
import { recordOnboardingFinishedAt, storage, isCommunityAccountProfile } from "@/lib/storage";
import { restoreCommunitySessionMarkers } from "@/lib/welcome-path-community-reconcile";

const ONBOARDING_LS = "diabeater_onboarding_completed";
const DEFAULT_COMMUNITY_REGION = "UK";

export type CommunityMemberSessionParams = {
  profile: ProfileRow | null | undefined;
  linkedCarer: boolean;
  primaryAppRole?: PrimaryAppRole | null;
  localCommunityProfile?: boolean;
  /**
   * Durable signup-time intent read from Supabase auth `user_metadata` (see
   * `onboardingAccountPathFromUserMetadata`). Catches the case where session-storage
   * markers were lost between choosing "Community Member" on /welcome and completing
   * email verification — without it, those accounts fall through to patient onboarding.
   */
  metadataAccountPath?: OnboardingAccountPath | null;
};

/** Whether this account should skip patient onboarding and use Community Member mode. */
export function resolvesAsCommunityMemberAccount(params: CommunityMemberSessionParams): boolean {
  if (params.linkedCarer) return false;
  if (profileIndicatesExistingPatientAccount(params.profile)) return false;
  if (params.profile?.account_type === "community") return true;
  if (params.profile?.primary_app_role === "community") return true;
  if (params.localCommunityProfile ?? isCommunityAccountProfile(storage.getProfile())) return true;
  if (params.primaryAppRole === "community") return true;
  if (params.primaryAppRole == null && getPrimaryAppRole() === "community") return true;
  if (isCommunityOnlyAccount() || isPersistedCommunityAccount()) return true;
  if (params.metadataAccountPath === "community") return true;
  return false;
}

/** Local + chosen-path markers before cloud profile exists (signup/login). */
export function hasCommunityMemberIntent(): boolean {
  return isCommunityMemberAccount();
}

export function shouldUseCommunityMemberSession(
  profile: ProfileRow | null | undefined,
  metadataAccountPath?: OnboardingAccountPath | null,
): boolean {
  if (profileIndicatesExistingPatientAccount(profile)) return false;
  if (profile?.account_type === "community" || profile?.primary_app_role === "community") return true;
  if (metadataAccountPath === "community") return true;
  return hasCommunityMemberIntent();
}

export function markCommunityOnboardingCompleteLocally(): void {
  try {
    localStorage.setItem(ONBOARDING_LS, "true");
    localStorage.removeItem("diabeater_onboarding_struggle");
  } catch {
    /* ignore */
  }
  recordOnboardingFinishedAt();
}

export function saveCommunityMemberLocalProfile(opts?: {
  name?: string;
  email?: string;
  region?: "UK" | "US" | "OTHER";
}): void {
  const region = opts?.region ?? DEFAULT_COMMUNITY_REGION;
  const units = applyRegionUnitDefaults(region, {});
  const existing = storage.getProfile();
  storage.saveProfile({
    name: opts?.name?.trim() || existing?.name?.trim() || "",
    email: opts?.email?.trim() || existing?.email?.trim() || "",
    bgUnits: units.bgUnits,
    carbUnits: "grams",
    diabetesType: "none",
    insulinDeliveryMethod: "pen",
    usingInsulin: false,
    hasAcceptedDisclaimer: true,
    dateOfBirth: "",
    accountType: "community",
    region,
    weightDisplayUnit: units.weightDisplayUnit,
    emergencyNumber: existing?.emergencyNumber,
  });
}

/** Persist community session markers, local profile, and cloud profile (when online). */
export async function finalizeCommunityMemberSession(
  userId: string,
  opts?: { email?: string; fullName?: string | null },
): Promise<{ error: Error | null }> {
  if (!userId.trim()) return { error: null };

  restoreCommunitySessionMarkers();
  saveCommunityMemberLocalProfile({
    email: opts?.email,
    name: opts?.fullName?.trim() || undefined,
  });
  markCommunityOnboardingCompleteLocally();
  setActiveAppMode("community");

  const { profile } = await getProfile(userId);
  if (profileIndicatesExistingPatientAccount(profile)) {
    return { error: null };
  }

  const needsCloudSync =
    profile?.onboarding_complete !== true ||
    profile?.account_type !== "community" ||
    profile?.primary_app_role !== "community";

  if (!needsCloudSync) return { error: null };

  const fullName =
    opts?.fullName?.trim() ||
    profile?.full_name?.trim() ||
    storage.getProfile()?.name?.trim() ||
    null;

  const { error } = await upsertProfile({
    id: userId,
    onboarding_complete: true,
    account_type: "community",
    primary_app_role: "community",
    full_name: fullName,
  });
  if (error) return { error };

  const acctRes = await syncAccountTypeToCloud(userId);
  return { error: acctRes.error };
}

/** Restore community markers and local completion after login on a new device. */
export async function ensureCommunityMemberSessionReady(
  userId: string,
  opts?: { email?: string; metadataAccountPath?: OnboardingAccountPath | null },
): Promise<void> {
  if (!userId.trim()) return;
  const { profile } = await getProfile(userId);
  if (!shouldUseCommunityMemberSession(profile, opts?.metadataAccountPath)) return;
  await finalizeCommunityMemberSession(userId, {
    email: opts?.email,
    fullName: profile?.full_name ?? null,
  });
}
