-- Fix "Database error deleting user" in Supabase Dashboard (Auth → Delete user).
-- PostgreSQL blocks deleting auth.users while a public row still references that id with ON DELETE NO ACTION / RESTRICT.
-- This migration re-creates each public → auth.users FK with ON DELETE CASCADE so Dashboard deletes cascade cleanly.
--
-- Safe to re-run: skips constraints that already use CASCADE.

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
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND n.nspname = 'public'
  LOOP
    IF r.def LIKE '%ON DELETE CASCADE%' THEN
      CONTINUE;
    END IF;

    newdef := r.def;
    IF newdef ~* ' ON DELETE RESTRICT' THEN
      newdef := regexp_replace(newdef, ' ON DELETE RESTRICT', ' ON DELETE CASCADE', 'i');
    ELSIF newdef ~* ' ON DELETE NO ACTION' THEN
      newdef := regexp_replace(newdef, ' ON DELETE NO ACTION', ' ON DELETE CASCADE', 'i');
    ELSIF newdef ~* ' ON DELETE SET NULL' THEN
      newdef := regexp_replace(newdef, ' ON DELETE SET NULL', ' ON DELETE CASCADE', 'i');
    ELSIF newdef ~* ' ON DELETE SET DEFAULT' THEN
      newdef := regexp_replace(newdef, ' ON DELETE SET DEFAULT', ' ON DELETE CASCADE', 'i');
    ELSE
      newdef := r.def || ' ON DELETE CASCADE';
    END IF;

    BEGIN
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.sch, r.tbl, r.conname);
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', r.sch, r.tbl, r.conname, newdef);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Could not alter FK % on public.%: %', r.conname, r.tbl, SQLERRM;
    END;
  END LOOP;
END $$;
