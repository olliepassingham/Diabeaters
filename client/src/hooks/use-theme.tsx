import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

export type ColourThemeId = "warm-beige" | "ocean-blue" | "forest-green" | "lavender" | "rose" | "slate";

export interface ColourTheme {
  id: ColourThemeId;
  name: string;
  preview: { light: string; dark: string };
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const COLOUR_THEMES: ColourTheme[] = [
  {
    id: "warm-beige",
    name: "Warm Beige",
    preview: { light: "#d4c4a8", dark: "#3d2e1e" },
    light: {},
    dark: {},
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    preview: { light: "#b8d4e3", dark: "#1a2d3d" },
    light: {
      "--background": "210 32% 91%",
      "--foreground": "210 20% 15%",
      "--border": "210 22% 84%",
      "--card": "210 22% 97%",
      "--card-foreground": "210 20% 15%",
      "--card-border": "210 18% 91%",
      "--sidebar": "210 26% 93%",
      "--sidebar-foreground": "210 20% 15%",
      "--sidebar-border": "210 20% 83%",
      "--sidebar-primary": "210 45% 30%",
      "--sidebar-primary-foreground": "210 20% 96%",
      "--sidebar-accent": "210 24% 89%",
      "--sidebar-accent-foreground": "210 20% 20%",
      "--sidebar-ring": "210 45% 30%",
      "--popover": "210 26% 94%",
      "--popover-foreground": "210 20% 15%",
      "--popover-border": "210 20% 86%",
      "--primary": "210 50% 30%",
      "--primary-foreground": "0 0% 96%",
      "--secondary": "200 38% 86%",
      "--secondary-foreground": "210 20% 20%",
      "--muted": "210 22% 89%",
      "--muted-foreground": "210 14% 42%",
      "--accent": "200 40% 80%",
      "--accent-foreground": "210 20% 20%",
      "--input": "210 20% 83%",
      "--ring": "210 45% 30%",
    },
    dark: {
      "--background": "215 28% 12%",
      "--foreground": "210 30% 88%",
      "--border": "215 20% 24%",
      "--card": "215 22% 21%",
      "--card-foreground": "210 30% 90%",
      "--card-border": "215 18% 28%",
      "--sidebar": "218 24% 15%",
      "--sidebar-foreground": "210 30% 88%",
      "--sidebar-border": "215 18% 22%",
      "--sidebar-primary": "210 55% 58%",
      "--sidebar-primary-foreground": "215 24% 12%",
      "--sidebar-accent": "215 18% 24%",
      "--sidebar-accent-foreground": "210 30% 88%",
      "--sidebar-ring": "210 55% 58%",
      "--popover": "215 22% 20%",
      "--popover-foreground": "210 30% 88%",
      "--popover-border": "215 18% 28%",
      "--primary": "210 55% 58%",
      "--primary-foreground": "215 24% 12%",
      "--secondary": "215 30% 38%",
      "--secondary-foreground": "210 30% 90%",
      "--muted": "215 18% 22%",
      "--muted-foreground": "210 20% 62%",
      "--accent": "200 45% 46%",
      "--accent-foreground": "210 30% 92%",
      "--input": "215 18% 28%",
      "--ring": "210 55% 58%",
    },
  },
  {
    id: "forest-green",
    name: "Forest Green",
    preview: { light: "#b8d4b8", dark: "#1e3d2e" },
    light: {
      "--background": "140 24% 90%",
      "--foreground": "150 18% 15%",
      "--border": "140 18% 82%",
      "--card": "140 18% 97%",
      "--card-foreground": "150 18% 15%",
      "--card-border": "140 14% 91%",
      "--sidebar": "140 20% 92%",
      "--sidebar-foreground": "150 18% 15%",
      "--sidebar-border": "140 16% 82%",
      "--sidebar-primary": "155 35% 28%",
      "--sidebar-primary-foreground": "140 20% 96%",
      "--sidebar-accent": "140 18% 88%",
      "--sidebar-accent-foreground": "150 18% 20%",
      "--sidebar-ring": "155 35% 28%",
      "--popover": "140 20% 93%",
      "--popover-foreground": "150 18% 15%",
      "--popover-border": "140 16% 85%",
      "--primary": "155 38% 28%",
      "--primary-foreground": "0 0% 96%",
      "--secondary": "140 26% 84%",
      "--secondary-foreground": "150 18% 20%",
      "--muted": "140 16% 88%",
      "--muted-foreground": "150 12% 42%",
      "--accent": "140 28% 79%",
      "--accent-foreground": "150 18% 20%",
      "--input": "140 16% 82%",
      "--ring": "155 35% 28%",
    },
    dark: {
      "--background": "150 22% 11%",
      "--foreground": "140 28% 86%",
      "--border": "150 18% 22%",
      "--card": "150 18% 19%",
      "--card-foreground": "140 28% 88%",
      "--card-border": "150 16% 26%",
      "--sidebar": "152 22% 14%",
      "--sidebar-foreground": "140 28% 86%",
      "--sidebar-border": "150 16% 20%",
      "--sidebar-primary": "150 50% 50%",
      "--sidebar-primary-foreground": "150 22% 11%",
      "--sidebar-accent": "150 16% 22%",
      "--sidebar-accent-foreground": "140 28% 86%",
      "--sidebar-ring": "150 50% 50%",
      "--popover": "150 18% 18%",
      "--popover-foreground": "140 28% 86%",
      "--popover-border": "150 16% 26%",
      "--primary": "150 50% 50%",
      "--primary-foreground": "150 22% 11%",
      "--secondary": "150 28% 36%",
      "--secondary-foreground": "140 28% 88%",
      "--muted": "150 16% 20%",
      "--muted-foreground": "140 18% 58%",
      "--accent": "150 40% 42%",
      "--accent-foreground": "140 28% 92%",
      "--input": "150 16% 26%",
      "--ring": "150 50% 50%",
    },
  },
  {
    id: "lavender",
    name: "Lavender",
    preview: { light: "#d4c4e3", dark: "#2d1e3d" },
    light: {
      "--background": "270 26% 91%",
      "--foreground": "270 15% 15%",
      "--border": "270 18% 83%",
      "--card": "270 18% 97%",
      "--card-foreground": "270 15% 15%",
      "--card-border": "270 14% 91%",
      "--sidebar": "270 20% 92%",
      "--sidebar-foreground": "270 15% 15%",
      "--sidebar-border": "270 16% 83%",
      "--sidebar-primary": "270 35% 35%",
      "--sidebar-primary-foreground": "270 20% 96%",
      "--sidebar-accent": "270 18% 88%",
      "--sidebar-accent-foreground": "270 15% 20%",
      "--sidebar-ring": "270 35% 35%",
      "--popover": "270 20% 94%",
      "--popover-foreground": "270 15% 15%",
      "--popover-border": "270 16% 86%",
      "--primary": "270 40% 35%",
      "--primary-foreground": "0 0% 96%",
      "--secondary": "270 28% 86%",
      "--secondary-foreground": "270 15% 20%",
      "--muted": "270 16% 88%",
      "--muted-foreground": "270 12% 42%",
      "--accent": "270 28% 80%",
      "--accent-foreground": "270 15% 20%",
      "--input": "270 16% 83%",
      "--ring": "270 35% 35%",
    },
    dark: {
      "--background": "272 24% 12%",
      "--foreground": "270 28% 86%",
      "--border": "272 18% 24%",
      "--card": "272 18% 20%",
      "--card-foreground": "270 28% 88%",
      "--card-border": "272 16% 28%",
      "--sidebar": "274 22% 14%",
      "--sidebar-foreground": "270 28% 86%",
      "--sidebar-border": "272 16% 22%",
      "--sidebar-primary": "270 50% 60%",
      "--sidebar-primary-foreground": "272 24% 12%",
      "--sidebar-accent": "272 16% 24%",
      "--sidebar-accent-foreground": "270 28% 86%",
      "--sidebar-ring": "270 50% 60%",
      "--popover": "272 18% 19%",
      "--popover-foreground": "270 28% 86%",
      "--popover-border": "272 16% 28%",
      "--primary": "270 50% 60%",
      "--primary-foreground": "272 24% 12%",
      "--secondary": "272 28% 38%",
      "--secondary-foreground": "270 28% 88%",
      "--muted": "272 16% 22%",
      "--muted-foreground": "270 18% 60%",
      "--accent": "270 42% 48%",
      "--accent-foreground": "270 28% 92%",
      "--input": "272 16% 28%",
      "--ring": "270 50% 60%",
    },
  },
  {
    id: "rose",
    name: "Rose",
    preview: { light: "#e3c4c4", dark: "#3d1e1e" },
    light: {
      "--background": "350 28% 91%",
      "--foreground": "350 15% 15%",
      "--border": "350 20% 84%",
      "--card": "350 20% 97%",
      "--card-foreground": "350 15% 15%",
      "--card-border": "350 16% 91%",
      "--sidebar": "350 22% 92%",
      "--sidebar-foreground": "350 15% 15%",
      "--sidebar-border": "350 18% 83%",
      "--sidebar-primary": "350 40% 38%",
      "--sidebar-primary-foreground": "350 22% 96%",
      "--sidebar-accent": "350 20% 88%",
      "--sidebar-accent-foreground": "350 15% 20%",
      "--sidebar-ring": "350 40% 38%",
      "--popover": "350 22% 94%",
      "--popover-foreground": "350 15% 15%",
      "--popover-border": "350 18% 86%",
      "--primary": "350 45% 38%",
      "--primary-foreground": "0 0% 96%",
      "--secondary": "350 28% 86%",
      "--secondary-foreground": "350 15% 20%",
      "--muted": "350 18% 88%",
      "--muted-foreground": "350 12% 42%",
      "--accent": "350 30% 80%",
      "--accent-foreground": "350 15% 20%",
      "--input": "350 18% 83%",
      "--ring": "350 40% 38%",
    },
    dark: {
      "--background": "352 24% 12%",
      "--foreground": "350 30% 86%",
      "--border": "352 18% 24%",
      "--card": "352 18% 20%",
      "--card-foreground": "350 30% 88%",
      "--card-border": "352 16% 28%",
      "--sidebar": "354 22% 14%",
      "--sidebar-foreground": "350 30% 86%",
      "--sidebar-border": "352 16% 22%",
      "--sidebar-primary": "350 52% 58%",
      "--sidebar-primary-foreground": "352 24% 12%",
      "--sidebar-accent": "352 16% 24%",
      "--sidebar-accent-foreground": "350 30% 86%",
      "--sidebar-ring": "350 52% 58%",
      "--popover": "352 18% 19%",
      "--popover-foreground": "350 30% 86%",
      "--popover-border": "352 16% 28%",
      "--primary": "350 52% 58%",
      "--primary-foreground": "352 24% 12%",
      "--secondary": "352 28% 38%",
      "--secondary-foreground": "350 30% 88%",
      "--muted": "352 16% 22%",
      "--muted-foreground": "350 18% 60%",
      "--accent": "350 44% 48%",
      "--accent-foreground": "350 30% 92%",
      "--input": "352 16% 28%",
      "--ring": "350 52% 58%",
    },
  },
  {
    id: "slate",
    name: "Slate",
    preview: { light: "#c4c8cc", dark: "#1e2228" },
    light: {
      "--background": "220 16% 91%",
      "--foreground": "220 12% 15%",
      "--border": "220 12% 84%",
      "--card": "220 12% 97%",
      "--card-foreground": "220 12% 15%",
      "--card-border": "220 10% 91%",
      "--sidebar": "220 14% 92%",
      "--sidebar-foreground": "220 12% 15%",
      "--sidebar-border": "220 10% 83%",
      "--sidebar-primary": "220 20% 30%",
      "--sidebar-primary-foreground": "220 12% 96%",
      "--sidebar-accent": "220 12% 88%",
      "--sidebar-accent-foreground": "220 12% 20%",
      "--sidebar-ring": "220 20% 30%",
      "--popover": "220 14% 94%",
      "--popover-foreground": "220 12% 15%",
      "--popover-border": "220 10% 86%",
      "--primary": "220 24% 30%",
      "--primary-foreground": "0 0% 96%",
      "--secondary": "220 16% 86%",
      "--secondary-foreground": "220 12% 20%",
      "--muted": "220 12% 88%",
      "--muted-foreground": "220 10% 42%",
      "--accent": "220 16% 82%",
      "--accent-foreground": "220 12% 20%",
      "--input": "220 10% 83%",
      "--ring": "220 20% 30%",
    },
    dark: {
      "--background": "222 18% 11%",
      "--foreground": "220 16% 86%",
      "--border": "222 14% 22%",
      "--card": "222 14% 19%",
      "--card-foreground": "220 16% 88%",
      "--card-border": "222 12% 26%",
      "--sidebar": "224 18% 13%",
      "--sidebar-foreground": "220 16% 86%",
      "--sidebar-border": "222 12% 20%",
      "--sidebar-primary": "220 40% 58%",
      "--sidebar-primary-foreground": "222 18% 11%",
      "--sidebar-accent": "222 12% 22%",
      "--sidebar-accent-foreground": "220 16% 86%",
      "--sidebar-ring": "220 40% 58%",
      "--popover": "222 14% 18%",
      "--popover-foreground": "220 16% 86%",
      "--popover-border": "222 12% 26%",
      "--primary": "220 40% 58%",
      "--primary-foreground": "222 18% 11%",
      "--secondary": "222 20% 36%",
      "--secondary-foreground": "220 16% 88%",
      "--muted": "222 12% 20%",
      "--muted-foreground": "220 12% 58%",
      "--accent": "220 30% 46%",
      "--accent-foreground": "220 16% 92%",
      "--input": "222 12% 26%",
      "--ring": "220 40% 58%",
    },
  },
];

interface ThemeContextType {
  theme: Theme;
  colourTheme: ColourThemeId;
  toggleTheme: () => void;
  setColourTheme: (id: ColourThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyColourTheme(themeMode: Theme, colourId: ColourThemeId) {
  const root = document.documentElement;
  const colourTheme = COLOUR_THEMES.find(t => t.id === colourId);
  if (!colourTheme) return;

  const vars = themeMode === "dark" ? colourTheme.dark : colourTheme.light;

  COLOUR_THEMES.forEach(t => {
    const allVars = { ...t.light, ...t.dark };
    Object.keys(allVars).forEach(key => {
      root.style.removeProperty(key);
    });
  });

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    return (stored as Theme) || "light";
  });

  const [colourTheme, setColourThemeState] = useState<ColourThemeId>(() => {
    const stored = localStorage.getItem("diabeater_colour_theme");
    return (stored as ColourThemeId) || "warm-beige";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
    applyColourTheme(theme, colourTheme);
  }, [theme, colourTheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setColourTheme = (id: ColourThemeId) => {
    setColourThemeState(id);
    localStorage.setItem("diabeater_colour_theme", id);
  };

  return (
    <ThemeContext.Provider value={{ theme, colourTheme, toggleTheme, setColourTheme }}>
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
