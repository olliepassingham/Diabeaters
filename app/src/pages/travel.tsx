import { useState, useEffect, useLayoutEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { 
  Plane, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  Package, 
  Syringe, 
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Hospital,
  Pill,
  Info,
  Globe,
  Thermometer,
  Sun,
  Snowflake,
  Calendar,
  Heart,
  Languages,
  Phone,
  Navigation,
  Luggage,
  Trash2,
  Plus
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { storage, Supply, UserSettings, UserProfile, HolidayPrep } from "@/lib/storage";
import { recordLastInteraction } from "@/lib/last-interaction";
import {
  buildTravelWeatherRiskWarnings,
  travelAccessBufferMultiplier,
  travelPackingBufferMultiplier,
  travelWeatherAdhesivePiecesMultiplier,
  travelWeatherCgmSpareExtraCount,
  travelWeatherHypoTreatmentsMultiplier,
  travelWeatherPumpPowerMultiplier,
  travelWeatherTestStripMultiplier,
  tripCalendarDaysBetween,
} from "@/lib/travel-supply-policy";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FaceLogoWatermark } from "@/components/face-logo";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioToolHeroCard } from "@/components/scenarios/scenario-tool-hero-card";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { upsertScenario } from "@/lib/scenarios-supabase";
import { invokeNotifyScenarioStarted } from "@/lib/invoke-notify-scenario-started";
import { NOTIFY_EDGE_FAILURE_TITLE, notifyEdgeFailureDescription } from "@/lib/notify-toast-messages";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import { PharmacyCard } from "@/components/pharmacy-card";

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
  weatherChange: "warmer" | "colder" | "similar" | "unknown";
  weatherSeverity: "slight" | "moderate" | "extreme";
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

function TravelDisclaimerCard() {
  return (
    <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-900 dark:text-yellow-100">Not Medical Advice</p>
            <p className="text-yellow-800 dark:text-yellow-200 mt-1">
              Educational preparation only — not medical advice. Follow your care team for travel and insulin planning.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function calculatePackingList(plan: TravelPlan, supplies: Supply[], settings: UserSettings, isPumpUser: boolean): PackingItem[] {
  const items: PackingItem[] = [];
  const bufferMultiplier = travelPackingBufferMultiplier(plan.travelType);
  const accessBuffer = travelAccessBufferMultiplier(plan.accessRisk);
  const wxHypo = travelWeatherHypoTreatmentsMultiplier(plan);
  const wxAdhesive = travelWeatherAdhesivePiecesMultiplier(plan);
  const wxStrips = travelWeatherTestStripMultiplier(plan);
  const wxCgmExtra = travelWeatherCgmSpareExtraCount(plan);
  const wxPower = travelWeatherPumpPowerMultiplier(plan);
  
  const insulinSupplies = supplies.filter(s => s.type === "insulin" || s.type === "insulin_short" || s.type === "insulin_long");
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
    
    // Power: many pumps are USB-rechargeable; some still use disposable cells
    const powerItems = Math.max(2, Math.ceil((plan.duration / 5) * bufferMultiplier * accessBuffer * wxPower));
    items.push({
      name: "Pump power (cable / adapter / cells)",
      estimatedAmount: powerItems,
      unit: "items",
      reasoning:
        wxPower > 1
          ? "Charging cable and plug adapter; warm climates can increase charging needs — add spare cells only if your pump uses disposables."
          : "Charging cable and plug adapter; add spare disposable cells only if your pump uses them. Skip disposable batteries for rechargeable pumps.",
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
      estimatedAmount: Math.ceil((plan.duration / 3) * wxAdhesive),
      unit: "pieces",
      reasoning:
        wxAdhesive > 1
          ? `For securing sites (${plan.weatherChange} ${plan.weatherSeverity} climate — extra tape)`
          : "For securing sites in hot/humid conditions",
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
    const totalSensors = sensorsNeeded + spares + accessSpare + wxCgmExtra;
    const sparesText = spares + accessSpare + wxCgmExtra;
    items.push({
      name: supply.name,
      estimatedAmount: totalSensors,
      unit: "sensors",
      reasoning: `${plan.duration} days ÷ ${cgmDays} days/sensor = ${sensorsNeeded} + ${sparesText} spare${sparesText === 1 ? "" : "s"}${wxCgmExtra ? " (includes heat/adhesion buffer)" : ""}`,
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
    estimatedAmount: Math.ceil(plan.duration * 4 * bufferMultiplier * wxStrips),
    unit: "strips",
    reasoning:
      wxStrips > 1
        ? `For meter backup testing (+climate adjustment: ${plan.weatherChange} ${plan.weatherSeverity})`
        : "For meter backup testing",
    category: "monitoring",
    checked: false,
  });

  items.push({
    name: "Fast-Acting Glucose",
    estimatedAmount: Math.ceil(plan.duration * 2 * wxHypo),
    unit: "treatments",
    reasoning:
      wxHypo > 1
        ? `Glucose tablets/juice for hypo treatment (+climate: ${plan.weatherChange} ${plan.weatherSeverity})`
        : "Glucose tablets/juice for hypo treatment",
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

  for (const w of buildTravelWeatherRiskWarnings(plan)) {
    warnings.push(w);
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

function riskSeverityRank(severity: RiskWarning["severity"]): number {
  if (severity === "high") return 0;
  if (severity === "medium") return 1;
  return 2;
}

function truncateOneLine(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function parseISODateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatGBDateOrEmpty(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const d = parseISODateOrNull(value);
  if (!d) return "";
  return d.toLocaleDateString("en-GB", options);
}

function getDefaultISOTripDates(): { start: string; end: string } {
  const today = new Date();
  const start = today.toISOString().split("T")[0];
  const end = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return { start, end };
}

function withDefaultTripDates(plan: TravelPlan): TravelPlan {
  const start = parseISODateOrNull(plan.startDate);
  const end = parseISODateOrNull(plan.endDate);
  if (start && end) return plan;
  const defaults = getDefaultISOTripDates();
  return {
    ...plan,
    startDate: start ? plan.startDate : defaults.start,
    endDate: end ? plan.endDate : defaults.end,
  };
}

function CompactRiskConsiderations({ warnings }: { warnings: RiskWarning[] }) {
  if (warnings.length === 0) return null;
  const sorted = [...warnings].sort((a, b) => riskSeverityRank(a.severity) - riskSeverityRank(b.severity));
  const top = sorted.slice(0, 3);
  const more = sorted.length - top.length;
  return (
    <Card className="border-orange-500/35 bg-orange-50/25 dark:bg-orange-950/20" data-testid="card-travel-risks-compact">
      <CardHeader className="py-2.5 px-3 pb-1">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
          Heads-up for this trip
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-1.5">
        {top.map((w, i) => (
          <p key={i} className="text-xs leading-snug text-foreground/90 border-l-2 border-orange-400/50 pl-2">
            <span className="font-medium">{w.title}.</span> {truncateOneLine(w.description, 110)}
          </p>
        ))}
        {more > 0 ? (
          <p className="text-[11px] text-muted-foreground">+{more} more — your team can help prioritise what matters for you.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TravelPackingItemRow({
  item,
  globalIndex,
  onToggle,
  dataTestIdPrefix,
}: {
  item: PackingItem;
  globalIndex: number;
  onToggle: () => void;
  dataTestIdPrefix: string;
}) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer transition-colors hover-elevate",
        item.checked
          ? "border-green-200 bg-green-50/80 dark:border-green-800 dark:bg-green-950/25"
          : "border-border/50 bg-muted/30",
      )}
      data-testid={`${dataTestIdPrefix}-${globalIndex}`}
    >
      <Checkbox
        checked={item.checked}
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={onToggle}
        data-testid={`checkbox-${dataTestIdPrefix}-${globalIndex}`}
      />
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm leading-tight block", item.checked ? "line-through text-muted-foreground" : "")}>
          {item.name}
        </span>
      </div>
      <Badge variant="outline" className="shrink-0 h-6 px-1.5 text-[11px] tabular-nums font-medium">
        {item.estimatedAmount} {item.unit}
      </Badge>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
            data-testid={`${dataTestIdPrefix}-why-${globalIndex}`}
            aria-label="Why this quantity"
          >
            <Info className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] text-sm" align="end" sideOffset={6} onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Why this quantity</p>
          <p className="text-sm leading-snug">{item.reasoning}</p>
        </PopoverContent>
      </Popover>
      {item.checked ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" /> : null}
    </div>
  );
}

const EMERGENCY_PHRASES: Record<string, { lang: string; iAmDiabetic: string; needSugar: string; needHelp: string; emergencyNumber: string }> = {
  "English": { lang: "en", iAmDiabetic: "I am diabetic", needSugar: "I need sugar", needHelp: "I need medical help", emergencyNumber: "999 / 112" },
  "Spanish": { lang: "es", iAmDiabetic: "Soy diabético/a", needSugar: "Necesito azúcar", needHelp: "Necesito ayuda médica", emergencyNumber: "112" },
  "French": { lang: "fr", iAmDiabetic: "Je suis diabétique", needSugar: "J'ai besoin de sucre", needHelp: "J'ai besoin d'aide médicale", emergencyNumber: "15 / 112" },
  "German": { lang: "de", iAmDiabetic: "Ich bin Diabetiker/in", needSugar: "Ich brauche Zucker", needHelp: "Ich brauche medizinische Hilfe", emergencyNumber: "112" },
  "Italian": { lang: "it", iAmDiabetic: "Sono diabetico/a", needSugar: "Ho bisogno di zucchero", needHelp: "Ho bisogno di aiuto medico", emergencyNumber: "118 / 112" },
  "Portuguese": { lang: "pt", iAmDiabetic: "Sou diabético/a", needSugar: "Preciso de açúcar", needHelp: "Preciso de ajuda médica", emergencyNumber: "112" },
  "Dutch": { lang: "nl", iAmDiabetic: "Ik heb diabetes", needSugar: "Ik heb suiker nodig", needHelp: "Ik heb medische hulp nodig", emergencyNumber: "112" },
  "Greek": { lang: "el", iAmDiabetic: "Έχω διαβήτη", needSugar: "Χρειάζομαι ζάχαρη", needHelp: "Χρειάζομαι ιατρική βοήθεια", emergencyNumber: "166 / 112" },
  "Turkish": { lang: "tr", iAmDiabetic: "Şeker hastasıyım", needSugar: "Şekere ihtiyacım var", needHelp: "Tıbbi yardıma ihtiyacım var", emergencyNumber: "112" },
  "Arabic": { lang: "ar", iAmDiabetic: "أنا مصاب بالسكري", needSugar: "أحتاج سكر", needHelp: "أحتاج مساعدة طبية", emergencyNumber: "varies" },
  "Chinese": { lang: "zh", iAmDiabetic: "我有糖尿病", needSugar: "我需要糖", needHelp: "我需要医疗帮助", emergencyNumber: "120" },
  "Japanese": { lang: "ja", iAmDiabetic: "糖尿病です", needSugar: "砂糖が必要です", needHelp: "医療支援が必要です", emergencyNumber: "119" },
  "Thai": { lang: "th", iAmDiabetic: "ฉันเป็นเบาหวาน", needSugar: "ฉันต้องการน้ำตาล", needHelp: "ฉันต้องการความช่วยเหลือทางการแพทย์", emergencyNumber: "1669" },
  "Polish": { lang: "pl", iAmDiabetic: "Mam cukrzycę", needSugar: "Potrzebuję cukru", needHelp: "Potrzebuję pomocy medycznej", emergencyNumber: "112" },
  "Hindi": { lang: "hi", iAmDiabetic: "मुझे मधुमेह है", needSugar: "मुझे चीनी चाहिए", needHelp: "मुझे चिकित्सा सहायता चाहिए", emergencyNumber: "102 / 112" },
  "Croatian": { lang: "hr", iAmDiabetic: "Imam dijabetes", needSugar: "Trebam šećer", needHelp: "Trebam medicinsku pomoć", emergencyNumber: "112" },
};

export default function Travel() {
  const [step, setStep] = useState<"entry" | "inputs" | "results">("entry");
  const [isTravelModeActive, setIsTravelModeActive] = useState(false);
  const [isSickDayAlsoActive, setIsSickDayAlsoActive] = useState(false);
  const [sickDaySeverity, setSickDaySeverity] = useState<string | undefined>();
  
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
    weatherChange: "unknown",
    weatherSeverity: "moderate",
  });
  const [packingList, setPackingList] = useState<PackingItem[]>([]);
  const [riskWarnings, setRiskWarnings] = useState<RiskWarning[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [settings, setSettings] = useState<UserSettings>({});
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [basalInjectionTime, setBasalInjectionTime] = useState("22:00");
  const { toast } = useToast();
  const [activeTravelTab, setActiveTravelTab] = useState<"overview" | "plan" | "checklist">("overview");

  const [holidayPrep, setHolidayPrep] = useState<HolidayPrep | null>(null);
  const [showPrepForm, setShowPrepForm] = useState(false);
  const [prepDestination, setPrepDestination] = useState("");
  const [prepDeparture, setPrepDeparture] = useState("");
  const [prepReturn, setPrepReturn] = useState("");
  const [prepNotes, setPrepNotes] = useState("");
  const [prepChecklistOpen, setPrepChecklistOpen] = useState(false);
  const [resultsTab, setResultsTab] = useState<"packing" | "emergency" | "climate">("packing");

  const isPumpUser = profile?.insulinDeliveryMethod === "pump";
  const showClimateTab =
    plan.weatherChange !== "similar" || plan.timezoneChange !== "none";

  useEffect(() => {
    if (storage.getScenarioState().travelModeActive) {
      recordLastInteraction("scenario:travel");
    }
  }, []);

  useEffect(() => {
    if (!showClimateTab && resultsTab === "climate") setResultsTab("packing");
  }, [showClimateTab, resultsTab]);

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

  const [selectedLanguage, setSelectedLanguage] = useState("English");

  useLayoutEffect(() => {
    const s = storage.getSupplies();
    const st = storage.getSettings();
    const p = storage.getProfile();
    setSupplies(s);
    setSettings(st);
    setProfile(p);
    if (st.basalInjectionTime) {
      setBasalInjectionTime(st.basalInjectionTime);
    }

    const scenarioState = storage.getScenarioState();
    setIsTravelModeActive(scenarioState.travelModeActive || false);
    setIsSickDayAlsoActive(scenarioState.sickDayActive || false);
    setSickDaySeverity(scenarioState.sickDaySeverity);

    if (scenarioState.travelModeActive) {
      const savedPlan = storage.getTravelPlan();
      const savedList = storage.getTravelPackingList();
      if (savedPlan) {
        setPlan(withDefaultTripDates(savedPlan as TravelPlan));
      }
      if (savedList && savedList.length > 0) {
        setPackingList(savedList);
        const warnings = calculateRiskWarnings(
          withDefaultTripDates((savedPlan || plan) as TravelPlan),
          p?.insulinDeliveryMethod === "pump",
        );
        setRiskWarnings(warnings);
      }
    } else {
      const draft = storage.getTravelWizardDraft();
      if (draft && (draft.step === "inputs" || draft.step === "results")) {
        const nextPlan = withDefaultTripDates(draft.plan as TravelPlan);
        setPlan(nextPlan);
        if (draft.step === "results") {
          const list =
            draft.packingList.length > 0
              ? (draft.packingList as PackingItem[])
              : calculatePackingList(nextPlan as TravelPlan, s, st, p?.insulinDeliveryMethod === "pump");
          setPackingList(list);
          setRiskWarnings(calculateRiskWarnings(nextPlan as TravelPlan, p?.insulinDeliveryMethod === "pump"));
        } else {
          setPackingList([]);
          setRiskWarnings([]);
        }
        setStep(draft.step);
        if (draft.resultsTab === "packing" || draft.resultsTab === "emergency" || draft.resultsTab === "climate") {
          setResultsTab(draft.resultsTab);
        }
      }
    }

    const savedPrep = storage.getHolidayPrep();
    if (savedPrep) {
      setHolidayPrep(savedPrep);
    }
  }, []);

  useEffect(() => {
    if (step !== "inputs" && step !== "results") return;
    if (storage.getScenarioState().travelModeActive) return;
    storage.saveTravelWizardDraft({
      step,
      plan,
      packingList: step === "results" ? packingList : [],
      resultsTab,
      savedAt: new Date().toISOString(),
    });
  }, [step, plan, packingList, resultsTab]);

  const handleStartPlan = () => {
    setStep("inputs");
  };
  
  const defaultChecklist = [
    { id: "gp_letter", label: "Get GP letter confirming diabetes diagnosis and medication list", checked: false },
    { id: "prescription", label: "Check prescription is up to date and collect early if needed", checked: false },
    { id: "carry_on", label: "Pack all insulin and supplies in hand luggage (never in hold)", checked: false },
    { id: "sharps_bin", label: "Pack a travel sharps container for used needles", checked: false },
    { id: "cool_bag", label: "Get an insulin cool bag or Frio wallet for hot climates", checked: false },
    { id: "spare_meter", label: "Pack a spare blood glucose meter and batteries", checked: false },
    { id: "hypo_kit", label: "Pack hypo treatment (glucose tablets, juice boxes, glucagon)", checked: false },
    { id: "id_bracelet", label: "Wear medical ID bracelet or necklace", checked: false },
    { id: "insurance", label: "Arrange travel insurance that covers Type 1 diabetes", checked: false },
    { id: "timezone", label: "Discuss insulin timing adjustments with diabetes team if crossing time zones", checked: false },
    { id: "emergency_card", label: "Set up Emergency Card with translations for your destination", checked: false },
    { id: "snacks", label: "Pack carb snacks for journey delays", checked: false },
  ];

  const handleSaveHolidayPrep = () => {
    if (!prepDestination.trim() || !prepDeparture || !prepReturn) {
      toast({ title: "Missing details", description: "Please fill in destination and dates", variant: "destructive" });
      return;
    }
    if (new Date(prepReturn) <= new Date(prepDeparture)) {
      toast({ title: "Invalid dates", description: "Return date must be after departure", variant: "destructive" });
      return;
    }
    const prep: HolidayPrep = {
      id: crypto.randomUUID(),
      destination: prepDestination.trim(),
      departureDate: prepDeparture,
      returnDate: prepReturn,
      notes: prepNotes.trim() || undefined,
      checklist: defaultChecklist,
      createdAt: new Date().toISOString(),
    };
    storage.saveHolidayPrep(prep);
    setHolidayPrep(prep);
    setShowPrepForm(false);
    toast({ title: "Holiday prep saved", description: `Trip to ${prep.destination} is being tracked` });
  };

  const handleDeleteHolidayPrep = () => {
    storage.deleteHolidayPrep();
    setHolidayPrep(null);
    setPrepDestination("");
    setPrepDeparture("");
    setPrepReturn("");
    setPrepNotes("");
    toast({ title: "Holiday prep cleared", description: "Trip planning data removed" });
  };

  const handleTogglePrepChecklist = (itemId: string) => {
    if (!holidayPrep) return;
    const updated = {
      ...holidayPrep,
      checklist: holidayPrep.checklist.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      ),
    };
    storage.saveHolidayPrep(updated);
    setHolidayPrep(updated);
  };

  const handleActivateFromPrep = () => {
    if (!holidayPrep) return;
    const duration = tripCalendarDaysBetween(holidayPrep.departureDate, holidayPrep.returnDate);
    setPlan(prev => ({
      ...prev,
      destination: holidayPrep.destination,
      duration,
      startDate: holidayPrep.departureDate,
      endDate: holidayPrep.returnDate,
    }));
    setStep("inputs");
  };

  const getPrepDaysUntilDeparture = (): number | null => {
    if (!holidayPrep) return null;
    const dep = parseISODateOrNull(holidayPrep.departureDate);
    if (!dep) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dep.setHours(0, 0, 0, 0);
    return Math.ceil((dep.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getPrepTripDays = (): number => {
    if (!holidayPrep) return 0;
    return tripCalendarDaysBetween(holidayPrep.departureDate, holidayPrep.returnDate);
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
    storage.saveTravelPlan(plan);
    storage.saveTravelPackingList(packingList);
    setIsTravelModeActive(true);
    const startedAt = new Date().toISOString();
    const tz =
      plan.timezoneDirection === "none" || !plan.timezoneHours
        ? "TZ 0h"
        : `TZ ${plan.timezoneDirection === "west" ? "-" : "+"}${plan.timezoneHours}h`;
    const summary = `${plan.destination}${plan.startDate && plan.endDate ? ` · ${plan.startDate}–${plan.endDate}` : ""} · ${tz}`;
    void upsertScenario({
      scenarioKey: "travel",
      title: "Travel",
      label: `Travel mode: ${summary}`,
      state: {
        travel_active: true,
        travel_start: plan.startDate || null,
        travel_end: plan.endDate || null,
        destination: plan.destination || null,
        timezone_hours: plan.timezoneHours ?? null,
        timezone_direction: plan.timezoneDirection ?? null,
        summary,
        started_at: startedAt,
        ended_at: null,
      },
    });
    toast({
      title: "Travel Mode Activated",
      description: `You'll see travel reminders until ${
        formatGBDateOrEmpty(plan.endDate, { day: "numeric", month: "short", year: "numeric" }) || "your return date"
      }`,
    });
    void (async () => {
      const res = await invokeNotifyScenarioStarted({
        scenarioKey: "travel",
        title: "Travel started",
        summary,
      });
      if (!res.success) {
        toast({
          title: NOTIFY_EDGE_FAILURE_TITLE,
          description: notifyEdgeFailureDescription(res),
          variant: "destructive",
        });
      }
    })();
    storage.clearTravelWizardDraft();
  };
  
  const handleDeactivateTravelMode = () => {
    storage.deactivateTravelMode();
    localStorage.removeItem("diabeater_travel_session");
    setIsTravelModeActive(false);
    setStep("entry");
    const endedAt = new Date().toISOString();
    void upsertScenario({
      scenarioKey: "travel",
      title: "Travel",
      label: "Travel mode (off)",
      state: {
        travel_active: false,
        travel_start: plan.startDate || null,
        travel_end: plan.endDate || null,
        destination: plan.destination || null,
        ended_at: endedAt,
      },
    });
    toast({
      title: "Travel Mode Deactivated",
      description: "Welcome back home!",
    });
  };

  const updatePackingItem = (index: number) => {
    setPackingList(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], checked: !updated[index].checked };
      storage.saveTravelPackingList(updated);
      return updated;
    });
  };
  
  const updateDuration = (days: number) => {
    const start = parseISODateOrNull(plan.startDate) ?? new Date(getDefaultISOTripDates().start);
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

    const tz =
      plan.timezoneDirection === "none" || !plan.timezoneHours
        ? "TZ 0h"
        : `TZ ${plan.timezoneDirection === "west" ? "-" : "+"}${plan.timezoneHours}h`;
    const summary = `${plan.destination}${plan.startDate && plan.endDate ? ` · ${plan.startDate}–${plan.endDate}` : ""} · ${tz}`;
    void upsertScenario({
      scenarioKey: "travel",
      title: "Travel",
      label: `Travel plan: ${summary}`,
      state: {
        travel_active: false,
        travel_start: plan.startDate || null,
        travel_end: plan.endDate || null,
        destination: plan.destination || null,
        timezone_hours: plan.timezoneHours ?? null,
        timezone_direction: plan.timezoneDirection ?? null,
        summary,
        planned_at: new Date().toISOString(),
      },
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
    storage.clearTravelWizardDraft();
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
      weatherChange: "unknown",
      weatherSeverity: "moderate",
    });
    setPackingList([]);
    setRiskWarnings([]);
  };

  if (step === "entry" && isTravelModeActive && packingList.length > 0) {
    const startDate = parseISODateOrNull(plan.startDate) ?? new Date(getDefaultISOTripDates().start);
    const endDate = parseISODateOrNull(plan.endDate) ?? new Date(getDefaultISOTripDates().end);
    const today = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, plan.duration || Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const hasStarted = today >= startDate;
    const hasEnded = today > endDate;
    const daysElapsed = hasStarted ? Math.min(totalDays, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
    const daysUntilStart = !hasStarted ? Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const progressPercent = hasStarted ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0;

    const checkedCount = packingList.filter(i => i.checked).length;
    const groupedItems = packingList.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, PackingItem[]>);

    const todayScheduleEntry = (() => {
      if (plan.timezoneChange === "none" || !basalSchedule.length) return null;
      const dayInTrip = daysElapsed;
      const entry = basalSchedule.find(s => s.day === dayInTrip);
      if (entry) return entry;
      const lastEntry = basalSchedule[basalSchedule.length - 1];
      if (dayInTrip >= (lastEntry?.day || 0)) return lastEntry;
      return null;
    })();

    const selectedPhrases = EMERGENCY_PHRASES[selectedLanguage];

    return (
      <PageShell variant="standard" className="space-y-7">
        <PageHeader
          stackActionsMaxSm
          leading={<PageBackButton />}
          title={
            <span className="inline-flex min-w-0 flex-wrap items-center gap-2.5" data-testid="text-travel-dashboard-title">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Plane className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden />
              </span>
              <span className="min-w-0">
                {hasEnded ? "Trip complete" : hasStarted ? "Travelling" : "Trip starting soon"}
              </span>
            </span>
          }
          description={
            <>
              <span className="font-medium text-foreground">{plan.destination}</span>
              <span className="text-muted-foreground">
                {" "}
                · {plan.duration} day{plan.duration === 1 ? "" : "s"} ({plan.travelType})
              </span>
            </>
          }
          actions={
            <Badge variant="secondary" className="shrink-0 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden />
              Active
            </Badge>
          }
        />

        <ScenarioToolHeroCard
          className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800"
          classNames={{ content: "space-y-3" }}
          body={
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {formatGBDateOrEmpty(plan.startDate, { day: "numeric", month: "short" }) || "Start date"} —{" "}
                  {formatGBDateOrEmpty(plan.endDate, { day: "numeric", month: "short", year: "numeric" }) || "End date"}
                </span>
                <span className="font-medium" data-testid="text-trip-progress">
                  {hasEnded ? "Trip ended" : hasStarted ? `Day ${daysElapsed + 1} of ${totalDays}` : `Starts in ${daysUntilStart} day${daysUntilStart !== 1 ? "s" : ""}`}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" data-testid="progress-trip" />
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{daysElapsed} days elapsed</span>
                <span>{daysRemaining} days remaining</span>
              </div>
              <div className="border-t border-green-200/60 pt-3 dark:border-green-800/60">
                <ScenarioCoachLink topic="travel" />
              </div>
            </>
          }
        />

        <TravelDisclaimerCard />

        <Tabs value={activeTravelTab} onValueChange={(v) => setActiveTravelTab(v as any)} className="w-full" data-testid="travel-active-tabs">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="text-xs sm:text-sm" data-testid="tab-travel-overview">Overview</TabsTrigger>
            <TabsTrigger value="plan" className="text-xs sm:text-sm" data-testid="tab-travel-plan">Plan</TabsTrigger>
            <TabsTrigger value="checklist" className="text-xs sm:text-sm" data-testid="tab-travel-checklist">Checklist</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4 animate-fade-in-up" data-testid="tabcontent-travel-overview">
            {isSickDayAlsoActive && (
              <Card className="border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20" data-testid="card-sick-day-also-active">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-full bg-orange-100 dark:bg-orange-900 shrink-0">
                      <Thermometer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Sick day mode is also active{sickDaySeverity ? ` — ${sickDaySeverity} severity` : ""}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Being unwell while travelling significantly increases supply needs. Your supply forecasts now show the combined impact. Make sure you have access to medical care at your destination.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Link href="/scenarios/sick-day">
                          <Button variant="outline" size="sm" className="min-h-11" data-testid="button-view-sick-day-from-travel">
                            <Thermometer className="h-3 w-3 mr-1" />
                            View sick day dashboard
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {todayScheduleEntry && !isPumpUser && hasStarted && !hasEnded && (
              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Today's Insulin Timing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Long-acting injection today</p>
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 font-mono" data-testid="text-today-injection-time">
                          {todayScheduleEntry.localTime} <span className="text-sm font-normal">local time</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ({todayScheduleEntry.homeTime} home time)
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-purple-700 dark:text-purple-300">
                          {todayScheduleEntry.label}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{todayScheduleEntry.note}</p>
                      </div>
                    </div>
                    {plan.timezoneChange === "major" && (
                      <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                        Shifting by up to 2 hours per day until adjusted to local time ({plan.timezoneHours}h {plan.timezoneDirection}).
                        Monitor blood glucose extra closely during adjustment.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {isPumpUser && plan.timezoneChange !== "none" && hasStarted && !hasEnded && (
              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Timezone Reminder
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg space-y-2">
                    <p className="text-sm">
                      You're {plan.timezoneHours} hours {plan.timezoneDirection === "east" ? "ahead of" : "behind"} home time.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {daysElapsed < 2 
                        ? "Consider keeping your pump on home time for the first day, then update the clock."
                        : "Your pump clock should now be set to local time. Check basal rates are appropriate."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="plan" className="mt-4 space-y-4 animate-fade-in-up" data-testid="tabcontent-travel-plan">
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="h-5 w-5 text-red-600 dark:text-red-400" />
                  Emergency Quick Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href="/emergency-card">
                  <Button variant="outline" className="w-full" data-testid="button-active-emergency-card">
                    <Globe className="h-4 w-4 mr-2 text-red-600" />
                    View Full Emergency Card
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </Link>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Languages className="h-4 w-4" />
                      Key Phrases
                    </h4>
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger className="w-40" data-testid="select-phrase-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(EMERGENCY_PHRASES).map(lang => (
                          <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedPhrases && (
                    <div className="grid grid-cols-1 gap-2">
                      <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">"I am diabetic"</p>
                        <p className="text-lg font-medium" data-testid="text-phrase-diabetic">{selectedPhrases.iAmDiabetic}</p>
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">"I need sugar"</p>
                        <p className="text-lg font-medium" data-testid="text-phrase-sugar">{selectedPhrases.needSugar}</p>
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">"I need medical help"</p>
                        <p className="text-lg font-medium" data-testid="text-phrase-help">{selectedPhrases.needHelp}</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Emergency Number ({selectedLanguage})</p>
                          <p className="text-lg font-bold font-mono" data-testid="text-emergency-number">{selectedPhrases.emergencyNumber}</p>
                        </div>
                        <Phone className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>

                <Link href="/help-now">
                  <Button variant="outline" className="w-full mt-2" data-testid="button-help-now-link">
                    <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                    Help Now Page
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <CompactRiskConsiderations warnings={riskWarnings} />

            <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-950/20">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">Travel Mode Active</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {hasEnded
                          ? "Your trip has ended"
                          : `Until ${
                              formatGBDateOrEmpty(plan.endDate, { day: "numeric", month: "short" }) || "return"
                            }`}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleDeactivateTravelMode} data-testid="button-end-travel-active">
                    End Travel Mode
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklist" className="mt-4 space-y-4 animate-fade-in-up" data-testid="tabcontent-travel-checklist">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Packing Checklist
                  </CardTitle>
                  <Badge variant={checkedCount === packingList.length ? "default" : "secondary"} data-testid="badge-packing-progress">
                    {checkedCount}/{packingList.length} packed
                  </Badge>
                </div>
                <CardDescription>Tap items to mark them as packed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map(category => {
                  const items = groupedItems[category];
                  if (!items || items.length === 0) return null;
                  const { label, icon: Icon, color } = categoryLabels[category];
                  return (
                    <div key={category} className="space-y-2">
                      <h3 className={`font-semibold flex items-center gap-2 text-sm ${color}`}>
                        <Icon className="h-4 w-4" />
                        {label}
                      </h3>
                      <div className="space-y-1">
                        {items.map((item) => {
                          const globalIndex = packingList.findIndex((i) => i === item);
                          return (
                            <TravelPackingItemRow
                              key={globalIndex}
                              item={item}
                              globalIndex={globalIndex}
                              onToggle={() => updatePackingItem(globalIndex)}
                              dataTestIdPrefix="active-packing-item"
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Travel Mode Active</p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {hasEnded
                      ? "Your trip has ended"
                      : `Until ${
                          formatGBDateOrEmpty(plan.endDate, { day: "numeric", month: "short" }) || "return"
                        }`}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleDeactivateTravelMode} data-testid="button-end-travel-active">
                End Travel Mode
              </Button>
            </div>
          </CardContent>
        </Card>

      </PageShell>
    );
  }

  if (step === "entry") {
    return (
      <PageShell variant="standard" className="space-y-7">
        <PageHeader
          leading={<PageBackButton />}
          title="Travel"
          description="Build a packing list from your supplies, or track holiday prep before you go."
          actions={
            <div data-testid="link-travel-entry-coach-wrap">
              <ScenarioCoachLink topic="travel" />
            </div>
          }
        />

        <Card variant="glass" data-testid="card-travel-entry-hub">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Get started</CardTitle>
            <CardDescription>
              Choose a full travel plan (dates, timezone, packing list) or optional holiday prep (countdown + checklist).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-2">
            <section className="space-y-3" aria-labelledby="travel-plan-heading">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 id="travel-plan-heading" className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Travel plan
                </h2>
                <InlineInfoHint
                  ariaLabel="What Travel Mode does"
                  content={
                    <div className="space-y-3 text-sm">
                      <p>
                        Builds a packing list from your trip details and tracked supplies, with buffers for delays and
                        emergencies.
                      </p>
                      <p className="text-xs text-muted-foreground border-t border-border pt-2">
                        Educational preparation only—not medical advice. Follow your care team.
                      </p>
                    </div>
                  }
                />
              </div>
              <Button onClick={handleStartPlan} className="w-full" size="lg" data-testid="button-start-travel-plan">
                Start travel plan
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </section>

            <section className="space-y-3 border-t border-border/60 pt-6" aria-labelledby="holiday-prep-heading">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 id="holiday-prep-heading" className="text-sm font-semibold flex items-center gap-2">
                  <Luggage className="h-4 w-4 text-muted-foreground" />
                  Holiday prep
                </h2>
                <InlineInfoHint
                  ariaLabel="About Holiday Prep"
                  content={
                    <p className="text-sm">
                      Optional: set trip dates for a supply coverage check and a preparation checklist. Clears
                      automatically after your return date.
                    </p>
                  }
                />
              </div>
              <div className="space-y-4">
            {!holidayPrep && !showPrepForm && (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setShowPrepForm(true)}
                data-testid="button-start-holiday-prep"
              >
                <Plus className="h-4 w-4 mr-2" />
                Plan a Holiday
              </Button>
            )}

            {showPrepForm && !holidayPrep && (
              <div className="space-y-4" data-testid="holiday-prep-form">
                <div className="space-y-2">
                  <Label>Where are you going?</Label>
                  <Input 
                    placeholder="e.g. Spain, Lake District, Florida"
                    value={prepDestination}
                    onChange={(e) => setPrepDestination(e.target.value)}
                    data-testid="input-prep-destination"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Departure</Label>
                    <Input 
                      type="date"
                      value={prepDeparture}
                      onChange={(e) => setPrepDeparture(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      data-testid="input-prep-departure"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Return</Label>
                    <Input 
                      type="date"
                      value={prepReturn}
                      onChange={(e) => setPrepReturn(e.target.value)}
                      min={prepDeparture || new Date().toISOString().split("T")[0]}
                      data-testid="input-prep-return"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input 
                    placeholder="e.g. All-inclusive, hiking trip, visiting family"
                    value={prepNotes}
                    onChange={(e) => setPrepNotes(e.target.value)}
                    data-testid="input-prep-notes"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveHolidayPrep} data-testid="button-save-holiday-prep">
                    Save Trip
                  </Button>
                  <Button variant="ghost" onClick={() => setShowPrepForm(false)} data-testid="button-cancel-holiday-prep">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {holidayPrep && (() => {
              const daysUntil = getPrepDaysUntilDeparture();
              const tripDays = getPrepTripDays();
              const coverage = storage.getHolidaySupplyCoverage();
              const checkedCount = holidayPrep.checklist.filter(c => c.checked).length;
              const totalChecklist = holidayPrep.checklist.length;
              const prescriptionCycle = storage.getPrescriptionCycle();
              const hasSupplyShortfall = coverage.some(c => c.shortfall > 0);
              const isDepartureNear = daysUntil !== null && daysUntil <= 3 && daysUntil >= 0;
              const hasDeparted = daysUntil !== null && daysUntil < 0;

              return (
                <div className="space-y-4" data-testid="holiday-prep-active">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-base">{holidayPrep.destination}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatGBDateOrEmpty(holidayPrep.departureDate, { day: "numeric", month: "short" }) ||
                          "Departure"} 
                        {" — "}
                        {formatGBDateOrEmpty(holidayPrep.returnDate, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }) || "Return"}
                        {" "}({tripDays} days)
                      </p>
                      {holidayPrep.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{holidayPrep.notes}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleDeleteHolidayPrep} data-testid="button-delete-holiday-prep">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {daysUntil !== null && daysUntil >= 0 && (
                    <div className={`p-3 rounded-lg text-center ${
                      daysUntil <= 3
                        ? "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800"
                        : daysUntil <= 7
                        ? "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800"
                        : "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
                    }`} data-testid="text-prep-countdown">
                      <p className="text-2xl font-bold">{daysUntil}</p>
                      <p className="text-sm text-muted-foreground">
                        {daysUntil === 0 ? "Departing today" : daysUntil === 1 ? "day until departure" : "days until departure"}
                      </p>
                    </div>
                  )}

                  {hasDeparted && !isTravelModeActive && (
                    <Alert className="border-orange-300 dark:border-orange-700">
                      <Plane className="h-4 w-4" />
                      <AlertTitle>Already departed?</AlertTitle>
                      <AlertDescription>
                        Your departure date has passed. If you're travelling, activate Travel Mode for real-time guidance.
                      </AlertDescription>
                    </Alert>
                  )}

                  {coverage.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-1.5">
                        <Package className="h-4 w-4" />
                        Supply Coverage (~2× {tripDays}-day trip)
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Bars compare your forecast days of stock to about twice your trip length, in line with usual travel planning advice.
                      </p>
                      <div className="space-y-2">
                        {coverage.map(({ supply, daysRemaining, daysNeeded, shortfall, coveragePercent }) => (
                          <div key={supply.id} className="space-y-1" data-testid={`prep-supply-${supply.id}`}>
                            <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                              <span>{supply.name}</span>
                              <span className={`text-xs font-medium ${
                                shortfall > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                              }`}>
                                {daysRemaining >= 999 
                                  ? "N/A" 
                                  : shortfall > 0 
                                  ? `${shortfall} days short` 
                                  : "Covered"}
                              </span>
                            </div>
                            {daysRemaining < 999 && (
                              <Progress 
                                value={coveragePercent} 
                                className={`h-2 ${shortfall > 0 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      {hasSupplyShortfall && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Some supplies won't last the trip. Consider ordering a top-up or speaking to your pharmacy.
                        </p>
                      )}
                    </div>
                  )}

                  {prescriptionCycle && daysUntil !== null && daysUntil > 0 && (() => {
                    const interval = prescriptionCycle.intervalDays || 28;
                    const insulinSupplies = supplies.filter(s => 
                      s.type === "insulin_short" || s.type === "insulin_long" || s.type === "insulin_vial" || s.type === "insulin"
                    );
                    const relevantPickups = insulinSupplies.flatMap(s => storage.getPickupHistory(s.id));
                    const sortedPickups = [...relevantPickups].sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());
                    const lastPickup = sortedPickups[0];
                    if (!lastPickup) return null;
                    const lastDate = new Date(lastPickup.pickupDate);
                    if (!Number.isFinite(lastDate.getTime())) return null;
                    lastDate.setHours(0, 0, 0, 0);
                    const nextDue = new Date(lastDate);
                    nextDue.setDate(nextDue.getDate() + interval);
                    if (!Number.isFinite(nextDue.getTime())) return null;
                    const departure = new Date(holidayPrep.departureDate);
                    if (!Number.isFinite(departure.getTime())) return null;
                    departure.setHours(0, 0, 0, 0);
                    const daysBeforeDeparture = Math.ceil((departure.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24));
                    if (!Number.isFinite(daysBeforeDeparture)) return null;
                    
                    if (daysBeforeDeparture >= -7 && daysBeforeDeparture <= 14) {
                      return (
                        <Alert className="border-blue-300 dark:border-blue-700" data-testid="alert-prescription-timing">
                          <Calendar className="h-4 w-4" />
                          <AlertTitle>Prescription Timing</AlertTitle>
                          <AlertDescription>
                            {daysBeforeDeparture <= 0
                              ? `Your next prescription is due around ${nextDue.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — that's ${Math.abs(daysBeforeDeparture)} days before departure. Ask your pharmacy about collecting early.`
                              : `Your next prescription is due around ${nextDue.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — while you're away. Ask your pharmacy about collecting early before you go.`
                            }
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    return null;
                  })()}

                  <Collapsible open={prepChecklistOpen} onOpenChange={setPrepChecklistOpen}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between h-auto min-h-11 py-3 px-3"
                        data-testid="button-prep-checklist-toggle"
                      >
                        <span className="flex items-center gap-2 text-left">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>
                            <span className="font-medium text-sm block">Preparation checklist</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {checkedCount} of {totalChecklist} done
                            </span>
                          </span>
                        </span>
                        {prepChecklistOpen ? (
                          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      <Progress value={(checkedCount / totalChecklist) * 100} className="h-2" />
                      <div className="space-y-1">
                        {holidayPrep.checklist.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-start gap-2 p-2 rounded-lg cursor-pointer hover-elevate"
                            data-testid={`prep-check-${item.id}`}
                          >
                            <Checkbox 
                              checked={item.checked}
                              onCheckedChange={() => handleTogglePrepChecklist(item.id)}
                            />
                            <span className={`text-sm leading-tight ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                              {item.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {isDepartureNear && !isTravelModeActive && (
                    <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-950/20" data-testid="card-departure-prompt">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Plane className="h-5 w-5 text-green-600" />
                            <p className="font-medium text-green-800 dark:text-green-200">
                              {daysUntil === 0 ? "Time to go!" : "Nearly time to go!"}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Activate Travel Mode to get real-time guidance, timezone adjustments, and emergency support while you're away.
                          </p>
                          <Button onClick={handleActivateFromPrep} className="w-full" data-testid="button-activate-from-prep">
                            Start Travel Plan
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!isDepartureNear && !hasDeparted && !isTravelModeActive && (
                    <Button variant="outline" onClick={handleActivateFromPrep} className="w-full" data-testid="button-start-plan-from-prep">
                      <Plane className="h-4 w-4 mr-2" />
                      Start Travel Plan for This Trip
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              );
            })()}
              </div>
            </section>

            <section className="border-t border-border/60 pt-6 space-y-3" aria-labelledby="travel-extras-heading">
              <h2 id="travel-extras-heading" className="text-sm font-semibold text-muted-foreground">
                Before you go
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2" data-testid="card-pretravel-appointment">
                  <div className="flex flex-wrap items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">Appointments</span>
                    <InlineInfoHint
                      ariaLabel="Why book before you travel"
                      content={
                        <p className="text-sm">
                          Letters for travel and extra supplies often need planning—book ahead where you can.
                        </p>
                      }
                    />
                  </div>
                  <Link href="/appointments" className="block">
                    <Button variant="secondary" className="w-full" size="sm" data-testid="link-pretravel-appointments">
                      View appointments
                    </Button>
                  </Link>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <Globe className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="text-sm font-medium">Emergency card</span>
                    <InlineInfoHint
                      ariaLabel="About the emergency card"
                      content={
                        <p className="text-sm">
                          Short medical alert text you can show or translate when you need help abroad.
                        </p>
                      }
                    />
                  </div>
                  <Link href="/emergency-card" className="block">
                    <Button variant="secondary" className="w-full" size="sm" data-testid="button-emergency-card">
                      <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                      Open emergency card
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  </Link>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>

        <TravelDisclaimerCard />

      </PageShell>
    );
  }

  if (step === "inputs") {
    return (
      <PageShell variant="standard" className="space-y-7">
        <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-100 dark:border-purple-900">
          <CardHeader>
            <div className="flex items-center gap-3">
              <PageBackButton />
              <Button variant="ghost" size="icon" onClick={resetPlan} data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-xl">
                Travel{" "}
                <span className="text-sm font-normal text-muted-foreground">— Tell us about your upcoming travel</span>
              </CardTitle>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trip information</CardTitle>
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
                    const startDate = parseISODateOrNull(newStart);
                    if (!startDate || !Number.isFinite(startDate.getTime())) return;
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
                    const startDate = parseISODateOrNull(plan.startDate) ?? new Date(getDefaultISOTripDates().start);
                    const endDate = parseISODateOrNull(newEnd);
                    if (!endDate || !Number.isFinite(endDate.getTime())) return;
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
              <p className="text-xs text-muted-foreground">
                Your home pharmacy (for collecting before you go):
              </p>
              <PharmacyCard variant="default" />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Weather at Destination
              </Label>
              <Select 
                value={plan.weatherChange} 
                onValueChange={(value: "warmer" | "colder" | "similar" | "unknown") => setPlan(prev => ({ ...prev, weatherChange: value }))}
              >
                <SelectTrigger data-testid="select-weather-change">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">I'm not sure</SelectItem>
                  <SelectItem value="similar">Similar to home</SelectItem>
                  <SelectItem value="warmer">Warmer than home</SelectItem>
                  <SelectItem value="colder">Colder than home</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(plan.weatherChange === "warmer" || plan.weatherChange === "colder") && (
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <Label>How much {plan.weatherChange === "warmer" ? "warmer" : "colder"}?</Label>
                <Select 
                  value={plan.weatherSeverity} 
                  onValueChange={(value: "slight" | "moderate" | "extreme") => setPlan(prev => ({ ...prev, weatherSeverity: value }))}
                >
                  <SelectTrigger data-testid="select-weather-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slight">Slightly (5-10°C difference)</SelectItem>
                    <SelectItem value="moderate">Moderately (10-20°C difference)</SelectItem>
                    <SelectItem value="extreme">Significantly (20°C+ difference)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {plan.weatherChange === "warmer" 
                    ? "Heat can speed up insulin absorption and increase hypo risk" 
                    : "Cold can slow insulin absorption and affect CGM/meter accuracy"}
                </p>
              </div>
            )}

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
      </PageShell>
    );
  }

  const groupedItems = packingList.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PackingItem[]>);

  const checkedCount = packingList.filter(i => i.checked).length;

  return (
    <PageShell variant="standard" className="space-y-7">
      <div className="flex items-start gap-2 border-b border-border/60 pb-3 mb-3">
        <div className="flex shrink-0 items-center gap-1">
          <PageBackButton />
          <Button variant="ghost" size="icon" onClick={resetPlan} data-testid="button-new-plan">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-base font-semibold leading-snug text-balance break-words sm:text-lg">
            {plan.destination || "Trip"}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {plan.duration} day{plan.duration === 1 ? "" : "s"}
            </span>
          </h1>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="text-xs text-muted-foreground min-w-0">
              {formatGBDateOrEmpty(plan.startDate, { day: "numeric", month: "short" }) || "Start date"} –{" "}
              {formatGBDateOrEmpty(plan.endDate, { day: "numeric", month: "short", year: "numeric" }) || "End date"}
            </p>
            <Badge variant="outline" className="shrink-0 text-xs">
              {plan.travelType === "international" ? "International" : "Domestic"}
            </Badge>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border px-3 py-2.5 mb-4 flex flex-wrap items-center justify-between gap-2",
          isTravelModeActive
            ? "border-green-500/40 bg-green-500/[0.08] dark:bg-green-950/25"
            : "border-border/60 bg-muted/20",
        )}
        data-testid="strip-travel-mode-status"
      >
        {isTravelModeActive ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-900 dark:text-green-100 truncate">Travel mode on</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleDeactivateTravelMode} data-testid="button-deactivate-travel">
              End
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <Plane className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-snug">
                Turn on for reminders until{" "}
                <span className="text-foreground font-medium">
                  {formatGBDateOrEmpty(plan.endDate, { day: "numeric", month: "short", year: "numeric" }) ||
                    "your return date"}
                </span>
                .
              </p>
            </div>
            <Button size="sm" onClick={handleActivateTravelMode} data-testid="button-activate-travel" className="shrink-0">
              <Plane className="h-3.5 w-3.5 mr-1.5" />
              Activate
            </Button>
          </>
        )}
      </div>

      <Tabs
        value={!showClimateTab && resultsTab === "climate" ? "packing" : resultsTab}
        onValueChange={(v) => setResultsTab(v as "packing" | "emergency" | "climate")}
        className="w-full"
        data-testid="tabs-travel-results"
      >
        <TabsList className={cn("grid w-full gap-1", showClimateTab ? "grid-cols-3" : "grid-cols-2")}>
          <TabsTrigger value="packing" className="text-xs sm:text-sm" data-testid="tab-results-packing">
            Packing
          </TabsTrigger>
          <TabsTrigger value="emergency" className="text-xs sm:text-sm" data-testid="tab-results-emergency">
            Emergency
          </TabsTrigger>
          {showClimateTab && (
            <TabsTrigger value="climate" className="text-xs sm:text-sm" data-testid="tab-results-climate">
              Climate & time
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="packing" className="mt-4 space-y-4">
          <Card data-testid="card-smart-packing-list">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-5 w-5" />
                  Smart packing list
                </CardTitle>
                <Badge variant="secondary" className="tabular-nums">
                  {checkedCount}/{packingList.length}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Tap to pack. Use the info button on each row to see how quantities were estimated.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((category) => {
                const items = groupedItems[category];
                if (!items || items.length === 0) return null;
                const { label, icon: Icon, color } = categoryLabels[category];
                return (
                  <div key={category} className="space-y-1.5">
                    <h3 className={cn("text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5", color)}>
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </h3>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const globalIndex = packingList.findIndex((i) => i === item);
                        return (
                          <TravelPackingItemRow
                            key={globalIndex}
                            item={item}
                            globalIndex={globalIndex}
                            onToggle={() => toggleItem(globalIndex)}
                            dataTestIdPrefix="packing-item"
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-border/50 space-y-2">
                <p className="text-[11px] text-muted-foreground text-center leading-snug">
                  Educational packing guide only — not medical advice. Follow your care team.
                </p>
                <MedicalSourcesLink anchor="insulin" className="flex justify-center" compact />
              </div>
            </CardContent>
          </Card>

          <CompactRiskConsiderations warnings={riskWarnings} />
        </TabsContent>

        <TabsContent value="emergency" className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href="/emergency-card" className="flex-1">
              <Button className="w-full" variant="secondary" data-testid="button-travel-tab-emergency-card">
                Open emergency card
              </Button>
            </Link>
            <Link href="/help-now" className="flex-1">
              <Button className="w-full" variant="outline" data-testid="button-travel-tab-help-now">
                Help now
              </Button>
            </Link>
          </div>

          <Card className="border-border/70">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Hospital className="h-5 w-5 shrink-0" />
                If something goes wrong — start here
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Three priorities; open a section below for step-by-step detail.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground/90">
              <p className="flex gap-2.5">
                <span className="font-bold text-primary tabular-nums shrink-0">1</span>
                <span>
                  <strong>Hypo first.</strong> Treat low glucose, then reassess — get urgent help if you do not recover
                  or someone else needs to help you.
                </span>
              </p>
              <p className="flex gap-2.5">
                <span className="font-bold text-primary tabular-nums shrink-0">2</span>
                <span>
                  <strong>Lost insulin or supplies.</strong> Pharmacy first, then urgent care or hospital with your
                  prescription and letter; use insurance if you have it.
                </span>
              </p>
              <p className="flex gap-2.5">
                <span className="font-bold text-primary tabular-nums shrink-0">3</span>
                <span>
                  <strong>Prevent the crisis.</strong> Keep insulin and kit in carry-on only; know how to reach your
                  team and the local emergency number.
                </span>
              </p>
            </CardContent>
          </Card>

          <Accordion type="multiple" className="w-full rounded-lg border border-border/60 bg-card px-1">
            <AccordionItem value="lost-insulin" className="border-b-0 px-2">
              <AccordionTrigger className="text-sm py-3 hover:no-underline">
                Lost or damaged insulin
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside pl-0.5">
                  <li>Contact a local pharmacy with your prescription</li>
                  <li>Ask hotel concierge for nearby pharmacies if needed</li>
                  <li>Call your diabetes team for guidance</li>
                  <li>Consider the insulin manufacturer&apos;s local office</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="supplies" className="border-b-0 px-2">
              <AccordionTrigger className="text-sm py-3 hover:no-underline">
                Supplies running out
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside pl-0.5">
                  <li>Visit local hospital or urgent care</li>
                  <li>Show prescription and doctor&apos;s letter</li>
                  <li>Contact your travel insurance provider</li>
                  <li>Research nearest medical facilities before you travel</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="urgent-help" className="border-b-0 px-2">
              <AccordionTrigger className="text-sm py-3 hover:no-underline">
                When to seek urgent medical help
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside pl-0.5">
                  <li>Persistent high blood glucose with ketones</li>
                  <li>Severe hypoglycaemia requiring assistance</li>
                  <li>Signs of diabetic ketoacidosis (DKA)</li>
                  <li>Vomiting or inability to keep fluids down</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="travel-docs" className="border-b-0 px-2">
              <AccordionTrigger className="text-sm py-3 hover:no-underline">
                {plan.travelType === "international"
                  ? "International: carry-on, customs & language"
                  : "Carry-on, security & documents"}
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside pl-0.5">
                  <li>Keep supplies in carry-on luggage</li>
                  <li>Carry your doctor&apos;s letter for security and care</li>
                  {plan.travelType === "international" && (
                    <li>Learn key diabetes terms in the local language</li>
                  )}
                  <li>Note the emergency number for your destination</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {showClimateTab && (
        <TabsContent value="climate" className="mt-4 space-y-3">
          <Card className="border-border/70">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Thermometer className="h-4 w-4 shrink-0" />
                At a glance
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                What to watch first on this trip; open a section for full detail and the basal table.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="list-disc list-inside space-y-1.5 text-sm text-foreground/90">
                {plan.weatherChange === "warmer" && (
                  <li>
                    Warmer than home: heat can speed insulin — check glucose more often, keep extra fast hypo treatment
                    handy, and keep insulin cool.
                  </li>
                )}
                {plan.weatherChange === "colder" && (
                  <li>
                    Colder than home: insulin may act slower — watch trends, keep insulin from freezing, warm strips, and
                    keep hypo supplies in inner pockets.
                  </li>
                )}
                {plan.weatherChange === "unknown" && (
                  <li>
                    Weather still unknown: both heat and cold can change absorption — use the weather section when you
                    know the forecast.
                  </li>
                )}
                {plan.timezoneChange !== "none" && (
                  <li>
                    About {plan.timezoneHours} hour{plan.timezoneHours === 1 ? "" : "s"} time difference
                    {plan.timezoneDirection === "none"
                      ? ""
                      : plan.timezoneDirection === "east"
                        ? " (travelling east)"
                        : " (travelling west)"}
                    {": "}
                    shift meals and basal gradually and monitor closely in the first days.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Accordion
            type="multiple"
            className="w-full rounded-lg border border-border/60 bg-card px-1"
            defaultValue={
              plan.weatherChange !== "similar"
                ? ["weather"]
                : plan.timezoneChange !== "none"
                  ? ["timezone"]
                  : []
            }
          >
            {plan.weatherChange !== "similar" && (
              <AccordionItem value="weather" className="border-b-0 px-1">
                <AccordionTrigger className="text-sm py-3 hover:no-underline">
                  Weather — detail & actions
                </AccordionTrigger>
                <AccordionContent className="pb-2 pt-0 border-t border-border/40">
                  <Card
                    className={plan.weatherChange === "warmer"
          ? "border-red-200 dark:border-red-800" 
          : plan.weatherChange === "colder" 
            ? "border-blue-200 dark:border-blue-800" 
            : "border-orange-200 dark:border-orange-800"
        }>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {plan.weatherChange === "warmer" ? (
                <Sun className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : plan.weatherChange === "colder" ? (
                <Snowflake className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Thermometer className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              )}
              {plan.weatherChange === "warmer" 
                ? "Hot Weather Adjustments" 
                : plan.weatherChange === "colder" 
                  ? "Cold Weather Adjustments" 
                  : "Weather Considerations"}
            </CardTitle>
            <CardDescription>
              {plan.weatherChange === "warmer" 
                ? "Personalized recommendations for your warmer destination" 
                : plan.weatherChange === "colder" 
                  ? "Personalized recommendations for your colder destination" 
                  : "How climate differences may affect your diabetes management"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.weatherChange === "warmer" && (
              <>
                {/* Personalized Hot Weather Recommendations */}
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <h4 className="font-medium text-red-900 dark:text-red-100 mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Your Insulin Adjustment Suggestion
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-100 dark:border-red-900">
                      <p className="text-sm font-medium text-red-900 dark:text-red-100">Mealtime Doses</p>
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">
                        In heat, insulin can act faster (some people need less mealtime insulin)
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use your care team’s plan and adjust based on readings — heat affects everyone differently.
                      </p>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-100 dark:border-red-900">
                      <p className="text-sm font-medium text-red-900 dark:text-red-100">Background/Basal Insulin</p>
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">Often no change, but monitor closely</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        If you’re running lower than usual, follow your agreed basal plan or contact your team for advice.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h5 className="font-medium text-sm mb-2">Why This Happens</h5>
                    <p className="text-sm text-muted-foreground">
                      Heat increases blood flow to the skin, causing insulin to absorb faster than normal. 
                      This means the same dose works more quickly and effectively — increasing hypo risk.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h5 className="font-medium text-sm mb-2">Key Actions</h5>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Check blood glucose more often (every 2-3 hours)</li>
                      <li>Carry extra hypo treatment — glucose tabs melt in heat</li>
                      <li>Stay hydrated (dehydration raises BG)</li>
                      <li>Keep insulin in a cooling case or bag</li>
                    </ul>
                  </div>
                </div>

                {isPumpUser && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Pump users:</strong> Infusion sets may lose adhesion in humidity and sweat. 
                      Pack extra sets and consider skin prep wipes or additional tape.
                    </p>
                  </div>
                )}
              </>
            )}

            {plan.weatherChange === "colder" && (
              <>
                {/* Personalized Cold Weather Recommendations */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Your Insulin Adjustment Suggestion
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-100 dark:border-blue-900">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Mealtime Doses</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        In cold, insulin can act slower (some people need more mealtime insulin)
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start with your normal dose and adjust based on readings — cold affects everyone differently
                      </p>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-100 dark:border-blue-900">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Background/Basal Insulin</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">Often no change, but monitor trends</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        If you’re running higher than usual for more than a day, follow your agreed plan or contact your team.
                      </p>
                    </div>
                    {plan.weatherSeverity !== "slight" && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">⚠️ Activity Warning</p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Shivering and winter activities (skiing, skating) burn glucose rapidly like exercise. 
                          Despite needing more insulin for meals, you may experience <strong>unexpected hypos</strong> during physical activity in the cold.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h5 className="font-medium text-sm mb-2">Why This Happens</h5>
                    <p className="text-sm text-muted-foreground">
                      Cold reduces blood flow to the skin, slowing insulin absorption. 
                      This means your usual dose may work more slowly or less effectively initially.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h5 className="font-medium text-sm mb-2">Key Actions</h5>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Keep insulin close to your body (it can freeze!)</li>
                      <li>Warm test strips before using</li>
                      <li>CGM may read lower than actual in extreme cold</li>
                      <li>Carry hypo treatment in an inside pocket</li>
                    </ul>
                  </div>
                </div>

                {isPumpUser && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Pump users:</strong> Keep your pump close to your body to prevent insulin from getting too cold. 
                      Insulin left in a cold bag or exposed tubing may not work properly.
                    </p>
                  </div>
                )}
              </>
            )}

            {plan.weatherChange === "unknown" && (
              <>
                <p className="text-sm text-muted-foreground">
                  You haven't specified the weather at your destination. Here's a quick overview of how temperature differences can affect your insulin needs:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Sun className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <h5 className="font-medium text-red-900 dark:text-red-100">If It's Hotter</h5>
                    </div>
                    <ul className="text-xs text-red-800 dark:text-red-200 space-y-1 list-disc list-inside">
                      <li>Insulin can absorb faster (some people need less insulin)</li>
                      <li>Higher hypo risk</li>
                      <li>Keep insulin cool</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Snowflake className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h5 className="font-medium text-blue-900 dark:text-blue-100">If It's Colder</h5>
                    </div>
                    <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                      <li>Insulin can absorb slower (some people need more insulin)</li>
                      <li>Activity in cold = hypo risk</li>
                      <li>Keep insulin warm (don't let it freeze)</li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            <Alert className="border-muted">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Not medical advice.</strong> These are starting points based on general patterns. 
                Everyone responds differently — monitor frequently, start with smaller adjustments, and increase if needed.
                Discuss significant travel with your diabetes team beforehand if possible.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
                </AccordionContent>
              </AccordionItem>
            )}

            {plan.timezoneChange !== "none" && (
              <AccordionItem value="timezone" className="border-b-0 px-1">
                <AccordionTrigger className="text-sm py-3 hover:no-underline">
                  Time zones & basal schedule
                </AccordionTrigger>
                <AccordionContent className="pb-2 pt-0 border-t border-border/40">
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
                      onChange={(e) => {
                        setBasalInjectionTime(e.target.value);
                        const current = storage.getSettings();
                        storage.saveSettings({ ...current, basalInjectionTime: e.target.value });
                      }}
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
                </AccordionContent>
              </AccordionItem>
            )}

          </Accordion>
        </TabsContent>
        )}

      </Tabs>
    </PageShell>
  );
}
