import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAiCoachEnabled } from "@/lib/flags";
import { buildCoachHref } from "@/lib/ai-coach/links";

/**
 * Supporter Mode entry point for the AI coach.
 *
 * Mirrors {@link ./CoachEntryCard.CoachEntryCard} but routes to
 * `/coach?audience=supporter`, which selects the supporter system prompt
 * (see docs/regulatory/ai_coach_system_prompt.md §2b) and tweaks the
 * consent screen / starter prompts accordingly.
 */
export function CarerCoachEntryCard() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  if (!isAiCoachEnabled) return null;

  return (
    <div
      className="animate-fade-in-up space-y-2"
      style={{ animationDelay: "60ms" }}
      data-testid="carer-coach-entry"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 500))}
          placeholder="Ask anything (supporter)…"
          className="min-h-11 bg-background/80 sm:max-w-md"
          data-testid="input-carer-coach-ask"
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 shrink-0"
          disabled={!q.trim()}
          data-testid="button-carer-coach-ask"
          onClick={() =>
            setLocation(buildCoachHref({ q: q.trim(), audience: "supporter", from: "carer-dashboard-card" }))
          }
        >
          Ask
        </Button>
      </div>
      <Button asChild className="min-h-11 w-full sm:w-auto">
        <Link href="/coach?audience=supporter" data-testid="link-carer-coach-open">
          Open coach
        </Link>
      </Button>
    </div>
  );
}
