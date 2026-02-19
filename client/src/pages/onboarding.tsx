import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowRight, ArrowLeft, Check, Package, Utensils, Dumbbell, LayoutDashboard, Heart, Shield, Sparkles, Clock, TrendingDown } from "lucide-react";
import { FaceLogo } from "@/components/face-logo";
import { storage } from "@/lib/storage";
import { parseInputToGramsPerUnit, formatRatioForStorage } from "@/lib/ratio-utils";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";
import { validateTDD, validateCorrectionFactor, validateCarbRatio } from "@/lib/clinical-validation";
import { ClinicalWarningHint } from "@/components/clinical-warning";

type Struggle = "supplies" | "meals" | "exercise" | "overview" | null;

type Step = 
  | "welcome"
  | "struggle"
  | "essentials"
  | "path_data"
  | "disclaimer"
  | "first_win";

const STRUGGLE_OPTIONS = [
  {
    id: "supplies" as Struggle,
    icon: Package,
    title: "I keep running out of supplies",
    description: "Insulin, needles, sensors — I never know when to reorder",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    id: "meals" as Struggle,
    icon: Utensils,
    title: "I struggle with meal dosing",
    description: "Working out carbs and insulin for meals is stressful",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "exercise" as Struggle,
    icon: Dumbbell,
    title: "Exercise throws my levels off",
    description: "I worry about going low or high when I'm active",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-500/10",
  },
  {
    id: "overview" as Struggle,
    icon: LayoutDashboard,
    title: "I want everything in one place",
    description: "A single hub for supplies, meals, exercise and more",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
  },
];

interface OnboardingData {
  name: string;
  diabetesType: string;
  struggle: Struggle;
  insulinDeliveryMethod: string;
  bgUnits: string;
  carbUnits: string;
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
  onComplete?: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [data, setData] = useState<OnboardingData>({
    name: "",
    diabetesType: "type1",
    struggle: null,
    insulinDeliveryMethod: "",
    bgUnits: "mmol/L",
    carbUnits: "grams",
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

  const updateData = (field: keyof OnboardingData, value: string | boolean | Struggle) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const getSteps = (): Step[] => {
    return ["welcome", "struggle", "essentials", "path_data", "disclaimer", "first_win"];
  };

  const steps = getSteps();
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex) / (steps.length - 1)) * 100;

  const handleSaveProfile = () => {
    storage.saveProfile({
      name: data.name,
      email: "",
      bgUnits: data.bgUnits,
      carbUnits: data.carbUnits,
      diabetesType: data.diabetesType || "type1",
      insulinDeliveryMethod: data.insulinDeliveryMethod === "injections" ? "pen" : data.insulinDeliveryMethod,
      usingInsulin: true,
      hasAcceptedDisclaimer: data.hasAcceptedDisclaimer,
      dateOfBirth: "",
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
  };

  const handleNext = () => {
    const stepIndex = steps.indexOf(currentStep);
    if (stepIndex < steps.length - 1) {
      if (currentStep === "disclaimer") {
        handleSaveProfile();
      }
      setCurrentStep(steps[stepIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepIndex = steps.indexOf(currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1]);
    }
  };

  const handleFinish = () => {
    localStorage.setItem("diabeater_onboarding_completed", "true");
    toast({
      title: `Welcome to Diabeaters${data.name ? `, ${data.name}` : ""}!`,
      description: "Let's get started.",
    });
    if (onComplete) {
      onComplete();
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case "welcome": return true;
      case "struggle": return data.struggle !== null;
      case "essentials": return !!data.insulinDeliveryMethod;
      case "path_data": return true;
      case "disclaimer": return data.hasAcceptedDisclaimer;
      case "first_win": return true;
      default: return true;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return <WelcomeStep data={data} updateData={updateData} />;
      case "struggle":
        return <StruggleStep data={data} updateData={updateData} />;
      case "essentials":
        return <EssentialsStep data={data} updateData={updateData} />;
      case "path_data":
        return <PathDataStep data={data} updateData={updateData} />;
      case "disclaimer":
        return <DisclaimerStep data={data} updateData={updateData} />;
      case "first_win":
        return <FirstWinStep data={data} onFinish={handleFinish} />;
      default:
        return null;
    }
  };

  const showProgress = currentStep !== "welcome" && currentStep !== "first_win";
  const showBackButton = currentStep !== "welcome" && currentStep !== "first_win";
  const showNextButton = currentStep !== "first_win";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg space-y-6">
        {currentStep !== "welcome" && (
          <div className="flex justify-center">
            <FaceLogo size={40} />
          </div>
        )}

        {showProgress && (
          <Progress value={progress} className="h-1.5" data-testid="progress-onboarding" />
        )}

        <div className="animate-fade-in-up">
          {renderStep()}
        </div>

        {(showBackButton || showNextButton) && (currentStep as string) !== "first_win" && (
          <div className="flex justify-between gap-4">
            {showBackButton ? (
              <Button variant="outline" onClick={handleBack} data-testid="button-onboarding-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            ) : <div />}
            <div className="flex-1" />
            {currentStep === "path_data" && (
              <Button variant="ghost" onClick={handleNext} data-testid="button-onboarding-skip">
                Skip for now
              </Button>
            )}
            {showNextButton && (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="min-w-32"
                data-testid="button-onboarding-next"
              >
                {currentStep === "disclaimer" ? "Let's go" : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Copyright PassingTime Ltd {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function WelcomeStep({ data, updateData }: { data: OnboardingData; updateData: (field: keyof OnboardingData, value: any) => void }) {
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
            Stay one step ahead of your diabetes.
            Less guessing, more living.
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

          <div className="space-y-2">
            <Label className="text-base">What type of diabetes do you have?</Label>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => updateData("diabetesType", "type1")}
                className={`flex items-center justify-between p-3 rounded-md border text-left transition-colors ${
                  data.diabetesType === "type1"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover-elevate"
                }`}
                data-testid="button-diabetes-type1"
              >
                <span className="font-medium text-sm">Type 1</span>
                {data.diabetesType === "type1" && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
              <button
                type="button"
                disabled
                className="flex items-center justify-between p-3 rounded-md border border-border text-left opacity-50 cursor-not-allowed"
                data-testid="button-diabetes-type2"
              >
                <span className="font-medium text-sm text-muted-foreground">Type 2</span>
                <span className="text-xs text-muted-foreground">Coming soon</span>
              </button>
              <button
                type="button"
                disabled
                className="flex items-center justify-between p-3 rounded-md border border-border text-left opacity-50 cursor-not-allowed"
                data-testid="button-diabetes-gestational"
              >
                <span className="font-medium text-sm text-muted-foreground">Gestational</span>
                <span className="text-xs text-muted-foreground">Coming soon</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

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

function StruggleStep({ data, updateData }: { data: OnboardingData; updateData: (field: keyof OnboardingData, value: any) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">
          {data.name ? `${data.name}, what` : "What"}'s your biggest challenge right now?
        </h2>
        <p className="text-muted-foreground">
          We'll set things up around what matters most to you
        </p>
      </div>

      <div className="space-y-3">
        {STRUGGLE_OPTIONS.map((option) => {
          const isSelected = data.struggle === option.id;
          const Icon = option.icon;
          return (
            <div
              key={option.id}
              className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all hover-elevate ${
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""
              }`}
              onClick={() => updateData("struggle", option.id)}
              data-testid={`struggle-${option.id}`}
            >
              <div className={`p-3 rounded-lg ${option.bg}`}>
                <Icon className={`h-5 w-5 ${option.color}`} />
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

function EssentialsStep({ data, updateData }: { data: OnboardingData; updateData: (field: keyof OnboardingData, value: any) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">A few essentials</h2>
        <p className="text-muted-foreground">
          Just the basics so we can personalise your experience
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">How do you take your insulin?</Label>
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
        </CardContent>
      </Card>
    </div>
  );
}

function PathDataStep({ data, updateData }: { data: OnboardingData; updateData: (field: keyof OnboardingData, value: any) => void }) {
  const struggle = data.struggle;

  if (struggle === "supplies") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-blue-500/10">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold">Let's sort your supplies</h2>
          <p className="text-muted-foreground">
            A couple of numbers so we can predict when you'll run out
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {data.insulinDeliveryMethod === "pump" ? (
              <div className="space-y-4">
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
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
              </div>
            )}
            <p className="text-xs text-muted-foreground italic">
              You can always update these later in Settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (struggle === "meals") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-amber-500/10">
              <Utensils className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold">Let's simplify mealtimes</h2>
          <p className="text-muted-foreground">
            Your ratios let us suggest doses — even rough numbers help
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
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
            </div>
            <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">How much 1 unit lowers your blood sugar</p>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Not sure? No problem — you can always add these later in Settings, or use our Ratio Adviser to figure them out.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (struggle === "exercise") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-green-500/10">
              <Dumbbell className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold">Let's make exercise easier</h2>
          <p className="text-muted-foreground">
            We need a couple of numbers to give you adjustment suggestions
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">All insulin you take in a day — this helps calculate exercise adjustments</p>
            </div>
            <div className="space-y-2">
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
            </div>
            <p className="text-xs text-muted-foreground italic">
              You can always update these later in Settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-purple-500/10">
            <LayoutDashboard className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">Your all-in-one hub</h2>
        <p className="text-muted-foreground">
          A few details so we can make everything work together
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
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
          <div className="space-y-2">
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
          </div>
          <p className="text-xs text-muted-foreground italic">
            You can add more detail later in Settings — we'll prompt you when it's needed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
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
            <div className="text-sm space-y-2">
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                Diabeaters does not provide medical advice.
              </p>
              <ul className="space-y-1.5 text-yellow-800 dark:text-yellow-200 ml-4 list-disc">
                <li>All suggestions are for information only</li>
                <li>Never adjust insulin without your healthcare team</li>
                <li>In emergencies, call 999 immediately</li>
                <li>This is a companion tool, not a replacement for medical care</li>
              </ul>
            </div>
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

function FirstWinStep({ data, onFinish }: { data: OnboardingData; onFinish: () => void }) {
  const struggle = data.struggle;

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
          { icon: Sparkles, text: "Smart prescription suggestions — skip what you don't need yet" },
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
        ctaPath: "/adviser?tab=exercise",
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
        { icon: Sparkles, text: "AI-powered activity recommendations" },
      ],
      ctaText: "Go to Dashboard",
      ctaPath: "/",
    };
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <div className="space-y-8">
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

      <div className="space-y-3">
        <Button
          className="w-full"
          size="lg"
          onClick={onFinish}
          data-testid="button-onboarding-complete"
        >
          {content.ctaText}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You can add more details anytime from Settings
        </p>
      </div>
    </div>
  );
}
