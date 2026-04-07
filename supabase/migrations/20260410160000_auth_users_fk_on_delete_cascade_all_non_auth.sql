-- v2: Broader than 20260410150000 (public-only). Fixes FKs from ANY schema except auth
-- (do not alter auth.identities etc. — those are managed by Supabase).
--
-- Also fixes ON DELETE placement when pg_get_constraintdef includes DEFERRABLE / MATCH.
--
-- Apply with: supabase db push   OR paste this file in SQL Editor.

DO $$
DECLARE
  r RECORD;
  newdef text;
BEGIN
  FOR r IN
    SELECT
      c.conname::text AS conname,
      n.nspname::text AS sch,
      rel.relname::text AS tbl,
      pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY (c.confkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND af.attname = 'id'
      AND array_length(c.conkey, 1) = 1
      AND n.nspname <> 'auth'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    IF r.def LIKE '%ON DELETE CASCADE%' THEN
      CONTINUE;
    END IF;

    newdef := r.def;
    newdef := regexp_replace(newdef, ' ON DELETE RESTRICT', ' ON DELETE CASCADE', 'gi');
    newdef := regexp_replace(newdef, ' ON DELETE NO ACTION', ' ON DELETE CASCADE', 'gi');
    newdef := regexp_replace(newdef, ' ON DELETE SET NULL', ' ON DELETE CASCADE', 'gi');
    newdef := regexp_replace(newdef, ' ON DELETE SET DEFAULT', ' ON DELETE CASCADE', 'gi');

    IF newdef NOT LIKE '%ON DELETE CASCADE%' THEN
      newdef := regexp_replace(
        newdef,
        '(REFERENCES\s+auth\.users\s*\(\s*id\s*\))',
        '\1 ON DELETE CASCADE',
        'i'
      );
    END IF;

    IF newdef NOT LIKE '%ON DELETE CASCADE%' THEN
      RAISE WARNING 'Skip % on %.%: could not derive ON DELETE CASCADE from: %', r.conname, r.sch, r.tbl, r.def;
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.sch, r.tbl, r.conname);
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', r.sch, r.tbl, r.conname, newdef);
      RAISE NOTICE 'Updated FK % on %.%', r.conname, r.sch, r.tbl;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Could not alter FK % on %.%: %', r.conname, r.sch, r.tbl, SQLERRM;
    END;
  END LOOP;
END $$;
