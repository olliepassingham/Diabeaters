import { Capacitor } from "@capacitor/core";

/**
 * When the WebView loads a remote `server.url`, Capacitor can mis-report the platform as `"web"`
 * and `isNativePlatform()` as false (see ionic-team/capacitor issues ~2373). Treat real iPhone/iPad
 * user agents as iOS-like for **UI** that should appear in the native shell.
 */
export function isIosLikeUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Standard Mobile Safari / most WKWebView UAs
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iOS WebView often includes this even when "iPhone" is absent from shortened custom UAs
  if (/\bCPU (?:iPhone )?OS /.test(ua)) return true;
  // iPadOS "desktop" mode: Mac UA + touch (Apple-recommended heuristic)
  const touchMac = navigator.maxTouchPoints > 1 && /Macintosh/.test(ua);
  if (touchMac) return true;

  return false;
}

/**
 * Whether to show iOS-only developer tooling (push test panel, About unlock taps).
 *
 * Prefer {@link isIosDeviceForCapacitorPush} for registering with APNs. This helper is slightly
 * broader for **UI**: `Capacitor.getPlatform()` is usually `"ios"` in the App Store shell even when
 * `navigator.userAgent` is trimmed and no longer matches {@link isIosLikeUserAgent}. Some
 * `server.url` builds report `"web"`; we then trust {@link isIosLikeUserAgent} or native shell.
 */
export function isIosShellForPushTestUi(): boolean {
  const p = Capacitor.getPlatform();
  if (p === "ios") return true;
  if (isIosLikeUserAgent()) return true;
  return p === "web" && Capacitor.isNativePlatform?.() === true;
}

/**
 * Allow Capacitor PushNotifications flows when the runtime reports `"web"` on a real iOS device
 * (remote `server.url` quirk) as well as when it correctly reports `"ios"`.
 */
export function isIosDeviceForCapacitorPush(): boolean {
  const p = Capacitor.getPlatform();
  if (p === "ios") return true;
  return p === "web" && isIosLikeUserAgent();
}
