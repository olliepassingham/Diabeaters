import { BedtimeLastNightCard } from "@/components/scenarios/bedtime-last-night-card";
import { useBedtimeLastNight } from "@/hooks/use-bedtime-last-night";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage } from "@/lib/storage";
import type { BgUnits } from "@/lib/cgm/types";

/** Overnight CGM review on the alcohol guide — same data path as Bedtime “Last night”. */
export function AlcoholMorningCgmCard({ units }: { units: BgUnits }) {
  const logs = storage.getBedtimeLogs();
  const { insight, status, message, reviewTarget, refresh } = useBedtimeLastNight(logs, units);
  const settings = storage.getSettings();
  const { low, high } = resolveUserTargetBgRange(settings, units);

  if (status === "no_cgm") {
    return (
      <div
        className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground"
        data-testid="card-alcohol-morning-cgm-hint"
      >
        <p className="font-medium text-foreground">After a drinking night</p>
        <p className="mt-1 leading-snug">
          Connect Dexcom Share or LibreLink Up in Settings → CGM to review overnight lows the next morning.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="card-alcohol-morning-cgm">
      <p className="text-xs text-muted-foreground px-0.5">
        Overnight glucose often matters more after alcohol — review last night, then plan your checks.
      </p>
      <BedtimeLastNightCard
        insight={insight}
        status={status}
        message={message}
        usedCalendarFallback={reviewTarget?.source === "calendar_fallback"}
        units={units}
        targetLow={low}
        targetHigh={high}
        onRefresh={refresh}
      />
    </div>
  );
}
