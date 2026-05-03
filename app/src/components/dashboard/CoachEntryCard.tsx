import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { isAiCoachEnabled } from "@/lib/flags";

export function CoachEntryCard() {
  if (!isAiCoachEnabled) return null;

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }} data-testid="dashboard-coach-entry">
      <Button asChild className="min-h-11 w-full sm:w-auto">
        <Link href="/coach" data-testid="link-dashboard-coach-open">
          Open coach
        </Link>
      </Button>
    </div>
  );
}
