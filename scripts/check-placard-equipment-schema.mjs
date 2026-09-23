// Read-only schema checks using the configured project's existing service credentials.
// GET requests return zero rows; RPCs are inspected in OpenAPI, never invoked.
import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

async function main() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase service configuration is missing");
  const project = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
  const url = new URL(base);
  if (url.protocol !== "https:" || url.hostname !== project + ".supabase.co" || url.port || url.username || url.password) {
    throw new Error("Linked project differs from the application configuration");
  }
  const headers = { apikey: key, Authorization: "Bearer " + key };
  const schemaResponse = await fetch(url.origin + "/rest/v1/", {
    method: "GET", headers: { ...headers, Accept: "application/openapi+json" },
    redirect: "error", signal: AbortSignal.timeout(15000),
  });
  const schema = await schemaResponse.json();

  // Keep these selects, filters, and ordering aligned with getKqEquipmentShopSnapshot.
  // The null-owner filters and limit=0 avoid retrieving or counting player data.
  const queries = [
    {
      table: "kq_equipment_wallets",
      select: "cash_cents,reputation,planned_route_code,planned_equipment_code,chanvrier:arena_chanvrier_profiles(strength)",
      user_id: "is.null",
    },
    {
      table: "kq_player_equipment",
      select: "equipment_code,purchase_price_cents,level,wear_cycles,maintenance_version,culture_wear_percent,culture_wear_version",
      user_id: "is.null", order: "acquired_at.asc",
    },
    { table: "kq_equipment_loadouts", select: "equipment_code", user_id: "is.null", order: "slot.asc" },
    { table: "kq_runs", select: "id", user_id: "is.null", status: "eq.active" },
    { table: "kq_market_lots", select: "flower_id", owner_id: "is.null", status: "eq.ready" },
    { table: "kq_flowers", select: "id", owner_id: "is.null", status: "eq.available" },
    {
      table: "kq_player_route_masteries",
      select: "route,sale_count,best_jury_score,total_payout_cents,total_reputation,mastered_at",
      user_id: "is.null", order: "mastered_at.desc",
    },
    {
      table: "kq_culture_equipment_wear_receipts",
      select: "run_id,user_id,energy_mode,equipment,created_at", user_id: "is.null",
    },
    {
      table: "kq_culture_equipment_replacements",
      select: "user_id,request_key,equipment_code,expected_version,receipt,created_at", user_id: "is.null",
    },
  ];
  const requiredPaths = [
    ...queries.map(({ table }) => "/" + table),
    "/arena_chanvrier_profiles",
    "/rpc/rpc_kq_ensure_equipment_profile",
    "/rpc/rpc_kq_replace_culture_equipment",
  ];
  const missing = requiredPaths.filter(path => !schema.paths?.[path]);
  const equipmentProperties = schema.definitions?.kq_player_equipment?.properties;
  const missingColumns = ["culture_wear_percent", "culture_wear_version"]
    .filter(column => !equipmentProperties?.[column])
    .map(column => "kq_player_equipment." + column);

  const checks = await Promise.all(queries.map(async ({ table, ...parameters }) => {
    try {
      const query = new URLSearchParams({ ...parameters, limit: "0" });
      const response = await fetch(url.origin + "/rest/v1/" + table + "?" + query, {
        method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      // Only print known error-code formats, never messages, details, hints, or rows.
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
  // Configuration and transport exceptions can contain URLs or credentials.
  console.error(JSON.stringify({ ok: false, error: "Schema check failed: verify linked project, service configuration, and connectivity" }));
  process.exitCode = 1;
});
