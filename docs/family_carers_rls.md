# Family & Carers — RLS and query patterns

This document complements `docs/sql/family_carers.sql`. **Do not treat this as executable SQL**; it explains how carers should access patient-owned data once tables and policies are applied in Supabase.

## Model (MVP)

- One **patient** may have many **carers**.
- Each **carer** links via a one-time **invite code**; for this MVP we assume **at most one linked patient per carer** (enforced in product flow; DB allows multiple if you extend later).
- **Privacy is per link**: `carer_links.scopes` is JSON with booleans `supplies`, `appointments`, `scenarios`, `emergency_info`. On first successful link, defaults are all `true`; the patient can turn scopes off later.
- **Emergency info** lives on `profiles` (see SQL file for suggested columns). Carers may read it only when `emergency_info` is true for their link.
- **Push / in-app notifications** for carers are **not** in this MVP — add after staging validation (see “Next steps” at the end of the implementation checklist).

## Policy examples

### `carer_invites`

- **Patient** creates invites: `INSERT` with `patient_id = auth.uid()`.
- **Patient** lists own invites: `SELECT` where `patient_id = auth.uid()`.
- **Revoke**: `DELETE` the row, or set `used_at` if you model soft-revoke (client implementation deletes the row).
- **Redeem**: a **carer** (signed in) should update the invite row to set `used_at` only when `code` matches, `used_at IS NULL`, and `expires_at > now()`. Prefer a **single RPC** (`SECURITY DEFINER`) that inserts `carer_links` and marks the invite used in one transaction to avoid races.

Carers must **not** be able to enumerate all invites (no broad `SELECT` on `carer_invites` for non-owners).

### `carer_links`

- **Patient**: `SELECT`, `UPDATE`, `DELETE` where `patient_id = auth.uid()`.
- **Carer**: `SELECT` where `carer_id = auth.uid()` (read link + scopes + `patient_id`).

### Patient data (`supplies`, future `appointments`, scenario flags, `profiles`)

Use an **EXISTS** subquery on `carer_links`:

```sql
EXISTS (
  SELECT 1
  FROM public.carer_links cl
  WHERE cl.patient_id = <row_owner_patient_id>
    AND cl.carer_id = auth.uid()
    AND coalesce((cl.scopes->>'<scope_key>')::boolean, false) = true
)
```

Replace `<row_owner_patient_id>` with the column that identifies the patient (e.g. `supplies.user_id`, or `profiles.id` for profile rows). Replace `<scope_key>` with `supplies`, `appointments`, `scenarios`, or `emergency_info`.

Always allow the patient to read their own rows:

```sql
<row_owner_patient_id> = auth.uid()
  OR EXISTS ( ... carer_links ... )
```

## Patient reads carer display names

To show each linked carer’s name on the patient’s **Family & Carers** screen, the patient must be allowed to `SELECT` limited columns from `profiles` for rows where an active `carer_links` row exists (`patient_id = auth.uid()` and `carer_id = profiles.id`). Without this, the UI still works but may fall back to anonymised labels until you add a policy.

## Client query patterns

- **Patient — list carers**: `SELECT * FROM carer_links WHERE patient_id = auth.uid()` (then `SELECT id, full_name, avatar_url FROM profiles WHERE id IN (...carer_ids...)` if policy allows).
- **Carer — who am I caring for?**: `SELECT patient_id, scopes FROM carer_links WHERE carer_id = auth.uid() LIMIT 1` (MVP).
- **Carer — supplies**: `SELECT * FROM supplies WHERE user_id = :patient_id` (RLS enforces link + `scopes.supplies`).
- **Carer — profile / emergency**: `SELECT ... FROM profiles WHERE id = :patient_id` (RLS enforces link + `scopes.emergency_info` for sensitive columns, or split policies).

## Notifications (later)

- Document only for MVP: when you add notifications, use a worker or Edge Function subscribed to relevant writes, respecting the same `carer_links.scopes` flags.
- Avoid leaking invite codes or patient identifiers in notification payloads sent to the wrong user.
