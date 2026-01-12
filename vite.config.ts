
// vite.config.ts / vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    // ✅ force one React/ReactDOM
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    // ✅ pre-bundle so everything (including overlays) uses the same instance
    include: ["react", "react-dom"],
  },
});
