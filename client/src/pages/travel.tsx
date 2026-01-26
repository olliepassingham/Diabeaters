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
import { storage, Supply, UserSettings, UserProfile } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { FaceLogoWatermark } from "@/components/face-logo";

interface TravelPlan {
  duration: number;
  destination: string;
  travelType: "domestic" | "international";
  timezoneChange: "none" | "minor" | "major";
  timezoneHours: number;
  timezoneDirection: "east" | "west" | "none";
  startDate: string;
  endDate: string;
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

function calculatePackingList(plan: TravelPlan, supplies: Supply[], settings: UserSettings, isPumpUser: boolean): PackingItem[] {
  const items: PackingItem[] = [];
  const bufferMultiplier = plan.travelType === "international" ? 2 : 1.5;
  const accessBuffer = plan.accessRisk === "limited" ? 1.5 : plan.accessRisk === "unsure" ? 1.3 : 1;
  
  const insulinSupplies = supplies.filter(s => s.type === "insulin");
  const needleSupplies = supplies.filter(s => s.type === "needle");
  const cgmSupplies = supplies.filter(s => s.type === "cgm");

  if (isPumpUser) {
    // === PUMP USER PACKING LIST ===
    const tdd = settings.tdd || 40;
    const reservoirCapacity = settings.reservoirCapacity || 300;
    const siteChangeDays = settings.siteChangeDays || 3;
    const reservoirChangeDays = settings.reservoirChangeDays || 3;
    
    // Calculate insulin cartridges/reservoirs needed
    const totalUnitsNeeded = tdd * plan.duration;
    const unitsWithBuffer = totalUnitsNeeded * bufferMultiplier * accessBuffer;
    const reservoirsNeeded = Math.ceil(unitsWithBuffer / reservoirCapacity);
    
    items.push({
      name: "Insulin Reservoir/Cartridge",
      estimatedAmount: reservoirsNeeded,
      unit: reservoirsNeeded === 1 ? "reservoir" : "reservoirs",
      reasoning: `${tdd}u/day × ${plan.duration} days = ${totalUnitsNeeded}u (${(totalUnitsNeeded / reservoirCapacity).toFixed(1)} reservoirs) + buffer`,
      category: "insulin",
      checked: false,
    });
    
    // Calculate infusion sets needed
    const baseSiteChanges = Math.ceil(plan.duration / siteChangeDays);
    const setsWithBuffer = Math.ceil(baseSiteChanges * bufferMultiplier * accessBuffer);
    
    items.push({
      name: "Infusion Sets",
      estimatedAmount: setsWithBuffer,
      unit: "sets",
      reasoning: `Change every ${siteChangeDays} days × ${plan.duration} day trip = ${baseSiteChanges} changes + spares for failures`,
      category: "delivery",
      checked: false,
    });
    
    // Pump batteries
    const batteryChanges = Math.ceil(plan.duration / 7);
    const batteriesWithBuffer = Math.ceil((batteryChanges + 2) * bufferMultiplier);
    
    items.push({
      name: "Pump Batteries",
      estimatedAmount: batteriesWithBuffer,
      unit: "batteries",
      reasoning: "Extra batteries for pump operation + spares",
      category: "delivery",
      checked: false,
    });
    
    // Skin prep and adhesive
    items.push({
      name: "Skin Prep Wipes",
      estimatedAmount: setsWithBuffer,
      unit: "wipes",
      reasoning: "One per infusion site change",
      category: "delivery",
      checked: false,
    });
    
    items.push({
      name: "Extra Adhesive/Tape",
      estimatedAmount: Math.ceil(plan.duration / 3),
      unit: "pieces",
      reasoning: "For securing sites in hot/humid conditions",
      category: "delivery",
      checked: false,
    });
    
    // CRITICAL: Backup pen supplies for pump failure
    // Calculate for 3 days contingency (reasonable time to get pump replaced/fixed)
    const contingencyDays = 3;
    const contingencyUnits = tdd * contingencyDays;
    const backupRapidPens = Math.max(1, Math.ceil(contingencyUnits / 100));
    
    items.push({
      name: "Backup Insulin Pen (Rapid-Acting)",
      estimatedAmount: backupRapidPens,
      unit: backupRapidPens === 1 ? "pen" : "pens",
      reasoning: `ESSENTIAL: Backup for pump failure - ${contingencyDays} days supply (${contingencyUnits}u)`,
      category: "backup",
      checked: false,
    });
    
    items.push({
      name: "Backup Insulin Pen (Long-Acting)",
      estimatedAmount: 1,
      unit: "pen",
      reasoning: "ESSENTIAL: For basal coverage if pump fails - discuss dosing with your healthcare team before travel",
      category: "backup",
      checked: false,
    });
    
    const backupNeedles = Math.ceil(contingencyDays * 6);
    items.push({
      name: "Backup Pen Needles",
      estimatedAmount: backupNeedles,
      unit: "needles",
      reasoning: `For backup pens in case of pump failure (${contingencyDays} days)`,
      category: "backup",
      checked: false,
    });
    
  } else {
    // === PEN/MDI USER PACKING LIST ===
    const unitsPerPen = 100;
    const shortActingUnitsPerDay = settings.shortActingUnitsPerDay || 20;
    const longActingUnitsPerDay = settings.longActingUnitsPerDay || 15;
    
    const totalShortActingUnits = shortActingUnitsPerDay * plan.duration;
    const totalLongActingUnits = longActingUnitsPerDay * plan.duration;
    
    const shortActingUnitsWithBuffer = totalShortActingUnits * bufferMultiplier * accessBuffer;
    const longActingUnitsWithBuffer = totalLongActingUnits * bufferMultiplier * accessBuffer;
    
    const shortActingPensNeeded = Math.ceil(shortActingUnitsWithBuffer / unitsPerPen);
    const longActingPensNeeded = Math.ceil(longActingUnitsWithBuffer / unitsPerPen);
    
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

    const injectionsPerDay = settings.injectionsPerDay || 4;
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
  }

  const cgmDays = settings.cgmDays || 14; // Use setting, default to 14 days
  cgmSupplies.forEach(supply => {
    const sensorsNeeded = Math.ceil(plan.duration / cgmDays);
    // For CGMs: domestic = 1 spare, international = 2 spares, limited access = extra 1
    const spares = plan.travelType === "international" ? 2 : 1;
    const accessSpare = plan.accessRisk === "limited" ? 1 : 0;
    const totalSensors = sensorsNeeded + spares + accessSpare;
    const sparesText = spares + accessSpare;
    items.push({
      name: supply.name,
      estimatedAmount: totalSensors,
      unit: "sensors",
      reasoning: `${plan.duration} days ÷ ${cgmDays} days/sensor = ${sensorsNeeded} + ${sparesText} spare${sparesText > 1 ? 's' : ''}`,
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

function calculateRiskWarnings(plan: TravelPlan, isPumpUser: boolean): RiskWarning[] {
  const warnings: RiskWarning[] = [];

  if (plan.duration > 14) {
    warnings.push({
      title: "Extended Trip Duration",
      description: "For trips longer than 2 weeks, consider arranging pharmacy access at your destination or bringing extra supplies.",
      severity: "medium",
    });
  }

  if (plan.timezoneChange === "major") {
    if (isPumpUser) {
      warnings.push({
        title: "Pump Basal Rate Adjustment Needed",
        description: "Crossing multiple timezones will require adjusting your pump's clock and basal rates. Discuss a specific adjustment plan with your healthcare team before departure. Consider keeping the pump on home time for short trips.",
        severity: "high",
      });
    } else {
      warnings.push({
        title: "Significant Timezone Change",
        description: "Crossing multiple timezones may affect your insulin timing. Consider discussing adjustment strategies with your healthcare team before departure.",
        severity: "high",
      });
    }
  } else if (plan.timezoneChange === "minor") {
    warnings.push({
      title: "Minor Timezone Change",
      description: "Small timezone adjustments usually don't require major changes, but monitor your levels more frequently during the first few days.",
      severity: "low",
    });
  }

  if (isPumpUser) {
    warnings.push({
      title: "Pump Failure Contingency",
      description: "Pack backup rapid-acting and long-acting insulin pens with needles. Before travelling, consult your healthcare team to establish your injection backup plan including the correct long-acting dose.",
      severity: "medium",
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
  const [isTravelModeActive, setIsTravelModeActive] = useState(false);
  
  const getDefaultDates = () => {
    const today = new Date();
    const start = today.toISOString().split("T")[0];
    const end = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return { start, end };
  };
  
  const defaultDates = getDefaultDates();
  const [plan, setPlan] = useState<TravelPlan>({
    duration: 7,
    destination: "",
    travelType: "domestic",
    timezoneChange: "none",
    timezoneHours: 0,
    timezoneDirection: "none",
    startDate: defaultDates.start,
    endDate: defaultDates.end,
    accessRisk: "easy",
  });
  const [packingList, setPackingList] = useState<PackingItem[]>([]);
  const [riskWarnings, setRiskWarnings] = useState<RiskWarning[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [settings, setSettings] = useState<UserSettings>({});
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [basalInjectionTime, setBasalInjectionTime] = useState("22:00");
  const { toast } = useToast();

  const isPumpUser = profile?.insulinDeliveryMethod === "pump";

  // Calculate long-acting insulin adjustment schedule for MDI users
  const calculateBasalAdjustmentSchedule = () => {
    if (isPumpUser || plan.timezoneChange === "none" || !basalInjectionTime) return [];
    
    const [hours, minutes] = basalInjectionTime.split(":").map(Number);
    const homeTimeMinutes = hours * 60 + minutes;
    const tzDiff = plan.timezoneHours;
    const direction = plan.timezoneDirection;
    
    // Shift by 2-3 hours per day maximum
    const maxShiftPerDay = 2;
    const daysToAdjust = Math.ceil(tzDiff / maxShiftPerDay);
    
    const schedule: Array<{
      day: number;
      label: string;
      homeTime: string;
      localTime: string;
      note: string;
    }> = [];
    
    const formatTime = (totalMinutes: number) => {
      let mins = totalMinutes % (24 * 60);
      if (mins < 0) mins += 24 * 60;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    };
    
    // Day 0: Travel day - take at usual home time
    schedule.push({
      day: 0,
      label: "Travel Day",
      homeTime: basalInjectionTime,
      localTime: formatTime(homeTimeMinutes + (direction === "east" ? tzDiff * 60 : -tzDiff * 60)),
      note: "Take at your usual time (shown in both home and local time)"
    });
    
    // Gradual adjustment days
    for (let i = 1; i <= daysToAdjust; i++) {
      const shiftSoFar = Math.min(i * maxShiftPerDay, tzDiff);
      const shiftMinutes = shiftSoFar * 60;
      
      let adjustedHomeMinutes: number;
      let adjustedLocalMinutes: number;
      
      if (direction === "east") {
        // Travelling east: shift injection earlier (local time catching up to target)
        adjustedHomeMinutes = homeTimeMinutes - shiftMinutes;
        adjustedLocalMinutes = homeTimeMinutes + (tzDiff * 60) - shiftMinutes;
      } else {
        // Travelling west: shift injection later
        adjustedHomeMinutes = homeTimeMinutes + shiftMinutes;
        adjustedLocalMinutes = homeTimeMinutes - (tzDiff * 60) + shiftMinutes;
      }
      
      const isFullyAdjusted = shiftSoFar >= tzDiff;
      
      schedule.push({
        day: i,
        label: `Day ${i}`,
        homeTime: formatTime(adjustedHomeMinutes),
        localTime: formatTime(adjustedLocalMinutes),
        note: isFullyAdjusted 
          ? "Fully adjusted to local time" 
          : `Shifted ${shiftSoFar}h of ${tzDiff}h total`
      });
    }
    
    // Final day showing target local time
    if (daysToAdjust > 0) {
      schedule.push({
        day: daysToAdjust + 1,
        label: "Onwards",
        homeTime: direction === "east" 
          ? formatTime(homeTimeMinutes - tzDiff * 60)
          : formatTime(homeTimeMinutes + tzDiff * 60),
        localTime: basalInjectionTime,
        note: "Continue taking at your usual local time"
      });
    }
    
    return schedule;
  };

  const basalSchedule = calculateBasalAdjustmentSchedule();

  useEffect(() => {
    setSupplies(storage.getSupplies());
    setSettings(storage.getSettings());
    setProfile(storage.getProfile());
    
    const scenarioState = storage.getScenarioState();
    setIsTravelModeActive(scenarioState.travelModeActive || false);
  }, []);

  const handleStartPlan = () => {
    setStep("inputs");
  };
  
  const handleActivateTravelMode = () => {
    const signedTimezoneShift = plan.timezoneDirection === "west" 
      ? -plan.timezoneHours 
      : plan.timezoneHours;
    storage.activateTravelMode(
      plan.destination,
      plan.startDate,
      plan.endDate,
      signedTimezoneShift,
      plan.timezoneDirection
    );
    setIsTravelModeActive(true);
    toast({
      title: "Travel Mode Activated",
      description: `You'll see travel reminders until ${new Date(plan.endDate).toLocaleDateString()}`,
    });
  };
  
  const handleDeactivateTravelMode = () => {
    storage.deactivateTravelMode();
    localStorage.removeItem("diabeater_travel_session");
    setIsTravelModeActive(false);
    toast({
      title: "Travel Mode Deactivated",
      description: "Welcome back home!",
    });
  };
  
  const updateDuration = (days: number) => {
    const start = new Date(plan.startDate);
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setPlan(prev => ({
      ...prev,
      duration: days,
      endDate: end.toISOString().split("T")[0]
    }));
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

    const list = calculatePackingList(plan, supplies, settings, isPumpUser);
    const warnings = calculateRiskWarnings(plan, isPumpUser);
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
    const dates = getDefaultDates();
    setPlan({
      duration: 7,
      destination: "",
      travelType: "domestic",
      timezoneChange: "none",
      timezoneHours: 0,
      timezoneDirection: "none",
      startDate: dates.start,
      endDate: dates.end,
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
            <div className="space-y-2">
              <Label>Travel Duration</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Weekend", days: 3 },
                  { label: "1 Week", days: 7 },
                  { label: "2 Weeks", days: 14 },
                  { label: "3 Weeks", days: 21 },
                  { label: "1 Month", days: 30 },
                ].map((preset) => (
                  <Button
                    key={preset.days}
                    type="button"
                    variant={plan.duration === preset.days ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateDuration(preset.days)}
                    data-testid={`button-duration-${preset.days}`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">Or enter custom:</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => updateDuration(Math.max(1, plan.duration - 1))}
                    data-testid="button-duration-minus"
                  >
                    -
                  </Button>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={365}
                    value={plan.duration}
                    onChange={(e) => updateDuration(parseInt(e.target.value) || 1)}
                    className="w-20 text-center"
                    data-testid="input-duration"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => updateDuration(Math.min(365, plan.duration + 1))}
                    data-testid="button-duration-plus"
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground ml-1">days</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={plan.startDate}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const startDate = new Date(newStart);
                    const endDate = new Date(startDate.getTime() + plan.duration * 24 * 60 * 60 * 1000);
                    setPlan(prev => ({ 
                      ...prev, 
                      startDate: newStart,
                      endDate: endDate.toISOString().split("T")[0]
                    }));
                  }}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={plan.endDate}
                  min={plan.startDate}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    const startDate = new Date(plan.startDate);
                    const endDate = new Date(newEnd);
                    const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                    setPlan(prev => ({ 
                      ...prev, 
                      endDate: newEnd,
                      duration: diffDays
                    }));
                  }}
                  data-testid="input-end-date"
                />
              </div>
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
                onValueChange={(value: "none" | "minor" | "major") => {
                  setPlan(prev => ({ 
                    ...prev, 
                    timezoneChange: value,
                    timezoneDirection: value === "none" ? "none" : prev.timezoneDirection === "none" ? "east" : prev.timezoneDirection,
                    timezoneHours: value === "none" ? 0 : value === "minor" ? 2 : 6
                  }));
                }}
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
            
            {plan.timezoneChange !== "none" && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label>Hours Difference</Label>
                  <Select 
                    value={plan.timezoneHours.toString()} 
                    onValueChange={(value) => setPlan(prev => ({ ...prev, timezoneHours: parseInt(value) }))}
                  >
                    <SelectTrigger data-testid="select-timezone-hours">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                        <SelectItem key={h} value={h.toString()}>{h} hour{h > 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select 
                    value={plan.timezoneDirection} 
                    onValueChange={(value: "east" | "west") => setPlan(prev => ({ ...prev, timezoneDirection: value }))}
                  >
                    <SelectTrigger data-testid="select-timezone-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="east">Travelling East (ahead)</SelectItem>
                      <SelectItem value="west">Travelling West (behind)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Destination is {plan.timezoneHours} hours {plan.timezoneDirection === "east" ? "ahead of" : "behind"} your home time
                </p>
              </div>
            )}

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


      {plan.timezoneChange !== "none" && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Timezone Adjustment Guidance
            </CardTitle>
            <CardDescription>
              Daily reminders for adjusting to {plan.timezoneHours}-hour time difference
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                {plan.timezoneDirection === "east" ? "Travelling East" : "Travelling West"} — Key Strategy
              </h4>
              {plan.timezoneDirection === "east" ? (
                <div className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
                  <p>When travelling east, your day gets shorter. This affects insulin timing:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>You may need less long-acting insulin on travel day (shorter day)</li>
                    <li>Shift meal times and boluses earlier gradually over 2-3 days</li>
                    <li>Monitor more frequently in the first 48 hours</li>
                    <li>Expect some temporary insulin resistance from jet lag</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
                  <p>When travelling west, your day gets longer. This affects insulin timing:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>You may need extra short-acting insulin for the extended day</li>
                    <li>Keep basal insulin on home time initially, then shift gradually</li>
                    <li>Add an extra meal if your day extends significantly</li>
                    <li>Monitor more frequently during the adjustment period</li>
                  </ul>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <h5 className="font-medium text-sm mb-1">Day 1-2 (Departure)</h5>
                <p className="text-xs text-muted-foreground">
                  Check glucose every 2-3 hours. Keep snacks accessible. Consider keeping pump/basal on home timezone for first day.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h5 className="font-medium text-sm mb-1">Day 3-4 (Adjusting)</h5>
                <p className="text-xs text-muted-foreground">
                  Begin shifting meal times to local schedule. Adjust basal timing by 2-3 hours per day. Continue extra monitoring.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h5 className="font-medium text-sm mb-1">Day 5+ (Settled)</h5>
                <p className="text-xs text-muted-foreground">
                  Should be on local schedule. Resume normal monitoring pattern. Watch for delayed effects of jet lag.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h5 className="font-medium text-sm mb-1">Return Journey</h5>
                <p className="text-xs text-muted-foreground">
                  Same process in reverse. Expect adjustment to take 1 day per hour of timezone difference.
                </p>
              </div>
            </div>

            {!isPumpUser && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <Syringe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    Long-Acting Insulin Adjustment Calculator
                  </h4>
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                  Enter your usual long-acting (basal) insulin injection time to see a gradual adjustment schedule for your trip.
                </p>
                
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor="basal-time" className="text-blue-900 dark:text-blue-100 whitespace-nowrap">
                      I usually take my long-acting insulin at:
                    </Label>
                    <Input
                      id="basal-time"
                      type="time"
                      value={basalInjectionTime}
                      onChange={(e) => setBasalInjectionTime(e.target.value)}
                      className="w-32 bg-white dark:bg-blue-900/50"
                      data-testid="input-basal-time"
                    />
                    <span className="text-sm text-blue-700 dark:text-blue-300">(home time)</span>
                  </div>

                  {basalSchedule.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Your Adjustment Schedule ({plan.timezoneHours}h {plan.timezoneDirection})
                      </h5>
                      <div className="bg-white dark:bg-blue-900/30 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100">
                              <th className="px-3 py-2 text-left font-medium">Day</th>
                              <th className="px-3 py-2 text-left font-medium">Home Time</th>
                              <th className="px-3 py-2 text-left font-medium">Local Time</th>
                              <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {basalSchedule.map((row, idx) => (
                              <tr 
                                key={idx} 
                                className={idx % 2 === 0 ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}
                              >
                                <td className="px-3 py-2 text-blue-800 dark:text-blue-200 font-medium">
                                  {row.label}
                                </td>
                                <td className="px-3 py-2 text-blue-700 dark:text-blue-300 font-mono">
                                  {row.homeTime}
                                </td>
                                <td className="px-3 py-2 text-blue-700 dark:text-blue-300 font-mono">
                                  {row.localTime}
                                </td>
                                <td className="px-3 py-2 text-blue-600 dark:text-blue-400 text-xs hidden sm:table-cell">
                                  {row.note}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="sm:hidden space-y-1 mt-2">
                        {basalSchedule.map((row, idx) => (
                          <p key={idx} className="text-xs text-blue-600 dark:text-blue-400">
                            <strong>{row.label}:</strong> {row.note}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                        <p><strong>Important notes:</strong></p>
                        <ul className="list-disc list-inside space-y-0.5 ml-1">
                          <li>Tresiba is more flexible and may not need gradual adjustment</li>
                          <li>For trips under 3 days, you may keep your home injection time</li>
                          <li>Monitor blood glucose more frequently during adjustment</li>
                          <li>Discuss your specific plan with your diabetes team before travelling</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                These are general guidelines only. Discuss your specific adjustment plan with your diabetes team before travelling, especially for major timezone changes.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <Card className={isTravelModeActive ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/20" : "border-primary/50"}>
        <CardContent className="p-4">
          {isTravelModeActive ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Travel Mode Active</p>
                  <p className="text-xs text-green-600 dark:text-green-400">You'll see reminders until your trip ends</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleDeactivateTravelMode} data-testid="button-deactivate-travel">
                End Travel Mode
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Plane className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Activate Travel Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Enable travel mode to see reminders and timezone guidance across the app until {new Date(plan.endDate).toLocaleDateString()}.
                  </p>
                </div>
              </div>
              <Button onClick={handleActivateTravelMode} className="w-full" data-testid="button-activate-travel">
                <Plane className="h-4 w-4 mr-2" />
                Activate Travel Mode
              </Button>
            </div>
          )}
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
