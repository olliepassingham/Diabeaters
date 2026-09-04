import { useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { 
  Plane, 
  Clock, 
  ShieldAlert, 
  Package, 
  Syringe, 
  Activity,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Pill,
  Info,
  Globe,
  Thermometer,
  Sun,
  Snowflake,
  Calendar,
  Trash2,
  Dumbbell,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  storage,
  Supply,
  UserSettings,
  UserProfile,
  HolidayPrep,
  Appointment,
  DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT,
  DIABEATER_ACTIVE_USER_CHANGED_EVENT,
  DIABEATER_APPOINTMENTS_CHANGED_EVENT,
  DIABEATER_PROFILE_CHANGED_EVENT,
  isAppointmentsStorageKey,
} from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { syncAppointments } from "@/lib/appointments-supabase";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { getEffectiveTdd } from "@/lib/tdd";
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
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { ScenarioCoachLink } from "@/components/ai-coach/ScenarioCoachLink";
import { fetchScenarioStateForUser, upsertScenario } from "@/lib/scenarios-supabase";
import { invokeNotifyScenarioStarted } from "@/lib/invoke-notify-scenario-started";
import { NOTIFY_EDGE_FAILURE_TITLE, notifyEdgeFailureDescription } from "@/lib/notify-toast-messages";
import { MedicalSourcesLink } from "@/components/medical-sources-link";
import {
  getDisplayLocale,
} from "@/lib/region";
import { PharmacyCard } from "@/components/pharmacy-card";
import {
  buildActiveTravelCoachPrompt,
  buildActiveTravelTodayFocus,
  buildActiveTravelTripProfileChips,
  type TravelTripStyle,
} from "@/lib/travel-active-guidance";
import { buildExerciseScenarioPlannerHref } from "@/lib/exercise-planner-href";
import { getWorkoutElapsedMs } from "@/lib/exercise-session-timing";
import { TravelInsulinClockCard } from "@/components/travel-insulin-clock-card";
import {
  buildBasalAdjustmentSchedule,
  pickBasalRowForDay,
  timezoneChangeFromHours,
  type BasalAdjustmentRow,
} from "@/lib/travel-insulin-clock";

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
  tripStyle?: TravelTripStyle;
}

function travelTripStyleForCloud(tripStyle: TravelTripStyle | undefined): string | null {
  if (!tripStyle || tripStyle === "not_sure") return null;
  return tripStyle;
}

/** Parse date-only strings as local calendar dates (avoids UTC-midnight timezone skew). */
function parseAppointmentDateLocal(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatNextAppointmentWhen(appointment: Appointment): string {
  const d = parseAppointmentDateLocal(appointment.date);
  if (!d) return "Date TBC";
  const datePart = format(d, "EEE d MMM");
  return appointment.time?.trim() ? `${datePart} · ${appointment.time.trim()}` : datePart;
}

function buildTravelScenarioSummary(plan: TravelPlan): string {
  const tz =
    plan.timezoneDirection === "none" || !plan.timezoneHours
      ? "TZ 0h"
      : `TZ ${plan.timezoneDirection === "west" ? "-" : "+"}${plan.timezoneHours}h`;
  return `${plan.destination}${plan.startDate && plan.endDate ? ` · ${plan.startDate}–${plan.endDate}` : ""} · ${tz}`;
}

async function syncTravelScenarioCloudFromPlan(planSlice: TravelPlan): Promise<void> {
  const remote = (await fetchScenarioStateForUser("travel")) ?? {};
  const summary = buildTravelScenarioSummary(planSlice);
  await upsertScenario({
    scenarioKey: "travel",
    title: "Travel",
    label: `Travel mode: ${summary}`,
    state: {
      ...remote,
      travel_active: true,
      travelModeActive: true,
      travel_start: planSlice.startDate || null,
      travel_end: planSlice.endDate || null,
      destination: planSlice.destination || null,
      timezone_hours: planSlice.timezoneHours ?? null,
      timezone_direction: planSlice.timezoneDirection ?? null,
      travel_trip_style: travelTripStyleForCloud(planSlice.tripStyle),
      summary,
    },
  });
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

const TRAVEL_DURATION_PRESETS = [
  { label: "Weekend", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "3 weeks", days: 21 },
  { label: "1 month", days: 30 },
] as const;

const TRIP_STYLE_OPTIONS: { value: TravelTripStyle; label: string }[] = [
  { value: "relax", label: "Relax" },
  { value: "active", label: "Active" },
  { value: "city", label: "City" },
  { value: "remote", label: "Remote" },
  { value: "family", label: "Family" },
  { value: "not_sure", label: "Mixed" },
];

type ClimateGuidanceSection = {
  title: string;
  subtitle: string;
  bullets: string[];
  callout?: string;
};

function climateWeatherGuidance(plan: TravelPlan, isPumpUser: boolean): ClimateGuidanceSection | null {
  const severityNote =
    plan.weatherSeverity === "extreme"
      ? "Large climate swing — start with small dose changes and check often."
      : plan.weatherSeverity === "moderate"
        ? "Noticeable difference from home — adjust based on readings, not guesses."
        : null;

  if (plan.weatherChange === "warmer") {
    const bullets = [
      "Heat can make insulin work faster — hypo risk often goes up.",
      "Check glucose every 2–3 hours while you settle in.",
      "Keep insulin in a cool bag or Frio wallet; never leave it in a hot car.",
      "Carry extra fast-acting hypo treatment (glucose tabs can melt).",
      "Drink enough water — dehydration can push glucose up.",
    ];
    if (isPumpUser) bullets.push("Humidity and sweat: pack spare infusion sets and skin prep or tape.");
    return {
      title: "Hotter than home",
      subtitle: "Focus on cooling supplies, frequent checks, and hypo readiness.",
      bullets,
      callout:
        severityNote ??
        "Mealtime insulin may need less than usual for some people — only change doses with your care team's plan.",
    };
  }
  if (plan.weatherChange === "colder") {
    const bullets = [
      "Cold can slow insulin absorption — you may run higher before doses catch up.",
      "Keep insulin next to your body so it does not freeze.",
      "Warm test strips in your hands before using them.",
      "Keep hypo supplies in an inside pocket — still check if you are active in the cold.",
      "Shivering and winter sport can drop glucose like exercise.",
    ];
    if (isPumpUser) bullets.push("Keep the pump and tubing warm; cold insulin may not work properly.");
    return {
      title: "Colder than home",
      subtitle: "Protect insulin from freezing and watch for both highs and activity lows.",
      bullets,
      callout:
        severityNote ??
        (plan.weatherSeverity !== "slight"
          ? "Some people need more mealtime insulin in the cold — confirm any change with your team."
          : "Trends matter more than a single reading — give changes a day before adjusting again."),
    };
  }
  if (plan.weatherChange === "unknown") {
    return {
      title: "Weather not set",
      subtitle: "Until you know the forecast, plan for both heat and cold.",
      bullets: [
        "If it is hot: cool insulin, check often, extra hypo supplies.",
        "If it is cold: keep insulin warm, warm strips, watch for exercise lows.",
        "Update your trip inputs when you have a forecast for tighter advice.",
      ],
    };
  }
  return null;
}

type ClimateTimezonePhase = { label: string; text: string };

function climateTimezoneGuidance(plan: TravelPlan): ClimateGuidanceSection & { phases: ClimateTimezonePhase[] } {
  const dir =
    plan.timezoneDirection === "east" ? "Travelling east" : plan.timezoneDirection === "west" ? "Travelling west" : "Time zone change";

  const bullets =
    plan.timezoneDirection === "east"
      ? [
          "Your day is shorter — meals and boluses may need to move earlier.",
          "Jet lag can cause temporary insulin resistance — expect some unpredictability.",
          "Many people check glucose every 2–3 hours for the first 48 hours.",
        ]
      : plan.timezoneDirection === "west"
        ? [
            "Your day is longer — you may need an extra meal or bolus on travel day.",
            "Some people keep long-acting on home time for day one, then shift slowly.",
            "Extra checks help while your body clock adjusts.",
          ]
        : [
            "Shift meals and basal timing gradually toward local time.",
            "Check glucose more often for the first few days.",
            "Discuss major time changes with your diabetes team before you go.",
          ];

  const phases: ClimateTimezonePhase[] = [
    {
      label: "Days 1–2",
      text: "Check often; keep snacks handy. Long-acting may stay on home time at first if your team agrees.",
    },
    {
      label: "Days 3–4",
      text: "Move meals and basal toward local time in small steps (about 1–2 hours per day).",
    },
    {
      label: "Day 5+",
      text: "You should be on local routine — return journey uses the same idea in reverse.",
    },
  ];

  return {
    title: `${dir} · ${plan.timezoneHours}h`,
    subtitle: "Shift timing gradually — rushing increases hypo and high risk.",
    bullets,
    phases,
    callout: "Trips under 3 days: some people keep home basal times. Flexible insulins (e.g. degludec) may need less shifting — follow your own plan.",
  };
}

function TravelDisclaimerCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p
        className="px-1 text-center text-sm leading-snug text-muted-foreground"
        role="note"
        data-testid="travel-disclaimer-compact"
      >
        <span className="font-medium text-foreground/80">Not medical advice.</span> Follow your care team for travel and insulin planning.
      </p>
    );
  }

  return (
    <Card className="overflow-hidden rounded-[1.35rem] border-amber-500/25 bg-amber-500/[0.06] shadow-none" data-testid="travel-disclaimer">
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-foreground">Not medical advice</p>
        <p className="mt-1 text-sm leading-snug text-foreground/85">
          Educational preparation only. Follow your care team for travel and insulin planning.
        </p>
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
    const tdd = getEffectiveTdd(settings) ?? 40;
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

function completedAtWithinInclusiveTripDates(completedAtIso: string, tripStart: Date, tripEnd: Date): boolean {
  const t = new Date(completedAtIso);
  if (!Number.isFinite(t.getTime())) return false;
  const start = new Date(tripStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(tripEnd);
  end.setHours(23, 59, 59, 999);
  return t >= start && t <= end;
}

function countExerciseOutcomesInTripWindow(planStart: string, planEnd: string): number {
  const start = parseISODateOrNull(planStart);
  const end = parseISODateOrNull(planEnd);
  if (!start || !end) return 0;
  return storage
    .getExerciseOutcomes()
    .filter((o) => completedAtWithinInclusiveTripDates(o.completedAt, start, end)).length;
}

function formatTripDate(
  value: string | null | undefined,
  profile: UserProfile | null,
  options: Intl.DateTimeFormatOptions,
): string {
  const d = parseISODateOrNull(value);
  if (!d) return "";
  return d.toLocaleDateString(getDisplayLocale(profile), options);
}

function getDefaultISOTripDates(): { start: string; end: string } {
  const toLocalIso = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const today = new Date();
  const start = toLocalIso(today);
  const end = toLocalIso(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));
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
    <Card className="overflow-hidden rounded-[1.35rem] border-amber-500/25 bg-amber-500/[0.06] shadow-none" data-testid="card-travel-risks-compact">
      <CardHeader className="px-4 py-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          Heads-up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-3.5 pt-0">
        {top.map((w, i) => (
          <p key={i} className="text-sm leading-snug text-foreground/90">
            <span className="font-semibold">{w.title}.</span> {truncateOneLine(w.description, 90)}
          </p>
        ))}
        {more > 0 ? (
          <p className="text-sm text-muted-foreground">+{more} more</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function travelSegmentClass(active: boolean) {
  return cn(
    "h-11 min-h-11 min-w-0 flex-1 rounded-lg px-2 text-sm font-medium shadow-none transition-colors",
    active
      ? "bg-background text-foreground shadow-sm ring-1 ring-border/60 dark:bg-background/90"
      : "text-muted-foreground hover:text-foreground",
  );
}

function travelTileClass(active: boolean) {
  return cn(
    "h-12 min-h-12 min-w-0 w-full rounded-xl px-3 text-sm font-medium shadow-none",
    active
      ? "bg-primary text-primary-foreground"
      : "bg-muted/55 text-foreground ring-1 ring-border/50 hover:bg-muted/80",
  );
}

const travelDateInputClass =
  "travel-date-input h-11 w-full min-w-0 max-w-full rounded-xl text-base tabular-nums";

function TravelSegmentGroup<T extends string>({
  labelledBy,
  value,
  onChange,
  options,
  testId,
  columns,
  variant = "segmented",
}: {
  labelledBy?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  testId?: string;
  columns: 2 | 3;
  variant?: "segmented" | "tiles";
}) {
  return (
    <div
      className={cn(
        "grid min-w-0",
        variant === "tiles"
          ? "gap-2"
          : "gap-1 rounded-xl bg-muted/45 p-1 dark:bg-muted/30",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
      )}
      role="group"
      aria-labelledby={labelledBy}
      data-testid={testId}
    >
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            variant === "tiles" ? travelTileClass(value === opt.value) : travelSegmentClass(value === opt.value),
            "w-full",
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
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
        "flex items-center gap-2.5 rounded-xl border px-2.5 py-2 cursor-pointer transition-colors",
        item.checked
          ? "border-emerald-500/30 bg-emerald-500/[0.08] dark:bg-emerald-950/30"
          : "border-border/50 bg-card/70",
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
      <div className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium leading-snug", item.checked ? "line-through text-muted-foreground" : "text-foreground")}>
          {item.name}
        </span>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {item.estimatedAmount} {item.unit}
      </span>
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
          <p className="text-sm leading-snug">{item.reasoning}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function Travel() {
  const { user } = useAuth();
  const [step, setStep] = useState<"entry" | "inputs" | "results">("entry");
  const TRAVEL_INPUT_STEPS = 3;
  const INPUT_STEP_TITLES = ["Trip details", "Time difference", "Conditions"] as const;
  const [travelWizardStep, setTravelWizardStep] = useState(0);
  const [customDurationOpen, setCustomDurationOpen] = useState(false);
  const [isTravelModeActive, setIsTravelModeActive] = useState(false);
  const [isSickDayAlsoActive, setIsSickDayAlsoActive] = useState(false);
  const [sickDaySeverity, setSickDaySeverity] = useState<string | undefined>();
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  
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
  const [basalInjectionTime2, setBasalInjectionTime2] = useState("");
  const { toast } = useToast();
  const [activeTravelTab, setActiveTravelTab] = useState<"overview" | "plan" | "checklist">("overview");

  const [holidayPrep, setHolidayPrep] = useState<HolidayPrep | null>(null);
  const [resultsTab, setResultsTab] = useState<"packing" | "emergency" | "climate">("packing");

  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);
  const showClimateTab =
    plan.weatherChange !== "similar" || plan.timezoneChange !== "none";

  const usesTwoBasalDoses = !isPumpUser && (settings.longActingInjectionsPerDay ?? 0) >= 2;

  const basalSchedules = useMemo(() => {
    if (isPumpUser || plan.timezoneChange === "none") return [];
    const out: { doseLabel: string; rows: BasalAdjustmentRow[] }[] = [];
    const firstLabel = usesTwoBasalDoses ? "First long-acting dose" : "Long-acting insulin";
    if (basalInjectionTime.trim()) {
      out.push({
        doseLabel: firstLabel,
        rows: buildBasalAdjustmentSchedule(basalInjectionTime, plan),
      });
    }
    if (usesTwoBasalDoses && basalInjectionTime2.trim()) {
      out.push({
        doseLabel: "Second long-acting dose",
        rows: buildBasalAdjustmentSchedule(basalInjectionTime2, plan),
      });
    }
    return out.filter((s) => s.rows.length > 0);
  }, [
    isPumpUser,
    plan.timezoneChange,
    plan.timezoneHours,
    plan.timezoneDirection,
    basalInjectionTime,
    basalInjectionTime2,
    usesTwoBasalDoses,
    settings.longActingInjectionsPerDay,
  ]);

  useEffect(() => {
    if (storage.getScenarioState().travelModeActive) {
      recordLastInteraction("scenario:travel");
    }
  }, []);

  const loadNextAppointment = useCallback(() => {
    const uid = user?.id;
    if (!uid) {
      setNextAppointment(null);
      return;
    }
    try {
      const upcoming = storage.getUpcomingAppointmentsForUser(uid);
      setNextAppointment(upcoming[0] ?? null);
    } catch {
      setNextAppointment(null);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNextAppointment();
    void syncAppointments({ throttleMs: 0 }).then(() => loadNextAppointment());

    const onStorage = (e: StorageEvent) => {
      if (isAppointmentsStorageKey(e.key)) loadNextAppointment();
    };
    const onAppointmentsChanged = () => loadNextAppointment();
    const onActiveUser = () => {
      void syncAppointments({ throttleMs: 0 }).then(() => loadNextAppointment());
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncAppointments().then(() => loadNextAppointment());
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, onAppointmentsChanged);
    window.addEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, onActiveUser);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DIABEATER_APPOINTMENTS_CHANGED_EVENT, onAppointmentsChanged);
      window.removeEventListener(DIABEATER_ACTIVE_USER_CHANGED_EVENT, onActiveUser);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadNextAppointment]);

  const [tripExerciseTick, setTripExerciseTick] = useState(0);
  useEffect(() => {
    const onExercise = () => setTripExerciseTick((n) => n + 1);
    window.addEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onExercise);
    return () => window.removeEventListener(DIABEATER_ACTIVE_EXERCISE_CHANGED_EVENT, onExercise);
  }, []);

  /** Live clock for active exercise elapsed / recovery timers on the active-trip dashboard. */
  const [travelExerciseUiClock, setTravelExerciseUiClock] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTravelExerciseUiClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeExerciseForTravel = useMemo(() => {
    void tripExerciseTick;
    void travelExerciseUiClock;
    return storage.getActiveExercise();
  }, [tripExerciseTick, travelExerciseUiClock]);

  useEffect(() => {
    if (!showClimateTab && resultsTab === "climate") setResultsTab("packing");
  }, [showClimateTab, resultsTab]);

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
    if (st.basalInjectionTime2) {
      setBasalInjectionTime2(st.basalInjectionTime2);
    } else {
      setBasalInjectionTime2("");
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
          isPumpDeliveryMethod(p?.insulinDeliveryMethod),
        );
        setRiskWarnings(warnings);
      }
      const prepWhileActive = storage.getHolidayPrep();
      if (prepWhileActive) setHolidayPrep(prepWhileActive);
    } else {
      // Prefill from draft if present, but always land on entry —
      // do not auto-jump into the travel plan wizard/results on open.
      const draft = storage.getTravelWizardDraft();
      if (draft && (draft.step === "inputs" || draft.step === "results")) {
        const nextPlan = withDefaultTripDates(draft.plan as TravelPlan);
        setPlan(nextPlan);
        if (draft.step === "results") {
          const list =
            draft.packingList.length > 0
              ? (draft.packingList as PackingItem[])
              : calculatePackingList(nextPlan as TravelPlan, s, st, isPumpDeliveryMethod(p?.insulinDeliveryMethod));
          setPackingList(list);
          setRiskWarnings(calculateRiskWarnings(nextPlan as TravelPlan, isPumpDeliveryMethod(p?.insulinDeliveryMethod)));
        } else {
          setPackingList([]);
          setRiskWarnings([]);
        }
        if (draft.resultsTab === "packing" || draft.resultsTab === "emergency" || draft.resultsTab === "climate") {
          setResultsTab(draft.resultsTab);
        }
      }

      const savedPrep = storage.getHolidayPrep();
      if (savedPrep) {
        setHolidayPrep(savedPrep);
      } else {
        // Restore trip card from a saved packing plan / draft if prep was never created.
        const fromPlan = (storage.getTravelPlan() || draft?.plan) as TravelPlan | null | undefined;
        if (fromPlan?.destination?.trim() && fromPlan.startDate && fromPlan.endDate) {
          const restored: HolidayPrep = {
            id: crypto.randomUUID(),
            destination: fromPlan.destination.trim(),
            departureDate: fromPlan.startDate,
            returnDate: fromPlan.endDate,
            checklist: [
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
            ],
            createdAt: new Date().toISOString(),
          };
          storage.saveHolidayPrep(restored);
          setHolidayPrep(restored);
        }
      }
    }
  }, []);

  useEffect(() => {
    const onProfile = () => setProfile(storage.getProfile());
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
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

  const seedPlanFromHolidayPrep = (base?: TravelPlan): TravelPlan => {
    const prev = base ?? plan;
    if (!holidayPrep) return prev;
    const duration = tripCalendarDaysBetween(holidayPrep.departureDate, holidayPrep.returnDate);
    return {
      ...prev,
      destination: holidayPrep.destination || prev.destination,
      duration,
      startDate: holidayPrep.departureDate,
      endDate: holidayPrep.returnDate,
    };
  };

  const handleStartPlan = () => {
    const draft = storage.getTravelWizardDraft();

    // Resume an existing packing / results plan instead of restarting the wizard.
    if (draft?.step === "results") {
      const nextPlan = seedPlanFromHolidayPrep(withDefaultTripDates(draft.plan as TravelPlan));
      setPlan(nextPlan);
      const list =
        draft.packingList.length > 0
          ? (draft.packingList as PackingItem[])
          : packingList.length > 0
            ? packingList
            : calculatePackingList(nextPlan, supplies, settings, isPumpUser);
      setPackingList(list);
      setRiskWarnings(calculateRiskWarnings(nextPlan, isPumpUser));
      if (draft.resultsTab === "packing" || draft.resultsTab === "emergency" || draft.resultsTab === "climate") {
        setResultsTab(draft.resultsTab);
      }
      setStep("results");
      return;
    }

    const nextPlan = seedPlanFromHolidayPrep(
      draft?.plan ? withDefaultTripDates(draft.plan as TravelPlan) : undefined,
    );
    setPlan(nextPlan);

    // Dates already saved on the trip card — skip re-entering trip details.
    const datesReady = Boolean(nextPlan.destination?.trim() && nextPlan.startDate && nextPlan.endDate);
    setTravelWizardStep(datesReady ? 1 : 0);
    setStep("inputs");
  };

  const packingPlanReady = packingList.length > 0;

  const inputWizardProgressPct = ((travelWizardStep + 1) / TRAVEL_INPUT_STEPS) * 100;

  const advanceTravelWizard = () => {
    if (travelWizardStep < TRAVEL_INPUT_STEPS - 1) {
      setTravelWizardStep((s) => s + 1);
      return;
    }
    handleGeneratePlan();
  };

  const tripDatesLocked = Boolean(
    (holidayPrep?.destination?.trim() && holidayPrep.departureDate && holidayPrep.returnDate) ||
      (plan.destination?.trim() && plan.startDate && plan.endDate),
  );

  const backTravelWizard = () => {
    // Dates already live on the trip card — don't dump people into a blank Trip details form.
    if (travelWizardStep <= 1 && tripDatesLocked) {
      setStep("entry");
      setTravelWizardStep(0);
      return;
    }
    if (travelWizardStep > 0) {
      setTravelWizardStep((s) => s - 1);
      return;
    }
    setStep("entry");
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

  const handleDeleteHolidayPrep = () => {
    storage.deleteHolidayPrep();
    setHolidayPrep(null);
    toast({ title: "Trip cleared", description: "Removed from your travel guide" });
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

  const handleActivateTravelMode = (planOverride?: TravelPlan) => {
    const activePlan = planOverride ?? plan;
    const signedTimezoneShift = activePlan.timezoneDirection === "west" 
      ? -activePlan.timezoneHours 
      : activePlan.timezoneHours;
    storage.activateTravelMode(
      activePlan.destination,
      activePlan.startDate,
      activePlan.endDate,
      signedTimezoneShift,
      activePlan.timezoneDirection
    );
    storage.saveTravelPlan(activePlan);
    storage.saveTravelPackingList(packingList);
    setIsTravelModeActive(true);
    const startedAt = new Date().toISOString();
    const summary = buildTravelScenarioSummary(activePlan);
    void upsertScenario({
      scenarioKey: "travel",
      title: "Travel",
      label: `Travel mode: ${summary}`,
      state: {
        travel_active: true,
        travel_start: activePlan.startDate || null,
        travel_end: activePlan.endDate || null,
        destination: activePlan.destination || null,
        timezone_hours: activePlan.timezoneHours ?? null,
        timezone_direction: activePlan.timezoneDirection ?? null,
        travel_trip_style: travelTripStyleForCloud(activePlan.tripStyle),
        summary,
        started_at: startedAt,
        ended_at: null,
      },
    });
    toast({
      title: "Travel mode on",
      description: "Turned on for this trip. Check Insulin times for today’s local injection clock.",
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
        travel_trip_style: null,
        ended_at: endedAt,
      },
    });
    toast({
      title: "Travel Mode Deactivated",
      description: "Welcome back home!",
    });
  };

  const handleActiveTripStyleChange = (tripStyle: TravelTripStyle) => {
    const next = { ...plan, tripStyle };
    setPlan(next);
    storage.saveTravelPlan(next);
    if (!isTravelModeActive) return;
    void syncTravelScenarioCloudFromPlan(next);
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
    setResultsTab(
      plan.timezoneChange !== "none" && plan.timezoneHours > 0 ? "climate" : "packing",
    );
    setStep("results");
    storage.saveTravelPlan(plan);

    // Keep countdown / checklist trip aligned with the packing plan.
    if (plan.startDate && plan.endDate && plan.destination.trim()) {
      const existing = storage.getHolidayPrep();
      const synced: HolidayPrep = {
        id: existing?.id || crypto.randomUUID(),
        destination: plan.destination.trim(),
        departureDate: plan.startDate,
        returnDate: plan.endDate,
        notes: existing?.notes,
        checklist: existing?.checklist?.length ? existing.checklist : defaultChecklist,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      storage.saveHolidayPrep(synced);
      setHolidayPrep(synced);
    }

    storage.addActivityLog({
      activityType: "travel_plan",
      activityDetails: `${plan.duration} days to ${plan.destination} (${plan.travelType})`,
      recommendation: `Generated packing list with ${list.length} items`,
    });

    const summary = buildTravelScenarioSummary(plan);
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
        travel_trip_style: travelTripStyleForCloud(plan.tripStyle),
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

  if (step === "entry" && isTravelModeActive) {
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

    const todayScheduleEntries = (() => {
      if (plan.timezoneChange === "none" || !basalSchedules.length) return [];
      const dayInTrip = daysElapsed;
      return basalSchedules
        .map(({ doseLabel, rows }) => {
          const entry = pickBasalRowForDay(rows, dayInTrip);
          return entry ? { doseLabel, ...entry } : null;
        })
        .filter((x): x is BasalAdjustmentRow & { doseLabel: string } => x != null);
    })();

    const dayNumber = hasStarted ? daysElapsed + 1 : 0;
    const activeProgressInput = {
      plan,
      dayNumber,
      totalDays,
      hasStarted,
      hasEnded,
      daysUntilStart,
      daysRemaining,
      isPumpUser,
    };
    const todayFocus = buildActiveTravelTodayFocus(activeProgressInput);
    const tripProfileChips = buildActiveTravelTripProfileChips(plan);
    const activeCoachPrompt = buildActiveTravelCoachPrompt(activeProgressInput);

    void tripExerciseTick;
    const tripExerciseSessionCount = countExerciseOutcomesInTripWindow(plan.startDate, plan.endDate);
    const firstExerciseRoutine = storage.getRecentExercises(1)[0];
    const travelExercisePlannerHref = firstExerciseRoutine
      ? buildExerciseScenarioPlannerHref({
          exerciseType: firstExerciseRoutine.exerciseType,
          durationMinutes: firstExerciseRoutine.durationMinutes,
          intensity: firstExerciseRoutine.intensity,
          routineId: firstExerciseRoutine.id,
          from: "travel",
        })
      : "/scenarios/exercise";

    const liveTripExercise = activeExerciseForTravel;
    const travelExerciseElapsedLabel =
      liveTripExercise?.phase === "active" && liveTripExercise.exerciseStartedAt
        ? formatExerciseElapsedShort(getWorkoutElapsedMs(liveTripExercise, travelExerciseUiClock))
        : liveTripExercise?.phase === "recovery" && liveTripExercise.exerciseEndedAt
          ? formatExerciseElapsedShort(
              travelExerciseUiClock - new Date(liveTripExercise.exerciseEndedAt).getTime(),
            )
          : null;

    return (
      <PageShell variant="narrow" density="compact" className="space-y-3">
        <header className="flex min-w-0 items-start gap-2" data-testid="travel-active-header">
          <div className="shrink-0 pt-0.5">
            <PageBackButton />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <h1
                className="min-w-0 truncate font-display text-xl font-semibold tracking-tight text-foreground"
                data-testid="text-travel-dashboard-title"
              >
                {plan.destination || "Travel"}
              </h1>
            </div>
            {tripProfileChips.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="travel-trip-profile-chips">
                {tripProfileChips.map((chip) => (
                  <span key={chip.label} className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground ring-1 ring-border/50">
                    {chip.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        <div className="overflow-hidden rounded-[1.35rem] border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.10] via-card to-card shadow-[0_12px_40px_-24px_rgba(14,165,233,0.45)]">
          <div className="space-y-3 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {hasEnded ? "Trip" : hasStarted ? "Day" : "Starts in"}
              </p>
              <p
                className="mt-1 font-display text-[2.5rem] font-bold leading-none tabular-nums tracking-tight text-foreground"
                data-testid="text-trip-progress"
              >
                {hasEnded
                  ? "Ended"
                  : hasStarted
                    ? daysElapsed + 1
                    : daysUntilStart <= 0
                      ? "Today"
                      : daysUntilStart}
                {hasStarted && !hasEnded ? (
                  <span className="text-xl font-semibold text-muted-foreground">/{totalDays}</span>
                ) : !hasStarted && !hasEnded && daysUntilStart > 0 ? (
                  <span className="ml-1 text-xl font-semibold text-muted-foreground">d</span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-xl bg-background/80 px-3 py-1.5 text-sm font-medium ring-1 ring-border/50">
                {formatTripDate(plan.startDate, profile, { day: "numeric", month: "short" }) || "Start"} –{" "}
                {formatTripDate(plan.endDate, profile, { day: "numeric", month: "short" }) || "End"}
              </span>
              <span className="inline-flex items-center rounded-xl bg-background/50 px-3 py-1.5 text-sm font-medium capitalize ring-1 ring-border/40">
                {plan.travelType}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" data-testid="progress-trip" />
            <p className="text-sm leading-snug text-foreground/85" data-testid="travel-progress-guidance">
              {todayFocus}
            </p>
            <ScenarioCoachLink
              topic="travel"
              from="travel-active"
              q={activeCoachPrompt}
              className="min-h-10 w-full"
            />
          </div>
        </div>

        {plan.timezoneChange !== "none" && plan.timezoneHours > 0 ? (
          <TravelInsulinClockCard
            hours={plan.timezoneHours}
            direction={plan.timezoneDirection}
            isPumpUser={isPumpUser}
            todayEntries={todayScheduleEntries}
            schedules={basalSchedules}
            hasStarted={hasStarted && !hasEnded}
          />
        ) : null}

        {plan.tripStyle === "active" && hasStarted && !hasEnded ? (
          <Card
            className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none"
            data-testid="card-travel-active-exercise"
          >
            <CardContent className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Activity</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground" data-testid="text-trip-exercise-count">
                    {tripExerciseSessionCount}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">
                      {tripExerciseSessionCount === 1 ? "session" : "sessions"}
                    </span>
                  </p>
                </div>

                {liveTripExercise ? (
                  <div
                    className="space-y-2 rounded-xl border border-emerald-500/30 bg-background/70 px-3 py-2.5 dark:border-emerald-800/45 dark:bg-background/40"
                    data-testid="travel-active-exercise-session"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{liveTripExercise.exerciseName}</p>
                        <p className="text-sm text-muted-foreground leading-snug">
                          {liveTripExercise.durationMinutes} min · {liveTripExercise.intensity}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground/90">
                        {liveTripExercise.phase === "pre"
                          ? "Before you start"
                          : liveTripExercise.phase === "active"
                            ? "During"
                            : "Recovery"}
                      </p>
                      {travelExerciseElapsedLabel ? (
                        <span
                          className="text-sm font-semibold tabular-nums text-foreground"
                          data-testid="text-travel-exercise-elapsed"
                          title={
                            liveTripExercise.phase === "active"
                              ? "Workout elapsed"
                              : "Time since workout ended"
                          }
                        >
                          {travelExerciseElapsedLabel}
                        </span>
                      ) : null}
                    </div>
                    {liveTripExercise.phase === "active" && liveTripExercise.exerciseStartedAt ? (
                      <ExerciseWorkoutProgressBar
                        phase="active"
                        exerciseStartedAt={liveTripExercise.exerciseStartedAt}
                        durationMinutes={liveTripExercise.durationMinutes}
                        nowMs={travelExerciseUiClock}
                        pausedAt={liveTripExercise.pausedAt}
                        totalPausedMs={liveTripExercise.totalPausedMs}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <Button
                asChild
                size="sm"
                className="h-10 shrink-0 w-full rounded-xl sm:mt-0.5 sm:w-auto"
                data-testid="button-travel-log-activity"
              >
                <Link href={liveTripExercise ? "/scenarios/exercise" : travelExercisePlannerHref}>
                  <Dumbbell className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                  {liveTripExercise ? "Continue" : "Log activity"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Tabs value={activeTravelTab} onValueChange={(v) => setActiveTravelTab(v as any)} className="w-full" data-testid="travel-active-tabs">
          <TabsList className="grid h-11 w-full grid-cols-2 gap-1 rounded-xl bg-muted/45 p-1">
            <TabsTrigger value="overview" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-travel-overview">Trip</TabsTrigger>
            <TabsTrigger value="checklist" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-travel-checklist">Packing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-3 animate-fade-in-up" data-testid="tabcontent-travel-overview">
            <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none" data-testid="card-travel-overview-glance">
              <CardContent className="space-y-3 p-3.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">Return</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {formatTripDate(plan.endDate, profile, { day: "numeric", month: "short" }) || "—"}
                    </span>
                  </div>
                  <div className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">Timezone</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {plan.timezoneChange === "none"
                        ? "None"
                        : `${plan.timezoneHours}h ${plan.timezoneDirection === "east" ? "E" : plan.timezoneDirection === "west" ? "W" : ""}`}
                    </span>
                  </div>
                  <div className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">Pharmacies</span>
                    <span className="shrink-0 text-sm font-bold capitalize">
                      {plan.accessRisk === "easy" ? "Easy" : plan.accessRisk === "limited" ? "Limited" : "Unsure"}
                    </span>
                  </div>
                  <div className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">Packed</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums" data-testid="text-overview-packing-progress">
                      {checkedCount}/{packingList.length}
                    </span>
                  </div>
                </div>
                {(!plan.tripStyle || plan.tripStyle === "not_sure") && (
                  <div className="space-y-2 border-t border-border/60 pt-3" data-testid="overview-trip-style-nudge">
                    <p className="text-sm font-medium text-foreground">Trip style</p>
                    <TravelSegmentGroup
                      value={plan.tripStyle ?? "not_sure"}
                      onChange={handleActiveTripStyleChange}
                      options={TRIP_STYLE_OPTIONS}
                      testId="select-overview-trip-style"
                      columns={2}
                      variant="tiles"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 min-h-9 rounded-xl"
                    onClick={() => setActiveTravelTab("checklist")}
                    data-testid="button-overview-open-checklist"
                  >
                    <Package className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                    Packing
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-10 min-h-9 rounded-xl" data-testid="button-overview-emergency">
                    <Link href="/emergency-card">
                      <Globe className="h-3.5 w-3.5 mr-1.5 text-red-600 dark:text-red-400" aria-hidden />
                      Emergency card
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-10 min-h-9 rounded-xl" data-testid="button-overview-supplies">
                    <Link href="/supplies">
                      <Package className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                      Supplies
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <CompactRiskConsiderations warnings={riskWarnings} />

            {isSickDayAlsoActive && (
              <Card className="overflow-hidden rounded-[1.35rem] border-amber-500/25 bg-amber-500/[0.06] shadow-none dark:bg-amber-950/30" data-testid="card-sick-day-also-active">
                <CardContent className="flex items-center gap-3 p-3.5">
                  <Thermometer className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <p className="min-w-0 flex-1 text-sm font-medium">
                    Sick day also on{sickDaySeverity ? ` · ${sickDaySeverity}` : ""}
                  </p>
                  <Link href="/scenarios/sick-day">
                    <Button variant="outline" size="sm" className="h-9 rounded-lg" data-testid="button-view-sick-day-from-travel">
                      Sick day
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="checklist" className="mt-4 space-y-3 animate-fade-in-up" data-testid="tabcontent-travel-checklist">
            <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold">Packing checklist</CardTitle>
                  <Badge variant={checkedCount === packingList.length ? "default" : "secondary"} data-testid="badge-packing-progress">
                    {checkedCount}/{packingList.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
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

        <TravelDisclaimerCard compact />

      </PageShell>
    );
  }

  if (step === "entry") {
    const daysUntil = holidayPrep ? getPrepDaysUntilDeparture() : null;
    const tripDays = holidayPrep ? getPrepTripDays() : 0;
    const coverage = holidayPrep ? storage.getHolidaySupplyCoverage() : [];
    const shortfallCount = coverage.filter((c) => c.shortfall > 0).length;
    const isDepartureNear = daysUntil !== null && daysUntil <= 3 && daysUntil >= 0;
    const hasDeparted = daysUntil !== null && daysUntil < 0;
    const primaryTripAction = !holidayPrep
      ? null
      : isDepartureNear || hasDeparted
        ? {
            label: "Start travel",
            testId: "button-activate-from-prep" as const,
            onClick: () => {
              const next = seedPlanFromHolidayPrep();
              setPlan(next);
              handleActivateTravelMode(next);
            },
          }
        : packingPlanReady
          ? {
              label: "Open trip plan",
              testId: "button-start-plan-from-prep" as const,
              onClick: () => handleStartPlan(),
            }
          : {
              label: "Continue trip plan",
              testId: "button-start-plan-from-prep" as const,
              onClick: () => handleStartPlan(),
            };

    return (
      <PageShell variant="narrow" density="compact" className="space-y-4 overflow-x-hidden pb-6">
        <PageHeader
          leading={<PageBackButton />}
          title="Travel"
          actions={
            <div data-testid="link-travel-entry-coach-wrap">
              <ScenarioCoachLink topic="travel" />
            </div>
          }
        />

        {!holidayPrep ? (
          <section
            className="overflow-hidden rounded-[1.75rem] border border-sky-500/20 bg-gradient-to-b from-sky-500/[0.12] via-card to-card px-5 pb-5 pt-6 shadow-[0_18px_40px_-28px_rgba(14,165,233,0.55)]"
            data-testid="travel-empty-hero"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/25 to-cyan-500/10 text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-200">
              <Plane className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="mt-4 text-center font-display text-2xl font-semibold tracking-tight text-foreground">
              Plan your trip
            </h2>
            <p className="mx-auto mt-2 max-w-[18rem] text-center text-sm leading-relaxed text-muted-foreground">
              Local insulin times across time zones, plus packing for the days you&apos;re away.
            </p>
            <Button
              type="button"
              className="mt-5 h-12 w-full rounded-2xl text-[15px] font-semibold"
              onClick={handleStartPlan}
              data-testid="button-start-travel-plan"
            >
              Plan a trip
              <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Button>
          </section>
        ) : (
          <Card
            className="overflow-hidden rounded-[1.75rem] border-sky-500/20 bg-gradient-to-b from-sky-500/[0.10] via-card to-card shadow-[0_18px_40px_-28px_rgba(14,165,233,0.45)]"
            data-testid="card-travel-entry-hub"
          >
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3" data-testid="holiday-prep-active">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700/80 dark:text-sky-300/90">
                    Your trip
                  </p>
                  <h2 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-foreground">
                    {holidayPrep.destination}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatTripDate(holidayPrep.departureDate, profile, { day: "numeric", month: "short" }) ||
                      "Departure"}
                    {" – "}
                    {formatTripDate(holidayPrep.returnDate, profile, {
                      day: "numeric",
                      month: "short",
                    }) || "Return"}
                    {tripDays > 0 ? ` · ${tripDays}d` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full text-muted-foreground"
                  onClick={handleDeleteHolidayPrep}
                  aria-label="Delete trip"
                  data-testid="button-delete-holiday-prep"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {daysUntil !== null && daysUntil >= 0 ? (
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-center",
                    daysUntil <= 3
                      ? "border-orange-500/25 bg-orange-500/[0.08]"
                      : daysUntil <= 7
                        ? "border-amber-500/25 bg-amber-500/[0.08]"
                        : "border-border/50 bg-background/70",
                  )}
                  data-testid="text-prep-countdown"
                >
                  <p className="font-display text-[2.75rem] font-bold leading-none tabular-nums tracking-tight text-foreground">
                    {daysUntil}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {daysUntil === 0 ? "Departing today" : daysUntil === 1 ? "day to go" : "days to go"}
                  </p>
                </div>
              ) : null}

              {hasDeparted && !isTravelModeActive ? (
                <p className="text-center text-sm text-muted-foreground">Departure date has passed — start travel for local insulin times.</p>
              ) : null}

              {coverage.length > 0 ? (
                <Link
                  href="/supplies"
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors",
                    shortfallCount > 0
                      ? "border-red-500/25 bg-red-500/[0.06] hover:bg-red-500/[0.09]"
                      : "border-border/50 bg-background/60 hover:bg-background",
                  )}
                  data-testid="link-travel-supply-summary"
                >
                  <Package
                    className={cn(
                      "h-4 w-4 shrink-0",
                      shortfallCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                    {shortfallCount > 0
                      ? `${shortfallCount} supply item${shortfallCount === 1 ? "" : "s"} short for this trip`
                      : "Supplies look covered for this trip"}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ) : null}

              {primaryTripAction && !isTravelModeActive ? (
                <Button
                  className="h-12 w-full rounded-2xl text-[15px] font-semibold"
                  onClick={primaryTripAction.onClick}
                  data-testid={primaryTripAction.testId}
                >
                  {primaryTripAction.label}
                  <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}

        <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/80" aria-label="Travel shortcuts">
          <Link
            href="/appointments"
            className="flex min-h-12 items-center gap-3 border-b border-border/40 px-4 py-3.5 transition-colors hover:bg-muted/30"
            data-testid="link-pretravel-appointments"
          >
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">Appointments</span>
              {nextAppointment ? (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground" data-testid="link-pretravel-next-appointment">
                  {nextAppointment.title?.trim() || "Appointment"} · {formatNextAppointmentWhen(nextAppointment)}
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-muted-foreground">Letters and clinic visits</span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <Link
            href="/emergency-card"
            className="flex min-h-12 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30"
            data-testid="button-emergency-card"
          >
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">Emergency card</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Show if you need help abroad</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </section>

        <TravelDisclaimerCard compact />
      </PageShell>
    );
  }

  if (step === "inputs") {
    const matchedDurationPreset = TRAVEL_DURATION_PRESETS.find((preset) => preset.days === plan.duration);
    return (
      <>
      <PageShell variant="narrow" density="compact" className="space-y-3 overflow-x-hidden pb-28">
        <PageHeader
          leading={
            <Button type="button" variant="ghost" size="icon" className="mr-2" aria-label="Go back" onClick={backTravelWizard}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          }
          title="Travel plan"
          actions={<ScenarioCoachLink topic="travel" from="travel-setup" />}
        />

        {(holidayPrep || plan.destination.trim()) && (
          <div
            className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2"
            data-testid="travel-wizard-trip-summary"
          >
            <p className="truncate text-[13px] font-semibold text-foreground">
              {holidayPrep?.destination || plan.destination}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {(formatTripDate(holidayPrep?.departureDate || plan.startDate, profile, {
                day: "numeric",
                month: "short",
              }) || "Start") +
                " – " +
                (formatTripDate(holidayPrep?.returnDate || plan.endDate, profile, {
                  day: "numeric",
                  month: "short",
                }) || "End")}
            </p>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Step {tripDatesLocked ? travelWizardStep : travelWizardStep + 1} of{" "}
              {tripDatesLocked ? TRAVEL_INPUT_STEPS - 1 : TRAVEL_INPUT_STEPS}
            </span>
            <span>{INPUT_STEP_TITLES[travelWizardStep]}</span>
          </div>
          <Progress
            value={
              tripDatesLocked
                ? (travelWizardStep / (TRAVEL_INPUT_STEPS - 1)) * 100
                : inputWizardProgressPct
            }
            className="h-1.5"
            data-testid="travel-input-progress"
          />
        </div>

        <Card className="overflow-hidden rounded-2xl border-sky-500/20 bg-gradient-to-b from-sky-500/[0.07] via-card to-card shadow-none dark:border-sky-400/15 dark:from-sky-950/40">
          <CardHeader className="space-y-0 px-3.5 pb-2.5 pt-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/10 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-200">
                <Plane className="h-4 w-4" aria-hidden />
              </span>
              <CardTitle className="font-display text-base font-semibold tracking-tight">{INPUT_STEP_TITLES[travelWizardStep]}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 border-t border-sky-500/10 px-3.5 pb-4 pt-4">
            {travelWizardStep === 0 ? (
              <>
            <div className="space-y-1.5">
              <Label htmlFor="destination" className="text-xs font-medium text-muted-foreground">Destination</Label>
              <Input
                id="destination"
                placeholder="City, country"
                value={plan.destination}
                onChange={(e) => setPlan(prev => ({ ...prev, destination: e.target.value }))}
                className="h-11 rounded-xl text-base"
                data-testid="input-destination"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label id="duration-preset" className="text-xs font-medium text-muted-foreground">Duration</Label>
                <span className="text-sm font-semibold tabular-nums text-foreground">{plan.duration}d</span>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2" role="group" aria-labelledby="duration-preset" data-testid="select-duration">
                {TRAVEL_DURATION_PRESETS.map((preset) => (
                  <Button
                    key={preset.days}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={travelTileClass(!customDurationOpen && plan.duration === preset.days)}
                    onClick={() => {
                      setCustomDurationOpen(false);
                      updateDuration(preset.days);
                    }}
                    data-testid={`option-duration-${preset.days}`}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={travelTileClass(customDurationOpen || !matchedDurationPreset)}
                  onClick={() => setCustomDurationOpen(true)}
                  data-testid="option-duration-custom"
                >
                  Custom
                </Button>
              </div>

              {(customDurationOpen || !matchedDurationPreset) && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 shrink-0 rounded-xl"
                    onClick={() => updateDuration(Math.max(1, plan.duration - 1))}
                    aria-label="Decrease duration"
                    data-testid="button-duration-minus"
                  >
                    -
                  </Button>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={365}
                    inputMode="numeric"
                    value={plan.duration}
                    onChange={(e) => updateDuration(parseInt(e.target.value) || 1)}
                    className="h-12 w-24 rounded-xl text-center text-xl font-semibold tabular-nums"
                    data-testid="input-duration"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 shrink-0 rounded-xl"
                    onClick={() => updateDuration(Math.min(365, plan.duration + 1))}
                    aria-label="Increase duration"
                    data-testid="button-duration-plus"
                  >
                    +
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="start-date" className="text-xs font-medium text-muted-foreground">Start</Label>
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
                  className={travelDateInputClass}
                  data-testid="input-start-date"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="end-date" className="text-xs font-medium text-muted-foreground">End</Label>
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
                  className={travelDateInputClass}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label id="travel-type-label" className="text-xs font-medium text-muted-foreground">Travel type</Label>
              <TravelSegmentGroup
                labelledBy="travel-type-label"
                value={plan.travelType}
                onChange={(value) => setPlan((prev) => ({ ...prev, travelType: value }))}
                options={[
                  { value: "domestic", label: "Domestic" },
                  { value: "international", label: "International" },
                ]}
                testId="select-travel-type"
                columns={2}
              />
            </div>
              </>
            ) : null}

            {travelWizardStep === 1 ? (
              <>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Time difference</Label>
              <p className="text-sm leading-snug text-muted-foreground">
                How many hours ahead or behind is your destination? Example: UK to Thailand is about 7h east.
              </p>
              <div className="space-y-3 rounded-xl border border-border/50 bg-background/50 p-3">
                <div className="flex items-center justify-center gap-3" data-testid="select-timezone-hours">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl"
                    onClick={() =>
                      setPlan((prev) => {
                        const hours = Math.max(0, prev.timezoneHours - 1);
                        return {
                          ...prev,
                          timezoneHours: hours,
                          timezoneChange: timezoneChangeFromHours(hours),
                          timezoneDirection:
                            hours === 0 ? "none" : prev.timezoneDirection === "none" ? "east" : prev.timezoneDirection,
                        };
                      })
                    }
                    aria-label="Decrease hours"
                  >
                    -
                  </Button>
                  <span className="min-w-[3.5rem] text-center font-display text-2xl font-bold tabular-nums">
                    {plan.timezoneHours}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl"
                    onClick={() =>
                      setPlan((prev) => {
                        const hours = Math.min(12, prev.timezoneHours + 1);
                        return {
                          ...prev,
                          timezoneHours: hours,
                          timezoneChange: timezoneChangeFromHours(hours),
                          timezoneDirection:
                            hours === 0 ? "none" : prev.timezoneDirection === "none" ? "east" : prev.timezoneDirection,
                        };
                      })
                    }
                    aria-label="Increase hours"
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground">h</span>
                </div>
                {plan.timezoneHours > 0 ? (
                  <TravelSegmentGroup
                    labelledBy="timezone-direction-label"
                    value={plan.timezoneDirection === "none" ? "east" : plan.timezoneDirection}
                    onChange={(value) => setPlan((prev) => ({ ...prev, timezoneDirection: value }))}
                    options={[
                      { value: "east", label: "East (ahead)" },
                      { value: "west", label: "West (behind)" },
                    ]}
                    testId="select-timezone-direction"
                    columns={2}
                  />
                ) : (
                  <p className="text-center text-sm text-muted-foreground">0h = same time zone</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label id="trip-style-label" className="text-xs font-medium text-muted-foreground">Trip style</Label>
              <TravelSegmentGroup
                labelledBy="trip-style-label"
                value={plan.tripStyle ?? "not_sure"}
                onChange={(value) => {
                  setPlan((prev) => {
                    const updated = { ...prev, tripStyle: value };
                    if (isTravelModeActive) {
                      storage.saveTravelPlan(updated);
                      void syncTravelScenarioCloudFromPlan(updated);
                    }
                    return updated;
                  });
                }}
                options={TRIP_STYLE_OPTIONS}
                testId="select-trip-style"
                columns={2}
                variant="tiles"
              />
            </div>
              </>
            ) : null}

            {travelWizardStep === 2 ? (
              <>
            <div className="space-y-2">
              <Label id="access-risk-label" className="text-xs font-medium text-muted-foreground">Pharmacy access</Label>
              <TravelSegmentGroup
                labelledBy="access-risk-label"
                value={plan.accessRisk}
                onChange={(value) => setPlan((prev) => ({ ...prev, accessRisk: value }))}
                options={[
                  { value: "easy", label: "Easy" },
                  { value: "limited", label: "Limited" },
                  { value: "unsure", label: "Unsure" },
                ]}
                testId="select-access-risk"
                columns={3}
              />
              <PharmacyCard variant="default" />
            </div>

            <div className="space-y-2">
              <Label id="weather-change-label" className="text-xs font-medium text-muted-foreground">Weather</Label>
              <TravelSegmentGroup
                labelledBy="weather-change-label"
                value={plan.weatherChange}
                onChange={(value) => setPlan((prev) => ({ ...prev, weatherChange: value }))}
                options={[
                  { value: "similar", label: "Similar" },
                  { value: "warmer", label: "Warmer" },
                  { value: "colder", label: "Colder" },
                  { value: "unknown", label: "Unsure" },
                ]}
                testId="select-weather-change"
                columns={2}
                variant="tiles"
              />
            </div>

            {(plan.weatherChange === "warmer" || plan.weatherChange === "colder") && (
              <div className="space-y-2 rounded-xl border border-border/50 bg-background/50 p-3">
                <Label id="weather-severity-label" className="text-xs font-medium text-muted-foreground">How much?</Label>
                <TravelSegmentGroup
                  labelledBy="weather-severity-label"
                  value={plan.weatherSeverity}
                  onChange={(value) => setPlan((prev) => ({ ...prev, weatherSeverity: value }))}
                  options={[
                    { value: "slight", label: "Slight" },
                    { value: "moderate", label: "Moderate" },
                    { value: "extreme", label: "Extreme" },
                  ]}
                  testId="select-weather-severity"
                  columns={3}
                />
              </div>
            )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </PageShell>
      <div
        className="fixed bottom-[var(--bottom-nav-height,0px)] left-0 right-0 z-40 border-t border-border/80 bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/85 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        <Button
          type="button"
          className="mx-auto flex h-12 w-full max-w-lg rounded-xl text-base font-semibold"
          onClick={advanceTravelWizard}
          data-testid={travelWizardStep === TRAVEL_INPUT_STEPS - 1 ? "button-generate-plan" : "button-travel-wizard-next"}
        >
          {travelWizardStep === TRAVEL_INPUT_STEPS - 1 ? "Generate plan" : "Next"}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
      </>
    );
  }

  const groupedItems = packingList.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PackingItem[]>);

  const checkedCount = packingList.filter(i => i.checked).length;

  const packingPct = packingList.length > 0 ? Math.round((checkedCount / packingList.length) * 100) : 0;

  return (
    <PageShell variant="narrow" density="compact" className="space-y-3 overflow-x-hidden pb-6">
      <PageHeader
        leading={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-2 h-9 w-9 shrink-0"
            aria-label="Back to your trip"
            onClick={() => setStep("entry")}
            data-testid="button-travel-results-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        }
        title={plan.destination || "Trip"}
        actions={<ScenarioCoachLink topic="travel" from="travel-results" />}
      />

      <div className="overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.10] via-card to-card shadow-[0_12px_40px_-24px_rgba(14,165,233,0.45)]">
        <div className="px-3.5 pb-3.5 pt-3.5 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Packed</p>
          <p className="mt-1 font-display text-[2.25rem] font-bold leading-none tabular-nums tracking-tight text-foreground">
            {checkedCount}
            <span className="text-lg font-semibold text-muted-foreground">/{packingList.length}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/40 pt-3">
            <span className="inline-flex items-center rounded-lg bg-background/80 px-2.5 py-1 text-xs font-semibold tabular-nums ring-1 ring-border/50">
              {plan.duration}d
            </span>
            <span className="inline-flex items-center rounded-lg bg-background/50 px-2.5 py-1 text-xs font-medium ring-1 ring-border/40">
              {formatTripDate(plan.startDate, profile, { day: "numeric", month: "short" }) || "Start"} –{" "}
              {formatTripDate(plan.endDate, profile, { day: "numeric", month: "short" }) || "End"}
            </span>
            <span className="inline-flex items-center rounded-lg bg-background/50 px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-border/40">
              {plan.travelType} · {packingPct}%
            </span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-[1.35rem] border px-4 py-3.5",
          isTravelModeActive ? "border-sky-500/30 bg-sky-500/[0.08]" : "border-border/50 bg-card/70",
        )}
        data-testid="strip-travel-mode-status"
      >
        {isTravelModeActive ? (
          <>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Travel mode on</p>
              <p className="text-xs text-muted-foreground">Insulin times use destination local time.</p>
            </div>
            <Button size="sm" variant="outline" className="h-10 shrink-0 rounded-xl" onClick={handleDeactivateTravelMode} data-testid="button-deactivate-travel">
              End
            </Button>
          </>
        ) : (
          <>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Start when you leave</p>
              <p className="text-xs leading-snug text-muted-foreground">
                Turn on at the airport or when you board — not weeks before. Then open Insulin for today’s local injection time.
              </p>
            </div>
            <Button size="sm" className="h-10 shrink-0 rounded-xl" onClick={handleActivateTravelMode} data-testid="button-activate-travel">
              Start
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
        <TabsList className={cn("grid h-11 w-full gap-1 rounded-xl bg-muted/45 p-1", showClimateTab ? "grid-cols-3" : "grid-cols-2")}>
          <TabsTrigger value="packing" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-results-packing">
            Packing
          </TabsTrigger>
          <TabsTrigger value="emergency" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-results-emergency">
            Emergency
          </TabsTrigger>
          {showClimateTab && (
            <TabsTrigger value="climate" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-results-climate">
              Insulin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="packing" className="mt-4 space-y-4">
          <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none" data-testid="card-smart-packing-list">
            <CardHeader className="px-4 pb-2 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold">Packing list</CardTitle>
                <span className="text-sm font-semibold tabular-nums">
                  {checkedCount}/{packingList.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4 pt-0">
              {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((category) => {
                const items = groupedItems[category];
                if (!items || items.length === 0) return null;
                const { label, icon: Icon, color } = categoryLabels[category];
                return (
                  <div key={category} className="space-y-1.5">
                    <h3 className={cn("flex items-center gap-1.5 text-sm font-semibold", color)}>
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
                            onToggle={() => toggleItem(globalIndex)}
                            dataTestIdPrefix="packing-item"
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="space-y-2 border-t border-border/50 pt-2">
                <MedicalSourcesLink anchor="insulin" className="flex justify-center" compact />
              </div>
            </CardContent>
          </Card>

          <CompactRiskConsiderations warnings={riskWarnings} />
        </TabsContent>

        <TabsContent value="emergency" className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/emergency-card">
              <Button className="w-full rounded-xl" variant="secondary" data-testid="button-travel-tab-emergency-card">
                Emergency card
              </Button>
            </Link>
            <Link href="/help-now">
              <Button className="w-full rounded-xl" variant="outline" data-testid="button-travel-tab-help-now">
                Help now
              </Button>
            </Link>
          </div>

          <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-base font-semibold">If something goes wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 pt-0">
              {[
                { n: "1", title: "Hypo first", body: "Treat lows, then reassess." },
                { n: "2", title: "Lost supplies", body: "Pharmacy, then urgent care with your letter." },
                { n: "3", title: "Prevent crisis", body: "Carry-on only; know your team and local emergency number." },
              ].map((row) => (
                <div key={row.n} className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/70 px-3.5 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-sm font-bold tabular-nums">
                    {row.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{row.title}</p>
                    <p className="mt-0.5 text-sm leading-snug text-foreground/85">{row.body}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Accordion type="multiple" className="w-full rounded-2xl border border-border/60 bg-card/40 px-1">
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
        <TabsContent value="climate" className="mt-4 space-y-3" data-testid="panel-travel-climate">
          {plan.timezoneChange !== "none" && plan.timezoneHours > 0 ? (
            <TravelInsulinClockCard
              hours={plan.timezoneHours}
              direction={plan.timezoneDirection}
              isPumpUser={isPumpUser}
              todayEntries={basalSchedules
                .map(({ doseLabel, rows }) => {
                  const entry = pickBasalRowForDay(rows, 0);
                  return entry ? { doseLabel, ...entry } : null;
                })
                .filter((x): x is BasalAdjustmentRow & { doseLabel: string } => x != null)}
              schedules={basalSchedules}
              hasStarted={false}
            />
          ) : null}
          {/* Most-needed info first: when to take long-acting insulin, no scrolling required. */}
          {!isPumpUser && plan.timezoneChange !== "none" && (() => {
            const tz = climateTimezoneGuidance(plan);
            return (
              <Card className="overflow-hidden rounded-[1.35rem] border-sky-500/25 shadow-none" data-testid="card-climate-basal-timing">
                <CardHeader className="px-4 pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      Long-acting insulin timing
                    </CardTitle>
                    <InlineInfoHint
                      ariaLabel="Why shift long-acting insulin gradually"
                      content={
                        <div className="space-y-2">
                          <p className="font-medium text-foreground">{tz.title}</p>
                          <ul className="space-y-1.5">
                            {tz.bullets.map((line) => (
                              <li key={line} className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" aria-hidden />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                          {tz.callout ? <p className="text-muted-foreground">{tz.callout}</p> : null}
                        </div>
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 pt-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor="basal-time" className="text-sm">
                        {usesTwoBasalDoses ? "First long-acting (home time)" : "Long-acting time (home)"}
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
                        className="h-11 w-32 rounded-xl"
                        data-testid="input-basal-time"
                      />
                    </div>
                    {usesTwoBasalDoses ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="basal-time-2" className="text-sm">
                          Second long-acting (home time)
                        </Label>
                        <Input
                          id="basal-time-2"
                          type="time"
                          value={basalInjectionTime2}
                          onChange={(e) => {
                            setBasalInjectionTime2(e.target.value);
                            const current = storage.getSettings();
                            storage.saveSettings({ ...current, basalInjectionTime2: e.target.value });
                          }}
                          className="h-11 w-32 rounded-xl"
                          data-testid="input-basal-time-2"
                        />
                      </div>
                    ) : null}
                  </div>

                  {basalSchedules.some((s) => s.rows.length > 0) && (
                    <div className="space-y-4">
                      {basalSchedules.map(({ doseLabel, rows }) =>
                        rows.length === 0 ? null : (
                          <div key={doseLabel} className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">{doseLabel}</p>
                            <div className="overflow-x-auto rounded-xl border border-border/60">
                              <table className="w-full min-w-[260px] text-sm">
                                <thead>
                                  <tr className="bg-muted/40 text-left text-sm text-muted-foreground">
                                    <th className="px-3 py-2 font-medium">Day</th>
                                    <th className="px-3 py-2 font-medium">Home</th>
                                    <th className="px-3 py-2 font-medium">Local</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row, idx) => (
                                    <tr
                                      key={`${doseLabel}-${idx}`}
                                      className={idx % 2 === 0 ? "bg-muted/15" : undefined}
                                    >
                                      <td className="px-3 py-2 font-medium">{row.label}</td>
                                      <td className="px-3 py-2 font-mono text-sm tabular-nums">{row.homeTime}</td>
                                      <td className="px-3 py-2 font-mono text-sm tabular-nums">{row.localTime}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {(() => {
            const weather = climateWeatherGuidance(plan, isPumpUser);
            if (!weather) return null;
            const visibleBullets = weather.bullets.slice(0, 2);
            const moreBullets = weather.bullets.slice(2);
            return (
              <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none">
                <CardHeader className="px-4 pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {plan.weatherChange === "warmer" ? (
                        <Sun className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" aria-hidden />
                      ) : plan.weatherChange === "colder" ? (
                        <Snowflake className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" aria-hidden />
                      ) : (
                        <Thermometer className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      {weather.title}
                    </CardTitle>
                    {(moreBullets.length > 0 || weather.callout) && (
                      <InlineInfoHint
                        ariaLabel="More weather guidance"
                        content={
                          <div className="space-y-2">
                            {moreBullets.length > 0 && (
                              <ul className="space-y-1.5">
                                {moreBullets.map((line) => (
                                  <li key={line} className="flex gap-2">
                                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" aria-hidden />
                                    <span>{line}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {weather.callout ? <p className="text-muted-foreground">{weather.callout}</p> : null}
                          </div>
                        }
                      />
                    )}
                  </div>
                  {weather.subtitle ? (
                    <p className="text-sm text-muted-foreground">{weather.subtitle}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <ul className="space-y-2 text-sm leading-snug text-foreground/90">
                    {visibleBullets.map((line) => (
                      <li key={line} className="flex gap-2.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/50" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })()}

          {plan.timezoneChange !== "none" && (() => {
            const tz = climateTimezoneGuidance(plan);
            return (
              <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none">
                <CardHeader className="px-4 pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      Body clock adjustment
                    </CardTitle>
                    <InlineInfoHint
                      ariaLabel="Timezone adjustment details"
                      content={
                        <div className="space-y-2">
                          <p className="font-medium text-foreground">{tz.title}</p>
                          <ul className="space-y-1.5">
                            {tz.bullets.map((line) => (
                              <li key={line} className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" aria-hidden />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                          {tz.callout ? <p className="text-muted-foreground">{tz.callout}</p> : null}
                        </div>
                      }
                    />
                  </div>
                  {tz.subtitle ? (
                    <p className="text-sm text-muted-foreground">{tz.subtitle}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {tz.phases.map((phase) => (
                      <div
                        key={phase.label}
                        className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {phase.label}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground/85">{phase.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <p className="text-center text-sm leading-snug text-muted-foreground">
            Educational guidance only — not medical advice.
          </p>
        </TabsContent>
        )}

      </Tabs>
    </PageShell>
  );
}
