import { CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { pickCoachTopicSlugFromScenarioState } from "@/lib/ai-coach/coachAppContextSummary";
import { HomeActionTile } from "@/components/home/HomeActionTile";

/**
 * Primary home actions — fixed 3-up on phones (no fourth Guides tile).
 * Active scenarios use the status chips above this dock instead.
 */
export function HomeActionDock({
  isUrgent,
  showCoach,
  onTreatedHypo,
}: {
  isUrgent: boolean;
  showCoach: boolean;
  onTreatedHypo: () => void;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-2 px-1"
      data-testid="home-action-dock"
    >
      <HomeActionTile
        label="Help Now"
        icon={Phone}
        href="/help-now"
        variant="destructive"
        urgentPulse={isUrgent}
        testId="button-help-now"
        animationDelay="60ms"
        className="min-w-0"
      />
      <HomeActionTile
        label="Treated a Hypo"
        icon={CheckCircle2}
        onClick={onTreatedHypo}
        variant="success"
        testId="button-dashboard-treated-hypo"
        animationDelay="80ms"
        className="min-w-0"
      />
      {showCoach ? (
        <HomeActionTile
          label={openAssistantCtaLabel()}
          icon={MessageCircle}
          href={buildCoachHref({ topic: pickCoachTopicSlugFromScenarioState() })}
          variant="primary"
          glow
          testId="link-dashboard-coach-open"
          animationDelay="100ms"
          className="min-w-0"
        />
      ) : (
        <div className="min-w-0" aria-hidden />
      )}
    </div>
  );
}
