// Browser check of the real tasting section and pagination hook, using local fixtures.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const out = resolve(root, "output/storefront-reviews");
const port = 3199;
const review = (id, comment, scores = true) => ({ id, pseudo: "Dégustateur", comment, consumptionMethod: "vaporizer", createdAt: "2026-10-01T00:00:00Z", updatedAt: comment, scores: scores ? ["appearance","manicure","drying_curing","cold_aroma","aroma_intensity","aroma_complexity","flavor","smoothness_burn","persistence","overall_impression"].map(criterion => ({ criterion, score: 80 })) : [], aromaTags: [] });
const first = review("00000000-0000-4000-8000-000000000001", "Premier avis sans note disponible", false);
const second = review("00000000-0000-4000-8000-000000000002", "Deuxième avis complet");
const modules = {
  "reviews-preview": `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ProductTastingSection} from '/src/components/boutique/ProductTastingSection';
    function summary(id, comment) { return {entry:{id,title:'Lot '+id,slug:id,track:'regular',season:{code:'2025',label:'Saison 2025',isArchived:true},stats:{approvedReviewCount:55,averageScore:80,criterionAverages:{flavor:80}}},reviews:[{...${JSON.stringify(first)},comment,updatedAt:comment}],nextReviewCursor:'page-1'}; }
    function App(){const [value,setValue]=React.useState(summary('a',${JSON.stringify(first.comment)})); window.replaceSummary=(id,comment)=>setValue(summary(id,comment)); return React.createElement(ProductTastingSection,{summary:value,showArenaLink:true});}
    createRoot(document.getElementById('root')).render(React.createElement(App));
  `,
  "next/link": `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  "next/navigation": `export const usePathname=()=>location.pathname; export const useRouter=()=>({});`,
};
let mode = "success";
const requests = [];
const errors = [];
const server = await createServer({
  configFile: false, envDir: false, root, cacheDir: resolve(out,"vite-cache"),
  esbuild: { jsx:"automatic" }, resolve: { alias:{"@":resolve(root,"src")},dedupe:["react","react-dom"] },
  optimizeDeps: { include:["react","react-dom/client","react/jsx-runtime","lucide-react"] },
  css: { postcss:{plugins:[tailwindcss({base:root})]} },
  plugins: [{name:"reviews-audit",enforce:"pre",resolveId(id){if(id in modules)return `\0${id}`;},load(id){if(id.startsWith("\0"))return modules[id.slice(1)];},configureServer(vite){
    vite.middlewares.use((request,response,next)=>{
      if(request.url?.startsWith("/api/boutique/tasting/")){
        requests.push(request.url); response.setHeader("Content-Type","application/json");
        if(mode==="fail"){response.statusCode=503;response.end(JSON.stringify({error:"Avis indisponibles, réessaie."}));return;}
        const payload=JSON.stringify({reviews:[first,{...second,comment:request.url.includes('/b/')?'Avis du lot b':second.comment}],nextReviewCursor:null});
        if(mode==="hold")setTimeout(()=>response.end(payload),600);else response.end(payload);
        return;
      }
      if(request.url!=="/")return next();
      response.setHeader("Content-Type","text/html");response.end('<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/@id/__x00__reviews-preview"></script></html>');
    });
  }}],
  server:{host:"127.0.0.1",port,strictPort:true,hmr:false,watch:{ignored:["**/output/**","**/.next/**"]}},
});
let browser;
try {
  await mkdir(out,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(out,"chrome-profile"),args:["--no-sandbox","--disable-gpu"]});
  const page=await browser.newPage();page.on("pageerror",error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request",request=>{const url=new URL(request.url());if(url.protocol==="data:"||(url.hostname==="127.0.0.1"&&url.port===String(port)))void request.continue();else void request.abort();});
  const clickMore=()=>page.$eval("#avis-degustation button",button=>button.click());
  const count=()=>page.$$eval("#avis-degustation article",items=>items.length);
  for(const width of [320,390,1440]){
    await page.setViewport({width,height:1000});await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:"networkidle0"});
    await page.waitForSelector("#avis-degustation article");
    assert.equal(await count(),1);
    assert(await page.$eval("#avis-degustation article",item=>item.textContent.includes("—")));
    assert(await page.$eval('a[href*="edit=notes"]',link=>link.href.includes("season=2025")));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.screenshot({path:resolve(out,`reviews-${width}.png`),fullPage:true});
    await clickMore();await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===2);
    assert.equal(await count(),2); // duplicate first review is not appended twice.
  }
  await page.evaluate(()=>window.replaceSummary("a","Avis corrigé après actualisation"));
  await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===1&&document.body.textContent.includes("Avis corrigé"));
  mode="fail";await clickMore();await page.waitForSelector('[role="alert"]');assert.equal(await count(),1);
  mode="success";await clickMore();await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===2);
  await page.evaluate(()=>window.replaceSummary("a","Version avant navigation"));
  await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===1);
  mode="hold";await clickMore();await page.waitForFunction(()=>document.querySelector("#avis-degustation button").disabled);
  await page.evaluate(()=>window.replaceSummary("b","Premier avis du nouveau lot b"));
  await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===1&&document.body.textContent.includes("nouveau lot b"));
  await new Promise(done=>setTimeout(done,800));assert.equal(await count(),1);
  mode="success";await clickMore();await page.waitForFunction(()=>document.body.textContent.includes("Avis du lot b"));assert.equal(await count(),2);
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,"report.json"),JSON.stringify({passed:true,widths:[320,390,1440],missingScore:true,duplicateSuppression:true,snapshotRefresh:true,retry:true,navigationDuringLoad:true,archiveLink:true,requests:requests.length,errors},null,2));
  console.log("Storefront reviews browser: 320/390/1440 px, missing-score display, pagination, retries, deduplication, same-entry refresh, navigation during load and archive links verified.");
} finally {await browser?.close();await server.close();}
