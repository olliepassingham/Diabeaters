import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Settings } from "lucide-react";
import { Link } from "wouter";
import { storage, Supply, ScenarioState, UserProfile, DashboardWidget } from "@/lib/storage";
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
  WidgetLibrary,
} from "@/components/widgets";

type HealthStatus = "stable" | "watch" | "action";

function getHealthStatus(supplies: Supply[], scenarioState: ScenarioState): HealthStatus {
  const minDays = supplies.length > 0 
    ? Math.min(...supplies.map(s => s.dailyUsage > 0 ? s.currentQuantity / s.dailyUsage : 999))
    : 999;
  
  if (scenarioState.sickDayActive && scenarioState.sickDaySeverity === "severe") {
    return "action";
  }
  if (minDays < 2) {
    return "action";
  }
  if (minDays < 7 || scenarioState.sickDayActive) {
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

function HeroCard({ status, onCustomize }: { status: HealthStatus; onCustomize: () => void }) {
  const isUrgent = status === "action";

  return (
    <Card className="overflow-visible" data-testid="card-hero">
      <CardContent className="p-4 space-y-3">
        <Link href="/help-now">
          <Button 
            variant="destructive" 
            className={`w-full h-14 text-lg rounded-full ${isUrgent ? "animate-pulse shadow-lg shadow-red-500/30" : ""}`}
            data-testid="button-help-now"
          >
            <Phone className="h-5 w-5 mr-2" />
            Help Now
          </Button>
        </Link>
        <Button 
          variant="outline" 
          className="w-full"
          onClick={onCustomize}
          data-testid="button-customize"
        >
          <Settings className="h-4 w-4 mr-2" />
          Customize Dashboard
        </Button>
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

  useEffect(() => {
    setProfile(storage.getProfile());
    setSupplies(storage.getSupplies());
    setScenarioState(storage.getScenarioState());
    setWidgets(storage.getDashboardWidgets());
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

  const enabledWidgets = widgets
    .filter(w => w.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8">
      <HeaderCard profile={profile} status={healthStatus} />
      
      <HeroCard status={healthStatus} onCustomize={() => setIsEditing(true)} />

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
          {enabledWidgets.map((widget) => (
            <div key={widget.id} data-testid={`widget-container-${widget.type}`}>
              <WidgetRenderer type={widget.type} />
            </div>
          ))}
        </div>
      )}

      {!isEditing && enabledWidgets.length === 0 && (
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
