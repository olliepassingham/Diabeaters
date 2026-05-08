import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ScenarioToolDisclaimer } from "@/components/disclaimer";
import { ExerciseGuidedCoach } from "@/components/scenarios/ExerciseGuidedCoach";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { storage } from "@/lib/storage";
import { recordLastInteraction } from "@/lib/last-interaction";
import { ScenarioActiveCard } from "@/components/scenarios/ScenarioActiveCard";
import { ExerciseWorkoutProgressBar } from "@/components/exercise-active-session-extras";
import { Activity } from "lucide-react";

export default function ScenarioExercisePage() {
  const [tick, setTick] = useState(0);
  const active = useMemo(() => storage.getActiveExercise(), [tick]);

  useEffect(() => {
    if (storage.getActiveExercise()) {
      recordLastInteraction("scenario:exercise");
    }
  }, []);

  useEffect(() => {
    if (!storage.getActiveExercise()) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(t);
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

      {active ? (
        <ScenarioActiveCard
          title={active.exerciseName || "Exercise"}
          subtitle="Active session"
          badgeText="Active"
          tone="blue"
          icon={<Activity className="h-4 w-4 text-primary" aria-hidden />}
          facts={[
            { label: "Intensity", value: (active.intensity || "unknown").replace(/_/g, " ") },
            { label: "Duration", value: active.durationMinutes ? `${active.durationMinutes} min` : "—" },
            { label: "Phase", value: (active.phase || "active").replace(/_/g, " ") },
          ]}
        >
          <ExerciseWorkoutProgressBar
            phase={active.phase}
            exerciseStartedAt={active.exerciseStartedAt}
            durationMinutes={active.durationMinutes}
            nowMs={Date.now()}
          />
        </ScenarioActiveCard>
      ) : null}

      <ExerciseGuidedCoach />
      <ScenarioToolDisclaimer className="mt-2" />
    </PageShell>
  );
}
