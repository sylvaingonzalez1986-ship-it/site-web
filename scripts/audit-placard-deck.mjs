// Real card guide and game CSS; local synthetic collection, no remote requests.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
const root = process.cwd(), output = resolve(root, "output/placard-indoor-deck");
const entry = `import React from 'react'; import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import {KqCardEffectGuide,KqCardRoleLegend} from '/src/components/placard/KqCardEffectGuide';
import {KQ_CARDS} from '/src/lib/kanab-quest-game';
import {getKqCardArtwork} from '/src/lib/kanab-quest-artwork';
import styles from '/src/components/placard/KanabQuestDicePrototype.module.css';
createRoot(document.getElementById('root')).render(React.createElement('main',{className:styles.page},
React.createElement('section',{className:styles.deckPanel},React.createElement('h1',null,'La Botte · Prépare ton deck'),
React.createElement('p',{className:styles.deckRulesGuide},'Une préparation avant les dés, une réaction après. 1 = Danger · 2–3 = neutre · 4–6 = réussite.'),
React.createElement(KqCardRoleLegend),
React.createElement('div',{className:styles.deckChoices},KQ_CARDS.filter(c=>['BOTTE-013','BOTTE-004','BOTTE-006','BOTTE-032','BOTTE-021','BOTTE-010'].includes(c.code)).map(card=>React.createElement('article',{key:card.code,className:styles.deckChoiceCard},
React.createElement('span',{className:styles.cardArtwork},React.createElement('img',{src:getKqCardArtwork(card.code),alt:card.name,style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain'}})),
React.createElement('strong',null,card.name),React.createElement(KqCardEffectGuide,{card}),React.createElement('div',null,React.createElement('button',null,'−'),React.createElement('b',null,'1 / 2'),React.createElement('button',null,'+'))))))));`;
const server = await createServer({ root, cacheDir: resolve(output,"vite-cache"), configFile:false, envDir:false,
  publicDir:resolve(root,"public"), esbuild:{jsx:"automatic"}, optimizeDeps:{include:["react","react-dom/client"]}, resolve:{alias:{"@":resolve(root,"src")}},
  css:{postcss:{plugins:[tailwindcss({base:root})]}}, plugins:[{name:"deck-audit",resolveId(id){if(id==="deck-entry")return "\0deck-entry";},load(id){if(id==="\0deck-entry")return entry;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url!=="/")return next();res.setHeader("Content-Type","text/html");res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}:root{--font-display:Impact;--font-body:Arial}</style><div id="root"></div><script type="module" src="/@id/__x00__deck-entry"></script></html>');});}}],
  server:{host:"127.0.0.1",port:3204,strictPort:true,hmr:false,watch:null} });
let browser;
try {
  await mkdir(output,{recursive:true}); await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:["--no-sandbox","--disable-gpu"]});
  const page=await browser.newPage(), errors=[]; page.on("pageerror",e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on("request",r=>{const u=new URL(r.url());if(u.protocol==="data:"||(u.hostname==="127.0.0.1"&&u.port==="3204"))void r.continue();else void r.abort();});
  for(const width of [320,390,768,1440]) {
    await page.setViewport({width,height:1000});await page.goto("http://127.0.0.1:3204/",{waitUntil:"networkidle0"});
    await page.waitForSelector("article");
    assert.equal(await page.$$eval("article",cards=>cards.length),6);
    assert.equal(await page.$$eval('[data-card-role]',cards=>new Set(cards.map(c=>c.dataset.cardRole)).size),6);
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    if (overflow) {
      await page.screenshot({path:resolve(output,`overflow-${width}.png`),fullPage:true});
      console.log(await page.$$eval('article, article span, main, section',nodes=>nodes.filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>({className:n.className,width:n.getBoundingClientRect().width,text:n.textContent.slice(0,90)}))));
    }
    assert.equal(overflow,false,`Overflow at ${width}px`);
    assert.equal(await page.$$eval("article",cards=>cards.every(c=>c.textContent.includes("Effet")&&c.textContent.includes("Limite"))),true);
    await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
    await page.screenshot({path:resolve(output,`deck-${width}.png`),fullPage:true});
  }
  assert.deepEqual(errors,[]);await writeFile(resolve(output,"audit.json"),JSON.stringify({widths:[320,390,768,1440],cards:6,errors},null,2));
  console.log("Deck : 6 cartes, 4 largeurs, aucun débordement horizontal ni erreur JavaScript.");
} finally {await browser?.close();await server.close();}
