/** Deep link to date of birth on Personal info & usage settings. */
export const SETTINGS_DATE_OF_BIRTH_HREF = "/settings/usage#settings-dob";

/** Carb ratios and related insulin settings. */
export const SETTINGS_RATIOS_HREF = "/settings/ratios";

/** Scroll the authenticated app main container (or window) to the top. */
export function scrollAppMainToTop(behavior: ScrollBehavior = "auto"): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById("app-scroll-main");
  if (el) {
    el.scrollTo({ top: 0, left: 0, behavior });
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior });
}

export function scrollToSettingsHashTarget(hashId: string, opts?: { focusInput?: boolean }): boolean {
  const el = document.getElementById(hashId);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (opts?.focusInput && el instanceof HTMLInputElement) {
    window.setTimeout(() => el.focus({ preventScroll: true }), 280);
  }
  return true;
}
