import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { ExerciseGuidedCoach } from "./ExerciseGuidedCoach";
import type { ActiveExerciseSession } from "@/lib/storage";

const mockToast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/lib/exercise-reminders", () => ({
  scheduleExercisePreReminders: vi.fn(),
  scheduleExerciseActiveReminders: vi.fn(),
  cancelExerciseReminders: vi.fn(),
}));

let mockSession: ActiveExerciseSession | null = null;
let mockProfile: Partial<{ bgUnits: string; insulinDeliveryMethod: string }> = {
  bgUnits: "mmol/L",
  insulinDeliveryMethod: "pen",
};
let mockSettings: { usesClosedLoop?: boolean } = {};

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    storage: {
      ...actual.storage,
      getProfile: () => mockProfile,
      getSettings: () => mockSettings,
      getActiveExercise: () => mockSession,
      getRecentExercises: () => [],
      getExerciseOutcomes: () => [],
      getLastExerciseSummary: () => null,
      getScenarioState: () => ({ travelModeActive: false, sickDayActive: false }),
      getExercisePatterns: () => ({
        totalSessions: 0,
        droppedCount: 0,
        stableCount: 0,
        roseCount: 0,
        hypoCount: 0,
        avgPattern: "",
      }),
      updateActiveExercise: vi.fn((patch: Partial<ActiveExerciseSession>) => {
        if (!mockSession) return null;
        mockSession = { ...mockSession, ...patch };
        return mockSession;
      }),
      startExerciseSession: vi.fn(),
      startExercisePhase: vi.fn(),
      finishExercisePhase: vi.fn(),
      endExerciseSession: vi.fn(),
      useExerciseRoutine: vi.fn(),
    },
  };
});

function renderWithRouter(ui: ReactElement) {
  const { hook } = memoryLocation({ path: "/scenarios/exercise" });
  return render(<Router hook={hook}>{ui}</Router>);
}

function makeSession(phase: ActiveExerciseSession["phase"]): ActiveExerciseSession {
  return {
    id: "s1",
    exerciseName: "Cardio",
    exerciseType: "cardio",
    intensity: "moderate",
    durationMinutes: 45,
    phase,
    startedAt: new Date().toISOString(),
    exerciseStartedAt: phase !== "pre" ? new Date().toISOString() : undefined,
    exerciseEndedAt: phase === "recovery" ? new Date().toISOString() : undefined,
    recoveryEndsAt: phase === "recovery" ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : undefined,
    recoveryMinutes: 90,
    midCheckDone: false,
    preChecklist: { bgChecked: false, carbsConsidered: false, basalAdjusted: false },
  };
}

describe("ExerciseGuidedCoach", () => {
  beforeEach(() => {
    mockSession = null;
    mockProfile = { bgUnits: "mmol/L", insulinDeliveryMethod: "pen" };
    mockSettings = {};
    mockToast.mockClear();
  });

  it("shows closed-loop pump tips during pre phase for pump users on hybrid loop", () => {
    mockProfile = { bgUnits: "mmol/L", insulinDeliveryMethod: "pump" };
    mockSettings = { usesClosedLoop: true };
    mockSession = makeSession("pre");
    const { queryByTestId } = renderWithRouter(<ExerciseGuidedCoach />);
    expect(queryByTestId("coach-pump-tips-pre")).not.toBeNull();
  });

  it("renders the start screen when no active session", () => {
    const { queryByTestId } = renderWithRouter(<ExerciseGuidedCoach />);
    expect(queryByTestId("exercise-guided-coach-start")).not.toBeNull();
    fireEvent.click(queryByTestId("coach-plan-workout-trigger")!);
    expect(queryByTestId("button-start-coach")).not.toBeNull();
  });

  it("renders the pre phase coach when session is in pre", () => {
    mockSession = makeSession("pre");
    const { queryByTestId, getByText } = renderWithRouter(<ExerciseGuidedCoach />);
    expect(queryByTestId("exercise-guided-coach")).not.toBeNull();
    expect(queryByTestId("button-coach-start-workout")).not.toBeNull();
    expect(getByText("More context")).toBeTruthy();

    fireEvent.click(queryByTestId("button-coach-section-more-context")!);
    expect(queryByTestId("button-coach-sleep-6")).not.toBeNull();
    expect(queryByTestId("button-coach-lastmeal-60")).not.toBeNull();
    expect(queryByTestId("toggle-coach-fasted")).not.toBeNull();
    expect(queryByTestId("button-coach-env-outdoor_hot")).not.toBeNull();
  });

  it("renders during phase with a prominent Exercise mode CTA and collapsed RPE/symptom logging", () => {
    mockSession = makeSession("active");
    const { queryByTestId } = renderWithRouter(<ExerciseGuidedCoach />);
    expect(queryByTestId("button-coach-finish-workout")).not.toBeNull();
    // Exercise Mode is the prominent primary "during" action now.
    expect(queryByTestId("button-coach-exercise-mode")).not.toBeNull();
    expect(queryByTestId("button-coach-feel-low")).not.toBeNull();
    // RPE/symptom logging is secondary — collapsed by default, not competing for attention.
    expect(queryByTestId("button-coach-rpe-moderate")).toBeNull();
    fireEvent.click(queryByTestId("button-coach-section-log-how-it-feels")!);
    expect(queryByTestId("button-coach-rpe-moderate")).not.toBeNull();
    expect(queryByTestId("button-coach-symptom-shaky")).not.toBeNull();
    // Mid-workout carb tally was removed — people rarely log grams during exercise.
    expect(queryByTestId("button-coach-quick-addcarbs-15")).toBeNull();
    expect(queryByTestId("panel-coach-carbs")).toBeNull();
  });

  it("auto-expands during-phase logging when symptoms are already flagged", () => {
    mockSession = { ...makeSession("active"), midSymptoms: ["shaky"], midSymptomSeverity: "moderate" };
    const { queryByTestId } = renderWithRouter(<ExerciseGuidedCoach />);
    // Don't hide active symptom guidance behind a collapsed accordion.
    expect(queryByTestId("button-coach-rpe-moderate")).not.toBeNull();
    expect(queryByTestId("panel-coach-symptoms-action")).not.toBeNull();
  });

  it("renders recovery phase with bedtime presets and alcohol pill, no dead carb/bolus fields", () => {
    mockSession = makeSession("recovery");
    const { queryByTestId } = renderWithRouter(<ExerciseGuidedCoach />);
    expect(queryByTestId("button-coach-finish-session")).not.toBeNull();
    expect(queryByTestId("button-coach-bedtime-2")).not.toBeNull();
    expect(queryByTestId("button-coach-bedtime-custom")).not.toBeNull();
    expect(queryByTestId("toggle-coach-alcohol-tonight")).not.toBeNull();
    // Moderate/intense sessions still get a bedtime nudge even before a time is chosen.
    expect(queryByTestId("button-coach-recovery-bedtime")).not.toBeNull();
    // Dead inputs that never fed any calculation were removed.
    expect(queryByTestId("input-coach-recovery-carbs")).toBeNull();
    expect(queryByTestId("input-coach-recovery-bolus")).toBeNull();
  });

  it("recovery bedtime preset drives an urgent Bedtime tool prompt when bedtime is close", () => {
    mockSession = makeSession("recovery");
    const { queryByTestId, getByText } = renderWithRouter(<ExerciseGuidedCoach />);
    fireEvent.click(queryByTestId("button-coach-bedtime-2")!);
    expect(getByText(/Bedtime in about 2h/i)).toBeTruthy();
    expect(queryByTestId("button-coach-recovery-bedtime")).not.toBeNull();
  });
});
