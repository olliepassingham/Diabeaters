import { getOnboardingAccountPath } from "@/lib/carer-session";
import type { UserProfile } from "@/lib/storage";

/** Local profile fields used to decide insulin / Type 1 clinical surfaces. */
export type InsulinAccessProfile = Pick<UserProfile, "diabetesType" | "usingInsulin" | "accountType"> | null | undefined;

export function isType2Patient(profile: InsulinAccessProfile): boolean {
  return profile?.diabetesType === "type2";
}

/** True when this device session is the Type 2 patient home (profile or signup path). */
export function isType2AppSession(profile?: InsulinAccessProfile): boolean {
  if (isType2Patient(profile)) return true;
  return getOnboardingAccountPath() === "type2";
}

/**
 * Full insulin dosing / pump / ratio tools (Type 1 clinical lane).
 * Type 2 patients use the patient shell but this stays false for v1.
 */
export function hasInsulinClinicalTools(profile: InsulinAccessProfile): boolean {
  if (!profile) return false;
  if (profile.accountType === "community") return false;
  if (profile.diabetesType === "type2" || profile.diabetesType === "none") return false;
  if (profile.usingInsulin === false) return false;
  return true;
}

/**
 * Paths that require insulin clinical tools — block for Type 2 / community.
 * Supply tracker is allowed for Type 2 (meds / kit without insulin dosing).
 */
export function isInsulinClinicalPath(pathOnly: string, profile?: InsulinAccessProfile): boolean {
  const p = (pathOnly || "/").split("?")[0] ?? "/";
  if (p === "/adviser" || p.startsWith("/adviser/")) return true;
  if (p === "/tools/correction") return true;
  if (p === "/supplies" || p.startsWith("/supplies/")) {
    return !isType2AppSession(profile);
  }
  // The exercise guide is built around insulin/glucose check-ins — Type 1 only
  // until a Type 2 activity flow exists.
  if (p === "/scenarios/exercise") return true;
  if (p === "/scenarios/bedtime" || p === "/bedtime") return true;
  if (p === "/scenarios/sick-day" || p === "/sick-day") return true;
  if (p === "/scenarios/pump-failure") return true;
  // Alcohol situation tool still runs meal/bolus math — Type 1 clinical only until a Type 2 education flow exists.
  if (p === "/scenarios/alcohol") return true;
  if (p.startsWith("/settings/ratios")) return true;
  return false;
}

/**
 * Type 1–oriented helper pages kept off the Type 2 tools hub (and deep links).
 * Hypo help is not listed for Type 2; deep links still render education-only.
 */
export function isType2HiddenToolsPath(pathOnly: string): boolean {
  const p = (pathOnly || "/").split("?")[0] ?? "/";
  if (p === "/tools/achievements") return true;
  if (p === "/tools/activity" || p.startsWith("/tools/activity/")) return true;
  return false;
}
