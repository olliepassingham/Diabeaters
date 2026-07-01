import { describe, expect, it, beforeEach } from "vitest";
import {
  consumePendingHypoCheckInRespond,
  storePendingHypoCheckInRespond,
} from "./hypo-check-in-respond-deep-link";

describe("hypo-check-in-respond-deep-link", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores and consumes pending respond payload", () => {
    storePendingHypoCheckInRespond({ checkInId: "abc-123", carerName: "Neil" });
    expect(consumePendingHypoCheckInRespond()).toEqual({
      checkInId: "abc-123",
      carerName: "Neil",
    });
    expect(consumePendingHypoCheckInRespond()).toBeNull();
  });
});
