import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { TraceMap, originalPositionFor, sourceContentFor } from "@jridgewell/trace-mapping";
import { REHEARSAL_APP } from "./admin-rehearsal-server.mjs";

const destination = "/admin/rehearsal?from=account";
const adminHref = `/admin/login?next=${encodeURIComponent(destination)}`;
const check = (valid, label) => { if (!valid) throw new Error(label); };

export async function prepareAdminBrowserApp({ root, appDir, digest }) {
  const sources = [];
  const copy = async (relative, target = relative) => {
    const bytes = await readFile(resolve(root, relative));
    const path = resolve(appDir, target);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    const identical = digest(await readFile(path)) === digest(bytes);
    check(identical, "Fixture source copy differs");
    sources.push({ path: relative, fixturePath: target, sha256: digest(bytes), byteIdentical: identical });
  };
  const middlewareSource = existsSync(resolve(root, "src/middleware.ts")) ? "src/middleware.ts" : "middleware.ts";
  const previousRootCopy = resolve(appDir, "middleware.ts");
  if (existsSync(previousRootCopy)) {
    check(digest(await readFile(previousRootCopy)) === digest(await readFile(resolve(root, middlewareSource))), "Refusing to remove an unrecognized fixture middleware");
    await unlink(previousRootCopy);
  }
  // Next's dev Webpack watcher discovers this convention beside src/app.
  // Copy identical bytes; the actual repository middleware is never relocated.
  await copy(middlewareSource, "src/middleware.ts");
  for (const path of [
    "src/app/compte/connexion/page.tsx", "src/app/admin/login/page.tsx", "src/app/admin/layout.tsx",
    "src/app/age-gate/page.tsx", "src/app/api/account/login/route.ts", "src/app/api/account/logout/route.ts", "src/app/api/age-gate/verify/route.ts",
    "src/components/account/AccountLoginForm.tsx", "src/components/admin/AdminLoginForm.tsx",
    "src/components/admin/AdminLogin.module.css", "src/components/admin/AdminTheme.module.css",
    "src/components/navigation/NavigationFeedback.tsx", "src/components/navigation/NavigationFeedback.module.css", "src/components/navigation/NavigationLink.tsx",
    "src/components/AgeGatePageClient.tsx", "src/components/FirstVisitExperience.module.css", "src/app/globals.css",
    "src/app/fonts/SpaceGrotesk-Latin-Variable.woff2", "src/app/fonts/BarlowCondensed-Latin-Bold.woff2",
    "src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2", "src/app/fonts/BarlowCondensed-Latin-Black.woff2",
    "public/mascots/home-welcome.png",
  ]) await copy(path);
  const generated = async (relative, contents) => {
    const path = resolve(appDir, relative);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  };
  // A minimal UI cache, not an authentication stub: both forms still call the
  // real APIs, and all access decisions still read actual Supabase cookies.
  await generated("src/context/CartContext.tsx", `"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import type {PublicCustomer} from "@/types/customer";
const Context=createContext<{setUser:(user:PublicCustomer|null)=>void}|null>(null);
export function CartProvider({children}:{children:ReactNode}){
 const [,setUser]=useState<PublicCustomer|null>(null);
 useEffect(()=>{document.documentElement.dataset.rehearsalHydrated="true";},[]);
 return <Context.Provider value={{setUser}}>{children}</Context.Provider>;
}
export function useCart(){const value=useContext(Context);if(!value)throw new Error("Rehearsal provider missing");return value;}
`);
  await generated("src/app/layout.tsx", `import type {ReactNode} from "react";
import localFont from "next/font/local";
import {CartProvider} from "@/context/CartContext";
import {NavigationFeedbackProvider} from "@/components/navigation/NavigationFeedback";
import "./globals.css";
const body=localFont({src:"./fonts/SpaceGrotesk-Latin-Variable.woff2",variable:"--font-body",weight:"400 700",display:"swap"});
const display=localFont({src:[{path:"./fonts/BarlowCondensed-Latin-Bold.woff2",weight:"700"},{path:"./fonts/BarlowCondensed-Latin-ExtraBold.woff2",weight:"800"},{path:"./fonts/BarlowCondensed-Latin-Black.woff2",weight:"900"}],variable:"--font-display",display:"swap"});
export default function Layout({children}:{children:ReactNode}){
 return <html lang="fr"><body className={body.variable+" "+display.variable}><CartProvider><NavigationFeedbackProvider><main id="main-content">{children}</main></NavigationFeedbackProvider></CartProvider></body></html>;
}
`);
  await generated("postcss.config.mjs", "export default { plugins: { '@tailwindcss/postcss': {} } };\n");
  // The development bundler loads the on-disk config independently of the
  // custom server's conf object, so the same non-eval map setup belongs here.
  await generated("next.config.mjs", `export default {
 poweredByHeader:false, images:{unoptimized:true}, experimental:{agentUpgrade:false},
 webpack(config,{dev,webpack}){
  if(dev){
   const before=config.plugins.length;
   config.plugins=config.plugins.filter(plugin=>plugin?.constructor?.name!=="EvalSourceMapDevToolPlugin");
   const removed=before-config.plugins.length;
   config.plugins.push(new webpack.SourceMapDevToolPlugin({filename:"[file].map"}));
   process.send?.({type:"fixture-compilation",evalSourceMapsRemoved:removed,externalSourceMaps:true});
  }
  return config;
 }
};\n`);
  await generated("src/components/rehearsal/LogoutControls.tsx", `"use client";
import {useState} from "react";
export function LogoutControls(){
 const [error,setError]=useState(false);
 async function logout(kind:"admin"|"account"){
  const response=await fetch("/api/"+kind+"/logout",{method:"POST"});
  if(!response.ok){setError(true);return;}
  window.location.assign(${JSON.stringify(adminHref)});
 }
 return <div style={{display:"grid",gap:16,marginTop:24}}>
  <button className="btn-cartoon btn-primary" data-rehearsal-logout="admin" onClick={()=>logout("admin")}>Déconnecter l’administration</button>
  <button className="btn-cartoon btn-primary" data-rehearsal-logout="account" onClick={()=>logout("account")}>Déconnecter le compte</button>
  {error&&<p role="alert">Déconnexion refusée.</p>}
 </div>;
}
`);
  await generated("src/app/admin/rehearsal/page.tsx", `import {redirect} from "next/navigation";
import {getValidatedAdminContext} from "@/lib/admin-guard";
import {LogoutControls} from "@/components/rehearsal/LogoutControls";
export const dynamic="force-dynamic";
export default async function Page(){
 if(!await getValidatedAdminContext())redirect(${JSON.stringify(adminHref)});
 return <section data-rehearsal-authorized="true" style={{maxWidth:560,margin:"0 auto",padding:24,color:"#003f30",background:"#fffaf1"}}>
  <h1>Accès admin validé</h1><p>Destination témoin locale. L’accès est contrôlé par la garde réelle du site.</p><LogoutControls/>
 </section>;
}
`);
  return sources;
}

export async function rehearseAdminBrowser({ accounts, adminPassword, osEnv, workspace, report, mark, setStage, rotateAdminPassword, smokeOnly = false }) {
  const browserReport = report.browser = { widths: [320, 390], captures: [], submissionChecks: [], pageErrors: 0, blockedRequests: 0, cspViolations: [], unexpectedCspCount: 0, expectedDevelopmentCspBlocks: [], browserClosed: false, middleware: {} };
  const mapCache = new Map(), pendingCspChecks = new Set();
  let compilationEpoch = 0;
  const knownReactDebugEval = new Map([
    ['(0, eval)("null");', "react-development-eval-availability-probe"],
    ['return (0, eval)(response);', "react-development-model-debug-expression"],
    ['var fn = (0, eval)(encodedName)[name];', "react-development-fake-call-stack"],
    ['(0, eval)("({" + JSON.stringify(code) + ":function(){}})")[code]', "react-development-inferred-function-name"],
    ['(0, eval)("({" + JSON.stringify(code) + ":class{}})")[code]', "react-development-inferred-class-name"],
    ['(0, eval)("({" + JSON.stringify(code) + ":async function(){}})")[', "react-development-inferred-async-function-name"],
  ]);
  const recordCsp = async (directive, kind, sourceModule, line, column) => {
    let expected;
    if (directive === "script-src" && kind === "eval" && sourceModule === "main-app.js") {
      try {
        const key = `${compilationEpoch}:${sourceModule}`;
        if (!mapCache.has(key)) mapCache.set(key, readFile(resolve(workspace, "browser-app/.next/dev/static/chunks/main-app.js.map"), "utf8").then((json) => new TraceMap(JSON.parse(json))));
        const map = await mapCache.get(key);
        const original = originalPositionFor(map, { line, column: Math.max(0, column - 1) });
        if (original.source?.replaceAll("\\", "/").endsWith("/node_modules/next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js")) {
          const sourceLine = sourceContentFor(map, original.source)?.split("\n")[original.line - 1]?.trim().replace(/\s+/g, " ");
          const diagnostic = knownReactDebugEval.get(sourceLine);
          if (diagnostic) expected = { diagnostic, sourceModule: "react-server-dom-webpack-client.browser.development.js", originalLine: original.line };
        }
      } catch { /* Unmapped or changed source is unexpected, never waived. */ }
    }
    if (expected) {
      const found = browserReport.expectedDevelopmentCspBlocks.find((item) => item.diagnostic === expected.diagnostic && item.originalLine === expected.originalLine);
      if (found) found.blockedCount++;
      else browserReport.expectedDevelopmentCspBlocks.push({ ...expected, blockedCount: 1 });
    } else {
      browserReport.unexpectedCspCount++;
      const found = browserReport.cspViolations.find((item) => item.directive === directive && item.kind === kind && item.sourceModule === sourceModule && item.line === line);
      if (found) found.count++;
      else if (browserReport.cspViolations.length < 20) browserReport.cspViolations.push({ directive, kind, sourceModule, line, column, count: 1 });
    }
  };
  let browser, currentPassword = adminPassword;
  const stage = (name, width) => { setStage(`browser:${name}${width ? `:${width}` : ""}`); };
  const passed = (name, width) => mark(name, width ? { width } : {});
  const cspValid = (headers) => {
    const csp = headers["content-security-policy"] ?? "";
    return csp.includes("default-src 'self'") && /script-src[^;]*'nonce-[a-zA-Z0-9]+'/.test(csp) && !csp.includes("'unsafe-eval'");
  };
  const screenshot = async (page, name, width) => {
    // Clear *all* fields before every capture, including masked passwords and
    // synthetic emails. No screenshot is taken on an exception/failure path.
    await page.$$eval("input,textarea", (fields) => {
      for (const field of fields) {
        const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(field, "");
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForFunction(() => [...document.querySelectorAll("input,textarea")].every((field) => field.value === ""));
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => ({
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      controlsInsideViewport: [...document.querySelectorAll("main input,main button,main a")].every((control) => {
        const rect = control.getBoundingClientRect();
        return !rect.width || (rect.left >= -1 && rect.right <= innerWidth + 1);
      }),
    }));
    check(geometry.scrollWidth <= width + 1 && geometry.controlsInsideViewport, "Browser layout overflow");
    const filename = `browser-${name}-${width}.png`;
    await page.screenshot({ path: resolve(workspace, filename), fullPage: true });
    browserReport.captures.push({ name, width, filename, fieldsEmpty: true, ...geometry });
  };
  const waitText = (page, text) => page.waitForFunction((value) => document.body.textContent.includes(value), {}, text);
  const hydrate = async (page) => {
    await page.waitForFunction(() => document.documentElement.dataset.rehearsalHydrated === "true" || window.__rehearsalRuntimeError);
    check(await page.evaluate(() => document.documentElement.dataset.rehearsalHydrated === "true" && !window.__rehearsalRuntimeError), "Browser hydration rejected by runtime");
  };
  const goto = async (page, path) => {
    const response = await page.goto(REHEARSAL_APP + path, { waitUntil: "domcontentloaded" });
    check(response && response.status() < 400 && cspValid(response.headers()), "Document middleware/CSP missing or refused");
    await hydrate(page);
  };
  const fill = async (page, selector, value) => {
    // A logout triggers a document navigation: SSR inputs can appear before
    // React attaches their handlers. Wait before typing synthetic credentials.
    await hydrate(page);
    await page.waitForSelector(selector);
    await page.$eval(selector, (input) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.type(selector, value);
  };
  const submit = async (page, apiPath) => {
    const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === apiPath && response.request().method() === "POST");
    await page.click('button[type="submit"]');
    return responsePromise;
  };
  const accountLogin = async (page, account, wrong = false) => {
    await fill(page, 'input[name="email"]', account.email);
    await fill(page, 'input[name="password"]', wrong ? "invalid-synthetic-account-password" : account.password);
    const response = await submit(page, "/api/account/login");
    const submitted = JSON.parse(response.request().postData() || "{}");
    const matchesFixture = submitted.email === account.email && submitted.password === (wrong ? "invalid-synthetic-account-password" : account.password);
    browserReport.submissionChecks.push({ form: "account", matchesFixture });
    check(matchesFixture, "Account form input was not captured correctly");
    check(response.status() === (wrong ? 401 : 200), "Account login HTTP status unexpected");
    if (wrong) await page.waitForSelector('[role="alert"]');
    else {
      const data = await response.json();
      check(data.user?.id === account.id, "Account API identity mismatch");
    }
  };
  const adminLogin = async (page, value, wrong = false) => {
    await fill(page, "#admin-password", value);
    const response = await submit(page, "/api/admin/login");
    const matchesFixture = JSON.parse(response.request().postData() || "{}").password === value;
    browserReport.submissionChecks.push({ form: "admin", matchesFixture });
    check(matchesFixture, "Admin form input was not captured correctly");
    check(response.status() === (wrong ? 401 : 200), "Admin login HTTP status unexpected");
    if (wrong) await waitText(page, "Mot de passe administrateur incorrect.");
    else {
      check((await response.json()).success === true, "Admin API did not explicitly confirm success");
      await page.waitForSelector('[data-rehearsal-authorized="true"]');
      check(new URL(page.url()).pathname + new URL(page.url()).search === destination, "Admin destination mismatch");
    }
  };
  const deniedGuard = async (page) => {
    const status = await page.evaluate(async () => (await fetch("/api/admin/newsletter", { cache: "no-store" })).status);
    check(status === 401, "Unprivileged account reached real admin API");
  };
  const accountCta = async (page, width, exerciseAge, captureAge = true) => {
    const href = await page.$eval('a[href^="/compte/connexion?"]', (link) => link.getAttribute("href"));
    const target = new URL(href, REHEARSAL_APP);
    check(target.origin === REHEARSAL_APP && target.searchParams.get("next") === adminHref, "Nested account/admin next path changed");
    await page.click('a[href^="/compte/connexion?"]');
    await page.waitForFunction(() => ["/compte/connexion", "/age-gate"].includes(location.pathname));
    if (exerciseAge) {
      // The middleware intentionally applies its age gate to document requests.
      // Test this boundary explicitly even if the preceding Link used RSC/SPA.
      await goto(page, href);
      check(new URL(page.url()).pathname === "/age-gate", "Age gate did not intercept the account document");
      check(new URL(page.url()).searchParams.get("next") === target.pathname + target.search, "Age gate lost the nested account destination");
      if (captureAge) await screenshot(page, "age-gate", width);
      const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/age-gate/verify" && response.request().method() === "POST");
      await page.$$eval("button", (buttons) => buttons.find((button) => button.textContent === "Oui, j'ai 18 ans ou plus").click());
      check((await responsePromise).status() === 200, "Real age verification API failed");
    }
    await page.waitForFunction(() => location.pathname === "/compte/connexion");
    await hydrate(page);
    check(new URL(page.url()).searchParams.get("next") === adminHref, "Account return path lost after age verification");
    await page.waitForSelector('input[name="email"]');
  };
  const newPage = async (context, width) => {
    const page = await context.newPage();
    await page.setViewport({ width, height: 844 });
    page.setDefaultTimeout(120_000);
    page.setDefaultNavigationTimeout(120_000);
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "fd00:" + randomBytes(14).toString("hex").match(/.{4}/g).join(":") });
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin === REHEARSAL_APP || url.protocol === "data:") void request.continue();
      else { browserReport.blockedRequests++; void request.abort(); }
    });
    page.on("response", (response) => {
      const path = new URL(response.url()).pathname;
      if (path.startsWith("/api/")) report.requests.push({ stage: "browser", path, method: response.request().method(), status: response.status(), width });
    });
    page.on("pageerror", () => { browserReport.pageErrors++; });
    await page.exposeFunction("recordRehearsalCspViolation", async (directive, kind, sourceModule, line, column) => {
      const task = recordCsp(directive, kind, sourceModule, line, column);
      pendingCspChecks.add(task);
      try { await task; } finally { pendingCspChecks.delete(task); }
    });
    await page.evaluateOnNewDocument(() => {
      window.addEventListener("error", () => { window.__rehearsalRuntimeError = true; });
      document.addEventListener("securitypolicyviolation", (event) => {
        window.__rehearsalCspBlocked = true;
        let sourceModule = "browser-internal";
        try {
          const source = new URL(event.sourceFile);
          const filename = source.pathname.split("/").at(-1);
          if (source.origin === location.origin && /^[a-zA-Z0-9_.-]+\.(?:js|mjs)$/.test(filename)) sourceModule = filename;
        } catch { /* Keep only a fixed category for non-URL browser sources. */ }
        void window.recordRehearsalCspViolation(event.effectiveDirective, ["eval", "inline"].includes(event.blockedURI) ? event.blockedURI : "resource", sourceModule, event.lineNumber, event.columnNumber);
      });
    });
    return page;
  };
  try {
    stage("middleware-origin");
    for (const origin of [undefined, "https://origin-rehearsal.invalid"]) {
      const response = await fetch(REHEARSAL_APP + "/api/admin/login", {
        method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: "{}", signal: AbortSignal.timeout(120_000),
      });
      const headers = Object.fromEntries(response.headers);
      const probe = { stage: "browser:middleware-origin", path: "/api/admin/login", method: "POST", status: response.status,
        originCase: origin ? "foreign" : "missing", cspPresent: Boolean(headers["content-security-policy"]), cspValid: cspValid(headers) };
      // Inspect an error only in memory; retain fixed diagnostic categories,
      // never the body, headers, stack, source code or environment values.
      if (response.status >= 500) {
        const errorBody = await response.text();
        probe.diagnostics = [
          ["MODULE_NOT_FOUND", /Module not found|Cannot find module|Can't resolve/],
          ["SERVER_ONLY_IMPORT", /server-only/],
          ["FONT_COMPILATION", /next\/font/],
          ["TAILWIND_COMPILATION", /tailwindcss|postcss/],
          ["MIDDLEWARE_ERROR", /middleware/],
        ].filter(([, pattern]) => pattern.test(errorBody)).map(([code]) => code);
      }
      report.requests.push(probe);
      check(response.status === 403 && cspValid(Object.fromEntries(response.headers)), "Original middleware must reject invalid/missing Origin and return CSP");
    }
    browserReport.middleware = { absentOrigin403: true, foreignOrigin403: true, nonceCspWithoutUnsafeEval: true };
    passed("browser-original-middleware-origin-and-csp");
    stage("launch");
    browser = await puppeteer.launch({
      executablePath: Launcher.getInstallations()[0], pipe: true, headless: true, env: osEnv,
      args: ["--no-sandbox", "--disable-gpu", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"],
    });
    for (const width of browserReport.widths) {
      const context = await browser.createBrowserContext();
      const page = await newPage(context, width);
      stage("account-link-and-age", width);
      await goto(page, adminHref);
      await waitText(page, "Connecte ton compte");
      await screenshot(page, "no-account", width);
      await accountCta(page, width, true);
      await screenshot(page, "account-form", width);
      passed("browser-nested-next-and-real-age-gate", width);
      if (smokeOnly) break;

      stage("wrong-account-password", width);
      await accountLogin(page, accounts[0], true);
      await screenshot(page, "wrong-account-password", width);
      passed("browser-account-password-refused", width);
      stage("account-login-no-elevation", width);
      await accountLogin(page, accounts[0]);
      await page.waitForSelector("#admin-password");
      await deniedGuard(page);
      await screenshot(page, "admin-password", width);
      passed("browser-real-account-login-without-admin-elevation", width);

      stage("admin-password", width);
      await adminLogin(page, "invalid-synthetic-admin-password", true);
      await screenshot(page, "wrong-admin-password", width);
      await adminLogin(page, currentPassword);
      await screenshot(page, "authorized-witness", width);
      passed("browser-admin-password-refused-then-protected-destination", width);

      stage("admin-logout-and-relogin", width);
      await page.click('[data-rehearsal-logout="admin"]');
      await page.waitForSelector("#admin-password");
      await deniedGuard(page);
      await screenshot(page, "admin-logged-out", width);
      await adminLogin(page, currentPassword);
      passed("browser-admin-logout-and-relogin", width);

      stage("account-logout-and-relogin", width);
      await page.click('[data-rehearsal-logout="account"]');
      await waitText(page, "Connecte ton compte");
      await deniedGuard(page);
      await screenshot(page, "account-logged-out", width);
      await accountCta(page, width, false);
      await accountLogin(page, accounts[0]);
      await page.waitForSelector("#admin-password");
      await deniedGuard(page);
      await adminLogin(page, currentPassword);
      passed("browser-account-logout-relogin-requires-admin-password", width);

      stage("password-rotation", width);
      const oldPassword = currentPassword;
      await Promise.all(pendingCspChecks);
      currentPassword = await rotateAdminPassword();
      compilationEpoch++;
      await goto(page, destination);
      await page.waitForSelector("#admin-password");
      await deniedGuard(page);
      await adminLogin(page, oldPassword, true);
      await screenshot(page, "rotated-old-password-refused", width);
      await adminLogin(page, currentPassword);
      await screenshot(page, "rotated-reconnected", width);
      passed("browser-rotation-refuses-old-session-and-password-reconnects", width);
      await context.close();

      stage("forbidden-account", width);
      const forbiddenContext = await browser.createBrowserContext();
      const forbiddenPage = await newPage(forbiddenContext, width);
      await goto(forbiddenPage, adminHref);
      await accountCta(forbiddenPage, width, true, false);
      await accountLogin(forbiddenPage, accounts[1]);
      await waitText(forbiddenPage, "Ta connexion au site reste active.");
      check(await forbiddenPage.$("#admin-password") === null, "Forbidden account sees administrator password form");
      await deniedGuard(forbiddenPage);
      await screenshot(forbiddenPage, "forbidden-account", width);
      passed("browser-forbidden-account-keeps-account-session", width);
      await forbiddenContext.close();
    }
    await Promise.all(pendingCspChecks);
    check(browserReport.pageErrors === 0 && browserReport.blockedRequests === 0 && browserReport.unexpectedCspCount === 0, "Browser runtime/CSP/network diagnostic failed");
  } finally {
    if (browser) {
      await browser.close();
      browserReport.browserClosed = true;
    }
  }
}
