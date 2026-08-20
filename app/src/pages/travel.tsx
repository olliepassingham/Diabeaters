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
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Pill,
  Info,
  Globe,
  Thermometer,
  Sun,
  Snowflake,
  Calendar,
  Languages,
  Phone,
  Luggage,
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
  getRegionDefaultsForProfile,
  travelEnglishEmergencyNumber,
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
import {
  ExerciseWorkoutProgressBar,
  formatExerciseElapsedShort,
} from "@/components/exercise-active-session-extras";

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

type BasalAdjustmentRow = {
  day: number;
  label: string;
  homeTime: string;
  localTime: string;
  note: string;
};

type TravelPlanBasalSlice = Pick<TravelPlan, "timezoneHours" | "timezoneDirection" | "timezoneChange">;

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

/** Gradual MDI long-acting clock shift for a single home-clock anchor time. */
function buildBasalAdjustmentSchedule(
  basalInjectionTime: string,
  plan: TravelPlanBasalSlice,
): BasalAdjustmentRow[] {
  const anchor = basalInjectionTime.trim();
  if (plan.timezoneChange === "none" || !anchor) return [];

  const [hours, minutes] = anchor.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return [];

  const homeTimeMinutes = hours * 60 + minutes;
  const tzDiff = plan.timezoneHours;
  const direction = plan.timezoneDirection;

  const maxShiftPerDay = 2;
  const daysToAdjust = Math.ceil(tzDiff / maxShiftPerDay);

  const schedule: BasalAdjustmentRow[] = [];

  const formatTime = (totalMinutes: number) => {
    let mins = totalMinutes % (24 * 60);
    if (mins < 0) mins += 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  schedule.push({
    day: 0,
    label: "Travel Day",
    homeTime: anchor,
    localTime: formatTime(homeTimeMinutes + (direction === "east" ? tzDiff * 60 : -tzDiff * 60)),
    note: "Take at your usual time (shown in both home and local time)",
  });

  for (let i = 1; i <= daysToAdjust; i++) {
    const shiftSoFar = Math.min(i * maxShiftPerDay, tzDiff);
    const shiftMinutes = shiftSoFar * 60;

    let adjustedHomeMinutes: number;
    let adjustedLocalMinutes: number;

    if (direction === "east") {
      adjustedHomeMinutes = homeTimeMinutes - shiftMinutes;
      adjustedLocalMinutes = homeTimeMinutes + tzDiff * 60 - shiftMinutes;
    } else {
      adjustedHomeMinutes = homeTimeMinutes + shiftMinutes;
      adjustedLocalMinutes = homeTimeMinutes - tzDiff * 60 + shiftMinutes;
    }

    const isFullyAdjusted = shiftSoFar >= tzDiff;

    schedule.push({
      day: i,
      label: `Day ${i}`,
      homeTime: formatTime(adjustedHomeMinutes),
      localTime: formatTime(adjustedLocalMinutes),
      note: isFullyAdjusted ? "Fully adjusted to local time" : `Shifted ${shiftSoFar}h of ${tzDiff}h total`,
    });
  }

  if (daysToAdjust > 0) {
    schedule.push({
      day: daysToAdjust + 1,
      label: "Onwards",
      homeTime: direction === "east" ? formatTime(homeTimeMinutes - tzDiff * 60) : formatTime(homeTimeMinutes + tzDiff * 60),
      localTime: anchor,
      note: "Continue taking at your usual local time",
    });
  }

  return schedule;
}

function pickBasalRowForDay(rows: BasalAdjustmentRow[], dayInTrip: number): BasalAdjustmentRow | null {
  if (!rows.length) return null;
  const entry = rows.find((s) => s.day === dayInTrip);
  if (entry) return entry;
  const lastEntry = rows[rows.length - 1];
  if (dayInTrip >= (lastEntry?.day ?? 0)) return lastEntry;
  return null;
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
  "h-12 w-full min-w-0 max-w-full rounded-xl text-base tabular-nums [&::-webkit-calendar-picker-indicator]:shrink-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:min-w-0";

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
  const { user } = useAuth();
  const [step, setStep] = useState<"entry" | "inputs" | "results">("entry");
  const TRAVEL_INPUT_STEPS = 3;
  const INPUT_STEP_TITLES = ["Trip details", "Timezone & style", "Conditions"] as const;
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
  const [showPrepForm, setShowPrepForm] = useState(false);
  const [prepDestination, setPrepDestination] = useState("");
  const [prepDeparture, setPrepDeparture] = useState("");
  const [prepReturn, setPrepReturn] = useState("");
  const [prepNotes, setPrepNotes] = useState("");
  const [prepChecklistOpen, setPrepChecklistOpen] = useState(false);
  const [resultsTab, setResultsTab] = useState<"packing" | "emergency" | "climate">("packing");
  const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof EMERGENCY_PHRASES>("English");

  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);
  const regionDefaults = getRegionDefaultsForProfile(profile);
  const emergencyPhrases = useMemo((): Record<
    string,
    { lang: string; iAmDiabetic: string; needSugar: string; needHelp: string; emergencyNumber: string }
  > => {
    const englishNumber = travelEnglishEmergencyNumber(profile);
    return {
      ...EMERGENCY_PHRASES,
      English: { ...EMERGENCY_PHRASES.English, emergencyNumber: englishNumber },
    };
  }, [profile]);
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
    // Keep travel plan dates in sync so packing/supply math share one trip.
    const duration = tripCalendarDaysBetween(prep.departureDate, prep.returnDate);
    const nextPlan: TravelPlan = {
      ...plan,
      destination: prep.destination,
      duration,
      startDate: prep.departureDate,
      endDate: prep.returnDate,
    };
    setPlan(nextPlan);
    if (!storage.getScenarioState().travelModeActive) {
      storage.saveTravelPlan(nextPlan);
    }
    toast({ title: "Trip saved", description: `${prep.destination} is on your travel guide` });
  };

  const handleDeleteHolidayPrep = () => {
    storage.deleteHolidayPrep();
    setHolidayPrep(null);
    setPrepDestination("");
    setPrepDeparture("");
    setPrepReturn("");
    setPrepNotes("");
    toast({ title: "Trip cleared", description: "Countdown and checklist removed" });
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
      title: "Travel Mode Activated",
      description: `You'll see travel reminders until ${
        formatTripDate(activePlan.endDate, profile, { day: "numeric", month: "short", year: "numeric" }) || "your return date"
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

    const selectedPhrases = emergencyPhrases[selectedLanguage];
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
          <TabsList className="grid h-11 w-full grid-cols-3 gap-1 rounded-xl bg-muted/45 p-1">
            <TabsTrigger value="overview" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-travel-overview">Overview</TabsTrigger>
            <TabsTrigger value="plan" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-travel-plan">Plan</TabsTrigger>
            <TabsTrigger value="checklist" className="rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-travel-checklist">Checklist</TabsTrigger>
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
                    onClick={() => setActiveTravelTab("plan")}
                    data-testid="button-overview-open-plan"
                  >
                    <Clock className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                    Plan
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 min-h-9 rounded-xl"
                    onClick={() => setActiveTravelTab("checklist")}
                    data-testid="button-overview-open-checklist"
                  >
                    <Package className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                    Checklist
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

          <TabsContent value="plan" className="mt-4 space-y-3 animate-fade-in-up" data-testid="tabcontent-travel-plan">
            {todayScheduleEntries.length > 0 && !isPumpUser && hasStarted && !hasEnded && (
              <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none">
                <CardHeader className="px-4 pb-2 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Clock className="h-4 w-4 text-primary" aria-hidden />
                    Today&apos;s insulin timing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 pt-0">
                  {todayScheduleEntries.map((row, idx) => (
                    <div
                      key={`${row.doseLabel}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">{row.doseLabel}</p>
                        <p
                          className="text-xl font-bold tabular-nums text-foreground"
                          data-testid={idx === 0 ? "text-today-injection-time" : `text-today-injection-time-${idx + 1}`}
                        >
                          {row.localTime}
                          <span className="ml-1 text-sm font-normal text-muted-foreground">local</span>
                        </p>
                        <p className="text-sm text-muted-foreground">{row.homeTime} home</p>
                      </div>
                      <Badge variant="outline" className="rounded-full">{row.label}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {isPumpUser && plan.timezoneChange !== "none" && hasStarted && !hasEnded && (
              <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none">
                <CardHeader className="px-4 pb-2 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Clock className="h-4 w-4 text-primary" aria-hidden />
                    Timezone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 px-4 pb-4 pt-0 text-sm">
                  <p className="font-semibold tabular-nums">
                    {plan.timezoneHours}h {plan.timezoneDirection === "east" ? "ahead" : "behind"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {daysElapsed < 2
                      ? "Keep pump on home time for day one, then switch to local."
                      : "Pump should be on local time — check basal rates suit."}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none">
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-base font-semibold">Emergency</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href="/emergency-card">
                    <Button variant="secondary" className="min-h-10 w-full rounded-xl" data-testid="button-active-emergency-card">
                      <Globe className="h-4 w-4 mr-2" />
                      Emergency card
                    </Button>
                  </Link>
                  <Link href="/help-now">
                    <Button variant="outline" className="min-h-10 w-full rounded-xl" data-testid="button-help-now-link">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Help now
                    </Button>
                  </Link>
                </div>

                <Collapsible defaultOpen={false} className="group rounded-xl border border-border/60 bg-muted/10">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <CollapsibleTrigger className="flex min-h-10 flex-1 items-center gap-2 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
                      <Languages className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      Key phrases
                      <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                    </CollapsibleTrigger>
                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                      <SelectTrigger className="h-10 w-full min-w-[8.5rem] max-w-[10rem] sm:w-40" data-testid="select-phrase-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(emergencyPhrases).map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <CollapsibleContent className="space-y-2 border-t border-border/60 px-3 pb-3 pt-2">
                    {selectedPhrases ? (
                      <div className="grid grid-cols-1 gap-2">
                        <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                          <p className="text-[11px] text-muted-foreground">I am diabetic</p>
                          <p className="text-base font-medium" data-testid="text-phrase-diabetic">
                            {selectedPhrases.iAmDiabetic}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                          <p className="text-[11px] text-muted-foreground">I need sugar</p>
                          <p className="text-base font-medium" data-testid="text-phrase-sugar">
                            {selectedPhrases.needSugar}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                          <p className="text-[11px] text-muted-foreground">I need medical help</p>
                          <p className="text-base font-medium" data-testid="text-phrase-help">
                            {selectedPhrases.needHelp}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                          <div>
                            <p className="text-[11px] text-muted-foreground">Emergency ({selectedLanguage})</p>
                            <p className="text-lg font-bold tabular-nums" data-testid="text-emergency-number">
                              {selectedPhrases.emergencyNumber}
                            </p>
                          </div>
                          <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
                        </div>
                      </div>
                    ) : null}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
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
    return (
      <PageShell variant="narrow" density="compact" className="space-y-4">
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
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Plan your trip</h2>
            <button
              type="button"
              onClick={handleStartPlan}
              className={cn(
                "group flex w-full items-center gap-3.5 rounded-[1.35rem] border border-sky-500/20 bg-gradient-to-b from-sky-500/[0.07] via-card to-card px-4 py-4 text-left transition-all",
                "hover:border-sky-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              data-testid="button-start-travel-plan"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/10 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-200">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-semibold text-foreground">Travel plan</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Packing list, timezone & climate
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/70" aria-hidden />
            </button>
            {!showPrepForm ? (
              <button
                type="button"
                onClick={() => setShowPrepForm(true)}
                className={cn(
                  "group flex w-full items-center gap-3.5 rounded-[1.35rem] border border-border/60 bg-card/70 px-4 py-3.5 text-left transition-all",
                  "hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                data-testid="button-start-holiday-prep"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-foreground ring-1 ring-border/50">
                  <Luggage className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">Save trip dates</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Countdown and supply check
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
              </button>
            ) : null}
          </section>
        ) : null}

        {(showPrepForm || holidayPrep) && (
          <Card className="overflow-hidden rounded-[1.35rem] border-border/50 shadow-none" data-testid="card-travel-entry-hub">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="font-display text-lg font-semibold tracking-tight">
                {holidayPrep ? "Your trip" : "Trip dates"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4 pt-0">
              {showPrepForm && !holidayPrep ? (
              <div className="space-y-4" data-testid="holiday-prep-form">
                <div className="space-y-2">
                  <Label>Where are you going?</Label>
                  <Input 
                    placeholder="e.g. Spain, Lake District, Florida"
                    value={prepDestination}
                    onChange={(e) => setPrepDestination(e.target.value)}
                    className="h-11 rounded-xl"
                    data-testid="input-prep-destination"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <Label>Departure</Label>
                    <Input 
                      type="date"
                      value={prepDeparture}
                      onChange={(e) => setPrepDeparture(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className={travelDateInputClass}
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
                      className={travelDateInputClass}
                      data-testid="input-prep-return"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input 
                    placeholder="e.g. All-inclusive, hiking trip"
                    value={prepNotes}
                    onChange={(e) => setPrepNotes(e.target.value)}
                    className="h-11 rounded-xl"
                    data-testid="input-prep-notes"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveHolidayPrep} className="h-11 rounded-xl" data-testid="button-save-holiday-prep">
                    Save trip
                  </Button>
                  <Button variant="ghost" onClick={() => setShowPrepForm(false)} className="h-11 rounded-xl" data-testid="button-cancel-holiday-prep">
                    Cancel
                  </Button>
                </div>
              </div>
              ) : null}

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
                        {formatTripDate(holidayPrep.departureDate, profile, { day: "numeric", month: "short" }) ||
                          "Departure"} 
                        {" — "}
                        {formatTripDate(holidayPrep.returnDate, profile, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }) || "Return"}
                        {" "}({tripDays} days)
                      </p>
                      {holidayPrep.notes && (
                        <p className="mt-1 text-sm text-muted-foreground">{holidayPrep.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDeleteHolidayPrep}
                      aria-label="Delete holiday prep"
                      data-testid="button-delete-holiday-prep"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {daysUntil !== null && daysUntil >= 0 && (
                    <div
                      className={cn(
                        "overflow-hidden rounded-[1.35rem] border px-4 py-4 text-center",
                        daysUntil <= 3
                          ? "border-orange-500/30 bg-orange-500/[0.08]"
                          : daysUntil <= 7
                            ? "border-amber-500/30 bg-amber-500/[0.08]"
                            : "border-sky-500/25 bg-sky-500/[0.08]",
                      )}
                      data-testid="text-prep-countdown"
                    >
                      <p className="font-display text-5xl font-bold tabular-nums tracking-tight text-foreground">{daysUntil}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {daysUntil === 0 ? "Departing today" : daysUntil === 1 ? "day to go" : "days to go"}
                      </p>
                    </div>
                  )}

                  {hasDeparted && !isTravelModeActive && (
                    <Alert className="border-orange-300 dark:border-orange-700">
                      <Plane className="h-4 w-4" />
                      <AlertTitle>Departure date has passed</AlertTitle>
                      <AlertDescription>Open your packing list to start travel mode.</AlertDescription>
                    </Alert>
                  )}

                  {coverage.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        Supplies
                        <InlineInfoHint
                          ariaLabel="How supply cover is calculated"
                          content={
                            <p className="text-sm">
                              We check stock against about {coverage[0]?.daysNeeded ?? tripDays} days
                              for this {tripDays}-day trip (includes a travel buffer). Green means enough; red means order more.
                            </p>
                          }
                        />
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {coverage.map(({ supply, daysRemaining, shortfall, coveragePercent, orderByDate }) => (
                          <div
                            key={supply.id}
                            className={cn(
                              "rounded-xl border px-2.5 py-2",
                              shortfall > 0 ? "border-red-500/30 bg-red-500/[0.06]" : "border-border/70 bg-background/70",
                            )}
                            data-testid={`prep-supply-${supply.id}`}
                          >
                            <p className="truncate text-[11px] font-medium text-muted-foreground">{supply.name}</p>
                            <p className={cn(
                              "mt-0.5 text-sm font-bold tabular-nums",
                              shortfall > 0 ? "text-red-600 dark:text-red-400" : "text-foreground",
                            )}>
                              {daysRemaining >= 999
                                ? "—"
                                : shortfall > 0
                                  ? `${shortfall}d short`
                                  : `${daysRemaining}d`}
                            </p>
                            {orderByDate && shortfall > 0 ? (
                              <p className="mt-0.5 text-[10px] font-medium text-red-700 dark:text-red-300" data-testid={`prep-supply-order-by-${supply.id}`}>
                                Order by {formatTripDate(orderByDate, profile, { day: "numeric", month: "short" }) || orderByDate}
                              </p>
                            ) : null}
                            {daysRemaining < 999 ? (
                              <Progress
                                value={coveragePercent}
                                className={`mt-1.5 h-1.5 ${shortfall > 0 ? "[&>div]:bg-red-500" : "[&>div]:bg-emerald-500"}`}
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                      {hasSupplyShortfall ? (
                        <p className="text-xs text-red-600 dark:text-red-400">Order short items before you go.</p>
                      ) : null}
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
                      const dueLabel =
                        formatTripDate(nextDue.toISOString().slice(0, 10), profile, { day: "numeric", month: "short" }) ||
                        "soon";
                      return (
                        <Alert className="border-blue-300 dark:border-blue-700" data-testid="alert-prescription-timing">
                          <Calendar className="h-4 w-4" />
                          <AlertTitle className="flex items-center gap-1 text-sm">
                            Prescription
                            <InlineInfoHint
                              ariaLabel="Prescription timing tip"
                              content={
                                <p className="text-sm">
                                  Due around {dueLabel}
                                  {daysBeforeDeparture <= 0
                                    ? ` (${Math.abs(daysBeforeDeparture)} days before departure).`
                                    : " while you are away."}{" "}
                                  Ask your pharmacy about collecting early.
                                </p>
                              }
                            />
                          </AlertTitle>
                          <AlertDescription>Due {dueLabel} — collect early if you can.</AlertDescription>
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
                          <span className="font-medium text-sm">Checklist · {checkedCount}/{totalChecklist}</span>
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

                  {!isTravelModeActive && (
                    <Button
                      className="h-11 w-full rounded-xl"
                      variant={isDepartureNear || hasDeparted ? "default" : "outline"}
                      onClick={() => {
                        if ((isDepartureNear || hasDeparted) && packingPlanReady) {
                          const next = seedPlanFromHolidayPrep();
                          setPlan(next);
                          handleActivateTravelMode(next);
                          return;
                        }
                        handleStartPlan();
                      }}
                      data-testid={
                        isDepartureNear || hasDeparted
                          ? "button-activate-from-prep"
                          : "button-start-plan-from-prep"
                      }
                    >
                      {isDepartureNear || hasDeparted
                        ? packingPlanReady
                          ? "Start travel"
                          : "Make packing list"
                        : packingPlanReady
                          ? "Open packing list"
                          : "Make packing list"}
                      <ChevronRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  )}
                </div>
              );
            })()}
            </CardContent>
          </Card>
        )}
        <section className="space-y-3" aria-labelledby="travel-extras-heading">
          <h2 id="travel-extras-heading" className="text-sm font-semibold text-muted-foreground">
            Before you go
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-[1.35rem] border border-border/50 bg-card/70 p-3.5" data-testid="card-pretravel-appointment">
              <div className="flex flex-wrap items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold">Appointments</span>
                <InlineInfoHint
                  ariaLabel="Why book before you travel"
                  content={
                    <p className="text-sm">
                      Letters for travel and extra supplies often need planning—book ahead where you can.
                    </p>
                  }
                />
              </div>
              {nextAppointment ? (
                <Link
                  href="/appointments"
                  className="block rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 transition-colors hover:border-border hover:bg-background"
                  data-testid="link-pretravel-next-appointment"
                >
                  <p className="text-sm font-semibold text-foreground truncate">
                    {nextAppointment.title?.trim() || "Appointment"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Next: {formatNextAppointmentWhen(nextAppointment)}
                    {nextAppointment.location?.trim()
                      ? ` · ${nextAppointment.location.trim()}`
                      : ""}
                  </p>
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No upcoming appointments saved yet.
                </p>
              )}
              <Link href="/appointments" className="block">
                <Button variant="secondary" className="h-10 w-full rounded-xl" size="sm" data-testid="link-pretravel-appointments">
                  {nextAppointment ? "View all appointments" : "Add appointment"}
                </Button>
              </Link>
            </div>
            <div className="space-y-2 rounded-[1.35rem] border border-border/50 bg-card/70 p-3.5">
              <div className="flex flex-wrap items-center gap-1">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold">Emergency card</span>
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
                <Button variant="secondary" className="h-10 w-full rounded-xl" size="sm" data-testid="button-emergency-card">
                  Open emergency card
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <TravelDisclaimerCard />

      </PageShell>
    );
  }

  if (step === "inputs") {
    const matchedDurationPreset = TRAVEL_DURATION_PRESETS.find((preset) => preset.days === plan.duration);
    return (
      <>
      <PageShell variant="narrow" density="compact" className="space-y-4 pb-28">
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
            className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5"
            data-testid="travel-wizard-trip-summary"
          >
            <p className="text-sm font-semibold text-foreground truncate">
              {holidayPrep?.destination || plan.destination}
            </p>
            <p className="text-xs text-muted-foreground">
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
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

        <Card className="overflow-hidden rounded-[1.35rem] border-sky-500/20 bg-gradient-to-b from-sky-500/[0.07] via-card to-card shadow-none dark:border-sky-400/15 dark:from-sky-950/40">
          <CardHeader className="space-y-0 px-4 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/10 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-200">
                <Plane className="h-5 w-5" aria-hidden />
              </span>
              <CardTitle className="font-display text-lg font-semibold tracking-tight">{INPUT_STEP_TITLES[travelWizardStep]}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 border-t border-sky-500/10 px-4 pb-5 pt-5">
            {travelWizardStep === 0 ? (
              <>
            <div className="space-y-2">
              <Label htmlFor="destination" className="text-xs font-medium text-muted-foreground">Destination</Label>
              <Input
                id="destination"
                placeholder="City, country"
                value={plan.destination}
                onChange={(e) => setPlan(prev => ({ ...prev, destination: e.target.value }))}
                className="h-12 rounded-xl text-base"
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

            <div className="space-y-3">
              <div className="min-w-0 space-y-2">
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
              <div className="min-w-0 space-y-2">
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

            <div className="space-y-2">
              <Label id="timezone-label" className="text-xs font-medium text-muted-foreground">Timezone</Label>
              <TravelSegmentGroup
                labelledBy="timezone-label"
                value={plan.timezoneChange}
                onChange={(value) => {
                  setPlan((prev) => ({
                    ...prev,
                    timezoneChange: value,
                    timezoneDirection: value === "none" ? "none" : prev.timezoneDirection === "none" ? "east" : prev.timezoneDirection,
                    timezoneHours: value === "none" ? 0 : value === "minor" ? 2 : 6,
                  }));
                }}
                options={[
                  { value: "none", label: "None" },
                  { value: "minor", label: "Minor" },
                  { value: "major", label: "Major" },
                ]}
                testId="select-timezone"
                columns={3}
              />
            </div>
            
            {plan.timezoneChange !== "none" && (
              <div className="space-y-3 rounded-xl border border-border/50 bg-background/50 p-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Hours</Label>
                  <div className="flex items-center justify-center gap-3" data-testid="select-timezone-hours">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-xl"
                      onClick={() => setPlan((prev) => ({ ...prev, timezoneHours: Math.max(1, prev.timezoneHours - 1) }))}
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
                      onClick={() => setPlan((prev) => ({ ...prev, timezoneHours: Math.min(12, prev.timezoneHours + 1) }))}
                      aria-label="Increase hours"
                    >
                      +
                    </Button>
                    <span className="text-sm text-muted-foreground">h</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label id="timezone-direction-label" className="text-xs font-medium text-muted-foreground">Direction</Label>
                  <TravelSegmentGroup
                    labelledBy="timezone-direction-label"
                    value={plan.timezoneDirection === "none" ? "east" : plan.timezoneDirection}
                    onChange={(value) => setPlan((prev) => ({ ...prev, timezoneDirection: value }))}
                    options={[
                      { value: "east", label: "East" },
                      { value: "west", label: "West" },
                    ]}
                    testId="select-timezone-direction"
                    columns={2}
                  />
                </div>
              </div>
            )}
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
    <PageShell variant="narrow" density="compact" className="space-y-4">
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

      <div className="overflow-hidden rounded-[1.35rem] border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.10] via-card to-card shadow-[0_12px_40px_-24px_rgba(14,165,233,0.45)]">
        <div className="px-4 pb-4 pt-4 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Packed</p>
          <p className="mt-1 font-display text-[2.5rem] font-bold leading-none tabular-nums tracking-tight text-foreground">
            {checkedCount}
            <span className="text-xl font-semibold text-muted-foreground">/{packingList.length}</span>
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2 border-t border-border/40 pt-3.5">
            <span className="inline-flex items-center rounded-xl bg-background/80 px-3 py-1.5 text-sm font-semibold tabular-nums ring-1 ring-border/50">
              {plan.duration}d
            </span>
            <span className="inline-flex items-center rounded-xl bg-background/50 px-3 py-1.5 text-sm font-medium ring-1 ring-border/40">
              {formatTripDate(plan.startDate, profile, { day: "numeric", month: "short" }) || "Start"} –{" "}
              {formatTripDate(plan.endDate, profile, { day: "numeric", month: "short" }) || "End"}
            </span>
            <span className="inline-flex items-center rounded-xl bg-background/50 px-3 py-1.5 text-sm font-medium capitalize ring-1 ring-border/40">
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
            <p className="text-sm font-semibold">Travel mode on</p>
            <Button size="sm" variant="outline" className="h-10 rounded-xl" onClick={handleDeactivateTravelMode} data-testid="button-deactivate-travel">
              End
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">Start this trip</p>
            <Button size="sm" className="h-10 rounded-xl" onClick={handleActivateTravelMode} data-testid="button-activate-travel">
              Start travel
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
              Climate
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
