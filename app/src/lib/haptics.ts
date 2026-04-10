import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/** Subtle tap feedback on native iOS/Android; no-op on web. */
export async function hapticLight(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // ignore
  }
}
