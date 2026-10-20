import { useEffect, useState } from "react";
import { HomeSupplyGraph } from "@/components/home/HomeSupplyGraph";
import {
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_SUPPLIES_CHANGED_EVENT,
  storage,
  type Supply,
} from "@/lib/storage";

/** Supply runway as a movable home widget. Reads supplies itself so Edit home can reorder or hide it. */
export function SupplyRunwayWidget() {
  const [supplies, setSupplies] = useState<Supply[]>(() => {
    try {
      return storage.getSupplies();
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const refresh = () => {
      try {
        setSupplies(storage.getSupplies());
      } catch {
        setSupplies([]);
      }
    };
    refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
    window.addEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, refresh);
      window.removeEventListener(DIABEATER_SUPPLIES_CHANGED_EVENT, refresh);
    };
  }, []);

  return <HomeSupplyGraph supplies={supplies} embedded />;
}
