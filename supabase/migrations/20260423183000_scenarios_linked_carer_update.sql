-- Supporters with scenarios scope may UPDATE patient scenario rows (sick-day shared log).

DO $migration$
BEGIN
  IF to_regclass('public.scenarios') IS NULL THEN
    RAISE NOTICE 'public.scenarios missing; skip scenarios_linked_carer_update';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS scenarios_linked_carer_update ON public.scenarios';

  EXECUTE $pol$
    CREATE POLICY scenarios_linked_carer_update
      ON public.scenarios
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.carer_links cl
          WHERE cl.patient_id = public.scenarios.user_id
            AND cl.carer_id = auth.uid()
            AND coalesce((cl.scopes->>'scenarios')::boolean, false) = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.carer_links cl
          WHERE cl.patient_id = public.scenarios.user_id
            AND cl.carer_id = auth.uid()
            AND coalesce((cl.scopes->>'scenarios')::boolean, false) = true
        )
      );
  $pol$;
END
$migration$;
