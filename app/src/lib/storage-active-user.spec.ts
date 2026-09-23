import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_USER_ID_KEY,
  LAST_LOCAL_USER_ID_KEY,
  setActiveUserIdForLocalStorage,
  storage,
} from "@/lib/storage";

describe("setActiveUserIdForLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function seedPatientProfile(name: string) {
    storage.saveProfile({
      name,
      email: "",
      bgUnits: "mmol/L",
      carbUnits: "grams",
      diabetesType: "type1",
      insulinDeliveryMethod: "pen",
      usingInsulin: true,
      hasAcceptedDisclaimer: true,
      dateOfBirth: "",
      accountType: "patient",
    });
    localStorage.setItem("diabeater_onboarding_completed", "true");
  }

  it("keeps clinical data when the same user logs out and back in", () => {
    setActiveUserIdForLocalStorage("user-a");
    seedPatientProfile("Alex");

    setActiveUserIdForLocalStorage(null);
    expect(storage.getProfile()?.name).toBe("Alex");
    expect(localStorage.getItem(ACTIVE_USER_ID_KEY)).toBeNull();
    expect(localStorage.getItem(LAST_LOCAL_USER_ID_KEY)).toBe("user-a");

    setActiveUserIdForLocalStorage("user-a");
    expect(storage.getProfile()?.name).toBe("Alex");
    expect(localStorage.getItem("diabeater_onboarding_completed")).toBe("true");
  });

  it("wipes clinical data when a different user signs in after logout", () => {
    setActiveUserIdForLocalStorage("user-a");
    seedPatientProfile("Alex");

    setActiveUserIdForLocalStorage(null);
    setActiveUserIdForLocalStorage("user-b");

    expect(storage.getProfile()).toBeNull();
    expect(localStorage.getItem("diabeater_onboarding_completed")).toBeNull();
    expect(localStorage.getItem(LAST_LOCAL_USER_ID_KEY)).toBe("user-b");
  });

  it("wipes clinical data on direct account switch without logout", () => {
    setActiveUserIdForLocalStorage("user-a");
    seedPatientProfile("Alex");

    setActiveUserIdForLocalStorage("user-b");

    expect(storage.getProfile()).toBeNull();
    expect(localStorage.getItem(LAST_LOCAL_USER_ID_KEY)).toBe("user-b");
  });
});
