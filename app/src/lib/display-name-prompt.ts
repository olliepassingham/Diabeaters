const SNOOZE_PREFIX = "diabeater_display_name_prompt_snooze_until_v1:";
/** How long “Not now” waits before asking again. */
export const DISPLAY_NAME_PROMPT_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

function snoozeKey(userId: string): string {
  return `${SNOOZE_PREFIX}${userId}`;
}

export function isDisplayNamePromptSnoozed(userId: string): boolean {
  try {
    const raw = localStorage.getItem(snoozeKey(userId));
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function snoozeDisplayNamePrompt(userId: string, ms = DISPLAY_NAME_PROMPT_SNOOZE_MS): void {
  try {
    localStorage.setItem(snoozeKey(userId), String(Date.now() + ms));
  } catch {
    /* private mode */
  }
}

export function clearDisplayNamePromptSnooze(userId: string): void {
  try {
    localStorage.removeItem(snoozeKey(userId));
  } catch {
    /* ignore */
  }
}
