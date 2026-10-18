import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { setOnboardingAccountPath } from "@/lib/carer-session";
import { storage, type UserProfile } from "@/lib/storage";
import { ensureLocalType2Profile } from "@/lib/type2-session";
import { Type2Home } from "./Type2Home";

vi.mock("@/lib/flags", () => ({
  isAiCoachEnabled: true,
  isCommunityEnabled: true,
}));

const baseProfile = (): UserProfile => ({
  name: "Alex Demo",
  email: "alex@example.com",
  dateOfBirth: "",
  bgUnits: "mmol/L",
  carbUnits: "grams",
  diabetesType: "type1",
  insulinDeliveryMethod: "pen",
  usingInsulin: true,
  hasAcceptedDisclaimer: true,
  accountType: "patient",
});

describe("Type2Home", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setOnboardingAccountPath("type2");
  });

  it("rewrites local profile to Type 2 when path is type2", () => {
    storage.saveProfile(baseProfile());
    const next = ensureLocalType2Profile(storage.getProfile());
    expect(next?.diabetesType).toBe("type2");
    expect(next?.usingInsulin).toBe(false);
    expect(storage.getProfile()?.diabetesType).toBe("type2");
  });

  it("renders care kit essentials without the old tile grid", () => {
    storage.saveProfile({ ...baseProfile(), diabetesType: "type2", usingInsulin: false });
    render(<Type2Home profile={storage.getProfile()} displayName="Alex Demo" />);
    expect(screen.getByTestId("type2-home")).not.toBeNull();
    expect(screen.getByTestId("type2-home-supplies")).not.toBeNull();
    expect(screen.getByTestId("type2-home-appointments")).not.toBeNull();
    expect(screen.getByTestId("type2-home-emergency")).not.toBeNull();
    expect(screen.getByTestId("type2-home-ask-beatie")).not.toBeNull();
    expect(screen.queryByTestId("type2-home-tiles")).toBeNull();
    expect(screen.queryByText(/connect your cgm/i)).toBeNull();
  });
});
