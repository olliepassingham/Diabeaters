/**
 * Shared in-app + iOS push delivery for low/critical supply alerts.
 * Used by `notify_supply_low` (patient JWT) and `notify_supply_low_cron` (service role).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverPushToTokenRows, mobilePushDeliveryConfigured } from "./deliver-push.ts";
import { fetchLatestPushTokensForUserId } from "./push-token-query.ts";

type SupabaseAdmin = ReturnType<typeof createClient>;

export function prefsAllowSupply(prefs: unknown): {
  enabled: boolean;
  supplyAlerts: boolean;
  inapp: boolean;
  push: boolean;
} {
  const p = (prefs && typeof prefs === "object" ? prefs : {}) as Record<string, unknown>;
  return {
    enabled: p.enabled !== false,
    supplyAlerts: p.supply_alerts !== false,
    inapp: p.inapp !== false,
    push: p.push === true,
  };
}

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function supplyLowDedupeKey(patientUserId: string, supplyId: string, level: "low" | "critical"): string {
  return `supplies_low:${patientUserId}:${supplyId}:${level}:${utcDateKey()}`;
}

export function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = String(err.code ?? "");
  const msg = (err.message ?? "").toLowerCase();
  return code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint");
}

export type SupplyLowCarer = { carer_id: string };

export async function deliverSupplyLowAlerts(
  admin: SupabaseAdmin,
  params: {
    patientId: string;
    patientLabel: string;
    supplyId: string;
    supplyName: string;
    level: "low" | "critical";
    daysRemaining: number | null;
    carers: SupplyLowCarer[];
  },
): Promise<{ recipients: number; inappDelivered: number; pushDelivered: number }> {
  const { patientId, patientLabel, supplyId, supplyName, level, daysRemaining, carers } = params;

  const recipients = [patientId, ...carers.map((c) => c.carer_id)];
  const { data: prefsRows } = await admin
    .from("notification_preferences")
    .select("user_id,prefs")
    .in("user_id", recipients);
  const prefsById = new Map<string, unknown>(
    (prefsRows ?? []).map((r: Record<string, unknown>) => [String(r.user_id), r.prefs]),
  );

  const title = level === "critical" ? "Supplies critical" : "Supplies running low";
  const dedupeKey = supplyLowDedupeKey(patientId, supplyId, level);

  let inappDelivered = 0;
  let pushDelivered = 0;

  for (const rid of recipients) {
    const prefs = prefsAllowSupply(prefsById.get(rid));
    if (!prefs.enabled || !prefs.supplyAlerts) continue;

    const isPatient = rid === patientId;
    const bodyText = isPatient
      ? `${supplyName} is ${level}${daysRemaining != null ? ` (${Math.max(0, Math.round(daysRemaining))}d left)` : ""}.`
      : `${patientLabel}: ${supplyName} is ${level}${
          daysRemaining != null ? ` (${Math.max(0, Math.round(daysRemaining))}d left)` : ""
        }.`;

    const data = {
      kind: "supplies_low",
      level,
      supply_id: supplyId,
      supply_name: supplyName,
      days_remaining: daysRemaining,
      patient_user_id: patientId,
      deep_link: isPatient ? "/supplies" : "/carer-view",
    };

    let inappInsertedFresh = false;

    if (prefs.inapp) {
      const { error: insErr } = await admin.from("notifications").insert({
        user_id: rid,
        title,
        body: bodyText,
        data,
        dedupe_key: dedupeKey,
        read: false,
      });
      if (!insErr) {
        inappDelivered += 1;
        inappInsertedFresh = true;
      } else if (isUniqueViolation(insErr)) {
        /* duplicate same-day notify */
      } else {
        console.error("[supply-low-delivery] notification insert", insErr);
      }
    }

    const shouldSendPush =
      prefs.push && mobilePushDeliveryConfigured() && (inappInsertedFresh || !prefs.inapp);

    if (shouldSendPush) {
      const tokenRows = await fetchLatestPushTokensForUserId(admin, rid);
      const { delivered } = await deliverPushToTokenRows(tokenRows, title, bodyText, data);
      pushDelivered += delivered;
    }
  }

  return { recipients: recipients.length, inappDelivered, pushDelivered };
}
