import { describe, expect, it } from "vitest";
import { pathFromOpenedAppUrl } from "./native-app-open-url";

describe("pathFromOpenedAppUrl", () => {
  it("maps diabeaters://auth/email-verify to /auth/email-verify (host is not a path segment)", () => {
    expect(pathFromOpenedAppUrl("diabeaters://auth/email-verify?x=1#frag")).toBe("/auth/email-verify?x=1#frag");
  });

  it("passes through https URLs as pathname + search + hash", () => {
    expect(pathFromOpenedAppUrl("https://diabeaters.vercel.app/auth/callback?code=abc")).toBe(
      "/auth/callback?code=abc",
    );
  });

  it("supports diabeaters:///auth/email-verify (empty host)", () => {
    expect(pathFromOpenedAppUrl("diabeaters:///auth/email-verify")).toBe("/auth/email-verify");
  });
});
