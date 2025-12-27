import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { FaceLogo } from "@/components/face-logo";

type Step = "personal" | "units" | "diabetes" | "delivery" | "disclaimer" | "complete";

interface OnboardingData {
  name: string;
  email: string;
  bgUnits: string;
  carbUnits: string;
  diabetesType: string;
  insulinDeliveryMethod: string;
  usingInsulin: boolean;
  hasAcceptedDisclaimer: boolean;
}

const STEPS: Step[] = ["personal", "units", "diabetes", "delivery", "disclaimer", "complete"];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("personal");
  const [data, setData] = useState<OnboardingData>({
    name: "",
    email: "",
    bgUnits: "mmol/L",
    carbUnits: "grams",
    diabetesType: "",
    insulinDeliveryMethod: "",
    usingInsulin: false,
    hasAcceptedDisclaimer: false,
  });

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleSaveProfile = () => {
    localStorage.setItem("diabeater_onboarding_completed", "true");
    localStorage.setItem("diabeater_profile", JSON.stringify(data));
    toast({
      title: "Welcome to Diabeaters!",
      description: "Your profile has been set up successfully.",
    });
    setLocation("/");
    window.location.reload();
  };

  const handleNext = () => {
    const stepIndex = STEPS.indexOf(currentStep);
    if (stepIndex < STEPS.length - 1) {
      if (currentStep === "diabetes" && (data.diabetesType === "type2" || data.diabetesType === "gestational")) {
        setCurrentStep("delivery");
      } else if (currentStep === "diabetes" && data.diabetesType === "type1") {
        setCurrentStep("delivery");
      } else {
        setCurrentStep(STEPS[stepIndex + 1]);
      }
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
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={data.name}
                  onChange={(e) => updateData("name", e.target.value)}
                  placeholder="Your name"
                  data-testid="input-onboarding-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={data.email}
                  onChange={(e) => updateData("email", e.target.value)}
                  placeholder="your@email.com"
                  data-testid="input-onboarding-email"
                />
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
                <RadioGroup
                  value={data.bgUnits}
                  onValueChange={(value) => updateData("bgUnits", value)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mmol/L" id="mmol" data-testid="radio-mmol" />
                    <Label htmlFor="mmol" className="font-normal">mmol/L (millimoles per litre)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mg/dL" id="mgdl" data-testid="radio-mgdl" />
                    <Label htmlFor="mgdl" className="font-normal">mg/dL (milligrams per decilitre)</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>Carbohydrate Units</Label>
                <RadioGroup
                  value={data.carbUnits}
                  onValueChange={(value) => updateData("carbUnits", value)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="grams" id="grams" data-testid="radio-grams" />
                    <Label htmlFor="grams" className="font-normal">Grams</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="exchanges" id="exchanges" data-testid="radio-exchanges" />
                    <Label htmlFor="exchanges" className="font-normal">Carb Exchanges (15g portions)</Label>
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
              <CardDescription>Select your diabetes type for personalized guidance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={data.diabetesType}
                onValueChange={(value) => updateData("diabetesType", value)}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer">
                  <RadioGroupItem value="type1" id="type1" className="mt-1" data-testid="radio-type1" />
                  <div>
                    <Label htmlFor="type1" className="font-medium cursor-pointer">Type 1 Diabetes</Label>
                    <p className="text-sm text-muted-foreground mt-1">Autoimmune condition requiring insulin therapy</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer">
                  <RadioGroupItem value="type2" id="type2" className="mt-1" data-testid="radio-type2" />
                  <div>
                    <Label htmlFor="type2" className="font-medium cursor-pointer">Type 2 Diabetes</Label>
                    <p className="text-sm text-muted-foreground mt-1">Metabolic condition, may or may not require insulin</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer">
                  <RadioGroupItem value="gestational" id="gestational" className="mt-1" data-testid="radio-gestational" />
                  <div>
                    <Label htmlFor="gestational" className="font-medium cursor-pointer">Gestational Diabetes</Label>
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
              <CardDescription>
                {data.diabetesType === "type1"
                  ? "How do you administer insulin?"
                  : "Are you currently using insulin?"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.diabetesType === "type1" ? (
                <RadioGroup
                  value={data.insulinDeliveryMethod}
                  onValueChange={(value) => {
                    updateData("insulinDeliveryMethod", value);
                    updateData("usingInsulin", true);
                  }}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer">
                    <RadioGroupItem value="injections" id="injections" className="mt-1" data-testid="radio-injections" />
                    <div>
                      <Label htmlFor="injections" className="font-medium cursor-pointer">Injections (MDI)</Label>
                      <p className="text-sm text-muted-foreground mt-1">Multiple daily injections with pens or syringes</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer">
                    <RadioGroupItem value="pump" id="pump" className="mt-1" data-testid="radio-pump" />
                    <div>
                      <Label htmlFor="pump" className="font-medium cursor-pointer">Insulin Pump</Label>
                      <p className="text-sm text-muted-foreground mt-1">Continuous subcutaneous insulin infusion</p>
                    </div>
                  </div>
                </RadioGroup>
              ) : (
                <RadioGroup
                  value={data.usingInsulin ? "yes" : "no"}
                  onValueChange={(value) => updateData("usingInsulin", value === "yes")}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer">
                    <RadioGroupItem value="yes" id="using-yes" className="mt-1" data-testid="radio-using-insulin-yes" />
                    <div>
                      <Label htmlFor="using-yes" className="font-medium cursor-pointer">Yes, I use insulin</Label>
                      <p className="text-sm text-muted-foreground mt-1">I currently take insulin as part of my treatment</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer">
                    <RadioGroupItem value="no" id="using-no" className="mt-1" data-testid="radio-using-insulin-no" />
                    <div>
                      <Label htmlFor="using-no" className="font-medium cursor-pointer">No, I don't use insulin</Label>
                      <p className="text-sm text-muted-foreground mt-1">I manage with diet, exercise, or other medications</p>
                    </div>
                  </div>
                </RadioGroup>
              )}
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
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <Checkbox
                  id="disclaimer"
                  checked={data.hasAcceptedDisclaimer}
                  onCheckedChange={(checked) => updateData("hasAcceptedDisclaimer", checked === true)}
                  data-testid="checkbox-disclaimer"
                />
                <div>
                  <Label htmlFor="disclaimer" className="font-medium cursor-pointer">
                    I understand and accept
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    I acknowledge that Diabeaters is not a substitute for professional medical advice
                  </p>
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
          {currentStep === "complete" ? (
            <Button
              onClick={handleComplete}
              className="min-w-32"
              data-testid="button-onboarding-complete"
            >
              Get Started
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : currentStep === "disclaimer" ? (
            <Button
              onClick={() => setCurrentStep("complete")}
              disabled={!data.hasAcceptedDisclaimer}
              className="min-w-32"
              data-testid="button-onboarding-next"
            >
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
      </div>
    </div>
  );
}
