import { buildExerciseScenarioPlannerHref } from "@/lib/exercise-planner-href";

/** Struggle keys saved during onboarding (localStorage `diabeater_onboarding_struggle`). */
export type OnboardingStruggleKey = "supplies" | "meals" | "exercise" | "overview";

export type OnboardingMealRatioFields = {
  breakfastRatio: string;
  lunchRatio: string;
  dinnerRatio: string;
  mealRatiosUnknown?: boolean;
};

/** Deep link for onboarding first win — pre-fills a gentle example plan. */
export const ONBOARDING_EXERCISE_DEMO_HREF = buildExerciseScenarioPlannerHref({
  exerciseType: "walking",
  durationMinutes: 30,
  intensity: "moderate",
});

export function hasOnboardingMealRatios(data: OnboardingMealRatioFields): boolean {
  return !!(data.breakfastRatio || data.lunchRatio || data.dinnerRatio);
}

export function shouldUseRatioAdviserFirstWin(data: OnboardingMealRatioFields): boolean {
  return !!data.mealRatiosUnknown || !hasOnboardingMealRatios(data);
}

export type OnboardingWizardStep =
  | "welcome"
  | "care_context"
  | "struggle"
  | "region"
  | "details"
  | "disclaimer"
  | "first_win";

export function buildOnboardingSteps(opts: {
  upgradeFlow: boolean;
  showCommunityPath: boolean;
  showBothPath: boolean;
  minimalSetup: boolean;
}): OnboardingWizardStep[] {
  let flow: OnboardingWizardStep[];
  if (opts.upgradeFlow) flow = ["details", "disclaimer", "first_win"];
  else if (opts.showCommunityPath) flow = ["welcome", "region", "disclaimer", "first_win"];
  else if (opts.showBothPath) {
    flow = ["welcome", "care_context", "struggle", "region", "details", "disclaimer", "first_win"];
  } else {
    flow = ["welcome", "struggle", "region", "details", "disclaimer", "first_win"];
  }
  if (opts.minimalSetup && !opts.upgradeFlow && !opts.showCommunityPath) {
    return flow.filter((step) => step !== "details");
  }
  return flow;
}

const POST_ROUTES: Record<OnboardingStruggleKey, string> = {
  supplies: "/supplies",
  meals: "/adviser?tab=meal",
  exercise: "/scenarios/exercise",
  overview: "/",
};

export function getPostOnboardingPath(struggle: string | null | undefined): string {
  if (!struggle) return "/";
  return POST_ROUTES[struggle as OnboardingStruggleKey] ?? "/";
}

export type SecondaryCta = { label: string; path: string };

/**
 * Optional second action on the final onboarding screen (still completes onboarding when used).
 */
export function getOnboardingSecondaryCta(
  struggle: OnboardingStruggleKey | null,
  mealRatioState: OnboardingMealRatioFields,
  opts?: { wantsSupporterSetupNext?: boolean },
): SecondaryCta | null {
  const hasMealRatios = hasOnboardingMealRatios(mealRatioState);
  if (opts?.wantsSupporterSetupNext) {
    return { label: "Set up Supporter linking", path: "/carer-setup" };
  }
  if (!struggle) return null;
  if (struggle === "supplies") {
    return { label: "Go to dashboard", path: "/" };
  }
  if (struggle === "meals") {
    if (hasMealRatios) {
      return { label: "Fine-tune ratios", path: "/adviser?tab=ratios" };
    }
    return { label: "Go to dashboard", path: "/" };
  }
  if (struggle === "exercise") {
    return { label: "Go to dashboard", path: "/" };
  }
  if (struggle === "overview") {
    return { label: "Open supplies", path: "/supplies" };
  }
  return null;
}
