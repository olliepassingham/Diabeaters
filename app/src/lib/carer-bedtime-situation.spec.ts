import { describe, expect, it } from "vitest";
import {
  bedtimeAttentionDetail,
  bedtimeReadyDetail,
  bedtimeSituationDetail,
  formatBedtimeSharedBg,
} from "./carer-bedtime-situation";

describe("carer-bedtime-situation", () => {
  it("formats shared bedtime BG", () => {
    expect(formatBedtimeSharedBg({ bg: 6.2, bg_units: "mmol/L" })).toBe("6.2 mmol/L");
    expect(formatBedtimeSharedBg({ bg: 112, bg_units: "mg/dL" })).toBe("112 mg/dL");
    expect(formatBedtimeSharedBg({ bg: 6.2 })).toBeNull();
  });

  it("ready detail reassures without BG by default", () => {
    expect(
      bedtimeReadyDetail({
        bedtime_ready: true,
        inputs_summary: {
          bg: 6.2,
          bg_units: "mmol/L",
          trend: "flat",
          recent_hypos: false,
          had_alcohol: false,
          exercised_today: false,
        },
      }),
    ).toBe("Overnight looks steady · flat trend · no recent hypo");
  });

  it("ready detail includes BG when live glucose is shared", () => {
    expect(
      bedtimeReadyDetail(
        {
          bedtime_ready: true,
          inputs_summary: {
            bg: 6.2,
            bg_units: "mmol/L",
            trend: "flat",
            recent_hypos: false,
            had_alcohol: false,
          },
        },
        { includeBg: true },
      ),
    ).toBe("Overnight looks steady · 6.2 mmol/L · flat trend");
  });

  it("ready detail falls back to a calm line with no summary", () => {
    expect(bedtimeReadyDetail({ bedtime_ready: true })).toBe("Overnight looks steady");
  });

  it("ready detail ignores non-ready state", () => {
    expect(bedtimeReadyDetail({ bedtime_ready: false, readiness_level: "monitor" })).toBeUndefined();
  });

  it("attention detail keeps risk chips", () => {
    expect(
      bedtimeAttentionDetail({
        bedtime_ready: false,
        inputs_summary: {
          recent_hypos: true,
          had_alcohol: true,
          trend: "falling",
        },
      }),
    ).toBe("recent hypo · alcohol");
  });

  it("attention detail can include BG when shared", () => {
    expect(
      bedtimeAttentionDetail(
        {
          bedtime_ready: false,
          readiness_level: "monitor",
          inputs_summary: { bg: 4.8, bg_units: "mmol/L" },
        },
        { includeBg: true },
      ),
      ).toBe("They noted this was worth watching overnight · 4.8 mmol/L");
    });

  it("situation detail routes by readiness", () => {
    expect(bedtimeSituationDetail({ bedtime_ready: true }, true)).toBe("Overnight looks steady");
    expect(
      bedtimeSituationDetail({ bedtime_ready: false, readiness_level: "alert" }, false),
    ).toBe("Higher overnight risk noted at check-in");
  });
});
