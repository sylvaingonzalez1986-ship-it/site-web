// Read-only provider smoke using the production adapter. No game balances or credentials.
import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src"), "server-only": path.resolve("src/test/server-only.ts") } }, server: { middlewareMode: true, watch: null } });
try {
 const { fetchKqStockQuotes } = await vite.ssrLoadModule("/src/lib/stock-market-quotes.ts");
 const ids = ["^FCHI", "^GSPC", "AIR.PA", "AAPL"];
 const quotes = await fetchKqStockQuotes(ids);
 assert.deepEqual(quotes.map(quote => quote.id).sort(), [...ids].sort(), "All representative quotes must satisfy production validation");
 assert(quotes.every(quote => Number(quote.priceNative) > 0 && Number(quote.fxRate) > 0));
 assert(quotes.filter(quote => quote.currency === "USD").every(quote => quote.fxQuotedAt));
 const result = { checkedAt: new Date().toISOString(), provider: "Yahoo Finance spark", fxConvention: "USD per EUR", quotes };
 await mkdir("output", { recursive: true });
 await writeFile("output/stock-market-live-check.json", JSON.stringify(result, null, 2) + "\n");
 console.log(JSON.stringify(result, null, 2));
} catch (error) {
 console.error("Live stock contract unavailable:", error instanceof Error ? error.message : "unknown");
 process.exitCode = 1;
} finally { await vite.close(); }
