import {
  profileQueryKey,
  updateProfile,
  type PharmacyJson,
  type ProfileRow,
  type ProfileUpdatePayload,
} from "@/lib/profile";
import { queryClient } from "@/lib/queryClient";
import {
  DIABEATER_SETTINGS_CHANGED_EVENT,
  emptyPharmacyHours,
  PHARMACY_DAY_KEYS,
  isCommunityAccountProfile,
  storage,
  type Pharmacy,
  type PharmacyDayKey,
  type PharmacyHoursDay,
  type UserProfile,
} from "@/lib/storage";
import { isPenDeliveryMethod, isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { normalizeDateOfBirthInput } from "@/lib/user-age";
import { normalizeAppRegion } from "@/lib/region";
import { UK_DEFAULT_NEEDLES_PER_BOX, UK_DEFAULT_UNITS_PER_INSULIN_PEN } from "@/lib/storage";

/** PostgREST when a `profiles` column exists in repo migrations but not in the linked project (or schema cache is stale). */
export function isMissingProfileColumnSchemaError(message: string, column: string): boolean {
  const m = message.toLowerCase();
  const c = column.toLowerCase();
  return (
    m.includes(c) &&
    (m.includes("schema cache") || m.includes("could not find") || m.includes("column"))
  );
}

function normalizeDeliveryFromCloud(raw: unknown): "pen" | "pump" | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().toLowerCase();
  if (m === "pen" || m === "pump") return m;
  return null;
}

function normalizeTddFromCloud(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function pharmacyHoursDayFromCloud(raw: unknown): PharmacyHoursDay {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: PharmacyHoursDay = {};
  if (r.closed === true) out.closed = true;
  if (typeof r.open === "string") out.open = r.open;
  if (typeof r.close === "string") out.close = r.close;
  if (r.break && typeof r.break === "object") {
    const br = r.break as Record<string, unknown>;
    if (typeof br.start === "string" && typeof br.end === "string") {
      out.break = { start: br.start, end: br.end };
    }
  }
  return out;
}

function pharmacyFromCloud(raw: PharmacyJson | null | undefined): Pharmacy | null {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;
  const hours = emptyPharmacyHours();
  const inHours = (raw.hours ?? {}) as Record<string, unknown>;
  for (const key of PHARMACY_DAY_KEYS) {
    hours[key] = pharmacyHoursDayFromCloud(inHours[key]);
  }
  return {
    name,
    phone: typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : undefined,
    addressLine: typeof raw.addressLine === "string" && raw.addressLine.trim() ? raw.addressLine.trim() : undefined,
    notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : undefined,
    hours,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt.trim()
        ? raw.updatedAt
        : new Date(0).toISOString(),
  };
}

function pharmacyToCloud(p: Pharmacy): PharmacyJson {
  const hours: PharmacyJson["hours"] = {};
  for (const key of PHARMACY_DAY_KEYS) {
    const day = p.hours[key];
    if (!day) continue;
    const cloudDay: { open?: string; close?: string; closed?: boolean; break?: { start?: string; end?: string } } = {};
    if (day.closed) cloudDay.closed = true;
    if (day.open) cloudDay.open = day.open;
    if (day.close) cloudDay.close = day.close;
    if (day.break?.start && day.break?.end) {
      cloudDay.break = { start: day.break.start, end: day.break.end };
    }
    if (Object.keys(cloudDay).length > 0) {
      (hours as Record<PharmacyDayKey, unknown>)[key] = cloudDay;
    }
  }
  return {
    name: p.name,
    phone: p.phone,
    addressLine: p.addressLine,
    notes: p.notes,
    hours,
    updatedAt: p.updatedAt,
  };
}

function defaultProfileSkeleton(insulinDeliveryMethod: "pen" | "pump"): UserProfile {
  return {
    name: "",
    email: "",
    dateOfBirth: "",
    bgUnits: "mmol/L",
    carbUnits: "grams",
    diabetesType: "type1",
    insulinDeliveryMethod,
    usingInsulin: true,
    hasAcceptedDisclaimer: true,
  };
}

/**
 * Merge server-owned clinical prefs into local storage.
 * - Delivery method: if cloud has pen/pump, apply when it differs from local (multi-device).
 * - TDD: if cloud has a positive value, apply only when local TDD is missing (avoid overwriting in-progress edits).
 */
export function applyClinicalPrefsFromCloudRow(row: ProfileRow | null): void {
  if (!row?.id) return;

  if (row.account_type === "community") {
    const localProfile = storage.getProfile();
    storage.saveProfile({
      name: localProfile?.name ?? "",
      email: localProfile?.email ?? "",
      dateOfBirth: localProfile?.dateOfBirth ?? "",
      bgUnits: localProfile?.bgUnits ?? "mmol/L",
      carbUnits: localProfile?.carbUnits ?? "grams",
      diabetesType: "none",
      insulinDeliveryMethod: localProfile?.insulinDeliveryMethod ?? "pen",
      usingInsulin: false,
      hasAcceptedDisclaimer: localProfile?.hasAcceptedDisclaimer ?? true,
      ratioFormat: localProfile?.ratioFormat,
      carbPortionSize: localProfile?.carbPortionSize,
      accountType: "community",
    });
    return;
  }

  if (row.account_type === "patient") {
    const lp = storage.getProfile();
    if (lp?.accountType === "community") {
      storage.saveProfile({
        ...lp,
        accountType: "patient",
        usingInsulin: true,
        diabetesType: lp.diabetesType === "none" ? "type1" : lp.diabetesType,
      });
    }
  }

  const cloudDelivery = normalizeDeliveryFromCloud(row.insulin_delivery_method);
  const cloudTdd = normalizeTddFromCloud(row.tdd);
  const cloudDob = normalizeDateOfBirthInput(row.date_of_birth ?? null);

  const localProfile = storage.getProfile();
  const localSettings = storage.getSettings();

  if (cloudDob && (!localProfile?.dateOfBirth || !String(localProfile.dateOfBirth).trim())) {
    if (!localProfile) {
      storage.saveProfile({ ...defaultProfileSkeleton(cloudDelivery ?? "pen"), dateOfBirth: cloudDob });
    } else {
      storage.saveProfile({ ...localProfile, dateOfBirth: cloudDob });
    }
  }

  if (cloudDelivery != null) {
    if (!localProfile) {
      storage.saveProfile(defaultProfileSkeleton(cloudDelivery));
    } else if (localProfile.insulinDeliveryMethod !== cloudDelivery) {
      storage.saveProfile({ ...localProfile, insulinDeliveryMethod: cloudDelivery });
    }
  }

  let wroteSettings = false;
  if (cloudTdd != null && (!localSettings.tdd || localSettings.tdd <= 0)) {
    storage.saveSettings({ ...localSettings, tdd: cloudTdd });
    wroteSettings = true;
  }

  if (wroteSettings && typeof window !== "undefined") {
    window.dispatchEvent(new Event(DIABEATER_SETTINGS_CHANGED_EVENT));
  }

  if (row.pharmacy !== undefined) {
    const cloudPharmacy = pharmacyFromCloud(row.pharmacy);
    const localPharmacy = storage.getPharmacy();
    if (!cloudPharmacy && row.pharmacy === null && localPharmacy) {
      // Server explicitly cleared pharmacy elsewhere; mirror to this device.
      storage.savePharmacy(null);
    } else if (cloudPharmacy && (!localPharmacy || (cloudPharmacy.updatedAt > (localPharmacy.updatedAt ?? "")))) {
      storage.savePharmacy(cloudPharmacy);
    }
  }

  if (row.app_region === "UK" || row.app_region === "US" || row.app_region === "OTHER") {
    const lp = storage.getProfile();
    if (lp) {
      const region = normalizeAppRegion(row.app_region);
      const emergencyNumber =
        typeof row.emergency_number === "string" && row.emergency_number.trim()
          ? row.emergency_number.trim()
          : lp.emergencyNumber;
      if (lp.region !== region || lp.emergencyNumber !== emergencyNumber) {
        storage.saveProfile({ ...lp, region, emergencyNumber });
      }
    }
  }
}

export type ClinicalPrefsCloudSyncResult = {
  error: Error | null;
  /** Field was omitted on a later attempt because PostgREST reported the column missing from `profiles`. */
  dateOfBirthCloudSkipped?: boolean;
  insulinDeliveryMethodCloudSkipped?: boolean;
  tddCloudSkipped?: boolean;
  unitsPerInsulinPenCloudSkipped?: boolean;
  needlesPerBoxCloudSkipped?: boolean;
};

/** User-facing second line when some clinical prefs could not be written to Supabase. */
export function describePartialClinicalPrefsCloudSync(result: ClinicalPrefsCloudSyncResult): string | null {
  if (result.error) return null;
  const bits: string[] = [];
  if (result.dateOfBirthCloudSkipped) bits.push("date of birth");
  if (result.insulinDeliveryMethodCloudSkipped) bits.push("insulin delivery (pen/pump)");
  if (result.tddCloudSkipped) bits.push("TDD");
  if (bits.length === 0) return null;
  const listed =
    bits.length === 1
      ? bits[0]
      : bits.length === 2
        ? `${bits[0]} and ${bits[1]}`
        : `${bits.slice(0, -1).join(", ")}, and ${bits.at(-1)}`;
  const verb = bits.length === 1 ? "is" : "are";
  return `${listed} ${verb} on this device only until those columns exist on your Supabase project—run all migrations from the repo, then reload the API schema cache.`;
}

function buildClinicalPrefsPayload(
  userId: string,
  opts: {
    includeDelivery: boolean;
    includeTdd: boolean;
    includeDob: boolean;
    includeUnitsPerPen: boolean;
    includeNeedlesPerBox: boolean;
  },
  values: {
    insulin_delivery_method: "pen" | "pump" | undefined;
    tdd: number | null;
    dobNorm: string | null;
    unitsPerInsulinPen: number;
    needlesPerBox: number;
  },
): ProfileUpdatePayload {
  const payload: ProfileUpdatePayload = { id: userId };
  if (opts.includeDelivery && values.insulin_delivery_method !== undefined) {
    payload.insulin_delivery_method = values.insulin_delivery_method;
  }
  if (opts.includeTdd && values.tdd != null) {
    payload.tdd = values.tdd;
  }
  if (opts.includeDob && values.dobNorm != null) {
    payload.date_of_birth = values.dobNorm;
  }
  if (opts.includeUnitsPerPen) {
    payload.units_per_insulin_pen = values.unitsPerInsulinPen;
  }
  if (opts.includeNeedlesPerBox) {
    payload.needles_per_box = values.needlesPerBox;
  }
  return payload;
}

function payloadHasClinicalFields(payload: ProfileUpdatePayload): boolean {
  return (
    payload.insulin_delivery_method !== undefined ||
    payload.tdd !== undefined ||
    payload.date_of_birth !== undefined ||
    payload.units_per_insulin_pen !== undefined ||
    payload.needles_per_box !== undefined
  );
}

/**
 * Push local insulin delivery method + TDD (+ optional DOB) to Supabase `profiles` (signed-in patient).
 * Retries with fewer fields when PostgREST reports a column missing (migrations not applied or stale schema cache).
 */
export async function syncClinicalPrefsToCloud(userId: string): Promise<ClinicalPrefsCloudSyncResult> {
  const p = storage.getProfile();
  const s = storage.getSettings();

  const insulin_delivery_method: "pen" | "pump" | undefined = isPumpDeliveryMethod(p?.insulinDeliveryMethod)
    ? "pump"
    : isPenDeliveryMethod(p?.insulinDeliveryMethod)
      ? "pen"
      : undefined;
  const tdd = typeof s.tdd === "number" && s.tdd > 0 && Number.isFinite(s.tdd) ? s.tdd : null;
  const dobNorm = normalizeDateOfBirthInput(p?.dateOfBirth ?? null);
  const unitsPerInsulinPen = Math.max(
    1,
    s.unitsPerInsulinPen || s.insulinCartridgeUnits || UK_DEFAULT_UNITS_PER_INSULIN_PEN,
  );
  const needlesPerBox = Math.max(1, s.needlesPerBox || UK_DEFAULT_NEEDLES_PER_BOX);

  const values = { insulin_delivery_method, tdd, dobNorm, unitsPerInsulinPen, needlesPerBox };
  let includeDelivery = insulin_delivery_method !== undefined;
  let includeTdd = tdd != null;
  let includeDob = dobNorm != null;
  let includeUnitsPerPen = true;
  let includeNeedlesPerBox = true;

  const skipped = {
    dateOfBirth: false,
    insulinDeliveryMethod: false,
    tdd: false,
    unitsPerInsulinPen: false,
    needlesPerBox: false,
  };

  for (let attempt = 0; attempt < 7; attempt++) {
    const payload = buildClinicalPrefsPayload(
      userId,
      { includeDelivery, includeTdd, includeDob, includeUnitsPerPen, includeNeedlesPerBox },
      values,
    );
    if (!payloadHasClinicalFields(payload)) {
      await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
      return {
        error: null,
        dateOfBirthCloudSkipped: skipped.dateOfBirth,
        insulinDeliveryMethodCloudSkipped: skipped.insulinDeliveryMethod,
        tddCloudSkipped: skipped.tdd,
        unitsPerInsulinPenCloudSkipped: skipped.unitsPerInsulinPen,
        needlesPerBoxCloudSkipped: skipped.needlesPerBox,
      };
    }

    const { error } = await updateProfile(payload);
    if (!error) {
      await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
      return {
        error: null,
        dateOfBirthCloudSkipped: skipped.dateOfBirth,
        insulinDeliveryMethodCloudSkipped: skipped.insulinDeliveryMethod,
        tddCloudSkipped: skipped.tdd,
        unitsPerInsulinPenCloudSkipped: skipped.unitsPerInsulinPen,
        needlesPerBoxCloudSkipped: skipped.needlesPerBox,
      };
    }

    const msg = error.message;
    if (includeDob && isMissingProfileColumnSchemaError(msg, "date_of_birth")) {
      includeDob = false;
      skipped.dateOfBirth = true;
      continue;
    }
    if (includeDelivery && isMissingProfileColumnSchemaError(msg, "insulin_delivery_method")) {
      includeDelivery = false;
      skipped.insulinDeliveryMethod = true;
      continue;
    }
    if (includeTdd && isMissingProfileColumnSchemaError(msg, "tdd")) {
      includeTdd = false;
      skipped.tdd = true;
      continue;
    }
    if (includeUnitsPerPen && isMissingProfileColumnSchemaError(msg, "units_per_insulin_pen")) {
      includeUnitsPerPen = false;
      skipped.unitsPerInsulinPen = true;
      continue;
    }
    if (includeNeedlesPerBox && isMissingProfileColumnSchemaError(msg, "needles_per_box")) {
      includeNeedlesPerBox = false;
      skipped.needlesPerBox = true;
      continue;
    }

    return { error };
  }

  return { error: new Error("Clinical prefs sync: too many retries") };
}

/** Push region + optional emergency number override to `profiles`. Tolerates missing columns. */
export async function syncRegionToCloud(userId: string): Promise<{ error: Error | null; skipped?: boolean }> {
  const p = storage.getProfile();
  const region = p?.region;
  if (!region) return { error: null };
  const { error } = await updateProfile({
    id: userId,
    app_region: region,
    emergency_number: p.emergencyNumber?.trim() || null,
  });
  if (!error) {
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
    return { error: null };
  }
  if (
    isMissingProfileColumnSchemaError(error.message, "app_region") ||
    isMissingProfileColumnSchemaError(error.message, "emergency_number")
  ) {
    return { error: null, skipped: true };
  }
  return { error };
}

/**
 * Push the local primary pharmacy (or `null` to clear) to `profiles.pharmacy`.
 * If the column is missing on the linked Supabase project (migration not applied),
 * we treat this as a no-op so the local save still succeeds without raising an error.
 */
/** Push `profiles.account_type` from local profile (patient vs community). Tolerates missing column. */
export async function syncAccountTypeToCloud(userId: string): Promise<{ error: Error | null; skipped?: boolean }> {
  const p = storage.getProfile();
  const account_type: "patient" | "community" = isCommunityAccountProfile(p) ? "community" : "patient";
  const { error } = await updateProfile({ id: userId, account_type });
  if (!error) {
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
    return { error: null };
  }
  if (isMissingProfileColumnSchemaError(error.message, "account_type")) {
    return { error: null, skipped: true };
  }
  return { error };
}

export async function syncPharmacyToCloud(userId: string): Promise<{ error: Error | null; pharmacyCloudSkipped?: boolean }> {
  const local = storage.getPharmacy();
  const payload: ProfileUpdatePayload = {
    id: userId,
    pharmacy: local ? pharmacyToCloud(local) : null,
  };
  const { error } = await updateProfile(payload);
  if (!error) {
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
    return { error: null };
  }
  if (isMissingProfileColumnSchemaError(error.message, "pharmacy")) {
    return { error: null, pharmacyCloudSkipped: true };
  }
  return { error };
}
