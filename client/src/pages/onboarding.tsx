import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowRight, ArrowLeft, Check, SkipForward } from "lucide-react";
import { FaceLogo } from "@/components/face-logo";
import { storage } from "@/lib/storage";
import { InfoTooltip, DIABETES_TERMS } from "@/components/info-tooltip";

type Step = "personal" | "units" | "diabetes" | "delivery" | "insulin" | "usage" | "disclaimer" | "complete";

interface OnboardingData {
  name: string;
  bgUnits: string;
  carbUnits: string;
  diabetesType: string;
  insulinDeliveryMethod: string;
  usingInsulin: boolean;
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

const STEPS: Step[] = ["personal", "units", "diabetes", "delivery", "insulin", "usage", "disclaimer", "complete"];

interface OnboardingProps {
  onComplete?: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("personal");
  const [data, setData] = useState<OnboardingData>({
    name: "",
    bgUnits: "mmol/L",
    carbUnits: "grams",
    diabetesType: "",
    insulinDeliveryMethod: "",
    usingInsulin: false,
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

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleSaveProfile = () => {
    storage.saveProfile({
      name: data.name,
      email: "",
      bgUnits: data.bgUnits,
      carbUnits: data.carbUnits,
      diabetesType: data.diabetesType,
      insulinDeliveryMethod: data.insulinDeliveryMethod === "injections" ? "pen" : data.insulinDeliveryMethod,
      usingInsulin: data.usingInsulin,
      hasAcceptedDisclaimer: data.hasAcceptedDisclaimer,
      dateOfBirth: "",
    });

    const settings: Record<string, number | string | undefined> = {};
    if (data.tdd) settings.tdd = parseFloat(data.tdd);
    if (data.breakfastRatio) settings.breakfastRatio = data.breakfastRatio;
    if (data.lunchRatio) settings.lunchRatio = data.lunchRatio;
    if (data.dinnerRatio) settings.dinnerRatio = data.dinnerRatio;
    if (data.correctionFactor) settings.correctionFactor = parseFloat(data.correctionFactor);
    if (data.shortActingUnitsPerDay) settings.shortActingUnitsPerDay = parseInt(data.shortActingUnitsPerDay);
    if (data.longActingUnitsPerDay) settings.longActingUnitsPerDay = parseInt(data.longActingUnitsPerDay);
    if (data.injectionsPerDay) settings.injectionsPerDay = parseInt(data.injectionsPerDay);
    if (data.cgmDays) settings.cgmDays = parseInt(data.cgmDays);

    if (Object.keys(settings).length > 0) {
      storage.saveSettings(settings);
    }

    toast({
      title: "Welcome to Diabeaters!",
      description: "Your profile has been set up successfully.",
    });

    if (onComplete) {
      onComplete();
    }
  };

  const handleNext = () => {
    const stepIndex = STEPS.indexOf(currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepIndex = STEPS.indexOf(currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1]);
    }
  };

  const handleComplete = () => {
    if (!data.hasAcceptedDisclaimer) {
      toast({
        title: "Disclaimer Required",
        description: "Please accept the disclaimer to continue.",
        variant: "destructive",
      });
      return;
    }
    handleSaveProfile();
  };

  const updateData = (field: keyof OnboardingData, value: string | boolean) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const isSkippableStep = currentStep === "insulin" || currentStep === "usage";

  const renderStep = () => {
    switch (currentStep) {
      case "personal":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Let's get to know you better</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">What should we call you?</Label>
                <Input id="name" value={data.name} onChange={(e) => updateData("name", e.target.value)} placeholder="Your name" data-testid="input-onboarding-name" />
              </div>
            </CardContent>
          </Card>
        );

      case "units":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Units & Formatting</CardTitle>
              <CardDescription>Choose your preferred measurement units</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Blood Glucose Units</Label>
                <RadioGroup value={data.bgUnits} onValueChange={(value) => updateData("bgUnits", value)} className="space-y-2">
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => updateData("bgUnits", "mmol/L")}>
                    <RadioGroupItem value="mmol/L" id="mmol" data-testid="radio-mmol" />
                    <Label htmlFor="mmol" className="font-normal cursor-pointer flex-1">mmol/L (millimoles per litre)</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => updateData("bgUnits", "mg/dL")}>
                    <RadioGroupItem value="mg/dL" id="mgdl" data-testid="radio-mgdl" />
                    <Label htmlFor="mgdl" className="font-normal cursor-pointer flex-1">mg/dL (milligrams per decilitre)</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>Carbohydrate Units</Label>
                <RadioGroup value={data.carbUnits} onValueChange={(value) => updateData("carbUnits", value)} className="space-y-2">
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => updateData("carbUnits", "grams")}>
                    <RadioGroupItem value="grams" id="grams" data-testid="radio-grams" />
                    <Label htmlFor="grams" className="font-normal cursor-pointer flex-1">Grams</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => updateData("carbUnits", "portions-10g")}>
                    <RadioGroupItem value="portions-10g" id="portions-10g" data-testid="radio-portions-10g" />
                    <Label htmlFor="portions-10g" className="font-normal cursor-pointer flex-1">Carb Portion (10g)</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => updateData("carbUnits", "portions-15g")}>
                    <RadioGroupItem value="portions-15g" id="portions-15g" data-testid="radio-portions-15g" />
                    <Label htmlFor="portions-15g" className="font-normal cursor-pointer flex-1">Carb Portion (15g)</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        );

      case "diabetes":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Diabetes Type</CardTitle>
              <CardDescription>Select your diabetes type for personalised guidance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={data.diabetesType} onValueChange={(value) => updateData("diabetesType", value)} className="space-y-3">
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => updateData("diabetesType", "type1")}>
                  <RadioGroupItem value="type1" id="type1" className="mt-1" data-testid="radio-type1" />
                  <div className="flex-1">
                    <Label htmlFor="type1" className="font-medium cursor-pointer">Type 1 Diabetes</Label>
                    <p className="text-sm text-muted-foreground mt-1">Autoimmune condition requiring insulin therapy</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border opacity-60 cursor-not-allowed">
                  <RadioGroupItem value="type2" id="type2" className="mt-1" disabled data-testid="radio-type2" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="type2" className="font-medium text-muted-foreground">Type 2 Diabetes</Label>
                      <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Metabolic condition, may or may not require insulin</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border opacity-60 cursor-not-allowed">
                  <RadioGroupItem value="gestational" id="gestational" className="mt-1" disabled data-testid="radio-gestational" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="gestational" className="font-medium text-muted-foreground">Gestational Diabetes</Label>
                      <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Diabetes during pregnancy</p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        );

      case "delivery":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Insulin Delivery</CardTitle>
              <CardDescription>How do you administer insulin?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={data.insulinDeliveryMethod}
                onValueChange={(value) => { updateData("insulinDeliveryMethod", value); updateData("usingInsulin", true); }}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => { updateData("insulinDeliveryMethod", "injections"); updateData("usingInsulin", true); }}>
                  <RadioGroupItem value="injections" id="injections" className="mt-1" data-testid="radio-injections" />
                  <div className="flex-1">
                    <Label htmlFor="injections" className="font-medium cursor-pointer">Injections (Multiple Daily Injections)</Label>
                    <p className="text-sm text-muted-foreground mt-1">Multiple daily injections with pens or syringes</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => { updateData("insulinDeliveryMethod", "pump"); updateData("usingInsulin", true); }}>
                  <RadioGroupItem value="pump" id="pump" className="mt-1" data-testid="radio-pump" />
                  <div className="flex-1">
                    <Label htmlFor="pump" className="font-medium cursor-pointer">Insulin Pump</Label>
                    <p className="text-sm text-muted-foreground mt-1">A device that delivers insulin continuously throughout the day</p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        );

      case "insulin":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Your Insulin Settings</CardTitle>
              <CardDescription>These help calculate doses - you can skip and add later in Settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="onboard-tdd" className="flex items-center">
                    Total Daily Dose (units)
                    <InfoTooltip {...DIABETES_TERMS.tdd} />
                  </Label>
                  <Input id="onboard-tdd" type="number" placeholder="e.g., 40" value={data.tdd} onChange={(e) => updateData("tdd", e.target.value)} data-testid="input-onboarding-tdd" />
                  <p className="text-xs text-muted-foreground">All insulin you take in a day</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboard-correction" className="flex items-center">
                    Correction Factor
                    <InfoTooltip {...DIABETES_TERMS.correctionFactor} />
                  </Label>
                  <Input id="onboard-correction" type="number" step="0.1" placeholder={data.bgUnits === "mmol/L" ? "e.g., 3" : "e.g., 50"} value={data.correctionFactor} onChange={(e) => updateData("correctionFactor", e.target.value)} data-testid="input-onboarding-correction" />
                  <p className="text-xs text-muted-foreground">How much 1 unit lowers your blood sugar</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center">
                  Carb Ratios (units per 10g carbs)
                  <InfoTooltip {...DIABETES_TERMS.carbRatio} />
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Breakfast</Label>
                    <Input type="number" step="0.1" placeholder="e.g., 1.0" value={data.breakfastRatio} onChange={(e) => updateData("breakfastRatio", e.target.value)} data-testid="input-onboarding-breakfast-ratio" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Lunch</Label>
                    <Input type="number" step="0.1" placeholder="e.g., 0.8" value={data.lunchRatio} onChange={(e) => updateData("lunchRatio", e.target.value)} data-testid="input-onboarding-lunch-ratio" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Dinner</Label>
                    <Input type="number" step="0.1" placeholder="e.g., 1.0" value={data.dinnerRatio} onChange={(e) => updateData("dinnerRatio", e.target.value)} data-testid="input-onboarding-dinner-ratio" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">Don't worry if you're unsure - you can always update these in Settings later.</p>
            </CardContent>
          </Card>
        );

      case "usage":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Daily Supply Usage</CardTitle>
              <CardDescription>Helps predict when supplies will run out - you can skip and add later</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.insulinDeliveryMethod === "pump" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label className="flex items-center">
                      Total Daily Dose
                      <InfoTooltip {...DIABETES_TERMS.tdd} />
                    </Label>
                    <div className="h-9 px-3 rounded-md border bg-muted/50 flex items-center">
                      <span className={data.tdd ? "" : "text-muted-foreground"}>
                        {data.tdd ? `${data.tdd} units/day` : "Set in the previous step"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboard-cgm" className="flex items-center">
                      Sensor Duration (days)
                      <InfoTooltip {...DIABETES_TERMS.cgmDuration} />
                    </Label>
                    <Input id="onboard-cgm" type="number" placeholder="e.g., 10 or 14" value={data.cgmDays} onChange={(e) => updateData("cgmDays", e.target.value)} data-testid="input-onboarding-cgm" />
                    <p className="text-xs text-muted-foreground">How many days each glucose sensor lasts</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="onboard-short" className="flex items-center">
                      Short-Acting Units/Day
                      <InfoTooltip {...DIABETES_TERMS.shortActing} />
                    </Label>
                    <Input id="onboard-short" type="number" placeholder="e.g., 25" value={data.shortActingUnitsPerDay} onChange={(e) => updateData("shortActingUnitsPerDay", e.target.value)} data-testid="input-onboarding-short-acting" />
                    <p className="text-xs text-muted-foreground">Mealtime insulin - 100 units = 1 pen</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboard-long" className="flex items-center">
                      Long-Acting Units/Day
                      <InfoTooltip {...DIABETES_TERMS.longActing} />
                    </Label>
                    <Input id="onboard-long" type="number" placeholder="e.g., 20" value={data.longActingUnitsPerDay} onChange={(e) => updateData("longActingUnitsPerDay", e.target.value)} data-testid="input-onboarding-long-acting" />
                    <p className="text-xs text-muted-foreground">Background insulin - 100 units = 1 pen</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboard-injections" className="flex items-center">
                      Injections Per Day
                      <InfoTooltip {...DIABETES_TERMS.injectionsPerDay} />
                    </Label>
                    <Input id="onboard-injections" type="number" placeholder="e.g., 4" value={data.injectionsPerDay} onChange={(e) => updateData("injectionsPerDay", e.target.value)} data-testid="input-onboarding-injections" />
                    <p className="text-xs text-muted-foreground">Total injections including all types</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboard-cgm" className="flex items-center">
                      Sensor Duration (days)
                      <InfoTooltip {...DIABETES_TERMS.cgmDuration} />
                    </Label>
                    <Input id="onboard-cgm" type="number" placeholder="e.g., 10 or 14" value={data.cgmDays} onChange={(e) => updateData("cgmDays", e.target.value)} data-testid="input-onboarding-cgm" />
                    <p className="text-xs text-muted-foreground">How many days each glucose sensor lasts</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground italic">This information helps your Supply Tracker predict when you'll need more supplies. You can update it anytime in Settings.</p>
            </CardContent>
          </Card>
        );

      case "disclaimer":
        return (
          <Card className="border-yellow-500/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <CardTitle>Important Disclaimer</CardTitle>
              </div>
              <CardDescription>Please read and accept before continuing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-sm space-y-3">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Diabeaters does not provide medical advice.
                </p>
                <ul className="space-y-2 text-yellow-800 dark:text-yellow-200 ml-4 list-disc">
                  <li>All recommendations are for informational purposes only</li>
                  <li>Never adjust your insulin or medication without consulting your healthcare team</li>
                  <li>In emergencies, contact emergency services immediately</li>
                  <li>This app is a companion tool, not a replacement for professional medical care</li>
                </ul>
              </div>
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover-elevate cursor-pointer" onClick={() => updateData("hasAcceptedDisclaimer", !data.hasAcceptedDisclaimer)}>
                <Checkbox id="disclaimer" checked={data.hasAcceptedDisclaimer} onCheckedChange={(checked) => updateData("hasAcceptedDisclaimer", checked === true)} data-testid="checkbox-disclaimer" />
                <div className="flex-1">
                  <Label htmlFor="disclaimer" className="font-medium cursor-pointer">I understand and accept</Label>
                  <p className="text-sm text-muted-foreground mt-1">I acknowledge that Diabeaters is not a substitute for professional medical advice</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case "complete":
        return (
          <Card className="border-primary/50">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>You're All Set!</CardTitle>
              <CardDescription>Your Diabeaters profile is ready</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diabetes Type:</span>
                  <span className="font-medium capitalize">{data.diabetesType.replace("type", "Type ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Blood Glucose Units:</span>
                  <span className="font-medium">{data.bgUnits}</span>
                </div>
                {data.usingInsulin && data.insulinDeliveryMethod && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Insulin Delivery:</span>
                    <span className="font-medium capitalize">{data.insulinDeliveryMethod}</span>
                  </div>
                )}
                {data.tdd && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Daily Dose:</span>
                    <span className="font-medium">{data.tdd} units</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                You can update these settings anytime from your profile.
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <FaceLogo size={64} />
          </div>
          <h1 className="text-2xl font-semibold">Welcome to Diabeaters</h1>
          <p className="text-muted-foreground">Let's set up your profile</p>
        </div>

        <Progress value={progress} className="h-2" />

        {renderStep()}

        <div className="flex justify-between gap-4">
          {currentStepIndex > 0 && currentStep !== "complete" && (
            <Button variant="outline" onClick={handleBack} data-testid="button-onboarding-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {isSkippableStep && (
            <Button variant="ghost" onClick={handleNext} data-testid="button-onboarding-skip">
              <SkipForward className="h-4 w-4 mr-2" />
              Skip
            </Button>
          )}
          {currentStep === "complete" ? (
            <Button onClick={handleComplete} className="min-w-32" data-testid="button-onboarding-complete">
              Get Started
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : currentStep === "disclaimer" ? (
            <Button onClick={() => setCurrentStep("complete")} disabled={!data.hasAcceptedDisclaimer} className="min-w-32" data-testid="button-onboarding-next">
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleNext} className="min-w-32" data-testid="button-onboarding-next">
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4">
          Prototype - Copyright PassingTime Ltd {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
