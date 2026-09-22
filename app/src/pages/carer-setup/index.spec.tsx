import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  getOnboardingAccountPath,
  getPrimaryAppRole,
  hasPendingCarer,
  setPendingCarer,
} from "@/lib/carer-session";

const setLocation = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/", setLocation],
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1", email: "s@example.com" }, loading: false }),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => null,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import CarerSetupPage from "./index";

describe("CarerSetupPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setLocation.mockReset();
    setPendingCarer();
  });

  it("shows invite empty-state guidance and switch to Type 1", () => {
    render(<CarerSetupPage />);
    expect(screen.getByText(/you'll need an invite code/i)).not.toBeNull();
    expect(screen.getByTestId("carer-setup-empty-hint")).not.toBeNull();
    expect(screen.getByTestId("carer-setup-switch-type1")).not.toBeNull();
  });

  it("switches to Type 1 essentials without stranding supporter markers", () => {
    render(<CarerSetupPage />);
    fireEvent.click(screen.getByTestId("carer-setup-switch-type1"));
    expect(hasPendingCarer()).toBe(false);
    expect(getOnboardingAccountPath()).toBe("patient");
    expect(getPrimaryAppRole()).toBe("patient");
    expect(setLocation).toHaveBeenCalledWith("/onboarding");
  });
});
