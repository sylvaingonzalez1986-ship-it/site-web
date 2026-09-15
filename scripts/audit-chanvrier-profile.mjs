import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import puppeteer from "puppeteer-core";
import { Launcher } from "chrome-launcher";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.cwd(), output = resolve(root, "output/chanvrier-profile");
const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import '/src/app/globals.css'; import {ArenaJourneyTour} from '/src/components/contest/ArenaJourneyTour';
import {ACHIEVEMENTS} from '/src/lib/chanvrier-progress';
window.__saves=[]; window.__progressReads=0; let profile=null; let tutorialReads=0;
const metrics={'triple-spark':20,'spark-collector':40,'perfect-culture':2,'cool-head':4,'natural-defense':1,cultures:18,bestJury:8.7,wins:3,losses:2};
let progress={metrics,reputation:312,rating:1120,rank:7,rankAsOf:'2026-09-15T06:00:00Z',unlockedFamilies:5,packsGranted:1,newBadgeCount:1,showcase:{badges:[],title:null,tracked:null},missions:[{code:'online-two',track:'online',step:1,target:2,progress:1,cardCount:3,claimed:false,unlocked:true,claimable:false}],badges:ACHIEVEMENTS.flatMap(a=>a.thresholds.map((n,i)=>({id:'kq-ach-'+a.code+'-'+(i+1),code:'kq-ach-'+a.code+'-'+(i+1),label:a.name+' '+(i+1),description:a.description,origin:'game',awardedAt:(metrics[a.code]??0)>=n?'2026-09-14T12:00:00Z':null})))};
progress.badges.push({id:'notebook-badge',code:'premier-carnet',label:'Premier Carnet',description:'Première fleur notée.',origin:'notebook',awardedAt:'2026-09-14T12:00:00Z'});
progress.badgeCount=progress.badges.filter(b=>b.awardedAt).length;
window.fetch=async(url,options={})=>{
 if(String(url).endsWith('/chanvrier/progress')){
  if(options.method==='PATCH'){const body=JSON.parse(options.body);if(body.showcase)progress.showcase=body.showcase;return new Response(JSON.stringify({saved:true}),{status:200});}
  window.__progressReads++;
  if(window.__failProgress)return new Response(JSON.stringify({error:'Palmarès temporairement indisponible.'}),{status:503});
  return new Response(JSON.stringify(progress),{status:200});
 }

 if(String(url).endsWith('/tutorial')&&!options.method&&location.search.includes('retry')){
  tutorialReads++;
  if(tutorialReads===1)return new Response(JSON.stringify({error:'Le guide est momentanément indisponible.'}),{status:503});
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(String(url).endsWith('/tutorial'))return new Response(JSON.stringify({userId:'preview-player',progress:{step:0,status:'new'},persisted:true,chanvrier:profile}),{status:200});
 if(String(url).endsWith('/chanvrier')){const body=JSON.parse(options.body); window.__saves.push(body); profile=body;return new Response(JSON.stringify({profile,created:true,startingBonusCents:0}),{status:200});}
 throw new Error('Unexpected preview API '+url);
};
createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement('h1',null,'L’Arène'),React.createElement('p',null,'Profil de démonstration'),React.createElement(ArenaJourneyTour)));
`;
const server = await createServer({ configFile: false, envDir: false, root, publicDir: resolve(root, "public"), cacheDir: resolve(output, "vite-cache"),
  esbuild: { jsx: "automatic" }, resolve: { alias: { "@": resolve(root, "src") } }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: "chanvrier-preview", enforce: "pre", resolveId(id) {
    if (id === "chanvrier-entry") return "\0chanvrier-entry";
    if (id === "next/link") return "\0link";
    if (id === "next/image") return "\0image";
    if (id.endsWith("/cookies/CookieConsentProvider")) return "\0cookies";
  }, load(id) {
    if (id === "\0chanvrier-entry") return entry;
    if (id === "\0link") return `import React from 'react'; export default function Link({prefetch,...props}){return React.createElement('a',props);}`;
    if (id === "\0image") return `import React from 'react'; export default function Image({priority,fill,...props}){return React.createElement('img',props);}`;
    if (id === "\0cookies") return "export const useCookieConsent=()=>({showBanner:false});";
  }, configureServer(vite) { vite.middlewares.use((req, res, next) => {
    if (req.url?.split("?")[0] !== "/arene") return next();
    res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#063a30;color:#fff3d4}h1,p{margin:20px}</style><div id="root"></div><script type="module" src="/@id/__x00__chanvrier-entry"></script></html>');
  }); } }], server: { host: "127.0.0.1", port: 3197, strictPort: true, hmr: false, watch: { ignored: ["**/output/**", "**/.next/**"] } },
});
let browser;
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], userDataDir: resolve(output, "chrome-profile"), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", request => { const url = new URL(request.url()); if (url.protocol === "data:" || url.hostname === "127.0.0.1" && url.port === "3197") void request.continue(); else void request.abort(); });
  for (const width of [320, 375, 1280]) {
    await page.setViewport({ width, height: width < 500 ? 900 : 950 });
    await page.goto("http://127.0.0.1:3197/arene", { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-chanvrier-profile][open]");
    if (await page.$$eval("dialog[open]", elements => elements.length) !== 1) throw new Error("The profile must precede the tutorial");
    const original = await page.$eval("[data-chanvrier-profile] canvas", el => el.toDataURL());
    await page.click('[aria-label="Brun"]');
    await page.click('[aria-label="Bordeaux"]');
    await page.locator('button ::-p-text(Féminin)').click();
    await page.waitForFunction(before => document.querySelector('[data-chanvrier-profile] canvas').toDataURL() !== before, {}, original);
    await page.type('input[autocomplete="nickname"]', 'Louise29');
    await page.screenshot({ path: resolve(output, `appearance-${width}.png`) });
    await page.locator('button ::-p-text(Choisir ma force)').click();
    await page.locator('button ::-p-text(Commercial)').click();
    await page.screenshot({ path: resolve(output, `strength-${width}.png`) });
    const overflow = await page.$eval('[data-chanvrier-profile]', el => el.scrollWidth > el.clientWidth + 2);
    if (overflow) throw new Error(`Horizontal overflow at ${width}`);
    await page.locator('button ::-p-text(Créer mon chanvrier)').click();
    await page.waitForFunction(() => !document.querySelector('[data-chanvrier-profile]') && document.querySelector('dialog[open]'));
    const saves = await page.evaluate(() => window.__saves);
    if (saves.length !== 1 || saves[0].strength !== "merchant" || saves[0].gender !== "female" || saves[0].skin !== "brown" || saves[0].clothing !== "berry") throw new Error("Wrong saved profile");
    await page.click('[aria-label="Passer le tutoriel"]');
    await page.waitForSelector('[data-chanvrier-card] button[aria-expanded="false"]');
    if(await page.evaluate(()=>window.__progressReads)!==0)throw new Error('Closed card must not fetch');
    await page.click('[data-chanvrier-card] button[aria-expanded]');
    await page.waitForSelector('[data-chanvrier-palmares]');
    await page.waitForFunction(() => document.querySelector('[data-chanvrier-palmares] canvas')?.getContext('2d').getImageData(190,100,1,1).data[3] > 0);
    if (await page.$eval('[data-chanvrier-palmares] h2', el => el.textContent) !== 'Louise29') throw new Error('Player card has the wrong nickname');
    const cardFits = await page.$eval('[data-chanvrier-palmares]', el => {const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight && el.scrollWidth<=el.clientWidth+2;});
    if (!cardFits) throw new Error(`Player card overflow at ${width}`);
    await page.$eval('[data-chanvrier-palmares]', async el => { await Promise.all(el.getAnimations().map(animation => animation.finished)); });
    await page.screenshot({ path: resolve(output, `player-card-${width}.png`) });
    if(await page.evaluate(()=>window.__progressReads)!==1)throw new Error('One lazy progress read expected');
    await page.locator('button ::-p-text(Succès)').click();
    await page.waitForSelector('[aria-label="Filtrer les succès"]');
    await page.screenshot({path:resolve(output,`achievements-${width}.png`)});
    await page.locator('button:not(:disabled) ::-p-text(Suivre cet objectif)').click();
    await page.waitForSelector('button[aria-pressed="true"]');
    await page.locator('button ::-p-text(Badges)').click();
    await page.waitForSelector('[aria-label="Origine des badges"]');
    await page.locator('button ::-p-text(Premier Carnet)').click();
    await page.locator('button ::-p-text(Afficher sur ma carte)').click();
    await page.waitForSelector('[aria-label="Premier Carnet"]');
    await page.select('select','triple-spark');
    await page.waitForFunction(()=>document.querySelector('[data-chanvrier-palmares]').textContent.includes('Porte-étincelles'));
    await page.screenshot({path:resolve(output,`badges-${width}.png`)});
    if(await page.$eval('[data-chanvrier-palmares]',el=>el.scrollWidth>el.clientWidth+2))throw new Error('Badges overflow');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-chanvrier-palmares]') && document.activeElement?.getAttribute('aria-expanded') === 'false');
    await page.click('[data-chanvrier-card] button[aria-expanded]');
    await page.mouse.click(2,2);
    await page.waitForFunction(() => !document.querySelector('[data-chanvrier-palmares]'));
    await page.click('[data-chanvrier-card] button[aria-expanded]');
    const readsBefore=await page.evaluate(()=>window.__progressReads);
    await page.keyboard.press('Escape');
    await page.click('[data-chanvrier-card] button[aria-expanded]');
    if(await page.evaluate(()=>window.__progressReads)!==readsBefore)throw new Error('Unchanged profile should use its brief memory cache');
    await page.evaluate(()=>{window.__failProgress=true;window.dispatchEvent(new Event('arena:progress-updated'));});
    await page.waitForSelector('[role="alert"]');
    await page.evaluate(()=>{window.__failProgress=false;});
    await page.locator('button ::-p-text(Réessayer le palmarès)').click();
    await page.waitForFunction(()=>!document.querySelector('[data-chanvrier-palmares] [role="alert"]'));
    await page.locator('button ::-p-text(Personnaliser mon personnage)').click();
    await page.waitForSelector('[data-chanvrier-profile][open]');
    await page.$eval('input[autocomplete="nickname"]', el => el.select());
    await page.type('input[autocomplete="nickname"]', 'Louise30');
    await page.locator('button ::-p-text(Choisir ma force)').click();
    await page.locator('button ::-p-text(Enregistrer mon profil)').click();
    await page.waitForFunction(() => document.querySelector('[data-chanvrier-card] button[aria-expanded]')?.textContent.includes('Louise30'));
    if ((await page.evaluate(() => window.__saves)).length !== 2) throw new Error('Opening the card must not write to the API');
    console.log(`OK ${width}px: onboarding, player card, no overflow, Escape focus, outside dismissal, edit refresh`);
  }
  await page.goto("http://127.0.0.1:3197/arene?retry", { waitUntil: "networkidle0" });
  await page.waitForSelector('[role="status"] button:not(:disabled)');
  await page.click('[role="status"] button');
  await page.waitForSelector('[role="status"] button[aria-busy="true"]:disabled');
  await page.waitForSelector('[data-chanvrier-profile][open]');
  if(await page.$('[role="status"]'))throw new Error('Retry error must disappear after recovery');
  console.log('OK API failure: visible retry feedback, disabled duplicate requests, profile opens on recovery');
  if (errors.length) throw new Error(errors.join("\n"));
} finally { await browser?.close(); await server.close(); }
