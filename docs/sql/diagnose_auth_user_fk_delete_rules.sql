-- Run in Supabase SQL Editor to see every FK pointing at auth.users(id) and the ON DELETE rule.
-- Anything that is not CASCADE can block Dashboard → Authentication → Delete user.
--
-- After fixing FKs (migration 20260410160000_auth_users_fk_on_delete_cascade_all_non_auth.sql),
-- re-run this query: all rows should show CASCADE.
--
-- If Postgres logs show "permission denied for table <name>" (e.g. community_posts) during
-- DELETE FROM auth.users, RLS is blocking the auth admin role (supabase_auth_admin) during
-- CASCADE. Prefer migration 20260410180000_auth_users_before_delete_public_data_security_definer.sql
-- (SECURITY DEFINER trigger — bypasses RLS). Optionally also 20260410170000 (RLS policies).

SELECT
  n.nspname AS referencing_schema,
  rel.relname AS referencing_table,
  a.attname AS referencing_column,
  con.conname AS constraint_name,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY (con.confkey)
WHERE con.contype = 'f'
  AND con.confrelid = 'auth.users'::regclass
  AND af.attname = 'id'
ORDER BY 1, 2, 3;
