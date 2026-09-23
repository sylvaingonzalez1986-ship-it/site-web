<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Supabase Data API permissions

- Every migration creating a `public` table must declare its Data API permissions in the same file. RLS policies do not replace `GRANT` statements, including for `service_role`.
- Grant only the operations used by the application. Its database queries run on the server as `service_role`; do not copy generic `anon` / `authenticated` grants onto private tables.
- Keep tables written through `SECURITY DEFINER` RPCs read-only or inaccessible to API roles as intended. For a private table, explicitly revoke all table privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- Grant sequence `USAGE` explicitly when a permitted insert uses a `SERIAL` / `BIGSERIAL` default. Give API views their own grants and check underlying relations for `security_invoker` views.
- Do not restore automatic grants with `ALTER DEFAULT PRIVILEGES`, or grant privileges on all tables/functions in `public`. Use named objects.
- Run `npm run check:supabase-grants` after changing migrations. Historical application access is completed by `20260923000200_explicit_data_api_grants.sql`; new tables must not rely on that catch-up migration.
