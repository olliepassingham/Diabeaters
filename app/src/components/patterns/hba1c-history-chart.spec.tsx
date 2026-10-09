import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppointmentResultsFields } from "@/components/appointments/appointment-results-fields";
import { Hba1cHistoryChart } from "@/components/patterns/hba1c-history-chart";
import type { Hba1cHistoryPoint } from "@/lib/appointment-outcomes";

const point: Hba1cHistoryPoint = {
  appointmentId: "a1",
  title: "HbA1c",
  date: "2026-03-01",
  hba1cPercent: 7,
};

describe("HbA1c unit on the graph and the result field", () => {
  beforeEach(() => {
    window.localStorage.removeItem("diabeaters_hba1c_unit_v1");
  });

  it("draws the graph in mmol/mol after that unit is chosen", () => {
    render(<Hba1cHistoryChart points={[point]} />);
    expect(screen.getByText(/Latest: 7%/)).not.toBeNull();

    fireEvent.click(screen.getByTestId("hba1c-unit-mmol"));

    expect(screen.getByText(/Latest: 53 mmol\/mol/)).not.toBeNull();
    expect(screen.getByRole("img", { name: /mmol\/mol/ })).not.toBeNull();
  });

  it("stores a mmol/mol entry as a percentage", () => {
    const seen: Array<number | undefined> = [];
    render(
      <AppointmentResultsFields
        type="blood_test"
        visitDate="2026-03-01"
        outcome={{}}
        onChange={(next) => seen.push(next.hba1cPercent)}
      />,
    );

    fireEvent.click(screen.getByTestId("hba1c-unit-mmol"));
    fireEvent.change(screen.getByTestId("input-outcome-hba1c"), { target: { value: "53" } });

    expect(seen.at(-1)).toBe(7);
    expect((screen.getByTestId("input-outcome-hba1c") as HTMLInputElement).value).toBe("53");
  });
});
