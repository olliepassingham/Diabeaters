import { isPenDeliveryMethod, isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { seedPumpSuppliesIfNeeded, type PumpSupplySeedOptions } from "@/lib/pump-supplies";
import { ensureStarterCgmIfNeeded, seedMdiSuppliesIfNeeded } from "@/lib/starter-supplies";
import { seedDefaultTargetBgRangeIfNeeded } from "@/lib/starter-target-range";
import { isCommunityAccountProfile, storage } from "@/lib/storage";

/**
 * First-run (and empty-account) defaults for patient mode:
 * typical target range + delivery-method starter supplies.
 */
export function seedPatientFirstRunDefaultsIfNeeded(opts: PumpSupplySeedOptions = {}): {
  targetSeeded: boolean;
  suppliesSeeded: boolean;
  supplyCount: number;
} {
  const empty = { targetSeeded: false, suppliesSeeded: false, supplyCount: 0 };
  const profile = storage.getProfile();
  if (!profile || isCommunityAccountProfile(profile) || profile.usingInsulin === false) {
    return empty;
  }

  const target = seedDefaultTargetBgRangeIfNeeded();

  let suppliesSeeded = false;
  let supplyCount = 0;

  if (isPumpDeliveryMethod(profile.insulinDeliveryMethod)) {
    const r = seedPumpSuppliesIfNeeded(opts);
    suppliesSeeded = r.seeded;
    supplyCount = r.count;
  } else if (isPenDeliveryMethod(profile.insulinDeliveryMethod)) {
    const r = seedMdiSuppliesIfNeeded();
    suppliesSeeded = r.seeded;
    supplyCount = r.count;
  }

  const cgm = ensureStarterCgmIfNeeded();
  if (cgm.seeded) {
    suppliesSeeded = true;
    supplyCount += 1;
  }

  return {
    targetSeeded: target.seeded,
    suppliesSeeded,
    supplyCount,
  };
}
