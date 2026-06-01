/**
 * Android push delivery for Edge Functions: Firebase Cloud Messaging (FCM) HTTP v1.
 *
 * Configure (Supabase Dashboard → Edge Functions → Secrets):
 * - FCM_SERVICE_ACCOUNT_JSON — full Firebase service account JSON (single line or with \n in private_key)
 * - FCM_PROJECT_ID — optional override; defaults to project_id inside the JSON
 */
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";

export type DeliverAndroidPushResult =
  | { success: true; channel: "fcm" }
  | { success: false; channel: "fcm" | "none"; httpStatus?: number; errorBody?: string };

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function parseServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

export function fcmDirectConfigured(): boolean {
  const sa = parseServiceAccount();
  return Boolean(sa?.client_email?.trim() && sa?.private_key?.trim());
}

export function getFcmEdgeSendContext(): { projectId: string } {
  const override = Deno.env.get("FCM_PROJECT_ID")?.trim();
  const sa = parseServiceAccount();
  return { projectId: override || sa?.project_id?.trim() || "unknown" };
}

function normalizePrivateKey(raw: string): string {
  return raw.trim().replace(/\\n/g, "\n");
}

async function getFcmAccessToken(): Promise<string> {
  const sa = parseServiceAccount();
  if (!sa?.client_email || !sa?.private_key) {
    throw new Error("fcm_service_account_incomplete");
  }
  const key = await importPKCS8(normalizePrivateKey(sa.private_key), "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fcm_oauth_failed:${res.status}:${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("fcm_oauth_missing_access_token");
  return json.access_token;
}

function stringifyData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

async function sendViaFcm(
  deviceToken: string,
  opts: { title: string; body: string; data?: Record<string, unknown> },
): Promise<DeliverAndroidPushResult> {
  const projectId = getFcmEdgeSendContext().projectId;
  if (!projectId || projectId === "unknown") {
    return { success: false, channel: "none", errorBody: "fcm_project_id_missing" };
  }

  const token = deviceToken.trim();
  if (!token || token.length < 16) {
    return { success: false, channel: "fcm", httpStatus: 0, errorBody: "invalid_device_token_format" };
  }

  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken();
  } catch (e) {
    return {
      success: false,
      channel: "fcm",
      httpStatus: 0,
      errorBody: e instanceof Error ? e.message : String(e),
    };
  }

  const custom = opts.data && typeof opts.data === "object" && !Array.isArray(opts.data)
    ? stringifyData(opts.data as Record<string, unknown>)
    : {};

  const payload = {
    message: {
      token,
      notification: {
        title: opts.title,
        body: opts.body,
      },
      data: custom,
      android: {
        priority: "HIGH",
        notification: {
          channel_id: "diabeaters_push",
          sound: "default",
          notification_priority: "PRIORITY_HIGH",
        },
      },
    },
  };

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn("[fcm] send failed", res.status, body);
    return { success: false, channel: "fcm", httpStatus: res.status, errorBody: body.slice(0, 800) };
  }
  return { success: true, channel: "fcm" };
}

export async function deliverAndroidPushToDevice(
  deviceToken: string,
  title: string,
  body: string,
  data: unknown,
): Promise<DeliverAndroidPushResult> {
  if (!fcmDirectConfigured()) {
    return { success: false, channel: "none", errorBody: "fcm_not_configured" };
  }
  const custom = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;
  return await sendViaFcm(deviceToken, { title, body, data: custom });
}
