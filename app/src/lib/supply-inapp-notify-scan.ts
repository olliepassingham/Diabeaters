import { invokeNotifySupplyLow } from "@/lib/invoke-notify-supply-low";
import { notifyInAppNotificationsChanged } from "@/lib/in-app-notifications-events";
import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";

const SUPPLY_ALERT_STATE_KEY = "diabeater_supply_alert_state_v1";

export type SupplyAlertLevel = "ok" | "low" | "critical";

function getSupplyAlertState(): Record<string, SupplyAlertLevel> {
  try {
    const raw = localStorage.getItem(SUPPLY_ALERT_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, SupplyAlertLevel>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setSupplyAlertState(state: Record<string, SupplyAlertLevel>) {
  try {
    localStorage.setItem(SUPPLY_ALERT_STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export type SupplyInAppNotifyScanResult = {
  /** True if at least one edge invoke succeeded (in-app row likely created). */
  notified: boolean;
  /** First failed invoke payload when all attempts in this run failed after at least one attempt. */
  edgeFailure: { success: false; error?: string; detail?: string } | null;
};

/**
 * When supply levels cross low/critical thresholds, call the cloud notify function so the in-app inbox
 * (and carers) receive the same alerts as on the Supplies screen. Updates persisted threshold state.
 */
export async function runSupplyLowInAppNotifyScan(): Promise<SupplyInAppNotifyScanResult> {
  const s = storage.getNotificationSettings();
  if (!s.enabled || !s.supplyAlerts) {
    return { notified: false, edgeFailure: null };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { notified: false, edgeFailure: null };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.user) {
    return { notified: false, edgeFailure: null };
  }

  const criticalDays = Math.max(0, Number(s.criticalThresholdDays || 0));
  const lowDays = Math.max(criticalDays, Number(s.lowThresholdDays || 0));
  if (lowDays <= 0) {
    return { notified: false, edgeFailure: null };
  }

  const state = getSupplyAlertState();
  const nextState: Record<string, SupplyAlertLevel> = { ...state };
  const all = storage.getSupplies();

  let notified = false;
  let edgeFailure: SupplyInAppNotifyScanResult["edgeFailure"] = null;

  for (const item of all) {
    const adjustedQty = storage.getAdjustedQuantity(item);
    const effectiveUsage = storage.getEffectiveDailyUsage(item);
    const isIntervalType = item.type === "cgm" || item.type === "infusion_set" || item.type === "reservoir";
    const isManualOnly = effectiveUsage <= 0 && !isIntervalType;
    const isGlycogen = /glycogen/i.test(item.name || "");
    if ((isManualOnly || isGlycogen) && adjustedQty > 0) {
      continue;
    }

    const days = storage.getDaysRemaining(item);
    const rounded = !Number.isFinite(days) ? 999 : Math.round(days);
    const level: SupplyAlertLevel =
      rounded <= criticalDays ? "critical" : rounded <= lowDays ? "low" : "ok";

    const prev = state[item.id] ?? "ok";
    nextState[item.id] = level;

    const shouldSend =
      (prev === "ok" && (level === "low" || level === "critical")) ||
      (prev === "low" && level === "critical");
    if (!shouldSend) continue;

    const res = await invokeNotifySupplyLow({
      supplyId: item.id,
      supplyName: item.name,
      level: level === "critical" ? "critical" : "low",
      daysRemaining: rounded,
    });
    if (res.success) {
      notified = true;
      notifyInAppNotificationsChanged({ skipPageRefresh: true });
    } else {
      nextState[item.id] = prev;
      if (!edgeFailure) {
        edgeFailure = { success: false, error: res.error, detail: res.detail };
      }
    }
  }

  setSupplyAlertState(nextState);
  return { notified, edgeFailure };
}
