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
          "bg-primary text-primary-foreground",
          "shadow-sm shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.55)] ring-1 ring-[hsl(var(--primary)/0.28)]",
          "hover:bg-primary/90 hover:shadow-md hover:ring-[hsl(var(--primary)/0.38)] active:translate-y-[0.5px]",
          "transition-all",
        ].join(" ")}
      >
        <Link href="/coach" data-testid="link-dashboard-coach-open">
          {openAssistantCtaLabel()}
        </Link>
      </Button>
    </div>
  );
}
