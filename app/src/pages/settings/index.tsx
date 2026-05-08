import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";
import { FaceLogoWatermark } from "@/components/face-logo";
import { syncNotificationPreferences } from "@/lib/notification-preferences";
import { ensureIosPushRegistered, resetIosPushRegistrationState } from "@/lib/push-tokens";
import { Link, useLocation } from "wouter";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { FieldLabelWithInfo } from "@/components/ui/field-label-with-info";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseRatioToGramsPerUnit, gramsPerUnitToInputValue, parseInputToGramsPerUnit, formatRatioForStorage, formatRatioInputPlaceholder, formatRatioInputLabel } from "@/lib/ratio-utils";
import type { RatioFormat } from "@/lib/storage";
import { validateTDD, validateCorrectionFactor, validateTargetBgLow, validateTargetBgHigh, validateTargetRange, validateCarbRatio } from "@/lib/clinical-validation";
import { ClinicalWarningHint } from "@/components/clinical-warning";
import appPackage from "../../../package.json";
import { PageHeader, PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { profileQueryKey, useProfile } from "@/lib/profile";
import { normalizeDateOfBirthInput } from "@/lib/user-age";
import { describePartialClinicalPrefsCloudSync, syncClinicalPrefsToCloud } from "@/lib/clinical-prefs-cloud-sync";
import { getSupabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useLinkedPatient } from "@/hooks/use-linked-patient";
import { SettingsAppearanceRoute } from "./appearance";
import { SettingsUsageRoute } from "./usage";
import { SettingsNotificationsRoute } from "./notifications";
import { SettingsAboutRoute } from "./about";
import { SettingsRatiosRoute } from "./ratios";
import { SettingsDataBackupSection, SettingsHubGroup, SettingsHubNavLink } from "./shared";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";

/** Mobile save bars must sit above `BottomNav` (z-[100]); `bottom-0` + lower z-index left them untappable behind the tabs. */
const SETTINGS_MOBILE_STICKY_FOOTER =
  "md:hidden fixed left-0 right-0 z-[110] border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 bottom-[calc(var(--keyboard-inset-bottom,0px)+var(--bottom-nav-height,7.5rem))]";

function ProfileTab({
  bgUnits,
  setBgUnits,
  carbUnits,
  setCarbUnits,
  deliveryMethod,
  setDeliveryMethod,
  dateOfBirth,
  setDateOfBirth,
  onSave,
}: {
  bgUnits: string;
  setBgUnits: (v: string) => void;
  carbUnits: string;
  setCarbUnits: (v: string) => void;
  deliveryMethod: "pen" | "pump";
  setDeliveryMethod: (v: "pen" | "pump") => void;
  dateOfBirth: string;
  setDateOfBirth: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-2">
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
        <div className="space-y-2">
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
      <div className="space-y-2">
        <Label htmlFor="delivery-method">Insulin Delivery Method</Label>
        <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as "pen" | "pump")}>
          <SelectTrigger id="delivery-method" data-testid="select-delivery-method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pen">MDI (Multiple Daily Injections)</SelectItem>
            <SelectItem value="pump">Insulin Pump</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {deliveryMethod === "pump" ? "Using an insulin pump for continuous delivery" : "Using pens or syringes for injections"}
        </p>
      </div>
      <div className="space-y-2">
        <FieldLabelWithInfo
          htmlFor="settings-dob"
          info={
            <div className="space-y-2">
              <p>
                Format: YYYY-MM-DD. We use this only to calculate age on this device for age-matched education (for
                example hypo and correction tools, and which scenarios appear). It syncs with your profile when you are
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
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-primary" />
            <CardTitle className="text-h3 font-semibold">Insulin Settings</CardTitle>
          </div>
          <CardDescription className="text-body text-muted-foreground">
            Configure your insulin ratios and targets for calculations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-28 md:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tdd" className="flex items-center">
              Total Daily Dose (TDD)
              <InfoTooltip {...DIABETES_TERMS.tdd} />
            </Label>
            <Input id="tdd" type="number" placeholder="e.g., 40" value={tdd} onChange={(e) => setTdd(e.target.value)} data-testid="input-tdd" />
            <ClinicalWarningHint warning={validateTDD(tdd)} />
            <p className="text-xs text-muted-foreground">Units per day</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="correction-factor" className="flex items-center">
              Correction Factor
              <InfoTooltip {...DIABETES_TERMS.correctionFactor} />
            </Label>
            <Input id="correction-factor" type="number" step="0.1" placeholder={bgUnits === "mmol/L" ? "e.g., 3" : "e.g., 50"} value={correctionFactor} onChange={(e) => setCorrectionFactor(e.target.value)} data-testid="input-correction-factor" />
            <ClinicalWarningHint warning={validateCorrectionFactor(correctionFactor, bgUnits)} />
            <p className="text-xs text-muted-foreground">How much 1 unit lowers your blood sugar</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center">
              Target Range ({bgUnits})
              <InfoTooltip {...DIABETES_TERMS.targetRange} />
            </Label>
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Low" value={targetBgLow} onChange={(e) => setTargetBgLow(e.target.value)} data-testid="input-target-bg-low" />
              <span className="text-muted-foreground">-</span>
              <Input type="number" placeholder="High" value={targetBgHigh} onChange={(e) => setTargetBgHigh(e.target.value)} data-testid="input-target-bg-high" />
            </div>
            <ClinicalWarningHint warning={validateTargetBgLow(targetBgLow, bgUnits)} />
            <ClinicalWarningHint warning={validateTargetBgHigh(targetBgHigh, bgUnits)} />
            <ClinicalWarningHint warning={validateTargetRange(targetBgLow, targetBgHigh)} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <Label className="text-sm font-medium">Ratio format:</Label>
            <RadioGroup value={ratioFormat} onValueChange={(v) => onRatioFormatChange(v as RatioFormat)} className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="per10g" id="ratio-format-per10g" data-testid="radio-ratio-format-per10g" />
                <Label htmlFor="ratio-format-per10g" className="text-sm cursor-pointer">Units:10g</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="perCP" id="ratio-format-perCP" data-testid="radio-ratio-format-perCP" />
                <Label htmlFor="ratio-format-perCP" className="text-sm cursor-pointer">Units:1 CP</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="1toXg" id="ratio-format-1toXg" data-testid="radio-ratio-format-1toXg" />
                <Label htmlFor="ratio-format-1toXg" className="text-sm cursor-pointer">1 unit:Xg</Label>
              </div>
            </RadioGroup>
          </div>

          {ratioFormat === "perCP" && (
            <div className="flex items-center gap-3 flex-wrap">
              <Label className="text-sm text-muted-foreground">1 Carb Portion (CP) =</Label>
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
                />
                <span className="text-sm text-muted-foreground">g</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-sm font-medium flex items-center">
              Carb Ratios ({formatRatioInputLabel(ratioFormat, carbPortionSize ? parseFloat(carbPortionSize) : undefined)})
              <InfoTooltip {...DIABETES_TERMS.carbRatio} />
            </Label>
            <Link href="/adviser?tab=ratios" className="text-xs text-muted-foreground flex items-center gap-1 hover:underline" data-testid="link-go-ratio-adviser">
              Not sure? Try the Ratio Adviser
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="breakfast-ratio" className="text-xs text-muted-foreground">Breakfast</Label>
              <Input id="breakfast-ratio" type="number" step="0.1" placeholder={formatRatioInputPlaceholder(ratioFormat)} value={breakfastRatio} onChange={(e) => setBreakfastRatio(e.target.value)} data-testid="input-breakfast-ratio" />
              <ClinicalWarningHint warning={validateCarbRatio(parseInputToGramsPerUnit(breakfastRatio, ratioFormat, carbPortionSize ? parseFloat(carbPortionSize) : undefined))} />
              <p className="text-xs text-muted-foreground">{formatRatioInputLabel(ratioFormat, carbPortionSize ? parseFloat(carbPortionSize) : undefined)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lunch-ratio" className="text-xs text-muted-foreground">Lunch</Label>
              <Input id="lunch-ratio" type="number" step="0.1" placeholder={formatRatioInputPlaceholder(ratioFormat)} value={lunchRatio} onChange={(e) => setLunchRatio(e.target.value)} data-testid="input-lunch-ratio" />
              <ClinicalWarningHint warning={validateCarbRatio(parseInputToGramsPerUnit(lunchRatio, ratioFormat, carbPortionSize ? parseFloat(carbPortionSize) : undefined))} />
              <p className="text-xs text-muted-foreground">{formatRatioInputLabel(ratioFormat, carbPortionSize ? parseFloat(carbPortionSize) : undefined)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dinner-ratio" className="text-xs text-muted-foreground">Dinner</Label>
              <Input id="dinner-ratio" type="number" step="0.1" placeholder={formatRatioInputPlaceholder(ratioFormat)} value={dinnerRatio} onChange={(e) => setDinnerRatio(e.target.value)} data-testid="input-dinner-ratio" />
              <ClinicalWarningHint warning={validateCarbRatio(parseInputToGramsPerUnit(dinnerRatio, ratioFormat, carbPortionSize ? parseFloat(carbPortionSize) : undefined))} />
              <p className="text-xs text-muted-foreground">{formatRatioInputLabel(ratioFormat, carbPortionSize ? parseFloat(carbPortionSize) : undefined)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="snack-ratio" className="text-xs text-muted-foreground">Snack</Label>
              <Input id="snack-ratio" type="number" step="0.1" placeholder={formatRatioInputPlaceholder(ratioFormat)} value={snackRatio} onChange={(e) => setSnackRatio(e.target.value)} data-testid="input-snack-ratio" />
              <ClinicalWarningHint warning={validateCarbRatio(parseInputToGramsPerUnit(snackRatio, ratioFormat, carbPortionSize ? parseFloat(carbPortionSize) : undefined))} />
              <p className="text-xs text-muted-foreground">{formatRatioInputLabel(ratioFormat, carbPortionSize ? parseFloat(carbPortionSize) : undefined)}</p>
            </div>
          </div>
        </div>

          <div className="hidden md:flex justify-end">
            <Button onClick={onSave} data-testid="button-save-insulin">
              <Save className="h-4 w-4 mr-2" />
              Save Insulin Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mobile-only sticky action bar for long forms */}
      <div className={SETTINGS_MOBILE_STICKY_FOOTER}>
        <div className="mx-auto w-full max-w-screen-md px-4 pt-3 pb-3">
          <Button onClick={onSave} className="w-full" data-testid="button-save-insulin-sticky">
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
  onSave
}: {
  isPumpUser: boolean; tdd: string;
  shortActingUnitsPerDay: string; setShortActingUnitsPerDay: (v: string) => void;
  longActingUnitsPerDay: string; setLongActingUnitsPerDay: (v: string) => void;
  shortActingInjectionsPerDay: string; setShortActingInjectionsPerDay: (v: string) => void;
  longActingInjectionsPerDay: string; setLongActingInjectionsPerDay: (v: string) => void;
  primingUnits: string; setPrimingUnits: (v: string) => void;
  basalInjectionTime: string; setBasalInjectionTime: (v: string) => void;
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
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Smarter supply forecast</p>
            <p className="text-xs text-muted-foreground">
              Optional: use recent adjustments/refills to estimate burn rate (last 7 days).
            </p>
          </div>
          <Switch
            checked={suppliesSmarterForecastEnabled}
            onCheckedChange={(v) => setSuppliesSmarterForecastEnabled(v)}
            data-testid="switch-smarter-supplies-forecast"
          />
        </div>

        {isPumpUser ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Total Daily Dose</Label>
              <div className="h-9 px-3 rounded-md border bg-muted/50 flex items-center">
                <span className={tdd ? "" : "text-muted-foreground"}>
                  {tdd ? `${tdd} units/day` : "Set under Ratios below"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Uses your TDD from Insulin Settings</p>
              <p className="text-xs text-muted-foreground border-t border-border/60 pt-2 mt-2">
                If you use <strong>hybrid closed loop</strong> (e.g. Control-IQ, Loop), exercise and temp-basal tips in
                this app may overlap what automation already does — follow your care team and device manuals first.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservoir-capacity">Reservoir Capacity</Label>
              <Input id="reservoir-capacity" type="number" placeholder="e.g., 300" value={reservoirCapacity} onChange={(e) => setReservoirCapacity(e.target.value)} data-testid="input-reservoir-capacity" />
              <p className="text-xs text-muted-foreground">Units per cartridge</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-change-days">Site Change Interval</Label>
              <Select value={siteChangeDays} onValueChange={setSiteChangeDays}>
                <SelectTrigger id="site-change-days" data-testid="select-site-change-days"><SelectValue placeholder="Days" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Every 2 days</SelectItem>
                  <SelectItem value="3">Every 3 days</SelectItem>
                  <SelectItem value="4">Every 4 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">How often you change infusion sets</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservoir-change-days">Reservoir Change Interval</Label>
              <Select value={reservoirChangeDays} onValueChange={setReservoirChangeDays}>
                <SelectTrigger id="reservoir-change-days" data-testid="select-reservoir-change-days"><SelectValue placeholder="Days" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Every 2 days</SelectItem>
                  <SelectItem value="3">Every 3 days</SelectItem>
                  <SelectItem value="4">Every 4 days</SelectItem>
                  <SelectItem value="5">Every 5 days</SelectItem>
                  <SelectItem value="7">Every 7 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">How often you change reservoirs</p>
            </div>
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="cgm-days">CGM Sensor Duration (days)</Label>
              <Input id="cgm-days" type="number" placeholder="e.g., 10" value={cgmDays} onChange={(e) => setCgmDays(e.target.value)} data-testid="input-cgm-days" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="short-acting-units">Short-Acting Units/Day</Label>
              <Input id="short-acting-units" type="number" placeholder="e.g., 25" value={shortActingUnitsPerDay} onChange={(e) => setShortActingUnitsPerDay(e.target.value)} data-testid="input-short-acting-units" />
              <p className="text-xs text-muted-foreground">
                {unitsPerInsulinPen || String(UK_DEFAULT_UNITS_PER_INSULIN_PEN)} units = 1 pen
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="long-acting-units">Long-Acting Units/Day</Label>
              <Input id="long-acting-units" type="number" placeholder="e.g., 20" value={longActingUnitsPerDay} onChange={(e) => setLongActingUnitsPerDay(e.target.value)} data-testid="input-long-acting-units" />
              <p className="text-xs text-muted-foreground">
                {unitsPerInsulinPen || String(UK_DEFAULT_UNITS_PER_INSULIN_PEN)} units = 1 pen
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="short-acting-injections">Short-Acting Injections/Day</Label>
              <Input id="short-acting-injections" type="number" placeholder="e.g., 3" value={shortActingInjectionsPerDay} onChange={(e) => setShortActingInjectionsPerDay(e.target.value)} data-testid="input-short-acting-injections" />
              <p className="text-xs text-muted-foreground">Meals + corrections</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="long-acting-injections">Long-Acting Injections/Day</Label>
              <Input id="long-acting-injections" type="number" placeholder="e.g., 1" value={longActingInjectionsPerDay} onChange={(e) => setLongActingInjectionsPerDay(e.target.value)} data-testid="input-long-acting-injections" />
              <p className="text-xs text-muted-foreground">Basal doses (usually 1 or 2)</p>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="settings-basal-time">Usual long-acting injection time</Label>
              <Input
                id="settings-basal-time"
                type="time"
                value={basalInjectionTime}
                onChange={(e) => setBasalInjectionTime(e.target.value)}
                className="w-full max-w-[12rem]"
                data-testid="input-settings-basal-time"
              />
              <p className="text-xs text-muted-foreground">
                Home clock time; used for travel insulin timing (MDI) when you cross time zones.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <Label htmlFor="priming-units">Pen Priming (units)</Label>
                <InfoTooltip {...DIABETES_TERMS.penPriming} />
              </div>
              <Input id="priming-units" type="number" min="0" max="5" step="0.5" placeholder="e.g., 2" value={primingUnits} onChange={(e) => setPrimingUnits(e.target.value)} data-testid="input-priming-units" />
              <p className="text-xs text-muted-foreground">Units you expel before each injection</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cgm-days">CGM Sensor Duration (days)</Label>
              <Input id="cgm-days" type="number" placeholder="e.g., 10" value={cgmDays} onChange={(e) => setCgmDays(e.target.value)} data-testid="input-cgm-days" />
            </div>
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Supply Pack Sizes</Label>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Set how many units come in each pack or box you pick up. This controls the +/- buttons in Supply Tracker so one tap adds a whole pen or box.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {isPumpUser ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="insulin-cartridge-units">Units per Insulin Cartridge</Label>
                  <Input id="insulin-cartridge-units" type="number" min="1" placeholder="e.g., 300" value={insulinCartridgeUnits} onChange={(e) => setInsulinCartridgeUnits(e.target.value)} data-testid="input-insulin-cartridge-units" />
                  <p className="text-xs text-muted-foreground">Units in one cartridge/vial</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="infusion-sets-per-box">Infusion Sets per Box</Label>
                  <Input id="infusion-sets-per-box" type="number" min="1" placeholder="e.g., 10" value={infusionSetsPerBox} onChange={(e) => setInfusionSetsPerBox(e.target.value)} data-testid="input-infusion-sets-per-box" />
                  <p className="text-xs text-muted-foreground">Sets in one box</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reservoirs-per-box">Reservoirs per Box</Label>
                  <Input id="reservoirs-per-box" type="number" min="1" placeholder="e.g., 10" value={reservoirsPerBox} onChange={(e) => setReservoirsPerBox(e.target.value)} data-testid="input-reservoirs-per-box" />
                  <p className="text-xs text-muted-foreground">Reservoirs in one box</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="units-per-pen">Units per Insulin Pen</Label>
                  <Input
                    id="units-per-pen"
                    type="number"
                    min="1"
                    placeholder={`e.g., ${UK_DEFAULT_UNITS_PER_INSULIN_PEN}`}
                    value={unitsPerInsulinPen}
                    onChange={(e) => setUnitsPerInsulinPen(e.target.value)}
                    data-testid="input-units-per-pen"
                  />
                  <p className="text-xs text-muted-foreground">Units in one disposable pen</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="needles-per-box">Needles per Box</Label>
                  <Input
                    id="needles-per-box"
                    type="number"
                    min="1"
                    placeholder={`e.g., ${UK_DEFAULT_NEEDLES_PER_BOX}`}
                    value={needlesPerBox}
                    onChange={(e) => setNeedlesPerBox(e.target.value)}
                    data-testid="input-needles-per-box"
                  />
                  <p className="text-xs text-muted-foreground">Needles/lancets in one box</p>
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
  
  const [bgUnits, setBgUnits] = useState("mmol/L");
  const [carbUnits, setCarbUnits] = useState("grams");
  const [deliveryMethod, setDeliveryMethod] = useState<"pen" | "pump">("pen");
  
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
  
  const isCommunityAccount = profile?.accountType === "community";
  const hidePatientClinicalHub = isCarer || isCommunityAccount;

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    enabled: true,
    pushNotifications: true,
    supplyAlerts: true,
    criticalThresholdDays: 3,
    lowThresholdDays: 7,
    appointmentReminders: true,
    hypoAlerts: true,
    scenarioAlerts: true,
    hypoDashboardQuickNotify: true,
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
      setBgUnits(storedProfile.bgUnits || "mmol/L");
      setCarbUnits(storedProfile.carbUnits || "grams");
      setDeliveryMethod((storedProfile.insulinDeliveryMethod as "pen" | "pump") || "pen");
    } else {
      setProfile(defaultProfile);
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
      (pathOnly === "/settings/usage" || pathOnly === "/settings/ratios" || pathOnly === "/settings/pharmacy")
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
      sources: "/settings/about#settings-sources",
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
      sources: "/settings/about#settings-sources",
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
    const t = window.setTimeout(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(t);
  }, [location, pathOnly]);

  const handleSaveProfile = async (opts?: { quietSuccess?: boolean }): Promise<{
    ok: boolean;
    dateOfBirthCloudSkipped?: boolean;
    insulinDeliveryMethodCloudSkipped?: boolean;
    tddCloudSkipped?: boolean;
  }> => {
    const base = profile ?? storage.getProfile();
    if (!base) return { ok: false };
    const normalizedDob = normalizeDateOfBirthInput(base.dateOfBirth?.trim() || null);
    const updatedProfile = {
      ...base,
      bgUnits,
      carbUnits,
      insulinDeliveryMethod: deliveryMethod,
      dateOfBirth: normalizedDob ?? "",
    };
    storage.saveProfile(updatedProfile);
    setProfile(updatedProfile);

    let cloud: Awaited<ReturnType<typeof syncClinicalPrefsToCloud>> = { error: null };
    if (user?.id) {
      cloud = await syncClinicalPrefsToCloud(user.id);
      if (cloud.error) {
        toast({
          title: "Saved on this device",
          description: `Could not sync to your account: ${cloud.error.message}`,
          variant: "destructive",
        });
        return { ok: false };
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
    };
    storage.saveSettings(newSettings);
    setSettings(newSettings);
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
        ? `Profile and usage settings are updated on this device. ${partial}`
        : "Profile and usage settings are updated on this device.",
    });
  };

  const isPumpUser = deliveryMethod === "pump";

  const handleNotifToggle = (key: keyof NotificationSettings, value: boolean) => {
    const updated = { ...notifSettings, [key]: value };
    setNotifSettings(updated);
    storage.saveNotificationSettings(updated);
    void syncNotificationPreferences(updated);
    if (key === "pushNotifications") {
      if (!value) {
        resetIosPushRegistrationState();
      } else {
        resetIosPushRegistrationState();
        void ensureIosPushRegistered();
      }
    }
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
          Hypo alerts, supply trend alerts, scenario alerts, community feed likes and comments.
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
    <CardContent className="space-y-6 px-4 py-4 sm:px-5 sm:py-5 md:space-y-8 md:px-6 md:py-6 pb-36 md:pb-6">
      <section id="settings-personal" className="scroll-mt-24 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</p>
        <ProfileTab
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
          onSave={() => void handleSaveProfile()}
        />
      </section>

      <section id="settings-usage" className="scroll-mt-24 space-y-3 border-t border-border/50 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usage &amp; supplies</p>
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
          onSave={() => handleSaveUsage()}
        />
      </section>

      <div id="settings-backup" className="scroll-mt-24 border-t border-border/50 pt-5" data-testid="card-account-backup">
        <SettingsDataBackupSection embedded />
      </div>

      <div className={SETTINGS_MOBILE_STICKY_FOOTER}>
        <div className="mx-auto w-full max-w-screen-md px-4 pt-2.5 pb-2.5">
          <Button
            type="button"
            className="w-full"
            data-testid="button-save-usage-page-sticky"
            onClick={() => void handleSaveUsagePage()}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>
    </CardContent>
  );

  const ratiosToolsInner = (
    <CardContent className="pt-6 pb-6 space-y-8">
      <div id="settings-ratios" className="scroll-mt-28 space-y-3 pb-28 md:pb-0">
        <h3 className="text-h3 font-semibold text-foreground">Ratios</h3>
        <p className="text-small text-muted-foreground">TDD, correction factor, targets, and meal ratios.</p>
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
    </CardContent>
  );

  if (pathOnly === "/settings") {
    const completion = storage.getSettingsCompletion();
    return (
      <PageShell variant="standard" className="relative space-y-6 bg-muted/20 text-foreground">
        <FaceLogoWatermark />
        <PageHeader
          className="mb-1"
          title="Settings"
          description={
            isCarer
              ? "Your supporter account, alerts, and appearance."
              : isCommunityAccount
                ? "Community profile, alerts, and appearance."
                : "Personal profile, clinical defaults, alerts, and appearance."
          }
          actions={settingsInfoDialog}
        />

        {!isCarer && !isCommunityAccount ? (
          <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm ring-1 ring-border/40">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">2‑minute setup</CardTitle>
                  <CardDescription>
                    Helps the dashboard, supplies, meal planner, and scenarios give better suggestions.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {completion.percentage}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Progress value={completion.percentage} className="h-2" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/settings/ratios">
                    <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                    Ratios & TDD
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/settings/usage#settings-usage">
                    <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                    Usage & supplies
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You can still use the app without this — it just makes forecasts and advice more accurate.
              </p>
            </CardContent>
          </Card>
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
              label="Profile"
              description="Name, handle, bio, and feed visibility"
              icon={AtSign}
            />
          </SettingsHubGroup>
        )}

        {isCommunityAccount && (
          <SettingsHubGroup title="Account type">
            <SettingsHubNavLink
              href="/onboarding?upgrade=1"
              label="I have Type 1 diabetes / use insulin"
              description="Unlock supplies, meal planner, ratios, scenarios, and the full dashboard"
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
                  : "Hypo, trends, scenarios"
            }
            icon={Bell}
          />
        </SettingsHubGroup>

        <SettingsHubGroup title="Help & legal">
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
        supporterMode={isCarer}
      />
    );
  }

  if (pathOnly === "/settings/about") {
    return <SettingsAboutRoute settingsInfoDialog={settingsInfoDialog} />;
  }

  return (
    <PageShell variant="standard" className="relative space-y-6 bg-background text-foreground">
      <FaceLogoWatermark />
      <PageHeader title="Settings" description="This section was moved." />
      <Button variant="outline" asChild>
        <Link href="/settings">Back to settings</Link>
      </Button>
    </PageShell>
  );
}
