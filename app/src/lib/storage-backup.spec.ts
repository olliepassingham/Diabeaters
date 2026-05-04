import { describe, expect, it } from "vitest";
import { peekDiabeatersBackup } from "./storage";

describe("peekDiabeatersBackup", () => {
  it("rejects empty object", () => {
    const r = peekDiabeatersBackup("{}");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  it("rejects random JSON array", () => {
    const r = peekDiabeatersBackup("[1,2,3]");
    expect(r.ok).toBe(false);
  });

  it("accepts export-shaped backup with marker", () => {
    const j = JSON.stringify({
      _exportedAt: new Date().toISOString(),
      _version: "1.0",
      _appVersion: "9.9.9",
      PROFILE: { id: "x", full_name: "Test" },
    });
    const r = peekDiabeatersBackup(j);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.keysRestored).toBe(1);
      expect(r.backupFormatVersion).toBe("1.0");
      expect(r.appVersion).toBe("9.9.9");
    }
  });

  it("accepts two sections without export marker", () => {
    const j = JSON.stringify({
      PROFILE: { id: "a" },
      SETTINGS: { tdd: 40 },
    });
    const r = peekDiabeatersBackup(j);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.keysRestored).toBe(2);
  });

  it("accepts profile-only legacy export without marker", () => {
    const j = JSON.stringify({ PROFILE: { id: "a" } });
    const r = peekDiabeatersBackup(j);
    expect(r.ok).toBe(true);
  });

  it("rejects single non-core section without marker", () => {
    const j = JSON.stringify({ TRAVEL_PLAN: {} });
    const r = peekDiabeatersBackup(j);
    expect(r.ok).toBe(false);
  });
});
