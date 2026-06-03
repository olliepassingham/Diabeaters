import { Link } from "wouter";
import { MessageCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { isAiCoachEnabled } from "@/lib/flags";
import type { CoachTopicSlug } from "@/lib/ai-coach/topics";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { scenarioAskAssistantLinkLabel } from "@/lib/ai-coach/persona";
import { cn } from "@/lib/utils";

type Props = {
  topic: CoachTopicSlug;
  /** Visible label; keep short for header toolbars. */
  label?: string;
  className?: string;
  /** Button surface; defaults to outline for scenario headers. */
  variant?: ButtonProps["variant"];
  /** Pre-fill the coach message box (max 500 chars). */
  q?: string | null;
  /** Entry source for breadcrumbs / analytics. */
  from?: string | null;
  /** Soft primary halo in guide headers (default on). */
  glow?: boolean;
};

export function ScenarioCoachLink({
  topic,
  label = scenarioAskAssistantLinkLabel(),
  className,
  variant = "outline",
  q,
  from = "scenario-link",
  glow = true,
}: Props) {
  if (!isAiCoachEnabled) return null;

  const button = (
    <Button
      variant={variant}
      size="sm"
      className={cn(className ?? "min-h-11 whitespace-nowrap", glow && "shadow-none")}
      asChild
    >
      <Link href={buildCoachHref({ topic, q, from })} data-testid={`link-scenario-coach-${topic}`}>
        <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Link>
    </Button>
  );

  if (!glow) return button;

  return (
    <span className="coach-entry-glow-subtle inline-flex w-full shrink-0 rounded-xl sm:w-auto">{button}</span>
  );
}
