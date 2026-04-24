import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Utensils, Dumbbell, AlertCircle, Calculator, ChevronDown, ChevronUp, Pizza, X, ArrowRight, ArrowLeft, Search, Thermometer, Plane, BookOpen } from "lucide-react";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { RatioAdviserTool } from "@/components/ratio-adviser-tool";
import { Switch } from "@/components/ui/switch";
import { storage, UserSettings, UserProfile, ScenarioState, RatioFormat } from "@/lib/storage";
import { parseRatioToGramsPerUnit, calculateDoseFromCarbs, formatRatioForDisplay } from "@/lib/ratio-utils";
import { calculateMealDose, roundInsulinUnits, type MealDoseResult } from "@/lib/meal-dose";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FaceLogoWatermark } from "@/components/face-logo";
import { MedicalNumericOutputDisclaimer } from "@/components/medical-numeric-output-disclaimer";

import { Link, useLocation } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { hypoTreatmentsInRollingHours } from "@/lib/hypo-context";


function getInitialTab(): string {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (tab === "meal" || tab === "ratios") {
    return tab;
  }
  if (tab === "ratio-adviser") return "ratios";
  return "meal";
}

export default function Adviser() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [settings, setSettings] = useState<UserSettings>({});
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [cameFromRatios, setCameFromRatios] = useState(false);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [recentHypoCount48h, setRecentHypoCount48h] = useState(0);
  const didPrefillFromExerciseLink = useRef(false);
  const didPrefillFromAlcoholLink = useRef(false);

  useEffect(() => {
    const path = location.split("?")[0] ?? location;
    if (path !== "/adviser") return;
    const qs = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
    const params = new URLSearchParams(qs);
    const tab = params.get("tab");
    if (tab === "meal" || tab === "ratios") {
      setActiveTab(tab);
    } else if (tab === "ratio-adviser") {
      setActiveTab("ratios");
    }
    setCameFromRatios(params.get("from") === "ratios");
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

  const [mealCarbs, setMealCarbs] = useState("");
  const [carbUnit, setCarbUnit] = useState<"grams" | "cp">("grams");
  const [mealTime, setMealTime] = useState<string>("lunch");

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
  const [splitResult, setSplitResult] = useState<{
    totalUnits: number;
    firstDose: number;
    secondDose: number;
    secondDoseDelay: number;
    splitRatio: string;
    ratioUsed: string;
  } | null>(null);

  const bgUnits = profile.bgUnits || "mmol/L";
  const isPumpUser = profile?.insulinDeliveryMethod === "pump";

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
  };

  const handleQuickMealPlan = () => {
    if (!mealCarbs) return;
    const carbValue = carbUnit === "cp" ? parseInt(mealCarbs) * 10 : parseInt(mealCarbs);
    const freshSettings = storage.getSettings();
    const exerciseContext = planningAroundExercise ? exerciseTiming : undefined;
    const hoursAway = planningAroundExercise ? parseInt(exerciseWithin) : undefined;
    
    const result = calculateMealDose(carbValue, mealTime, freshSettings, bgUnits, exerciseContext, hoursAway);
    setMealResult(result);
    
    try {
      storage.addActivityLog({
        activityType: "meal_planning",
        activityDetails: `${carbValue}g carbs for ${mealTime}`,
        recommendation: `${result.dose} units`,
      });
    } catch {}
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
        title="Meal &amp; ratios"
        actions={
          <PageInfoDialog title="About Meal &amp; ratios" description="Meal planning and ratio tools">
            <InfoSection title="Meal planner">
              <p>
                Enter carbs and meal type for a dose suggestion based on your ratios. Toggle &quot;Planning around exercise?&quot; to get
                adjusted doses for meals before, during, or after workouts.
                {isPumpUser && (
                  <>
                    {" "}
                    If you use a pump, program boluses on your device and always check IOB; your pump may suggest different amounts if
                    automation is on.
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

      {recentHypoCount48h > 0 && (
        <Alert
          className="mb-3 border-red-200/80 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-3 [&>svg]:left-3 [&>svg]:top-3 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg~*]:pl-6"
          data-testid="banner-recent-hypos-adviser"
        >
          <AlertCircle className="text-red-600 dark:text-red-400" />
          <AlertDescription className="text-xs text-red-900 dark:text-red-100 leading-snug">
            <strong className="font-semibold">Recent hypo:</strong>{" "}
            {recentHypoCount48h} treatment{recentHypoCount48h === 1 ? "" : "s"} logged in the last 48 hours — take extra
            care with boluses and corrections.
          </AlertDescription>
        </Alert>
      )}

      {scenarioState.sickDayActive && (
        <Alert className="mb-4 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" data-testid="banner-sick-day-active">
          <Thermometer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-amber-800 dark:text-amber-200">
              Sick Day Mode is active. Your insulin needs may be different — ratios are adjusted and exercise should be approached cautiously.
            </span>
            <Link href="/scenarios/sick-day">
              <Badge variant="outline" className="cursor-pointer text-amber-700 dark:text-amber-300 border-amber-400" data-testid="link-sick-day-scenarios">
                Sick Day Settings
              </Badge>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {scenarioState.travelModeActive && (
        <Alert className="mb-4 border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20" data-testid="banner-travel-mode-active">
          <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Travel Mode is active{scenarioState.travelDestination ? ` — ${scenarioState.travelDestination}` : ''}. Be mindful of timezone and routine changes affecting your levels.
            </span>
            <Link href="/scenarios/travel">
              <Badge variant="outline" className="cursor-pointer text-blue-700 dark:text-blue-300 border-blue-400" data-testid="link-travel-scenarios">
                Travel Settings
              </Badge>
            </Link>
          </AlertDescription>
        </Alert>
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
          {cameFromRatios && (
            <Link href="/ratios">
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

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Your Current Ratios</p>
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
              </div>

              <Button onClick={handleQuickMealPlan} disabled={!mealCarbs} className="w-full" data-testid="button-get-meal-advice">
                {isPumpUser ? "Get bolus suggestion" : "Get Dose Suggestion"}
              </Button>
            </CardContent>
          </Card>

          {mealResult && (
            <Card data-testid="card-meal-result">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-primary" />
                    {mealResult.exerciseContext === "during" ? "During-Exercise Fuel" :
                     mealResult.exerciseContext === "before" ? "Pre-Exercise Dose" :
                     mealResult.exerciseContext === "after" ? "Post-Exercise Dose" :
                     "Your Dose Suggestion"}
                  </h4>
                  <Button variant="ghost" size="icon" onClick={() => setMealResult(null)} data-testid="button-clear-meal-result">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {mealResult.error !== "no_ratios" && <MedicalNumericOutputDisclaimer compact />}

                {mealResult.error === "no_ratios" ? (
                  <div className="p-4 bg-muted rounded-lg text-center space-y-2">
                    <p className="text-sm text-muted-foreground">You need insulin-to-carb ratios before the meal planner can suggest doses.</p>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setMealResult(null); setActiveTab("ratios"); }} data-testid="button-no-ratios-go-adviser">
                      <Calculator className="h-3.5 w-3.5" />
                      Go to Ratio Adviser
                    </Button>
                  </div>
                ) : mealResult.exerciseContext === "during" ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-4 dark:border-blue-800/50 dark:bg-blue-950/25">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">
                            During exercise
                          </p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {isPumpUser ? "Usually no meal bolus" : "Usually no insulin"}
                          </p>
                          <p className="text-sm text-blue-700/80 dark:text-blue-200/80">
                            {mealResult.carbs}g carbs
                            {mealResult.standardDose != null
                              ? ` • Standard would be ${mealResult.standardDose}u${isPumpUser ? " (meal bolus)" : ""}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    {mealResult.tips && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {mealResult.tips.map((tip, i) => <li key={i} className="flex gap-2"><span className="text-primary">-</span>{tip}</li>)}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mealResult.exerciseContext && mealResult.standardDose !== undefined && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Standard</p>
                          <p className="text-xl font-bold line-through text-muted-foreground">
                            {mealResult.standardDose}u
                          </p>
                          <p className="text-xs text-muted-foreground">{mealResult.carbs}g • {mealResult.mealType}</p>
                        </div>
                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-center dark:border-emerald-800/50 dark:bg-emerald-950/25">
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium uppercase tracking-wide">
                            {mealResult.exerciseContext === "before" ? "Pre‑exercise" : "Post‑exercise"}
                            {typeof mealResult.exerciseReduction === "number" ? ` • −${mealResult.exerciseReduction}%` : ""}
                          </p>
                          <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100" data-testid="text-meal-dose">
                            {mealResult.dose}u
                          </p>
                          <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">
                            {isPumpUser ? "Adjusted bolus (program on pump)" : "Adjusted dose"}
                          </p>
                        </div>
                      </div>
                    )}
                    {mealResult.exerciseContext && mealResult.standardDose !== undefined && isPumpUser ? (
                      <p className="text-xs text-muted-foreground text-center">
                        Check IOB before delivering; your pump may show a different recommended bolus if automation is active.
                      </p>
                    ) : null}
                    {!mealResult.exerciseContext && (
                      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-center dark:border-emerald-800/50 dark:bg-emerald-950/25">
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium uppercase tracking-wide">Suggested</p>
                        <p className="text-4xl font-bold text-emerald-900 dark:text-emerald-100" data-testid="text-meal-dose">
                          {mealResult.dose}u
                        </p>
                        <p className="text-sm text-emerald-700/80 dark:text-emerald-200/80">
                          {mealResult.carbs}g • {mealResult.mealType}
                        </p>
                        {isPumpUser ? (
                          <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90 pt-1">
                            Check IOB on your pump before delivering; use extended or combo bolus if your team recommends it for this meal.
                          </p>
                        ) : null}
                      </div>
                    )}
                    {mealResult.roundingAdvice && (
                      <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                        <strong>Rounding guide:</strong> {mealResult.roundingAdvice}
                      </div>
                    )}
                    {mealResult.tips && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {mealResult.tips.map((tip, i) => <li key={i} className="flex gap-2"><span className="text-primary">-</span>{tip}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">[Not medical advice. Always verify with your own calculations.]</p>
              </CardContent>
            </Card>
          )}

          {scenarioState.sickDayActive && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800" data-testid="meal-note-sick-day">
              <div className="flex items-start gap-2">
                <Thermometer className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Sick Day Note:</strong> Your ratios may need 10-30% more insulin during illness. The Sick Day tool has adjusted ratios for you.
                </p>
              </div>
            </div>
          )}

          {scenarioState.travelModeActive && Math.abs(scenarioState.travelTimezoneShift || 0) >= 2 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800" data-testid="meal-note-travel">
              <div className="flex items-start gap-2">
                <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Travel Note:</strong> You're in a different timezone. Your usual meal times and ratios may need adjusting as your body clock adapts.
                </p>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            data-testid="button-open-ratio-adviser"
            onClick={() => setActiveTab("ratios")}
          >
            <Calculator className="h-4 w-4 text-primary" />
            <span>Ratio Adviser</span>
            <span className="ml-auto text-xs text-muted-foreground">Review or estimate your ratios</span>
          </Button>

          <Card>
            <Collapsible open={showSplitCalculator} onOpenChange={setShowSplitCalculator}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-4 h-auto" data-testid="button-split-calculator-toggle">
                  <div className="flex items-center gap-2">
                    <Pizza className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <span className="font-medium">Split Dose Calculator</span>
                      <p className="text-xs text-muted-foreground font-normal">For high-fat meals like pizza, fish & chips</p>
                    </div>
                  </div>
                  {showSplitCalculator ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      High-fat meals slow carb absorption.{" "}
                      {isPumpUser
                        ? "Delivering the full bolus at once can cause an early low then a late rise. Splitting matches digestion — on a pump, extended or dual-wave bolus often does this for you."
                        : "Taking all insulin upfront can cause an initial hypo, then a late spike. Split your dose to match the slower digestion."}
                    </p>
                  </div>

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

                  <Button onClick={calculateSplitBolus} disabled={!splitCarbs} className="w-full" data-testid="button-calculate-split">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Split Doses
                  </Button>

                  {splitResult && (
                    <div className="p-4 bg-primary/5 rounded-lg space-y-3">
                      <MedicalNumericOutputDisclaimer compact />
                      <h4 className="font-medium flex items-center gap-2">
                        <Pizza className="h-4 w-4 text-primary" />
                        Your Split Dose Plan ({splitResult.splitRatio})
                      </h4>
                      
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

                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Total:</strong> {splitResult.totalUnits} units for {splitCarbs}g carbs</p>
                        <p className="text-xs">{splitResult.ratioUsed}</p>
                        <p><strong>Why split?</strong> Fat slows carb absorption by {splitResult.secondDoseDelay - 1} to {splitResult.secondDoseDelay + 1} hours.</p>
                      </div>

                      <div className="p-2 bg-muted rounded text-xs text-muted-foreground space-y-1">
                        <p><strong>Rounding guide:</strong> This app rounds suggested doses to whole units (pen-friendly). If you use a device that can deliver finer increments, follow your care team’s guidance.</p>
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
                            Your pump may have an extended/square wave bolus feature that handles this automatically. 
                            Check your pump's manual for how to set up a dual-wave or combo bolus instead of manually splitting doses.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    [Not medical advice. Everyone's response to fat varies. Start conservatively and adjust based on your experience.]
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </TabsContent>

        <TabsContent value="ratios" className="space-y-4 mt-4 animate-fade-in-up">
          {cameFromRatios && (
            <Link href="/ratios">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="button-back-to-ratios">
                <ArrowLeft className="h-4 w-4" />
                Back to Ratios
              </Button>
            </Link>
          )}
          <RatioAdviserTool settings={settings} bgUnit={bgUnits} onSettingsUpdate={(s) => setSettings(s)} onNavigateToMeal={() => setActiveTab("meal")} />
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pb-4 mt-4">
        <span className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Not medical advice — always follow your diabetes team's guidance
        </span>
      </div>
      <div className="flex justify-center pb-6">
        <MedicalSourcesLink anchor="insulin" compact />
      </div>
    </PageShell>
  );
}
