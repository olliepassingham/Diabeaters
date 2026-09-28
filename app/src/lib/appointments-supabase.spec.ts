import { describe, expect, it } from "vitest";

import { appointmentCloudUpdateIsNewer } from "./appointments-supabase";

describe("appointmentCloudUpdateIsNewer", () => {
  it("pushes when the device edit is newer than the stored row", () => {
    expect(appointmentCloudUpdateIsNewer("2026-09-28T08:00:00.000Z", "2026-09-28T09:00:00.000Z")).toBe(true);
  });

  it("does not push an older snapshot over a newer stored row", () => {
    expect(appointmentCloudUpdateIsNewer("2026-09-28T09:00:00.000Z", "2026-09-28T08:00:00.000Z")).toBe(false);
  });
});
