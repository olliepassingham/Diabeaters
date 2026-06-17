import { describe, expect, it } from "vitest";
import { DEFAULT_CARER_SCOPES } from "@/lib/carers.types";

describe("DEFAULT_CARER_SCOPES public_profile_mention", () => {
  it("is off by default for new supporter links", () => {
    expect(DEFAULT_CARER_SCOPES.public_profile_mention).toBe(false);
  });
});
