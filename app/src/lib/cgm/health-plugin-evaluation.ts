/** @capgo/capacitor-health evaluation — see docs/cgm-health-plugin-evaluation.md */
export const HEALTH_PLUGIN_EVALUATION = {
  package: "@capgo/capacitor-health",
  capacitorVersion: 8,
  dataType: "bloodGlucose",
  defaultUnit: "mg/dL",
  iosCapability: "HealthKit",
  androidSdk: "Health Connect (API 26+)",
  trendSupport: false,
  writeSupport: false,
} as const;
