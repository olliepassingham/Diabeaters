/** Struggle keys saved during onboarding (localStorage `diabeater_onboarding_struggle`). */
export type OnboardingStruggleKey = "supplies" | "meals" | "exercise" | "overview";

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
  hasMealRatios: boolean,
): SecondaryCta | null {
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
