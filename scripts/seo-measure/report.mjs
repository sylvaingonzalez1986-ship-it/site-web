import assert from "node:assert/strict";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { publicPath } from "../seo-operator/crawl.mjs";

const dayMs = 86400000;
const sourceNames = ["googleWeb", "bingWeb", "organicSales"];
const devices = ["mobile", "desktop", "tablet", "unknown"];
const brands = ["brand", "nonbrand", "unknown"];

function dateNumber(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
  const date = Date.parse(value + "T00:00:00Z");
  assert.ok(Number.isFinite(date) && iso(date) === value, "Date invalide");
  return date;
}
function iso(day) { return new Date(day).toISOString().slice(0, 10); }
function keysOnly(value, allowed) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.ok(Object.keys(value).every(key => allowed.includes(key)), "Champ inattendu");
}
function addRow(sum, row, sales) {
  sum.count++;
  if (sales) {
    sum.orders += row.orders;
    sum.cents += Math.round(row.revenueEUR * 100);
  } else {
    sum.clicks += row.clicks;
    sum.impressions += row.impressions;
    if (row.position != null) {
      sum.weighted += row.position * row.impressions;
      sum.withPosition += row.impressions;
    }
  }
}
function empty() {
  return { count: 0, orders: 0, cents: 0, clicks: 0, impressions: 0, weighted: 0, withPosition: 0 };
}
function result(sum, sales) {
  if (!sum.count) return null;
  if (sales) return { orders: sum.orders, revenueEUR: sum.cents / 100 };
  return {
    clicks: sum.clicks, impressions: sum.impressions,
    ctr: sum.impressions ? sum.clicks / sum.impressions : null,
    position: sum.impressions && sum.withPosition === sum.impressions ? sum.weighted / sum.impressions : null
  };
}
function checkRows(rows, sales, first, last) {
  const seen = new Set();
  for (const row of rows) {
    keysOnly(row, ["date", "country", "device", "brand", "landing", ...(sales ? ["orders", "revenueEUR"] : ["clicks", "impressions", "position"])]);
    const day = dateNumber(row.date);
    assert.ok(day >= first && day <= last);
    assert.match(row.country, /^[A-Z]{2}$/);
    assert.ok(devices.includes(row.device) && brands.includes(row.brand));
    assert.ok(publicPath(row.landing), "Chemin public canonique requis");
    const key = [row.date, row.country, row.device, row.brand, row.landing].join("|");
    assert.ok(!seen.has(key), "Segment journalier en double");
    seen.add(key);
    if (sales) {
      assert.ok(Number.isSafeInteger(row.orders) && row.orders >= 0 && Number.isFinite(row.revenueEUR) && row.revenueEUR >= 0);
      assert.ok(Math.abs(Math.round(row.revenueEUR * 100) / 100 - row.revenueEUR) < 0.000001);
    } else {
      assert.ok(Number.isSafeInteger(row.clicks) && row.clicks >= 0 && Number.isSafeInteger(row.impressions) && row.impressions >= row.clicks);
      assert.ok(row.position == null || Number.isFinite(row.position) && row.position >= 1);
    }
  }
}
function windowSummary(rows, sales, start, end) {
  const from = iso(start), through = iso(end);
  const total = empty(), groups = new Map();
  for (const row of rows) {
    if (row.date < from || row.date > through) continue;
    addRow(total, row, sales);
    const id = [row.country, row.device, row.brand, row.landing].join("|");
    if (!groups.has(id)) groups.set(id, empty());
    addRow(groups.get(id), row, sales);
  }
  if (!total.count) return null;
  return { start: from, end: through, ...result(total, sales), segments: [...groups.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([id, sum]) => {
    const [country, device, brand, landing] = id.split("|");
    return { country, device, brand, landing, ...result(sum, sales) };
  }) };
}
function movements(sources) {
  const changes = [];
  const key = row => [row.landing, row.country, row.device, row.brand].join("|");
  for (const source of ["googleWeb", "bingWeb"]) {
    const periods = sources[source]?.periods;
    if (!periods?.previous28 || !periods.last28) continue;
    const previous = new Map(periods.previous28.segments.map(row => [key(row), row]));
    for (const row of periods.last28.segments) {
      const before = previous.get(key(row));
      if (!before || row.country !== "FR" || row.clicks === before.clicks) continue;
      const clicksDelta = row.clicks - before.clicks;
      changes.push({ path: row.landing, country: row.country, device: row.device, brand: row.brand, source,
        kind: clicksDelta > 0 ? "rising" : "declining", clicksDelta, impressionsDelta: row.impressions - before.impressions });
    }
  }
  return ["declining", "rising"].flatMap(kind => changes.filter(row => row.kind === kind)
    .sort((a,b) => Math.abs(b.clicksDelta) - Math.abs(a.clicksDelta)).slice(0,3));
}
export function summarize(input, asOf) {
  keysOnly(input, ["schema", "sources"]);
  assert.equal(input.schema, 1);
  keysOnly(input.sources, sourceNames);
  const today = dateNumber(asOf);
  const sources = {};
  for (const name of sourceNames) {
    const source = input.sources[name];
    sources[name] = null;
    if (source == null) continue;
    keysOnly(source, ["from", "through", "rows"]);
    const first = dateNumber(source.from), last = dateNumber(source.through);
    assert.ok(last < today && first <= last && Array.isArray(source.rows), "Couverture complète et finalisée requise");
    const sales = name === "organicSales";
    checkRows(source.rows, sales, first, last);
    const periods = {};
    for (const [period, length, offset] of [["last28", 28, 0], ["previous28", 28, 28], ["baseline90", 90, 0]]) {
      const end = last - offset * dayMs, start = end - (length - 1) * dayMs;
      periods[period] = start < first ? null : windowSummary(source.rows, sales, start, end);
    }
    sources[name] = { through: source.through, periods };
  }
  return { schema: 1, asOf, sources, opportunities: movements(sources) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { "as-of": { type: "string" }, "state-dir": { type: "string" } },
  });
  assert.equal(positionals.length, 1, "report.mjs <input.json> [--as-of YYYY-MM-DD] [--state-dir dossier]");
  const asOf = values["as-of"] ?? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
  const data = JSON.parse(readFileSync(positionals[0], "utf8").replace(/^\uFEFF/, ""));
  const report = summarize(data, asOf);
  if (values["state-dir"]) {
    const target = path.join(values["state-dir"], "metrics-summary.json");
    const temporary = target + "." + randomUUID();
    const compact = JSON.stringify(report, (key, value) => key === "segments" ? undefined : value);
    writeFileSync(temporary, compact + "\n", { flag: "wx", mode: 0o600 });
    renameSync(temporary, target);
    console.log("Synthèse agrégée enregistrée.");
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}
