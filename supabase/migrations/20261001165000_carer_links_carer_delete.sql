-- A supporter can end their own link. The patient delete policy is unchanged.
-- Other links for the same supporter are separate rows and are not affected.

DROP POLICY IF EXISTS carer_links_carer_delete ON public.carer_links;

CREATE POLICY carer_links_carer_delete
  ON public.carer_links FOR DELETE
  TO authenticated
  USING (carer_id = auth.uid());
