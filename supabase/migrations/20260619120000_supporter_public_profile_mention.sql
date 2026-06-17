-- Optional "Supports @handle" on a supporter's public community profile (dual opt-in).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_supported_person_on_profile boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.show_supported_person_on_profile IS
  'Supporter opt-in: may show their linked patient on their public profile when carer_links.scopes.public_profile_mention is true and the patient profile is public.';

CREATE OR REPLACE FUNCTION public.get_public_profile_supported_person(p_user_id uuid)
RETURNS TABLE (
  patient_id uuid,
  full_name text,
  public_handle text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    patient.id AS patient_id,
    patient.full_name,
    patient.public_handle,
    patient.avatar_url
  FROM public.profiles supporter
  INNER JOIN public.carer_links cl ON cl.carer_id = supporter.id
  INNER JOIN public.profiles patient ON patient.id = cl.patient_id
  WHERE supporter.id = p_user_id
    AND supporter.is_public = true
    AND supporter.show_supported_person_on_profile = true
    AND COALESCE((cl.scopes->>'public_profile_mention')::boolean, false) = true
    AND patient.is_public = true
    AND nullif(trim(patient.public_handle), '') IS NOT NULL
  ORDER BY cl.linked_at ASC NULLS LAST, cl.id ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_supported_person(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_supported_person(uuid) TO anon, authenticated;
