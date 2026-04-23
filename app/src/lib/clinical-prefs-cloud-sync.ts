import { profileQueryKey, updateProfile, type ProfileRow, type ProfileUpdatePayload } from "@/lib/profile";
import { queryClient } from "@/lib/queryClient";
import { storage, DIABEATER_SETTINGS_CHANGED_EVENT, type UserProfile } from "@/lib/storage";

function normalizeDeliveryFromCloud(raw: unknown): "pen" | "pump" | null {
  if (raw === "pen" || raw === "pump") return raw;
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

  const cloudDelivery = normalizeDeliveryFromCloud(row.insulin_delivery_method);
  const cloudTdd = normalizeTddFromCloud(row.tdd);

  const localProfile = storage.getProfile();
  const localSettings = storage.getSettings();

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
}

/**
 * Push local insulin delivery method + TDD to Supabase `profiles` (signed-in patient).
 */
export async function syncClinicalPrefsToCloud(userId: string): Promise<{ error: Error | null }> {
  const p = storage.getProfile();
  const s = storage.getSettings();

  const insulin_delivery_method: "pen" | "pump" | undefined =
    p?.insulinDeliveryMethod === "pump" ? "pump" : p?.insulinDeliveryMethod === "pen" ? "pen" : undefined;
  const tdd = typeof s.tdd === "number" && s.tdd > 0 && Number.isFinite(s.tdd) ? s.tdd : null;

  if (insulin_delivery_method === undefined && tdd == null) {
    return { error: null };
  }

  const payload: ProfileUpdatePayload = { id: userId };
  if (insulin_delivery_method !== undefined) {
    payload.insulin_delivery_method = insulin_delivery_method;
  }
  if (tdd != null) {
    payload.tdd = tdd;
  }

  const { error } = await updateProfile(payload);
  if (!error) {
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
  }
  return { error };
}
