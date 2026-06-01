import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

const IOS_NATIVE_CLASS = "ios-native";
const ANDROID_NATIVE_CLASS = "android-native";

/** Mark the document when running inside a Capacitor native shell. */
export function applyNativeDocumentClass(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const p = Capacitor.getPlatform();
  root.classList.toggle(IOS_NATIVE_CLASS, Capacitor.isNativePlatform() && p === "ios");
  root.classList.toggle(ANDROID_NATIVE_CLASS, Capacitor.isNativePlatform() && p === "android");
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
