// Read-only schema checks using the application's existing service credentials.
// Table GETs return zero rows. RPCs are inspected in OpenAPI and never invoked.
import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";

async function main() {
  nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase service configuration is missing");
  const project = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
  const url = new URL(base);
  if (url.protocol !== "https:" || url.hostname !== project + ".supabase.co"
    || url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Linked project differs from the application configuration");
  }

  const headers = { apikey: key, Authorization: "Bearer " + key };
  const schemaResponse = await fetch(url.origin + "/rest/v1/", {
    method: "GET", headers: { ...headers, Accept: "application/openapi+json" },
    redirect: "error", signal: AbortSignal.timeout(15000),
  });
  const schema = await schemaResponse.json();
  const tables = [
    {
      table: "kq_commerce_accounts", owner: "user_id",
      columns: ["user_id", "business_started_at", "shop_name", "shop_created_at", "shop_paid_until", "shop_renew",
        "shop_suspended", "advertising", "domiciliation_mode", "domiciliation_paid_until", "domiciliation_renew",
        "vat_sales_ttc_cents", "vat_reserved_cents", "vat_paid_cents", "vat_next_settlement_at"],
    },
    {
      table: "kq_lab_invoices", owner: "user_id",
      columns: ["id", "run_id", "user_id", "issued_at", "due_at", "amount_cents", "remaining_cents", "due_processed_at"],
    },
    {
      table: "kq_business_ledger", owner: "user_id",
      columns: ["id", "user_id", "kind", "amount_cents", "occurred_at"],
    },
    {
      table: "kq_market_sale_receipts", owner: "owner_id",
      columns: ["id", "owner_id", "payout_cents", "vat_cents", "lab_paid_cents", "electricity_paid_cents"],
    },
  ];
  const rpcPaths = ["/rpc/rpc_kq_commerce_state", "/rpc/rpc_kq_commerce_command"];
  const missing = tables.map(({ table }) => "/" + table).filter(path => !schema.paths?.[path]);
  missing.push(...rpcPaths.filter(path => !schema.paths?.[path]?.post));
  const definitions = schema.definitions ?? schema.components?.schemas;
  const missingColumns = tables.flatMap(({ table, columns }) => columns
    .filter(column => !definitions?.[table]?.properties?.[column])
    .map(column => table + "." + column));

  // Null-owner filters and limit=0 avoid retrieving or counting any player data.
  const checks = await Promise.all(tables.map(async ({ table, owner, columns }) => {
    try {
      const query = new URLSearchParams({ select: columns.join(","), [owner]: "is.null", limit: "0" });
      const response = await fetch(url.origin + "/rest/v1/" + table + "?" + query, {
        method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      // Never print returned rows, server messages, details, hints, credentials or URLs.
      const code = typeof data?.code === "string" && /^(PGRST\d{3}|[0-9A-Z]{5})$/.test(data.code)
        ? data.code : null;
      return { table, status: response.status, ok: response.ok && Array.isArray(data) && data.length === 0, code };
    } catch {
      return { table, status: null, ok: false, code: "request_failed" };
    }
  }));
  const ok = schemaResponse.ok && !missing.length && !missingColumns.length && checks.every(check => check.ok);
  console.log(JSON.stringify({ projectMatches: true, status: schemaResponse.status, missing, missingColumns, checks, ok }));
  if (!ok) process.exitCode = 1;
}

main().catch(() => {
  // Exceptions can contain configuration or transport details; keep the output generic.
  console.error(JSON.stringify({ ok: false, error: "Schema check failed: verify linked project, service configuration, and connectivity" }));
  process.exitCode = 1;
});
