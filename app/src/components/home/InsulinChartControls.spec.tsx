import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { InsulinChartControls } from "@/components/home/InsulinChartControls";
import {
  getLongActingDoses,
  getRapidInsulinDoseHistory,
  getRapidInsulinDoses,
  recordLongActingDose,
  recordRapidInsulinDose,
} from "@/lib/insulin-activity";

function renderControls() {
  return render(
    <InsulinChartControls visible hasDoses remaining={0} runsOutLabel={null} />,
  );
}

function renderControlsWithoutList() {
  return render(
    <InsulinChartControls visible hasDoses remaining={0} runsOutLabel={null} showDoseList={false} />,
  );
}

describe("InsulinChartControls dose list", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lists recent rapid and long-acting doses", () => {
    recordRapidInsulinDose({ units: 6, takenAtIso: new Date(Date.now() - 60 * 60_000).toISOString() });
    recordLongActingDose({ units: 12, takenAtIso: new Date(Date.now() - 8 * 60 * 60_000).toISOString() });
    renderControls();

    const list = screen.getByTestId("insulin-dose-list");
    expect(list.textContent).toContain("Rapid");
    expect(list.textContent).toContain("6u");
    expect(list.textContent).toContain("Long");
    expect(list.textContent).toContain("12u");
    // The rapid dose taken an hour ago still has insulin working.
    expect(list.textContent).toContain("u left");
  });

  it("only lists today's doses, not yesterday's", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    recordRapidInsulinDose({ units: 9, takenAtIso: yesterday.toISOString() });
    recordRapidInsulinDose({ units: 4, takenAtIso: new Date(Date.now() - 30 * 60_000).toISOString() });
    renderControls();

    const list = screen.getByTestId("insulin-dose-list");
    expect(list.textContent).toContain("4u");
    expect(list.textContent).not.toContain("9u");
    expect(list.textContent).not.toContain("Yesterday");
  });

  it("hides the dose list when showDoseList is false (Home)", () => {
    recordRapidInsulinDose({ units: 6, takenAtIso: new Date(Date.now() - 60 * 60_000).toISOString() });
    renderControlsWithoutList();
    expect(screen.queryByTestId("insulin-dose-list")).toBeNull();
    // The slim add-insulin row still shows.
    expect(screen.getByTestId("button-add-insulin-dose")).toBeTruthy();
  });

  it("edits a dose's units and saves to the store and history", () => {
    const saved = recordRapidInsulinDose({
      units: 6,
      takenAtIso: new Date(Date.now() - 60 * 60_000).toISOString(),
    });
    renderControls();

    fireEvent.click(screen.getByTestId(`button-edit-insulin-dose-${saved!.id}`));
    const unitsInput = screen.getByTestId("input-insulin-units") as HTMLInputElement;
    expect(unitsInput.value).toBe("6");
    fireEvent.change(unitsInput, { target: { value: "4.5" } });
    fireEvent.click(screen.getByTestId("button-save-insulin-edit"));

    expect(getRapidInsulinDoses()[0]?.units).toBe(4.5);
    expect(getRapidInsulinDoseHistory()[0]?.units).toBe(4.5);
    expect(screen.queryByTestId("insulin-dose-edit-form")).toBeNull();
  });

  it("deletes a dose after confirming", () => {
    const saved = recordRapidInsulinDose({ units: 5 });
    renderControls();

    fireEvent.click(screen.getByTestId(`button-edit-insulin-dose-${saved!.id}`));
    fireEvent.click(screen.getByTestId("button-delete-insulin-dose"));
    // First tap only asks; the dose is still there.
    expect(getRapidInsulinDoses()).toHaveLength(1);
    fireEvent.click(screen.getByTestId("button-confirm-delete-insulin-dose"));

    expect(getRapidInsulinDoses()).toEqual([]);
    expect(getRapidInsulinDoseHistory()).toEqual([]);
  });

  it("still adds a new dose from the add form", () => {
    renderControls();
    fireEvent.click(screen.getByTestId("button-add-insulin-dose"));
    fireEvent.change(screen.getByTestId("input-insulin-units"), { target: { value: "3" } });
    fireEvent.click(screen.getByTestId("button-save-insulin-dose"));
    expect(getRapidInsulinDoses()[0]?.units).toBe(3);
  });
});
