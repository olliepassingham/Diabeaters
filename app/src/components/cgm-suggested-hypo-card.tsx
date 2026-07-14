import { useMemo, useState } from "react";
import { Activity, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card
      className="overflow-hidden rounded-2xl border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card shadow-none"
      data-testid="card-cgm-suggested-hypo"
    >
      <CardContent className="space-y-3 px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200"
            aria-hidden
          >
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-foreground">Possible low on your chart</p>
            <p className="text-sm leading-snug text-muted-foreground">
              Around {formatEpisodeWhen(episode.nadirAt)} · lowest {bgLabel} · about {episode.durationMinutes}{" "}
              min below your target. Add to your activity log?
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Educational only — sensor noise and compression lows happen. Confirm only if this matches a real
              hypo for you.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => confirm(episode)}
            data-testid="button-cgm-suggested-hypo-confirm"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Add to log
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => dismiss(episode)}
            data-testid="button-cgm-suggested-hypo-dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
