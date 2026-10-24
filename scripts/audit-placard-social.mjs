/** Isolated social RPG browser audit. All commands use the real tutorial adapter. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/social');
const communityOnly = process.argv.includes('--community-only');
const expansionOnly = process.argv.includes('--expansion-only');
const producerOnly = process.argv.includes('--producer-only');
const composerOnly = process.argv.includes('--composer-only') || producerOnly;
const illustrationsSmoke = process.argv.includes('--illustrations-smoke');
const illustrationIdsArgument=process.argv.find(argument=>argument.startsWith('--illustration-ids='));
const illustrationIds=illustrationIdsArgument?.slice('--illustration-ids='.length).split(',').filter(Boolean);
if(illustrationIds){assert.ok(illustrationIds.length>0,'Choose at least one illustration ID');assert.equal(new Set(illustrationIds).size,illustrationIds.length,'Illustration IDs must be unique');assert.equal(illustrationsSmoke,false,'Use either the selected-ID filter or smoke mode');}
const illustrationsOnly = process.argv.includes('--illustrations-only') || illustrationsSmoke || Boolean(illustrationIds);
const illustrationsReport = illustrationIds ? 'illustrations-selected-report.json' : illustrationsSmoke ? 'illustrations-smoke-report.json' : 'illustrations-report.json';
const port = Number(process.env.KQ_SOCIAL_PORT ?? 3411), origin = `http://127.0.0.1:${port}`;
const modules = {
  entry: `import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KqSocialNetworks} from '/src/components/placard/KqSocialNetworks';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
import {applyKqOperationsSocial,getKqOperationsSocial} from '/src/lib/kanab-quest-operations-social';
import {getKqSocialAdventure} from '/src/lib/kanab-quest-social-adventure';
import {projectKqSocialCultureContext} from '/src/lib/kanab-quest-social-culture';
import {getKqSocialProducerNarrative} from '/src/lib/kanab-quest-social-producer';
import {createKqSocialSnapshot,getKqSocialScenario,getKqSocialChoicePreview,KQ_SOCIAL_SPONSORS} from '/src/lib/kanab-quest-social';
import {getKqSocialFeed,getKqSocialFeedOutcome} from '/src/lib/kanab-quest-social-feed';
import {getKqSocialPlayer} from '/src/lib/kanab-quest-social-player';
import {KQ_SOCIAL_SCENARIOS} from '/src/lib/kanab-quest-social-stories';
import {DEFAULT_CHANVRIER_APPEARANCE} from '/src/lib/arena-chanvrier';
let state=createKqOperationsLesson('market'),mode='ready',refresh=()=>{},cultureOverride=null;
const identities={
 elodie:{firstName:'Élodie',profile:{nickname:'elodie.atelier',gender:'female',skin:'brown',clothing:'berry',strength:'merchant',appearance:{...DEFAULT_CHANVRIER_APPEARANCE,hair:'braids',hairColor:'black',face:'round',eyes:'bright',top:'apron',bottom:'skirt',bottomColor:'violet'}}},
 mehdi:{firstName:'Mehdi',profile:{nickname:'mehdi.latelier',gender:'male',skin:'honey',clothing:'teal',strength:'green-thumb',appearance:{...DEFAULT_CHANVRIER_APPEARANCE,hair:'quiff',hairColor:'ginger',face:'square',eyes:'relaxed',facialHair:'stubble',top:'hoodie',bottom:'cargo',bottomColor:'sage'}}},
 long:{firstName:'Anne-Charlotte-Marie-Alexandrine',profile:{nickname:'atelier.anne-charlotte',gender:'female',skin:'brown',clothing:'berry',strength:'merchant',appearance:{...DEFAULT_CHANVRIER_APPEARANCE,hair:'braids',top:'apron'}}},
 missing:{firstName:null,profile:null},
};
let identity=identities.elodie;
window.requests=[];window.notifications=[];
const socialSnapshot=()=>getKqOperationsSocial(state,cultureOverride??undefined);
const execute=(path,method,body={})=>{
 if(path==='/api/arena/placard/social'&&cultureOverride){
  if(method==='GET')return socialSnapshot();
  const key=path+':'+body.requestKey;
  if(state.receipts[key])return {...state.receipts[key],culture:cultureOverride};
  const next=structuredClone(state),payload=applyKqOperationsSocial(next,body,false,false,cultureOverride);
  next.receipts[key]=structuredClone(payload);delete next.receipts[key].culture;state=next;return payload;
 }
 const result=applyKqOperationsRequest(state,{path,method,body});state=result.state;return result.payload
};
window.fixture=()=>structuredClone(socialSnapshot());
window.commerce=()=>structuredClone(getKqOperationsCommerce(state));
window.catalog=()=>structuredClone(KQ_SOCIAL_SPONSORS);
window.scene=platform=>{const snapshot=socialSnapshot(),available=getKqSocialAdventure(snapshot,platform),id=document.querySelector('[data-social-subject][aria-pressed="true"]')?.dataset.socialSubject;return (id&&available.subjects.some(subject=>subject.id===id)?getKqSocialAdventure(snapshot,platform,id):available).scene};
window.sceneRequirement=platform=>getKqSocialProducerNarrative(window.scene(platform).id).requirement;
window.player=()=>getKqSocialPlayer(identity);
window.feedPresentation=platform=>getKqSocialFeed(window.scene(platform),getKqOperationsSocial(state).platforms[platform].memory,window.player());
window.feedOutcome=id=>getKqSocialFeedOutcome(getKqOperationsSocial(state).history.find(entry=>entry.id===id),window.player());
window.artScenes=()=>KQ_SOCIAL_SCENARIOS.map(scene=>({id:scene.id,platform:scene.platform,chapter:KQ_SOCIAL_SCENARIOS.filter(item=>item.platform===scene.platform).findIndex(item=>item.id===scene.id)}));
window.preview=(platform,choiceId)=>getKqSocialChoicePreview(socialSnapshot(),platform,window.scene(platform).choices.find(c=>c.id===choiceId));
window.setFailure=name=>{mode=name};
const api=createKqTutorialApi(async(path,options={})=>{
 const method=options.method??'GET',body=options.body?JSON.parse(options.body):{};
 window.requests.push({path,method,body:structuredClone(body)});
 if(path==='/api/arena/placard/social/player'&&method==='GET')return Response.json(structuredClone(identity));
 if(mode==='unavailable'&&method==='GET')return Response.json({error:'Réseaux indisponibles dans cet essai.'},{status:503});
 if(mode==='old-server'&&method==='GET')return Response.json({version:1});
 if(mode==='refusal'&&method==='POST')return Response.json({error:'La situation a changé. Actualise les réseaux avant de choisir.'},{status:409});
 try {const payload=execute(String(path),method,body);refresh();if(mode==='lost-result'&&method==='POST'){mode='ready';return Response.json({error:'Réponse perdue après enregistrement. Vérifie le même choix.'},{status:503})}return Response.json(payload)}
 catch(error){return Response.json({error:error.message},{status:409})}
});
const notify=api.notify;api.notify=(name,detail)=>{window.notifications.push(name);notify(name,detail)};
window.setIdentity=name=>{identity=identities[name];api.notify('arena:profile-updated')};
const makeCulture=name=>{
 const now=state.trial.clock,at=new Date(now).toISOString();
 const run=(id,variety,zone,stageIndex=2)=>({id,updatedAt:at,state:{varietyCode:'BUD-'+id,varietyName:variety,stageIndex,phase:'prepare',warehouse:{version:2,zoneId:'zone-'+id,zones:[{id:'zone-'+id,name:zone}]},history:[]}});
 const runs=['empty','curing','ready'].includes(name)?[]:[run('one','Payton Strawberry','Atelier nord',name==='flowering'?3:2)];
 if(name==='multi')runs.push(run('two','Futura 75','Atelier sud'));
 const lots=['curing','ready'].includes(name)?[{id:'lot-one',runId:'one',varietyCode:'BUD-one',varietyName:'Payton Strawberry',cultivation:'indoor',harvestGrams:212.4,remainingGrams:90,harvestedAt:new Date(now-3600000).toISOString(),storage:{harvestedAt:new Date(now-3600000).toISOString(),readyAt:new Date(now+(name==='ready'?-1000:3600000)).toISOString()}}]:[];
 return projectKqSocialCultureContext({runs,lots},now,'own');
};
window.changeCulture=(name,notify=true)=>{cultureOverride=makeCulture(name);if(notify){api.notify('kq:social-updated');refresh()}};
window.showCulture=(name,requirement,platform='instagram')=>{
 const revision=socialSnapshot().revision+1;
 state=createKqOperationsLesson('market');mode='ready';cultureOverride=makeCulture(name);window.requests=[];window.notifications=[];
 state.social=createKqSocialSnapshot(state.trial.clock,state.trial.commerce.online.followers,true);
 state.social.revision=revision;
 const scenes=KQ_SOCIAL_SCENARIOS.filter(scene=>scene.platform===platform),index=scenes.findIndex(scene=>scene.episode===1&&getKqSocialProducerNarrative(scene.id).requirement===requirement);
 if(index<0)throw Error('Missing culture requirement '+requirement);
 state.social.platforms[platform].chapter=index;window.requestedCultureScene=scenes[index].id;api.notify('kq:social-updated');refresh();
};
window.showCommunity=()=>{state.social=createKqSocialSnapshot(state.trial.clock,state.trial.commerce.online.followers,true);state.social.platforms.instagram.chapter=8;api.notify('kq:social-updated');refresh()};
window.showExpansion=platform=>{state.social=createKqSocialSnapshot(state.trial.clock,state.trial.commerce.online.followers,true);state.social.platforms[platform].chapter=9;api.notify('kq:social-updated');refresh()};
window.showIllustration=(platform,chapter)=>{const revision=getKqOperationsSocial(state).revision+1;state.social=createKqSocialSnapshot(state.trial.clock,state.trial.commerce.online.followers,true);state.social.revision=revision;state.social.platforms[platform].chapter=chapter;api.notify('kq:social-updated');refresh()};
window.advance=hours=>{execute('/api/arena/placard/commerce','POST',{action:'online',command:'advance-online-time',payload:{hours},requestKey:crypto.randomUUID()});api.notify('kq:social-updated');refresh()};
function App(){const[revision,setRevision]=useState(0),[scenario,setScenario]=useState('ready');refresh=()=>setRevision(value=>value+1);
 window.reset=name=>{state=createKqOperationsLesson('market');cultureOverride=null;mode=name;window.requests=[];window.notifications=[];if(['tired','pressure','sponsors'].includes(name)){state.social=createKqSocialSnapshot(state.trial.clock,state.trial.commerce.online.followers,true);if(name==='tired')state.social.energy=2;else{const ig=state.social.platforms.instagram,x=state.social.platforms.x;ig.followers=name==='sponsors'?1200:600;x.followers=name==='sponsors'?1200:200;ig.moderation=name==='pressure'?3:0;x.haters=name==='pressure'?50:0;if(name==='sponsors'){ig.trust=90;x.trust=90}state.social.socialFollowers=ig.followers+x.followers;state.trial.commerce.online.followers+=state.social.socialFollowers;state.social.audienceFollowers=state.trial.commerce.online.followers}}setScenario(name+'-'+(revision+1));setRevision(value=>value+1)};
 return <KqTutorialApiProvider api={api}><aside className="fixture-tools"><strong>Démo locale · aventure sociale</strong><p>Données fictives en mémoire. Aucun compte externe ni partie réelle n’est modifié.</p></aside><main className="audit-surface"><KqSocialNetworks key={scenario}/></main></KqTutorialApiProvider>
}
createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const template = await readFile(resolve(root, 'scripts/audit-placard-online-progression.mjs'), 'utf8');
const html = template.match(/const html = `([\s\S]*?)`;\r?\nconst server/)[1].replace('<head>', '<head><link rel="icon" href="data:,">');
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  plugins: [{ name: 'isolated-social', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((request, response, next) => { if (request.url?.startsWith('/api/')) { response.statusCode = 403; response.end('Real API disabled'); return; } if (request.url !== '/') return next(); response.setHeader('Content-Type', 'text/html'); response.end(html); }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
const checks = [], errors = [], forbidden = [], failures = [], identityEvidence = [], artworkEvidence = [];
let browser, page;
await mkdir(output, { recursive: true });
await server.listen();
try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() }); });
  await page.setRequestInterception(true);
  page.on('request', request => { const url = request.url(); if ((url.startsWith(origin + '/') && !url.includes('/api/')) || url.startsWith('data:')) void request.continue(); else { forbidden.push(url); void request.abort(); } });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(origin, { waitUntil: 'networkidle0', timeout: 60000 });

  const ready = () => page.waitForSelector('[data-social-choice]', { visible: true });
  const snapshot = () => page.evaluate(() => window.fixture());
  const posts = () => page.evaluate(() => window.requests.filter(request => request.method === 'POST'));
  const socialReads = () => page.evaluate(() => window.requests.filter(request => request.method === 'GET' && request.path === '/api/arena/placard/social').length);
  const reset = async name => { await page.evaluate(name => window.reset(name), name); if (!['unavailable','old-server'].includes(name)) { await ready(); await page.waitForFunction(() => !document.querySelector('[data-social-choice]').disabled || window.fixture().energy < 5); } };
  const clickText = async (text, scope = '[data-social-networks]') => { const handle = await page.waitForFunction((text, scope) => [...document.querySelectorAll(scope + ' button')].find(node => node.textContent.trim() === text && !node.disabled && node.getBoundingClientRect().height > 0), {}, text, scope); await handle.asElement().click(); await handle.dispose(); };
  const act = async selector => { const before = (await snapshot()).revision,reads=await socialReads(); await page.click(selector); await page.waitForFunction(revision => window.fixture().revision > revision, {}, before); await page.waitForSelector('[data-social-result]'); await page.waitForFunction(() => !document.querySelector('[data-social-retry]')); assert.equal(await socialReads(),reads,'An acknowledged command reuses its authoritative snapshot without another social GET'); };
  const closed = () => page.waitForFunction(() => !document.querySelector('dialog[open]'));
  const continueStory = async () => { if (await page.$('[data-social-result]')) await clickText('Continuer', '[data-social-result]'); };
  const overflow = async label => { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page overflow'); assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-social-networks] *')].filter(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().right > innerWidth + 1).map(node=>node.tagName+'.'+node.className)), [], label + ': clipped contents'); assert.doesNotMatch(await page.$eval('[data-social-networks]',node=>node.innerText), /NaN|undefined|Infinity/); };
  const contextText = () => page.$eval('[data-social-context]', node => node.innerText);
  const canvasFingerprint = selector => page.$eval(selector, canvas => {
    const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let hash=2166136261,visible=0;
    for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619);if(i%4===3&&pixels[i]>0)visible++}
    return {hash:hash>>>0,visible,width:canvas.width,height:canvas.height};
  });
  const playerPortrait = async () => {
    const player = await page.evaluate(() => window.player());
    await page.waitForFunction(player => [...document.querySelectorAll('[data-social-scene] [data-social-draft]')].every(node => node.innerText.includes(player.name) && node.innerText.includes(player.handle)), {}, player);
    await page.waitForFunction(() => {
      const portraits = [...document.querySelectorAll('[data-social-player-avatar] canvas')];
      return portraits.length > 0 && portraits.every(canvas => canvas.dataset.avatarState === 'ready' && canvas.getAttribute('aria-busy') === 'false');
    });
    const fingerprint = await canvasFingerprint('[data-social-player-avatar] canvas');
    assert.ok(fingerprint.visible>10000,'The real customized portrait canvas contains rendered pixels');
    assert.equal(fingerprint.width,768);assert.equal(fingerprint.height,768);
    assert.doesNotMatch(await page.$$eval('[data-social-feed]',nodes=>nodes.map(node=>node.innerText).join('\n')),/\bSylvain\b/,'Feed identities and messages do not keep a fixed player name');
    return fingerprint;
  };
  const illustration = async (scope, scenarioId, artwork, imageAlt) => {
    assert.ok(artwork,'A dedicated illustration is defined for '+scenarioId);
    const selector=scope+' [data-social-artwork="'+scenarioId+'"]';
    await page.waitForSelector(selector,{visible:true});
    await page.$eval(selector,node=>node.scrollIntoView({block:'center'}));
    await page.waitForFunction(selector=>{const image=document.querySelector(selector+' img');return image?.complete&&image.naturalWidth>0}, {}, selector);
    const evidence=await page.$eval(selector,node=>{const image=node.querySelector('img'),frame=node.getBoundingClientRect(),person=node.querySelector('[data-social-player-scene]')?.getBoundingClientRect();return {id:node.dataset.socialArtwork,placement:node.dataset.playerPlacement,alt:node.getAttribute('aria-label'),src:new URL(image.currentSrc||image.src).pathname,width:image.naturalWidth,height:image.naturalHeight,renderedWidth:frame.width,fit:getComputedStyle(image).objectFit,canvases:node.querySelectorAll('[data-social-player-scene] canvas').length,person:person?{left:(person.left-frame.left)/frame.width,width:person.width/frame.width,bottom:(person.bottom-frame.top)/frame.height}:null}});
    assert.equal(evidence.src,artwork.src,'The displayed illustration belongs to the actual situation');
    assert.equal(evidence.placement,artwork.playerPlacement);assert.equal(evidence.alt,imageAlt);
    assert.equal(evidence.fit,'contain','The square illustration remains complete without a crop');
    assert.ok(evidence.width>=512&&evidence.width===evidence.height,'Dedicated art is a decoded square image');
    const player=await page.evaluate(()=>window.player());
    assert.equal(evidence.canvases,player.profile&&artwork.playerPlacement!=='none'?1:0,'A real player canvas is mounted only in the intended placement');
    if(evidence.canvases){
      await page.waitForFunction(selector=>document.querySelector(selector+' [data-social-player-scene] canvas')?.dataset.avatarState==='ready',{},selector);
      assert.ok(Math.abs(evidence.person.left-(artwork.playerPlacement==='center'?0.25:0))<0.015,'Avatar placement follows dedicated art independently of its older generic image category');
      assert.ok(Math.abs(evidence.person.width-0.5)<0.015&&evidence.person.bottom<1,'The complete avatar fits within the illustration');
    }
    return evidence;
  };
  const feed = async platform => {
    const selector = '[data-social-scene] [data-social-feed="'+platform+'"]';
    await page.waitForSelector(selector, {visible:true});
    assert.equal(await page.$$eval('[data-social-scene] [data-social-feed]', nodes => nodes.filter(node => node.getBoundingClientRect().height > 0).length), 1, 'Only the selected network story feed is visible');
    const scene = await page.evaluate(platform => window.scene(platform), platform);
    const presentation = await page.evaluate(platform => window.feedPresentation(platform), platform);
    assert.deepEqual(await page.$$eval('[data-social-scene] [data-social-draft]', nodes => nodes.map(node => node.dataset.socialDraft).sort()), scene.choices.map(choice => choice.id).sort(), 'Every choice appears as its own publication draft');
    assert.equal(await page.$$eval('[data-social-scene] [data-social-draft]', nodes => nodes.every(node => {
      const button = node.querySelector('[data-social-choice]');
      return button && button.dataset.socialChoice === node.dataset.socialDraft && button.textContent.trim() === 'Publier' && button.getAttribute('aria-label')?.startsWith('Publier : ') && node.innerText.length > 50;
    })), true, 'Drafts retain one real accessible publishing control and visible content');
    await page.waitForSelector('[data-social-context]', {visible:true});
    assert.ok((await contextText()).includes(scene.body),'The actual situation is visible before the player chooses');
    assert.equal(await page.$$eval('[data-social-scene] [data-social-comment]',nodes=>nodes.length),0,'No reaction is invented before publication');
    assert.equal(await page.$$eval('[data-social-scene] [aria-label^="Publication de "]',nodes=>nodes.length),0,'The composer does not start from another character\'s published post');
    assert.equal(await page.$$eval('[data-social-scene] [data-person]',nodes=>nodes.every(node=>node.dataset.person==='player')),true,'The composer shows only the player\'s identity');
    assert.equal(await page.$$eval('[data-social-composer] [data-social-draft]',nodes=>nodes.length),scene.choices.length,'Every available draft belongs to the player composer');
    assert.equal(await page.$$eval('[data-social-scene] [data-social-draft]', (nodes, texts) => nodes.every(node => node.innerText.includes(texts[node.dataset.socialDraft])), presentation.choicePosts), true, 'The player reads the exact draft that will be published');
    assert.doesNotMatch(await page.$eval(selector, node => node.innerText), /\b\d[\d\s.,]*\s*(?:likes|vues|reposts|retweets|j[’']aime)\b/i, 'Feed chrome does not invent engagement counters');
    await illustration(selector,scene.id,presentation.artwork,presentation.imageAlt);
    await page.waitForFunction(selector => [...document.querySelectorAll(selector+' img')].every(node => node.complete && node.naturalWidth > 0), {}, selector);
    const images = await page.$$eval(selector+' img', nodes => nodes.map(node => ({src:node.currentSrc || node.src,alt:node.getAttribute('alt'),width:node.naturalWidth})));
    assert.ok(images.every(image => new URL(image.src).origin === origin && /^\/(?:placard|contest|app\/kanab-quest)\//.test(new URL(image.src).pathname) && image.alt !== null && image.width > 0), 'Illustrations load from local game assets with alt attributes');
    if (platform === 'x') {
      assert.equal(await page.$$eval(selector+' [data-social-attachment]',nodes=>nodes.length),1,'X displays one compact illustrated attachment');
      assert.ok(await page.$eval(selector+' [data-social-attachment]',node=>node.getBoundingClientRect().width<=321),'The X illustration stays compact');
      assert.match(await page.$eval(selector,node=>node.innerText),/Nouvelle publication/,'X presents a new player publication');
      assert.doesNotMatch(await page.$eval(selector,node=>node.innerText),/En réponse à cette conversation|Tu réponds quoi/,'X drafts are not framed as replies to an invented post');
    }
  };
  const recordedPost = async entry => {
    const selector = '[data-social-published="'+entry.id+'"]';
    await page.waitForSelector(selector, {visible:true});
    assert.equal(await page.$$eval(selector, nodes => nodes.length), 1, 'A committed post appears exactly once');
    const ids = await page.$$eval('[data-social-published]', nodes => nodes.map(node => node.dataset.socialPublished));
    const historyIds = (await snapshot()).history.map(item => item.id);
    assert.ok(ids.every(id => historyIds.includes(id)), 'Every published card is backed by authoritative history');
    const outcome = await page.evaluate(id => window.feedOutcome(id), entry.id);
    assert.ok(outcome && await page.$eval(selector, (node, text) => node.innerText.includes(text), outcome.text), 'The recorded post displays the committed choice text');
    assert.ok(await page.$eval(selector, (node, name) => node.innerText.includes(name), outcome.author.name), 'The recorded post keeps the player identity from the game');
    for (const comment of outcome.comments) {
      const renderedComment=selector+' [data-social-comment="'+comment.id+'"]';
      assert.equal(await page.$$eval(renderedComment,nodes=>nodes.length),1,'Each reply belongs to this committed publication');
      assert.ok(await page.$eval(renderedComment,(node,text)=>node.innerText.includes(text),comment.text),'The reply responds to the actual choice text');
    }
    assert.equal(await page.$$eval('[data-social-comment]',nodes=>nodes.every(node=>node.closest('[data-social-published]'))),true,'Reactions exist only beneath confirmed publications');
    await illustration(selector,entry.scenarioId,outcome.artwork,outcome.imageAlt);
    assert.doesNotMatch(await page.$eval(selector, node => node.innerText), /\b\d[\d\s.,]*\s*(?:likes|vues|reposts|retweets|j[’']aime)\b/i, 'Recorded posts show no fictional engagement counters');
  };
  if (composerOnly) {
    await ready();await page.evaluate(()=>document.fonts.ready);
    for(const platform of ['instagram','x']){
      await reset('ready');await page.click('[data-platform="'+platform+'"]');
      await playerPortrait();await feed(platform);
      assert.equal(await page.$$eval('[data-social-published], [data-social-comment]',nodes=>nodes.length),0,'Opening a network does not fabricate an existing publication or reaction');
      for(const width of [320,390,1440]){
        await page.setViewport({width,height:1000});await overflow('Composer '+platform+' '+width);
        await page.$eval('[data-social-context]',node=>node.scrollIntoView({block:'start'}));
        await page.screenshot({path:resolve(output,'composer-'+platform+'-'+width+'.png'),fullPage:true});
      }
      const before=await snapshot(),cash=(await page.evaluate(()=>window.commerce())).cashCents,reads=await socialReads();
      const choice=await page.evaluate(platform=>window.scene(platform).choices.find(choice=>choice.intent==='craft').id,platform);
      await page.focus('[data-social-choice="'+choice+'"]');await page.keyboard.press('Enter');
      await page.waitForFunction(revision=>window.fixture().revision===revision+1,{},before.revision);
      await page.waitForSelector('[data-social-result]');
      const after=await snapshot(),entry=after.history[0];
      assert.equal(entry.id,(await posts())[0].body.requestKey);assert.equal(entry.choiceId,choice);
      assert.equal((await posts()).length,1,'Keyboard publishing submits once');
      assert.equal(await socialReads(),reads,'Confirmed publishing does not cause an extra social GET');
      assert.equal((await page.evaluate(()=>window.commerce())).cashCents,cash);
      await recordedPost(entry);await feed(platform);
      if(platform==='x')assert.equal(await page.$$eval('[data-social-published] [data-comment-kind="quote"]',nodes=>nodes.length),(await page.evaluate(id=>window.feedOutcome(id),entry.id)).comments.filter(comment=>comment.kind==='quote').length,'Quotes correspond to this exact authored reply pair');
      for(const width of [320,390,1440]){
        await page.setViewport({width,height:1000});await overflow('Confirmed player post '+platform+' '+width);
        await page.$eval('[data-social-published]',node=>node.scrollIntoView({block:'start'}));
        await page.screenshot({path:resolve(output,'composer-published-'+platform+'-'+width+'.png'),fullPage:true});
      }
      checks.push(platform+': visible context and player drafts at 320/390/1440; keyboard Publier records exactly once, then displays only that receipt\'s reactions');
    }
    await reset('refusal');await page.click('[data-social-choice="workshop"]');
    await page.waitForSelector('[data-social-networks] [role="alert"]');
    assert.equal((await snapshot()).history.length,0);assert.equal((await snapshot()).energy,100);
    assert.equal(await page.$$eval('[data-social-published], [data-social-comment]',nodes=>nodes.length),0,'A refused draft receives no fake publication or reactions');
    checks.push('A server refusal preserves the draft and energy without fabricating a post or response');
    await reset('lost-result');const reads=await socialReads();await page.click('[data-social-choice="workshop"]');
    await page.waitForSelector('[data-social-retry]');
    await page.waitForFunction(reads=>window.requests.filter(request=>request.method==='GET'&&request.path==='/api/arena/placard/social').length===reads+1,{},reads);
    const uncertain=await snapshot();await page.click('[data-social-retry]');await page.waitForFunction(()=>!document.querySelector('[data-social-retry]'));
    assert.equal((await snapshot()).revision,uncertain.revision);
    const commands=await posts();assert.equal(commands.length,2);assert.equal(commands[0].body.requestKey,commands[1].body.requestKey);
    assert.equal(await socialReads(),reads+1);await recordedPost(uncertain.history[0]);
    checks.push('A lost response verifies once and retries the same UUID, without duplicating the recorded publication or reactions');
    const unchanged=await snapshot(),elodie=await playerPortrait();
    await page.evaluate(()=>window.setIdentity('mehdi'));const mehdi=await playerPortrait();
    assert.notEqual(mehdi.hash,elodie.hash);await feed('instagram');await recordedPost(unchanged.history[0]);
    await page.evaluate(()=>window.setIdentity('long'));await playerPortrait();await page.setViewport({width:320,height:1000});await feed('instagram');await overflow('Long player name composer');
    assert.deepEqual(await snapshot(),unchanged,'Identity refresh does not mutate the social game');
    checks.push('The composer and recorded post retain the real player identity and avatar, including long names at 320 px');
    if(producerOnly){
      await page.evaluate(()=>window.setIdentity('elodie'));await playerPortrait();
      const showCulture=async(name,requirement,platform='instagram')=>{
        await page.evaluate((name,requirement,platform)=>window.showCulture(name,requirement,platform),name,requirement,platform);
        await page.click('[data-platform="'+platform+'"]');
        await page.waitForFunction(()=>document.querySelector('[data-social-composer]')?.dataset.socialComposer===window.scene('instagram').id);
        if(name!=='empty')await page.waitForFunction(()=>document.querySelector('[data-social-composer]')?.dataset.socialComposer===window.requestedCultureScene);
        await page.waitForFunction(()=>document.querySelector('[data-social-context]')?.innerText.includes(window.scene('instagram').body));
      };
      const publishCraft=async platform=>{
        const choice=await page.evaluate(platform=>window.scene(platform).choices.find(choice=>choice.intent==='craft').id,platform);
        await act('[data-social-choice="'+choice+'"]');return (await snapshot()).history[0];
      };
      await showCulture('empty','flowering');
      assert.equal(await page.evaluate(()=>window.sceneRequirement('instagram')),'general','No crop allows only general producer posts');
      assert.notEqual(await page.evaluate(()=>window.scene('instagram').id),await page.evaluate(()=>window.requestedCultureScene));
      assert.equal(await page.$$eval('[data-social-subjects]',nodes=>nodes.length),0);
      assert.doesNotMatch(await page.$$eval('[data-social-draft]',nodes=>nodes.map(node=>node.innerText).join('\n')),/Payton Strawberry|Futura 75|\{\{/);
      await feed('instagram');checks.push('An empty verified farm skips fact-dependent crop scenes and invents neither a variety nor a harvest');

      await showCulture('multi','culture');
      await page.waitForSelector('[data-social-subjects]');
      assert.equal(await page.$$eval('[data-social-subject]',nodes=>nodes.length),2);
      assert.equal(await page.$$eval('[data-social-subject][aria-pressed="true"]',nodes=>nodes.length),0,'Multiple crops require an explicit choice');
      assert.equal(await page.$$eval('[data-social-choice]',nodes=>nodes.every(node=>node.disabled)),true);
      await page.click('[data-social-subject="run:two"]');
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-social-choice]')].some(node=>!node.disabled));
      await feed('instagram');
      const drafts=await page.$$eval('[data-social-draft]',nodes=>nodes.map(node=>node.innerText).join('\n'));
      assert.match(drafts,/Futura 75/);assert.doesNotMatch(drafts,/Payton Strawberry|\{\{/);
      for(const width of [320,1440]){await page.setViewport({width,height:1000});await overflow('Real multi-zone subject '+width);await page.screenshot({path:resolve(output,'producer-multizone-'+width+'.png'),fullPage:true});}
      await page.evaluate(()=>window.changeCulture('culture'));
      await page.waitForFunction(()=>!document.querySelector('[data-social-subjects]')&&[...document.querySelectorAll('[data-social-choice]')].some(node=>!node.disabled));
      assert.match(await page.$$eval('[data-social-draft]',nodes=>nodes.map(node=>node.innerText).join('\n')),/Payton Strawberry/);
      checks.push('Removing the selected zone falls back to the sole verified crop without leaving publishing disabled');
      await page.evaluate(()=>window.changeCulture('multi'));await page.waitForSelector('[data-social-subject="run:two"]');
      await page.click('[data-social-subject="run:two"]');
      const chosen=await publishCraft('instagram');
      assert.equal(chosen.subject.id,'run:two');assert.equal(chosen.subject.variety,'Futura 75');assert.equal(chosen.narrativeVersion,3);
      assert.equal((await posts())[0].body.subjectId,'run:two');assert.ok((await posts())[0].body.contextKey.startsWith('v3-'));
      await recordedPost(chosen);
      const receiptText=await page.$eval('[data-social-published="'+chosen.id+'"]',node=>node.innerText);
      await page.evaluate(()=>window.changeCulture('flowering'));
      await page.waitForFunction(()=>document.querySelector('[data-social-composer]')?.dataset.socialComposer===window.scene('instagram').id);
      assert.equal(await page.$eval('[data-social-published="'+chosen.id+'"]',node=>node.innerText),receiptText,'Changing current culture never rewrites a committed post');
      checks.push('Two real zones require a selection, bind the chosen variety and key, and preserve the published subject after culture changes');

      await showCulture('culture','culture');
      const staleChoice=await page.evaluate(()=>window.scene('instagram').choices.find(choice=>choice.intent==='craft').id);
      const beforeStale=await snapshot();await page.evaluate(()=>window.changeCulture('empty',false));
      await page.click('[data-social-choice="'+staleChoice+'"]');
      await page.waitForSelector('[data-social-networks] [role="alert"]');
      assert.equal((await snapshot()).revision,beforeStale.revision);assert.equal((await snapshot()).energy,beforeStale.energy);
      assert.equal((await snapshot()).history.length,0);assert.equal(await page.$$eval('[data-social-published], [data-social-comment]',nodes=>nodes.length),0);
      checks.push('A crop removed after preview is rejected at publication without spending energy or fabricating a receipt');

      for(const [name,requirement] of [['flowering','flowering'],['curing','harvest'],['curing','curing'],['ready','ready']]){
        await showCulture(name,requirement);await feed('instagram');
        assert.equal(await page.evaluate(()=>window.sceneRequirement('instagram')),requirement);
        assert.match(await contextText(),/Payton Strawberry/);
        const entry=await publishCraft('instagram');
        assert.equal(entry.subject.requirement,requirement);assert.equal(entry.subject.variety,'Payton Strawberry');
        if(requirement==='harvest'){assert.equal(entry.subject.harvestGrams,212.4);assert.match((await page.evaluate(id=>window.feedOutcome(id),entry.id)).text,/212,4/);}
        await recordedPost(entry);await page.setViewport({width:320,height:1000});await overflow('Actual '+requirement+' post');
        await page.screenshot({path:resolve(output,'producer-'+requirement+'-320.png'),fullPage:true});
        checks.push('Verified '+requirement+' subject is used in the selected draft, recorded post and matching reactions');
      }
    }
    assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);assert.deepEqual(failures,[]);
    await writeFile(resolve(output,producerOnly?'producer-report.json':'composer-report.json'),JSON.stringify({success:true,checks,errors,forbidden,failures},null,2));
    console.log(JSON.stringify({success:true,checks:checks.length,mode:producerOnly?'producer-only':'composer-only',output},null,2));
  } else if (illustrationsOnly) {
    await ready();await page.evaluate(()=>document.fonts.ready);
    const catalog=await page.evaluate(()=>window.artScenes());assert.equal(catalog.length,54);
    const scenes=illustrationIds?catalog.filter(scene=>illustrationIds.includes(scene.id)):illustrationsSmoke?catalog.filter(scene=>['ig-first-frame','x-first-thread','x-rival'].includes(scene.id)):catalog;
    if(illustrationIds)assert.equal(scenes.length,illustrationIds.length,'Every requested illustration ID exists in the real catalog');
    for(const scene of scenes){
      await continueStory();await page.evaluate(scene=>window.showIllustration(scene.platform,scene.chapter),scene);
      await page.click('[data-platform="'+scene.platform+'"]');
      await page.waitForFunction(id=>document.querySelector('[data-social-scene]')?.dataset.socialScene===id,{},scene.id);
      await playerPortrait();await feed(scene.platform);
      const presentation=await page.evaluate(platform=>window.feedPresentation(platform),scene.platform);
      const evidence=await illustration('[data-social-scene]',scene.id,presentation.artwork,presentation.imageAlt);
      for(const width of [320,1440]){
        await page.setViewport({width,height:1000});await overflow('Illustration '+scene.id+' '+width);
        const figure=await page.$('[data-social-scene] [data-social-artwork="'+scene.id+'"]');
        await figure.screenshot({path:resolve(output,'illustration-'+scene.id+'-'+width+'.png')});
      }
      if(evidence.canvases){const pixels=await canvasFingerprint('[data-social-scene] [data-social-player-scene] canvas');assert.ok(pixels.visible>10000);assert.equal(pixels.height,1280)}
      const choice=await page.evaluate(platform=>window.scene(platform).choices.find(choice=>choice.intent==='craft'),scene.platform);
      await act('[data-social-choice="'+choice.id+'"]');await recordedPost((await snapshot()).history[0]);
      for(const width of [320,1440]){
        await page.setViewport({width,height:1000});await overflow('Recorded illustration '+scene.id+' '+width);
        const figure=await page.$('[data-social-published] [data-social-artwork="'+scene.id+'"]');
        await figure.screenshot({path:resolve(output,'publication-'+scene.id+'-'+width+'.png')});
      }
      artworkEvidence.push(evidence);
      checks.push(scene.id+': unique local illustration at 320/1440, intended avatar placement and matching committed result');
      if(artworkEvidence.length%9===0)console.log(JSON.stringify({mode:'illustrations-only',verified:artworkEvidence.length,total:scenes.length}));
    }
    assert.equal(new Set(artworkEvidence.map(item=>item.src)).size,scenes.length);
    if(!illustrationIds){if(!illustrationsSmoke)assert.ok(artworkEvidence.some(item=>item.placement==='none'));assert.ok(artworkEvidence.some(item=>item.placement==='left'));assert.ok(artworkEvidence.some(item=>item.placement==='center'));}
    await continueStory();const sample=artworkEvidence.find(item=>item.canvases);
    if(sample){
    const scene=scenes.find(item=>item.id===sample.id);
    await page.evaluate(scene=>window.showIllustration(scene.platform,scene.chapter),scene);await page.click('[data-platform="'+scene.platform+'"]');
    await page.waitForSelector('[data-social-scene="'+scene.id+'"]');await feed(scene.platform);
    const elodie=await canvasFingerprint('[data-social-scene] [data-social-player-scene] canvas');
    await page.evaluate(()=>window.setIdentity('mehdi'));await playerPortrait();await feed(scene.platform);
    const mehdi=await canvasFingerprint('[data-social-scene] [data-social-player-scene] canvas');assert.notEqual(elodie.hash,mehdi.hash);
    await page.setViewport({width:320,height:1000});await overflow('Dedicated art with Mehdi');
    await page.evaluate(()=>window.setIdentity('missing'));
    await page.waitForFunction(()=>document.querySelectorAll('[data-social-player-avatar] canvas').length===0);await feed(scene.platform);await overflow('Dedicated art without a profile');
    assert.equal(await page.$$eval('[data-social-scene] [data-social-player-scene]',nodes=>nodes.length),0);
    identityEvidence.push({elodie,mehdi});checks.push('Dedicated art retains different real avatar pixels on live identity changes and a neutral backdrop when the profile is absent');
    }
    assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);assert.deepEqual(failures,[]);
    await writeFile(resolve(output,illustrationsReport),JSON.stringify({success:true,checks,artworkEvidence,identityEvidence,errors,forbidden,failures},null,2));
    console.log(JSON.stringify({success:true,checks:checks.length,mode:illustrationIds?'illustrations-selected':illustrationsSmoke?'illustrations-smoke':'illustrations-only',output},null,2));
  } else if (expansionOnly) {
    for (const platform of ['instagram','x']) {
      await reset('ready');await page.evaluate(platform=>window.showExpansion(platform),platform);
      await page.click('[data-platform="'+platform+'"]');
      await page.waitForFunction(platform=>document.querySelector('[data-social-scene]')?.dataset.socialScene===window.scene(platform).id,{},platform);
      const initialScene=await page.evaluate(platform=>window.scene(platform),platform);
      assert.equal(initialScene.id,platform==='instagram'?'ig-credit-source':'x-archive-resurfaces');
      for(let episode=1;episode<=3;episode++){
        await playerPortrait();await feed(platform);
        const before=await snapshot(),scene=await page.evaluate(platform=>window.scene(platform),platform);
        assert.equal(scene.episode,episode);
        for(const width of [320,390,1440]){
          await page.setViewport({width,height:1000});await overflow('Expansion '+platform+' episode '+episode+' '+width);
          await page.$eval('[data-social-scene] [data-social-feed]',node=>node.scrollIntoView({block:'start'}));
          await page.screenshot({path:resolve(output,'expansion-'+platform+'-episode-'+episode+'-'+width+'.png')});
        }
        const selected=scene.choices.find(choice=>choice.intent===(episode===2?'care':'craft'));
        await act('[data-social-choice="'+selected.id+'"]');
        const after=await snapshot();
        assert.equal(after.revision,before.revision+1);assert.equal(after.platforms[platform].chapter,9+episode);
        assert.equal(after.platforms[platform].memory[scene.id],selected.id);
        await feed(platform);await recordedPost(after.history[0]);await overflow('Expansion result '+platform+' '+episode);
        if(episode===3){assert.equal(Date.parse(after.platforms[platform].nextPostAt)-Date.parse(after.serverNow),300000);assert.equal(await page.$eval('[data-social-choice]',node=>node.disabled),true)}
        checks.push(platform+': '+scene.id+' at 320/390/1440, personalized drafts and portrait, committed choice and exact remembered follow-up');
      }
    }
    assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);assert.deepEqual(failures,[]);
    await writeFile(resolve(output,'expansion-report.json'),JSON.stringify({success:true,checks,errors,forbidden,failures},null,2));
    console.log(JSON.stringify({success:true,checks:checks.length,mode:'expansion-only',output},null,2));
  } else if (communityOnly) {
    await ready();await page.evaluate(()=>window.showCommunity());
    await page.waitForSelector('[data-social-scene="ig-open-house"]');
    for (const identity of ['elodie','mehdi']) {
      await page.evaluate(identity=>window.setIdentity(identity),identity);await playerPortrait();
      await page.waitForFunction(()=>document.querySelector('[data-social-player-scene="community"] canvas')?.dataset.avatarState==='ready');
      const canvas=await canvasFingerprint('[data-social-player-scene="community"] canvas');
      assert.ok(canvas.visible>10000);assert.equal(canvas.height,1280);
      identityEvidence.push({name:identity,scene:canvas});
      for (const width of [320,390,1440]) {
        await page.setViewport({width,height:1000});await feed('instagram');await overflow('Community '+identity+' '+width);
        const illustration=await page.$('[data-social-scene] [data-social-illustration="community"]');
        await illustration.screenshot({path:resolve(output,'community-'+identity+'-'+width+'.png')});
        checks.push('Community '+identity+' at '+width+' px: real avatar ready, local illustration loaded, no overflow');
      }
    }
    assert.notEqual(identityEvidence[0].scene.hash,identityEvidence[1].scene.hash);
    assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);assert.deepEqual(failures,[]);
    await writeFile(resolve(output,'community-report.json'),JSON.stringify({success:true,checks,identityEvidence,errors,forbidden,failures},null,2));
    console.log(JSON.stringify({success:true,checks:checks.length,mode:'community-only',output},null,2));
  } else {
  await ready(); await page.evaluate(() => document.fonts.ready);
  const elodiePortrait = await playerPortrait();
  await page.waitForFunction(()=>document.querySelector('[data-social-player-scene] canvas')?.dataset.avatarState==='ready');
  assert.equal(await page.$eval('[data-social-player-scene] canvas',node=>node.height),1280,'The workshop shows the real full player avatar over the scene');
  const elodieScene = await canvasFingerprint('[data-social-player-scene] canvas');
  assert.ok(elodieScene.visible>10000,'The full player avatar is visibly rendered over the workshop');
  identityEvidence.push({name:'Élodie',portrait:elodiePortrait,scene:elodieScene});
  for (const width of [320,390,1440]) {
    await page.setViewport({width,height:1000}); await feed('instagram'); await overflow('Instagram '+width);
    assert.doesNotMatch(await page.$eval('[data-social-scene]',node=>node.innerText), /Audience estimée/,'Follower outcomes start collapsed');
    await page.screenshot({path:resolve(output,'instagram-'+width+'.png'),fullPage:true});
    await page.$eval('[data-social-feed="instagram"]',node=>node.scrollIntoView({block:'start'}));
    await page.screenshot({path:resolve(output,'instagram-feed-'+width+'.png')});
    await page.click('[data-platform="x"]'); await feed('x'); await overflow('X '+width); await page.screenshot({path:resolve(output,'x-'+width+'.png'),fullPage:true});
    await page.$eval('[data-social-feed="x"]',node=>node.scrollIntoView({block:'start'}));
    await page.screenshot({path:resolve(output,'x-feed-'+width+'.png')});
    await page.click('[data-social-view="sponsors"]'); await overflow('Sponsor inbox '+width); await page.screenshot({path:resolve(output,'sponsors-locked-'+width+'.png'),fullPage:true});
    assert.equal(await page.$$eval('[data-social-sponsor-accept]',nodes=>nodes.every(node=>node.disabled)),true);
    await page.click('[data-social-view="story"]'); await page.click('[data-platform="instagram"]');
  }
  checks.push('320/390/1440: story-first Instagram and X, collapsed numerical forecasts, sponsor inbox and locked audience prerequisites without overflow');
  checks.push('Instagram and X composers use local images, visible context and player drafts; reactions appear only after a confirmed publication');
  assert.equal(await page.$$eval('[data-social-published]', nodes => nodes.length), 0, 'Unsubmitted drafts never appear as recorded posts');
  await page.focus('[role="tablist"][aria-label="Ma boutique"] [role="tab"][aria-selected="true"]'); await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Développer ma boutique');
  await page.waitForSelector('[data-shop-view="activity"]');
  assert.equal(await page.$$eval('[data-shop-view="social"]',nodes=>nodes.length),0,'Networks is not duplicated in the management tabs');
  await page.keyboard.press('ArrowDown'); await ready();
  assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Réseaux');
  const first = await snapshot(), forecast = await page.evaluate(()=>window.preview('instagram','workshop'));
  const cashBefore = (await page.evaluate(()=>window.commerce())).cashCents;
  const readsBeforeKeyboardPost=await socialReads();
  await page.focus('[data-social-choice="workshop"]'); await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.fixture().revision===1); await page.waitForSelector('[data-social-result]');
  const published = await snapshot();
  assert.equal(published.version,2); assert.equal(published.platforms.instagram.chapter,1);
  assert.ok(published.history[0].followersDelta>=forecast.followersMin && published.history[0].followersDelta<=forecast.followersMax);
  assert.equal(published.energy,first.energy+forecast.energy); assert.equal(published.platforms.instagram.trust,first.platforms.instagram.trust+forecast.trust);
  assert.equal((await page.evaluate(()=>window.commerce())).cashCents,cashBefore);
  assert.equal((await posts())[0].body.modelVersion,2);
  assert.equal(published.history[0].id,(await posts())[0].body.requestKey);
  assert.equal(published.history[0].narrativeVersion,2,'Only the confirmed current story receipt gets the narrative version');
  await recordedPost(published.history[0]);
  assert.equal(await socialReads(),readsBeforeKeyboardPost,'Keyboard publication uses the confirmed POST snapshot without a duplicate read');
  assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-social-result')),true);
  assert.equal(await page.$eval('[data-social-choice]',node=>node.disabled),false,'Episode two is playable immediately');
  const selectedFollowup = await page.evaluate(()=>{const scene=window.scene('instagram');return {body:scene.body,matched:scene.followups.find(branch=>branch.fromScenarioId==='ig-first-frame'&&branch.fromChoiceId==='workshop')?.body}});
  assert.equal(selectedFollowup.body,selectedFollowup.matched,'Next scene resolves the actual remembered decision');
  assert.ok((await contextText()).includes(selectedFollowup.body),'The authored followup is immediately visible to the player');
  const workshopContext = await contextText();
  assert.ok((await page.evaluate(()=>window.notifications)).includes('kq:commerce-updated'));
  checks.push('keyboard post executes once, costs exact mental energy, records actual ranged followers and trust, focuses outcome and changes next scene');
  await continueStory(); await act('[data-social-choice="process"]'); await continueStory(); await act('[data-social-choice="duet"]');
  assert.equal((await snapshot()).platforms.instagram.chapter,3);
  assert.equal(await page.$eval('[data-social-choice]',node=>node.disabled),true);
  const frozen = await page.$eval('[data-social-cooldown]',node=>node.innerText);
  await page.evaluate(()=>{window.realNow=performance.now.bind(performance);performance.now=()=>window.realNow()+3600000});
  await new Promise(done=>setTimeout(done,1100));
  assert.equal(await page.$eval('[data-social-cooldown]',node=>node.innerText),frozen);
  await page.evaluate(()=>{performance.now=window.realNow});
  await page.evaluate(()=>window.advance(24)); await page.waitForFunction(()=>!document.querySelector('[data-social-choice]').disabled);
  checks.push('three-episode arc chains immediately then cools down; tutorial time remains frozen until explicit clock advance');
  await continueStory(); await page.click('[data-platform="x"]');
  const xChoice = await page.evaluate(()=>window.scene('x').choices.find(c=>c.intent==='craft').id);
  const beforeX = await snapshot(), xPreview = await page.evaluate(id=>window.preview('x',id),xChoice);
  await page.focus('[data-social-choice="'+xChoice+'"]'); await page.keyboard.press('Enter');
  await page.waitForFunction(revision=>window.fixture().revision>revision,{},beforeX.revision); await page.waitForSelector('[data-social-result]');
  const afterX = await snapshot(); await recordedPost(afterX.history[0]);
  assert.equal(afterX.energy,beforeX.energy+xPreview.energy); assert.equal(afterX.platforms.x.chapter,1);
  await act('[data-social-recover]'); assert.equal((await snapshot()).energy,100);
  assert.ok((await snapshot()).recoverReadyAt);
  checks.push('X has its own narrative, actual mental costs and hater pressure; pause restores capped energy with a real cooldown');
  await reset('tired'); assert.equal(await page.$$eval('[data-social-choice]',nodes=>nodes.every(node=>node.disabled)),true);
  await act('[data-social-recover]'); assert.equal((await snapshot()).energy,32);
  await reset('pressure'); await page.setViewport({width:320,height:1000}); await overflow('high pressure');
  assert.match(await page.$eval('[data-social-networks]',node=>node.innerText),/visibilité réduite/);
  await page.screenshot({path:resolve(output,'pressure-320.png'),fullPage:true});
  checks.push('exhaustion blocks unaffordable actions and recovery restores play; moderation and pressure remain visible');
  await reset('sponsors'); await page.click('[data-social-view="sponsors"]');
  const catalog = await page.evaluate(()=>window.catalog()), offer = catalog[0];
  assert.equal(await page.$eval('[data-social-sponsor-accept="'+offer.id+'"]',node=>node.disabled),false);
  await page.focus('[data-social-sponsor-accept="'+offer.id+'"]'); await page.keyboard.press('Enter');
  await page.waitForSelector('[data-social-confirm][open]');
  assert.match(await page.$eval('[data-social-confirm]',node=>node.innerText),/publications ordinaires/);
  assert.match(await page.$eval('[data-social-confirm]',node=>node.innerText),/Aucun délai hors connexion/);
  await page.keyboard.press('Escape'); await closed(); assert.equal((await snapshot()).sponsors.active,null);
  await page.click('[data-social-sponsor-accept="'+offer.id+'"]'); await page.waitForSelector('[data-social-confirm][open]');
  await act('[data-social-confirm-action]'); await closed();
  assert.equal((await snapshot()).sponsors.active.publicationsLeft,4);
  const sponsoredCash = (await page.evaluate(()=>window.commerce())).cashCents;
  assert.equal((await snapshot()).sponsors.earnedCents,0);
  for(const width of [320,390,1440]){await page.setViewport({width,height:1000});await overflow('Active contract '+width);await page.screenshot({path:resolve(output,'active-sponsor-'+width+'.png'),fullPage:true})}
  checks.push('eligible audience unlocks sponsor offer; keyboard review and Escape are safe; acceptance records exact deliverables and four-publication budget');
  await continueStory(); await page.click('[data-social-view="story"]');
  assert.match(await page.$eval('[data-social-scene]',node=>node.innerText),/4 publications restantes/);
  const lowCost = await page.evaluate(()=>window.scene('instagram').choices.find(choice=>choice.intent==='care').id);
  await act('[data-social-choice="'+lowCost+'"]'); assert.equal((await snapshot()).sponsors.active.publicationsLeft,3);
  await page.click('[data-social-view="sponsors"]'); await act('[data-social-sponsored-post="'+offer.requiredTags[0]+'"]');
  assert.equal((await snapshot()).sponsors.active.publicationsLeft,2);assert.deepEqual((await snapshot()).sponsors.active.progressTags,[offer.requiredTags[0]]);
  assert.equal(await page.$eval('[data-social-sponsored-post="'+offer.requiredTags[1]+'"]',node=>node.disabled),true);
  assert.equal((await page.evaluate(()=>window.commerce())).cashCents,sponsoredCash);
  await page.evaluate(()=>window.advance(24));await page.waitForFunction(()=>!document.querySelector('[data-social-sponsored-post]').disabled);
  await act('[data-social-sponsored-post="'+offer.requiredTags[1]+'"]');
  assert.equal((await snapshot()).sponsors.active.progressTags.length,2);
  assert.equal((await snapshot()).sponsors.earnedCents,0,'Delivered does not mean paid');
  assert.equal((await page.evaluate(()=>window.commerce())).cashCents,sponsoredCash);
  const beforeClaim = await snapshot();
  const readsBeforeClaim=await socialReads();
  await page.evaluate(()=>window.setFailure('lost-result')); await page.click('[data-social-sponsor-claim]');
  await page.waitForSelector('[data-social-retry]');
  await page.waitForFunction(reads=>window.requests.filter(request=>request.method==='GET'&&request.path==='/api/arena/placard/social').length===reads+1,{},readsBeforeClaim);
  assert.equal(await socialReads(),readsBeforeClaim+1,'A lost reward response still triggers exactly one verification read');
  assert.equal((await snapshot()).sponsors.earnedCents,offer.rewardCents);
  await page.click('[data-social-retry]');await page.waitForFunction(()=>!document.querySelector('[data-social-retry]'));
  assert.equal((await snapshot()).revision,beforeClaim.revision+1);
  assert.equal((await page.evaluate(()=>window.commerce())).cashCents,sponsoredCash+offer.rewardCents);
  const claims=(await posts()).filter(request=>request.body.action==='sponsor-claim');assert.equal(claims.length,2);assert.equal(claims[0].body.requestKey,claims[1].body.requestKey);
  assert.equal(await socialReads(),readsBeforeClaim+1,'The acknowledged retry adds no read and retains its original request UUID');
  assert.ok((await snapshot()).sponsors.completedIds.includes(offer.id));
  await page.setViewport({width:390,height:1000});await page.screenshot({path:resolve(output,'sponsor-paid-390.png'),fullPage:true});
  checks.push('ordinary posts consume sponsor budget; two distinct disclosed posts fulfill it, then claim pays exactly once even after lost response');
  await reset('sponsors');await page.click('[data-social-view="sponsors"]');await page.click('[data-social-sponsor-accept="'+offer.id+'"]');await act('[data-social-confirm-action]');await closed();
  await page.click('[data-social-sponsor-cancel]');await page.waitForSelector('[data-social-confirm][open]');
  assert.match(await page.$eval('[data-social-confirm]',node=>node.innerText),/ne seront pas versés/);
  await act('[data-social-confirm-action]');await closed();assert.equal((await snapshot()).sponsors.active,null);assert.equal((await snapshot()).sponsors.earnedCents,0);
  checks.push('cancellation explicitly forfeits unpaid reward, closes partnership and creates no debt');
  await reset('sponsors');await page.click('[data-social-view="sponsors"]');await page.click('[data-social-sponsor-decline="'+offer.id+'"]');
  await page.waitForSelector('[data-social-confirm][open]');assert.match(await page.$eval('[data-social-confirm]',node=>node.innerText),/définitivement close/);
  await page.keyboard.press('Escape');await closed();assert.equal((await snapshot()).sponsors.declinedIds.length,0);
  await page.click('[data-social-sponsor-decline="'+offer.id+'"]');await act('[data-social-confirm-action]');await closed();assert.ok((await snapshot()).sponsors.declinedIds.includes(offer.id));
  assert.equal((await snapshot()).sponsors.earnedCents,0);
  checks.push('declining an offer requires explicit review of its permanent closure; Escape leaves it available');
  await reset('sponsors');await page.click('[data-social-view="sponsors"]');await page.click('[data-social-sponsor-accept="'+offer.id+'"]');await act('[data-social-confirm-action]');await closed();
  await page.click('[data-social-view="story"]');
  for(let i=0;i<4;i++){if(i===3){await page.evaluate(()=>window.advance(24));await page.waitForFunction(()=>!document.querySelector('[data-social-choice]').disabled)}const choice=await page.evaluate(()=>window.scene('instagram').choices.find(c=>c.intent==='care').id);await act('[data-social-choice="'+choice+'"]')}
  assert.equal((await snapshot()).sponsors.active,null);assert.equal((await snapshot()).sponsors.earnedCents,0);assert.ok((await snapshot()).sponsors.declinedIds.includes(offer.id));
  assert.match(await page.$eval('[data-social-result]',node=>node.innerText),/partenariat|publications/i);
  checks.push('missing the four-publication obligation ends an unpaid contract with a visible explanation');
  for(const failure of ['unavailable','old-server']){await reset(failure);await page.waitForSelector('[data-social-networks] [role="alert"]');assert.equal(await page.$$eval('[data-social-choice]',nodes=>nodes.length),0);await page.evaluate(()=>window.setFailure('ready'));await clickText('Réessayer');await ready()}
  checks.push('missing and old-version snapshots never invent zeros; reload recovers the new adventure');
  await reset('lost-result');const readsBeforeLostPost=await socialReads();await page.click('[data-social-choice="workshop"]');await page.waitForSelector('[data-social-retry]');
  await page.waitForFunction(reads=>window.requests.filter(request=>request.method==='GET'&&request.path==='/api/arena/placard/social').length===reads+1,{},readsBeforeLostPost);
  const uncertain=await snapshot();await page.click('[data-social-retry]');await page.waitForFunction(()=>!document.querySelector('[data-social-retry]'));
  assert.equal((await snapshot()).revision,uncertain.revision);const replay=await posts();assert.equal(replay.length,2);assert.equal(replay[0].body.requestKey,replay[1].body.requestKey);
  assert.equal(await socialReads(),readsBeforeLostPost+1,'A lost post gets one verification read and its successful retry gets none');
  await reset('refusal');await page.click('[data-social-choice="workshop"]');await page.waitForSelector('[data-social-networks] [role="alert"]');assert.equal((await snapshot()).history.length,0);assert.equal((await snapshot()).energy,100);
  checks.push('ordinary post retries retain UUID and explicit stale-state rejection never spends energy');
  assert.equal(await page.$$eval('[data-social-published]',nodes=>nodes.length),0,'A rejected publication never appears as a committed post');
  await reset('ready');await act('[data-social-choice="reveal"]');
  assert.equal((await snapshot()).platforms.instagram.memory['ig-first-frame'],'reveal');
  assert.equal(await page.$eval('[data-social-scene]',node=>node.dataset.socialScene),'ig-comment');
  await feed('instagram');
  const revealContext = await contextText();
  assert.notEqual(revealContext,workshopContext,'Different remembered choices change the visible context of the next scene');
  await recordedPost((await snapshot()).history[0]);
  for(const width of [320,390,1440]){
    await page.setViewport({width,height:1000});await overflow('Published Instagram '+width);
    await page.screenshot({path:resolve(output,'published-instagram-'+width+'.png'),fullPage:true});
    await page.$eval('[data-social-published]',node=>node.scrollIntoView({block:'start'}));
    await page.screenshot({path:resolve(output,'publication-instagram-'+width+'.png')});
  }
  checks.push('published cards map committed request IDs; no draft or rejected post is fabricated; remembered choices change the visible next context');
  await reset('ready');await page.click('[data-platform="x"]');await act('[data-social-choice="hook"]');
  assert.equal((await snapshot()).platforms.x.memory['x-first-thread'],'hook');
  assert.equal(await page.$eval('[data-social-scene]',node=>node.dataset.socialScene),'x-proof');
  await feed('x');await recordedPost((await snapshot()).history[0]);
  assert.ok(await page.$$eval('[data-social-published] [data-comment-kind="quote"]',nodes=>nodes.length)>0,'The confirmed X hook receives its authored quotation');
  for(const width of [320,390,1440]){
    await page.setViewport({width,height:1000});await overflow('Published X and quote '+width);
    await page.screenshot({path:resolve(output,'published-x-'+width+'.png'),fullPage:true});
    await page.$eval('[data-social-scene] [data-social-feed="x"]',node=>node.scrollIntoView({block:'start'}));
    await page.screenshot({path:resolve(output,'quoted-x-'+width+'.png')});
  }
  checks.push('the confirmed X hook gets its authored quoted reaction while the next player composer remains free of invented replies');
  await page.click('[data-platform="instagram"]');await act('[data-social-choice="postcard"]');
  assert.match(await page.$eval('[data-social-published]',node=>node.innerText),/Moi, c[’']est Élodie/,'A committed personal introduction uses the actual first name in its message');
  await page.click('[data-platform="x"]');
  assert.equal(await page.$$eval('[data-social-scene] [data-social-comment]',nodes=>nodes.length),0,'Changing networks does not display unearned reactions');
  const beforeIdentity = await snapshot(), cashBeforeIdentity = (await page.evaluate(()=>window.commerce())).cashCents;
  const postCountBeforeIdentity = (await posts()).length;
  await page.evaluate(()=>{window.identityScreen=document.querySelector('[data-social-networks]');window.setIdentity('mehdi')});
  const mehdiPortrait = await playerPortrait();
  assert.notEqual(mehdiPortrait.hash,elodiePortrait.hash,'Different gender, skin, hair and clothing produce different real avatar pixels');
  assert.equal(await page.evaluate(()=>window.identityScreen===document.querySelector('[data-social-networks]')),true,'Profile refresh updates the same mounted game screen');
  assert.ok(await page.$$eval('[data-social-scene] [data-social-draft]',nodes=>nodes.every(node=>node.innerText.includes('Mehdi'))),'Draft identities update to the new first name without remounting');
  assert.doesNotMatch(await page.$eval('[data-social-scene] [data-social-feed]',node=>node.innerText),/Élodie/,'Previous first name is not retained in the composer');
  await feed('x');await recordedPost(beforeIdentity.history[0]);
  assert.match(await page.$eval('[data-social-published]',node=>node.innerText),/Moi, c[’']est Mehdi/,'The recorded personal message resolves the current first name after profile refresh');
  await page.setViewport({width:320,height:1000});await overflow('Mehdi personalized X');
  await page.$eval('[data-social-scene] [data-social-feed="x"]',node=>node.scrollIntoView({block:'start'}));
  await page.screenshot({path:resolve(output,'personalized-mehdi-x-320.png')});
  await page.click('[data-platform="instagram"]');await feed('instagram');
  await page.waitForFunction(()=>document.querySelector('[data-social-published] [data-social-player-scene] canvas')?.dataset.avatarState==='ready');
  const mehdiScene = await canvasFingerprint('[data-social-published] [data-social-player-scene] canvas');
  assert.notEqual(mehdiScene.hash,elodieScene.hash,'The full avatar in the scene changes together with the portrait');
  identityEvidence.push({name:'Mehdi',portrait:mehdiPortrait,scene:mehdiScene});
  await page.setViewport({width:390,height:1000});await overflow('Mehdi personalized Instagram');
  await page.$eval('[data-social-published]',node=>node.scrollIntoView({block:'start'}));
  await page.screenshot({path:resolve(output,'personalized-mehdi-instagram-390.png')});
  assert.deepEqual(await snapshot(),beforeIdentity,'Loading or changing identity never changes social state');
  assert.equal((await page.evaluate(()=>window.commerce())).cashCents,cashBeforeIdentity,'Identity refresh never changes treasury');
  assert.equal((await posts()).length,postCountBeforeIdentity,'Identity refresh sends no game command');
  assert.ok((await page.evaluate(()=>window.requests)).some(request=>request.path==='/api/arena/placard/social/player'&&request.method==='GET'),'Player identity comes from the profile endpoint');
  checks.push('Élodie and Mehdi use their actual first name, nickname handle and different ready ChanvrierAvatar portrait/full canvases; live profile refresh preserves the screen, story and wallet');
  await page.evaluate(()=>window.setIdentity('long'));await playerPortrait();
  await page.setViewport({width:320,height:1000});await feed('instagram');await overflow('Long first name Instagram');
  await page.screenshot({path:resolve(output,'personalized-long-name-320.png'),fullPage:true});
  await page.click('[data-platform="x"]');await feed('x');await overflow('Long first name X');await recordedPost(beforeIdentity.history[0]);
  checks.push('a long first name and nickname remain readable in drafts, comments and recorded posts at 320 px without overflow');
  await page.evaluate(()=>window.setIdentity('missing'));
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-social-scene] [data-social-draft]')].every(node=>node.innerText.includes(window.player().name))&&document.querySelectorAll('[data-social-player-avatar] canvas').length===0);
  await page.click('[data-platform="instagram"]');await feed('instagram');await overflow('Missing player profile');
  assert.equal(await page.$$eval('[data-social-player-scene]',nodes=>nodes.length),0,'Missing profile does not fabricate an avatar in the scene');
  assert.equal(await page.$$eval('[data-social-player-avatar] img',nodes=>nodes.length),0,'Missing profile does not fall back to a fixed Sylvain portrait');
  assert.doesNotMatch(await page.$$eval('[data-social-feed]',nodes=>nodes.map(node=>node.innerText).join('\n')),/Sylvain|Élodie|Mehdi|Anne-Charlotte/,'Missing identity stays neutral');
  assert.deepEqual(await snapshot(),beforeIdentity);
  await page.screenshot({path:resolve(output,'personalized-missing-profile-320.png'),fullPage:true});
  checks.push('missing profile shows neutral identity and decoration without inventing a player or reusing a fixed portrait');
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);assert.deepEqual(failures,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({success:true,version:2,checks,identityEvidence,errors,forbidden,failures},null,2));
  console.log(JSON.stringify({success:true,checks:checks.length,output},null,2));
  }
} catch (error) {
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, producerOnly ? 'producer-report.json' : composerOnly ? 'composer-report.json' : illustrationsOnly ? illustrationsReport : expansionOnly ? 'expansion-report.json' : communityOnly ? 'community-report.json' : 'report.json'), JSON.stringify({ success: false, checks, artworkEvidence, identityEvidence, errors, forbidden,failures,failure:String(error) }, null, 2));
  throw error;
} finally { if (browser) await browser.close(); await server.close(); }


