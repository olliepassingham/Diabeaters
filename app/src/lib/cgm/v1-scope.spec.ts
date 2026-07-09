import { describe, expect, it } from "vitest";
import { HEALTH_PLUGIN_EVALUATION } from "@/lib/cgm/health-plugin-evaluation";
import { CGM_V1_MODE, isCgmSourceEnabledInV1 } from "@/lib/cgm/v1-scope";
import { CGM_DATA_RETENTION_POLICY } from "@/lib/cgm/copy";

describe("CGM v1 scope", () => {
  it("locks v1 to prefill health only", () => {
    expect(CGM_V1_MODE).toBe("prefill_health_only");
    expect(isCgmSourceEnabledInV1("health_platform")).toBe(true);
    expect(isCgmSourceEnabledInV1("nightscout")).toBe(false);
  });

  it("documents on-device-only retention", () => {
    expect(CGM_DATA_RETENTION_POLICY.serverUpload).toBe("latest_snapshot_only");
    expect(CGM_DATA_RETENTION_POLICY.v1Storage).toBe("on_device_only");
  });
});

describe("health plugin evaluation", () => {
  it("targets blood glucose via capgo health", () => {
    expect(HEALTH_PLUGIN_EVALUATION.package).toBe("@capgo/capacitor-health");
    expect(HEALTH_PLUGIN_EVALUATION.dataType).toBe("bloodGlucose");
  });
});
