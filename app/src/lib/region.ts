import type { UserProfile } from "@/lib/storage";

export type AppRegion = "UK" | "US" | "OTHER";

export type BgUnits = "mmol/L" | "mg/dL";
export type WeightDisplayUnit = "kg" | "lbs";

export type RegionDefaults = {
  bgUnits: BgUnits;
  weightDisplayUnit: WeightDisplayUnit;
  displayLocale: string;
  emergencyNumber: string;
  urgentCareHint: string;
  emergencyDepartment: string;
  gpLabel: string;
  repeatPrescriptionLabel: string;
  doctorLetterLabel: string;
  paracetamolLabel: string;
};

const UK_DEFAULTS: RegionDefaults = {
  bgUnits: "mmol/L",
  weightDisplayUnit: "kg",
  displayLocale: "en-GB",
  emergencyNumber: "999",
  urgentCareHint: "Call 999 for emergencies. For urgent non-emergency advice, consider NHS 111.",
  emergencyDepartment: "A&E",
  gpLabel: "GP surgery",
  repeatPrescriptionLabel: "repeat prescription",
  doctorLetterLabel: "GP letter",
  paracetamolLabel: "Paracetamol",
};

const US_DEFAULTS: RegionDefaults = {
  bgUnits: "mg/dL",
  weightDisplayUnit: "lbs",
  displayLocale: "en-US",
  emergencyNumber: "911",
  urgentCareHint:
    "Call 911 for emergencies. For urgent non-emergency care, contact your doctor or local urgent care.",
  emergencyDepartment: "ER",
  gpLabel: "Doctor's office (PCP)",
  repeatPrescriptionLabel: "prescription refill",
  doctorLetterLabel: "Doctor's letter",
  paracetamolLabel: "Acetaminophen",
};

export const APP_REGION_OPTIONS: { value: AppRegion; label: string; description: string }[] = [
  { value: "UK", label: "United Kingdom", description: "mmol/L, kg, 999" },
  { value: "US", label: "United States", description: "mg/dL, lbs, 911" },
  { value: "OTHER", label: "Other / international", description: "Choose your units" },
];

export function normalizeAppRegion(raw: unknown): AppRegion {
  if (raw === "UK" || raw === "US" || raw === "OTHER") return raw;
  return "UK";
}

export function regionDefaults(region: AppRegion): RegionDefaults {
  if (region === "US") return US_DEFAULTS;
  if (region === "OTHER") {
    return {
      ...UK_DEFAULTS,
      bgUnits: "mmol/L",
      weightDisplayUnit: "kg",
      displayLocale: typeof navigator !== "undefined" ? navigator.language || "en-GB" : "en-GB",
      emergencyNumber: "112",
      urgentCareHint: "Use your local emergency number for life-threatening situations.",
    };
  }
  return UK_DEFAULTS;
}

export function getProfileRegion(profile: UserProfile | null | undefined): AppRegion {
  return normalizeAppRegion(profile?.region);
}

export function getEffectiveEmergencyNumber(profile: UserProfile | null | undefined): string {
  const override = profile?.emergencyNumber?.trim();
  if (override) return override;
  return regionDefaults(getProfileRegion(profile)).emergencyNumber;
}

export function getRegionDefaultsForProfile(profile: UserProfile | null | undefined): RegionDefaults {
  const base = regionDefaults(getProfileRegion(profile));
  const override = profile?.emergencyNumber?.trim();
  if (override) return { ...base, emergencyNumber: override };
  return base;
}

export function getDisplayLocale(profile: UserProfile | null | undefined): string {
  return getRegionDefaultsForProfile(profile).displayLocale;
}

export function formatAppDate(
  value: Date | string | number,
  profile: UserProfile | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(getDisplayLocale(profile), options);
}

export function formatAppTime(
  value: Date | string | number,
  profile: UserProfile | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(getDisplayLocale(profile), options);
}

export function formatAppDateTime(
  value: Date | string | number,
  profile: UserProfile | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(getDisplayLocale(profile), options);
}

export function getKetoneEmergencyCopy(region: AppRegion): {
  moderateWithHighBg: string;
  moderateWithHighBgBrief: string;
  large: string;
  largeBrief: string;
  footer: string;
} {
  const d = regionDefaults(region);
  const er = d.emergencyDepartment;
  const num = d.emergencyNumber;
  if (region === "US") {
    return {
      moderateWithHighBg: `EMERGENCY: Moderate ketones with high glucose or severe illness. Go to the ${er} or call ${num} if you cannot reach your diabetes team.`,
      moderateWithHighBgBrief: `Emergency: go to the ${er} or call ${num} if you cannot reach your team.`,
      large: `EMERGENCY: Large ketones detected. Go to the ${er} immediately or call ${num}. This is a medical emergency.`,
      largeBrief: `Go to the ${er} or call ${num} now.`,
      footer: `US Emergency: ${num} · For non-emergency advice, contact your doctor or diabetes team.`,
    };
  }
  if (region === "OTHER") {
    return {
      moderateWithHighBg: `EMERGENCY: Moderate ketones with high glucose or severe illness. Seek emergency care (${num}) if you cannot reach your diabetes team.`,
      moderateWithHighBgBrief: `Emergency: seek urgent care or call ${num} if you cannot reach your team.`,
      large: `EMERGENCY: Large ketones detected. Seek emergency medical care immediately (${num}).`,
      largeBrief: `Seek emergency care or call ${num} now.`,
      footer: `Emergency: ${num} · Contact your local diabetes team for urgent advice.`,
    };
  }
  return {
    moderateWithHighBg: `EMERGENCY: Moderate ketones with high glucose or severe illness. Go to ${er} or call ${num} if you cannot reach your diabetes team.`,
    moderateWithHighBgBrief: `Emergency: go to ${er} or call ${num} if you cannot reach your team.`,
    large: `EMERGENCY: Large ketones detected. Go to ${er} immediately or call ${num}. This is a medical emergency.`,
    largeBrief: `Go to ${er} or call ${num} now.`,
    footer: `UK Emergency: ${num} · NHS 111 for non-emergency advice`,
  };
}

/** Exercise tip threshold in user's BG units. */
export function exercisePreWorkoutBgTip(bgUnits: BgUnits): string {
  if (bgUnits === "mg/dL") {
    return "Check your blood sugar before exercise — starting below 126 mg/dL may mean you need a snack first.";
  }
  return "Check your blood sugar before exercise — starting below 7 mmol/L may mean you need a snack first.";
}

export function getTipDisplayText(text: string, bgUnits: BgUnits): string {
  if (text.includes("below 7 mmol/L")) {
    return exercisePreWorkoutBgTip(bgUnits);
  }
  return text;
}

export function applyRegionUnitDefaults(
  region: AppRegion,
  current?: { bgUnits?: string; weightDisplayUnit?: WeightDisplayUnit },
): { bgUnits: BgUnits; weightDisplayUnit: WeightDisplayUnit } {
  const d = regionDefaults(region);
  return {
    bgUnits: (current?.bgUnits === "mg/dL" || current?.bgUnits === "mmol/L"
      ? current.bgUnits
      : d.bgUnits) as BgUnits,
    weightDisplayUnit:
      current?.weightDisplayUnit === "kg" || current?.weightDisplayUnit === "lbs"
        ? current.weightDisplayUnit
        : d.weightDisplayUnit,
  };
}

export function insulinBrandExamples(region: AppRegion): { rapid: string; long: string } {
  if (region === "US") {
    return { rapid: "Humalog, Novolog", long: "Lantus, Tresiba" };
  }
  return { rapid: "NovoRapid, Humalog", long: "Levemir, Lantus" };
}
