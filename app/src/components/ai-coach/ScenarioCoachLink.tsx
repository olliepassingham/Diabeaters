import { Link } from "wouter";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAiCoachEnabled } from "@/lib/flags";
import type { CoachTopicSlug } from "@/lib/ai-coach/topics";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { scenarioAskAssistantLinkLabel } from "@/lib/ai-coach/persona";

type Props = {
  topic: CoachTopicSlug;
  /** Visible label; keep short for header toolbars. */
  label?: string;
  className?: string;
};

export function ScenarioCoachLink({ topic, label = scenarioAskAssistantLinkLabel(), className }: Props) {
  if (!isAiCoachEnabled) return null;
  return (
    <Button variant="outline" size="sm" className={className ?? "min-h-11 whitespace-nowrap"} asChild>
      <Link href={buildCoachHref({ topic, from: "scenario-link" })} data-testid={`link-scenario-coach-${topic}`}>
        <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
