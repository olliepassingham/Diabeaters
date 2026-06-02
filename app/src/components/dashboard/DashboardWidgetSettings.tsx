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
import { InlineInfoHint } from "@/components/ui/field-label-with-info";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Columns2, GripVertical, LayoutGrid, RectangleHorizontal } from "lucide-react";
import { DASHBOARD_WIDGET_BY_ID } from "@/config/dashboard-widgets";
import type { WidgetPlacement } from "@/hooks/useDashboardWidgets";
import type { WidgetSize, WidgetType } from "@/lib/storage";
import { shouldOfferWelcomeWidget } from "@/components/widgets/welcome-widget";
import { cn } from "@/lib/utils";

export type DashboardWidgetSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placements: WidgetPlacement[];
  toggleWidget: (id: WidgetType, enabled: boolean) => void;
  setWidgetSize: (id: WidgetType, size: WidgetSize) => void;
  reorderWidgets: (orderedIds: WidgetType[]) => void;
  resetWidgets: () => void;
  /** When true, hide the Settings progress row (setup is complete). */
  isSettingsComplete?: boolean;
  /** When false, hide the half/full width control (mobile: always full width). */
  allowResize?: boolean;
};

function SortableRow({
  placement,
  onToggle,
  onResize,
  allowResize,
}: {
  placement: WidgetPlacement;
  onToggle: (id: WidgetType, enabled: boolean) => void;
  onResize: (id: WidgetType, size: WidgetSize) => void;
  allowResize: boolean;
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
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border/50 bg-muted/15 px-2 py-1.5 shadow-sm dark:bg-background/30",
        isDragging && "z-50 opacity-95 shadow-md ring-2 ring-primary/25",
        !placement.enabled && "opacity-70",
      )}
      data-testid={`widget-item-${placement.type}`}
    >
      <button
        type="button"
        className="touch-none flex h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground active:cursor-grabbing hover:bg-muted/50 hover:text-foreground"
        aria-label={`Drag to reorder ${def.label}`}
        data-testid={`drag-handle-${placement.type}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{def.label}</p>
        <p className="hidden text-[11px] leading-snug text-muted-foreground line-clamp-1 sm:block">{def.description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {allowResize ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg"
            onClick={() => onResize(placement.id, placement.size === "full" ? "half" : "full")}
            title={placement.size === "full" ? "Use half width on large screens" : "Use full width"}
            data-testid={`button-size-${placement.type}`}
          >
            {placement.size === "full" ? (
              <RectangleHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <Columns2 className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="sr-only">{placement.size === "full" ? "Full width" : "Half width"}</span>
          </Button>
        ) : null}

        <div className="flex items-center">
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
  isSettingsComplete = false,
  allowResize = true,
}: DashboardWidgetSettingsProps) {
  const sorted = useMemo(() => [...placements].sort((a, b) => a.order - b.order), [placements]);
  const sortedForUi = useMemo(() => {
    const base = isSettingsComplete ? sorted.filter((p) => p.type !== "settings-completion") : sorted;
    const welcomeOk = shouldOfferWelcomeWidget();
    return welcomeOk ? base : base.filter((p) => p.type !== "welcome");
  }, [sorted, isSettingsComplete]);
  const enabledCount = sortedForUi.filter((p) => p.enabled).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sortedForUi.findIndex((p) => p.id === active.id);
      const newIndex = sortedForUi.findIndex((p) => p.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const moved = arrayMove(sortedForUi, oldIndex, newIndex).map((p) => p.id);
      reorderWidgets(moved);
    },
    [sortedForUi, reorderWidgets],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "grid w-[calc(100%-1rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
          "h-[min(calc(100dvh-var(--bottom-nav-height,7.5rem)-1rem),88dvh)]",
          "top-auto bottom-[calc(var(--bottom-nav-height,7.5rem)+env(safe-area-inset-bottom,0px)+0.35rem)] translate-x-[-50%] translate-y-0",
          "sm:top-[50%] sm:bottom-auto sm:h-[min(90dvh,40rem)] sm:translate-y-[-50%]",
        )}
        data-testid="dashboard-widget-settings-dialog"
      >
        <DialogHeader className="space-y-1 border-b border-border/60 px-4 py-2.5 pr-11 text-left sm:py-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
            <LayoutGrid className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" aria-hidden />
            Customise dashboard
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-start gap-1 text-xs text-muted-foreground sm:text-sm">
              <span className="min-w-0 flex-1">
                Drag to reorder · {enabledCount} visible on home
              </span>
              <InlineInfoHint
                ariaLabel="About customising widgets"
                content="Choose which cards appear on your dashboard and drag them into your preferred order. Your choices are saved on this device."
              />
            </div>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-full min-h-0" data-testid="widget-settings-scroll">
          <div className="px-3 py-2 sm:px-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedForUi.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5 pb-1" data-testid="widget-library">
                  {sortedForUi.map((p) => (
                    <SortableRow
                      key={p.id}
                      placement={p}
                      onToggle={toggleWidget}
                      onResize={setWidgetSize}
                      allowResize={allowResize}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col gap-1.5 border-t border-border/60 bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-full rounded-xl text-muted-foreground sm:w-auto"
            onClick={() => {
              resetWidgets();
            }}
            data-testid="button-reset-widgets"
          >
            Reset to defaults
          </Button>
          <Button
            type="button"
            size="default"
            className="w-full min-h-10 rounded-xl sm:w-auto"
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
