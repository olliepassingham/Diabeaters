import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ScenarioToolDisclaimer } from "@/components/disclaimer";
import { ExerciseGuidedCoach } from "@/components/scenarios/ExerciseGuidedCoach";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { storage } from "@/lib/storage";
import { recordLastInteraction } from "@/lib/last-interaction";

export default function ScenarioExercisePage() {
  useEffect(() => {
    if (storage.getActiveExercise()) {
      recordLastInteraction("scenario:exercise");
    }
  }, []);

  return (
    <PageShell variant="standard" className="space-y-7">
      <PageHeader
        stackActionsMaxSm
        leading={<PageBackButton />}
        title="Exercise"
        description="Guided steps for checks, carbs, and bolus timing around your activity."
        actions={
          <>
            <ScenarioCoachLink topic="exercise" />
            <Button variant="outline" size="sm" className="min-h-11 whitespace-nowrap" asChild>
              <Link
                href="/routines?section=exercise"
                data-testid="link-exercise-routines-header"
                aria-label="Exercise routines"
              >
                <span className="sm:hidden">Routines</span>
                <span className="hidden sm:inline">Exercise routines</span>
              </Link>
            </Button>
          </>
        }
      />
      <ExerciseGuidedCoach />
      <ScenarioToolDisclaimer className="mt-2" />
    </PageShell>
  );
}
