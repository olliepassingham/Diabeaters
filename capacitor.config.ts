import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Default: load production from Vercel so GitHub → Vercel deploy updates
 * installed iOS/Android apps without a new store binary.
 *
 * Override URL: CAPACITOR_SERVER_URL=https://…
 * Bundle web into the binary (offline cold start, no live deploy):
 *   CAPACITOR_BUNDLE_WEB=1 npm run ios:release:sync:bundled
 *
 * Do not point CAPACITOR_SERVER_URL at staging for store archives.
 */
const PRODUCTION_SERVER_URL = "https://diabeaters.vercel.app";
const bundleWeb = process.env.CAPACITOR_BUNDLE_WEB === "1";
const remoteServerUrl = bundleWeb
  ? undefined
  : process.env.CAPACITOR_SERVER_URL?.trim() || PRODUCTION_SERVER_URL;

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
     * Keep splash until React shell paints — `hideNativeSplashWhenReady` fades it out.
     */
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: "#EFF6FF",
      showSpinner: false,
    },
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
      "@capacitor/splash-screen",
      "@capacitor/status-bar",
      "@capgo/capacitor-health",
    ],
  },
};

export default config;
