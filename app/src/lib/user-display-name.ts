/**
 * Resolve a human display name — never surface raw emails in emergency / Help now UI.
 */
import { storage } from "@/lib/storage";

export function isEmailLike(value: string | null | undefined): boolean {
  const t = value?.trim() ?? "";
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export type UserDisplayNameInput = {
  cloudFullName?: string | null;
  localName?: string | null;
};

/** Best label for Help now, emergency card, account hero, etc. */
export function resolveUserDisplayName(input: UserDisplayNameInput): string {
  const candidates = [input.cloudFullName?.trim(), input.localName?.trim()].filter(Boolean) as string[];
  for (const value of candidates) {
    if (!isEmailLike(value)) return value;
  }
  return "";
}

/** Write a validated display name into local profile storage. */
export function applyDisplayNameToLocalProfile(name: string): void {
  const trimmed = name.trim();
  if (!trimmed || isEmailLike(trimmed)) return;
  const local = storage.getProfile();
  if (!local) return;
  if (local.name?.trim() === trimmed) return;
  storage.saveProfile({ ...local, name: trimmed });
}
