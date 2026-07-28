import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

const baseUrl = (process.env.PLACARD_MOBILE_AUDIT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const cookie = String(process.env.PLACARD_MOBILE_AUDIT_COOKIE || "").trim();
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl);
const minimumPerformance = Number(process.env.PLACARD_MOBILE_MIN_PERFORMANCE || 0.75);
const minimumAccessibility = Number(process.env.PLACARD_MOBILE_MIN_ACCESSIBILITY || 0.9);
const maximumLcpMs = Number(process.env.PLACARD_MOBILE_MAX_LCP_MS || 4000);
const maximumCls = Number(process.env.PLACARD_MOBILE_MAX_CLS || 0.1);
const maximumBytes = Number(process.env.PLACARD_MOBILE_MAX_BYTES || 2_000_000);

if (!isLocal) throw new Error("L’audit mobile Placard refuse toujours les cibles distantes.");
if (!cookie) throw new Error("PLACARD_MOBILE_AUDIT_COOKIE est requis pour le compte de recette local.");

const chrome = await launch({ chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"] });
try {
  const result = await lighthouse(`${baseUrl}/arene/placard`, {
    port: chrome.port,
    output: "json",
    logLevel: "error",
    extraHeaders: { Cookie: cookie },
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      disabled: false,
    },
    throttlingMethod: "simulate",
  });
  if (!result) throw new Error("Lighthouse n’a produit aucun rapport.");

  const { lhr } = result;
  const performance = lhr.categories.performance?.score ?? 0;
  const accessibility = lhr.categories.accessibility?.score ?? 0;
  const lcpMs = lhr.audits["largest-contentful-paint"]?.numericValue ?? Number.POSITIVE_INFINITY;
  const cls = lhr.audits["cumulative-layout-shift"]?.numericValue ?? Number.POSITIVE_INFINITY;
  const totalBytes = lhr.audits["total-byte-weight"]?.numericValue ?? Number.POSITIVE_INFINITY;
  const checks = {
    performance: performance >= minimumPerformance,
    accessibility: accessibility >= minimumAccessibility,
    lcp: lcpMs <= maximumLcpMs,
    cls: cls <= maximumCls,
    pageWeight: totalBytes <= maximumBytes,
  };
  const summary = {
    mode: "local-mobile",
    viewport: "390x844@3",
    scores: {
      performance: Math.round(performance * 100),
      accessibility: Math.round(accessibility * 100),
    },
    metrics: {
      lcpMs: Math.round(lcpMs),
      cls: Number(cls.toFixed(3)),
      totalBytes: Math.round(totalBytes),
    },
    budgets: {
      minimumPerformance: Math.round(minimumPerformance * 100),
      minimumAccessibility: Math.round(minimumAccessibility * 100),
      maximumLcpMs,
      maximumCls,
      maximumBytes,
    },
    checks,
    passed: Object.values(checks).every(Boolean),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.passed) process.exitCode = 1;
} finally {
  await chrome.kill();
}
