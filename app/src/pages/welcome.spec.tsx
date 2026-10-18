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

  it("renders Type 1, Type 2, supporter, then exploring", () => {
    render(<Welcome />);
    expect(screen.getByRole("heading", { name: /who is this for/i })).not.toBeNull();
    const order = [
      screen.getByTestId("welcome-patient"),
      screen.getByTestId("welcome-type2"),
      screen.getByTestId("welcome-supporter"),
      screen.getByTestId("welcome-community"),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.queryByTestId("welcome-both")).toBeNull();
    expect(screen.getByTestId("welcome-supporter").textContent).toMatch(/with type 1/i);
    expect(screen.getByTestId("welcome-community").className).toMatch(/emerald/);
  });

  it("sets patient onboarding path and routes to signup", () => {
    render(<Welcome />);
    fireEvent.click(screen.getByTestId("welcome-patient"));
    expect(getOnboardingAccountPath()).toBe("patient");
    expect(getPrimaryAppRole()).toBe("patient");
    expect(setLocation).toHaveBeenCalledWith("/signup");
  });

  it("sets type2 path then patient signup", () => {
    render(<Welcome />);
    fireEvent.click(screen.getByTestId("welcome-type2"));
    expect(getOnboardingAccountPath()).toBe("type2");
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
