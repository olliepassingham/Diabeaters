import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(rootDir, "app");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "app", "src"),
      "@shared": path.resolve(rootDir, "shared"),
      "@assets": path.resolve(rootDir, "attached_assets"),
      // App deps live under app/; force one React copy so hooks work in Vitest + RTL.
      react: path.resolve(appDir, "node_modules/react"),
      "react-dom": path.resolve(appDir, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(rootDir, "app", "src", "test", "setup.ts")],
    include: [
      "app/src/**/*.spec.{ts,tsx}",
      "supabase/functions/_shared/**/*.spec.ts",
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});

