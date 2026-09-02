import { useCallback, useMemo, useState } from "react";
import type { WidgetSize, WidgetType } from "@/lib/storage";
import { DASHBOARD_WIDGET_BY_ID, DASHBOARD_WIDGET_REGISTRY } from "@/config/dashboard-widgets";
import type { DashboardWidgetComponentProps } from "@/config/dashboard-widgets";
import type { ComponentType } from "react";

const STORAGE_KEY = "diabeaters_dashboard_widgets";
const LEGACY_STORAGE_KEY = "diabeater_dashboard_widgets";

export type WidgetPlacement = {
  id: WidgetType;
  type: WidgetType;
  enabled: boolean;
  order: number;
  size: WidgetSize;
};

export type ActiveDashboardWidget = {
  id: WidgetType;
  type: WidgetType;
  size: WidgetSize;
  Component: ComponentType<DashboardWidgetComponentProps>;
};

type PersistedRow = {
  id?: string;
  type?: string;
  enabled?: boolean;
  order?: number;
  size?: WidgetSize;
};

function isWidgetType(s: string): s is WidgetType {
  return DASHBOARD_WIDGET_BY_ID.has(s as WidgetType);
}

function buildDefaultPlacements(): WidgetPlacement[] {
  return DASHBOARD_WIDGET_REGISTRY.map((def, index) => ({
    id: def.id,
    type: def.id,
    enabled: def.defaultEnabled,
    order: index,
    size: def.defaultSize,
  }));
}

function normaliseOrders(list: WidgetPlacement[]): WidgetPlacement[] {
  const sorted = [...list].sort((a, b) => a.order - b.order);
  return sorted.map((p, i) => ({ ...p, order: i }));
}

/**
 * One-time: apply Aug 2026 home defaults — Patterns after Community, Routines off.
 * Preserves custom sizes/enabled for other widgets; only forces Routines off and registry order.
 */
function migrateHomeWidgetDefaultsV2(list: WidgetPlacement[]): WidgetPlacement[] {
  if (typeof localStorage === "undefined") return list;
  const FLAG = "diabeaters_dash_home_order_v2";
  try {
    if (localStorage.getItem(FLAG)) return list;
  } catch {
    return list;
  }

  const byId = new Map(list.map((p) => [p.id, p]));
  const next = DASHBOARD_WIDGET_REGISTRY.map((def, index) => {
    const prev = byId.get(def.id);
    return {
      id: def.id,
      type: def.id,
      enabled: def.id === "routines" ? false : typeof prev?.enabled === "boolean" ? prev.enabled : def.defaultEnabled,
      order: index,
      size:
        prev?.size === "full" || prev?.size === "half"
          ? prev.size
          : def.defaultSize,
    };
  });

  try {
    localStorage.setItem(FLAG, "1");
  } catch {
    /* ignore */
  }
  return next;
}

/** Put practical daily tools before retrospective insights on the redesigned home. */
function migrateHomeWidgetDefaultsV3(list: WidgetPlacement[]): WidgetPlacement[] {
  if (typeof localStorage === "undefined") return list;
  const FLAG = "diabeaters_dash_home_order_v3";
  try {
    if (localStorage.getItem(FLAG)) return list;
  } catch {
    return list;
  }

  const byId = new Map(list.map((placement) => [placement.id, placement]));
  const next = DASHBOARD_WIDGET_REGISTRY.map((definition, index) => {
    const previous = byId.get(definition.id);
    return {
      id: definition.id,
      type: definition.id,
      enabled: typeof previous?.enabled === "boolean" ? previous.enabled : definition.defaultEnabled,
      order: index,
      size:
        previous?.size === "full" || previous?.size === "half"
          ? previous.size
          : definition.defaultSize,
    };
  });

  try {
    localStorage.setItem(FLAG, "1");
  } catch {
    /* ignore */
  }
  return next;
}

function mergeWithRegistry(saved: PersistedRow[] | null): WidgetPlacement[] {
  const defaults = buildDefaultPlacements();
  if (!saved?.length) return defaults;

  const valid = saved.filter((row): row is PersistedRow & { id: WidgetType } => {
    return typeof row.id === "string" && isWidgetType(row.id);
  });

  const byId = new Map<WidgetType, PersistedRow>();
  for (const row of valid) {
    byId.set(row.id, row);
  }

  const merged: WidgetPlacement[] = DASHBOARD_WIDGET_REGISTRY.map((def, index) => {
    const prev = byId.get(def.id);
    return {
      id: def.id,
      type: def.id,
      enabled: typeof prev?.enabled === "boolean" ? prev.enabled : def.defaultEnabled,
      order: typeof prev?.order === "number" ? prev.order : index,
      size:
        prev?.size === "full" || prev?.size === "half"
          ? prev.size
          : def.defaultSize,
    };
  });

  return normaliseOrders(migrateHomeWidgetDefaultsV3(migrateHomeWidgetDefaultsV2(merged)));
}

function loadPlacements(): WidgetPlacement[] {
  if (typeof localStorage === "undefined") return buildDefaultPlacements();

  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw);
      }
    }
    if (!raw) return buildDefaultPlacements();

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return buildDefaultPlacements();

    const merged = mergeWithRegistry(parsed as PersistedRow[]);
    // Persist one-time home order migrations so the hierarchy sticks.
    persistPlacements(merged);
    return merged;
  } catch {
    return buildDefaultPlacements();
  }
}

function persistPlacements(list: WidgetPlacement[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / private mode */
  }
}

export function useDashboardWidgets() {
  const [placements, setPlacements] = useState<WidgetPlacement[]>(() => normaliseOrders(loadPlacements()));

  const commit = useCallback((updater: (prev: WidgetPlacement[]) => WidgetPlacement[]) => {
    setPlacements((prev) => {
      const next = normaliseOrders(updater(prev));
      persistPlacements(next);
      return next;
    });
  }, []);

  const toggleWidget = useCallback(
    (id: WidgetType, enabled: boolean) => {
      commit((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
    },
    [commit],
  );

  const setWidgetSize = useCallback(
    (id: WidgetType, size: WidgetSize) => {
      commit((prev) => prev.map((p) => (p.id === id ? { ...p, size } : p)));
    },
    [commit],
  );

  const reorderWidgets = useCallback(
    (orderedIds: WidgetType[]) => {
      commit((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        const next: WidgetPlacement[] = [];
        let o = 0;
        for (const id of orderedIds) {
          const p = byId.get(id);
          if (p) next.push({ ...p, order: o++ });
        }
        for (const p of prev) {
          if (!orderedIds.includes(p.id)) next.push({ ...p, order: o++ });
        }
        return next;
      });
    },
    [commit],
  );

  const moveWidget = useCallback(
    (id: WidgetType, direction: "up" | "down") => {
      commit((prev) => {
        const sorted = normaliseOrders(prev);
        const idx = sorted.findIndex((p) => p.id === id);
        if (idx < 0) return prev;
        const j = direction === "up" ? idx - 1 : idx + 1;
        if (j < 0 || j >= sorted.length) return prev;
        const copy = [...sorted];
        [copy[idx], copy[j]] = [copy[j]!, copy[idx]!];
        return copy.map((p, i) => ({ ...p, order: i }));
      });
    },
    [commit],
  );

  const resetWidgets = useCallback(() => {
    const fresh = buildDefaultPlacements();
    persistPlacements(fresh);
    setPlacements(fresh);
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const orderedPlacements = useMemo(() => normaliseOrders(placements), [placements]);

  const activeWidgets: ActiveDashboardWidget[] = useMemo(() => {
    return orderedPlacements
      .filter((p) => p.enabled)
      .map((p) => {
        const def = DASHBOARD_WIDGET_BY_ID.get(p.id);
        if (!def?.component) return null;
        return {
          id: p.id,
          type: p.type,
          size: p.size,
          Component: def.component,
        };
      })
      .filter((x): x is ActiveDashboardWidget => x != null);
  }, [orderedPlacements]);

  return {
    placements: orderedPlacements,
    activeWidgets,
    toggleWidget,
    moveWidget,
    setWidgetSize,
    reorderWidgets,
    resetWidgets,
  };
}
