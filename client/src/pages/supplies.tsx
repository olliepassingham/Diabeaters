import { useState, useEffect } from "react";
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
import { Plus, Pencil, Trash2, Package, Syringe, Activity, Settings, Calendar, RotateCcw, AlertTriangle, ClipboardList, Save, Undo2, Plug, Cylinder, TrendingDown, Plane, Thermometer, ArrowRight, Bell, ShoppingCart, CheckCircle2, X, Lightbulb, PackageCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage, Supply, LastPrescription, UsualPrescription, UsualPrescriptionItem, PrescriptionCycle, ScenarioState, getSupplyIncrement, getUnitsPerPen, getInsulinContainerLabel } from "@/lib/storage";
import { FaceLogoWatermark } from "@/components/face-logo";
import { Link } from "wouter";
import { formatDistanceToNow, format, differenceInDays, addDays } from "date-fns";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";

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

      </CardContent>
    </Card>
  );
}


function PrescriptionCyclePanel({ 
  cycle, 
  onSave, 
  supplies,
  scenarioState 
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
    const lead = Math.min(cycle.leadTimeDays || 5, interval - 1);
    if (cycle.lastOrderDate) {
      return addDays(new Date(cycle.lastOrderDate), interval - lead);
    }
    if (cycle.lastCollectionDate) {
      return addDays(new Date(cycle.lastCollectionDate), interval - lead);
    }
    return null;
  };

  const getRawNextCollectionDate = (): Date | null => {
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
    return differenceInDays(result.date, new Date());
  };

  const getDaysUntilCollection = (): number | null => {
    const result = getNextCollectionDate();
    if (!result) return null;
    return differenceInDays(result.date, new Date());
  };

  const daysUntilOrder = getDaysUntilOrder();
  const daysUntilCollection = getDaysUntilCollection();
  const orderAdjustedForTravel = getNextOrderDate()?.adjusted || false;
  const collectionAdjustedForTravel = getNextCollectionDate()?.adjusted || false;
  const needsSetup = !cycle;
  const orderOverdue = daysUntilOrder !== null && daysUntilOrder < 0;
  const orderSoon = daysUntilOrder !== null && daysUntilOrder >= 0 && daysUntilOrder <= 3;

  const advice = storage.getSmartPrescriptionAdvice(supplies);
  const hasAdvice = advice.collectSoon.length > 0 || advice.skipSuggestions.length > 0 || advice.travelExtras.length > 0;

  return (
    <Card data-testid="card-prescription-cycle" className={advice.collectSoon.length > 0 ? "border-amber-500/40" : ""}>
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
        <CardDescription>Smart prescription tracking based on your actual supply levels</CardDescription>
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
              <Label htmlFor="lead-time">How many days does it take to process your prescription?</Label>
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
                <p className="text-xs text-muted-foreground mb-1">Processing time</p>
                <p className="text-lg font-bold" data-testid="text-lead-time">
                  {cycle?.leadTimeDays || 5} days
                </p>
              </div>
            </div>

            {(daysUntilOrder !== null || daysUntilCollection !== null) && (
              <div className="space-y-2">
                {daysUntilOrder !== null && (
                  <div className={`p-3 rounded-lg ${
                    orderAdjustedForTravel ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800" :
                    orderOverdue ? "bg-red-50 dark:bg-red-950/30" : 
                    orderSoon ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-muted/30"
                  }`} data-testid="card-next-order">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">
                          {orderAdjustedForTravel ? "Reorder before trip" : orderOverdue ? "Reorder overdue" : "Reorder by"}
                        </p>
                        <p className={`text-sm font-medium ${
                          orderAdjustedForTravel ? "text-blue-700 dark:text-blue-400" :
                          orderOverdue ? "text-red-700 dark:text-red-400" : 
                          orderSoon ? "text-yellow-700 dark:text-yellow-400" : ""
                        }`}>
                          {format(getNextOrderDate()!.date, "d MMMM yyyy")}
                        </p>
                        {orderAdjustedForTravel && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                            <Plane className="h-3 w-3" />
                            Moved earlier — your trip starts {format(travelStart!, "d MMM")}
                          </p>
                        )}
                      </div>
                      <Badge variant={orderAdjustedForTravel ? "secondary" : orderOverdue ? "destructive" : orderSoon ? "secondary" : "outline"}>
                        {orderOverdue ? `${Math.abs(daysUntilOrder)} days overdue` : 
                         daysUntilOrder === 0 ? "Today" :
                         `${daysUntilOrder} day${daysUntilOrder !== 1 ? "s" : ""}`}
                      </Badge>
                    </div>
                  </div>
                )}

                {daysUntilCollection !== null && (
                  <div className={`p-3 rounded-lg ${
                    collectionAdjustedForTravel ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800" : "bg-muted/30"
                  }`} data-testid="card-next-collection">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">
                          {collectionAdjustedForTravel ? "Collect before trip" : "Next collection due"}
                        </p>
                        <p className={`text-sm font-medium ${collectionAdjustedForTravel ? "text-blue-700 dark:text-blue-400" : ""}`}>
                          {format(getNextCollectionDate()!.date, "d MMMM yyyy")}
                        </p>
                        {collectionAdjustedForTravel && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                            <Plane className="h-3 w-3" />
                            Moved earlier — your trip starts {format(travelStart!, "d MMM")}
                          </p>
                        )}
                      </div>
                      <Badge variant={collectionAdjustedForTravel ? "secondary" : "outline"}>
                        {daysUntilCollection! <= 0 ? "Now" : 
                         `${daysUntilCollection} day${daysUntilCollection !== 1 ? "s" : ""}`}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            {advice.orderedSupplies.length > 0 && (
              <div className="space-y-2" data-testid="section-ordered-supplies">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">On Order</p>
                {advice.orderedSupplies.map(({ supply, daysSinceOrder, estimatedCollectBy }) => {
                  const Icon = typeIcons[supply.type] || Package;
                  const isReady = estimatedCollectBy === 0;
                  return (
                    <div key={supply.id} className={`flex items-center justify-between gap-2 p-2 rounded-lg ${isReady ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-blue-50 dark:bg-blue-950/20"}`} data-testid={`ordered-item-${supply.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${isReady ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"}`} />
                        <div className="min-w-0">
                          <span className="text-sm truncate block">{supply.name}</span>
                          <span className="text-xs text-muted-foreground">Ordered {daysSinceOrder === 0 ? "today" : `${daysSinceOrder}d ago`}</span>
                        </div>
                      </div>
                      <Badge variant={isReady ? "default" : "secondary"} className="shrink-0 text-xs">
                        {isReady ? "Ready to collect" : `~${estimatedCollectBy}d until ready`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {advice.collectSoon.length > 0 && (
              <div className="space-y-2" data-testid="section-collect-soon">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Action Needed</p>
                {advice.collectSoon.map(({ supply, daysUntilCollect, reason }) => {
                  const Icon = typeIcons[supply.type] || Package;
                  const isUrgent = daysUntilCollect <= 0;
                  return (
                    <div key={supply.id} className={`p-2.5 rounded-lg ${isUrgent ? "bg-red-50 dark:bg-red-950/20" : "bg-amber-50 dark:bg-amber-950/20"}`} data-testid={`collect-item-${supply.id}`}>
                      <div className="flex items-start gap-2">
                        {isUrgent ? (
                          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                        ) : (
                          <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        )}
                        <p className={`text-sm ${isUrgent ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
                          {reason}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {advice.travelExtras.length > 0 && (
              <div className="space-y-2" data-testid="section-travel-extras">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Plane className="h-3 w-3 inline mr-1" />
                  Extra for Travel
                </p>
                {advice.travelExtras.map(({ supply, extraNeeded, reason }) => {
                  const Icon = typeIcons[supply.type] || Package;
                  return (
                    <div key={supply.id} className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20" data-testid={`travel-extra-${supply.id}`}>
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-blue-800 dark:text-blue-300">{reason}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {advice.skipSuggestions.length > 0 && (
              <div className="space-y-2" data-testid="section-skip-suggestions">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Lightbulb className="h-3 w-3 inline mr-1" />
                  Next Prescription Suggestions
                </p>
                {advice.skipSuggestions.map(({ supply, daysRemaining, reason }) => {
                  const Icon = typeIcons[supply.type] || Package;
                  return (
                    <div key={supply.id} className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20" data-testid={`skip-item-${supply.id}`}>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-emerald-800 dark:text-emerald-300">
                          {reason}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!hasAdvice && supplies.length > 0 && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20" data-testid="card-all-good">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-sm text-emerald-800 dark:text-emerald-300">
                    All supplies looking good. No action needed right now.
                  </p>
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
      .filter(s => isInsulinType(s.type) || s.type === "needle" || s.type === "other")
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

function CombinedScenarioImpactPanel({ supplies, scenarioState }: { supplies: Supply[]; scenarioState: ScenarioState }) {
  if (!scenarioState.travelModeActive || !scenarioState.sickDayActive) return null;

  const severity = scenarioState.sickDaySeverity || "moderate";

  const sickDayMultipliers: Record<string, number> = {
    insulin_short: severity === "severe" ? 1.3 : severity === "moderate" ? 1.2 : 1.1,
    insulin_long: 1.0,
    insulin: severity === "severe" ? 1.3 : severity === "moderate" ? 1.2 : 1.1,
    needle: severity === "severe" ? 1.5 : severity === "moderate" ? 1.3 : 1.1,
    cgm: 1.0,
    infusion_set: severity === "severe" ? 1.3 : 1.0,
    reservoir: severity === "severe" ? 1.2 : 1.0,
  };

  const travelStart = scenarioState.travelStartDate ? new Date(scenarioState.travelStartDate) : new Date();
  const travelEnd = scenarioState.travelEndDate ? new Date(scenarioState.travelEndDate) : addDays(new Date(), 7);
  const tripDuration = Math.max(1, differenceInDays(travelEnd, travelStart));
  const travelBuffer = 2;

  const settings = storage.getSettings();

  const getCombinedImpact = () => {
    return supplies
      .filter(s => s.dailyUsage > 0 && s.currentQuantity > 0)
      .map(s => {
        let dailyRate: number;
        if (s.type === "cgm") {
          dailyRate = 1 / (settings.cgmDays || 14);
        } else if (s.type === "infusion_set") {
          dailyRate = 1 / (settings.siteChangeDays || 3);
        } else if (s.type === "reservoir") {
          dailyRate = 1 / (settings.reservoirChangeDays || 3);
        } else {
          dailyRate = s.dailyUsage;
        }
        if (dailyRate <= 0) return null;

        const normalDaysLeft = Math.min(365, Math.floor(s.currentQuantity / dailyRate));

        const effectiveMultiplier = sickDayMultipliers[s.type] || 1.0;
        const combinedDailyRate = dailyRate * effectiveMultiplier;
        const combinedDaysLeft = Math.min(365, Math.floor(s.currentQuantity / combinedDailyRate));

        const totalNeededForTrip = Math.ceil(combinedDailyRate * tripDuration * travelBuffer);
        const shortfall = Math.max(0, totalNeededForTrip - s.currentQuantity);

        return {
          supply: s,
          normalDaysLeft,
          combinedDaysLeft,
          daysLost: normalDaysLeft - combinedDaysLeft,
          shortfall,
          effectiveMultiplier,
          willRunOutDuringTrip: combinedDaysLeft < tripDuration,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  };

  const combined = getCombinedImpact();
  const atRisk = combined.filter(c => c.willRunOutDuringTrip || c.shortfall > 0);

  return (
    <Card className="border-red-500/30 lg:col-span-2" data-testid="card-combined-scenario-impact">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <CardTitle className="text-base">Combined Scenario Impact</CardTitle>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-xs">
              <Plane className="h-3 w-3 mr-1" />
              {scenarioState.travelDestination || "Travel"} — {tripDuration}d
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Thermometer className="h-3 w-3 mr-1" />
              {severity} sick day
            </Badge>
          </div>
        </div>
        <CardDescription>
          Travelling while unwell — your supplies face higher demand from both scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
          <p className="text-sm text-red-800 dark:text-red-200">
            Being unwell while travelling creates a compounding effect on your supplies. Illness increases insulin and testing needs, while travel requires extra buffer stock. Plan for both.
          </p>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
            Not medical advice — contact your diabetes team before travelling while unwell.
          </p>
        </div>

        {atRisk.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">Supplies at risk</p>
            {atRisk.map(({ supply, normalDaysLeft, combinedDaysLeft, shortfall }) => {
              const Icon = typeIcons[supply.type] || Package;
              return (
                <div 
                  key={supply.id} 
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20"
                  data-testid={`combined-supply-${supply.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{supply.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="text-muted-foreground line-through">{normalDaysLeft}d</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-red-600 dark:text-red-400">~{combinedDaysLeft}d</span>
                    {shortfall > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        Need {shortfall} more
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {combined.filter(c => !c.willRunOutDuringTrip && c.shortfall === 0).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplies OK for trip</p>
            {combined.filter(c => !c.willRunOutDuringTrip && c.shortfall === 0).map(({ supply, normalDaysLeft, combinedDaysLeft }) => {
              const Icon = typeIcons[supply.type] || Package;
              return (
                <div 
                  key={supply.id} 
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/20"
                  data-testid={`combined-supply-ok-${supply.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{supply.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="text-muted-foreground">{normalDaysLeft}d</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">~{combinedDaysLeft}d</span>
                    <Badge variant="outline" className="text-xs">OK</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SupplyCard({ 
  supply, 
  onEdit, 
  onDelete, 
  onUpdateQuantity,
  onLogPickup,
  onMarkOrdered,
  onClearOrder,
}: { 
  supply: Supply; 
  onEdit: (supply: Supply) => void;
  onDelete: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onLogPickup: (supply: Supply) => void;
  onMarkOrdered: (id: string) => void;
  onClearOrder: (id: string) => void;
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
    <Card className={status === "critical" ? "border-red-500/50 glow-critical" : status === "low" ? "border-yellow-500/50 glow-warning" : ""}>
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
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
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
              {isInsulinType(supply.type) ? (
                <div data-testid={`text-remaining-${supply.id}`}>
                  {(() => {
                    const uPerContainer = getUnitsPerPen();
                    const containerLabel = getInsulinContainerLabel(supply.type);
                    const containerCount = Math.floor(adjustedQuantity / uPerContainer);
                    const plural = containerCount === 1 ? containerLabel : `${containerLabel}s`;
                    return (
                      <>
                        <p className={`text-2xl font-bold ${
                          status === "critical" ? "text-red-600 dark:text-red-500" : 
                          status === "low" ? "text-yellow-600 dark:text-yellow-500" : ""
                        }`}>
                          {containerCount} {plural}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ~{Math.floor(adjustedQuantity)} units remaining
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
                  ~{Math.floor(adjustedQuantity)}{supply.type === "needle" ? " needles" : ""}
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
            <div className="space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Sensor duration</span>
                <span>{storage.getSettings().cgmDays || 14} days each</span>
              </div>
              {supply.activeItemStartDate && (() => {
                const settings = storage.getSettings();
                const itemDuration = settings.cgmDays || 14;
                const activeStart = new Date(supply.activeItemStartDate);
                const today = new Date();
                activeStart.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                const daysSinceActive = Math.floor((today.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24));
                const daysLeft = Math.max(0, itemDuration - daysSinceActive);
                const isExpired = daysLeft === 0;
                return (
                  <div className={`flex items-center justify-between ${isExpired ? "text-yellow-600 dark:text-yellow-500" : "text-muted-foreground"}`}>
                    <span>Active sensor</span>
                    <span>{isExpired ? "Due for change" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}</span>
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
                const settings = storage.getSettings();
                const itemDuration = settings.siteChangeDays || 3;
                const activeStart = new Date(supply.activeItemStartDate);
                const today = new Date();
                activeStart.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                const daysSinceActive = Math.floor((today.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24));
                const daysLeft = Math.max(0, itemDuration - daysSinceActive);
                const isExpired = daysLeft === 0;
                return (
                  <div className={`flex items-center justify-between ${isExpired ? "text-yellow-600 dark:text-yellow-500" : "text-muted-foreground"}`}>
                    <span>Active set</span>
                    <span>{isExpired ? "Due for change" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}</span>
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
                const settings = storage.getSettings();
                const itemDuration = settings.reservoirChangeDays || 3;
                const activeStart = new Date(supply.activeItemStartDate);
                const today = new Date();
                activeStart.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                const daysSinceActive = Math.floor((today.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24));
                const daysLeft = Math.max(0, itemDuration - daysSinceActive);
                const isExpired = daysLeft === 0;
                return (
                  <div className={`flex items-center justify-between ${isExpired ? "text-yellow-600 dark:text-yellow-500" : "text-muted-foreground"}`}>
                    <span>Active reservoir</span>
                    <span>{isExpired ? "Due for change" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}</span>
                  </div>
                );
              })()}
            </div>
          ) : (() => {
            const effectiveUsage = storage.getEffectiveDailyUsage(supply);
            const primingWaste = isInsulinType(supply.type) ? storage.getPrimingWastePerDay(supply.type) : 0;
            const baseUsage = effectiveUsage - primingWaste;
            return (
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Daily usage</span>
                  <span>
                    {effectiveUsage > 0 ? effectiveUsage : supply.dailyUsage}/day
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
            const effectiveUsage = storage.getEffectiveDailyUsage(supply);
            const usedAmount = Math.round(daysSincePickup * effectiveUsage);
            return (
              <div className="text-xs text-muted-foreground">
                Started with {supply.quantityAtPickup}{isInsulinType(supply.type) ? "u" : ""} • Used ~{usedAmount}{isInsulinType(supply.type) ? "u" : ""}
              </div>
            );
          })()}
          
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

        {supply.isOnOrder && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 mt-3" data-testid={`order-status-${supply.id}`}>
            <PackageCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                On order
                {supply.orderedDate && (() => {
                  const orderDate = new Date(supply.orderedDate);
                  const today = new Date();
                  orderDate.setHours(0, 0, 0, 0);
                  today.setHours(0, 0, 0, 0);
                  const days = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
                  return days === 0 ? " — ordered today" : ` — ordered ${days} day${days !== 1 ? "s" : ""} ago`;
                })()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClearOrder(supply.id)}
              data-testid={`button-clear-order-${supply.id}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

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
            {!supply.isOnOrder && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMarkOrdered(supply.id)}
                data-testid={`button-mark-ordered-${supply.id}`}
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                Ordered
              </Button>
            )}
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
                  {Math.floor(adjustedQuantity)} {isInsulinType(supply.type) ? "units" : ""}
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
      activeItemStartDate: usesDurationSettings && activeItemDate ? new Date(activeItemDate + "T12:00:00").toISOString() : undefined,
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
            <Select value={type} onValueChange={(v) => {
              const newType = v as Supply["type"];
              setType(newType);
              if (!supply) {
                const suggested = storage.getSuggestedDailyUsage(newType);
                setDailyUsage(suggested ? suggested.value.toString() : "");
              }
            }}>
              <SelectTrigger id="type" data-testid="select-supply-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needle">Needles/Lancets</SelectItem>
                <SelectItem value="insulin_short">Short-Acting Insulin</SelectItem>
                <SelectItem value="insulin_long">Long-Acting Insulin</SelectItem>
                <SelectItem value="insulin_vial">Insulin Vials (Pump)</SelectItem>
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
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Depletion is calculated using your CGM Sensor Duration from Settings (Usual Habits). 
                    Each sensor lasts the number of days you've configured there.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="active-item-date">Current sensor applied on (optional)</Label>
                  <Input
                    id="active-item-date"
                    type="date"
                    value={activeItemDate}
                    onChange={e => setActiveItemDate(e.target.value)}
                    data-testid="input-active-item-date"
                  />
                  <p className="text-xs text-muted-foreground">
                    When did you apply your current sensor? This lets the app know the stock quantity is your unused sensors,
                    separate from the one you're wearing.
                  </p>
                </div>
              </div>
            ) : type === "infusion_set" ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Depletion is calculated using your Site Change frequency from Settings (Usual Habits). 
                    Each infusion set lasts the number of days you've configured there.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="active-item-date">Current set applied on (optional)</Label>
                  <Input
                    id="active-item-date"
                    type="date"
                    value={activeItemDate}
                    onChange={e => setActiveItemDate(e.target.value)}
                    data-testid="input-active-item-date"
                  />
                  <p className="text-xs text-muted-foreground">
                    When did you last change your infusion set? This separates your active set from unused stock.
                  </p>
                </div>
              </div>
            ) : type === "reservoir" ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Depletion is calculated using your Reservoir Change frequency from Settings (Usual Habits). 
                    Each reservoir lasts the number of days you've configured there.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="active-item-date">Current reservoir changed on (optional)</Label>
                  <Input
                    id="active-item-date"
                    type="date"
                    value={activeItemDate}
                    onChange={e => setActiveItemDate(e.target.value)}
                    data-testid="input-active-item-date"
                  />
                  <p className="text-xs text-muted-foreground">
                    When did you last change your reservoir? This separates your active reservoir from unused stock.
                  </p>
                </div>
              </div>
            ) : (() => {
              const suggested = storage.getSuggestedDailyUsage(type);
              return (
                <div className="space-y-2">
                  <Label htmlFor="daily-usage">
                    {isInsulinType(type) ? "Daily Insulin Usage (units/day)" : 
                     type === "needle" ? "Needles Used Per Day" : "Daily Usage"}
                  </Label>
                  <Input 
                    id="daily-usage" 
                    type="number" 
                    step="0.1"
                    placeholder={isInsulinType(type) ? "e.g., 40" : type === "needle" ? "e.g., 4" : "e.g., 4"} 
                    value={dailyUsage} 
                    onChange={e => setDailyUsage(e.target.value)}
                    data-testid="input-supply-daily-usage"
                  />
                  {suggested && dailyUsage === suggested.value.toString() && (
                    <p className="text-xs text-primary">
                      Auto-filled {suggested.source}
                    </p>
                  )}
                  {type === "insulin_short" && (
                    <p className="text-xs text-muted-foreground">
                      Short-acting (rapid) insulin units you use per day, e.g. NovoRapid, Humalog, Fiasp.
                    </p>
                  )}
                  {type === "insulin_long" && (
                    <p className="text-xs text-muted-foreground">
                      Long-acting (basal) insulin units you use per day, e.g. Lantus, Levemir, Tresiba.
                    </p>
                  )}
                  {type === "insulin_vial" && (
                    <p className="text-xs text-muted-foreground">
                      Insulin vials for pump use (typically 10ml / 1000 units), e.g. NovoRapid, Humalog, Fiasp.
                    </p>
                  )}
                  {type === "insulin" && (
                    <p className="text-xs text-muted-foreground">
                      Total insulin units you use per day. This determines how quickly your pens deplete.
                    </p>
                  )}
                  {type === "needle" && (
                    <p className="text-xs text-muted-foreground">
                      Number of needles you use per day (typically matches your injections per day).
                    </p>
                  )}
                </div>
              );
            })()}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-supply">Cancel</Button>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-refill">Cancel</Button>
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

function EditUsualPrescriptionDialog({ 
  open, 
  onOpenChange, 
  usualPrescription, 
  currentSupplies,
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  usualPrescription: UsualPrescription | null;
  currentSupplies: Supply[];
  onSave: (items: UsualPrescriptionItem[]) => void;
}) {
  const [items, setItems] = useState<UsualPrescriptionItem[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Supply["type"]>("needle");
  const [newQuantity, setNewQuantity] = useState("");
  const [newDailyUsage, setNewDailyUsage] = useState("");

  useEffect(() => {
    if (open) {
      setItems(usualPrescription?.items ? [...usualPrescription.items.map(i => ({ ...i }))] : []);
      setAddingNew(false);
      resetNewForm();
    }
  }, [open, usualPrescription]);

  const resetNewForm = () => {
    setNewName("");
    setNewType("needle");
    setNewQuantity("");
    setNewDailyUsage("");
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], quantity: Math.max(0, quantity) };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    if (!newName.trim() || !newQuantity) return;
    const newInc = getSupplyIncrement(newType);
    const rawQty = parseFloat(newQuantity) || 0;
    const actualUnits = newInc.amount > 1 ? Math.round(rawQty * newInc.amount) : rawQty;
    const item: UsualPrescriptionItem = {
      name: newName.trim(),
      type: newType,
      quantity: actualUnits,
      dailyUsage: parseFloat(newDailyUsage) || 0,
    };
    setItems([...items, item]);
    setAddingNew(false);
    resetNewForm();
  };

  const handleSave = () => {
    onSave(items);
    onOpenChange(false);
  };

  const hasChanges = JSON.stringify(items) !== JSON.stringify(usualPrescription?.items || []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Usual Prescription</DialogTitle>
          <DialogDescription>
            Edit the items and quantities you normally receive on your repeat prescription.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {items.length === 0 && !addingNew && (
            <div className="text-center py-6 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No items saved yet.</p>
              <p className="text-xs">Add items to build your usual prescription.</p>
            </div>
          )}
          {items.map((item, index) => {
            const Icon = typeIcons[item.type as keyof typeof typeIcons] || Package;
            const inc = getSupplyIncrement(item.type as Supply["type"]);
            const packCount = inc.amount > 1 ? Math.round(item.quantity / inc.amount * 10) / 10 : item.quantity;
            const packLabel = inc.amount > 1 ? inc.label : "";
            return (
              <div key={`${item.name}-${index}`} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30" data-testid={`usual-item-${index}`}>
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {typeLabels[item.type as keyof typeof typeLabels] || item.type}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateQuantity(index, Math.max(0, item.quantity - inc.amount))}
                    disabled={item.quantity <= 0}
                    data-testid={`button-usual-decrease-${index}`}
                  >
                    -{inc.amount > 1 ? ` 1 ${packLabel}` : "1"}
                  </Button>
                  <div className="text-center">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={e => handleUpdateQuantity(index, parseFloat(e.target.value) || 0)}
                      className="w-16 text-center text-sm"
                      data-testid={`input-usual-quantity-${index}`}
                    />
                    {inc.amount > 1 && (
                      <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                        {packCount} {packLabel}{packCount !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateQuantity(index, item.quantity + inc.amount)}
                    data-testid={`button-usual-increase-${index}`}
                  >
                    +{inc.amount > 1 ? ` 1 ${packLabel}` : "1"}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveItem(index)}
                  data-testid={`button-usual-remove-${index}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}

          {currentSupplies.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const fromSupplies: UsualPrescriptionItem[] = currentSupplies.map(s => ({
                  name: s.name,
                  type: s.type,
                  quantity: s.currentQuantity,
                  dailyUsage: s.dailyUsage,
                }));
                setItems(fromSupplies);
              }}
              className="w-full"
              data-testid="button-usual-from-current"
            >
              <ClipboardList className="h-3.5 w-3.5 mr-1" />
              Use Current Supplies
            </Button>
          )}

          {addingNew ? (
            <div className="space-y-3 p-3 rounded-lg border border-dashed">
              <div className="space-y-2">
                <Label htmlFor="usual-new-name">Name</Label>
                <Input
                  id="usual-new-name"
                  placeholder="e.g., NovoRapid FlexPen"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  data-testid="input-usual-new-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usual-new-type">Type</Label>
                <Select value={newType} onValueChange={v => setNewType(v as Supply["type"])}>
                  <SelectTrigger id="usual-new-type" data-testid="select-usual-new-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="needle">Needles/Lancets</SelectItem>
                    <SelectItem value="insulin_short">Short-Acting Insulin</SelectItem>
                    <SelectItem value="insulin_long">Long-Acting Insulin</SelectItem>
                    <SelectItem value="insulin_vial">Insulin Vials (Pump)</SelectItem>
                    <SelectItem value="cgm">CGM/Monitors</SelectItem>
                    <SelectItem value="infusion_set">Infusion Sets (Pump)</SelectItem>
                    <SelectItem value="reservoir">Reservoirs/Cartridges (Pump)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const addInc = getSupplyIncrement(newType);
                const usesPacks = addInc.amount > 1;
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="usual-new-qty">
                        {usesPacks ? `How many ${addInc.label}s?` : "Quantity"}
                      </Label>
                      <Input
                        id="usual-new-qty"
                        type="number"
                        placeholder={usesPacks ? `e.g., 5` : "e.g., 100"}
                        value={newQuantity}
                        onChange={e => setNewQuantity(e.target.value)}
                        data-testid="input-usual-new-quantity"
                      />
                      {usesPacks && newQuantity && (
                        <p className="text-xs text-muted-foreground">
                          = {Math.round((parseFloat(newQuantity) || 0) * addInc.amount)} units
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="usual-new-daily">Daily Usage</Label>
                      <Input
                        id="usual-new-daily"
                        type="number"
                        step="0.1"
                        placeholder="e.g., 4"
                        value={newDailyUsage}
                        onChange={e => setNewDailyUsage(e.target.value)}
                        data-testid="input-usual-new-daily-usage"
                      />
                    </div>
                  </div>
                );
              })()}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddItem} disabled={!newName.trim() || !newQuantity} data-testid="button-usual-confirm-add">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Item
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingNew(false); resetNewForm(); }} data-testid="button-usual-cancel-add">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingNew(true)}
              className="w-full"
              data-testid="button-usual-add-new"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Item
            </Button>
          )}
        </div>
        <DialogFooter className="flex-row gap-2 pt-3 border-t">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} data-testid="button-usual-cancel">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges} data-testid="button-usual-save">
            <Save className="h-3.5 w-3.5 mr-1" />
            Save Usual Prescription
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
  const [usualDialogOpen, setUsualDialogOpen] = useState(false);

  useEffect(() => {
    setSupplies(storage.getSupplies());
    setLastPrescription(storage.getLastPrescription());
    setUsualPrescription(storage.getUsualPrescription());
    setPrescriptionCycle(storage.getPrescriptionCycle());
    setScenarioState(storage.getScenarioState());
    trackFeatureEngagement("supplies");
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
        lastPickupDate: new Date().toISOString(),
        isOnOrder: false,
        orderedDate: undefined,
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

  const handleMarkOrdered = (id: string) => {
    storage.markSupplyOrdered(id);
    const supply = supplies.find(s => s.id === id);
    toast({
      title: "Marked as ordered",
      description: supply ? `${supply.name} marked as on order. We'll remind you when to collect.` : "Supply marked as on order.",
    });
    refreshSupplies();
  };

  const handleClearOrder = (id: string) => {
    storage.clearSupplyOrder(id);
    toast({ title: "Order cleared" });
    refreshSupplies();
  };

  const filterByType = (type: string) => {
    if (type === "all") return supplies;
    if (type === "insulin") return supplies.filter(s => isInsulinType(s.type));
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
              <p>Save the items and quantities you normally receive on your repeat prescription. Use "Edit Usual" to view, add, remove, or change quantities. Then use "Add Usual" to quickly add those items when you pick up.</p>
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
            <Button variant="outline" size="sm" onClick={() => setUsualDialogOpen(true)} data-testid="button-edit-usual-prescription">
              <Pencil className="h-4 w-4 mr-1" />
              {usualPrescription && usualPrescription.items.length > 0 ? "Edit Usual" : "Set Usual"}
            </Button>
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
          scenarioState={scenarioState}
        />
        <TravelImpactPanel supplies={supplies} scenarioState={scenarioState} />
        <SickDayImpactPanel supplies={supplies} scenarioState={scenarioState} />
        <CombinedScenarioImpactPanel supplies={supplies} scenarioState={scenarioState} />
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
          <TabsContent key={tabValue} value={tabValue} className="mt-6 animate-fade-in-up">
            {filterByType(tabValue).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No supplies in this category yet.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={handleAddNew} data-testid="button-add-supply-empty">
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
                      onMarkOrdered={handleMarkOrdered}
                      onClearOrder={handleClearOrder}
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

      <EditUsualPrescriptionDialog
        open={usualDialogOpen}
        onOpenChange={setUsualDialogOpen}
        usualPrescription={usualPrescription}
        currentSupplies={supplies}
        onSave={handleSaveUsualPrescription}
      />
    </div>
  );
}
