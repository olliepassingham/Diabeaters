import { registerPlugin } from "@capacitor/core";

/** Sets app icon badge count without re-requesting notification permissions (iOS native plugin). */
export interface AppIconBadgePlugin {
  setCount(options: { count: number }): Promise<void>;
}

export const AppIconBadge = registerPlugin<AppIconBadgePlugin>("AppIconBadge");
