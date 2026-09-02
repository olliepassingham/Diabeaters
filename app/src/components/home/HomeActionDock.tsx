import { CheckCircle2, MessageCircle, Phone, Plane } from "lucide-react";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { pickCoachTopicSlugFromScenarioState } from "@/lib/ai-coach/coachAppContextSummary";
import { HomeActionTile } from "@/components/home/HomeActionTile";

export function HomeActionDock({
  isUrgent,
  showCoach,
  showGuides,
  guidesHref,
  onTreatedHypo,
}: {
  isUrgent: boolean;
  showCoach: boolean;
  showGuides: boolean;
  guidesHref: string;
  onTreatedHypo: () => void;
}) {
  return (
    <div
      className="flex items-stretch gap-2 overflow-x-auto px-1 pb-1"
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
      />
      <HomeActionTile
        label="Treated a Hypo"
        icon={CheckCircle2}
        onClick={onTreatedHypo}
        variant="success"
        testId="button-dashboard-treated-hypo"
        animationDelay="80ms"
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
        />
      ) : null}
      {showGuides ? (
        <HomeActionTile
          label="Guides"
          subtitle="Sick day or travel"
          icon={Plane}
          href={guidesHref}
          testId="link-dashboard-quick-scenarios"
          animationDelay="120ms"
        />
      ) : null}
    </div>
  );
}
