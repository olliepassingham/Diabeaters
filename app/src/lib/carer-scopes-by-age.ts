import type { CarerScopes } from "@/lib/carers.types";
import { DEFAULT_CARER_SCOPES } from "@/lib/carers.types";
import { getAgeBand, type UserAgeBand } from "@/lib/user-age";

/**
 * Default supporter scopes when a new link is created (must stay aligned with
 * `public.redeem_carer_invite` defaults in Supabase migrations).
 *
 * - Child (under 13): guardian-style — clinical basics on cloud profile are included
 *   so parents can help keep delivery/TDD/DOB accurate (still revocable in Family & supporters).
 * - Teen / adult / unknown DOB: same as {@link DEFAULT_CARER_SCOPES} (clinical off when unknown).
 */
export function defaultCarerScopesForAgeBand(band: UserAgeBand): CarerScopes {
  if (band === "child") {
    return {
      supplies: true,
      appointments: true,
      scenarios: true,
      hypo_alerts: true,
      emergency_info: true,
      clinical_settings: true,
      public_profile_mention: false,
    };
  }
  return {
    ...DEFAULT_CARER_SCOPES,
    public_profile_mention: false,
  };
}

/** Uses the same age bands as the rest of the app ({@link getAgeBand}). */
export function defaultCarerScopesFromProfileDob(dateOfBirth: string | null | undefined): CarerScopes {
  return defaultCarerScopesForAgeBand(getAgeBand(dateOfBirth));
}

export function carerScopePresetSummary(band: UserAgeBand): string {
  if (band === "child") {
    return "Under 13: new supporter links start with clinical basics enabled (you can turn any access off below).";
  }
  if (band === "teen") {
    return "Age 13–17: new supporter links match your privacy toggles; clinical basics stay off unless you enable them.";
  }
  return "New supporter links use your privacy toggles below; clinical basics stay off unless you enable them.";
}
