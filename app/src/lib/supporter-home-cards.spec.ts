import { beforeEach, describe, expect, it } from "vitest";
import {
  appointmentsShouldResurface,
  loadSupporterHomeCardPrefs,
  quietCardVisible,
  revealAppointmentsIfNeeded,
  saveSupporterHomeCardPrefs,
  setSupporterCardShown,
  supporterAppointmentKey,
  emptySupporterHomeCardPrefs,
} from "./supporter-home-cards";

describe("supporter home cards", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps every quiet card visible until the supporter hides it", () => {
    const prefs = emptySupporterHomeCardPrefs();
    expect(quietCardVisible(prefs, "appointments")).toBe(true);
    expect(quietCardVisible(prefs, "activity")).toBe(true);
  });

  it("hides appointments until a new upcoming visit appears", () => {
    const hidden = setSupporterCardShown(emptySupporterHomeCardPrefs(), "appointments", false, ["a"]);
    expect(quietCardVisible(hidden, "appointments", { upcomingAppointmentKeys: ["a"] })).toBe(false);
    expect(appointmentsShouldResurface(["a"], ["a"])).toBe(false);
    expect(quietCardVisible(hidden, "appointments", { upcomingAppointmentKeys: ["a", "b"] })).toBe(true);
    expect(revealAppointmentsIfNeeded(hidden, ["a", "b"]).hidden).not.toContain("appointments");
  });

  it("does not bring appointments back when the list is empty", () => {
    const hidden = setSupporterCardShown(emptySupporterHomeCardPrefs(), "appointments", false, ["a"]);
    expect(appointmentsShouldResurface(["a"], [])).toBe(false);
    expect(revealAppointmentsIfNeeded(hidden, [])).toBe(hidden);
  });

  it("keeps low supplies on screen after the card was hidden", () => {
    const hidden = setSupporterCardShown(emptySupporterHomeCardPrefs(), "supplies", false, []);
    expect(quietCardVisible(hidden, "supplies")).toBe(false);
    expect(quietCardVisible(hidden, "supplies", { forceVisible: true })).toBe(true);
  });

  it("stores the choice per linked person", () => {
    const hidden = setSupporterCardShown(emptySupporterHomeCardPrefs(), "activity", false, []);
    saveSupporterHomeCardPrefs("user-1", "patient-a", hidden);
    expect(loadSupporterHomeCardPrefs("user-1", "patient-a").hidden).toEqual(["activity"]);
    expect(loadSupporterHomeCardPrefs("user-1", "patient-b").hidden).toEqual([]);
    expect(loadSupporterHomeCardPrefs("user-2", "patient-a").hidden).toEqual([]);
  });

  it("prefers the client id so a synced row stays the same appointment", () => {
    expect(supporterAppointmentKey({ id: "server", client_id: "local-1" })).toBe("local-1");
    expect(supporterAppointmentKey({ id: "server" })).toBe("server");
    expect(supporterAppointmentKey({})).toBeNull();
  });
});
