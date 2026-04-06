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

/** Feed like/comment rows inserted by DB triggers (`community_feed_notifications` migration). */
export type FeedInAppNotificationPayload = {
  kind: "feed_post_like" | "feed_post_comment";
  post_id: string;
  actor_user_id?: string;
  comment_id?: string;
  deep_link?: string;
};

export type InAppNotificationPayload = HypoNotificationPayload | FeedInAppNotificationPayload | Record<string, unknown>;

/** Row shape for `public.notifications` (in-app inbox). */
export type InAppNotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: InAppNotificationPayload;
  created_at: string;
  read: boolean;
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
