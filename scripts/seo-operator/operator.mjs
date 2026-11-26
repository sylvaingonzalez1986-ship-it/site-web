import { mkdir, open, readFile, rename, rm, stat, unlink, writeFile, appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { crawl, publicPath } from "./crawl.mjs";
import { authStatus, makeDraft } from "./draft.mjs";

const PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DAY = 86_400_000;
const KINDS = { daily: { minute: 420, timeout: 150_000 }, weekly: { minute: 450, timeout: 115_000 }, monthly: { minute: 480, timeout: 20_000 } };
const FINAL = new Set(["completed", "failed", "missed"]);
const FIXABLE = new Set(["description", "h1", "title", "structured-data"]);
const MAX_ATTEMPTS = 2;
const RECENT_TICK = 28 * 60_000;
const STATE_VERSION = 1;

function parisClock(instant) {
  const parts = Object.fromEntries(PARIS.formatToParts(instant).map(part => [part.type, Number(part.value)]));
  return { date: new Date(Date.UTC(parts.year, parts.month - 1, parts.day)), minute: parts.hour * 60 + parts.minute };
}

function isoDate(date) { return date.toISOString().slice(0, 10); }
function moveDays(date, days) { return new Date(date.getTime() + days * DAY); }

function period(clock, kind, dueOnly = true) {
  const { date, minute } = clock;
  if (kind === "daily") return dueOnly && minute < KINDS.daily.minute ? moveDays(date, -1) : date;
  if (kind === "weekly") {
    const monday = moveDays(date, -((date.getUTCDay() + 6) % 7));
    return dueOnly && monday.getTime() === date.getTime() && minute < KINDS.weekly.minute ? moveDays(monday, -7) : monday;
  }
  const dayOffset = dueOnly && date.getUTCDate() === 1 && minute < KINDS.monthly.minute ? 1 : 0;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - dayOffset, 1));
}

function nextPeriod(date, kind) {
  if (kind === "monthly") return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return moveDays(date, kind === "weekly" ? 7 : 1);
}

function currentState() {
  return { version: STATE_VERSION, initializedAt: new Date().toISOString(), lastTick: null, runs: {}, events: [], cache: {}, daily: null };
}

async function load(path, missing) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return missing;
    throw error;
  }
}

async function atomic(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await file.sync();
  } finally { await file.close(); }
  try { await rename(temporary, path); }
  catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}

async function lock(directory) {
  const lease = join(directory, "run.lock");
  const owner = join(lease, "owner.json");
  for (let count = 0; count < 2; count += 1) {
    try {
      await mkdir(lease);
      await writeFile(owner, JSON.stringify({ pid: process.pid }), { flag: "wx" });
      return () => rm(lease, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const identity = await load(owner, null);
    if (identity && alive(identity.pid)) return null;
    const metadata = await stat(lease).catch(() => null);
    if (!metadata || (!identity && Date.now() - metadata.mtimeMs < 60_000)) return null;
    // Claim the orphan inside its directory, so a competing observer cannot remove a new lease.
    const recovery = join(lease, "recover.lock");
    let claim;
    try { claim = await open(recovery, "wx"); }
    catch (error) {
      if (error.code === "EEXIST" || error.code === "ENOENT") return null;
      throw error;
    }
    await claim.close();
    const latestOwner = await load(owner, null);
    if (latestOwner && alive(latestOwner.pid)) {
      await unlink(recovery);
      return null;
    }
    await rm(lease, { recursive: true, force: true });
  }
  return null;
}

function event(state, type, details = {}) {
  const entry = { at: new Date().toISOString(), type, ...details };
  state.events = [...state.events.slice(-239), entry];
  return entry;
}

function plannedPeriods(state, clock, kind) {
  const latest = period(clock, kind);
  const activated = period(parisClock(new Date(state.initializedAt)), kind, false);
  const first = new Date(Math.max(activated.getTime(), latest.getTime() - 93 * DAY));
  const dates = [];
  // Keep the period aligned for weekly and monthly runs while limiting historic catch-up.
  for (let date = period({ date: first, minute: 1_000 }, kind); date <= latest; date = nextPeriod(date, kind)) {
    if (date >= activated) dates.push(isoDate(date));
  }
  return dates;
}

function missingPeriods(state, clock) {
  return Object.keys(KINDS).flatMap(kind => plannedPeriods(state, clock, kind)
    .filter(slot => !FINAL.has(state.runs[`${kind}:${slot}`]?.status)).map(slot => ({ kind, slot })));
}

function currentMode(mode) { return mode?.mode ?? "active"; }

function compactStatus(state, mode) {
  const current = new Date();
  const latestRuns = Object.fromEntries(Object.keys(KINDS).map(kind => {
    const entries = Object.values(state.runs).filter(item => item.kind === kind).sort((a, b) => b.slot.localeCompare(a.slot));
    return [kind, entries[0] ?? null];
  }));
  return { mode: currentMode(mode), timezone: "Europe/Paris", lastTick: state.lastTick,
    heartbeat: !state.lastTick ? "unobserved" : current - new Date(state.lastTick) > RECENT_TICK ? "late" : "current",
    due: missingPeriods(state, parisClock(current)), latestRuns,
    missedRuns: Object.values(state.runs).filter(run => run.status === "missed").length, recentEvents: state.events.slice(-8) };
}

function validateBacklog(raw) {
  if (!raw || !Array.isArray(raw.candidates) || raw.candidates.length > 50) throw new Error("invalid-backlog");
  const seen = new Set();
  for (const item of raw.candidates) {
    if (!item || !/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(item.id ?? "") || item.id.length > 100 || seen.has(item.id)
      || !publicPath(item.path) || !["technical", "content"].includes(item.kind)
      || !Number.isInteger(item.priority) || item.priority < 0 || item.priority > 99
      || (item.kind === "content" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.publishedAnchor ?? ""))
      || [item.title, item.reason, item.evidence].some(text => typeof text !== "string" || !text.trim() || text.length > 500)) {
      throw new Error("invalid-backlog");
    }
    seen.add(item.id);
  }
  return raw.candidates;
}

function selectWeekly(state, run, candidates) {
  const daily = state.daily;
  if (!daily || Date.now() - new Date(daily.checkedAt).getTime() > 3 * DAY) return [];
  const checked = new Map(daily.pages.map(page => [page.path, page]));
  const observed = daily.pages.filter(page => page.state === "html").flatMap(page => page.signals
    .filter(signal => FIXABLE.has(signal)).map(signal => ({ id: `${signal}:${page.path}`, kind: "technical", path: page.path,
      priority: 100, title: signal, reason: `Contrôle HTML initial : ${signal}`, evidence: daily.checkedAt })));
  const recent = Object.values(state.runs).filter(other => other.id !== run.id && other.kind === "weekly" && other.selection
    && Date.now() - new Date(other.startedAt).getTime() < 28 * DAY);
  const contentThisWeek = recent.some(other => other.slot === run.slot && other.selection.some(item => item.kind === "content"));
  const contentPaths = new Set(recent.flatMap(other => other.selection.filter(item => item.kind === "content").map(item => item.path)));
  const handled = new Set(recent.flatMap(other => other.selection.map(item => item.id)));
  const proposed = new Set(Object.values(state.runs).filter(other => other.id !== run.id && other.kind === "weekly")
    .flatMap(other => (other.selection ?? []).filter(item => item.kind === "content").map(item => item.id)));
  const ready = candidates.filter(item => {
    const page = checked.get(item.path);
    return page?.state === "html" && !page.signals.length && !page.sectionAnchors?.includes(item.publishedAnchor)
      && !proposed.has(item.id);
  });
  const queue = [...observed, ...ready]
    .filter(item => !handled.has(item.id) && (item.kind !== "content" || (!contentThisWeek && !contentPaths.has(item.path))))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const selected = [];
  for (const item of queue) {
    if (selected.length === 2) break;
    if (selected.some(previous => previous.path === item.path || (item.kind === "content" && previous.kind === "content"))) continue;
    const page = checked.get(item.path);
    selected.push({ ...item, checkedAt: daily.checkedAt, status: page.status, signals: page.signals });
  }
  return selected;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && isoDate(date) === value;
}

async function metricsSummary(directory) {
  const path = join(directory, "metrics-summary.json");
  const metadata = await stat(path).catch(() => null);
  const unavailable = { status: "non mesuré", asOf: null, sources: { googleWeb: null, bingWeb: null, organicSales: null }, opportunities: [] };
  if (!metadata?.isFile() || metadata.size > 65_536) return unavailable;
  const report = await load(path, null).catch(() => null);
  if (report?.schema !== 1 || !validDate(report.asOf)) return unavailable;
  const sources = {};
  for (const name of Object.keys(unavailable.sources)) {
    const source = report.sources?.[name];
    sources[name] = null;
    if (!validDate(source?.through) || source.through > report.asOf) continue;
    const totals = name === "organicSales" ? ["orders", "revenueEUR"] : ["clicks", "impressions", "ctr", "position"];
    const periods = {};
    for (const key of ["last28", "previous28", "baseline90"]) {
      const item = source.periods?.[key];
      periods[key] = null;
      if (!validDate(item?.start) || !validDate(item?.end) || item.start > item.end || item.end > source.through
        || totals.some(total => item[total] !== null && (!Number.isFinite(item[total]) || item[total] < 0))
        || (typeof item.ctr === "number" && item.ctr > 1)) continue;
      periods[key] = { start: item.start, end: item.end, ...Object.fromEntries(totals.map(total => [total, item[total]])) };
    }
    sources[name] = { through: source.through, periods };
  }
  const opportunities = [];
  if (Array.isArray(report.opportunities)) {
    for (const item of report.opportunities.slice(0, 6)) {
      if (!item || !publicPath(item.path) || !["googleWeb", "bingWeb"].includes(item.source) || !comparison(sources[item.source])
        || !["rising", "declining"].includes(item.kind) || !Number.isSafeInteger(item.clicksDelta) || !Number.isSafeInteger(item.impressionsDelta)
        || Math.sign(item.clicksDelta) !== (item.kind === "rising" ? 1 : -1) || item.country !== "FR"
        || !["mobile", "desktop", "tablet", "unknown"].includes(item.device) || !["brand", "nonbrand", "unknown"].includes(item.brand)) continue;
      const { path, source, kind, clicksDelta, impressionsDelta, device, brand, country } = item;
      opportunities.push({ path, source, kind, clicksDelta, impressionsDelta, device, brand, country });
    }
  }
  return { status: Object.values(sources).some(source => source && Object.values(source.periods).some(Boolean)) ? "mesuré" : "non mesuré",
    asOf: report.asOf, sources, opportunities };
}

function comparison(source) {
  const current = source?.periods.last28;
  const previous = source?.periods.previous28;
  if (!current || !previous) return null;
  const [start, end, previousStart, previousEnd] = [current.start, current.end, previous.start, previous.end]
    .map(date => Date.parse(`${date}T00:00:00Z`));
  if (end - start !== 27 * DAY || previousEnd - previousStart !== 27 * DAY || start - previousEnd !== DAY) return null;
  const deltas = {};
  for (const key of Object.keys(current).filter(key => key !== "start" && key !== "end")) {
    const change = current[key] === null || previous[key] === null ? null : current[key] - previous[key];
    const name = key === "ctr" ? "ctrPercentagePoints" : key;
    deltas[name] = change === null ? null : Math.round(change * (key === "ctr" ? 100 : 1) * 1_000) / 1_000;
  }
  return { current: { start: current.start, end: current.end }, previous: { start: previous.start, end: previous.end }, deltas };
}

async function daily(state, signal) {
  const checkedAt = new Date().toISOString();
  const { summary, pages, cache } = await crawl({ previous: state.cache, signal });
  const report = { checkedAt, summary, pages };
  if (summary.robotsStatus !== 200 || summary.sitemapStatus !== 200) return { result: "public-endpoints-unavailable", report, retry: true };
  state.cache = cache;
  state.daily = report;
  return { result: "measured", report };
}

async function weekly(state, run, configuration, save, signal) {
  const candidates = configuration.backlog ? validateBacklog(await load(configuration.backlog, null)) : [];
  if (!run.selection) {
    run.selection = selectWeekly(state, run, candidates);
    await save();
  }
  const selection = run.selection;
  const report = { selection, metrics: await metricsSummary(configuration.directory) };
  if (!selection.length) return { result: "no-eligible-lot", report };
  if (!configuration.codex) return { result: "selected", report: { ...report, draft: "disabled" } };
  if (run.draftReserved) return { result: "selected", report: { ...report, draft: "already-attempted" } };
  if (!await authStatus(configuration.codex, configuration.directory, signal)) {
    return { result: "selected", report: { ...report, draft: "chatgpt-session-unavailable" } };
  }
  const working = join(configuration.directory, "drafts", run.slot);
  await mkdir(working, { recursive: true });
  run.draftReserved = true;
  await save();
  const draft = await makeDraft(configuration.codex, working, selection, signal);
  return { result: "selected", report: { ...report, draft: draft ?? "draft-unavailable" } };
}

async function monthly(state, run, configuration) {
  const start = new Date(`${run.slot}T00:00:00Z`);
  const previous = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  const series = Object.values(state.runs).filter(item => item.slot >= isoDate(previous) && item.slot < run.slot);
  const runs = Object.fromEntries(Object.keys(KINDS).map(kind => [kind, {
    completed: series.filter(item => item.kind === kind && item.status === "completed").length,
    failed: series.filter(item => item.kind === kind && item.status === "failed").length,
    missed: series.filter(item => item.kind === kind && item.status === "missed").length,
  }]));
  const metrics = await metricsSummary(configuration.directory);
  const comparisons28 = Object.fromEntries(Object.entries(metrics.sources).map(([name, source]) => [name, comparison(source)]));
  const protection = comparisons28.googleWeb || comparisons28.bingWeb ? "Relire les pages signalées avant de modifier les entrées organiques."
    : "Conserver les URL, titres, canoniques et liens principaux des pages d’entrée en attendant les mesures par page.";
  const observation = state.daily;
  const technical = observation ? { checkedAt: observation.checkedAt, summary: observation.summary, sampled: observation.pages.length,
    pages: observation.pages.filter(page => page.signals.length).map(page => ({ path: page.path, signals: page.signals })) } : null;
  const strategy = {
    status: metrics.status,
    reviewDue: { date: isoDate(nextPeriod(start, "monthly")), time: "08:00", timezone: "Europe/Paris" },
    comparisons28,
    opportunities: metrics.opportunities,
    technical,
    protection,
    protectedPaths: ["/", "/boutique", "/boutique/fleurs-cbd", "/cbd-breton", "/cbd-naturel", "/analyse-laboratoire-cbd"],
    aiPanel: { status: "non observé", country: "FR", language: "fr", surfaces: ["Bing", "Brave Search", "ChatGPT avec recherche", "Perplexity"], questions: [
      { query: "CBD breton", question: "Quel producteur breton et quelle preuve de provenance sont cités ?" },
      { query: "CBD Bretagne", question: "Quelles pages locales sont affichées ou citées ?" },
      { query: "CBD naturel", question: "Quels critères, unités et liens vers une preuve sont repris ?" },
      { query: "CBD français", question: "La production locale et la revente sont-elles distinguées ?" },
      { query: "CBD producteur", question: "Quelles pages distinguent la ferme des partenaires ?" },
      { query: "vente directe producteur", question: "Quel site et quelle page soutiennent la vente directe ?" },
    ] },
  };
  return { result: "summarized", report: { start: isoDate(previous), endExclusive: run.slot, runs,
    lastTechnicalObservation: state.daily?.checkedAt ?? null,
    metrics, strategy, coreWebVitals: "non mesuré" } };
}

const SOURCE_NAMES = { googleWeb: "Search Console", bingWeb: "Bing Webmaster Tools", organicSales: "Ventes organiques" };

function displayedReport(kind, report) {
  if (!report) return "Aucun rapport pour cette cadence.";
  const slot = report.id.split(":")[1];
  if (kind === "daily") {
    const notable = report.pages.filter(page => page.signals.length);
    return [`SEO quotidien du ${slot}`, `Robots HTTP ${report.summary.robotsStatus} · Sitemap HTTP ${report.summary.sitemapStatus}`,
      `${report.pages.length} URL dans le relevé, ${notable.length} signalées.`,
      ...notable.map(page => `- ${page.path} · ${page.signals.join(", ")}`)].join("\n");
  }
  if (kind === "weekly") {
    const lines = [`SEO de la semaine du ${slot}`, report.selection.length ? `${report.selection.length} lot(s) retenu(s).` : "Aucun lot éligible."];
    for (const item of report.selection) lines.push(`- ${item.title} (${item.path})`, `  ${item.reason}`);
    if (report.draft && typeof report.draft === "object") lines.push(`Brouillon de recette · ${report.draft.proposedChange}`);
    else if (report.selection.length) lines.push("Brouillon de recette indisponible.");
    const available = Object.entries(report.metrics?.sources ?? {}).filter(([, value]) => value?.periods.last28).map(([name]) => SOURCE_NAMES[name]);
    lines.push(available.length ? `Mesures sur 28 jours · ${available.join(", ")}.` : "Mesures organiques sur 28 jours indisponibles.");
    return lines.join("\n");
  }
  const lines = [`Bilan SEO de ${report.start} au ${isoDate(moveDays(new Date(`${report.endExclusive}T00:00:00Z`), -1))}`];
  const strategy = report.strategy;
  if (!strategy) return [...lines, `Mesures · ${report.metrics?.status ?? "non mesuré"}.`].join("\n");
  for (const [name, changes] of Object.entries(strategy.comparisons28)) {
    if (!changes) {
      lines.push(`${SOURCE_NAMES[name]} · comparaison sur 28 jours indisponible.`);
      continue;
    }
    const labels = { clicks: "clics", impressions: "impressions", ctrPercentagePoints: "points de CTR", position: "positions",
      orders: "commandes", revenueEUR: "€ de chiffre d’affaires" };
    const totals = Object.entries(changes.deltas).filter(([, value]) => value !== null)
      .map(([key, value]) => `${value > 0 ? "+" : ""}${value} ${labels[key]}`);
    lines.push(`${SOURCE_NAMES[name]} · ${totals.join(", ") || "deltas indisponibles"} (${changes.current.start} au ${changes.current.end}).`);
  }
  lines.push(...strategy.opportunities.map(item => `- ${item.path} · ${item.clicksDelta > 0 ? "+" : ""}${item.clicksDelta} clics · ${SOURCE_NAMES[item.source]}, ${item.country}, ${item.device}, ${item.brand}.`));
  if (strategy.technical) lines.push(`Relevé public · ${strategy.technical.sampled} URL, ${strategy.technical.pages.length} signalées.`);
  lines.push(strategy.protection, `Panel IA ${strategy.aiPanel.status}. Les questions figurent dans le rapport JSON.`,
    `Prochaine revue le ${strategy.reviewDue.date} à ${strategy.reviewDue.time}, heure de Paris.`);
  return lines.join("\n");
}

async function execute(kind, slot, state, configuration, save, log) {
  const id = `${kind}:${slot}`;
  const run = state.runs[id] ?? { id, kind, slot, attempts: 0 };
  if (FINAL.has(run.status)) return run;
  state.runs[id] = run;
  while (run.attempts < MAX_ATTEMPTS) {
    if (currentMode(await load(configuration.modePath, null)) !== "active") return run;
    run.attempts += 1;
    run.startedAt ??= new Date().toISOString();
    run.status = "running";
    await log("attempt-started", { id, attempt: run.attempts });
    const cancellation = new AbortController();
    const signal = AbortSignal.any([AbortSignal.timeout(KINDS[kind].timeout), cancellation.signal]);
    const stopWatch = setInterval(async () => {
      const mode = await load(configuration.modePath, null).catch(() => null);
      if (currentMode(mode) === "stopped") cancellation.abort();
    }, 1_000);
    stopWatch.unref();
    let outcome;
    try {
      if (kind === "daily") outcome = await daily(state, signal);
      else if (kind === "weekly") outcome = await weekly(state, run, configuration, save, signal);
      else outcome = await monthly(state, run, configuration);
    } catch (error) {
      const result = signal.aborted ? "run-timeout" : error.message === "invalid-backlog" ? "invalid-backlog" : "operation-failed";
      outcome = { result, retry: true };
    } finally { clearInterval(stopWatch); }
    if (cancellation.signal.aborted) outcome = { result: "stopped", retry: true };
    run.result = outcome.result;
    const reportName = `${kind}-${slot}.json`;
    if (outcome.report) {
      await atomic(join(configuration.directory, "reports", reportName), { id, attempt: run.attempts, ...outcome.report });
      run.report = reportName;
    }
    if (!outcome.retry) {
      run.status = "completed";
      run.endedAt = new Date().toISOString();
      await log("completed", { id, result: run.result });
      return run;
    }
    run.status = "retry";
    await log("attempt-failed", { id, attempt: run.attempts, result: run.result });
  }
  run.status = "failed";
  run.endedAt = new Date().toISOString();
  await log("failed", { id, result: run.result ?? "interrupted" });
  return run;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    "state-dir": { type: "string", default: resolve("output/seo-operator") },
    backlog: { type: "string" }, "codex-exe": { type: "string" }, json: { type: "boolean" },
  } });
  const [command, kind, extra] = positionals;
  if (!command || extra || (["run", "report"].includes(command) ? !Object.hasOwn(KINDS, kind) : kind !== undefined)
    || (values.backlog && !isAbsolute(values.backlog)) || (values["codex-exe"] && !isAbsolute(values["codex-exe"]))) {
    throw new Error("invalid-command");
  }
  const directory = resolve(values["state-dir"]);
  const statePath = join(directory, "state.json");
  const modePath = join(directory, "mode.json");
  await mkdir(directory, { recursive: true });
  const mode = await load(modePath, null);
  if (["pause", "resume", "stop", "start"].includes(command)) {
    if (command === "resume" && currentMode(mode) === "stopped") throw new Error("use-start-after-stop");
    const next = { mode: { pause: "paused", stop: "stopped", start: "active", resume: "active" }[command], at: new Date().toISOString() };
    await atomic(modePath, next);
    console.log(JSON.stringify(next));
    return;
  }
  if (command === "status") {
    console.log(JSON.stringify(compactStatus(await load(statePath, currentState()), mode), null, 2));
    return;
  }
  if (command === "report") {
    const state = await load(statePath, currentState());
    const result = Object.values(state.runs).filter(item => item.kind === kind && validDate(item.slot) && item.report)
      .sort((a, b) => b.slot.localeCompare(a.slot))[0];
    const report = result ? await load(join(directory, "reports", `${kind}-${result.slot}.json`), null) : null;
    console.log(values.json ? JSON.stringify(report, null, 2) : displayedReport(kind, report));
    return;
  }
  if (!['tick', 'run'].includes(command)) throw new Error("invalid-command");
  const release = await lock(directory);
  if (!release) {
    console.log(JSON.stringify({ result: "already-running" }));
    return;
  }
  try {
    const state = await load(statePath, currentState());
    if (state.version !== STATE_VERSION) throw new Error("unsupported-state-version");
    await mkdir(join(directory, "reports"), { recursive: true });
    const save = () => atomic(statePath, state);
    const log = async (type, details) => {
      const entry = event(state, type, details);
      await save();
      await appendFile(join(directory, "events.ndjson"), `${JSON.stringify(entry)}\n`, { mode: 0o600 });
    };
    const started = new Date();
    const clock = parisClock(started);
    if (command === "tick") state.lastTick = started.toISOString();
    await save();
    if (currentMode(mode) !== "active") {
      console.log(JSON.stringify({ mode: currentMode(mode), lastTick: state.lastTick }));
      return;
    }
    const configuration = { directory, modePath, backlog: values.backlog, codex: values["codex-exe"] };
    const outcomes = [];
    if (command === "run") {
      outcomes.push(await execute(kind, isoDate(period(clock, kind, false)), state, configuration, save, log));
    } else {
      for (const [cadence] of Object.entries(KINDS)) {
        const dates = plannedPeriods(state, clock, cadence);
        for (const slot of dates.slice(0, -1)) {
          const id = `${cadence}:${slot}`;
          if (!FINAL.has(state.runs[id]?.status)) {
            state.runs[id] = { ...state.runs[id], id, kind: cadence, slot, status: "missed", endedAt: new Date().toISOString() };
            await log("missed", { id });
          }
        }
        if (dates.length) {
          const slot = dates.at(-1);
          if (state.runs[`${cadence}:${slot}`]?.status !== "completed") {
            outcomes.push(await execute(cadence, slot, state, configuration, save, log));
          }
        }
      }
    }
    console.log(JSON.stringify({ lastTick: state.lastTick, runs: outcomes }));
    if (outcomes.some(item => item.status === "failed")) process.exitCode = 1;
  } finally { await release(); }
}

main().catch(error => {
  const known = ["invalid-command", "use-start-after-stop", "unsupported-state-version"];
  console.error(JSON.stringify({ result: known.includes(error.message) ? error.message : "operator-failed" }));
  process.exitCode = 1;
});
