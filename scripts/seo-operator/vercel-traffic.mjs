import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

const DAY = 86_400_000;
const MAX_RUNTIME = 48_000;
const production = "environment eq 'production'";
const trackedPaths = ["/", "/boutique", "/boutique/fleurs-cbd", "/cbd-breton", "/cbd-naturel", "/analyse-laboratoire-cbd",
  "/cbd-rennes", "/cbd-quimper", "/cbd-brest", "/cbd-vannes", "/cbd-lorient", "/cbd-saint-brieuc", "/cbd-saint-malo",
  "/cbd-fougeres", "/cbd-vitre", "/cbd-redon"];
const searchHosts = new Set(["google.com", "www.google.com", "google.fr", "www.google.fr", "bing.com", "www.bing.com",
  "search.brave.com", "duckduckgo.com", "www.duckduckgo.com", "qwant.com", "www.qwant.com"]);
const aiHosts = new Set(["chatgpt.com", "www.chatgpt.com", "chat.openai.com", "perplexity.ai", "www.perplexity.ai",
  "claude.ai", "www.claude.ai", "gemini.google.com", "copilot.microsoft.com"]);

function classify(host) {
  if (searchHosts.has(host)) return "search-referrer";
  if (aiHosts.has(host)) return "ai-referrer";
  if (!host || host === "(none)") return "unreported";
  return "other";
}

function counts(row) {
  if (!Number.isSafeInteger(row?.pageviews) || row.pageviews < 0 || !Number.isSafeInteger(row.visitors) || row.visitors < 0) return null;
  return { pageviews: row.pageviews, visitors: row.visitors };
}

function window(end, days, offset = 0) {
  return { since: new Date(end - (days + offset) * DAY).toISOString(), until: new Date(end - offset * DAY - 1).toISOString() };
}

function odataList(items) { return [...items].map(item => `'${item}'`).join(","); }

function scopeConfig(raw) {
  if (!raw || !isAbsolute(raw.cli ?? "") || !/^prj_[a-zA-Z0-9]+$/.test(raw.projectId ?? "")
    || !/^team_[a-zA-Z0-9]+$/.test(raw.teamId ?? "")) throw new Error("invalid configuration");
  return raw;
}

function aggregate(config, bounds, dimensions, deadline, filter = production) {
  const query = new URLSearchParams({ projectId: config.projectId, teamId: config.teamId, ...bounds, limit: "100", filter });
  for (const dimension of dimensions) query.append("by", dimension);
  const remaining = deadline - Date.now();
  if (remaining < 100) throw new Error("query timeout");
  const keep = new Set(["systemroot", "windir", "comspec", "path", "pathext", "userprofile", "appdata", "localappdata",
    "temp", "tmp", "homedrive", "homepath", "home", "programfiles", "programfiles(x86)"]);
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => keep.has(key.toLowerCase()))), CI: "1" };
  const result = execFileSync(process.execPath, [config.cli, "api", `/v1/query/web-analytics/visits/aggregate?${query}`, "--method", "GET", "--raw",
    "--no-color", "--non-interactive"], { env, timeout: Math.min(remaining, 7_000), maxBuffer: 1_000_000, windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" });
  const payload = JSON.parse(result);
  if (!Array.isArray(payload.data) || !Array.isArray(payload.query?.groupBy)
    || dimensions.some(dimension => !payload.query.groupBy.includes(dimension))) throw new Error("invalid aggregate");
  return payload.data;
}

function collect(config) {
  const now = new Date();
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const deadline = now.getTime() + MAX_RUNTIME;
  const periods = { last28: window(end, 28), previous28: window(end, 28, 28), baseline90: window(end, 90) };
  const data = {};
  for (const [name, bounds] of Object.entries(periods)) {
    const totals = aggregate(config, bounds, ["environment"], deadline);
    const rows = aggregate(config, bounds, ["referrerHostname"], deadline);
    const references = [];
    const otherPageviews = {};
    for (const row of rows) {
      const tally = counts(row);
      if (!tally) continue;
      const hostname = typeof row.referrerHostname === "string" ? row.referrerHostname.toLowerCase() : null;
      const category = classify(hostname);
      if (["search-referrer", "ai-referrer"].includes(category)) references.push({ hostname, category, ...tally });
      else otherPageviews[category] = (otherPageviews[category] ?? 0) + tally.pageviews;
    }
    data[name] = { from: bounds.since, through: bounds.until, total: counts(totals.find(row => row.environment === "production")),
      references, otherPageviews };
  }
  const pageFilter = `${production} and referrerHostname in (${odataList(searchHosts)}) and requestPath in (${odataList(trackedPaths)})`;
  const landing = aggregate(config, periods.last28, ["requestPath", "referrerHostname"], deadline, pageFilter);
  const observedPaths = [...new Set(landing.filter(row => counts(row)?.pageviews > 0 && searchHosts.has(row.referrerHostname)
    && trackedPaths.includes(row.requestPath)).map(row => row.requestPath))].sort();
  return {
    schema: 1, source: "Vercel Web Analytics API", environment: "production", collectedAt: now.toISOString(), timezone: "UTC",
    periods: data, searchReferrersOnTrackedPaths: { period: "last28", observedPaths },
    scope: "Aggregate page views, estimated unique visitors and browser referrer hosts. Referrer hosts do not measure search clicks or establish organic attribution. No sales measure.",
  };
}

try {
  const raw = readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, "");
  process.stdout.write(JSON.stringify(collect(scopeConfig(JSON.parse(raw)))));
} catch {
  console.error("Vercel traffic aggregates unavailable");
  process.exitCode = 1;
}
