import type { ExerciseIntensity, ExerciseType } from "@/lib/storage";

export const EXERCISE_TYPE_OPTIONS: Array<{ value: ExerciseType; label: string }> = [
  { value: "cardio", label: "Cardio" },
  { value: "strength", label: "Strength" },
  { value: "hiit", label: "HIIT" },
  { value: "yoga", label: "Yoga / Pilates" },
  { value: "walking", label: "Walking" },
  { value: "court", label: "Court & racket sports" },
  { value: "field", label: "Field & team sports" },
  { value: "swimming", label: "Swimming" },
];

export const EXERCISE_INTENSITY_OPTIONS: Array<{ value: ExerciseIntensity; label: string }> = [
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "intense", label: "Intense" },
];

export const EXERCISE_START_IN_OPTIONS = [0, 15, 30, 45, 60] as const;

export const EXERCISE_MEAL_TYPE_OPTIONS = [
  { value: "snack", label: "Snack" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
] as const;
