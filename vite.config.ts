
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// If you're on Node >=20, import.meta.dirname is available in ESM.
// (If you ever switch to CJS, adapt path resolution accordingly.)

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
    // Ensure a single React instance across app + any plugins
    dedupe: ["react", "react-dom"],
  },

  // Pre-bundle React to keep a single instance for all consumers (overlay/plugins too)
  optimizeDeps: {
    include: ["react", "react-dom"],
  },

  // Your Vite app lives in /client (index.html and src/**)
  root: path.resolve(import.meta.dirname, "client"),

  // base: "/" is Vite default; root domain serving, no subpath
  base: "/",

  // Build output for Vercel static deploy (dist/) and legacy server (dist/public via build:server)
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },

  server: {
    /**
     * Replit preview uses a long subdomain; Vite 5+ blocks unknown hosts by default.
     * Allow your preview host so requests aren’t rejected.
     * You can also use [".replit.dev"] to allow all subdomains, but explicit is safer.
     */
    allowedHosts: [
      "968087af-9df7-4929-8117-1d95be2fa504-00-2pu2fid2qgqx4.kirk.replit.dev",
    ],

    // Local dev port for Vite (you’re using single‑port middleware in Express, but this is kept for parity)
    port: 5173,
    strictPort: true,

    // Lock down file serving
    fs: { strict: true, deny: ["**/.*"] },

    // Proxy API calls during dev to your Express server on 3000
    proxy: { "/api": "http://localhost:3000" },

    // If the dev overlay ever becomes noisy or conflicts in Replit, uncomment:
    // hmr: { overlay: false },
  },
});
