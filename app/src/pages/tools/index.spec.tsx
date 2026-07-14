import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-community-push-prompt-after-onboarding", () => ({
  useCommunityPushPromptAfterOnboarding: () => ({
    communityPushPromptOpen: false,
    setCommunityPushPromptOpen: () => {},
  }),
}));

import { CARER_TOOLS, ToolsHubPage } from "./index";

describe("ToolsHubPage", () => {
  it("renders patient sections without duplicate Most used; meal and ratios tool appears once", () => {
    render(<ToolsHubPage hubVariant="patient" />);

    expect(screen.queryByTestId("tools-section-most-used")).toBeNull();
    expect(screen.queryByTestId("tools-section-act-now")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-plan")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-learn")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-resources")).toBeNull();

    const titles = screen.getAllByRole("heading", { name: /meal.*ratios/i });
    expect(titles.length).toBe(1);
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
});
