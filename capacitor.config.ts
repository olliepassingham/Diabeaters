import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS wrapper MUST always load production URL for App Store builds.
 * Do not point server.url at staging. For local staging tests, temporarily
 * override and run npx cap sync ios — revert before archiving.
 */
const config: CapacitorConfig = {
  appId: "com.passingtime.diabeaters",
  appName: "Diabeaters",
  webDir: "dist/public",
  server: {
    url: "https://diabeaters.vercel.app",
    cleartext: false,
  },
};

export default config;
