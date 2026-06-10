import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS wrapper MUST always load production URL for App Store builds.
 * Android Play Store builds use the same remote URL pattern.
 * Do not point server.url at staging. For local staging tests, temporarily
 * override and run npx cap sync ios|android — revert before archiving.
 *
 * When `server.url` is set, the WebView loads that host’s JS (e.g. Vercel). Vite
 * flags like `VITE_SHOW_PUSH_TEST` apply only if set on **that** deployment’s build,
 * unless you use the per-device unlock (About → Version, seven taps on iOS).
 */
const config: CapacitorConfig = {
  appId: "com.passingtime.diabeaters",
  appName: "Diabeaters",
  webDir: "dist",
  server: {
    url: "https://diabeaters.vercel.app",
    cleartext: false,
  },
  plugins: {
    /**
     * iOS: show banners and play sound while the app is open (same as lock-screen alerts).
     */
    PushNotifications: {
      // Badge is managed by AppIconBadge + syncNativeAppBadgeNow — not push presentation (stale aps.badge).
      presentationOptions: ["sound", "alert"],
    },
    LocalNotifications: {
      presentationOptions: ["sound", "alert"],
    },
    /** Android only — excluded from iOS via `ios.includePlugins` (badge-only permission broke alerts). */
    Badge: {
      persist: false,
      autoClear: false,
    },
  },
  ios: {
    includePlugins: [
      "@capacitor/app",
      "@capacitor/camera",
      "@capacitor/haptics",
      "@capacitor/local-notifications",
      "@capacitor/push-notifications",
      "@capacitor/status-bar",
    ],
  },
};

export default config;
