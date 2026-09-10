import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const baseUrl = (process.env.PLACARD_LOAD_TEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const workspaceRoot = resolve(process.cwd());
const reportDirectory = resolve(
  workspaceRoot,
  String(process.env.PLACARD_LOAD_TEST_REPORT_DIR || "output/placard-load-tests").trim(),
);
const reportDirectoryFromRoot = relative(workspaceRoot, reportDirectory);
if (
  !reportDirectoryFromRoot
  || reportDirectoryFromRoot === ".."
  || reportDirectoryFromRoot.startsWith(`..${sep}`)
  || isAbsolute(reportDirectoryFromRoot)
) {
  throw new Error("PLACARD_LOAD_TEST_REPORT_DIR doit designer un sous-dossier du projet.");
}
const participants = Math.max(1, Number(process.env.PLACARD_LOAD_TEST_PARTICIPANTS || 100));
const rampMs = Math.max(0, Number(process.env.PLACARD_LOAD_TEST_RAMP_MS || 15000));
const timeoutMs = Math.max(1000, Number(process.env.PLACARD_LOAD_TEST_TIMEOUT_MS || 10000));
const pageP95BudgetMs = Math.max(100, Number(process.env.PLACARD_LOAD_TEST_PAGE_P95_MS || 2500));
const apiP95BudgetMs = Math.max(100, Number(process.env.PLACARD_LOAD_TEST_API_P95_MS || 1200));
const maxErrorRate = Math.min(1, Math.max(0, Number(process.env.PLACARD_LOAD_TEST_MAX_ERROR_RATE || 0.01)));
const cookieValues = String(process.env.PLACARD_LOAD_TEST_COOKIES || "")
  .split(/\r?\n|\|\|/)
  .map((value) => value.trim())
  .filter(Boolean);
const legacyCookie = String(process.env.PLACARD_LOAD_TEST_COOKIE || "").trim();
const cookies = cookieValues.length > 0 ? cookieValues : legacyCookie ? [legacyCookie] : [];
const uniqueCookies = [...new Set(cookies)];
delete process.env.PLACARD_LOAD_TEST_COOKIES;
delete process.env.PLACARD_LOAD_TEST_COOKIE;
const requestedMinimumAccounts = Number(process.env.PLACARD_LOAD_TEST_MIN_ACCOUNTS || 2);
const minimumAccounts = Number.isInteger(requestedMinimumAccounts) && requestedMinimumAccounts > 0
  ? requestedMinimumAccounts
  : 2;
const allowRemote = process.env.PLACARD_LOAD_TEST_ALLOW_REMOTE === "1";
const remoteConfirmation = process.env.PLACARD_LOAD_TEST_CONFIRM_TARGET === "STAGING_READ_ONLY";
const allowedRemoteHost = String(process.env.PLACARD_LOAD_TEST_ALLOWED_HOST || "").trim().toLowerCase();
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl);

if (!isLocal) {
  const targetHost = new URL(baseUrl).host.toLowerCase();
  if (!allowRemote || !remoteConfirmation || !allowedRemoteHost || targetHost !== allowedRemoteHost) {
    throw new Error(
      "Cible distante refusée. Une recette distante exige ALLOW_REMOTE=1, " +
      "CONFIRM_TARGET=STAGING_READ_ONLY et un PLACARD_LOAD_TEST_ALLOWED_HOST identique.",
    );
  }
}
if (uniqueCookies.length < minimumAccounts) {
  throw new Error(
    `Le test de charge exige ${minimumAccounts} comptes authentifiés distincts. ` +
    "Renseignez PLACARD_LOAD_TEST_COOKIES avec des cookies séparés par ||.",
  );
}

const paths = [
  "/arene/placard",
  "/api/arena/placard/bootstrap",
  "/api/arena/placard/rankings",
  "/api/arena/placard/flowers",
  "/api/arena/placard/battles",
  "/api/arena/placard/equipment",
  "/api/arena/placard/market",
];

async function preflightAccount(cookie, index) {
  const headers = { cookie, "user-agent": "placard-read-load-preflight/2.0" };
  const [pageResponse, bootstrapResponse] = await Promise.all([
    fetch(`${baseUrl}/arene/placard`, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { ...headers, accept: "text/html" },
    }),
    fetch(`${baseUrl}/api/arena/placard/bootstrap`, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { ...headers, accept: "application/json" },
    }),
  ]);
  if (pageResponse.status !== 200 || bootstrapResponse.status !== 200) {
    throw new Error(
      `Préflight du compte ${index + 1} refusé : page HTTP ${pageResponse.status}, ` +
      `bootstrap HTTP ${bootstrapResponse.status}.`,
    );
  }
  return { pageStatus: pageResponse.status, bootstrapStatus: bootstrapResponse.status };
}

const accountPreflights = await Promise.all(uniqueCookies.map(preflightAccount));

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function parseServerTiming(value) {
  if (!value) return {};
  return Object.fromEntries(value.split(",").flatMap((entry) => {
    const [rawName, ...parameters] = entry.trim().split(";");
    const durationParameter = parameters.find((parameter) => parameter.trim().startsWith("dur="));
    const duration = durationParameter ? Number(durationParameter.trim().slice(4)) : Number.NaN;
    return rawName && Number.isFinite(duration) ? [[rawName, duration]] : [];
  }));
}

async function request(path, cookie) {
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
    const headersAt = performance.now();
    const body = await response.arrayBuffer();
    return {
      duration: performance.now() - startedAt,
      ttfb: headersAt - startedAt,
      bytes: body.byteLength,
      ok: response.status === 200,
      status: response.status,
      path,
      serverTiming: parseServerTiming(response.headers.get("server-timing")),
    };
  } catch (error) {
    return { duration: performance.now() - startedAt, ok: false, status: 0, path, error: String(error) };
  }
}

const startedAt = Date.now();
const jobs = Array.from({ length: participants }, (_, index) => new Promise((resolve) => {
  const delay = participants === 1 ? 0 : Math.floor((index / (participants - 1)) * rampMs);
  setTimeout(async () => {
    const participantCookie = uniqueCookies[index % uniqueCookies.length];
    resolve(await Promise.all(paths.map((path) => request(path, participantCookie))));
  }, delay);
}));

const results = (await Promise.all(jobs)).flat();
const failures = results.filter((result) => !result.ok);
const byPath = Object.fromEntries(paths.map((path) => {
  const rows = results.filter((result) => result.path === path);
  const durations = rows.map((result) => result.duration);
  const ttfb = rows.map((result) => result.ttfb).filter(Number.isFinite);
  const p95 = Math.round(percentile(durations, 0.95));
  const budgetP95 = path === "/arene/placard" ? pageP95BudgetMs : apiP95BudgetMs;
  const errors = rows.filter((result) => !result.ok).length;
  const timingNames = [...new Set(rows.flatMap((result) => Object.keys(result.serverTiming ?? {})))];
  const serverTimingMs = Object.fromEntries(timingNames.map((name) => {
    const values = rows.map((result) => result.serverTiming?.[name]).filter(Number.isFinite);
    return [name, {
      samples: values.length,
      p50: Math.round(percentile(values, 0.5)),
      p95: Math.round(percentile(values, 0.95)),
    }];
  }));
  return [path, {
    requests: rows.length,
    errors,
    errorRate: Number((errors / rows.length).toFixed(4)),
    p50: Math.round(percentile(durations, 0.5)),
    p95,
    p99: Math.round(percentile(durations, 0.99)),
    ttfbP50: Math.round(percentile(ttfb, 0.5)),
    ttfbP95: Math.round(percentile(ttfb, 0.95)),
    transferredBytes: rows.reduce((sum, result) => sum + Number(result.bytes ?? 0), 0),
    serverTimingMs,
    budgetP95,
    withinBudget: errors / rows.length <= maxErrorRate && p95 <= budgetP95,
  }];
}));
const allDurations = results.map((result) => result.duration);
const durationSeconds = Math.max(0.001, (Date.now() - startedAt) / 1000);
const authenticatedAccounts = uniqueCookies.length;
const failedPaths = Object.entries(byPath)
  .filter(([, metrics]) => !metrics.withinBudget)
  .map(([path]) => path);
const errorRate = Number((failures.length / results.length).toFixed(4));
const passed = errorRate <= maxErrorRate && failedPaths.length === 0;
const generatedAt = new Date().toISOString();
const reportFileName = `placard-load-${generatedAt.replace(/[:.]/g, "-")}.json`;
const reportPath = resolve(reportDirectory, reportFileName);
const artifactPath = relative(workspaceRoot, reportPath).split(sep).join("/");
const summary = {
  schema: "kanab-quest-load-test-v2",
  generatedAt,
  artifactPath,
  mode: "read-only",
  baseUrl,
  participants,
  authenticatedAccounts,
  accountPreflights,
  sessionModel: authenticatedAccounts >= participants ? "one-account-per-participant" : "accounts-reused",
  requests: results.length,
  durationSeconds: Number(durationSeconds.toFixed(1)),
  requestsPerSecond: Number((results.length / durationSeconds).toFixed(2)),
  errors: failures.length,
  errorRate,
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
  failedPaths,
  passed,
};

await mkdir(reportDirectory, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) {
  console.error(`Budget Placard dépassé : ${failedPaths.join(", ") || "taux d’erreur global"}.`);
  process.exitCode = 1;
}
