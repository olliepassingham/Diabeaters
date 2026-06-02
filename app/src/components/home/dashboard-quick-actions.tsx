import { MessageCircle, Plane } from "lucide-react";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { isAiCoachEnabled } from "@/lib/flags";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { pickCoachTopicSlugFromScenarioState } from "@/lib/ai-coach/coachAppContextSummary";
import { HomeQuickActions, type HomeQuickAction } from "@/components/home/home-ui";

export function DashboardQuickActions({
  showScenariosLink,
  scenariosHref,
}: {
  showScenariosLink: boolean;
  scenariosHref: string;
}) {
  const actions: HomeQuickAction[] = [];

  if (isAiCoachEnabled) {
    actions.push({
      id: "coach",
      label: openAssistantCtaLabel(),
      icon: MessageCircle,
      href: buildCoachHref({ topic: pickCoachTopicSlugFromScenarioState() }),
      variant: "primary",
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
