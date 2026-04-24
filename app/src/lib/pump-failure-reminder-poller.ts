import { Capacitor } from "@capacitor/core";

import { createPumpFailureInAppNotification } from "@/lib/pump-failure-inapp";
import { storage, type PumpFailureReminderKind } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";

let runLock = false;

function copyFor(kind: PumpFailureReminderKind): { title: string; body: string } {
  if (kind === "bg_recheck_60m") {
    return { title: "Recheck glucose (1 hour)", body: "Recheck glucose now. If still rising/high, follow your clinic’s pump failure plan." };
  }
  if (kind === "bg_recheck_120m") {
    return { title: "Recheck glucose (2 hours)", body: "Recheck glucose now. Consider site/set change and urgent advice if you’re not improving." };
  }
  if (kind === "ketone_recheck_120m") {
    return { title: "Recheck ketones (2 hours)", body: "If you have ketone strips, recheck now. Seek urgent help if moderate/large or vomiting." };
  }
  return { title: "Next‑morning review", body: "Quick check-in: did you stabilise overnight? Tap to review and plan for next time." };
}

export async function runPumpFailureReminderNotifier(): Promise<void> {
  if (runLock) return;
  runLock = true;
  try {
    const sc = storage.getScenarioState();
    if (!sc.pumpFailureActive) return;
    const session = storage.getPumpFailureSession();
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
      const res = await createPumpFailureInAppNotification({
        userId: uid,
        title: `Pump failure: ${copy.title}`,
        body: copy.body,
        kind: r.kind,
        sessionId: session.id,
      });
      if (!res.ok) continue;

      const updated = storage.getPumpFailureSession();
      if (!updated || updated.id !== session.id) continue;

      updated.reminders = updated.reminders.map((x) =>
        x.kind === r.kind && x.atIso === r.atIso ? { ...x, sentAtIso: new Date().toISOString() } : x,
      );
      storage.savePumpFailureSession(updated);

      if (!Capacitor.isNativePlatform() && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Pump failure reminder", {
            body: copy.body,
            tag: `pump-failure-${session.id}-${r.kind}-${r.atIso}`,
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

