/**
 * Regulatory and UX copy for CGM prefill (v1).
 * CGM readings stay on-device in v1 — see CGM_DATA_RETENTION_POLICY.
 */

export const CGM_NOT_MEDICAL_DEVICE =
  "Diabeaters is not a medical device. CGM prefill is a convenience only — always confirm on your CGM receiver or meter before treating.";

export const CGM_PREFILL_DISCLAIMER =
  "Prefilled values come from Apple Health or Health Connect. They may be delayed (Dexcom often writes to Apple Health about 3 hours late). You can always edit or ignore the suggestion.";

export const CGM_DATA_RETENTION_POLICY = {
  v1Storage: "on_device_only" as const,
  serverUpload: false,
  description:
    "v1 never uploads CGM streams to Diabeaters servers. Readings are fetched when you open a tool or tap prefill, used locally, and not stored in Supabase.",
  healthCredentials: "OS health permissions only — no LibreLinkUp or Dexcom Share passwords in v1.",
};

export const CGM_HEALTH_SETUP_IOS =
  "In your Dexcom or Libre app, enable sharing blood glucose to Apple Health. Then return here and tap Connect Apple Health.";

export const CGM_HEALTH_SETUP_ANDROID =
  "In your Libre or Dexcom app, enable Health Connect sharing if available. Install Health Connect from the Play Store if prompted.";

export const CGM_WEB_UNAVAILABLE =
  "CGM prefill works in the Diabeaters iPhone and Android apps. Open the app on your phone to connect Apple Health or Health Connect.";
