import { useState } from "react";
import { BedtimeLastNightCard } from "@/components/scenarios/bedtime-last-night-card";
import { useBedtimeLastNight } from "@/hooks/use-bedtime-last-night";
import { resolveUserTargetBgRange } from "@/lib/target-bg-range";
import { storage, type BedtimeLog } from "@/lib/storage";
import type { BgUnits } from "@/lib/cgm/types";

/** Overnight CGM review on the alcohol guide — same data path as Bedtime “Last night”. */
export function AlcoholMorningCgmCard({ units }: { units: BgUnits }) {
  // Snapshot once — getBedtimeLogs() returns a new array every call; passing that
  // into the hook used to restart the CGM fetch on every parent re-render.
  const [logs] = useState<BedtimeLog[]>(() => storage.getBedtimeLogs());
  const { insight, status, message, reviewTarget, refresh } = useBedtimeLastNight(logs, units);
  const settings = storage.getSettings();
  const { low, high } = resolveUserTargetBgRange(settings, units);

  if (status === "no_cgm") {
    return (
      <div
        className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground"
        data-testid="card-alcohol-morning-cgm-hint"
      >
        <p className="font-medium text-foreground">Overnight glucose</p>
        <p className="mt-1 leading-snug">
          Connect Dexcom Share or LibreLink Up in Settings → CGM to review last night&apos;s readings here.
          Useful after alcohol, when delayed lows are more common — no need to have logged drinks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="card-alcohol-morning-cgm">
      <p className="px-0.5 text-xs text-muted-foreground">
        Optional overnight CGM review (from your sensor — not from an alcohol log). Delayed lows are more common
        after drinking; check this if you want, then plan your evening.
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
