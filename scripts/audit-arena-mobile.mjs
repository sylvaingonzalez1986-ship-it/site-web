import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const baseUrl = (process.env.ARENA_MOBILE_AUDIT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const cookie = String(process.env.ARENA_MOBILE_AUDIT_COOKIE || "").trim();
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl)) throw new Error("L’audit Arène refuse les cibles distantes.");
if (!cookie) throw new Error("ARENA_MOBILE_AUDIT_COOKIE est requis.");

const ageResponse = await fetch(`${baseUrl}/api/age-gate/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirmed: true }),
});
if (!ageResponse.ok) throw new Error("La validation d’âge locale de l’audit a échoué.");
const ageCookie = ageResponse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
if (!ageCookie) throw new Error("Le cookie d’âge local de l’audit est absent.");
const auditCookies = `${cookie}; ${ageCookie}`.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
  const separator = part.indexOf("=");
  return { name: part.slice(0, separator), value: part.slice(separator + 1) };
}).filter((entry) => entry.name && entry.value);

const requestedView = String(process.env.ARENA_MOBILE_AUDIT_VIEW || "").trim();
const allPages = [
  ["jouer", "/arene"],
  ["carnet", "/arene?vue=carnet"],
  ["classement", "/arene?vue=classement"],
];
const pages = requestedView ? allPages.filter(([view]) => view === requestedView) : allPages;
if (pages.length === 0) throw new Error("ARENA_MOBILE_AUDIT_VIEW doit valoir jouer, carnet ou classement.");
const minimumPerformance = Number(process.env.ARENA_MOBILE_MIN_PERFORMANCE || 0.75);
const minimumAccessibility = Number(process.env.ARENA_MOBILE_MIN_ACCESSIBILITY || 0.9);
const maximumLcpMs = Number(process.env.ARENA_MOBILE_MAX_LCP_MS || 4000);
const maximumCls = Number(process.env.ARENA_MOBILE_MAX_CLS || 0.1);
const maximumBytes = Number(process.env.ARENA_MOBILE_MAX_BYTES || 2_000_000);

const chrome = await launch({ chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"] });
try {
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  for (const entry of auditCookies) {
    await cdp.send("Network.setCookie", { ...entry, url: baseUrl });
  }
  for (const [view, path] of pages) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    const finalPath = new URL(page.url()).pathname;
    if (finalPath !== "/arene") {
      throw new Error(
        `Audit ${view} invalide : la navigation a abouti sur ${finalPath}. ` +
        "Fournissez dans ARENA_MOBILE_AUDIT_COOKIE la session d'un compte autorise a acceder a la beta.",
      );
    }
    const consentDialogVisible = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      return dialog?.textContent?.toLowerCase().includes("cookies") === true;
    });
    if (consentDialogVisible) {
      throw new Error(
        `Audit ${view} invalide : la modale de consentement est encore affichee. ` +
        "Fournissez un cookie lcb_cookie_consent valide dans ARENA_MOBILE_AUDIT_COOKIE.",
      );
    }
  }
  await page.close();
  await browser.disconnect();

  const summaries = [];
  for (const [view, path] of pages) {
    const result = await lighthouse(`${baseUrl}${path}`, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3, disabled: false },
      throttlingMethod: "simulate",
    });
    if (!result) throw new Error(`Aucun rapport Lighthouse pour ${view}.`);
    const { lhr } = result;
    const finalUrl = new URL(lhr.finalDisplayedUrl || lhr.finalUrl || `${baseUrl}${path}`);
    if (finalUrl.pathname !== "/arene") {
      throw new Error(
        `Audit ${view} invalide : la navigation a abouti sur ${finalUrl.pathname}. ` +
        "Fournissez dans ARENA_MOBILE_AUDIT_COOKIE la session d'un compte autorise a acceder a la beta.",
      );
    }
    const performance = lhr.categories.performance?.score ?? 0;
    const accessibility = lhr.categories.accessibility?.score ?? 0;
    const lcpMs = lhr.audits["largest-contentful-paint"]?.numericValue ?? Infinity;
    const fcpMs = lhr.audits["first-contentful-paint"]?.numericValue ?? Infinity;
    const tbtMs = lhr.audits["total-blocking-time"]?.numericValue ?? Infinity;
    const serverResponseMs = lhr.audits["server-response-time"]?.numericValue ?? Infinity;
    const lcpInsightItems = lhr.audits["lcp-breakdown-insight"]?.details?.items ?? [];
    const lcpElement = lhr.audits["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.selector
      ?? lhr.audits["largest-contentful-paint-element"]?.details?.items?.[0]?.node?.selector
      ?? lcpInsightItems.find((item) => item.type === "node")?.selector
      ?? null;
    const lcpBreakdown = (lcpInsightItems.find((item) => item.type === "table")?.items ?? []).map((item) => ({
      type: item.subpart ?? item.label ?? null,
      duration: item.duration ?? item.value ?? null,
    })) ?? [];
    const cls = lhr.audits["cumulative-layout-shift"]?.numericValue ?? Infinity;
    const totalBytes = lhr.audits["total-byte-weight"]?.numericValue ?? Infinity;
    const accessibilityIssues = (lhr.categories.accessibility?.auditRefs ?? [])
      .filter((reference) => reference.weight > 0 && lhr.audits[reference.id]?.score !== 1)
      .map((reference) => ({
        id: reference.id,
        title: lhr.audits[reference.id]?.title ?? reference.id,
        nodes: (lhr.audits[reference.id]?.details?.items ?? []).slice(0, 5).map((item) => item.node?.selector ?? item.node?.snippet ?? null).filter(Boolean),
      }));
    const checks = {
      performance: performance >= minimumPerformance,
      accessibility: accessibility >= minimumAccessibility,
      lcp: lcpMs <= maximumLcpMs,
      cls: cls <= maximumCls,
      pageWeight: totalBytes <= maximumBytes,
    };
    summaries.push({ view, finalUrl: finalUrl.toString(), scores: { performance: Math.round(performance * 100), accessibility: Math.round(accessibility * 100) }, metrics: { serverResponseMs: Math.round(serverResponseMs), fcpMs: Math.round(fcpMs), lcpMs: Math.round(lcpMs), tbtMs: Math.round(tbtMs), cls: Number(cls.toFixed(3)), totalBytes: Math.round(totalBytes), lcpElement, lcpBreakdown }, accessibilityIssues, checks, passed: Object.values(checks).every(Boolean) });
  }
  const report = { mode: "local-mobile", viewport: "390x844@3", pages: summaries, passed: summaries.every((entry) => entry.passed) };
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  try {
    await chrome.kill();
  } catch (error) {
    // Windows peut conserver brièvement un verrou sur le profil Lighthouse.
    // Ne jamais masquer le résultat de l'audit pour un échec de nettoyage temporaire.
    if (!(error instanceof Error && "code" in error && error.code === "EPERM")) {
      throw error;
    }
  }
}
