const KEY = "diabeater_last_interaction_v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type LastInteractionKind =
  | "coach"
  | "scenario:sick-day"
  | "scenario:pump-failure"
  | "scenario:alcohol"
  | "scenario:exercise"
  | "scenario:travel"
  | "ratios"
  | "community-draft";

export type LastInteractionRecord = {
  kind: LastInteractionKind;
  ref?: string;
  at: string;
};

export function recordLastInteraction(kind: LastInteractionKind, ref?: string): void {
  try {
    const rec: LastInteractionRecord = { kind, at: new Date().toISOString() };
    if (ref?.trim()) rec.ref = ref.trim().slice(0, 200);
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}

export function readLastInteraction(): LastInteractionRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.kind !== "string" || typeof o.at !== "string") return null;
    const atMs = new Date(o.at).getTime();
    if (Number.isNaN(atMs) || Date.now() - atMs > MAX_AGE_MS) return null;
    const ref = typeof o.ref === "string" ? o.ref : undefined;
    return { kind: o.kind as LastInteractionKind, ref, at: o.at };
  } catch {
    return null;
  }
}

export function clearLastInteraction(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
