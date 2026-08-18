import type { UserSettings } from "@/lib/storage";

export function usesClosedLoop(settings: UserSettings | null | undefined): boolean {
  return settings?.usesClosedLoop === true;
}

export type ClosedLoopSurface = "meal" | "correction" | "bedtime" | "sickDay" | "pumpTips";

/** Shared educational copy — not device-specific dosing. */
export const CLOSED_LOOP_NOTES: Record<ClosedLoopSurface, string> = {
  meal: "Closed-loop may already be adjusting insulin. Check IOB and don't stack a full bolus on automation unless your team has a plan for that.",
  correction: "If automation is active, check IOB and wait before a manual correction unless your team has a stacking rule.",
  bedtime: "If Sleep activity is on, let the loop work overnight. Avoid stacking a bedtime correction on automation without your team's plan.",
  sickDay: "Illness can outpace the loop. Check the infusion site and IOB — don't assume automation will cover a failed set.",
  pumpTips:
    "Your closed-loop system may adjust basal automatically — follow your device and care team before manual temp basals.",
};

export function closedLoopSafetyNote(
  surface: ClosedLoopSurface,
  settings: UserSettings | null | undefined,
): string | null {
  if (!usesClosedLoop(settings)) return null;
  return CLOSED_LOOP_NOTES[surface];
}

/** When automation handles basals, soften generic temp-basal coaching copy. */
export function filterPumpTipsForClosedLoop(tips: string[], settings: UserSettings | null | undefined): string[] {
  if (!usesClosedLoop(settings)) return tips;
  const automationNote = CLOSED_LOOP_NOTES.pumpTips;
  const filtered = tips.filter(
    (t) => !/temp basal|temporary basal|suspend pump|reduce basal|basal reduction/i.test(t),
  );
  if (filtered.length === 0) return [automationNote];
  return [automationNote, ...filtered.slice(0, 2)];
}
