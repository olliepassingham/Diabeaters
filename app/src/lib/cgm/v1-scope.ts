/**
 * v1 product decision: prefill-only via OS health stores (HealthKit / Health Connect).
 * See docs/cgm-integration-v1-scope.md.
 */

export const CGM_V1_MODE = "prefill_health_only" as const;

/** Prefill offered with a freshness warning above this age. */
export const CGM_PREFILL_WARN_AGE_MINUTES = 60;

/** Readings older than this are stale for automatic prefill. */
export const CGM_PREFILL_STALE_AGE_MINUTES = 180;

/** Sources enabled in v1. */
export const CGM_V1_ENABLED_SOURCES = ["health_platform"] as const;

/** Sources planned for v2 (adapter stubs exist). */
export const CGM_V2_PLANNED_SOURCES = ["nightscout", "libre_link_up", "dexcom_share"] as const;

export function isCgmSourceEnabledInV1(source: string): boolean {
  return (CGM_V1_ENABLED_SOURCES as readonly string[]).includes(source);
}
