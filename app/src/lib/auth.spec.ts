import { describe, expect, it } from "vitest";

import { describeAuthErrorForDisplay, normalizeAuthEmail } from "@/lib/auth";

describe("normalizeAuthEmail", () => {
  it("trims and lowercases autofill spacing", () => {
    expect(normalizeAuthEmail("  Alex@Example.COM ")).toBe("alex@example.com");
  });
});

describe("describeAuthErrorForDisplay", () => {
  it("asks the user to complete the security check on captcha failures", () => {
    expect(
      describeAuthErrorForDisplay({
        name: "AuthApiError",
        message: "captcha verification process failed",
        code: "captcha_failed",
      } as Error & { code: string }),
    ).toEqual({
      message: "Please complete the security check and try again.",
    });
  });

  it("keeps invalid credentials as a generic retry", () => {
    expect(
      describeAuthErrorForDisplay({
        name: "AuthApiError",
        message: "Invalid login credentials",
        code: "invalid_credentials",
      } as Error & { code: string }),
    ).toEqual({ message: "Try again." });
  });
});
