import { readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";
import { publicPath, SITE } from "../seo-operator/crawl.mjs";
import { summarize } from "./report.mjs";

const { values } = parseArgs({ options: { "state-dir": { type: "string" }, property: { type: "string", default: "sc-domain:leschanvriersbretons.com" } } });
if (!values["state-dir"] || !["sc-domain:leschanvriersbretons.com", SITE + "/"].includes(values.property)) {
  throw new Error("Dossier d’état et propriété Search Console des Chanvriers Bretons requis.");
}
const accessToken = process.env.LCB_GSC_READONLY_TOKEN;
if (!accessToken) throw new Error("Jeton OAuth Search Console en lecture seule indisponible.");
const directory = path.resolve(values["state-dir"]);
const endpoint = "https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(values.property) + "/searchAnalytics/query";
const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Los_Angeles" }).format(new Date());
const shifted = (value, days) => new Date(Date.parse(value + "T00:00:00Z") + days * 86400000).toISOString().slice(0,10);
const france = { dimension: "country", operator: "equals", expression: "fra" };
async function query(startDate, endDate, dimensions, filters, rowLimit) {
  const response = await fetch(endpoint, { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
    body: JSON.stringify({ startDate, endDate, type: "web", dataState: "final", dimensions, rowLimit,
      dimensionFilterGroups: [{ filters: [france, ...filters] }] }) });
  if (!response.ok) throw new Error("Search Console HTTP " + response.status + " ; import interrompu.");
  const body = await response.json();
  return body.rows ?? [];
}
const days = await query(shifted(date, -14), shifted(date, -1), ["date"], [], 20);
const through = days.map(row => row.keys[0]).sort().at(-1);
if (!through) throw new Error("Aucun jour finalisé renvoyé pour cette propriété et la France.");
const from = shifted(through, -89);
const brandExpression = "(?i)(les[ -]+)?chanvriers?[ -]+bretons?|leschanvriersbretons";
const rows = [];
for (const [brand, operator] of [["brand","includingRegex"], ["nonbrand","excludingRegex"]]) {
  const group = await query(from, through, ["date", "device", "page"], [{ dimension: "query", operator, expression: brandExpression }], 25000);
  if (group.length >= 25000) throw new Error("Limite de lignes atteinte. Export par fenêtres plus petites nécessaire.");
  for (const row of group) {
    const [date, device, page] = row.keys;
    const url = new URL(page);
    if (url.origin !== SITE || url.search || url.hash || !publicPath(url.pathname)) continue;
    rows.push({ date, country: "FR", device: device.toLowerCase(), brand, landing: url.pathname,
      clicks: row.clicks, impressions: row.impressions, position: row.position });
  }
}
const file = path.join(directory, "metrics-input.json");
let input;
try { input = JSON.parse((await readFile(file,"utf8")).replace(/^\uFEFF/, "")); }
catch (error) { if (error.code !== "ENOENT") throw error; input = { schema: 1, sources: {} }; }
input.sources.googleWeb = { from, through, rows };
const summary = summarize(input, new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date()));
for (const [target, value, replacer] of [[file,input,null], [path.join(directory,"metrics-summary.json"),summary,(key,value) => key === "segments" ? undefined : value]]) {
  const temp = target + "." + randomUUID();
  await writeFile(temp, JSON.stringify(value, replacer) + "\n", { flag: "wx", mode: 0o600 });
  await rename(temp,target);
}
console.log("Google Web FR, " + from + " au " + through + " : " + rows.length + " segments journaliers publics.");
