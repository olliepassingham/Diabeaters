import { describe, expect, it } from "vitest";
import { buildCoachHref } from "./links";

describe("buildCoachHref", () => {
  it("returns bare /coach when no params", () => {
    expect(buildCoachHref({})).toBe("/coach");
  });

  it("adds supporter audience", () => {
    expect(buildCoachHref({ audience: "supporter" })).toBe("/coach?audience=supporter");
  });

  it("adds community topic", () => {
    expect(buildCoachHref({ topic: "community" })).toBe("/coach?topic=community");
  });

  it("adds topic and encodes q", () => {
    expect(buildCoachHref({ topic: "sick-day", q: "hello world" })).toBe(
      "/coach?topic=sick-day&q=hello+world",
    );
  });

  it("truncates very long q", () => {
    const long = "x".repeat(600);
    const href = buildCoachHref({ q: long });
    const q = new URLSearchParams(href.split("?")[1] ?? "").get("q");
    expect(q?.length).toBe(500);
  });

  it("adds from", () => {
    expect(buildCoachHref({ from: "topbar" })).toBe("/coach?from=topbar");
  });
});
