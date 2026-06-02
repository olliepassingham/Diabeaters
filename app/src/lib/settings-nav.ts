/** Deep link to date of birth on Personal info & usage settings. */
export const SETTINGS_DATE_OF_BIRTH_HREF = "/settings/usage#settings-dob";

export function scrollToSettingsHashTarget(hashId: string, opts?: { focusInput?: boolean }): boolean {
  const el = document.getElementById(hashId);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (opts?.focusInput && el instanceof HTMLInputElement) {
    window.setTimeout(() => el.focus({ preventScroll: true }), 280);
  }
  return true;
}
