import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Utensils,
  Dumbbell,
  AlertCircle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Pizza,
  ArrowRight,
  ArrowLeft,
  Search,
  Thermometer,
  Plane,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { RatioAdviserTool } from "@/components/ratio-adviser-tool";
import { Switch } from "@/components/ui/switch";
import { storage, UserSettings, UserProfile, ScenarioState, RatioFormat, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { parseRatioToGramsPerUnit, calculateDoseFromCarbs, formatRatioForDisplay } from "@/lib/ratio-utils";
import { calculateMealDose, roundInsulinUnits, type MealDoseResult } from "@/lib/meal-dose";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FaceLogoWatermark } from "@/components/face-logo";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MealCarbAbsorptionPreview } from "@/components/meal-carb-absorption-preview";
import { MealDoseResultCard } from "@/components/meal-dose-result-card";

import { Link, useLocation } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { hypoTreatmentsInRollingHours } from "@/lib/hypo-context";
import { ageInWholeYearsUtc } from "@/lib/user-age";
import {
  getPostExerciseEducationalCopy,
  inferPostExerciseLoadTier,
} from "@/lib/post-exercise-nudge";
import {
  getMealAbsorptionVisual,
  getSplitFatAbsorptionVisual,
  MEAL_FOOD_TYPE_OPTIONS,
  mealFoodTypeLabel,
  splitFatLevelShortLabel,
  type MealFoodType,
} from "@/lib/meal-planner-food-categories";


function getInitialTab(): string {
  const params = new URLSearchParams(window.location.search);
  const split = params.get("split");
  if (split === "1" || split === "true") return "meal";
  const tab = params.get("tab");
  if (tab === "meal" || tab === "ratios") {
    return tab;
  }
  if (tab === "ratio-adviser") return "ratios";
  return "meal";
}

function getInitialMealTime(): string {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const mt = params.get("mealTime");
  if (mt === "breakfast" || mt === "lunch" || mt === "dinner" || mt === "snack") return mt;
  return "lunch";
}

function adviserSearchParams(location: string): URLSearchParams {
  const qs = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
  return new URLSearchParams(qs);
}

function buildMealPlannerHref(params: URLSearchParams, opts?: { result?: boolean }): string {
  const next = new URLSearchParams(params);
  next.set("tab", "meal");
  if (opts?.result) {
    next.set("result", "1");
  } else {
    next.delete("result");
  }
  const qs = next.toString();
  return qs ? `/adviser?${qs}` : "/adviser?tab=meal";
}

export default function Adviser() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [settings, setSettings] = useState<UserSettings>({});
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [cameFromRatios, setCameFromRatios] = useState(false);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [recentHypoCount48h, setRecentHypoCount48h] = useState(0);
  const [postExerciseNudgeRev, setPostExerciseNudgeRev] = useState(0);
  const showPostExerciseBanner = useMemo(() => storage.shouldShowPostExerciseEducationalNudges(), [postExerciseNudgeRev]);
  const postExerciseBannerCopy = useMemo(
    () => getPostExerciseEducationalCopy(inferPostExerciseLoadTier(storage.getLastExerciseSummary())),
    [postExerciseNudgeRev],
  );
  const didPrefillFromExerciseLink = useRef(false);
  const didPrefillFromAlcoholLink = useRef(false);
  const splitCalculatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = location.split("?")[0] ?? location;
    if (path !== "/adviser") return;
    const qs = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
    const params = new URLSearchParams(qs);
    const tab = params.get("tab");
    const split = params.get("split");
    if (split === "1" || split === "true") {
      setActiveTab("meal");
      setShowSplitCalculator(true);
    } else if (tab === "meal" || tab === "ratios") {
      setActiveTab(tab);
      if (tab === "ratios") setShowSplitCalculator(false);
    } else if (tab === "ratio-adviser") {
      setActiveTab("ratios");
      setShowSplitCalculator(false);
    }
    setCameFromRatios(params.get("from") === "ratios");

    const mtParam = params.get("mealTime");
    if (mtParam === "breakfast" || mtParam === "lunch" || mtParam === "dinner" || mtParam === "snack") {
      setMealTime(mtParam);
    }
  }, [location]);

  useEffect(() => {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "",
    );
    const tab = params.get("tab");
    const trackTab = tab === "ratios" || tab === "ratio-adviser" ? "ratios" : "meal";
    if (trackTab === "meal") {
      trackFeatureEngagement("adviser-meal");
    }
  }, []);

  const [mealResult, setMealResult] = useState<MealDoseResult | null>(null);
  const [showMealResultDetails, setShowMealResultDetails] = useState(false);

  const showMealResultPage =
    activeTab === "meal" &&
    adviserSearchParams(location).get("result") === "1" &&
    mealResult != null;

  useEffect(() => {
    const params = adviserSearchParams(location);
    if (params.get("result") === "1" && !mealResult) {
      setLocation(buildMealPlannerHref(params, { result: false }));
    }
  }, [location, mealResult, setLocation]);

  const openMealResultPage = (result: MealDoseResult) => {
    setMealResult(result);
    setShowMealResultDetails(false);
    setActiveTab("meal");
    setLocation(buildMealPlannerHref(adviserSearchParams(location), { result: true }));
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const closeMealResultPage = (clearResult = false) => {
    if (clearResult) setMealResult(null);
    setLocation(buildMealPlannerHref(adviserSearchParams(location), { result: false }));
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const [mealCarbs, setMealCarbs] = useState("");
  const [carbUnit, setCarbUnit] = useState<"grams" | "cp">("grams");
  const [mealTime, setMealTime] = useState<string>(getInitialMealTime);
  const [mealFoodType, setMealFoodType] = useState<MealFoodType>("balanced");
  const mealAbsorptionVisual = useMemo(() => getMealAbsorptionVisual(mealFoodType), [mealFoodType]);
  const mealFoodShortLabel = useMemo(() => {
    const full = mealFoodTypeLabel(mealFoodType);
    return full.includes(" (") ? full.slice(0, full.indexOf(" (")) : full;
  }, [mealFoodType]);

  const [planningAroundExercise, setPlanningAroundExercise] = useState(false);
  const [exerciseTiming, setExerciseTiming] = useState<"before" | "after" | "during">("before");
  const [exerciseWithin, setExerciseWithin] = useState("2");

  const [showCurrentRatios, setShowCurrentRatios] = useState(false);

  useEffect(() => {
    // Deep-link prefill from Exercise planner:
    // /adviser?tab=meal&exercise=1&exerciseTiming=before|after|during&exerciseWithin=<hours>
    // Only apply once per mount to avoid overriding user edits.
    if (didPrefillFromExerciseLink.current) return;
    try {
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "",
      );
      const exercise = params.get("exercise");
      if (exercise !== "1" && exercise !== "true") return;

      const timingRaw = params.get("exerciseTiming");
      const withinRaw = params.get("exerciseWithin");
      const timing =
        timingRaw === "after" || timingRaw === "during" || timingRaw === "before" ? timingRaw : "before";
      const withinNum = withinRaw != null ? parseInt(withinRaw, 10) : NaN;
      const within =
        Number.isFinite(withinNum) && withinNum >= 0 ? String(Math.min(24, Math.max(0, withinNum))) : "2";

      setActiveTab("meal");
      setPlanningAroundExercise(true);
      setExerciseTiming(timing);
      setExerciseWithin(within);
      didPrefillFromExerciseLink.current = true;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // If a workout just finished, default the meal planner to post-exercise.
    // Skip when an explicit deep-link prefill was applied.
    if (didPrefillFromExerciseLink.current || didPrefillFromAlcoholLink.current) return;
    try {
      const last = storage.getLastExerciseSummary();
      if (!last) return;
      const ended = new Date(last.endedAt).getTime();
      if (!Number.isFinite(ended)) return;
      const hoursSince = Math.max(0, Math.ceil((Date.now() - ended) / 3_600_000));
      if (hoursSince > 12) return;
      setActiveTab("meal");
      setPlanningAroundExercise(true);
      setExerciseTiming("after");
      setExerciseWithin(String(Math.min(24, hoursSince)));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Deep-link prefill from Alcohol scenario: /adviser?tab=meal&from=alcohol&carbs=60&mealTime=dinner
    if (didPrefillFromAlcoholLink.current) return;
    try {
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "",
      );
      if (params.get("from") !== "alcohol") return;
      const carbsRaw = params.get("carbs");
      const mt = params.get("mealTime");
      if (!carbsRaw || mt == null) return;
      const carbsNum = parseInt(carbsRaw, 10);
      if (!Number.isFinite(carbsNum) || carbsNum <= 0) return;
      const mealOk = mt === "breakfast" || mt === "lunch" || mt === "dinner" || mt === "snack";
      if (!mealOk) return;
      setActiveTab("meal");
      setMealCarbs(String(carbsNum));
      setMealTime(mt);
      setCarbUnit("grams");
      setPlanningAroundExercise(false);
      didPrefillFromAlcoholLink.current = true;
    } catch {
      // ignore
    }
  }, []);

  // Split Bolus Calculator state
  const [splitCarbs, setSplitCarbs] = useState("");
  const [splitFatLevel, setSplitFatLevel] = useState<"low" | "medium" | "high">("high");
  const [splitMealTime, setSplitMealTime] = useState<"breakfast" | "lunch" | "dinner" | "snack">("dinner");
  const [showSplitCalculator, setShowSplitCalculator] = useState(false);
  const [showSplitResultDetails, setShowSplitResultDetails] = useState(false);
  const [splitResult, setSplitResult] = useState<{
    totalUnits: number;
    firstDose: number;
    secondDose: number;
    secondDoseDelay: number;
    splitRatio: string;
    ratioUsed: string;
  } | null>(null);

  const splitAbsorptionVisual = useMemo(() => getSplitFatAbsorptionVisual(splitFatLevel), [splitFatLevel]);

  const bgUnits = profile.bgUnits || "mmol/L";
  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);

  useEffect(() => {
    setSettings(storage.getSettings());
    setScenarioState(storage.getScenarioState());
    setRecentHypoCount48h(hypoTreatmentsInRollingHours(storage.getHypoTreatments(), 48).length);
    const storedProfile = storage.getProfile();
    if (storedProfile) {
      setProfile(storedProfile);
      if (storedProfile.carbUnits) {
        setCarbUnit(storedProfile.carbUnits === "cp" ? "cp" : "grams");
      }
    }
  }, []);

  useEffect(() => {
    const onProfile = () => {
      const storedProfile = storage.getProfile();
      if (storedProfile) {
        setProfile(storedProfile);
        if (storedProfile.carbUnits) {
          setCarbUnit(storedProfile.carbUnits === "cp" ? "cp" : "grams");
        }
      }
    };
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  // Split Bolus Calculator function
  const calculateSplitBolus = () => {
    if (!splitCarbs) return;
    
    const carbValue = parseInt(splitCarbs);
    if (isNaN(carbValue) || carbValue <= 0) return;
    
    // Get ratio based on selected meal time
    const ratioMap: Record<string, string | undefined> = {
      breakfast: settings.breakfastRatio,
      lunch: settings.lunchRatio,
      dinner: settings.dinnerRatio,
      snack: settings.snackRatio || settings.lunchRatio, // Fallback snack to lunch
    };
    const selectedRatio = ratioMap[splitMealTime];
    
    let totalUnits = 0;
    let ratioUsed = "";
    const ratioFmt: RatioFormat = profile.ratioFormat || "per10g";
    const cpSize = profile?.carbPortionSize;
    
    if (selectedRatio) {
      const gpu = parseRatioToGramsPerUnit(selectedRatio);
      if (gpu && gpu > 0) {
        totalUnits = Math.round((carbValue / gpu) * 10) / 10;
        ratioUsed = `Using your ${splitMealTime} ratio (${formatRatioForDisplay(gpu, ratioFmt, cpSize)})`;
      }
    } else if (settings.tdd) {
      const ageYears = ageInWholeYearsUtc(profile.dateOfBirth ?? storage.getProfile()?.dateOfBirth);
      if (ageYears !== null && ageYears < 18) {
        toast({
          title: "Meal ratio needed",
          description:
            "For under-18 users we do not estimate doses from TDD alone. Add the meal ratio from your diabetes team in Settings, then try again.",
          variant: "destructive",
        });
        setSplitResult(null);
        return;
      }
      const estimatedRatio = Math.round(500 / settings.tdd);
      totalUnits = Math.round((carbValue / estimatedRatio) * 10) / 10;
      ratioUsed = `Estimated from TDD (${formatRatioForDisplay(estimatedRatio, ratioFmt, cpSize)})`;
    }
    
    if (totalUnits <= 0) {
      setSplitResult(null);
      return;
    }
    
    // Split ratios and timing based on fat content
    let firstPercent: number;
    let secondDoseDelay: number;
    let splitRatio: string;
    
    switch (splitFatLevel) {
      case "low":
        firstPercent = 70;
        secondDoseDelay = 1.5;
        splitRatio = "70/30";
        break;
      case "medium":
        firstPercent = 60;
        secondDoseDelay = 2;
        splitRatio = "60/40";
        break;
      case "high":
        firstPercent = 50;
        secondDoseDelay = 3;
        splitRatio = "50/50";
        break;
    }
    
    const totalRounded = roundInsulinUnits(totalUnits);
    const firstDose = roundInsulinUnits(totalRounded * (firstPercent / 100));
    const secondDose = roundInsulinUnits(totalRounded - firstDose);
    
    setSplitResult({
      totalUnits: totalRounded,
      firstDose,
      secondDose,
      secondDoseDelay,
      splitRatio,
      ratioUsed,
    });
    setShowSplitResultDetails(false);
  };

  const handleQuickMealPlan = () => {
    if (!mealCarbs) return;
    const carbValue = carbUnit === "cp" ? parseInt(mealCarbs) * 10 : parseInt(mealCarbs);
    const freshSettings = storage.getSettings();
    const exerciseContext = planningAroundExercise ? exerciseTiming : undefined;
    const hoursAway = planningAroundExercise ? parseInt(exerciseWithin) : undefined;

    const lastEx = storage.getLastExerciseSummary();
    const exerciseMeta =
      exerciseContext && lastEx && storage.didExerciseRecently(24)
        ? { exerciseType: lastEx.exerciseType, intensity: lastEx.intensity, durationMinutes: lastEx.durationMinutes }
        : undefined;

    const result = calculateMealDose(carbValue, mealTime, freshSettings, bgUnits, exerciseContext, hoursAway, exerciseMeta);

    try {
      storage.addActivityLog({
        activityType: "meal_planning",
        activityDetails: `${carbValue}g carbs for ${mealTime} (${mealFoodTypeLabel(mealFoodType)})`,
        recommendation: `${result.dose} units`,
      });
    } catch {}

    openMealResultPage(result);
  };

  const getRatioForMeal = (meal: string): string => {
    const ratioMap: Record<string, string | undefined> = {
      breakfast: settings.breakfastRatio,
      lunch: settings.lunchRatio,
      dinner: settings.dinnerRatio,
      snack: settings.snackRatio,
    };
    const val = ratioMap[meal];
    if (!val) return "Not set";
    const gpu = parseRatioToGramsPerUnit(val);
    if (!gpu || gpu <= 0) return "Not set";
    const fmt: RatioFormat = profile.ratioFormat || "per10g";
    return formatRatioForDisplay(gpu, fmt, profile.carbPortionSize);
  };

  return (
    <PageShell variant="standard" className="relative flex min-h-full flex-col">
      <FaceLogoWatermark />
      <PageHeader
        leading={<PageBackButton />}
        className="mb-4"
        title={showMealResultPage ? "Your dose suggestion" : "Meal &amp; ratios"}
        actions={
          <PageInfoDialog title="About Meal &amp; ratios" description="Meal planning and ratio tools">
            <InfoSection title="Meal planner">
              <p>
                Carbs and meal time set the dose from your ratios. After a suggestion, you&apos;ll see carbs and a simple absorption-time bar
                from your food choice (fast vs slow — typical patterns only). Use &quot;Planning around exercise?&quot; for before, during, or
                after workouts.
                {isPumpUser && (
                  <>
                    {" "}
                    On a pump, program boluses on your device and check IOB; automation may suggest different amounts.
                  </>
                )}
              </p>
            </InfoSection>
            <InfoSection title="Ratio adviser">
              <p>Estimate or refine insulin-to-carb ratios with guided steps, then return to the meal planner to use them.</p>
            </InfoSection>
            <InfoSection title="How it works">
              <p>All calculations use the ratios and settings you&apos;ve entered (carb ratios, TDD, correction factor). The more accurate your settings, the better the suggestions.</p>
            </InfoSection>
            <InfoSection title="Safety note">
              <p>All suggestions are for informational purposes only. Always verify with your own calculations and healthcare team. Not medical advice.</p>
            </InfoSection>
          </PageInfoDialog>
        }
      />

      {/**
       * Keep safety context visible without pushing the tools below the fold on phones.
       * These banners default to compact summaries with tap-to-expand details.
       */}
      {recentHypoCount48h > 0 && (
        <details className="group mb-3" data-testid="banner-recent-hypos-adviser">
          <summary className="list-none">
            <Alert className="cursor-pointer border-red-200/80 bg-red-50/50 p-3 dark:border-red-900/50 dark:bg-red-950/20 [&>svg]:left-3 [&>svg]:top-3 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg~*]:pl-6">
              <AlertCircle className="text-red-600 dark:text-red-400" />
              <AlertDescription className="text-xs leading-snug text-red-900 dark:text-red-100">
                <span className="font-semibold">Recent hypo:</span>{" "}
                {recentHypoCount48h} treatment{recentHypoCount48h === 1 ? "" : "s"} in the last 48h
                <span className="text-red-900/70 dark:text-red-100/70"> · tap for more</span>
              </AlertDescription>
              <div className="mt-2 hidden text-xs text-red-900/80 dark:text-red-100/80 group-open:block">
                Take extra care with boluses and corrections, and consider being more conservative until you&apos;re stable again.
              </div>
            </Alert>
          </summary>
        </details>
      )}

      {showPostExerciseBanner && (
        <details className="group mb-3" data-testid="banner-recent-exercise-adviser">
          <summary className="list-none">
            <Alert className="cursor-pointer border-emerald-300/60 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <Dumbbell className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              <AlertDescription className="text-sm text-emerald-900 dark:text-emerald-100">
                <strong>{postExerciseBannerCopy.adviserLead}:</strong>{" "}
                <span className="text-emerald-900/80 dark:text-emerald-100/80">tap for details</span>
              </AlertDescription>
              <div className="mt-2 hidden text-sm text-emerald-900/80 dark:text-emerald-100/80 group-open:block">
                {postExerciseBannerCopy.adviserDetail}
              </div>
            </Alert>
          </summary>
        </details>
      )}

      {scenarioState.sickDayActive && (
        <details className="group mb-3" data-testid="banner-sick-day-active">
          <summary className="list-none">
            <Alert className="cursor-pointer border-amber-500/50 bg-amber-50/50 p-3 dark:bg-amber-950/20">
              <Thermometer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Sick day:</strong> active <span className="text-amber-800/70 dark:text-amber-200/70">· tap for more</span>
                </span>
                <Link href="/scenarios/sick-day">
                  <Badge
                    variant="outline"
                    className="cursor-pointer border-amber-400 text-amber-700 dark:text-amber-300"
                    data-testid="link-sick-day-scenarios"
                  >
                    Settings
                  </Badge>
                </Link>
              </AlertDescription>
              <div className="mt-2 hidden text-sm text-amber-800/80 dark:text-amber-200/80 group-open:block">
                Your insulin needs may be different — ratios are adjusted and exercise should be approached cautiously.
              </div>
            </Alert>
          </summary>
        </details>
      )}

      {scenarioState.travelModeActive && (
        <details className="group mb-3" data-testid="banner-travel-mode-active">
          <summary className="list-none">
            <Alert className="cursor-pointer border-blue-500/50 bg-blue-50/50 p-3 dark:bg-blue-950/20">
              <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Travel:</strong>{" "}
                  active{scenarioState.travelDestination ? ` — ${scenarioState.travelDestination}` : ""}
                  <span className="text-blue-800/70 dark:text-blue-200/70"> · tap for more</span>
                </span>
                <Link href="/scenarios/travel">
                  <Badge
                    variant="outline"
                    className="cursor-pointer border-blue-400 text-blue-700 dark:text-blue-300"
                    data-testid="link-travel-scenarios"
                  >
                    Settings
                  </Badge>
                </Link>
              </AlertDescription>
              <div className="mt-2 hidden text-sm text-blue-800/80 dark:text-blue-200/80 group-open:block">
                Be mindful of timezone and routine changes affecting your levels.
              </div>
            </Alert>
          </summary>
        </details>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="meal" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-meal">
            <Utensils className="h-4 w-4" /><span>Meal</span>
          </TabsTrigger>
          <TabsTrigger value="ratios" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-ratios">
            <Search className="h-4 w-4" /><span>Ratios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meal" className="space-y-4 mt-4 animate-fade-in-up">
          {showMealResultPage && mealResult ? (
            <div className="space-y-4 animate-fade-in-up">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground -ml-2"
                onClick={() => closeMealResultPage()}
                data-testid="button-back-meal-planner"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to meal planner
              </Button>
              <MealDoseResultCard
                mealResult={mealResult}
                mealAbsorptionVisual={mealAbsorptionVisual}
                mealFoodShortLabel={mealFoodShortLabel}
                isPumpUser={isPumpUser}
                showDetails={showMealResultDetails}
                onShowDetailsChange={setShowMealResultDetails}
                scenarioState={scenarioState}
                onClose={() => closeMealResultPage(true)}
                onGoToRatios={() => {
                  closeMealResultPage(true);
                  setActiveTab("ratios");
                }}
                variant="page"
              />
            </div>
          ) : (
            <>
          {cameFromRatios && (
            <Link href="/settings/ratios">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="button-back-to-ratios-meal">
                <ArrowLeft className="h-4 w-4" />
                Back to Ratios
              </Button>
            </Link>
          )}
          {(!settings.breakfastRatio && !settings.lunchRatio && !settings.dinnerRatio) && (
            <Card className="border-primary/30 bg-primary/5" data-testid="card-no-ratios-guidance">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Calculator className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base">Let's get your ratios set up first</h3>
                    <p className="text-sm text-muted-foreground">
                      The meal planner needs your insulin-to-carb ratios to suggest doses. The Ratio Adviser can help you work these out in a couple of minutes.
                    </p>
                  </div>
                </div>
                <Button className="w-full gap-2" onClick={() => setActiveTab("ratios")} data-testid="button-go-ratio-adviser">
                  Go to Ratio Adviser
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                Quick Meal Planner
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-1">
                {isPumpUser
                  ? "Enter carbs for a bolus estimate to program on your pump"
                  : "Enter your carbs and get a mealtime dose suggestion"}
                <InfoTooltip {...DIABETES_TERMS.bolus} />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="meal-carbs" className="flex items-center">
                    How many carbs? ({carbUnit === "cp" ? "CP" : "grams"})
                    <InfoTooltip {...DIABETES_TERMS.carbRatio} />
                  </Label>
                  <Input
                    id="meal-carbs"
                    type="number"
                    placeholder={carbUnit === "cp" ? "e.g., 6" : "e.g., 60"}
                    value={mealCarbs}
                    onChange={(e) => setMealCarbs(e.target.value)}
                    data-testid="input-meal-carbs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meal-time">Which meal?</Label>
                  <Select value={mealTime} onValueChange={setMealTime}>
                    <SelectTrigger id="meal-time" data-testid="select-meal-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meal-food-type">What sort of food?</Label>
                <Select value={mealFoodType} onValueChange={(v) => setMealFoodType(v as MealFoodType)}>
                  <SelectTrigger id="meal-food-type" data-testid="select-meal-food-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_FOOD_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  <Label htmlFor="exercise-toggle" className="text-sm font-medium cursor-pointer">
                    Planning around exercise?
                  </Label>
                </div>
                <Switch
                  id="exercise-toggle"
                  checked={planningAroundExercise}
                  onCheckedChange={setPlanningAroundExercise}
                  data-testid="switch-exercise-toggle"
                />
              </div>

              {planningAroundExercise && (
                <div className="grid gap-4 md:grid-cols-2 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label>Meal timing vs exercise</Label>
                    <Select value={exerciseTiming} onValueChange={(v: "before" | "after" | "during") => setExerciseTiming(v)}>
                      <SelectTrigger data-testid="select-exercise-timing">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">Meal before exercise</SelectItem>
                        <SelectItem value="after">Meal after exercise</SelectItem>
                        <SelectItem value="during">During exercise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {exerciseTiming !== "during" && (
                    <div className="space-y-2">
                      <Label>How many hours {exerciseTiming === "before" ? "until" : "since"} exercise?</Label>
                      <Select value={exerciseWithin} onValueChange={setExerciseWithin}>
                        <SelectTrigger data-testid="select-exercise-hours">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">About 1 hour</SelectItem>
                          <SelectItem value="2">About 2 hours</SelectItem>
                          <SelectItem value="3">About 3 hours</SelectItem>
                          <SelectItem value="4">4+ hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-muted/50 rounded-lg">
                <Collapsible open={showCurrentRatios} onOpenChange={setShowCurrentRatios}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-3 p-3 text-left"
                      data-testid="button-toggle-current-ratios"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Your current ratios</p>
                        <p className="text-xs text-muted-foreground">
                          Breakfast {getRatioForMeal("breakfast")} · Lunch {getRatioForMeal("lunch")}
                        </p>
                      </div>
                      {showCurrentRatios ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div className="flex justify-between gap-1 flex-wrap">
                          <span className="text-muted-foreground">Breakfast:</span>
                          <span className={getRatioForMeal("breakfast") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("breakfast")}</span>
                        </div>
                        <div className="flex justify-between gap-1 flex-wrap">
                          <span className="text-muted-foreground">Lunch:</span>
                          <span className={getRatioForMeal("lunch") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("lunch")}</span>
                        </div>
                        <div className="flex justify-between gap-1 flex-wrap">
                          <span className="text-muted-foreground">Dinner:</span>
                          <span className={getRatioForMeal("dinner") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("dinner")}</span>
                        </div>
                        <div className="flex justify-between gap-1 flex-wrap">
                          <span className="text-muted-foreground">Snack:</span>
                          <span className={getRatioForMeal("snack") === "Not set" ? "text-muted-foreground" : "font-medium"}>{getRatioForMeal("snack")}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                        <p className="text-xs text-muted-foreground">
                          Estimate or update ratios in the <span className="font-medium text-foreground">Ratios</span> tab above.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => setActiveTab("ratios")}
                          data-testid="button-ratios-from-current-ratios"
                        >
                          Open Ratios tab
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <Button
                onClick={handleQuickMealPlan}
                disabled={!mealCarbs}
                className="w-full"
                data-testid="button-get-meal-advice"
              >
                {isPumpUser ? "Get bolus suggestion" : "Get Dose Suggestion"}
              </Button>
            </CardContent>
          </Card>

          {mealFoodType === "high_fat_protein" && !showSplitCalculator ? (
            <Alert
              className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/25"
              data-testid="alert-high-fat-split-nudge"
            >
              <Pizza className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-foreground">Try the split dose calculator below.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="shrink-0 border-amber-500/30 bg-background/80"
                  data-testid="button-open-split-from-nudge"
                  onClick={() => {
                    setShowSplitCalculator(true);
                    window.requestAnimationFrame(() => {
                      splitCalculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    });
                  }}
                >
                  Open split calculator
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div ref={splitCalculatorRef}>
          <Card
            className={cn(
              "overflow-hidden border-primary/30 shadow-md shadow-primary/5",
              showSplitCalculator ? "ring-2 ring-primary/25" : "ring-1 ring-primary/15",
            )}
            data-testid="card-split-dose-calculator"
          >
            <div className="border-b border-primary/10 bg-gradient-to-br from-primary/14 via-primary/6 to-transparent px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3.5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20"
                  aria-hidden
                >
                  <Pizza className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                      Split dose calculator
                    </h3>
                    <Badge
                      variant="secondary"
                      className="rounded-full border-primary/20 bg-primary/10 px-2.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-primary"
                    >
                      High-fat meals
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Collapsible open={showSplitCalculator} onOpenChange={setShowSplitCalculator}>
              <div className="px-4 py-3 sm:px-5">
                <CollapsibleTrigger asChild>
                  <Button
                    variant={showSplitCalculator ? "secondary" : "default"}
                    className="h-11 w-full gap-2 rounded-xl text-sm font-semibold shadow-sm"
                    data-testid="button-split-calculator-toggle"
                  >
                    {showSplitCalculator ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Hide calculator
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4" />
                        Calculate split doses
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <CardContent className="space-y-4 border-t border-border/50 pt-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="split-carbs">Total carbs (g)</Label>
                      <Input
                        id="split-carbs"
                        type="number"
                        placeholder="e.g., 80"
                        value={splitCarbs}
                        onChange={(e) => setSplitCarbs(e.target.value)}
                        data-testid="input-split-carbs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="split-meal">Which meal?</Label>
                      <Select value={splitMealTime} onValueChange={(v: "breakfast" | "lunch" | "dinner" | "snack") => setSplitMealTime(v)}>
                        <SelectTrigger id="split-meal" data-testid="select-split-meal">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="breakfast">Breakfast</SelectItem>
                          <SelectItem value="lunch">Lunch</SelectItem>
                          <SelectItem value="dinner">Dinner</SelectItem>
                          <SelectItem value="snack">Snack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="split-fat">Fat content</Label>
                      <Select value={splitFatLevel} onValueChange={(v: "low" | "medium" | "high") => setSplitFatLevel(v)}>
                        <SelectTrigger id="split-fat" data-testid="select-split-fat">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low fat (pasta, rice)</SelectItem>
                          <SelectItem value="medium">Medium fat (burgers, curries)</SelectItem>
                          <SelectItem value="high">High fat (pizza, fish & chips)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={calculateSplitBolus} disabled={!splitCarbs} className="w-full rounded-xl" data-testid="button-calculate-split">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate split doses
                  </Button>

                  {splitResult && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Pizza className="h-4 w-4 text-primary" />
                          Split plan
                        </h4>
                        <Badge variant="secondary" className="font-mono text-xs tabular-nums">
                          {splitResult.splitRatio}
                        </Badge>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {isPumpUser ? "FIRST PART — NOW" : "FIRST DOSE - NOW"}
                          </p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{splitResult.firstDose} units</p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            {isPumpUser ? "Program or deliver at meal start" : "Take when you start eating"}
                          </p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            {isPumpUser ? "SECOND PART — LATER" : "SECOND DOSE - LATER"}
                          </p>
                          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{splitResult.secondDose} units</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {isPumpUser
                              ? `Program remainder in ${splitResult.secondDoseDelay} h (or use extended bolus)`
                              : `Take in ${splitResult.secondDoseDelay} hours`}
                          </p>
                        </div>
                      </div>

                      <MealCarbAbsorptionPreview
                        carbsGrams={parseInt(splitCarbs, 10)}
                        visual={splitAbsorptionVisual}
                        foodChoiceLabel={splitFatLevelShortLabel(splitFatLevel)}
                        previewTestId="split-carb-absorption-preview"
                      />

                      <Collapsible open={showSplitResultDetails} onOpenChange={setShowSplitResultDetails}>
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="w-full flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left"
                            data-testid="button-toggle-split-result-details"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="text-sm font-medium">More detail</span>
                              <span className="text-xs text-muted-foreground truncate">Why split, ratio, tips</span>
                            </div>
                            {showSplitResultDetails ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pt-2 space-y-3">
                            <MedicalNumericOutputDisclaimer compact />
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                High-fat meals slow carb absorption.{" "}
                                {isPumpUser
                                  ? "Delivering the full bolus at once can cause an early low then a late rise. Splitting matches digestion — on a pump, extended or dual-wave bolus often does this for you."
                                  : "Taking all insulin upfront can cause an initial hypo, then a late spike. Split your dose to match the slower digestion."}
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>
                                <strong>Total:</strong> {splitResult.totalUnits} units for {splitCarbs}g carbs
                              </p>
                              <p className="text-xs">{splitResult.ratioUsed}</p>
                              <p>
                                <strong>Why split?</strong> Fat slows carb absorption by {splitResult.secondDoseDelay - 1} to{" "}
                                {splitResult.secondDoseDelay + 1} hours.
                              </p>
                            </div>
                            <div className="p-2 bg-muted rounded text-xs text-muted-foreground space-y-1">
                              <p>
                                <strong>Rounding guide:</strong> This app rounds suggested doses to whole units (pen-friendly). If you use
                                a device that can deliver finer increments, follow your care team&apos;s guidance.
                              </p>
                              <p>
                                <strong>Tip:</strong>{" "}
                                {isPumpUser
                                  ? "Set a timer for the second part; check BG and IOB before delivering."
                                  : "Set a timer for your second dose! Check BG before taking it."}
                              </p>
                            </div>
                            {isPumpUser && (
                              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800" data-testid="pump-tip-split-bolus">
                                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">Pump Users</p>
                                <p className="text-sm text-indigo-800 dark:text-indigo-200">
                                  Your pump may have an extended/square wave bolus feature that handles this automatically. Check your
                                  pump&apos;s manual for how to set up a dual-wave or combo bolus instead of manually splitting doses.
                                </p>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              [Not medical advice. Everyone&apos;s response to fat varies. Start conservatively and adjust based on your
                              experience.]
                            </p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
          </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="ratios" className="space-y-4 mt-4 animate-fade-in-up">
          {cameFromRatios && (
            <Link href="/settings/ratios">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="button-back-to-ratios">
                <ArrowLeft className="h-4 w-4" />
                Back to Ratios
              </Button>
            </Link>
          )}
          <RatioAdviserTool settings={settings} bgUnit={bgUnits} onSettingsUpdate={(s) => setSettings(s)} onNavigateToMeal={() => setActiveTab("meal")} />
        </TabsContent>
      </Tabs>

      {activeTab === "meal" ? (
        <>
          <div className="mt-4 flex items-center justify-center gap-3 pb-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" aria-hidden />
              Not medical advice — always follow your diabetes team&apos;s guidance
            </span>
          </div>
          <div className="flex justify-center pb-6">
            <MedicalSourcesLink anchor="insulin" compact />
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
