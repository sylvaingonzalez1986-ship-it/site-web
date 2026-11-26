import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const SITE = "https://www.leschanvriersbretons.com";
const AGENT = "LCB-SEO-Operator";
const SEEDS = ["/", "/cbd-breton", "/cbd-naturel", "/analyse-laboratoire-cbd", "/boutique", "/boutique/fleurs-cbd", "/blog", "/a-propos"];
const STATIC_PATHS = new Set([...SEEDS, "/cbd-pas-cher", "/glossaire-cbd"]);
const CATEGORIES = new Set(["fleurs-cbd", "resines-cbd", "huiles-cbd", "e-liquide-cbd", "cosmetiques-cbd", "tisane-cbd", "miam-cbd", "accessoires-cbd"]);
const CITY_PATHS = new Set(["/cbd-rennes", "/cbd-quimper", "/cbd-brest", "/cbd-vannes", "/cbd-lorient", "/cbd-saint-brieuc", "/cbd-saint-malo", "/cbd-fougeres", "/cbd-vitre", "/cbd-redon"]);
const SENSITIVE_SEGMENT = /(?:^|-)(?:admin|auth|compte|panier|checkout|paiement|payment|private|prive|preview|test|commande|order|login|profil|token|session|webhook|api)(?:-|$)/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUEST_TIMEOUT = 8_000;
const BODY_LIMIT = 2_000_000;
const PAGE_LIMIT = 18;
const ROBOTS = "/robots.txt";
const SITEMAP = "/sitemap.xml";

export function publicPath(path) {
  if (typeof path !== "string" || path.length > 220) return false;
  if (STATIC_PATHS.has(path) || CITY_PATHS.has(path)) return true;
  const [, root, child, leaf, extra] = path.split("/");
  if (!path.startsWith("/") || !SLUG.test(child ?? "") || SENSITIVE_SEGMENT.test(child)) return false;
  if (root === "blog") return leaf === undefined;
  if (root !== "boutique" || !CATEGORIES.has(child)) return false;
  return leaf === undefined || (extra === undefined && /^product-\d{5,20}$/.test(leaf));
}

function publicLocation(raw, base, allowEndpoint = false) {
  if (!raw || /[?#\\%\u0000-\u0020\u007f]/.test(raw) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(raw)) return null;
  try {
    const url = new URL(raw, base);
    if (url.origin !== new URL(base).origin || url.username || url.password) return null;
    if (!publicPath(url.pathname) && !(allowEndpoint && [ROBOTS, SITEMAP].includes(url.pathname))) return null;
    return url;
  } catch {
    return null;
  }
}

function checkedBase(raw, preview) {
  const url = new URL(raw);
  const isLoopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    && ["http:", "https:"].includes(url.protocol);
  const isPreview = preview && url.protocol === "https:" && !url.port
    && /^site-[a-z0-9]+-sylvains-projects-d3690ef6\.vercel\.app$/.test(url.hostname);
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password
    || (url.origin !== SITE && !isLoopback && !isPreview)) throw new Error("invalid-base");
  return { origin: url.origin, isPreview };
}

function decode(value) {
  const entities = { amp: "&", apos: "'", quot: '"', lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|apos|quot|lt|gt|nbsp);/gi, (raw, entity) => {
    if (entity[0] !== "#") return entities[entity.toLowerCase()] ?? raw;
    const code = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : raw;
  });
}

function attributes(raw) {
  const values = Object.create(null);
  for (const [, name, double, single, bare] of raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    values[name.toLowerCase()] ??= decode(double ?? single ?? bare ?? "");
  }
  return values;
}

function tags(html, name) {
  const pattern = new RegExp(`<${name}\\b((?:"[^"]*"|'[^']*'|[^'">])*)>`, "gi");
  return [...html.matchAll(pattern)].map(match => attributes(match[1]));
}

function field(value, limit = 260) {
  return decode(value.replace(/<[^>]*>/g, "")).replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim().slice(0, limit);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function metadata(html, pageUrl, publicationOrigin) {
  const types = new Set();
  let invalidStructuredData = 0;
  function collect(value, depth = 0) {
    if (!value || depth > 4) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 100)) collect(item, depth + 1);
      return;
    }
    for (const type of [value["@type"]].flat()) {
      if (typeof type === "string" && /^[a-zA-Z][a-zA-Z0-9]{0,64}$/.test(type)) types.add(type);
    }
    collect(value["@graph"], depth + 1);
  }
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(
    /<script\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script\s*>/gi,
    (_, attrs, json) => {
      if (attributes(attrs).type?.toLowerCase() === "application/ld+json") {
        try { collect(JSON.parse(json)); } catch { invalidStructuredData += 1; }
      }
      return "";
    },
  ).replace(/<(style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const details = tags(clean, "meta");
  const canonicals = tags(clean, "link").filter(item => item.rel?.toLowerCase().split(/\s+/).includes("canonical"));
  const canonical = canonicals[0]?.href;
  const safeCanonical = canonical?.startsWith(`${publicationOrigin}/`) || canonical === publicationOrigin
    ? publicLocation(canonical, publicationOrigin)?.href ?? null : null;
  const headings = [...clean.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)];
  const linkedPaths = tags(clean, "a").flatMap(item => {
    const link = publicLocation(item.href, pageUrl) ?? publicLocation(item.href, publicationOrigin);
    return link ? [link.pathname] : [];
  });
  return {
    title: field(clean.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? ""),
    description: field(details.find(item => item.name?.toLowerCase() === "description")?.content ?? ""),
    canonical: safeCanonical,
    canonicalCount: canonicals.length,
    robots: uniqueSorted(details.flatMap(item => item.name?.toLowerCase() === "robots" || item.name?.toLowerCase() === "googlebot"
      ? (item.content ?? "").toLowerCase().split(/[\s,]+/).filter(part => /^(?:no)?(?:index|follow|archive|snippet|imageindex)$|^none$/.test(part)) : [])),
    refresh: details.some(item => item["http-equiv"]?.toLowerCase() === "refresh"),
    h1: headings.slice(0, 8).map(match => field(match[1])),
    h1Count: headings.length,
    sectionAnchors: uniqueSorted([...tags(clean, "h2"), ...tags(clean, "h3")]
      .map(item => item.id).filter(id => id && id.length <= 100 && SLUG.test(id))).slice(0, 80),
    types: [...types].sort(),
    invalidStructuredData,
    linkedPaths: uniqueSorted(linkedPaths).slice(0, 120),
  };
}

export function robotsRules(body) {
  const groups = [];
  const sitemaps = [];
  let group;
  for (const line of body.split(/\r?\n/)) {
    const [, name, raw] = line.replace(/#.*/, "").match(/^\s*([a-z-]+)\s*:\s*(.*?)\s*$/i) ?? [];
    if (!raw) continue;
    switch (name.toLowerCase()) {
      case "sitemap":
        sitemaps.push(raw);
        break;
      case "user-agent":
        if (!group || group.rules.length) {
          group = { agents: [], rules: [] };
          groups.push(group);
        }
        group.agents.push(raw.toLowerCase());
        break;
      case "allow":
      case "disallow":
        if (group && raw.startsWith("/") && raw.length <= 512) {
          group.rules.push({ allow: name.toLowerCase() === "allow", pattern: raw });
        }
        break;
    }
  }
  const exact = groups.filter(item => item.agents.includes(AGENT.toLowerCase()));
  const rules = (exact.length ? exact : groups.filter(item => item.agents.includes("*"))).flatMap(item => item.rules);
  return {
    sitemaps,
    allows(path) {
      const matches = rules.filter(({ pattern }) => {
        const final = pattern.endsWith("$");
        const literal = final ? pattern.slice(0, -1) : pattern;
        const expression = literal.split("*").map(part => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")).join(".*");
        return new RegExp(`^${expression}${final ? "$" : ""}`).test(path);
      }).sort((left, right) => right.pattern.length - left.pattern.length || Number(right.allow) - Number(left.allow));
      return matches[0]?.allow ?? true;
    },
  };
}

async function limitedBody(response) {
  if (!response.body) return { text: "", bytes: 0 };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return { text: text + decoder.decode(), bytes };
      bytes += value.byteLength;
      if (bytes > BODY_LIMIT) throw new Error("body-limit");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    // A cancelled body keeps an oversized or redirected response out of the cache.
    await reader.cancel().catch(() => {});
  }
}

function token(value) {
  return typeof value === "string" && /^[\x20-\x7e]{1,200}$/.test(value) ? value : null;
}

function findings(page, publicationOrigin) {
  if (page.state !== "html") return [page.state];
  const signals = [];
  if (!page.inSitemap) signals.push("absent-sitemap");
  if (page.status !== 200) signals.push("http-status");
  if (page.robots.some(rule => rule === "noindex" || rule === "none")) signals.push("noindex");
  if (page.refresh) signals.push("meta-refresh");
  if (page.canonicalCount !== 1 || page.canonical !== new URL(page.path, publicationOrigin).href) signals.push("canonical");
  if (page.h1Count !== 1 || !page.h1[0]) signals.push("h1");
  if (!page.title) signals.push("title");
  if (!page.description) signals.push("description");
  if (page.invalidStructuredData) signals.push("structured-data");
  return signals;
}

function sitemapPaths(body, origin) {
  const matches = [...body.matchAll(/<loc\b[^>]*>([^<]+)<\/loc\s*>/gi)];
  const paths = matches.flatMap(match => {
    const raw = decode(match[1].trim());
    const url = /^https?:\/\//i.test(raw) && publicLocation(raw, origin);
    return url ? [url.pathname] : [];
  });
  return { paths: new Set(paths), entries: matches.length, duplicatePublicPaths: paths.length - new Set(paths).size };
}

export async function crawl({ base = SITE, preview = false, paths, previous = {}, signal, bypass, publicationOrigin = SITE } = {}) {
  const { origin, isPreview } = checkedBase(base, preview);
  if (paths?.length > PAGE_LIMIT || paths?.some(path => !publicPath(path))) throw new Error("invalid-crawl-path");
  if (isPreview && bypass && !token(bypass)) throw new Error("invalid-preview-token");
  const headers = { "user-agent": `${AGENT}/1.0`, accept: "text/html, application/xml, text/xml, text/plain" };
  if (isPreview && bypass) headers["x-vercel-protection-bypass"] = bypass;

  async function get(path, cached) {
    const start = performance.now();
    const localSignal = AbortSignal.timeout(REQUEST_TIMEOUT);
    const requestHeaders = { ...headers };
    if (cached?.etag) requestHeaders["if-none-match"] = cached.etag;
    if (cached?.modified) requestHeaders["if-modified-since"] = cached.modified;
    const request = new URL(path, origin);
    try {
      const response = await fetch(request, {
        method: "GET", redirect: "manual", credentials: "omit", headers: requestHeaders,
        signal: signal ? AbortSignal.any([signal, localSignal]) : localSignal,
      });
      const status = response.status;
      const durationMs = Math.round(performance.now() - start);
      if (status >= 300 && status < 400) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        const destination = publicLocation(location, request, true)?.pathname ?? null;
        const ageGate = typeof location === "string" && (/^\/age-gate(?:\?|$)/.test(location)
          || location.startsWith(`${origin}/age-gate?`));
        return { status, durationMs, destination, ageGate };
      }
      const mime = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
      const permittedType = path === ROBOTS ? mime === "text/plain"
        : path === SITEMAP ? ["application/xml", "text/xml"].includes(mime) : mime === "text/html";
      if (!response.ok || !permittedType) {
        await response.body?.cancel();
        return { status, durationMs, badType: response.ok && !permittedType };
      }
      const body = await limitedBody(response);
      return {
        status, durationMs, ...body,
        etag: token(response.headers.get("etag")), modified: token(response.headers.get("last-modified")),
        noindex: /(?:^|[\s,;:])(?:noindex|none)(?:$|[\s,;])/.test((response.headers.get("x-robots-tag") ?? "").toLowerCase()),
      };
    } catch (error) {
      if (signal?.aborted) throw new Error("run-timeout");
      if (localSignal.aborted) return { state: "request-timeout" };
      return { state: error.message === "body-limit" ? "response-too-large" : "network-unavailable" };
    }
  }

  const robotResponse = await get(ROBOTS);
  const robots = robotResponse.text === undefined ? null : robotsRules(robotResponse.text);
  const sitemapResponse = await get(SITEMAP);
  const sitemap = sitemapPaths(sitemapResponse.text ?? "", publicationOrigin);
  const expectedSitemap = new URL(SITEMAP, publicationOrigin).href;
  const summary = {
    robotsStatus: robotResponse.status ?? robotResponse.state,
    sitemapStatus: sitemapResponse.status ?? sitemapResponse.state,
    sitemapDeclared: robots?.sitemaps.includes(expectedSitemap) ?? false,
    sitemapEntries: sitemap.entries,
    duplicatePublicSitemapPaths: sitemap.duplicatePublicPaths,
  };
  const discovered = [...sitemap.paths].filter(path => !SEEDS.includes(path)).sort();
  const families = [/^\/boutique\/[^/]+\//, /^\/boutique\/[^/]+$/, /^\/blog\//, /^\/cbd-/];
  const sample = families.flatMap(pattern => discovered.filter(path => pattern.test(path)).slice(0, 2));
  const pagePaths = uniqueSorted(paths ?? [...SEEDS, ...sample].slice(0, PAGE_LIMIT));
  const pages = [];
  const cache = {};
  for (const path of pagePaths) {
    const inSitemap = sitemap.paths.has(path);
    const cached = Array.isArray(previous[path]?.page?.sectionAnchors) ? previous[path] : null;
    let page;
    if (!robots || (!preview && !robots.allows(path))) {
      page = { path, inSitemap, state: "robots-blocked" };
    } else {
      const response = await get(path, cached);
      if (response.status === 304 && cached?.page?.state === "html") {
        page = { ...cached.page, inSitemap, durationMs: response.durationMs, change: "not-modified" };
        cache[path] = cached;
      } else if (response.text !== undefined) {
        const data = metadata(response.text, new URL(path, origin), publicationOrigin);
        if (response.noindex && !isPreview) data.robots = uniqueSorted([...data.robots, "noindex"]);
        const digest = createHash("sha256").update(JSON.stringify([response.status, data])).digest("hex");
        const change = cached ? (cached.digest === digest ? "unchanged" : "changed") : "new";
        const { status, durationMs, bytes, etag, modified } = response;
        page = { path, inSitemap, status, durationMs, bytes, state: "html", change, ...data };
        cache[path] = { digest, etag, modified, page };
      } else {
        const { status, destination } = response;
        const state = response.state ?? (response.ageGate ? "age-gate" : response.badType ? "unexpected-type"
          : status >= 300 && status < 400 ? "redirect" : "http-status");
        page = { path, inSitemap, state, status, destination };
      }
    }
    pages.push({ ...page, signals: findings(page, publicationOrigin) });
  }
  return { summary, pages, cache };
}

async function main() {
  const { values } = parseArgs({ options: {
    base: { type: "string", default: SITE }, preview: { type: "boolean" },
    check: { type: "string", multiple: true }, "require-link": { type: "string", multiple: true },
  } });
  if (values.preview && !values.check?.length) throw new Error("preview-requires-explicit-paths");
  if (values["require-link"]?.some(path => !publicPath(path))) throw new Error("invalid-required-link");
  const { summary, pages } = await crawl({ base: values.base, preview: values.preview, paths: values.check,
    bypass: process.env.SEO_PREVIEW_BYPASS_TOKEN, signal: AbortSignal.timeout(150_000) });
  const missingLinks = pages.flatMap(page => (values["require-link"] ?? [])
    .filter(path => !page.linkedPaths?.includes(path)).map(path => ({ source: page.path, target: path })));
  process.stdout.write(`${JSON.stringify({ summary, pages, missingLinks }, null, 2)}\n`);
  if (values.check && (summary.robotsStatus !== 200 || summary.sitemapStatus !== 200 || !summary.sitemapDeclared
    || missingLinks.length || pages.some(page => page.signals.length))) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(() => {
    console.error("SEO HTML check failed or received invalid arguments");
    process.exitCode = 1;
  });
}
