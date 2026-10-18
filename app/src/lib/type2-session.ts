import { getOnboardingAccountPath } from "@/lib/carer-session";
import { isType2Patient } from "@/lib/insulin-clinical-access";
import { storage, type UserProfile } from "@/lib/storage";

/** Ensure local profile matches Type 2 path so tools / Help Now gate correctly after SQL or re-login. */
export function ensureLocalType2Profile(profile: UserProfile | null): UserProfile | null {
  const pathIsType2 = getOnboardingAccountPath() === "type2";
  if (!pathIsType2 && !isType2Patient(profile)) return profile;
  if (!profile) {
    const next: UserProfile = {
      name: "",
      email: "",
      dateOfBirth: "",
      bgUnits: "mmol/L",
      carbUnits: "grams",
      diabetesType: "type2",
      insulinDeliveryMethod: "pen",
      usingInsulin: false,
      hasAcceptedDisclaimer: true,
      accountType: "patient",
    };
    storage.saveProfile(next);
    return next;
  }
  if (profile.diabetesType === "type2" && profile.usingInsulin === false && profile.accountType !== "community") {
    return profile;
  }
  const next: UserProfile = {
    ...profile,
    diabetesType: "type2",
    usingInsulin: false,
    accountType: "patient",
  };
  storage.saveProfile(next);
  return next;
}
