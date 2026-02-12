import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Settings, AlertCircle, ArrowRight, MessageCircle, CheckCircle2, Bell } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { storage, Supply, ScenarioState, UserProfile, DashboardWidget, WidgetSize, HypoTreatment, CarerLink } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import {
  SupplySummaryWidget,
  SupplyDepletionWidget,
  TodayOverviewWidget,
  AIRecommendationsWidget,
  QuickActionsWidget,
  ScenarioStatusWidget,
  SettingsCompletionWidget,
  CommunityWidget,
  MessagesWidget,
  ActivityAdviserWidget,
  RatioAdviserWidget,
  TravelModeWidget,
  SickDayWidget,
  HelpNowInfoWidget,
  AppointmentsWidget,
  WidgetLibrary,
} from "@/components/widgets";

type HealthStatus = "stable" | "watch" | "action";

function getHealthStatus(supplies: Supply[], scenarioState: ScenarioState): HealthStatus {
  // Use the same calculation as the Supplies page for consistency
  const supplyStatuses = supplies.map(s => storage.getSupplyStatus(s));
  const hasCritical = supplyStatuses.includes("critical");
  const hasLow = supplyStatuses.includes("low");
  
  // Severe sick day is always action needed
  if (scenarioState.sickDayActive && scenarioState.sickDaySeverity === "severe") {
    return "action";
  }
  
  // Critical supplies (≤3 days) = action needed
  if (hasCritical) {
    return "action";
  }
  
  // Low supplies (≤7 days) or any sick day = watch
  if (hasLow || scenarioState.sickDayActive) {
    return "watch";
  }
  
  return "stable";
}

function StatusIndicator({ status }: { status: HealthStatus }) {
  const config = {
    stable: { bg: "bg-green-500", text: "Stable", textColor: "text-green-700 dark:text-green-400" },
    watch: { bg: "bg-amber-500", text: "Watch", textColor: "text-amber-700 dark:text-amber-400" },
    action: { bg: "bg-red-500", text: "Action needed", textColor: "text-red-700 dark:text-red-400" },
  };

  const { bg, text, textColor } = config[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${bg} animate-pulse`} />
      <span className={`text-sm font-medium ${textColor}`} data-testid="text-status">
        {text}
      </span>
    </div>
  );
}

function HeaderCard({ profile, status }: { profile: UserProfile | null; status: HealthStatus }) {
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const firstName = profile?.name?.split(" ")[0] || "";

  return (
    <Card className="bg-card/80 backdrop-blur" data-testid="card-header">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-greeting">
              {greeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-muted-foreground text-sm">Here's your diabetes today</p>
          </div>
          <StatusIndicator status={status} />
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardInfoDialog() {
  return (
    <PageInfoDialog
      title="About Your Dashboard"
      description="Your personal diabetes command centre"
    >
      <InfoSection title="Customise Your View">
        <p>Click the gear icon to customise your dashboard. You can show or hide widgets and rearrange them to suit your needs.</p>
      </InfoSection>
      <InfoSection title="Rearranging Widgets">
        <p>When in customisation mode, use the up and down arrows to move widgets. Toggle the switch to show or hide a widget.</p>
      </InfoSection>
      <InfoSection title="Status Indicator">
        <p>The status shows your overall diabetes situation. Green means stable, amber means watch, and red means action is needed.</p>
      </InfoSection>
      <InfoSection title="Quick Navigation">
        <p>Click the Diabeaters logo in the navigation bar to return to the dashboard from any page.</p>
      </InfoSection>
      <InfoSection title="Help Now Button">
        <p>The red Help Now button gives you instant access to emergency resources, contacts, and guidance for urgent situations.</p>
      </InfoSection>
      <InfoSection title="AI Coach">
        <p>The speech bubble icon opens your AI Coach - a conversational assistant that can answer questions about diabetes management. It remembers your previous conversations and uses your profile to give personalised guidance. Remember, it's not medical advice!</p>
      </InfoSection>
    </PageInfoDialog>
  );
}

function HeroCard({ status, onCustomize }: { status: HealthStatus; onCustomize: () => void }) {
  const isUrgent = status === "action";
  const { toast } = useToast();
  const [hypoDialogOpen, setHypoDialogOpen] = useState(false);
  const [hypoGlucose, setHypoGlucose] = useState("");
  const [hypoTreatment, setHypoTreatment] = useState("");
  const [hypoNotes, setHypoNotes] = useState("");
  const [carers, setCarers] = useState<CarerLink[]>([]);

  useEffect(() => {
    setCarers(storage.getCarerLinks());
  }, []);

  const handleLogHypo = () => {
    const hasCarers = carers.length > 0;
    storage.addHypoTreatment({
      timestamp: new Date().toISOString(),
      glucoseLevel: hypoGlucose ? parseFloat(hypoGlucose) : undefined,
      treatment: hypoTreatment || undefined,
      notes: hypoNotes || undefined,
      carerNotified: hasCarers,
    });
    setHypoDialogOpen(false);
    setHypoGlucose("");
    setHypoTreatment("");
    setHypoNotes("");
    toast({
      title: hasCarers ? "Hypo logged & carers notified" : "Hypo treatment logged",
      description: hasCarers
        ? `${carers.length} linked carer${carers.length > 1 ? "s" : ""} ${carers.length > 1 ? "have" : "has"} been notified.`
        : "Your hypo treatment has been recorded.",
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3" data-testid="card-hero">
        <Link href="/help-now" className="flex-1">
          <Button 
            variant="destructive" 
            size="sm"
            className={`w-full rounded-full ${isUrgent ? "animate-pulse shadow-lg shadow-red-500/30" : ""}`}
            data-testid="button-help-now"
          >
            <Phone className="h-4 w-4 mr-1" />
            Help Now
          </Button>
        </Link>
        <Button
          size="sm"
          className="rounded-full bg-green-600 dark:bg-green-700 text-white gap-1 shrink-0"
          onClick={() => setHypoDialogOpen(true)}
          data-testid="button-dashboard-treated-hypo"
        >
          <CheckCircle2 className="h-4 w-4" />
          Treated a Hypo
        </Button>
        <div className="flex items-center gap-2 shrink-0">
          <DashboardInfoDialog />
          <Link href="/ai-coach">
            <Button 
              variant="outline"
              size="icon"
              className="rounded-full"
              data-testid="button-ai-coach"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onCustomize}
            data-testid="button-customize"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={hypoDialogOpen} onOpenChange={setHypoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Log Hypo Treatment
            </DialogTitle>
            <DialogDescription>
              Record details about your hypo. {carers.length > 0 ? `Your ${carers.length} linked carer${carers.length > 1 ? "s" : ""} will be notified.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="dash-hypo-glucose">Blood Glucose (mmol/L) - optional</Label>
              <Input
                id="dash-hypo-glucose"
                type="number"
                step="0.1"
                placeholder="e.g., 3.2"
                value={hypoGlucose}
                onChange={(e) => setHypoGlucose(e.target.value)}
                data-testid="input-dashboard-hypo-glucose"
              />
            </div>
            <div className="space-y-2">
              <Label>What did you take?</Label>
              <Select value={hypoTreatment} onValueChange={setHypoTreatment}>
                <SelectTrigger data-testid="select-dashboard-hypo-treatment">
                  <SelectValue placeholder="Select treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Glucose tablets">Glucose tablets</SelectItem>
                  <SelectItem value="Juice">Juice</SelectItem>
                  <SelectItem value="Sweets">Sweets</SelectItem>
                  <SelectItem value="Sugary drink">Sugary drink</SelectItem>
                  <SelectItem value="Gel">Glucose gel</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dash-hypo-notes">Notes (optional)</Label>
              <Input
                id="dash-hypo-notes"
                placeholder="e.g., Felt shaky before lunch"
                value={hypoNotes}
                onChange={(e) => setHypoNotes(e.target.value)}
                data-testid="input-dashboard-hypo-notes"
              />
            </div>
            {carers.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-md">
                <Bell className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  {carers.map(c => c.name).join(", ")} will be notified
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHypoDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLogHypo} className="bg-green-600 dark:bg-green-700 gap-2" data-testid="button-dashboard-confirm-hypo">
              <CheckCircle2 className="h-4 w-4" />
              Log & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SetupPromptCard({ completion }: { completion: { percentage: number; completed: number; total: number } }) {
  return (
    <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/30" data-testid="card-setup-prompt">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Complete Your Setup</h3>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {completion.completed}/{completion.total}
          </Badge>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Setup progress</span>
            <span className="font-medium">{completion.percentage}%</span>
          </div>
          <Progress value={completion.percentage} className="h-2" />
        </div>

        <p className="text-sm text-muted-foreground">
          Complete your settings to unlock all features and get personalized recommendations.
        </p>
        
        <Link href="/settings">
          <Button className="w-full" data-testid="button-complete-setup">
            Complete Settings
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function WidgetRenderer({ type, size = "full" }: { type: string; size?: WidgetSize }) {
  const compact = size === "half";
  switch (type) {
    case "supply-summary":
      return <SupplySummaryWidget compact={compact} />;
    case "today-overview":
      return <TodayOverviewWidget compact={compact} />;
    case "ai-recommendations":
      return <AIRecommendationsWidget compact={compact} />;
    case "quick-actions":
      return <QuickActionsWidget compact={compact} />;
    case "scenario-status":
      return <ScenarioStatusWidget compact={compact} />;
    case "settings-completion":
      return <SettingsCompletionWidget compact={compact} />;
    case "community":
      return <CommunityWidget compact={compact} />;
    case "messages":
      return <MessagesWidget compact={compact} />;
    case "activity-adviser":
      return <ActivityAdviserWidget compact={compact} />;
    case "ratio-adviser":
      return <RatioAdviserWidget compact={compact} />;
    case "travel-mode":
      return <TravelModeWidget compact={compact} />;
    case "sick-day":
      return <SickDayWidget compact={compact} />;
    case "help-now-info":
      return <HelpNowInfoWidget compact={compact} />;
    case "appointments":
      return <AppointmentsWidget compact={compact} />;
    case "supply-depletion":
      return <SupplyDepletionWidget compact={compact} />;
    default:
      return null;
  }
}

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSettingsComplete, setIsSettingsComplete] = useState(false);
  const [settingsCompletion, setSettingsCompletion] = useState({ percentage: 0, completed: 0, total: 5 });

  // Refresh data on mount and when refreshKey changes
  useEffect(() => {
    const refreshData = () => {
      setProfile(storage.getProfile());
      setSupplies(storage.getSupplies());
      setScenarioState(storage.getScenarioState());
      setWidgets(storage.getDashboardWidgets());
      setIsSettingsComplete(storage.isSettingsComplete());
      setSettingsCompletion(storage.getSettingsCompletion());
    };
    
    refreshData();
    
    // Also refresh when window gains focus (e.g., returning from settings page)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };
    
    const handleFocus = () => refreshData();
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshKey]);

  const healthStatus = getHealthStatus(supplies, scenarioState);

  const handleToggleWidget = (widgetId: string, enabled: boolean) => {
    const updated = widgets.map(w => 
      w.id === widgetId ? { ...w, enabled } : w
    );
    storage.saveDashboardWidgets(updated);
    setWidgets(updated);
  };

  const handleResizeWidget = (widgetId: string, size: WidgetSize) => {
    const updated = widgets.map(w => 
      w.id === widgetId ? { ...w, size } : w
    );
    storage.saveDashboardWidgets(updated);
    setWidgets(updated);
  };

  const handleMoveWidget = (widgetId: string, direction: "up" | "down") => {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(w => w.id === widgetId);
    
    if (direction === "up" && index > 0) {
      const prevOrder = sorted[index - 1].order;
      const currOrder = sorted[index].order;
      sorted[index - 1].order = currOrder;
      sorted[index].order = prevOrder;
    } else if (direction === "down" && index < sorted.length - 1) {
      const nextOrder = sorted[index + 1].order;
      const currOrder = sorted[index].order;
      sorted[index + 1].order = currOrder;
      sorted[index].order = nextOrder;
    }
    
    storage.saveDashboardWidgets(sorted);
    setWidgets(sorted);
  };

  const handleCloseEditor = () => {
    setIsEditing(false);
    setRefreshKey(prev => prev + 1);
  };

  // Filter widgets: remove settings-completion from the list if we're showing it separately
  const enabledWidgets = widgets
    .filter(w => w.enabled)
    .filter(w => !isSettingsComplete || w.type !== "settings-completion" ? true : true) // Keep settings widget in normal flow when complete
    .sort((a, b) => a.order - b.order);

  // When settings incomplete, filter out settings-completion widget from normal flow (we show SetupPromptCard instead)
  const widgetsToRender = isSettingsComplete 
    ? enabledWidgets 
    : enabledWidgets.filter(w => w.type !== "settings-completion");

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8">
      <div className="animate-fade-in-down">
        <HeaderCard profile={profile} status={healthStatus} />
      </div>
      
      <div className="animate-fade-in" style={{ animationDelay: '50ms' }}>
        <HeroCard status={healthStatus} onCustomize={() => setIsEditing(true)} />
      </div>

      {!isEditing && !isSettingsComplete && (
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <SetupPromptCard completion={settingsCompletion} />
        </div>
      )}

      {isEditing && (
        <div className="animate-fade-in-scale">
          <WidgetLibrary
            widgets={widgets}
            onToggleWidget={handleToggleWidget}
            onMoveWidget={handleMoveWidget}
            onResizeWidget={handleResizeWidget}
            onClose={handleCloseEditor}
          />
        </div>
      )}
      
      {!isEditing && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 animate-stagger">
          {widgetsToRender.map((widget) => (
            <div 
              key={widget.id} 
              className={`${widget.size === "full" ? "col-span-2" : "h-[280px] min-h-[280px] max-h-[280px]"} [&>*]:h-full`}
              data-testid={`widget-container-${widget.type}`}
            >
              <WidgetRenderer type={widget.type} size={widget.size} />
            </div>
          ))}
        </div>
      )}

      {!isEditing && widgetsToRender.length === 0 && isSettingsComplete && (
        <div className="text-center py-12 animate-fade-in">
          <p className="text-muted-foreground mb-4">No widgets enabled. Click "Customize Dashboard" to add some.</p>
          <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-add-widgets">
            Add Widgets
          </Button>
        </div>
      )}
    </div>
  );
}
