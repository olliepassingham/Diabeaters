/**
 * Terminology — UK Type 1 diabetes app.
 *
 * Canonical relationship words for the app:
 *
 * - "supporter": the linked adult, parent, partner, or friend who follows along
 *   with someone's diabetes. Use this in patient-facing copy ("your supporter",
 *   "tell supporters", "Family & supporters" link).
 * - "person you support": used when the viewer is in Supporter Mode and we are
 *   referring to the patient they are linked to ("dashboard for the person you
 *   support").
 *
 * "carer" / "carers" is kept in code identifiers, file names, and stable feature
 * IDs (`useLinkedCarer`, `carer-session.ts`, `invokeNotifyCarersOnHypo`, etc.)
 * to avoid churn — but UI strings should use "supporter" / "person you support".
 *
 * Casing: prefer sentence case ("Family & supporters") for nav/section labels;
 * Title Case is reserved for the app name and explicit branded buttons such as
 * "Help Now" or "Treated a Hypo".
 *
 * If you need to add new copy, search for "supporter" or "person you support"
 * to stay consistent rather than introducing new variants.
 */
export const TERMINOLOGY_GUIDE = {
  patientFacingLinkedAdult: "supporter",
  supporterFacingLinkedPatient: "person you support",
} as const;
