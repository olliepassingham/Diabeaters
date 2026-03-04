import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const appDir = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  envDir: appDir,

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

  build: {
    outDir: path.resolve(appDir, "..", "dist", "public"),
    emptyOutDir: true,
  },

  server: {
    allowedHosts: [
      "968087af-9df7-4929-8117-1d95be2fa504-00-2pu2fid2qgqx4.kirk.replit.dev",
    ],
    port: 5173,
    strictPort: true,
    fs: { strict: true, deny: ["**/.*"] },
    proxy: { "/api": "http://localhost:3000" },
  },
});
