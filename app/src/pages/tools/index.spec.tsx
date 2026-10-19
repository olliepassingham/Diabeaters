import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-community-push-prompt-after-onboarding", () => ({
  useCommunityPushPromptAfterOnboarding: () => ({
    communityPushPromptOpen: false,
    setCommunityPushPromptOpen: () => {},
  }),
}));

import { setOnboardingAccountPath, clearOnboardingAccountPath } from "@/lib/carer-session";
import { storage } from "@/lib/storage";
import { CARER_TOOLS, ToolsHubPage, type2ToolsForHub } from "./index";

describe("ToolsHubPage", () => {
  beforeEach(() => {
    localStorage.clear();
    clearOnboardingAccountPath();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders patient sections without duplicate Most used; meal and ratios tool appears once", () => {
    render(<ToolsHubPage hubVariant="patient" />);

    expect(screen.queryByTestId("tools-section-most-used")).toBeNull();
    expect(screen.queryByTestId("tools-section-act-now")).not.toBeNull();
    expect(screen.queryByTestId("tools-section-plan")).toBeNull();
    expect(screen.queryByTestId("tools-section-learn")).toBeNull();
    expect(screen.queryByTestId("tools-section-resources")).toBeNull();

    const titles = screen.getAllByRole("heading", { name: /meal.*ratios/i });
    expect(titles.length).toBe(1);
    expect(screen.queryByRole("heading", { name: /hypo history/i })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Plan" }));
    expect(screen.queryByTestId("tools-section-plan")).not.toBeNull();
    expect(screen.getByRole("heading", { name: /hypo history/i })).not.toBeNull();
    expect(screen.queryByRole("heading", { name: /meal.*ratios/i })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Learn" }));
    expect(screen.queryByTestId("tools-section-learn")).not.toBeNull();
    expect(screen.getByRole("heading", { name: /^education$/i })).not.toBeNull();
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

  it("Type 2 hub omits achievements and activity log", () => {
    setOnboardingAccountPath("type2");
    storage.saveProfile({
      name: "Chris",
      email: "",
      dateOfBirth: "",
      bgUnits: "mmol/L",
      carbUnits: "grams",
      diabetesType: "type2",
      insulinDeliveryMethod: "pen",
      usingInsulin: false,
      hasAcceptedDisclaimer: true,
      accountType: "patient",
    });
    render(<ToolsHubPage tools={type2ToolsForHub()} hubVariant="type2" />);

    expect(screen.queryByTestId("tools-type2")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: /what is a hypo/i })).toBeNull();
    expect(screen.getByRole("heading", { name: /glucose units/i })).not.toBeNull();
    expect(screen.queryByRole("heading", { name: /^achievements$/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /activity log/i })).toBeNull();
  });
});
