import { MessageCircle, Plane } from "lucide-react";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { isAiCoachEnabled } from "@/lib/flags";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { pickCoachTopicSlugFromScenarioState } from "@/lib/ai-coach/coachAppContextSummary";
import { HomeQuickActions, type HomeQuickAction } from "@/components/home/home-ui";

export function DashboardQuickActions({
  showScenariosLink,
  scenariosHref,
  showCoachLink = isAiCoachEnabled,
}: {
  showScenariosLink: boolean;
  scenariosHref: string;
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

  if (showScenariosLink) {
    actions.push({
      id: "scenarios",
      label: "Guides",
      icon: Plane,
      href: scenariosHref,
      testId: "link-dashboard-quick-scenarios",
    });
  }

  return <HomeQuickActions actions={actions} testId="dashboard-quick-actions" />;
}
