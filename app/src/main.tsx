// client/src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App";
import "@/index.css";
import "@/theme.css";
import {
  applyRootAppearanceClass,
  getEffectiveAppearance,
  getStoredThemeMode,
  migrateLegacyThemeModeKey,
} from "@/hooks/useThemeMode";
import { applyNativeDocumentClass } from "@/lib/native-chrome";
import { ensureNativeNotificationChannels } from "@/lib/native-local-notifications";
import { registerNotificationActionTypes } from "@/lib/notification-actions";
import { clearNativeAppBadge, scheduleNativeAppBadgeBootClear } from "@/lib/native-app-badge";
import { isCapacitorNativeShell } from "@/lib/native-platform";
import { ensurePushDeepLinkListenersAttached } from "@/lib/push-tokens";
import { hideNativeSplashWhenReady } from "@/lib/native-splash";
import { prefetchOfflineCriticalRoutes } from "@/lib/offline-critical-prefetch";
import "@/lib/offline-guides-entry";

migrateLegacyThemeModeKey();
applyRootAppearanceClass(getEffectiveAppearance(getStoredThemeMode()));
applyNativeDocumentClass();
void ensureNativeNotificationChannels();
void registerNotificationActionTypes();
if (isCapacitorNativeShell()) {
  void clearNativeAppBadge();
  scheduleNativeAppBadgeBootClear();
  ensurePushDeepLinkListenersAttached();
}

if (import.meta.env.PROD || isCapacitorNativeShell()) {
  prefetchOfflineCriticalRoutes();
}

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

// After first paint: fade OS splash so cold start doesn't flash white/network gap.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    void hideNativeSplashWhenReady();
  });
});
// Safety net if the first frames are blocked (slow network / chunk).
window.setTimeout(() => {
  void hideNativeSplashWhenReady();
}, 2500);
