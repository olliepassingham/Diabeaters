/**
 * Unified mobile push delivery (iOS APNs + Android FCM).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  deliverAndroidPushToDevice,
  fcmDirectConfigured,
  getFcmEdgeSendContext,
  type DeliverAndroidPushResult,
} from "./deliver-android-push.ts";
import {
  apnsDirectConfigured,
  deliverIosPushToDevice,
  getApnsEdgeSendContext,
  iosPushDeliveryConfigured,
  pushRelayConfigured,
  type DeliverIosPushResult,
} from "./deliver-ios-push.ts";
import { fetchNativeAppBadgeCountForUser } from "./native-app-badge-count.ts";

type SupabaseAdmin = ReturnType<typeof createClient>;

export type PushPlatform = "ios" | "android";

export type DeliverPushResult =
  | { success: true; channel: "apns" | "fcm" | "relay"; platform: PushPlatform }
  | { success: false; channel: "apns" | "fcm" | "relay" | "none"; platform: PushPlatform; httpStatus?: number; errorBody?: string };

export type DeliverPushOptions = {
  recipientUserId?: string;
  admin?: SupabaseAdmin;
  /** When set, skips DB badge lookup (caller already computed unread total). */
  badgeCount?: number;
};

export function mobilePushDeliveryConfigured(): boolean {
  return iosPushDeliveryConfigured() || fcmDirectConfigured();
}

export function getMobilePushEdgeContext(): {
  apns: ReturnType<typeof getApnsEdgeSendContext>;
  fcm: ReturnType<typeof getFcmEdgeSendContext>;
  apnsConfigured: boolean;
  fcmConfigured: boolean;
  relayConfigured: boolean;
} {
  return {
    apns: getApnsEdgeSendContext(),
    fcm: getFcmEdgeSendContext(),
    apnsConfigured: apnsDirectConfigured(),
    fcmConfigured: fcmDirectConfigured(),
    relayConfigured: pushRelayConfigured(),
  };
}

async function resolveBadgeCount(options?: DeliverPushOptions): Promise<number> {
  if (options?.badgeCount !== undefined) {
    return Math.max(0, Math.floor(options.badgeCount));
  }
  const userId = options?.recipientUserId?.trim();
  const admin = options?.admin;
  if (!userId || !admin) return 0;

  const res = await fetchNativeAppBadgeCountForUser(admin, userId);
  if (res.error) {
    console.warn("[deliver-push] badge count failed:", res.error);
    return 0;
  }
  return res.count;
}

export async function deliverPushToDevice(
  platform: PushPlatform,
  deviceToken: string,
  title: string,
  body: string,
  data: unknown,
  badgeCount?: number,
): Promise<DeliverPushResult> {
  if (platform === "android") {
    const r = await deliverAndroidPushToDevice(deviceToken, title, body, data);
    if (r.success) return { ...r, platform: "android" };
    return { ...r, platform: "android" };
  }
  const r: DeliverIosPushResult = await deliverIosPushToDevice(deviceToken, title, body, data, badgeCount);
  if (r.success) return { ...r, platform: "ios" };
  return { ...r, platform: "ios" };
}

export type PushTokenRow = { platform: string; token: string };

export async function deliverPushToTokenRows(
  rows: PushTokenRow[],
  title: string,
  body: string,
  data: unknown,
  options?: DeliverPushOptions,
): Promise<{ delivered: number; attempts: number }> {
  const badgeCount = await resolveBadgeCount(options);

  let delivered = 0;
  let attempts = 0;
  for (const row of rows) {
    const platform = row.platform === "android" ? "android" : row.platform === "ios" ? "ios" : null;
    const token = String(row.token ?? "").trim();
    if (!platform || !token) continue;
    attempts += 1;
    const r = await deliverPushToDevice(platform, token, title, body, data, badgeCount);
    if (r.success) delivered += 1;
  }
  return { delivered, attempts };
}

/** @deprecated Use {@link mobilePushDeliveryConfigured} */
export { iosPushDeliveryConfigured };
