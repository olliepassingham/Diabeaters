import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

const IOS_NATIVE_CLASS = "ios-native";
const ANDROID_NATIVE_CLASS = "android-native";

/** Mark the document when running inside a Capacitor native shell. */
export function applyNativeDocumentClass(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const p = Capacitor.getPlatform();
  const isIosNative = Capacitor.isNativePlatform() && p === "ios";
  const isAndroidNative = Capacitor.isNativePlatform() && p === "android";
  root.classList.toggle(IOS_NATIVE_CLASS, isIosNative);
  root.classList.toggle(ANDROID_NATIVE_CLASS, isAndroidNative);
  if (isIosNative || isAndroidNative) {
    applyNativeViewportNoZoom();
  }
}

/** Disable pinch zoom in the native app WebView (focus zoom is handled via 16px inputs in index.css). */
export function applyNativeViewportNoZoom(): void {
  if (typeof document === "undefined" || !Capacitor.isNativePlatform()) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute(
    "content",
    "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no",
  );
}

/** @deprecated Use {@link applyNativeDocumentClass} */
export const applyIosNativeDocumentClass = applyNativeDocumentClass;

/**
 * Match status bar icon style to app chrome on iOS and Android.
 * Capacitor naming: Style.Light = dark glyphs (light backgrounds); Style.Dark = light glyphs (dark backgrounds).
 */
export async function syncNativeStatusBar(effectiveTheme: "light" | "dark"): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const p = Capacitor.getPlatform();
  if (p !== "ios" && p !== "android") return;
  try {
    await StatusBar.setStyle({
      style: effectiveTheme === "dark" ? Style.Dark : Style.Light,
    });
    if (p === "android") {
      await StatusBar.setBackgroundColor({ color: effectiveTheme === "dark" ? "#0f172a" : "#ffffff" });
    }
  } catch {
    // Simulator / WebView edge cases
  }
}
