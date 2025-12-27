import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Phone } from "lucide-react";
import { Link } from "wouter";
import { storage, DashboardWidget } from "@/lib/storage";
import {
  SupplySummaryWidget,
  TodayOverviewWidget,
  AIRecommendationsWidget,
  QuickActionsWidget,
  ScenarioStatusWidget,
  SettingsCompletionWidget,
  WidgetLibrary,
} from "@/components/widgets";

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
    default:
      return null;
  }
}

export default function Dashboard() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setWidgets(storage.getDashboardWidgets());
    setProfile(storage.getProfile());
  }, [refreshKey]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-greeting">
            {greeting()}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">Your diabetes management command centre.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/help-now">
            <Button variant="destructive" size="sm" data-testid="button-help-now">
              <Phone className="h-4 w-4 mr-2" />
              Help Now
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsEditing(!isEditing)}
            data-testid="button-edit-dashboard"
          >
            <Settings className="h-4 w-4 mr-2" />
            {isEditing ? "Done" : "Edit Dashboard"}
          </Button>
        </div>
      </div>

      {isEditing && (
        <WidgetLibrary
          widgets={widgets}
          onToggleWidget={handleToggleWidget}
          onMoveWidget={handleMoveWidget}
          onClose={handleCloseEditor}
        />
      )}

      {!isEditing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enabledWidgets.map((widget) => (
            <div key={widget.id} className={widget.type === "quick-actions" ? "md:col-span-2" : ""}>
              <WidgetRenderer type={widget.type} />
            </div>
          ))}
        </div>
      )}

      {!isEditing && enabledWidgets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No widgets enabled. Click "Edit Dashboard" to add some.</p>
          <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-add-widgets">
            Add Widgets
          </Button>
        </div>
      )}
    </div>
  );
}
