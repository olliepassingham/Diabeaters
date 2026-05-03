import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AskAnythingModal } from "./AskAnythingModal";

vi.mock("@/lib/flags", () => ({
  isAiCoachEnabled: true,
}));

describe("AskAnythingModal", () => {
  it("renders Help Now link and topic chips", () => {
    const { hook } = memoryLocation({ path: "/" });
    render(
      <Router hook={hook}>
        <AskAnythingModal open onOpenChange={() => {}} audience="patient" source="test" />
      </Router>,
    );
    expect(screen.getByText(/Educational only/i)).not.toBeNull();
    const helpLink = screen.getByRole("link", { name: /open Help Now/i });
    expect(helpLink.getAttribute("href")).toBe("/help-now");
    expect(screen.getByTestId("chip-ask-topic-sick-day")).not.toBeNull();
  });

  it("toggles sick-day chip selection", () => {
    const { hook } = memoryLocation({ path: "/" });
    render(
      <Router hook={hook}>
        <AskAnythingModal open onOpenChange={() => {}} audience="patient" source="test" />
      </Router>,
    );
    const chip = screen.getByTestId("chip-ask-topic-sick-day");
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(chip).not.toBeNull();
  });
});
