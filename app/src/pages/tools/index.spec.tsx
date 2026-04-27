import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CARER_TOOLS, ToolsHubPage } from "./index";

describe("ToolsHubPage", () => {
  it("renders patient sections without duplicate Most used; meal and ratios tool appears once", () => {
    render(<ToolsHubPage hubVariant="patient" />);

    expect(screen.queryByTestId("tools-section-most-used")).toBeNull();
    expect(screen.queryByTestId("tools-section-act-now")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-plan")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-learn")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-resources")).not.toBeNull();

    const titles = screen.getAllByRole("heading", { name: /meal.*ratios/i });
    expect(titles.length).toBe(1);

    expect(screen.getByText("NHS")).not.toBeNull();
  });

  it("supporter hub shows combined section and omits empty Plan", () => {
    render(<ToolsHubPage tools={CARER_TOOLS} hubVariant="carer" />);

    expect(screen.queryByTestId("tools-section-supporter")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-plan")).toBeNull();
    expect(screen.queryByTestId("tools-section-act-now")).toBeNull();
    expect(screen.queryByTestId("tools-section-learn")).toBeNull();
    expect(screen.getByRole("heading", { name: /hypo help/i })).not.toBeNull();
    expect(screen.getByRole("heading", { name: /^education$/i })).not.toBeNull();
  });

  it("opens resource preview dialog when a curated card is activated", () => {
    render(<ToolsHubPage />);

    expect(screen.queryByTestId("resource-preview-dialog")).toBeNull();

    fireEvent.click(screen.getAllByTestId("resource-nhs-type1")[0]!);

    expect(screen.getByTestId("resource-preview-dialog")).not.toBeNull();
    expect(screen.getByRole("heading", { name: /type 1 diabetes: overview/i })).not.toBeNull();
    expect(screen.getByTestId("resource-open-external")).not.toBeNull();
  });

  it("open external delegates to window.open", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ToolsHubPage />);
    fireEvent.click(screen.getAllByTestId("resource-nhs-type1")[0]!);
    fireEvent.click(screen.getByTestId("resource-open-external"));

    expect(openSpy).toHaveBeenCalledWith(
      "https://www.nhs.uk/conditions/type-1-diabetes/",
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockRestore();
  });
});
