import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { isAiCoachEnabled } from "@/lib/flags";
import { openAssistantCtaLabel } from "@/lib/ai-coach/persona";

export function CoachEntryCard() {
  if (!isAiCoachEnabled) return null;

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }} data-testid="dashboard-coach-entry">
      <Button
        asChild
        className={[
          "min-h-11 w-full sm:w-auto",
          "rounded-2xl px-4 font-semibold tracking-tight",
          "bg-gradient-to-r from-indigo-600 to-violet-600",
          "shadow-sm shadow-indigo-600/10 ring-1 ring-indigo-500/20",
          "hover:shadow-md hover:ring-indigo-500/30 active:translate-y-[0.5px]",
          "transition-all",
          "dark:from-indigo-500 dark:to-violet-500 dark:shadow-indigo-500/10 dark:ring-indigo-400/20",
        ].join(" ")}
      >
        <Link href="/coach" data-testid="link-dashboard-coach-open">
          {openAssistantCtaLabel()}
        </Link>
      </Button>
    </div>
  );
}
