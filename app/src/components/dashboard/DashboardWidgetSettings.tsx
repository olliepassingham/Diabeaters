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
import { Drawer } from "vaul";
import { X } from "lucide-react";
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
import { Columns2, GripVertical, LayoutGrid, RectangleHorizontal } from "lucide-react";
import { DASHBOARD_WIDGET_BY_ID } from "@/config/dashboard-widgets";
import type { WidgetPlacement } from "@/hooks/useDashboardWidgets";
import type { WidgetSize, WidgetType } from "@/lib/storage";
import { shouldOfferWelcomeWidget } from "@/components/widgets/welcome-widget";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/** Max panel height: viewport minus status bar, home indicator, and bottom tab bar. */
const MOBILE_PANEL_MAX_H =
  "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - var(--bottom-nav-height, 7.5rem) - 0.75rem)";

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

function WidgetSettingsHeader({ enabledCount }: { enabledCount: number }) {
  return (
    <div className="shrink-0 space-y-1 border-b border-border/60 px-4 py-2.5 pr-11 text-left sm:py-3">
      <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
        <LayoutGrid className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" aria-hidden />
        Customise dashboard
      </h2>
      <div className="flex items-start gap-1 text-xs text-muted-foreground sm:text-sm">
        <span className="min-w-0 flex-1">Drag to reorder · {enabledCount} visible on home</span>
        <InlineInfoHint
          ariaLabel="About customising widgets"
          className="h-9 w-9"
          content="Choose which cards appear on your dashboard and drag them into your preferred order. Your choices are saved on this device."
        />
      </div>
    </div>
  );
}

function WidgetSettingsFooter({
  onReset,
  onDone,
}: {
  onReset: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-t border-border/60 bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-full rounded-xl text-muted-foreground sm:w-auto"
        onClick={onReset}
        data-testid="button-reset-widgets"
      >
        Reset to defaults
      </Button>
      <Button
        type="button"
        size="default"
        className="w-full min-h-10 rounded-xl sm:w-auto"
        onClick={onDone}
        data-testid="button-done-editing"
      >
        Done
      </Button>
    </div>
  );
}

function WidgetSettingsList({
  sortedForUi,
  sensors,
  onDragEnd,
  toggleWidget,
  setWidgetSize,
  allowResize,
  scrollable = false,
}: {
  sortedForUi: WidgetPlacement[];
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  toggleWidget: (id: WidgetType, enabled: boolean) => void;
  setWidgetSize: (id: WidgetType, size: WidgetSize) => void;
  allowResize: boolean;
  /** When false, list is fixed height (better for drag-to-reorder on phone). */
  scrollable?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-3 py-2 sm:px-4",
        scrollable
          ? "min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          : "shrink-0 overflow-hidden",
      )}
      data-testid="widget-settings-scroll"
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
  const isMobile = useIsMobile();
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

  const listProps = {
    sortedForUi,
    sensors,
    onDragEnd: handleDragEnd,
    toggleWidget,
    setWidgetSize,
    allowResize,
  };

  if (isMobile) {
    return (
      <Drawer.Root
        open={open}
        onOpenChange={onOpenChange}
        handleOnly
        shouldScaleBackground={false}
        repositionInputs={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[110] bg-black/80" />
          <Drawer.Content
            className={cn(
              "fixed inset-x-2 z-[110] flex h-auto max-h-[var(--widget-settings-max-h)] flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl outline-none",
              "bottom-[calc(var(--bottom-nav-height,7.5rem)+env(safe-area-inset-bottom,0px)+0.35rem)]",
            )}
            style={{ ["--widget-settings-max-h" as string]: MOBILE_PANEL_MAX_H }}
            data-testid="dashboard-widget-settings-dialog"
          >
            <div className="flex shrink-0 justify-center pt-2">
              <Drawer.Handle
                className="!h-1 !w-12 shrink-0 !rounded-full !bg-muted-foreground/40"
                aria-label="Drag down to close"
              />
            </div>
            <Drawer.Close className="absolute right-3 top-3 rounded-sm p-1.5 text-foreground opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">Close</span>
            </Drawer.Close>
            <Drawer.Title className="sr-only">Customise dashboard</Drawer.Title>
            <Drawer.Description className="sr-only">
              Drag to reorder widgets on your home screen.
            </Drawer.Description>
            <WidgetSettingsHeader enabledCount={enabledCount} />
            <WidgetSettingsList {...listProps} scrollable={false} />
            <WidgetSettingsFooter onReset={resetWidgets} onDone={() => onOpenChange(false)} />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-lg"
        data-testid="dashboard-widget-settings-dialog"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Customise dashboard</DialogTitle>
          <DialogDescription>Drag to reorder widgets on your home screen.</DialogDescription>
        </DialogHeader>
        <WidgetSettingsHeader enabledCount={enabledCount} />
        <WidgetSettingsList {...listProps} scrollable />
        <DialogFooter className="p-0">
          <WidgetSettingsFooter onReset={resetWidgets} onDone={() => onOpenChange(false)} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
