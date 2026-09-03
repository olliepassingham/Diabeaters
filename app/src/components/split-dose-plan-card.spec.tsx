import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SplitDosePlanCard } from "@/components/split-dose-plan-card";
import type { MealSplitPlan } from "@/lib/meal-split-plan";

const plan: MealSplitPlan = {
  totalUnits: 12,
  firstDose: 6,
  secondDose: 6,
  secondDoseDelay: 3,
  splitRatio: "50/50",
  carbsGrams: 110,
  mealTime: "dinner",
  fatTier: "high",
  ratioUsed: "Using your dinner ratio (1u:10g)",
};

describe("SplitDosePlanCard", () => {
  it("shows the calculated split and lets fat tier be changed without another calculate step", () => {
    const onFatTierChange = vi.fn();
    render(
      <SplitDosePlanCard
        plan={plan}
        isPumpUser={false}
        onFatTierChange={onFatTierChange}
        onBack={() => {}}
        backLabel="Back to dose suggestion"
      />,
    );

    expect(screen.getByTestId("split-dose-timeline")).not.toBeNull();
    expect(screen.getByText("6u now")).not.toBeNull();
    expect(screen.getByText(/110g/)).not.toBeNull();

    fireEvent.click(screen.getByTestId("button-split-fat-medium"));
    expect(onFatTierChange).toHaveBeenCalledWith("medium");
  });
});
