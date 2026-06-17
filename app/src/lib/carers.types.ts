/** Scopes stored per carer link (JSONB in `carer_links.scopes`). */
export type CarerScopes = {
  supplies: boolean;
  appointments: boolean;
  scenarios: boolean;
  hypo_alerts: boolean;
  emergency_info: boolean;
  /** When true, supporter may view/update cloud clinical basics on the patient's profile (delivery, TDD, DOB). */
  clinical_settings: boolean;
  /** When true, supporter may show their linked patient on their public profile (patient must also allow). */
  public_profile_mention: boolean;
};

export const DEFAULT_CARER_SCOPES: CarerScopes = {
  supplies: true,
  appointments: true,
  scenarios: true,
  hypo_alerts: true,
  emergency_info: true,
  clinical_settings: false,
  public_profile_mention: false,
};

/** Client shape; DB columns are snake_case — map in carers.ts. */
export type CarerInviteRow = {
  code: string;
  patientId: string;
  expiresAt: string;
  usedAt: string | null;
};

/** Client shape; DB columns are snake_case — map in carers.ts. */
export type CarerLinkRow = {
  id: string;
  patientId: string;
  carerId: string;
  role: string;
  scopes: CarerScopes;
  linkedAt: string;
};

/** Linked patient context for the signed-in carer (MVP: at most one). */
export type LinkedPatientInfo = {
  linkId: string;
  patientId: string;
  carerId: string;
  scopes: CarerScopes;
};

/** Carer can be linked to multiple patients; include display fields for selection UI. */
export type LinkedPatientWithProfile = LinkedPatientInfo & {
  patient_full_name: string | null;
  patient_avatar_url: string | null;
};

export type CarerLinkWithProfile = CarerLinkRow & {
  carer_full_name: string | null;
  carer_avatar_url: string | null;
};

export type CloudSupplyRow = {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  updated_at: string;
  unit?: string | null;
  category?: string | null;
  notes?: string | null;
};

export type CloudHypoLogRow = {
  id: string;
  user_id: string;
  blood_glucose: number | null;
  treatment: string | null;
  notes: string | null;
  created_at: string;
};
