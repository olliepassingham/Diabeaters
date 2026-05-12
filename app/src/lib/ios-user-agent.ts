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
 * Allow Capacitor PushNotifications flows when the runtime reports `"web"` on a real iOS device
 * (remote `server.url` quirk) as well as when it correctly reports `"ios"`.
 */
export function isIosDeviceForCapacitorPush(): boolean {
  const p = Capacitor.getPlatform();
  if (p === "ios") return true;
  return p === "web" && isIosLikeUserAgent();
}
