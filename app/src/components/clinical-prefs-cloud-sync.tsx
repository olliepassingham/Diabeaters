import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode } from "@/lib/carer-session";
import { applyClinicalPrefsFromCloudRow } from "@/lib/clinical-prefs-cloud-sync";

/**
 * When the signed-in patient profile loads from Supabase, merge insulin delivery method + TDD
 * into local storage (new device / cleared storage). Skipped in supporter-only carer mode.
 */
export function ClinicalPrefsCloudSync() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isCarer: hasCarerLink } = useLinkedCarer();

  useEffect(() => {
    if (!user?.id || !profile) return;
    if (hasCarerLink && getActiveAppMode() === "carer") return;
    applyClinicalPrefsFromCloudRow(profile);
  }, [
    user?.id,
    hasCarerLink,
    profile?.id,
    profile?.account_type,
    profile?.insulin_delivery_method,
    profile?.tdd,
    profile?.date_of_birth,
    profile?.full_name,
    profile?.pharmacy?.updatedAt,
  ]);

  return null;
}
