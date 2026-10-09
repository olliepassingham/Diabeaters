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

function snapshotText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function buildUsagePageSnapshot(fields: UsagePageSnapshotFields): string {
  return JSON.stringify({
    userDisplayName: snapshotText(fields.userDisplayName),
    appRegion: fields.appRegion,
    emergencyNumber: snapshotText(fields.emergencyNumber),
    bgUnits: fields.bgUnits,
    carbUnits: fields.carbUnits,
    deliveryMethod: fields.deliveryMethod,
    bodyWeightInput: snapshotText(fields.bodyWeightInput),
    weightDisplayUnit: fields.weightDisplayUnit,
    dateOfBirth: normalizeDateOfBirthInput(snapshotText(fields.dateOfBirth) || null) ?? "",
    shortActingUnitsPerDay: snapshotText(fields.shortActingUnitsPerDay),
    longActingUnitsPerDay: snapshotText(fields.longActingUnitsPerDay),
    shortActingInjectionsPerDay: snapshotText(fields.shortActingInjectionsPerDay),
    longActingInjectionsPerDay: snapshotText(fields.longActingInjectionsPerDay),
    primingUnits: snapshotText(fields.primingUnits),
    basalInjectionTime: snapshotText(fields.basalInjectionTime),
    basalInjectionTime2: snapshotText(fields.basalInjectionTime2),
    cgmDays: snapshotText(fields.cgmDays),
    siteChangeDays: snapshotText(fields.siteChangeDays),
    reservoirChangeDays: snapshotText(fields.reservoirChangeDays),
    reservoirCapacity: snapshotText(fields.reservoirCapacity),
    unitsPerInsulinPen: snapshotText(fields.unitsPerInsulinPen),
    needlesPerBox: snapshotText(fields.needlesPerBox),
    infusionSetsPerBox: snapshotText(fields.infusionSetsPerBox),
    reservoirsPerBox: snapshotText(fields.reservoirsPerBox),
    insulinCartridgeUnits: snapshotText(fields.insulinCartridgeUnits),
    suppliesSmarterForecastEnabled: fields.suppliesSmarterForecastEnabled,
    usesClosedLoop: fields.usesClosedLoop,
  });
}

export function buildRatiosPageSnapshot(fields: RatiosPageSnapshotFields): string {
  return JSON.stringify({
    tdd: snapshotText(fields.tdd),
    breakfastRatio: snapshotText(fields.breakfastRatio),
    lunchRatio: snapshotText(fields.lunchRatio),
    dinnerRatio: snapshotText(fields.dinnerRatio),
    snackRatio: snapshotText(fields.snackRatio),
    correctionFactor: snapshotText(fields.correctionFactor),
    targetBgLow: snapshotText(fields.targetBgLow),
    targetBgHigh: snapshotText(fields.targetBgHigh),
    ratioFormat: fields.ratioFormat,
    carbPortionSize: snapshotText(fields.carbPortionSize),
  });
}
