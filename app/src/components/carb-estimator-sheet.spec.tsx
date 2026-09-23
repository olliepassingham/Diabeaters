import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CarbEstimatorSheet } from "@/components/carb-estimator-sheet";
import { storage } from "@/lib/storage";

const setLocation = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/", setLocation],
}));

describe("CarbEstimatorSheet", () => {
  beforeEach(() => {
    localStorage.clear();
    setLocation.mockReset();
  });

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

    expect(screen.getByLabelText("Drag down to close")).not.toBeNull();
    fireEvent.change(screen.getByTestId("input-carb-food-search"), {
      target: { value: "banana" },
    });
    fireEvent.click(screen.getByTestId("button-add-carb-food-banana"));

    expect(screen.getByTestId("button-carb-estimator-add-more")).not.toBeNull();
    expect(screen.getByText("Likely range 22–32g")).not.toBeNull();
    const confirmedInput = screen.getByTestId("input-confirmed-carb-estimate");
    expect((confirmedInput as HTMLInputElement).value).toBe("27");

    fireEvent.change(confirmedInput, { target: { value: "30" } });
    expect(screen.getByLabelText("How this carb estimate works")).not.toBeNull();
    expect(screen.queryByText(/Portions and recipes vary/)).toBeNull();
    expect(screen.queryByText(/Build your meal from typical portions/)).toBeNull();
    fireEvent.click(screen.getByTestId("button-use-carb-estimate"));

    expect(onConfirm).toHaveBeenCalledWith({
      grams: 30,
      compositionHint: {
        carbType: "fruit",
        hasFat: false,
        hasProtein: false,
        hasFibre: true,
      },
    });
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

  it("moves between the meal editor and food browser without losing selections", () => {
    render(
      <CarbEstimatorSheet
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );

    fireEvent.change(screen.getByTestId("input-carb-food-search"), {
      target: { value: "pizza" },
    });
    fireEvent.click(screen.getByTestId("button-add-carb-food-pizza"));
    expect(screen.getByText("Your meal · 1 item")).not.toBeNull();

    fireEvent.click(screen.getByTestId("button-carb-estimator-add-more"));
    expect(screen.getByTestId("button-view-carb-estimator-meal")).not.toBeNull();
    expect(screen.getByText("1 item selected")).not.toBeNull();

    fireEvent.click(screen.getByTestId("button-view-carb-estimator-meal"));
    expect(screen.getByText("Your meal · 1 item")).not.toBeNull();
    expect(screen.getByTestId("button-use-carb-estimate")).not.toBeNull();
  });

  it("lists My routines and confirms carbs in one tap", () => {
    const routine = storage.addRoutine({
      name: "Desk lunch wrap",
      mealType: "lunch",
      mealDescription: "",
      carbEstimate: 48,
      insulinTiming: "before",
      outcome: "good",
      tags: [],
    });
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CarbEstimatorSheet open onOpenChange={onOpenChange} onConfirm={onConfirm} />,
    );

    expect(screen.getByTestId("button-carb-category-routines")).not.toBeNull();
    expect(screen.getByText("Desk lunch wrap")).not.toBeNull();
    expect(screen.getByText(/Lunch · 48g carbs/)).not.toBeNull();

    fireEvent.click(screen.getByTestId(`button-use-carb-routine-${routine.id}`));
    expect(onConfirm).toHaveBeenCalledWith({ grams: 48, compositionHint: null });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(storage.getRoutine(routine.id)?.timesUsed).toBe(1);
  });

  it("shows an empty routines state with a manage link", () => {
    render(
      <CarbEstimatorSheet open onOpenChange={() => {}} onConfirm={() => {}} />,
    );

    fireEvent.click(screen.getByTestId("button-carb-category-routines"));
    expect(screen.getByTestId("carb-estimator-routines-empty")).not.toBeNull();
    fireEvent.click(screen.getByTestId("button-carb-estimator-manage-routines"));
    expect(setLocation).toHaveBeenCalledWith("/routines");
  });
});
