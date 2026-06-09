import { describe, expect, it } from "vitest";
import { isEmailLike, resolveUserDisplayName } from "./user-display-name";

describe("resolveUserDisplayName", () => {
  it("prefers cloud full name when valid", () => {
    expect(
      resolveUserDisplayName({ cloudFullName: "Ollie Passingham", localName: "Local Name" }),
    ).toBe("Ollie Passingham");
  });

  it("skips email-like cloud name and uses local name", () => {
    expect(
      resolveUserDisplayName({
        cloudFullName: "oliver.passingham@se.com",
        localName: "Ollie Passingham",
      }),
    ).toBe("Ollie Passingham");
  });

  it("returns empty when only emails are available", () => {
    expect(
      resolveUserDisplayName({
        cloudFullName: "oliver.passingham@se.com",
        localName: "other@example.com",
      }),
    ).toBe("");
  });
});

describe("isEmailLike", () => {
  it("detects simple emails", () => {
    expect(isEmailLike("user@domain.com")).toBe(true);
    expect(isEmailLike("Ollie Passingham")).toBe(false);
  });
});
