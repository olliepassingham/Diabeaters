import { describe, expect, it } from "vitest";
import { isMissingProfileColumnSchemaError } from "./clinical-prefs-cloud-sync";

describe("isMissingProfileColumnSchemaError", () => {
  it("matches PostgREST schema cache message for date_of_birth", () => {
    expect(
      isMissingProfileColumnSchemaError(
        "Could not find the 'date_of_birth' column of 'profiles' in the schema cache",
        "date_of_birth",
      ),
    ).toBe(true);
  });

  it("matches PostgREST schema cache message for insulin_delivery_method", () => {
    expect(
      isMissingProfileColumnSchemaError(
        "Could not find the 'insulin_delivery_method' column of 'profiles' in the schema cache",
        "insulin_delivery_method",
      ),
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isMissingProfileColumnSchemaError("JWT expired", "date_of_birth")).toBe(false);
    expect(
      isMissingProfileColumnSchemaError("permission denied for table profiles", "insulin_delivery_method"),
    ).toBe(false);
  });
});
