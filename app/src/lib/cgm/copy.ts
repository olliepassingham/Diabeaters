/**
 * Regulatory and UX copy for CGM prefill (v1).
 * CGM readings stay on-device in v1 — see CGM_DATA_RETENTION_POLICY.
 */

export const CGM_NOT_MEDICAL_DEVICE =
  "Diabeaters is not a medical device. CGM prefill is a convenience only — always confirm on your CGM receiver or meter before treating.";

export const CGM_PREFILL_DISCLAIMER =
  "Prefilled values may come from Dexcom Share or LibreLink Up (near-live) or Apple Health / Health Connect (often delayed). Always confirm on your CGM before treating.";

export const CGM_DATA_RETENTION_POLICY = {
  v1Storage: "on_device_only" as const,
  serverUpload: "latest_snapshot_only" as const,
  description:
    "v1 does not upload CGM history. When you allow Live glucose for a supporter, your device may sync only the latest reading (value, trend, time) so they can see it in the top bar — not charts or credentials.",
  healthCredentials:
    "Apple Health uses OS permissions only. Dexcom Share and LibreLink Up credentials are stored on this device. If you enable exercise low-glucose alerts with Dexcom Share, your login is sent encrypted to our server only while an exercise session is active so we can poll in the background; it is removed when the session ends.",
};

export const CGM_HEALTH_SETUP_IOS =
  "In your Dexcom or Libre app, enable sharing blood glucose to Apple Health. Then return here and tap Connect Apple Health.";

export const CGM_HEALTH_SETUP_ANDROID =
  "In your Libre or Dexcom app, enable Health Connect sharing if available. Install Health Connect from the Play Store if prompted.";

export const CGM_WEB_UNAVAILABLE =
  "CGM prefill works in the Diabeaters iPhone and Android apps. Open the app on your phone to connect Apple Health or Health Connect.";
