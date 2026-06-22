import { describe, expect, it } from "vitest";

import { PASSWORD_MIN_LENGTH, validatePassword } from "@/lib/password-policy";

describe("password policy", () => {
  it("requires at least the configured minimum length", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN_LENGTH - 1)).ok).toBe(false);
    expect(validatePassword("a".repeat(PASSWORD_MIN_LENGTH)).ok).toBe(true);
  });

  it("returns a clear message when too short", () => {
    expect(validatePassword("short")).toEqual({
      ok: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  });
});
