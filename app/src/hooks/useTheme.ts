export const THEME_STORAGE_KEY = "diabeaters_theme";

/** Preferred storage key for accent colour (App Store / settings spec). */
export const THEME_COLOR_STORAGE_KEY = "diabeaters_theme_color";

/** Opt-in soft page background tint derived from primary theme. */
export const BACKGROUND_TINT_STORAGE_KEY = "diabeaters_bg_tint";

const LIGHT_BG_BASE = "247 248 250";
const DARK_BG_BASE = "18 18 18";

/** Mix space-separated RGB triples: `result = t * a + (1-t) * b`. */
function mixRgbTriples(a: string, b: string, t: number): string {
  const pa = a.split(/\s+/).map(Number);
  const pb = b.split(/\s+/).map(Number);
  const r = Math.round(pa[0]! * t + pb[0]! * (1 - t));
  const g = Math.round(pa[1]! * t + pb[1]! * (1 - t));
  const bl = Math.round(pa[2]! * t + pb[2]! * (1 - t));
  return `${r} ${g} ${bl}`;
}

export type AppPrimaryTheme =
  | "blue"
  | "purple"
  | "teal"
  | "green"
  | "rose"
  | "amber"
  | "orange"
  | "indigo";

type PrimaryPack = {
  colorPrimary: string;
  colorPrimaryForeground: string;
  colorPrimaryLight: string;
  colorPrimaryDark: string;
  colorPrimaryBorder: string;
  ring: string;
  sidebarPrimary: string;
  sidebarRing: string;
};

const LIGHT: Record<AppPrimaryTheme, PrimaryPack> = {
  blue: {
    colorPrimary: "59 130 246",
    colorPrimaryForeground: "255 255 255",
    colorPrimaryLight: "239 246 255",
    colorPrimaryDark: "29 78 216",
    colorPrimaryBorder: "37 99 235",
    ring: "221 83% 53%",
    sidebarPrimary: "221 83% 53%",
    sidebarRing: "221 83% 53%",
  },
  purple: {
    colorPrimary: "147 51 234",
    colorPrimaryForeground: "255 255 255",
    colorPrimaryLight: "243 232 255",
    colorPrimaryDark: "107 33 168",
    colorPrimaryBorder: "126 34 206",
    ring: "262 83% 58%",
    sidebarPrimary: "262 83% 58%",
    sidebarRing: "262 83% 58%",
  },
  teal: {
    colorPrimary: "20 184 166",
    colorPrimaryForeground: "255 255 255",
    colorPrimaryLight: "204 251 241",
    colorPrimaryDark: "15 118 110",
    colorPrimaryBorder: "13 148 136",
    ring: "173 80% 40%",
    sidebarPrimary: "173 80% 36%",
    sidebarRing: "173 80% 40%",
  },
  green: {
    colorPrimary: "34 197 94",
    colorPrimaryForeground: "255 255 255",
    colorPrimaryLight: "220 252 231",
    colorPrimaryDark: "21 128 61",
    colorPrimaryBorder: "22 163 74",
    ring: "142 71% 45%",
    sidebarPrimary: "142 71% 40%",
    sidebarRing: "142 71% 45%",
  },
  rose: {
    colorPrimary: "244 63 94",
    colorPrimaryForeground: "255 255 255",
    colorPrimaryLight: "255 228 230",
    colorPrimaryDark: "190 18 60",
    colorPrimaryBorder: "225 29 72",
    ring: "346 77% 50%",
    sidebarPrimary: "346 77% 48%",
    sidebarRing: "346 77% 50%",
  },
  amber: {
    colorPrimary: "245 158 11",
    colorPrimaryForeground: "255 255 255",
    colorPrimaryLight: "255 251 235",
    colorPrimaryDark: "180 83 9",
    colorPrimaryBorder: "217 119 6",
    ring: "38 92% 50%",
    sidebarPrimary: "38 92% 45%",
    sidebarRing: "38 92% 50%",
  },
  orange: {
    colorPrimary: "249 115 22",
    colorPrimaryForeground: "255 255 255",
    colorPrimaryLight: "255 247 237",
    colorPrimaryDark: "194 65 12",
    colorPrimaryBorder: "234 88 12",
    ring: "25 95% 53%",
    sidebarPrimary: "25 95% 48%",
    sidebarRing: "25 95% 53%",
  },
  indigo: {
    colorPrimary: "99 102 241",
    colorPrimaryForeground: "255 255 255",
    colorPrimaryLight: "238 242 255",
    colorPrimaryDark: "67 56 202",
    colorPrimaryBorder: "79 70 229",
    ring: "239 84% 67%",
    sidebarPrimary: "239 84% 62%",
    sidebarRing: "239 84% 67%",
  },
};

const DARK: Record<AppPrimaryTheme, PrimaryPack> = {
  blue: {
    colorPrimary: "96 165 250",
    colorPrimaryForeground: "15 23 42",
    colorPrimaryLight: "30 64 175",
    colorPrimaryDark: "191 219 254",
    colorPrimaryBorder: "59 130 246",
    ring: "217 91% 60%",
    sidebarPrimary: "217 91% 60%",
    sidebarRing: "217 91% 60%",
  },
  purple: {
    colorPrimary: "192 132 252",
    colorPrimaryForeground: "15 23 42",
    colorPrimaryLight: "88 28 135",
    colorPrimaryDark: "233 213 255",
    colorPrimaryBorder: "168 85 247",
    ring: "270 95% 75%",
    sidebarPrimary: "270 95% 75%",
    sidebarRing: "270 95% 75%",
  },
  teal: {
    colorPrimary: "45 212 191",
    colorPrimaryForeground: "15 23 42",
    colorPrimaryLight: "17 94 89",
    colorPrimaryDark: "153 246 228",
    colorPrimaryBorder: "20 184 166",
    ring: "172 66% 55%",
    sidebarPrimary: "172 66% 55%",
    sidebarRing: "172 66% 55%",
  },
  green: {
    colorPrimary: "74 222 128",
    colorPrimaryForeground: "15 23 42",
    colorPrimaryLight: "20 83 45",
    colorPrimaryDark: "187 247 208",
    colorPrimaryBorder: "34 197 94",
    ring: "142 70% 55%",
    sidebarPrimary: "142 70% 55%",
    sidebarRing: "142 70% 55%",
  },
  rose: {
    colorPrimary: "251 113 133",
    colorPrimaryForeground: "15 23 42",
    colorPrimaryLight: "136 19 55",
    colorPrimaryDark: "255 205 210",
    colorPrimaryBorder: "244 63 94",
    ring: "350 89% 72%",
    sidebarPrimary: "350 89% 72%",
    sidebarRing: "350 89% 72%",
  },
  amber: {
    colorPrimary: "251 191 36",
    colorPrimaryForeground: "15 23 42",
    colorPrimaryLight: "120 53 15",
    colorPrimaryDark: "254 243 199",
    colorPrimaryBorder: "245 158 11",
    ring: "38 92% 60%",
    sidebarPrimary: "38 92% 58%",
    sidebarRing: "38 92% 60%",
  },
  orange: {
    colorPrimary: "251 146 60",
    colorPrimaryForeground: "15 23 42",
    colorPrimaryLight: "124 45 18",
    colorPrimaryDark: "255 237 213",
    colorPrimaryBorder: "249 115 22",
    ring: "25 95% 65%",
    sidebarPrimary: "25 95% 62%",
    sidebarRing: "25 95% 65%",
  },
  indigo: {
    colorPrimary: "129 140 248",
    colorPrimaryForeground: "15 23 42",
    colorPrimaryLight: "49 46 129",
    colorPrimaryDark: "224 231 255",
    colorPrimaryBorder: "99 102 241",
    ring: "239 84% 72%",
    sidebarPrimary: "239 84% 70%",
    sidebarRing: "239 84% 72%",
  },
};

export const PRIMARY_THEMES: readonly {
  id: AppPrimaryTheme;
  label: string;
  swatch: string;
}[] = [
  { id: "blue", label: "Blue", swatch: "rgb(59, 130, 246)" },
  { id: "purple", label: "Purple", swatch: "rgb(147, 51, 234)" },
  { id: "teal", label: "Teal", swatch: "rgb(20, 184, 166)" },
  { id: "green", label: "Green", swatch: "rgb(34, 197, 94)" },
  { id: "rose", label: "Rose", swatch: "rgb(244, 63, 94)" },
  { id: "amber", label: "Amber", swatch: "rgb(245, 158, 11)" },
  { id: "orange", label: "Orange", swatch: "rgb(249, 115, 22)" },
  { id: "indigo", label: "Indigo", swatch: "rgb(99, 102, 241)" },
] as const;

const LEGACY_MAP: Record<string, AppPrimaryTheme> = {
  "ocean-blue": "blue",
  "forest-green": "green",
  lavender: "purple",
  rose: "rose",
  slate: "blue",
  "warm-beige": "blue",
};

function isAppPrimaryTheme(s: string): s is AppPrimaryTheme {
  return (
    s === "blue" ||
    s === "purple" ||
    s === "teal" ||
    s === "green" ||
    s === "rose" ||
    s === "amber" ||
    s === "orange" ||
    s === "indigo"
  );
}

/** One-time migration from diabeater_colour_theme → theme keys; sync legacy `diabeaters_theme` → `diabeaters_theme_color`. */
export function migrateLegacyColourTheme(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(THEME_STORAGE_KEY)) {
    const old = localStorage.getItem("diabeater_colour_theme");
    if (old && LEGACY_MAP[old]) {
      const id = LEGACY_MAP[old]!;
      localStorage.setItem(THEME_STORAGE_KEY, id);
      localStorage.setItem(THEME_COLOR_STORAGE_KEY, id);
    }
  }
  localStorage.removeItem("diabeater_colour_theme");

  const legacy = localStorage.getItem(THEME_STORAGE_KEY);
  if (legacy && isAppPrimaryTheme(legacy) && !localStorage.getItem(THEME_COLOR_STORAGE_KEY)) {
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, legacy);
  }
}

export function getStoredPrimaryTheme(): AppPrimaryTheme {
  if (typeof window === "undefined") return "blue";
  const raw =
    localStorage.getItem(THEME_COLOR_STORAGE_KEY) ?? localStorage.getItem(THEME_STORAGE_KEY);
  if (raw && isAppPrimaryTheme(raw)) return raw;
  return "blue";
}

export function getStoredBackgroundTint(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BACKGROUND_TINT_STORAGE_KEY) === "1";
}

export function persistBackgroundTint(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) {
    localStorage.setItem(BACKGROUND_TINT_STORAGE_KEY, "1");
  } else {
    localStorage.removeItem(BACKGROUND_TINT_STORAGE_KEY);
  }
}

export function applyPrimaryThemeToDocument(id: AppPrimaryTheme, mode: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const pack = mode === "dark" ? DARK[id] : LIGHT[id];
  const root = document.documentElement;
  root.style.setProperty("--color-primary", pack.colorPrimary);
  root.style.setProperty("--color-primary-foreground", pack.colorPrimaryForeground);
  root.style.setProperty("--color-primary-light", pack.colorPrimaryLight);
  root.style.setProperty("--color-primary-dark", pack.colorPrimaryDark);
  root.style.setProperty("--color-primary-border", pack.colorPrimaryBorder);
  root.style.setProperty("--ring", pack.ring);
  root.style.setProperty("--sidebar-primary", pack.sidebarPrimary);
  root.style.setProperty("--sidebar-ring", pack.sidebarRing);
}

/**
 * When enabled, sets `--app-background` to a subtle blend of `--color-primary-light` and the
 * default page base (must stay as space-separated `R G B` for Tailwind `rgb(var(...) / α)`).
 */
export function applyBackgroundTintToDocument(
  enabled: boolean,
  mode: "light" | "dark",
  primary: AppPrimaryTheme,
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // User preference: keep tint for light mode only.
  if (mode === "dark") {
    root.style.removeProperty("--app-background");
    return;
  }
  if (!enabled) {
    root.style.removeProperty("--app-background");
    return;
  }
  const pack = LIGHT[primary];
  const base = LIGHT_BG_BASE;
  const blended = mixRgbTriples(pack.colorPrimaryLight, base, 0.28);
  root.style.setProperty("--app-background", blended);
}

/**
 * Imperative API: persist + apply immediately (live update without reload).
 * When using React, also update ThemeProvider state via setPrimaryTheme.
 */
export function setTheme(id: AppPrimaryTheme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_COLOR_STORAGE_KEY, id);
  localStorage.setItem(THEME_STORAGE_KEY, id);
  const mode = document.documentElement.classList.contains("dark") ? "dark" : "light";
  applyPrimaryThemeToDocument(id, mode);
  applyBackgroundTintToDocument(getStoredBackgroundTint(), mode, id);
}
