import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ScenarioToolDisclaimer } from "@/components/disclaimer";
import { ExerciseGuidedCoach } from "@/components/scenarios/ExerciseGuidedCoach";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";

export default function ScenarioExercisePage() {
  return (
    <PageShell variant="standard" className="space-y-6">
      <PageHeader
        leading={<PageBackButton />}
        title="Exercise"
        description="A guided pre / during / recovery coach. Deeper questions feed into the recommendations — always confirm with your care team."
        actions={
          <Button variant="outline" size="sm" className="min-h-11 whitespace-nowrap" asChild>
            <Link href="/routines?section=exercise" data-testid="link-exercise-routines-header">
              Exercise routines
            </Link>
          </Button>
        }
      />
      <ScenarioToolDisclaimer />
      <ExerciseGuidedCoach />
    </PageShell>
  );
}
