import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

const baseUrl = (process.env.PLACARD_MOBILE_AUDIT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const workspaceRoot = resolve(process.cwd());
const reportDirectory = resolve(
  workspaceRoot,
  String(process.env.PLACARD_MOBILE_REPORT_DIR || "output/placard-mobile-audits").trim(),
);
const reportDirectoryFromRoot = relative(workspaceRoot, reportDirectory);
if (
  !reportDirectoryFromRoot
  || reportDirectoryFromRoot === ".."
  || reportDirectoryFromRoot.startsWith(`..${sep}`)
  || isAbsolute(reportDirectoryFromRoot)
) {
  throw new Error("PLACARD_MOBILE_REPORT_DIR doit designer un sous-dossier du projet.");
}
const legacyCookie = String(process.env.PLACARD_MOBILE_AUDIT_COOKIE || "").trim();
const cookies = String(process.env.PLACARD_MOBILE_AUDIT_COOKIES || "")
  .split(/\r?\n|\|\|/)
  .map((value) => value.trim())
  .filter(Boolean);
if (cookies.length === 0 && legacyCookie) cookies.push(legacyCookie);

function parseCredentialProfiles(value) {
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON doit contenir un tableau JSON valide.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON doit contenir un tableau.");
  }
  const profiles = parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Compte de recette ${index + 1} invalide.`);
    }
    const label = String(entry.label || `profil-${index + 1}`).trim();
    const email = String(entry.email || "").trim().toLowerCase();
    const password = String(entry.password || "");
    if (!label || !email || !password) {
      throw new Error(`Compte de recette ${index + 1} incomplet : label, email et password sont requis.`);
    }
    return { label, email, password };
  });
  if (new Set(profiles.map((profile) => profile.email)).size !== profiles.length) {
    throw new Error("Les comptes de recette doivent utiliser des emails distincts.");
  }
  return profiles;
}

let credentialProfiles = parseCredentialProfiles(
  String(process.env.PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON || "").trim(),
);
delete process.env.PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON;
delete process.env.PLACARD_MOBILE_AUDIT_COOKIES;
delete process.env.PLACARD_MOBILE_AUDIT_COOKIE;
if (cookies.length > 0 && credentialProfiles.length > 0) {
  throw new Error("Choisissez soit PLACARD_MOBILE_AUDIT_COOKIES, soit PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON.");
}

const requestedLabels = String(process.env.PLACARD_MOBILE_AUDIT_PROFILES || "")
  .split(/\r?\n|\|\|/)
  .map((value) => value.trim())
  .filter(Boolean);
const minimumAccounts = Math.max(1, Number(process.env.PLACARD_MOBILE_MIN_ACCOUNTS || 2));
const requireDistinctCollections = process.env.PLACARD_MOBILE_REQUIRE_DISTINCT_COLLECTIONS !== "0";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl);
const minimumPerformance = Number(process.env.PLACARD_MOBILE_MIN_PERFORMANCE || 0.75);
const minimumAccessibility = Number(process.env.PLACARD_MOBILE_MIN_ACCESSIBILITY || 0.9);
const maximumLcpMs = Number(process.env.PLACARD_MOBILE_MAX_LCP_MS || 4000);
const maximumCls = Number(process.env.PLACARD_MOBILE_MAX_CLS || 0.1);
const maximumBytes = Number(process.env.PLACARD_MOBILE_MAX_BYTES || 2_000_000);
const auditViews = [
  { code: "hud", path: "/arene/placard" },
  { code: "equipment-catalog", path: "/arene/placard?view=shop&catalog=equipment" },
  { code: "market", path: "/arene/placard?view=market" },
];

if (!isLocal) throw new Error("L’audit mobile Placard refuse toujours les cibles distantes.");
const providedAccountCount = cookies.length || credentialProfiles.length;
if (providedAccountCount < minimumAccounts) {
  throw new Error(
    `La recette mobile exige ${minimumAccounts} comptes locaux. ` +
    "Renseignez PLACARD_MOBILE_AUDIT_ACCOUNTS_JSON ou PLACARD_MOBILE_AUDIT_COOKIES.",
  );
}

const ageResponse = await fetch(`${baseUrl}/api/age-gate/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirmed: true }),
});
if (!ageResponse.ok) throw new Error("La validation d’âge locale de l’audit a échoué.");
const ageCookie = ageResponse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
if (!ageCookie) throw new Error("Le cookie d’âge local de l’audit est absent.");

function getResponseCookies(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values
    .map((value) => String(value).split(";", 1)[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function loginCredentialProfile(profile) {
  const response = await fetch(`${baseUrl}/api/account/login`, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", "user-agent": "placard-local-mobile-audit/2.1" },
    body: JSON.stringify({ email: profile.email, password: profile.password }),
  });
  const cookie = getResponseCookies(response);
  if (response.status !== 200 || !cookie) {
    throw new Error(
      `Connexion locale impossible pour ${profile.label} : HTTP ${response.status}. ` +
      "Vérifiez le compte de recette, sa confirmation et la configuration Supabase locale.",
    );
  }
  return { label: profile.label, cookie: `${cookie}; ${ageCookie}` };
}

let authenticationMode = "cookies";
let profiles;
if (credentialProfiles.length > 0) {
  authenticationMode = "credentials-json";
  profiles = [];
  for (const profile of credentialProfiles) profiles.push(await loginCredentialProfile(profile));
  credentialProfiles = [];
} else {
  profiles = cookies.map((cookie, index) => ({
    label: requestedLabels[index] || `profil-${index + 1}`,
    cookie: `${cookie}; ${ageCookie}`,
  }));
}

function toCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function summarizeCollection(payload) {
  const supportCards = Array.isArray(payload?.collection?.cards) ? payload.collection.cards : [];
  const buddies = Array.isArray(payload?.ownedBuddies) ? payload.ownedBuddies : [];
  const heritages = Array.isArray(payload?.heritage?.cards) ? payload.heritage.cards : [];
  const summary = {
    supportReferences: supportCards.filter((card) => toCount(card?.ownedCopies) > 0).length,
    supportCopies: supportCards.reduce((sum, card) => sum + toCount(card?.ownedCopies), 0),
    buddieReferences: buddies.filter((card) => toCount(card?.ownedCopies) > 0).length,
    buddieCopies: buddies.reduce((sum, card) => sum + toCount(card?.ownedCopies), 0),
    heritageReferences: heritages.filter((card) => toCount(card?.ownedCopies) > 0).length,
    heritageCopies: heritages.reduce((sum, card) => sum + toCount(card?.ownedCopies), 0),
    activeRun: Boolean(payload?.playerSession?.activeRun),
  };
  return {
    ...summary,
    sizeKey: [
      summary.supportReferences,
      summary.supportCopies,
      summary.buddieReferences,
      summary.buddieCopies,
      summary.heritageReferences,
      summary.heritageCopies,
    ].join(":"),
  };
}

async function preflightProfile(profile) {
  const headers = { cookie: profile.cookie, "user-agent": "placard-local-mobile-audit/2.0" };
  const [pageResponse, bootstrapResponse, equipmentResponse, marketResponse] = await Promise.all([
    fetch(`${baseUrl}/arene/placard`, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { ...headers, accept: "text/html" },
    }),
    fetch(`${baseUrl}/api/arena/placard/bootstrap`, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { ...headers, accept: "application/json" },
    }),
    fetch(`${baseUrl}/api/arena/placard/equipment`, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { ...headers, accept: "application/json" },
    }),
    fetch(`${baseUrl}/api/arena/placard/market`, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { ...headers, accept: "application/json" },
    }),
  ]);
  if (pageResponse.status !== 200) {
    const location = pageResponse.headers.get("location");
    throw new Error(
      `Profil ${profile.label} invalide : page Placard HTTP ${pageResponse.status}` +
      `${location ? ` vers ${new URL(location, baseUrl).pathname}` : ""}. ` +
      "Vérifiez la session et les six verrous KQ_* du serveur local de recette.",
    );
  }
  if (bootstrapResponse.status !== 200) {
    throw new Error(
      `Profil ${profile.label} invalide : bootstrap Placard HTTP ${bootstrapResponse.status}. ` +
      "Vérifiez la session locale et les droits du compte.",
    );
  }
  if (equipmentResponse.status !== 200) {
    throw new Error(
      `Profil ${profile.label} invalide : catalogue matériel HTTP ${equipmentResponse.status}.`,
    );
  }
  if (marketResponse.status !== 200) {
    throw new Error(
      `Profil ${profile.label} invalide : marché Placard HTTP ${marketResponse.status}.`,
    );
  }
  const payload = await bootstrapResponse.json();
  const equipmentPayload = await equipmentResponse.json();
  const marketPayload = await marketResponse.json();
  return {
    pageStatus: pageResponse.status,
    bootstrapStatus: bootstrapResponse.status,
    equipmentStatus: equipmentResponse.status,
    marketStatus: marketResponse.status,
    equipmentReferences: Array.isArray(equipmentPayload?.catalog) ? equipmentPayload.catalog.length : 0,
    ownedEquipment: Array.isArray(equipmentPayload?.ownedCodes) ? equipmentPayload.ownedCodes.length : 0,
    marketLots: Array.isArray(marketPayload?.lots) ? marketPayload.lots.length : 0,
    collection: summarizeCollection(payload),
  };
}

const preparedProfiles = [];
for (const profile of profiles) {
  preparedProfiles.push({ ...profile, preflight: await preflightProfile(profile) });
}

const collectionProfileCount = new Set(
  preparedProfiles.map((profile) => profile.preflight.collection.sizeKey),
).size;
const collectionCoveragePassed = !requireDistinctCollections
  || preparedProfiles.length < 2
  || collectionProfileCount >= 2;

const chrome = await launch({ chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"] });
try {
  const profileSummaries = [];
  const viewSummaries = [];
  for (const profile of preparedProfiles) {
    const collection = { ...profile.preflight.collection };
    delete collection.sizeKey;
    const views = [];
    for (const auditView of auditViews) {
      const auditedUrl = new URL(auditView.path, baseUrl);
      const result = await lighthouse(auditedUrl.href, {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        extraHeaders: { Cookie: profile.cookie },
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
      if (!result) {
        throw new Error(`Lighthouse n’a produit aucun rapport pour ${profile.label}/${auditView.code}.`);
      }

      const { lhr } = result;
      const finalUrl = new URL(lhr.finalDisplayedUrl || lhr.finalUrl || auditedUrl.href);
      const performance = lhr.categories.performance?.score ?? 0;
      const accessibility = lhr.categories.accessibility?.score ?? 0;
      const lcpMs = lhr.audits["largest-contentful-paint"]?.numericValue ?? Number.POSITIVE_INFINITY;
      const fcpMs = lhr.audits["first-contentful-paint"]?.numericValue ?? Number.POSITIVE_INFINITY;
      const tbtMs = lhr.audits["total-blocking-time"]?.numericValue ?? Number.POSITIVE_INFINITY;
      const cls = lhr.audits["cumulative-layout-shift"]?.numericValue ?? Number.POSITIVE_INFINITY;
      const totalBytes = lhr.audits["total-byte-weight"]?.numericValue ?? Number.POSITIVE_INFINITY;
      const navigationPassed = finalUrl.pathname === auditedUrl.pathname
        && finalUrl.search === auditedUrl.search
        && lhr.audits["http-status-code"]?.score !== 0
        && !lhr.runtimeError;
      const accessibilityIssues = (lhr.categories.accessibility?.auditRefs ?? [])
        .filter((reference) => reference.weight > 0 && lhr.audits[reference.id]?.score !== 1)
        .map((reference) => ({
          id: reference.id,
          title: lhr.audits[reference.id]?.title ?? reference.id,
          affectedNodes: (lhr.audits[reference.id]?.details?.items ?? []).length,
        }));
      const checks = {
        navigation: navigationPassed,
        performance: performance >= minimumPerformance,
        accessibility: accessibility >= minimumAccessibility,
        lcp: lcpMs <= maximumLcpMs,
        cls: cls <= maximumCls,
        pageWeight: totalBytes <= maximumBytes,
      };
      const viewSummary = {
        view: auditView.code,
        requestedPath: auditView.path,
        finalPath: `${finalUrl.pathname}${finalUrl.search}`,
        scores: {
          performance: Math.round(performance * 100),
          accessibility: Math.round(accessibility * 100),
        },
        metrics: {
          fcpMs: Math.round(fcpMs),
          lcpMs: Math.round(lcpMs),
          tbtMs: Math.round(tbtMs),
          cls: Number(cls.toFixed(3)),
          totalBytes: Math.round(totalBytes),
        },
        accessibilityIssues,
        checks,
        passed: Object.values(checks).every(Boolean),
      };
      views.push(viewSummary);
      viewSummaries.push(viewSummary);
    }

    profileSummaries.push({
      profile: profile.label,
      preflight: {
        pageStatus: profile.preflight.pageStatus,
        bootstrapStatus: profile.preflight.bootstrapStatus,
        equipmentStatus: profile.preflight.equipmentStatus,
        marketStatus: profile.preflight.marketStatus,
        equipmentReferences: profile.preflight.equipmentReferences,
        ownedEquipment: profile.preflight.ownedEquipment,
        marketLots: profile.preflight.marketLots,
        collection,
      },
      views,
      passed: views.every((entry) => entry.passed),
    });
  }

  const globalChecks = {
    accountCoverage: profileSummaries.length >= minimumAccounts,
    distinctCollectionProfiles: collectionCoveragePassed,
    viewCoverage: auditViews.every((view) => viewSummaries.some((entry) => entry.view === view.code)),
  };
  const generatedAt = new Date().toISOString();
  const reportFileName = `placard-mobile-${generatedAt.replace(/[:.]/g, "-")}.json`;
  const reportPath = resolve(reportDirectory, reportFileName);
  const artifactPath = relative(workspaceRoot, reportPath).split(sep).join("/");
  const report = {
    schema: "kanab-quest-mobile-audit-v2",
    generatedAt,
    artifactPath,
    mode: "local-mobile-multi-account",
    authenticationMode,
    viewport: "390x844@3",
    accounts: profileSummaries.length,
    auditedViews: auditViews.map((view) => view.code),
    collectionProfiles: collectionProfileCount,
    budgets: {
      minimumAccounts,
      requireDistinctCollections,
      minimumPerformance: Math.round(minimumPerformance * 100),
      minimumAccessibility: Math.round(minimumAccessibility * 100),
      maximumLcpMs,
      maximumCls,
      maximumBytes,
    },
    worstCase: {
      performance: Math.min(...viewSummaries.map((entry) => entry.scores.performance)),
      accessibility: Math.min(...viewSummaries.map((entry) => entry.scores.accessibility)),
      lcpMs: Math.max(...viewSummaries.map((entry) => entry.metrics.lcpMs)),
      cls: Math.max(...viewSummaries.map((entry) => entry.metrics.cls)),
      totalBytes: Math.max(...viewSummaries.map((entry) => entry.metrics.totalBytes)),
    },
    globalChecks,
    profiles: profileSummaries,
    passed: Object.values(globalChecks).every(Boolean) && profileSummaries.every((entry) => entry.passed),
  };
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  try {
    await chrome.kill();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EPERM")) throw error;
  }
}
