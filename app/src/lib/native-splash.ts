import { isCapacitorNativeShell } from "@/lib/native-platform";

/**
 * Hide the native launch splash once the web shell has painted.
 * Capacitor config sets `SplashScreen.launchAutoHide: false` so we own the handoff
 * and avoid a white/network gap after the OS splash.
 *
 * Use {@link isCapacitorNativeShell} — remote `server.url` builds often report
 * `Capacitor.isNativePlatform() === false`, which would leave the splash stuck.
 */
export async function hideNativeSplashWhenReady(): Promise<void> {
  if (!isCapacitorNativeShell()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 220 });
  } catch {
    // Plugin missing or already hidden — ignore.
  }
}
