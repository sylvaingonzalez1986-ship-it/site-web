import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
if (!process.argv.includes("--apply")) throw new Error("Run with --apply to credit proven historical achievements. Replaying is idempotent.");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase service configuration.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
for (const kind of ["runs", "battles", "bots", "sales"]) {
  let cursor = null, count = 0;
  for (;;) {
    const { data, error } = await client.rpc("rpc_chanvrier_backfill", { p_kind: kind, p_after: cursor, p_limit: 100 }).abortSignal(AbortSignal.timeout(60000));
    if (error) throw new Error(`${kind}: ${error.code ?? "request failed"}. Safe to restart the script; committed pages will not award twice.`);
    count += data.processed;
    console.log(`${kind}: ${count} rows inspected${data.done ? " (complete)" : ""}`);
    if (data.done) break;
    if (!data.after || data.after === cursor) throw new Error("Backfill cursor did not advance.");
    cursor = data.after;
  }
}
