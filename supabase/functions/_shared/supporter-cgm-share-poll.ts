/**
 * Poll stored Dexcom Share logins and refresh patient_live_glucose for supporters.
 * Credentials stay encrypted with EXERCISE_CGM_MONITOR_SECRET.
 */
import { fetchLatestDexcomShareReading } from "./dexcom-share-client.ts";
import { decryptExerciseCgmSecret } from "./exercise-cgm-crypto.ts";
import { mapDexcomShareTrend, mgDlToDisplay } from "./exercise-cgm-alert-eval.ts";
import { notifyLinkedCarersOfLiveGlucose } from "./notify-carers-live-glucose.ts";

const BATCH = 25;

type AdminClient = {
  from: (table: string) => any;
};

type PollRow = {
  user_id: string;
  dexcom_server: "eu" | "us" | "jp";
  dexcom_username: string;
  dexcom_password_ciphertext: string;
  dexcom_password_iv: string;
  bg_units: "mmol/L" | "mg/dL";
  target_low: number | null;
  target_high: number | null;
};

export type SupporterCgmPollStats = {
  polled: number;
  updated: number;
  cleared: number;
  errors: number;
};

function trendForRow(raw: string | null): "rising" | "falling" | "flat" | null {
  const mapped = mapDexcomShareTrend(raw);
  if (mapped === "rising" || mapped === "falling" || mapped === "flat") return mapped;
  return null;
}

function defaultTargets(units: "mmol/L" | "mg/dL"): { low: number; high: number } {
  return units === "mg/dL" ? { low: 72, high: 180 } : { low: 4, high: 10 };
}

function rangeStatus(value: number, low: number, high: number): "low" | "in_range" | "high" {
  if (!(high > low) || !Number.isFinite(value)) return "in_range";
  if (value < low) return "low";
  if (value > high) return "high";
  return "in_range";
}

function shortError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\s+/g, " ").slice(0, 180);
}

async function sharingStillOn(admin: AdminClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.from("carer_links").select("scopes").eq("patient_id", userId);
  if (error) throw new Error("carer_links_fetch_failed");
  return (data ?? []).some((row: { scopes?: unknown }) => {
    const scopes = (row.scopes && typeof row.scopes === "object" ? row.scopes : {}) as Record<string, unknown>;
    return scopes.live_glucose !== false;
  });
}

async function markPoll(admin: AdminClient, userId: string, nowIso: string, lastError: string | null) {
  await admin
    .from("patient_supporter_cgm_poll")
    .update({ last_polled_at: nowIso, last_error: lastError, updated_at: nowIso })
    .eq("user_id", userId);
}

export async function pollSupporterCgmShares(
  admin: AdminClient,
  cryptoSecret: string,
): Promise<SupporterCgmPollStats> {
  const stats: SupporterCgmPollStats = { polled: 0, updated: 0, cleared: 0, errors: 0 };
  const { data: rows, error } = await admin
    .from("patient_supporter_cgm_poll")
    .select(
      "user_id, dexcom_server, dexcom_username, dexcom_password_ciphertext, dexcom_password_iv, bg_units, target_low, target_high",
    )
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);

  if (error || !rows) {
    stats.errors += 1;
    return stats;
  }

  for (const raw of rows as PollRow[]) {
    const nowIso = new Date().toISOString();
    try {
      const stillOn = await sharingStillOn(admin, raw.user_id);
      if (!stillOn) {
        await admin.from("patient_supporter_cgm_poll").delete().eq("user_id", raw.user_id);
        stats.cleared += 1;
        continue;
      }

      let password: string;
      try {
        password = await decryptExerciseCgmSecret(
          { ciphertext: raw.dexcom_password_ciphertext, iv: raw.dexcom_password_iv },
          cryptoSecret,
        );
      } catch {
        await markPoll(admin, raw.user_id, nowIso, "decrypt_failed");
        stats.errors += 1;
        continue;
      }

      let reading;
      try {
        reading = await fetchLatestDexcomShareReading({
          username: raw.dexcom_username,
          password,
          server: raw.dexcom_server,
        });
      } catch (e) {
        await markPoll(admin, raw.user_id, nowIso, shortError(e));
        stats.polled += 1;
        stats.errors += 1;
        continue;
      }

      stats.polled += 1;
      if (!reading) {
        await markPoll(admin, raw.user_id, nowIso, "no_reading");
        continue;
      }

      const units = raw.bg_units === "mg/dL" ? "mg/dL" : "mmol/L";
      const value = mgDlToDisplay(reading.valueMgDl, units);
      const defaults = defaultTargets(units);
      const targetLow = Number(raw.target_low);
      const targetHigh = Number(raw.target_high);
      const low = Number.isFinite(targetLow) && targetLow > 0 ? targetLow : defaults.low;
      const high = Number.isFinite(targetHigh) && targetHigh > low ? targetHigh : defaults.high;

      const { data: existing } = await admin
        .from("patient_live_glucose")
        .select("recorded_at")
        .eq("user_id", raw.user_id)
        .maybeSingle();
      const existingMs = existing?.recorded_at ? new Date(String(existing.recorded_at)).getTime() : 0;
      const nextMs = new Date(reading.recordedAt).getTime();
      if (Number.isFinite(existingMs) && existingMs >= nextMs) {
        await markPoll(admin, raw.user_id, nowIso, null);
        continue;
      }

      const { error: upsertErr } = await admin.from("patient_live_glucose").upsert(
        {
          user_id: raw.user_id,
          value,
          units,
          trend: trendForRow(reading.trend),
          source_label: "Dexcom Share",
          recorded_at: reading.recordedAt,
          target_low: low,
          target_high: high,
          range_status: rangeStatus(value, low, high),
          updated_at: nowIso,
        },
        { onConflict: "user_id" },
      );
      if (upsertErr) {
        await markPoll(admin, raw.user_id, nowIso, "upsert_failed");
        stats.errors += 1;
        continue;
      }

      await markPoll(admin, raw.user_id, nowIso, null);
      stats.updated += 1;
      try {
        await notifyLinkedCarersOfLiveGlucose(admin, raw.user_id);
      } catch {
        // The reading is saved even if the check-in alert step fails.
      }
    } catch {
      stats.errors += 1;
      await markPoll(admin, raw.user_id, nowIso, "poll_failed");
    }
  }

  return stats;
}
