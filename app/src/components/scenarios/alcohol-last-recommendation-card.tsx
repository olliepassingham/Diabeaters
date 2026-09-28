import { useState } from "react";
import {
  formatAlcoholRecommendationWhen,
  readAlcoholLastRecommendation,
} from "@/lib/alcohol-last-recommendation";

/** Last alcohol guidance the user actually asked for. Hidden when they have not used the tool. */
export function AlcoholLastRecommendationCard() {
  const [snapshot] = useState(() => readAlcoholLastRecommendation());
  if (!snapshot) return null;

  const { title, when } = formatAlcoholRecommendationWhen(snapshot.askedAtIso);

  return (
    <div
      className="rounded-2xl border border-border/60 bg-card px-4 py-3"
      data-testid="card-alcohol-last-recommendation"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{when}</p>
      <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{snapshot.summary}</p>
    </div>
  );
}
