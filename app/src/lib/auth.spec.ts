import { describe, expect, it } from "vitest";
import type { Session, User } from "@supabase/supabase-js";

import {
  describeAuthErrorForDisplay,
  isLikelyExistingAccountSignup,
  normalizeAuthEmail,
} from "@/lib/auth";
import { getEmailAuthRedirectUrl, nextPathAfterAuthConfirm } from "@/lib/auth-app-url";

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

  it("asks the user to wait after a send rate limit", () => {
    expect(
      describeAuthErrorForDisplay({
        name: "AuthApiError",
        message: "For security purposes, you can only request this after 60 seconds.",
        code: "over_email_send_rate_limit",
      } as Error & { code: string }),
    ).toEqual({
      message: "Please wait a few minutes before requesting another email.",
    });
  });
});

describe("isLikelyExistingAccountSignup", () => {
  it("treats a user with no identities and no session as an existing account", () => {
    expect(
      isLikelyExistingAccountSignup({ id: "u1", identities: [] } as User, null),
    ).toBe(true);
  });

  it("does not flag a new unconfirmed signup", () => {
    expect(
      isLikelyExistingAccountSignup(
        {
          id: "u1",
          identities: [
            {
              id: "i1",
              identity_id: "i1",
              user_id: "u1",
              identity_data: {},
              provider: "email",
              last_sign_in_at: "",
              created_at: "",
              updated_at: "",
            },
          ],
        } as User,
        null,
      ),
    ).toBe(false);
  });

  it("does not flag a signup that returned a session", () => {
    expect(
      isLikelyExistingAccountSignup(
        { id: "u1", identities: [] } as User,
        { access_token: "t" } as Session,
      ),
    ).toBe(false);
  });
});

describe("email auth redirects", () => {
  it("sends confirmation mail to the public https verify page, not a native scheme", () => {
    const url = getEmailAuthRedirectUrl();
    expect(url.startsWith("https://")).toBe(true);
    expect(url.endsWith("/auth/email-verify")).toBe(true);
    expect(url.includes("diabeaters://")).toBe(false);
  });
});

describe("nextPathAfterAuthConfirm", () => {
  it("honours an explicit next path", () => {
    expect(nextPathAfterAuthConfirm("?token_hash=abc&type=recovery&next=/reset-password")).toBe(
      "/reset-password",
    );
  });

  it("sends signup confirmation to the verified screen, not password reset", () => {
    expect(nextPathAfterAuthConfirm("?token_hash=abc&type=signup")).toBe("/verified-return");
  });

  it("sends recovery links to reset password", () => {
    expect(nextPathAfterAuthConfirm("?token_hash=abc&type=recovery")).toBe("/reset-password");
  });
});
