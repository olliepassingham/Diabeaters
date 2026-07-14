import type { BgPrefillResult } from "@/lib/cgm/prefill";
import { useBgPrefill, type UseBgPrefillOptions } from "@/hooks/use-bg-prefill";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { useSupporterLiveBg } from "@/hooks/use-supporter-live-bg";

/**
 * Live BG for the current session: linked patient's cloud snapshot in Supporter Mode,
 * otherwise on-device CGM prefill.
 */
export function useSessionBgPrefill(options?: UseBgPrefillOptions): {
  prefill: BgPrefillResult | null;
  loading: boolean;
  refresh: () => void;
  fromSupporter: boolean;
} {
  const { data: linkedPatient } = useLinkedPatient();
  const inSupporterSession = Boolean(linkedPatient);
  const scopeOn = linkedPatient?.scopes.live_glucose !== false;
  const supporterEnabled = inSupporterSession && scopeOn;

  const device = useBgPrefill({
    ...options,
    pollIntervalMs: supporterEnabled ? undefined : options?.pollIntervalMs,
  });
  const supporter = useSupporterLiveBg(linkedPatient?.patientId ?? null, supporterEnabled);

  if (supporterEnabled) {
    return {
      prefill: supporter.prefill,
      loading: supporter.loading,
      refresh: supporter.refresh,
      fromSupporter: true,
    };
  }

  return {
    prefill: device.prefill,
    loading: device.loading,
    refresh: device.refresh,
    fromSupporter: false,
  };
}
