import type { CgmAdapter } from "@/lib/cgm/adapter";
import type { CgmAccessResult, CgmAvailability, BgUnits, GlucoseReading } from "@/lib/cgm/types";
import { isCapacitorNativeShell } from "@/lib/native-platform";
import { Capacitor } from "@capacitor/core";
import { mgDlToMmol } from "@/lib/cgm/units";
import { assessReadingStaleness } from "@/lib/cgm/staleness";
import { CGM_PREFILL_STALE_AGE_MINUTES } from "@/lib/cgm/v1-scope";

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
const HEALTH_REQUEST_TIMEOUT_MS = 30_000;

function isBloodGlucoseAuthorized(status: { readAuthorized?: string[] }): boolean {
  return status.readAuthorized?.includes("bloodGlucose") ?? false;
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
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
  return Capacitor.getPlatform() === "android" ? "Health Connect" : "Apple Health";
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
  label: platformHealthLabel(),
  description: "Read blood glucose samples your CGM app already shares with the phone health app.",

  async isAvailable(): Promise<CgmAvailability> {
    if (!isCapacitorNativeShell()) {
      return { available: false, reason: "Requires the Diabeaters iPhone or Android app." };
    }
    const Health = await loadHealthPlugin();
    if (!Health) return { available: false, reason: "Health plugin is not available on this build." };
    try {
      const status = await Health.isAvailable();
      if (!status.available) {
        return { available: false, reason: status.reason ?? `${platformHealthLabel()} is not available.` };
      }
      return { available: true };
    } catch (e) {
      return { available: false, reason: e instanceof Error ? e.message : "Health check failed." };
    }
  },

  async requestAccess(): Promise<CgmAccessResult> {
    const Health = await loadHealthPlugin();
    if (!Health) return { granted: false, error: "Health plugin unavailable." };
    const label = platformHealthLabel();
    try {
      const existing = await withTimeout(
        Health.checkAuthorization(BG_AUTH_OPTIONS),
        HEALTH_CHECK_TIMEOUT_MS,
        `${label} took too long to respond. Try again.`,
      );
      if (isBloodGlucoseAuthorized(existing)) {
        return { granted: true };
      }

      const status = await withTimeout(
        Health.requestAuthorization(BG_AUTH_OPTIONS),
        HEALTH_REQUEST_TIMEOUT_MS,
        `No response from ${label}. Look for a permission sheet, or open Settings → Health → Data Access & Devices → Diabeaters.`,
      );
      const granted = isBloodGlucoseAuthorized(status);
      return {
        granted,
        error: granted
          ? undefined
          : "Blood glucose read permission was not granted. You can enable it in Settings → Health → Data Access & Devices.",
      };
    } catch (e) {
      return { granted: false, error: e instanceof Error ? e.message : "Permission request failed." };
    }
  },

  async checkAccess(): Promise<CgmAccessResult> {
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
    const Health = await loadHealthPlugin();
    if (!Health) return null;

    const end = new Date();
    const start = new Date(end.getTime() - CGM_PREFILL_STALE_AGE_MINUTES * 60_000);

    try {
      const { samples } = await Health.readSamples({
        dataType: "bloodGlucose",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        limit: 20,
      });

      const sorted = [...(samples as HealthSample[])].sort((a, b) => {
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
    } catch {
      return null;
    }
  },
};
