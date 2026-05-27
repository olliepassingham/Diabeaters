import { describe, expect, it } from "vitest";

import { isProfileHandleUniqueViolation, normalizePublicHandleInput } from "@/lib/profile";

describe("profile handle uniqueness helpers", () => {
  it("detects postgres unique violation by code", () => {
    expect(isProfileHandleUniqueViolation({ code: "23505", message: "duplicate" })).toBe(true);
  });

  it("detects unique index name in message", () => {
    expect(
      isProfileHandleUniqueViolation({
        message: 'duplicate key value violates unique constraint "profiles_public_handle_unique_lower"',
      }),
    ).toBe(true);
  });

  it("normalizes handles to lowercase", () => {
    expect(normalizePublicHandleInput("Ollie_1")).toBe("ollie_1");
  });
});
