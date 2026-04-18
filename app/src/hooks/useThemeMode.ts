export const THEME_MODE_STORAGE_KEY = "diabeaters_theme_mode";

/** Light, dark, or Auto (time-based schedule). */
export type ThemeMode = "light" | "dark" | "system";

/** When no preference is stored (first launch), use dark appearance. */
export const DEFAULT_THEME_MODE: ThemeMode = "dark";

export function isThemeMode(s: string | null): s is ThemeMode {
  return s === "light" || s === "dark" || s === "system";
}

/** Migrate legacy `theme` localStorage → `diabeaters_theme_mode`. */
export function migrateLegacyThemeModeKey(): void {
  if (typeof window === "undefined") return;

  if (!localStorage.getItem(THEME_MODE_STORAGE_KEY)) {
    const legacy = localStorage.getItem("theme");
    if (legacy === "light" || legacy === "dark" || legacy === "system") {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, legacy);
    }
  }
  localStorage.removeItem("theme");
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME_MODE;
  const raw = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return DEFAULT_THEME_MODE;
}

export const AUTO_LIGHT_START_HOUR = 7; // 07:00 inclusive
export const AUTO_DARK_START_HOUR = 19; // 19:00 inclusive

/** Time-based Auto: dark from 19:00–07:00, light otherwise (local timezone). */
export function getTimePrefersDark(date: Date = new Date()): boolean {
  const h = date.getHours(); // local timezone
  return h >= AUTO_DARK_START_HOUR || h < AUTO_LIGHT_START_HOUR;
}

export function getEffectiveAppearance(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getTimePrefersDark() ? "dark" : "light";
  return mode;
}

/** Applies `light` / `dark` class on `<html>` for Tailwind `darkMode: class`. */
export function applyRootAppearanceClass(effective: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(effective);
}

export function setMode(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  applyRootAppearanceClass(getEffectiveAppearance(mode));
}

export function loadMode(): ThemeMode {
  return getStoredThemeMode();
}
