import { MessageCircle } from "lucide-react";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { isAiCoachEnabled } from "@/lib/flags";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { pickCoachTopicSlugFromScenarioState } from "@/lib/ai-coach/coachAppContextSummary";
import { HomeQuickActions, type HomeQuickAction } from "@/components/home/home-ui";

/** Legacy coach-only quick actions row (scenario entry lives in Active chips). */
export function DashboardQuickActions({
  showCoachLink = isAiCoachEnabled,
}: {
  showScenariosLink?: boolean;
  scenariosHref?: string;
  /** When false, hides Beatie (e.g. offline). Defaults to the AI coach feature flag. */
  showCoachLink?: boolean;
}) {
  const actions: HomeQuickAction[] = [];

  if (showCoachLink) {
    actions.push({
      id: "coach",
      label: openAssistantCtaLabel(),
      icon: MessageCircle,
      href: buildCoachHref({ topic: pickCoachTopicSlugFromScenarioState() }),
      variant: "primary",
      glow: true,
      testId: "link-dashboard-coach-open",
    });
  }

  return <HomeQuickActions actions={actions} testId="dashboard-quick-actions" />;
}
