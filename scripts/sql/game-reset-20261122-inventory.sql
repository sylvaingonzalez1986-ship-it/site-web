-- Supply the output of this read-only query as inventory.json (Supabase CLI --output json).
SELECT jsonb_build_object(
  'tables', (SELECT jsonb_agg(relname ORDER BY relname)
             FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')),
  'columns', (SELECT jsonb_object_agg(table_name, names)
              FROM (SELECT table_name, jsonb_agg(column_name ORDER BY ordinal_position) AS names
                    FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name) cols)
) AS inventory;
