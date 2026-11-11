/** Real Next handlers + dedicated disposable Supabase. Never loads .env files. */
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { installLocalNetworkGuard, REHEARSAL_API, REHEARSAL_APP } from "./lib/admin-rehearsal-server.mjs";

const root = process.cwd();
const workspace = resolve(root, "output/admin-rehearsal");
const browserMode = process.argv.includes("--browser");
const browserSmoke = browserMode && process.argv.includes("--browser-smoke");
const appDir = resolve(workspace, browserMode ? "browser-app" : "app");
const reportName = browserSmoke ? "browser-smoke-report.json" : browserMode ? "browser-report.json" : "report.json";
const adminCookieName = "lcb_admin_session";
const routes = ["admin/login", "admin/logout", "admin/newsletter"];
const osNames = new Set(["systemroot", "windir", "comspec", "path", "pathext", "temp", "tmp", "userprofile", "appdata", "localappdata", "programfiles", "programfiles(x86)", "programdata", "homedrive", "homepath"]);
const osEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => osNames.has(name.toLowerCase())));
const digest = (value) => createHash("sha256").update(value).digest("hex");
const check = (valid, label) => { if (!valid) throw new Error(label); };
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const password = () => randomBytes(30).toString("base64url") + "aA1!";
function passwordHash(value) {
  const salt = randomBytes(24);
  return ["scrypt", salt.toString("base64"), scryptSync(value, salt, 64).toString("base64")].join("$");
}
function checked(result, label) {
  check(!result.error, label);
  return result.data;
}
function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
function applyCookies(jar, response) {
  for (const raw of response.headers.getSetCookie()) {
    const pair = raw.split(";", 1)[0], separator = pair.indexOf("=");
    const name = pair.slice(0, separator), value = pair.slice(separator + 1);
    if (/;\s*max-age=0(?:;|$)/i.test(raw) || !value) jar.delete(name);
    else jar.set(name, value);
  }
}

async function prepareApp() {
  await mkdir(appDir, { recursive: true });
  const names = await readdir(appDir);
  check(!names.some((name) => /^\.env(?:\.|$)/.test(name)), "An env file exists in the isolated app; refusing to load it");
  // Copy only application source. No repository config, middleware, proxy,
  // instrumentation, secret output, environment file or production assets.
  for (const directory of ["lib", "types", "data"]) {
    await cp(resolve(root, "src", directory), resolve(appDir, "src", directory), {
      recursive: true,
      filter: (path) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path),
    });
  }
  const sources = [];
  for (const route of routes) {
    const relative = `src/app/api/${route}/route.ts`;
    const source = await readFile(resolve(root, relative));
    await mkdir(resolve(appDir, `src/app/api/${route}`), { recursive: true });
    await writeFile(resolve(appDir, relative), source);
    sources.push({ path: relative, sha256: digest(source) });
  }
  await writeFile(resolve(appDir, "package.json"), JSON.stringify({ name: "admin-access-rehearsal", private: true }));
  await writeFile(resolve(appDir, "tsconfig.json"), JSON.stringify({ compilerOptions: {
    target: "ES2017", lib: ["dom", "dom.iterable", "esnext"], allowJs: true,
    skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true,
    module: "esnext", moduleResolution: "bundler", resolveJsonModule: true,
    isolatedModules: true, jsx: "react-jsx", incremental: true, baseUrl: ".",
    plugins: [{ name: "next" }], paths: { "@/*": ["./src/*"] },
  }, include: ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] }, null, 2));
  await writeFile(resolve(appDir, "next.config.mjs"), "export default { poweredByHeader: false, experimental: { agentUpgrade: false } };\n");
  await writeFile(resolve(appDir, "postcss.config.mjs"), "export default { plugins: {} };\n");
  await writeFile(resolve(appDir, "src/app/layout.tsx"), "export default function Layout({ children }: { children: React.ReactNode }) { return <html lang=\"fr\"><body>{children}</body></html>; }\n");
  if (browserMode) {
    const { prepareAdminBrowserApp } = await import("./lib/admin-rehearsal-browser.mjs");
    sources.push(...await prepareAdminBrowserApp({ root, appDir, digest }));
  }
  return sources;
}

async function main() {
  check(process.argv.includes("--run"), "Use --run only after the dedicated disposable local instance is ready");
  const report = {
    startedAt: new Date().toISOString(), passed: false, mode: browserSmoke ? "browser-smoke" : browserMode ? "browser" : "api", apiOrigin: REHEARSAL_API, appOrigin: REHEARSAL_APP,
    scope: "Real copied Next admin login/logout/newsletter handlers, real Supabase Auth, rate-limit RPC and persistent admin_sessions. Synthetic accounts and administrator passwords only.",
    isolation: { childEnvironment: "OS allowlist plus synthetic/local values", envFilesLoaded: false, productionConfigCopied: false, network: "fetch and raw TCP restricted to exact loopback ports 55310 and 55321", credentialsOrCookiesRecorded: false },
    limits: ["Does not execute /api/account/login or its UI; account sessions are established by the real Supabase Auth SDK with SSR cookies.", "Does not execute application middleware/proxy, Origin/CSP checks, production deployment, iPhone/Safari or other admin screens.", "NODE_ENV=development on local HTTP: production Secure-cookie transport is not exercised.", "Next development upgrade reminders are disabled only in the isolated app. Its unconditional public version-metadata GET is blocked before network access and counted separately; any other blocked request fails the rehearsal."],
    checks: [], requests: [], sources: [], cleanup: { serverStopped: false, accountsRemoved: false },
  };
  if (browserMode) {
    report.scope = "Real Chromium account/admin/age-gate pages and forms, copied middleware, real Next APIs and local Supabase Auth with synthetic accounts. Protected destination and logout controls are explicitly local witnesses.";
    report.limits = [
      ...(browserSmoke ? ["Bootstrap smoke only: Origin/CSP, hydration and age-gate/account return at 320px; authentication/logout/rotation scenarios are intentionally not executed."] : []),
      "Minimal root layout: real global CSS, local fonts, admin layout and navigation components; the shop shell, menus, site UI variants and other screens are not loaded.",
      "Cart context only retains the user supplied by the real login API in memory; cart hydration and store APIs are outside this rehearsal.",
      "The age gate is exercised through document navigation to the actual account CTA href; this does not validate age handling for every SPA transition in the full shell.",
      "Chromium at 320/390px, not physical iPhone/Safari. Local development HTTP does not exercise production Secure-cookie transport.",
      "The isolated development compiler replaces eval source maps with external source maps to preserve the original middleware CSP. Production compilation/deployment is not covered.",
      "React development debug eval probes remain blocked by the unchanged CSP. Only exact known expressions mapped to the installed React RSC development source are counted separately; any other CSP violation fails the rehearsal.",
      "The middleware's original bytes are copied beside src/app only in the fixture because this Next dev Webpack watcher ignores the repository-root location. The application's default Turbopack build discovers the original root file; this rehearsal does not validate production compiler discovery. Source/fixture paths and byte equality are recorded.",
      "Upgrade reminders are disabled in this fixture. The unconditional public Next version GET remains blocked and counted separately; all other unexpected network requests fail.",
    ];
  }
  let stage = "prepare", service, server, childBlocked = 0, parentBlocked = 0, expectedNextDiagnosticsBlocked = 0;
  const createdUsers = [];
  const restoreNetwork = installLocalNetworkGuard(() => { parentBlocked++; });
  const mark = (name, extra = {}) => { report.checks.push({ name, passed: true, ...extra }); console.log(`PASS ${name}`); };
  const runIp = "fd00:" + randomBytes(14).toString("hex").match(/.{4}/g).join(":");
  async function request(jar, path, body) {
    check(routes.some((route) => path === `/api/${route}`), "Unexpected rehearsal route");
    const response = await fetch(`${REHEARSAL_APP}${path}`, {
      method: body ? "POST" : "GET", signal: AbortSignal.timeout(120_000),
      headers: { cookie: cookieHeader(jar), origin: REHEARSAL_APP, "content-type": "application/json", "x-forwarded-for": runIp },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    report.requests.push({ stage, path, method: body ? "POST" : "GET", status: response.status });
    let data;
    try { data = await response.json(); } catch { throw new Error("Route did not return JSON"); }
    applyCookies(jar, response);
    return { response, data };
  }
  async function stopServer() {
    if (!server) return;
    const current = server;
    server = undefined;
    if (current.exitCode === null && current.signalCode === null) {
      const stopped = new Promise((done) => current.once("exit", done));
      if (current.connected) current.send({ type: "shutdown" });
      await Promise.race([stopped, delay(12_000)]);
      if (current.exitCode === null && current.signalCode === null) {
        current.kill();
        await Promise.race([stopped, delay(5000)]);
      }
    }
    check(current.exitCode !== null || current.signalCode !== null, "Isolated Next process did not stop");
    report.cleanup.serverStopped = true;
  }
  async function startServer(env) {
    report.cleanup.serverStopped = false;
    server = spawn(process.execPath, [resolve(root, "scripts/lib/admin-rehearsal-server.mjs")], {
      cwd: appDir, env, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    server.on("message", (message) => {
      if (message?.type === "network-blocked") childBlocked++;
      if (message?.type === "next-version-diagnostic-blocked") expectedNextDiagnosticsBlocked++;
      if (message?.type === "fixture-compilation") {
        report.browserCompilation ??= [];
        report.browserCompilation.push({ evalSourceMapsRemoved: Number(message.evalSourceMapsRemoved), externalSourceMaps: message.externalSourceMaps === true });
      }
    });
    await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(new Error("Isolated Next startup timed out")), 120_000);
      const finish = (error) => {
        clearTimeout(timer);
        if (error) reject(error);
        else done();
      };
      server.once("error", () => finish(new Error("Isolated Next could not start")));
      server.once("exit", () => finish(new Error("Isolated Next exited before readiness")));
      server.on("message", (message) => {
        if (message?.type === "ready") finish();
        if (message?.type === "failed") finish(new Error("Isolated Next preparation failed"));
      });
    });
  }
  try {
    const config = await readFile(resolve(workspace, "supabase/config.toml"), "utf8");
    check(/^project_id\s*=\s*"admin-access-rehearsal"\s*$/m.test(config), "Dedicated Supabase project_id required");
    stage = "local-cli-status";
    // stdout/stderr stay in memory; no keys, environment dumps or CLI error output.
    let status;
    try {
      status = JSON.parse(execFileSync("supabase.exe", ["status", "--workdir", workspace, "-o", "json"], {
        env: osEnv, encoding: "utf8", windowsHide: true, timeout: 30_000, stdio: ["ignore", "pipe", "pipe"],
      }));
    } catch { throw new Error("Dedicated local Supabase status unavailable"); }
    check(status.API_URL === REHEARSAL_API && status.ANON_KEY && status.SERVICE_ROLE_KEY, "Dedicated local Supabase API and keys required");
    if (status.DB_URL) {
      const database = new URL(status.DB_URL);
      check(database.hostname === "127.0.0.1" && database.port === "55322", "Dedicated local database port required");
    }
    const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
    const serviceKey = status.SECRET_KEY || status.SERVICE_ROLE_KEY;
    service = createClient(REHEARSAL_API, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    stage = "source-copy";
    report.sources = await prepareApp();
    mark("isolated-source-and-local-instance");
    stage = "synthetic-accounts";
    const accounts = [];
    for (const role of ["allowed", "forbidden"]) {
      const email = `admin-rehearsal-${role}-${randomUUID()}@example.test`;
      const accountPassword = password();
      const data = checked(await service.auth.admin.createUser({ email, password: accountPassword, email_confirm: true }), "Local account creation failed");
      createdUsers.push(data.user.id);
      accounts.push({ role, email, password: accountPassword, id: data.user.id });
    }
    async function signIn(account) {
      const jar = new Map();
      const client = createServerClient(REHEARSAL_API, publicKey, {
        cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (values) => values.forEach(({ name, value }) => value ? jar.set(name, value) : jar.delete(name)) },
      });
      const session = checked(await client.auth.signInWithPassword({ email: account.email, password: account.password }), "Local Auth sign-in failed");
      check(session.user.id === account.id && jar.size > 0, "Local Auth identity mismatch");
      const identity = checked(await client.auth.getUser(), "Local Auth validation failed");
      check(identity.user.id === account.id, "Local Auth getUser identity mismatch");
      return jar;
    }
    const allowed = accounts[0], forbidden = accounts[1];
    const adminPassword = password(), rotatedPassword = password();
    const env = { ...osEnv, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1",
      ADMIN_REHEARSAL_CONFIRM: "LOCAL_DISPOSABLE_ONLY", ADMIN_REHEARSAL_APP_DIR: appDir,
      ADMIN_REHEARSAL_BROWSER: browserMode ? "1" : "0",
      NEXT_PUBLIC_SUPABASE_URL: REHEARSAL_API, NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey, ADMIN_ALLOWED_EMAILS: allowed.email,
      ADMIN_SESSION_SECRET: randomBytes(48).toString("base64url"), ADMIN_PASSWORD_HASH: passwordHash(adminPassword),
      ADMIN_TOTP_SECRET: "", SENTRY_DSN: "", NEXT_PUBLIC_SENTRY_DSN: "",
    };
    stage = "initial-server-start";
    await startServer(env);
    if (browserMode) {
      const { rehearseAdminBrowser } = await import("./lib/admin-rehearsal-browser.mjs");
      await rehearseAdminBrowser({
        accounts, adminPassword, osEnv, workspace, report, mark, smokeOnly: browserSmoke,
        setStage: (value) => { stage = value; },
        rotateAdminPassword: async () => {
          const nextPassword = password();
          await stopServer();
          await startServer({ ...env, ADMIN_PASSWORD_HASH: passwordHash(nextPassword) });
          return nextPassword;
        },
      });
    } else {
    let allowedJar = await signIn(allowed);
    const forbiddenJar = await signIn(forbidden);
    mark("real-auth-signin-and-getUser", { syntheticAccounts: 2 });
    stage = "anonymous-login";
    let reply = await request(new Map(), "/api/admin/login", { password: adminPassword });
    check(reply.response.status === 401 && reply.data.code === "account_session_required", "Anonymous admin login must return 401");
    mark("no-account-401");
    stage = "forbidden-account";
    reply = await request(forbiddenJar, "/api/admin/login", { password: adminPassword });
    check(reply.response.status === 403 && reply.data.code === "admin_account_required", "Forbidden account must return 403");
    check(!forbiddenJar.has(adminCookieName), "Forbidden account received admin cookie");
    mark("forbidden-account-403");
    stage = "wrong-password";
    reply = await request(allowedJar, "/api/admin/login", { password: password() });
    check(reply.response.status === 401 && !allowedJar.has(adminCookieName), "Wrong password must return 401 without admin cookie");
    mark("wrong-admin-password-401");
    stage = "initial-admin-login";
    reply = await request(allowedJar, "/api/admin/login", { password: adminPassword });
    check(reply.response.status === 200 && reply.data.success === true && allowedJar.has(adminCookieName), "Explicit admin login failed");
    const header = reply.response.headers.getSetCookie().find((value) => value.startsWith(adminCookieName + "="));
    check(header && /;\s*HttpOnly/i.test(header) && /;\s*SameSite=Strict/i.test(header) && /;\s*Path=\//i.test(header), "Admin cookie attributes missing");
    const token = allowedJar.get(adminCookieName), tokenHash = digest(token);
    const stored = checked(await service.from("admin_sessions").select("customer_id,expires_at,credential_fingerprint").eq("token_hash", tokenHash).maybeSingle(), "Stored admin session read failed");
    check(stored?.customer_id === allowed.id && Date.parse(stored.expires_at) > Date.now() && stored.credential_fingerprint === digest(JSON.stringify([env.ADMIN_PASSWORD_HASH, ""])), "Stored session identity or fingerprint mismatch");
    mark("login-cookie-and-durable-session");
    stage = "real-admin-guard";
    reply = await request(allowedJar, "/api/admin/newsletter");
    check(reply.response.status === 200 && Array.isArray(reply.data.subscribers) && reply.data.subscribers.length === 0, "Authorized newsletter read failed");
    reply = await request(new Map(), "/api/admin/newsletter");
    check(reply.response.status === 401, "Anonymous admin guard must deny");
    reply = await request(new Map([[adminCookieName, token]]), "/api/admin/newsletter");
    check(reply.response.status === 401, "Admin cookie without account must deny");
    const mismatchedJar = new Map(forbiddenJar); mismatchedJar.set(adminCookieName, token);
    reply = await request(mismatchedJar, "/api/admin/newsletter");
    check(reply.response.status === 401, "Admin cookie bound to another account must deny");
    mark("real-guard-authorized-anonymous-and-account-binding");
    stage = "restart-persistence";
    await stopServer();
    await startServer(env);
    reply = await request(allowedJar, "/api/admin/newsletter");
    check(reply.response.status === 200, "Stored session did not survive server restart");
    mark("session-persists-across-server-restart");
    stage = "logout-replay";
    const replayJar = new Map(allowedJar);
    reply = await request(allowedJar, "/api/admin/logout", {});
    check(reply.response.status === 200 && reply.data.success === true && !allowedJar.has(adminCookieName), "Admin logout failed");
    const revoked = checked(await service.from("admin_sessions").select("customer_id").eq("token_hash", tokenHash).maybeSingle(), "Revocation database read failed");
    check(revoked === null, "Logout did not remove persistent session");
    reply = await request(replayJar, "/api/admin/newsletter");
    check(reply.response.status === 401, "Revoked admin cookie replay accepted");
    mark("logout-deletes-session-and-replay-401");
    stage = "login-before-rotation";
    reply = await request(allowedJar, "/api/admin/login", { password: adminPassword });
    check(reply.response.status === 200 && reply.data.success === true, "Re-login after logout failed");
    const previousJar = new Map(allowedJar);
    stage = "password-rotation";
    await stopServer();
    await startServer({ ...env, ADMIN_PASSWORD_HASH: passwordHash(rotatedPassword) });
    reply = await request(previousJar, "/api/admin/newsletter");
    check(reply.response.status === 401, "Old session survived administrator password rotation");
    allowedJar = await signIn(allowed);
    reply = await request(allowedJar, "/api/admin/login", { password: adminPassword });
    check(reply.response.status === 401 && !allowedJar.has(adminCookieName), "Old administrator password accepted after rotation");
    reply = await request(allowedJar, "/api/admin/login", { password: rotatedPassword });
    check(reply.response.status === 200 && reply.data.success === true && allowedJar.has(adminCookieName), "Re-login with rotated password failed");
    reply = await request(allowedJar, "/api/admin/newsletter");
    check(reply.response.status === 200, "New session guard failed after password rotation");
    mark("rotation-rejects-old-cookie-and-password-new-login-works");
    }
    check(parentBlocked === 0 && childBlocked === 0, "Unexpected network request blocked");
    report.passed = true;
  } catch {
    report.failedStage = stage;
    report.passed = false;
  } finally {
    try { await stopServer(); } catch { report.passed = false; report.cleanup.serverStopped = false; }
    if (service) {
      let removed = 0;
      for (const id of createdUsers) {
        const result = await service.auth.admin.deleteUser(id).catch(() => ({ error: true }));
        if (!result.error) removed++;
      }
      report.cleanup.accountsRemoved = removed === createdUsers.length;
      if (!report.cleanup.accountsRemoved) report.passed = false;
    }
    report.networkBlocked = { parent: parentBlocked, child: childBlocked };
    report.expectedNextDiagnosticsBlocked = { publicVersionMetadataGet: expectedNextDiagnosticsBlocked, networkAccessAllowed: false, upgradeReminders: false };
    report.finishedAt = new Date().toISOString();
    await mkdir(workspace, { recursive: true });
    await writeFile(resolve(workspace, reportName), JSON.stringify(report, null, 2));
    restoreNetwork();
  }
  check(report.passed, "Local admin rehearsal failed; see the secret-free report stage");
  console.log(`Admin local rehearsal passed: ${report.checks.length} checks. Report: output/admin-rehearsal/${reportName}`);
}

main().catch(() => {
  console.error(`Admin local rehearsal did not pass. See output/admin-rehearsal/${reportName}; no credentials or server logs are printed.`);
  process.exitCode = 1;
});
