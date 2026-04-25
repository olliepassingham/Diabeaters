import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/disclaimer";
import { ExercisePlanner } from "@/components/scenarios/ExercisePlanner";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";

export default function ScenarioExercisePage() {
  return (
    <PageShell variant="standard" className="space-y-6">
      <PageHeader
        leading={<PageBackButton />}
        title="Exercise"
        description="Plan activity with carbs, checks, and insulin-unit adjustments — always confirm with your care team."
        actions={
          <Button variant="outline" size="sm" className="min-h-11 whitespace-nowrap" asChild>
            <Link href="/routines?section=exercise" data-testid="link-exercise-routines-header">
              Exercise routines
            </Link>
          </Button>
        }
      />
      <Disclaimer className="text-xs border border-border/60 rounded-lg p-3 bg-muted/20" />
      <ExercisePlanner />
    </PageShell>
  );
}
