import { describe, expect, it } from "vitest";
import {
  carerNameFromCheckInNotification,
  checkInIdFromNotificationData,
  formatHypoCheckInStatusLabel,
  friendlyCreateCheckInError,
  isActivePendingHypoCheckIn,
} from "./hypo-check-ins";

describe("hypo-check-ins", () => {
  it("reads check-in id from notification payload", () => {
    expect(checkInIdFromNotificationData({ check_in_id: "abc-123" })).toBe("abc-123");
    expect(checkInIdFromNotificationData({ kind: "hypo_check_in" })).toBeNull();
  });

  it("reads carer name with fallback", () => {
    expect(carerNameFromCheckInNotification({ carer_name: "Sarah" })).toBe("Sarah");
    expect(carerNameFromCheckInNotification({})).toBe("Your supporter");
  });

  it("formats status labels for supporters", () => {
    expect(formatHypoCheckInStatusLabel("pending")).toBe("Waiting for reply");
    expect(formatHypoCheckInStatusLabel("ok")).toBe("They replied they're OK");
    expect(formatHypoCheckInStatusLabel("hypo_logged")).toBe("They logged a hypo");
    expect(formatHypoCheckInStatusLabel("expired")).toBe("No reply (timed out)");
  });

  it("maps create errors to friendly copy", () => {
    expect(friendlyCreateCheckInError("rate_limited")).toContain("15 minutes");
    expect(friendlyCreateCheckInError("pending_exists")).toContain("waiting");
    expect(friendlyCreateCheckInError("check_in_expired")).toContain("30 minutes");
  });

  it("treats pending check-ins older than 30 minutes as inactive", () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const stale = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    expect(isActivePendingHypoCheckIn({ status: "pending", created_at: recent })).toBe(true);
    expect(isActivePendingHypoCheckIn({ status: "pending", created_at: stale })).toBe(false);
    expect(isActivePendingHypoCheckIn({ status: "ok", created_at: recent })).toBe(false);
  });
});
