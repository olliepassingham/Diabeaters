import type { UserSettings } from "@/lib/storage";

export function usesClosedLoop(settings: UserSettings | null | undefined): boolean {
  return settings?.usesClosedLoop === true;
}

/** When automation handles basals, soften generic temp-basal coaching copy. */
export function filterPumpTipsForClosedLoop(tips: string[], settings: UserSettings | null | undefined): string[] {
  if (!usesClosedLoop(settings)) return tips;
  const automationNote =
    "Your closed-loop system may adjust basal automatically — follow your device and care team before manual temp basals.";
  const filtered = tips.filter(
    (t) => !/temp basal|temporary basal|suspend pump|reduce basal|basal reduction/i.test(t),
  );
  if (filtered.length === 0) return [automationNote];
  return [automationNote, ...filtered.slice(0, 2)];
}
