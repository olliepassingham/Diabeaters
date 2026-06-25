import { describe, expect, it } from "vitest";
import {
  carerNameFromCheckInNotification,
  checkInIdFromNotificationData,
  formatHypoCheckInStatusLabel,
  friendlyCreateCheckInError,
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
  });

  it("maps create errors to friendly copy", () => {
    expect(friendlyCreateCheckInError("rate_limited")).toContain("15 minutes");
    expect(friendlyCreateCheckInError("pending_exists")).toContain("waiting");
    expect(friendlyCreateCheckInError("Could not find the function public.create_hypo_check_in")).toContain(
      "not set up on the server",
    );
  });
});
