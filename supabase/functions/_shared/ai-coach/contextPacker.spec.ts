/**
 * Context-packer specs — §3 of docs/regulatory/ai_coach_system_prompt.md.
 *
 * Asserts:
 *   - PII never leaks (no name, email, postcode, raw timestamps).
 *   - Numeric inputs are clamped to safe ranges.
 *   - dataSparse fires when the user has fewer than ~14 BG readings AND <= 1
 *     exercise session in the last fortnight.
 *   - Age band, delivery method, BG units, diagnosed years are derived
 *     correctly.
 */

import { describe, expect, it } from "vitest";
import { packContext, type PackContextInput } from "./contextPacker.ts";

const FIXED_NOW = new Date("2026-05-01T00:00:00Z");

const baseFortnight = {
  bgReadings: 84,
  estimatedTimeInRangePct: 62,
  hypoCount: 4,
  severeHypoCount: 0,
  highCount: 11,
  exerciseSessions: 5,
  sickDayActive: false,
  travelModeActive: false,
};

function input(overrides?: Partial<PackContextInput>): PackContextInput {
  return {
    profile: {
      dateOfBirth: "1990-06-15",
      insulinDeliveryMethod: "mdi",
      bgUnits: "mmol/L",
      diabetesOnsetDate: "2014-01-10",
    },
    lastFortnight: { ...baseFortnight },
    ratiosAreSet: true,
    now: FIXED_NOW,
    ...overrides,
  };
}

describe("packContext — profile derivation", () => {
  it("derives age band and whole years from DOB", () => {
    const adult = packContext(input());
    expect(adult.profile.ageBand).toBe("30-39");
    expect(adult.profile.ageYears).toBe(35);

    const twentys = packContext(input({ profile: { ...input().profile, dateOfBirth: "2000-01-01" } }));
    expect(twentys.profile.ageBand).toBe("18-29");
    expect(twentys.profile.ageYears).toBe(26);

    expect(
      packContext(input({ profile: { ...input().profile, dateOfBirth: "1955-01-01" } }))
        .profile.ageBand,
    ).toBe("60+");

    const minor = packContext(input({ profile: { ...input().profile, dateOfBirth: "2012-06-15" } }));
    expect(minor.profile.ageBand).toBe("under18");
    expect(minor.profile.ageYears).toBe(13);
  });

  it("returns 'unknown' age band for missing or malformed DOB", () => {
    const missing = packContext(input({ profile: { ...input().profile, dateOfBirth: null } })).profile;
    expect(missing.ageBand).toBe("unknown");
    expect(missing.ageYears).toBeNull();
    const bad = packContext(input({ profile: { ...input().profile, dateOfBirth: "not-a-date" } })).profile;
    expect(bad.ageBand).toBe("unknown");
    expect(bad.ageYears).toBeNull();
  });

  it("normalises delivery method to mdi/pump/unknown", () => {
    expect(
      packContext(input({ profile: { ...input().profile, insulinDeliveryMethod: "pen" } }))
        .profile.deliveryMethod,
    ).toBe("mdi");
    expect(
      packContext(input({ profile: { ...input().profile, insulinDeliveryMethod: "PUMP" } }))
        .profile.deliveryMethod,
    ).toBe("pump");
    expect(
      packContext(
        input({ profile: { ...input().profile, insulinDeliveryMethod: "something-else" } }),
      ).profile.deliveryMethod,
    ).toBe("unknown");
  });

  it("normalises BG units", () => {
    expect(
      packContext(input({ profile: { ...input().profile, bgUnits: "mmol/L" } })).profile
        .bgUnits,
    ).toBe("mmol/L");
    expect(
      packContext(input({ profile: { ...input().profile, bgUnits: "mg/dL" } })).profile
        .bgUnits,
    ).toBe("mg/dL");
    expect(
      packContext(input({ profile: { ...input().profile, bgUnits: null } })).profile.bgUnits,
    ).toBe("unknown");
  });

  it("derives diagnosedYearsAgo as a non-negative integer", () => {
    expect(packContext(input()).profile.diagnosedYearsAgo).toBe(12);
    expect(
      packContext(input({ profile: { ...input().profile, diabetesOnsetDate: null } }))
        .profile.diagnosedYearsAgo,
    ).toBeNull();
    expect(
      packContext(input({ profile: { ...input().profile, diabetesOnsetDate: "garbage" } }))
        .profile.diagnosedYearsAgo,
    ).toBeNull();
  });
});

describe("packContext — lastFortnight clamping", () => {
  it("clamps negative or non-finite numbers to 0", () => {
    const ctx = packContext(
      input({
        lastFortnight: {
          ...baseFortnight,
          bgReadings: -3,
          hypoCount: Number.NaN,
          highCount: Number.POSITIVE_INFINITY,
          exerciseSessions: -1,
        },
      }),
    );
    expect(ctx.lastFortnight.bgReadings).toBe(0);
    expect(ctx.lastFortnight.hypoCount).toBe(0);
    expect(ctx.lastFortnight.highCount).toBe(0);
    expect(ctx.lastFortnight.exerciseSessions).toBe(0);
  });

  it("clamps estimatedTimeInRangePct to 0..100 or null", () => {
    expect(
      packContext(
        input({ lastFortnight: { ...baseFortnight, estimatedTimeInRangePct: -5 } }),
      ).lastFortnight.estimatedTimeInRangePct,
    ).toBe(0);
    expect(
      packContext(
        input({ lastFortnight: { ...baseFortnight, estimatedTimeInRangePct: 150 } }),
      ).lastFortnight.estimatedTimeInRangePct,
    ).toBe(100);
    expect(
      packContext(
        input({
          lastFortnight: { ...baseFortnight, estimatedTimeInRangePct: Number.NaN },
        }),
      ).lastFortnight.estimatedTimeInRangePct,
    ).toBeNull();
  });

  it("includes travelTripStyle when travel is active and style is known", () => {
    const ctx = packContext(
      input({
        lastFortnight: { ...baseFortnight, travelModeActive: true, travelTripStyle: "active" },
      }),
    );
    expect(ctx.lastFortnight.travelTripStyle).toBe("active");
  });

  it("drops travelTripStyle when travel mode is off", () => {
    const ctx = packContext(
      input({
        lastFortnight: { ...baseFortnight, travelModeActive: false, travelTripStyle: "active" },
      }),
    );
    expect(ctx.lastFortnight.travelTripStyle).toBeUndefined();
  });
});

describe("packContext — dataSparse", () => {
  it("is true when both BG readings and exercise sessions are scarce", () => {
    const ctx = packContext(
      input({
        lastFortnight: { ...baseFortnight, bgReadings: 2, exerciseSessions: 0 },
      }),
    );
    expect(ctx.dataSparse).toBe(true);
  });

  it("is false when bgReadings is plentiful even if exerciseSessions is 0", () => {
    const ctx = packContext(
      input({
        lastFortnight: { ...baseFortnight, bgReadings: 90, exerciseSessions: 0 },
      }),
    );
    expect(ctx.dataSparse).toBe(false);
  });

  it("is false when exercise sessions are present even if BG is scarce", () => {
    const ctx = packContext(
      input({
        lastFortnight: { ...baseFortnight, bgReadings: 5, exerciseSessions: 4 },
      }),
    );
    expect(ctx.dataSparse).toBe(false);
  });
});

describe("packContext — supplies summary", () => {
  it("includes sanitised supplies when suppliesSummary is provided", () => {
    const ctx = packContext(
      input({
        suppliesSummary: {
          trackedSlots: 3,
          criticalOrEmptySlots: 1,
          slotsByCategory: { cgm: 2, infusion_set: 1 },
        },
      }),
    );
    expect(ctx.supplies?.trackedSlots).toBe(3);
    expect(ctx.supplies?.criticalOrEmptySlots).toBe(1);
    expect(ctx.supplies?.slotsByCategory.cgm).toBe(2);
    expect(ctx.supplies?.slotsByCategory.infusion_set).toBe(1);
  });
});

describe("packContext — PII strip", () => {
  it("never includes name/email/postcode-shaped keys even if smuggled in", () => {
    // Caller passes extra fields by accident — packer must drop them.
    const ctx = packContext(
      input({
        profile: {
          ...input().profile,
          // @ts-expect-error: extra keys intentionally not in the type.
          name: "Alex Example",
          // @ts-expect-error: extra keys intentionally not in the type.
          email: "alex@example.com",
          // @ts-expect-error: extra keys intentionally not in the type.
          postcode: "SW1A 1AA",
        } as never,
      }),
    );
    const json = JSON.stringify(ctx);
    expect(json).not.toContain("Alex Example");
    expect(json).not.toContain("alex@example.com");
    expect(json).not.toContain("SW1A");
  });
});
