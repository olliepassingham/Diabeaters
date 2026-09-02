import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowRight,
  ArrowLeft,
  Search,
  Thermometer,
  Plane,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RatioAdviserTool } from "@/components/ratio-adviser-tool";
import { Switch } from "@/components/ui/switch";
import { storage, UserSettings, UserProfile, ScenarioState, RatioFormat, DIABEATER_PROFILE_CHANGED_EVENT } from "@/lib/storage";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { parseRatioToGramsPerUnit, calculateDoseFromCarbs, formatRatioForDisplay } from "@/lib/ratio-utils";
import { calculateMealDose, calculateSplitDose, insulinRoundIncrement, type MealDoseResult, type SplitFatTier } from "@/lib/meal-dose";
import { getEffectiveTdd } from "@/lib/tdd";
import { Badge } from "@/components/ui/badge";
import { FaceLogoWatermark } from "@/components/face-logo";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";
import { MealCarbAbsorptionPreview } from "@/components/meal-carb-absorption-preview";
import { MealCompositionBuilder } from "@/components/meal-composition-builder";
import { MealDoseResultCard } from "@/components/meal-dose-result-card";
import { CarbEstimatorSheet } from "@/components/carb-estimator-sheet";
import { ScenarioResultHero, ScenarioResultHeroSuffix } from "@/components/scenarios/scenario-result-hero";

import { Link, useLocation, useSearch } from "wouter";
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
  computeMealImpact,
  DEFAULT_MEAL_COMPOSITION,
  mealCompositionSummaryLabel,
  type MealComposition,
  type MealImpactProfile,
} from "@/lib/meal-impact";
import {
  getSplitFatAbsorptionVisual,
  splitFatLevelShortLabel,
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

function adviserSearchParams(search: string): URLSearchParams {
  // wouter's useLocation() only returns the pathname (no query string), so callers
  // must pass the search string from useSearch() here, not the location itself.
  return new URLSearchParams(search);
}

export default function Adviser() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const search = useSearch();
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
    const params = adviserSearchParams(search);
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
  }, [location, search]);

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
  // Plain local state rather than a URL query flag — keeps this view resilient to any
  // transient re-renders of the search string (wouter's history-driven `useSearch()` can
  // update out of step with local `setState` batches) and avoids a stale/removed dose
  // result flashing back to the entry form right after it was computed.
  const [showMealResultPage, setShowMealResultPage] = useState(false);

  const openMealResultPage = (result: MealDoseResult, impact: MealImpactProfile) => {
    setMealResult(result);
    setMealResultImpact(impact);
    setShowMealResultDetails(false);
    setActiveTab("meal");
    setShowMealResultPage(true);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const closeMealResultPage = (clearResult = false) => {
    setShowMealResultPage(false);
    if (clearResult) {
      setMealResult(null);
      setMealResultImpact(null);
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const [mealCarbs, setMealCarbs] = useState("");
  const [carbUnit, setCarbUnit] = useState<"grams" | "cp">("grams");
  const [carbEstimatorOpen, setCarbEstimatorOpen] = useState(false);
  const [mealTime, setMealTime] = useState<string>(getInitialMealTime);
  const [mealComposition, setMealComposition] = useState<MealComposition>(DEFAULT_MEAL_COMPOSITION);
  const mealImpact = useMemo(() => computeMealImpact(mealComposition), [mealComposition]);
  const [mealResultImpact, setMealResultImpact] = useState<MealImpactProfile | null>(null);

  const [planningAroundExercise, setPlanningAroundExercise] = useState(false);
  const [exerciseTiming, setExerciseTiming] = useState<"before" | "after" | "during">("before");
  const [exerciseWithin, setExerciseWithin] = useState("2");

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
  const roundIncrement = insulinRoundIncrement(isPumpUser);

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
    } else {
      const effectiveTdd = getEffectiveTdd(settings);
      if (!effectiveTdd) {
        setSplitResult(null);
        return;
      }
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
      const estimatedRatio = Math.round(500 / effectiveTdd);
      totalUnits = Math.round((carbValue / estimatedRatio) * 10) / 10;
      ratioUsed = `Estimated from TDD (${formatRatioForDisplay(estimatedRatio, ratioFmt, cpSize)})`;
    }
    
    if (totalUnits <= 0) {
      setSplitResult(null);
      return;
    }

    const split = calculateSplitDose(totalUnits, splitFatLevel, roundIncrement);

    setSplitResult({
      totalUnits: split.totalUnits,
      firstDose: split.firstDose,
      secondDose: split.secondDose,
      secondDoseDelay: split.secondDoseDelay,
      splitRatio: split.splitRatio,
      ratioUsed,
    });
    setShowSplitResultDetails(false);
  };

  const handleQuickMealPlan = () => {
    const carbValue = carbUnit === "cp" ? parseInt(mealCarbs) * 10 : parseInt(mealCarbs);
    if (!mealCarbs || !Number.isFinite(carbValue) || carbValue <= 0) {
      toast({
        title: "Enter carbs first",
        description: "Add how many carbs you're about to eat before getting a dose suggestion.",
        variant: "destructive",
      });
      return;
    }
    const freshSettings = storage.getSettings();
    const exerciseContext = planningAroundExercise ? exerciseTiming : undefined;
    const hoursAway = planningAroundExercise ? parseInt(exerciseWithin) : undefined;

    const lastEx = storage.getLastExerciseSummary();
    const exerciseMeta =
      exerciseContext && lastEx && storage.didExerciseRecently(24)
        ? { exerciseType: lastEx.exerciseType, intensity: lastEx.intensity, durationMinutes: lastEx.durationMinutes }
        : undefined;

    const result = calculateMealDose(carbValue, mealTime, freshSettings, bgUnits, exerciseContext, hoursAway, exerciseMeta, roundIncrement);

    try {
      storage.addActivityLog({
        activityType: "meal_planning",
        activityDetails: `${carbValue}g carbs for ${mealTime} (${mealCompositionSummaryLabel(mealComposition)})`,
        recommendation: `${result.dose} units`,
      });
    } catch {}

    openMealResultPage(result, mealImpact);
  };

  /** Re-runs the calculation once ratios are saved from the inline "no ratios" setup panel. */
  const handleMealRatiosSaved = (updated: UserSettings) => {
    setSettings(updated);
    handleQuickMealPlan();
  };

  /** Opens the standalone split calculator prefilled from the just-calculated result. */
  const openSplitCalculatorFromResult = () => {
    if (!mealResult) return;
    setSplitCarbs(String(mealResult.carbs));
    if (
      mealResult.mealType === "breakfast" ||
      mealResult.mealType === "lunch" ||
      mealResult.mealType === "dinner" ||
      mealResult.mealType === "snack"
    ) {
      setSplitMealTime(mealResult.mealType);
    }
    const tier: SplitFatTier =
      mealResultImpact?.composition.hasFat && mealResultImpact?.composition.hasProtein ? "high" : "medium";
    setSplitFatLevel(tier);
    closeMealResultPage(false);
    setShowSplitCalculator(true);
    window.requestAnimationFrame(() => {
      splitCalculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    <PageShell variant="standard" density="compact" className="relative flex min-h-full flex-col">
      <FaceLogoWatermark />
      <PageHeader
        leading={<PageBackButton />}
        title={showMealResultPage ? "Your dose suggestion" : "Meal & ratios"}
        actions={
          <PageInfoDialog title="About Meal & ratios" description="Meal planning and ratio tools">
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
       * Compact context chips under the title — keep safety signals visible without
       * creating a large gap before the Meal / Ratios tabs.
       */}
      {(recentHypoCount48h > 0 ||
        showPostExerciseBanner ||
        scenarioState.sickDayActive ||
        scenarioState.travelModeActive) && (
        <div className="flex flex-col gap-1.5">
          {recentHypoCount48h > 0 && (
            <details className="group" data-testid="banner-recent-hypos-adviser">
              <summary className="list-none">
                <div className="flex cursor-pointer items-center gap-2 rounded-xl border border-red-200/70 bg-red-50/70 px-3 py-2 text-xs leading-snug text-red-900 transition-colors hover:bg-red-50 dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-100 dark:hover:bg-red-950/40">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold">Recent hypo:</span>{" "}
                    {recentHypoCount48h} treatment{recentHypoCount48h === 1 ? "" : "s"} in the last 48h
                    <span className="text-red-900/65 dark:text-red-100/65"> · tap for more</span>
                  </p>
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 text-red-900/50 transition-transform group-open:rotate-180 dark:text-red-100/50"
                    aria-hidden
                  />
                </div>
              </summary>
              <p className="mt-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
                Take extra care with boluses and corrections, and consider being more conservative until you&apos;re stable again.
              </p>
            </details>
          )}

          {showPostExerciseBanner && (
            <details className="group" data-testid="banner-recent-exercise-adviser">
              <summary className="list-none">
                <div className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-300/55 bg-emerald-50/70 px-3 py-2 text-xs leading-snug text-emerald-950 transition-colors hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-100 dark:hover:bg-emerald-950/40">
                  <Dumbbell className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold">{postExerciseBannerCopy.adviserLead}</span>
                    <span className="text-emerald-950/65 dark:text-emerald-100/65"> · tap for details</span>
                  </p>
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 text-emerald-950/45 transition-transform group-open:rotate-180 dark:text-emerald-100/50"
                    aria-hidden
                  />
                </div>
              </summary>
              <p className="mt-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
                {postExerciseBannerCopy.adviserDetail}
              </p>
            </details>
          )}

          {scenarioState.sickDayActive && (
            <details className="group" data-testid="banner-sick-day-active">
              <summary className="list-none">
                <div className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-50/70 px-3 py-2 text-xs leading-snug text-amber-950 transition-colors hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100 dark:hover:bg-amber-950/40">
                  <Thermometer className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold">Sick day:</span> active
                    <span className="text-amber-950/65 dark:text-amber-100/65"> · tap for more</span>
                  </p>
                  <Link
                    href="/scenarios/sick-day"
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Badge
                      variant="outline"
                      className="h-6 border-amber-400/80 px-2 text-[10px] font-semibold text-amber-800 dark:text-amber-200"
                      data-testid="link-sick-day-scenarios"
                    >
                      Settings
                    </Badge>
                  </Link>
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 text-amber-950/45 transition-transform group-open:rotate-180 dark:text-amber-100/50"
                    aria-hidden
                  />
                </div>
              </summary>
              <p className="mt-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
                Your insulin needs may be different — ratios are adjusted and exercise should be approached cautiously.
              </p>
            </details>
          )}

          {scenarioState.travelModeActive && (
            <details className="group" data-testid="banner-travel-mode-active">
              <summary className="list-none">
                <div className="flex cursor-pointer items-center gap-2 rounded-xl border border-sky-300/55 bg-sky-50/70 px-3 py-2 text-xs leading-snug text-sky-950 transition-colors hover:bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-100 dark:hover:bg-sky-950/40">
                  <Plane className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold">Travel:</span>{" "}
                    active{scenarioState.travelDestination ? ` — ${scenarioState.travelDestination}` : ""}
                    <span className="text-sky-950/65 dark:text-sky-100/65"> · tap for more</span>
                  </p>
                  <Link
                    href="/scenarios/travel"
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Badge
                      variant="outline"
                      className="h-6 border-sky-400/80 px-2 text-[10px] font-semibold text-sky-800 dark:text-sky-200"
                      data-testid="link-travel-scenarios"
                    >
                      Settings
                    </Badge>
                  </Link>
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 text-sky-950/45 transition-transform group-open:rotate-180 dark:text-sky-100/50"
                    aria-hidden
                  />
                </div>
              </summary>
              <p className="mt-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
                Be mindful of timezone and routine changes affecting your levels.
              </p>
            </details>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col">
        <TabsList className="grid h-11 w-full max-w-md grid-cols-2 rounded-full border border-border/50 bg-muted/35 p-0.5">
          <TabsTrigger value="meal" className="gap-1.5 rounded-full text-xs sm:text-sm" data-testid="tab-meal">
            <Utensils className="h-4 w-4" /><span>Meal</span>
          </TabsTrigger>
          <TabsTrigger value="ratios" className="gap-1.5 rounded-full text-xs sm:text-sm" data-testid="tab-ratios">
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
                mealImpact={mealResultImpact}
                isPumpUser={isPumpUser}
                showDetails={showMealResultDetails}
                onShowDetailsChange={setShowMealResultDetails}
                scenarioState={scenarioState}
                onClose={() => closeMealResultPage(true)}
                onGoToRatios={() => {
                  closeMealResultPage(true);
                  setActiveTab("ratios");
                }}
                onOpenSplitCalculator={openSplitCalculatorFromResult}
                settings={settings}
                bgUnit={bgUnits}
                ratioFormat={profile.ratioFormat || "per10g"}
                carbPortionSize={profile?.carbPortionSize}
                onRatiosSaved={handleMealRatiosSaved}
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

          <Card className="overflow-hidden rounded-[1.35rem] border-primary/20 bg-gradient-to-b from-primary/[0.07] via-card to-card shadow-none dark:border-primary/15 dark:from-primary/10">
            <CardContent className="space-y-4 px-4 pb-5 pt-4 sm:px-5">
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Carbs</h3>
                <div className="space-y-2 rounded-2xl border border-border/50 bg-background/70 p-3 shadow-sm dark:bg-background/40">
                  <Label htmlFor="meal-carbs" className="sr-only">
                    How many carbs? ({carbUnit === "cp" ? "CP" : "grams"})
                  </Label>
                  <div className="flex items-stretch gap-2">
                    <Input
                      id="meal-carbs"
                      type="number"
                      inputMode="decimal"
                      placeholder={carbUnit === "cp" ? "6" : "60"}
                      value={mealCarbs}
                      onChange={(e) => setMealCarbs(e.target.value)}
                      className="h-14 flex-1 rounded-xl border-border/60 bg-background text-2xl font-semibold tabular-nums tracking-tight shadow-none"
                      data-testid="input-meal-carbs"
                    />
                    <span className="flex min-w-[4.5rem] items-center justify-center rounded-xl border border-border/60 bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
                      {carbUnit === "cp" ? "CP" : "g"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full rounded-xl text-primary hover:bg-primary/10"
                    onClick={() => setCarbEstimatorOpen(true)}
                    data-testid="button-open-carb-estimator"
                  >
                    <Search className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Estimate from foods
                  </Button>
                </div>
              </section>

              <div className="space-y-1.5">
                <Label htmlFor="meal-time" className="text-xs font-medium text-muted-foreground">
                  Meal
                </Label>
                <Select value={mealTime} onValueChange={setMealTime}>
                  <SelectTrigger id="meal-time" className="h-12 rounded-xl" data-testid="select-meal-time">
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

              <MealCompositionBuilder value={mealComposition} onChange={setMealComposition} />

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-background/70 px-3 py-2.5 dark:bg-background/40">
                <div className="flex min-w-0 items-center gap-2">
                  <Dumbbell className="h-4 w-4 shrink-0 text-primary" />
                  <Label htmlFor="exercise-toggle" className="text-sm font-medium cursor-pointer">
                    Around exercise?
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
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/50 bg-muted/30 p-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Timing</Label>
                    <Select value={exerciseTiming} onValueChange={(v: "before" | "after" | "during") => setExerciseTiming(v)}>
                      <SelectTrigger className="h-12 rounded-xl" data-testid="select-exercise-timing">
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
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Hours {exerciseTiming === "before" ? "until" : "since"}
                      </Label>
                      <Select value={exerciseWithin} onValueChange={setExerciseWithin}>
                        <SelectTrigger className="h-12 rounded-xl" data-testid="select-exercise-hours">
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

              <div
                className="rounded-2xl border border-border/50 bg-background/70 p-3 dark:bg-background/40"
                data-testid="meal-ratios-strip"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Your ratios</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => setActiveTab("ratios")}
                    data-testid="button-ratios-from-strip"
                  >
                    Edit
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
                    <div key={m} className="rounded-lg bg-muted/30 px-1.5 py-1.5 text-center">
                      <p className="text-[10px] capitalize text-muted-foreground">{m.slice(0, 4)}</p>
                      <p
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          getRatioForMeal(m) === "Not set" && "font-normal text-muted-foreground",
                        )}
                        data-testid={`meal-ratios-strip-${m}`}
                      >
                        {getRatioForMeal(m)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleQuickMealPlan}
                disabled={!mealCarbs}
                className="h-12 w-full rounded-xl text-sm font-semibold"
                data-testid="button-get-meal-advice"
              >
                {isPumpUser ? "Get bolus suggestion" : "Get dose"}
              </Button>
            </CardContent>
          </Card>

          <div ref={splitCalculatorRef}>
          <Card
            className={cn(
              "overflow-hidden rounded-2xl border-border/60 bg-card shadow-none",
              showSplitCalculator ? "ring-2 ring-primary/20" : "",
            )}
            data-testid="card-split-dose-calculator"
          >
            <div className="border-b border-border/50 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  Split dose calculator
                </h3>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0 text-[10px] font-semibold uppercase tracking-wide">
                  High-fat meals
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Split bolus for slower-absorbing meals — pizza, curry, fish &amp; chips.
              </p>
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
                      <ScenarioResultHero
                        label="Split plan"
                        value={
                          <>
                            {splitResult.firstDose + splitResult.secondDose}
                            <ScenarioResultHeroSuffix>u</ScenarioResultHeroSuffix>
                          </>
                        }
                      >
                        <p className="mt-2 text-sm text-muted-foreground">
                          {splitResult.firstDose}u now · {splitResult.secondDose}u in {splitResult.secondDoseDelay}h
                        </p>
                        <Badge variant="secondary" className="mt-2 font-mono text-xs tabular-nums">
                          {splitResult.splitRatio}
                        </Badge>
                      </ScenarioResultHero>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-center">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isPumpUser ? "First part — now" : "First dose — now"}
                          </p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{splitResult.firstDose}u</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {isPumpUser ? "Program or deliver at meal start" : "Take when you start eating"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-center">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isPumpUser ? "Second part — later" : "Second dose — later"}
                          </p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{splitResult.secondDose}u</p>
                          <p className="mt-1 text-xs text-muted-foreground">
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

      <CarbEstimatorSheet
        open={carbEstimatorOpen}
        onOpenChange={setCarbEstimatorOpen}
        onConfirm={(grams) => {
          setMealCarbs(String(grams));
          setCarbUnit("grams");
          toast({
            title: "Carb estimate added",
            description: `${grams}g is ready to check before continuing.`,
          });
        }}
      />

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
