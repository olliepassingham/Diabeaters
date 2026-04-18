/**
 * iOS push delivery for Edge Functions: Apple Push Notification service (APNs) HTTP/2,
 * with optional legacy HTTP relay (PUSH_NOTIFICATION_API_URL).
 *
 * Configure APNs (Supabase Dashboard → Edge Functions → Secrets):
 * - APNS_TEAM_ID — Apple Developer Team ID (10 characters)
 * - APNS_KEY_ID — Key ID from the .p8 key (10 characters)
 * - APNS_PRIVATE_KEY — Contents of the Auth Key .p8 file; newlines may be stored as literal \n
 * - APNS_BUNDLE_ID — optional; default com.passingtime.diabeaters (must match app + signing)
 * - APNS_USE_SANDBOX — optional; set "true" for development builds from Xcode (sandbox APNs).
 *   TestFlight / App Store builds use production APNs (leave unset or "false").
 *
 * Legacy relay (optional, if you do not use direct APNs):
 * - PUSH_NOTIFICATION_API_URL — POST JSON { to, title, body, data }
 * - PUSH_NOTIFICATION_API_KEY — Bearer token for that API
 */
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";

export function apnsDirectConfigured(): boolean {
  return Boolean(
    Deno.env.get("APNS_TEAM_ID")?.trim() &&
      Deno.env.get("APNS_KEY_ID")?.trim() &&
      Deno.env.get("APNS_PRIVATE_KEY")?.trim(),
  );
}

export function pushRelayConfigured(): boolean {
  return Boolean(Deno.env.get("PUSH_NOTIFICATION_API_URL")?.trim());
}

/** True when at least one delivery path can send iOS pushes. */
export function iosPushDeliveryConfigured(): boolean {
  return apnsDirectConfigured() || pushRelayConfigured();
}

function normalizeP8(raw: string): string {
  return raw.trim().replace(/\\n/g, "\n");
}

function normalizeDeviceToken(token: string): string {
  return token.replace(/\s+/g, "").replace(/[<>]/g, "");
}

async function buildApnsJwt(): Promise<string> {
  const teamId = Deno.env.get("APNS_TEAM_ID")!.trim();
  const keyId = Deno.env.get("APNS_KEY_ID")!.trim();
  const pem = normalizeP8(Deno.env.get("APNS_PRIVATE_KEY") ?? "");
  const key = await importPKCS8(pem, "ES256");
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key);
}

async function sendViaApns(
  deviceToken: string,
  opts: { title: string; body: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID")?.trim() || "com.passingtime.diabeaters";
  const useSandbox = Deno.env.get("APNS_USE_SANDBOX") === "true";
  const host = useSandbox ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const hex = normalizeDeviceToken(deviceToken);
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 32) {
    console.warn("[apns] invalid device token format");
    return false;
  }

  const custom = opts.data && typeof opts.data === "object" && !Array.isArray(opts.data)
    ? (opts.data as Record<string, unknown>)
    : {};

  const payload: Record<string, unknown> = {
    aps: {
      alert: { title: opts.title, body: opts.body },
      sound: "default",
    },
    ...custom,
  };

  let jwt: string;
  try {
    jwt = await buildApnsJwt();
  } catch (e) {
    console.error("[apns] jwt build failed", e);
    return false;
  }

  const res = await fetch(`${host}/3/device/${hex}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn("[apns] send failed", res.status, body);
  }
  return res.ok;
}

async function sendViaRelay(
  deviceToken: string,
  title: string,
  body: string,
  data: unknown,
): Promise<boolean> {
  const pushUrl = Deno.env.get("PUSH_NOTIFICATION_API_URL")?.trim();
  if (!pushUrl) return false;
  const pushKey = Deno.env.get("PUSH_NOTIFICATION_API_KEY")?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (pushKey) headers["Authorization"] = `Bearer ${pushKey}`;
  const res = await fetch(pushUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ to: deviceToken, title, body, data }),
  });
  if (!res.ok) {
    console.warn("[push-relay] status", res.status, await res.text());
  }
  return res.ok;
}

/**
 * Sends one notification to a single device token.
 * Uses direct APNs when fully configured; otherwise the optional HTTP relay.
 */
export async function deliverIosPushToDevice(
  deviceToken: string,
  title: string,
  body: string,
  data: unknown,
): Promise<boolean> {
  const custom = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;

  if (apnsDirectConfigured()) {
    const ok = await sendViaApns(deviceToken, { title, body, data: custom });
    if (ok) return true;
  }
  if (pushRelayConfigured()) {
    return await sendViaRelay(deviceToken, title, body, data);
  }
  return false;
}
