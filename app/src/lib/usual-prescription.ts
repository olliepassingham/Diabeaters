import {
  getSupplyIncrement,
  type SupplyType,
  type UsualPrescriptionItem,
} from "@/lib/storage";

export { getRepeatPrescriptionQuantity, supplyToUsualPrescriptionItem } from "@/lib/storage";

export function formatUsualItemQuantity(item: UsualPrescriptionItem): {
  primary: string;
  secondary?: string;
  packCount: number;
} {
  const inc = getSupplyIncrement(item.type);
  if (inc.amount > 1) {
    const packCount = Math.round((item.quantity / inc.amount) * 10) / 10;
    return {
      primary: `${packCount} ${inc.label}${packCount !== 1 ? "s" : ""}`,
      secondary: `${item.quantity} units`,
      packCount,
    };
  }
  return {
    primary: `${item.quantity} ${inc.label}${item.quantity !== 1 ? "s" : ""}`,
    packCount: item.quantity,
  };
}

export const USUAL_SUPPLY_TYPE_ACCENTS: Record<SupplyType, string> = {
  needle: "border-l-orange-500/80 bg-orange-500/[0.06]",
  insulin: "border-l-rose-500/80 bg-rose-500/[0.06]",
  insulin_short: "border-l-rose-500/80 bg-rose-500/[0.06]",
  insulin_long: "border-l-pink-500/80 bg-pink-500/[0.06]",
  insulin_vial: "border-l-fuchsia-500/80 bg-fuchsia-500/[0.06]",
  cgm: "border-l-violet-500/80 bg-violet-500/[0.06]",
  infusion_set: "border-l-cyan-500/80 bg-cyan-500/[0.06]",
  reservoir: "border-l-sky-500/80 bg-sky-500/[0.06]",
  other: "border-l-slate-500/80 bg-slate-500/[0.06]",
};

export const USUAL_SUPPLY_TYPE_BADGES: Record<SupplyType, string> = {
  needle: "bg-orange-500/10 text-orange-800 dark:text-orange-200",
  insulin: "bg-rose-500/10 text-rose-800 dark:text-rose-200",
  insulin_short: "bg-rose-500/10 text-rose-800 dark:text-rose-200",
  insulin_long: "bg-pink-500/10 text-pink-800 dark:text-pink-200",
  insulin_vial: "bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200",
  cgm: "bg-violet-500/10 text-violet-800 dark:text-violet-200",
  infusion_set: "bg-cyan-500/10 text-cyan-800 dark:text-cyan-200",
  reservoir: "bg-sky-500/10 text-sky-800 dark:text-sky-200",
  other: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};
