import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  Settings, 
  CheckCircle2, 
  Syringe, 
  Package, 
  Activity,
  ArrowRight,
  ShoppingCart,
  Thermometer,
  Plane,
  History,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import { storage, Supply, ScenarioState, UserProfile, UserSettings } from "@/lib/storage";
import { WidgetLibrary } from "@/components/widgets";

type HealthStatus = "stable" | "watch" | "action";

function getHealthStatus(supplies: Supply[], scenarioState: ScenarioState): HealthStatus {
  const minDays = supplies.length > 0 
    ? Math.min(...supplies.map(s => s.dailyUsage > 0 ? s.currentQuantity / s.dailyUsage : 999))
    : 999;
  
  if (scenarioState.sickDayActive && scenarioState.sickDaySeverity === "severe") {
    return "action";
  }
  if (minDays < 3 || scenarioState.sickDayActive) {
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

function HeroCard({ status }: { status: HealthStatus }) {
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
          onClick={() => document.getElementById("customize-trigger")?.click()}
          data-testid="button-customize"
        >
          <Settings className="h-4 w-4 mr-2" />
          Customize Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}

function TodayCard({ supplies, settings }: { supplies: Supply[]; settings: UserSettings }) {
  const minDays = supplies.length > 0 
    ? Math.min(...supplies.filter(s => s.dailyUsage > 0).map(s => Math.floor(s.currentQuantity / s.dailyUsage)))
    : 0;

  const ratioStatus = settings.breakfastRatio ? "Stable" : "Not set";
  const supplyStatus = `${minDays} days`;
  const activityStatus = "Light";

  return (
    <Card data-testid="card-today">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Today</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium" data-testid="text-today-status">All systems normal</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Syringe className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Ratios</p>
            <p className="text-sm font-medium" data-testid="text-ratio-status">{ratioStatus}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Supplies</p>
            <p className="text-sm font-medium" data-testid="text-supply-status">{supplyStatus}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Activity className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Activity</p>
            <p className="text-sm font-medium" data-testid="text-activity-status">{activityStatus}</p>
          </div>
        </div>

        <Link href="/activity-adviser">
          <Button variant="secondary" className="w-full" data-testid="button-plan-today">
            Plan Today
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function SuppliesCard({ supplies }: { supplies: Supply[] }) {
  const minDays = supplies.length > 0 
    ? Math.min(...supplies.filter(s => s.dailyUsage > 0).map(s => Math.floor(s.currentQuantity / s.dailyUsage)))
    : 0;
  
  const maxDays = 30;
  const progressValue = Math.min((minDays / maxDays) * 100, 100);
  const progressColor = minDays < 7 ? "bg-amber-500" : minDays < 3 ? "bg-red-500" : "";

  return (
    <Card data-testid="card-supplies">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Supplies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-2xl font-bold" data-testid="text-days-remaining">
            {minDays} days remaining
          </p>
          <Progress value={progressValue} className={`h-2 mt-2 ${progressColor}`} />
          <p className="text-xs text-muted-foreground mt-1">Based on last 14 days</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/supplies" className="flex-1">
            <Button variant="outline" className="w-full" data-testid="button-view-supplies">
              View Supplies
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href="/supplies">
            <Button variant="ghost" size="icon" data-testid="button-reorder">
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsCard() {
  return (
    <Card data-testid="card-quick-actions">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Link href="/supplies">
            <Button variant="secondary" className="w-full h-16 flex-col gap-1" data-testid="button-action-supplies">
              <Package className="h-5 w-5" />
              <span className="text-xs">Supplies</span>
            </Button>
          </Link>
          <Link href="/ratio-adviser">
            <Button variant="secondary" className="w-full h-16 flex-col gap-1" data-testid="button-action-ratios">
              <Syringe className="h-5 w-5" />
              <span className="text-xs">Ratios</span>
            </Button>
          </Link>
          <Link href="/scenario-adviser?mode=sick">
            <Button variant="secondary" className="w-full h-16 flex-col gap-1" data-testid="button-action-sick">
              <Thermometer className="h-5 w-5" />
              <span className="text-xs">Sick Day</span>
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link href="/activity-adviser">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="button-action-activity">
              <Activity className="h-4 w-4" />
              <span className="text-xs">Activity</span>
            </Button>
          </Link>
          <Link href="/scenario-adviser?mode=travel">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="button-action-travel">
              <Plane className="h-4 w-4" />
              <span className="text-xs">Travel</span>
            </Button>
          </Link>
          <Link href="/activity-history">
            <Button variant="ghost" size="sm" className="gap-1" data-testid="button-action-history">
              <History className="h-4 w-4" />
              <span className="text-xs">History</span>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function AIInsightCard() {
  const insights = [
    "You've had 3 stable mornings in a row. Consider a slightly later breakfast bolus today.",
    "Your supplies are well-stocked. No urgent refills needed this week.",
    "Light activity planned? Remember to check levels before and after.",
    "Weekend approaching - good time to review your ratios for any adjustments.",
  ];

  const randomInsight = insights[Math.floor(Math.random() * insights.length)];

  return (
    <Card data-testid="card-ai-insight">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-lg">AI Insight</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-3" data-testid="text-insight">
          {randomInsight}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Not medical advice · Based on your data
        </p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [settings, setSettings] = useState<UserSettings>({});
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ travelModeActive: false, sickDayActive: false });
  const [isEditing, setIsEditing] = useState(false);
  const [widgets, setWidgets] = useState(storage.getDashboardWidgets());

  useEffect(() => {
    setProfile(storage.getProfile());
    setSupplies(storage.getSupplies());
    setSettings(storage.getSettings());
    setScenarioState(storage.getScenarioState());
  }, []);

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

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8">
      <HeaderCard profile={profile} status={healthStatus} />
      
      <HeroCard status={healthStatus} />
      
      <div className="grid grid-cols-1 gap-4">
        <TodayCard supplies={supplies} settings={settings} />
        <SuppliesCard supplies={supplies} />
        <QuickActionsCard />
        <AIInsightCard />
      </div>

      <button 
        id="customize-trigger" 
        className="hidden"
        onClick={() => setIsEditing(true)}
      />

      {isEditing && (
        <WidgetLibrary
          widgets={widgets}
          onToggleWidget={handleToggleWidget}
          onMoveWidget={handleMoveWidget}
          onClose={() => setIsEditing(false)}
        />
      )}
    </div>
  );
}
