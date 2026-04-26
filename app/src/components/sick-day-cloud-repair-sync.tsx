import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLinkedCarer } from "@/hooks/use-linked-carer";
import { getActiveAppMode } from "@/lib/carer-session";
import { repairSickDayCloudIfLocalInactive } from "@/lib/scenarios-supabase";

/**
 * When signed in as the patient (User mode), align Supabase sick_day with local storage if they ended sick day
 * offline or on an older build. Skipped in Supporter mode so we never touch the wrong scenarios row.
 */
export function SickDayCloudRepairSync() {
  const { user, loading } = useAuth();
  const { isCarer: hasCarerLink } = useLinkedCarer();

  useEffect(() => {
    if (loading || !user?.id) return;
    if (hasCarerLink && getActiveAppMode() === "carer") return;
    void repairSickDayCloudIfLocalInactive();
  }, [loading, user?.id, hasCarerLink]);

  return null;
}
