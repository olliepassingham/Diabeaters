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
        actions={
          <Button variant="outline" size="sm" className="min-h-11 whitespace-nowrap" asChild>
            <Link href="/routines?section=exercise" data-testid="link-exercise-routines-header">
              Exercise routines
            </Link>
          </Button>
        }
      />
      <ExerciseGuidedCoach />
      <ScenarioToolDisclaimer className="mt-2" />
    </PageShell>
  );
}
