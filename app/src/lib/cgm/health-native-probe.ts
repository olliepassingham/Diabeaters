import { isCapacitorNativeShell } from "@/lib/native-platform";
import { withTimeout } from "@/lib/cgm/async-timeout";

const PLUGIN_PROBE_TIMEOUT_MS = 4_000;

export type HealthNativeProbe =
  | { status: "ready"; pluginVersion?: string }
  | { status: "plugin_missing"; message: string }
  | { status: "health_unavailable"; reason?: string };

/** Verify the native Health bridge responds (catches old app shells without @capgo/capacitor-health). */
export async function probeHealthNativeBridge(): Promise<HealthNativeProbe> {
  if (!isCapacitorNativeShell()) {
    return {
      status: "plugin_missing",
      message: "CGM prefill requires the Diabeaters iPhone or Android app.",
    };
  }

  try {
    const mod = await import("@capgo/capacitor-health");
    const { version } = await withTimeout(
      mod.Health.getPluginVersion(),
      PLUGIN_PROBE_TIMEOUT_MS,
      "Apple Health support is not in this app build. Install the latest Diabeaters update from TestFlight or the App Store.",
    );

    const availability = await withTimeout(
      mod.Health.isAvailable(),
      PLUGIN_PROBE_TIMEOUT_MS,
      "Apple Health did not respond. Try again after installing the latest app update.",
    );

    if (!availability.available) {
      return { status: "health_unavailable", reason: availability.reason };
    }

    return { status: "ready", pluginVersion: version };
  } catch (e) {
    return {
      status: "plugin_missing",
      message:
        e instanceof Error
          ? e.message
          : "Apple Health support is not in this app build. Install the latest Diabeaters update.",
    };
  }
}
