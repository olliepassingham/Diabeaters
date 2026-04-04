/**
 * Family & Carers — Supabase helpers (patient invites/links, carer redeem, scoped reads).
 * Requires tables/RPC from docs/sql/family_carers.sql (not executed from the app).
 */
import { getSupabase } from "./supabase";
import type {
  CarerInviteRow,
  CarerLinkRow,
  CarerLinkWithProfile,
  CarerScopes,
  CloudHypoLogRow,
  CloudSupplyRow,
  LinkedPatientInfo,
  LinkedPatientWithProfile,
} from "./carers.types";
import { DEFAULT_CARER_SCOPES } from "./carers.types";

const NOT_CONFIGURED = new Error(
  "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (preferred) or .env.",
);

const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 8;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function randomInviteCode(): string {
  const arr = new Uint32Array(INVITE_LENGTH);
  crypto.getRandomValues(arr);
  let s = "";
  for (let i = 0; i < INVITE_LENGTH; i++) {
    s += INVITE_CHARS[arr[i]! % INVITE_CHARS.length];
  }
  return s;
}

type RestishError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

/** Missing table, stale PostgREST schema cache, or HTTP 404 on carer_links lookup. */
function isCarerLinksInfrastructureError(err: RestishError): boolean {
  const raw = err.message ?? "";
  const blob = [raw, err.details, err.hint].filter(Boolean).join(" ").toLowerCase();
  const status = err.status;
  return (
    status === 404 ||
    /\b404\b/.test(blob) ||
    blob.includes("does not exist") ||
    blob.includes("schema cache") ||
    blob.includes("pgrst205") ||
    blob.includes("could not find the table") ||
    (blob.includes("relation") && blob.includes("carer_links"))
  );
}

function isDuplicateInviteCodeError(err: RestishError): boolean {
  const msg = (err.message ?? "").toLowerCase();
  const code = String(err.code ?? "");
  const status = err.status;
  return (
    status === 409 ||
    code === "23505" ||
    msg.includes("duplicate") ||
    msg.includes("unique") ||
    msg.includes("already exists")
  );
}

/** Maps PostgREST / DB errors to UK-English copy for invite creation. */
function mapCreateInviteError(err: RestishError): string {
  const raw = err.message ?? "";
  const blob = [raw, err.details, err.hint].filter(Boolean).join(" ").toLowerCase();
  const status = err.status;

  if (
    status === 404 ||
    /\b404\b/.test(blob) ||
    blob.includes("does not exist") ||
    blob.includes("schema cache") ||
    blob.includes("pgrst205") ||
    blob.includes("could not find the table") ||
    (blob.includes("relation") && blob.includes("carer_invites"))
  ) {
    return "Staging project is missing 'public.carer_invites' or API schema cache is stale.";
  }

  if (
    status === 401 ||
    status === 403 ||
    /\b401\b/.test(blob) ||
    /\b403\b/.test(blob) ||
    blob.includes("row-level security") ||
    blob.includes("rls") ||
    blob.includes("permission denied") ||
    blob.includes("jwt")
  ) {
    return "Invite blocked by policies; ensure patient_id matches your user and RLS policies exist.";
  }

  const ref = err.code || err.hint?.slice(0, 10) || "unknown";
  const snippet = raw.length > 100 ? `${raw.slice(0, 97)}…` : raw;
  return `We couldn't create that invite (ref: ${ref}). ${snippet || "Unknown error."}`;
}

/**
 * DEV: GET carer_invites with the current session JWT. Logs status + URL; use the returned strings for a toast.
 */
export async function probeCarerInvites(): Promise<{
  title: string;
  description: string;
  status: number;
}> {
  if (!import.meta.env.DEV) {
    return { title: "Not available", description: "Probe runs in development only.", status: 0 };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      title: "Probe skipped",
      description: "Supabase is not configured.",
      status: 0,
    };
  }

  const base = (import.meta.env.VITE_SUPABASE_URL as string)?.trim().replace(/\/$/, "");
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim();
  if (!base || !anon) {
    return {
      title: "Probe skipped",
      description: "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.",
      status: 0,
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return {
      title: "Probe skipped",
      description: "Sign in so the request can use your session token.",
      status: 0,
    };
  }

  const url = `${base}/rest/v1/carer_invites?select=code&limit=1`;
  let status = 0;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
      },
    });
    status = res.status;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info("[DEV] probe carer_invites:", status, url);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info("[DEV] probe carer_invites failed:", url, msg);
    }
    return {
      title: "Probe failed",
      description: `Network error: ${msg}`,
      status: 0,
    };
  }

  if (status === 200 || status === 206) {
    return {
      title: "carer_invites OK",
      description: `HTTP ${status} — table exists and responded.`,
      status,
    };
  }
  if (status === 404) {
    return {
      title: "carer_invites not found",
      description: "HTTP 404 — table missing from schema cache or not created.",
      status,
    };
  }
  if (status === 401 || status === 403) {
    return {
      title: "carer_invites reachable",
      description: `HTTP ${status} — policies blocked this read (often expected); server is reachable.`,
      status,
    };
  }

  return {
    title: `carer_invites HTTP ${status}`,
    description: "Unexpected status; check the console and Supabase logs.",
    status,
  };
}

export function normaliseScopes(raw: unknown): CarerScopes {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CARER_SCOPES };
  const o = raw as Record<string, unknown>;
  return {
    supplies: Boolean(o.supplies),
    appointments: Boolean(o.appointments),
    scenarios: Boolean(o.scenarios),
    hypo_alerts: Boolean(o.hypo_alerts),
    emergency_info: Boolean(o.emergency_info),
  };
}

function mapInviteRowFromDb(row: Record<string, unknown>): CarerInviteRow {
  return {
    code: String(row.code),
    patientId: String(row.patient_id),
    expiresAt: String(row.expires_at),
    usedAt: row.used_at == null ? null : String(row.used_at),
  };
}

function mapLinkRow(row: Record<string, unknown>): CarerLinkRow {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    carerId: String(row.carer_id),
    role: String(row.role ?? "viewer"),
    scopes: normaliseScopes(row.scopes),
    linkedAt: String(row.linked_at),
  };
}

async function getSessionUserId(): Promise<{ id: string } | { error: Error }> {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    return { error: error ?? new Error("Not signed in") };
  }
  return { id: data.user.id };
}

/**
 * Patient: create a new invite code, expiring in 7 days.
 * Retries if `code` collides (unlikely).
 */
export async function createInvite(): Promise<{
  data: { code: string; expiresAt: string } | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const uid = await getSessionUserId();
  if ("error" in uid) return { data: null, error: uid.error };

  const expires_at = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomInviteCode();
    const { error } = await supabase.from("carer_invites").insert({
      code,
      patient_id: uid.id,
      expires_at,
    });
    if (!error) {
      return { data: { code, expiresAt: expires_at }, error: null };
    }
    const restish = error as RestishError;
    if (isDuplicateInviteCodeError(restish)) {
      continue;
    }
    return { data: null, error: new Error(mapCreateInviteError(restish)) };
  }
  return { data: null, error: new Error("Could not generate a unique invite code") };
}

/** Patient: unused, unexpired invites for the current user. */
export async function listInvites(): Promise<{
  data: CarerInviteRow[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const uid = await getSessionUserId();
  if ("error" in uid) return { data: null, error: uid.error };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("carer_invites")
    .select("code, patient_id, expires_at, used_at")
    .eq("patient_id", uid.id)
    .is("used_at", null)
    .gt("expires_at", now)
    .order("expires_at", { ascending: true });

  if (error) return { data: null, error: new Error(error.message) };
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapInviteRowFromDb);
  return { data: rows, error: null };
}

/**
 * Patient: revoke an invite by deleting the row (code cannot be reused).
 * Documented alternative: set `used_at` to invalidate without delete — we delete for a clear audit trail in UI.
 */
export async function revokeInvite(code: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const uid = await getSessionUserId();
  if ("error" in uid) return { error: uid.error };

  const { error } = await supabase
    .from("carer_invites")
    .delete()
    .eq("code", code.trim())
    .eq("patient_id", uid.id);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Friendly message when DB is not yet migrated for idempotent redeem (duplicate carer_links row). */
function mapRedeemCarerInviteError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("carer_links_patient_id_carer_id_key") ||
    (m.includes("duplicate key") && m.includes("carer_links"))
  ) {
    return "You are already linked as a carer for this person. Open Carer View from Account or switch mode.";
  }
  return message;
}

/**
 * Carer: redeem a code. Uses RPC `redeem_carer_invite` (see docs/sql/family_carers.sql).
 */
export async function redeemInvite(code: string): Promise<{
  data: { patientId: string } | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { data: null, error: new Error("Enter an invite code") };

  const { data, error } = await supabase.rpc("redeem_carer_invite", {
    invite_code: trimmed,
  });

  if (error) {
    return { data: null, error: new Error(mapRedeemCarerInviteError(error.message)) };
  }

  const payload = data as Record<string, unknown> | null;
  const rawPid = payload?.patient_id;
  const patientId =
    typeof rawPid === "string" ? rawPid : rawPid != null ? String(rawPid) : null;
  if (!patientId) {
    return {
      data: null,
      error: new Error("Unexpected response from server. Is redeem_carer_invite deployed?"),
    };
  }
  return { data: { patientId }, error: null };
}

/** Patient: linked carers with profile display fields when join succeeds. */
export async function listCarerLinksForPatient(): Promise<{
  data: CarerLinkWithProfile[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const uid = await getSessionUserId();
  if ("error" in uid) return { data: null, error: uid.error };

  const { data: linkRows, error } = await supabase
    .from("carer_links")
    .select("id, patient_id, carer_id, role, scopes, linked_at")
    .eq("patient_id", uid.id)
    .order("linked_at", { ascending: false });

  if (error) return { data: null, error: new Error(error.message) };

  const rows = (linkRows ?? []) as Record<string, unknown>[];
  const carerIds = [...new Set(rows.map((r) => String(r.carer_id)))];

  let profileById = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  if (carerIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", carerIds);
    profileById = new Map(
      ((profs ?? []) as { id: string; full_name?: string | null; avatar_url?: string | null }[]).map((p) => [
        p.id,
        { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null },
      ]),
    );
  }

  const out: CarerLinkWithProfile[] = rows.map((row) => {
    const base = mapLinkRow(row);
    const p = profileById.get(base.carerId);
    return {
      ...base,
      carer_full_name: p?.full_name ?? null,
      carer_avatar_url: p?.avatar_url ?? null,
    };
  });
  return { data: out, error: null };
}

/** Shallow-merge scope flags onto existing JSON (patient only, via RLS). */
export async function updateScopes(
  linkId: string,
  scopesPatch: Partial<CarerScopes>,
): Promise<{ data: CarerScopes | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const uid = await getSessionUserId();
  if ("error" in uid) return { data: null, error: uid.error };

  const { data: current, error: fetchErr } = await supabase
    .from("carer_links")
    .select("scopes")
    .eq("id", linkId)
    .eq("patient_id", uid.id)
    .maybeSingle();

  if (fetchErr) return { data: null, error: new Error(fetchErr.message) };
  if (!current) return { data: null, error: new Error("Link not found") };

  const merged: CarerScopes = {
    ...normaliseScopes(current.scopes),
    ...scopesPatch,
  };

  const { data: updated, error } = await supabase
    .from("carer_links")
    .update({ scopes: merged })
    .eq("id", linkId)
    .eq("patient_id", uid.id)
    .select("scopes")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: normaliseScopes(updated?.scopes), error: null };
}

/** Patient: remove a carer link. */
export async function removeCarer(linkId: string): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const uid = await getSessionUserId();
  if ("error" in uid) return { error: uid.error };

  const { error } = await supabase
    .from("carer_links")
    .delete()
    .eq("id", linkId)
    .eq("patient_id", uid.id);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

type CarerLinkRowForCarer = {
  id: string;
  patient_id: string;
  carer_id: string;
  scopes: unknown;
};

const DEV_CARER_LINKS_SOFT_MSG =
  "Development: could not load carer link. Ensure public.carer_links exists and refresh the PostgREST schema cache if the table was added recently.";

/** Carer: first linked patient + scopes (legacy helper; prefer listLinkedPatientsForCarer). */
export async function getLinkedPatientForCarer(): Promise<{
  data: LinkedPatientInfo | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const uid = await getSessionUserId();
  if ("error" in uid) return { data: null, error: uid.error };

  const { data, error } = await supabase
    .from("carer_links")
    .select("id, patient_id, carer_id, scopes")
    .eq("carer_id", uid.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    const restish = error as RestishError;
    if (import.meta.env.DEV && isCarerLinksInfrastructureError(restish)) {
      console.warn("[DEV] getLinkedPatientForCarer: carer_links query failed (schema / 404)", error);
      return { data: null, error: new Error(DEV_CARER_LINKS_SOFT_MSG) };
    }
    return { data: null, error: new Error(error.message) };
  }
  if (!data) return { data: null, error: null };

  const row = data as CarerLinkRowForCarer;
  const mapped: LinkedPatientInfo = {
    linkId: String(row.id),
    patientId: String(row.patient_id),
    carerId: String(row.carer_id),
    scopes: normaliseScopes(row.scopes ?? {}),
  };
  return { data: mapped, error: null };
}

/** Carer: all linked patients + scopes, enriched with profile display fields. */
export async function listLinkedPatientsForCarer(): Promise<{
  data: LinkedPatientWithProfile[] | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const uid = await getSessionUserId();
  if ("error" in uid) return { data: null, error: uid.error };

  const { data, error } = await supabase
    .from("carer_links")
    .select("id, patient_id, carer_id, scopes, linked_at")
    .eq("carer_id", uid.id)
    .order("linked_at", { ascending: false });

  if (error) {
    const restish = error as RestishError;
    if (import.meta.env.DEV && isCarerLinksInfrastructureError(restish)) {
      console.warn("[DEV] listLinkedPatientsForCarer: carer_links query failed (schema / 404)", error);
      return { data: null, error: new Error(DEV_CARER_LINKS_SOFT_MSG) };
    }
    return { data: null, error: new Error(error.message) };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return { data: [], error: null };

  const patientIds = [...new Set(rows.map((r) => String(r.patient_id)))].filter(Boolean);
  const { data: profs, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", patientIds);

  if (profErr) return { data: null, error: new Error(profErr.message) };

  const profileById = new Map(
    ((profs ?? []) as { id: string; full_name?: string | null; avatar_url?: string | null }[]).map((p) => [
      p.id,
      { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null },
    ]),
  );

  const out: LinkedPatientWithProfile[] = rows.map((r) => {
    const patientId = String(r.patient_id);
    const p = profileById.get(patientId);
    return {
      linkId: String(r.id),
      patientId,
      carerId: String(r.carer_id),
      scopes: normaliseScopes(r.scopes ?? {}),
      patient_full_name: p?.full_name ?? null,
      patient_avatar_url: p?.avatar_url ?? null,
    };
  });

  return { data: out, error: null };
}

/**
 * Carer: fetch cloud supplies for the linked patient (RLS must allow SELECT).
 * Does not use the Supply Tracker cache helpers — read-only, avoids mixing carer/patient cache.
 */
export async function fetchSuppliesForLinkedPatient(
  patientId: string,
): Promise<{ data: CloudSupplyRow[] | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("supplies")
    .select("id, user_id, name, quantity, updated_at, unit, category, notes")
    .eq("user_id", patientId)
    .order("updated_at", { ascending: false });

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as CloudSupplyRow[], error: null };
}

export type CloudSupplyEventRow = {
  id: string;
  user_id: string;
  supply_id: string;
  kind: string;
  delta: number | null;
  stock_now: number | null;
  meta: Record<string, unknown>;
  created_at: string;
};

/** Carer: supply event rows for linked patient (RLS + scope via supply_events policy). */
export async function fetchSupplyEventsForLinkedPatient(
  patientId: string,
): Promise<{ data: CloudSupplyEventRow[] | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("supply_events")
    .select("id,user_id,supply_id,kind,delta,stock_now,meta,created_at")
    .eq("user_id", patientId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { data: null, error: new Error(error.message) };
  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    supply_id: String(row.supply_id),
    kind: String(row.kind),
    delta: row.delta == null ? null : Number(row.delta),
    stock_now: row.stock_now == null ? null : Number(row.stock_now),
    meta: (row.meta && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >,
    created_at: String(row.created_at),
  }));
  return { data: rows, error: null };
}

/** Carer: hypo log rows for linked patient (RLS + scope). */
export async function fetchHypoLogsForLinkedPatient(
  patientId: string,
): Promise<{ data: CloudHypoLogRow[] | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("hypo_logs")
    .select("id, user_id, blood_glucose, treatment, notes, created_at")
    .eq("user_id", patientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { data: null, error: new Error(error.message) };

  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    blood_glucose: row.blood_glucose == null ? null : Number(row.blood_glucose),
    treatment: row.treatment == null ? null : String(row.treatment),
    notes: row.notes == null ? null : String(row.notes),
    created_at: String(row.created_at),
  }));

  return { data: rows, error: null };
}

/** Carer: appointment rows for linked patient (RLS + scope). */
export async function fetchAppointmentsForLinkedPatient(
  patientId: string,
): Promise<{ data: Record<string, unknown>[] | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id,user_id,client_id,title,type,date,time,scheduled_at,location,notes,is_completed,created_at,updated_at,deleted_at",
    )
    .eq("user_id", patientId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as Record<string, unknown>[], error: null };
}

/** Carer: scenario rows for linked patient (RLS + scope). */
export async function fetchScenariosForLinkedPatient(
  patientId: string,
): Promise<{ data: Record<string, unknown>[] | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("scenarios")
    .select("*")
    .eq("user_id", patientId)
    .order("updated_at", { ascending: false });

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as Record<string, unknown>[], error: null };
}

export type PatientEmergencyProfile = {
  full_name: string | null;
  avatar_url: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_notes: string | null;
};

/** Carer: patient profile subset when RLS allows (emergency + display). */
export async function fetchPatientProfileForCarer(
  patientId: string,
): Promise<{ data: PatientEmergencyProfile | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, emergency_contact_name, emergency_contact_phone, emergency_notes",
    )
    .eq("id", patientId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };

  const row = data as Record<string, unknown>;
  return {
    data: {
      full_name: (row.full_name as string) ?? null,
      avatar_url: (row.avatar_url as string) ?? null,
      emergency_contact_name: (row.emergency_contact_name as string) ?? null,
      emergency_contact_phone: (row.emergency_contact_phone as string) ?? null,
      emergency_notes: (row.emergency_notes as string) ?? null,
    },
    error: null,
  };
}

export { useLinkedPatient } from "../hooks/use-linked-patient";
