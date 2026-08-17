/** Payload embedded in push / in-app notification data. */
export type HypoNotificationPayload = {
  /** Carer-facing hypo alert vs patient self-confirmation in inbox. */
  kind?: "hypo_logged" | "hypo_logged_self" | string;
  deep_link?: string;
  hypo_id: string;
  patient_user_id: string;
  blood_glucose: number | string | null;
  treatment: string | null;
  notes: string | null;
  created_at: string;
  carer_row_id?: string;
  carer_name?: string;
};

/** Feed like/comment/mention rows inserted by DB triggers (community migrations). */
export type FeedInAppNotificationPayload = {
  kind: "feed_post_like" | "feed_post_comment" | "feed_post_mention" | "feed_comment_mention" | "feed_comment_like";
  post_id: string;
  actor_user_id?: string;
  comment_id?: string;
  deep_link?: string;
};

/** DM rows inserted by notify_dm_thread_members_on_message trigger. */
export type DmInAppNotificationPayload = {
  kind: "dm_message";
  thread_id: string;
  message_id?: string;
  sender_user_id?: string;
  deep_link?: string;
};

export type InAppNotificationPayload =
  | HypoNotificationPayload
  | FeedInAppNotificationPayload
  | DmInAppNotificationPayload
  | Record<string, unknown>;

/** Row shape for `public.notifications` (in-app inbox). */
export type InAppNotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: InAppNotificationPayload;
  created_at: string;
  read: boolean;
  /** Server-set idempotency key for some kinds (e.g. supplies_low); omitted on older rows. */
  dedupe_key?: string | null;
};

/** Patient inbox when a linked supporter acknowledges a hypo log. */
export type HypoAcknowledgedNotificationPayload = {
  kind: "hypo_acknowledged";
  hypo_id: string;
  carer_id?: string;
  carer_name?: string;
  deep_link?: string;
};

/** Patient inbox when a supporter asks if they are OK. */
export type HypoCheckInNotificationPayload = {
  kind: "hypo_check_in";
  check_in_id: string;
  carer_id?: string;
  carer_name?: string;
  patient_user_id?: string;
  glucose_concern?: "low" | "high" | "unknown";
  deep_link?: string;
};

/** Supporter inbox when the patient responds to a check-in. */
export type HypoCheckInResponseNotificationPayload = {
  kind: "hypo_check_in_response";
  check_in_id: string;
  response?: string;
  patient_user_id?: string;
  patient_name?: string;
  hypo_id?: string;
  glucose_concern?: "low" | "high" | "unknown";
  deep_link?: string;
};

/** Alias matching product language (“in-app notification”). */
export type Notification = InAppNotificationRow;

/** Edge Function JSON response. */
export type NotifyCarersOnHypoResult = {
  success: boolean;
  eligible_carers?: number;
  delivered_push?: number;
  delivered_inapp?: number;
  error?: string;
  detail?: string;
};
