import { describe, expect, it } from "vitest";
import { nextSupportedPerson } from "./supporter-leave";

describe("nextSupportedPerson", () => {
  const people = [
    { linkId: "link-a", patientId: "a" },
    { linkId: "link-b", patientId: "b" },
  ];

  it("keeps the other person when one link ends", () => {
    expect(nextSupportedPerson(people, "link-a")).toEqual({ linkId: "link-b", patientId: "b" });
    expect(nextSupportedPerson(people, "link-b")).toEqual({ linkId: "link-a", patientId: "a" });
  });

  it("returns null when that was the only link", () => {
    expect(nextSupportedPerson([{ linkId: "link-a", patientId: "a" }], "link-a")).toBeNull();
  });
});
