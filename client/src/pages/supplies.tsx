import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Package, Syringe, Activity, Settings, Calendar, RotateCcw, AlertTriangle, ClipboardList, Save, Undo2, Plug, Cylinder, TrendingDown, Plane, Thermometer, ArrowRight, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, Supply, LastPrescription, UsualPrescription, PrescriptionCycle, ScenarioState, getSupplyIncrement, getUnitsPerPen, getInsulinContainerLabel } from "@/lib/storage";
import { FaceLogoWatermark } from "@/components/face-logo";
import { Link } from "wouter";
import { formatDistanceToNow, format, differenceInDays, addDays } from "date-fns";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";

const typeIcons = {
  needle: Syringe,
  insulin: Package,
  cgm: Activity,
  infusion_set: Plug,
  reservoir: Cylinder,
  other: Package,
};

const typeLabels = {
  needle: "Needles/Lancets",
  insulin: "Insulin",
  cgm: "CGM/Monitors",
  infusion_set: "Infusion Sets",
  reservoir: "Reservoirs/Cartridges",
  other: "Other",
};

function DepletionTimeline({ supplies, onSupplyClick }: { supplies: Supply[]; onSupplyClick?: (id: string) => void }) {
  if (supplies.length === 0) return null;

  const supplyData = supplies.map(s => {
    const daysRemaining = storage.getDaysRemaining(s);
    const status = storage.getSupplyStatus(s);
    const runOutDate = storage.getRunOutDate(s);
    return { supply: s, daysRemaining: Math.min(daysRemaining, 90), actualDays: daysRemaining, status, runOutDate };
  }).sort((a, b) => a.actualDays - b.actualDays);

  const maxDays = Math.max(...supplyData.map(d => d.daysRemaining), 30);

  return (
    <Card data-testid="card-depletion-timeline">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Depletion Timeline</CardTitle>
        </div>
        <CardDescription>When each supply is predicted to run out. Tap any supply to jump to its details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span>Critical (0-3 days)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-yellow-500" />
            <span>Low (4-7 days)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span>OK (8+ days)</span>
          </div>
        </div>

        {supplyData.map(({ supply, daysRemaining, actualDays, status, runOutDate }) => {
          const barWidth = maxDays > 0 ? Math.max((daysRemaining / maxDays) * 100, 2) : 2;
          const barColor = status === "critical" ? "bg-red-500" : status === "low" ? "bg-yellow-500" : "bg-emerald-500";
          const Icon = typeIcons[supply.type] || Package;

          return (
            <button
              key={supply.id}
              type="button"
              className="w-full text-left space-y-1 rounded-md p-1.5 -mx-1.5 cursor-pointer hover-elevate transition-colors"
              onClick={() => onSupplyClick?.(supply.id)}
              data-testid={`timeline-row-${supply.id}`}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{supply.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium ${
                    status === "critical" ? "text-red-600 dark:text-red-400" : 
                    status === "low" ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"
                  }`}>
                    {actualDays >= 999 ? "N/A" : `${actualDays}d`}
                  </span>
                  {runOutDate && actualDays < 999 && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {format(runOutDate, "d MMM")}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </button>
          );
        })}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <span>Today</span>
          <span>{maxDays >= 90 ? "90+ days" : `${maxDays} days`}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PrescriptionCyclePanel({ 
  cycle, 
  onSave, 
  supplies 
}: { 
  cycle: PrescriptionCycle | null; 
  onSave: (cycle: PrescriptionCycle) => void;
  supplies: Supply[];
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

  const getNextOrderDate = (): Date | null => {
    if (!cycle) return null;
    const interval = cycle.intervalDays || 28;
    const lead = Math.min(cycle.leadTimeDays || 5, interval - 1);
    if (cycle.lastOrderDate) {
      return addDays(new Date(cycle.lastOrderDate), interval - lead);
    }
    if (cycle.lastCollectionDate) {
      return addDays(new Date(cycle.lastCollectionDate), interval - lead);
    }
    return null;
  };

  const getNextCollectionDate = (): Date | null => {
    if (!cycle) return null;
    const interval = cycle.intervalDays || 28;
    if (cycle.lastCollectionDate) {
      return addDays(new Date(cycle.lastCollectionDate), interval);
    }
    if (cycle.lastOrderDate) {
      const lead = Math.min(cycle.leadTimeDays || 5, interval - 1);
      return addDays(new Date(cycle.lastOrderDate), lead);
    }
    return null;
  };

  const getDaysUntilOrder = (): number | null => {
    const nextOrder = getNextOrderDate();
    if (!nextOrder) return null;
    return differenceInDays(nextOrder, new Date());
  };

  const getDaysUntilCollection = (): number | null => {
    const nextCollection = getNextCollectionDate();
    if (!nextCollection) return null;
    return differenceInDays(nextCollection, new Date());
  };

  const getSuppliesRunningOutBeforeCollection = (): Supply[] => {
    const nextCollection = getNextCollectionDate();
    if (!nextCollection) return [];
    const daysUntil = differenceInDays(nextCollection, new Date());
    if (daysUntil <= 0) return [];
    return supplies.filter(s => {
      const daysRemaining = storage.getDaysRemaining(s);
      return daysRemaining < daysUntil && daysRemaining < 999;
    });
  };

  const daysUntilOrder = getDaysUntilOrder();
  const daysUntilCollection = getDaysUntilCollection();
  const atRiskSupplies = getSuppliesRunningOutBeforeCollection();
  const needsSetup = !cycle;
  const orderOverdue = daysUntilOrder !== null && daysUntilOrder < 0;
  const orderSoon = daysUntilOrder !== null && daysUntilOrder >= 0 && daysUntilOrder <= 3;

  return (
    <Card data-testid="card-prescription-cycle">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Prescription Cycle</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)} data-testid="button-edit-prescription-cycle">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Track when to reorder your prescription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing || needsSetup ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="interval-days">How often do you get a prescription? (days)</Label>
              <Input 
                id="interval-days" 
                type="number" 
                placeholder="e.g., 28" 
                value={intervalDays} 
                onChange={e => setIntervalDays(e.target.value)}
                data-testid="input-interval-days"
              />
              <p className="text-xs text-muted-foreground">
                Common intervals: 28 days (monthly), 56 days (2 months), 84 days (3 months)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-time">How many days before do you need to reorder?</Label>
              <Input 
                id="lead-time" 
                type="number" 
                placeholder="e.g., 5" 
                value={leadTimeDays} 
                onChange={e => setLeadTimeDays(e.target.value)}
                data-testid="input-lead-time"
              />
              <p className="text-xs text-muted-foreground">
                Time it takes your GP surgery or pharmacy to process your repeat prescription
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-order-date">When did you last order? (optional)</Label>
              <Input 
                id="last-order-date" 
                type="date" 
                value={lastOrderDate} 
                onChange={e => setLastOrderDate(e.target.value)}
                data-testid="input-last-order-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-collection-date">When did you last collect? (optional)</Label>
              <Input 
                id="last-collection-date" 
                type="date" 
                value={lastCollectionDate} 
                onChange={e => setLastCollectionDate(e.target.value)}
                data-testid="input-last-collection-date"
              />
            </div>
            <Button onClick={handleSave} size="sm" data-testid="button-save-prescription-cycle">
              Save Prescription Cycle
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Prescription every</p>
                <p className="text-lg font-bold" data-testid="text-prescription-interval">
                  {cycle?.intervalDays || 28} days
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Reorder lead time</p>
                <p className="text-lg font-bold" data-testid="text-lead-time">
                  {cycle?.leadTimeDays || 5} days
                </p>
              </div>
            </div>

            {(daysUntilOrder !== null || daysUntilCollection !== null) && (
              <div className="space-y-2">
                {daysUntilOrder !== null && (
                  <div className={`p-3 rounded-lg ${
                    orderOverdue ? "bg-red-50 dark:bg-red-950/30" : 
                    orderSoon ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-muted/30"
                  }`} data-testid="card-next-order">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">
                          {orderOverdue ? "Reorder overdue" : "Reorder by"}
                        </p>
                        <p className={`text-sm font-medium ${
                          orderOverdue ? "text-red-700 dark:text-red-400" : 
                          orderSoon ? "text-yellow-700 dark:text-yellow-400" : ""
                        }`}>
                          {format(getNextOrderDate()!, "d MMMM yyyy")}
                        </p>
                      </div>
                      <Badge variant={orderOverdue ? "destructive" : orderSoon ? "secondary" : "outline"}>
                        {orderOverdue ? `${Math.abs(daysUntilOrder)} days overdue` : 
                         daysUntilOrder === 0 ? "Today" :
                         `${daysUntilOrder} day${daysUntilOrder !== 1 ? "s" : ""}`}
                      </Badge>
                    </div>
                  </div>
                )}

                {daysUntilCollection !== null && (
                  <div className="p-3 rounded-lg bg-muted/30" data-testid="card-next-collection">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Next collection due</p>
                        <p className="text-sm font-medium">
                          {format(getNextCollectionDate()!, "d MMMM yyyy")}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {daysUntilCollection! <= 0 ? "Now" : 
                         `${daysUntilCollection} day${daysUntilCollection !== 1 ? "s" : ""}`}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            {atRiskSupplies.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30" data-testid="card-at-risk-supplies">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      {atRiskSupplies.length === 1 ? "1 supply" : `${atRiskSupplies.length} supplies`} may run out before your next collection
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {atRiskSupplies.map(s => (
                        <p key={s.id} className="text-xs text-red-700 dark:text-red-400">
                          {s.name} — {storage.getDaysRemaining(s)} days left
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TravelImpactPanel({ supplies, scenarioState }: { supplies: Supply[]; scenarioState: ScenarioState }) {
  if (!scenarioState.travelModeActive) return null;

  const settings = storage.getSettings();
  const profile = storage.getProfile();
  const isPumpUser = profile?.insulinDeliveryMethod === "pump";

  const travelStart = scenarioState.travelStartDate ? new Date(scenarioState.travelStartDate) : new Date();
  const travelEnd = scenarioState.travelEndDate ? new Date(scenarioState.travelEndDate) : addDays(new Date(), 7);
  const tripDuration = Math.max(1, differenceInDays(travelEnd, travelStart));

  const getSupplyNeedsForTrip = () => {
    const needs: Array<{ supply: Supply; currentDaysLeft: number; daysNeededForTrip: number; shortfall: number; extraNeeded: number }> = [];
    
    for (const supply of supplies) {
      const currentDaysLeft = storage.getDaysRemaining(supply);
      if (currentDaysLeft >= 999) continue;
      
      let dailyRate: number;
      if (supply.type === "cgm") {
        const cgmDays = settings.cgmDays || 14;
        dailyRate = 1 / cgmDays;
      } else if (supply.type === "infusion_set") {
        const siteChangeDays = settings.siteChangeDays || 3;
        dailyRate = 1 / siteChangeDays;
      } else if (supply.type === "reservoir") {
        const reservoirChangeDays = settings.reservoirChangeDays || 3;
        dailyRate = 1 / reservoirChangeDays;
      } else {
        dailyRate = supply.dailyUsage;
      }
      
      if (dailyRate <= 0) continue;
      
      const travelBuffer = 2;
      const totalNeededForTrip = Math.ceil(dailyRate * tripDuration * travelBuffer);
      const currentStock = Math.floor(storage.getAdjustedQuantity(supply));
      const shortfall = totalNeededForTrip - currentStock;

      needs.push({
        supply,
        currentDaysLeft,
        daysNeededForTrip: tripDuration,
        shortfall: Math.max(0, shortfall),
        extraNeeded: Math.max(0, shortfall),
      });
    }
    
    return needs;
  };

  const needs = getSupplyNeedsForTrip();
  const suppliesAtRisk = needs.filter(n => n.currentDaysLeft < tripDuration);
  const suppliesShort = needs.filter(n => n.shortfall > 0);

  return (
    <Card className="border-blue-500/30" data-testid="card-travel-impact">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-base">Travel Supply Impact</CardTitle>
          </div>
          <Badge variant="secondary">
            {scenarioState.travelDestination || "Travel"} — {tripDuration} days
          </Badge>
        </div>
        <CardDescription>
          How your trip affects supply levels (includes 2x NHS travel buffer)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {suppliesShort.length > 0 && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30" data-testid="card-travel-shortfall">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  You may not have enough for the trip
                </p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                  With the recommended 2x travel buffer, you may need more of these:
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {needs.map(({ supply, currentDaysLeft, shortfall, extraNeeded }) => {
            const Icon = typeIcons[supply.type] || Package;
            const isShort = shortfall > 0;
            const willRunOutDuringTrip = currentDaysLeft < tripDuration;

            return (
              <div 
                key={supply.id} 
                className={`flex items-center justify-between gap-2 p-2 rounded-lg ${
                  isShort ? "bg-red-50 dark:bg-red-950/20" : 
                  willRunOutDuringTrip ? "bg-yellow-50 dark:bg-yellow-950/20" : "bg-muted/20"
                }`}
                data-testid={`travel-supply-${supply.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{supply.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isShort ? (
                    <Badge variant="destructive" className="text-xs">
                      Need {extraNeeded} more
                    </Badge>
                  ) : willRunOutDuringTrip ? (
                    <Badge variant="secondary" className="text-xs">
                      Tight — {currentDaysLeft}d left
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      OK
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Link href="/scenarios?tab=travel">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-view-travel-packing">
            View Full Packing List
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function SickDayImpactPanel({ supplies, scenarioState }: { supplies: Supply[]; scenarioState: ScenarioState }) {
  if (!scenarioState.sickDayActive) return null;

  const severity = scenarioState.sickDaySeverity || "moderate";
  const usageMultiplier = severity === "severe" ? 1.5 : severity === "moderate" ? 1.25 : 1.1;

  const getAffectedSupplies = () => {
    return supplies
      .filter(s => s.type === "insulin" || s.type === "needle" || s.type === "other")
      .map(s => {
        const normalDaysLeft = storage.getDaysRemaining(s);
        if (normalDaysLeft >= 999) return null;
        const adjustedDaysLeft = Math.floor(normalDaysLeft / usageMultiplier);
        const daysLost = normalDaysLeft - adjustedDaysLeft;
        return { supply: s, normalDaysLeft, adjustedDaysLeft, daysLost };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  };

  const affected = getAffectedSupplies();
  const testStripEstimate = severity === "severe" ? "every 2-3 hours" : severity === "moderate" ? "every 3-4 hours" : "every 4 hours";

  return (
    <Card className="border-orange-500/30" data-testid="card-sick-day-impact">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <CardTitle className="text-base">Sick Day Impact</CardTitle>
          </div>
          <Badge variant="secondary">
            {severity} severity
          </Badge>
        </div>
        <CardDescription>
          How being unwell may affect your supply usage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            When you're unwell, your body may need more insulin due to stress hormones and illness. 
            Supplies could deplete up to {Math.round((usageMultiplier - 1) * 100)}% faster than normal.
          </p>
          <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
            Not medical advice — always follow your sick day rules from your diabetes team.
          </p>
        </div>

        {affected.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Adjusted forecasts</p>
            {affected.map(({ supply, normalDaysLeft, adjustedDaysLeft, daysLost }) => {
              const Icon = typeIcons[supply.type] || Package;
              const isAtRisk = adjustedDaysLeft <= 3;

              return (
                <div 
                  key={supply.id} 
                  className={`flex items-center justify-between gap-2 p-2 rounded-lg ${
                    isAtRisk ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/20"
                  }`}
                  data-testid={`sick-supply-${supply.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{supply.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="text-muted-foreground line-through">{normalDaysLeft}d</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={`font-medium ${isAtRisk ? "text-red-600 dark:text-red-400" : ""}`}>
                      ~{adjustedDaysLeft}d
                    </span>
                    {daysLost > 0 && (
                      <span className="text-orange-600 dark:text-orange-400">
                        (-{daysLost}d)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Blood glucose testing: </span>
            NHS guidance suggests checking {testStripEstimate} when unwell. Make sure you have enough test strips.
          </p>
        </div>

        <Link href="/scenarios?tab=sickday">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-view-sick-day">
            View Sick Day Guidance
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function SupplyCard({ 
  supply, 
  onEdit, 
  onDelete, 
  onUpdateQuantity,
  onLogPickup 
}: { 
  supply: Supply; 
  onEdit: (supply: Supply) => void;
  onDelete: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onLogPickup: (supply: Supply) => void;
}) {
  const adjustedQuantity = storage.getAdjustedQuantity(supply);
  const daysRemaining = storage.getDaysRemaining(supply);
  const runOutDate = storage.getRunOutDate(supply);
  const status = storage.getSupplyStatus(supply);
  const daysSincePickup = storage.getDaysSincePickup(supply);
  const Icon = typeIcons[supply.type] || Package;

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

  return (
    <Card className={status === "critical" ? "border-red-500/50" : status === "low" ? "border-yellow-500/50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              status === "critical" ? "bg-red-500/10" : 
              status === "low" ? "bg-yellow-500/10" : "bg-primary/10"
            }`}>
              <Icon className={`h-4 w-4 ${
                status === "critical" ? "text-red-600 dark:text-red-500" : 
                status === "low" ? "text-yellow-600 dark:text-yellow-500" : "text-primary"
              }`} />
            </div>
            <div>
              <p className="font-medium text-sm">{supply.name}</p>
              <p className="text-xs text-muted-foreground">{typeLabels[supply.type]}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(supply)} data-testid={`button-edit-${supply.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-delete-${supply.id}`}>
                  <Trash2 className="h-4 w-4" />
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
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(supply.id)} data-testid="button-confirm-delete">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className={`p-3 rounded-lg mb-3 ${
          status === "critical" ? "bg-red-500/10" : 
          status === "low" ? "bg-yellow-500/10" : "bg-primary/5"
        }`}>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estimated Remaining</p>
              {supply.type === "insulin" ? (
                <div data-testid={`text-remaining-${supply.id}`}>
                  {(() => {
                    const uPerContainer = getUnitsPerPen();
                    const containerLabel = getInsulinContainerLabel();
                    const containerCount = Math.floor(adjustedQuantity / uPerContainer);
                    const remainderUnits = Math.floor(adjustedQuantity % uPerContainer);
                    const plural = containerCount === 1 ? containerLabel : `${containerLabel}s`;
                    return (
                      <>
                        <p className={`text-2xl font-bold ${
                          status === "critical" ? "text-red-600 dark:text-red-500" : 
                          status === "low" ? "text-yellow-600 dark:text-yellow-500" : ""
                        }`}>
                          {containerCount} {plural}{remainderUnits > 0 ? ` + ${remainderUnits}u` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          (~{Math.floor(adjustedQuantity)} units total)
                        </p>
                      </>
                    );
                  })()}
                </div>
              ) : supply.type === "cgm" ? (
                <p className={`text-2xl font-bold ${
                  status === "critical" ? "text-red-600 dark:text-red-500" : 
                  status === "low" ? "text-yellow-600 dark:text-yellow-500" : ""
                }`} data-testid={`text-remaining-${supply.id}`}>
                  {Math.floor(adjustedQuantity)} {Math.floor(adjustedQuantity) === 1 ? "sensor" : "sensors"}
                </p>
              ) : supply.type === "infusion_set" ? (
                <p className={`text-2xl font-bold ${
                  status === "critical" ? "text-red-600 dark:text-red-500" : 
                  status === "low" ? "text-yellow-600 dark:text-yellow-500" : ""
                }`} data-testid={`text-remaining-${supply.id}`}>
                  {Math.floor(adjustedQuantity)} {Math.floor(adjustedQuantity) === 1 ? "set" : "sets"}
                </p>
              ) : supply.type === "reservoir" ? (
                <p className={`text-2xl font-bold ${
                  status === "critical" ? "text-red-600 dark:text-red-500" : 
                  status === "low" ? "text-yellow-600 dark:text-yellow-500" : ""
                }`} data-testid={`text-remaining-${supply.id}`}>
                  {Math.floor(adjustedQuantity)} {Math.floor(adjustedQuantity) === 1 ? "reservoir" : "reservoirs"}
                </p>
              ) : (
                <p className={`text-2xl font-bold ${
                  status === "critical" ? "text-red-600 dark:text-red-500" : 
                  status === "low" ? "text-yellow-600 dark:text-yellow-500" : ""
                }`} data-testid={`text-remaining-${supply.id}`}>
                  ~{Math.floor(adjustedQuantity)}
                </p>
              )}
            </div>
            <div className="text-right">
              <Badge 
                variant={status === "critical" ? "destructive" : status === "low" ? "secondary" : "outline"}
                className="mb-1"
                data-testid={`badge-days-${supply.id}`}
              >
                {status === "critical" && <AlertTriangle className="h-3 w-3 mr-1" />}
                {daysRemaining === 999 ? "N/A" : `~${daysRemaining} days`}
              </Badge>
              {runOutDate && daysRemaining < 999 && (
                <p className="text-xs text-muted-foreground">
                  Est. run out: {format(runOutDate, "MMM d")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {supply.type === "cgm" ? (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Sensor duration</span>
              <span>{storage.getSettings().cgmDays || 14} days each</span>
            </div>
          ) : supply.type === "infusion_set" ? (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Site change</span>
              <span>Every {storage.getSettings().siteChangeDays || 3} days</span>
            </div>
          ) : supply.type === "reservoir" ? (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Reservoir change</span>
              <span>Every {storage.getSettings().reservoirChangeDays || 3} days</span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Daily usage</span>
              <span>{supply.dailyUsage}/day</span>
            </div>
          )}
          
          {lastPickupText && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {lastPickupText}
            </div>
          )}
          
          {supply.quantityAtPickup && daysSincePickup !== null && daysSincePickup > 0 && 
           supply.type !== "cgm" && supply.type !== "infusion_set" && supply.type !== "reservoir" && (
            <div className="text-xs text-muted-foreground">
              Started with {supply.quantityAtPickup} • Used ~{Math.round(daysSincePickup * supply.dailyUsage)}
            </div>
          )}
          
          {supply.quantityAtPickup && daysSincePickup !== null && daysSincePickup > 0 && supply.type === "cgm" && (
            <div className="text-xs text-muted-foreground">
              Started with {supply.quantityAtPickup} sensor{supply.quantityAtPickup !== 1 ? 's' : ''}
            </div>
          )}
          
          {supply.quantityAtPickup && daysSincePickup !== null && daysSincePickup > 0 && supply.type === "infusion_set" && (
            <div className="text-xs text-muted-foreground">
              Started with {supply.quantityAtPickup} set{supply.quantityAtPickup !== 1 ? 's' : ''}
            </div>
          )}
          
          {supply.quantityAtPickup && daysSincePickup !== null && daysSincePickup > 0 && supply.type === "reservoir" && (
            <div className="text-xs text-muted-foreground">
              Started with {supply.quantityAtPickup} reservoir{supply.quantityAtPickup !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="pt-3 mt-3 border-t space-y-2">
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1"
              onClick={() => onLogPickup(supply)}
              data-testid={`button-refill-${supply.id}`}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Refill
            </Button>
          </div>
          {(() => {
            const inc = getSupplyIncrement(supply.type);
            return (
              <div className="flex items-center justify-between gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onUpdateQuantity(supply.id, Math.max(0, Math.floor(adjustedQuantity) - inc.amount))}
                  data-testid={`button-decrease-${supply.id}`}
                >
                  -{inc.amount > 1 ? ` 1 ${inc.label}` : "1"}
                </Button>
                <span className="text-center text-sm font-medium" data-testid={`text-quantity-${supply.id}`}>
                  {Math.floor(adjustedQuantity)} {supply.type === "insulin" ? "units" : ""}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onUpdateQuantity(supply.id, Math.floor(adjustedQuantity) + inc.amount)}
                  data-testid={`button-increase-${supply.id}`}
                >
                  +{inc.amount > 1 ? ` 1 ${inc.label}` : "1"}
                </Button>
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}

function SupplyDialog({ 
  supply, 
  open, 
  onOpenChange, 
  onSave,
  lastPrescription 
}: { 
  supply: Supply | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Supply, "id">) => void;
  lastPrescription: LastPrescription | null;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Supply["type"]>("needle");
  const [quantity, setQuantity] = useState("");
  const [dailyUsage, setDailyUsage] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [showLastPrescriptionOption, setShowLastPrescriptionOption] = useState(false);

  useEffect(() => {
    if (supply) {
      setName(supply.name);
      setType(supply.type);
      setQuantity(supply.currentQuantity.toString());
      setDailyUsage(supply.dailyUsage.toString());
      setNotes(supply.notes || "");
      setPickupDate(supply.lastPickupDate ? format(new Date(supply.lastPickupDate), "yyyy-MM-dd") : "");
      setShowLastPrescriptionOption(false);
    } else {
      setName("");
      setType("needle");
      setQuantity("");
      setDailyUsage("");
      setNotes("");
      setPickupDate(format(new Date(), "yyyy-MM-dd"));
      setShowLastPrescriptionOption(lastPrescription !== null);
    }
  }, [supply, open, lastPrescription]);

  const useLastPrescription = () => {
    if (lastPrescription) {
      setName(lastPrescription.name);
      setType(lastPrescription.type);
      setQuantity(lastPrescription.quantity.toString());
      setDailyUsage(lastPrescription.dailyUsage.toString());
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
    });
    onOpenChange(false);
  };

  const usesDurationSettings = type === "cgm" || type === "infusion_set" || type === "reservoir";
  const isValid = name.trim() && quantity && (usesDurationSettings || dailyUsage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{supply ? "Edit Supply" : "Add New Supply"}</DialogTitle>
          <DialogDescription>
            {supply ? "Update the details of your supply item." : "Add a new item to track in your inventory."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2">
          {!supply && showLastPrescriptionOption && lastPrescription && (
            <Card className="bg-primary/5 border-primary/20 mb-4">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Use last prescription?</p>
                    <p className="text-xs text-muted-foreground truncate">{lastPrescription.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowLastPrescriptionOption(false)} data-testid="button-add-different">
                      New
                    </Button>
                    <Button size="sm" onClick={useLastPrescription} data-testid="button-use-last">
                      Use
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              placeholder="e.g., NovoRapid FlexPen" 
              value={name} 
              onChange={e => setName(e.target.value)}
              data-testid="input-supply-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as Supply["type"])}>
              <SelectTrigger id="type" data-testid="select-supply-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needle">Needles/Lancets</SelectItem>
                <SelectItem value="insulin">Insulin</SelectItem>
                <SelectItem value="cgm">CGM/Monitors</SelectItem>
                <SelectItem value="infusion_set">Infusion Sets (Pump)</SelectItem>
                <SelectItem value="reservoir">Reservoirs/Cartridges (Pump)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                {type === "cgm" ? "Number of Sensors" : 
                 type === "infusion_set" ? "Number of Infusion Sets" :
                 type === "reservoir" ? "Number of Reservoirs" : "Current Quantity"}
              </Label>
              <Input 
                id="quantity" 
                type="number" 
                placeholder={type === "cgm" || type === "infusion_set" || type === "reservoir" ? "e.g., 10" : "e.g., 50"}
                value={quantity} 
                onChange={e => setQuantity(e.target.value)}
                data-testid="input-supply-quantity"
              />
            </div>
            {type === "cgm" ? (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Depletion is calculated using your CGM Sensor Duration from Settings (Usual Habits). 
                  Each sensor lasts the number of days you've configured there.
                </p>
              </div>
            ) : type === "infusion_set" ? (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Depletion is calculated using your Site Change frequency from Settings (Usual Habits). 
                  Each infusion set lasts the number of days you've configured there.
                </p>
              </div>
            ) : type === "reservoir" ? (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Depletion is calculated using your Reservoir Change frequency from Settings (Usual Habits). 
                  Each reservoir lasts the number of days you've configured there.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="daily-usage">Daily Usage</Label>
                <Input 
                  id="daily-usage" 
                  type="number" 
                  step="0.1"
                  placeholder="e.g., 4" 
                  value={dailyUsage} 
                  onChange={e => setDailyUsage(e.target.value)}
                  data-testid="input-supply-daily-usage"
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pickup-date">Pickup Date</Label>
            <Input 
              id="pickup-date" 
              type="date"
              value={pickupDate} 
              onChange={e => setPickupDate(e.target.value)}
              data-testid="input-supply-pickup-date"
            />
            <p className="text-xs text-muted-foreground">
              When you received this supply. Used to estimate remaining quantity.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input 
              id="notes" 
              placeholder="Any additional notes..." 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              data-testid="input-supply-notes"
            />
          </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid} data-testid="button-save-supply">
            {supply ? "Save Changes" : "Add Supply"}
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
          <DialogTitle>Refill {supply?.name}</DialogTitle>
          <DialogDescription>
            Record your prescription refill. This resets your supply count and starts fresh tracking.
          </DialogDescription>
        </DialogHeader>
        
        {hasTypicalQuantity && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Quick refill</p>
                  <p className="text-xs text-muted-foreground">
                    Your usual: {supply?.typicalRefillQuantity} units
                  </p>
                </div>
                <Button onClick={handleQuickRefill} data-testid="button-quick-refill">
                  Refill Now
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirm} 
            disabled={parsedQty <= 0} 
            data-testid="button-confirm-pickup"
          >
            Confirm Refill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Supplies() {
  const { toast } = useToast();
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
  const [activeTab, setActiveTab] = useState("all");
  const [highlightedSupplyId, setHighlightedSupplyId] = useState<string | null>(null);

  useEffect(() => {
    setSupplies(storage.getSupplies());
    setLastPrescription(storage.getLastPrescription());
    setUsualPrescription(storage.getUsualPrescription());
    setPrescriptionCycle(storage.getPrescriptionCycle());
    setScenarioState(storage.getScenarioState());
  }, []);

  const refreshSupplies = () => {
    setSupplies(storage.getSupplies());
    setUsualPrescription(storage.getUsualPrescription());
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

  const handleSavePrescriptionCycle = (cycle: PrescriptionCycle) => {
    storage.savePrescriptionCycle(cycle);
    setPrescriptionCycle(cycle);
    toast({ title: "Prescription cycle saved", description: "Your prescription schedule has been updated." });
  };

  const handleAddNew = () => {
    setEditingSupply(null);
    setDialogOpen(true);
  };

  const handleEdit = (supply: Supply) => {
    setEditingSupply(supply);
    setDialogOpen(true);
  };

  const handleSave = (data: Omit<Supply, "id">) => {
    if (editingSupply) {
      storage.updateSupply(editingSupply.id, data);
      toast({ title: "Supply updated", description: `${data.name} has been updated.` });
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
    }
    refreshSupplies();
  };

  const handleDelete = (id: string) => {
    saveStateForUndo();
    const supply = supplies.find(s => s.id === id);
    storage.deleteSupply(id);
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

  const handleUpdateQuantity = (id: string, quantity: number) => {
    storage.updateSupply(id, { currentQuantity: quantity });
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
        lastPickupDate: new Date().toISOString()
      };
      
      if (saveAsTypical) {
        updates.typicalRefillQuantity = quantity;
      }
      
      storage.updateSupply(pickupSupply.id, updates);
      storage.addPickupRecord(pickupSupply.id, pickupSupply.name, quantity);
      toast({ 
        title: "Refill recorded", 
        description: `${pickupSupply.name} refilled with ${quantity} units.${saveAsTypical ? " Saved as your typical amount." : ""}` 
      });
      refreshSupplies();
    }
  };

  const filterByType = (type: string) => {
    if (type === "all") return supplies;
    return supplies.filter(s => s.type === type);
  };

  const lowStockCount = supplies.filter(s => storage.getSupplyStatus(s) !== "ok").length;

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

  return (
    <div className="space-y-6 relative">
      <FaceLogoWatermark />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-3xl font-semibold">Supply Tracker</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage your diabetes supplies.
              {lowStockCount > 0 && (
                <span className="text-yellow-600 dark:text-yellow-500 ml-2">
                  ({lowStockCount} item{lowStockCount > 1 ? "s" : ""} running low)
                </span>
              )}
            </p>
          </div>
          <PageInfoDialog
            title="About Supply Tracker"
            description="Keep tabs on your diabetes supplies"
          >
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
              <p>Save your typical prescription quantities so you can quickly add them when you refill. Use "Save Usual" to remember your current setup.</p>
            </InfoSection>
            <InfoSection title="Automatic Deduction">
              <p>Quantities are automatically reduced each day based on your daily usage settings.</p>
            </InfoSection>
            <InfoSection title="Depletion Timeline">
              <p>A visual overview showing when each supply will run out, with colour-coded bars (red = critical, amber = low, green = OK).</p>
            </InfoSection>
            <InfoSection title="Prescription Cycle">
              <p>Set up your repeat prescription schedule to get reminders when it's time to reorder. The app will also warn you if any supply might run out before your next collection.</p>
            </InfoSection>
            <InfoSection title="Travel & Sick Day Impact">
              <p>When Travel Mode or Sick Day Mode is active, you'll see how your supply levels are affected — including extra supplies needed for travel and adjusted depletion forecasts when unwell.</p>
            </InfoSection>
          </PageInfoDialog>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleAddNew} data-testid="button-add-new-supply">
              <Plus className="h-4 w-4 mr-1" />
              Add Supply
            </Button>
            {supplies.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleSaveAsUsualPrescription} data-testid="button-save-usual-prescription">
                <Save className="h-4 w-4 mr-1" />
                Save Usual
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleUndo} 
              disabled={!previousSupplies}
              data-testid="button-undo"
            >
              <Undo2 className="h-4 w-4 mr-1" />
              Undo
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {usualPrescription && usualPrescription.items.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleAddUsualPrescription} data-testid="button-add-usual-prescription">
                <ClipboardList className="h-4 w-4 mr-1" />
                Add Usual
              </Button>
            )}
            <Link href="/settings#usual-habits">
              <Button variant="outline" size="sm" data-testid="button-usage-settings">
                <Settings className="h-4 w-4 mr-1" />
                Habits
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {supplies.length > 0 && (
        <DepletionTimeline supplies={supplies} onSupplyClick={handleTimelineClick} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PrescriptionCyclePanel 
          cycle={prescriptionCycle} 
          onSave={handleSavePrescriptionCycle} 
          supplies={supplies}
        />
        <TravelImpactPanel supplies={supplies} scenarioState={scenarioState} />
        <SickDayImpactPanel supplies={supplies} scenarioState={scenarioState} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({supplies.length})
          </TabsTrigger>
          <TabsTrigger value="needle" data-testid="tab-needles">
            Needles ({filterByType("needle").length})
          </TabsTrigger>
          <TabsTrigger value="insulin" data-testid="tab-insulin">
            Insulin ({filterByType("insulin").length})
          </TabsTrigger>
          <TabsTrigger value="cgm" data-testid="tab-cgm">
            CGM ({filterByType("cgm").length})
          </TabsTrigger>
          <TabsTrigger value="infusion_set" data-testid="tab-infusion-sets">
            Infusion ({filterByType("infusion_set").length})
          </TabsTrigger>
          <TabsTrigger value="reservoir" data-testid="tab-reservoirs">
            Reservoirs ({filterByType("reservoir").length})
          </TabsTrigger>
        </TabsList>

        {["all", "needle", "insulin", "cgm", "infusion_set", "reservoir"].map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="mt-6">
            {filterByType(tabValue).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No supplies in this category yet.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={handleAddNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Supply
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filterByType(tabValue).map((supply) => (
                  <div
                    key={supply.id}
                    id={`supply-card-${supply.id}`}
                    className={`rounded-lg transition-all duration-500 ${
                      highlightedSupplyId === supply.id
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : ""
                    }`}
                  >
                    <SupplyCard
                      supply={supply}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onUpdateQuantity={handleUpdateQuantity}
                      onLogPickup={handleLogPickup}
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
      />

      <RefillDialog
        supply={pickupSupply}
        open={pickupDialogOpen}
        onOpenChange={setPickupDialogOpen}
        onConfirm={handleConfirmRefill}
      />
    </div>
  );
}
