// Real components, deterministic difficult combinations, local synthetic profile API.
// This gallery complements the existing exhaustive heads/outfits/editor audits.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const root = process.cwd();
const before = process.argv.includes('--before');
const preview = process.argv.includes('--preview');
const output = resolve(root, 'output/chanvrier-calibration/combinations', before ? 'before' : 'after');
const port = 3221, origin = `http://127.0.0.1:${port}`;
const avatarSource = before ? '/output/chanvrier-calibration/baseline-source/ChanvrierAvatar' : '/src/components/contest/ChanvrierAvatar';
const legacy = { nickname: 'Ancien29', gender: 'female', clothing: 'berry', skin: 'copper', strength: 'green-thumb' };
let saved = { ...legacy }, saves = 0;
const errors = [], checks = [];
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {ChanvrierAvatar} from '${avatarSource}';
import {LeaderboardAvatar} from '/src/components/contest/LeaderboardAvatar';
import {ChanvrierProfileEditor} from '/src/components/contest/ChanvrierProfileEditor';
import {DEFAULT_CHANVRIER_APPEARANCE as defaults, parseChanvrierProfile} from '/src/lib/arena-chanvrier';
const cases = [
 ['Temoin', 'male','ivory','crop','oval','none','none','tee','jeans','work'],
 ['Machoire-carree','male','honey','bald','square','moustache','round-glasses','shirt','cargo','boots'],
 ['Visage-long','female','peach','bob','long','none','glasses','hoodie','jeans','high-tops'],
 ['Tresses-coeur','female','brown','braids','heart','none','scarf','overalls','shorts','sneakers'],
 ['Barbe-lunettes','male','ebony','long','angular','beard','glasses','jacket','cargo','work'],
 ['Boucles-rond','female','copper','curls','round','none','earrings','apron','skirt','boots'],
 ['Foulard-cheveux','female','ivory','long','oval','none','scarf','hoodie','skirt','sneakers'],
 ['Tablier-peau','male','ebony','afro','oval','stubble','none','apron','shorts','sneakers'],
 ['Chemise-peau','male','ebony','buzz','square','none','none','shirt','shorts','high-tops'],
 ['Manches-claires','female','ivory','bun','round','none','none','apron','shorts','boots'],
 ['Queue-oreille','female','peach','ponytail','long','none','earrings','tee','skirt','work'],
 ['Crete-barbiche','male','honey','mohawk','heart','stubble','round-glasses','jacket','jeans','high-tops'],
].map(([id,gender,skin,hair,face,facialHair,accessory,top,bottom,shoes],i)=>({id,profile:{nickname:'Testeur29',strength:'green-thumb',gender,skin,clothing:i%2?'teal':'ochre',appearance:{...defaults,hair,face,facialHair,accessory,top,bottom,shoes,hairColor:i===5?'ginger':'chestnut',mouth:i%3===0?'grin':'smile',eyes:i===4?'relaxed':i===2?'bright':'almond',bottomColor:'blue',shoeColor:'ochre'}}}));
window.cases=cases;
const query=new URLSearchParams(location.search);
function App(){
 const [profile,setProfile]=React.useState(cases[0].profile),[open,setOpen]=React.useState(false);
 window.setProfile=setProfile;
 React.useEffect(()=>{if(query.has('editor'))fetch('/api/arena/chanvrier').then(r=>r.json()).then(r=>{setProfile(parseChanvrierProfile(r.profile));setOpen(true)});},[]);
 return query.has('editor')?<main className="editor"><ChanvrierAvatar profile={profile} className="saved"/><button id="edit" onClick={()=>setOpen(true)}>Personnaliser</button>{open&&<ChanvrierProfileEditor profile={profile} onClose={()=>setOpen(false)} onSaved={p=>{setProfile(p);setOpen(false)}}/>}</main>:<main>
 <h1>Personnages : raccords et expressions</h1><div className="grid">{cases.map(({id,profile})=><figure key={id} data-case={id} data-profile={JSON.stringify(profile)}><div className="views"><ChanvrierAvatar profile={profile} className="full"/><ChanvrierAvatar profile={profile} view="portrait" className="portrait"/></div><figcaption>{id}<LeaderboardAvatar profile={profile} pseudo={id}/></figcaption></figure>)}</div>
 <section id="live"><h2>Changement d’options</h2><ChanvrierAvatar profile={profile} className="full"/><ChanvrierAvatar profile={profile} view="portrait" className="portrait"/></section>
 </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  define: { 'process.env': '{}' }, resolve: { alias: { '@': resolve(root, 'src') } },
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'] },
  plugins: [{ name: 'chanvrier-calibration', enforce: 'pre',
    resolveId(id) { if (id === 'calibration-entry') return '\0calibration-entry'; if (id === 'next/image') return '\0image'; if (before && id === './ChanvrierAvatar') return resolve(root,'output/chanvrier-calibration/baseline-source/ChanvrierAvatar.tsx'); },
    async load(id) {
      if (id === '\0calibration-entry') return (await transformWithOxc(entry, 'entry.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code;
      if (id === '\0image') return "import React from 'react';export default function Image({fill,priority,unoptimized,quality,loader,...props}){return React.createElement('img',props)}";
    },
    configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
      if (req.url === '/api/arena/chanvrier') {
        if (req.method === 'POST') { let raw=''; for await (const chunk of req) raw+=chunk; saved=JSON.parse(raw); saves++; }
        res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({profile:saved}));
      }
      if (req.url?.split('?')[0] !== '/') return next();
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>:root{--font-display:Arial;--font-body:Arial}*{box-sizing:border-box}body{margin:0;background:#f6e9c9;color:#172923;font-family:Arial}main{padding:20px}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:16px}figure{margin:0;background:#fff5df;padding:12px}.views{display:flex;align-items:center}.full{width:50%;height:auto;display:block}.portrait{width:50%;height:auto;display:block}figcaption{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px}#live{display:flex;flex-wrap:wrap;align-items:center;max-width:600px}#live h2{width:100%}.saved{width:min(100%,280px);height:auto}.editor{max-width:700px;margin:auto}button,input{font:inherit}@media(max-width:680px){.grid{grid-template-columns:1fr}main{padding:8px}}</style><div id="root"></div><script type="module" src="/@id/__x00__calibration-entry"></script></html>');
    }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
let browser;
try {
  await mkdir(output,{recursive:true}); await server.listen();
  if (preview) { console.log(`Character preview: ${origin}/?editor (local synthetic saves)`); await new Promise(()=>{}); }
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();
  page.setDefaultTimeout(45000); page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  let failQuiff=false,delayBrows=false;
  page.on('request',async r=>{
    if(failQuiff&&r.url().endsWith('/head-quiff.webp')){failQuiff=false;return r.respond({status:503,body:'fixture unavailable'});}
    if(delayBrows&&r.url().endsWith('/patch-eyebrows-thick.webp'))await new Promise(resolve=>setTimeout(resolve,700));
    return r.url().startsWith(origin)||r.url().startsWith('data:')?r.continue():r.abort();
  });
  const ready=()=>page.waitForFunction(()=>{const c=[...document.querySelectorAll('canvas[data-avatar-state]')];return c.length&&c.every(c=>c.dataset.avatarState==='ready')},{timeout:60000});
  await page.setViewport({width:1440,height:1000});
  await page.goto(origin,{waitUntil:'networkidle0'}); await ready();
  await writeFile(resolve(output,'profiles.json'),JSON.stringify(await page.evaluate(()=>window.cases),null,2)+'\n');
  await page.screenshot({path:resolve(output,'combinations-1440.png'),fullPage:true});
  for(const id of ['Temoin','Visage-long','Tresses-coeur','Foulard-cheveux','Tablier-peau']) await (await page.$(`[data-case="${id}"]`)).screenshot({path:resolve(output,id+'.png')});
  checks.push('12 configurations difficiles en pied, en portrait et dans le vrai badge de classement à 48 px');
  if(!before){
    // Same profile, independent canvases: no shared mutable canvas/IDs bleed.
    assert.equal(await page.$eval('[data-case="Temoin"] .full',c=>c.toDataURL()),await page.$eval('#live .full',c=>c.toDataURL()));
    assert.equal(await page.$eval('[data-case="Temoin"] .portrait',c=>c.toDataURL()),await page.$eval('#live .portrait',c=>c.toDataURL()));
    const cropMatches=await page.$eval('#live',node=>{
      const full=node.querySelector('.full'),portrait=node.querySelector('.portrait'),copy=document.createElement('canvas');copy.width=768;copy.height=768;
      const c=copy.getContext('2d');c.imageSmoothingQuality='high';c.drawImage(full,64,40,592,592,0,0,768,768);return copy.toDataURL()===portrait.toDataURL();
    });assert(cropMatches,'portrait must crop the identical full composition');
    await page.evaluate(async()=>{for(let i=1;i<12;i++){window.setProfile(window.cases[i].profile);await new Promise(requestAnimationFrame)}window.setProfile(window.cases[4].profile)});
    await ready();
    assert.equal(await page.$eval('[data-case="Barbe-lunettes"] .full',c=>c.toDataURL()),await page.$eval('#live .full',c=>c.toDataURL()));
    checks.push('Parité exacte plein pied/portrait, instances simultanées et 12 changements rapides sans ancien calque');
    failQuiff=true;
    await page.evaluate(()=>window.setProfile({...window.cases[0].profile,appearance:{...window.cases[0].profile.appearance,hair:'quiff'}}));
    await page.waitForSelector('#live canvas[data-avatar-state="error"]');
    assert.equal(await page.$eval('#live .full',c=>getComputedStyle(c).opacity),'0','failed option cannot show previous avatar');
    await page.evaluate(()=>window.setProfile(window.cases[0].profile));await ready();
    await page.evaluate(()=>window.setProfile({...window.cases[0].profile,appearance:{...window.cases[0].profile.appearance,hair:'quiff'}}));await ready();
    delayBrows=true;
    await page.evaluate(()=>window.setProfile({...window.cases[0].profile,appearance:{...window.cases[0].profile.appearance,eyebrows:'thick'}}));
    await page.waitForSelector('#live canvas[data-avatar-state="loading"]');
    assert.equal(await page.$eval('#live .full',c=>getComputedStyle(c).opacity),'0','pending selection cannot show old layers');
    await page.evaluate(()=>window.setProfile(window.cases[4].profile));await ready();
    await page.waitForNetworkIdle();
    assert.equal(await page.$eval('[data-case="Barbe-lunettes"] .full',c=>c.toDataURL()),await page.$eval('#live .full',c=>c.toDataURL()));
    checks.push('Ressource en erreur puis réessayée ; ressource retardée abandonnée sans couche fantôme ni état d’erreur persistant');
  }
  await page.setViewport({width:320,height:844});await page.screenshot({path:resolve(output,'combinations-320.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'gallery fits 320px');
  if(!before){
    await page.goto(origin+'/?editor',{waitUntil:'networkidle0'});await page.waitForSelector('dialog[open]');await ready();
    const initial=await page.$eval('dialog canvas',c=>c.toDataURL());
    await page.screenshot({path:resolve(output,'legacy-editor-320.png')});
    const clickText=async text=>{const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('dialog button')].find(b=>b.textContent.trim()===text),text);assert(handle.asElement(),text);await handle.asElement().evaluate(e=>e.scrollIntoView({block:'center'}));await handle.asElement().click();await handle.dispose();};
    await clickText('Tenue');
    await page.$eval('[aria-label="Haut : Chemise"]',b=>b.click());await ready();
    const edited=await page.$eval('dialog canvas',c=>c.toDataURL());assert.notEqual(initial,edited);
    await page.$eval('[data-profile-next]',b=>b.click());await page.waitForSelector('dialog[data-profile-step="review"]');
    await page.$eval('[data-profile-next]',b=>b.click());await page.waitForSelector('dialog[open]',{hidden:true});await ready();
    assert.equal(saves,1);assert.equal(saved.nickname,legacy.nickname);assert.equal(saved.strength,legacy.strength);assert.equal(saved.appearance.top,'shirt');
    const savedPixels=await page.$eval('.saved',c=>c.toDataURL());assert.equal(savedPixels,edited,'saved avatar equals editor preview');
    await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('dialog[open]');await ready();
    assert.equal(await page.$eval('.saved',c=>c.toDataURL()),savedPixels);
    await clickText('Tenue');
    assert.equal(await page.$eval('[aria-label="Haut : Chemise"]',b=>b.getAttribute('aria-pressed')),'true');
    assert(await page.$eval('dialog',d=>d.scrollWidth<=d.clientWidth+1),'editor fits 320px');
    checks.push('Ancien profil sans appearance : chargé, modifié dans le vrai éditeur, sauvegardé une fois puis rechargé avec pixels identiques (API locale)');
  }
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,phase:before?'before':'after',checks,errors,fixture:'Actual components; local synthetic API; no live account/database writes'},null,2)+'\n');
  if(!before){
    const reportRoot=resolve(root,'output/chanvrier-calibration');
    const comparisonCases=['Temoin','Visage-long','Tresses-coeur','Foulard-cheveux','Tablier-peau'];
    const tiles=[];
    for(let i=0;i<comparisonCases.length;i++)for(const [column,phase] of ['before','after'].entries()){
      const tile=await sharp(resolve(reportRoot,'combinations',phase,comparisonCases[i]+'.png')).resize(456,435,{fit:'contain',background:'#fff5df'}).png().toBuffer();
      tiles.push({input:tile,left:column*472,top:52+i*451});
    }
    const heading=Buffer.from('<svg width="944" height="52"><rect width="944" height="52" fill="#f6e9c9"/><g font-family="Arial" font-size="24" font-weight="bold" fill="#172923"><text x="20" y="35">Avant</text><text x="492" y="35">Après</text></g></svg>');
    await sharp({create:{width:944,height:52+comparisonCases.length*451,channels:3,background:'#f6e9c9'}}).composite([{input:heading,left:0,top:0},...tiles]).png().toFile(resolve(reportRoot,'comparaison.png'));
    const rows=comparisonCases.map(id=>`<section><h2>${id}</h2><div class="pair"><figure><img src="combinations/before/${id}.png" alt="${id} avant"><figcaption>Avant</figcaption></figure><figure><img src="combinations/after/${id}.png" alt="${id} après"><figcaption>Après</figcaption></figure></div></section>`).join('');
    await writeFile(resolve(reportRoot,'comparaison.html'),`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Personnages — comparaison avant/après</title><style>body{max-width:1100px;margin:24px auto;padding:0 16px;background:#f6e9c9;color:#172923;font:16px/1.5 Arial}h1{font-size:28px}h2{font-size:21px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{width:100%;height:auto}figcaption{font-weight:bold}a{color:#006a61}details{margin:20px 0}code{overflow-wrap:anywhere}</style><h1>Personnages : calibrage des dessins existants</h1><p>Mêmes configurations, dimensions et fonds. Chaque carte montre le personnage entier, son visage et le composant de classement à 48 px.</p><p>Corrections : mâchoires recalées sur le dessin source, traits préservés, nuances de cheveux et de peau conservées, manches et gants protégés, foulard sous les cheveux. Les identifiants et le format de sauvegarde restent identiques.</p>${rows}<details><summary>Couverture et limites</summary><p>72 associations visage/coiffure, chaque option de traits et de couleur, 16 paires bas/chaussures, 6 hauts, 12 silhouettes/peaux et 12 combinaisons difficiles. Éditeur testé à 320, 390 et 1440 px ; portraits à 48, 180 et 384 px. Les chargements, changements rapides et la sauvegarde/relecture d’un ancien profil sont vérifiés sur les vrais composants avec une API locale fictive. Aucune écriture en base distante. Les coiffures qui couvrent la mâchoire atténuent naturellement les différences de forme. Catalogue sans chapeau ; aucune combinaison de chapeau à vérifier.</p></details><details><summary>Modifier une pièce en respectant le gabarit</summary><p>Conserver les sources RGBA et leurs marges : tête maître 1254 × 1254, export tête 768 × 768 ; vêtements 768 × 1280. Mesurer les repères dans <code>chanvrier-head-registration.ts</code> et <code>chanvrier-composition.ts</code>. Garder le menton, les yeux, les oreilles et les cols raccordés. Une forme de visage ajuste le contour peint, sans déplacer les traits ni étirer le menton. Une tenue reste dans le cadre commun : jambes, chaussures, bas, haut, foulard, tête, boucle d’oreille. Pour une zone de peau, mesurer son RGB source et son point intérieur dans <code>chanvrier-body-registration.ts</code> ; le masque suit l’encre sans recolorer les manches crème. Les nouveaux dessins restent indépendants et recolorables. Repasser les galeries sur les mêmes profils avant/après, et inspecter les raccords aux tailles du jeu.</p></details><p><a href="combinations/after/profiles.json">Configurations exactes</a> · <a href="heads/after/report.json">Rapport visages</a> · <a href="outfits/after/report.json">Rapport tenues</a> · <a href="editor/after/report.json">Rapport éditeur</a> · <a href="combinations/after/report.json">Rapport assemblage et sauvegarde</a></p></html>`);
  }
  console.log(`PASS calibration: ${checks.length} groups. ${output}`);
} finally {await browser?.close();await server.close();}
