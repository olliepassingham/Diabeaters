import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trackFeatureEngagement } from "@/components/discovery-prompts";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Package, Syringe, Activity, Settings, Calendar, RotateCcw, AlertTriangle, ClipboardList, Undo2, Plug, Cylinder, Plane, Thermometer, ArrowRight, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { UsualPrescriptionDialog } from "@/components/usual-prescription-dialog";
import { useToast } from "@/hooks/use-toast";
import { storage, Supply, LastPrescription, UsualPrescription, UsualPrescriptionItem, PrescriptionCycle, ScenarioState, getSupplyIncrement, getUnitsPerPen, getInsulinContainerLabel, DIABEATER_SCENARIO_STATE_CHANGED_EVENT, DIABEATER_PROFILE_CHANGED_EVENT, type UserProfile } from "@/lib/storage";
import { INSULIN_STOCK_QUANTITY_HINT } from "@/lib/insulin-pen-units";
import { isPumpDeliveryMethod } from "@/lib/insulin-delivery-method";
import { FaceLogoWatermark } from "@/components/face-logo";
import { Link, useSearch } from "wouter";
import { formatDistanceToNow, format, differenceInDays, addDays, startOfDay } from "date-fns";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageBackButton, PageHeader, PageShell } from "@/components/layout";
import { OfflineDeviceNotice } from "@/components/offline-device-notice";
import { NOTIFY_EDGE_FAILURE_TITLE, notifyEdgeFailureDescription } from "@/lib/notify-toast-messages";
import { runSupplyLowInAppNotifyScan } from "@/lib/supply-inapp-notify-scan";
import { PharmacyCard } from "@/components/pharmacy-card";
import { ToastAction } from "@/components/ui/toast";
import { SupplyRunwayAtAGlance } from "@/components/visualizations/supply-runway-at-glance";
import { addLocalSupplyEvent, enqueueSupplyEventForCloud, inferDailyUsageFromLocalEvents, listLocalSupplyEvents } from "@/lib/supply-events";
import { SettingsGroupLabel, SettingsPanel, SettingsPanelBody } from "@/components/settings/settings-ui";

const typeIcons: Record<string, any> = {
  needle: Syringe,
  insulin: Package,
  insulin_short: Package,
  insulin_long: Package,
  cgm: Activity,
  infusion_set: Plug,
  reservoir: Cylinder,
  other: Package,
};

/** Start of local calendar day for fair comparisons (prescription + pickups). */
function startOfLocalDay(d: Date): Date {
  return startOfDay(d);
}

/** Most recent refill / pickup logged on any supply. */
function getMaxSupplyPickupDay(supplies: Supply[]): Date | null {
  let max: Date | null = null;
  for (const s of supplies) {
    if (!s.lastPickupDate) continue;
    const t = new Date(s.lastPickupDate);
    if (!Number.isFinite(t.getTime())) continue;
    const day = startOfLocalDay(t);
    if (!max || day.getTime() > max.getTime()) max = day;
  }
  return max;
}

/**
 * Real-world anchor: many people log pickups on each supply but forget to update prescription cycle dates.
 * We use the later of (saved last collection, latest supply pickup) so reorder/collection projections stay sane.
 */
function getEffectiveCollectionAnchor(cycle: PrescriptionCycle, supplies: Supply[]): Date | null {
  const fromCycle = cycle.lastCollectionDate ? startOfLocalDay(new Date(cycle.lastCollectionDate)) : null;
  const fromSupplies = getMaxSupplyPickupDay(supplies);
  if (fromCycle && fromSupplies) {
    return fromCycle.getTime() >= fromSupplies.getTime() ? fromCycle : fromSupplies;
  }
  return fromCycle ?? fromSupplies;
}

const typeLabels: Record<string, string> = {
  needle: "Needles/Lancets",
  insulin: "Insulin",
  insulin_short: "Short-Acting Insulin",
  insulin_long: "Long-Acting Insulin",
  insulin_vial: "Insulin Vials (Pump)",
  cgm: "CGM/Monitors",
  infusion_set: "Infusion Sets",
  reservoir: "Reservoirs/Cartridges",
  other: "Other",
};

function isInsulinType(type: string): boolean {
  return type === "insulin" || type === "insulin_short" || type === "insulin_long" || type === "insulin_vial";
}

function isPumpOnlySupplyType(type: string): boolean {
  return type === "insulin_vial" || type === "infusion_set" || type === "reservoir";
}

function PumpOnlySupplySelectItems() {
  return (
    <>
      <SelectItem value="insulin_vial">Insulin Vials (Pump)</SelectItem>
      <SelectItem value="infusion_set">Infusion Sets (Pump)</SelectItem>
      <SelectItem value="reservoir">Reservoirs/Cartridges (Pump)</SelectItem>
    </>
  );
}


function PrescriptionCyclePanel({ 
  cycle, 
  onSave, 
  supplies,
  scenarioState,
}: { 
  cycle: PrescriptionCycle | null; 
  onSave: (cycle: PrescriptionCycle) => void;
  supplies: Supply[];
  scenarioState: ScenarioState;
}) {
  const [editing, setEditing] = useState(false);
  const [intervalDays, setIntervalDays] = useState(cycle?.intervalDays?.toString() || "28");
  const [leadTimeDays, setLeadTimeDays] = useState(cycle?.leadTimeDays?.toString() || "5");
  const [lastOrderDate, setLastOrderDate] = useState(
    cycle?.lastOrderDate ? format(new Date(cycle.lastOrderDate), "yyyy-MM-dd") : ""
  );
  const [lastCollectionDate, setLastCollectionDate] = useState(
    cycle?.lastCollectionDate ? format(new Date(cycle.lastCollectionDate), "yyyy-MM-dd") : ""
  );

  useEffect(() => {
    if (cycle) {
      setIntervalDays(cycle.intervalDays.toString());
      setLeadTimeDays(cycle.leadTimeDays.toString());
      setLastOrderDate(cycle.lastOrderDate ? format(new Date(cycle.lastOrderDate), "yyyy-MM-dd") : "");
      setLastCollectionDate(cycle.lastCollectionDate ? format(new Date(cycle.lastCollectionDate), "yyyy-MM-dd") : "");
    }
  }, [cycle]);

  const handleSave = () => {
    const interval = Math.max(1, parseInt(intervalDays) || 28);
    const lead = Math.max(0, Math.min(parseInt(leadTimeDays) || 5, interval - 1));
    onSave({
      intervalDays: interval,
      leadTimeDays: lead,
      lastOrderDate: lastOrderDate ? new Date(lastOrderDate + "T12:00:00").toISOString() : undefined,
      lastCollectionDate: lastCollectionDate ? new Date(lastCollectionDate + "T12:00:00").toISOString() : undefined,
    });
    setEditing(false);
  };

  const travelStart = scenarioState.travelModeActive && scenarioState.travelStartDate 
    ? new Date(scenarioState.travelStartDate) : null;
  const travelEnd = scenarioState.travelModeActive && scenarioState.travelEndDate 
    ? new Date(scenarioState.travelEndDate) : null;

  const fallsDuringTravel = (date: Date): boolean => {
    if (!travelStart || !travelEnd) return false;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const ts = new Date(travelStart);
    ts.setHours(0, 0, 0, 0);
    const te = new Date(travelEnd);
    te.setHours(0, 0, 0, 0);
    return d >= ts && d <= te;
  };

  const adjustForTravel = (date: Date): { date: Date; adjusted: boolean } => {
    if (fallsDuringTravel(date) && travelStart) {
      const dayBefore = addDays(new Date(travelStart), -1);
      dayBefore.setHours(12, 0, 0, 0);
      return { date: dayBefore, adjusted: true };
    }
    return { date, adjusted: false };
  };

  const getRawNextOrderDate = (): Date | null => {
    if (!cycle) return null;
    const interval = cycle.intervalDays || 28;
    const lead = Math.min(cycle.leadTimeDays ?? 5, Math.max(0, interval - 1));

    const orderDate = cycle.lastOrderDate ? startOfLocalDay(new Date(cycle.lastOrderDate)) : null;
    const collAnchor = getEffectiveCollectionAnchor(cycle, supplies);

    if (orderDate && collAnchor && orderDate.getTime() > collAnchor.getTime()) {
      return addDays(orderDate, interval - lead);
    }
    if (collAnchor) {
      return addDays(collAnchor, interval - lead);
    }
    if (orderDate) {
      return addDays(orderDate, interval - lead);
    }
    return null;
  };

  const getRawNextCollectionDate = (): Date | null => {
    if (!cycle) return null;
    const interval = cycle.intervalDays || 28;
    const lead = Math.min(cycle.leadTimeDays ?? 5, Math.max(0, interval - 1));

    const orderDate = cycle.lastOrderDate ? startOfLocalDay(new Date(cycle.lastOrderDate)) : null;
    const collAnchor = getEffectiveCollectionAnchor(cycle, supplies);

    if (orderDate && collAnchor && orderDate.getTime() > collAnchor.getTime()) {
      return addDays(orderDate, lead);
    }
    if (collAnchor) {
      return addDays(collAnchor, interval);
    }
    if (orderDate) {
      return addDays(orderDate, lead);
    }
    return null;
  };

  const getNextOrderDate = (): { date: Date; adjusted: boolean } | null => {
    const raw = getRawNextOrderDate();
    if (!raw) return null;
    return adjustForTravel(raw);
  };

  const getNextCollectionDate = (): { date: Date; adjusted: boolean } | null => {
    const raw = getRawNextCollectionDate();
    if (!raw) return null;
    return adjustForTravel(raw);
  };

  const getDaysUntilOrder = (): number | null => {
    const result = getNextOrderDate();
    if (!result) return null;
    return differenceInDays(startOfLocalDay(result.date), startOfLocalDay(new Date()));
  };

  const getDaysUntilCollection = (): number | null => {
    const result = getNextCollectionDate();
    if (!result) return null;
    return differenceInDays(startOfLocalDay(result.date), startOfLocalDay(new Date()));
  };

  const daysUntilOrder = getDaysUntilOrder();
  const daysUntilCollection = getDaysUntilCollection();
  const orderAdjustedForTravel = getNextOrderDate()?.adjusted || false;
  const collectionAdjustedForTravel = getNextCollectionDate()?.adjusted || false;
  const needsSetup = !cycle;
  const orderOverdue = daysUntilOrder !== null && daysUntilOrder < 0;
  const orderSoon = daysUntilOrder !== null && daysUntilOrder >= 0 && daysUntilOrder <= 3;
  const latestPickup = getMaxSupplyPickupDay(supplies);
  const pickupNewerThanSavedCollection =
    !!cycle?.lastCollectionDate &&
    !!latestPickup &&
    latestPickup.getTime() > startOfLocalDay(new Date(cycle.lastCollectionDate)).getTime();

  const syncCollectionFromLatestPickup = () => {
    if (!cycle) return;
    const latest = latestPickup;
    if (!latest) return;
    onSave({
      ...cycle,
      lastCollectionDate: new Date(latest.getFullYear(), latest.getMonth(), latest.getDate(), 12, 0, 0, 0).toISOString(),
    });
  };

  const markCollectedToday = () => {
    if (!cycle) return;
    const today = new Date();
    const iso = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0).toISOString();
    onSave({
      ...cycle,
      lastCollectionDate: iso,
    });
  };

  const advice = storage.getSmartPrescriptionAdvice(supplies);
  const intervalPresets = [28, 56, 84];

  return (
    <div
      data-testid="card-prescription-cycle"
      className={`space-y-3 ${advice.collectSoon.length > 0 ? "rounded-lg border border-amber-500/40 p-3" : ""}`}
    >
        {!needsSetup && !editing ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditing(true)}
              data-testid="button-edit-prescription-cycle"
              aria-label="Edit reorder schedule"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        {editing || needsSetup ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="interval-days" className="text-xs">
                Repeat every (days)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {intervalPresets.map((days) => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant={intervalDays === String(days) ? "default" : "outline"}
                    className="h-8 px-3"
                    onClick={() => setIntervalDays(String(days))}
                  >
                    {days}d
                  </Button>
                ))}
              </div>
              <Input
                id="interval-days"
                type="number"
                min={1}
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                data-testid="input-interval-days"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-time" className="text-xs">
                Pharmacy processing (days)
              </Label>
              <Input
                id="lead-time"
                type="number"
                min={0}
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                data-testid="input-lead-time"
              />
            </div>
            <details className="rounded-lg border border-border/60 px-3 py-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">Last order / collect (optional)</summary>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="last-order-date" className="text-xs">
                    Last order
                  </Label>
                  <Input
                    id="last-order-date"
                    type="date"
                    value={lastOrderDate}
                    onChange={(e) => setLastOrderDate(e.target.value)}
                    data-testid="input-last-order-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="last-collection-date" className="text-xs">
                    Last collect
                  </Label>
                  <Input
                    id="last-collection-date"
                    type="date"
                    value={lastCollectionDate}
                    onChange={(e) => setLastCollectionDate(e.target.value)}
                    data-testid="input-last-collection-date"
                  />
                </div>
              </div>
            </details>
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm" className="flex-1" data-testid="button-save-prescription-cycle">
                Save
              </Button>
              {!needsSetup ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {daysUntilOrder !== null ? (
                <div
                  className={`rounded-lg px-3 py-2 ${
                    orderOverdue
                      ? "bg-red-500/10 dark:bg-red-950/30"
                      : orderSoon
                        ? "bg-amber-500/10 dark:bg-amber-950/30"
                        : "bg-muted/40"
                  }`}
                  data-testid="card-next-order"
                >
                  <p className="text-[11px] text-muted-foreground">Reorder by</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {format(getNextOrderDate()!.date, "d MMM")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {orderOverdue
                      ? `${Math.abs(daysUntilOrder)}d overdue`
                      : daysUntilOrder === 0
                        ? "Today"
                        : `In ${daysUntilOrder}d`}
                    {orderAdjustedForTravel ? " · before trip" : ""}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Every</p>
                  <p className="text-sm font-semibold tabular-nums" data-testid="text-prescription-interval">
                    {cycle?.intervalDays || 28}d
                  </p>
                </div>
              )}
              {daysUntilCollection !== null ? (
                <div
                  className={`rounded-lg px-3 py-2 ${
                    collectionAdjustedForTravel ? "bg-blue-500/10 dark:bg-blue-950/30" : "bg-muted/40"
                  }`}
                  data-testid="card-next-collection"
                >
                  <p className="text-[11px] text-muted-foreground">Collect by</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {format(getNextCollectionDate()!.date, "d MMM")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {daysUntilCollection! <= 0 ? "Now" : `In ${daysUntilCollection}d`}
                    {collectionAdjustedForTravel ? " · before trip" : ""}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Processing</p>
                  <p className="text-sm font-semibold tabular-nums" data-testid="text-lead-time">
                    {cycle?.leadTimeDays || 5}d
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={markCollectedToday}
                data-testid="button-collected-today-prescription"
              >
                Collected today
              </Button>
              {latestPickup ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={syncCollectionFromLatestPickup}
                  data-testid="button-sync-cycle-from-pickup"
                  title={
                    pickupNewerThanSavedCollection
                      ? `Latest refill: ${format(latestPickup, "d MMM yyyy")}`
                      : undefined
                  }
                >
                  Match refill
                </Button>
              ) : null}
            </div>

            {advice.collectSoon.length > 0 ? (
              <div className="space-y-1.5" data-testid="section-collect-soon">
                {advice.collectSoon.map(({ supply, daysUntilCollect, reason }) => {
                  const isUrgent = daysUntilCollect <= 0;
                  return (
                    <p
                      key={supply.id}
                      className={`text-xs leading-snug ${
                        isUrgent ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300"
                      }`}
                      data-testid={`collect-item-${supply.id}`}
                    >
                      {isUrgent ? "⚠ " : ""}
                      {reason}
                    </p>
                  );
                })}
              </div>
            ) : null}

            <PharmacyCard variant="compact" />
          </>
        )}
    </div>
  );
}


function SupplyCard({ 
  supply, 
  nextActionHint,
  onEdit, 
  onDelete, 
  onAdjustQuantity,
  onLogPickup,
  onRefresh,
}: { 
  supply: Supply; 
  nextActionHint?: { label: string; tone: "muted" | "amber" | "red" | "blue" };
  onEdit: (supply: Supply) => void;
  onDelete: (id: string) => void;
  onAdjustQuantity: (args: {
    id: string;
    nextQuantity: number;
    delta: number;
    unitLabel: string;
    unitAmount: number;
  }) => void;
  onLogPickup: (supply: Supply) => void;
  onRefresh: () => void;
}) {
  const actionRowRef = useRef<HTMLDivElement | null>(null);
  const [nextActionNudge, setNextActionNudge] = useState(0);

  const adjustedQuantity = storage.getAdjustedQuantity(supply);
  const daysRemaining = storage.getDaysRemaining(supply);
  const runOutDate = storage.getRunOutDate(supply);
  const status = storage.getSupplyStatus(supply);
  const daysSincePickup = storage.getDaysSincePickup(supply);
  const Icon = typeIcons[supply.type] || Package;
  const effectiveUsage = storage.getEffectiveDailyUsage(supply);
  const history = listLocalSupplyEvents(supply.id, 5);
  const smarterEnabled = !!storage.getSettings().suppliesSmarterForecastEnabled;
  const inferred = smarterEnabled ? inferDailyUsageFromLocalEvents(supply.id, 7) : null;
  const forecastUsage =
    inferred?.usagePerDay && inferred.usagePerDay > 0 ? Math.round(inferred.usagePerDay) : effectiveUsage;
  const forecastConfidence =
    inferred?.usagePerDay && inferred.usagePerDay > 0 ? inferred.confidence : effectiveUsage > 0 ? "high" : "low";
  const activeItemInfo =
    supply.type === "cgm" || supply.type === "infusion_set" || supply.type === "reservoir"
      ? storage.getActiveItemInfo(supply)
      : null;

  const getLastPickupText = () => {
    if (!supply.lastPickupDate) return null;
    try {
      const pickupDate = new Date(supply.lastPickupDate);
      const dayText = daysSincePickup !== null && daysSincePickup > 0 
        ? ` (${daysSincePickup} day${daysSincePickup !== 1 ? 's' : ''} ago)`
        : ' (today)';
      return `Picked up ${format(pickupDate, "MMM d")}${dayText}`;
    } catch {
      return null;
    }
  };

  const lastPickupText = getLastPickupText();
  const stockNowInt = Math.max(0, Math.floor(adjustedQuantity));
  const nextAction =
    nextActionHint ??
    (daysRemaining !== 999 && daysRemaining <= 3
      ? { label: "Reorder now", tone: "red" as const }
      : status === "critical"
        ? { label: "Reorder now", tone: "red" as const }
        : status === "low"
          ? { label: "Reorder soon", tone: "amber" as const }
          : { label: "OK", tone: "muted" as const });

  const nextActionBadgeClass =
    nextAction.tone === "red"
      ? "border-red-500/40 bg-red-500/[0.10] text-red-900 dark:text-red-100"
      : nextAction.tone === "amber"
        ? "border-amber-500/40 bg-amber-500/[0.10] text-amber-950 dark:text-amber-50"
        : nextAction.tone === "blue"
          ? "border-blue-500/40 bg-blue-500/[0.10] text-blue-900 dark:text-blue-100"
          : "border-border/70 bg-background/60 text-muted-foreground";

  const forecastLine =
    forecastUsage > 0 && supply.type !== "cgm" && supply.type !== "infusion_set" && supply.type !== "reservoir" ? (
      <p className="text-xs text-muted-foreground">
        Forecast: {forecastUsage}/day{isInsulinType(supply.type) ? " units" : supply.type === "needle" ? " needles" : ""}{" "}
        {smarterEnabled ? <span className="ml-1">• Smarter: {forecastConfidence}</span> : null} •{" "}
        <Link href="/settings/usage#settings-usage" className="underline underline-offset-2">
          Edit habits
        </Link>
      </p>
    ) : null;

  const detailsContent = (
    <>
      {supply.type === "cgm" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Sensor duration</span>
            <span>{storage.getSettings().cgmDays || 14} days each</span>
          </div>
          {supply.activeItemStartDate && (() => {
            const info = storage.getActiveItemInfo(supply);
            if (!info) return null;
            const changeSoon = info.daysLeft <= 1;
            return (
              <div className="space-y-1">
                <div className={`flex items-center justify-between ${changeSoon ? "text-yellow-600 dark:text-yellow-500" : "text-muted-foreground"}`}>
                  <span>Active sensor</span>
                  <span>{changeSoon ? "Change due today" : `${info.daysLeft} day${info.daysLeft !== 1 ? "s" : ""} left`}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={(e) => { e.stopPropagation(); storage.markItemChangedEarly(supply.id); onRefresh(); }}
                  data-testid={`button-change-early-${supply.id}`}
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  {changeSoon ? "Changed sensor" : "Changed early"}
                </Button>
              </div>
            );
          })()}
        </div>
      ) : supply.type === "infusion_set" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Site change</span>
            <span>Every {storage.getSettings().siteChangeDays || 3} days</span>
          </div>
          {supply.activeItemStartDate && (() => {
            const info = storage.getActiveItemInfo(supply);
            if (!info) return null;
            const changeSoon = info.daysLeft <= 1;
            return (
              <div className="space-y-1">
                <div className={`flex items-center justify-between ${changeSoon ? "text-yellow-600 dark:text-yellow-500" : "text-muted-foreground"}`}>
                  <span>Active set</span>
                  <span>{changeSoon ? "Change due today" : `${info.daysLeft} day${info.daysLeft !== 1 ? "s" : ""} left`}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={(e) => { e.stopPropagation(); storage.markItemChangedEarly(supply.id); onRefresh(); }}
                  data-testid={`button-change-early-${supply.id}`}
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  {changeSoon ? "Changed set" : "Changed early"}
                </Button>
              </div>
            );
          })()}
        </div>
      ) : supply.type === "reservoir" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Reservoir change</span>
            <span>Every {storage.getSettings().reservoirChangeDays || 3} days</span>
          </div>
          {supply.activeItemStartDate && (() => {
            const info = storage.getActiveItemInfo(supply);
            if (!info) return null;
            const changeSoon = info.daysLeft <= 1;
            return (
              <div className="space-y-1">
                <div className={`flex items-center justify-between ${changeSoon ? "text-yellow-600 dark:text-yellow-500" : "text-muted-foreground"}`}>
                  <span>Active reservoir</span>
                  <span>{changeSoon ? "Change due today" : `${info.daysLeft} day${info.daysLeft !== 1 ? "s" : ""} left`}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={(e) => { e.stopPropagation(); storage.markItemChangedEarly(supply.id); onRefresh(); }}
                  data-testid={`button-change-early-${supply.id}`}
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  {changeSoon ? "Changed reservoir" : "Changed early"}
                </Button>
              </div>
            );
          })()}
        </div>
      ) : (() => {
        const effectiveUsage2 = storage.getEffectiveDailyUsage(supply);
        const primingWaste = isInsulinType(supply.type) ? storage.getPrimingWastePerDay(supply.type) : 0;
        const baseUsage = effectiveUsage2 - primingWaste;
        return (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Daily usage</span>
              <span>
                {effectiveUsage2 > 0 ? effectiveUsage2 : supply.dailyUsage}/day
                {isInsulinType(supply.type) && " units"}
                {supply.type === "needle" && " needles"}
              </span>
            </div>
            {primingWaste > 0 && baseUsage > 0 && (
              <p className="text-xs text-muted-foreground">
                ({baseUsage}u dose + {primingWaste}u priming waste)
              </p>
            )}
          </div>
        );
      })()}

      {lastPickupText && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {lastPickupText}
        </div>
      )}

      {supply.quantityAtPickup && daysSincePickup !== null && daysSincePickup > 0 &&
       supply.type !== "cgm" && supply.type !== "infusion_set" && supply.type !== "reservoir" && (() => {
        const effectiveUsage2 = storage.getEffectiveDailyUsage(supply);
        const usedAmount = Math.round(daysSincePickup * effectiveUsage2);
        return (
          <div className="text-xs text-muted-foreground">
            Started with {supply.quantityAtPickup}{isInsulinType(supply.type) ? "u" : ""} • Used ~{usedAmount}{isInsulinType(supply.type) ? "u" : ""}
          </div>
        );
      })()}

      {supply.quantityAtPickup && daysSincePickup !== null && daysSincePickup > 0 && supply.type === "cgm" && (
        <div className="text-xs text-muted-foreground">
          Started with {supply.quantityAtPickup} sensor{supply.quantityAtPickup !== 1 ? "s" : ""}
        </div>
      )}

      {supply.quantityAtPickup && daysSincePickup !== null && daysSincePickup > 0 && supply.type === "infusion_set" && (
        <div className="text-xs text-muted-foreground">
          Started with {supply.quantityAtPickup} set{supply.quantityAtPickup !== 1 ? "s" : ""}
        </div>
      )}

      {supply.quantityAtPickup && daysSincePickup !== null && daysSincePickup > 0 && supply.type === "reservoir" && (
        <div className="text-xs text-muted-foreground">
          Started with {supply.quantityAtPickup} reservoir{supply.quantityAtPickup !== 1 ? "s" : ""}
        </div>
      )}
    </>
  );
  const runwayPanel =
    daysRemaining === 999
      ? {
          wrap: "rounded-xl border border-border/70 bg-background/60",
          labelClass: "text-muted-foreground",
          valueClass: "text-foreground",
          subClass: "text-muted-foreground",
        }
      : status === "critical"
        ? {
            wrap: "rounded-xl border border-red-500/45 bg-red-500/[0.12] dark:bg-red-950/45 dark:border-red-500/35",
            labelClass: "text-red-800 dark:text-red-200/90",
            valueClass: "text-red-950 dark:text-red-50",
            subClass: "text-red-900/75 dark:text-red-200/70",
          }
        : status === "low"
          ? {
              wrap: "rounded-xl border border-amber-500/45 bg-amber-500/[0.12] dark:bg-amber-950/40 dark:border-amber-500/35",
              labelClass: "text-amber-900 dark:text-amber-200/90",
              valueClass: "text-amber-950 dark:text-amber-50",
              subClass: "text-amber-900/80 dark:text-amber-200/75",
            }
          : {
              wrap: "rounded-xl border border-emerald-500/40 bg-emerald-500/[0.11] dark:bg-emerald-950/35 dark:border-emerald-500/30",
              labelClass: "text-emerald-900 dark:text-emerald-200/90",
              valueClass: "text-emerald-950 dark:text-emerald-50",
              subClass: "text-emerald-900/75 dark:text-emerald-200/75",
            };

  const stockLabel = (() => {
    if (isInsulinType(supply.type)) {
      const uPerContainer = getUnitsPerPen();
      const containerLabel = getInsulinContainerLabel(supply.type);
      const containerCount = Math.floor(adjustedQuantity / uPerContainer);
      const plural = containerCount === 1 ? containerLabel : `${containerLabel}s`;
      return { primary: `${containerCount} ${plural}`, secondary: `~${stockNowInt} units` };
    }
    if (supply.type === "cgm") {
      return { primary: `${stockNowInt} ${stockNowInt === 1 ? "sensor" : "sensors"}`, secondary: null };
    }
    if (supply.type === "infusion_set") {
      return { primary: `${stockNowInt} ${stockNowInt === 1 ? "set" : "sets"}`, secondary: null };
    }
    if (supply.type === "reservoir") {
      return { primary: `${stockNowInt} ${stockNowInt === 1 ? "reservoir" : "reservoirs"}`, secondary: null };
    }
    return { primary: String(stockNowInt), secondary: null };
  })();

  return (
    <Card
      className={[
        "overflow-hidden rounded-[1.35rem] border-border/70",
        status === "critical"
          ? "border-red-500/35 bg-red-500/[0.03]"
          : status === "low"
            ? "border-amber-500/35 bg-amber-500/[0.03]"
            : "bg-card",
      ].join(" ")}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                status === "critical"
                  ? "border-red-500/30 bg-red-500/10 dark:bg-red-950/30"
                  : status === "low"
                    ? "border-amber-500/25 bg-amber-500/10 dark:bg-amber-950/30"
                    : "border-border/60 bg-primary/10",
              ].join(" ")}
            >
              <Icon
                className={[
                  "h-4 w-4",
                  status === "critical"
                    ? "text-red-600 dark:text-red-400"
                    : status === "low"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-primary",
                ].join(" ")}
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{supply.name}</p>
                <button
                  type="button"
                  className="shrink-0"
                  onClick={() => {
                    const target = actionRowRef.current;
                    if (target) {
                      setNextActionNudge((n) => n + 1);
                      target.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                  aria-label={`Next action: ${nextAction.label}`}
                  data-testid={`button-next-action-${supply.id}`}
                >
                  <Badge
                    variant="outline"
                    className={[
                      "h-5 px-1.5 text-[10px] transition",
                      nextActionBadgeClass,
                      nextActionNudge > 0 ? "ring-2 ring-primary/30" : "",
                    ].join(" ")}
                    data-testid={`badge-next-action-${supply.id}`}
                  >
                    {nextAction.label}
                  </Badge>
                </button>
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                {typeLabels[supply.type]}
                {lastPickupText ? ` · ${lastPickupText.replace("Picked up ", "")}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onEdit(supply)}
              aria-label={`Edit ${supply.name}`}
              data-testid={`button-edit-${supply.id}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={`Delete ${supply.name}`}
                  data-testid={`button-delete-${supply.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Supply</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{supply.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(supply.id)} data-testid="button-confirm-delete">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className={`mt-2.5 grid grid-cols-2 gap-2 rounded-lg border p-2 ${runwayPanel.wrap}`}>
          <div className="min-w-0 border-r border-border/50 pr-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Stock</p>
            <div data-testid={`text-remaining-${supply.id}`}>
              <p className="text-base font-semibold tabular-nums leading-tight">{stockLabel.primary}</p>
              {stockLabel.secondary ? (
                <p className="text-[10px] text-muted-foreground">{stockLabel.secondary}</p>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 pl-0.5">
            <p className={`text-[10px] font-medium uppercase tracking-wide ${runwayPanel.labelClass}`}>Runway</p>
            {daysRemaining === 999 ? (
              <>
                <p className={`text-sm font-semibold leading-tight ${runwayPanel.valueClass}`}>No estimate</p>
                <Button asChild size="sm" variant="link" className="h-auto p-0 text-[10px]">
                  <Link href="/settings/usage#settings-usage">Set usage</Link>
                </Button>
              </>
            ) : (
              <>
                <p className={`text-base font-semibold tabular-nums leading-tight ${runwayPanel.valueClass}`}>
                  {daysRemaining}d
                </p>
                {runOutDate ? (
                  <p className={`text-[10px] ${runwayPanel.subClass}`}>until {format(runOutDate, "d MMM")}</p>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="mt-1.5 hidden sm:block">{forecastLine}</div>

        <details className="mt-1 hidden sm:block">
          <summary className="cursor-pointer select-none text-[11px] text-muted-foreground">Details</summary>
          <div className="mt-1.5 space-y-1.5 text-xs">{detailsContent}</div>
        </details>

        <details className="group mt-1.5 sm:hidden">
          <summary className="list-none cursor-pointer select-none">
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              <span>More</span>
              <ChevronDown className="h-3.5 w-3.5 group-open:hidden" />
              <ChevronUp className="hidden h-3.5 w-3.5 group-open:block" />
            </div>
          </summary>
          <div className="mt-1.5 space-y-2 text-xs">
            {forecastLine ? <div className="text-muted-foreground">{forecastLine}</div> : null}
            <div className="space-y-1.5">{detailsContent}</div>
            {history.length > 0 ? (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">History</p>
                <div className="space-y-0.5">
                  {history.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        {e.kind === "adjust" ? "Adjusted" : e.kind}
                        {typeof e.delta === "number" && e.delta !== 0 && (
                          <span
                            className={
                              e.delta < 0
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-emerald-700 dark:text-emerald-400"
                            }
                          >
                            {" "}
                            {e.delta > 0 ? `+${e.delta}` : `${e.delta}`}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0">
                        {new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>

        <div
          ref={actionRowRef}
          className={[
            "mt-2.5 flex items-center gap-1.5 border-t border-border/60 pt-2.5 transition",
            nextActionNudge > 0 ? "rounded-lg ring-2 ring-primary/20" : "",
          ].join(" ")}
        >
          <Button
            variant="default"
            size="sm"
            className="h-11 shrink-0 rounded-xl px-3.5"
            onClick={() => onLogPickup(supply)}
            data-testid={`button-refill-${supply.id}`}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Refill
          </Button>
          {(() => {
            const inc = getSupplyIncrement(supply.type);
            const currentNow = Math.floor(adjustedQuantity);
            return (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 w-11 rounded-xl px-0 text-base"
                  aria-label="Decrease quantity"
                  onClick={() => {
                    const nextQuantity = Math.max(0, currentNow - inc.amount);
                    onAdjustQuantity({
                      id: supply.id,
                      nextQuantity,
                      delta: nextQuantity - currentNow,
                      unitLabel: inc.label,
                      unitAmount: inc.amount,
                    });
                  }}
                  data-testid={`button-decrease-${supply.id}`}
                >
                  −
                </Button>
                <span
                  className="min-w-[2.75rem] text-center text-base font-semibold tabular-nums"
                  data-testid={`text-quantity-${supply.id}`}
                >
                  {Math.floor(adjustedQuantity)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 w-11 rounded-xl px-0 text-base"
                  aria-label="Increase quantity"
                  onClick={() => {
                    const nextQuantity = currentNow + inc.amount;
                    onAdjustQuantity({
                      id: supply.id,
                      nextQuantity,
                      delta: nextQuantity - currentNow,
                      unitLabel: inc.label,
                      unitAmount: inc.amount,
                    });
                  }}
                  data-testid={`button-increase-${supply.id}`}
                >
                  +
                </Button>
              </div>
            );
          })()}
        </div>

        {history.length > 0 && (
          <details className="mt-2 opacity-90 hidden sm:block">
            <summary className="text-xs text-muted-foreground cursor-pointer select-none">
              History
            </summary>
            <div className="mt-2 space-y-1">
              {history.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {e.kind === "adjust" ? "Adjusted" : e.kind}
                    {typeof e.delta === "number" && e.delta !== 0 && (
                      <span
                        className={
                          e.delta < 0
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-emerald-700 dark:text-emerald-400"
                        }
                      >
                        {" "}
                        {e.delta > 0 ? `+${e.delta}` : `${e.delta}`}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0">
                    {new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function SupplyDialogField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SupplyDialogHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/[0.05] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}

function SupplyDialog({ 
  supply, 
  open, 
  onOpenChange, 
  onSave,
  lastPrescription,
  isPumpUser,
}: { 
  supply: Supply | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Supply, "id">) => void;
  lastPrescription: LastPrescription | null;
  isPumpUser: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Supply["type"]>("needle");
  const [quantity, setQuantity] = useState("");
  const [dailyUsage, setDailyUsage] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [activeItemDate, setActiveItemDate] = useState("");
  const [showLastPrescriptionOption, setShowLastPrescriptionOption] = useState(false);

  useEffect(() => {
    if (supply) {
      setName(supply.name);
      setType(supply.type);
      setQuantity(supply.currentQuantity.toString());
      setDailyUsage(supply.dailyUsage.toString());
      setNotes(supply.notes || "");
      setPickupDate(supply.lastPickupDate ? format(new Date(supply.lastPickupDate), "yyyy-MM-dd") : "");
      setActiveItemDate(supply.activeItemStartDate ? format(new Date(supply.activeItemStartDate), "yyyy-MM-dd") : "");
      setShowLastPrescriptionOption(false);
    } else {
      setName("");
      setType("needle");
      setQuantity("");
      setNotes("");
      setPickupDate(format(new Date(), "yyyy-MM-dd"));
      setActiveItemDate("");
      setShowLastPrescriptionOption(lastPrescription !== null);
      const suggested = storage.getSuggestedDailyUsage("needle");
      setDailyUsage(suggested ? suggested.value.toString() : "");
    }
  }, [supply, open, lastPrescription]);

  const useLastPrescription = () => {
    if (lastPrescription) {
      setName(lastPrescription.name);
      let nextType = lastPrescription.type;
      if (!isPumpUser && isPumpOnlySupplyType(nextType)) {
        nextType = nextType === "insulin_vial" ? "insulin_short" : "other";
      }
      setType(nextType);
      setQuantity(lastPrescription.quantity.toString());
      const suggested = storage.getSuggestedDailyUsage(nextType);
      setDailyUsage(
        lastPrescription.type !== nextType
          ? suggested
            ? suggested.value.toString()
            : ""
          : lastPrescription.dailyUsage.toString(),
      );
      setNotes(lastPrescription.notes || "");
      setShowLastPrescriptionOption(false);
    }
  };

  const handleSubmit = () => {
    const parsedQuantity = parseFloat(quantity) || 0;
    const usesDurationSettings = type === "cgm" || type === "infusion_set" || type === "reservoir";
    onSave({
      name,
      type,
      currentQuantity: parsedQuantity,
      dailyUsage: usesDurationSettings ? 0 : (parseFloat(dailyUsage) || 0),
      notes: notes || undefined,
      lastPickupDate: pickupDate ? new Date(pickupDate + "T12:00:00").toISOString() : undefined,
      quantityAtPickup: parsedQuantity,
      activeItemStartDate: usesDurationSettings && activeItemDate ? new Date(activeItemDate + "T12:00:00").toISOString() : undefined,
    });
    onOpenChange(false);
  };

  const usesDurationSettings = type === "cgm" || type === "infusion_set" || type === "reservoir";
  const isValid = name.trim() && quantity && (usesDurationSettings || dailyUsage);
  const showPumpSupplyTypes = isPumpUser || (!!supply && isPumpOnlySupplyType(type));
  const TypeIcon = typeIcons[type] || Package;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,720px)] flex-col gap-0 overflow-hidden border-border/50 p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-3 border-b border-border/40 px-5 pb-4 pt-5 text-left">
          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <TypeIcon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle>{supply ? "Edit supply" : "Add supply"}</DialogTitle>
              <DialogDescription className="text-left">
                {supply ? "Update stock details and how the app forecasts this item." : "Add a new item to track in your inventory."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!supply && showLastPrescriptionOption && lastPrescription && (
            <SettingsPanel className="mb-4">
              <SettingsPanelBody className="flex items-center justify-between gap-3 p-3.5 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Use last prescription?</p>
                  <p className="truncate text-xs text-muted-foreground">{lastPrescription.name}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowLastPrescriptionOption(false)} data-testid="button-add-different">
                    New
                  </Button>
                  <Button size="sm" className="rounded-xl" onClick={useLastPrescription} data-testid="button-use-last">
                    Use
                  </Button>
                </div>
              </SettingsPanelBody>
            </SettingsPanel>
          )}

          <div className="space-y-5">
            <section className="space-y-3">
              <SettingsGroupLabel>Basics</SettingsGroupLabel>
              <SettingsPanel>
                <SettingsPanelBody className="space-y-4 p-4 sm:p-5">
                  <SupplyDialogField label="Name" htmlFor="name">
                    <Input
                      id="name"
                      placeholder="e.g., NovoRapid FlexPen"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="input-supply-name"
                    />
                  </SupplyDialogField>

                  <SupplyDialogField label="Type" htmlFor="type">
                    <Select
                      value={type}
                      onValueChange={(v) => {
                        const newType = v as Supply["type"];
                        setType(newType);
                        if (!supply) {
                          const suggested = storage.getSuggestedDailyUsage(newType);
                          setDailyUsage(suggested ? suggested.value.toString() : "");
                        }
                      }}
                    >
                      <SelectTrigger id="type" className="h-12 rounded-xl" data-testid="select-supply-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="needle">Needles/Lancets</SelectItem>
                        <SelectItem value="insulin_short">Short-Acting Insulin</SelectItem>
                        <SelectItem value="insulin_long">Long-Acting Insulin</SelectItem>
                        {showPumpSupplyTypes ? <PumpOnlySupplySelectItems /> : null}
                        <SelectItem value="cgm">CGM/Monitors</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </SupplyDialogField>

                  <SupplyDialogField
                    label={
                      type === "cgm"
                        ? "Number of sensors"
                        : type === "infusion_set"
                          ? "Number of infusion sets"
                          : type === "reservoir"
                            ? "Number of reservoirs"
                            : "Current quantity"
                    }
                    htmlFor="quantity"
                    hint={isInsulinType(type) ? INSULIN_STOCK_QUANTITY_HINT : undefined}
                  >
                    <Input
                      id="quantity"
                      type="number"
                      placeholder={
                        isInsulinType(type)
                          ? `e.g., ${getUnitsPerPen() * 2} (2 pens)`
                          : type === "cgm" || type === "infusion_set" || type === "reservoir"
                            ? "e.g., 10"
                            : "e.g., 50"
                      }
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      data-testid="input-supply-quantity"
                    />
                  </SupplyDialogField>
                </SettingsPanelBody>
              </SettingsPanel>
            </section>

            {type === "cgm" ? (
              <section className="space-y-3">
                <SettingsGroupLabel>Sensor tracking</SettingsGroupLabel>
                <SettingsPanel>
                  <SettingsPanelBody className="space-y-4 p-4 sm:p-5">
                    <SupplyDialogHint>
                      Depletion uses your CGM sensor duration from{" "}
                      <Link href="/settings#usage" className="font-medium text-primary underline-offset-2 hover:underline">
                        Settings → Usual Habits
                      </Link>
                      . Each sensor lasts the number of days configured there.
                    </SupplyDialogHint>
                    <SupplyDialogField
                      label="Current sensor applied on (optional)"
                      htmlFor="active-item-date"
                      hint="When did you apply your current sensor? This separates the one you're wearing from unused stock."
                    >
                      <Input
                        id="active-item-date"
                        type="date"
                        value={activeItemDate}
                        onChange={(e) => setActiveItemDate(e.target.value)}
                        data-testid="input-active-item-date"
                      />
                    </SupplyDialogField>
                  </SettingsPanelBody>
                </SettingsPanel>
              </section>
            ) : type === "infusion_set" ? (
              <section className="space-y-3">
                <SettingsGroupLabel>Site changes</SettingsGroupLabel>
                <SettingsPanel>
                  <SettingsPanelBody className="space-y-4 p-4 sm:p-5">
                    <SupplyDialogHint>
                      Depletion uses your site change frequency from{" "}
                      <Link href="/settings#usage" className="font-medium text-primary underline-offset-2 hover:underline">
                        Settings → Usual Habits
                      </Link>
                      .
                    </SupplyDialogHint>
                    <SupplyDialogField
                      label="Current set applied on (optional)"
                      htmlFor="active-item-date"
                      hint="When did you last change your infusion set? This separates your active set from unused stock."
                    >
                      <Input
                        id="active-item-date"
                        type="date"
                        value={activeItemDate}
                        onChange={(e) => setActiveItemDate(e.target.value)}
                        data-testid="input-active-item-date"
                      />
                    </SupplyDialogField>
                  </SettingsPanelBody>
                </SettingsPanel>
              </section>
            ) : type === "reservoir" ? (
              <section className="space-y-3">
                <SettingsGroupLabel>Reservoir changes</SettingsGroupLabel>
                <SettingsPanel>
                  <SettingsPanelBody className="space-y-4 p-4 sm:p-5">
                    <SupplyDialogHint>
                      Depletion uses your reservoir change frequency from{" "}
                      <Link href="/settings#usage" className="font-medium text-primary underline-offset-2 hover:underline">
                        Settings → Usual Habits
                      </Link>
                      .
                    </SupplyDialogHint>
                    <SupplyDialogField
                      label="Current reservoir changed on (optional)"
                      htmlFor="active-item-date"
                      hint="When did you last change your reservoir? This separates your active reservoir from unused stock."
                    >
                      <Input
                        id="active-item-date"
                        type="date"
                        value={activeItemDate}
                        onChange={(e) => setActiveItemDate(e.target.value)}
                        data-testid="input-active-item-date"
                      />
                    </SupplyDialogField>
                  </SettingsPanelBody>
                </SettingsPanel>
              </section>
            ) : (
              (() => {
                const suggested = storage.getSuggestedDailyUsage(type);
                return (
                  <section className="space-y-3">
                    <SettingsGroupLabel>Usage</SettingsGroupLabel>
                    <SettingsPanel>
                      <SettingsPanelBody className="space-y-3 p-4 sm:p-5">
                        <SupplyDialogField
                          label={
                            isInsulinType(type)
                              ? "Daily insulin usage (units/day)"
                              : type === "needle"
                                ? "Needles used per day"
                                : "Daily usage"
                          }
                          htmlFor="daily-usage"
                          hint={
                            type === "insulin_short"
                              ? "Short-acting (rapid) insulin units per day, e.g. NovoRapid, Humalog, Fiasp."
                              : type === "insulin_long"
                                ? "Long-acting (basal) insulin units per day, e.g. Lantus, Levemir, Tresiba."
                                : type === "insulin_vial"
                                  ? "Insulin vials for pump use (typically 10ml / 1000 units)."
                                  : type === "insulin"
                                    ? "Total insulin units per day — determines how quickly pens deplete."
                                    : type === "needle"
                                      ? "Number of needles per day (typically matches injections per day)."
                                      : undefined
                          }
                        >
                          <Input
                            id="daily-usage"
                            type="number"
                            step="0.1"
                            placeholder={isInsulinType(type) ? "e.g., 40" : type === "needle" ? "e.g., 4" : "e.g., 4"}
                            value={dailyUsage}
                            onChange={(e) => setDailyUsage(e.target.value)}
                            data-testid="input-supply-daily-usage"
                          />
                          {suggested && dailyUsage === suggested.value.toString() ? (
                            <p className="text-xs font-medium text-primary">Auto-filled from {suggested.source}</p>
                          ) : null}
                        </SupplyDialogField>
                      </SettingsPanelBody>
                    </SettingsPanel>
                  </section>
                );
              })()
            )}

            <section className="space-y-3">
              <SettingsGroupLabel>Details</SettingsGroupLabel>
              <SettingsPanel>
                <SettingsPanelBody className="space-y-4 p-4 sm:p-5">
                  <SupplyDialogField
                    label="Pickup date"
                    htmlFor="pickup-date"
                    hint="When you received this supply. Used to estimate remaining quantity."
                  >
                    <Input
                      id="pickup-date"
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      data-testid="input-supply-pickup-date"
                    />
                  </SupplyDialogField>

                  <SupplyDialogField label="Notes (optional)" htmlFor="notes">
                    <Input
                      id="notes"
                      placeholder="Any additional notes…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      data-testid="input-supply-notes"
                    />
                  </SupplyDialogField>
                </SettingsPanelBody>
              </SettingsPanel>
            </section>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border/40 bg-muted/15 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="min-h-10 w-full rounded-xl sm:w-auto"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-supply"
          >
            Cancel
          </Button>
          <Button
            className="min-h-10 w-full rounded-xl sm:w-auto"
            onClick={handleSubmit}
            disabled={!isValid}
            data-testid="button-save-supply"
          >
            {supply ? "Save changes" : "Add supply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefillDialog({
  supply,
  open,
  onOpenChange,
  onConfirm
}: {
  supply: Supply | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quantity: number, saveAsTypical: boolean) => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [saveAsTypical, setSaveAsTypical] = useState(false);
  const hasTypicalQuantity = supply?.typicalRefillQuantity && supply.typicalRefillQuantity > 0;

  useEffect(() => {
    if (supply && open) {
      if (supply.typicalRefillQuantity && supply.typicalRefillQuantity > 0) {
        setQuantity(supply.typicalRefillQuantity.toString());
        setSaveAsTypical(false);
      } else {
        setQuantity("");
        setSaveAsTypical(true);
      }
    }
  }, [supply, open]);

  const handleQuickRefill = () => {
    if (supply?.typicalRefillQuantity) {
      onConfirm(supply.typicalRefillQuantity, false);
      onOpenChange(false);
    }
  };

  const handleConfirm = () => {
    const qty = parseFloat(quantity) || 0;
    onConfirm(qty, saveAsTypical);
    onOpenChange(false);
  };

  const parsedQty = parseFloat(quantity) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log pickup: {supply?.name}</DialogTitle>
          <DialogDescription>
            Use this when you have collected this item from the pharmacy. Enter how much you received — your stock and
            pickup date update so forecasts stay accurate.
          </DialogDescription>
        </DialogHeader>
        
        {hasTypicalQuantity && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Quick pickup</p>
                  <p className="text-xs text-muted-foreground">
                    Your usual: {supply?.typicalRefillQuantity} units
                  </p>
                </div>
                <Button onClick={handleQuickRefill} data-testid="button-quick-refill">
                  Log usual amount
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pickup-quantity">
              {hasTypicalQuantity ? "Or enter different quantity" : "Quantity received"}
            </Label>
            <Input
              id="pickup-quantity"
              type="number"
              placeholder="e.g., 50"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              data-testid="input-pickup-quantity"
            />
            {parsedQty > 0 && (
              <p className="text-xs text-muted-foreground">
                New supply level: {parsedQty}
              </p>
            )}
          </div>
          
          {parsedQty > 0 && !hasTypicalQuantity && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="save-typical"
                checked={saveAsTypical}
                onChange={(e) => setSaveAsTypical(e.target.checked)}
                className="rounded"
                data-testid="checkbox-save-typical"
              />
              <Label htmlFor="save-typical" className="text-sm font-normal cursor-pointer">
                Remember this as my usual refill amount
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-refill">Cancel</Button>
          <Button 
            onClick={handleConfirm} 
            disabled={parsedQty <= 0} 
            data-testid="button-confirm-pickup"
          >
            Confirm pickup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Supplies() {
  const { toast } = useToast();
  const search = useSearch();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [lastPrescription, setLastPrescription] = useState<LastPrescription | null>(null);
  const [usualPrescription, setUsualPrescription] = useState<UsualPrescription | null>(null);
  const [pickupDialogOpen, setPickupDialogOpen] = useState(false);
  const [pickupSupply, setPickupSupply] = useState<Supply | null>(null);
  const [previousSupplies, setPreviousSupplies] = useState<Supply[] | null>(null);
  const [prescriptionCycle, setPrescriptionCycle] = useState<PrescriptionCycle | null>(null);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(() => storage.getProfile());
  const [activeTab, setActiveTab] = useState("all");
  const [highlightedSupplyId, setHighlightedSupplyId] = useState<string | null>(null);
  const [usualDialogOpen, setUsualDialogOpen] = useState(false);
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const lastSupplyDeepLinkKey = useRef<string | null>(null);

  useEffect(() => {
    storage.autoAdvanceActiveItemDates();
    setSupplies(storage.getSupplies());
    setLastPrescription(storage.getLastPrescription());
    setUsualPrescription(storage.getUsualPrescription());
    setPrescriptionCycle(storage.getPrescriptionCycle());
    setScenarioState(storage.getScenarioState());
    setLocalProfile(storage.getProfile());
    trackFeatureEngagement("supplies");
  }, []);

  useEffect(() => {
    const onScenario = () => setScenarioState(storage.getScenarioState());
    window.addEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, onScenario);
    return () => window.removeEventListener(DIABEATER_SCENARIO_STATE_CHANGED_EVENT, onScenario);
  }, []);

  useEffect(() => {
    const onProfile = () => setLocalProfile(storage.getProfile());
    window.addEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
    return () => window.removeEventListener(DIABEATER_PROFILE_CHANGED_EVENT, onProfile);
  }, []);

  const refreshSupplies = () => {
    storage.autoAdvanceActiveItemDates();
    setSupplies(storage.getSupplies());
    setUsualPrescription(storage.getUsualPrescription());
  };

  const maybeNotifyLowSupplies = async () => {
    const { edgeFailure } = await runSupplyLowInAppNotifyScan();
    if (edgeFailure) {
      toast({
        title: NOTIFY_EDGE_FAILURE_TITLE,
        description: notifyEdgeFailureDescription(edgeFailure),
        variant: "destructive",
      });
    }
  };

  const saveStateForUndo = () => {
    setPreviousSupplies([...storage.getSupplies()]);
  };

  const handleAddUsualPrescription = () => {
    saveStateForUndo();
    const result = storage.addUsualPrescriptionSupplies();
    if (result.added > 0 || result.merged > 0) {
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} new`);
      if (result.merged > 0) parts.push(`${result.merged} merged`);
      toast({ 
        title: "Usual prescription added", 
        description: `${parts.join(", ")} item${(result.added + result.merged) > 1 ? "s" : ""} from your usual prescription.` 
      });
      refreshSupplies();
    } else {
      setPreviousSupplies(null);
      toast({ 
        title: "No usual prescription saved", 
        description: "Add supplies first, then save them as your usual prescription.",
        variant: "destructive"
      });
    }
  };

  const handleSaveAsUsualPrescription = () => {
    if (supplies.length === 0) {
      toast({ 
        title: "No supplies to save", 
        description: "Add some supplies first before saving as your usual prescription.",
        variant: "destructive"
      });
      return;
    }
    storage.saveCurrentSuppliesAsUsualPrescription();
    setUsualPrescription(storage.getUsualPrescription());
    toast({ 
      title: "Usual prescription saved", 
      description: `Saved ${supplies.length} item${supplies.length > 1 ? "s" : ""} as your usual prescription.` 
    });
  };

  const handleSaveUsualPrescription = (items: UsualPrescriptionItem[]) => {
    storage.saveUsualPrescription(items);
    setUsualPrescription(storage.getUsualPrescription());
    toast({
      title: "Usual prescription updated",
      description: items.length > 0 
        ? `Saved ${items.length} item${items.length > 1 ? "s" : ""} as your usual prescription.`
        : "Usual prescription cleared.",
    });
  };

  const handleSavePrescriptionCycle = (cycle: PrescriptionCycle) => {
    storage.savePrescriptionCycle(cycle);
    setPrescriptionCycle(cycle);
    toast({ title: "Prescription cycle saved", description: "Your prescription schedule has been updated." });
  };

  const nextActionHintBySupplyId = useMemo(() => {
    const advice = storage.getSmartPrescriptionAdvice(supplies);
    const map = new Map<string, { label: string; tone: "muted" | "amber" | "red" | "blue" }>();

    for (const { supply, daysUntilCollect } of advice.collectSoon) {
      const urgent = daysUntilCollect <= 0;
      map.set(supply.id, {
        label: urgent ? "Order now" : "Order soon",
        tone: urgent ? "red" : "amber",
      });
    }

    return map;
  }, [supplies, prescriptionCycle]);

  const handleAddNew = () => {
    setEditingSupply(null);
    setDialogOpen(true);
  };

  const handleEdit = (supply: Supply) => {
    setEditingSupply(supply);
    setDialogOpen(true);
  };

  const handleSave = (data: Omit<Supply, "id">) => {
    const queueCloudUpsert = (localId: string) => {
      void maybeNotifyLowSupplies();
      void import("@/lib/supplies").then((m) => {
        const local = storage.getSupplies().find((s) => s.id === localId);
        if (!local) return;
        void m.syncToCloud(local);
      });
    };

    if (editingSupply) {
      const updated = storage.updateSupply(editingSupply.id, data);
      toast({ title: "Supply updated", description: `${data.name} has been updated.` });
      if (updated) queueCloudUpsert(updated.id);
    } else {
      const result = storage.addSupply(data);
      storage.saveLastPrescription({
        name: data.name,
        type: data.type,
        quantity: data.currentQuantity,
        dailyUsage: data.dailyUsage,
        notes: data.notes,
      });
      setLastPrescription(storage.getLastPrescription());
      if (result.merged) {
        toast({ title: "Supply merged", description: `Added ${data.currentQuantity} to existing ${data.name}.` });
      } else {
        toast({ title: "Supply added", description: `${data.name} has been added to your inventory.` });
      }
      queueCloudUpsert(result.supply.id);
    }
    refreshSupplies();
  };

  const handleDelete = (id: string) => {
    saveStateForUndo();
    const supply = supplies.find(s => s.id === id);
    storage.deleteSupply(id);
    if (supply) {
      void import("@/lib/supplies").then((m) => void m.deleteFromCloud(supply));
    }
    toast({ title: "Supply deleted", description: supply ? `${supply.name} has been removed.` : "Supply removed." });
    refreshSupplies();
  };

  const handleUndo = () => {
    if (previousSupplies) {
      localStorage.setItem("diabeater_supplies", JSON.stringify(previousSupplies));
      toast({ title: "Undo successful", description: "Changes have been reverted." });
      setPreviousSupplies(null);
      refreshSupplies();
    }
  };

  const handleAdjustQuantity = (args: {
    id: string;
    nextQuantity: number;
    delta: number;
    unitLabel: string;
    unitAmount: number;
  }) => {
    const updated = storage.setSupplyRemainingNow(args.id, args.nextQuantity);
    if (updated) {
      void maybeNotifyLowSupplies();
      void import("@/lib/supplies").then((m) => void m.syncToCloud(updated));

      const evt = addLocalSupplyEvent({
        supplyId: args.id,
        kind: "adjust",
        delta: args.delta,
        stockNow: args.nextQuantity,
        createdAt: new Date().toISOString(),
        meta: {
          source: "stepper",
          unitLabel: args.unitLabel,
          unitAmount: args.unitAmount,
          supplyName: updated.name,
          ...(updated.cloud_id ? { cloudSupplyId: updated.cloud_id } : {}),
        },
      });
      enqueueSupplyEventForCloud(evt);

      const prevQuantity = args.nextQuantity - args.delta;
      toast({
        title: "Stock updated",
        description: `${args.delta > 0 ? "+" : ""}${args.delta} (${args.unitLabel})`,
        action: (
          <ToastAction
            altText="Undo"
            onClick={() => {
              const undoUpdated = storage.setSupplyRemainingNow(args.id, prevQuantity);
              if (undoUpdated) {
                void maybeNotifyLowSupplies();
                void import("@/lib/supplies").then((m) => void m.syncToCloud(undoUpdated));
                const undoEvt = addLocalSupplyEvent({
                  supplyId: args.id,
                  kind: "adjust",
                  delta: -args.delta,
                  stockNow: prevQuantity,
                  createdAt: new Date().toISOString(),
                  meta: {
                    source: "undo",
                    unitLabel: args.unitLabel,
                    unitAmount: args.unitAmount,
                    supplyName: undoUpdated.name,
                    ...(undoUpdated.cloud_id ? { cloudSupplyId: undoUpdated.cloud_id } : {}),
                  },
                });
                enqueueSupplyEventForCloud(undoEvt);
              }
              refreshSupplies();
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    }
    refreshSupplies();
  };

  const handleLogPickup = (supply: Supply) => {
    setPickupSupply(supply);
    setPickupDialogOpen(true);
  };

  const handleConfirmRefill = (quantity: number, saveAsTypical: boolean) => {
    if (pickupSupply) {
      const updates: Partial<Supply> = { 
        currentQuantity: quantity,
        quantityAtPickup: quantity,
        lastPickupDate: new Date().toISOString(),
        isOnOrder: false,
        orderedDate: undefined,
      };
      
      if (saveAsTypical) {
        updates.typicalRefillQuantity = quantity;
      }
      
      const updated = storage.updateSupply(pickupSupply.id, updates);
      if (updated) {
        void maybeNotifyLowSupplies();
        void import("@/lib/supplies").then((m) => void m.syncToCloud(updated));
      }
      storage.addPickupRecord(pickupSupply.id, pickupSupply.name, quantity);
      toast({ 
        title: "Pickup recorded", 
        description: `${pickupSupply.name}: logged ${quantity} received from the pharmacy.${saveAsTypical ? " Saved as your usual amount." : ""}` 
      });
      refreshSupplies();
    }
  };

  const filterByType = (type: string) => {
    if (type === "all") return supplies;
    if (type === "insulin") return supplies.filter(s => isInsulinType(s.type));
    return supplies.filter(s => s.type === type);
  };

  const profile = localProfile;
  const isPumpUser = isPumpDeliveryMethod(profile?.insulinDeliveryMethod);
  const showInfusionTab = isPumpUser || filterByType("infusion_set").length > 0;
  const showReservoirTab = isPumpUser || filterByType("reservoir").length > 0;
  const supplyTabValues = [
    "all",
    "needle",
    "insulin",
    "cgm",
    ...(showInfusionTab ? (["infusion_set"] as const) : []),
    ...(showReservoirTab ? (["reservoir"] as const) : []),
  ] as const;

  useEffect(() => {
    if (activeTab === "infusion_set" && !showInfusionTab) {
      setActiveTab("all");
    } else if (activeTab === "reservoir" && !showReservoirTab) {
      setActiveTab("all");
    }
  }, [activeTab, showInfusionTab, showReservoirTab]);

  const lowStockCount = supplies.filter(s => storage.getSupplyStatus(s) !== "ok").length;
  const criticalSupplies = supplies.filter((s) => storage.getSupplyStatus(s) === "critical");
  const lowSupplies = supplies.filter((s) => storage.getSupplyStatus(s) === "low");

  const handleTimelineClick = (supplyId: string) => {
    setActiveTab("all");
    setHighlightedSupplyId(supplyId);
    setTimeout(() => {
      const el = document.getElementById(`supply-card-${supplyId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    setTimeout(() => setHighlightedSupplyId(null), 2000);
  };

  useEffect(() => {
    const qs = (search || "").replace(/^\?/, "");
    const params = new URLSearchParams(qs);
    const supplyId = params.get("supply") ?? params.get("id");
    if (!supplyId) {
      lastSupplyDeepLinkKey.current = null;
      return;
    }
    if (supplies.length === 0) return;
    if (!supplies.some((s) => s.id === supplyId)) return;

    const dedupeKey = `${qs}|${supplyId}`;
    if (lastSupplyDeepLinkKey.current === dedupeKey) return;
    lastSupplyDeepLinkKey.current = dedupeKey;

    setActiveTab("all");
    setHighlightedSupplyId(supplyId);
    const scrollT = window.setTimeout(() => {
      document.getElementById(`supply-card-${supplyId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    const clearHighlightT = window.setTimeout(() => setHighlightedSupplyId(null), 2200);
    return () => {
      window.clearTimeout(scrollT);
      window.clearTimeout(clearHighlightT);
    };
  }, [search, supplies]);

  return (
    <PageShell variant="standard" className="relative space-y-4">
      <FaceLogoWatermark />
      <PageHeader
        leading={<PageBackButton />}
        title="Supply Tracker"
        description={
          lowStockCount > 0 ? (
            <span className="text-amber-700 dark:text-amber-400">
              {lowStockCount} item{lowStockCount > 1 ? "s" : ""} running low
            </span>
          ) : undefined
        }
        actions={
          <PageInfoDialog title="About Supply Tracker" description="Keep tabs on your diabetes supplies">
            <InfoSection title="Adding Supplies">
              <p>Click "Add Supply" to add insulin, needles, CGM sensors, or other items. Set a daily usage amount and the app will calculate when you'll run out.</p>
            </InfoSection>
            <InfoSection title="Depletion Forecasts">
              <p>Each supply shows when it will run out based on your daily usage. Red means critical (under 3 days), amber means low (under 7 days).</p>
            </InfoSection>
            <InfoSection title="Logging Refills">
              <p>When you pick up a prescription, click the refill button on any supply to add the quantity you received.</p>
            </InfoSection>
            <InfoSection title="Usual Prescription">
              <p>Save the items and amounts you normally collect on your repeat script. Tap Set usual to build the list once, then Add usual to tracker on pickup day. Quantities are what you receive each time — not what&apos;s left in stock.</p>
            </InfoSection>
            <InfoSection title="Automatic Deduction">
              <p>Quantities are automatically reduced each day based on your daily usage settings.</p>
            </InfoSection>
            <InfoSection title="Depletion Timeline">
              <p>A visual overview showing when each supply will run out, with colour-coded bars (red = critical, amber = low, green = OK).</p>
            </InfoSection>
            <InfoSection title="Reorder dates">
              <p>Optional repeat schedule for when to reorder and collect. Tap Collected today or Match refill after a pickup to keep dates accurate.</p>
            </InfoSection>
          </PageInfoDialog>
        }
      />
      <OfflineDeviceNotice variant="supplies" />

      {scenarioState.travelModeActive && (criticalSupplies.length > 0 || lowSupplies.length > 0) && (
        <Alert
          className="border-blue-300/80 bg-blue-50/70 dark:bg-blue-950/25 dark:border-blue-800/60"
          data-testid="alert-travel-low-supplies"
        >
          <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-950 dark:text-blue-100 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <span>
              Travel mode is on and some supplies are running low — consider ordering spares before you go, including
              backup hypo treatment.
            </span>
            <Button variant="outline" size="sm" className="mt-2 sm:mt-0 shrink-0" asChild>
              <Link href="/scenarios/travel">Travel checklist</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {supplies.length > 0 ? (
        <SupplyRunwayAtAGlance supplies={supplies} onSupplyClick={handleTimelineClick} />
      ) : null}

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="w-full">
          <div className="-mx-1 flex gap-2 overflow-x-auto rounded-2xl bg-muted/20 px-1 py-1 [scrollbar-width:thin]">
            <Button
              onClick={handleAddNew}
              className="h-11 shrink-0 min-w-0 rounded-xl px-3.5"
              data-testid="button-add-new-supply"
            >
              <Plus className="h-4 w-4 md:mr-1" />
              <span className="ml-1">Add</span>
            </Button>

            {usualPrescription && usualPrescription.items.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddUsualPrescription}
                className="h-11 shrink-0 min-w-0 rounded-xl px-3.5"
                data-testid="button-add-usual-prescription"
              >
                <ClipboardList className="h-4 w-4 md:mr-1" />
                <span className="ml-1">Add usual</span>
              </Button>
            ) : null}

            <Button
              variant="outline"
              onClick={() => setUsualDialogOpen(true)}
              className="h-11 shrink-0 min-w-0 rounded-xl px-3.5"
              data-testid="button-edit-usual-prescription"
            >
              <Pencil className="h-4 w-4 md:mr-1" />
              <span className="ml-1">{usualPrescription && usualPrescription.items.length > 0 ? "Usual" : "Set usual"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={!previousSupplies}
              className="h-11 shrink-0 rounded-xl px-3.5"
              data-testid="button-undo"
              aria-label="Undo"
              title="Undo"
            >
              <Undo2 className="h-4 w-4 md:mr-1" />
              <span className="ml-1">Undo</span>
            </Button>

            <Link href="/settings/usage#settings-usage">
              <Button
                variant="outline"
                size="sm"
                className="h-11 shrink-0 rounded-xl px-3.5"
                data-testid="button-usage-settings"
                aria-label="Habits"
                title="Habits"
              >
                <Settings className="h-4 w-4 md:mr-1" />
                <span className="ml-1">Habits</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              className="h-11 shrink-0 rounded-xl px-3.5"
              onClick={() => setReorderDialogOpen(true)}
              data-testid="button-toggle-planning"
            >
              <Calendar className="h-4 w-4 md:mr-1" />
              <span className="ml-1">Reorder</span>
            </Button>
          </div>
        </div>
      </div>

      {(criticalSupplies.length > 0 || lowSupplies.length > 0) && (
        <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-medium">Warnings</span>{" "}
              <span className="text-muted-foreground">
                {criticalSupplies.length > 0 ? `${criticalSupplies.length} critical` : null}
                {criticalSupplies.length > 0 && lowSupplies.length > 0 ? " • " : null}
                {lowSupplies.length > 0 ? `${lowSupplies.length} low` : null}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              {criticalSupplies.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => handleTimelineClick(criticalSupplies[0].id)}
                >
                  Jump
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="-mx-1 flex h-auto w-[calc(100%+0.5rem)] gap-1 overflow-x-auto rounded-full bg-muted/45 p-1 [scrollbar-width:thin]">
          <TabsTrigger value="all" className="shrink-0 rounded-full" data-testid="tab-all">
            All ({supplies.length})
          </TabsTrigger>
          <TabsTrigger value="needle" className="shrink-0 rounded-full" data-testid="tab-needles">
            Needles ({filterByType("needle").length})
          </TabsTrigger>
          <TabsTrigger value="insulin" className="shrink-0 rounded-full" data-testid="tab-insulin">
            Insulin ({filterByType("insulin").length})
          </TabsTrigger>
          <TabsTrigger value="cgm" className="shrink-0 rounded-full" data-testid="tab-cgm">
            CGM ({filterByType("cgm").length})
          </TabsTrigger>
          {showInfusionTab ? (
            <TabsTrigger value="infusion_set" className="shrink-0 rounded-full" data-testid="tab-infusion-sets">
              Infusion ({filterByType("infusion_set").length})
            </TabsTrigger>
          ) : null}
          {showReservoirTab ? (
            <TabsTrigger value="reservoir" className="shrink-0 rounded-full" data-testid="tab-reservoirs">
              Reservoirs ({filterByType("reservoir").length})
            </TabsTrigger>
          ) : null}
        </TabsList>

        {supplyTabValues.map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="mt-6 animate-fade-in-up">
            {filterByType(tabValue).length === 0 ? (
              <Card className="rounded-[1.35rem] border-border/60">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No supplies in this category yet.
                  </p>
                  <Button variant="outline" className="mt-4 h-12 rounded-xl" onClick={handleAddNew} data-testid="button-add-supply-empty">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Supply
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 lg:grid-cols-3">
                {filterByType(tabValue).map((supply) => (
                  <div
                    key={supply.id}
                    id={`supply-card-${supply.id}`}
                    className={`rounded-[1.35rem] transition-all duration-500 ${
                      highlightedSupplyId === supply.id
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : ""
                    }`}
                  >
                    <SupplyCard
                      supply={supply}
                      nextActionHint={nextActionHintBySupplyId.get(supply.id)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onAdjustQuantity={handleAdjustQuantity}
                      onLogPickup={handleLogPickup}
                      onRefresh={() => setSupplies(storage.getSupplies())}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <SupplyDialog
        supply={editingSupply}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        lastPrescription={lastPrescription}
        isPumpUser={Boolean(isPumpUser)}
      />

      <RefillDialog
        supply={pickupSupply}
        open={pickupDialogOpen}
        onOpenChange={setPickupDialogOpen}
        onConfirm={handleConfirmRefill}
      />

      <UsualPrescriptionDialog
        open={usualDialogOpen}
        onOpenChange={setUsualDialogOpen}
        usualPrescription={usualPrescription}
        currentSupplies={supplies}
        onSave={handleSaveUsualPrescription}
        isPumpUser={Boolean(isPumpUser)}
      />

      <Dialog open={reorderDialogOpen} onOpenChange={setReorderDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reorder dates</DialogTitle>
            <DialogDescription>Optional repeat schedule for when to order and collect.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <PrescriptionCyclePanel
              cycle={prescriptionCycle}
              onSave={handleSavePrescriptionCycle}
              supplies={supplies}
              scenarioState={scenarioState}
            />
            {scenarioState.travelModeActive ? (
              <Link
                href="/scenarios/travel"
                className="flex items-center justify-between rounded-lg border border-blue-500/25 bg-blue-500/5 px-3 py-2 text-xs text-blue-800 dark:text-blue-200"
                onClick={() => setReorderDialogOpen(false)}
              >
                <span className="flex items-center gap-1.5">
                  <Plane className="h-3.5 w-3.5" />
                  Travel mode on — packing list
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
            {scenarioState.sickDayActive ? (
              <Link
                href="/scenarios?tab=sick-day"
                className="flex items-center justify-between rounded-lg border border-orange-500/25 bg-orange-500/5 px-3 py-2 text-xs text-orange-800 dark:text-orange-200"
                onClick={() => setReorderDialogOpen(false)}
              >
                <span className="flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5" />
                  Sick day mode on — guidance
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
