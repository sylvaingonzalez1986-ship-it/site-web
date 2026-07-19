const baseUrl = (process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const participants = Math.max(1, Number(process.env.LOAD_TEST_PARTICIPANTS || 500));
const rampMs = Math.max(0, Number(process.env.LOAD_TEST_RAMP_MS || 120000));
const timeoutMs = Math.max(1000, Number(process.env.LOAD_TEST_TIMEOUT_MS || 10000));
const paths = ["/arene", "/api/contest/seasons", "/api/contest/entries", "/api/contest/rankings?limit=12", "/api/contest/feed?limit=18"];

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
      headers: { accept: path === "/arene" ? "text/html" : "application/json", "user-agent": "arena-load-test/1.0" },
    });
    await response.arrayBuffer();
    return { duration: performance.now() - startedAt, ok: response.status < 500, status: response.status, path };
  } catch (error) {
    return { duration: performance.now() - startedAt, ok: false, status: 0, path, error: String(error) };
  }
}

const startedAt = Date.now();
const jobs = Array.from({ length: participants }, (_, index) => new Promise((resolve) => {
  const delay = participants === 1 ? 0 : Math.floor((index / (participants - 1)) * rampMs);
  setTimeout(async () => {
    const results = [];
    for (const path of paths) results.push(await request(path));
    resolve(results);
  }, delay);
}));

const results = (await Promise.all(jobs)).flat();
const durations = results.map((result) => result.duration);
const failures = results.filter((result) => !result.ok);
const summary = {
  baseUrl,
  participants,
  requests: results.length,
  durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
  errors: failures.length,
  errorRate: Number((failures.length / results.length).toFixed(4)),
  latencyMs: {
    p50: Math.round(percentile(durations, 0.5)),
    p95: Math.round(percentile(durations, 0.95)),
    p99: Math.round(percentile(durations, 0.99)),
    max: Math.round(Math.max(...durations)),
  },
  statuses: Object.fromEntries([...new Set(results.map((result) => result.status))].map((status) => [status, results.filter((result) => result.status === status).length])),
};

console.log(JSON.stringify(summary, null, 2));
if (summary.errorRate > 0.01 || summary.latencyMs.p95 > 2500) process.exitCode = 1;
