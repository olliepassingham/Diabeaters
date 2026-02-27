import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.passingtime.diabeaters",
  appName: "Diabeaters",
  webDir: "dist",
  server: {
    url: "https://diabeaters.vercel.app",
    cleartext: false,
  },
};

export default config;
