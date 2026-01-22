import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Settings, AlertCircle, ArrowRight, Bot } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { storage, Supply, ScenarioState, UserProfile, DashboardWidget } from "@/lib/storage";
import { PageInfoDialog, InfoSection } from "@/components/page-info-dialog";
import {
  SupplySummaryWidget,
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
    </PageInfoDialog>
  );
}

function HeroCard({ status, onCustomize }: { status: HealthStatus; onCustomize: () => void }) {
  const isUrgent = status === "action";

  return (
    <div className="flex items-center justify-between gap-3" data-testid="card-hero">
      <Link href="/help-now" className="flex-1">
        <Button 
          variant="destructive" 
          className={`w-full rounded-full ${isUrgent ? "animate-pulse shadow-lg shadow-red-500/30" : ""}`}
          data-testid="button-help-now"
        >
          <Phone className="h-4 w-4 mr-2" />
          Help Now
        </Button>
      </Link>
      <Link href="/ai-coach">
        <Button 
          variant="outline"
          size="icon"
          className="rounded-full"
          data-testid="button-ai-coach"
        >
          <Bot className="h-4 w-4" />
        </Button>
      </Link>
      <DashboardInfoDialog />
      <Button 
        variant="outline" 
        size="icon"
        onClick={onCustomize}
        data-testid="button-customize"
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
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

function WidgetRenderer({ type }: { type: string }) {
  switch (type) {
    case "supply-summary":
      return <SupplySummaryWidget />;
    case "today-overview":
      return <TodayOverviewWidget />;
    case "ai-recommendations":
      return <AIRecommendationsWidget />;
    case "quick-actions":
      return <QuickActionsWidget />;
    case "scenario-status":
      return <ScenarioStatusWidget />;
    case "settings-completion":
      return <SettingsCompletionWidget />;
    case "community":
      return <CommunityWidget />;
    case "messages":
      return <MessagesWidget />;
    case "activity-adviser":
      return <ActivityAdviserWidget />;
    case "ratio-adviser":
      return <RatioAdviserWidget />;
    case "travel-mode":
      return <TravelModeWidget />;
    case "sick-day":
      return <SickDayWidget />;
    case "help-now-info":
      return <HelpNowInfoWidget />;
    case "appointments":
      return <AppointmentsWidget />;
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
    <div className="space-y-4 max-w-lg mx-auto pb-8">
      <HeaderCard profile={profile} status={healthStatus} />
      
      <HeroCard status={healthStatus} onCustomize={() => setIsEditing(true)} />

      {/* Show setup prompt at top when settings incomplete */}
      {!isEditing && !isSettingsComplete && (
        <SetupPromptCard completion={settingsCompletion} />
      )}

      {isEditing && (
        <WidgetLibrary
          widgets={widgets}
          onToggleWidget={handleToggleWidget}
          onMoveWidget={handleMoveWidget}
          onClose={handleCloseEditor}
        />
      )}
      
      {!isEditing && (
        <div className="grid grid-cols-1 gap-4">
          {widgetsToRender.map((widget) => (
            <div key={widget.id} data-testid={`widget-container-${widget.type}`}>
              <WidgetRenderer type={widget.type} />
            </div>
          ))}
        </div>
      )}

      {!isEditing && widgetsToRender.length === 0 && isSettingsComplete && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No widgets enabled. Click "Customize Dashboard" to add some.</p>
          <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-add-widgets">
            Add Widgets
          </Button>
        </div>
      )}
    </div>
  );
}
