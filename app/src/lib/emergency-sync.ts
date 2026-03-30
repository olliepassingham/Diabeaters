/**
 * Single source of truth for emergency contact / medical handover information.
 *
 * - Persisted in localStorage (`diabeater_emergency_profile_v1`) for offline use and instant reads.
 * - When Supabase is configured and the user is signed in, the same data is mirrored to `profiles`:
 *   emergency_contact_name, emergency_contact_phone, emergency_notes (structured multi-line blob).
 * - Legacy `diabeater_emergency_contacts` (multiple local contacts) is migrated once into this model.
 */

import { storage } from "@/lib/storage";
import type { ProfileRow } from "@/lib/profile";

export const EMERGENCY_PROFILE_STORAGE_KEY = "diabeater_emergency_profile_v1";

/** Canonical emergency handover record used across Account, Settings, Help now, and Emergency card. */
export type EmergencyProfileData = {
  contactName: string;
  relation: string;
  phone: string;
  phoneSecondary: string;
  medicalInstructions: string;
  notes: string;
  /** Last local write (ms); used for simple conflict hints only. */
  updatedAt: number;
};

export const EMPTY_EMERGENCY_PROFILE: EmergencyProfileData = {
  contactName: "",
  relation: "",
  phone: "",
  phoneSecondary: "",
  medicalInstructions: "",
  notes: "",
  updatedAt: 0,
};

const NOTE_REL = /^Relationship:\s*(.+)$/im;
const NOTE_MED = /^Medical instructions:\s*(.+)$/im;
const NOTE_OTHER = /^Notes:\s*([\s\S]+)$/im;

/** Builds the `emergency_notes` column from structured fields (human-readable for carers). */
export function buildEmergencyNotesBlob(d: EmergencyProfileData): string {
  const parts: string[] = [];
  const rel = d.relation.trim();
  const med = d.medicalInstructions.trim();
  const note = d.notes.trim();
  if (rel) parts.push(`Relationship: ${rel}`);
  if (med) parts.push(`Medical instructions: ${med}`);
  if (note) parts.push(`Notes: ${note}`);
  return parts.join("\n\n");
}

/** Parses our structured blob back into fields (best-effort; free-text falls into `notes`). */
export function parseEmergencyNotesBlob(raw: string | null | undefined): Pick<
  EmergencyProfileData,
  "relation" | "medicalInstructions" | "notes"
> {
  if (!raw?.trim()) {
    return { relation: "", medicalInstructions: "", notes: "" };
  }
  const relM = raw.match(NOTE_REL);
  const medM = raw.match(NOTE_MED);
  const noteM = raw.match(NOTE_OTHER);
  if (relM || medM || noteM) {
    return {
      relation: relM?.[1]?.trim() ?? "",
      medicalInstructions: medM?.[1]?.trim() ?? "",
      notes: noteM?.[1]?.trim() ?? "",
    };
  }
  return { relation: "", medicalInstructions: "", notes: raw.trim() };
}

function parseStored(json: string | null): EmergencyProfileData | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json) as Partial<EmergencyProfileData>;
    if (typeof o !== "object" || o === null) return null;
    return {
      contactName: typeof o.contactName === "string" ? o.contactName : "",
      relation: typeof o.relation === "string" ? o.relation : "",
      phone: typeof o.phone === "string" ? o.phone : "",
      phoneSecondary: typeof o.phoneSecondary === "string" ? o.phoneSecondary : "",
      medicalInstructions: typeof o.medicalInstructions === "string" ? o.medicalInstructions : "",
      notes: typeof o.notes === "string" ? o.notes : "",
      updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/** One-time migration from legacy multi-contact local list → single primary profile. */
function migrateFromLegacyContacts(): EmergencyProfileData | null {
  try {
    const contacts = storage.getEmergencyContacts();
    const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
    if (!primary) return null;
    return {
      ...EMPTY_EMERGENCY_PROFILE,
      contactName: primary.name ?? "",
      phone: primary.phone ?? "",
      relation: primary.relationship ?? "",
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/** Read from localStorage, migrating legacy contacts if the new key is empty. */
export function readLocalEmergencyProfile(): EmergencyProfileData {
  if (typeof window === "undefined") return { ...EMPTY_EMERGENCY_PROFILE };
  const raw = localStorage.getItem(EMERGENCY_PROFILE_STORAGE_KEY);
  let data = parseStored(raw);
  if (!data || isProfileEmpty(data)) {
    const migrated = migrateFromLegacyContacts();
    if (migrated && (!data || isProfileEmpty(data))) {
      data = migrated;
      writeLocalEmergencyProfile(data);
    }
  }
  return data ?? { ...EMPTY_EMERGENCY_PROFILE };
}

function isProfileEmpty(d: EmergencyProfileData): boolean {
  return (
    !d.contactName.trim() &&
    !d.phone.trim() &&
    !d.relation.trim() &&
    !d.phoneSecondary.trim() &&
    !d.medicalInstructions.trim() &&
    !d.notes.trim()
  );
}

export function writeLocalEmergencyProfile(data: EmergencyProfileData): void {
  if (typeof window === "undefined") return;
  const payload: EmergencyProfileData = {
    ...data,
    updatedAt: Date.now(),
  };
  localStorage.setItem(EMERGENCY_PROFILE_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Merge Supabase profile emergency columns into local shape.
 * Cloud non-empty fields win over local on first hydration after login.
 */
export function mergeProfileRowIntoLocal(
  profile: ProfileRow,
  local: EmergencyProfileData,
): { merged: EmergencyProfileData; prefilledKeys: Set<string> } {
  const parsed = parseEmergencyNotesBlob(profile.emergency_notes);
  const prefilled = new Set<string>();

  const name = profile.emergency_contact_name?.trim();
  const phone = profile.emergency_contact_phone?.trim();

  const merged: EmergencyProfileData = { ...local };

  if (name) {
    merged.contactName = name;
    prefilled.add("contactName");
  }
  if (phone) {
    merged.phone = phone;
    prefilled.add("phone");
  }
  if (parsed.relation) {
    merged.relation = parsed.relation;
    prefilled.add("relation");
  }
  if (parsed.medicalInstructions) {
    merged.medicalInstructions = parsed.medicalInstructions;
    prefilled.add("medicalInstructions");
  }
  if (parsed.notes) {
    merged.notes = parsed.notes;
    prefilled.add("notes");
  }

  merged.updatedAt = Date.now();
  return { merged, prefilledKeys: prefilled };
}

/** Maps unified profile → legacy shape for UI that still expects { name, phone, relationship }. */
export function toLegacyPrimaryContact(d: EmergencyProfileData): {
  name: string;
  phone: string;
  relationship?: string;
} | null {
  if (!d.contactName.trim() && !d.phone.trim()) return null;
  return {
    name: d.contactName.trim() || "Contact",
    phone: d.phone.trim(),
    relationship: d.relation.trim() || undefined,
  };
}

/** Expose storage key for cross-tab `storage` events. */
export function getEmergencyProfileStorageKey(): string {
  return EMERGENCY_PROFILE_STORAGE_KEY;
}
