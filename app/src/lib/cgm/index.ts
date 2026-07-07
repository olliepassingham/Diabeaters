export type { CgmAdapter } from "./adapter";
export type { GlucoseReading, CgmSourceId, BgUnits, CgmAvailability, CgmAccessResult } from "./types";
export {
  CGM_V1_MODE,
  CGM_PREFILL_WARN_AGE_MINUTES,
  CGM_PREFILL_STALE_AGE_MINUTES,
  CGM_V1_ENABLED_SOURCES,
  CGM_V2_PLANNED_SOURCES,
  isCgmSourceEnabledInV1,
} from "./v1-scope";
export {
  CGM_NOT_MEDICAL_DEVICE,
  CGM_PREFILL_DISCLAIMER,
  CGM_DATA_RETENTION_POLICY,
  CGM_HEALTH_SETUP_IOS,
  CGM_HEALTH_SETUP_ANDROID,
  CGM_WEB_UNAVAILABLE,
} from "./copy";
export {
  readCgmPreferences,
  writeCgmPreferences,
  isCgmPrefillActive,
  DEFAULT_CGM_PREFERENCES,
  type CgmPreferences,
} from "./preferences";
export { fetchLatestCgmReading, connectHealthPlatformCgm, listCgmAdapters, getCgmAdapter } from "./registry";
export { getBgPrefill, bgPrefillFromReading, type BgPrefillResult } from "./prefill";
export { assessReadingStaleness, formatAgeMinutes } from "./staleness";
export { mgDlToMmol, mmolToMgDl, convertGlucoseValue } from "./units";
export { probeHealthNativeBridge, type HealthNativeProbe } from "./health-native-probe";
export { healthPlatformCgmAdapter } from "./adapters/health-platform";
export { HEALTH_PLUGIN_EVALUATION } from "./health-plugin-evaluation";
