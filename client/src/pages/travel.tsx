import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Plane, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  Package, 
  Syringe, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  Hospital,
  Pill,
  Info,
  Globe
} from "lucide-react";
import { storage, Supply, UserSettings } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { FaceLogoWatermark } from "@/components/face-logo";

interface TravelPlan {
  duration: number;
  destination: string;
  travelType: "domestic" | "international";
  timezoneChange: "none" | "minor" | "major";
  accessRisk: "easy" | "limited" | "unsure";
}

interface PackingItem {
  name: string;
  estimatedAmount: number;
  unit: string;
  reasoning: string;
  category: "insulin" | "delivery" | "monitoring" | "hypo" | "backup";
  checked: boolean;
}

interface RiskWarning {
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
}

function calculatePackingList(plan: TravelPlan, supplies: Supply[], settings: UserSettings): PackingItem[] {
  const items: PackingItem[] = [];
  const bufferMultiplier = plan.travelType === "international" ? 2 : 1.5;
  const accessBuffer = plan.accessRisk === "limited" ? 1.5 : plan.accessRisk === "unsure" ? 1.3 : 1;
  
  const insulinSupplies = supplies.filter(s => s.type === "insulin");
  const needleSupplies = supplies.filter(s => s.type === "needle");
  const cgmSupplies = supplies.filter(s => s.type === "cgm");

  // Calculate insulin needs separately for short-acting and long-acting
  // Uses daily units from settings, then converts to pens (100 units = 1 pen)
  const unitsPerPen = 100;
  const shortActingUnitsPerDay = settings.shortActingUnitsPerDay || 20; // Default: 20 units/day
  const longActingUnitsPerDay = settings.longActingUnitsPerDay || 15; // Default: 15 units/day
  
  // Calculate total units needed for trip
  const totalShortActingUnits = shortActingUnitsPerDay * plan.duration;
  const totalLongActingUnits = longActingUnitsPerDay * plan.duration;
  
  // Apply buffer and convert to pens
  const shortActingUnitsWithBuffer = totalShortActingUnits * bufferMultiplier * accessBuffer;
  const longActingUnitsWithBuffer = totalLongActingUnits * bufferMultiplier * accessBuffer;
  
  const shortActingPensNeeded = Math.ceil(shortActingUnitsWithBuffer / unitsPerPen);
  const longActingPensNeeded = Math.ceil(longActingUnitsWithBuffer / unitsPerPen);
  
  // Find named supplies from user's tracker if available
  const shortActingSupply = insulinSupplies.find(s => 
    s.name.toLowerCase().includes('rapid') || 
    s.name.toLowerCase().includes('novorapid') || 
    s.name.toLowerCase().includes('humalog') ||
    s.name.toLowerCase().includes('fiasp') ||
    s.name.toLowerCase().includes('short')
  );
  const longActingSupply = insulinSupplies.find(s => 
    s.name.toLowerCase().includes('lantus') || 
    s.name.toLowerCase().includes('levemir') || 
    s.name.toLowerCase().includes('tresiba') ||
    s.name.toLowerCase().includes('long') ||
    s.name.toLowerCase().includes('basal')
  );

  // Add short-acting insulin
  if (shortActingPensNeeded > 0) {
    items.push({
      name: shortActingSupply?.name || "Short-Acting Insulin (Rapid)",
      estimatedAmount: shortActingPensNeeded,
      unit: shortActingPensNeeded === 1 ? "pen" : "pens",
      reasoning: `${shortActingUnitsPerDay}u/day × ${plan.duration} days = ${totalShortActingUnits}u (${(totalShortActingUnits / unitsPerPen).toFixed(1)} pens) + buffer`,
      category: "insulin",
      checked: false,
    });
  }

  // Add long-acting insulin
  if (longActingPensNeeded > 0) {
    items.push({
      name: longActingSupply?.name || "Long-Acting Insulin (Basal)",
      estimatedAmount: longActingPensNeeded,
      unit: longActingPensNeeded === 1 ? "pen" : "pens",
      reasoning: `${longActingUnitsPerDay}u/day × ${plan.duration} days = ${totalLongActingUnits}u (${(totalLongActingUnits / unitsPerPen).toFixed(1)} pens) + buffer`,
      category: "insulin",
      checked: false,
    });
  }

  // Fallback if no insulin usage is configured
  if (shortActingPensNeeded === 0 && longActingPensNeeded === 0) {
    items.push({
      name: "Insulin Pens (configure usage in Settings)",
      estimatedAmount: Math.ceil(plan.duration / 5 * bufferMultiplier),
      unit: "pens",
      reasoning: "Set your daily pen usage in Settings for accurate calculation",
      category: "insulin",
      checked: false,
    });
  }

  // Calculate needles based on injections per day from settings
  // This reflects the user's actual daily injection habits
  const injectionsPerDay = settings.injectionsPerDay || 4; // Default to 4 if not set
  const baseNeedles = injectionsPerDay * plan.duration;
  const needlesWithBuffer = Math.ceil(baseNeedles * bufferMultiplier * accessBuffer);

  if (needleSupplies.length > 0) {
    needleSupplies.forEach(supply => {
      items.push({
        name: supply.name,
        estimatedAmount: needlesWithBuffer,
        unit: "needles",
        reasoning: `${injectionsPerDay} injections/day × ${plan.duration} days = ${baseNeedles} + buffer for dropped/bent`,
        category: "delivery",
        checked: false,
      });
    });
  } else {
    items.push({
      name: "Pen Needles / Syringes",
      estimatedAmount: needlesWithBuffer,
      unit: "needles",
      reasoning: `${injectionsPerDay} injections/day × ${plan.duration} days = ${baseNeedles} + buffer for dropped/bent`,
      category: "delivery",
      checked: false,
    });
  }

  cgmSupplies.forEach(supply => {
    const baseAmount = Math.ceil((plan.duration / 10) + 1);
    const withBuffer = Math.ceil(baseAmount * bufferMultiplier);
    items.push({
      name: supply.name,
      estimatedAmount: withBuffer,
      unit: "sensors",
      reasoning: `Based on ${plan.duration} day trip + spare sensor`,
      category: "monitoring",
      checked: false,
    });
  });

  items.push({
    name: "Blood Glucose Meter",
    estimatedAmount: 1,
    unit: "device",
    reasoning: "Backup for CGM failures or battery issues",
    category: "monitoring",
    checked: false,
  });

  items.push({
    name: "Test Strips",
    estimatedAmount: Math.ceil(plan.duration * 4 * bufferMultiplier),
    unit: "strips",
    reasoning: "For meter backup testing",
    category: "monitoring",
    checked: false,
  });

  items.push({
    name: "Fast-Acting Glucose",
    estimatedAmount: Math.ceil(plan.duration * 2),
    unit: "treatments",
    reasoning: "Glucose tablets/juice for hypo treatment",
    category: "hypo",
    checked: false,
  });

  items.push({
    name: "Glucagon Kit",
    estimatedAmount: 1,
    unit: "kit",
    reasoning: "Emergency severe hypo treatment",
    category: "hypo",
    checked: false,
  });

  items.push({
    name: "Diabetes ID Card/Bracelet",
    estimatedAmount: 1,
    unit: "item",
    reasoning: "Medical identification for emergencies",
    category: "backup",
    checked: false,
  });

  items.push({
    name: "Doctor's Letter",
    estimatedAmount: 1,
    unit: "document",
    reasoning: "Explains medical supplies for security/customs",
    category: "backup",
    checked: false,
  });

  if (plan.travelType === "international") {
    items.push({
      name: "Prescription Copies",
      estimatedAmount: 2,
      unit: "copies",
      reasoning: "Original + backup for international pharmacies",
      category: "backup",
      checked: false,
    });
  }

  items.push({
    name: "Insulin Cooling Case",
    estimatedAmount: 1,
    unit: "case",
    reasoning: "Keep insulin at safe temperature during travel",
    category: "backup",
    checked: false,
  });

  return items;
}

function calculateRiskWarnings(plan: TravelPlan): RiskWarning[] {
  const warnings: RiskWarning[] = [];

  if (plan.duration > 14) {
    warnings.push({
      title: "Extended Trip Duration",
      description: "For trips longer than 2 weeks, consider arranging pharmacy access at your destination or bringing extra supplies.",
      severity: "medium",
    });
  }

  if (plan.timezoneChange === "major") {
    warnings.push({
      title: "Significant Timezone Change",
      description: "Crossing multiple timezones may affect your insulin timing. Consider discussing adjustment strategies with your healthcare team before departure.",
      severity: "high",
    });
  } else if (plan.timezoneChange === "minor") {
    warnings.push({
      title: "Minor Timezone Change",
      description: "Small timezone adjustments usually don't require major changes, but monitor your levels more frequently during the first few days.",
      severity: "low",
    });
  }

  if (plan.accessRisk === "limited") {
    warnings.push({
      title: "Limited Pharmacy Access",
      description: "Your destination may have limited access to diabetes supplies. Pack extra supplies and research emergency medical facilities before departure.",
      severity: "high",
    });
  } else if (plan.accessRisk === "unsure") {
    warnings.push({
      title: "Uncertain Pharmacy Access",
      description: "Research pharmacy availability at your destination. Consider contacting your insulin manufacturer for international availability information.",
      severity: "medium",
    });
  }

  if (plan.travelType === "international") {
    warnings.push({
      title: "International Travel Documentation",
      description: "Carry a doctor's letter explaining your diabetes supplies. Keep insulin and supplies in carry-on luggage to prevent freezing and loss.",
      severity: "medium",
    });
  }

  return warnings;
}

const categoryLabels = {
  insulin: { label: "Insulin", icon: Syringe, color: "text-blue-600 dark:text-blue-400" },
  delivery: { label: "Delivery Supplies", icon: Package, color: "text-green-600 dark:text-green-400" },
  monitoring: { label: "Monitoring", icon: Activity, color: "text-purple-600 dark:text-purple-400" },
  hypo: { label: "Hypo Treatment", icon: Pill, color: "text-orange-600 dark:text-orange-400" },
  backup: { label: "Backup & Documentation", icon: ShieldAlert, color: "text-gray-600 dark:text-gray-400" },
};

export default function Travel() {
  const [step, setStep] = useState<"entry" | "inputs" | "results">("entry");
  const [plan, setPlan] = useState<TravelPlan>({
    duration: 7,
    destination: "",
    travelType: "domestic",
    timezoneChange: "none",
    accessRisk: "easy",
  });
  const [packingList, setPackingList] = useState<PackingItem[]>([]);
  const [riskWarnings, setRiskWarnings] = useState<RiskWarning[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [settings, setSettings] = useState<UserSettings>({});
  const { toast } = useToast();

  useEffect(() => {
    setSupplies(storage.getSupplies());
    setSettings(storage.getSettings());
  }, []);

  const handleStartPlan = () => {
    setStep("inputs");
  };

  const handleGeneratePlan = () => {
    if (!plan.destination.trim()) {
      toast({
        title: "Missing destination",
        description: "Please enter your travel destination.",
        variant: "destructive",
      });
      return;
    }

    if (plan.duration < 1 || plan.duration > 365) {
      toast({
        title: "Invalid duration",
        description: "Please enter a valid trip duration (1-365 days).",
        variant: "destructive",
      });
      return;
    }

    const list = calculatePackingList(plan, supplies, settings);
    const warnings = calculateRiskWarnings(plan);
    setPackingList(list);
    setRiskWarnings(warnings);
    setStep("results");

    storage.addActivityLog({
      activityType: "travel_plan",
      activityDetails: `${plan.duration} days to ${plan.destination} (${plan.travelType})`,
      recommendation: `Generated packing list with ${list.length} items`,
    });
  };

  const toggleItem = (index: number) => {
    setPackingList(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], checked: !updated[index].checked };
      return updated;
    });
  };

  const resetPlan = () => {
    setStep("entry");
    setPlan({
      duration: 7,
      destination: "",
      travelType: "domestic",
      timezoneChange: "none",
      accessRisk: "easy",
    });
    setPackingList([]);
    setRiskWarnings([]);
  };

  if (step === "entry") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 relative">
        <FaceLogoWatermark />
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Plane className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Travel Mode</h1>
            <p className="text-muted-foreground">Prepare for your trip with confidence</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Plan Your Travel
            </CardTitle>
            <CardDescription>
              Travel Mode helps you plan supplies and prepare for unexpected issues while travelling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This feature will help you create a smart packing list based on your trip details 
              and your tracked supplies. It includes safety buffers for delays, breakage, and emergencies.
            </p>
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Not Medical Advice</AlertTitle>
              <AlertDescription>
                This tool provides general preparation guidance only. Always consult your healthcare 
                team for medical advice specific to your situation.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleStartPlan} 
              className="w-full"
              size="lg"
              data-testid="button-start-travel-plan"
            >
              Start Travel Plan
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-red-600" />
              Emergency Card
            </CardTitle>
            <CardDescription>
              A digital medical alert card in 14 languages - perfect for international travel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/emergency-card">
              <Button variant="outline" className="w-full" data-testid="button-emergency-card">
                <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                View Emergency Card
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Link href="/">
            <Button variant="ghost" data-testid="link-back-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (step === "inputs") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 relative">
        <FaceLogoWatermark />
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={resetPlan} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Trip Details</h1>
            <p className="text-muted-foreground">Tell us about your upcoming travel</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Travel Information</CardTitle>
            <CardDescription>
              We'll use this to calculate your supply needs with appropriate safety buffers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Travel Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={365}
                  value={plan.duration}
                  onChange={(e) => setPlan(prev => ({ ...prev, duration: parseInt(e.target.value) || 1 }))}
                  data-testid="input-duration"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destination</Label>
                <Input
                  id="destination"
                  placeholder="City, Country"
                  value={plan.destination}
                  onChange={(e) => setPlan(prev => ({ ...prev, destination: e.target.value }))}
                  data-testid="input-destination"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Travel Type</Label>
              <Select 
                value={plan.travelType} 
                onValueChange={(value: "domestic" | "international") => setPlan(prev => ({ ...prev, travelType: value }))}
              >
                <SelectTrigger data-testid="select-travel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="domestic">Domestic</SelectItem>
                  <SelectItem value="international">International</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timezone Change</Label>
              <Select 
                value={plan.timezoneChange} 
                onValueChange={(value: "none" | "minor" | "major") => setPlan(prev => ({ ...prev, timezoneChange: value }))}
              >
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="minor">Minor (1-3 hours)</SelectItem>
                  <SelectItem value="major">Major (4+ hours)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pharmacy Access at Destination</Label>
              <Select 
                value={plan.accessRisk} 
                onValueChange={(value: "easy" | "limited" | "unsure") => setPlan(prev => ({ ...prev, accessRisk: value }))}
              >
                <SelectTrigger data-testid="select-access-risk">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy access to pharmacies</SelectItem>
                  <SelectItem value="limited">Limited access</SelectItem>
                  <SelectItem value="unsure">Unsure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Your packing list will be generated using data from your Supply Tracker. 
                Make sure your supplies are up to date for the most accurate recommendations.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleGeneratePlan} 
              className="w-full"
              size="lg"
              data-testid="button-generate-plan"
            >
              Generate Travel Plan
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const groupedItems = packingList.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PackingItem[]>);

  const checkedCount = packingList.filter(i => i.checked).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 relative">
      <FaceLogoWatermark />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={resetPlan} data-testid="button-new-plan">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Your Travel Plan</h1>
          <p className="text-muted-foreground">
            {plan.duration} days to {plan.destination}
          </p>
        </div>
        <Badge variant="outline">
          {plan.travelType === "international" ? "International" : "Domestic"}
        </Badge>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">Not Medical Advice</AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          This packing list is for preparation guidance only. Consult your healthcare team 
          for medical advice about traveling with diabetes.
        </AlertDescription>
      </Alert>

      {riskWarnings.length > 0 && (
        <Card className="border-orange-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              Risk Considerations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskWarnings.map((warning, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg ${
                  warning.severity === "high" 
                    ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" 
                    : warning.severity === "medium"
                    ? "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800"
                    : "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800"
                }`}
              >
                <h4 className="font-medium text-sm">{warning.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{warning.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Smart Packing List
            </CardTitle>
            <Badge variant="secondary">
              {checkedCount}/{packingList.length} packed
            </Badge>
          </div>
          <CardDescription>
            Tap items to mark them as packed. Quantities include safety buffers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map(category => {
            const items = groupedItems[category];
            if (!items || items.length === 0) return null;
            const { label, icon: Icon, color } = categoryLabels[category];
            
            return (
              <div key={category} className="space-y-3">
                <h3 className={`font-semibold flex items-center gap-2 ${color}`}>
                  <Icon className="h-4 w-4" />
                  {label}
                </h3>
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const globalIndex = packingList.findIndex(i => i === item);
                    return (
                      <div 
                        key={idx}
                        onClick={() => toggleItem(globalIndex)}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors hover-elevate ${
                          item.checked 
                            ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" 
                            : "bg-muted/50"
                        }`}
                        data-testid={`packing-item-${globalIndex}`}
                      >
                        <Checkbox 
                          checked={item.checked} 
                          className="mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleItem(globalIndex)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`font-medium ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                              {item.name}
                            </span>
                            <Badge variant="outline" className="shrink-0">
                              {item.estimatedAmount} {item.unit}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{item.reasoning}</p>
                        </div>
                        {item.checked && <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hospital className="h-5 w-5" />
            Emergency Preparedness
          </CardTitle>
          <CardDescription>
            General guidance for handling travel emergencies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium">If Insulin is Lost or Damaged</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Contact local pharmacy with prescription</li>
                <li>Reach out to hotel concierge for pharmacy locations</li>
                <li>Call your diabetes team for guidance</li>
                <li>Consider contacting insulin manufacturer's local office</li>
              </ul>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium">If Supplies Run Out</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Visit local hospital or urgent care</li>
                <li>Show prescription and doctor's letter</li>
                <li>Contact your travel insurance provider</li>
                <li>Research before travel: nearest medical facilities</li>
              </ul>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium">When to Seek Medical Help</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Persistent high blood glucose with ketones</li>
                <li>Severe hypoglycemia requiring assistance</li>
                <li>Signs of diabetic ketoacidosis (DKA)</li>
                <li>Vomiting or inability to keep fluids down</li>
              </ul>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium">International Travel Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Keep supplies in carry-on luggage</li>
                <li>Carry doctor's letter for customs/security</li>
                <li>Learn key diabetes terms in local language</li>
                <li>Note emergency number for your destination</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>


      <div className="flex flex-wrap justify-center gap-4">
        <Button variant="outline" onClick={resetPlan} data-testid="button-create-new-plan">
          Create New Plan
        </Button>
        <Link href="/">
          <Button data-testid="link-back-to-dashboard">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
