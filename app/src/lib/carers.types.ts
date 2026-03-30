/** Scopes stored per carer link (JSONB in `carer_links.scopes`). */
export type CarerScopes = {
  supplies: boolean;
  appointments: boolean;
  scenarios: boolean;
  emergency_info: boolean;
};

export const DEFAULT_CARER_SCOPES: CarerScopes = {
  supplies: true,
  appointments: true,
  scenarios: true,
  emergency_info: true,
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
