import { describe, expect, it } from "vitest";
import { SETTINGS_DATE_OF_BIRTH_HREF } from "./settings-nav";

describe("SETTINGS_DATE_OF_BIRTH_HREF", () => {
  it("points at personal usage settings with dob anchor", () => {
    expect(SETTINGS_DATE_OF_BIRTH_HREF).toBe("/settings/usage#settings-dob");
  });
});
