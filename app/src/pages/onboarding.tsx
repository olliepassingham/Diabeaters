import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Package,
  Utensils,
  Dumbbell,
  LayoutDashboard,
  Moon,
  Heart,
  Shield,
  Sparkles,
  Clock,
  TrendingDown,
  ClipboardList,
  Globe,
} from "lucide-react";
import { FaceLogo } from "@/components/face-logo";
import { recordOnboardingFinishedAt, storage } from "@/lib/storage";
import { parseInputToGramsPerUnit, formatRatioForStorage } from "@/lib/ratio-utils";
import { DIABETES_TERMS } from "@/components/info-tooltip";
import { FieldLabelWithInfo, InlineInfoHint, StaticLabelWithInfo } from "@/components/ui/field-label-with-info";
import { validateTDD, validateCorrectionFactor, validateCarbRatio } from "@/lib/clinical-validation";
import { ClinicalWarningHint } from "@/components/clinical-warning";
import { Disclaimer } from "@/components/disclaimer";
import { Link, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { upsertProfile } from "@/lib/profile";
import {
  describePartialClinicalPrefsCloudSync,
  syncAccountTypeToCloud,
  syncClinicalPrefsToCloud,
} from "@/lib/clinical-prefs-cloud-sync";
import { normalizeDateOfBirthInput } from "@/lib/user-age";
import { withReconciledTdd } from "@/lib/tdd";
import { PageShell } from "@/components/layout/page-shell";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildOnboardingSteps,
  getOnboardingSecondaryCta,
  getPostOnboardingPath,
  ONBOARDING_EXERCISE_DEMO_HREF,
  shouldUseRatioAdviserFirstWin,
  type OnboardingWizardStep,
} from "@/lib/onboarding-routes";
import {
  clearOnboardingAccountPath,
  getOnboardingAccountPath,
  setActiveAppMode,
  setOnboardingAccountPath,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import { getCommunityMemberOnboardingCompletePath } from "@/lib/community-landing";
import { markCommunityPushPromptPending } from "@/lib/community-push-prompt";
import {
  clearCommunitySkippedProfileSetup,
  markCommunitySkippedProfileSetup,
} from "@/lib/community-profile-prompt";
import { markBedtimeReminderPromptPending } from "@/lib/bedtime-reminder-prompt";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { reschedulePumpChangeReminders } from "@/lib/pump-change-reminders";
import { seedPumpSuppliesIfNeeded } from "@/lib/pump-supplies";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APP_REGION_OPTIONS,
  applyRegionUnitDefaults,
  type AppRegion,
  regionDefaults,
} from "@/lib/region";
import { syncRegionToCloud } from "@/lib/clinical-prefs-cloud-sync";
import {
  OnboardingBackdrop,
  OnboardingBrandMark,
  OnboardingCard,
  OnboardingFeatureList,
  OnboardingHeroIcon,
  OnboardingNavActions,
  OnboardingOptionCard,
  OnboardingProgress,
  OnboardingStepHeader,
  OnboardingStepPanel,
  OnboardingStepRail,
  OnboardingStickyActions,
  OnboardingTrustRow,
} from "@/components/onboarding/onboarding-ui";

type Struggle = "supplies" | "meals" | "exercise" | "overview" | null;

const ONBOARDING_RATIO_FORMAT_LABEL = "units:10g";

function diabetesTermInfo(term: { explanation: string; example?: string }, extra?: string) {
  return (
    <div className="space-y-2">
      <p>{term.explanation}</p>
      {term.example ? <p className="italic text-primary/80">Example: {term.example}</p> : null}
      {extra ? <p>{extra}</p> : null}
    </div>
  );
}

type CareContext = "mostly_me" | "mostly_them" | "both_equally" | null;

type Step = OnboardingWizardStep;

type StruggleOptionDef = {
  id: Exclude<Struggle, null>;
  icon: typeof Package;
  title: string;
  description: string;
  color: string;
  bg: string;
};

const BASE_STRUGGLE_OPTIONS: StruggleOptionDef[] = [
  {
    id: "supplies",
    icon: Package,
    title: "I keep running out of supplies",
    description: "Insulin, needles, sensors — I never know when to reorder",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    id: "meals",
    icon: Utensils,
    title: "I want help around food and dosing",
    description: "Less stress at mealtimes — we'll guide you if ratios aren't settled yet",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "exercise",
    icon: Dumbbell,
    title: "Exercise throws my levels off",
    description: "Plan activity with carb and timing tips — no perfect numbers needed",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-500/10",
  },
  {
    id: "overview",
    icon: LayoutDashboard,
    title: "I want everything in one place",
    description: "A single hub for supplies, meals, exercise and more",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
  },
];

function getStruggleOptionOrder(careContext: CareContext): Array<Exclude<Struggle, null>> {
  if (careContext === "mostly_me") return ["supplies", "overview", "meals", "exercise"];
  if (careContext === "mostly_them") return ["supplies", "overview", "meals", "exercise"];
  if (careContext === "both_equally") return ["supplies", "overview", "meals", "exercise"];
  return ["supplies", "overview", "meals", "exercise"];
}

function getStruggleCopy(id: Exclude<Struggle, null>, careContext: CareContext): { title: string; description: string } {
  if (careContext === "mostly_me") {
    if (id === "supplies") {
      return {
        title: "I need steadier stock of my supplies",
        description: "Even with supporter responsibilities, running out of insulin, sensors, or sets still catches me out.",
      };
    }
    if (id === "meals") {
      return {
        title: "I want help around food and dosing",
        description: "Calmer mealtimes — we'll start with tools that work even if your ratios aren't settled.",
      };
    }
    if (id === "exercise") {
      return {
        title: "Exercise throws my levels off",
        description: "Plan activity with carb and timing tips — you don't need perfect numbers to start.",
      };
    }
    return {
      title: "I want a clearer hub for my own diabetes",
      description: "Supplies, meals, exercise, and planning — one place that matches how I actually live.",
    };
  }

  if (careContext === "mostly_them") {
    if (id === "supplies") {
      return {
        title: "We lose track of their supplies",
        description: "Sensors, insulin, sets — it’s hard to know what’s running low and when to reorder.",
      };
    }
    if (id === "meals") {
      return {
        title: "We need calmer mealtimes for them",
        description: "Food and dosing support — we'll guide you if their ratios aren't clear yet.",
      };
    }
    if (id === "exercise") {
      return {
        title: "Activity makes their levels swing",
        description: "Plan sessions with carb and timing tips — no perfect numbers needed to start.",
      };
    }
    return {
      title: "I want a calmer overview for their care",
      description: "A single place to see what matters next — without bouncing between screens.",
    };
  }

  if (careContext === "both_equally") {
    if (id === "supplies") {
      return {
        title: "We need clearer supply planning",
        description: "Between two people’s routines, it’s easy to miss what’s running low.",
      };
    }
    if (id === "meals") {
      return {
        title: "We need better meal-time planning",
        description: "Less second-guessing at the table — we'll help find ratios if you're unsure.",
      };
    }
    if (id === "exercise") {
      return {
        title: "Exercise days are harder to manage",
        description: "Steadier guidance before, during, and after activity — rough estimates are fine.",
      };
    }
    return {
      title: "We want one calm hub for everything",
      description: "Supplies, meals, exercise, and day-to-day planning — together in one place.",
    };
  }

  // Default + "mostly_me" (and non-both flows): keep the original first-person wording.
  const base = BASE_STRUGGLE_OPTIONS.find((o) => o.id === id);
  return { title: base?.title ?? "", description: base?.description ?? "" };
}

function getStruggleOptionsForCareContext(careContext: CareContext): StruggleOptionDef[] {
  const order = getStruggleOptionOrder(careContext);
  const byId = new Map(BASE_STRUGGLE_OPTIONS.map((o) => [o.id, o]));
  return order.map((id) => {
    const base = byId.get(id);
    if (!base) return BASE_STRUGGLE_OPTIONS[0];
    const copy = getStruggleCopy(id, careContext);
    return { ...base, title: copy.title, description: copy.description };
  });
}

function getPathDataCareContext(data: OnboardingData): CareContext {
  return getOnboardingAccountPath() === "both" ? data.careContext : null;
}

interface OnboardingData {
  name: string;
  diabetesType: string;
  careContext: CareContext;
  struggle: Struggle;
  insulinDeliveryMethod: string;
  /** Optional YYYY-MM-DD for age-aware tools. */
  dateOfBirth: string;
  bgUnits: string;
  carbUnits: string;
  region: AppRegion | "";
  weightDisplayUnit: "kg" | "lbs";
  emergencyNumber: string;
  hasAcceptedDisclaimer: boolean;
  tdd: string;
  breakfastRatio: string;
  lunchRatio: string;
  dinnerRatio: string;
  /** User chose "I don't know my ratios" on the meals path. */
  mealRatiosUnknown: boolean;
  correctionFactor: string;
  shortActingUnitsPerDay: string;
  longActingUnitsPerDay: string;
  injectionsPerDay: string;
  cgmDays: string;
  siteChangeDays: string;
  reservoirChangeDays: string;
  reservoirCapacity: string;
}

interface OnboardingProps {
  /** Optional path override after marking onboarding complete (e.g. secondary CTA on last step). */
  onComplete?: (pathOverride?: string) => void;
}

const ONBOARDING_STEP_LABELS: Partial<Record<Step, string>> = {
  care_context: "Care",
  struggle: "Focus",
  region: "Region",
  details: "Details",
  disclaimer: "Terms",
};

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const upgradeFlow = useMemo(() => new URLSearchParams(search).get("upgrade") === "1", [search]);
  const accountPath = useMemo(() => getOnboardingAccountPath(), []);
  const showBothPath = accountPath === "both";
  const showCommunityPath = accountPath === "community";
  const [minimalSetup, setMinimalSetup] = useState(false);
  const steps: Step[] = useMemo(
    () =>
      buildOnboardingSteps({
        upgradeFlow,
        showCommunityPath,
        showBothPath,
        minimalSetup,
      }),
    [upgradeFlow, showCommunityPath, showBothPath, minimalSetup],
  );
  const [currentStep, setCurrentStep] = useState<Step>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("upgrade") === "1"
      ? "details"
      : "welcome",
  );
  const [data, setData] = useState<OnboardingData>({
    name: "",
    diabetesType: "type1",
    careContext: null,
    struggle: null,
    insulinDeliveryMethod: "",
    dateOfBirth: "",
    bgUnits: "mmol/L",
    carbUnits: "grams",
    region: "",
    weightDisplayUnit: "kg",
    emergencyNumber: "",
    hasAcceptedDisclaimer: false,
    tdd: "",
    breakfastRatio: "",
    lunchRatio: "",
    dinnerRatio: "",
    mealRatiosUnknown: false,
    correctionFactor: "",
    shortActingUnitsPerDay: "",
    longActingUnitsPerDay: "",
    injectionsPerDay: "",
    cgmDays: "",
    siteChangeDays: "3",
    reservoirChangeDays: "3",
    reservoirCapacity: "300",
  });

  useEffect(() => {
    if (!upgradeFlow) return;
    const p = storage.getProfile();
    if (!p) return;
    setData((prev) => ({
      ...prev,
      name: p.name?.trim() ? p.name : prev.name,
      bgUnits: p.bgUnits || prev.bgUnits,
      carbUnits: p.carbUnits || prev.carbUnits,
      region: p.region || prev.region,
      weightDisplayUnit: p.weightDisplayUnit || prev.weightDisplayUnit,
      emergencyNumber: p.emergencyNumber || prev.emergencyNumber,
      diabetesType: p.diabetesType && p.diabetesType !== "none" ? p.diabetesType : prev.diabetesType,
      insulinDeliveryMethod: p.insulinDeliveryMethod || prev.insulinDeliveryMethod,
      dateOfBirth: p.dateOfBirth || prev.dateOfBirth,
      hasAcceptedDisclaimer: p.hasAcceptedDisclaimer,
    }));
  }, [upgradeFlow]);

  const updateData = (field: keyof OnboardingData, value: string | boolean | Struggle | CareContext | AppRegion) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "region" && (value === "UK" || value === "US" || value === "OTHER")) {
        const units = applyRegionUnitDefaults(value, {
          bgUnits: prev.bgUnits,
          weightDisplayUnit: prev.weightDisplayUnit,
        });
        next.bgUnits = units.bgUnits;
        next.weightDisplayUnit = units.weightDisplayUnit;
        if (value === "OTHER" && !prev.emergencyNumber.trim()) {
          next.emergencyNumber = regionDefaults("OTHER").emergencyNumber;
        } else if (value !== "OTHER") {
          next.emergencyNumber = "";
        }
      }
      return next;
    });
  };

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex) / (steps.length - 1)) * 100;

  const handleSaveProfile = () => {
    const prev = storage.getProfile();
    storage.saveProfile({
      name: data.name,
      email: "",
      bgUnits: data.bgUnits,
      carbUnits: data.carbUnits,
      diabetesType: data.diabetesType || "type1",
      insulinDeliveryMethod: data.insulinDeliveryMethod === "injections" ? "pen" : data.insulinDeliveryMethod,
      usingInsulin: true,
      hasAcceptedDisclaimer: data.hasAcceptedDisclaimer,
      dateOfBirth: normalizeDateOfBirthInput(data.dateOfBirth) ?? "",
      ratioFormat: prev?.ratioFormat,
      carbPortionSize: prev?.carbPortionSize,
      accountType: "patient",
      region: data.region || prev?.region || "UK",
      weightDisplayUnit: data.weightDisplayUnit,
      emergencyNumber: data.emergencyNumber.trim() || undefined,
    });

    const settings: Record<string, number | string | undefined> = {};
    if (data.tdd) settings.tdd = parseFloat(data.tdd);
    if (data.breakfastRatio) {
      const gpu = parseInputToGramsPerUnit(data.breakfastRatio, "per10g");
      settings.breakfastRatio = gpu ? formatRatioForStorage(gpu) : data.breakfastRatio;
    }
    if (data.lunchRatio) {
      const gpu = parseInputToGramsPerUnit(data.lunchRatio, "per10g");
      settings.lunchRatio = gpu ? formatRatioForStorage(gpu) : data.lunchRatio;
    }
    if (data.dinnerRatio) {
      const gpu = parseInputToGramsPerUnit(data.dinnerRatio, "per10g");
      settings.dinnerRatio = gpu ? formatRatioForStorage(gpu) : data.dinnerRatio;
    }
    if (data.correctionFactor) settings.correctionFactor = parseFloat(data.correctionFactor);
    if (data.shortActingUnitsPerDay) settings.shortActingUnitsPerDay = parseInt(data.shortActingUnitsPerDay);
    if (data.longActingUnitsPerDay) settings.longActingUnitsPerDay = parseInt(data.longActingUnitsPerDay);
    if (data.injectionsPerDay) settings.injectionsPerDay = parseInt(data.injectionsPerDay);
    if (data.cgmDays) settings.cgmDays = parseInt(data.cgmDays);

    const isPump = isPumpDeliveryMethod(
      data.insulinDeliveryMethod === "injections" ? "pen" : data.insulinDeliveryMethod,
    );
    if (isPump) {
      if (data.siteChangeDays) settings.siteChangeDays = parseInt(data.siteChangeDays);
      if (data.reservoirChangeDays) settings.reservoirChangeDays = parseInt(data.reservoirChangeDays);
      if (data.reservoirCapacity) settings.reservoirCapacity = parseInt(data.reservoirCapacity);
    }

    if (Object.keys(settings).length > 0) {
      storage.saveSettings(withReconciledTdd({ ...storage.getSettings(), ...settings }));
    }

    if (data.struggle) {
      localStorage.setItem("diabeater_onboarding_struggle", data.struggle);
    }
    if (data.careContext) {
      try {
        localStorage.setItem("diabeater_onboarding_care_context", data.careContext);
      } catch {
        // ignore
      }
    }
  };

  const handleNext = () => {
    if (currentStep === "struggle") {
      setMinimalSetup(false);
    }
    const stepIndex = steps.indexOf(currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1]);
    }
  };

  const handleMinimalSetup = () => {
    if (data.struggle === null) return;
    setMinimalSetup(true);
    setCurrentStep("region");
  };

  const handleBack = () => {
    const stepIndex = steps.indexOf(currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1]);
    }
  };

  const handleFinishCommunity = async (pathOverride?: string) => {
    const region = data.region || "UK";
    const units = applyRegionUnitDefaults(region, {
      bgUnits: data.bgUnits,
      weightDisplayUnit: data.weightDisplayUnit,
    });
    storage.saveProfile({
      name: data.name,
      email: "",
      bgUnits: units.bgUnits,
      carbUnits: "grams",
      diabetesType: "none",
      insulinDeliveryMethod: "pen",
      usingInsulin: false,
      hasAcceptedDisclaimer: data.hasAcceptedDisclaimer,
      dateOfBirth: "",
      accountType: "community",
      region,
      weightDisplayUnit: units.weightDisplayUnit,
      emergencyNumber: data.emergencyNumber.trim() || undefined,
    });
    try {
      localStorage.removeItem("diabeater_onboarding_struggle");
    } catch {
      /* ignore */
    }
    localStorage.setItem("diabeater_onboarding_completed", "true");
    recordOnboardingFinishedAt();
    markCommunityPushPromptPending();
    if (pathOverride === "/tools") {
      markCommunitySkippedProfileSetup();
    } else {
      clearCommunitySkippedProfileSetup();
    }
    setActiveAppMode("community");
    setPrimaryAppRole("community");
    if (getOnboardingAccountPath() == null) setOnboardingAccountPath("community");
    if (user?.id) {
      const fullName = data.name.trim() ? data.name.trim() : null;
      const { error } = await upsertProfile({
        id: user.id,
        onboarding_complete: true,
        full_name: fullName,
        account_type: "community",
        primary_app_role: "community",
      });
      if (error) {
        toast({
          title: "Could not sync profile",
          description: error.message,
          variant: "destructive",
        });
      } else {
        const acctRes = await syncAccountTypeToCloud(user.id);
        if (acctRes.error) {
          toast({
            title: "Profile synced; account type pending",
            description: acctRes.error.message,
            variant: "destructive",
          });
        }
        void syncRegionToCloud(user.id);
      }
    }
    toast({
      title: `Welcome${data.name ? `, ${data.name}` : ""}`,
      description: "Explore Tools for education and tips, or open the feed when your profile is public.",
    });
    if (onComplete) {
      onComplete(pathOverride ?? getCommunityMemberOnboardingCompletePath());
    }
  };

  const handleFinish = async (pathOverride?: string) => {
    if (showCommunityPath && !upgradeFlow) {
      await handleFinishCommunity(pathOverride);
      return;
    }

    handleSaveProfile();
    if (isPumpDeliveryMethod(data.insulinDeliveryMethod)) {
      seedPumpSuppliesIfNeeded({
        tdd: data.tdd ? parseFloat(data.tdd) : undefined,
        siteChangeDays: data.siteChangeDays ? parseInt(data.siteChangeDays, 10) : undefined,
        reservoirChangeDays: data.reservoirChangeDays ? parseInt(data.reservoirChangeDays, 10) : undefined,
        reservoirCapacity: data.reservoirCapacity ? parseInt(data.reservoirCapacity, 10) : undefined,
      });
      void reschedulePumpChangeReminders();
    }
    localStorage.setItem("diabeater_onboarding_completed", "true");
    recordOnboardingFinishedAt();
    markBedtimeReminderPromptPending();
    if (upgradeFlow) {
      setActiveAppMode("patient");
      setPrimaryAppRole("patient");
      clearOnboardingAccountPath();
    }
    if (user?.id) {
      const fullName = data.name.trim() ? data.name.trim() : null;
      const { error } = await upsertProfile({
        id: user.id,
        onboarding_complete: true,
        full_name: fullName,
        account_type: "patient",
        primary_app_role: "patient",
      });
      if (error) {
        toast({
          title: "Could not sync profile",
          description: error.message,
          variant: "destructive",
        });
      } else {
        const syncRes = await syncClinicalPrefsToCloud(user.id);
        if (syncRes.error) {
          toast({
            title: "Profile synced; clinical prefs pending",
            description: syncRes.error.message,
            variant: "destructive",
          });
        } else {
          const partial = describePartialClinicalPrefsCloudSync(syncRes);
          if (partial) {
            toast({
              title: "Clinical prefs partially synced",
              description: partial,
            });
          }
        }
        const acctRes = await syncAccountTypeToCloud(user.id);
        if (acctRes.error && !syncRes.error) {
          toast({
            title: "Profile synced; account type pending",
            description: acctRes.error.message,
            variant: "destructive",
          });
        }
        void syncRegionToCloud(user.id);
      }
    }
    toast({
      title: upgradeFlow
        ? "Clinical tools unlocked"
        : `Welcome to Diabeaters${data.name ? `, ${data.name}` : ""}!`,
      description: upgradeFlow
        ? "Supplies, meal planning, situation guides, and the rest of the app are ready when you are."
        : "Let's get started.",
    });
    if (onComplete) {
      onComplete(pathOverride);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case "welcome": return true;
      case "care_context": return data.careContext !== null;
      case "struggle": return data.struggle !== null;
      case "region": return data.region === "UK" || data.region === "US" || data.region === "OTHER";
      case "details":
        return upgradeFlow || data.struggle !== null;
      case "disclaimer": return data.hasAcceptedDisclaimer;
      case "first_win": return true;
      default: return true;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <WelcomeStep
            data={data}
            updateData={updateData}
            showBothPath={showBothPath}
            communityFlow={showCommunityPath}
          />
        );
      case "care_context":
        return <CareContextStep data={data} updateData={updateData} />;
      case "struggle":
        return <StruggleStep data={data} updateData={updateData} onMinimalSetup={handleMinimalSetup} />;
      case "region":
        return <RegionStep data={data} updateData={updateData} pathCare={getPathDataCareContext(data)} />;
      case "details":
        return (
          <div className="space-y-10">
            <EssentialsStep data={data} updateData={updateData} pathCare={getPathDataCareContext(data)} />
            <div className="h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" aria-hidden />
            <PathDataStep data={data} updateData={updateData} />
          </div>
        );
      case "disclaimer":
        return <DisclaimerStep data={data} updateData={updateData} />;
      case "first_win":
        return showCommunityPath && !upgradeFlow ? (
          <CommunityMemberFirstWinStep onFinish={handleFinish} />
        ) : (
          <FirstWinStep data={data} onFinish={handleFinish} />
        );
      default:
        return null;
    }
  };

  const showProgress = currentStep !== "welcome" && currentStep !== "care_context" && currentStep !== "first_win";
  const showBackButton = currentStep !== "welcome" && currentStep !== "first_win";
  const showNextButton = currentStep !== "first_win";
  const stepRail = useMemo(
    () =>
      steps
        .filter((s) => s !== "welcome" && s !== "first_win")
        .map((s) => ({ id: s, label: ONBOARDING_STEP_LABELS[s] ?? s })),
    [steps],
  );
  const stepLabel =
    currentStep !== "welcome" && currentStep !== "first_win"
      ? `Step ${currentStepIndex + 1} of ${steps.length}`
      : null;

  return (
    <OnboardingBackdrop>
      <PageShell
        variant="narrow"
        className={`space-y-1 px-4 pt-6 md:pt-8 pb-0 sm:pb-0 ${
          currentStep === "first_win" || currentStep === "details" || currentStep === "disclaimer"
            ? "pb-44 sm:pb-10"
            : "pb-28"
        }`}
      >
        <OnboardingBrandMark show={currentStep !== "welcome"} />

        {stepLabel ? (
          <p className="sr-only" aria-live="polite">
            {stepLabel}
          </p>
        ) : null}

        {currentStep !== "welcome" && currentStep !== "first_win" ? (
          <OnboardingStepRail steps={stepRail} currentStepId={currentStep} />
        ) : null}

        {showProgress ? <OnboardingProgress value={progress} /> : null}

        <OnboardingStepPanel stepKey={currentStep}>{renderStep()}</OnboardingStepPanel>

        <p className="pt-2 text-center text-xs text-muted-foreground sm:pt-6">
          Privacy, terms, and support are available in Settings → About once you’re signed in.
        </p>
      </PageShell>

      <OnboardingNavActions
        showBack={showBackButton}
        onBack={handleBack}
        showNext={showNextButton}
        onNext={handleNext}
        nextLabel={currentStep === "disclaimer" ? "Let's go" : "Next"}
        nextDisabled={!canProceed()}
        backTestId="button-onboarding-back"
        nextTestId="button-onboarding-next"
      />
    </OnboardingBackdrop>
  );
}

function CommunityMemberFirstWinStep({ onFinish }: { onFinish: (path?: string) => void | Promise<void> }) {
  const profilePath = getCommunityMemberOnboardingCompletePath();
  return (
    <div className="space-y-8 pb-4 sm:pb-0">
      <div className="space-y-4 text-center">
        <OnboardingHeroIcon icon={Sparkles} accent="primary" />
        <OnboardingStepHeader
          title="You're ready to explore"
          subtitle={
            <>
              Browse education and {AI_ASSISTANT_NAME} in Tools now, or set up your public profile first to join the
              Feed. You can unlock full Type&nbsp;1 features anytime in Settings.
            </>
          }
        />
      </div>
      <OnboardingCard accent="primary" contentClassName="pt-5 pb-5">
        <ul className="space-y-3 text-sm text-muted-foreground" data-testid="onboarding-community-feed-requirements">
          {[
            ["Display name", "how others see you on posts and messages"],
            ["Public @handle", "your unique community username"],
            ["Profile public", "turns on Feed access when the rest is complete"],
          ].map(([label, detail]) => (
            <li key={label} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-medium text-foreground">{label}</span> — {detail}
              </span>
            </li>
          ))}
        </ul>
      </OnboardingCard>
      <OnboardingStickyActions
        className="space-y-3"
        testId="onboarding-community-first-win-actions"
      >
        <Button
          className="mx-auto w-full max-w-lg rounded-xl"
          size="lg"
          onClick={() => void onFinish(profilePath)}
          data-testid="button-onboarding-community-complete"
        >
          Set up community profile
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button
          className="mx-auto w-full max-w-lg rounded-xl"
          size="lg"
          variant="outline"
          onClick={() => void onFinish("/tools")}
          data-testid="button-onboarding-community-tools"
        >
          Browse tools
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Finishing saves your basics. You can add your public profile anytime in Account.
        </p>
      </OnboardingStickyActions>
    </div>
  );
}

function WelcomeStep({
  data,
  updateData,
  showBothPath,
  communityFlow,
}: {
  data: OnboardingData;
  updateData: (field: keyof OnboardingData, value: any) => void;
  showBothPath: boolean;
  communityFlow?: boolean;
}) {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-5">
        <div className="flex justify-center">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 scale-125 rounded-full bg-primary/15 blur-2xl"
            />
            <div className="relative rounded-3xl bg-card/80 p-4 shadow-md ring-1 ring-border/60 backdrop-blur-sm">
              <FaceLogo size={72} />
              <div className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 shadow-sm ring-2 ring-background">
                <Heart className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Diabeaters</h1>
          <p className="mx-auto max-w-sm text-pretty text-lg leading-relaxed text-muted-foreground">
            {communityFlow
              ? "Learn at your own pace, join the conversation when you want, and keep things simple — no supply or dose tracking required."
              : showBothPath
                ? "We’ll set up your own tools first, then you can link Supporter access in a couple of taps."
                : "You’ll leave with the one thing you care about most working for you — less guessing, more living."}
          </p>
        </div>
      </div>

      <OnboardingCard contentClassName="space-y-6 pt-6 pb-6">
          <div className="space-y-2">
            <Label htmlFor="welcome-name" className="text-base">What should we call you?</Label>
            <Input
              id="welcome-name"
              value={data.name}
              onChange={(e) => updateData("name", e.target.value)}
              placeholder="Your first name"
              className="text-center text-lg"
              data-testid="input-onboarding-name"
            />
          </div>

          {!communityFlow ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-base">Diabetes type</Label>
              <InlineInfoHint
                ariaLabel="About diabetes type"
                content={
                  <p>
                    Diabeaters is built for Type&nbsp;1 diabetes management (insulin, carbs, and daily planning).
                  </p>
                }
              />
            </div>
            <button
              type="button"
              onClick={() => updateData("diabetesType", "type1")}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all hover-elevate",
                data.diabetesType === "type1"
                  ? "border-primary/45 bg-primary/5 ring-2 ring-primary/15 shadow-sm"
                  : "border-border/70",
              )}
              data-testid="button-diabetes-type1"
            >
              <span className="font-medium text-sm">Type 1</span>
              {data.diabetesType === "type1" && <Check className="h-4 w-4 text-primary" />}
            </button>
          </div>
          ) : null}
      </OnboardingCard>

      <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground/80">
        No complicated setup. Just the bits that matter to you.
      </p>

      <OnboardingTrustRow
        items={[
          { icon: Shield, label: "Your data stays on your device" },
          { icon: Clock, label: "Takes 2 minutes" },
        ]}
      />
    </div>
  );
}

function CareContextStep({ data, updateData }: { data: OnboardingData; updateData: (field: keyof OnboardingData, value: any) => void }) {
  const options: Array<{ id: NonNullable<CareContext>; title: string; description: string }> = [
    {
      id: "mostly_me",
      title: "Mostly for my own diabetes day-to-day",
      description: "Supporter tools are secondary for now.",
    },
    {
      id: "mostly_them",
      title: "Mostly to help someone I support",
      description: "We’ll still capture your basics so the tools make sense when you switch modes.",
    },
    {
      id: "both_equally",
      title: "Both equally",
      description: "We’ll keep the setup balanced for you and the person you support.",
    },
  ];

  return (
    <div className="space-y-6">
      <OnboardingStepHeader
        title="Quick context"
        subtitle="You chose that you have Type 1 and you support someone too. Where should we focus this first setup?"
      />

      <RadioGroup
        value={data.careContext ?? ""}
        onValueChange={(v) => updateData("careContext", v as CareContext)}
        className="space-y-3"
      >
        {options.map((opt) => (
          <label
            key={opt.id}
            htmlFor={`care-${opt.id}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all hover-elevate",
              data.careContext === opt.id
                ? "border-primary/45 bg-gradient-to-br from-primary/[0.1] to-primary/[0.02] ring-2 ring-primary/20 shadow-sm"
                : "border-border/70 bg-card/70 backdrop-blur-sm",
            )}
          >
            <RadioGroupItem id={`care-${opt.id}`} value={opt.id} className="mt-1" data-testid={`care-context-${opt.id}`} />
            <div className="min-w-0">
              <div className="font-medium leading-snug">{opt.title}</div>
              <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{opt.description}</div>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function StruggleStep({
  data,
  updateData,
  onMinimalSetup,
}: {
  data: OnboardingData;
  updateData: (field: keyof OnboardingData, value: any) => void;
  onMinimalSetup: () => void;
}) {
  const supporterAngle = data.careContext === "mostly_them" || data.careContext === "both_equally";
  const strugglePresentationContext: CareContext = useMemo(() => {
    return getOnboardingAccountPath() === "both" ? data.careContext : null;
  }, [data.careContext]);

  const struggleOptions = useMemo(() => getStruggleOptionsForCareContext(strugglePresentationContext), [strugglePresentationContext]);

  return (
    <div className="space-y-6">
      <OnboardingStepHeader
        title={<>{data.name ? `${data.name}, what` : "What"} do you want working better first?</>}
        subtitle={
          supporterAngle
            ? "Pick what you want to open first — we’ll send you there when setup finishes."
            : "Pick what you want to open first — you can add clinical details whenever you’re ready."
        }
      />

      <div className="space-y-3">
        {struggleOptions.map((option) => (
          <OnboardingOptionCard
            key={option.id}
            selected={data.struggle === option.id}
            onClick={() => updateData("struggle", option.id)}
            icon={option.icon}
            iconBg={option.bg}
            iconColor={option.color}
            title={option.title}
            description={option.description}
            testId={`struggle-${option.id}`}
          />
        ))}
      </div>

      {data.struggle ? (
        <div className="pt-1 text-center" data-testid="onboarding-struggle-skip">
          <button
            type="button"
            className="min-h-11 rounded-xl px-3 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:bg-muted/40 hover:text-foreground"
            onClick={onMinimalSetup}
            data-testid="button-onboarding-minimal-setup"
          >
            Skip optional details — I’ll add them in Settings later
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EssentialsStep({
  data,
  updateData,
  pathCare,
}: {
  data: OnboardingData;
  updateData: (field: keyof OnboardingData, value: any) => void;
  pathCare?: CareContext | null;
}) {
  const supporterHeavy = pathCare === "mostly_them" || pathCare === "both_equally";
  const isParentForOther = pathCare === "mostly_them";

  return (
    <div className="space-y-6">
      <OnboardingStepHeader
        title="A few essentials"
        subtitle={
          supporterHeavy
            ? "A few basics so dose planning and forecasts line up with real life — you can fine-tune everything later."
            : "A few details so tips and safety checks can match how you live with diabetes. Nothing here is set in stone — you can change it all later."
        }
      />

      <OnboardingCard contentClassName="space-y-6 pt-6">
          <div className="space-y-3">
            <StaticLabelWithInfo
              labelClassName="text-sm font-medium"
              ariaLabel="About insulin delivery"
              info={
                <p>
                  Pens (MDI) or pump — this shapes supply forecasts and which usage questions we ask later. You can
                  change it anytime in Settings.
                </p>
              }
            >
              {pathCare === "mostly_them"
                ? "How does the person you support take insulin?"
                : "How do you take your insulin?"}
            </StaticLabelWithInfo>
            <RadioGroup
              value={data.insulinDeliveryMethod}
              onValueChange={(value) => updateData("insulinDeliveryMethod", value)}
              className="space-y-2"
            >
              <div
                className={cn(
                  "flex cursor-pointer items-center space-x-3 rounded-xl border p-3 transition-all hover-elevate",
                  data.insulinDeliveryMethod === "injections"
                    ? "border-primary/45 bg-primary/5 ring-1 ring-primary/15"
                    : "border-border/70",
                )}
                onClick={() => updateData("insulinDeliveryMethod", "injections")}
              >
                <RadioGroupItem value="injections" id="ob-injections" data-testid="radio-injections" />
                <div className="flex-1">
                  <Label htmlFor="ob-injections" className="font-normal cursor-pointer">Injections (pens)</Label>
                </div>
              </div>
              <div
                className={cn(
                  "flex cursor-pointer items-center space-x-3 rounded-xl border p-3 transition-all hover-elevate",
                  data.insulinDeliveryMethod === "pump"
                    ? "border-primary/45 bg-primary/5 ring-1 ring-primary/15"
                    : "border-border/70",
                )}
                onClick={() => updateData("insulinDeliveryMethod", "pump")}
              >
                <RadioGroupItem value="pump" id="ob-pump" data-testid="radio-pump" />
                <div className="flex-1">
                  <Label htmlFor="ob-pump" className="font-normal cursor-pointer">Insulin pump</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <FieldLabelWithInfo
              htmlFor="ob-dob"
              className="[&_label]:text-sm [&_label]:font-medium"
              info={
                <div className="space-y-2">
                  {isParentForOther ? (
                    <>
                      <p>
                        We only use this to estimate their age on this device so education and calculators can stay
                        appropriate for a child or teenager (for example hypo help and which situation guides appear). It is not
                        sold and it is not used for advertising.
                      </p>
                      <p>
                        It stays with this signed-in account and you can edit or clear it anytime in Settings. If you
                        skip it, some tools stay generic.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        We only use this to work out your age here so guidance can stay age-appropriate (for example hypo
                        tools and which situation guides you see). It is not sold and it is not used for advertising.
                      </p>
                      <p>
                        It stays with your signed-in account and you can edit or clear it whenever you like in Settings.
                        If you skip it, a few features stay generic instead of tailored.
                      </p>
                    </>
                  )}
                  <p>
                    More detail:{" "}
                    <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">
                      Privacy
                    </Link>
                    .
                  </p>
                </div>
              }
            >
              {isParentForOther ? (
                <>
                  Their date of birth <span className="text-muted-foreground font-normal">(optional)</span>
                </>
              ) : (
                <>
                  Date of birth <span className="text-muted-foreground font-normal">(optional)</span>
                </>
              )}
            </FieldLabelWithInfo>
            <Input
              id="ob-dob"
              type="date"
              value={data.dateOfBirth}
              onChange={(e) => updateData("dateOfBirth", e.target.value)}
              data-testid="input-onboarding-dob"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Blood glucose units</Label>
            <RadioGroup
              value={data.bgUnits}
              onValueChange={(value) => updateData("bgUnits", value)}
              className="flex gap-3"
            >
              <div
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border hover-elevate cursor-pointer ${data.bgUnits === "mmol/L" ? "border-primary bg-primary/5" : ""}`}
                onClick={() => updateData("bgUnits", "mmol/L")}
              >
                <RadioGroupItem value="mmol/L" id="ob-mmol" className="sr-only" data-testid="radio-mmol" />
                <Label htmlFor="ob-mmol" className="font-normal cursor-pointer">mmol/L</Label>
              </div>
              <div
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border hover-elevate cursor-pointer ${data.bgUnits === "mg/dL" ? "border-primary bg-primary/5" : ""}`}
                onClick={() => updateData("bgUnits", "mg/dL")}
              >
                <RadioGroupItem value="mg/dL" id="ob-mgdl" className="sr-only" data-testid="radio-mgdl" />
                <Label htmlFor="ob-mgdl" className="font-normal cursor-pointer">mg/dL</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Weight display</Label>
            <RadioGroup
              value={data.weightDisplayUnit}
              onValueChange={(value) => updateData("weightDisplayUnit", value as "kg" | "lbs")}
              className="flex gap-3"
            >
              <div
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border hover-elevate cursor-pointer ${data.weightDisplayUnit === "kg" ? "border-primary bg-primary/5" : ""}`}
                onClick={() => updateData("weightDisplayUnit", "kg")}
              >
                <RadioGroupItem value="kg" id="ob-weight-kg" className="sr-only" />
                <Label htmlFor="ob-weight-kg" className="font-normal cursor-pointer">kg</Label>
              </div>
              <div
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border hover-elevate cursor-pointer ${data.weightDisplayUnit === "lbs" ? "border-primary bg-primary/5" : ""}`}
                onClick={() => updateData("weightDisplayUnit", "lbs")}
              >
                <RadioGroupItem value="lbs" id="ob-weight-lbs" className="sr-only" />
                <Label htmlFor="ob-weight-lbs" className="font-normal cursor-pointer">lbs</Label>
              </div>
            </RadioGroup>
          </div>
      </OnboardingCard>
    </div>
  );
}

function RegionStep({
  data,
  updateData,
  pathCare,
}: {
  data: OnboardingData;
  updateData: (field: keyof OnboardingData, value: string | boolean | Struggle | CareContext | AppRegion) => void;
  pathCare?: CareContext | null;
}) {
  const supporterHeavy = pathCare === "mostly_them" || pathCare === "both_equally";

  return (
    <div className="space-y-6" data-testid="onboarding-region">
      <OnboardingStepHeader
        icon={Globe}
        accent="primary"
        title="Where are you based?"
        subtitle={
          supporterHeavy
            ? "This sets default units and emergency numbers for the person you support. You can change units on the next step."
            : "This sets your default blood glucose units, weight display, and local emergency number. You can override units on the next step."
        }
      />

      <OnboardingCard contentClassName="space-y-3 pt-6">
          {APP_REGION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-testid={`onboarding-region-${opt.value}`}
              className={cn(
                "w-full rounded-2xl border p-4 text-left transition-all hover-elevate",
                data.region === opt.value
                  ? "border-primary/45 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] ring-2 ring-primary/15 shadow-sm"
                  : "border-border/70 bg-background/50",
              )}
              onClick={() => updateData("region", opt.value)}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{opt.description}</p>
            </button>
          ))}

          {data.region === "OTHER" ? (
            <div className="space-y-2 pt-2">
              <Label htmlFor="ob-emergency-number" className="text-sm font-medium">
                Local emergency number
              </Label>
              <Input
                id="ob-emergency-number"
                inputMode="tel"
                placeholder="e.g. 112"
                value={data.emergencyNumber}
                onChange={(e) => updateData("emergencyNumber", e.target.value)}
                data-testid="input-onboarding-emergency-number"
              />
            </div>
          ) : null}
      </OnboardingCard>
    </div>
  );
}

type PathDataUpdate = (field: keyof OnboardingData, value: any) => void;

function PathDataSuppliesStep({
  data,
  updateData,
  pathCare,
}: {
  data: OnboardingData;
  updateData: PathDataUpdate;
  pathCare: CareContext;
}) {
  const supporterHeavy = pathCare === "mostly_them" || pathCare === "both_equally";
  const isPump = isPumpDeliveryMethod(data.insulinDeliveryMethod);
  const defaultSuppliesTab = isPump ? "basics" : "usage";
  const [suppliesTab, setSuppliesTab] = useState(defaultSuppliesTab);
  const optionalTone = cn("text-xs sm:text-sm", supporterHeavy && "opacity-80");

  return (
    <div className="space-y-6" data-testid="onboarding-path-supplies">
      <OnboardingStepHeader
        icon={Package}
        accent="blue"
        title={pathCare === "mostly_them" ? "Let’s sort their supplies" : "Let’s sort your supplies"}
        subtitle={
          supporterHeavy
            ? "A couple of numbers so forecasts match their real usage — you can refine later in Supplies."
            : "A couple of numbers so we can predict when you'll run out"
        }
      />

      <OnboardingCard accent="blue" contentClassName="pt-6">
          <Tabs value={suppliesTab} onValueChange={setSuppliesTab} className="w-full">
            <TabsList className="grid h-auto min-h-11 w-full grid-cols-3 gap-1 rounded-xl bg-muted/40 p-1">
              <TabsTrigger value="basics" className="text-xs sm:text-sm" data-testid="onboarding-path-tab-basics">
                {isPump ? "Pump basics" : "Basics"}
              </TabsTrigger>
              <TabsTrigger value="usage" className="text-xs sm:text-sm" data-testid="onboarding-path-tab-usage">
                {isPump ? "Pump usage" : "Daily totals"}
              </TabsTrigger>
              <TabsTrigger value="optional" className={optionalTone} data-testid="onboarding-path-tab-optional">
                CGM (optional)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="basics" className="mt-4 space-y-4">
              {isPump ? (
                <div className="space-y-1.5">
                  <FieldLabelWithInfo
                    htmlFor="path-tdd"
                    info={diabetesTermInfo(DIABETES_TERMS.tdd, "All insulin the pump delivers in a day.")}
                  >
                    Total Daily Dose (units)
                  </FieldLabelWithInfo>
                  <Input
                    id="path-tdd"
                    type="number"
                    placeholder="e.g., 40"
                    value={data.tdd}
                    onChange={(e) => updateData("tdd", e.target.value)}
                    data-testid="input-onboarding-tdd"
                  />
                  <ClinicalWarningHint warning={validateTDD(data.tdd)} />
                </div>
              ) : (
                <div className="flex justify-end">
                  <InlineInfoHint
                    ariaLabel="About supply basics"
                    content={
                      <p>
                        {supporterHeavy
                          ? "We’ll use daily insulin totals in the next tab to estimate how quickly they go through pens and vials. Add sensor duration under CGM (optional) if they use a CGM."
                          : "We’ll use your daily insulin totals in the next tab to estimate how quickly you go through pens and vials. Add sensor duration under CGM (optional) if you use a CGM."}
                      </p>
                    }
                  />
                </div>
              )}
            </TabsContent>
            <TabsContent value="usage" className="mt-4 space-y-4">
              {isPump ? (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    {supporterHeavy
                      ? "We’ll add starter rows for infusion sets, reservoirs, insulin, and backup pens — adjust stock after your next pickup."
                      : "We’ll add starter rows for infusion sets, reservoirs, insulin, and backup pens — adjust stock after your next pickup."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <FieldLabelWithInfo htmlFor="path-site-days" info={<p>How often they change infusion sets.</p>}>
                        Site change (days)
                      </FieldLabelWithInfo>
                      <Select
                        value={data.siteChangeDays}
                        onValueChange={(v) => updateData("siteChangeDays", v)}
                      >
                        <SelectTrigger id="path-site-days" data-testid="select-onboarding-site-days">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">Every 2 days</SelectItem>
                          <SelectItem value="3">Every 3 days</SelectItem>
                          <SelectItem value="4">Every 4 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabelWithInfo htmlFor="path-reservoir-days" info={<p>How often they change reservoirs.</p>}>
                        Reservoir change (days)
                      </FieldLabelWithInfo>
                      <Select
                        value={data.reservoirChangeDays}
                        onValueChange={(v) => updateData("reservoirChangeDays", v)}
                      >
                        <SelectTrigger id="path-reservoir-days" data-testid="select-onboarding-reservoir-days">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">Every 2 days</SelectItem>
                          <SelectItem value="3">Every 3 days</SelectItem>
                          <SelectItem value="4">Every 4 days</SelectItem>
                          <SelectItem value="5">Every 5 days</SelectItem>
                          <SelectItem value="7">Every 7 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <FieldLabelWithInfo htmlFor="path-reservoir-cap" info={<p>Units per cartridge or reservoir fill.</p>}>
                        Reservoir capacity (units)
                      </FieldLabelWithInfo>
                      <Input
                        id="path-reservoir-cap"
                        type="number"
                        placeholder="e.g., 300"
                        value={data.reservoirCapacity}
                        onChange={(e) => updateData("reservoirCapacity", e.target.value)}
                        data-testid="input-onboarding-reservoir-capacity"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabelWithInfo htmlFor="path-short" info={diabetesTermInfo(DIABETES_TERMS.shortActing)}>
                      Short-Acting (units/day)
                    </FieldLabelWithInfo>
                    <Input
                      id="path-short"
                      type="number"
                      placeholder="e.g., 25"
                      value={data.shortActingUnitsPerDay}
                      onChange={(e) => updateData("shortActingUnitsPerDay", e.target.value)}
                      data-testid="input-onboarding-short-acting"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabelWithInfo htmlFor="path-long" info={diabetesTermInfo(DIABETES_TERMS.longActing)}>
                      Long-Acting (units/day)
                    </FieldLabelWithInfo>
                    <Input
                      id="path-long"
                      type="number"
                      placeholder="e.g., 20"
                      value={data.longActingUnitsPerDay}
                      onChange={(e) => updateData("longActingUnitsPerDay", e.target.value)}
                      data-testid="input-onboarding-long-acting"
                    />
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="optional" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <InlineInfoHint
                  ariaLabel="About CGM settings"
                  content={
                    <div className="space-y-2">
                      <p>
                        {supporterHeavy
                          ? "Only needed if they use a CGM/sensor. Skip if you’re not sure."
                          : "Optional — only needed if you use a CGM/sensor."}
                      </p>
                      <p>You can update these anytime in Settings.</p>
                    </div>
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabelWithInfo htmlFor="path-cgm" info={diabetesTermInfo(DIABETES_TERMS.cgmDuration)}>
                  Sensor Duration (days)
                </FieldLabelWithInfo>
                <Input
                  id="path-cgm"
                  type="number"
                  placeholder="e.g., 10 or 14"
                  value={data.cgmDays}
                  onChange={(e) => updateData("cgmDays", e.target.value)}
                  data-testid="input-onboarding-cgm"
                />
              </div>
            </TabsContent>
          </Tabs>
      </OnboardingCard>
    </div>
  );
}

function PathDataMealsStep({
  data,
  updateData,
  pathCare,
}: {
  data: OnboardingData;
  updateData: PathDataUpdate;
  pathCare: CareContext;
}) {
  const supporterHeavy = pathCare === "mostly_them" || pathCare === "both_equally";
  const defaultMealsTab = pathCare === "mostly_them" ? "corrections" : "ratios";
  const [mealsTab, setMealsTab] = useState(defaultMealsTab);
  const mealsOptionalTone = cn("text-xs sm:text-sm", supporterHeavy && "opacity-80");

  return (
    <div className="space-y-6" data-testid="onboarding-path-meals">
      <OnboardingStepHeader
        icon={Utensils}
        accent="amber"
        title={pathCare === "mostly_them" ? "Let’s simplify their mealtimes" : "Let’s simplify mealtimes"}
        subtitle={
          supporterHeavy
            ? "Know a ratio? Add it now. Not sure? We’ll open the Ratio Adviser when you finish."
            : "Know a ratio? Add one now. Not sure? We’ll guide you through the Ratio Adviser next."
        }
      />

      <OnboardingCard accent="amber" contentClassName="pt-6">
          <Tabs value={mealsTab} onValueChange={setMealsTab} className="w-full">
            <TabsList className="grid h-auto min-h-11 w-full grid-cols-3 gap-1 rounded-xl bg-muted/40 p-1">
              <TabsTrigger value="ratios" className="text-xs sm:text-sm" data-testid="onboarding-path-tab-ratios">
                Ratios
              </TabsTrigger>
              <TabsTrigger value="corrections" className="text-xs sm:text-sm" data-testid="onboarding-path-tab-corrections">
                Corrections
              </TabsTrigger>
              <TabsTrigger value="optional" className={mealsOptionalTone} data-testid="onboarding-path-tab-optional-meals">
                Tips (optional)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ratios" className="mt-4 space-y-4">
              {data.mealRatiosUnknown ? (
                <div
                  className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground"
                  data-testid="onboarding-meals-ratios-unknown-banner"
                >
                  No problem — after setup we&apos;ll open the Ratio Adviser to help you find starting numbers.
                </div>
              ) : null}
              <StaticLabelWithInfo
                labelClassName="text-sm font-medium"
                ariaLabel="About carb ratios"
                info={
                  <div className="space-y-2">
                    {diabetesTermInfo(DIABETES_TERMS.carbRatio)}
                    <p>
                      Enter values as <strong>{ONBOARDING_RATIO_FORMAT_LABEL}</strong> carbs. One meal is enough to
                      start — add the rest in Settings later.
                    </p>
                  </div>
                }
              >
                Carb ratios ({ONBOARDING_RATIO_FORMAT_LABEL} carbs)
              </StaticLabelWithInfo>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { label: "Breakfast", key: "breakfastRatio" as const, placeholder: "e.g., 1.0", testId: "breakfast" },
                    { label: "Lunch", key: "lunchRatio" as const, placeholder: "e.g., 0.8", testId: "lunch", hint: "A good one to start with" },
                    { label: "Dinner", key: "dinnerRatio" as const, placeholder: "e.g., 1.0", testId: "dinner" },
                  ] as const
                ).map((meal) => (
                  <div key={meal.key} className="space-y-1.5">
                    <Label className="text-sm">{meal.label}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder={meal.placeholder}
                      value={data[meal.key]}
                      onChange={(e) => {
                        updateData(meal.key, e.target.value);
                        if (e.target.value.trim()) updateData("mealRatiosUnknown", false);
                      }}
                      data-testid={`input-onboarding-${meal.testId}-ratio`}
                    />
                    <ClinicalWarningHint
                      warning={validateCarbRatio(parseInputToGramsPerUnit(data[meal.key], "per10g"))}
                    />
                    <p className="text-xs text-muted-foreground">
                      {ONBOARDING_RATIO_FORMAT_LABEL}
                      {"hint" in meal && meal.hint ? ` · ${meal.hint}` : ""}
                    </p>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant={data.mealRatiosUnknown ? "default" : "outline"}
                className="w-full rounded-xl"
                onClick={() => {
                  updateData("mealRatiosUnknown", true);
                  updateData("breakfastRatio", "");
                  updateData("lunchRatio", "");
                  updateData("dinnerRatio", "");
                }}
                data-testid="button-onboarding-meals-ratios-unknown"
              >
                I don&apos;t know my ratios yet
              </Button>
            </TabsContent>
            <TabsContent value="corrections" className="mt-4 space-y-1.5">
              <FieldLabelWithInfo
                htmlFor="path-correction"
                info={diabetesTermInfo(
                  DIABETES_TERMS.correctionFactor,
                  pathCare === "mostly_them"
                    ? `How much 1 unit lowers their blood sugar (${data.bgUnits}).`
                    : `How much 1 unit lowers your blood sugar (${data.bgUnits}).`,
                )}
              >
                Correction Factor
              </FieldLabelWithInfo>
              <Input
                id="path-correction"
                type="number"
                step="0.1"
                placeholder={data.bgUnits === "mmol/L" ? "e.g., 3" : "e.g., 50"}
                value={data.correctionFactor}
                onChange={(e) => updateData("correctionFactor", e.target.value)}
                data-testid="input-onboarding-correction"
              />
              <ClinicalWarningHint warning={validateCorrectionFactor(data.correctionFactor, data.bgUnits)} />
            </TabsContent>
            <TabsContent value="optional" className="mt-4 flex justify-center py-4">
              <InlineInfoHint
                ariaLabel="About optional meal settings"
                content={
                  <p>
                    Not sure? You can add ratios and corrections later in Settings, or use the Ratio Adviser to work
                    them out.
                  </p>
                }
              />
            </TabsContent>
          </Tabs>
      </OnboardingCard>
    </div>
  );
}

function PathDataExerciseStep({
  data,
  updateData,
  pathCare,
}: {
  data: OnboardingData;
  updateData: PathDataUpdate;
  pathCare: CareContext;
}) {
  const supporterHeavy = pathCare === "mostly_them" || pathCare === "both_equally";

  return (
    <div className="space-y-6" data-testid="onboarding-path-exercise">
      <OnboardingStepHeader
        icon={Dumbbell}
        accent="green"
        title={pathCare === "mostly_them" ? "Ready to plan their activity" : "Ready to plan activity"}
        subtitle={
          supporterHeavy
            ? "The exercise planner works from activity type and duration — no daily totals required."
            : "The exercise planner works from what you’re doing — you don’t need perfect numbers to start."
        }
      />

      <OnboardingCard accent="green" contentClassName="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground">
            After setup we&apos;ll open a sample 30-minute walk so you can see carb and timing guidance right away.
          </p>
          <div className="space-y-1.5">
            <FieldLabelWithInfo
              htmlFor="path-correction-ex"
              info={
                <div className="space-y-2">
                  {diabetesTermInfo(DIABETES_TERMS.correctionFactor)}
                  <p>Optional — add later in Settings if you prefer.</p>
                </div>
              }
            >
              Correction factor (optional)
            </FieldLabelWithInfo>
            <Input
              id="path-correction-ex"
              type="number"
              step="0.1"
              placeholder={data.bgUnits === "mmol/L" ? "e.g., 3 — skip if unsure" : "e.g., 50 — skip if unsure"}
              value={data.correctionFactor}
              onChange={(e) => updateData("correctionFactor", e.target.value)}
              data-testid="input-onboarding-correction"
            />
            <ClinicalWarningHint warning={validateCorrectionFactor(data.correctionFactor, data.bgUnits)} />
          </div>
      </OnboardingCard>
    </div>
  );
}

function PathDataOverviewStep({
  data,
  updateData,
  pathCare,
}: {
  data: OnboardingData;
  updateData: PathDataUpdate;
  pathCare: CareContext;
}) {
  const supporterHeavy = pathCare === "mostly_them" || pathCare === "both_equally";
  const defaultOverviewTab = pathCare === "mostly_them" ? "sensors" : "basics";
  const [overviewTab, setOverviewTab] = useState(defaultOverviewTab);
  const sensorsTone = cn("text-xs sm:text-sm", supporterHeavy && pathCare !== "mostly_them" && "opacity-90");

  return (
    <div className="space-y-6" data-testid="onboarding-path-overview">
      <OnboardingStepHeader
        icon={LayoutDashboard}
        accent="purple"
        title={pathCare === "mostly_them" ? "A calmer overview for their care" : "Your all-in-one hub"}
        subtitle={
          supporterHeavy
            ? "Start with what you know now — you can layer in detail later."
            : "A few details so we can make everything work together"
        }
      />

      <OnboardingCard accent="purple" contentClassName="pt-6">
          <Tabs value={overviewTab} onValueChange={setOverviewTab} className="w-full">
            <TabsList className="grid h-auto min-h-11 w-full grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1">
              <TabsTrigger value="basics" className="text-xs sm:text-sm" data-testid="onboarding-path-tab-ov-basics">
                Basics
              </TabsTrigger>
              <TabsTrigger value="sensors" className={sensorsTone} data-testid="onboarding-path-tab-sensors">
                Sensors
              </TabsTrigger>
            </TabsList>
            <TabsContent value="basics" className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <FieldLabelWithInfo
                  htmlFor="path-tdd-ov"
                  info={
                    <div className="space-y-2">
                      {diabetesTermInfo(DIABETES_TERMS.tdd)}
                      <p>You can add more detail later in Settings — we&apos;ll prompt you when it&apos;s needed.</p>
                    </div>
                  }
                >
                  Total Daily Dose (units)
                </FieldLabelWithInfo>
                <Input
                  id="path-tdd-ov"
                  type="number"
                  placeholder="e.g., 40"
                  value={data.tdd}
                  onChange={(e) => updateData("tdd", e.target.value)}
                  data-testid="input-onboarding-tdd"
                />
                <ClinicalWarningHint warning={validateTDD(data.tdd)} />
              </div>
            </TabsContent>
            <TabsContent value="sensors" className="mt-4 space-y-1.5">
              <FieldLabelWithInfo htmlFor="path-cgm-ov" info={diabetesTermInfo(DIABETES_TERMS.cgmDuration)}>
                Sensor Duration (days)
              </FieldLabelWithInfo>
              <Input
                id="path-cgm-ov"
                type="number"
                placeholder="e.g., 10 or 14"
                value={data.cgmDays}
                onChange={(e) => updateData("cgmDays", e.target.value)}
                data-testid="input-onboarding-cgm"
              />
            </TabsContent>
          </Tabs>
      </OnboardingCard>
    </div>
  );
}

function PathDataStep({ data, updateData }: { data: OnboardingData; updateData: PathDataUpdate }) {
  const struggle = data.struggle;
  const pathCare = getPathDataCareContext(data);

  if (!struggle) return null;

  switch (struggle) {
    case "supplies":
      return <PathDataSuppliesStep data={data} updateData={updateData} pathCare={pathCare} />;
    case "meals":
      return <PathDataMealsStep data={data} updateData={updateData} pathCare={pathCare} />;
    case "exercise":
      return <PathDataExerciseStep data={data} updateData={updateData} pathCare={pathCare} />;
    case "overview":
      return <PathDataOverviewStep data={data} updateData={updateData} pathCare={pathCare} />;
    default:
      return null;
  }
}

function DisclaimerStep({ data, updateData }: { data: OnboardingData; updateData: (field: keyof OnboardingData, value: any) => void }) {
  return (
    <div className="space-y-6">
      <OnboardingStepHeader
        icon={AlertTriangle}
        accent="yellow"
        title="One important thing"
        subtitle="Please read and accept before we continue"
      />

      <OnboardingCard accent="yellow" contentClassName="space-y-4 pt-6">
          <div className="flex items-start gap-3 rounded-xl bg-yellow-50 p-4 dark:bg-yellow-950/30">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-500" />
            <Disclaimer className="text-yellow-900 dark:text-yellow-100" />
          </div>

          <div
            className="flex cursor-pointer items-start space-x-3 rounded-xl border border-border/70 p-4 transition-all hover-elevate"
            onClick={() => updateData("hasAcceptedDisclaimer", !data.hasAcceptedDisclaimer)}
          >
            <Checkbox
              id="ob-disclaimer"
              checked={data.hasAcceptedDisclaimer}
              onCheckedChange={(checked) => updateData("hasAcceptedDisclaimer", checked === true)}
              data-testid="checkbox-disclaimer"
            />
            <div className="flex-1">
              <Label htmlFor="ob-disclaimer" className="font-medium cursor-pointer">I understand and accept</Label>
              <p className="text-sm text-muted-foreground mt-1">
                I acknowledge that Diabeaters is not a substitute for professional medical advice
              </p>
            </div>
          </div>
      </OnboardingCard>
    </div>
  );
}

function FirstWinStep({
  data,
  onFinish,
}: {
  data: OnboardingData;
  onFinish: (pathOverride?: string) => void | Promise<void>;
}) {
  const struggle = data.struggle;
  const wantsSupporterSetupNext = getOnboardingAccountPath() === "both";

  const getContent = () => {
    if (struggle === "supplies") {
      return {
        icon: Package,
        accent: "blue" as const,
        title: "Your Supply Tracker is ready",
        subtitle: "Here's what you can do right now",
        features: [
          { icon: TrendingDown, text: "See exactly when each supply will run out", highlight: true },
          { icon: Clock, text: "Get reminded before you run low" },
          { icon: ClipboardList, text: "Log usage so forecasts match how you treat day to day" },
        ],
        ctaText: "Go to Supply Tracker",
        ctaPath: "/supplies",
      };
    }
    if (struggle === "meals") {
      if (!shouldUseRatioAdviserFirstWin(data)) {
        return {
          icon: Utensils,
          accent: "amber" as const,
          title: "Your Meal Planner is ready",
          subtitle: "Try a dose calculation with the ratio you added",
          features: [
            { icon: Sparkles, text: "Get dose suggestions based on your carbs and ratios", highlight: true },
            { icon: Clock, text: "Automatic time-of-day ratio selection" },
            { icon: TrendingDown, text: "Add more ratios anytime in Settings" },
          ],
          ctaText: "Try a Meal Calculation",
          ctaPath: "/adviser?tab=meal",
        };
      }
      return {
        icon: Utensils,
        accent: "amber" as const,
        title: "Let's find your starting ratios",
        subtitle: "A short guided flow — then meal dose suggestions unlock",
        features: [
          { icon: Sparkles, text: "Guided questionnaire to estimate starting ratios", highlight: true },
          { icon: Clock, text: "Works even if you're not sure of your numbers yet" },
          { icon: TrendingDown, text: "Then jump straight into the Meal Planner" },
        ],
        ctaText: "Open Ratio Adviser",
        ctaPath: "/adviser?tab=ratio-adviser",
      };
    }
    if (struggle === "exercise") {
      return {
        icon: Dumbbell,
        accent: "green" as const,
        title: "Let's plan your first activity",
        subtitle: "We've picked a gentle example — change it to match your day",
        features: [
          { icon: Sparkles, text: "Carb and timing tips from activity type and duration", highlight: true },
          { icon: Clock, text: "Before, during, and after exercise guidance" },
          { icon: TrendingDown, text: "No daily insulin totals required to get started" },
        ],
        ctaText: "Try a 30-minute walk",
        ctaPath: ONBOARDING_EXERCISE_DEMO_HREF,
      };
    }
    return {
      icon: LayoutDashboard,
      accent: "purple" as const,
      title: "Your Dashboard is ready",
      subtitle: "Everything in one place, customised for you",
      features: [
        { icon: Package, text: "Supply tracking with depletion forecasts", highlight: true },
        { icon: Utensils, text: "Meal and exercise planning with dose suggestions" },
        { icon: Dumbbell, text: "Exercise planning with carb and insulin guidance" },
        { icon: Moon, text: "Evening bedtime readiness check when you're winding down" },
      ],
      ctaText: "Go to Dashboard",
      ctaPath: "/",
    };
  };

  const content = getContent();
  const Icon = content.icon;
  const secondaryRaw = getOnboardingSecondaryCta(
    struggle,
    {
      breakfastRatio: data.breakfastRatio,
      lunchRatio: data.lunchRatio,
      dinnerRatio: data.dinnerRatio,
      mealRatiosUnknown: data.mealRatiosUnknown,
    },
    { wantsSupporterSetupNext },
  );
  const secondary =
    secondaryRaw && secondaryRaw.path !== content.ctaPath ? secondaryRaw : null;

  return (
    <div className="space-y-8 pb-4 sm:pb-0">
      <div className="space-y-4 text-center">
        <OnboardingHeroIcon icon={Icon} accent={content.accent} />
        <OnboardingStepHeader title={content.title} subtitle={content.subtitle} />
      </div>

      <OnboardingCard accent={content.accent} contentClassName="pt-5 pb-5">
        <OnboardingFeatureList features={content.features} accent={content.accent} />
      </OnboardingCard>

      <OnboardingStickyActions className="space-y-3" testId="onboarding-first-win-actions">
        <Button
          className="mx-auto w-full max-w-lg rounded-xl"
          size="lg"
          onClick={() => void onFinish(content.ctaPath)}
          data-testid="button-onboarding-complete"
        >
          {content.ctaText}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        {secondary ? (
          <Button
            variant="outline"
            className="mx-auto w-full max-w-lg rounded-xl"
            size="lg"
            onClick={() => void onFinish(secondary.path)}
            data-testid="button-onboarding-complete-secondary"
          >
            {secondary.label}
          </Button>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">
          Finishing saves your setup and opens the app. You can add more detail anytime in Settings.
        </p>
      </OnboardingStickyActions>
    </div>
  );
}
