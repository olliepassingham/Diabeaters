import { isType2AppSession } from "@/lib/insulin-clinical-access";
import { isPenDeliveryMethod, isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { seedPumpSuppliesIfNeeded, type PumpSupplySeedOptions } from "@/lib/pump-supplies";
import { ensureStarterCgmIfNeeded, seedMdiSuppliesIfNeeded } from "@/lib/starter-supplies";
import { seedType2SuppliesIfNeeded } from "@/lib/starter-type2-supplies";
import { seedStarterExerciseRoutineIfNeeded } from "@/lib/starter-exercise-routine";
import { seedDefaultTargetBgRangeIfNeeded } from "@/lib/starter-target-range";
import { isCommunityAccountProfile, storage } from "@/lib/storage";

/**
 * First-run (and empty-account) defaults for patient mode:
 * delivery-method starter supplies + example quick exercise. Target range is confirmed in Settings.
 * Type 2 gets a non-insulin starter kit (strips, lancets, tablets, optional CGM).
 */
export function seedPatientFirstRunDefaultsIfNeeded(opts: PumpSupplySeedOptions = {}): {
  targetSeeded: boolean;
  suppliesSeeded: boolean;
  supplyCount: number;
  exerciseSeeded: boolean;
} {
  const empty = { targetSeeded: false, suppliesSeeded: false, supplyCount: 0, exerciseSeeded: false };
  const profile = storage.getProfile();
  if (!profile || isCommunityAccountProfile(profile)) {
    return empty;
  }

  // Collapse clones from cloud reconcile / repeated starter seeds.
  storage.dedupeSuppliesByNameAndType();

  if (isType2AppSession(profile)) {
    const type2 = seedType2SuppliesIfNeeded();
    return {
      targetSeeded: false,
      suppliesSeeded: type2.seeded,
      supplyCount: type2.count,
      exerciseSeeded: false,
    };
  }

  if (profile.usingInsulin === false) {
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

  const exercise = seedStarterExerciseRoutineIfNeeded();

  return {
    targetSeeded: target.seeded,
    suppliesSeeded,
    supplyCount,
    exerciseSeeded: exercise.seeded,
  };
}
