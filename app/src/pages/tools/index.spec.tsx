import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolsHubPage } from "./index";

describe("ToolsHubPage", () => {
  it("renders grouped sections and curated resources", () => {
    render(<ToolsHubPage />);

    expect(screen.queryByTestId("tools-section-most-used")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-act-now")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-plan")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-learn")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-resources")).not.toBeNull();

    // One stable curated source label.
    expect(screen.getByText("NHS")).not.toBeNull();
  });
});

