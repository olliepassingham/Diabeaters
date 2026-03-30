// client/src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App";
import "@/index.css";
import "@/theme.css";
import "@fontsource-variable/inter/index.css";
import {
  applyRootAppearanceClass,
  getEffectiveAppearance,
  getStoredThemeMode,
  migrateLegacyThemeModeKey,
} from "@/hooks/useThemeMode";

migrateLegacyThemeModeKey();
applyRootAppearanceClass(getEffectiveAppearance(getStoredThemeMode()));

if (import.meta.env.DEV) {
  console.info(
    `[Diabeaters dev] ${new Date().toISOString()} · service worker registration disabled (not PROD)`,
  );
  console.log(import.meta.env.VITE_SUPABASE_URL);
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Missing <div id="root"></div> in index.html');

createRoot(rootEl).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
