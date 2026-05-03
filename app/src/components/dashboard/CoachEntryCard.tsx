import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAiCoachEnabled } from "@/lib/flags";
import { buildCoachHref } from "@/lib/ai-coach/links";

export function CoachEntryCard() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  if (!isAiCoachEnabled) return null;

  return (
    <div className="animate-fade-in-up space-y-2" style={{ animationDelay: "60ms" }} data-testid="dashboard-coach-entry">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 500))}
          placeholder="Ask anything about T1D…"
          className="min-h-11 bg-background/80 sm:max-w-md"
          data-testid="input-dashboard-coach-ask"
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 shrink-0"
          disabled={!q.trim()}
          data-testid="button-dashboard-coach-ask"
          onClick={() => setLocation(buildCoachHref({ q: q.trim(), from: "dashboard-card" }))}
        >
          Ask
        </Button>
      </div>
      <Button asChild className="min-h-11 w-full sm:w-auto">
        <Link href="/coach" data-testid="link-dashboard-coach-open">
          Open coach
        </Link>
      </Button>
    </div>
  );
}
