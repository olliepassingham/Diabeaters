import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Calendar, 
  LayoutGrid, 
  X, 
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
  RectangleHorizontal,
  TrendingDown,
  Heart,
  Shield,
  MessageSquare
} from "lucide-react";
import { DashboardWidget, WidgetType, WidgetSize } from "@/lib/storage";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface WidgetInfo {
  type: WidgetType;
  name: string;
  description: string;
  icon: typeof Package;
  category: WidgetCategory;
}

type WidgetCategory = "health" | "supplies" | "planning" | "social" | "setup";

const CATEGORY_LABELS: Record<WidgetCategory, { label: string; icon: typeof Heart }> = {
  health: { label: "Health & Safety", icon: Heart },
  supplies: { label: "Supplies", icon: Package },
  planning: { label: "Planning & Activity", icon: Calendar },
  social: { label: "Community & Social", icon: Users },
  setup: { label: "Settings & Info", icon: Settings },
};

export const WIDGET_INFO: Record<WidgetType, WidgetInfo> = {
  "supply-summary": {
    type: "supply-summary",
    name: "Supplies",
    description: "View supply levels and days remaining",
    icon: Package,
    category: "supplies",
  },
  "supply-depletion": {
    type: "supply-depletion",
    name: "Depletion Forecast",
    description: "Visual timeline of when supplies run out",
    icon: TrendingDown,
    category: "supplies",
  },
  "scenario-status": {
    type: "scenario-status",
    name: "Scenarios",
    description: "Bedtime check, travel and sick day modes",
    icon: LayoutGrid,
    category: "planning",
  },
  "activity-adviser": {
    type: "activity-adviser",
    name: "Activity Adviser",
    description: "Plan activities, meals and routines with AI guidance",
    icon: Activity,
    category: "planning",
  },
  "ratio-adviser": {
    type: "ratio-adviser",
    name: "Ratio Adviser",
    description: "Your insulin ratios at a glance",
    icon: Syringe,
    category: "health",
  },
  "travel-mode": {
    type: "travel-mode",
    name: "Travel Mode",
    description: "Travel planning and reminders",
    icon: Plane,
    category: "planning",
  },
  "sick-day": {
    type: "sick-day",
    name: "Sick Day Mode",
    description: "Sick day guidance and monitoring",
    icon: Thermometer,
    category: "health",
  },
  "appointments": {
    type: "appointments",
    name: "Appointments",
    description: "Track clinic visits and check-ups",
    icon: Calendar,
    category: "planning",
  },
  "community": {
    type: "community",
    name: "Community",
    description: "Connect with others who understand",
    icon: Users,
    category: "social",
  },
  "messages": {
    type: "messages",
    name: "Messages",
    description: "Your direct message inbox",
    icon: Mail,
    category: "social",
  },
  "settings-completion": {
    type: "settings-completion",
    name: "Settings Progress",
    description: "Track your setup completion",
    icon: Settings,
    category: "setup",
  },
  "help-now-info": {
    type: "help-now-info",
    name: "Emergency Info",
    description: "Quick access to emergency contacts",
    icon: Phone,
    category: "health",
  },
};

interface WidgetLibraryProps {
  widgets: DashboardWidget[];
  onToggleWidget: (widgetId: string, enabled: boolean) => void;
  onMoveWidget: (widgetId: string, direction: "up" | "down") => void;
  onResizeWidget: (widgetId: string, size: WidgetSize) => void;
  onReorderWidgets?: (widgets: DashboardWidget[]) => void;
  onClose: () => void;
}

function SortableWidgetItem({ 
  widget, 
  info, 
  onToggle, 
  onResize,
  dragDisabled,
}: { 
  widget: DashboardWidget; 
  info: WidgetInfo; 
  onToggle: (id: string, enabled: boolean) => void;
  onResize: (id: string, size: WidgetSize) => void;
  dragDisabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = info.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        isDragging ? "opacity-50 shadow-lg z-50" : ""
      } ${widget.enabled ? "bg-muted/30" : "bg-muted/10 opacity-60"}`}
      data-testid={`widget-item-${widget.type}`}
    >
      <div
        className={`touch-none p-1 -m-1 ${dragDisabled ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground cursor-grab active:cursor-grabbing"}`}
        {...(dragDisabled ? {} : { ...attributes, ...listeners })}
        data-testid={`drag-handle-${widget.type}`}
      >
        <GripVertical className="h-5 w-5" />
      </div>
      
      <div className={`p-2 rounded-lg shrink-0 ${widget.enabled ? "bg-primary/10" : "bg-muted"}`}>
        <Icon className={`h-4 w-4 ${widget.enabled ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{info.name}</p>
        <p className="text-xs text-muted-foreground truncate">{info.description}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="text-[10px] gap-1"
          onClick={() => onResize(widget.id, widget.size === "full" ? "half" : "full")}
          title={widget.size === "full" ? "Switch to half width" : "Switch to full width"}
          data-testid={`button-size-${widget.type}`}
        >
          {widget.size === "full" ? (
            <>
              <RectangleHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Full</span>
            </>
          ) : (
            <>
              <Columns2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Half</span>
            </>
          )}
        </Button>

        <Switch 
          checked={widget.enabled}
          onCheckedChange={(checked) => onToggle(widget.id, checked)}
          data-testid={`switch-${widget.type}`}
        />
      </div>
    </div>
  );
}

export function WidgetLibrary({ widgets, onToggleWidget, onMoveWidget, onResizeWidget, onReorderWidgets, onClose }: WidgetLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<WidgetCategory | "all">("all");
  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedWidgets.findIndex(w => w.id === active.id);
    const newIndex = sortedWidgets.findIndex(w => w.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedWidgets, oldIndex, newIndex).map((w, i) => ({
      ...w,
      order: i,
    }));

    if (onReorderWidgets) {
      onReorderWidgets(reordered);
    }
  }, [sortedWidgets, onReorderWidgets]);

  const categories: WidgetCategory[] = ["health", "supplies", "planning", "social", "setup"];
  
  const filteredWidgets = activeCategory === "all" 
    ? sortedWidgets 
    : sortedWidgets.filter(w => {
        const info = WIDGET_INFO[w.type];
        return info && info.category === activeCategory;
      });

  const enabledCount = widgets.filter(w => w.enabled).length;
  const isFiltered = activeCategory !== "all";

  return (
    <Card className="border-primary/50" data-testid="widget-library">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Customise Dashboard</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {enabledCount} widget{enabledCount !== 1 ? "s" : ""} active.{" "}
              {isFiltered ? "Show all to drag & reorder." : "Drag to reorder."}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-library">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <Button
            variant={activeCategory === "all" ? "default" : "outline"}
            size="sm"
            className="rounded-full text-xs shrink-0"
            onClick={() => setActiveCategory("all")}
            data-testid="filter-all"
          >
            All
          </Button>
          {categories.map(cat => {
            const catInfo = CATEGORY_LABELS[cat];
            const CatIcon = catInfo.icon;
            const count = sortedWidgets.filter(w => WIDGET_INFO[w.type]?.category === cat).length;
            return (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                className="rounded-full text-xs shrink-0 gap-1"
                onClick={() => setActiveCategory(cat)}
                data-testid={`filter-${cat}`}
              >
                <CatIcon className="h-3 w-3" />
                {catInfo.label}
                <Badge variant="secondary" className="ml-0.5 text-[9px] px-1 py-0 h-3.5 no-default-hover-elevate no-default-active-elevate">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredWidgets.map(w => w.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {filteredWidgets.map((widget) => {
                const info = WIDGET_INFO[widget.type];
                if (!info) return null;
                return (
                  <SortableWidgetItem
                    key={widget.id}
                    widget={widget}
                    info={info}
                    onToggle={onToggleWidget}
                    onResize={onResizeWidget}
                    dragDisabled={isFiltered}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {filteredWidgets.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No widgets in this category
          </div>
        )}
        
        <div className="pt-3 border-t mt-4">
          <Button onClick={onClose} className="w-full gradient-primary border-primary-border" data-testid="button-done-editing">
            Done
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
