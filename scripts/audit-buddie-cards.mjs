// Local rendering of the real card and stylesheet, with no remote requests or writes.
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/buddies-refonte/card-checks");
const origin = "http://127.0.0.1:3224";
const modules = {
  "buddie-card-audit": `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {BuddieCard} from '/src/components/lottery/BuddieCard';
    import {KQ_BUDDIES} from '/src/lib/kanab-quest-game';
    const query=new URLSearchParams(location.search),width=Number(query.get('width')||240);
    const rarities=['common','silver','gold','epic','legendary'];
    const names=['Strawberry CBD','Cherry Wine','ACDC','Harlequin',"L’Arbre Mère — Toutes Variétés"];
    const codes=['HH2026-020','HH2026-011','HH2026-005','HH2026-004','HH2026-001'];
    const collection=query.has('collection'),start=Number(query.get('start')||0),count=Number(query.get('count')||52);
    const examples=collection?KQ_BUDDIES.slice(start,start+count):query.has('pilots')?rarities.map((rarity,i)=>({rarity,name:names[i],code:codes[i],cardNumber:Number(codes[i].slice(-3))})):rarities.map(rarity=>({rarity,name:'Strawberry CBD',code:'HH2026-020',cardNumber:20}));
    function App(){return <main style={{padding:32}}><h1>{collection?'Les Buddies · Collection complète':query.has('pilots')?'Buddies · Progression de finition':'Buddies · Comparaison des cinq cadres'}</h1><p>{collection?'52 personnages · 5 raretés':width+' px · Scène 4:5 · Carte 2:3'}</p><div id="cards" style={{display:collection?'grid':'flex',gridTemplateColumns:collection?'repeat(auto-fit, minmax(min(100%, '+width+'px), 1fr))':undefined,gap:24,alignItems:'flex-start'}}>{examples.map((example,i)=><section key={example.code+'-'+i} style={{width:'100%',maxWidth:width,flexShrink:0}}><BuddieCard {...example} priority/><p>{collection?example.name:example.rarity}</p></section>)}</div>{!collection&&<div id="edge-cases" style={{display:'flex',gap:24,marginTop:48}}><section id="long-name" style={{width}}><BuddieCard code="HH2026-020" name="L’Arbre Mère — Toutes Variétés" rarity="legendary" cardNumber={1}/><p>Nom long</p></section><section id="hidden" style={{width}}><BuddieCard code="HH2026-020" name="Nom secret à ne pas révéler" rarity="epic" cardNumber={4} hidden/><p>Carte manquante</p></section><section id="legacy" style={{width}}><BuddieCard code="LEGACY-AUDIT" name="Carte historique" rarity="gold" cardNumber={5} imageUrl="/__legacy.png"/><p>Image historique</p></section></div>}</main>}
    createRoot(document.getElementById('root')).render(<App/>);
  `,
  "next/image": `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
};
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, "vite-cache"), publicDir: resolve(root, "public"),
  optimizeDeps: { include: ["react", "react-dom/client"] },
  resolve: { alias: { "@": resolve(root, "src") } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "buddie-card-audit", enforce: "pre",
    resolveId(id) { if (id in modules) return "\0" + id; },
    async load(id) {
      if (id.startsWith("\0") && modules[id.slice(1)]) {
        return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", { lang: "tsx", jsx: { runtime: "automatic" } })).code;
      }
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] === "/__legacy.png") {
          res.setHeader("Content-Type", "image/png");
          createReadStream(resolve(root, "public/app/lottery/tcg-card-back.png")).pipe(res);
          return;
        }
        if (req.url?.split("?")[0] !== "/") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:AuditDisplay;src:url('/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2');font-weight:800}@font-face{font-family:AuditBody;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:400 700}:root{--font-display:AuditDisplay;--font-body:AuditBody}body{margin:0;background:#e6e1d4;color:#173d32}h1{font-family:AuditDisplay;font-size:32px;margin:0}p{font-size:14px;margin:12px 0 24px}</style><div id="root"></div><script type="module" src="/@id/__x00__buddie-card-audit"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port: 3224, strictPort: true, hmr: false, watch: null },
});

let browser;
const errors = [], results = [], blockedRequests = [];
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(output, "chrome-profile"), args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().startsWith(origin) || request.url().startsWith("data:")) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  for (const width of [160, 240, 384]) {
    await page.setViewport({ width: width * 5 + 160, height: width * 3 + 360, deviceScaleFactor: 1 });
    await page.goto(`${origin}/?width=${width}`, { waitUntil: "networkidle0" });
    await page.waitForSelector('#cards [data-artwork="scene"]');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))));
    const measurements = await page.$$eval('#cards [role="img"]', (cards) => cards.map((card) => {
      const rect = card.getBoundingClientRect();
      const scene = card.querySelector('[class*="scene"]');
      const title = card.querySelector('[class*="title"]');
      const image = scene?.querySelector('img');
      const sr = scene?.getBoundingClientRect();
      return { rarity: card.getAttribute('data-rarity'), width: rect.width, height: rect.height, scene: sr ? { x: sr.x - rect.x, y: sr.y - rect.y, width: sr.width, height: sr.height } : null, titleOverflow: title?.scrollHeight > title?.clientHeight + 1, imageLoaded: !!image?.naturalWidth, fit: image ? getComputedStyle(image).objectFit : null };
    }));
    assert.equal(measurements.length, 5);
    for (const card of measurements) {
      assert.ok(Math.abs(card.width - width) < 1);
      assert.ok(Math.abs(card.height / card.width - 1.5) < 0.005);
      assert.ok(Math.abs(card.scene.height / card.scene.width - 1.25) < 0.005);
      assert.deepEqual(card.scene, measurements[0].scene);
      assert.equal(card.titleOverflow, false);
      assert.equal(card.imageLoaded, true);
      assert.equal(card.fit, "contain");
    }
    assert.equal(await page.$eval('#hidden [role="img"]', (card) => card.outerHTML.includes('Nom secret')), false);
    assert.equal(await page.$eval('#hidden [class*="title"]', (title) => title.textContent), "Carte mystère");
    assert.equal(await page.$$eval('#hidden img', (images) => images.length), 1);
    const missingArtwork = await page.$eval('#hidden img', (image) => ({ loaded: image.complete && image.naturalWidth > 0, filter: getComputedStyle(image).filter }));
    assert.equal(missingArtwork.loaded, true);
    assert.match(missingArtwork.filter, /grayscale\(1\)/);
    assert.equal(await page.$$eval('#legacy svg', (svgs) => svgs.length), 0);
    assert.equal(await page.$eval('#legacy img', (image) => getComputedStyle(image).objectFit), "contain");
    await page.screenshot({ path: resolve(output, `frames-${width}.png`), fullPage: true });
    const longName = await page.$eval('#long-name [class*="title"] > span', (name) => ({ clientHeight: name.clientHeight, scrollHeight: name.scrollHeight, lineHeight: getComputedStyle(name).lineHeight, font: getComputedStyle(name).font, width: name.clientWidth }));
    assert.ok(longName.scrollHeight <= longName.clientHeight + 1, JSON.stringify({ width, longName }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: resolve(output, `frames-${width}.png`), fullPage: true });
    results.push({ width, measurements, hiddenNamePrivate: true, missingArtworkGrayscale: true, legacyUnframed: true, longNameFits: true });
  }
  if (process.argv.includes("--pilots")) {
    await page.setViewport({ width: 1840, height: 880, deviceScaleFactor: 1 });
    await page.goto(`${origin}/?width=336&pilots`, { waitUntil: "networkidle0" });
    await page.waitForSelector('#cards [data-artwork="scene"]');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))));
    const images = await page.$$eval('#cards img', (images) => images.map((image) => ({ src: image.getAttribute('src'), loaded: !!image.naturalWidth })));
    assert.equal(images.length, 5);
    assert.ok(images.every((image) => image.loaded));
    await page.$eval('#edge-cases', (element) => element.remove());
    await page.screenshot({ path: resolve(output, "pilots.png"), fullPage: true });
    results.push({ pilots: images });
  }
  if (process.argv.includes("--collection")) {
    await page.setViewport({ width: 1336, height: 1800, deviceScaleFactor: 1 });
    for (let start = 0; start < 52; start += 12) {
      await page.goto(`${origin}/?width=300&collection&start=${start}&count=12`, { waitUntil: "networkidle0" });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))));
      const cards = await page.$$eval('#cards [role="img"]', (cards) => cards.map((card) => {
        const title = card.querySelector('[class*="title"] > span');
        const image = card.querySelector('img');
        return { label: card.getAttribute('aria-label'), loaded: !!image?.naturalWidth, titleFits: !!title && title.scrollHeight <= title.clientHeight + 1 };
      }));
      assert.equal(cards.length, Math.min(12, 52 - start));
      assert.ok(cards.every((card) => card.loaded && card.titleFits), JSON.stringify(cards));
      await page.screenshot({ path: resolve(output, `collection-${String(start + 1).padStart(2, "0")}-${Math.min(start + 12, 52)}.png`), fullPage: true });
      results.push({ collectionStart: start + 1, cards });
    }
    await page.goto(`${origin}/?width=240&collection`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode().catch(() => {}))));
    const gallery = await page.evaluate(() => {
      const copy = document.documentElement.cloneNode(true);
      copy.querySelectorAll('script,link[rel="modulepreload"]').forEach((element) => element.remove());
      return '<!doctype html>' + copy.outerHTML;
    });
    // Rewrite only the serialized HTML so detached images cannot issue new HTTP requests.
    await writeFile(resolve(output, "galerie-buddies.html"), gallery
      .replaceAll('src="/app/', 'src="../../../public/app/')
      .replaceAll("/src/app/fonts/", "../../../src/app/fonts/"));
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  await writeFile(resolve(output, "report.json"), JSON.stringify({ results, errors, blockedRequests }, null, 2));
  console.log(JSON.stringify({ widths: [160, 240, 384], fiveFrames: true, hiddenNamePrivate: true, missingArtworkGrayscale: true, legacyUnframed: true, longNameFits: true, errors }));
} finally {
  await browser?.close();
  await server.close();
}
