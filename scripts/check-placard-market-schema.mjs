// Read-only checks using the configured project's existing service credentials.
import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error("Supabase service configuration is missing");
const project = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
if (new URL(base).hostname !== project + ".supabase.co") throw new Error("Linked project differs from the application configuration");
const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
const pulse = await fetch(base + "/rest/v1/rpc/rpc_kq_market_pulse", {
  method: "POST", headers, signal: AbortSignal.timeout(15000),
  body: JSON.stringify({ p_user_id: "00000000-0000-4000-8000-000000000000" }),
});
const pulseData = await pulse.json();
const schema = await fetch(base + "/rest/v1/", { headers: { ...headers, Accept: "application/openapi+json" }, signal: AbortSignal.timeout(15000) });
const schemaData = await schema.json();
const saleAvailable = Boolean(schemaData.paths?.["/rpc/rpc_kq_sell_market_offer"]);
console.log(JSON.stringify({projectMatches: true, pulseStatus: pulse.status, pulseError: pulseData.code ?? null, saleAvailable}));
if (!pulse.ok || !saleAvailable) process.exitCode = 1;
