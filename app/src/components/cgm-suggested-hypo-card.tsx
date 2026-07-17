import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DetectedHypoEpisode } from "@/lib/cgm/detect-hypo-episodes";
import { pickSuggestedHypoEpisode } from "@/lib/cgm/pick-suggested-hypo-episode";
import { dismissCgmHypoEpisode } from "@/lib/cgm/suggested-hypo-dismiss";
import type { CgmChartPoint } from "@/lib/cgm/cgm-chart";
import type { BgUnits } from "@/lib/cgm/types";
import { formatTargetBgInput } from "@/lib/hypo-context";
import { useToast } from "@/hooks/use-toast";
import { storage } from "@/lib/storage";

type CgmSuggestedHypoCardProps = {
  points: CgmChartPoint[];
  targetLow: number;
  units: BgUnits;
  onLogged?: () => void;
};

function formatEpisodeWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CgmSuggestedHypoCard({ points, targetLow, units, onLogged }: CgmSuggestedHypoCardProps) {
  const { toast } = useToast();
  const [revision, setRevision] = useState(0);

  const episode = useMemo(() => {
    void revision;
    return pickSuggestedHypoEpisode(points, targetLow, storage.getHypoTreatments());
  }, [points, targetLow, revision]);

  if (!episode) return null;

  function confirm(ep: DetectedHypoEpisode) {
    storage.addHypoTreatment({
      timestamp: ep.nadirAt,
      glucoseLevel: ep.nadirValue,
      notes: `Logged from glucose trends (possible low · ~${ep.durationMinutes} min below target)`,
      carerNotified: false,
    });
    dismissCgmHypoEpisode(ep.id);
    setRevision((n) => n + 1);
    onLogged?.();
    toast({
      title: "Added to activity log",
      description: "Supporters were not notified — this was logged from past CGM readings.",
    });
  }

  function dismiss(ep: DetectedHypoEpisode) {
    dismissCgmHypoEpisode(ep.id);
    setRevision((n) => n + 1);
  }

  const bgLabel = `${formatTargetBgInput(episode.nadirValue, units)} ${units}`;

  return (
    <div
      className="rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 shadow-none"
      data-testid="card-cgm-suggested-hypo"
      role="region"
      aria-label="Possible low on your chart"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="space-y-0.5">
            <p className="text-sm font-medium leading-snug text-foreground">
              Possible low · {formatEpisodeWhen(episode.nadirAt)}
            </p>
            <p className="text-xs leading-snug text-muted-foreground">
              Lowest {bgLabel} · ~{episode.durationMinutes} min below target. Sensor noise can look like this —
              only add if it was a real hypo.
            </p>
            <p className="text-xs leading-snug text-muted-foreground">
              Adds to your activity log only — won&apos;t notify supporters.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 px-2.5 text-xs"
              onClick={() => confirm(episode)}
              data-testid="button-cgm-suggested-hypo-confirm"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Add to activity log
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => dismiss(episode)}
              data-testid="button-cgm-suggested-hypo-dismiss"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
