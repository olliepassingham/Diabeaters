import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { buildCoachHref } from "@/lib/ai-coach/links";
import { isAiCoachEnabled } from "@/lib/flags";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";
import { pickCoachTopicSlugFromScenarioState } from "@/lib/ai-coach/coachAppContextSummary";
import { cn } from "@/lib/utils";

export function CoachEntryCard() {
  if (!isAiCoachEnabled) return null;

  const coachHref = buildCoachHref({ topic: pickCoachTopicSlugFromScenarioState() });

  return (
    <div
      className="coach-entry-glow w-full animate-fade-in-up rounded-2xl sm:w-auto"
      style={{ animationDelay: "60ms" }}
      data-testid="dashboard-coach-entry"
    >
      <Button
        asChild
        className={cn(
          "min-h-11 w-full rounded-2xl px-4 font-semibold tracking-tight shadow-none",
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 active:translate-y-[0.5px]",
          "transition-all",
        )}
      >
        <Link href={coachHref} data-testid="link-dashboard-coach-open">
          {openAssistantCtaLabel()}
        </Link>
      </Button>
    </div>
  );
}
