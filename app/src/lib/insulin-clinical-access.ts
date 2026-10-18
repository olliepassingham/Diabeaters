import type { UserProfile } from "@/lib/storage";

/** Local profile fields used to decide insulin / Type 1 clinical surfaces. */
export type InsulinAccessProfile = Pick<UserProfile, "diabetesType" | "usingInsulin" | "accountType"> | null | undefined;

export function isType2Patient(profile: InsulinAccessProfile): boolean {
  return profile?.diabetesType === "type2";
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

/** Paths that require insulin clinical tools — block for Type 2. */
export function isInsulinClinicalPath(pathOnly: string): boolean {
  const p = (pathOnly || "/").split("?")[0] ?? "/";
  if (p === "/adviser" || p.startsWith("/adviser/")) return true;
  if (p === "/tools/correction") return true;
  if (p === "/supplies" || p.startsWith("/supplies/")) return true;
  if (p === "/scenarios/exercise") return true;
  if (p === "/scenarios/bedtime" || p === "/bedtime") return true;
  if (p === "/scenarios/sick-day" || p === "/sick-day") return true;
  if (p === "/scenarios/pump-failure") return true;
  if (p.startsWith("/settings/ratios")) return true;
  return false;
}
