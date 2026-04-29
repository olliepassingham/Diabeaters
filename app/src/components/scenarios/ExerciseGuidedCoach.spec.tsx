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

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    storage: {
      ...actual.storage,
      getProfile: () => ({ bgUnits: "mmol/L", insulinDeliveryMethod: "mdi" }),
      getSettings: () => ({}),
      getActiveExercise: () => mockSession,
      getRecentExercises: () => [],
      getScenarioState: () => ({ travelModeActive: false, sickDayActive: false }),
      getExercisePatterns: () => ({
        totalSessions: 0,
        droppedCount: 0,
        stableCount: 0,
        roseCount: 0,
        hypoCount: 0,
        avgPattern: "",
      }),
      updateActiveExercise: vi.fn(() => mockSession),
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
    mockToast.mockClear();
  });

  it("renders the start screen when no active session", () => {
    const { queryByTestId } = renderWithRouter(<ExerciseGuidedCoach />);
    expect(queryByTestId("exercise-guided-coach-start")).not.toBeNull();
    expect(queryByTestId("button-start-coach")).not.toBeNull();
  });

  it("renders the pre phase coach when session is in pre", () => {
    mockSession = makeSession("pre");
    const { queryByTestId, getByText } = renderWithRouter(<ExerciseGuidedCoach />);
    expect(queryByTestId("exercise-guided-coach")).not.toBeNull();
    expect(queryByTestId("button-coach-start-workout")).not.toBeNull();
    expect(getByText("Personal context")).toBeTruthy();
    expect(getByText("Environment & timing")).toBeTruthy();
    expect(getByText("Medication context")).toBeTruthy();

    fireEvent.click(queryByTestId("button-coach-section-personal-context")!);
    expect(queryByTestId("button-coach-sleep-6")).not.toBeNull();
    expect(queryByTestId("button-coach-lastmeal-60")).not.toBeNull();
  });

  it("renders during phase with recovery CTA and RPE buttons", () => {
    mockSession = makeSession("active");
    const { queryByTestId } = renderWithRouter(<ExerciseGuidedCoach />);
    expect(queryByTestId("button-coach-finish-workout")).not.toBeNull();
    expect(queryByTestId("button-coach-rpe-moderate")).not.toBeNull();
    expect(queryByTestId("button-coach-quick-addcarbs-15")).not.toBeNull();
    expect(queryByTestId("button-coach-feel-low")).not.toBeNull();
    expect(queryByTestId("panel-coach-during-at-a-glance")).not.toBeNull();
    expect(queryByTestId("button-coach-symptom-shaky")).not.toBeNull();
  });

  it("renders recovery phase with recovery inputs", () => {
    mockSession = makeSession("recovery");
    const { queryByTestId } = renderWithRouter(<ExerciseGuidedCoach />);
    expect(queryByTestId("button-coach-finish-session")).not.toBeNull();
    expect(queryByTestId("input-coach-recovery-carbs")).not.toBeNull();
    expect(queryByTestId("input-coach-bedtime-hours")).not.toBeNull();
    expect(queryByTestId("button-coach-recovery-bedtime")).not.toBeNull();
  });
});
