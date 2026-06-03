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
  /**
   * iOS: show notification banners/sounds while the app is open.
   * Without this, iOS can suppress foreground presentation which makes it feel “broken”.
   */
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // Local notifications use the same iOS presentation mechanism.
    LocalNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Badge: {
      persist: false,
      autoClear: false,
    },
  },
};

export default config;
