import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native release builds bundle the production web app from `dist/` (offline cold start).
 *
 * To load a remote host instead (legacy OTA-style updates without an App Store release),
 * set `CAPACITOR_SERVER_URL` before `cap sync`, e.g.:
 *   CAPACITOR_SERVER_URL=https://diabeaters.vercel.app npm run ios:release:sync:remote
 *
 * Do not point `CAPACITOR_SERVER_URL` at staging for store archives.
 *
 * When a remote URL is set, Vite flags on **that** deployment apply unless unlocked per device
 * (About → Version, seven taps on iOS).
 */
const remoteServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.passingtime.diabeaters",
  appName: "Diabeaters",
  webDir: "dist",
  ...(remoteServerUrl
    ? {
        server: {
          url: remoteServerUrl,
          cleartext: false,
        },
      }
    : {}),
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
