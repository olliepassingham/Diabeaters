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

  it("maps shared community post universal links into the SPA route", () => {
    expect(pathFromOpenedAppUrl("https://diabeaters.vercel.app/community/post/abc-123")).toBe(
      "/community/post/abc-123",
    );
  });

  it("rejects https hosts that are not the public Diabeaters site", () => {
    expect(pathFromOpenedAppUrl("https://evil.example/community/post/abc")).toBeNull();
  });

  it("supports diabeaters:///auth/email-verify (empty host)", () => {
    expect(pathFromOpenedAppUrl("diabeaters:///auth/email-verify")).toBe("/auth/email-verify");
  });
});
