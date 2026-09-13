-- Audit en lecture seule : aucune donnée client, aucun secret, aucune mutation.
-- À exécuter dans l'éditeur SQL du projet Supabase concerné pour confirmer
-- les permissions réellement déployées. Ne constitue pas un test d'exploitation.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'blog_comments', 'blog_ratings')
ORDER BY tablename, policyname;

SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'blog_comments', 'blog_ratings')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'blog_comments', 'blog_ratings')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, grantee, column_name;

SELECT event_object_table, trigger_name, event_manipulation,
       action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('profiles', 'blog_comments', 'blog_ratings')
ORDER BY event_object_table, trigger_name;

SELECT role_name, table_name, column_name,
       has_column_privilege(role_name, 'public.' || table_name, column_name, privilege_name) AS allowed,
       privilege_name
FROM (VALUES
 ('authenticated', 'profiles', 'loyalty_points', 'UPDATE'),
 ('authenticated', 'profiles', 'loyalty_points_spent', 'UPDATE'),
 ('authenticated', 'blog_comments', 'status', 'INSERT'),
 ('anon', 'blog_comments', 'admin_note', 'SELECT'),
 ('anon', 'blog_ratings', 'customer_id', 'SELECT')
) AS checks(role_name, table_name, column_name, privilege_name);
