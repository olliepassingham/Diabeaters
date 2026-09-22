import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  getOnboardingAccountPath,
  getPrimaryAppRole,
} from "@/lib/carer-session";

const setLocation = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/", setLocation],
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock("@/lib/welcome-path-reconcile", () => ({
  reconcileWrongWelcomePathForSignedInUser: vi.fn(async () => ({ reconciled: false })),
}));

import Welcome from "./welcome";

describe("Welcome path picker", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setLocation.mockReset();
  });

  it("renders four clear choices plus Not sure helper", () => {
    render(<Welcome />);
    expect(screen.getByRole("heading", { name: /who is this for/i })).not.toBeNull();
    expect(screen.getByTestId("welcome-patient")).not.toBeNull();
    expect(screen.getByTestId("welcome-supporter")).not.toBeNull();
    expect(screen.getByTestId("welcome-community")).not.toBeNull();
    expect(screen.getByTestId("welcome-both")).not.toBeNull();
    expect(screen.getByTestId("welcome-not-sure").textContent).toMatch(/not sure/i);
    expect(screen.getByTestId("welcome-patient").textContent).toMatch(/dashboard, meals, travel, hypos/i);
    expect(screen.getByTestId("welcome-supporter").textContent).toMatch(/invite code/i);
    expect(screen.getByTestId("welcome-community").textContent).toMatch(/not full clinical tools/i);
  });

  it("sets patient onboarding path and routes to signup", () => {
    render(<Welcome />);
    fireEvent.click(screen.getByTestId("welcome-patient"));
    expect(getOnboardingAccountPath()).toBe("patient");
    expect(getPrimaryAppRole()).toBe("patient");
    expect(setLocation).toHaveBeenCalledWith("/signup");
  });

  it("sets both path then patient essentials signup", () => {
    render(<Welcome />);
    fireEvent.click(screen.getByTestId("welcome-both"));
    expect(getOnboardingAccountPath()).toBe("both");
    expect(getPrimaryAppRole()).toBe("patient");
    expect(setLocation).toHaveBeenCalledWith("/signup");
  });

  it("sets supporter path and routes to signup", () => {
    render(<Welcome />);
    fireEvent.click(screen.getByTestId("welcome-supporter"));
    expect(getOnboardingAccountPath()).toBe("supporter");
    expect(getPrimaryAppRole()).toBe("carer");
    expect(setLocation).toHaveBeenCalledWith("/signup");
  });

  it("sets community path and routes to signup", () => {
    render(<Welcome />);
    fireEvent.click(screen.getByTestId("welcome-community"));
    expect(getOnboardingAccountPath()).toBe("community");
    expect(getPrimaryAppRole()).toBe("community");
    expect(setLocation).toHaveBeenCalledWith("/signup");
  });
});
