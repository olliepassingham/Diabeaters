/** Quiet supporter-home cards the supporter can hide. Urgent cards are not in this list. */

export const SUPPORTER_QUIET_CARD_IDS = [
  "supplies",
  "situations",
  "activity",
  "appointments",
  "clinical",
] as const;

export type SupporterQuietCardId = (typeof SUPPORTER_QUIET_CARD_IDS)[number];

export type SupporterHomeCardPrefs = {
  hidden: SupporterQuietCardId[];
  /** Upcoming appointment keys present when Appointments was hidden. */
  appointmentKeys: string[];
};

const STORAGE_PREFIX = "diabeater_supporter_home_cards:";

export function emptySupporterHomeCardPrefs(): SupporterHomeCardPrefs {
  return { hidden: [], appointmentKeys: [] };
}

export function supporterAppointmentKey(row: { id?: unknown; client_id?: unknown }): string | null {
  const client = row.client_id != null ? String(row.client_id).trim() : "";
  if (client) return client;
  const id = row.id != null ? String(row.id).trim() : "";
  if (id) return id;
  return null;
}

function isQuietCardId(value: unknown): value is SupporterQuietCardId {
  return typeof value === "string" && (SUPPORTER_QUIET_CARD_IDS as readonly string[]).includes(value);
}

export function parseSupporterHomeCardPrefs(raw: unknown): SupporterHomeCardPrefs {
  if (!raw || typeof raw !== "object") return emptySupporterHomeCardPrefs();
  const o = raw as { hidden?: unknown; appointmentKeys?: unknown };
  const hidden = Array.isArray(o.hidden)
    ? o.hidden.filter(isQuietCardId).filter((id, i, all) => all.indexOf(id) === i)
    : [];
  const appointmentKeys = Array.isArray(o.appointmentKeys)
    ? o.appointmentKeys.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    : [];
  return { hidden, appointmentKeys };
}

export function appointmentsShouldResurface(
  savedKeys: readonly string[],
  upcomingKeys: readonly string[],
): boolean {
  if (upcomingKeys.length === 0) return false;
  const known = new Set(savedKeys);
  return upcomingKeys.some((key) => !known.has(key));
}

export function quietCardVisible(
  prefs: SupporterHomeCardPrefs,
  id: SupporterQuietCardId,
  opts?: { forceVisible?: boolean; upcomingAppointmentKeys?: readonly string[] },
): boolean {
  if (opts?.forceVisible) return true;
  if (!prefs.hidden.includes(id)) return true;
  if (id === "appointments") {
    return appointmentsShouldResurface(prefs.appointmentKeys, opts?.upcomingAppointmentKeys ?? []);
  }
  return false;
}

export function setSupporterCardShown(
  prefs: SupporterHomeCardPrefs,
  id: SupporterQuietCardId,
  shown: boolean,
  upcomingAppointmentKeys: readonly string[],
): SupporterHomeCardPrefs {
  const hidden = prefs.hidden.filter((cardId) => cardId !== id);
  if (shown) {
    return {
      hidden,
      appointmentKeys: id === "appointments" ? [] : prefs.appointmentKeys,
    };
  }
  return {
    hidden: [...hidden, id],
    appointmentKeys: id === "appointments" ? [...upcomingAppointmentKeys] : prefs.appointmentKeys,
  };
}

/** Drop the appointments hide when a new upcoming visit appears. */
export function revealAppointmentsIfNeeded(
  prefs: SupporterHomeCardPrefs,
  upcomingKeys: readonly string[],
): SupporterHomeCardPrefs {
  if (!prefs.hidden.includes("appointments")) return prefs;
  if (!appointmentsShouldResurface(prefs.appointmentKeys, upcomingKeys)) return prefs;
  return setSupporterCardShown(prefs, "appointments", true, upcomingKeys);
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadSupporterHomeCardPrefs(userId: string, patientId: string): SupporterHomeCardPrefs {
  if (typeof window === "undefined" || !userId || !patientId) return emptySupporterHomeCardPrefs();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptySupporterHomeCardPrefs();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parseSupporterHomeCardPrefs(parsed?.[patientId]);
  } catch {
    return emptySupporterHomeCardPrefs();
  }
}

export function saveSupporterHomeCardPrefs(
  userId: string,
  patientId: string,
  prefs: SupporterHomeCardPrefs,
): void {
  if (typeof window === "undefined" || !userId || !patientId) return;
  try {
    const key = storageKey(userId);
    const existing = localStorage.getItem(key);
    const all = existing ? (JSON.parse(existing) as Record<string, unknown>) : {};
    all[patientId] = prefs;
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    /* ignore quota / private mode */
  }
}
