const baseUrl = (process.env.PLACARD_LOAD_TEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const participants = Math.max(1, Number(process.env.PLACARD_LOAD_TEST_PARTICIPANTS || 25));
const rampMs = Math.max(0, Number(process.env.PLACARD_LOAD_TEST_RAMP_MS || 15000));
const timeoutMs = Math.max(1000, Number(process.env.PLACARD_LOAD_TEST_TIMEOUT_MS || 10000));
const pageP95BudgetMs = Math.max(100, Number(process.env.PLACARD_LOAD_TEST_PAGE_P95_MS || 2500));
const apiP95BudgetMs = Math.max(100, Number(process.env.PLACARD_LOAD_TEST_API_P95_MS || 1200));
const maxErrorRate = Math.min(1, Math.max(0, Number(process.env.PLACARD_LOAD_TEST_MAX_ERROR_RATE || 0.01)));
const cookie = String(process.env.PLACARD_LOAD_TEST_COOKIE || "").trim();
const allowRemote = process.env.PLACARD_LOAD_TEST_ALLOW_REMOTE === "1";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl);

if (!isLocal && !allowRemote) {
  throw new Error("Cible distante refusée. Utilise PLACARD_LOAD_TEST_ALLOW_REMOTE=1 uniquement sur un environnement de recette.");
}
if (!cookie) {
  throw new Error("PLACARD_LOAD_TEST_COOKIE est requis pour simuler un client de recette authentifié.");
}

const paths = [
  "/arene/placard",
  "/api/arena/placard/bootstrap",
  "/api/arena/placard/session",
  "/api/arena/placard/rankings",
];

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function request(path) {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: path === "/arene/placard" ? "text/html" : "application/json",
        cookie,
        "user-agent": "placard-read-load-test/1.0",
      },
    });
    await response.arrayBuffer();
    return {
      duration: performance.now() - startedAt,
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      path,
    };
  } catch (error) {
    return { duration: performance.now() - startedAt, ok: false, status: 0, path, error: String(error) };
  }
}

const startedAt = Date.now();
const jobs = Array.from({ length: participants }, (_, index) => new Promise((resolve) => {
  const delay = participants === 1 ? 0 : Math.floor((index / (participants - 1)) * rampMs);
  setTimeout(async () => {
    resolve(await Promise.all(paths.map(request)));
  }, delay);
}));

const results = (await Promise.all(jobs)).flat();
const failures = results.filter((result) => !result.ok);
const byPath = Object.fromEntries(paths.map((path) => {
  const rows = results.filter((result) => result.path === path);
  const durations = rows.map((result) => result.duration);
  const p95 = Math.round(percentile(durations, 0.95));
  const budgetP95 = path === "/arene/placard" ? pageP95BudgetMs : apiP95BudgetMs;
  const errors = rows.filter((result) => !result.ok).length;
  return [path, {
    requests: rows.length,
    errors,
    errorRate: Number((errors / rows.length).toFixed(4)),
    p50: Math.round(percentile(durations, 0.5)),
    p95,
    p99: Math.round(percentile(durations, 0.99)),
    budgetP95,
    withinBudget: errors / rows.length <= maxErrorRate && p95 <= budgetP95,
  }];
}));
const allDurations = results.map((result) => result.duration);
const summary = {
  mode: "read-only",
  baseUrl,
  participants,
  requests: results.length,
  durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
  errors: failures.length,
  errorRate: Number((failures.length / results.length).toFixed(4)),
  budgets: {
    maxErrorRate,
    pageP95Ms: pageP95BudgetMs,
    apiP95Ms: apiP95BudgetMs,
  },
  latencyMs: {
    p50: Math.round(percentile(allDurations, 0.5)),
    p95: Math.round(percentile(allDurations, 0.95)),
    p99: Math.round(percentile(allDurations, 0.99)),
  },
  statuses: Object.fromEntries([...new Set(results.map((result) => result.status))]
    .map((status) => [status, results.filter((result) => result.status === status).length])),
  byPath,
};

console.log(JSON.stringify(summary, null, 2));
const failedPaths = Object.entries(byPath)
  .filter(([, metrics]) => !metrics.withinBudget)
  .map(([path]) => path);
if (summary.errorRate > maxErrorRate || failedPaths.length > 0) {
  console.error(`Budget Placard dépassé : ${failedPaths.join(", ") || "taux d’erreur global"}.`);
  process.exitCode = 1;
}
