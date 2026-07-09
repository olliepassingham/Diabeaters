import { withTimeout } from "@/lib/cgm/async-timeout";

/** Standard Dexcom Share app id for US + outside-US (EU/UK). */
export const DEXCOM_SHARE_APPLICATION_ID = "d89443d2-327c-4a6f-89e5-496bbb0317db";

/** Japan / Asia-Pacific only. */
export const DEXCOM_SHARE_APPLICATION_ID_JP = "d8665ade-9673-4e27-9ff6-92db4ce13d13";

export type DexcomShareServer = "eu" | "us" | "jp";

const DEXCOM_SHARE_TIMEOUT_MS = 12_000;
const SESSION_TTL_MS = 25 * 60_000;
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

type DexcomShareCredentials = {
  username: string;
  password: string;
  server: DexcomShareServer;
};

type DexcomRawEntry = {
  Value?: number;
  WT?: string;
  ST?: string;
  Trend?: string | number;
};

export type DexcomShareGlucoseEntry = {
  valueMgDl: number;
  recordedAt: string;
  trend: string | null;
};

type SessionCache = {
  key: string;
  sessionId: string;
  resolvedAccountId?: string;
  expiresAt: number;
};

let sessionCache: SessionCache | null = null;

function dexcomShareBaseUrl(server: DexcomShareServer): string {
  const host =
    server === "us" ? "share2.dexcom.com" : server === "jp" ? "share.dexcom.jp" : "shareous1.dexcom.com";
  return `https://${host}/ShareWebServices/Services`;
}

function dexcomApplicationId(server: DexcomShareServer): string {
  return server === "jp" ? DEXCOM_SHARE_APPLICATION_ID_JP : DEXCOM_SHARE_APPLICATION_ID;
}

function cacheKey(creds: DexcomShareCredentials): string {
  return `${creds.server}:${normalizeDexcomLoginId(creds.username).toLowerCase()}`;
}

/** Format UUID account ids from uam2.dexcom.com (with or without hyphens). */
export function normalizeDexcomAccountId(value: string): string | null {
  const trimmed = value.trim();
  const hyphenated =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
      ? trimmed.toLowerCase()
      : null;
  if (hyphenated) return hyphenated;
  const compact = trimmed.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(compact)) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
}

export function isDexcomAccountId(value: string): boolean {
  return normalizeDexcomAccountId(value) != null;
}

/** Dexcom account management portal for finding your account ID (region-specific). */
export function dexcomAccountPortalUrl(server: DexcomShareServer): string {
  if (server === "us") return "https://uam1.dexcom.com";
  if (server === "jp") return "https://uam.dexcom.jp";
  return "https://uam2.dexcom.com";
}

/** Pull a Dexcom account UUID from a pasted URL, raw UUID, or login field value. */
export function extractDexcomAccountIdFromInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = normalizeDexcomAccountId(trimmed);
  if (direct) return direct;

  const hyphenated = trimmed.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (hyphenated) return normalizeDexcomAccountId(hyphenated[1]);

  const pathSegment = trimmed.match(/\/accounts\/([0-9a-f-]+)/i);
  if (pathSegment) return normalizeDexcomAccountId(pathSegment[1]);

  return null;
}

function normalizeDexcomLoginId(value: string): string {
  return extractDexcomAccountIdFromInput(value) ?? value.trim();
}

function parseDexcomTimestamp(raw?: string): string | null {
  if (!raw) return null;
  const match = raw.match(/\d+/);
  if (!match) return null;
  const ms = Number.parseInt(match[0], 10);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

const DEXCOM_TREND_BY_NUMBER = [
  "doubleup",
  "singleup",
  "fortyfiveup",
  "flat",
  "fortyfivedown",
  "singledown",
  "doubledown",
] as const;

function normalizeDexcomTrend(raw?: string | number): string | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    const idx = raw - 1;
    return DEXCOM_TREND_BY_NUMBER[idx] ?? null;
  }
  const t = raw.trim().toLowerCase();
  return t || null;
}

function dexcomShareHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0",
    "Accept-Encoding": "application/json",
  };
}

function parseDexcomErrorBody(data: unknown): string | null {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["Message", "message", "error", "Error"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

async function dexcomSharePost<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: dexcomShareHeaders(),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown = text;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail = parseDexcomErrorBody(data);
    throw new Error(detail ? `Dexcom Share error: ${detail}` : `Dexcom Share request failed (${res.status}).`);
  }

  return data as T;
}

function assertDexcomId(value: unknown, failureMessage: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim() === ZERO_UUID) {
    throw new Error(failureMessage);
  }
  return value.trim();
}

async function loginPublisherAccountByName(creds: DexcomShareCredentials): Promise<string> {
  const base = dexcomShareBaseUrl(creds.server);
  const applicationId = dexcomApplicationId(creds.server);
  return assertDexcomId(
    await dexcomSharePost<string>(`${base}/General/LoginPublisherAccountByName`, {
      applicationId,
      accountName: normalizeDexcomLoginId(creds.username),
      password: creds.password,
    }),
    "Dexcom Share login failed — check email/password and that Share is on in the Dexcom app.",
  );
}

async function loginWithKnownAccountId(creds: DexcomShareCredentials, accountId: string): Promise<string> {
  const base = dexcomShareBaseUrl(creds.server);
  const applicationId = dexcomApplicationId(creds.server);
  return assertDexcomId(
    await dexcomSharePost<string>(`${base}/General/LoginPublisherAccountById`, {
      applicationId,
      accountId,
      password: creds.password,
    }),
    "Dexcom Share password failed for this account ID — reset your password at uam2.dexcom.com (UK/EU).",
  );
}

async function loginPublisherAccountById(creds: DexcomShareCredentials): Promise<{ sessionId: string; accountId: string }> {
  const base = dexcomShareBaseUrl(creds.server);
  const applicationId = dexcomApplicationId(creds.server);

  const accountId = assertDexcomId(
    await dexcomSharePost<string>(`${base}/General/AuthenticatePublisherAccount`, {
      applicationId,
      accountName: normalizeDexcomLoginId(creds.username),
      password: creds.password,
    }),
    "Dexcom Share login failed — check email/password.",
  );

  const sessionId = await loginWithKnownAccountId(creds, accountId);
  return { sessionId, accountId };
}

export function getResolvedDexcomAccountId(creds: DexcomShareCredentials): string | null {
  const key = cacheKey(creds);
  if (sessionCache?.key === key && sessionCache.resolvedAccountId) {
    return sessionCache.resolvedAccountId;
  }
  return extractDexcomAccountIdFromInput(creds.username);
}

async function getDexcomShareSessionId(creds: DexcomShareCredentials): Promise<string> {
  const key = cacheKey(creds);
  if (sessionCache && sessionCache.key === key && sessionCache.expiresAt > Date.now()) {
    return sessionCache.sessionId;
  }

  const accountId = extractDexcomAccountIdFromInput(creds.username);
  const attempts: Array<() => Promise<{ sessionId: string; accountId?: string }>> = [];

  if (accountId) {
    attempts.push(async () => ({ sessionId: await loginWithKnownAccountId(creds, accountId), accountId }));
  } else {
    // G7 / Clarity accounts often fail ByName; email→account-id auth is more reliable.
    attempts.push(() => loginPublisherAccountById(creds));
    attempts.push(async () => ({ sessionId: await loginPublisherAccountByName(creds) }));
  }

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const { sessionId, accountId: resolvedAccountId } = await attempt();
      sessionCache = {
        key,
        sessionId,
        resolvedAccountId: resolvedAccountId ?? accountId ?? undefined,
        expiresAt: Date.now() + SESSION_TTL_MS,
      };
      return sessionId;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Dexcom Share login failed.");
}

export function clearDexcomShareSessionCache(): void {
  sessionCache = null;
}

export function mapDexcomShareTrend(raw?: string | number | null): "rising" | "falling" | "flat" | "not_sure" | null {
  const trend = normalizeDexcomTrend(raw ?? undefined);
  if (!trend) return null;
  if (trend.includes("up")) return "rising";
  if (trend.includes("down")) return "falling";
  if (trend === "flat") return "flat";
  return "not_sure";
}

export function parseDexcomShareEntry(entry: DexcomRawEntry): DexcomShareGlucoseEntry | null {
  const valueMgDl = entry.Value;
  if (!Number.isFinite(valueMgDl) || valueMgDl! <= 0) return null;
  const recordedAt = parseDexcomTimestamp(entry.WT) ?? parseDexcomTimestamp(entry.ST);
  if (!recordedAt) return null;
  return {
    valueMgDl: valueMgDl!,
    recordedAt,
    trend: normalizeDexcomTrend(entry.Trend),
  };
}

/** Fetch the latest Dexcom Share glucose reading (publisher account, not follower). */
export async function fetchLatestDexcomShareReading(
  creds: DexcomShareCredentials,
): Promise<DexcomShareGlucoseEntry | null> {
  const rows = await fetchDexcomShareRawReadings(creds, { minutes: 1440, maxCount: 1 });
  const entry = rows[0];
  if (!entry) return null;
  return parseDexcomShareEntry(entry);
}

/** Historical Dexcom Share readings for charts (newest-first from API, returned oldest-first). */
export async function fetchDexcomShareHistory(
  creds: DexcomShareCredentials,
  options: { minutes: number; maxCount: number },
): Promise<DexcomShareGlucoseEntry[]> {
  const rows = await fetchDexcomShareRawReadings(creds, options);
  return rows
    .map((row) => parseDexcomShareEntry(row))
    .filter((entry): entry is DexcomShareGlucoseEntry => entry != null)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

async function fetchDexcomShareRawReadings(
  creds: DexcomShareCredentials,
  options: { minutes: number; maxCount: number },
): Promise<DexcomRawEntry[]> {
  const sessionId = await getDexcomShareSessionId(creds);
  const base = dexcomShareBaseUrl(creds.server);
  const rows = await dexcomSharePost<DexcomRawEntry[]>(`${base}/Publisher/ReadPublisherLatestGlucoseValues`, {
    sessionId,
    minutes: options.minutes,
    maxCount: options.maxCount,
  });
  return Array.isArray(rows) ? rows : [];
}

export async function testDexcomShareConnection(
  creds: DexcomShareCredentials,
): Promise<
  | { ok: true; reading: DexcomShareGlucoseEntry; resolvedAccountId: string }
  | { ok: false; error: string }
> {
  clearDexcomShareSessionCache();
  const normalizedCreds = {
    ...creds,
    username: extractDexcomAccountIdFromInput(creds.username) ?? creds.username.trim(),
  };
  try {
    const reading = await withTimeout(
      fetchLatestDexcomShareReading(normalizedCreds),
      DEXCOM_SHARE_TIMEOUT_MS,
      "Dexcom Share took too long to respond.",
    );
    if (!reading) {
      return {
        ok: false,
        error: "Connected but no recent glucose found. Check your sensor is active and Share is on in the Dexcom app.",
      };
    }
    const resolvedAccountId =
      getResolvedDexcomAccountId(normalizedCreds) ?? normalizedCreds.username.trim();
    return { ok: true, reading, resolvedAccountId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Dexcom Share connection failed.";
    if (/Publisher account password failed|AccountPasswordInvalid|password failed/i.test(message)) {
      return {
        ok: false,
        error:
          "Dexcom rejected the password for Share. Enable Share in the Dexcom G7 app (add at least one follower). Then try your email and password here — or use “Find account ID” below and paste the ID from the Dexcom account portal.",
      };
    }
    if (/500/.test(message)) {
      return {
        ok: false,
        error:
          `${message} If your password is correct, confirm Share is enabled in the Dexcom app and try region Europe/UK. Wrong region can also cause server errors.`,
      };
    }
    return { ok: false, error: message };
  }
}
