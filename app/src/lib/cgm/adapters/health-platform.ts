import { Capacitor } from "@capacitor/core";
import type { CgmAdapter } from "@/lib/cgm/adapter";
import type { CgmAccessResult, CgmAvailability, BgUnits, GlucoseReading } from "@/lib/cgm/types";
import {
  healthPlatformLabel,
  isCapacitorNativeShell,
  isIosDevice,
} from "@/lib/native-platform";
import { mgDlToMmol } from "@/lib/cgm/units";
import { assessReadingStaleness } from "@/lib/cgm/staleness";
import { withTimeout } from "@/lib/cgm/async-timeout";
import { HealthAuthorization } from "@/lib/cgm/health-authorization-native";
import { probeHealthNativeBridge } from "@/lib/cgm/health-native-probe";
import { readCgmPreferences } from "@/lib/cgm/preferences";
import { CGM_PREFILL_STALE_AGE_MINUTES } from "@/lib/cgm/v1-scope";

/** Prefer native HealthKit bridge on iPhone; Health Connect uses Capgo on Android. */
function shouldUseIosHealthBridge(): boolean {
  return isIosDevice();
}

type HealthSample = {
  value: number;
  startDate?: string;
  endDate?: string;
  sourceName?: string;
};

const BG_AUTH_OPTIONS = {
  read: ["bloodGlucose"] as const,
  write: [] as const,
};

const HEALTH_CHECK_TIMEOUT_MS = 8_000;
const HEALTH_REQUEST_TIMEOUT_MS = 90_000;
const HEALTH_READ_TIMEOUT_MS = 12_000;

function isBloodGlucoseAuthorized(status: { readAuthorized?: string[] }): boolean {
  return status.readAuthorized?.includes("bloodGlucose") ?? false;
}

async function loadHealthPlugin(): Promise<typeof import("@capgo/capacitor-health").Health | null> {
  if (!isCapacitorNativeShell()) return null;
  try {
    const mod = await import("@capgo/capacitor-health");
    return mod.Health;
  } catch {
    return null;
  }
}

function platformHealthLabel(): string {
  return healthPlatformLabel();
}

function buildReading(
  sample: HealthSample,
  userUnits: BgUnits,
  sourceLabel: string,
): GlucoseReading | null {
  const recordedAt = sample.endDate ?? sample.startDate;
  if (!recordedAt || !Number.isFinite(sample.value) || sample.value <= 0) return null;

  const valueMgDl = sample.value;
  const value = userUnits === "mmol/L" ? mgDlToMmol(valueMgDl) : Math.round(valueMgDl);
  const { ageMinutes, isStale, stalenessNote } = assessReadingStaleness(recordedAt);
  if (ageMinutes > CGM_PREFILL_STALE_AGE_MINUTES) return null;

  return {
    value,
    units: userUnits,
    recordedAt,
    source: "health_platform",
    sourceLabel,
    trend: null,
    ageMinutes,
    isStale,
    stalenessNote,
  };
}

export const healthPlatformCgmAdapter: CgmAdapter = {
  id: "health_platform",
  get label() {
    return platformHealthLabel();
  },
  description: "Read blood glucose samples your CGM app already shares with the phone health app.",

  async isAvailable(): Promise<CgmAvailability> {
    if (!isCapacitorNativeShell()) {
      return { available: false, reason: "Requires the Diabeaters iPhone or Android app." };
    }
    // iOS: use our plugin only — Capgo isAvailable can hang.
    if (shouldUseIosHealthBridge()) {
      if (!Capacitor.isPluginAvailable("HealthAuthorization")) {
        return {
          available: false,
          reason: "Health permission bridge missing. Install TestFlight 1.0.16+.",
        };
      }
      try {
        const probe = await withTimeout(
          HealthAuthorization.probe(),
          4_000,
          "Health permission bridge did not respond.",
        );
        if (!probe.available) {
          return { available: false, reason: "Apple Health is not available on this device." };
        }
        return { available: true };
      } catch (e) {
        return { available: false, reason: e instanceof Error ? e.message : "Health check failed." };
      }
    }
    const Health = await loadHealthPlugin();
    if (!Health) return { available: false, reason: "Health plugin is not available on this build." };
    try {
      const status = await withTimeout(
        Health.isAvailable(),
        HEALTH_CHECK_TIMEOUT_MS,
        "Health Connect took too long to respond.",
      );
      if (!status.available) {
        return { available: false, reason: status.reason ?? `${platformHealthLabel()} is not available.` };
      }
      return { available: true };
    } catch (e) {
      return { available: false, reason: e instanceof Error ? e.message : "Health check failed." };
    }
  },

  async requestAccess(): Promise<CgmAccessResult> {
    const label = platformHealthLabel();

    // iOS: NEVER call Capgo (isAvailable / requestAuthorization / probe) before the sheet.
    // Capgo can hang forever. Only use our main-thread HealthAuthorization plugin.
    if (shouldUseIosHealthBridge()) {
      if (!Capacitor.isPluginAvailable("HealthAuthorization")) {
        return {
          granted: false,
          error:
            "This iPhone build is missing the Health permission bridge. Install TestFlight 1.0.16+ and try again.",
        };
      }
      try {
        // Quick probe of OUR plugin only (not Capgo).
        await withTimeout(
          HealthAuthorization.probe(),
          4_000,
          "Health permission bridge did not respond. Install the newest TestFlight build.",
        );
        const result = await withTimeout(
          HealthAuthorization.requestBloodGlucoseRead(),
          HEALTH_REQUEST_TIMEOUT_MS,
          `No permission sheet from ${label}. Diabeaters will not appear under Health until Apple shows Allow once. Try Settings → Privacy & Security → Health.`,
        );
        if (!result.promptCompleted && !result.success) {
          return {
            granted: false,
            error: "Apple Health did not complete the permission request. Force-quit and try Connect again.",
          };
        }
        return { granted: true };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Permission request failed.";
        return {
          granted: false,
          error: /entitlement|HealthKit|healthkit|Missing/i.test(message)
            ? `${message} HealthKit may be missing from this signed build.`
            : message,
        };
      }
    }

    const probe = await probeHealthNativeBridge();
    if (probe.status === "plugin_missing") {
      return { granted: false, error: probe.message };
    }
    if (probe.status === "health_unavailable") {
      return { granted: false, error: probe.reason ?? "Apple Health is not available on this device." };
    }

    const Health = await loadHealthPlugin();
    if (!Health) return { granted: false, error: "Health plugin unavailable." };
    try {
      const status = await withTimeout(
        Health.requestAuthorization(BG_AUTH_OPTIONS),
        HEALTH_REQUEST_TIMEOUT_MS,
        `No response from ${label}. Check Health Connect permissions for Diabeaters.`,
      );
      const granted = isBloodGlucoseAuthorized(status);
      return {
        granted,
        error: granted ? undefined : "Blood glucose read permission was not granted.",
      };
    } catch (e) {
      return { granted: false, error: e instanceof Error ? e.message : "Permission request failed." };
    }
  },

  async checkAccess(): Promise<CgmAccessResult> {
    // HealthKit never reports true read authorization to apps. After Connect succeeds we
    // persist iosHealthPromptCompleted and treat that as connected on iOS.
    if (shouldUseIosHealthBridge()) {
      const prefs = readCgmPreferences();
      return { granted: Boolean(prefs.iosHealthPromptCompleted && prefs.healthPlatformEnabled) };
    }
    const Health = await loadHealthPlugin();
    if (!Health) return { granted: false, error: "Health plugin unavailable." };
    const label = platformHealthLabel();
    try {
      const status = await withTimeout(
        Health.checkAuthorization(BG_AUTH_OPTIONS),
        HEALTH_CHECK_TIMEOUT_MS,
        `${label} took too long to respond.`,
      );
      const granted = isBloodGlucoseAuthorized(status);
      return { granted };
    } catch (e) {
      return { granted: false, error: e instanceof Error ? e.message : "Permission check failed." };
    }
  },

  async getLatestReading(userUnits: BgUnits): Promise<GlucoseReading | null> {
    const end = new Date();
    const start = new Date(end.getTime() - CGM_PREFILL_STALE_AGE_MINUTES * 60_000);
    const query = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 20,
    };

    try {
      // iOS: never touch Capgo for reads — dynamic import / readSamples can hang forever.
      if (shouldUseIosHealthBridge()) {
        if (!Capacitor.isPluginAvailable("HealthAuthorization")) return null;
        const { samples: nativeSamples } = await withTimeout(
          HealthAuthorization.readBloodGlucoseSamples(query),
          HEALTH_READ_TIMEOUT_MS,
          "Apple Health took too long to return blood glucose samples.",
        );
        return pickLatestReading(nativeSamples, userUnits);
      }

      const Health = await withTimeout(
        loadHealthPlugin(),
        HEALTH_READ_TIMEOUT_MS,
        `${platformHealthLabel()} plugin took too long to load.`,
      );
      if (!Health) return null;
      const result = await withTimeout(
        Health.readSamples({ dataType: "bloodGlucose", ...query }),
        HEALTH_READ_TIMEOUT_MS,
        `${platformHealthLabel()} took too long to return blood glucose samples.`,
      );
      return pickLatestReading(result.samples as HealthSample[], userUnits);
    } catch {
      return null;
    }
  },
};

function pickLatestReading(samples: HealthSample[], userUnits: BgUnits): GlucoseReading | null {
  const sorted = [...samples].sort((a, b) => {
    const ta = new Date(a.endDate ?? a.startDate ?? 0).getTime();
    const tb = new Date(b.endDate ?? b.startDate ?? 0).getTime();
    return tb - ta;
  });

  for (const sample of sorted) {
    const sourceName = sample.sourceName?.trim();
    const label = sourceName ? `${sourceName} via ${platformHealthLabel()}` : platformHealthLabel();
    const reading = buildReading(sample, userUnits, label);
    if (reading) return reading;
  }
  return null;
}
