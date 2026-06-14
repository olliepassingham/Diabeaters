import { useEffect } from "react";
import { trackNavHistory } from "@/lib/nav-back";

/** Records the previous in-app path so smart back can prefer history when available. */
export function useNavHistoryTracker(pathname: string): void {
  const pathOnly = pathname.split("?")[0] ?? pathname;

  useEffect(() => {
    trackNavHistory(pathOnly);
  }, [pathOnly]);
}
