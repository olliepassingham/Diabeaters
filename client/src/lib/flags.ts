/**
 * Environment flags. Safe feature-flag utility for banners, robots, and conditional UI.
 * Never expose secrets. Values come from VITE_APP_ENV at build time.
 */
export const APP_ENV =
  (import.meta.env.VITE_APP_ENV as string)?.trim() ||
  (import.meta.env.PROD ? "production" : "development");

export const isStaging = APP_ENV === "staging";
export const isProd = APP_ENV === "production";
export const isDev = APP_ENV === "development";
