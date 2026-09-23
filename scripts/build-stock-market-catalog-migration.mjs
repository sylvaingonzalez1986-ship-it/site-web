// Generate a new reviewed seed migration after refreshing the source catalogue.
// Never overwrites an existing migration or contacts the database.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const filename = process.argv[2];
assert(typeof filename === "string" && /^\d{14}_kq_stock_catalog\.sql$/.test(filename), "Usage: node scripts/build-stock-market-catalog-migration.mjs YYYYMMDDHHMMSS_kq_stock_catalog.sql");
const catalog = JSON.parse(await readFile("src/lib/stock-market-catalog.json", "utf8"));
assert(Array.isArray(catalog.instruments) && catalog.instruments.length >= 500);
assert.equal(new Set(catalog.instruments.map(asset => asset.id)).size, catalog.instruments.length);
const json = "[\n" + catalog.instruments.map(asset => " " + JSON.stringify(asset)).join(",\n") + "\n]";
assert(!json.includes("$stock_catalog$"), "Unsafe SQL delimiter in catalogue");
const sql = `-- Metadata from src/lib/stock-market-catalog.json (${catalog.asOf}).
-- Keep former constituents for existing holdings; their markets array is empty.
BEGIN;
UPDATE public.kq_stock_instruments SET markets = '{}'::text[];
INSERT INTO public.kq_stock_instruments (id, symbol, name, kind, markets, currency)
SELECT id, symbol, name, kind, markets, currency
FROM jsonb_to_recordset($stock_catalog$${json}$stock_catalog$::jsonb)
 AS instrument(id text, symbol text, name text, kind text, markets text[], currency text)
ON CONFLICT (id) DO UPDATE SET
 symbol = EXCLUDED.symbol, name = EXCLUDED.name, kind = EXCLUDED.kind,
 markets = EXCLUDED.markets, currency = EXCLUDED.currency;
COMMIT;
`;
await writeFile(path.join("supabase/migrations", filename), sql, { flag: "wx", encoding: "utf8" });
console.log(`Created ${filename}: ${catalog.instruments.length} instruments. Review and deploy together with the JSON catalogue.`);
