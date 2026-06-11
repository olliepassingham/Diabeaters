import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import {
  storage,
  UserProfile,
  UserSettings,
  NotificationSettings,
  UK_DEFAULT_NEEDLES_PER_BOX,
  UK_DEFAULT_UNITS_PER_INSULIN_PEN,
} from "@/lib/storage";
import {
  Syringe,
  Activity,
  Save,
  Package,
  ArrowRight,
  Palette,
  Bell,
  Info,
  Users,
  AtSign,
  Building2,
  Sparkles,
  Cookie,
  Eye,
  MessageSquarePlus,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { rescheduleBedtimeReminders } from "@/lib/bedtime-reminders";
import { reschedulePumpChangeReminders } from "@/lib/pump-change-reminders";
import { seedPumpSuppliesIfNeeded } from "@/lib/pump-supplies";
import { syncNotificationPreferences } from "@/lib/notification-preferences";
import { ensureNativePushRegistered, resetNativePushRegistrationState } from "@/lib/push-tokens";
import { Link, useLocation } from "wouter";
import { DIABETES_TERMS } from "@/components/info-tooltip";
import { FieldLabelWithInfo, InlineInfoHint, StaticLabelWithInfo } from "@/components/ui/field-label-with-info";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseRatioToGramsPerUnit, gramsPerUnitToInputValue, parseInputToGramsPerUnit, formatRatioForStorage, formatRatioInputPlaceholder, formatRatioInputLabel } from "@/lib/ratio-utils";
import type { RatioFormat } from "@/lib/storage";
import { validateTDD, validateCorrectionFactor, validateTargetBgLow, validateTargetBgHigh, validateTargetRange, validateCarbRatio } from "@/lib/clinical-validation";
import { ClinicalWarningHint } from "@/components/clinical-warning";
import { PageHeader, PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { profileQueryKey, updateProfile, useProfile } from "@/lib/profile";
import { isEmailLike, resolveUserDisplayName } from "@/lib/user-display-name";
import {
  formatWeightInputFromKg,
  getBodyWeightKgFromProfile,
  getWeightDisplayUnitFromProfile,
  parseWeightInputToKg,
  profileWeightRequiredForHypo,
  type WeightDisplayUnit,
} from "@/lib/body-weight";
import { normalizeDateOfBirthInput } from "@/lib/user-age";
import { scrollToSettingsHashTarget } from "@/lib/settings-nav";
import { describePartialClinicalPrefsCloudSync, syncClinicalPrefsToCloud, syncRegionToCloud } from "@/lib/clinical-prefs-cloud-sync";
import {
  APP_REGION_OPTIONS,
  applyRegionUnitDefaults,
  type AppRegion,
  regionDefaults,
} from "@/lib/region";
import { getSupabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { SettingsAppearanceRoute } from "./appearance";
import { SettingsUsageRoute } from "./usage";
import { SettingsNotificationsRoute } from "./notifications";
import { SettingsAboutRoute } from "./about";
import { SettingsFeedbackRoute } from "./feedback";
import { SettingsRatiosRoute } from "./ratios";
import { SettingsDataBackupSection, SettingsHubGroup, SettingsHubNavLink, SettingsSectionHeader, SettingsSetupBanner } from "./shared";

/** Mobile save bars must sit above `BottomNav` (z-[100]); `bottom-0` + lower z-index left them untappable behind the tabs. */
const SETTINGS_MOBILE_STICKY_FOOTER =
  "md:hidden fixed left-0 right-0 z-[110] border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 bottom-[calc(var(--keyboard-inset-bottom,0px)+var(--bottom-nav-height,7.5rem))]";

function ProfileTab({
  userDisplayName,
  setUserDisplayName,
  appRegion,
  setAppRegion,
  emergencyNumber,
  setEmergencyNumber,
  bgUnits,
  setBgUnits,
  carbUnits,
  setCarbUnits,
  deliveryMethod,
  setDeliveryMethod,
  dateOfBirth,
  setDateOfBirth,
  bodyWeightInput,
  setBodyWeightInput,
  weightDisplayUnit,
  setWeightDisplayUnit,
  weightRequiredForHypo,
  onSave,
}: {
  userDisplayName: string;
  setUserDisplayName: (v: string) => void;
  appRegion: AppRegion;
  setAppRegion: (v: AppRegion) => void;
  emergencyNumber: string;
  setEmergencyNumber: (v: string) => void;
  bgUnits: string;
  setBgUnits: (v: string) => void;
  carbUnits: string;
  setCarbUnits: (v: string) => void;
  deliveryMethod: "pen" | "pump";
  setDeliveryMethod: (v: "pen" | "pump") => void;
  dateOfBirth: string;
  setDateOfBirth: (v: string) => void;
  bodyWeightInput: string;
  setBodyWeightInput: (v: string) => void;
  weightDisplayUnit: WeightDisplayUnit;
  setWeightDisplayUnit: (v: WeightDisplayUnit) => void;
  weightRequiredForHypo: boolean;
  onSave: () => void;
}) {
  const handleRegionChange = (next: AppRegion) => {
    if (next === appRegion) return;
    const offerUnits = window.confirm(
      `Change region to ${APP_REGION_OPTIONS.find((o) => o.value === next)?.label ?? next}? Update blood glucose and weight units to match this region?`,
    );
    setAppRegion(next);
    if (offerUnits) {
      const units = applyRegionUnitDefaults(next, { bgUnits, weightDisplayUnit });
      setBgUnits(units.bgUnits);
      setWeightDisplayUnit(units.weightDisplayUnit);
    }
    if (next === "OTHER" && !emergencyNumber.trim()) {
      setEmergencyNumber(regionDefaults("OTHER").emergencyNumber);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:p-4">
      <div className="space-y-1.5">
        <FieldLabelWithInfo
          htmlFor="user-display-name"
          info={<p>Shown on Help now and your emergency card so bystanders know who needs help.</p>}
        >
          Your name
        </FieldLabelWithInfo>
        <Input
          id="user-display-name"
          autoComplete="name"
          value={userDisplayName}
          onChange={(e) => setUserDisplayName(e.target.value)}
          placeholder="e.g. Ollie Passingham"
          data-testid="input-user-display-name"
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabelWithInfo
          htmlFor="app-region"
          info={
            <p>
              Sets emergency numbers and safety wording. Units below can be changed separately.
            </p>
          }
        >
          Region
        </FieldLabelWithInfo>
        <Select value={appRegion} onValueChange={(v) => handleRegionChange(v as AppRegion)}>
          <SelectTrigger id="app-region" data-testid="select-app-region">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APP_REGION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {appRegion === "OTHER" ? (
        <div className="space-y-1.5">
          <Label htmlFor="emergency-number">Local emergency number</Label>
          <Input
            id="emergency-number"
            inputMode="tel"
            value={emergencyNumber}
            onChange={(e) => setEmergencyNumber(e.target.value)}
            data-testid="input-emergency-number"
          />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bg-units">Blood Glucose Units</Label>
          <Select value={bgUnits} onValueChange={setBgUnits}>
            <SelectTrigger id="bg-units" data-testid="select-bg-units">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mmol/L">mmol/L</SelectItem>
              <SelectItem value="mg/dL">mg/dL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="carb-units">Carbohydrate Units</Label>
          <Select value={carbUnits} onValueChange={setCarbUnits}>
            <SelectTrigger id="carb-units" data-testid="select-carb-units">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grams">Grams</SelectItem>
              <SelectItem value="portions-10g">Carb Portion (10g)</SelectItem>
              <SelectItem value="portions-15g">Carb Portion (15g)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabelWithInfo
          htmlFor="delivery-method"
          info={
            <p>
              {isPumpDeliveryMethod(deliveryMethod)
                ? "Using an insulin pump for continuous delivery."
                : "Using pens or syringes for injections (MDI)."}
            </p>
          }
        >
          Insulin Delivery Method
        </FieldLabelWithInfo>
        <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as "pen" | "pump")}>
          <SelectTrigger id="delivery-method" data-testid="select-delivery-method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pen">MDI (Multiple Daily Injections)</SelectItem>
            <SelectItem value="pump">Insulin Pump</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div id="settings-dob-section" className="scroll-mt-24 space-y-1.5">
        <FieldLabelWithInfo
          htmlFor="settings-dob"
          info={
            <div className="space-y-2">
              <p>
                Format: YYYY-MM-DD. We use this only to calculate age on this device for age-matched education (for
                example hypo and correction tools, and which situation guides appear). It syncs with your profile when you are
                signed in.
              </p>
              <p>
                It is not used for advertising. You can clear this field anytime if you prefer not to keep it here.
              </p>
              <p>
                How we handle personal data is summarised on our{" "}
                <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">
                  Privacy
                </Link>{" "}
                page.
              </p>
            </div>
          }
        >
          Date of birth <span className="text-muted-foreground font-normal">(optional)</span>
        </FieldLabelWithInfo>
        <Input
          id="settings-dob"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          data-testid="input-settings-dob"
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabelWithInfo
          htmlFor="settings-body-weight"
          info={
            <p>
              Used for hypo treatment estimates in Hypo help. Pre-fills the hypo calculator so you do not need to enter
              weight during a hypo. Stored on this device only. Update when your weight changes — especially important
              for under-18s.
            </p>
          }
        >
          Body weight {weightRequiredForHypo ? "(required for hypo help)" : "(optional)"}
        </FieldLabelWithInfo>
        <div className="flex gap-2">
          <Input
            id="settings-body-weight"
            type="number"
            inputMode="decimal"
            placeholder={weightDisplayUnit === "kg" ? "e.g. 70" : "e.g. 154"}
            value={bodyWeightInput}
            onChange={(e) => setBodyWeightInput(e.target.value)}
            className="flex-1"
            data-testid="input-settings-body-weight"
          />
          <div className="flex shrink-0">
            <Button
              type="button"
              variant={weightDisplayUnit === "kg" ? "default" : "outline"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setWeightDisplayUnit("kg")}
              data-testid="button-settings-weight-kg"
            >
              kg
            </Button>
            <Button
              type="button"
              variant={weightDisplayUnit === "lbs" ? "default" : "outline"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setWeightDisplayUnit("lbs")}
              data-testid="button-settings-weight-lbs"
            >
              lbs
            </Button>
          </div>
        </div>
      </div>
      <div className="hidden justify-end pt-1 md:flex">
        <Button onClick={onSave} data-testid="button-save-profile">
          <Save className="h-4 w-4 mr-2" />
          Save profile
        </Button>
      </div>
    </div>
  );
}

function InsulinTab({
  bgUnits, tdd, setTdd, correctionFactor, setCorrectionFactor,
  targetBgLow, setTargetBgLow, targetBgHigh, setTargetBgHigh,
  breakfastRatio, setBreakfastRatio, lunchRatio, setLunchRatio,
  dinnerRatio, setDinnerRatio, snackRatio, setSnackRatio,
  ratioFormat, onRatioFormatChange,
  carbPortionSize, onCarbPortionSizeChange,
  onSave
}: {
  bgUnits: string;
  tdd: string; setTdd: (v: string) => void;
  correctionFactor: string; setCorrectionFactor: (v: string) => void;
  targetBgLow: string; setTargetBgLow: (v: string) => void;
  targetBgHigh: string; setTargetBgHigh: (v: string) => void;
  breakfastRatio: string; setBreakfastRatio: (v: string) => void;
  lunchRatio: string; setLunchRatio: (v: string) => void;
  dinnerRatio: string; setDinnerRatio: (v: string) => void;
  snackRatio: string; setSnackRatio: (v: string) => void;
  ratioFormat: RatioFormat; onRatioFormatChange: (format: RatioFormat) => void;
  carbPortionSize: string; onCarbPortionSizeChange: (size: string) => void;
  onSave: () => void;
}) {
  const cpSize = carbPortionSize ? parseFloat(carbPortionSize) : undefined;
  const ratioFormatLabel = formatRatioInputLabel(ratioFormat, cpSize);
  const ratioFormatPlaceholder = formatRatioInputPlaceholder(ratioFormat);

  const diabetesTermInfo = (term: { explanation: string; example?: string }, extra?: string) => (
    <div className="space-y-2">
      <p>{term.explanation}</p>
      {term.example ? <p className="italic text-primary/80">Example: {term.example}</p> : null}
      {extra ? <p>{extra}</p> : null}
    </div>
  );

  const mealRatioFields: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    testId: string;
  }[] = [
    { id: "breakfast-ratio", label: "Breakfast", value: breakfastRatio, onChange: setBreakfastRatio, testId: "breakfast" },
    { id: "lunch-ratio", label: "Lunch", value: lunchRatio, onChange: setLunchRatio, testId: "lunch" },
    { id: "dinner-ratio", label: "Dinner", value: dinnerRatio, onChange: setDinnerRatio, testId: "dinner" },
    { id: "snack-ratio", label: "Snack", value: snackRatio, onChange: setSnackRatio, testId: "snack" },
  ];

  return (
    <>
      <div className="space-y-4 pb-28 md:pb-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <FieldLabelWithInfo
              htmlFor="tdd"
              info={diabetesTermInfo(DIABETES_TERMS.tdd, "Enter your typical total units per day.")}
            >
              Total Daily Dose (TDD)
            </FieldLabelWithInfo>
            <Input id="tdd" type="number" placeholder="e.g., 40" value={tdd} onChange={(e) => setTdd(e.target.value)} data-testid="input-tdd" />
            <ClinicalWarningHint warning={validateTDD(tdd)} />
          </div>
          <div className="space-y-1.5">
            <FieldLabelWithInfo
              htmlFor="correction-factor"
              info={diabetesTermInfo(
                DIABETES_TERMS.correctionFactor,
                `How much 1 unit lowers your blood sugar (${bgUnits}).`,
              )}
            >
              Correction Factor
            </FieldLabelWithInfo>
            <Input id="correction-factor" type="number" step="0.1" placeholder={bgUnits === "mmol/L" ? "e.g., 3" : "e.g., 50"} value={correctionFactor} onChange={(e) => setCorrectionFactor(e.target.value)} data-testid="input-correction-factor" />
            <ClinicalWarningHint warning={validateCorrectionFactor(correctionFactor, bgUnits)} />
          </div>
          <div className="space-y-1.5">
            <StaticLabelWithInfo
              ariaLabel="About target range"
              info={diabetesTermInfo(DIABETES_TERMS.targetRange)}
            >
              Target Range ({bgUnits})
            </StaticLabelWithInfo>
            <div className="flex items-center gap-2">
              <Input id="target-bg-low" type="number" placeholder="Low" value={targetBgLow} onChange={(e) => setTargetBgLow(e.target.value)} data-testid="input-target-bg-low" aria-label={`Target low (${bgUnits})`} />
              <span className="text-muted-foreground" aria-hidden>
                -
              </span>
              <Input id="target-bg-high" type="number" placeholder="High" value={targetBgHigh} onChange={(e) => setTargetBgHigh(e.target.value)} data-testid="input-target-bg-high" aria-label={`Target high (${bgUnits})`} />
            </div>
            <ClinicalWarningHint warning={validateTargetBgLow(targetBgLow, bgUnits)} />
            <ClinicalWarningHint warning={validateTargetBgHigh(targetBgHigh, bgUnits)} />
            <ClinicalWarningHint warning={validateTargetRange(targetBgLow, targetBgHigh)} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <StaticLabelWithInfo
              labelClassName="text-sm font-medium"
              ariaLabel="About ratio format"
              info={
                <p>
                  Choose how you enter carb coverage: units per 10g, units per carb portion (CP), or grams of carbs per
                  1 unit.
                </p>
              }
            >
              Ratio format
            </StaticLabelWithInfo>
            <RadioGroup value={ratioFormat} onValueChange={(v) => onRatioFormatChange(v as RatioFormat)} className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="per10g" id="ratio-format-per10g" data-testid="radio-ratio-format-per10g" />
                <Label htmlFor="ratio-format-per10g" className="text-sm cursor-pointer">
                  Units:10g
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="perCP" id="ratio-format-perCP" data-testid="radio-ratio-format-perCP" />
                <Label htmlFor="ratio-format-perCP" className="text-sm cursor-pointer">
                  Units:1 CP
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="1toXg" id="ratio-format-1toXg" data-testid="radio-ratio-format-1toXg" />
                <Label htmlFor="ratio-format-1toXg" className="text-sm cursor-pointer">
                  1 unit:Xg
                </Label>
              </div>
            </RadioGroup>
          </div>

          {ratioFormat === "perCP" && (
            <div className="flex flex-wrap items-center gap-3">
              <StaticLabelWithInfo
                labelClassName="text-sm text-muted-foreground font-normal"
                ariaLabel="About carb portion size"
                info={<p>How many grams of carbohydrate count as one carb portion (CP) in your ratios.</p>}
              >
                1 Carb Portion (CP) =
              </StaticLabelWithInfo>
              <div className="flex items-center gap-2">
                {["10", "12", "15"].map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={carbPortionSize === size ? "default" : "outline"}
                    size="sm"
                    onClick={() => onCarbPortionSizeChange(size)}
                    data-testid={`button-cp-size-${size}`}
                  >
                    {size}g
                  </Button>
                ))}
                <Input
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  className="w-20"
                  placeholder="Custom"
                  value={!["10", "12", "15"].includes(carbPortionSize) ? carbPortionSize : ""}
                  onChange={(e) => onCarbPortionSizeChange(e.target.value)}
                  data-testid="input-cp-size-custom"
                  aria-label="Custom carb portion size in grams"
                />
                <span className="text-sm text-muted-foreground">g</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <StaticLabelWithInfo
              labelClassName="text-sm font-medium"
              ariaLabel="About carb ratios"
              info={
                <div className="space-y-2">
                  {diabetesTermInfo(DIABETES_TERMS.carbRatio)}
                  <p>
                    Enter values as <strong>{ratioFormatLabel}</strong>. Placeholder shows the expected format.
                  </p>
                </div>
              }
            >
              Carb ratios ({ratioFormatLabel})
            </StaticLabelWithInfo>
            <Link
              href="/adviser?tab=ratios"
              className="text-xs text-primary flex items-center gap-1 hover:underline shrink-0"
              data-testid="link-go-ratio-adviser"
            >
              Ratio Adviser
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {mealRatioFields.map((meal) => (
              <div key={meal.id} className="space-y-1.5">
                <Label htmlFor={meal.id} className="text-sm">
                  {meal.label}
                </Label>
                <Input
                  id={meal.id}
                  type="number"
                  step="0.1"
                  placeholder={ratioFormatPlaceholder}
                  value={meal.value}
                  onChange={(e) => meal.onChange(e.target.value)}
                  data-testid={`input-${meal.testId}-ratio`}
                />
                <ClinicalWarningHint
                  warning={validateCarbRatio(parseInputToGramsPerUnit(meal.value, ratioFormat, cpSize))}
                />
                <p className="text-xs text-muted-foreground">{ratioFormatLabel}</p>
              </div>
            ))}
          </div>
        </div>

          <div className="hidden md:flex justify-end">
            <Button onClick={onSave} className="rounded-xl" data-testid="button-save-insulin">
              <Save className="h-4 w-4 mr-2" />
              Save Insulin Settings
            </Button>
          </div>
        </div>

      {/* Mobile-only sticky action bar for long forms */}
      <div className={SETTINGS_MOBILE_STICKY_FOOTER}>
        <div className="mx-auto w-full max-w-lg px-4 pt-3 pb-3">
          <Button onClick={onSave} className="h-11 w-full rounded-xl" data-testid="button-save-insulin-sticky">
            <Save className="h-4 w-4 mr-2" />
            Save Insulin Settings
          </Button>
        </div>
      </div>
    </>
  );
}

function UsageTab({
  isPumpUser, tdd,
  shortActingUnitsPerDay, setShortActingUnitsPerDay,
  longActingUnitsPerDay, setLongActingUnitsPerDay,
  shortActingInjectionsPerDay, setShortActingInjectionsPerDay,
  longActingInjectionsPerDay, setLongActingInjectionsPerDay,
  primingUnits, setPrimingUnits,
  basalInjectionTime, setBasalInjectionTime,
  basalInjectionTime2, setBasalInjectionTime2,
  cgmDays, setCgmDays,
  siteChangeDays, setSiteChangeDays,
  reservoirChangeDays, setReservoirChangeDays,
  reservoirCapacity, setReservoirCapacity,
  unitsPerInsulinPen, setUnitsPerInsulinPen,
  needlesPerBox, setNeedlesPerBox,
  infusionSetsPerBox, setInfusionSetsPerBox,
  reservoirsPerBox, setReservoirsPerBox,
  insulinCartridgeUnits, setInsulinCartridgeUnits,
  suppliesSmarterForecastEnabled, setSuppliesSmarterForecastEnabled,
  usesClosedLoop, setUsesClosedLoop,
  onSave
}: {
  isPumpUser: boolean; tdd: string;
  shortActingUnitsPerDay: string; setShortActingUnitsPerDay: (v: string) => void;
  longActingUnitsPerDay: string; setLongActingUnitsPerDay: (v: string) => void;
  shortActingInjectionsPerDay: string; setShortActingInjectionsPerDay: (v: string) => void;
  longActingInjectionsPerDay: string; setLongActingInjectionsPerDay: (v: string) => void;
  primingUnits: string; setPrimingUnits: (v: string) => void;
  basalInjectionTime: string; setBasalInjectionTime: (v: string) => void;
  basalInjectionTime2: string; setBasalInjectionTime2: (v: string) => void;
  cgmDays: string; setCgmDays: (v: string) => void;
  siteChangeDays: string; setSiteChangeDays: (v: string) => void;
  reservoirChangeDays: string; setReservoirChangeDays: (v: string) => void;
  reservoirCapacity: string; setReservoirCapacity: (v: string) => void;
  unitsPerInsulinPen: string; setUnitsPerInsulinPen: (v: string) => void;
  needlesPerBox: string; setNeedlesPerBox: (v: string) => void;
  infusionSetsPerBox: string; setInfusionSetsPerBox: (v: string) => void;
  reservoirsPerBox: string; setReservoirsPerBox: (v: string) => void;
  insulinCartridgeUnits: string; setInsulinCartridgeUnits: (v: string) => void;
  suppliesSmarterForecastEnabled: boolean; setSuppliesSmarterForecastEnabled: (v: boolean) => void;
  usesClosedLoop: boolean; setUsesClosedLoop: (v: boolean) => void;
  onSave: () => void;
}) {
  const usageFieldInputClass = "h-10 border-border/60 bg-background/85 shadow-none";
  const usageSelectTriggerClass = "h-10 rounded-xl border-border/60 bg-background/85";
  const longActingInjCount = parseInt(longActingInjectionsPerDay || "0", 10) || 0;
  const showSecondBasalTime = !isPumpUser && longActingInjCount === 2;
  const unitsPerPenLabel = unitsPerInsulinPen || String(UK_DEFAULT_UNITS_PER_INSULIN_PEN);

  return (
    <div className="space-y-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/15 px-3 py-2 sm:px-3 sm:py-2">
          <div className="min-w-0 flex-1">
            <StaticLabelWithInfo
              ariaLabel="About smarter supply forecast"
              info={
                <p>Optional: refine burn rate from recent adjustments and refills (last 7 days).</p>
              }
            >
              Smarter supply forecast
            </StaticLabelWithInfo>
          </div>
          <Switch
            className="shrink-0"
            checked={suppliesSmarterForecastEnabled}
            onCheckedChange={(v) => setSuppliesSmarterForecastEnabled(v)}
            data-testid="switch-smarter-supplies-forecast"
          />
        </div>

        {isPumpUser ? (
          <div className="rounded-xl border border-border/50 bg-muted/10 p-3 sm:p-4 space-y-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <StaticLabelWithInfo
                  ariaLabel="About closed loop"
                  info={
                    <p>
                      Turn on if you use hybrid or full closed loop (e.g. Control-IQ, Loop, CamAPS). Exercise and
                      temp-basal tips will be softened because your pump may adjust automatically.
                    </p>
                  }
                >
                  Hybrid / closed loop
                </StaticLabelWithInfo>
              </div>
              <Switch
                className="shrink-0"
                checked={usesClosedLoop}
                onCheckedChange={(v) => setUsesClosedLoop(v)}
                data-testid="switch-closed-loop"
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Pump &amp; CGM</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <StaticLabelWithInfo
                labelClassName="text-sm"
                ariaLabel="About total daily dose"
                info={
                  <div className="space-y-2">
                    <p>Uses your TDD from Insulin Settings (Ratios).</p>
                    <p>
                      If you use <strong>hybrid closed loop</strong> (e.g. Control-IQ, Loop), exercise and temp-basal
                      tips in this app may overlap what automation already does — follow your care team and device manuals
                      first.
                    </p>
                  </div>
                }
              >
                Total Daily Dose
              </StaticLabelWithInfo>
              <div className="flex h-10 items-center rounded-xl border border-border/60 bg-background/85 px-3">
                <span className={`text-sm ${tdd ? "" : "text-muted-foreground"}`}>
                  {tdd ? `${tdd} units/day` : "Set under Ratios below"}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabelWithInfo htmlFor="reservoir-capacity" info={<p>Units per cartridge.</p>}>
                Reservoir Capacity
              </FieldLabelWithInfo>
              <Input id="reservoir-capacity" className={usageFieldInputClass} type="number" placeholder="e.g., 300" value={reservoirCapacity} onChange={(e) => setReservoirCapacity(e.target.value)} data-testid="input-reservoir-capacity" />
            </div>
            <div className="space-y-1.5">
              <FieldLabelWithInfo htmlFor="site-change-days" info={<p>How often you change infusion sets.</p>}>
                Site Change Interval
              </FieldLabelWithInfo>
              <Select value={siteChangeDays} onValueChange={setSiteChangeDays}>
                <SelectTrigger id="site-change-days" className={usageSelectTriggerClass} data-testid="select-site-change-days"><SelectValue placeholder="Days" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Every 2 days</SelectItem>
                  <SelectItem value="3">Every 3 days</SelectItem>
                  <SelectItem value="4">Every 4 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabelWithInfo htmlFor="reservoir-change-days" info={<p>How often you change reservoirs.</p>}>
                Reservoir Change Interval
              </FieldLabelWithInfo>
              <Select value={reservoirChangeDays} onValueChange={setReservoirChangeDays}>
                <SelectTrigger id="reservoir-change-days" className={usageSelectTriggerClass} data-testid="select-reservoir-change-days"><SelectValue placeholder="Days" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Every 2 days</SelectItem>
                  <SelectItem value="3">Every 3 days</SelectItem>
                  <SelectItem value="4">Every 4 days</SelectItem>
                  <SelectItem value="5">Every 5 days</SelectItem>
                  <SelectItem value="7">Every 7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabelWithInfo
                htmlFor="cgm-days"
                info={<p>Typical wear window for your sensor (often 7–14 days).</p>}
              >
                CGM Sensor Duration (days)
              </FieldLabelWithInfo>
              <Input id="cgm-days" className={usageFieldInputClass} type="number" placeholder="e.g., 10" value={cgmDays} onChange={(e) => setCgmDays(e.target.value)} data-testid="input-cgm-days" />
            </div>
          </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-muted/10 p-3 sm:p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Typical day (MDI)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabelWithInfo
                htmlFor="short-acting-units"
                info={<p>{unitsPerPenLabel} units = 1 pen.</p>}
              >
                Short-Acting Units/Day
              </FieldLabelWithInfo>
              <Input id="short-acting-units" className={usageFieldInputClass} type="number" placeholder="e.g., 25" value={shortActingUnitsPerDay} onChange={(e) => setShortActingUnitsPerDay(e.target.value)} data-testid="input-short-acting-units" />
            </div>
            <div className="space-y-1.5">
              <FieldLabelWithInfo
                htmlFor="long-acting-units"
                info={<p>{unitsPerPenLabel} units = 1 pen.</p>}
              >
                Long-Acting Units/Day
              </FieldLabelWithInfo>
              <Input id="long-acting-units" className={usageFieldInputClass} type="number" placeholder="e.g., 20" value={longActingUnitsPerDay} onChange={(e) => setLongActingUnitsPerDay(e.target.value)} data-testid="input-long-acting-units" />
            </div>
            <div className="space-y-1.5">
              <FieldLabelWithInfo htmlFor="short-acting-injections" info={<p>Meals + corrections.</p>}>
                Short-Acting Injections/Day
              </FieldLabelWithInfo>
              <Input id="short-acting-injections" className={usageFieldInputClass} type="number" placeholder="e.g., 3" value={shortActingInjectionsPerDay} onChange={(e) => setShortActingInjectionsPerDay(e.target.value)} data-testid="input-short-acting-injections" />
            </div>
            <div className="space-y-1.5">
              <FieldLabelWithInfo htmlFor="long-acting-injections" info={<p>Basal doses (usually 1 or 2).</p>}>
                Long-Acting Injections/Day
              </FieldLabelWithInfo>
              <Input id="long-acting-injections" className={usageFieldInputClass} type="number" placeholder="e.g., 1" value={longActingInjectionsPerDay} onChange={(e) => setLongActingInjectionsPerDay(e.target.value)} data-testid="input-long-acting-injections" />
            </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-background/40 p-2.5 sm:p-3">
              <div className="space-y-1.5">
              {showSecondBasalTime ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabelWithInfo
                      htmlFor="settings-basal-time"
                      info={
                        <p>
                          Home clock time; used for travel insulin timing (MDI) when you cross time zones (both basal
                          doses).
                        </p>
                      }
                    >
                      First long-acting time
                    </FieldLabelWithInfo>
                    <Input
                      id="settings-basal-time"
                      className={`${usageFieldInputClass} w-full max-w-[12rem]`}
                      type="time"
                      value={basalInjectionTime}
                      onChange={(e) => setBasalInjectionTime(e.target.value)}
                      data-testid="input-settings-basal-time"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabelWithInfo
                      htmlFor="settings-basal-time-2"
                      info={
                        <p>
                          Home clock time; used for travel insulin timing (MDI) when you cross time zones (both basal
                          doses).
                        </p>
                      }
                    >
                      Second long-acting time
                    </FieldLabelWithInfo>
                    <Input
                      id="settings-basal-time-2"
                      className={`${usageFieldInputClass} w-full max-w-[12rem]`}
                      type="time"
                      value={basalInjectionTime2}
                      onChange={(e) => setBasalInjectionTime2(e.target.value)}
                      data-testid="input-settings-basal-time-2"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <FieldLabelWithInfo
                    htmlFor="settings-basal-time"
                    info={
                      <p>
                        Home clock time; used for travel insulin timing (MDI) when you cross time zones.
                      </p>
                    }
                  >
                    Usual long-acting injection time
                  </FieldLabelWithInfo>
                  <Input
                    id="settings-basal-time"
                    className={`${usageFieldInputClass} w-full max-w-[12rem]`}
                    type="time"
                    value={basalInjectionTime}
                    onChange={(e) => setBasalInjectionTime(e.target.value)}
                    data-testid="input-settings-basal-time"
                  />
                </div>
              )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabelWithInfo
                htmlFor="priming-units"
                info={
                  <div className="space-y-2">
                    <p>{DIABETES_TERMS.penPriming.explanation}</p>
                    <p>Units you expel before each injection.</p>
                  </div>
                }
              >
                Pen Priming (units)
              </FieldLabelWithInfo>
              <Input id="priming-units" className={usageFieldInputClass} type="number" min="0" max="5" step="0.5" placeholder="e.g., 2" value={primingUnits} onChange={(e) => setPrimingUnits(e.target.value)} data-testid="input-priming-units" />
            </div>
            <div className="space-y-1.5">
              <FieldLabelWithInfo
                htmlFor="cgm-days-mdi"
                info={<p>Typical wear window for your sensor (often 7–14 days).</p>}
              >
                CGM Sensor Duration (days)
              </FieldLabelWithInfo>
              <Input id="cgm-days-mdi" className={usageFieldInputClass} type="number" placeholder="e.g., 10" value={cgmDays} onChange={(e) => setCgmDays(e.target.value)} data-testid="input-cgm-days" />
            </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border/50 bg-muted/10 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <StaticLabelWithInfo
              ariaLabel="About supply pack sizes"
              info={
                <p>
                  Set how many units come in each pack or box you pick up. This controls the +/- buttons in Supply
                  Tracker so one tap adds a whole pen or box.
                </p>
              }
            >
              Supply pack sizes
            </StaticLabelWithInfo>
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isPumpUser ? (
              <>
                <div className="space-y-1.5">
                  <FieldLabelWithInfo htmlFor="insulin-cartridge-units" info={<p>Units in one cartridge or vial.</p>}>
                    Units per Insulin Cartridge
                  </FieldLabelWithInfo>
                  <Input id="insulin-cartridge-units" className={usageFieldInputClass} type="number" min="1" placeholder="e.g., 300" value={insulinCartridgeUnits} onChange={(e) => setInsulinCartridgeUnits(e.target.value)} data-testid="input-insulin-cartridge-units" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithInfo htmlFor="infusion-sets-per-box" info={<p>Sets in one box.</p>}>
                    Infusion Sets per Box
                  </FieldLabelWithInfo>
                  <Input id="infusion-sets-per-box" className={usageFieldInputClass} type="number" min="1" placeholder="e.g., 10" value={infusionSetsPerBox} onChange={(e) => setInfusionSetsPerBox(e.target.value)} data-testid="input-infusion-sets-per-box" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithInfo htmlFor="reservoirs-per-box" info={<p>Reservoirs in one box.</p>}>
                    Reservoirs per Box
                  </FieldLabelWithInfo>
                  <Input id="reservoirs-per-box" className={usageFieldInputClass} type="number" min="1" placeholder="e.g., 10" value={reservoirsPerBox} onChange={(e) => setReservoirsPerBox(e.target.value)} data-testid="input-reservoirs-per-box" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <FieldLabelWithInfo htmlFor="units-per-pen" info={<p>Units in one disposable pen.</p>}>
                    Units per Insulin Pen
                  </FieldLabelWithInfo>
                  <Input
                    id="units-per-pen"
                    className={usageFieldInputClass}
                    type="number"
                    min="1"
                    placeholder={`e.g., ${UK_DEFAULT_UNITS_PER_INSULIN_PEN}`}
                    value={unitsPerInsulinPen}
                    onChange={(e) => setUnitsPerInsulinPen(e.target.value)}
                    data-testid="input-units-per-pen"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithInfo htmlFor="needles-per-box" info={<p>Needles or lancets in one box.</p>}>
                    Needles per Box
                  </FieldLabelWithInfo>
                  <Input
                    id="needles-per-box"
                    className={usageFieldInputClass}
                    type="number"
                    min="1"
                    placeholder={`e.g., ${UK_DEFAULT_NEEDLES_PER_BOX}`}
                    value={needlesPerBox}
                    onChange={(e) => setNeedlesPerBox(e.target.value)}
                    data-testid="input-needles-per-box"
                  />
                </div>
              </>
            )}
          </div>
        </div>

      <div className="hidden justify-end pt-1 md:flex">
        <Button onClick={onSave} data-testid="button-save-usage">
          <Save className="h-4 w-4 mr-2" />
          Save usage
        </Button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { profile: cloudProfile } = useProfile();
  const [location, setLocation] = useLocation();
  const { data: linkedPatient } = useLinkedPatient();
  const isCarer = !!linkedPatient;
  const pathOnly = (location.split("?")[0] ?? "/settings").replace(/\/$/, "") || "/settings";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>({});
  const [userDisplayName, setUserDisplayName] = useState("");

  const [bgUnits, setBgUnits] = useState("mmol/L");
  const [carbUnits, setCarbUnits] = useState("grams");
  const [deliveryMethod, setDeliveryMethod] = useState<"pen" | "pump">("pen");
  const [bodyWeightInput, setBodyWeightInput] = useState("");
  const [weightDisplayUnit, setWeightDisplayUnit] = useState<WeightDisplayUnit>("kg");
  const [appRegion, setAppRegion] = useState<AppRegion>("UK");
  const [emergencyNumber, setEmergencyNumber] = useState("");

  const [tdd, setTdd] = useState("");
  const [breakfastRatio, setBreakfastRatio] = useState("");
  const [lunchRatio, setLunchRatio] = useState("");
  const [dinnerRatio, setDinnerRatio] = useState("");
  const [snackRatio, setSnackRatio] = useState("");
  const [correctionFactor, setCorrectionFactor] = useState("");
  const [targetBgLow, setTargetBgLow] = useState("");
  const [targetBgHigh, setTargetBgHigh] = useState("");
  const [ratioFormat, setRatioFormat] = useState<RatioFormat>("per10g");
  const [carbPortionSize, setCarbPortionSize] = useState("10");
  
  const [shortActingUnitsPerDay, setShortActingUnitsPerDay] = useState("");
  const [longActingUnitsPerDay, setLongActingUnitsPerDay] = useState("");
  const [injectionsPerDay, setInjectionsPerDay] = useState("");
  const [shortActingInjectionsPerDay, setShortActingInjectionsPerDay] = useState("");
  const [longActingInjectionsPerDay, setLongActingInjectionsPerDay] = useState("");
  const [primingUnits, setPrimingUnits] = useState("");
  const [basalInjectionTime, setBasalInjectionTime] = useState("22:00");
  const [basalInjectionTime2, setBasalInjectionTime2] = useState("");
  const [cgmDays, setCgmDays] = useState("");
  const [siteChangeDays, setSiteChangeDays] = useState("");
  const [reservoirChangeDays, setReservoirChangeDays] = useState("");
  const [reservoirCapacity, setReservoirCapacity] = useState("");
  const [unitsPerInsulinPen, setUnitsPerInsulinPen] = useState("");
  const [needlesPerBox, setNeedlesPerBox] = useState("");
  const [infusionSetsPerBox, setInfusionSetsPerBox] = useState("");
  const [reservoirsPerBox, setReservoirsPerBox] = useState("");
  const [insulinCartridgeUnits, setInsulinCartridgeUnits] = useState("");
  const [suppliesSmarterForecastEnabled, setSuppliesSmarterForecastEnabled] = useState(false);
  const [usesClosedLoop, setUsesClosedLoop] = useState(false);
  
  const isCommunityAccount = profile?.accountType === "community";
  const hidePatientClinicalHub = isCarer || isCommunityAccount;

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    enabled: true,
    pushNotifications: true,
    supplyAlerts: true,
    criticalThresholdDays: 3,
    lowThresholdDays: 7,
    appointmentReminders: true,
    supporterAppointmentReminders: true,
    appointmentAlerts: true,
    hypoAlerts: true,
    scenarioAlerts: true,
    hypoDashboardQuickNotify: false,
    communityFeedAlerts: true,
    communityDmAlerts: true,
  });
  
  useEffect(() => {
    const nd = normalizeDateOfBirthInput(cloudProfile?.date_of_birth ?? null);
    if (!nd) return;
    setProfile((prev) => {
      const base = prev ?? storage.getProfile();
      if (!base) return prev;
      if (base.dateOfBirth?.trim()) return prev;
      return { ...base, dateOfBirth: nd };
    });
  }, [cloudProfile?.date_of_birth]);

  useEffect(() => {
    const local = storage.getProfile();
    const resolved = resolveUserDisplayName({
      cloudFullName: cloudProfile?.full_name,
      localName: local?.name,
    });
    if (resolved) setUserDisplayName(resolved);
  }, [cloudProfile?.full_name]);

  useEffect(() => {
    const storedProfile = storage.getProfile();
    const storedSettings = storage.getSettings();
    
    const defaultProfile: UserProfile = {
      name: "",
      email: "",
      dateOfBirth: "",
      bgUnits: "mmol/L",
      carbUnits: "grams",
      diabetesType: "type1",
      insulinDeliveryMethod: "pen",
      usingInsulin: true,
      hasAcceptedDisclaimer: true,
    };
    
    if (storedProfile) {
      setProfile(storedProfile);
      const resolvedName = resolveUserDisplayName({
        cloudFullName: cloudProfile?.full_name,
        localName: storedProfile.name,
      });
      if (resolvedName) setUserDisplayName(resolvedName);
      setBgUnits(storedProfile.bgUnits || "mmol/L");
      setCarbUnits(storedProfile.carbUnits || "grams");
      setDeliveryMethod((storedProfile.insulinDeliveryMethod as "pen" | "pump") || "pen");
      const unit = getWeightDisplayUnitFromProfile(storedProfile);
      setWeightDisplayUnit(unit);
      const kg = getBodyWeightKgFromProfile(storedProfile);
      setBodyWeightInput(kg != null ? formatWeightInputFromKg(kg, unit) : "");
      setAppRegion(storedProfile.region ?? "UK");
      setEmergencyNumber(storedProfile.emergencyNumber ?? "");
    } else {
      setProfile(defaultProfile);
      setBodyWeightInput("");
      setWeightDisplayUnit("kg");
    }

    const format: RatioFormat = storedProfile?.ratioFormat || "per10g";
    setRatioFormat(format);
    setCarbPortionSize(storedProfile?.carbPortionSize?.toString() || "10");
    
    if (storedSettings) {
      setSettings(storedSettings);
      setTdd(storedSettings.tdd?.toString() || "");
      const cpSize = storedProfile?.carbPortionSize;
      const bGpu = parseRatioToGramsPerUnit(storedSettings.breakfastRatio);
      setBreakfastRatio(bGpu ? gramsPerUnitToInputValue(bGpu, format, cpSize) : "");
      const lGpu = parseRatioToGramsPerUnit(storedSettings.lunchRatio);
      setLunchRatio(lGpu ? gramsPerUnitToInputValue(lGpu, format, cpSize) : "");
      const dGpu = parseRatioToGramsPerUnit(storedSettings.dinnerRatio);
      setDinnerRatio(dGpu ? gramsPerUnitToInputValue(dGpu, format, cpSize) : "");
      const sGpu = parseRatioToGramsPerUnit(storedSettings.snackRatio);
      setSnackRatio(sGpu ? gramsPerUnitToInputValue(sGpu, format, cpSize) : "");
      setCorrectionFactor(storedSettings.correctionFactor?.toString() || "");
      setTargetBgLow(storedSettings.targetBgLow?.toString() || "");
      setTargetBgHigh(storedSettings.targetBgHigh?.toString() || "");
      setShortActingUnitsPerDay(storedSettings.shortActingUnitsPerDay?.toString() || "");
      setLongActingUnitsPerDay(storedSettings.longActingUnitsPerDay?.toString() || "");
      setInjectionsPerDay(storedSettings.injectionsPerDay?.toString() || "");
      const hasLegacyTotal = storedSettings.injectionsPerDay && storedSettings.injectionsPerDay > 0;
      const hasSplit = storedSettings.shortActingInjectionsPerDay || storedSettings.longActingInjectionsPerDay;
      if (hasLegacyTotal && !hasSplit) {
        const total = storedSettings.injectionsPerDay!;
        const longInj = Math.min(total, 1);
        const shortInj = total - longInj;
        setShortActingInjectionsPerDay(shortInj > 0 ? shortInj.toString() : "");
        setLongActingInjectionsPerDay(longInj.toString());
      } else {
        setShortActingInjectionsPerDay(storedSettings.shortActingInjectionsPerDay?.toString() || "");
        setLongActingInjectionsPerDay(storedSettings.longActingInjectionsPerDay?.toString() || "");
      }
      setPrimingUnits(storedSettings.primingUnitsPerInjection?.toString() || "");
      setBasalInjectionTime(storedSettings.basalInjectionTime || "22:00");
      setBasalInjectionTime2(storedSettings.basalInjectionTime2 || "");
      setCgmDays(storedSettings.cgmDays?.toString() || "");
      setSiteChangeDays(storedSettings.siteChangeDays?.toString() || "3");
      setReservoirChangeDays(storedSettings.reservoirChangeDays?.toString() || "3");
      setReservoirCapacity(storedSettings.reservoirCapacity?.toString() || "300");
      setUnitsPerInsulinPen(
        storedSettings.unitsPerInsulinPen ? String(storedSettings.unitsPerInsulinPen) : String(UK_DEFAULT_UNITS_PER_INSULIN_PEN),
      );
      setNeedlesPerBox(
        storedSettings.needlesPerBox ? String(storedSettings.needlesPerBox) : String(UK_DEFAULT_NEEDLES_PER_BOX),
      );
      setInfusionSetsPerBox(storedSettings.infusionSetsPerBox?.toString() || "");
      setReservoirsPerBox(storedSettings.reservoirsPerBox?.toString() || "");
      setInsulinCartridgeUnits(storedSettings.insulinCartridgeUnits?.toString() || "");
      setSuppliesSmarterForecastEnabled(!!storedSettings.suppliesSmarterForecastEnabled);
      setUsesClosedLoop(!!storedSettings.usesClosedLoop);
    } else {
      setSiteChangeDays("3");
      setReservoirChangeDays("3");
      setReservoirCapacity("300");
      setUnitsPerInsulinPen(String(UK_DEFAULT_UNITS_PER_INSULIN_PEN));
      setNeedlesPerBox(String(UK_DEFAULT_NEEDLES_PER_BOX));
    }
    
    setNotifSettings(storage.getNotificationSettings());
  }, []);

  useEffect(() => {
    if (
      hidePatientClinicalHub &&
      (pathOnly === "/settings/usage" || pathOnly === "/settings/ratios" || pathOnly === "/settings/pharmacy" || pathOnly === "/settings/carb-sources")
    ) {
      setLocation("/settings");
    }
  }, [hidePatientClinicalHub, pathOnly, setLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathOnly !== "/settings") return;

    const qs = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
    const tab = new URLSearchParams(qs).get("tab");
    const emergencyEdit = isCarer ? "/carer-view#carer-emergency" : "/account#account-emergency";
    const tabRoutes: Record<string, string> = {
      profile: "/settings/usage#settings-personal",
      insulin: "/settings/ratios",
      usage: "/settings/usage#settings-usage",
      notifications: "/settings/notifications",
      contacts: emergencyEdit,
      data: "/settings/usage#settings-backup",
      appearance: "/settings/appearance",
      sources: "/medical-sources",
      about: "/settings/about",
    };
    if (tab && tabRoutes[tab]) {
      setLocation(tabRoutes[tab]);
      return;
    }

    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;
    const hashRoutes: Record<string, string> = {
      "settings-personal": "/settings/usage#settings-personal",
      "settings-dob": "/settings/usage#settings-dob",
      "settings-dob-section": "/settings/usage#settings-dob-section",
      "settings-ratios": "/settings/ratios",
      "settings-usage": "/settings/usage#settings-usage",
      "settings-usage-tools": "/settings/usage",
      "settings-notifications": "/settings/notifications",
      "settings-appearance": "/settings/appearance",
      "settings-about": "/settings/about",
      "settings-emergency": emergencyEdit,
      notifications: "/settings/notifications",
      "emergency-contacts": emergencyEdit,
      "usual-habits": "/settings/usage#settings-usage",
      data: "/settings/usage#settings-backup",
      sources: "/medical-sources",
      insulin: "/settings/ratios",
    };
    const target = hashRoutes[raw];
    if (target) setLocation(target);
  }, [location, pathOnly, setLocation, isCarer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathOnly === "/settings") return;
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;

    let cancelled = false;
    const isDobHash = raw === "settings-dob" || raw === "settings-dob-section";

    const tryScroll = (attempt = 0) => {
      if (cancelled) return;
      let found = false;
      if (isDobHash) {
        const section = document.getElementById("settings-dob-section");
        const input = document.getElementById("settings-dob");
        const anchor = section ?? input;
        if (anchor) {
          anchor.scrollIntoView({ behavior: "smooth", block: "center" });
          if (input instanceof HTMLInputElement) {
            window.setTimeout(() => input.focus({ preventScroll: true }), 280);
          }
          found = true;
        }
      } else {
        found = scrollToSettingsHashTarget(raw);
      }
      if (!found && attempt < 15) {
        window.setTimeout(() => tryScroll(attempt + 1), 100);
      }
    };

    const t = window.setTimeout(() => tryScroll(), 50);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [location, pathOnly]);

  const handleSaveProfile = async (opts?: { quietSuccess?: boolean }): Promise<{
    ok: boolean;
    dateOfBirthCloudSkipped?: boolean;
    insulinDeliveryMethodCloudSkipped?: boolean;
    tddCloudSkipped?: boolean;
  }> => {
    const base = profile ?? storage.getProfile();
    if (!base) return { ok: false };
    const nameTrim = userDisplayName.trim();
    if (nameTrim && isEmailLike(nameTrim)) {
      toast({
        title: "Use your real name",
        description: "Your name cannot be an email address. Help now shows this to bystanders.",
        variant: "destructive",
      });
      return { ok: false };
    }
    const normalizedDob = normalizeDateOfBirthInput(base.dateOfBirth?.trim() || null);
    const parsedKg = parseWeightInputToKg(bodyWeightInput, weightDisplayUnit);
    if (profileWeightRequiredForHypo(normalizedDob) && parsedKg == null) {
      toast({
        title: "Weight required",
        description: "Add body weight for hypo treatment estimates (required for under-18s and when date of birth is not set).",
        variant: "destructive",
      });
      return { ok: false };
    }
    const updatedProfile = {
      ...base,
      name: nameTrim,
      bgUnits,
      carbUnits,
      insulinDeliveryMethod: deliveryMethod,
      dateOfBirth: normalizedDob ?? "",
      bodyWeightKg: parsedKg ?? undefined,
      weightDisplayUnit,
      region: appRegion,
      emergencyNumber: emergencyNumber.trim() || undefined,
    };
    const wasPump = isPumpDeliveryMethod(base.insulinDeliveryMethod);
    storage.saveProfile(updatedProfile);
    setProfile(updatedProfile);

    if (isPumpDeliveryMethod(deliveryMethod)) {
      seedPumpSuppliesIfNeeded({
        tdd: settings.tdd,
        siteChangeDays: siteChangeDays ? parseInt(siteChangeDays, 10) : undefined,
        reservoirChangeDays: reservoirChangeDays ? parseInt(reservoirChangeDays, 10) : undefined,
        reservoirCapacity: reservoirCapacity ? parseInt(reservoirCapacity, 10) : undefined,
      });
      if (!wasPump) void reschedulePumpChangeReminders();
    }

    let cloud: Awaited<ReturnType<typeof syncClinicalPrefsToCloud>> = { error: null };
    if (user?.id) {
      if (nameTrim) {
        const nameCloud = await updateProfile({ id: user.id, full_name: nameTrim });
        if (nameCloud.error) {
          toast({
            title: "Saved on this device",
            description: `Could not sync your name: ${nameCloud.error.message}`,
            variant: "destructive",
          });
          return { ok: false };
        }
        void queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
      }
      cloud = await syncClinicalPrefsToCloud(user.id);
      const regionCloud = await syncRegionToCloud(user.id);
      if (cloud.error) {
        toast({
          title: "Saved on this device",
          description: `Could not sync to your account: ${cloud.error.message}`,
          variant: "destructive",
        });
        return { ok: false };
      }
      if (regionCloud.error) {
        toast({
          title: "Saved on this device",
          description: `Region saved locally; cloud sync failed: ${regionCloud.error.message}`,
          variant: "destructive",
        });
      }
    }

    if (!opts?.quietSuccess) {
      const partial = describePartialClinicalPrefsCloudSync(cloud);
      toast({
        title: "Saved",
        description: partial
          ? `Your personal settings have been updated. ${partial}`
          : "Your personal settings have been updated.",
      });
    }

    return {
      ok: true,
      dateOfBirthCloudSkipped: cloud.dateOfBirthCloudSkipped,
      insulinDeliveryMethodCloudSkipped: cloud.insulinDeliveryMethodCloudSkipped,
      tddCloudSkipped: cloud.tddCloudSkipped,
    };
  };

  const handleRatioFormatChange = (newFormat: RatioFormat) => {
    const oldFormat = ratioFormat;
    const cpSize = carbPortionSize ? parseFloat(carbPortionSize) : undefined;
    const convertValue = (val: string) => {
      if (!val) return "";
      const gpu = parseInputToGramsPerUnit(val, oldFormat, cpSize);
      return gpu ? gramsPerUnitToInputValue(gpu, newFormat, cpSize) : val;
    };
    setBreakfastRatio(convertValue(breakfastRatio));
    setLunchRatio(convertValue(lunchRatio));
    setDinnerRatio(convertValue(dinnerRatio));
    setSnackRatio(convertValue(snackRatio));
    setRatioFormat(newFormat);
  };

  const handleCarbPortionSizeChange = (newSize: string) => {
    const oldCpSize = carbPortionSize ? parseFloat(carbPortionSize) : undefined;
    const newCpSize = newSize ? parseFloat(newSize) : undefined;
    setCarbPortionSize(newSize);
    if (ratioFormat === "perCP" && newCpSize && newCpSize > 0) {
      const convertValue = (val: string) => {
        if (!val) return "";
        const gpu = parseInputToGramsPerUnit(val, "perCP", oldCpSize);
        return gpu ? gramsPerUnitToInputValue(gpu, "perCP", newCpSize) : val;
      };
      setBreakfastRatio(convertValue(breakfastRatio));
      setLunchRatio(convertValue(lunchRatio));
      setDinnerRatio(convertValue(dinnerRatio));
      setSnackRatio(convertValue(snackRatio));
    }
  };

  const handleSaveInsulin = async () => {
    const cpSize = carbPortionSize ? parseFloat(carbPortionSize) : undefined;
    const bGpu = parseInputToGramsPerUnit(breakfastRatio, ratioFormat, cpSize);
    const lGpu = parseInputToGramsPerUnit(lunchRatio, ratioFormat, cpSize);
    const dGpu = parseInputToGramsPerUnit(dinnerRatio, ratioFormat, cpSize);
    const sGpu = parseInputToGramsPerUnit(snackRatio, ratioFormat, cpSize);
    const newSettings: UserSettings = {
      ...settings,
      tdd: tdd ? parseFloat(tdd) : undefined,
      breakfastRatio: bGpu ? formatRatioForStorage(bGpu) : undefined,
      lunchRatio: lGpu ? formatRatioForStorage(lGpu) : undefined,
      dinnerRatio: dGpu ? formatRatioForStorage(dGpu) : undefined,
      snackRatio: sGpu ? formatRatioForStorage(sGpu) : undefined,
      correctionFactor: correctionFactor ? parseFloat(correctionFactor) : undefined,
      targetBgLow: targetBgLow ? parseFloat(targetBgLow) : undefined,
      targetBgHigh: targetBgHigh ? parseFloat(targetBgHigh) : undefined,
    };
    storage.saveSettings(newSettings);
    setSettings(newSettings);
    if (newSettings.tdd && newSettings.tdd > 0) {
      storage.syncSettingsToSupplyUsage("tdd", newSettings.tdd);
    }
    if (profile) {
      const updatedProfile = { ...profile, ratioFormat, carbPortionSize: cpSize && cpSize > 0 ? cpSize : undefined };
      storage.saveProfile(updatedProfile);
      setProfile(updatedProfile);
    }
    let cloud: Awaited<ReturnType<typeof syncClinicalPrefsToCloud>> = { error: null };
    if (user?.id) {
      cloud = await syncClinicalPrefsToCloud(user.id);
      if (cloud.error) {
        toast({
          title: "Insulin settings saved on this device",
          description: `Could not sync TDD to your account: ${cloud.error.message}`,
          variant: "destructive",
        });
        return;
      }
    }
    const partial = describePartialClinicalPrefsCloudSync(cloud);
    toast({
      title: "Insulin settings saved",
      description: partial
        ? `Your insulin settings have been updated. ${partial}`
        : "Your insulin settings have been updated.",
    });
  };

  const handleSaveUsage = (opts?: { quietSuccess?: boolean }) => {
    const longInjParsed = longActingInjectionsPerDay ? parseInt(longActingInjectionsPerDay, 10) : 0;
    const newSettings: UserSettings = {
      ...settings,
      shortActingUnitsPerDay: shortActingUnitsPerDay ? parseInt(shortActingUnitsPerDay) : undefined,
      longActingUnitsPerDay: longActingUnitsPerDay ? parseInt(longActingUnitsPerDay) : undefined,
      shortActingInjectionsPerDay: shortActingInjectionsPerDay ? parseInt(shortActingInjectionsPerDay) : undefined,
      longActingInjectionsPerDay: longActingInjectionsPerDay ? parseInt(longActingInjectionsPerDay) : undefined,
      injectionsPerDay: (() => {
        const shortInj = shortActingInjectionsPerDay ? parseInt(shortActingInjectionsPerDay) : 0;
        const longInj = longActingInjectionsPerDay ? parseInt(longActingInjectionsPerDay) : 0;
        const total = shortInj + longInj;
        return total > 0 ? total : (injectionsPerDay ? parseInt(injectionsPerDay) : undefined);
      })(),
      primingUnitsPerInjection: primingUnits ? parseFloat(primingUnits) : undefined,
      basalInjectionTime: basalInjectionTime.trim() || undefined,
      basalInjectionTime2: longInjParsed === 2 && basalInjectionTime2.trim() ? basalInjectionTime2.trim() : undefined,
      cgmDays: cgmDays ? parseInt(cgmDays) : undefined,
      siteChangeDays: siteChangeDays ? parseInt(siteChangeDays) : undefined,
      reservoirChangeDays: reservoirChangeDays ? parseInt(reservoirChangeDays) : undefined,
      reservoirCapacity: reservoirCapacity ? parseInt(reservoirCapacity) : undefined,
      unitsPerInsulinPen: Math.max(1, parseInt(unitsPerInsulinPen || String(UK_DEFAULT_UNITS_PER_INSULIN_PEN), 10) || UK_DEFAULT_UNITS_PER_INSULIN_PEN),
      needlesPerBox: Math.max(1, parseInt(needlesPerBox || String(UK_DEFAULT_NEEDLES_PER_BOX), 10) || UK_DEFAULT_NEEDLES_PER_BOX),
      infusionSetsPerBox: infusionSetsPerBox ? Math.max(1, parseInt(infusionSetsPerBox)) : undefined,
      reservoirsPerBox: reservoirsPerBox ? Math.max(1, parseInt(reservoirsPerBox)) : undefined,
      insulinCartridgeUnits: insulinCartridgeUnits ? Math.max(1, parseInt(insulinCartridgeUnits)) : undefined,
      suppliesSmarterForecastEnabled,
      usesClosedLoop: isPumpDeliveryMethod(deliveryMethod) ? usesClosedLoop : undefined,
    };
    storage.saveSettings(newSettings);
    setSettings(newSettings);
    if (isPumpDeliveryMethod(deliveryMethod)) {
      void reschedulePumpChangeReminders();
    }
    const syncKeys = ["injectionsPerDay", "shortActingUnitsPerDay", "longActingUnitsPerDay"] as const;
    for (const key of syncKeys) {
      const val = newSettings[key] as number | undefined;
      if (val && val > 0) {
        storage.syncSettingsToSupplyUsage(key, val);
      }
    }
    if (!opts?.quietSuccess) {
      toast({ title: "Usage settings saved", description: "Your supply usage settings have been updated." });
    }
  };

  const handleSaveUsagePage = async () => {
    const save = await handleSaveProfile({ quietSuccess: true });
    if (!save.ok) return;
    handleSaveUsage({ quietSuccess: true });
    const partial = describePartialClinicalPrefsCloudSync({
      error: null,
      dateOfBirthCloudSkipped: save.dateOfBirthCloudSkipped,
      insulinDeliveryMethodCloudSkipped: save.insulinDeliveryMethodCloudSkipped,
      tddCloudSkipped: save.tddCloudSkipped,
    });
    toast({
      title: "Saved",
      description: partial
        ? `Personal & usage settings are updated on this device. ${partial}`
        : "Personal & usage settings are updated on this device.",
    });
  };

  const isPumpUser = isPumpDeliveryMethod(deliveryMethod);

  const handleNotifToggle = (key: keyof NotificationSettings, value: boolean) => {
    const updated = { ...notifSettings, [key]: value };
    setNotifSettings(updated);
    storage.saveNotificationSettings(updated);
    void syncNotificationPreferences(updated);
    if (key === "pushNotifications") {
      if (!value) {
        resetNativePushRegistrationState();
      } else {
        resetNativePushRegistrationState();
        void ensureNativePushRegistered();
      }
    }
    if (key === "bedtimeCheckReminders" || key === "enabled") {
      void rescheduleBedtimeReminders();
    }
    if (key === "pumpChangeReminders" || key === "enabled") {
      void reschedulePumpChangeReminders();
    }
  };

  const handleBedtimeReminderTime = (time: string) => {
    const updated = { ...notifSettings, bedtimeReminderTime: time };
    setNotifSettings(updated);
    storage.saveNotificationSettings(updated);
    void syncNotificationPreferences(updated);
    void rescheduleBedtimeReminders();
  };

  const handleNotifThreshold = (key: "criticalThresholdDays" | "lowThresholdDays", value: string) => {
    const numValue = parseInt(value) || 0;
    const updated = { ...notifSettings, [key]: numValue };
    setNotifSettings(updated);
    storage.saveNotificationSettings(updated);
    void syncNotificationPreferences(updated);
  };

  const settingsInfoDialog = (
    <PageInfoDialog title="About Settings" description="Configure your personal diabetes management preferences">
      <InfoSection title="Personal & usage">
        <p>Your units, insulin habits, supply pack sizes, and backup.</p>
      </InfoSection>
      <InfoSection title="Appearance">
        <p>Light, dark, or Auto (matches your device), plus primary accent colour.</p>
      </InfoSection>
      <InfoSection title="Notifications">
        <p>
          Hypo alerts, supply trend alerts, travel and sick-day guide alerts, community feed likes and comments.
        </p>
      </InfoSection>
      <InfoSection title="About">
        <p>
          Version, privacy, terms, support, third-party references, and medical disclaimers. Backup and restore is at
          the bottom of Personal & usage.
        </p>
      </InfoSection>
    </PageInfoDialog>
  );

  const usageToolsInner = (
    <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5 md:space-y-6 pb-36 md:pb-6">
      <section id="settings-personal" className="scroll-mt-24 space-y-2.5">
        <SettingsSectionHeader
          title="Personal & units"
          description="Your name (for Help now), region, units, delivery method, body weight, and optional date of birth."
        />
        <ProfileTab
          userDisplayName={userDisplayName}
          setUserDisplayName={setUserDisplayName}
          appRegion={appRegion}
          setAppRegion={setAppRegion}
          emergencyNumber={emergencyNumber}
          setEmergencyNumber={setEmergencyNumber}
          bgUnits={bgUnits}
          setBgUnits={setBgUnits}
          carbUnits={carbUnits}
          setCarbUnits={setCarbUnits}
          deliveryMethod={deliveryMethod}
          setDeliveryMethod={setDeliveryMethod}
          dateOfBirth={profile?.dateOfBirth ?? ""}
          setDateOfBirth={(v) =>
            setProfile((p) => {
              const cur = p ?? storage.getProfile();
              if (cur) return { ...cur, dateOfBirth: v };
              return {
                name: "",
                email: "",
                dateOfBirth: v,
                bgUnits,
                carbUnits,
                diabetesType: "type1",
                insulinDeliveryMethod: deliveryMethod,
                usingInsulin: true,
                hasAcceptedDisclaimer: true,
              };
            })
          }
          bodyWeightInput={bodyWeightInput}
          setBodyWeightInput={setBodyWeightInput}
          weightDisplayUnit={weightDisplayUnit}
          setWeightDisplayUnit={setWeightDisplayUnit}
          weightRequiredForHypo={profileWeightRequiredForHypo(
            normalizeDateOfBirthInput(profile?.dateOfBirth?.trim() || null),
          )}
          onSave={() => void handleSaveProfile()}
        />
      </section>

      <section id="settings-usage" className="scroll-mt-24 space-y-2.5 border-t border-border/40 pt-5">
        <SettingsSectionHeader
          title="Usage & supplies"
          description="Daily habits, sensor timing, and pack sizes for the tracker."
        />
        <UsageTab
          isPumpUser={isPumpUser}
          tdd={tdd}
          shortActingUnitsPerDay={shortActingUnitsPerDay}
          setShortActingUnitsPerDay={setShortActingUnitsPerDay}
          longActingUnitsPerDay={longActingUnitsPerDay}
          setLongActingUnitsPerDay={setLongActingUnitsPerDay}
          shortActingInjectionsPerDay={shortActingInjectionsPerDay}
          setShortActingInjectionsPerDay={setShortActingInjectionsPerDay}
          longActingInjectionsPerDay={longActingInjectionsPerDay}
          setLongActingInjectionsPerDay={setLongActingInjectionsPerDay}
          primingUnits={primingUnits}
          setPrimingUnits={setPrimingUnits}
          basalInjectionTime={basalInjectionTime}
          setBasalInjectionTime={setBasalInjectionTime}
          basalInjectionTime2={basalInjectionTime2}
          setBasalInjectionTime2={setBasalInjectionTime2}
          cgmDays={cgmDays}
          setCgmDays={setCgmDays}
          siteChangeDays={siteChangeDays}
          setSiteChangeDays={setSiteChangeDays}
          reservoirChangeDays={reservoirChangeDays}
          setReservoirChangeDays={setReservoirChangeDays}
          reservoirCapacity={reservoirCapacity}
          setReservoirCapacity={setReservoirCapacity}
          unitsPerInsulinPen={unitsPerInsulinPen}
          setUnitsPerInsulinPen={setUnitsPerInsulinPen}
          needlesPerBox={needlesPerBox}
          setNeedlesPerBox={setNeedlesPerBox}
          infusionSetsPerBox={infusionSetsPerBox}
          setInfusionSetsPerBox={setInfusionSetsPerBox}
          reservoirsPerBox={reservoirsPerBox}
          setReservoirsPerBox={setReservoirsPerBox}
          insulinCartridgeUnits={insulinCartridgeUnits}
          setInsulinCartridgeUnits={setInsulinCartridgeUnits}
          suppliesSmarterForecastEnabled={suppliesSmarterForecastEnabled}
          setSuppliesSmarterForecastEnabled={setSuppliesSmarterForecastEnabled}
          usesClosedLoop={usesClosedLoop}
          setUsesClosedLoop={setUsesClosedLoop}
          onSave={() => handleSaveUsage()}
        />
      </section>

      <div id="settings-backup" className="scroll-mt-24 border-t border-border/40 pt-5" data-testid="card-account-backup">
        <SettingsDataBackupSection embedded />
      </div>

      <div className={SETTINGS_MOBILE_STICKY_FOOTER}>
        <div className="mx-auto w-full max-w-lg px-4 pt-2.5 pb-2.5">
          <Button
            type="button"
            className="h-11 w-full rounded-xl"
            data-testid="button-save-usage-page-sticky"
            onClick={() => void handleSaveUsagePage()}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );

  const ratiosToolsInner = (
    <div className="space-y-4 px-4 py-4 sm:p-5">
      <div id="settings-ratios" className="scroll-mt-28 space-y-3 pb-28 md:pb-0">
        <SettingsSectionHeader
          title="Insulin ratios"
          description="TDD, correction factor, targets, and meal ratios used across tools and advisers."
        />
        <InsulinTab
          bgUnits={bgUnits}
          tdd={tdd}
          setTdd={setTdd}
          correctionFactor={correctionFactor}
          setCorrectionFactor={setCorrectionFactor}
          targetBgLow={targetBgLow}
          setTargetBgLow={setTargetBgLow}
          targetBgHigh={targetBgHigh}
          setTargetBgHigh={setTargetBgHigh}
          breakfastRatio={breakfastRatio}
          setBreakfastRatio={setBreakfastRatio}
          lunchRatio={lunchRatio}
          setLunchRatio={setLunchRatio}
          dinnerRatio={dinnerRatio}
          setDinnerRatio={setDinnerRatio}
          snackRatio={snackRatio}
          setSnackRatio={setSnackRatio}
          ratioFormat={ratioFormat}
          onRatioFormatChange={handleRatioFormatChange}
          carbPortionSize={carbPortionSize}
          onCarbPortionSizeChange={handleCarbPortionSizeChange}
          onSave={handleSaveInsulin}
        />
      </div>
    </div>
  );

  if (pathOnly === "/settings") {
    const completion = storage.getSettingsCompletion();
    const showSoftSetupCard = completion.completed < completion.total;
    return (
      <PageShell variant="narrow" density="compact" className="space-y-4 pb-6">
        <PageHeader
          title="Settings"
          description={
            isCarer
              ? "Your supporter account, alerts, and appearance."
              : isCommunityAccount
                ? "Community profile, alerts, and appearance."
                : "Personal details, clinical defaults, alerts, and appearance."
          }
          actions={settingsInfoDialog}
        />

        <Link
          href="/settings/feedback"
          className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
          data-testid="link-settings-feedback"
        >
          <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/[0.05]">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <MessageSquarePlus className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Send feedback</span>
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide">
                    New
                  </Badge>
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  Suggestions and bug reports help us improve Diabeaters
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </CardContent>
          </Card>
        </Link>

        {!isCarer && !isCommunityAccount && showSoftSetupCard ? (
          <div className="space-y-2">
            <SettingsSetupBanner
              percentage={completion.percentage}
              completed={completion.completed}
              total={completion.total}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl text-xs">
                <Link href="/settings/ratios">Ratios &amp; TDD</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl text-xs">
                <Link href="/settings/usage#settings-usage">Usage &amp; supplies</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {!hidePatientClinicalHub && (
        <SettingsHubGroup title="Personal & clinical">
            <SettingsHubNavLink
              href="/settings/usage"
              label="Personal info & usage"
              description="Units, habits, and supply forecasts"
              icon={Activity}
            />
            <SettingsHubNavLink
              href="/settings/ratios"
              label="Ratios"
              description="TDD, targets, correction factor, meal ratios"
              icon={Syringe}
            />
            <SettingsHubNavLink
              href="/settings/carb-sources"
              label="Carb sources"
              description="Name your gels, drinks, and tablets — used in hypo and exercise advice"
              icon={Cookie}
            />
            <SettingsHubNavLink
              href="/settings/pharmacy"
              label="Your pharmacy"
              description="Name and weekly opening hours for collect-by hints"
              icon={Building2}
            />
          </SettingsHubGroup>
        )}

        {!isCarer && (
          <SettingsHubGroup title="Community">
            <SettingsHubNavLink
              href="/account#profile"
              label="Community profile"
              description="Name, handle, bio, and feed visibility"
              icon={AtSign}
            />
          </SettingsHubGroup>
        )}

        {isCommunityAccount && (
          <SettingsHubGroup title="Account type">
            <SettingsHubNavLink
              href="/carer-setup"
              label="Support someone with Type 1"
              description="Enter their invite code to switch to Supporter Mode"
              icon={Eye}
            />
            <SettingsHubNavLink
              href="/onboarding?upgrade=1"
              label="I have Type 1 diabetes / use insulin"
              description="Unlock supplies, meal planner, ratios, situation guides, and the full dashboard"
              icon={Sparkles}
            />
          </SettingsHubGroup>
        )}

        {!isCarer && !isCommunityAccount && (
          <SettingsHubGroup title="Family & sharing">
            <SettingsHubNavLink
              href="/family-carers"
              label="Family & supporters"
              description="Invite, link, and control what they can see"
              icon={Users}
            />
          </SettingsHubGroup>
        )}

        <SettingsHubGroup title="Appearance">
          <SettingsHubNavLink
            href="/settings/appearance"
            label="Theme & colour"
            description="Light, dark, Auto, and accent colour"
            icon={Palette}
          />
        </SettingsHubGroup>

        <SettingsHubGroup title="Notifications">
          <SettingsHubNavLink
            href="/settings/notifications"
            label="Alerts"
            description={
              isCarer
                ? "Feed, messages, and device alerts for your supporter account"
                : isCommunityAccount
                  ? "Feed, messages, and device alerts"
                  : "Hypo, trends, guides"
            }
            icon={Bell}
          />
        </SettingsHubGroup>

        <SettingsHubGroup title="Help & legal">
          <SettingsHubNavLink
            href="/settings/feedback"
            label="Send feedback"
            description="Suggestions and bug reports"
            icon={MessageSquarePlus}
            dataTestId="hub-link-settings-feedback"
          />
          <SettingsHubNavLink
            href="/settings/about"
            label="Version, legal & references"
            description="Privacy, terms, support, sources"
            icon={Info}
          />
        </SettingsHubGroup>
      </PageShell>
    );
  }

  if (pathOnly === "/settings/usage") {
    return <SettingsUsageRoute settingsInfoDialog={settingsInfoDialog} usageToolsInner={usageToolsInner} />;
  }

  if (pathOnly === "/settings/ratios") {
    return <SettingsRatiosRoute settingsInfoDialog={settingsInfoDialog} ratiosInner={ratiosToolsInner} />;
  }

  if (pathOnly === "/settings/appearance") {
    return <SettingsAppearanceRoute settingsInfoDialog={settingsInfoDialog} />;
  }

  if (pathOnly === "/settings/notifications") {
    return (
      <SettingsNotificationsRoute
        settingsInfoDialog={settingsInfoDialog}
        notifSettings={notifSettings}
        onToggle={handleNotifToggle}
        onThreshold={handleNotifThreshold}
        onBedtimeReminderTimeChange={handleBedtimeReminderTime}
        supporterMode={isCarer}
      />
    );
  }

  if (pathOnly === "/settings/about") {
    return <SettingsAboutRoute settingsInfoDialog={settingsInfoDialog} />;
  }

  if (pathOnly === "/settings/feedback") {
    return <SettingsFeedbackRoute settingsInfoDialog={settingsInfoDialog} />;
  }

  return (
    <PageShell variant="narrow" density="compact" className="space-y-4 pb-6">
      <PageHeader title="Settings" description="This section was moved." />
      <Button variant="outline" asChild className="rounded-xl">
        <Link href="/settings">Back to settings</Link>
      </Button>
    </PageShell>
  );
}
