import type { AppRegion } from "@/lib/region";
import type { WeightDisplayUnit } from "@/lib/body-weight";
import type { RatioFormat } from "@/lib/storage";
import { normalizeDateOfBirthInput } from "@/lib/user-age";

export type UsagePageSnapshotFields = {
  userDisplayName: string;
  appRegion: AppRegion;
  emergencyNumber: string;
  bgUnits: string;
  carbUnits: string;
  deliveryMethod: "pen" | "pump";
  bodyWeightInput: string;
  weightDisplayUnit: WeightDisplayUnit;
  dateOfBirth: string;
  shortActingUnitsPerDay: string;
  longActingUnitsPerDay: string;
  shortActingInjectionsPerDay: string;
  longActingInjectionsPerDay: string;
  primingUnits: string;
  basalInjectionTime: string;
  basalInjectionTime2: string;
  cgmDays: string;
  siteChangeDays: string;
  reservoirChangeDays: string;
  reservoirCapacity: string;
  unitsPerInsulinPen: string;
  needlesPerBox: string;
  infusionSetsPerBox: string;
  reservoirsPerBox: string;
  insulinCartridgeUnits: string;
  suppliesSmarterForecastEnabled: boolean;
  usesClosedLoop: boolean;
};

export type RatiosPageSnapshotFields = {
  tdd: string;
  breakfastRatio: string;
  lunchRatio: string;
  dinnerRatio: string;
  snackRatio: string;
  correctionFactor: string;
  targetBgLow: string;
  targetBgHigh: string;
  ratioFormat: RatioFormat;
  carbPortionSize: string;
};

export function buildUsagePageSnapshot(fields: UsagePageSnapshotFields): string {
  return JSON.stringify({
    userDisplayName: fields.userDisplayName.trim(),
    appRegion: fields.appRegion,
    emergencyNumber: fields.emergencyNumber.trim(),
    bgUnits: fields.bgUnits,
    carbUnits: fields.carbUnits,
    deliveryMethod: fields.deliveryMethod,
    bodyWeightInput: fields.bodyWeightInput.trim(),
    weightDisplayUnit: fields.weightDisplayUnit,
    dateOfBirth: normalizeDateOfBirthInput(fields.dateOfBirth.trim() || null) ?? "",
    shortActingUnitsPerDay: fields.shortActingUnitsPerDay.trim(),
    longActingUnitsPerDay: fields.longActingUnitsPerDay.trim(),
    shortActingInjectionsPerDay: fields.shortActingInjectionsPerDay.trim(),
    longActingInjectionsPerDay: fields.longActingInjectionsPerDay.trim(),
    primingUnits: fields.primingUnits.trim(),
    basalInjectionTime: fields.basalInjectionTime.trim(),
    basalInjectionTime2: fields.basalInjectionTime2.trim(),
    cgmDays: fields.cgmDays.trim(),
    siteChangeDays: fields.siteChangeDays.trim(),
    reservoirChangeDays: fields.reservoirChangeDays.trim(),
    reservoirCapacity: fields.reservoirCapacity.trim(),
    unitsPerInsulinPen: fields.unitsPerInsulinPen.trim(),
    needlesPerBox: fields.needlesPerBox.trim(),
    infusionSetsPerBox: fields.infusionSetsPerBox.trim(),
    reservoirsPerBox: fields.reservoirsPerBox.trim(),
    insulinCartridgeUnits: fields.insulinCartridgeUnits.trim(),
    suppliesSmarterForecastEnabled: fields.suppliesSmarterForecastEnabled,
    usesClosedLoop: fields.usesClosedLoop,
  });
}

export function buildRatiosPageSnapshot(fields: RatiosPageSnapshotFields): string {
  return JSON.stringify({
    tdd: fields.tdd.trim(),
    breakfastRatio: fields.breakfastRatio.trim(),
    lunchRatio: fields.lunchRatio.trim(),
    dinnerRatio: fields.dinnerRatio.trim(),
    snackRatio: fields.snackRatio.trim(),
    correctionFactor: fields.correctionFactor.trim(),
    targetBgLow: fields.targetBgLow.trim(),
    targetBgHigh: fields.targetBgHigh.trim(),
    ratioFormat: fields.ratioFormat,
    carbPortionSize: fields.carbPortionSize.trim(),
  });
}
