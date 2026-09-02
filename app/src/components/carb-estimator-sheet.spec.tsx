import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarbEstimatorSheet } from "@/components/carb-estimator-sheet";

describe("CarbEstimatorSheet", () => {
  it("builds an estimate, lets the user edit it, and confirms grams", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CarbEstimatorSheet
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByTestId("input-carb-food-search"), {
      target: { value: "banana" },
    });
    fireEvent.click(screen.getByTestId("button-add-carb-food-banana"));

    expect(screen.getByText("Likely range 22–32g")).not.toBeNull();
    const confirmedInput = screen.getByTestId("input-confirmed-carb-estimate");
    expect((confirmedInput as HTMLInputElement).value).toBe("27");

    fireEvent.change(confirmedInput, { target: { value: "30" } });
    fireEvent.click(screen.getByTestId("button-use-carb-estimate"));

    expect(onConfirm).toHaveBeenCalledWith(30);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not offer confirmation until a food is selected", () => {
    render(
      <CarbEstimatorSheet
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.queryByTestId("button-use-carb-estimate")).toBeNull();
    expect(screen.getByText("Add a food to calculate a typical range.")).not.toBeNull();
  });
});
