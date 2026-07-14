import { detectHypoEpisodes, episodeMatchesLoggedHypo, type DetectedHypoEpisode } from "@/lib/cgm/detect-hypo-episodes";
import type { CgmChartPoint } from "@/lib/cgm/cgm-chart";
import { isCgmHypoEpisodeDismissed } from "@/lib/cgm/suggested-hypo-dismiss";
import type { HypoTreatment } from "@/lib/storage";

/** Prefer the most recent undismissed, unmatched episode for a confirm card. */
export function pickSuggestedHypoEpisode(
  points: CgmChartPoint[],
  threshold: number,
  treatments: HypoTreatment[],
): DetectedHypoEpisode | null {
  const logged = treatments.map((t) => t.timestamp);
  const episodes = detectHypoEpisodes(points, threshold);
  for (const episode of episodes) {
    if (isCgmHypoEpisodeDismissed(episode.id)) continue;
    if (episodeMatchesLoggedHypo(episode, logged)) continue;
    return episode;
  }
  return null;
}
