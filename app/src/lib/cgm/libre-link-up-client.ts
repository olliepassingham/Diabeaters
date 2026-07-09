import { withTimeout } from "@/lib/cgm/async-timeout";

/** LibreLink Up regional API hosts (unofficial). */
export type LibreLinkUpRegion = "eu" | "us" | "global" | "de" | "ap" | "au";

const LIBRE_CLIENT_VERSION = "4.16.0";
const LIBRE_TIMEOUT_MS = 14_000;
const SESSION_TTL_MS = 25 * 60_000;

export type LibreLinkUpCredentials = {
  email: string;
  password: string;
  region: LibreLinkUpRegion;
};

export type LibreLinkUpGlucoseEntry = {
  valueMgDl: number;
  recordedAt: string;
  trend: string | null;
};

type SessionState = {
  key: string;
  baseUrl: string;
  token: string;
  accountId: string;
  connectionId: string | null;
  expiresAt: number;
};

let sessionCache: SessionState | null = null;

type LibreGlucoseItem = {
  FactoryTimestamp?: string;
  Timestamp?: string;
  ValueInMgPerDl?: number;
  Value?: number;
  TrendArrow?: number;
};

function libreBaseUrl(region: LibreLinkUpRegion): string {
  switch (region) {
    case "us":
      return "https://api-us.libreview.io";
    case "de":
      return "https://api-de.libreview.io";
    case "ap":
      return "https://api-ap.libreview.io";
    case "au":
      return "https://api-au.libreview.io";
    case "global":
      return "https://api.libreview.io";
    case "eu":
    default:
      return "https://api-eu.libreview.io";
  }
}

function cacheKey(creds: LibreLinkUpCredentials): string {
  return `${creds.region}:${creds.email.trim().toLowerCase()}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function libreHeaders(accountId?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    product: "llu.android",
    version: LIBRE_CLIENT_VERSION,
    "cache-control": "no-cache",
    pragma: "no-cache",
  };
  if (accountId) {
    headers["account-id"] = accountId;
  }
  return headers;
}

function parseLibreTimestamp(raw?: string): string | null {
  if (!raw) return null;
  const normalized = raw.includes("UTC") ? raw : `${raw} UTC`;
  const ms = new Date(normalized).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

const TREND_BY_ARROW = [
  null,
  "singledown",
  "fortyfivedown",
  "flat",
  "fortyfiveup",
  "singleup",
  null,
] as const;

export function mapLibreLinkUpTrend(trendArrow?: number): string | null {
  if (trendArrow == null || !Number.isFinite(trendArrow)) return null;
  const idx = Math.round(trendArrow);
  return TREND_BY_ARROW[idx] ?? null;
}

function glucoseItemToEntry(item: LibreGlucoseItem): LibreLinkUpGlucoseEntry | null {
  const valueMgDl = item.ValueInMgPerDl ?? item.Value;
  if (valueMgDl == null || !Number.isFinite(valueMgDl) || valueMgDl <= 0) return null;
  const recordedAt = parseLibreTimestamp(item.FactoryTimestamp ?? item.Timestamp);
  if (!recordedAt) return null;
  return {
    valueMgDl,
    recordedAt,
    trend: mapLibreLinkUpTrend(item.TrendArrow),
  };
}

async function libreFetch(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string; accountId?: string },
): Promise<unknown> {
  const headers = new Headers(libreHeaders());
  const bodyHeaders = init.headers ? new Headers(init.headers) : new Headers();
  for (const [k, v] of Object.entries(libreHeaders())) {
    if (!bodyHeaders.has(k)) bodyHeaders.set(k, v);
  }
  if (init.token) bodyHeaders.set("authorization", `Bearer ${init.token}`);
  if (init.accountId) bodyHeaders.set("account-id", await sha256Hex(init.accountId));

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: bodyHeaders,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data && typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `LibreLink Up request failed (${res.status}).`;
    throw new Error(message);
  }
  return data;
}

async function loginLibre(
  creds: LibreLinkUpCredentials,
  baseUrl: string,
): Promise<{ baseUrl: string; token: string; accountId: string }> {
  const payload = await libreFetch(baseUrl, "/llu/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: creds.email.trim(), password: creds.password }),
  });

  const body = payload as {
    status?: number;
    data?: {
      redirect?: boolean;
      region?: string;
      authTicket?: { token?: string };
      user?: { id?: string };
      step?: { componentName?: string };
    };
  };

  if (body.status === 2) {
    throw new Error(
      "LibreLink Up login failed — use your LibreLink Up email and password (not your LibreLink patient app login unless linked).",
    );
  }
  if (body.status === 4 || body.data?.step) {
    throw new Error("LibreLink Up needs an extra step in the LibreLink Up app before Diabeaters can connect.");
  }

  if (body.data?.redirect && body.data.region) {
    const countries = (await libreFetch(baseUrl, "/llu/config/country?country=GB", {
      method: "GET",
    })) as {
      data?: { regionalMap?: Record<string, { lslApi?: string }> };
    };
    const nextBase = countries.data?.regionalMap?.[body.data.region]?.lslApi;
    if (!nextBase) {
      throw new Error(`LibreLink Up could not resolve region "${body.data.region}".`);
    }
    return loginLibre(creds, nextBase);
  }

  const token = body.data?.authTicket?.token;
  const accountId = body.data?.user?.id;
  if (!token || !accountId) {
    throw new Error("LibreLink Up login did not return a session.");
  }
  return { baseUrl, token, accountId };
}

async function ensureLibreSession(creds: LibreLinkUpCredentials): Promise<SessionState> {
  const key = cacheKey(creds);
  if (sessionCache && sessionCache.key === key && sessionCache.expiresAt > Date.now()) {
    return sessionCache;
  }

  const login = await loginLibre(creds, libreBaseUrl(creds.region));
  sessionCache = {
    key,
    baseUrl: login.baseUrl,
    token: login.token,
    accountId: login.accountId,
    connectionId: null,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  return sessionCache;
}

async function resolveConnectionId(session: SessionState): Promise<string> {
  if (session.connectionId) return session.connectionId;

  const connections = (await libreFetch(session.baseUrl, "/llu/connections", {
    method: "GET",
    token: session.token,
    accountId: session.accountId,
  })) as { data?: Array<{ patientId?: string }> };

  const first = connections.data?.[0]?.patientId;
  if (!first) {
    throw new Error(
      "No Libre connections found. In LibreLink Up, follow the person you support (or ask them to invite you), then try again.",
    );
  }
  session.connectionId = first;
  return first;
}

async function fetchGraphPayload(creds: LibreLinkUpCredentials): Promise<{
  connection: { glucoseMeasurement?: LibreGlucoseItem };
  graphData: LibreGlucoseItem[];
}> {
  const session = await ensureLibreSession(creds);
  const connectionId = await resolveConnectionId(session);
  const graph = (await libreFetch(session.baseUrl, `/llu/connections/${connectionId}/graph`, {
    method: "GET",
    token: session.token,
    accountId: session.accountId,
  })) as {
    data?: {
      connection?: { glucoseMeasurement?: LibreGlucoseItem };
      graphData?: LibreGlucoseItem[];
    };
  };

  return {
    connection: graph.data?.connection ?? {},
    graphData: graph.data?.graphData ?? [],
  };
}

export function clearLibreLinkUpSessionCache(): void {
  sessionCache = null;
}

export async function testLibreLinkUpConnection(
  creds: LibreLinkUpCredentials,
): Promise<{ ok: true; reading: LibreLinkUpGlucoseEntry } | { ok: false; error: string }> {
  try {
    clearLibreLinkUpSessionCache();
    const reading = await withTimeout(
      fetchLatestLibreLinkUpReading(creds),
      LIBRE_TIMEOUT_MS,
      "LibreLink Up took too long to respond.",
    );
    if (!reading) {
      return { ok: false, error: "LibreLink Up connected but returned no recent glucose." };
    }
    return { ok: true, reading };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "LibreLink Up connection failed." };
  }
}

export async function fetchLatestLibreLinkUpReading(
  creds: LibreLinkUpCredentials,
): Promise<LibreLinkUpGlucoseEntry | null> {
  const graph = await fetchGraphPayload(creds);
  const current = glucoseItemToEntry(graph.connection.glucoseMeasurement ?? {});
  if (current) return current;

  const sorted = [...graph.graphData]
    .map((item) => glucoseItemToEntry(item))
    .filter((e): e is LibreLinkUpGlucoseEntry => e != null)
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  return sorted[0] ?? null;
}

/** Historical readings for charts (oldest first). */
export async function fetchLibreLinkUpHistory(
  creds: LibreLinkUpCredentials,
  options: { minutes: number; maxCount: number },
): Promise<LibreLinkUpGlucoseEntry[]> {
  const graph = await fetchGraphPayload(creds);
  const cutoff = Date.now() - options.minutes * 60_000;
  const items = [...graph.graphData];
  const current = graph.connection.glucoseMeasurement;
  if (current) items.push(current);

  const entries = items
    .map((item) => glucoseItemToEntry(item))
    .filter((e): e is LibreLinkUpGlucoseEntry => e != null)
    .filter((e) => new Date(e.recordedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (entries.length <= options.maxCount) return entries;
  return entries.slice(entries.length - options.maxCount);
}

/** Map Libre trend tokens to exercise/CGM trend union. */
export function libreTrendToExerciseTrend(trend: string | null): "rising" | "falling" | "flat" | null {
  if (!trend) return null;
  const t = trend.toLowerCase();
  if (t.includes("up")) return "rising";
  if (t.includes("down")) return "falling";
  if (t === "flat") return "flat";
  return null;
}
