import type { NotificationSettings } from "@/lib/storage";

/** Defaults for supporter extreme-glucose check-in alerts (mmol/L). */
export const DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_LOW_MMOL = 3.5;
export const DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_HIGH_MMOL = 14;

export const SUPPORTER_LIVE_GLUCOSE_ALERT_LOW_OPTIONS_MMOL = [2.5, 3.0, 3.5, 4.0] as const;
export const SUPPORTER_LIVE_GLUCOSE_ALERT_HIGH_OPTIONS_MMOL = [12, 13, 14, 15, 16, 18, 20] as const;

export type SupporterLiveGlucoseAlertStatus = "ok" | "extreme_low" | "extreme_high";

export function bgToMmol(value: number, units: "mmol/L" | "mg/dL"): number {
  return units === "mg/dL" ? value / 18 : value;
}

export function mmolToDisplayBg(mmol: number, units: "mmol/L" | "mg/dL"): number {
  if (units === "mg/dL") return Math.round(mmol * 18);
  return Math.round(mmol * 10) / 10;
}

export function resolveSupporterLiveGlucoseAlertLimitsMmol(
  settings: NotificationSettings | null | undefined,
): { low: number; high: number } {
  const lowRaw = settings?.liveGlucoseAlertLowMmol;
  const highRaw = settings?.liveGlucoseAlertHighMmol;
  const low =
    typeof lowRaw === "number" && Number.isFinite(lowRaw) && lowRaw > 0
      ? lowRaw
      : DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_LOW_MMOL;
  const high =
    typeof highRaw === "number" && Number.isFinite(highRaw) && highRaw > 0
      ? highRaw
      : DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_HIGH_MMOL;
  if (high <= low) {
    return {
      low: DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_LOW_MMOL,
      high: DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_HIGH_MMOL,
    };
  }
  return { low, high };
}

export function resolveSupporterLiveGlucoseAlertLimitsFromPrefs(
  prefs: Record<string, unknown> | null | undefined,
): { low: number; high: number } {
  const lowRaw = prefs?.live_glucose_alert_low;
  const highRaw = prefs?.live_glucose_alert_high;
  const low =
    typeof lowRaw === "number" && Number.isFinite(lowRaw) && lowRaw > 0
      ? lowRaw
      : typeof lowRaw === "string" && Number.isFinite(Number(lowRaw)) && Number(lowRaw) > 0
        ? Number(lowRaw)
        : DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_LOW_MMOL;
  const high =
    typeof highRaw === "number" && Number.isFinite(highRaw) && highRaw > 0
      ? highRaw
      : typeof highRaw === "string" && Number.isFinite(Number(highRaw)) && Number(highRaw) > 0
        ? Number(highRaw)
        : DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_HIGH_MMOL;
  if (high <= low) {
    return {
      low: DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_LOW_MMOL,
      high: DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_HIGH_MMOL,
    };
  }
  return { low, high };
}

/** Reading vs supporter extreme limits (always compared in mmol/L). */
export function computeSupporterLiveGlucoseAlertStatus(
  value: number,
  units: "mmol/L" | "mg/dL",
  alertLowMmol: number,
  alertHighMmol: number,
): SupporterLiveGlucoseAlertStatus {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(alertLowMmol) ||
    !Number.isFinite(alertHighMmol) ||
    alertHighMmol <= alertLowMmol
  ) {
    return "ok";
  }
  const mmol = bgToMmol(value, units);
  if (mmol < alertLowMmol) return "extreme_low";
  if (mmol > alertHighMmol) return "extreme_high";
  return "ok";
}

export function formatSupporterAlertLimitOption(mmol: number, units: "mmol/L" | "mg/dL"): string {
  const display = mmolToDisplayBg(mmol, units);
  const formatted = units === "mmol/L" ? display.toFixed(1) : String(display);
  const isDefaultLow = mmol === DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_LOW_MMOL;
  const isDefaultHigh = mmol === DEFAULT_SUPPORTER_LIVE_GLUCOSE_ALERT_HIGH_MMOL;
  if (isDefaultLow || isDefaultHigh) return `${formatted} (default)`;
  return formatted;
}
