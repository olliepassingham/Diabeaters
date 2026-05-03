import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { isAiCoachEnabled } from "@/lib/flags";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";

/**
 * Supporter Mode entry point for the AI coach.
 *
 * Mirrors {@link ./CoachEntryCard.CoachEntryCard} but routes to
 * `/coach?audience=supporter`, which selects the supporter system prompt
 * (see docs/regulatory/ai_coach_system_prompt.md section 2b) and tweaks the
 * consent screen / starter prompts accordingly.
 */
export function CarerCoachEntryCard() {
  if (!isAiCoachEnabled) return null;

  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: "60ms" }}
      data-testid="carer-coach-entry"
    >
      <Button asChild className="min-h-11 w-full sm:w-auto">
        <Link href="/coach?audience=supporter" data-testid="link-carer-coach-open">
          {openAssistantCtaLabel()}
        </Link>
      </Button>
    </div>
  );
}
