import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Calendar, 
  Brain, 
  Zap, 
  LayoutGrid, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Settings, 
  Users,
  Mail,
  Activity,
  Syringe,
  Plane,
  Thermometer,
  Phone,
  GripVertical,
  Columns2,
  Square
} from "lucide-react";
import { DashboardWidget, WidgetType, WidgetSize } from "@/lib/storage";

interface WidgetInfo {
  type: WidgetType;
  name: string;
  description: string;
  icon: typeof Package;
}

export const WIDGET_INFO: Record<WidgetType, WidgetInfo> = {
  "today-overview": {
    type: "today-overview",
    name: "Today at a Glance",
    description: "Today's status and micro-stats",
    icon: Calendar,
  },
  "supply-summary": {
    type: "supply-summary",
    name: "Supplies",
    description: "View supply levels and days remaining",
    icon: Package,
  },
  "quick-actions": {
    type: "quick-actions",
    name: "Quick Actions",
    description: "Fast access to all features",
    icon: Zap,
  },
  "ai-recommendations": {
    type: "ai-recommendations",
    name: "AI Insights",
    description: "Supportive guidance and tips",
    icon: Brain,
  },
  "scenario-status": {
    type: "scenario-status",
    name: "Scenarios",
    description: "Bedtime check, travel and sick day modes",
    icon: LayoutGrid,
  },
  "community": {
    type: "community",
    name: "Community",
    description: "Connect with others who understand",
    icon: Users,
  },
  "messages": {
    type: "messages",
    name: "Messages",
    description: "Your direct message inbox",
    icon: Mail,
  },
  "activity-adviser": {
    type: "activity-adviser",
    name: "Activity Adviser",
    description: "Plan activities, meals and routines with AI guidance",
    icon: Activity,
  },
  "ratio-adviser": {
    type: "ratio-adviser",
    name: "Ratio Adviser",
    description: "Your insulin ratios at a glance",
    icon: Syringe,
  },
  "travel-mode": {
    type: "travel-mode",
    name: "Travel Mode",
    description: "Travel planning and reminders",
    icon: Plane,
  },
  "sick-day": {
    type: "sick-day",
    name: "Sick Day Mode",
    description: "Sick day guidance and monitoring",
    icon: Thermometer,
  },
  "settings-completion": {
    type: "settings-completion",
    name: "Settings Progress",
    description: "Track your setup completion",
    icon: Settings,
  },
  "help-now-info": {
    type: "help-now-info",
    name: "Emergency Info",
    description: "Quick access to emergency contacts",
    icon: Phone,
  },
  "appointments": {
    type: "appointments",
    name: "Appointments",
    description: "Track clinic visits and check-ups",
    icon: Calendar,
  },
};

interface WidgetLibraryProps {
  widgets: DashboardWidget[];
  onToggleWidget: (widgetId: string, enabled: boolean) => void;
  onMoveWidget: (widgetId: string, direction: "up" | "down") => void;
  onResizeWidget: (widgetId: string, size: WidgetSize) => void;
  onClose: () => void;
}

export function WidgetLibrary({ widgets, onToggleWidget, onMoveWidget, onResizeWidget, onClose }: WidgetLibraryProps) {
  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <Card className="border-primary/50" data-testid="widget-library">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Customise Dashboard</CardTitle>
            <CardDescription>Show, hide, reorder and resize your widgets</CardDescription>
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
              className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${widget.enabled ? "bg-muted/30" : "bg-muted/10 opacity-60"}`}
              data-testid={`widget-item-${widget.type}`}
            >
              <div className="flex items-center gap-1">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 w-5 p-0"
                    disabled={index === 0}
                    onClick={() => onMoveWidget(widget.id, "up")}
                    data-testid={`button-move-up-${widget.type}`}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 w-5 p-0"
                    disabled={index === sortedWidgets.length - 1}
                    onClick={() => onMoveWidget(widget.id, "down")}
                    data-testid={`button-move-down-${widget.type}`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{info.name}</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {index + 1}
                  </Badge>
                  <Badge 
                    variant="secondary" 
                    className="text-[10px] px-1.5 py-0 cursor-pointer"
                    onClick={() => onResizeWidget(widget.id, widget.size === "full" ? "half" : "full")}
                    data-testid={`badge-size-${widget.type}`}
                  >
                    {widget.size === "full" ? (
                      <><Square className="h-2.5 w-2.5 mr-0.5" /> Full</>
                    ) : (
                      <><Columns2 className="h-2.5 w-2.5 mr-0.5" /> Half</>
                    )}
                  </Badge>
                </div>
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
