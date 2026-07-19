import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ScenarioToolDisclaimer } from "@/components/disclaimer";
import { ExerciseFuelCalculator } from "@/components/scenarios/ExerciseFuelCalculator";
import { ExerciseGuidedCoach } from "@/components/scenarios/ExerciseGuidedCoach";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { isAiCoachEnabled } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { storage, DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT } from "@/lib/storage";
import { recordLastInteraction } from "@/lib/last-interaction";

export default function ScenarioExercisePage() {
  const [tick, setTick] = useState(0);
  const active = useMemo(() => storage.getActiveExercise(), [tick]);

  useEffect(() => {
    if (storage.getActiveExercise()) {
      recordLastInteraction("scenario:exercise");
    }
  }, []);

  useEffect(() => {
    const onSessionChange = () => setTick((n) => n + 1);
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onSessionChange);
    return () => window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onSessionChange);
  }, []);

  useEffect(() => {
    if (!storage.getActiveExercise()) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const headerActionBtn =
    "min-h-10 w-full justify-center rounded-xl px-3 text-sm font-medium shadow-none sm:min-h-9 sm:w-auto";

  return (
    <PageShell variant="narrow" density="compact" className="space-y-4 max-sm:space-y-3 sm:space-y-6">
      <PageHeader
        stackActionsMaxSm
        className="max-sm:gap-1.5"
        leading={<PageBackButton />}
        title="Exercise"
        actions={
          <div
            className={cn(
              "grid w-full min-w-0 gap-2 sm:flex sm:w-auto sm:justify-end sm:gap-2",
              isAiCoachEnabled ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <ScenarioCoachLink topic="exercise" className={cn(headerActionBtn, "gap-1.5")} />
            <Button variant="outline" size="sm" className={cn(headerActionBtn)} asChild>
              <Link
                href="/routines?section=exercise"
                data-testid="link-exercise-routines-header"
                aria-label="Exercise routines"
              >
                <span className="sm:hidden">Routines</span>
                <span className="hidden sm:inline">Exercise routines</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* The guided coach below already shows the active session's name, phase, and
          progress in its own header — a second summary card here duplicated that. */}
      {!active ? <ExerciseFuelCalculator /> : null}
      <ExerciseGuidedCoach />
      <ScenarioToolDisclaimer className="mt-2" />
    </PageShell>
  );
}
