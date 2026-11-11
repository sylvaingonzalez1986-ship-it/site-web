import { createServer } from "node:http";
import net from "node:net";
import { syncBuiltinESMExports } from "node:module";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REHEARSAL_API = "http://127.0.0.1:55321";
export const REHEARSAL_APP = "http://127.0.0.1:55310";

// Applied before importing Next. Fetch and raw TCP may reach only these two
// loopback ports; proxy variables and real service credentials are never passed.
export function installLocalNetworkGuard(onBlocked = () => {}, onExpectedNextDiagnostic) {
  const allowed = new Set([REHEARSAL_API, REHEARSAL_APP]);
  const nativeFetch = globalThis.fetch;
  const nativeConnect = net.Socket.prototype.connect;
  const reject = (expectedNextDiagnostic = false) => {
    if (expectedNextDiagnostic) onExpectedNextDiagnostic();
    else onBlocked();
    throw new Error("ADMIN_REHEARSAL_NETWORK_BLOCKED");
  };
  globalThis.fetch = function localFetch(input, init) {
    let url;
    try { url = new URL(typeof input === "string" || input instanceof URL ? input : input.url); }
    catch { return reject(); }
    if (!allowed.has(url.origin) || url.username || url.password) {
      // Next 16.4.1 calls this unconditionally in hot-reloader-shared-utils.js:33.
      // Keep it BLOCKED, with a separate count only for this exact public GET
      // without headers/body. Any variation remains an unexpected blocked call.
      const request = input instanceof Request ? input : undefined;
      const expected = Boolean(onExpectedNextDiagnostic)
        && url.href === "https://registry.npmjs.org/-/package/next/dist-tags"
        && (init?.method ?? request?.method ?? "GET") === "GET"
        && init?.body == null && request?.body == null
        && [...new Headers(init?.headers ?? request?.headers).keys()].length === 0;
      return reject(expected);
    }
    // A local HTTP redirect cannot turn this into a request to a remote host.
    return nativeFetch.call(this, input, { ...init, redirect: "manual" });
  };
  net.Socket.prototype.connect = function localConnect(...args) {
    const value = Array.isArray(args[0]) ? args[0] : args;
    const options = value[0] && typeof value[0] === "object" ? value[0] : { port: value[0], host: typeof value[1] === "string" ? value[1] : undefined };
    if (options.path || options.host !== "127.0.0.1" || ![55310, 55321].includes(Number(options.port))) return reject();
    return nativeConnect.apply(this, args);
  };
  syncBuiltinESMExports();
  return () => {
    globalThis.fetch = nativeFetch;
    net.Socket.prototype.connect = nativeConnect;
    syncBuiltinESMExports();
  };
}

async function main() {
  const appDir = process.cwd();
  const browserMode = process.env.ADMIN_REHEARSAL_BROWSER === "1";
  if (process.env.ADMIN_REHEARSAL_CONFIRM !== "LOCAL_DISPOSABLE_ONLY"
    || process.env.NEXT_PUBLIC_SUPABASE_URL !== REHEARSAL_API
    || process.env.ADMIN_REHEARSAL_APP_DIR !== appDir
    || !appDir.replaceAll("\\", "/").endsWith(`/output/admin-rehearsal/${browserMode ? "browser-app" : "app"}`)) {
    throw new Error("ADMIN_REHEARSAL_ISOLATION_REQUIRED");
  }
  if ((await readdir(appDir)).some((name) => /^\.env(?:\.|$)/.test(name))) {
    throw new Error("ADMIN_REHEARSAL_ENV_FILE_FORBIDDEN");
  }
  let blocked = 0, expectedNextDiagnosticsBlocked = 0;
  installLocalNetworkGuard(() => {
    blocked++;
    process.send?.({ type: "network-blocked" });
  }, () => {
    expectedNextDiagnosticsBlocked++;
    process.send?.({ type: "next-version-diagnostic-blocked" });
  });
  const { default: next } = await import("next");
  const app = next({
    dir: appDir, dev: true, hostname: "127.0.0.1", port: 55310,
    webpack: true, quiet: true,
    // Documented in the installed Next agentUpgrade guide: false disables
    // development upgrade/advisory checks; no production config is changed.
    conf: {
      distDir: ".next", poweredByHeader: false, images: { unoptimized: true },
      experimental: { agentUpgrade: false }, serverExternalPackages: ["@napi-rs/canvas"],
      ...(browserMode ? { webpack(config, { dev, webpack }) {
        if (dev) {
          // The installed Next dev plugin emits eval(), prohibited by real CSP.
          // Retain CSP and application code; adapt only fixture source maps.
          config.plugins = config.plugins.filter((plugin) => plugin?.constructor?.name !== "EvalSourceMapDevToolPlugin");
          config.plugins.push(new webpack.SourceMapDevToolPlugin({ filename: "[file].map" }));
        }
        return config;
      } } : {}),
    },
  });
  await app.prepare();
  const handle = app.getRequestHandler();
  const paths = new Set(["/api/admin/login", "/api/admin/logout", "/api/admin/newsletter"]);
  if (browserMode) for (const path of ["/api/account/login", "/api/account/logout", "/api/age-gate/verify", "/admin/login", "/admin/rehearsal", "/compte/connexion", "/age-gate", "/mascots/home-welcome.png"]) paths.add(path);
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, REHEARSAL_APP).pathname;
    if (!paths.has(pathname) && !(browserMode && pathname.startsWith("/_next/"))) {
      response.writeHead(404).end();
      return;
    }
    void handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
    await app.close();
    process.send?.({ type: "closed", blocked, expectedNextDiagnosticsBlocked });
    process.exit(0);
  };
  process.on("message", (message) => { if (message?.type === "shutdown") void close(); });
  process.on("SIGTERM", () => { void close(); });
  process.on("SIGINT", () => { void close(); });
  process.on("disconnect", () => { void close(); });
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(55310, "127.0.0.1", done);
  });
  process.send?.({ type: "ready" });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.send?.({ type: "failed" });
    // Do not print Next errors, request bodies, environment values or cookies.
    process.exit(1);
  });
}
