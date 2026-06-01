import { Capacitor } from "@capacitor/core";

import { isIosLikeUserAgent } from "@/lib/ios-user-agent";

export type NativePushPlatform = "ios" | "android";

/** True when running in a Capacitor native shell (iOS or Android). */
export function isCapacitorNativeShell(): boolean {
  const p = Capacitor.getPlatform();
  if (p === "ios" || p === "android") return true;
  // Remote `server.url` builds can report `"web"` on real devices.
  return p === "web" && Capacitor.isNativePlatform?.() === true;
}

/** True when remote push registration (APNs or FCM) should run. */
export function isNativePushPlatform(): boolean {
  return getNativePushPlatform() != null;
}

export function getNativePushPlatform(): NativePushPlatform | null {
  const p = Capacitor.getPlatform();
  if (p === "android") return "android";
  if (p === "ios") return "ios";
  if (p === "web" && isIosLikeUserAgent()) return "ios";
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
