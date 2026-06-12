import { Capacitor } from "@capacitor/core";

import { isIosLikeUserAgent } from "@/lib/ios-user-agent";

export type NativePushPlatform = "ios" | "android";

/** True when the page runs inside a Capacitor WKWebView (not Mobile Safari). */
export function hasCapacitorNativeWebViewBridge(): boolean {
  if (typeof window === "undefined") return false;
  const handlers = (
    window as Window & { webkit?: { messageHandlers?: Record<string, unknown> } }
  ).webkit?.messageHandlers;
  if (!handlers) return false;
  return "bridge" in handlers || "capacitor" in handlers;
}

/** True when running in a Capacitor native shell (iOS or Android). */
export function isCapacitorNativeShell(): boolean {
  const p = Capacitor.getPlatform();
  if (p === "ios" || p === "android") return true;
  if (p !== "web") return false;
  // Remote `server.url` builds can report `"web"` and `isNativePlatform()` false on real devices.
  if (Capacitor.isNativePlatform?.()) return true;
  return hasCapacitorNativeWebViewBridge();
}

/** True when remote push registration (APNs or FCM) should run. */
export function isNativePushPlatform(): boolean {
  return getNativePushPlatform() != null;
}

export function getNativePushPlatform(): NativePushPlatform | null {
  const p = Capacitor.getPlatform();
  if (p === "android") return "android";
  if (p === "ios") return "ios";
  if (p !== "web") return null;

  if (isIosLikeUserAgent()) return "ios";

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Android/i.test(ua) && Capacitor.isNativePlatform?.()) return "android";

  // Remote `server.url` iOS App Store shell: platform "web", trimmed UA — still APNs/iOS.
  if (Capacitor.isNativePlatform?.()) return "ios";

  if (hasCapacitorNativeWebViewBridge()) {
    if (/Android/i.test(ua)) return "android";
    return "ios";
  }

  return null;
}

/** True when OS-scheduled local notifications are supported in this shell. */
export function supportsNativeLocalNotifications(): boolean {
  return isCapacitorNativeShell() && (Capacitor.getPlatform() === "ios" || Capacitor.getPlatform() === "android");
}

/** Whether to show native push test tooling (About unlock, dev panel). */
export function isNativeShellForPushTestUi(): boolean {
  const p = Capacitor.getPlatform();
  if (p === "ios" || p === "android") return true;
  if (p === "web" && isIosLikeUserAgent()) return true;
  return p === "web" && Capacitor.isNativePlatform?.() === true;
}

export function nativePlatformLabel(): string {
  const p = Capacitor.getPlatform();
  if (p === "android") return "Android";
  if (p === "ios") return "iPhone";
  return "device";
}

/**
 * Capacitor serves bundled `webDir` assets from localhost.
 * Remote `server.url` shells load the production host (e.g. Vercel) instead.
 */
export function isBundledCapacitorOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/** Service worker helps remote native shells cache JS for offline; bundled shells already ship assets. */
export function shouldRegisterServiceWorker(): boolean {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (isCapacitorNativeShell() && isBundledCapacitorOrigin()) return false;
  return true;
}
