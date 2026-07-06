import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyBackgroundTintToDocument,
  applyPrimaryThemeToDocument,
  getStoredBackgroundTint,
  getStoredPrimaryTheme,
  migrateLegacyColourTheme,
  persistBackgroundTint,
  type AppPrimaryTheme,
  THEME_COLOR_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "@/hooks/useTheme";
import {
  applyRootAppearanceClass,
  DEFAULT_THEME_MODE,
  getStoredThemeMode,
  getTimePrefersDark,
  migrateLegacyThemeModeKey,
  setMode as persistThemeMode,
  type ThemeMode,
} from "@/hooks/useThemeMode";
import { hapticLight } from "@/lib/haptics";
import { syncNativeStatusBar } from "@/lib/native-chrome";

interface ThemeContextType {
  /** Resolved light/dark UI (Auto uses a day/night schedule when theme mode is system). */
  theme: "light" | "dark";
  effectiveTheme: "light" | "dark";
  themeMode: ThemeMode;
  primaryTheme: AppPrimaryTheme;
  /** Soft page background tint using primary colour (persisted). */
  backgroundTint: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPrimaryTheme: (id: AppPrimaryTheme) => void;
  setBackgroundTint: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      migrateLegacyThemeModeKey();
      migrateLegacyColourTheme();
    }
    return typeof window === "undefined" ? DEFAULT_THEME_MODE : getStoredThemeMode();
  });

  // Used to periodically re-evaluate time-based Auto mode.
  const [, setAutoTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (themeMode !== "system") return;
    // Refresh Auto theme while the app remains open.
    const id = window.setInterval(() => {
      // No-op state update to force recompute of effectiveTheme.
      setAutoTick((v) => v + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [themeMode]);

  const effectiveTheme: "light" | "dark" = themeMode === "system" ? (getTimePrefersDark() ? "dark" : "light") : themeMode;
  const effectiveRef = useRef(effectiveTheme);
  effectiveRef.current = effectiveTheme;

  const [primaryTheme, setPrimaryThemeState] = useState<AppPrimaryTheme>(() =>
    typeof window === "undefined" ? "blue" : getStoredPrimaryTheme(),
  );

  const [backgroundTint, setBackgroundTintState] = useState(() =>
    typeof window === "undefined" ? false : getStoredBackgroundTint(),
  );

  useLayoutEffect(() => {
    applyRootAppearanceClass(effectiveTheme);
    applyPrimaryThemeToDocument(primaryTheme, effectiveTheme);
    applyBackgroundTintToDocument(backgroundTint, effectiveTheme, primaryTheme);
    void syncNativeStatusBar(effectiveTheme);
  }, [effectiveTheme, primaryTheme, backgroundTint]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    persistThemeMode(mode);
    setThemeModeState(mode);
    void hapticLight();
  }, []);

  const toggleTheme = useCallback(() => {
    const next = effectiveRef.current === "dark" ? "light" : "dark";
    setThemeMode(next);
  }, [setThemeMode]);

  const setPrimaryTheme = useCallback((id: AppPrimaryTheme) => {
    setPrimaryThemeState(id);
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    applyPrimaryThemeToDocument(id, effectiveRef.current);
    applyBackgroundTintToDocument(getStoredBackgroundTint(), effectiveRef.current, id);
  }, []);

  const setBackgroundTint = useCallback((enabled: boolean) => {
    persistBackgroundTint(enabled);
    setBackgroundTintState(enabled);
    applyBackgroundTintToDocument(enabled, effectiveRef.current, primaryTheme);
  }, [primaryTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme: effectiveTheme,
        effectiveTheme,
        themeMode,
        primaryTheme,
        backgroundTint,
        toggleTheme,
        setThemeMode,
        setPrimaryTheme,
        setBackgroundTint,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export type { AppPrimaryTheme } from "@/hooks/useTheme";
export { PRIMARY_THEMES } from "@/hooks/useTheme";
