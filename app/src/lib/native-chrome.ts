import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

const IOS_NATIVE_CLASS = "ios-native";

/** Mark the document when running inside the Capacitor iOS shell (system fonts, etc.). */
export function applyIosNativeDocumentClass(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
    root.classList.add(IOS_NATIVE_CLASS);
  } else {
    root.classList.remove(IOS_NATIVE_CLASS);
  }
}

/**
 * Match status bar icon style to app chrome (iOS only).
 * Capacitor naming: Style.Light = dark glyphs (for light backgrounds); Style.Dark = light glyphs (for dark backgrounds).
 */
export async function syncNativeStatusBar(effectiveTheme: "light" | "dark"): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
  try {
    await StatusBar.setStyle({
      style: effectiveTheme === "dark" ? Style.Dark : Style.Light,
    });
  } catch {
    // Simulator / WebView edge cases
  }
}
