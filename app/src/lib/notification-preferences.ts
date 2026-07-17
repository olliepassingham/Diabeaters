import { DEFAULT_BEDTIME_REMINDER_TIME } from "@/lib/bedtime-reminder-schedule";
import type { NotificationSettings } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";
import {
  resolveSupporterLiveGlucoseAlertLimitsMmol,
} from "@/lib/supporter-live-glucose-alerts";

export function toCloudPrefs(settings: NotificationSettings): Record<string, unknown> {
  const liveLimits = resolveSupporterLiveGlucoseAlertLimitsMmol(settings);
  return {
    enabled: Boolean(settings.enabled),
    push: Boolean(settings.pushNotifications),
    inapp: true,
    supply_alerts: Boolean(settings.supplyAlerts),
    critical_threshold_days: Number(settings.criticalThresholdDays || 0),
    low_threshold_days: Number(settings.lowThresholdDays || 0),
    appointment_reminders: Boolean(settings.appointmentReminders),
    bedtime_check_reminders: settings.bedtimeCheckReminders !== false,
    bedtime_reminder_time: settings.bedtimeReminderTime || DEFAULT_BEDTIME_REMINDER_TIME,
    supporter_appointment_reminders: settings.supporterAppointmentReminders !== false,
    appointment_alerts: settings.appointmentAlerts !== false,
    hypo_alerts: settings.hypoAlerts !== false,
    live_glucose_alerts: settings.liveGlucoseAlerts !== false,
    live_glucose_alert_low: liveLimits.low,
    live_glucose_alert_high: liveLimits.high,
    scenario_alerts: settings.scenarioAlerts !== false,
    feed_alerts: settings.communityFeedAlerts !== false,
    dm_alerts: settings.communityDmAlerts !== false,
    exercise_cgm_alerts: settings.exerciseCgmAlerts !== false,
    exercise_cgm_alert_threshold: settings.exerciseCgmAlertThreshold ?? null,
    exercise_cgm_alert_trend_aware: settings.exerciseCgmAlertTrendAware !== false,
  };
}

export async function syncNotificationPreferences(settings: NotificationSettings): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return;

  const prefs = toCloudPrefs(settings);
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: uid, prefs }, { onConflict: "user_id" });

  if (error) {
    console.warn("[notification_preferences] upsert failed:", error.message);
  }
}

