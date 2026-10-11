// Synthetic browser audit of the actual player component. All API calls are
// intercepted; no session, credentials, environment files or live database.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/arena-budget");
const origin = "http://127.0.0.1:3248";
const componentPath = "src/components/placard/KanabQuestDicePrototype.tsx";
// Pin the pre-optimization revision so the comparison survives this commit.
const baselineCommit = "c28a0c7ddde474c71830a78820d15790b3f3b483";
const baselineId = `${resolve(root, componentPath).replaceAll("\\", "/")}?budget-baseline`;
const baselineSource = execFileSync("git", ["show", `${baselineCommit}:${componentPath}`], { cwd: root, encoding: "utf8", maxBuffer: 2_000_000 });
const modules = {
  "budget-entry": `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import '/src/app/globals.css';
    import { KanabQuestDicePrototype as Current } from '/${componentPath}';
    import { KanabQuestDicePrototype as Baseline } from 'budget-baseline';
    const Component = new URLSearchParams(location.search).get('version') === 'before' ? Baseline : Current;
    const root = createRoot(document.getElementById('root')); let render = 0;
    sessionStorage.clear(); localStorage.clear();
    window.__budgetRender = () => {
      root.render(<div data-budget-render={++render}><Component apiScope="player" showAdminOperations={false} viewMode="game" showPackLab={render % 2 === 0}/></div>);
      return render;
    };
    window.__budgetRender();
  `,
  "next/image": `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) { return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>; }`,
  "next/link": `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}) { return <a {...props}/>; }`,
  "next/navigation": `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}}); export const usePathname=()=>'/arene/placard'; export const useSearchParams=()=>new URLSearchParams();`,
};

const progress = {
  seasonCode: "KQ-2026-S1", rank: 7, placardScore: 1337, rating: 1160,
  seasonPoints: 87, reputation: 246, wins: 12, losses: 3, streak: 2,
  arenaExperience: 51, claimedChallengeCodes: [], leaderboardGeneratedAt: new Date().toISOString(),
};
const session = { activeRun: null, flowers: [], battles: [], progress, warnings: [], buddieRotation: { requiredDistinctBuddies: 5, recentBuddieCodes: [] } };
const bootstrap = {
  collection: { ownerFound: true, collectionActive: true, inventory: { "BOTTE-003": 4, "BOTTE-017": 3 }, cards: [], cultureTokenBalance: 0 },
  ownedBuddieCodes: ["HH2026-003"], ownedBuddies: [{ code: "HH2026-003", ownedCopies: 2, imageUrl: "" }],
  heritage: { collectionActive: true, fragmentBalance: 0, cards: [] },
  routePlan: null, buddieRotation: session.buddieRotation,
};
const ranking = { entries: [{ rank: 1, pseudo: "Synthetic champion", placardScore: 1490, rating: 1200, seasonPoints: 150, reputation: 400, wins: 30, losses: 7, streak: 3 }] };
const measuredPaths = ["bootstrap", "rankings", "me", "session"];
const report = {
  passed: false, baselineCommit, results: [], errors: [], blockedRequests: [], unexpectedApiRequests: [],
  scope: "Real player component and season board; synthetic API fixtures, Next image/link/navigation shims; no backend or external network.",
  limitation: "Request budget only; this is not a production latency or invoice measurement. Baseline uses the pinned pre-optimization component with current dependencies.",
};

await mkdir(output, { recursive: true });
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, "vite-cache"), publicDir: resolve(root, "public"),
  optimizeDeps: { include: ["react", "react-dom/client", "lucide-react", "next/dynamic"] },
  resolve: { alias: { "@": resolve(root, "src") } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "arena-budget-audit", enforce: "pre",
    resolveId(id) {
      if (id === "budget-baseline") return baselineId;
      if (id in modules) return "\0" + id;
    },
    async load(id) {
      if (id === baselineId) return baselineSource;
      if (id.startsWith("\0") && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", { lang: "tsx", jsx: { runtime: "automatic" } })).code;
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/") return next();
        res.setHeader("Content-Type", "text/html");
        res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local request budget</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__budget-entry"></script></html>');
      });
    },
  }],
  server: { host: "127.0.0.1", port: 3248, strictPort: true, hmr: false, watch: null },
});

let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  for (const [version, scenario] of [["before", "normal"], ["after", "normal"], ["after", "cold-bootstrap"], ["after", "missing-session"], ["after", "warning-session"]]) {
    const page = await browser.newPage();
    const requests = [];
    const scenarioLabel = `${version}-${scenario}`;
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(60000);
    await page.setViewport({ width: 390, height: 844 });
    page.on("pageerror", error => report.errors.push({ scenario: scenarioLabel, message: error.message }));
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/")) {
        requests.push({ method: request.method(), path: url.pathname });
        let body;
        if (url.pathname === "/api/arena/placard/bootstrap") body = {
          ...bootstrap,
          playerSession: scenario === "missing-session" ? null : scenario === "warning-session"
            ? { ...session, progress: { ...progress, placardScore: 1, reputation: 1 }, warnings: ["Temporary session failure"] }
            : scenario === "cold-bootstrap"
              ? { ...session, progress: { ...progress, rank: 84, leaderboardGeneratedAt: new Date(Date.now() - 300_000).toISOString() } }
              : session,
        };
        else if (url.pathname === "/api/arena/placard/rankings") body = ranking;
        else if (url.pathname === "/api/arena/placard/me") body = { progress };
        else if (url.pathname === "/api/arena/placard/session") body = session;
        else if (url.pathname === "/api/arena/placard/equipment") body = { equipment: [], cashCents: 0, strength: "green-thumb" };
        else {
          report.unexpectedApiRequests.push({ scenario: scenarioLabel, path: url.pathname });
          body = { error: "API not covered by this synthetic audit" };
        }
        void request.respond({ status: body.error ? 503 : 200, contentType: "application/json", body: JSON.stringify(body) });
      } else if (url.origin === origin || url.protocol === "data:") void request.continue();
      else { report.blockedRequests.push({ scenario: scenarioLabel, url: request.url() }); void request.abort(); }
    });
    await page.goto(`${origin}/?version=${version}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-kq-season-board]");
    await page.waitForFunction(() => {
      const board = document.querySelector("[data-kq-season-board]");
      return board?.textContent.includes("246 de réputation") && board?.textContent.includes("#7");
    });
    const displayed = await page.$eval("[data-kq-season-board]", board => {
      const score = [...board.querySelectorAll("dt")].find(element => element.textContent === "Score Placard")?.parentElement.querySelector("dd")?.textContent;
      return { score: Number(score?.replace(/\s/g, "")), reputation: board.textContent.includes("246 de réputation"), rank: board.textContent.includes("#7") };
    });
    assert.deepEqual(displayed, { score: 1337, reputation: true, rank: true }, `${scenarioLabel}: bootstrap/session values are displayed`);
    await page.waitForNetworkIdle({ idleTime: 350 });
    const counts = () => Object.fromEntries(measuredPaths.map(endpoint => [endpoint, requests.filter(request => request.path === `/api/arena/placard/${endpoint}`).length]));
    const initialCounts = counts();
    if (version === "after") assert.deepEqual(initialCounts, scenario === "normal"
      ? { bootstrap: 1, rankings: 1, me: 0, session: 0 }
      : scenario === "cold-bootstrap"
        ? { bootstrap: 1, rankings: 1, me: 1, session: 0 }
        : { bootstrap: 1, rankings: 1, me: 1, session: 1 }, `${scenarioLabel}: request budget`);

    for (let iteration = 0; iteration < 5; iteration++) {
      const render = await page.evaluate(() => window.__budgetRender());
      await page.waitForSelector(`[data-budget-render="${render}"]`);
    }
    await page.waitForNetworkIdle({ idleTime: 350 });
    assert.deepEqual(counts(), initialCounts, `${scenarioLabel}: parent rerenders do not reload the session or ranking`);
    await page.$eval("[data-kq-season-board] details", element => { element.open = true; });
    if (version === "after" && scenario === "normal") await page.$eval("[data-kq-season-board]", element => element.scrollIntoView());
    if (version === "after" && scenario === "normal") await page.screenshot({ path: resolve(output, "normal-player.png"), fullPage: true });
    report.results.push({ version, scenario, initialCounts, countsAfterFiveRerenders: counts(), displayed, requests });
    await page.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.unexpectedApiRequests, []);
  assert.deepEqual(report.blockedRequests, []);
  const before = report.results.find(result => result.version === "before").initialCounts;
  const after = report.results.find(result => result.version === "after" && result.scenario === "normal").initialCounts;
  report.rankingRequests = { before: before.rankings + before.me, after: after.rankings + after.me };
  report.passed = true;
  console.log(JSON.stringify({ passed: true, rankingRequests: report.rankingRequests, results: report.results.map(({ version, scenario, initialCounts, countsAfterFiveRerenders, displayed }) => ({ version, scenario, initialCounts, countsAfterFiveRerenders, displayed })), output }, null, 2));
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
}
