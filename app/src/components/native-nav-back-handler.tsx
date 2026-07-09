import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { useEdgeSwipeBack } from "@/hooks/use-edge-swipe-back";
import { useNavHistoryTracker } from "@/hooks/use-nav-history-tracker";
import { canNavigateBack, navigateBack } from "@/lib/nav-back";
import { isAndroidDevice, isCapacitorNativeShell } from "@/lib/native-platform";

type NativeNavBackHandlerProps = {
  pathname: string;
  setLocation: (path: string) => void;
  enabled?: boolean;
};

/** Tracks nav history, edge-swipe back (iOS), and hardware back (Android). */
export function NativeNavBackHandler({ pathname, setLocation, enabled = true }: NativeNavBackHandlerProps) {
  const pathOnly = pathname.split("?")[0] ?? pathname;

  useNavHistoryTracker(pathOnly);
  useEdgeSwipeBack({ pathname: pathOnly, setLocation, enabled });

  useEffect(() => {
    if (!enabled || !isCapacitorNativeShell()) return;

    let removed = false;
    let handle: { remove: () => Promise<void> } | undefined;

    void CapacitorApp.addListener("backButton", () => {
      if (removed) return;
      if (canNavigateBack(pathOnly)) {
        navigateBack(pathOnly, setLocation);
        return;
      }
      if (isAndroidDevice()) {
        void CapacitorApp.exitApp();
      }
    }).then((listener) => {
      if (removed) {
        void listener.remove();
        return;
      }
      handle = listener;
    });

    return () => {
      removed = true;
      void handle?.remove();
    };
  }, [pathOnly, setLocation, enabled]);

  return null;
}
