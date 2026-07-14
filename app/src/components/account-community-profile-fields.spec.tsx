import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AccountCommunityProfileFields } from "./account-community-profile-fields";
import type { ProfileRow } from "@/lib/profile";

const mockRefresh = vi.fn();
const mockToast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
    id,
    "data-testid": testId,
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
    disabled?: boolean;
    id?: string;
    "data-testid"?: string;
  }) => (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked === true}
      data-testid={testId}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onCheckedChange?.(!checked);
      }}
    />
  ),
}));

vi.mock("@/lib/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profile")>();
  return {
    ...actual,
    useProfile: vi.fn(),
    updateProfile: vi.fn(),
    isPublicHandleAvailable: vi.fn(),
  };
});

vi.mock("@/lib/carer-session", () => ({
  getPrimaryAppRole: () => "patient" as const,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@example.com" } as import("@supabase/supabase-js").User }),
}));

import * as profileLib from "@/lib/profile";

const profilePublic: ProfileRow = {
  id: "u1",
  full_name: "Test",
  avatar_url: null,
  bio: "hello",
  public_handle: "myhandle",
  is_public: true,
  diabetes_onset_date: null,
};

function renderWithRouter(ui: ReactElement) {
  const { hook } = memoryLocation({ path: "/" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={hook}>{ui}</Router>
    </QueryClientProvider>,
  );
}

describe("AccountCommunityProfileFields", () => {
  beforeEach(() => {
    vi.mocked(profileLib.isPublicHandleAvailable).mockResolvedValue({
      available: true,
      normalized: "myhandle",
      error: null,
    });
    vi.mocked(profileLib.useProfile).mockReturnValue({
      profile: profilePublic,
      loading: false,
      refresh: mockRefresh,
      error: null,
    });
    vi.mocked(profileLib.updateProfile).mockResolvedValue({
      data: profilePublic,
      error: null,
    });
    mockRefresh.mockClear();
    mockToast.mockClear();
  });

  function clickLastPublicSwitchOn(view: ReturnType<typeof renderWithRouter>) {
    const on = view
      .getAllByTestId("account-community-public-switch")
      .filter((el) => el.getAttribute("aria-checked") === "true");
    fireEvent.click(on[on.length - 1]!);
  }

  it("calls updateProfile with is_public false when turning public profile off", async () => {
    const view = renderWithRouter(<AccountCommunityProfileFields />);
    clickLastPublicSwitchOn(view);
    await waitFor(() => {
      expect(profileLib.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ id: "u1", is_public: false }),
      );
    });
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Saved",
        description: expect.stringContaining("off"),
      }),
    );
  });

  it("reverts switch and toasts error when updateProfile fails", async () => {
    vi.mocked(profileLib.updateProfile).mockReset();
    vi.mocked(profileLib.updateProfile).mockResolvedValue({
      data: null,
      error: new Error("network"),
    });
    const view = renderWithRouter(<AccountCommunityProfileFields />);
    clickLastPublicSwitchOn(view);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Could not update visibility",
          variant: "destructive",
        }),
      );
    });
    const reverted = view
      .getAllByTestId("account-community-public-switch")
      .filter((el) => el.getAttribute("aria-checked") === "true");
    expect(reverted.length).toBeGreaterThan(0);
  });
});
