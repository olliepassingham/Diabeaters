import { StatusBar, Style } from "@capacitor/status-bar";

import { getDevicePlatform, isCapacitorNativeShell } from "@/lib/native-platform";

const IOS_NATIVE_CLASS = "ios-native";
const ANDROID_NATIVE_CLASS = "android-native";

/** Mark the document when running inside a Capacitor native shell. */
export function applyNativeDocumentClass(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const platform = getDevicePlatform();
  const isNative = isCapacitorNativeShell();
  const isIosNative = isNative && platform === "ios";
  const isAndroidNative = isNative && platform === "android";
  root.classList.toggle(IOS_NATIVE_CLASS, isIosNative);
  root.classList.toggle(ANDROID_NATIVE_CLASS, isAndroidNative);
  root.dataset.devicePlatform = platform;
  if (isIosNative || isAndroidNative) {
    applyNativeViewportNoZoom();
  }
}

/** Disable pinch zoom in the native app WebView (focus zoom is handled via 16px inputs in index.css). */
export function applyNativeViewportNoZoom(): void {
  if (typeof document === "undefined" || !isCapacitorNativeShell()) return;
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
  if (!isCapacitorNativeShell()) return;
  const platform = getDevicePlatform();
  if (platform !== "ios" && platform !== "android") return;
  try {
    await StatusBar.setStyle({
      style: effectiveTheme === "dark" ? Style.Dark : Style.Light,
    });
    if (platform === "android") {
      // Match --app-background so the status bar blends into the shell (see theme-color metas).
      await StatusBar.setBackgroundColor({ color: effectiveTheme === "dark" ? "#16141e" : "#f7f9fd" });
    }
  } catch {
    // Simulator / WebView edge cases
  }
}
