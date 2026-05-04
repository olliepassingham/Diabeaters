/**
 * Family & Carers — Supabase helpers (patient invites/links, carer redeem, scoped reads).
 * Requires tables/RPC from docs/sql/family_carers.sql (not executed from the app).
 */
import { devWarn } from "./dev-log";
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
    clinical_settings: Boolean(o.clinical_settings),
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
    return "You're already linked to this person. Open Supporter Mode from Account, or tap Change mode on Account to switch.";
  }
  if (m.includes("already used") || (m.includes("used") && m.includes("invite"))) {
    return "This invite code has already been used. If you already linked successfully, open Supporter Mode from Account (or try again after a few seconds).";
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

  // Do not fail the whole supporter link load if profile names are blocked by RLS;
  // CarerView can still load patient data using patient_id + scopes.
  if (profErr) {
    devWarn("[listLinkedPatientsForCarer] profiles join failed; continuing without names", profErr.message);
  }

  const profRows = ((profErr ? [] : profs) ?? []) as {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
  }[];
  const profileById = new Map(
    profRows.map((p) => [
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

function readScenarioStateField(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function isoTimeMs(v: unknown): number {
  if (typeof v !== "string") return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export type CarerSickDayTempEntry = {
  id: string;
  value: number;
  unit: "c" | "f";
  at: string;
  logged_by: "carer";
};

export type CarerSickDayMedNote = {
  id: string;
  at: string;
  text: string;
  medication_name?: string | null;
  logged_by: "carer";
};

export type CarerSickDayMedReminder = {
  id: string;
  name: string;
  due_at: string;
  repeat_mins: number;
  dose_label?: string | null;
  updated_by: "carer";
  updated_at: string;
};

function parseRepeatMinutes(repeatMins: unknown): number | null {
  const n = typeof repeatMins === "number" ? repeatMins : Number(repeatMins);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(7 * 24 * 60, Math.max(5, Math.round(n)));
}

function normaliseIso(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : s;
}

function computeMedsNextDue(medsActive: CarerSickDayMedReminder[]): Record<string, unknown> | null {
  if (medsActive.length === 0) return null;
  const sorted = [...medsActive].sort((a, b) => isoTimeMs(a.due_at) - isoTimeMs(b.due_at));
  const m = sorted[0]!;
  return {
    name: m.name,
    due_at: m.due_at,
    repeat_mins: m.repeat_mins,
    dose_label: m.dose_label ?? null,
  };
}

async function fetchSickDayScenarioStateForCarer(
  patientId: string,
): Promise<{ prev: Record<string, unknown> | null; error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { prev: null, error: NOT_CONFIGURED };

  const { data: row, error: fe } = await supabase
    .from("scenarios")
    .select("state")
    .eq("user_id", patientId)
    .eq("scenario_key", "sick_day")
    .maybeSingle();

  if (fe) return { prev: null, error: new Error(fe.message) };
  if (!row) {
    return {
      prev: null,
      error: new Error(
        "No sick day record yet — ask them to open Sick day once while signed in so data can sync.",
      ),
    };
  }

  return { prev: readScenarioStateField((row as Record<string, unknown>).state), error: null };
}

async function updateSickDayScenarioStateForCarer(
  patientId: string,
  nextState: Record<string, unknown>,
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { error: ue } = await supabase
    .from("scenarios")
    .update({ state: nextState, updated_at: new Date().toISOString() })
    .eq("user_id", patientId)
    .eq("scenario_key", "sick_day");

  return { error: ue ? new Error(ue.message) : null };
}

/** Carer: append a temperature reading to the patient sick_day scenario (RLS: scenarios_linked_carer_update). */
export async function carerAppendSickDayTemperature(
  patientId: string,
  params: { value: number; unit: "c" | "f" },
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { data: row, error: fe } = await supabase
    .from("scenarios")
    .select("state")
    .eq("user_id", patientId)
    .eq("scenario_key", "sick_day")
    .maybeSingle();

  if (fe) return { error: new Error(fe.message) };
  if (!row) {
    return {
      error: new Error(
        "No sick day record yet — ask them to open Sick day once while signed in so data can sync.",
      ),
    };
  }

  const prev = readScenarioStateField((row as Record<string, unknown>).state);
  const entry: CarerSickDayTempEntry = {
    id: crypto.randomUUID(),
    value: params.value,
    unit: params.unit,
    at: new Date().toISOString(),
    logged_by: "carer",
  };
  const prevCarer = Array.isArray(prev.carer_temp_recent) ? (prev.carer_temp_recent as unknown[]) : [];
  const carer_temp_recent = [entry, ...prevCarer].slice(0, 15);

  const tNew = isoTimeMs(entry.at);
  const tOldLatest = isoTimeMs((prev.temp_latest as Record<string, unknown> | undefined)?.at);
  const temp_latest =
    tNew >= tOldLatest ? { value: entry.value, unit: entry.unit, at: entry.at } : prev.temp_latest;

  const nextState = { ...prev, carer_temp_recent, temp_latest };
  const { error: ue } = await supabase
    .from("scenarios")
    .update({ state: nextState, updated_at: new Date().toISOString() })
    .eq("user_id", patientId)
    .eq("scenario_key", "sick_day");

  return { error: ue ? new Error(ue.message) : null };
}

/** Carer: append a medication / care note to sick_day scenario state. */
export async function carerAppendSickDayMedNote(
  patientId: string,
  params: { text: string; medicationName?: string },
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const text = params.text.trim();
  if (!text) return { error: new Error("Please enter a note.") };

  const { data: row, error: fe } = await supabase
    .from("scenarios")
    .select("state")
    .eq("user_id", patientId)
    .eq("scenario_key", "sick_day")
    .maybeSingle();

  if (fe) return { error: new Error(fe.message) };
  if (!row) {
    return {
      error: new Error(
        "No sick day record yet — ask them to open Sick day once while signed in so data can sync.",
      ),
    };
  }

  const prev = readScenarioStateField((row as Record<string, unknown>).state);
  const entry: CarerSickDayMedNote = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    text,
    medication_name: params.medicationName?.trim() || null,
    logged_by: "carer",
  };
  const prevNotes = Array.isArray(prev.carer_med_notes) ? (prev.carer_med_notes as unknown[]) : [];
  const carer_med_notes = [entry, ...prevNotes].slice(0, 25);

  const nextState = { ...prev, carer_med_notes };
  const { error: ue } = await supabase
    .from("scenarios")
    .update({ state: nextState, updated_at: new Date().toISOString() })
    .eq("user_id", patientId)
    .eq("scenario_key", "sick_day");

  return { error: ue ? new Error(ue.message) : null };
}

/** Carer: add or edit a medication reminder in sick_day scenario state. */
export async function carerUpsertSickDayMedicationReminder(
  patientId: string,
  params: {
    id?: string;
    name: string;
    repeatEveryMinutes: number;
    doseLabel?: string | null;
    /** If provided, set next due relative to now; otherwise keep existing due when editing. */
    resetDueFromNow?: boolean;
  },
): Promise<{ error: Error | null }> {
  const name = params.name.trim();
  if (!name) return { error: new Error("Enter a medication name.") };
  const repeatMins = parseRepeatMinutes(params.repeatEveryMinutes);
  if (!repeatMins) return { error: new Error("Choose a valid repeat interval.") };

  const { prev, error } = await fetchSickDayScenarioStateForCarer(patientId);
  if (error || !prev) return { error: error ?? new Error("Could not load sick day state.") };

  const nowIso = new Date().toISOString();
  const id = params.id?.trim() || crypto.randomUUID();
  const prevActive = Array.isArray(prev.meds_active) ? (prev.meds_active as unknown[]) : [];
  const mapped: CarerSickDayMedReminder[] = prevActive
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((r) => {
      const rid = typeof r!.id === "string" ? r!.id : crypto.randomUUID();
      const rname = typeof r!.name === "string" ? r!.name : "Medication";
      const due = normaliseIso(r!.due_at) ?? nowIso;
      const rm = parseRepeatMinutes(r!.repeat_mins) ?? 240;
      const dose = typeof r!.dose_label === "string" ? (r!.dose_label as string) : null;
      return { id: rid, name: rname, due_at: due, repeat_mins: rm, dose_label: dose, updated_by: "carer", updated_at: nowIso };
    });

  const existing = mapped.find((m) => m.id === id) ?? null;
  const due_at =
    params.resetDueFromNow === true
      ? new Date(Date.now() + repeatMins * 60_000).toISOString()
      : existing?.due_at ?? new Date(Date.now() + repeatMins * 60_000).toISOString();

  const next: CarerSickDayMedReminder = {
    id,
    name,
    due_at,
    repeat_mins: repeatMins,
    dose_label: params.doseLabel?.trim() ? params.doseLabel.trim() : null,
    updated_by: "carer",
    updated_at: nowIso,
  };

  const nextActive = [...mapped.filter((m) => m.id !== id), next].sort((a, b) => isoTimeMs(a.due_at) - isoTimeMs(b.due_at));
  const meds_next_due = computeMedsNextDue(nextActive);
  const nextState = { ...prev, meds_active: nextActive, meds_next_due };
  return await updateSickDayScenarioStateForCarer(patientId, nextState);
}

/** Carer: snooze a reminder by minutes. */
export async function carerSnoozeSickDayMedicationReminder(
  patientId: string,
  params: { id: string; minutes: number },
): Promise<{ error: Error | null }> {
  const id = params.id.trim();
  if (!id) return { error: new Error("Invalid reminder.") };
  const minutes = Math.min(24 * 60, Math.max(5, Math.round(params.minutes)));

  const { prev, error } = await fetchSickDayScenarioStateForCarer(patientId);
  if (error || !prev) return { error: error ?? new Error("Could not load sick day state.") };

  const nowIso = new Date().toISOString();
  const prevActive = Array.isArray(prev.meds_active) ? (prev.meds_active as unknown[]) : [];
  const mapped: CarerSickDayMedReminder[] = prevActive
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((r) => {
      const rid = typeof r!.id === "string" ? r!.id : crypto.randomUUID();
      const rname = typeof r!.name === "string" ? r!.name : "Medication";
      const due = normaliseIso(r!.due_at) ?? nowIso;
      const rm = parseRepeatMinutes(r!.repeat_mins) ?? 240;
      const dose = typeof r!.dose_label === "string" ? (r!.dose_label as string) : null;
      return { id: rid, name: rname, due_at: due, repeat_mins: rm, dose_label: dose, updated_by: "carer", updated_at: nowIso };
    });

  const idx = mapped.findIndex((m) => m.id === id);
  if (idx < 0) return { error: new Error("Reminder not found.") };
  mapped[idx] = {
    ...mapped[idx]!,
    due_at: new Date(Date.now() + minutes * 60_000).toISOString(),
    updated_by: "carer",
    updated_at: nowIso,
  };

  const nextActive = mapped.sort((a, b) => isoTimeMs(a.due_at) - isoTimeMs(b.due_at));
  const meds_next_due = computeMedsNextDue(nextActive);
  const nextState = { ...prev, meds_active: nextActive, meds_next_due };
  return await updateSickDayScenarioStateForCarer(patientId, nextState);
}

/** Carer: stop (remove) a reminder. */
export async function carerStopSickDayMedicationReminder(
  patientId: string,
  params: { id: string },
): Promise<{ error: Error | null }> {
  const id = params.id.trim();
  if (!id) return { error: new Error("Invalid reminder.") };

  const { prev, error } = await fetchSickDayScenarioStateForCarer(patientId);
  if (error || !prev) return { error: error ?? new Error("Could not load sick day state.") };

  const prevActive = Array.isArray(prev.meds_active) ? (prev.meds_active as unknown[]) : [];
  const nextActive = prevActive
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .filter(Boolean)
    .filter((r) => (typeof r!.id === "string" ? r!.id : "") !== id);

  const typedActive: CarerSickDayMedReminder[] = nextActive.map((x) => {
    const r = x as Record<string, unknown>;
    const nowIso = new Date().toISOString();
    return {
      id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
      name: typeof r.name === "string" ? r.name : "Medication",
      due_at: normaliseIso(r.due_at) ?? nowIso,
      repeat_mins: parseRepeatMinutes(r.repeat_mins) ?? 240,
      dose_label: typeof r.dose_label === "string" ? (r.dose_label as string) : null,
      updated_by: "carer",
      updated_at: nowIso,
    };
  });

  const meds_next_due = computeMedsNextDue(typedActive);
  const nextState = { ...prev, meds_active: typedActive, meds_next_due };
  return await updateSickDayScenarioStateForCarer(patientId, nextState);
}

/**
 * Carer: log that a dose was taken at a specific time, and advance the shared next due from that time + repeat interval.
 */
export async function carerLogSickDayMedicationTaken(
  patientId: string,
  params: { reminderId: string; takenAtIso: string; name: string; doseLabel?: string | null },
): Promise<{ error: Error | null }> {
  const reminderId = params.reminderId.trim();
  if (!reminderId) return { error: new Error("Invalid reminder.") };
  const name = params.name.trim();
  if (!name) return { error: new Error("Invalid medication name.") };

  const takenAt = normaliseIso(params.takenAtIso);
  if (!takenAt) return { error: new Error("Choose a valid time.") };
  if (new Date(takenAt).getTime() > Date.now() + 60_000) {
    return { error: new Error("Time cannot be in the future.") };
  }

  const { prev, error } = await fetchSickDayScenarioStateForCarer(patientId);
  if (error || !prev) return { error: error ?? new Error("Could not load sick day state.") };

  const prevDoses = Array.isArray(prev.medication_dose_log) ? (prev.medication_dose_log as unknown[]) : [];
  const entry = {
    id: crypto.randomUUID(),
    reminder_id: reminderId,
    name,
    dose_label: params.doseLabel?.trim() ? params.doseLabel.trim() : null,
    taken_at: takenAt,
    source: "carer" as const,
    notes: null as string | null,
  };
  const medication_dose_log = [entry, ...prevDoses].slice(0, 100);

  const nowIso = new Date().toISOString();
  const prevActive = Array.isArray(prev.meds_active) ? (prev.meds_active as unknown[]) : [];
  const mapped: CarerSickDayMedReminder[] = prevActive
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((r) => {
      const rid = typeof r!.id === "string" ? r!.id : crypto.randomUUID();
      const rname = typeof r!.name === "string" ? r!.name : "Medication";
      const due = normaliseIso(r!.due_at) ?? nowIso;
      const rm = parseRepeatMinutes(r!.repeat_mins) ?? 240;
      const dose = typeof r!.dose_label === "string" ? (r!.dose_label as string) : null;
      return { id: rid, name: rname, due_at: due, repeat_mins: rm, dose_label: dose, updated_by: "carer", updated_at: nowIso };
    });

  const idx = mapped.findIndex((m) => m.id === reminderId);
  if (idx >= 0) {
    const repeat = mapped[idx]!.repeat_mins;
    const stepMs = repeat * 60_000;
    const takenMs = new Date(takenAt).getTime();
    let nextMs = takenMs + stepMs;
    while (nextMs <= Date.now()) {
      nextMs += stepMs;
    }
    const nextDue = new Date(nextMs).toISOString();
    mapped[idx] = {
      ...mapped[idx]!,
      due_at: nextDue,
      updated_by: "carer",
      updated_at: nowIso,
    };
  }

  const nextActive = mapped.sort((a, b) => isoTimeMs(a.due_at) - isoTimeMs(b.due_at));
  const meds_next_due = computeMedsNextDue(nextActive);
  const nextState = { ...prev, medication_dose_log, meds_active: nextActive, meds_next_due };
  return await updateSickDayScenarioStateForCarer(patientId, nextState);
}

/**
 * Supporter: mark the linked person's sick day scenario inactive in Supabase (same shape as patient "end sick day").
 * Use when the cloud row is still "active" but they have already recovered — e.g. their app did not sync the end.
 */
export async function carerDeactivateSickDayScenarioForPatient(patientId: string): Promise<{ error: Error | null }> {
  const { prev, error } = await fetchSickDayScenarioStateForCarer(patientId);
  if (error) return { error };

  const base = prev && typeof prev === "object" ? prev : {};
  const preservedCarerTemps = Array.isArray(base.carer_temp_recent) ? base.carer_temp_recent : [];
  const preservedCarerNotes = Array.isArray(base.carer_med_notes) ? base.carer_med_notes : [];
  const endedAt = new Date().toISOString();
  const startedAt =
    (typeof base.started_at === "string" ? base.started_at : null) ??
    (typeof base.activated_at === "string" ? base.activated_at : null) ??
    null;
  const lastCheckAt = typeof base.last_check_at === "string" ? base.last_check_at : null;

  const nextState: Record<string, unknown> = {
    sick_day_active: false,
    sickDayActive: false,
    started_at: startedAt,
    ended_at: endedAt,
    inputs_summary: null,
    meds_next_due: null,
    meds_active: [],
    temp_recent: [],
    temp_latest: null,
    medication_dose_log: [],
    last_check_at: lastCheckAt,
    carer_temp_recent: preservedCarerTemps,
    carer_med_notes: preservedCarerNotes,
  };

  return updateSickDayScenarioStateForCarer(patientId, nextState);
}

/** @deprecated Use {@link carerLogSickDayMedicationTaken} — kept for any external callers; only appends a dose log row. */
export async function carerMarkSickDayMedicationTakenNow(
  patientId: string,
  params: { id: string },
): Promise<{ error: Error | null }> {
  const { prev, error } = await fetchSickDayScenarioStateForCarer(patientId);
  if (error || !prev) return { error: error ?? new Error("Could not load sick day state.") };
  const id = params.id.trim();
  const prevActive = Array.isArray(prev.meds_active) ? (prev.meds_active as unknown[]) : [];
  const row = prevActive
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .find((r) => (typeof r?.id === "string" ? r.id : "") === id);
  const name = row && typeof row.name === "string" ? row.name : "Medication";
  const dose = row && typeof row.dose_label === "string" ? row.dose_label : null;
  return carerLogSickDayMedicationTaken(patientId, {
    reminderId: id,
    takenAtIso: new Date().toISOString(),
    name,
    doseLabel: dose,
  });
}

/** Cloud profile fields a carer may read/update when `clinical_settings` scope is true. */
export type PatientClinicalPrefsForCarer = {
  date_of_birth: string | null;
  insulin_delivery_method: string | null;
  tdd: number | null;
};

function parsePatientClinicalPrefsRpc(raw: unknown): PatientClinicalPrefsForCarer | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const dob = o.date_of_birth;
  const date_of_birth =
    dob === null || dob === undefined ? null : typeof dob === "string" ? dob.trim() || null : null;
  const idm = o.insulin_delivery_method;
  let insulin_delivery_method: string | null = null;
  if (idm === "pen" || idm === "pump") insulin_delivery_method = idm;
  else if (idm === null || idm === undefined || idm === "") insulin_delivery_method = null;
  const tddRaw = o.tdd;
  let tdd: number | null = null;
  if (typeof tddRaw === "number" && Number.isFinite(tddRaw) && tddRaw > 0) tdd = tddRaw;
  else if (typeof tddRaw === "string" && tddRaw.trim()) {
    const n = parseFloat(tddRaw);
    if (Number.isFinite(n) && n > 0) tdd = n;
  }
  return { date_of_birth, insulin_delivery_method, tdd };
}

/** Carer: load patient's clinical prefs when `clinical_settings` scope is granted (RPC). */
export async function getPatientClinicalPrefsForCarer(patientId: string): Promise<{
  data: PatientClinicalPrefsForCarer | null;
  error: Error | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase.rpc("get_patient_clinical_prefs_for_carer", {
    p_patient_id: patientId,
  });
  if (error) return { data: null, error: new Error(error.message) };
  if (data == null) return { data: null, error: null };
  return { data: parsePatientClinicalPrefsRpc(data), error: null };
}

/** Carer: patch patient's cloud clinical prefs (delivery, TDD, DOB). Requires `clinical_settings` scope. */
export async function updatePatientClinicalPrefsForCarer(
  patientId: string,
  fields: Partial<{
    date_of_birth: string | null;
    insulin_delivery_method: "pen" | "pump" | null;
    tdd: number | null;
  }>,
): Promise<{ error: Error | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const p_fields: Record<string, unknown> = {};
  if ("date_of_birth" in fields) p_fields.date_of_birth = fields.date_of_birth ?? "";
  if ("insulin_delivery_method" in fields) {
    p_fields.insulin_delivery_method = fields.insulin_delivery_method ?? "";
  }
  if ("tdd" in fields) {
    p_fields.tdd = fields.tdd == null ? null : fields.tdd;
  }
  if (Object.keys(p_fields).length === 0) return { error: null };

  const { error } = await supabase.rpc("update_patient_clinical_prefs_for_carer", {
    p_patient_id: patientId,
    p_fields,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export { useLinkedPatient } from "../hooks/use-linked-patient";
