import { Capacitor } from "@capacitor/core";

import { endAlcoholNightMode } from "@/lib/alcohol-reminders";
import { createAlcoholInAppNotification } from "@/lib/alcohol-inapp";
import { storage, type AlcoholReminderKind } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";

let runLock = false;

function copyFor(kind: AlcoholReminderKind): { title: string; body: string } {
  if (kind === "bedtime_check") {
    return {
      title: "Bedtime check",
      body: "Alcohol can cause delayed lows overnight. Check glucose before sleep and treat lows as taught by your team.",
    };
  }
  if (kind === "overnight_check") {
    return {
      title: "Overnight check",
      body: "Delayed lows can happen after drinking. Recheck glucose and treat lows as taught by your team.",
    };
  }
  return {
    title: "Next‑morning review",
    body: "Quick check-in: how did overnight go? Tap to review and plan for next time.",
  };
}

export async function runAlcoholReminderNotifier(): Promise<void> {
  if (runLock) return;
  runLock = true;
  try {
    const sc = storage.getScenarioState();
    if (!sc.alcoholModeActive) return;
    const session = storage.getAlcoholSession();
    if (!session || session.endedAtIso) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return;

    const nowMs = Date.now();

    for (const r of session.reminders) {
      const atMs = new Date(r.atIso).getTime();
      if (!Number.isFinite(atMs)) continue;
      if (nowMs < atMs) continue;
      if (r.sentAtIso) continue;

      const copy = copyFor(r.kind);
      const res = await createAlcoholInAppNotification({
        userId: uid,
        title: `Alcohol: ${copy.title}`,
        body: copy.body,
        kind: r.kind,
        sessionId: session.id,
      });
      if (!res.ok) continue;

      const updated = storage.getAlcoholSession();
      if (!updated || updated.id !== session.id) continue;

      updated.reminders = updated.reminders.map((x) =>
        x.kind === r.kind && x.atIso === r.atIso ? { ...x, sentAtIso: new Date().toISOString() } : x,
      );
      storage.saveAlcoholSession(updated);

      // Auto-end Alcohol Mode after the morning review reminder is sent.
      if (r.kind === "morning_review") {
        try {
          await endAlcoholNightMode();
        } catch {
          // ignore
        }
      }

      if (!Capacitor.isNativePlatform() && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Alcohol reminder", {
            body: copy.body,
            tag: `alcohol-${session.id}-${r.kind}-${r.atIso}`,
          });
        } catch {
          // ignore
        }
      }
    }
  } finally {
    runLock = false;
  }
}

