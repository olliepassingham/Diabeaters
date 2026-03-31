import { getSupabase } from "@/lib/supabase";
import { storage, type Appointment } from "@/lib/storage";

type CloudAppointmentRow = {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  type: string;
  date: string;
  time: string | null;
  scheduled_at: string | null;
  location: string | null;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function parseLocalScheduledAt(date: string, time: string | null | undefined): string | null {
  // Interpret as local time (patient/device). Avoid `new Date("YYYY-MM-DD")` which is parsed as UTC.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  let hh = 12;
  let mm = 0;
  if (time && typeof time === "string") {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (tm) {
      hh = Number(tm[1]);
      mm = Number(tm[2]);
    }
  }
  const d = new Date(year, month - 1, day, hh, mm, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toCloudUpsert(
  userId: string,
  a: Appointment,
): Omit<CloudAppointmentRow, "id" | "created_at" | "updated_at"> {
  return {
    user_id: userId,
    client_id: a.id,
    title: a.title,
    type: a.type,
    date: a.date,
    time: a.time ?? null,
    scheduled_at: parseLocalScheduledAt(a.date, a.time ?? null),
    location: a.location ?? null,
    notes: a.notes ?? null,
    is_completed: a.isCompleted,
    deleted_at: a.deletedAt ?? null,
  };
}

function fromCloudRow(r: CloudAppointmentRow): Appointment {
  const scheduledIso = r.scheduled_at ? String(r.scheduled_at) : null;
  let date = r.date;
  let time: string | undefined = r.time ?? undefined;
  if (scheduledIso) {
    const d = new Date(scheduledIso);
    if (!Number.isNaN(d.getTime())) {
      // Keep UI-compatible fields hydrated for editing/display.
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      date = `${y}-${m}-${day}`;
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      time = `${hh}:${mm}`;
    }
  }
  return {
    id: r.client_id,
    title: r.title,
    // We keep it narrow in the UI; if a new server type appears, fall back to "other".
    type: (["clinic", "eye_check", "foot_check", "blood_test", "pump_review", "other"].includes(r.type)
      ? (r.type as Appointment["type"])
      : "other"),
    date,
    time,
    location: r.location ?? undefined,
    notes: r.notes ?? undefined,
    isCompleted: !!r.is_completed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? undefined,
  };
}

async function getAuthedUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function pushLocalAppointmentsToCloud(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = await getAuthedUserId();
  if (!userId) return;

  const locals = storage.getAppointments();
  const allRaw = (() => {
    // `getAppointments()` filters tombstones; we need the raw list to push deletes too.
    try {
      const raw = localStorage.getItem("diabeater_appointments");
      return raw ? (JSON.parse(raw) as Appointment[]) : locals;
    } catch {
      return locals;
    }
  })();

  if (allRaw.length === 0) return;

  const payload = allRaw.map((a) => toCloudUpsert(userId, a));
  const { error } = await supabase
    .from("appointments")
    .upsert(payload, { onConflict: "user_id,client_id" });

  if (error) {
    // Best-effort sync; keep local UX working.
    if (import.meta.env.DEV) console.warn("appointments: push failed", error);
  }
}

export async function pullCloudAppointmentsToLocal(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = await getAuthedUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id,user_id,client_id,title,type,date,time,scheduled_at,location,notes,is_completed,created_at,updated_at,deleted_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    if (import.meta.env.DEV) console.warn("appointments: pull failed", error);
    return;
  }

  const mapped = (data ?? []).map((r) => fromCloudRow(r as CloudAppointmentRow));
  storage.mergeAppointments(mapped);
}

let lastSyncAt = 0;
let inflight: Promise<void> | null = null;

/** Best-effort local-first sync (push then pull). Safe to call often. */
export function syncAppointments(opts?: { throttleMs?: number }): Promise<void> {
  const throttleMs = opts?.throttleMs ?? 10_000;
  const now = Date.now();
  if (inflight) return inflight;
  if (now - lastSyncAt < throttleMs) return Promise.resolve();

  inflight = (async () => {
    try {
      lastSyncAt = Date.now();
      await pushLocalAppointmentsToCloud();
      await pullCloudAppointmentsToLocal();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

