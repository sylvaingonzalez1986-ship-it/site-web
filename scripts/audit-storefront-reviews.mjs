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
const widths = [320,390,768,1440];
const criteria = ["appearance","manicure","drying_curing","cold_aroma","aroma_intensity","aroma_complexity","flavor","smoothness_burn","persistence","overall_impression"];
const axisLabels = ["Aspect","Manucure","Curing","Nez","Intensité","Complexité","Goût","Douceur","Tenue"];
const averageValues = [81.5,77,89.5,80,85.5,91,93.5,82,87.5,96.5];
const reviewValues = [78.5,81,84.5,76,88.5,79,91.5,82,86.5,94.5];
const averages = Object.fromEntries(criteria.map((criterion,index)=>[criterion,averageValues[index]]));
const completeScores = criteria.map((criterion,index)=>({criterion,score:reviewValues[index]}));
const partialScores = [{criterion:"flavor",score:62.5},{criterion:"overall_impression",score:83.5}];
const review = (id, comment, scores = []) => ({ id, pseudo: "Dégustateur", comment, consumptionMethod: "vaporizer", createdAt: "2026-10-01T00:00:00Z", updatedAt: comment, scores, aromaTags: [] });
const first = review("00000000-0000-4000-8000-000000000001", "Premier avis sans note disponible");
const second = review("00000000-0000-4000-8000-000000000002", "Deuxième avis complet", completeScores);
const third = review("00000000-0000-4000-8000-000000000003", "Troisième avis incomplet", partialScores);
const previewFonts = `
  @font-face {font-family:StorefrontDisplay;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}
  @font-face {font-family:StorefrontBody;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:400 700}
  :root {--font-display:StorefrontDisplay;--font-body:StorefrontBody;--font-sans:StorefrontBody}
  body {margin:0}
`;
const modules = {
  "reviews-preview": `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ProductTastingSection} from '/src/components/boutique/ProductTastingSection';
    function summary(id, comment, scenario='complete') { return {entry:{id,title:'Lot '+id,slug:id,track:'regular',season:{code:'2025',label:'Saison 2025',isArchived:true},stats:{approvedReviewCount:scenario==='empty'?0:55,averageScore:84.6,criterionAverages:scenario==='partial'?{flavor:62.5}:${JSON.stringify(averages)}}},reviews:scenario==='empty'?[]:[{...${JSON.stringify(first)},comment,updatedAt:comment}],nextReviewCursor:scenario==='empty'?null:'page-1'}; }
    function App(){const [value,setValue]=React.useState(summary('a',${JSON.stringify(first.comment)})); window.replaceSummary=(id,comment,scenario)=>setValue(summary(id,comment,scenario)); return React.createElement(ProductTastingSection,{summary:value,showArenaLink:true});}
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
  optimizeDeps: { noDiscovery:true, include:["react","react-dom","react-dom/client","react/jsx-runtime","react/jsx-dev-runtime","lucide-react"] },
  css: { postcss:{plugins:[tailwindcss({base:root})]} },
  plugins: [{name:"reviews-audit",enforce:"pre",resolveId(id){if(id in modules)return `\0${id}`;},load(id){if(id.startsWith("\0"))return modules[id.slice(1)];},configureServer(vite){
    vite.middlewares.use((request,response,next)=>{
      if(request.url?.startsWith("/api/boutique/tasting/")){
        requests.push(request.url); response.setHeader("Content-Type","application/json");
        if(mode==="fail"){response.statusCode=503;response.end(JSON.stringify({error:"Avis indisponibles, réessaie."}));return;}
        const payload=JSON.stringify({reviews:[first,{...second,comment:request.url.includes('/b/')?'Avis du lot b':second.comment},third],nextReviewCursor:null});
        if(mode==="hold")setTimeout(()=>response.end(payload),600);else response.end(payload);
        return;
      }
      if(request.url!=="/")return next();
      response.setHeader("Content-Type","text/html");response.end(`<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${previewFonts}</style><div id="root"></div><script type="module" src="/@id/__x00__reviews-preview"></script></html>`);
    });
  }}],
  server:{host:"127.0.0.1",port,strictPort:true,hmr:false,watch:{ignored:["**/output/**","**/.next/**"]}},
});
let browser;
try {
  await mkdir(out,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(out,"chrome-profile"),args:["--no-sandbox","--disable-gpu"]});
  const page=await browser.newPage();page.on("pageerror",error=>errors.push(error.message));
  page.setDefaultNavigationTimeout(120000); // Allow the first Vite dependency build on a cold cache.
  await page.setRequestInterception(true);
  page.on("request",request=>{const url=new URL(request.url());if(url.protocol==="data:"||(url.hostname==="127.0.0.1"&&url.port===String(port)))void request.continue();else void request.abort();});
  const clickMore=()=>page.$eval("#avis-degustation button",button=>button.click());
  const count=()=>page.$$eval("#avis-degustation article",items=>items.length);
  const summaryChart="#avis-degustation aside .contest-review-skill-chart";
  const reviewChart=(index)=>`#avis-degustation article:nth-of-type(${index}) .contest-review-skill-chart`;
  async function assertChart(selector, expectedScores, context) {
    const chart=await page.$eval(selector,element=>{
      const svg=element.querySelector("svg");
      const viewBox=svg.viewBox.baseVal;
      const labels=Array.from(svg.querySelectorAll("text"),label=>{
        const box=label.getBBox();
        return {text:label.textContent.trim(),x:box.x,y:box.y,width:box.width,height:box.height};
      });
      return {
        hiddenInDetails:Boolean(element.closest("details")),
        rendered:svg.getBoundingClientRect().width>0&&svg.getBoundingClientRect().height>0,
        labels,viewBox:{x:viewBox.x,y:viewBox.y,width:viewBox.width,height:viewBox.height},
        polygons:svg.querySelectorAll(".contest-review-skill-area").length,
        points:svg.querySelectorAll(".contest-review-skill-point").length,
        role:svg.getAttribute("role"),title:svg.querySelector("title")?.textContent,
        description:svg.querySelector("desc")?.textContent,
        labelIds:(svg.getAttribute("aria-labelledby")??"").split(/\s+/).filter(Boolean).map(id=>({id,exists:Boolean(document.getElementById(id))})),
        descriptionLinked:document.getElementById(svg.getAttribute("aria-describedby"))===svg.querySelector("desc"),
      };
    });
    assert.equal(chart.hiddenInDetails,false,`${context}: radar must be visible without opening details`);
    assert.equal(chart.rendered,true,`${context}: radar must have a rendered size`);
    assert.equal(chart.role,"img");
    assert(chart.title&&chart.description,`${context}: accessible title and numeric description are required`);
    assert(chart.labelIds.length>0&&chart.labelIds.every(label=>label.exists),`${context}: accessible labels must resolve`);
    assert.equal(chart.descriptionLinked,true,`${context}: accessible description must be linked`);
    assert.match(chart.description,/(?:\/\s*100|sur 100)/,`${context}: description must give the scale`);
    assert.equal(chart.labels.length,9,`${context}: nine tasting axes`);
    const values=criteria.slice(0,9).map(criterion=>expectedScores[criterion]);
    assert.equal(chart.points,values.filter(value=>typeof value==="number").length,`${context}: only actual scores produce points`);
    assert.equal(chart.polygons,values.every(value=>typeof value==="number")?1:0,`${context}: incomplete profiles must not invent a polygon`);
    for(const [index,label] of chart.labels.entries()){
      assert(label.text.includes(axisLabels[index]),`${context}: missing axis ${axisLabels[index]}`);
      const score=values[index];
      const expected=typeof score==="number"?score.toFixed(1).replace(".",","):"—";
      assert(label.text.includes(expected),`${context}: ${axisLabels[index]} must show ${expected}, got ${label.text}`);
      assert(chart.description.includes(typeof score==="number"?expected:"non renseigné"),`${context}: accessible description must explain ${axisLabels[index]}`);
      assert(label.x>=chart.viewBox.x-0.5&&label.y>=chart.viewBox.y-0.5&&label.x+label.width<=chart.viewBox.x+chart.viewBox.width+0.5&&label.y+label.height<=chart.viewBox.y+chart.viewBox.height+0.5,`${context}: label outside SVG: ${label.text}`);
      for(const other of chart.labels.slice(index+1)){
        const overlapX=Math.min(label.x+label.width,other.x+other.width)-Math.max(label.x,other.x);
        const overlapY=Math.min(label.y+label.height,other.y+other.height)-Math.max(label.y,other.y);
        assert(overlapX<=0.5||overlapY<=0.5,`${context}: overlapping labels ${label.text} / ${other.text}`);
      }
    }
    assert(!/(?:^|[^\d])70(?:[,.]0)?(?:[^\d]|$)/.test(chart.labels.map(label=>label.text).join(" ")),`${context}: absent scores must never become 70`);
  }
  async function assertNoOverflow(context) {
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${context}: horizontal page overflow`);
  }
  for(const width of widths){
    await page.setViewport({width,height:1000});await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:"networkidle0"});
    assert.deepEqual(errors,[],"The preview must load without browser errors");
    await page.waitForSelector("#avis-degustation article");
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await count(),1);
    assert(await page.$eval("#avis-degustation article",item=>item.textContent.includes("—")));
    assert.equal(await page.$("#avis-degustation article .contest-review-skill-chart"),null,"An unscored review must not show a radar");
    assert(await page.$eval('a[href*="edit=notes"]',link=>link.href.includes("season=2025")));
    await assertChart(summaryChart,averages,`${width}px summary`);
    const summaryText=await page.$eval("#avis-degustation aside",element=>element.textContent.replace(/\s+/g," "));
    assert.match(summaryText,/84,6/,"The server's authoritative overall average must remain visible");
    assert.match(summaryText,/Verdict\s*96,5\s*\/\s*100/,"The tenth criterion must remain visible outside the radar");
    await clickMore();await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===3);
    assert.equal(await count(),3); // duplicate first review is not appended twice.
    await assertChart(reviewChart(2),Object.fromEntries(completeScores.map(({criterion,score})=>[criterion,score])),`${width}px complete review`);
    await assertChart(reviewChart(3),Object.fromEntries(partialScores.map(({criterion,score})=>[criterion,score])),`${width}px partial review`);
    assert.match(await page.$eval("#avis-degustation article:nth-of-type(2)",element=>element.textContent.replace(/\s+/g," ")),/Verdict\s*94,5\s*\/\s*100/);
    assert.match(await page.$eval("#avis-degustation article:nth-of-type(3)",element=>element.textContent.replace(/\s+/g," ")),/Verdict\s*83,5\s*\/\s*100/);
    assert.equal(await page.$$eval("#avis-degustation svg [id]",elements=>new Set(elements.map(element=>element.id)).size===elements.length),true,"Each chart must have unique accessible label IDs");
    await assertNoOverflow(`${width}px complete and partial reviews`);
    await page.screenshot({path:resolve(out,`reviews-${width}.png`),fullPage:true});
    await page.evaluate(()=>window.replaceSummary("partial","Avis avec profil de lot partiel","partial"));
    await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===1&&document.body.textContent.includes("profil de lot partiel"));
    await assertChart(summaryChart,{flavor:62.5},`${width}px partial summary`);
    assert.match(await page.$eval("#avis-degustation aside",element=>element.textContent.replace(/\s+/g," ")),/Verdict\s*—/,"A missing verdict must not become a default score");
    await assertNoOverflow(`${width}px partial summary`);
    await page.evaluate(()=>window.replaceSummary("empty","","empty"));
    await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===0);
    assert.equal(await page.$("#avis-degustation .contest-review-skill-chart"),null,"Zero approved reviews must hide stale aggregate scores and all radars");
    await assertNoOverflow(`${width}px empty summary`);
  }
  await page.evaluate(()=>window.replaceSummary("a","Avis corrigé après actualisation"));
  await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===1&&document.body.textContent.includes("Avis corrigé"));
  mode="fail";await clickMore();await page.waitForSelector('[role="alert"]');assert.equal(await count(),1);
  mode="success";await clickMore();await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===3);
  await page.evaluate(()=>window.replaceSummary("a","Version avant navigation"));
  await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===1);
  mode="hold";await clickMore();await page.waitForFunction(()=>document.querySelector("#avis-degustation button").disabled);
  await page.evaluate(()=>window.replaceSummary("b","Premier avis du nouveau lot b"));
  await page.waitForFunction(()=>document.querySelectorAll("#avis-degustation article").length===1&&document.body.textContent.includes("nouveau lot b"));
  await new Promise(done=>setTimeout(done,800));assert.equal(await count(),1);
  mode="success";await clickMore();await page.waitForFunction(()=>document.body.textContent.includes("Avis du lot b"));assert.equal(await count(),3);
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,"report.json"),JSON.stringify({passed:true,widths,visibleRadars:true,completeAndPartialProfiles:true,exactDecimalScores:true,verdictPreserved:true,noInventedScores:true,accessibleDescriptions:true,svgLabelBounds:true,zeroReviews:true,missingScore:true,duplicateSuppression:true,snapshotRefresh:true,retry:true,navigationDuringLoad:true,archiveLink:true,requests:requests.length,errors},null,2));
  console.log("Storefront reviews browser: visible radars, exact scores, partial/missing profiles, verdicts, accessible descriptions and SVG bounds at 320/390/768/1440 px; pagination, retries, refresh and archive links verified.");
} catch (error) {
  if(errors.length>0) console.error("Browser errors:",errors);
  throw error;
} finally {await browser?.close();await server.close();}
