/** Row shape for `public.carers` (patient-owned notify list). */
export type CarerRow = {
  id: string;
  user_id: string;
  carer_name: string;
  relationship: string | null;
  contact_method: "push" | "inapp";
  contact_value: string;
  receive_hypo_alerts: boolean;
  created_at: string;
};

/** Alias for clarity in UI code. */
export type Carer = CarerRow;

/** Payload embedded in push / in-app notification data. */
export type HypoNotificationPayload = {
  hypo_id: string;
  patient_user_id: string;
  blood_glucose: number | string | null;
  treatment: string | null;
  notes: string | null;
  created_at: string;
  carer_row_id?: string;
  carer_name?: string;
};

/** Row shape for `public.notifications` (in-app inbox). */
export type InAppNotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: HypoNotificationPayload | Record<string, unknown>;
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
