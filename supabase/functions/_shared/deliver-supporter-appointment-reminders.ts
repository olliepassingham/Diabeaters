import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "./deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "./push-token-query.ts";
import {
  appointmentReminderTimes,
  prefsAllowAppointmentAlerts,
  reminderKindsDueNow,
  supporterReminderCopy,
  supporterReminderDedupeKey,
  type AppointmentReminderKind,
} from "./appointment-reminder-schedule.ts";

type AppointmentRow = {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  date: string;
  time: string | null;
  scheduled_at: string | null;
  is_completed: boolean;
  deleted_at: string | null;
};

type CarerLink = { carer_id: string; scopes: unknown };

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function appointmentsScopeOn(scopes: unknown): boolean {
  const s = (scopes && typeof scopes === "object" ? scopes : {}) as Record<string, unknown>;
  return s.appointments === true || s.appointments === "true";
}

async function alreadySent(
  admin: SupabaseClient,
  carerId: string,
  dedupeKey: string,
): Promise<boolean> {
  const { data } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", carerId)
    .eq("data->>dedupe_key", dedupeKey)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function deliverSupporterAppointmentRemindersForPatient(
  admin: SupabaseClient,
  patientId: string,
  patientLabel: string,
  appointments: AppointmentRow[],
  now: Date,
): Promise<{ reminders_attempted: number; inapp_delivered: number; push_delivered: number }> {
  let remindersAttempted = 0;
  let inappDelivered = 0;
  let pushDelivered = 0;

  const { data: linkRows } = await admin
    .from("carer_links")
    .select("carer_id, scopes")
    .eq("patient_id", patientId);

  const carers = (linkRows ?? [])
    .map((r) => ({
      carer_id: String((r as CarerLink).carer_id),
      scopes: (r as CarerLink).scopes,
    }))
    .filter((r) => isUuid(r.carer_id) && appointmentsScopeOn(r.scopes));

  if (carers.length === 0) {
    return { reminders_attempted: 0, inapp_delivered: 0, push_delivered: 0 };
  }

  const carerIds = carers.map((c) => c.carer_id);
  const { data: prefsRows } = await admin
    .from("notification_preferences")
    .select("user_id, prefs")
    .in("user_id", carerIds);
  const prefsByCarer = new Map<string, unknown>(
    (prefsRows ?? []).map((r) => [String((r as { user_id: string }).user_id), (r as { prefs: unknown }).prefs]),
  );

  for (const appt of appointments) {
    if (appt.is_completed || appt.deleted_at) continue;

    const times = appointmentReminderTimes(appt.date, appt.time, appt.scheduled_at);
    if (!times || times.scheduledAt <= now) continue;

    const kinds = reminderKindsDueNow(times, now);
    if (kinds.length === 0) continue;

    const appointmentKey = appt.client_id?.trim() || appt.id;

    for (const kind of kinds) {
      remindersAttempted += 1;
      const copy = supporterReminderCopy(patientLabel, appt.title, appt.time, kind);
      const dedupeKey = supporterReminderDedupeKey(
        patientId,
        appointmentKey,
        appt.date,
        appt.time,
        kind,
      );

      for (const carer of carers) {
        const gate = prefsAllowAppointmentAlerts(prefsByCarer.get(carer.carer_id));
        if (!gate.enabled || !gate.appointmentAlerts) continue;

        if (await alreadySent(admin, carer.carer_id, dedupeKey)) continue;
        if (!gate.inapp && !(gate.push && mobilePushDeliveryConfigured())) continue;

        const data = {
          kind: "appointment_reminder_support",
          reminder_kind: kind,
          patient_user_id: patientId,
          appointment_id: appointmentKey,
          dedupe_key: dedupeKey,
          deep_link: "/notifications?bell=1",
        };

        const { error: insErr } = await admin.from("notifications").insert({
          user_id: carer.carer_id,
          title: copy.title,
          body: copy.body,
          data,
          read: false,
        });
        if (insErr) continue;
        inappDelivered += 1;

        if (gate.push && mobilePushDeliveryConfigured()) {
          const tokenRows = await fetchLatestPushTokensForUserId(admin, carer.carer_id);
          const { delivered } = await deliverPushToTokenRows(
            tokenRows,
            copy.title,
            copy.body,
            data,
            { recipientUserId: carer.carer_id, admin },
          );
          pushDelivered += delivered;
        }
      }
    }
  }

  return { reminders_attempted: remindersAttempted, inapp_delivered: inappDelivered, push_delivered: pushDelivered };
}

export type { AppointmentReminderKind };
