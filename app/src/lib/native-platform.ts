import { Capacitor } from "@capacitor/core";

import { isIosLikeUserAgent } from "@/lib/ios-user-agent";

export type NativePushPlatform = "ios" | "android";

/** Resolved OS: native shell only. `web` = mobile browser or desktop, not the Diabeaters app. */
export type DevicePlatform = NativePushPlatform | "web";

/** True when the page runs inside a Capacitor WKWebView (not Mobile Safari). */
export function hasCapacitorNativeWebViewBridge(): boolean {
  if (typeof window === "undefined") return false;
  const handlers = (
    window as Window & { webkit?: { messageHandlers?: Record<string, unknown> } }
  ).webkit?.messageHandlers;
  if (!handlers) return false;
  return "bridge" in handlers || "capacitor" in handlers;
}

function isAndroidLikeUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Resolve iOS vs Android inside a Capacitor shell when `Capacitor.getPlatform()` may report `"web"`
 * (common with remote `server.url` builds or trimmed user agents).
 */
export function resolveNativeDevicePlatform(): NativePushPlatform | null {
  const reported = Capacitor.getPlatform();
  if (reported === "android") return "android";
  if (reported === "ios") return "ios";
  if (reported !== "web") return null;

  if (isAndroidLikeUserAgent()) return "android";
  if (isIosLikeUserAgent()) return "ios";

  if (Capacitor.isNativePlatform?.()) {
    // Trimmed UA on a real device — WKWebView bridge is iOS-only.
    if (hasCapacitorNativeWebViewBridge()) return "ios";
    return "ios";
  }

  if (hasCapacitorNativeWebViewBridge()) {
    return isAndroidLikeUserAgent() ? "android" : "ios";
  }

  return null;
}

/** Best-effort OS for UI, CGM labels, notifications, and feature branching. */
export function getDevicePlatform(): DevicePlatform {
  const native = resolveNativeDevicePlatform();
  if (native) return native;
  if (isCapacitorNativeShell()) {
    return isAndroidLikeUserAgent() ? "android" : "ios";
  }
  return "web";
}

export function isIosDevice(): boolean {
  return getDevicePlatform() === "ios";
}

export function isAndroidDevice(): boolean {
  return getDevicePlatform() === "android";
}

export function isWebClient(): boolean {
  return getDevicePlatform() === "web";
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
  return resolveNativeDevicePlatform();
}

/** Apple Health on iOS, Health Connect on Android; sensible label on web by user agent. */
export function healthPlatformLabel(): string {
  if (isAndroidDevice()) return "Health Connect";
  if (isIosDevice()) return "Apple Health";
  if (typeof navigator !== "undefined") {
    if (/Android/i.test(navigator.userAgent)) return "Health Connect";
    if (isIosLikeUserAgent()) return "Apple Health";
  }
  return "Apple Health / Health Connect";
}

/** Android notification channels are required on API 26+; omitted on iOS. */
export function androidNotificationChannel(channelId: string): { channelId?: string } {
  return isAndroidDevice() ? { channelId } : {};
}

/** True when OS-scheduled local notifications are supported in this shell. */
export function supportsNativeLocalNotifications(): boolean {
  return isCapacitorNativeShell() && getDevicePlatform() !== "web";
}

/** Whether to show native push test tooling (About unlock, dev panel). */
export function isNativeShellForPushTestUi(): boolean {
  const p = Capacitor.getPlatform();
  if (p === "ios" || p === "android") return true;
  if (p === "web" && isIosLikeUserAgent()) return true;
  return p === "web" && Capacitor.isNativePlatform?.() === true;
}

export function nativePlatformLabel(): string {
  const p = getDevicePlatform();
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
