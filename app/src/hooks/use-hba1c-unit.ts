import { useSyncExternalStore } from "react";
import { readHba1cUnit, subscribeHba1cUnit, writeHba1cUnit, type Hba1cUnit } from "@/lib/hba1c-units";

export function useHba1cUnit(): [Hba1cUnit, (unit: Hba1cUnit) => void] {
  const unit = useSyncExternalStore(subscribeHba1cUnit, readHba1cUnit, () => "percent" as const);
  return [unit, writeHba1cUnit];
}
