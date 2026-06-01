import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Check,
  Package,
  Utensils,
  Dumbbell,
  LayoutDashboard,
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
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { FieldLabelWithInfo } from "@/components/ui/field-label-with-info";
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
import { PageShell } from "@/components/layout/page-shell";
import { AI_ASSISTANT_NAME } from "@/lib/ai-coach/persona";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOnboardingSecondaryCta, getPostOnboardingPath } from "@/lib/onboarding-routes";
import {
  clearOnboardingAccountPath,
  getOnboardingAccountPath,
  setActiveAppMode,
  setPrimaryAppRole,
} from "@/lib/carer-session";
import { getCommunityMemberLandingPath } from "@/lib/community-landing";
import { markCommunityPushPromptPending } from "@/lib/community-push-prompt";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import {
  APP_REGION_OPTIONS,
  applyRegionUnitDefaults,
  type AppRegion,
  regionDefaults,
} from "@/lib/region";
import { syncRegionToCloud } from "@/lib/clinical-prefs-cloud-sync";

type Struggle = "supplies" | "meals" | "exercise" | "overview" | null;

type CareContext = "mostly_me" | "mostly_them" | "both_equally" | null;

type Step =
  | "welcome"
  | "care_context"
  | "struggle"
  | "region"
  | "details"
  | "disclaimer"
  | "first_win";

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
    title: "I struggle with meal dosing",
    description: "Working out carbs and insulin for meals is stressful",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "exercise",
    icon: Dumbbell,
    title: "Exercise throws my levels off",
    description: "I worry about going low or high when I'm active",
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
  if (careContext === "mostly_me") return ["meals", "supplies", "exercise", "overview"];
  if (careContext === "mostly_them") return ["supplies", "meals", "exercise", "overview"];
  if (careContext === "both_equally") return ["meals", "supplies", "exercise", "overview"];
  return ["supplies", "meals", "exercise", "overview"];
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
        title: "Mealtimes are stressful for me",
        description: "Carbs, doses, and timing — I want calmer decisions for my own diabetes day-to-day.",
      };
    }
    if (id === "exercise") {
      return {
        title: "Exercise throws my levels off",
        description: "I worry about going low or high when I’m active — especially on busy days.",
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
        title: "Mealtimes feel unpredictable for them",
        description: "Carb counting, ratios, and corrections can be stressful to support in the moment.",
      };
    }
    if (id === "exercise") {
      return {
        title: "Activity makes their levels swing",
        description: "Sports, school runs, and busy days can make highs/lows harder to anticipate.",
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
        description: "Carbs, doses, and timing — we want less second-guessing at the table.",
      };
    }
    if (id === "exercise") {
      return {
        title: "Exercise days are harder to manage",
        description: "Activity changes quickly — we want steadier guidance before, during, and after.",
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
  correctionFactor: string;
  shortActingUnitsPerDay: string;
  longActingUnitsPerDay: string;
  injectionsPerDay: string;
  cgmDays: string;
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

function OnboardingStepPills({ steps, currentStep }: { steps: Step[]; currentStep: Step }) {
  if (currentStep === "welcome" || currentStep === "first_win") return null;
  const rail = steps.filter((s) => s !== "welcome" && s !== "first_win") as Exclude<Step, "welcome" | "first_win">[];
  const activeIdx = rail.indexOf(currentStep as (typeof rail)[number]);
  if (activeIdx < 0) return null;

  return (
    <nav
      className="flex flex-wrap justify-center gap-1.5 px-1 pt-1 sm:gap-2"
      aria-label="Onboarding steps"
    >
      {rail.map((step, i) => {
        const done = i < activeIdx;
        const current = i === activeIdx;
        const label = ONBOARDING_STEP_LABELS[step] ?? step;
        return (
          <span
            key={step}
            aria-current={current ? "step" : undefined}
            className={cn(
              "inline-flex max-w-[6.5rem] items-center justify-center truncate rounded-full border px-2.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide sm:max-w-none sm:text-xs",
              done && "border-primary/30 bg-primary/10 text-foreground",
              current && "border-primary bg-primary text-primary-foreground shadow-sm",
              !done && !current && "border-border/50 bg-muted/40 text-muted-foreground",
            )}
          >
            {label}
          </span>
        );
      })}
    </nav>
  );
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const upgradeFlow = useMemo(() => new URLSearchParams(search).get("upgrade") === "1", [search]);
  const accountPath = useMemo(() => getOnboardingAccountPath(), []);
  const showBothPath = accountPath === "both";
  const showCommunityPath = accountPath === "community";
  const steps: Step[] = useMemo(() => {
    if (upgradeFlow) return ["details", "disclaimer", "first_win"];
    if (showCommunityPath) return ["welcome", "region", "disclaimer", "first_win"];
    if (showBothPath) return ["welcome", "care_context", "struggle", "region", "details", "disclaimer", "first_win"];
    return ["welcome", "struggle", "region", "details", "disclaimer", "first_win"];
  }, [upgradeFlow, showCommunityPath, showBothPath]);
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
    correctionFactor: "",
    shortActingUnitsPerDay: "",
    longActingUnitsPerDay: "",
    injectionsPerDay: "",
    cgmDays: "",
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

    if (Object.keys(settings).length > 0) {
      storage.saveSettings(settings);
    }

    if (data.struggle) {
      localStorage.setItem("diabeater_onboarding_struggle", data.struggle);
      localStorage.setItem("diabeater_profile_incomplete", "true");
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
    const stepIndex = steps.indexOf(currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1]);
    }
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
      localStorage.removeItem("diabeater_profile_incomplete");
    } catch {
      /* ignore */
    }
    localStorage.setItem("diabeater_onboarding_completed", "true");
    recordOnboardingFinishedAt();
    markCommunityPushPromptPending();
    setActiveAppMode("community");
    setPrimaryAppRole("community");
    if (user?.id) {
      const fullName = data.name.trim() ? data.name.trim() : null;
      const { error } = await upsertProfile({
        id: user.id,
        onboarding_complete: true,
        full_name: fullName,
        account_type: "community",
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
      onComplete(pathOverride ?? getCommunityMemberLandingPath());
    }
  };

  const handleFinish = async (pathOverride?: string) => {
    if (showCommunityPath && !upgradeFlow) {
      await handleFinishCommunity(pathOverride);
      return;
    }

    handleSaveProfile();
    localStorage.setItem("diabeater_onboarding_completed", "true");
    recordOnboardingFinishedAt();
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
        return <StruggleStep data={data} updateData={updateData} />;
      case "region":
        return <RegionStep data={data} updateData={updateData} pathCare={getPathDataCareContext(data)} />;
      case "details":
        return (
          <div className="space-y-8">
            <EssentialsStep data={data} updateData={updateData} pathCare={getPathDataCareContext(data)} />
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
  const stepLabel =
    currentStep !== "welcome" && currentStep !== "first_win"
      ? `Step ${currentStepIndex + 1} of ${steps.length}`
      : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageShell
        variant="narrow"
        className={`px-4 pt-6 md:pt-8 pb-0 sm:pb-0 ${
          currentStep === "first_win" || currentStep === "details" || currentStep === "disclaimer"
            ? "pb-44 sm:pb-10"
            : "pb-28"
        }`}
      >
        {currentStep !== "welcome" && (
          <div className="flex justify-center">
            <FaceLogo size={40} />
          </div>
        )}

        {stepLabel ? (
          <p className="sr-only" aria-live="polite">
            {stepLabel}
          </p>
        ) : null}
        <OnboardingStepPills steps={steps} currentStep={currentStep} />

        {showProgress && (
          <Progress value={progress} className="h-1.5" data-testid="progress-onboarding" />
        )}

        <div className="animate-fade-in-up">{renderStep()}</div>

        <p className="text-center text-xs text-muted-foreground pt-2 sm:pt-6">
          Privacy, terms, and support are available in Settings → About once you’re signed in.
        </p>
      </PageShell>

      {(showBackButton || showNextButton) && (
        <div
          className="fixed bottom-[var(--keyboard-inset-bottom,0px)] left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:px-4 sm:py-0 sm:backdrop-blur-none"
          data-testid="onboarding-sticky-actions"
        >
          <div className="mx-auto w-full max-w-lg flex justify-between gap-3 items-center">
            {showBackButton ? (
              <Button variant="outline" size="sm" onClick={handleBack} data-testid="button-onboarding-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            ) : (
              <div />
            )}
            <div className="flex-1 min-w-0 flex justify-end gap-2 flex-wrap sm:flex-nowrap">
              {showNextButton && (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  size="sm"
                  className="min-w-[7rem] shrink-0"
                  data-testid="button-onboarding-next"
                >
                  {currentStep === "disclaimer" ? "Let's go" : "Next"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommunityMemberFirstWinStep({ onFinish }: { onFinish: (path?: string) => void | Promise<void> }) {
  const land = getCommunityMemberLandingPath();
  const openLabel = land === "/community" ? "Open feed" : "Open Tools";
  return (
    <div className="space-y-8 pb-4 sm:pb-0">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">You&apos;re ready to explore</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Education, tips, optional feed, and {AI_ASSISTANT_NAME} — all in one place. You can switch to full Type&nbsp;1
            tools anytime in Settings.
          </p>
        </div>
      </div>
      <div
        className="space-y-3 fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none"
        data-testid="onboarding-community-first-win-actions"
      >
        <Button
          className="w-full"
          size="lg"
          onClick={() => void onFinish(land)}
          data-testid="button-onboarding-community-complete"
        >
          {openLabel}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Finishing saves your profile. You can add more detail anytime in Settings.
        </p>
      </div>
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
    <div className="text-center space-y-8">
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <FaceLogo size={80} />
            <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Diabeaters</h1>
          <p className="text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {communityFlow
              ? "Learn at your own pace, join the conversation when you want, and keep things simple — no supply or dose tracking required."
              : showBothPath
                ? "We’ll set up your own tools first, then you can link Supporter access in a couple of taps."
                : "You’ll leave with the one thing you care about most working for you — less guessing, more living."}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 pb-6 space-y-6">
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
            <Label className="text-base">Diabetes type</Label>
            <button
              type="button"
              onClick={() => updateData("diabetesType", "type1")}
              className={`flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors ${
                data.diabetesType === "type1"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover-elevate"
              }`}
              data-testid="button-diabetes-type1"
            >
              <span className="font-medium text-sm">Type 1</span>
              {data.diabetesType === "type1" && <Check className="h-4 w-4 text-primary" />}
            </button>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Diabeaters is built for Type&nbsp;1 diabetes management (insulin, carbs, and daily planning).
            </p>
          </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground/70 text-center max-w-xs mx-auto">
        No complicated setup. Just the bits that matter to you.
      </p>

      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          <span>Your data stays on your device</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>Takes 2 minutes</span>
        </div>
      </div>
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
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Quick context</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          You chose that you have Type&nbsp;1 and you support someone too. Where should we focus this first setup?
        </p>
      </div>

      <RadioGroup
        value={data.careContext ?? ""}
        onValueChange={(v) => updateData("careContext", v as CareContext)}
        className="space-y-3"
      >
        {options.map((opt) => (
          <label
            key={opt.id}
            htmlFor={`care-${opt.id}`}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover-elevate ${
              data.careContext === opt.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""
            }`}
          >
            <RadioGroupItem id={`care-${opt.id}`} value={opt.id} className="mt-1" data-testid={`care-context-${opt.id}`} />
            <div className="min-w-0">
              <div className="font-medium">{opt.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{opt.description}</div>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function StruggleStep({ data, updateData }: { data: OnboardingData; updateData: (field: keyof OnboardingData, value: any) => void }) {
  const supporterAngle = data.careContext === "mostly_them" || data.careContext === "both_equally";
  const strugglePresentationContext: CareContext = useMemo(() => {
    return getOnboardingAccountPath() === "both" ? data.careContext : null;
  }, [data.careContext]);

  const struggleOptions = useMemo(() => getStruggleOptionsForCareContext(strugglePresentationContext), [strugglePresentationContext]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">
          {data.name ? `${data.name}, what` : "What"} do you want working better first?
        </h2>
        <p className="text-muted-foreground">
          {supporterAngle
            ? "Pick the pain point you want help with right now (for you, or for the person you support)."
            : "We’ll tune the app around it so you see value quickly"}
        </p>
      </div>

      <div className="space-y-3">
        {struggleOptions.map((option) => {
          const isSelected = data.struggle === option.id;
          const Icon = option.icon;
          return (
            <div
              key={option.id}
              className={`flex items-center gap-3 p-3 sm:gap-4 sm:p-4 rounded-lg border cursor-pointer transition-all hover-elevate ${
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""
              }`}
              onClick={() => updateData("struggle", option.id)}
              data-testid={`struggle-${option.id}`}
            >
              <div className={`p-2.5 sm:p-3 rounded-lg ${option.bg}`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${option.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{option.title}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              {isSelected && (
                <div className="flex-shrink-0">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StrugglePreviewStep({
  data,
  onMinimalSetup,
}: {
  data: OnboardingData;
  onMinimalSetup: () => void;
}) {
  const s = data.struggle;
  const panels: Record<
    NonNullable<Struggle>,
    { headline: string; bullets: [string, string] }
  > = {
    supplies: {
      headline: "What you’ll get first",
      bullets: [
        "A supply tracker that shows when insulin, sensors, and essentials are likely to run low.",
        "Space to log what you use so forecasts match how you treat day to day.",
      ],
    },
    meals: {
      headline: "What you’ll get first",
      bullets: [
        "Meal planning that can suggest doses from your carbs and ratios (rough numbers are fine).",
        "A path to fine-tune ratios later if you’re not sure yet.",
      ],
    },
    exercise: {
      headline: "What you’ll get first",
      bullets: [
        "Exercise planning with carb and insulin adjustment suggestions.",
        "Guidance you can revisit before, during, and after activity.",
      ],
    },
    overview: {
      headline: "What you’ll get first",
      bullets: [
        "One hub for supplies, meals, and exercise — tailored as you add detail.",
        "Gentle prompts when something will work better with a bit more info.",
      ],
    },
  };

  if (!s) return null;
  const { headline, bullets } = panels[s];

  return (
    <div className="space-y-6" data-testid="onboarding-struggle-preview">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">{headline}</h2>
        <p className="text-muted-foreground text-sm">
          A quick preview before we collect a few details — you can skip anything you’re unsure about.
        </p>
      </div>
      <Card className="border-primary/15 bg-primary/[0.03]">
        <CardContent className="pt-6 pb-6 space-y-4 text-left">
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="text-primary font-semibold shrink-0">•</span>
              <span>{bullets[0]}</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-semibold shrink-0">•</span>
              <span>{bullets[1]}</span>
            </li>
          </ul>
        </CardContent>
      </Card>
      <div className="text-center pt-1">
        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground min-h-11 px-2"
          onClick={onMinimalSetup}
          data-testid="button-onboarding-minimal-setup"
        >
          Skip these questions — I’ll add details in Settings
        </button>
      </div>
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
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">A few essentials</h2>
        <p className="text-muted-foreground">
          {supporterHeavy
            ? "A few basics so dose planning and forecasts line up with real life — you can fine-tune everything later."
            : "A few details so tips and safety checks can match how you live with diabetes. Nothing here is set in stone — you can change it all later."}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {pathCare === "mostly_them"
                ? "How does the person you support take insulin?"
                : "How do you take your insulin?"}
            </Label>
            <RadioGroup
              value={data.insulinDeliveryMethod}
              onValueChange={(value) => updateData("insulinDeliveryMethod", value)}
              className="space-y-2"
            >
              <div
                className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => updateData("insulinDeliveryMethod", "injections")}
              >
                <RadioGroupItem value="injections" id="ob-injections" data-testid="radio-injections" />
                <div className="flex-1">
                  <Label htmlFor="ob-injections" className="font-normal cursor-pointer">Injections (pens)</Label>
                </div>
              </div>
              <div
                className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer"
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
        </CardContent>
      </Card>
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
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">Where are you based?</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {supporterHeavy
            ? "This sets default units and emergency numbers for the person you support. You can change units on the next step."
            : "This sets your default blood glucose units, weight display, and local emergency number. You can override units on the next step."}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          {APP_REGION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-testid={`onboarding-region-${opt.value}`}
              className={cn(
                "w-full text-left p-4 rounded-lg border hover-elevate transition-colors",
                data.region === opt.value ? "border-primary bg-primary/5" : "border-border",
              )}
              onClick={() => updateData("region", opt.value)}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{opt.description}</p>
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
        </CardContent>
      </Card>
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
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-blue-500/10">
            <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">
          {pathCare === "mostly_them" ? "Let’s sort their supplies" : "Let’s sort your supplies"}
        </h2>
        <p className="text-muted-foreground">
          {supporterHeavy
            ? "A couple of numbers so forecasts match their real usage — you can refine later in Supplies."
            : "A couple of numbers so we can predict when you'll run out"}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={suppliesTab} onValueChange={setSuppliesTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto min-h-11 p-1 gap-1">
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
                <div className="space-y-2">
                  <Label htmlFor="path-tdd" className="flex items-center gap-1">
                    Total Daily Dose (units)
                    <InfoTooltip {...DIABETES_TERMS.tdd} />
                  </Label>
                  <Input
                    id="path-tdd"
                    type="number"
                    placeholder="e.g., 40"
                    value={data.tdd}
                    onChange={(e) => updateData("tdd", e.target.value)}
                    data-testid="input-onboarding-tdd"
                  />
                  <ClinicalWarningHint warning={validateTDD(data.tdd)} />
                  <p className="text-xs text-muted-foreground">All insulin your pump delivers in a day</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {supporterHeavy
                    ? "We’ll use daily insulin totals in the next tab to estimate how quickly they go through pens and vials. Add sensor duration in CGM (optional) if they use a CGM."
                    : "We’ll use your daily insulin totals in the next tab to estimate how quickly you go through pens and vials. Add sensor duration in CGM (optional) if you use a CGM."}
                </p>
              )}
            </TabsContent>
            <TabsContent value="usage" className="mt-4 space-y-4">
              {isPump ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {supporterHeavy
                    ? "Pump therapy delivers basal and bolus together — total daily dose is the main number we use for supply forecasts. You can refine usage logs later in the Supply Tracker."
                    : "Your pump delivers basal and bolus together — total daily dose is the main number we use for supply forecasts. You can refine usage logs later in the Supply Tracker."}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="path-short" className="flex items-center gap-1">
                      Short-Acting (units/day)
                      <InfoTooltip {...DIABETES_TERMS.shortActing} />
                    </Label>
                    <Input
                      id="path-short"
                      type="number"
                      placeholder="e.g., 25"
                      value={data.shortActingUnitsPerDay}
                      onChange={(e) => updateData("shortActingUnitsPerDay", e.target.value)}
                      data-testid="input-onboarding-short-acting"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="path-long" className="flex items-center gap-1">
                      Long-Acting (units/day)
                      <InfoTooltip {...DIABETES_TERMS.longActing} />
                    </Label>
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
              {supporterHeavy ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Only needed if they use a CGM/sensor. Skip if you’re not sure — you can add it later.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Optional — only needed if you use a CGM/sensor.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="path-cgm" className="flex items-center gap-1">
                  Sensor Duration (days)
                  <InfoTooltip {...DIABETES_TERMS.cgmDuration} />
                </Label>
                <Input
                  id="path-cgm"
                  type="number"
                  placeholder="e.g., 10 or 14"
                  value={data.cgmDays}
                  onChange={(e) => updateData("cgmDays", e.target.value)}
                  data-testid="input-onboarding-cgm"
                />
              </div>
              <p className="text-xs text-muted-foreground italic">
                You can always update these later in Settings.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
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
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-amber-500/10">
            <Utensils className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">
          {pathCare === "mostly_them" ? "Let’s simplify their mealtimes" : "Let’s simplify mealtimes"}
        </h2>
        <p className="text-muted-foreground">
          {supporterHeavy
            ? "Ratios and corrections help dose suggestions — rough numbers are fine."
            : "Your ratios let us suggest doses — even rough numbers help"}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={mealsTab} onValueChange={setMealsTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto min-h-11 p-1 gap-1">
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
            <TabsContent value="ratios" className="mt-4 space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                Carb Ratios (units:10g carbs)
                <InfoTooltip {...DIABETES_TERMS.carbRatio} />
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Breakfast</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 1.0"
                    value={data.breakfastRatio}
                    onChange={(e) => updateData("breakfastRatio", e.target.value)}
                    data-testid="input-onboarding-breakfast-ratio"
                  />
                  <ClinicalWarningHint warning={validateCarbRatio(parseInputToGramsPerUnit(data.breakfastRatio, "per10g"))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Lunch</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 0.8"
                    value={data.lunchRatio}
                    onChange={(e) => updateData("lunchRatio", e.target.value)}
                    data-testid="input-onboarding-lunch-ratio"
                  />
                  <ClinicalWarningHint warning={validateCarbRatio(parseInputToGramsPerUnit(data.lunchRatio, "per10g"))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Dinner</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 1.0"
                    value={data.dinnerRatio}
                    onChange={(e) => updateData("dinnerRatio", e.target.value)}
                    data-testid="input-onboarding-dinner-ratio"
                  />
                  <ClinicalWarningHint warning={validateCarbRatio(parseInputToGramsPerUnit(data.dinnerRatio, "per10g"))} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="corrections" className="mt-4 space-y-2">
              <Label htmlFor="path-correction" className="flex items-center gap-1">
                Correction Factor
                <InfoTooltip {...DIABETES_TERMS.correctionFactor} />
              </Label>
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
              <p className="text-xs text-muted-foreground">
                {pathCare === "mostly_them"
                  ? "How much 1 unit lowers their blood sugar"
                  : "How much 1 unit lowers your blood sugar"}
              </p>
            </TabsContent>
            <TabsContent value="optional" className="mt-4">
              <p className="text-xs text-muted-foreground italic">
                Not sure? No problem — you can always add these later in Settings, or use our Ratio Adviser to figure
                them out.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
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
  const defaultExerciseTab = pathCare === "mostly_them" ? "corrections" : "basics";
  const [exerciseTab, setExerciseTab] = useState(defaultExerciseTab);
  const correctionsTone = cn("text-xs sm:text-sm", supporterHeavy && pathCare !== "mostly_them" && "opacity-90");

  return (
    <div className="space-y-6" data-testid="onboarding-path-exercise">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-green-500/10">
            <Dumbbell className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">
          {pathCare === "mostly_them" ? "Let’s make activity easier for them" : "Let’s make exercise easier"}
        </h2>
        <p className="text-muted-foreground">
          {supporterHeavy
            ? "A couple of numbers help us suggest safer adjustments around activity."
            : "We need a couple of numbers to give you adjustment suggestions"}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={exerciseTab} onValueChange={setExerciseTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-auto min-h-11 p-1 gap-1">
              <TabsTrigger value="basics" className="text-xs sm:text-sm" data-testid="onboarding-path-tab-ex-basics">
                Basics
              </TabsTrigger>
              <TabsTrigger value="corrections" className={correctionsTone} data-testid="onboarding-path-tab-ex-corrections">
                Corrections
              </TabsTrigger>
            </TabsList>
            <TabsContent value="basics" className="mt-4 space-y-2">
              <Label htmlFor="path-tdd-ex" className="flex items-center gap-1">
                Total Daily Dose (units)
                <InfoTooltip {...DIABETES_TERMS.tdd} />
              </Label>
              <Input
                id="path-tdd-ex"
                type="number"
                placeholder="e.g., 40"
                value={data.tdd}
                onChange={(e) => updateData("tdd", e.target.value)}
                data-testid="input-onboarding-tdd"
              />
              <ClinicalWarningHint warning={validateTDD(data.tdd)} />
              <p className="text-xs text-muted-foreground">
                {pathCare === "mostly_them"
                  ? "All insulin they take in a day — this helps calculate exercise adjustments"
                  : "All insulin you take in a day — this helps calculate exercise adjustments"}
              </p>
            </TabsContent>
            <TabsContent value="corrections" className="mt-4 space-y-2">
              <Label htmlFor="path-correction-ex" className="flex items-center gap-1">
                Correction Factor
                <InfoTooltip {...DIABETES_TERMS.correctionFactor} />
              </Label>
              <Input
                id="path-correction-ex"
                type="number"
                step="0.1"
                placeholder={data.bgUnits === "mmol/L" ? "e.g., 3" : "e.g., 50"}
                value={data.correctionFactor}
                onChange={(e) => updateData("correctionFactor", e.target.value)}
                data-testid="input-onboarding-correction"
              />
              <ClinicalWarningHint warning={validateCorrectionFactor(data.correctionFactor, data.bgUnits)} />
              <p className="text-xs text-muted-foreground italic mt-4">
                You can always update these later in Settings.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
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
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-purple-500/10">
            <LayoutDashboard className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">
          {pathCare === "mostly_them" ? "A calmer overview for their care" : "Your all-in-one hub"}
        </h2>
        <p className="text-muted-foreground">
          {supporterHeavy
            ? "Start with what you know now — you can layer in detail later."
            : "A few details so we can make everything work together"}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={overviewTab} onValueChange={setOverviewTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-auto min-h-11 p-1 gap-1">
              <TabsTrigger value="basics" className="text-xs sm:text-sm" data-testid="onboarding-path-tab-ov-basics">
                Basics
              </TabsTrigger>
              <TabsTrigger value="sensors" className={sensorsTone} data-testid="onboarding-path-tab-sensors">
                Sensors
              </TabsTrigger>
            </TabsList>
            <TabsContent value="basics" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="path-tdd-ov" className="flex items-center gap-1">
                  Total Daily Dose (units)
                  <InfoTooltip {...DIABETES_TERMS.tdd} />
                </Label>
                <Input
                  id="path-tdd-ov"
                  type="number"
                  placeholder="e.g., 40"
                  value={data.tdd}
                  onChange={(e) => updateData("tdd", e.target.value)}
                  data-testid="input-onboarding-tdd"
                />
              </div>
              <p className="text-xs text-muted-foreground italic">
                You can add more detail later in Settings — we'll prompt you when it's needed.
              </p>
            </TabsContent>
            <TabsContent value="sensors" className="mt-4 space-y-2">
              <Label htmlFor="path-cgm-ov" className="flex items-center gap-1">
                Sensor Duration (days)
                <InfoTooltip {...DIABETES_TERMS.cgmDuration} />
              </Label>
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
        </CardContent>
      </Card>
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
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">One important thing</h2>
        <p className="text-muted-foreground">
          Please read and accept before we continue
        </p>
      </div>

      <Card className="border-yellow-500/30">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
            <Disclaimer className="text-yellow-900 dark:text-yellow-100" />
          </div>

          <div
            className="flex items-start space-x-3 p-4 border rounded-lg hover-elevate cursor-pointer"
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
        </CardContent>
      </Card>
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
        iconColor: "text-blue-600 dark:text-blue-400",
        iconBg: "bg-blue-500/10",
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
      const hasRatios = !!(data.breakfastRatio || data.lunchRatio || data.dinnerRatio);
      if (hasRatios) {
        return {
          icon: Utensils,
          iconColor: "text-amber-600 dark:text-amber-400",
          iconBg: "bg-amber-500/10",
          title: "Your Meal Planner is ready",
          subtitle: "Let's take the stress out of mealtimes",
          features: [
            { icon: Sparkles, text: "Get dose suggestions based on your carbs and ratios", highlight: true },
            { icon: Clock, text: "Automatic time-of-day ratio selection" },
            { icon: TrendingDown, text: "Exercise adjustments built right in" },
          ],
          ctaText: "Try a Meal Calculation",
          ctaPath: "/adviser?tab=meal",
        };
      }
      return {
        icon: Utensils,
        iconColor: "text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-500/10",
        title: "Let's work out your ratios first",
        subtitle: "The Meal Planner needs your carb ratios to calculate doses — let's find yours",
        features: [
          { icon: Sparkles, text: "Guided questionnaire to estimate your starting ratios", highlight: true },
          { icon: Clock, text: "Works even if you don't know your ratios yet" },
          { icon: TrendingDown, text: "Then you'll be ready to use the Meal Planner" },
        ],
        ctaText: "Go to Ratio Adviser",
        ctaPath: "/adviser?tab=ratio-adviser",
      };
    }
    if (struggle === "exercise") {
      return {
        icon: Dumbbell,
        iconColor: "text-green-600 dark:text-green-400",
        iconBg: "bg-green-500/10",
        title: "Your Exercise Planner is ready",
        subtitle: "Move with more confidence",
        features: [
          { icon: Sparkles, text: "Get carb and insulin adjustments for any activity", highlight: true },
          { icon: Clock, text: "Before, during, and after exercise guidance" },
          { icon: TrendingDown, text: "Recovery recommendations to avoid late lows" },
        ],
        ctaText: "Plan an Activity",
        ctaPath: "/scenarios/exercise",
      };
    }
    return {
      icon: LayoutDashboard,
      iconColor: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-500/10",
      title: "Your Dashboard is ready",
      subtitle: "Everything in one place, customised for you",
      features: [
        { icon: Package, text: "Supply tracking with depletion forecasts", highlight: true },
        { icon: Utensils, text: "Meal and exercise planning with dose suggestions" },
        { icon: Dumbbell, text: "Exercise planning with carb and insulin guidance" },
      ],
      ctaText: "Go to Dashboard",
      ctaPath: "/",
    };
  };

  const content = getContent();
  const Icon = content.icon;
  const hasRatios = !!(data.breakfastRatio || data.lunchRatio || data.dinnerRatio);
  const secondaryRaw = getOnboardingSecondaryCta(struggle, hasRatios, { wantsSupporterSetupNext });
  const secondary =
    secondaryRaw && secondaryRaw.path !== content.ctaPath ? secondaryRaw : null;

  return (
    <div className="space-y-8 pb-4 sm:pb-0">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className={`p-4 rounded-full ${content.iconBg}`}>
            <Icon className={`h-8 w-8 ${content.iconColor}`} />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{content.title}</h2>
          <p className="text-muted-foreground">{content.subtitle}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="space-y-4">
            {content.features.map((feature, i) => {
              const FeatureIcon = feature.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${feature.highlight ? content.iconBg : "bg-muted"}`}>
                    <FeatureIcon className={`h-4 w-4 ${feature.highlight ? content.iconColor : "text-muted-foreground"}`} />
                  </div>
                  <p className={`text-sm pt-1.5 ${feature.highlight ? "font-medium" : "text-muted-foreground"}`}>
                    {feature.text}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div
        className="space-y-3 fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none"
        data-testid="onboarding-first-win-actions"
      >
        <Button
          className="w-full"
          size="lg"
          onClick={() => void onFinish(content.ctaPath)}
          data-testid="button-onboarding-complete"
        >
          {content.ctaText}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        {secondary && (
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={() => void onFinish(secondary.path)}
            data-testid="button-onboarding-complete-secondary"
          >
            {secondary.label}
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Finishing saves your setup and opens the app. You can add more detail anytime in Settings.
        </p>
      </div>
    </div>
  );
}
