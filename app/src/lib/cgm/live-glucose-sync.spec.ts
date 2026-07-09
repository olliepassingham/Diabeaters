import { describe, expect, it } from "vitest";
import { cloudLiveGlucoseToPrefill } from "./live-glucose-sync";
import type { CloudPatientLiveGlucoseRow } from "@/lib/carers.types";

describe("cloudLiveGlucoseToPrefill", () => {
  it("maps a cloud row to the same chip shape as on-device CGM", () => {
    const row: CloudPatientLiveGlucoseRow = {
      user_id: "patient-1",
      value: 9.6,
      units: "mmol/L",
      trend: "flat",
      source_label: "Dexcom Share",
      recorded_at: new Date(Date.now() - 2 * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
      target_low: 4,
      target_high: 10,
      range_status: "in_range",
    };
    const prefill = cloudLiveGlucoseToPrefill(row);
    expect(prefill.fromCgm).toBe(true);
    expect(prefill.value).toBe("9.6");
    expect(prefill.source).toMatch(/Dexcom Share/);
    expect(prefill.reading?.trend).toBe("flat");
  });
});
