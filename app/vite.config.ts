/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  if (mode === "development") {
    const env = loadEnv(mode, appDir, "VITE_");
    console.log(
      "[vite] VITE_SUPABASE_URL (import.meta.env, envDir=app only):",
      env.VITE_SUPABASE_URL?.trim() || "(empty)",
    );
  }

  return {
    plugins: [react()],
    envDir: appDir,

    test: {
      environment: "jsdom",
      globals: true,
      include: ["tests/**/*.spec.ts", "src/**/*.spec.ts"],
    },

    resolve: {
      alias: {
        "@": path.resolve(appDir, "src"),
        "@shared": path.resolve(appDir, "..", "shared"),
        "@assets": path.resolve(appDir, "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },

    optimizeDeps: {
      include: ["react", "react-dom", "date-fns"],
    },

    root: appDir,

    publicDir: "public",

    build: {
      outDir: "dist",
      assetsDir: "assets",
      emptyOutDir: true,
    },

    server: {
      allowedHosts: [
        "968087af-9df7-4929-8117-1d95be2fa504-00-2pu2fid2qgqx4.kirk.replit.dev",
      ],
      /** Stable URL: do not silently jump to 5174+ (common cause of “5173 won’t load”). */
      port: 5173,
      strictPort: true,
      host: true,
      fs: { strict: true, deny: ["**/.*"] },
      proxy: { "/api": "http://localhost:3000" },
    },
  };
});
