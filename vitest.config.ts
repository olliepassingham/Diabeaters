import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(rootDir, "app");
const appReact = path.resolve(appDir, "node_modules/react");
const rootReact = path.resolve(rootDir, "node_modules/react");
const reactDir = fs.existsSync(appReact) ? appReact : rootReact;
const reactDomDir = fs.existsSync(path.resolve(path.dirname(reactDir), "react-dom"))
  ? path.resolve(path.dirname(reactDir), "react-dom")
  : path.resolve(rootDir, "node_modules/react-dom");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "app", "src"),
      "@shared": path.resolve(rootDir, "shared"),
      "@assets": path.resolve(rootDir, "attached_assets"),
      // Prefer app/node_modules when present (see CI `npm --prefix app ci`); else root.
      react: reactDir,
      "react-dom": reactDomDir,
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(rootDir, "app", "src", "test", "setup.ts")],
    include: [
      "app/src/**/*.spec.{ts,tsx}",
      "app/tests/**/*.spec.ts",
      "scripts/**/*.spec.ts",
      "supabase/functions/_shared/**/*.spec.ts",
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});
