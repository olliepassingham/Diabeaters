/**
 * Unified mobile push delivery (iOS APNs + Android FCM).
 */
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

export type PushPlatform = "ios" | "android";

export type DeliverPushResult =
  | { success: true; channel: "apns" | "fcm" | "relay"; platform: PushPlatform }
  | { success: false; channel: "apns" | "fcm" | "relay" | "none"; platform: PushPlatform; httpStatus?: number; errorBody?: string };

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

export async function deliverPushToDevice(
  platform: PushPlatform,
  deviceToken: string,
  title: string,
  body: string,
  data: unknown,
): Promise<DeliverPushResult> {
  if (platform === "android") {
    const r = await deliverAndroidPushToDevice(deviceToken, title, body, data);
    if (r.success) return { ...r, platform: "android" };
    return { ...r, platform: "android" };
  }
  const r: DeliverIosPushResult = await deliverIosPushToDevice(deviceToken, title, body, data);
  if (r.success) return { ...r, platform: "ios" };
  return { ...r, platform: "ios" };
}

export type PushTokenRow = { platform: string; token: string };

export async function deliverPushToTokenRows(
  rows: PushTokenRow[],
  title: string,
  body: string,
  data: unknown,
): Promise<{ delivered: number; attempts: number }> {
  let delivered = 0;
  let attempts = 0;
  for (const row of rows) {
    const platform = row.platform === "android" ? "android" : row.platform === "ios" ? "ios" : null;
    const token = String(row.token ?? "").trim();
    if (!platform || !token) continue;
    attempts += 1;
    const r = await deliverPushToDevice(platform, token, title, body, data);
    if (r.success) delivered += 1;
  }
  return { delivered, attempts };
}

/** @deprecated Use {@link mobilePushDeliveryConfigured} */
export { iosPushDeliveryConfigured };
