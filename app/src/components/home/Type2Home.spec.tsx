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

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-type2-demo" }, loading: false }),
}));

vi.mock("@/lib/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profile")>();
  return {
    ...actual,
    useProfile: () => ({
      profile: {
        full_name: "Alex Demo",
        public_handle: "alex_demo",
        is_public: true,
      },
      loading: false,
    }),
  };
});

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
    expect(next?.insulinDeliveryMethod).toBe("");
    expect(storage.getProfile()?.diabetesType).toBe("type2");
  });

  it("clears leftover pen/pump delivery on an existing Type 2 profile", () => {
    storage.saveProfile({
      ...baseProfile(),
      diabetesType: "type2",
      usingInsulin: false,
      insulinDeliveryMethod: "pen",
    });
    const next = ensureLocalType2Profile(storage.getProfile());
    expect(next?.insulinDeliveryMethod).toBe("");
  });

  it("orders supplies, appointments, Feed, Beatie, then Help Now", () => {
    storage.saveProfile({ ...baseProfile(), diabetesType: "type2", usingInsulin: false });
    render(<Type2Home profile={storage.getProfile()} displayName="Alex Demo" />);
    expect(screen.getByTestId("type2-home")).not.toBeNull();
    expect(screen.getByTestId("type2-home-greeting")).not.toBeNull();
    expect(screen.queryByTestId("type2-home-hero")).toBeNull();

    const order = [
      screen.getByTestId("home-supply-graph"),
      screen.getByTestId("type2-home-appointments"),
      screen.getByTestId("type2-home-feed"),
      screen.getByTestId("type2-home-ask-beatie"),
      screen.getByTestId("type2-home-emergency"),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByText(/No visits yet/i)).not.toBeNull();
    expect(screen.getByText(/Emergency card for bystanders/i)).not.toBeNull();
    expect(screen.queryByTestId("type2-home-tiles")).toBeNull();
    expect(screen.queryByText(/connect your cgm/i)).toBeNull();
  });
});
