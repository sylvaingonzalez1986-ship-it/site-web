// Checks the linked project's private tables and named RPCs without reading players.
// --warm-quotes additionally refreshes public market prices; never calls a player command.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { createServer } from "vite";
async function main() {
 nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
 const base = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
 assert(base && key, "Missing application service configuration");
 const project = (await readFile("supabase/.temp/project-ref", "utf8")).trim(), url = new URL(base);
 assert(url.protocol === "https:" && url.hostname === `${project}.supabase.co` && !url.port && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, "Linked project does not match application configuration");
 const headers = { apikey: key, Authorization: `Bearer ${key}` };
 const request = (resource, options = {}) => fetch(`${url.origin}/rest/v1/${resource}`, { ...options, headers: { ...headers, ...options.headers }, redirect: "error", signal: AbortSignal.timeout(15000) });
 const schemaResponse = await request("", { headers: { Accept: "application/openapi+json" } });
 assert(schemaResponse.ok, "Schema unavailable");
 const schema = await schemaResponse.json();
 for (const rpc of ["rpc_kq_stock_refresh_claim", "rpc_kq_stock_refresh_publish", "rpc_kq_stock_command"]) assert(schema.paths?.[`/rpc/${rpc}`]?.post, `Missing named RPC: ${rpc}`);
 const tables = ["kq_stock_instruments", "kq_stock_quotes", "kq_stock_positions", "kq_stock_orders", "kq_stock_trades"];
 const checks = await Promise.all(tables.map(async table => {
  const response = await request(`${table}?select=*&limit=0`);
  assert([401, 403].includes(response.status), `Private table unexpectedly accessible: ${table}`);
  return { table, status: response.status };
 }));
 const result = { projectMatches: true, namedRpcs: 3, privateTables: checks, warmed: [] };
 if (process.argv.includes("--warm-quotes")) {
  const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src"), "server-only": path.resolve("src/test/server-only.ts") } }, server: { middlewareMode: true, watch: null } });
  try {
   const { fetchKqStockQuotes } = await vite.ssrLoadModule("/src/lib/stock-market-quotes.ts");
   const { KQ_STOCK_INSTRUMENTS } = await vite.ssrLoadModule("/src/lib/kanab-quest-stocks.ts");
   const rpc = async (name, body) => { const response = await request(`rpc/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); assert(response.ok, `RPC failed: ${name}, HTTP ${response.status}`); return response.json(); };
   for (const market of ["cac40", "sp500"]) {
    const ids = [...KQ_STOCK_INSTRUMENTS.filter(i => i.kind === "index" && i.markets.includes(market)), ...KQ_STOCK_INSTRUMENTS.filter(i => i.kind === "stock" && i.markets.includes(market)).slice(0, 10)].map(i => i.id);
    const lease = await rpc("rpc_kq_stock_refresh_claim", { p_asset_ids: ids });
    if (!lease) { result.warmed.push({ market, status: "recent cache or active lease" }); continue; }
    assert(typeof lease.leaseId === "string" && Array.isArray(lease.assetIds) && lease.assetIds.length > 0 && lease.assetIds.every(id => ids.includes(id)), "Invalid refresh lease");
    try {
     const quotes = await fetchKqStockQuotes(lease.assetIds);
     const published = await rpc("rpc_kq_stock_refresh_publish", { p_lease_id: lease.leaseId, p_assets: quotes });
     assert(published === true && quotes.length === lease.assetIds.length, "Incomplete real quote publication");
     result.warmed.push({ market, published: quotes.length, ids: quotes.map(quote => quote.id) });
    } catch (error) { await rpc("rpc_kq_stock_refresh_publish", { p_lease_id: lease.leaseId, p_assets: [] }).catch(() => {}); throw error; }
   }
  } finally { await vite.close(); }
 }
 console.log(JSON.stringify({ ...result, ok: true }, null, 2));
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : "Stock schema check unavailable; verify project configuration and connectivity."); process.exitCode = 1; });
