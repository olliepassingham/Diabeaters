import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Package, Calendar, Brain, Zap, LayoutGrid, X, ChevronUp, ChevronDown, Settings, Users } from "lucide-react";
import { DashboardWidget, WidgetType } from "@/lib/storage";

interface WidgetInfo {
  type: WidgetType;
  name: string;
  description: string;
  icon: typeof Package;
}

export const WIDGET_INFO: Record<WidgetType, WidgetInfo> = {
  "supply-summary": {
    type: "supply-summary",
    name: "Supply Summary",
    description: "View supply levels and restock alerts",
    icon: Package,
  },
  "today-overview": {
    type: "today-overview",
    name: "Today Overview",
    description: "Today's status and flagged risks",
    icon: Calendar,
  },
  "ai-recommendations": {
    type: "ai-recommendations",
    name: "AI Insights",
    description: "Preventative guidance and tips",
    icon: Brain,
  },
  "quick-actions": {
    type: "quick-actions",
    name: "Quick Actions",
    description: "Fast access to all features",
    icon: Zap,
  },
  "scenario-status": {
    type: "scenario-status",
    name: "Active Scenarios",
    description: "Travel and sick day modes",
    icon: LayoutGrid,
  },
  "settings-completion": {
    type: "settings-completion",
    name: "Settings Progress",
    description: "Track your setup completion",
    icon: Settings,
  },
  "community": {
    type: "community",
    name: "Community",
    description: "Connect with others who understand",
    icon: Users,
  },
};

interface WidgetLibraryProps {
  widgets: DashboardWidget[];
  onToggleWidget: (widgetId: string, enabled: boolean) => void;
  onMoveWidget: (widgetId: string, direction: "up" | "down") => void;
  onClose: () => void;
}

export function WidgetLibrary({ widgets, onToggleWidget, onMoveWidget, onClose }: WidgetLibraryProps) {
  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <Card className="border-primary/50" data-testid="widget-library">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Customize Dashboard</CardTitle>
            <CardDescription>Choose which widgets to show and arrange their order</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-library">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sortedWidgets.map((widget, index) => {
          const info = WIDGET_INFO[widget.type];
          const Icon = info.icon;
          
          return (
            <div 
              key={widget.id} 
              className={`flex items-center gap-3 p-3 rounded-lg border ${widget.enabled ? "bg-muted/30" : "bg-muted/10 opacity-60"}`}
              data-testid={`widget-item-${widget.type}`}
            >
              <div className="flex flex-col gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  disabled={index === 0}
                  onClick={() => onMoveWidget(widget.id, "up")}
                  data-testid={`button-move-up-${widget.type}`}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  disabled={index === sortedWidgets.length - 1}
                  onClick={() => onMoveWidget(widget.id, "down")}
                  data-testid={`button-move-down-${widget.type}`}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{info.name}</p>
                <p className="text-xs text-muted-foreground truncate">{info.description}</p>
              </div>
              
              <Switch 
                checked={widget.enabled}
                onCheckedChange={(checked) => onToggleWidget(widget.id, checked)}
                data-testid={`switch-${widget.type}`}
              />
            </div>
          );
        })}
        
        <div className="pt-3 border-t mt-4">
          <Button onClick={onClose} className="w-full" data-testid="button-done-editing">
            Done
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
