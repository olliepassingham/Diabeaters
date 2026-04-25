import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS wrapper MUST always load production URL for App Store builds.
 * Do not point server.url at staging. For local staging tests, temporarily
 * override and run npx cap sync ios — revert before archiving.
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
  },
};

export default config;
