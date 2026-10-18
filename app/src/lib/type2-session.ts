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
      // Do not default to "pen" — that pulls Type 1 tips / coach MDI context.
      insulinDeliveryMethod: "",
      usingInsulin: false,
      hasAcceptedDisclaimer: true,
      accountType: "patient",
    };
    storage.saveProfile(next);
    return next;
  }
  const alreadyType2 =
    profile.diabetesType === "type2" &&
    profile.usingInsulin === false &&
    profile.accountType !== "community";
  const needsClearPenDefault =
    alreadyType2 &&
    (profile.insulinDeliveryMethod === "pen" || profile.insulinDeliveryMethod === "pump");
  if (alreadyType2 && !needsClearPenDefault) {
    return profile;
  }
  const next: UserProfile = {
    ...profile,
    diabetesType: "type2",
    usingInsulin: false,
    accountType: "patient",
    // Clear leftover Type 1 delivery so tips/coach stay Type 2–safe.
    insulinDeliveryMethod: needsClearPenDefault || !alreadyType2 ? "" : profile.insulinDeliveryMethod,
  };
  storage.saveProfile(next);
  return next;
}
