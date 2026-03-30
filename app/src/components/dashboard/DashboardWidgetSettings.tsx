import { useCallback, useMemo } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GripVertical, Columns2, RectangleHorizontal } from "lucide-react";
import { DASHBOARD_WIDGET_BY_ID } from "@/config/dashboard-widgets";
import type { WidgetPlacement } from "@/hooks/useDashboardWidgets";
import type { WidgetSize, WidgetType } from "@/lib/storage";

export type DashboardWidgetSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placements: WidgetPlacement[];
  toggleWidget: (id: WidgetType, enabled: boolean) => void;
  setWidgetSize: (id: WidgetType, size: WidgetSize) => void;
  reorderWidgets: (orderedIds: WidgetType[]) => void;
  resetWidgets: () => void;
};

function SortableRow({
  placement,
  onToggle,
  onResize,
}: {
  placement: WidgetPlacement;
  onToggle: (id: WidgetType, enabled: boolean) => void;
  onResize: (id: WidgetType, size: WidgetSize) => void;
}) {
  const def = DASHBOARD_WIDGET_BY_ID.get(placement.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: placement.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!def) return null;

  const switchId = `widget-toggle-${placement.id}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-3 rounded-xl border-0 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4 dark:bg-card ${
        isDragging ? "z-50 opacity-90 shadow-md ring-2 ring-primary/20" : ""
      } ${placement.enabled ? "" : "opacity-75"}`}
      data-testid={`widget-item-${placement.type}`}
    >
      <button
        type="button"
        className="touch-none flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-500 active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-muted"
        aria-label={`Drag to reorder ${def.label}`}
        data-testid={`drag-handle-${placement.type}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-foreground">{def.label}</h3>
        <p className="text-sm text-gray-600 dark:text-muted-foreground">{def.description}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 sm:flex-nowrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 rounded-xl"
          onClick={() => onResize(placement.id, placement.size === "full" ? "half" : "full")}
          title={placement.size === "full" ? "Use half width on large screens" : "Use full width"}
          data-testid={`button-size-${placement.type}`}
        >
          {placement.size === "full" ? (
            <>
              <RectangleHorizontal className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Full width</span>
            </>
          ) : (
            <>
              <Columns2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Half width</span>
            </>
          )}
        </Button>

        <div className="flex items-center gap-2">
          <Label htmlFor={switchId} className="sr-only">
            Show {def.label} on dashboard
          </Label>
          <Switch
            id={switchId}
            checked={placement.enabled}
            onCheckedChange={(checked) => onToggle(placement.id, checked)}
            data-testid={`switch-${placement.type}`}
          />
        </div>
      </div>
    </div>
  );
}

export function DashboardWidgetSettings({
  open,
  onOpenChange,
  placements,
  toggleWidget,
  setWidgetSize,
  reorderWidgets,
  resetWidgets,
}: DashboardWidgetSettingsProps) {
  const sorted = useMemo(() => [...placements].sort((a, b) => a.order - b.order), [placements]);
  const enabledCount = sorted.filter((p) => p.enabled).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sorted.findIndex((p) => p.id === active.id);
      const newIndex = sorted.findIndex((p) => p.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const moved = arrayMove(sorted, oldIndex, newIndex).map((p) => p.id);
      reorderWidgets(moved);
    },
    [sorted, reorderWidgets],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-lg gap-0 overflow-y-auto p-0 sm:max-w-lg"
        data-testid="dashboard-widget-settings-dialog"
      >
        <DialogHeader className="space-y-1 border-b border-gray-100 px-6 py-5 text-left dark:border-border">
          <DialogTitle className="text-xl font-semibold">Edit dashboard widgets</DialogTitle>
          <DialogDescription className="text-base text-gray-600 dark:text-muted-foreground">
            Choose which cards appear on your dashboard and drag them into your preferred order. Your choices are saved on
            this device.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <Card className="border-0 shadow-md" data-testid="widget-library">
            <CardHeader className="px-5 pb-2 pt-5">
              <CardTitle className="text-h3 text-foreground">Widgets</CardTitle>
              <p className="text-sm text-gray-500 dark:text-muted-foreground">
                {enabledCount} widget{enabledCount === 1 ? "" : "s"} visible on the dashboard
              </p>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5 pt-0">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sorted.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-3">
                    {sorted.map((p) => (
                      <SortableRow
                        key={p.id}
                        placement={p}
                        onToggle={toggleWidget}
                        onResize={setWidgetSize}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-gray-100 px-6 py-4 sm:flex-row sm:justify-between dark:border-border">
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-xl sm:w-auto"
            onClick={() => {
              resetWidgets();
            }}
            data-testid="button-reset-widgets"
          >
            Reset to defaults
          </Button>
          <Button
            type="button"
            className="w-full rounded-xl sm:w-auto"
            onClick={() => onOpenChange(false)}
            data-testid="button-done-editing"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
