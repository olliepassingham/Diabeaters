import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STARTER_EXERCISE_ROUTINE_ID,
  STARTER_EXERCISE_SEEDED_KEY,
  hasStarterExerciseBeenSeeded,
  isStarterExerciseRoutine,
  seedStarterExerciseRoutineIfNeeded,
} from "./starter-exercise-routine";

const storageMock = vi.hoisted(() => ({
  getExerciseRoutines: vi.fn(),
  getExerciseRoutine: vi.fn(),
  addExerciseRoutine: vi.fn(),
  updateExerciseRoutine: vi.fn(),
  deleteExerciseRoutine: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  storage: storageMock,
}));

describe("starter-exercise-routine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    storageMock.getExerciseRoutines.mockReturnValue([]);
    storageMock.getExerciseRoutine.mockReturnValue(null);
    storageMock.addExerciseRoutine.mockImplementation((row: { id?: string; name: string }) => ({
      ...row,
      id: row.id ?? "generated",
      timesUsed: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));
  });

  it("identifies the starter routine by stable id", () => {
    expect(isStarterExerciseRoutine({ id: STARTER_EXERCISE_ROUTINE_ID })).toBe(true);
    expect(isStarterExerciseRoutine({ id: "other" })).toBe(false);
  });

  it("seeds one example routine when empty", () => {
    const r = seedStarterExerciseRoutineIfNeeded();
    expect(r.seeded).toBe(true);
    expect(r.routine?.id).toBe(STARTER_EXERCISE_ROUTINE_ID);
    expect(storageMock.addExerciseRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        id: STARTER_EXERCISE_ROUTINE_ID,
        name: "5km Run",
        exerciseType: "cardio",
        intensity: "moderate",
        durationMinutes: 30,
      }),
    );
    expect(localStorage.getItem(STARTER_EXERCISE_SEEDED_KEY)).toBe("1");
    expect(hasStarterExerciseBeenSeeded()).toBe(true);
  });

  it("does not seed twice", () => {
    seedStarterExerciseRoutineIfNeeded();
    const r2 = seedStarterExerciseRoutineIfNeeded();
    expect(r2.seeded).toBe(false);
    expect(storageMock.addExerciseRoutine).toHaveBeenCalledTimes(1);
  });

  it("does not re-seed after the example was deleted", () => {
    seedStarterExerciseRoutineIfNeeded();
    storageMock.getExerciseRoutines.mockReturnValue([]);
    storageMock.getExerciseRoutine.mockReturnValue(null);
    const r2 = seedStarterExerciseRoutineIfNeeded();
    expect(r2.seeded).toBe(false);
    expect(storageMock.addExerciseRoutine).toHaveBeenCalledTimes(1);
  });

  it("marks seeded without adding when other routines already exist", () => {
    storageMock.getExerciseRoutines.mockReturnValue([{ id: "user-1", name: "My swim" }]);
    const r = seedStarterExerciseRoutineIfNeeded();
    expect(r.seeded).toBe(false);
    expect(storageMock.addExerciseRoutine).not.toHaveBeenCalled();
    expect(localStorage.getItem(STARTER_EXERCISE_SEEDED_KEY)).toBe("1");
  });
});
