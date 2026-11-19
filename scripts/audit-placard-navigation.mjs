/** Local UI audit. Real lobby, shell, collection and progression; destination stubs isolate navigation. */
import assert from 'node:assert/strict';
import {mkdir, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import {createSchoolFixture,auditSchool} from './audit-school-scenarios.mjs';
import {createTournamentFixture,tournamentFixtureOwner} from './school-tournament-fixture.mjs';
import {auditSchoolHistory} from './audit-school-history-scenarios.mjs';
import {auditSchoolBotany} from './audit-school-botany-scenarios.mjs';
import {auditSchoolTerpenes} from './audit-school-terpenes-scenarios.mjs';
import {auditSchoolChallenge} from './audit-school-challenge-scenarios.mjs';
import {auditSchoolQuizFlow} from './audit-school-quiz-scenarios.mjs';
import {auditSchoolHarvest} from './audit-school-harvest-scenarios.mjs';
import {auditSchoolProducts} from './audit-school-products-scenarios.mjs';
import {auditSchoolSoil} from './audit-school-soil-scenarios.mjs';
import {auditSchoolHealth} from './audit-school-health-scenarios.mjs';
import {auditSchoolCultivation} from './audit-school-cultivation-scenarios.mjs';
import {auditSchoolCannabinoids} from './audit-school-cannabinoids-scenarios.mjs';
import {auditWorld3d,world3dFixturePayload} from './audit-world-3d-navigation-scenarios.mjs';
import {auditQuarterTeam,createQuarterTeamFixture} from './audit-quarter-team-scenarios.mjs';

const root=process.cwd(), output=resolve(root,'output/placard-navigation'), port=Number(process.env.NAVIGATION_AUDIT_PORT??3248), origin=`http://127.0.0.1:${port}`, preview=process.argv.includes('--preview');
const clarityOnly=process.argv.includes('--clarity-only');
const quarterTeam=process.argv.includes('--quarter-team');
const coastCorner=process.argv.includes('--coast-corner');
const coast=coastCorner||process.argv.includes('--coast');
const coastBaseline=coast&&process.argv.includes('--baseline');
const coastReport=`coast${coastCorner?'-corner':''}-${coastBaseline?'before':'after'}.json`;
const buildingRooms=process.argv.includes('--building-rooms');
const world3d=coast||quarterTeam||buildingRooms||process.argv.includes('--world-3d');
const motionOnly=process.argv.includes('--motion-only');
const focusOnly=process.argv.includes('--focus-only');
const cardsOnly=process.argv.includes('--cards-only');
const schoolVisual=process.argv.includes('--school-visual');
const schoolHistory=process.argv.includes('--school-history');
const schoolBotany=process.argv.includes('--school-botany');
const schoolTerpenes=process.argv.includes('--school-terpenes');
const schoolCannabinoids=process.argv.includes('--school-cannabinoids');
const schoolCultivation=process.argv.includes('--school-cultivation');
const schoolHealth=process.argv.includes('--school-health');
const schoolChallenge=process.argv.includes('--school-challenge');
const schoolQuizFlow=process.argv.includes('--school-quiz-flow');
const schoolHarvest=process.argv.includes('--school-harvest');
const schoolProducts=process.argv.includes('--school-products');
const schoolSoil=process.argv.includes('--school-soil');
const schoolReal=process.argv.includes('--school-real')||schoolVisual||schoolHistory||schoolBotany||schoolTerpenes||schoolCannabinoids||schoolCultivation||schoolHealth||schoolSoil||schoolProducts||schoolHarvest||schoolQuizFlow||schoolChallenge;
const schoolFixture=schoolReal?await createSchoolFixture():null;
const schoolPlayerFixtures=new Map([[1,Promise.resolve(schoolFixture)]]);
let tournamentFixturePromise;
const reportName=buildingRooms?'building-rooms-report.json':world3d?'world-3d-report.json':schoolChallenge?'school-challenge-report.json':schoolQuizFlow?'school-quiz-flow-report.json':schoolHarvest?'school-harvest-report.json':schoolProducts?'school-products-report.json':schoolSoil?'school-soil-report.json':schoolHealth?'school-health-report.json':schoolCultivation?'school-cultivation-report.json':schoolCannabinoids?'school-cannabinoids-report.json':schoolTerpenes?'school-terpenes-report.json':schoolBotany?'school-botany-report.json':schoolHistory?'school-history-report.json':schoolVisual?(process.env.SCHOOL_VISUAL_LAYOUT_ONLY?(process.env.SCHOOL_AUDIT_WIDTHS?'school-visual-layout-320-report.json':'school-visual-layout-report.json'):'school-visual-report.json'):schoolReal?(process.env.SCHOOL_AUDIT_WIDTHS?'school-regression-report.json':'school-real-report.json'):cardsOnly?'cards-school-report.json':focusOnly?'focus-report.json':motionOnly?'motion-report.json':clarityOnly?'clarity-report.json':'report.json';
const MAP_ASSET='/placard/map/placard-world-quizzshow-v9.webp';
const BUILDING_IDS=['warehouse','bank','office','market','shop','arena','missions','collection'];
// Independently inspected landmarks in the 1536 x 1024 v6 painting. These do
// not come from the app's polygons, so a wrongly traced mask cannot self-pass.
const MAP_LANDMARKS={warehouse:[365,255],bank:[800,221],office:[1180,320],market:[275,551],shop:[809,796],arena:[1235,619],missions:[753,453],collection:[284,831]};
const MAP_GROUND_POINTS=[[950,320],[530,410]];
function fixturePayload(path,scenario){
 if(world3d){const worldPayload=world3dFixturePayload(path);if(worldPayload)return worldPayload;}
 if(path==='/api/arena/placard/staff')return baseStaffSnapshot;
 if(path==='/api/arena/placard/equipment')return {tentNumber:1,tents:[{tentNumber:1,equippedCodes:[],levels:{}}],productionUnits:scenario==='active'?4:1,ownedCodes:[],purchasedCodes:[],equippedCodes:[],cashCents:scenario==='investment'?500000:0,levels:{},reputation:0,activeRun:scenario==='active'||scenario==='motion'||scenario.startsWith('overflow')||scenario==='storage-error',readyLotCount:scenario==='lots'||scenario==='motion'?2:0,availableFlowerCount:scenario==='jury'||scenario==='motion'?1:0,routeMasteries:[],routePlan:null};
 if(path==='/api/arena/placard/storage')return scenario==='storage-error'?null:{serverNow:'2026-10-11T12:00:00.000Z',lots:scenario.startsWith('overflow')?[{flowerId:'first',flowerStatus:'available',projection:{stage:'curing',readyAt:'2026-10-11T16:00:00.000Z',nextChangeAt:'2026-10-11T12:30:00.000Z',capacity:{overflowUnits:1250,overflowDeadlineAt:'2026-10-11T12:30:00.000Z'}}},{flowerId:'second',flowerStatus:'available',projection:{stage:'curing',readyAt:'2026-10-11T16:00:00.000Z',nextChangeAt:'2026-10-11T14:00:00.000Z',capacity:{overflowUnits:2500,overflowDeadlineAt:'2026-10-11T14:00:00.000Z'}}}]:[]};
 if(path==='/api/arena/placard/collection')return {collection:{cards:[]}};
 if(path==='/api/account/collection')return scenario==='cards-unavailable'?null:{pages:scenario==='cards'?[{slots:[{code:'HH2026-001',cardNumber:1,name:'L’Arbre Mère',rarity:'legendary',ownedCount:0,burnableCount:0,description:'Figure fondatrice de l’univers fictif du jeu, sans ancêtre botanique réel revendiqué.'},{code:'HH2026-004',cardNumber:4,name:'Orange Bud',rarity:'epic',ownedCount:2,burnableCount:1,description:'Description existante de la fiche.'},...((schoolCultivation||schoolHealth||schoolSoil||schoolProducts||schoolHarvest)?[{code:'HH2026-045',cardNumber:45,name:'Carmagnola',rarity:'common',ownedCount:0,burnableCount:0,description:'Fiche publique existante ; aucun exemplaire possédé dans ce test.'}]:[]),...(schoolCannabinoids?[{code:'HH2026-002',cardNumber:2,name:'Charlotte’s Web',rarity:'epic',ownedCount:0,burnableCount:0,description:'Fiche publique pour vérifier un accès sans possession.'}]:[])]}]:[],summary:{totalCards:0,ownedUnique:0,totalOwnedCopies:0,duplicateCopies:0},availableClaims:[]};
 return null;
}
// The browser never receives the author key or a backend URL. Its requests stay
// on this loopback server, whose middleware handles every API path itself.
const previewFetch=preview?`const nativeFetch=window.fetch.bind(window);let failed=false;window.fetch=async(input,init={})=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==location.origin)throw new TypeError('Démo locale : connexion externe désactivée');const scenario=new URLSearchParams(location.search).get('scenario');if(scenario==='error'&&!failed&&url.pathname==='/api/arena/placard/equipment'){failed=true;return new Response(JSON.stringify({error:'Essai local'}),{status:503,headers:{'Content-Type':'application/json'}});}return nativeFetch(input,init);};`:'';
const schoolApi='/api/arena/placard/school';
async function previewApi(req,res,url){
 // This selector exists only on the isolated loopback demo, never on the application API.
 const requestedSlot=Number(new URL(req.headers.referer||origin,origin).searchParams.get('player')||1);
 const slot=Number.isInteger(requestedSlot)&&requestedSlot>=1&&requestedSlot<=8?requestedSlot:1;
 const owner=tournamentFixtureOwner(slot);
 const json=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));};
 try{
  if(schoolFixture&&[schoolApi+'/challenge',schoolApi+'/quiz',schoolApi+'/quiz/check'].includes(url.pathname)){
   const redirectTo='/arene/placard?view=school&section=tournament';
   res.setHeader('Location',redirectTo);
   return json(410,{error:'Le quiz solo a été retiré. Rejoins le tournoi.',code:'school_quiz_retired',redirectTo});
  }
  if(schoolFixture&&url.pathname===schoolApi+'/tournament'){
   if(!['GET','POST'].includes(req.method))return json(405,{error:'Méthode non simulée'});
   if(req.method==='POST'&&req.headers['x-kq-school-owner']!==owner)return json(409,{error:'Le compte a changé.',code:'school_owner_changed'});
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192)return json(413,{error:'Requête trop volumineuse'});}
   tournamentFixturePromise??=createTournamentFixture({seedReplays:false,now:process.env.SCHOOL_PREVIEW_NOW || null});
   const fixture=await tournamentFixturePromise;
   const outcome=await fixture.request(req.method,req.method==='GET'?null:JSON.parse(body),owner);
   return json(outcome.status,outcome.body);
  }
  if(schoolFixture&&[schoolApi,`${schoolApi}/quiz`,`${schoolApi}/quiz/check`,`${schoolApi}/challenge`,`${schoolApi}/progress`,`${schoolApi}/history`,`${schoolApi}/botany`,`${schoolApi}/terpenes`,`${schoolApi}/cannabinoids`,`${schoolApi}/cultivation`,`${schoolApi}/health`,`${schoolApi}/soil`,`${schoolApi}/products`,`${schoolApi}/harvest`].includes(url.pathname)){
   const allowed=url.pathname===schoolApi?['GET']:url.pathname.endsWith('/progress')?['POST']:['GET','POST'];
   if(!allowed.includes(req.method))return json(405,{error:'Méthode non simulée'});
   let body='';
   for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32768)return json(413,{error:'Requête trop volumineuse'});}
   const lessonId=req.method==='GET'?url.searchParams.get('quizId'):JSON.parse(body).quizId;
   if(url.pathname.endsWith('/quiz')&&!schoolFixture.content.KQ_SCHOOL_MODULES.some(module=>module.id===lessonId))return json(400,{error:'Quiz inconnu'});
   if(!schoolPlayerFixtures.has(slot))schoolPlayerFixtures.set(slot,createSchoolFixture(owner));
   const activeSchool=await schoolPlayerFixtures.get(slot);
   return await activeSchool.handle({method:()=>req.method,headers:()=>req.headers,postData:()=>body,respond:({status,body:payload})=>json(status,JSON.parse(payload)),abort:()=>res.destroy()},url);
  }
  if(req.method!=='GET')return json(405,{error:'Démo locale : cette action n’est pas simulée'});
  const scenario=new URL(req.headers.referer||origin,origin).searchParams.get('scenario')||(schoolReal?'cards':'starter');
  const body=fixturePayload(url.pathname,scenario);
  return json(body?200:404,body||{error:'API non simulée'});
 }catch{
  if(!res.headersSent)json(400,{error:'Requête de démonstration invalide'});else res.end();
 }
}
// Preserve Vite's default deny list and also keep test scripts and server-only
// school sources inaccessible through ordinary, ?raw, or /@fs module URLs.
const privatePreviewFiles=['.env','.env.*','*.{crt,pem,key,p12,pfx,cer,der}','.npmrc','.yarnrc.yml','**/.git/**','**/.vercel/**','**/scripts/**','**/kanab-quest-school-answers.*','**/kanab-quest-school-*-answers.*','**/kanab-quest-school-server.*','**/kanab-quest-school-challenge-server.*','**/kanab-quest-school-tournament-server.*','**/kanab-quest-hemp-quiz-bank.*','**/kanab-quest-hemp-quiz-biology.*','**/kanab-quest-hemp-quiz-uses.*','**/kanab-quest-hemp-quiz-history-culture.*','**/kanab-quest-hemp-quiz-history-science.*','**/kanab-quest-hemp-quiz-expansion-nature.*'];
privatePreviewFiles.push('**/kanab-quest-hemp-quiz-additions.json', '**/kanab-quest-hemp-quiz-reviewed.json', '**/docs/quiz-2000/**', '**/docs/quiz-rebalance-*/**');
const stub=(name,body)=>`import React from 'react';export function ${name}(props){return <section data-destination="${name}" style={{padding:24}}><p data-simulated-destination>Destination simulée · vérification de navigation uniquement.</p>${body}</section>}`;
const destinations={
 './KqSchool':stub('KqSchool','<h2>QuizzShow</h2><p data-school-section>{props.initialSection}</p><p data-school-module>{props.initialModuleId}</p><button data-school-read-buddy onClick={()=>props.onOpenBuddy("HH2026-001",props.initialModuleId||"plant")}>Lire sa fiche</button><button data-school-quiz onClick={()=>props.onSectionChange("quiz","plant")}>Quiz</button><button data-school-exit onClick={props.onExit}>Quartier</button>'),
 './KqHarvests':stub('KqHarvests','<h1>Mes récoltes</h1><p data-harvest-section>{props.section}</p><p data-harvest-flower>{props.initialFlowerId}</p><button onClick={()=>props.onSectionChange("storage","fixture-flower")}>Stockage et affinage</button><button onClick={()=>props.onOpenWarehouse("fixture-flower")}>Augmenter la capacité</button><button onClick={()=>props.onOpenArena("fixture-flower")}>Présenter au jury</button><button onClick={()=>props.onOpenMarket("fixture-flower")}>Vendre cette récolte</button>'),
 './KanabQuestDicePrototype':stub('KanabQuestDicePrototype','<h1>{props.viewMode === "arena" ? "Jury & duels" : "La culture"}</h1>'),
 './KqWarehouseEntry':stub('KqWarehouseEntry','<h1>Entrepôt</h1><p data-equipment>{props.initialEquipmentCode}</p><p data-warehouse-section>{props.initialSection}</p><p data-warehouse-flower>{props.initialFlowerId}</p><p data-storage-configuration>{String(Boolean(props.initialStorageEquipmentOpen))}</p><p data-catalog>{props.initialShopOpen ? "Matériel" : "Plan"}</p><button onClick={()=>props.onOpenShop("LED-500")}>Acheter une lampe</button><button onClick={()=>props.onOpenMarket("fixture-flower")}>Préparer la vente</button>'),
 './KqMarketDesk':stub('KqMarketDesk','<h1>Ma boutique</h1><p data-market-section>{props.section}</p><p data-market-flower>{props.initialFlowerId}</p><p data-market-listing>{props.initialListingId}</p><button onClick={()=>props.onSectionChange("overview")}>Vue d’ensemble</button><button onClick={()=>props.onSectionChange("demands")}>Demandes clients</button><button onClick={()=>props.onSectionChange("sales")}>Vendre ma production</button><button onClick={()=>props.onSectionChange("dashboard")}>Mes ventes</button><button onClick={()=>props.onSectionChange("dashboard","fixture-listing")}>Voir l’annonce ciblée</button><button onClick={()=>props.onSectionChange("management")}>Développer ma boutique</button><button onClick={()=>props.onOpenShop("COMPUTER",props.initialFlowerId)}>Acheter un ordinateur</button>'),
 './KqTreasuryDesk':stub('KqTreasuryDesk','<h1>{props.initialPole === "bank" ? "La Banque" : "Le Bureau"}</h1><p data-treasury-pole>{props.initialPole}</p>'),
 './KqStaffDesk':stub('KqStaffDesk','<h1>Personnel</h1><button onClick={()=>props.onOpenTrim("fixture-employee")}>Trim dans l’Atelier</button>'),
 './KqSocialNetworks':stub('KqSocialNetworks','<h1>Réseaux sociaux</h1>'),
 './KqSupportBoosterShop':stub('KqSupportBoosterShop','<h1>Boutique</h1><p data-catalog>Packs</p><p data-shop-section>{props.initialSection}</p><button onClick={()=>props.onSectionChange("buddies")}>Packs Buddies</button><button onClick={props.onExit}>Quitter la boutique</button><button data-open-shop-collection onClick={()=>props.onOpenCollection(props.initialSection)}>Collections</button>'),
 './KqMissionCenter':stub('KqMissionCenter','<h1>Missions</h1><button onClick={()=>props.onOpen("shop")}>Mes packs</button>'),
};
if(schoolReal)delete destinations['./KqSchool'];
if(world3d)destinations['./KqStaffDesk']=stub('KqStaffDesk','<h1>Personnel</h1><button onClick={()=>props.onOpenTrim("fixture-employee")}>Trim dans l’Atelier</button><ol>{Array.from({length:18},(_,i)=><li key={i} style={{padding:12}}>Affectation locale {i+1} · horaires et coût du travail simulés.</li>)}</ol><button data-world-panel-end onClick={()=>props.onOpenTrim("fixture-last-employee")}>Ouvrir la dernière affectation</button>');
const modules={
 'entry':`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {PlacardPlayerShell} from '/src/components/placard/PlacardPlayerShell';${previewFetch}createRoot(document.getElementById('root')).render(<>${preview?`<p role="note" style={{margin:0,padding:"8px 16px",background:"#fffaf1",color:"#003f30",fontSize:12}}>${schoolReal?'Démo locale · progression et récompenses simulées.':'Prévisualisation locale du menu · données de démonstration. Les destinations sont simulées.'}</p>`:''}<PlacardPlayerShell/></>);`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
 'next/link':`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
 'next/navigation':`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{}});`,
 'next/dynamic':`import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><Component {...props}/></React.Suspense>}`,
 ...Object.fromEntries(Object.entries(destinations).map(([key,value])=>['destination:'+key,value])),
};
if(world3d){
 modules['entry']=`import {QuarterCharacterGate} from '/src/components/contest/QuarterCharacterGate';${modules['entry'].replace('<PlacardPlayerShell/>','{new URLSearchParams(location.search).has("entryGate")?<QuarterCharacterGate ownerId="world-audit-player"><PlacardPlayerShell draftOwnerId="world-audit-player"/></QuarterCharacterGate>:<PlacardPlayerShell draftOwnerId="world-audit-player"/>}')}`;
}
// Consent itself is covered by the entry audit; this isolated shell fixture starts after it.
modules['navigation-consent']='export const useCookieConsent=()=>({showBanner:false,consent:null,hasConsent:()=>false});';
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}button{cursor:pointer}`;
// This isolated navigation fixture has no hosting environment or payment destination.
modules['entry'] = `window.process={env:{NEXT_PUBLIC_KQ_FINANCIAL_SUPPORT_URL:''}};${modules['entry']}`;
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,world3d?'vite-cache-world-3d':'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react',...(world3d||schoolReal?['react/jsx-runtime','three','@react-three/fiber','three/addons/controls/OrbitControls.js','three/addons/utils/BufferGeometryUtils.js','three/addons/geometries/RoundedBoxGeometry.js']:[])]},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom',...(world3d?['three']:[])]},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'placard-clarity',enforce:'pre',resolveId(id,importer){if(id.replaceAll('\\','/').endsWith('/CookieConsentProvider'))return '\0navigation-consent';if(importer?.replaceAll('\\','/').endsWith('/PlacardPlayerShell.tsx')&&id in destinations)return '\0destination:'+id;if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{
 const url=new URL(req.url||'/',origin);
 const path=decodeURIComponent(url.pathname).replaceAll('\\','/');
 const privateOutput=/\/output(?:\/|$)/i.test(path)&&!/\/output\/placard-navigation\/vite-cache(?:-world-3d)?\//i.test(path);
 if(privateOutput||/(?:^|\/)(?:scripts\/|\.vercel(?:\/|$)|kanab-quest-school-(?:answers|server|(?:history|botany|terpenes|cannabinoids|cultivation|health|soil|products|harvest)(?:-[a-z-]+)?-answers)\.)/i.test(path)){res.statusCode=403;res.end('Source privée de la démo');return;}
 if(preview&&(url.pathname==='/api'||url.pathname.startsWith('/api/'))){void previewApi(req,res,url);return;}
 if(!['/','/arene/placard'].includes(url.pathname))return next();
 res.setHeader('Content-Type','text/html');
 if(preview)res.setHeader('Content-Security-Policy',"connect-src 'self'; form-action 'none'; frame-src 'none'");
 res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard — vérification locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);
 });}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null,fs:{deny:privatePreviewFiles}}});
﻿let browser, scenario='starter', failed=false;
const errors=[], requests=[], results=[];
const staffEngine = await server.ssrLoadModule('/src/lib/kanab-quest-staff.ts');
const baseStaffSnapshot = staffEngine.projectKqStaffSnapshot({
 state: null, revision: 0, serverNow: '2026-10-11T12:00:00.000Z', cashCents: 0,
 context: {businessStartedAt:'2026-10-11T10:00:00.000Z',reputation:0,instagramFollowers:0,shopPartners:0,activeRuns:[],processingBatches:[],supplierInvoices:[],dayPlanVersion:1,teamWork:[]},
});
await mkdir(output,{recursive:true});
if(preview){
 await server.listen();
 const url=`${origin}/arene/placard${schoolReal?'?view=school':''}`;
 await writeFile(resolve(output,schoolReal?'school-preview-process.json':'preview-process.json'),JSON.stringify({pid:process.pid,url,port,startedAt:new Date().toISOString(),command:`node scripts/audit-placard-navigation.mjs --preview${schoolVisual?' --school-visual':schoolReal?' --school-real':''}`,stopCommand:`Stop-Process -Id ${process.pid}`,scope:'Données fictives en mémoire ; aucun service distant ; réinitialisation au redémarrage.'},null,2));
 console.log(`Prévisualisation locale : ${url}\nPID ${process.pid} · données et récompenses simulées en mémoire.`);
}
else try {
 await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:world3d?['--no-sandbox','--enable-unsafe-swiftshader']:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(); page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(90000);
 const teamFixture=quarterTeam?await createQuarterTeamFixture(server):null;
 page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=new URL(request.url());
  if(url.protocol==='data:'||url.protocol==='blob:')return void request.continue();
  if(url.origin!==origin)return void request.abort();
  if(!url.pathname.startsWith('/api/'))return void request.continue();
  requests.push({path:url.pathname,method:request.method()});
  if(teamFixture&&url.pathname==='/api/arena/placard/staff')return void teamFixture.handle(request);
  if(schoolFixture&&url.pathname.startsWith('/api/arena/placard/school'))return void schoolFixture.handle(request,url);
  if(request.method()!=='GET')return void request.respond({status:405,contentType:'application/json',body:'{"error":"Local audit is read-only"}'});
  if(world3d&&scenario==='world-signed-out'&&url.pathname==='/api/arena/tutorial')return void request.respond({status:401,contentType:'application/json',body:'{}'});
  const payload=fixturePayload(url.pathname,scenario);
  if(scenario==='error'&&!failed&&url.pathname==='/api/arena/placard/equipment') { failed=true; return void request.respond({status:503,contentType:'application/json',body:'{"error":"Essai local"}'}); }
  if(scenario==='overflow-equipment-error'&&url.pathname==='/api/arena/placard/equipment')return void request.respond({status:503,contentType:'application/json',body:'{"error":"Résumé indisponible"}'});
  void request.respond({status:payload?200:404,contentType:'application/json',body:JSON.stringify(payload??{error:'API non simulée'})});
 });
 const visit=async(state='starter',query='')=>{scenario=state;failed=false;await page.goto(`${origin}/arene/placard?scenario=${state}${query?'&'+query:''}`,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);};
 const view=async destination=>{await page.waitForSelector(`[data-placard-view="${destination}"]`);if(destination!=='hub')await page.waitForSelector('[data-destination], [data-placard-collections], [data-school]');else{await page.waitForSelector('[data-map-zoom-toggle]');assert.equal(await page.$('[data-placard-map] [aria-label="Aide du quartier"], [data-placard-map] [data-help-facts], [data-map-motion-toggle]'),null,'The map help panel and manual animation control are absent');}};
 const visible=async selector=>page.waitForFunction(selector=>[...document.querySelectorAll(selector)].find(element=>element.checkVisibility()),{},selector);
 const mapPoint=async(id,kind='hit')=>page.evaluate(async({id,kind})=>{
  const viewport=document.querySelector('#placard-map-viewport');
  // Browser Back restores the map and its contextual panel on animation frames.
  // Let that layout settle before sending a real touch to image coordinates.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const button=document.querySelector(`[data-map-building="${id}"]`),image=viewport.querySelector('img');
  const values=button.getAttribute(`data-map-${kind}-point`)?.split(',').map(Number);
  if(!values||values.length!==2||values.some(value=>!Number.isFinite(value)))throw new Error(`Missing map ${kind} point for ${id}`);
  if(viewport.scrollWidth>viewport.clientWidth+1)viewport.scrollTo({left:image.offsetWidth*values[0]/100-viewport.clientWidth/2,top:image.offsetHeight*values[1]/100-viewport.clientHeight/2,behavior:'instant'});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  // Centre the settled map in the usable page space, between the sticky header
  // and the mobile navigation. The native scroll restoration may have moved it.
  const header=document.querySelector('#placard-content > header')?.getBoundingClientRect();
  const mobileNav=document.querySelector('nav[aria-label="Accès rapides de Kanab Quest"]')?.getBoundingClientRect();
  const top=header?.height??0,bottom=mobileNav?.height?mobileNav.top:innerHeight,frame=viewport.getBoundingClientRect();
  window.scrollBy({top:frame.top+frame.height/2-(top+bottom)/2,behavior:'instant'});
  const rect=image.getBoundingClientRect(),point={x:rect.left+rect.width*values[0]/100,y:rect.top+rect.height*values[1]/100};
  const hit=document.elementFromPoint(point.x,point.y);
  if(kind==='hit'&&hit?.closest('[data-map-building]')?.getAttribute('data-map-building')!==id)throw new Error(`Map facade ${id} is covered at ${JSON.stringify(point)} by ${hit?.tagName}: ${hit?.textContent?.slice(0,100)}`);
  return point;
 },{id,kind});
 const click=async selector=>{
  const building=selector.match(/^\[data-map-building="([a-z]+)"\]$/)?.[1];
  if(building){
   const touch=(await page.viewport()).hasTouch;
   // Overview facades can be smaller than a finger target. Use their real 44px
   // HTML signs for touch navigation; zoomed facade taps and polygon probes
   // still validate the drawing independently of these accessible alternatives.
   const point=touch&&!await page.$('[data-map-zoomed]')?await page.$eval(`[data-map-label="${building}"]`,(element,id)=>{
    element.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
    const rect=element.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    const hit=document.elementFromPoint(x,y);
    if(hit?.closest('[data-map-building]')?.getAttribute('data-map-building')!==id)throw new Error(`Map sign ${id} is covered by ${hit?.tagName??'the viewport edge'}`);
    return {x,y};
   },building):await mapPoint(building);
   if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);return;
  }
  const handle=await visible(selector);await handle.asElement().evaluate(element=>element.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await handle.asElement().click();await handle.dispose();
 };
 const clickMapZoom=async(input='pointer')=>{
  const handle=await visible('[data-map-zoom-toggle]');
  try {
   // Full-page captures and touch panning can leave the tool row behind the
   // sticky shell header. Centre the real control and verify its hit target.
   await handle.asElement().evaluate(element=>element.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   if(input==='keyboard'){await handle.asElement().focus();await page.keyboard.press('Enter');return;}
   const point=await handle.asElement().evaluate(element=>{
    const rect=element.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    const hit=document.elementFromPoint(x,y);
    if(!hit||!element.contains(hit))throw new Error(`Zoom control is covered by ${hit?.tagName??'the viewport edge'}: ${hit?.textContent?.slice(0,100)??''}`);
    return {x,y};
   });
   if((await page.viewport()).hasTouch)await page.touchscreen.tap(point.x,point.y);
   else await page.mouse.click(point.x,point.y);
  }finally{await handle.dispose();}
 };
 const clickText=async text=>{const handle=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(element=>element.checkVisibility()&&element.textContent.trim()===text),{},text);await handle.asElement().click();await handle.dispose();};
 const screenshot=async name=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return page.screenshot({path:resolve(output,`${name}.png`),fullPage:true});};
 const assertNoOverflow=async label=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' stays within the viewport');
 let width=1440;
 const navTo=async key=>{
  if(width<=1000){await click('nav[aria-label="Accès rapides de Kanab Quest"] button[aria-haspopup="dialog"]');await page.waitForSelector('dialog[aria-label="Menu de Kanab Quest"][open]');await click(`dialog[open] [data-placard-nav="${key}"]`);}
  else await click(`nav[aria-label="Navigation de Kanab Quest"] [data-placard-nav="${key}"]`);
  if(key!=='collection')await view(key);
 };
 const album='[data-placard-collections]';
 const measureMap=()=>page.evaluate(()=>{
  const rect=element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const viewport=document.querySelector('#placard-map-viewport');
  const image=viewport.querySelector('img');
  const buildings=[...document.querySelectorAll('[data-map-building]')].map(element=>{
   const label=document.querySelector(`[data-map-label="${element.dataset.mapBuilding}"]`)??element.firstElementChild;
   const hit=element.querySelector('[data-map-hit-area]');
   return {id:element.dataset.mapBuilding,label:element.getAttribute('aria-label')??element.textContent,bounds:rect(element),labelBounds:label?rect(label):null,hitBounds:hit?rect(hit):null,clipPath:hit?getComputedStyle(hit).clipPath:null,role:element.getAttribute('role'),tabIndex:element.tabIndex};
  });
  return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,imageLoaded:image.complete&&image.naturalWidth>0,source:image.getAttribute('src'),viewport:{...rect(viewport),clientWidth:viewport.clientWidth,scrollWidth:viewport.scrollWidth,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop},buildings,brokenImages:[...document.images].filter(element=>element.complete&&!element.naturalWidth).map(element=>element.src)};
 });
 const waitForVisibleSilhouette=async id=>page.waitForFunction(id=>{
  const shape=document.querySelector(`[data-map-silhouette="${id}"][data-active]`);
  if(!shape)return false;
  const style=getComputedStyle(shape),groupStyle=getComputedStyle(shape.parentElement);
  return Number(groupStyle.opacity)>.95&&style.visibility==='visible'&&style.stroke!=='none'&&Number.parseFloat(style.strokeWidth)>0;
 },{},id);
 const checkMapSilhouettes=async width=>{
  await page.$eval('#placard-map-viewport',element=>element.scrollIntoView({block:'center',behavior:'instant'}));
  const geometry=await page.evaluate(()=>{
   const image=document.querySelector('#placard-map-viewport img').getBoundingClientRect();
   return [...document.querySelectorAll('[data-map-building]')].map(button=>{
    const inspect=kind=>{
     const [x,y]=button.getAttribute(`data-map-${kind}-point`).split(',').map(Number);
     const point={x:image.left+image.width*x/100,y:image.top+image.height*y/100};
     const target=document.elementFromPoint(point.x,point.y),bounds=button.querySelector('[data-map-hit-area]').getBoundingClientRect();
     return {point,hit:target?.closest('[data-map-building]')?.getAttribute('data-map-building')??null,
      mailboxHit:!!target?.closest('[data-map-mailbox]'),
      maskHit:document.elementsFromPoint(point.x,point.y).find(element=>element.matches('[data-map-hit-area]'))?.getAttribute('data-map-hit-area')??null,
      labelHit:target?.closest('[data-map-label]')?.getAttribute('data-map-label')??null,
      inBoundingBox:point.x>bounds.left&&point.x<bounds.right&&point.y>bounds.top&&point.y<bounds.bottom};
    };
    const silhouette=document.querySelector(`[data-map-silhouette="${button.dataset.mapBuilding}"]`);
    return {id:button.dataset.mapBuilding,hit:inspect('hit'),ground:inspect('ground'),
     shape:silhouette?.tagName,vertices:silhouette?.points?.numberOfItems??0,
     controlPointerEvents:getComputedStyle(button).pointerEvents,
     hitPointerEvents:getComputedStyle(button.querySelector('[data-map-hit-area]')).pointerEvents};
   });
  });
  results.at(-1).silhouetteGeometry=geometry;
  for(const building of geometry){
   assert.equal(building.hit.hit,building.id,`${width}: actual building point activates ${building.id}`);
   assert.equal(building.hit.maskHit,building.id,`${width}: ${building.id} facade lies inside its silhouette, independently of its label`);
   assert.equal(building.ground.inBoundingBox,true,`${width}: ${building.id} ground point tests inside its former rectangular hit box`);
   assert.equal(building.ground.maskHit,null,`${width}: ground inside ${building.id} bounds is outside every silhouette`);
   assert(building.ground.hit===null||building.ground.labelHit!==null,`${width}: only a separate accessible label may cover ground near ${building.id}`);
   assert.equal(building.controlPointerEvents,'none',`${width}: ${building.id} button bounding rectangle is inert`);
   assert.equal(building.hitPointerEvents,'auto',`${width}: ${building.id} silhouette accepts input`);
   assert.equal(building.shape,'polygon');assert(building.vertices>=5,`${building.id} follows a building contour`);
  }
  const landmarks=await page.evaluate(({buildings,ground})=>{
   const bounds=document.querySelector('#placard-map-viewport img').getBoundingClientRect();
   const inspect=([x,y])=>{const point={x:bounds.left+bounds.width*x/1536,y:bounds.top+bounds.height*y/1024},target=document.elementFromPoint(point.x,point.y);return {screenPoint:point,hit:target?.closest('[data-map-building]')?.getAttribute('data-map-building')??null,mailboxHit:!!target?.closest('[data-map-mailbox]'),maskHit:document.elementsFromPoint(point.x,point.y).find(element=>element.matches('[data-map-hit-area]'))?.getAttribute('data-map-hit-area')??null};};
   return {buildings:Object.entries(buildings).map(([id,point])=>({id,point,...inspect(point)})),ground:ground.map(point=>({point,...inspect(point)}))};
  },{buildings:MAP_LANDMARKS,ground:MAP_GROUND_POINTS});
  results.at(-1).landmarks=landmarks;
  for(const landmark of landmarks.buildings){assert.equal(landmark.hit,landmark.id,`${width}: independently inspected facade ${landmark.id} is clickable`);assert.equal(landmark.maskHit,landmark.id,`${width}: independently inspected facade ${landmark.id} is inside its real silhouette`);}
  for(const landmark of landmarks.ground)assert.equal(landmark.hit,null,`${width}: inspected soil at ${landmark.point} does not select a building`);
  // A hit-test alone is insufficient: an actual ground click must not open a
  // panel, change the selected building, or navigate to another destination.
  const before=await page.evaluate(()=>({url:location.href,selected:document.querySelector('[data-map-building][data-selected]')?.getAttribute('data-map-building')??null,dialog:!!document.querySelector('dialog[open]')}));
  // Use exact pointer coordinates for soil: mobile browsers deliberately expand
  // nearby label taps beyond elementFromPoint for finger-target adjustment.
  // The mailbox has its own accessible 54px target; at 320px it can cover a
  // historical ground probe without overlapping any building silhouette.
  const clearGround=[...geometry.filter(building=>building.ground.hit===null&&!building.ground.mailboxHit).map(building=>({id:building.id,buildingId:building.id})),...landmarks.ground.filter(landmark=>!landmark.mailboxHit).map(landmark=>({id:landmark.point.join(','),sourcePoint:landmark.point}))];
  for(const building of clearGround){
   // Browser focus and scrolling can move the image between probes. Reproject
   // the same source coordinates immediately before each real pointer click.
   const point=building.buildingId?await mapPoint(building.buildingId,'ground'):await page.$eval('#placard-map-viewport img',(element,[x,y])=>{const rect=element.getBoundingClientRect();return {x:rect.left+rect.width*x/1536,y:rect.top+rect.height*y/1024};},building.sourcePoint);
   await page.mouse.click(point.x,point.y);
   const after=await page.evaluate(()=>({url:location.href,selected:document.querySelector('[data-map-building][data-selected]')?.getAttribute('data-map-building')??null,dialog:!!document.querySelector('dialog[open]')}));
   assert.deepEqual(after,before,`${width}: clicking the ground beside ${building.id} has no action`);
  }
  if(width>1000){
   for(const building of geometry){await page.mouse.move(building.hit.point.x,building.hit.point.y);await waitForVisibleSilhouette(building.id);}
   const point=await mapPoint('warehouse');await page.mouse.move(point.x,point.y);await screenshot(`quartier-hover-${width}`);await page.mouse.move(0,0);
  }
  await page.keyboard.press('Tab');
  for(const id of BUILDING_IDS){await page.focus(`[data-map-building="${id}"]`);await waitForVisibleSilhouette(id);assert(await page.$eval(`[data-map-label="${id}"]`,element=>[element,...element.querySelectorAll('*')].some(part=>{const style=getComputedStyle(part);return style.outlineStyle!=='none'&&Number.parseFloat(style.outlineWidth)>0;})),`${width}: ${id} visible label has a keyboard focus ring`);}
  await page.focus('[data-map-building="warehouse"]');await screenshot(`quartier-focus-${width}`);
  await page.keyboard.press('Enter');await page.waitForSelector('#placard-building-details');
  await page.keyboard.press('Escape');await page.waitForSelector('#placard-building-details',{hidden:true});
  assert.equal(await page.$eval('[data-map-building="warehouse"]',element=>element===document.activeElement),true,'Keyboard activation restores the original building after Escape');
  return {geometry,landmarks};
 };
 if(coast){
   const {auditVillageCoast}=await import('./audit-village-coast.mjs');
   await auditVillageCoast({page,visit,results,baseline:coastBaseline,output,corner:coastCorner});
 }else if(quarterTeam){
   await auditQuarterTeam({page,visit,screenshot,assertNoOverflow,results,fixture:teamFixture});
 }else if(buildingRooms){
   const {auditBuildingRooms}=await import('./audit-building-rooms-scenarios.mjs');
   await auditBuildingRooms({page,visit,click,assertNoOverflow,results,output});
 }else if(world3d){
   await auditWorld3d({page,visit,click,screenshot,assertNoOverflow,results,origin});
 }else if(schoolChallenge){
  await auditSchoolChallenge({page,visit,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolQuizFlow){
  await auditSchoolQuizFlow({page,visit,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolHarvest){
  await auditSchoolHarvest({page,visit,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolProducts){
  await auditSchoolProducts({page,visit,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolSoil){
  await auditSchoolSoil({page,visit,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolHealth){
  await auditSchoolHealth({page,visit,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolCultivation){
  await auditSchoolCultivation({page,visit,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolCannabinoids){
  await auditSchoolCannabinoids({page,visit,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolTerpenes){
  await auditSchoolTerpenes({page,visit,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolBotany){
  await auditSchoolBotany({page,visit,view,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolHistory){
  await auditSchoolHistory({page,visit,view,click,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(schoolReal){
  await auditSchool({page,visit,view,click,clickText,screenshot,assertNoOverflow,results,fixture:schoolFixture,setWidth:value=>{width=value;}});
 }else if(cardsOnly){
  for(width of [320,390,1440]){
   await page.setViewport({width,height:width<700?844:1050,isMobile:width<700,hasTouch:width<700,deviceScaleFactor:1});
   await visit('cards');await view('hub');
   assert.equal(await page.$$eval('[data-map-building="collection"]',els=>els.length),1);
   assert.equal(await page.$eval('[data-map-building="collection"]',el=>el.getAttribute('aria-label').startsWith('QuizzShow')),true);
   await page.focus('[data-map-building="collection"]');await page.keyboard.press('Enter');await view('school');
   await click('[data-school-exit]');await view('hub');
   await page.focus('[data-map-building="shop"]');await page.keyboard.press('Enter');await view('shop');
   await page.waitForSelector('[data-cards-tab="packs"][aria-current="page"]');
   await click('[data-cards-tab="collection"]');await page.waitForSelector('[data-placard-collections]');
   assert.equal(new URL(page.url()).searchParams.get('tab'),'collection');
   assert.equal(await page.$eval('[data-placard-collections]',el=>el.tagName),'SECTION');
   await click('[data-collection-tab="buddies"]');await page.waitForSelector('[data-buddie-collection-card="HH2026-004"]');
   await click('[data-buddie-collection-filter="all"]');await page.waitForSelector('[data-buddie-collection-card="HH2026-001"]');
   await assertNoOverflow('Maison des cartes');await screenshot(`cards-house-${width}`);
   await click('[data-buddie-collection-card="HH2026-001"]');await page.waitForSelector('[data-buddie-collection-detail="HH2026-001"][open]');
   assert((await page.$eval('[data-buddie-collection-detail]',el=>el.textContent)).includes('Le personnage du jeu'),'Unowned Buddy includes its real public history');
   await assertNoOverflow('Fiche sans possession');await screenshot(`cards-buddy-${width}`);
   await clickText('Apprendre avec ce Buddy');await view('school');assert.equal(new URL(page.url()).searchParams.get('module'),'plant');
   await click('[data-placard-back="shop"]');await view('shop');await page.waitForSelector('[data-buddie-collection-detail="HH2026-001"][open]');
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-buddie-collection-detail]'));
   await visit('cards','view=school&section=quiz&module=plant');await view('school');await click('[data-school-read-buddy]');await view('shop');
   await page.waitForSelector('[data-buddie-collection-detail="HH2026-001"][open]');await page.keyboard.press('Escape');await view('school');
   assert.equal(new URL(page.url()).searchParams.get('section'),'quiz');assert.equal(new URL(page.url()).searchParams.get('module'),'plant');
   await visit('cards','view=collection&section=buddies');await view('shop');await page.waitForSelector('[data-collection-tab="buddies"][aria-selected="true"]');
   assert.equal(await page.$eval('[data-cards-tab="collection"]',el=>el.getAttribute('aria-current')),'page');
   await click('[data-cards-tab="packs"]');await page.waitForSelector('[data-shop-section]');assert.equal(await page.$eval('[data-shop-section]',el=>el.textContent),'buddies');
   await navTo('school');await assertNoOverflow('Menu école');
   results.push({scenario:'cards-school-navigation',width,legacyCollection:true,unownedReading:true,roundTrip:true});
  }
  await visit('cards-unavailable','view=shop&tab=collection&section=buddies&buddy=HH2026-001&from=school&schoolModule=plant&schoolSection=learn');
  await page.waitForSelector('[data-buddie-collection-detail="HH2026-001"][open]');
  assert((await page.$eval('[data-buddie-collection-detail]',el=>el.textContent)).includes('quantité dans ton album indisponible'),'Account outage never invents zero ownership');
  await page.keyboard.press('Escape');await view('school');results.push({scenario:'public-buddy-with-account-outage',readable:true});
 }else if(focusOnly){
  for(width of [320,1440]){
   await page.setViewport({width,height:844,isMobile:width<=390,hasTouch:width<=390,deviceScaleFactor:1});
   await visit('starter');await view('hub');
   const lobbySelector='main[data-placard-lobby][aria-label="Mon quartier"][tabindex="-1"]';
   assert.equal(await page.$eval(lobbySelector,element=>element===document.activeElement),false,'Initial entry keeps its existing focus');
   const verifyHubFocus=async label=>{
    await view('hub');
    await page.waitForFunction(selector=>document.activeElement===document.querySelector(selector),{},lobbySelector);
    await page.waitForSelector('[data-placard-next-action]');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.$eval(lobbySelector,element=>element===document.activeElement&&element.tabIndex===-1),true,label+' keeps focus at Mon quartier after its summary loads');
    await page.keyboard.press('Tab');
    const primarySelector='[data-placard-next-action] > :is(button,a)';
    assert.equal(await page.$eval(primarySelector,element=>element===document.activeElement),true,label+' continues at the recommended action');
    assert.notEqual(await page.$eval(primarySelector,element=>getComputedStyle(element).outlineStyle),'none',label+' keeps a visible keyboard focus');
    await assertNoOverflow(label);
    results.push({width,scenario:label,landmark:'Mon quartier',nextTab:await page.$eval(primarySelector,element=>element.textContent.trim()),overflow:false});
   };
   for(const destination of ['workshop','staff']){
    await navTo(destination);
    await page.focus('button[data-placard-back="hub"]');await page.keyboard.press('Enter');
    await verifyHubFocus('keyboard-return-'+destination);
   }
   await navTo('market');
   if(width<=1000){
    await page.focus('button[aria-label="Plus d’activités"]');await page.keyboard.press('Enter');
    await page.waitForSelector('dialog[aria-label="Menu de Kanab Quest"][open]');
    await page.focus('dialog[open] [data-placard-nav="hub"]');
   }else await page.focus('nav[aria-label="Navigation de Kanab Quest"] [data-placard-nav="hub"]');
   await page.keyboard.press('Enter');await verifyHubFocus('keyboard-menu-return');
   await page.focus('[data-map-building="office"]');await page.keyboard.press('Enter');await view('staff');
   await page.goBack();await verifyHubFocus('browser-back-return');
   assert.equal(await page.$eval('[data-map-building="office"]',element=>element.dataset.selected),'true','Browser Back preserves the selected building');
   await screenshot('quartier-return-focus-'+width);
  }
 }else if(motionOnly){
  const atmosphere='[data-map-atmosphere]';
  const motionTargets='[data-water-glint], [data-gull-flight], [data-activity-glow], [data-doorway-intent], [data-scenery-motion], [data-scenery-reaction], [data-smoke-puff]';
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const motionScreenshot=async(name,fromTop=true)=>{
   if(fromTop)await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   return page.screenshot({path:resolve(output,`${name}.png`),fullPage:false});
  };
  const waitForMotion=state=>page.waitForFunction(state=>document.querySelector('[data-map-atmosphere]')?.getAttribute('data-motion-state')===state,{timeout:15000,polling:100},state);
  const showScene=async()=>{await page.$eval('#placard-map-viewport',element=>element.scrollIntoView({block:'center',behavior:'instant'}));await waitForMotion('running');};
  const sampleMotion=()=>page.$$eval(motionTargets,elements=>elements.map(element=>{
   const style=getComputedStyle(element),rect=element.getBoundingClientRect(),frame=document.querySelector('#placard-map-viewport').getBoundingClientRect();
   return {target:element.getAttribute('data-scenery-motion')??(element.hasAttribute('data-scenery-reaction')?'reaction:'+element.getAttribute('data-scenery-reaction'):element.hasAttribute('data-smoke-puff')?'smoke':element.hasAttribute('data-water-glint')?'water':element.hasAttribute('data-gull-flight')?'gull':element.getAttribute('data-activity-glow')??'doorway'),transform:style.transform,opacity:style.opacity,visibility:style.visibility,display:style.display,visible:rect.width>0&&rect.height>0&&rect.bottom>Math.max(0,frame.top)&&rect.top<Math.min(innerHeight,frame.bottom)&&rect.right>Math.max(0,frame.left)&&rect.left<Math.min(innerWidth,frame.right)};
  }));
  const checkFrozen=async label=>{await pause(300);const before=await sampleMotion();await pause(300);const after=await sampleMotion();assert.deepEqual(after,before,label+' freezes the actual painted effects');return after;};
  const sampleReaction=id=>page.$eval(`[data-scenery-reaction="${id}"]`,element=>{const style=getComputedStyle(element);return {transform:style.transform,opacity:style.opacity};});
  const checkReaction=async(id,input)=>{
   await page.mouse.move(2,2);await page.focus('[data-map-zoom-toggle]');await pause(800);
   const before=await sampleReaction(id);
   if(input==='keyboard')await page.focus(`[data-map-building="${id}"]`);
   else {const point=await mapPoint(id);await page.mouse.move(point.x,point.y);}
   await page.waitForFunction(({id,before})=>{const element=document.querySelector(`[data-scenery-reaction="${id}"]`);if(!element)return false;const style=getComputedStyle(element);return style.transform!==before.transform||style.opacity!==before.opacity;},{timeout:3000,polling:'raf'},{id,before});
   const during=await sampleReaction(id);await pause(250);
   return {id,input,before,during};
  };
  const armNavigation=async()=>page.evaluate(()=>{
   window.__motionNavigation=null;
   document.addEventListener('click',()=>{const started=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__motionNavigation={elapsedMs:Math.round(performance.now()-started),view:document.querySelector('[data-placard-view]')?.getAttribute('data-placard-view'),panel:!!document.querySelector('#placard-building-details')};}));},{capture:true,once:true});
  });
  for(width of [320,390,1440]){
   await page.setViewport({width,height:width<=390?844:1000,isMobile:width<=390,hasTouch:width<=390,deviceScaleFactor:1});
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
   await visit('motion');await view('hub');await page.waitForSelector(atmosphere);await page.waitForSelector('[data-map-activity="jury"]');
   await showScene();await assertNoOverflow(`Motion ${width}`);
   const initial=await sampleMotion();await pause(700);const moving=await sampleMotion();
   assert(initial.length>0,'Motion exposes real scene elements');
   assert(moving.some((item,index)=>item.visible&&item.display!=='none'&&item.visibility==='visible'&&(item.transform!==initial[index].transform||item.opacity!==initial[index].opacity)),`${width}: visible artwork changes in normal motion`);
   const hitBehavior=await page.$eval(atmosphere,element=>({pointerEvents:getComputedStyle(element).pointerEvents,hidden:element.getAttribute('aria-hidden'),focusable:element.getAttribute('focusable')}));
   assert.equal(hitBehavior.pointerEvents,'none','Decorative motion cannot cover building interactions');assert.equal(hitBehavior.hidden,'true','Decorative motion does not repeat game state to assistive technology');
   await motionScreenshot(`motion-running-${width}`);
   await showScene();await motionScreenshot(`motion-running-viewport-${width}`,false);
   assert.equal(await page.$('[data-map-discovery], [data-map-discovery-reply], [data-placard-map] details'),null,'Decorative discoveries and their explanatory text are absent');
   const record={width,scenario:'motion',normal:{initial,moving},hitBehavior,motionControlAbsent:true,discoveryTextAbsent:true};results.push(record);
   if(width<=390){
    const region=await page.$eval('#placard-map-viewport',element=>{
     const frame=element.getBoundingClientRect(),painting=element.querySelector('img').getBoundingClientRect();
     const sourcePoint=[61,323],point={x:painting.left+painting.width*sourcePoint[0]/1536,y:painting.top+painting.height*sourcePoint[1]/1024};
     return {sourcePoint,point,visible:point.x>Math.max(0,frame.left)&&point.x<Math.min(innerWidth,frame.right)&&point.y>Math.max(0,frame.top)&&point.y<Math.min(innerHeight,frame.bottom)};
    });
    const before=initial.find(item=>item.target==='hydrangea'),after=moving.find(item=>item.target==='hydrangea');
    assert(before&&after,`${width}: the initial phone view includes animated hydrangeas`);
    assert(region.visible,`${width}: the painted hydrangea centre is inside the actual camera and screen`);
    assert(after.display!=='none'&&after.visibility==='visible'&&Number(after.opacity)>0&&after.transform!==before.transform,`${width}: visible hydrangea artwork really moves in the initial phone view`);
    record.phoneScenery={target:'hydrangea',region,before,after};
   }
   if(width===1440){
    record.sceneryMotion=['bank-sign','shop-sign','library-sign','flag'].map(target=>{
     const before=initial.find(item=>item.target===target),after=moving.find(item=>item.target===target);
     assert(before&&after,`${target}: the painted scene element exists`);
     assert(after.visible&&after.display!=='none'&&after.visibility==='visible'&&(after.transform!==before.transform||after.opacity!==before.opacity),`${target}: the visible painted element really moves`);
     return {target,before,after};
    });
   }
   await page.focus('[data-map-building="collection"]');await pause(700);await showScene();
   const libraryBefore=(await sampleMotion()).find(item=>item.target==='library-sign');await pause(700);
   const libraryAfter=(await sampleMotion()).find(item=>item.target==='library-sign');
   assert(libraryBefore&&libraryAfter?.visible&&libraryAfter.visibility==='visible',`${width}: the library sign is visible when its building receives keyboard focus`);
   assert.notEqual(libraryBefore.transform,libraryAfter.transform,`${width}: the question-mark sign swings`);
   assert.match(await page.$eval('[data-map-building="collection"]',element=>element.getAttribute('aria-label')),/QuizzShow/);
   record.library={before:libraryBefore,after:libraryAfter,keyboardFocus:true};
   await motionScreenshot(`library-quiz-focused-${width}`,false);
   let recorder;
   if(width===390||width===1440){
    try {const {default:ffmpegPath}=await import('ffmpeg-static');const path=resolve(output,width===390?'quartier-motion-mobile-demo.webm':'quartier-motion-demo.webm');recorder=await page.screencast({path,format:'webm',fps:24,ffmpegPath});record.video={path};}
    catch(error){record.video={unavailable:error.message};}
   }
   try {
    const idleStarted=Date.now(),idleRequests=requests.length;
    await pause(7000);
    record.idle={durationMs:Date.now()-idleStarted,requests:requests.slice(idleRequests)};
    assert.deepEqual(record.idle.requests,[],`${width}: seven seconds of atmosphere add no API polling`);
    await showScene();
    if(width===1440){
     record.reactions=[];
     for(const id of ['bank','shop','collection'])for(const input of ['keyboard','pointer'])record.reactions.push(await checkReaction(id,input));
    }
    if(width===1440){const point=await mapPoint('warehouse');await page.mouse.move(point.x,point.y);await pause(650);}
    await armNavigation();await click('[data-map-building="warehouse"]');await page.waitForSelector('#placard-building-details');
    await page.waitForFunction(()=>window.__motionNavigation!==null);record.pointer=await page.evaluate(()=>window.__motionNavigation);
    assert.equal(record.pointer.panel,true,'The activity panel is available within two animation frames of the real pointer activation');
    await assertNoOverflow(`Motion panel ${width}`);await motionScreenshot(`motion-panel-${width}`,false);
    if(width===1440)await pause(650);
    await page.keyboard.press('Escape');await page.waitForSelector('#placard-building-details',{hidden:true});
    assert.equal(await page.$eval('[data-map-building="warehouse"]',element=>element===document.activeElement),true,'Escape returns focus to the selected building');
    await showScene();
    if(width===390){
     await click('[data-map-building="office"]');await view('staff');await pause(650);
     await page.goBack();await view('hub');await showScene();await pause(650);
     record.touchNavigation={destination:'staff',returned:true};
    }
    if(width===1440){
     const point=await mapPoint('bank');await page.mouse.move(point.x,point.y);await page.focus('[data-map-building="bank"]');await pause(800);
     const before=await sampleReaction('bank');await page.mouse.down();await pause(100);const pressed=await sampleReaction('bank');
     assert.notDeepEqual(pressed,before,'Pressing the bank gives a painted reaction before navigation');
     await page.mouse.up();await view('treasury');assert.equal(new URL(page.url()).searchParams.get('pole'),'accounting');
     await pause(650);await page.goBack();await view('hub');await showScene();await pause(650);
     record.press={building:'bank',before,pressed,destination:'treasury:accounting',returned:true};
    }
   }finally{
    if(recorder){try {await recorder.stop();record.video.bytes=(await stat(record.video.path)).size;assert(record.video.bytes>1024,'The interaction recording contains video frames');}catch(error){record.video={unavailable:error.message};}}
   }
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await waitForMotion('reduced');record.reduced=await checkFrozen('Live reduced-motion preference');
   await motionScreenshot(`motion-reduced-${width}`);
   await page.$eval('#placard-map-viewport',element=>element.scrollIntoView({block:'center',behavior:'instant'}));await motionScreenshot(`motion-reduced-viewport-${width}`,false);
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);await showScene();record.livePreference=true;
   if(width===1440){
    await clickMapZoom();await page.waitForSelector('[data-map-zoomed]');await showScene();
    const point=await page.$eval('#placard-map-viewport',element=>{element.scrollLeft=0;const rect=element.getBoundingClientRect();return {x:rect.right-40,y:rect.top+rect.height/2};});
    await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x-90,point.y,{steps:8});
    await waitForMotion('paused');record.panning=await checkFrozen('Mouse panning');
    await page.mouse.up();await waitForMotion('running');await clickMapZoom();await page.waitForSelector('[data-placard-map]:not([data-map-zoomed])');await showScene();
   }
   // A temporary, inert spacer allows an actual scroll outside the viewport even
   // when the desktop page is shorter than the browser. No observer is mocked.
   await page.evaluate(()=>{const spacer=document.createElement('div');spacer.dataset.motionAuditSpacer='';spacer.setAttribute('aria-hidden','true');spacer.style.height='200vh';document.body.append(spacer);window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});});
   await waitForMotion('offscreen');record.offscreen=await checkFrozen('Offscreen scene');
   await page.evaluate(()=>document.querySelector('[data-motion-audit-spacer]')?.remove());await showScene();
   if(width===1440){
    const other=await browser.newPage();
    try {await other.bringToFront();const hidden=await page.evaluate(()=>document.hidden);if(hidden){await waitForMotion('hidden');record.hidden=await checkFrozen('Hidden document');}else record.hidden={unavailable:'This headless browser does not hide background tabs'};}
    finally{await other.close();await page.bringToFront();}
    await showScene();
   }
   await page.focus('[data-map-building="market"]');await page.keyboard.press('Enter');await page.waitForSelector('#placard-building-details');
   await page.focus('[data-placard-activity="market"]');await armNavigation();await page.keyboard.press('Enter');await view('market');
   await page.waitForFunction(()=>window.__motionNavigation!==null);record.keyboard=await page.evaluate(()=>window.__motionNavigation);
   assert.equal(record.keyboard.view,'market','Keyboard navigation is available within two animation frames');
   assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales','The animated map preserves the sale destination');
   await assertNoOverflow(`Motion destination ${width}`);
   await page.goBack();await view('hub');await showScene();
   await click('[data-map-building="office"]');await view('staff');await assertNoOverflow(`Personnel destination ${width}`);
   await page.goBack();await view('hub');await showScene();
   await page.focus('[data-map-building="collection"]');await page.keyboard.press('Enter');await view('school');
   await page.waitForSelector('img[src="/placard/ui/school-v4.webp"]');
   await assertNoOverflow(`Library destination ${width}`);await motionScreenshot(`library-quiz-destination-${width}`,false);
   record.destinations=['market:sales','staff','school'];
  }
 }else if(clarityOnly){
  for(width of [320,390,1440]){
   await page.setViewport({width,height:844,isMobile:width<=390,hasTouch:width<=390,deviceScaleFactor:1});
   await visit('starter');await view('hub');
   await page.focus('[data-map-building="market"]');await page.keyboard.press('Enter');
   await page.waitForSelector('#placard-building-details');
   await click('[data-placard-activity="market"]');await view('market');
   assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales','The map action opens Vendre directly');
   await navTo('market');
   assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'overview','Generic Commerce still opens Synthèse');
   for(const section of ['overview','storage']){
    await visit('starter',`view=harvests&flower=fixture-flower${section==='storage'?'&section=storage':''}`);await view('harvests');
    await clickText('Présenter au jury');await view('arena');
    assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower');
    await click('button[data-placard-back="harvests"]');await view('harvests');
    assert.equal(await page.$eval('[data-harvest-section]',element=>element.textContent),section,'Jury returns to the original harvest sub-section');
    assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower');
   }
   await visit('starter','view=arena&flower=fixture-flower&from=workshop&fromSection=storage&fromFlower=fixture-flower');await view('arena');
   await click('button[data-placard-back="workshop"]');await view('workshop');
   assert.equal(new URL(page.url()).searchParams.get('section'),'storage');
   assert.equal(await page.$eval('[data-warehouse-flower]',element=>element.textContent),'fixture-flower');
   assert.equal(await page.$eval('[data-storage-configuration]',element=>element.textContent),'false','Returning from the jury does not open storage configuration');
   await visit('starter','view=harvests&section=storage&flower=fixture-flower');await view('harvests');
   await clickText('Augmenter la capacité');await view('workshop');
   assert.equal(new URL(page.url()).searchParams.get('configure'),'storage');
   assert.equal(await page.$eval('[data-storage-configuration]',element=>element.textContent),'true','The capacity action explicitly requests storage configuration');
   await click('button[data-placard-back="harvests"]');await view('harvests');
   assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower');
   assert.equal(new URL(page.url()).searchParams.has('configure'),false,'The equipment request is scoped to its warehouse entry');
   await assertNoOverflow('Navigation destinations');
   results.push({width,scenario:'clarity-navigation',mapSale:true,genericSummary:true,juryReturns:['overview','storage','workshop'],selectedLot:true});
  }
 }else{
 for(width of (process.env.NAVIGATION_AUDIT_WIDTHS?.split(',').map(Number)??[320,390,768,1440])) {
  await page.setViewport({width,height:width<=390?844:1000,isMobile:width<=390,hasTouch:width<=390,deviceScaleFactor:1});
  await visit('active');await view('hub');
  await page.waitForSelector('[data-placard-next-action]');
  const initialMeasurement=await measureMap();
  await screenshot(`quartier-${width}`);
  assert.equal(await page.$eval('[data-placard-map]',element=>element.hasAttribute('data-map-zoomed')),width<=700,'Mobile starts with readable buildings; larger screens show the whole village');
  if(width<=700){
   assert(initialMeasurement.viewport.height>=240&&initialMeasurement.viewport.height<=360,'Mobile exploration leaves room for the next action below the scene');
   assert(await page.$eval('[data-map-zoom-toggle] span',element=>getComputedStyle(element).display!=='none'&&element.textContent==='Tout le quartier'),'The complete map toggle stays readable on mobile');
   // Keyboard prepares the overview after a full-page capture; real touch zoom
   // and panning are exercised separately in the navigation and mobile audits.
   await clickMapZoom('keyboard');await page.waitForSelector('[data-placard-map]:not([data-map-zoomed])');
  }
  const measurement=await measureMap();
  results.push({width,initialMeasurement,measurement});
  await screenshot(`quartier-overview-${width}`);
  assert.equal(measurement.overflow,false);assert.equal(measurement.imageLoaded,true);assert.equal(measurement.source,MAP_ASSET);assert.deepEqual(measurement.brokenImages,[]);
  assert.deepEqual(measurement.buildings.map(building=>building.id).sort(),[...BUILDING_IDS].sort(),'Every illustrated destination has one real hit target');
  assert(measurement.viewport.scrollWidth<=measurement.viewport.clientWidth+1,'The overview shows the complete image');
  for(const [index,building] of measurement.buildings.entries()){
   assert(building.labelBounds?.width>=44&&building.labelBounds?.height>=44,`${width}: ${building.id} has a visible 44px label alternative to its irregular silhouette`);
   assert(building.labelBounds.left>=measurement.viewport.left-1&&building.labelBounds.right<=measurement.viewport.right+1&&building.labelBounds.top>=measurement.viewport.top-1&&building.labelBounds.bottom<=measurement.viewport.bottom+1,`${width}: ${building.id} label is fully visible in the overview`);
   assert(building.clipPath?.startsWith('polygon('),`${width}: ${building.id} uses a real polygon hit mask`);
   assert(building.tabIndex>=0,`${width}: ${building.id} has keyboard access`);
   assert(/[a-zÀ-ÿ]/i.test(building.label),`${building.id} keeps its complete accessible name in overview`);
   for(const other of measurement.buildings.slice(index+1)){
    const a=building.labelBounds,b=other.labelBounds;if(!a||!b)continue;
    assert(Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1,`${width}: ${building.id} and ${other.id} labels do not overlap`);
   }
  }
  results.at(-1).silhouettes=await checkMapSilhouettes(width);
  if(width<=1000){
   const trigger='nav[aria-label="Accès rapides de Kanab Quest"] button[aria-haspopup="dialog"]';
   await page.focus(trigger);await page.keyboard.press('Enter');await page.waitForSelector('dialog[aria-label="Menu de Kanab Quest"][open]');
   assert.equal(await page.evaluate(()=>document.querySelector('dialog[open]').contains(document.activeElement)),true,'Drawer receives focus');
   await screenshot(`menu-${width}`);await assertNoOverflow('Mobile menu');
   for(let index=0;index<16;index++){await page.keyboard.press('Tab');const focus=await page.evaluate(()=>({contained:document.querySelector('dialog[open]').contains(document.activeElement),tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,80)}));assert(focus.contained||focus.tag==='BODY',`Modal keyboard focus never reaches a background control: ${JSON.stringify(focus)}`);}
   await page.keyboard.press('Escape');await page.waitForSelector('dialog[aria-label="Menu de Kanab Quest"][open]',{hidden:true});
   assert.equal(await page.$eval(trigger,element=>element===document.activeElement),true,'Escape returns focus to Menu');
  }else{
   await page.hover('nav[aria-label="Navigation de Kanab Quest"] [data-placard-nav="market"]');await page.waitForSelector('[data-map-building="market"][data-highlighted]');
   await page.focus('nav[aria-label="Navigation de Kanab Quest"] [data-placard-nav="game"]');await page.waitForSelector('[data-map-building="warehouse"][data-highlighted]');
  }
  await click('[data-map-building="warehouse"]');await page.waitForSelector('#placard-building-details');
  await page.waitForFunction(()=>document.activeElement?.id==='placard-building-details');await screenshot(`entrepot-actions-${width}`);await assertNoOverflow('Warehouse choices');
  await page.keyboard.press('Escape');await page.waitForSelector('#placard-building-details',{hidden:true});assert.equal(await page.$eval('[data-map-building="warehouse"]',element=>element===document.activeElement),true);
  await click('[data-map-building="warehouse"]');await click('[data-placard-activity="storage"]');await view('harvests');
  assert.equal(new URL(page.url()).searchParams.get('view'),'harvests');
  await page.goBack();await view('hub');assert.equal(await page.$eval('[data-map-building="warehouse"]',element=>element.dataset.selected),'true','Selection survives return');
  await clickMapZoom();await page.waitForSelector('[data-map-zoomed]');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.$eval('#placard-map-viewport',element=>{element.scrollLeft=100;element.scrollTop=70;});
  await page.waitForFunction(()=>document.querySelector('#placard-map-viewport').scrollLeft>0);
  const before=await page.$eval('#placard-map-viewport',element=>({left:element.scrollLeft,top:element.scrollTop}));
  await navTo('game');await page.goBack();await view('hub');await page.waitForSelector('[data-map-zoomed]');
  const after=await page.$eval('#placard-map-viewport',element=>({left:element.scrollLeft,top:element.scrollTop}));
  assert(Math.abs(after.left-before.left)<=1&&Math.abs(after.top-before.top)<=1,'Map zoom and framing survive navigation');
  results.at(-1).zoomLayout=await page.evaluate(()=>({windowScroll:scrollY,scrollContainers:[...document.querySelectorAll('*')].filter(element=>element.scrollTop>0).map(element=>({tag:element.tagName,className:String(element.className),top:element.scrollTop,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight})),panel:document.querySelector('#placard-building-details')?.getBoundingClientRect().toJSON()}));
  const panPoint=await page.$eval('#placard-map-viewport',element=>{element.scrollIntoView({block:'center',behavior:'instant'});const rect=element.getBoundingClientRect();return {x:rect.left+rect.width*.7,y:rect.top+rect.height*.6};});
  const panStart=await page.$eval('#placard-map-viewport',element=>element.scrollLeft);
  if(width<=390){const client=await page.createCDPSession();await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:panPoint.x,y:panPoint.y}]});for(let step=1;step<=6;step++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:panPoint.x-step*10,y:panPoint.y}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();}
  else {await page.mouse.move(panPoint.x,panPoint.y);await page.mouse.down();await page.mouse.move(panPoint.x-70,panPoint.y,{steps:10});await page.mouse.up();}
  await page.waitForFunction(start=>document.querySelector('#placard-map-viewport')?.scrollLeft>start+10,{},panStart);await view('hub');
  results.at(-1).afterPanLayout=await page.evaluate(()=>({windowScroll:scrollY,scrollContainers:[...document.querySelectorAll('*')].filter(element=>element.scrollTop>0).map(element=>({tag:element.tagName,className:String(element.className),top:element.scrollTop,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight})),panelChildren:[...document.querySelector('#placard-building-details').children].map(element=>({tag:element.tagName,text:element.textContent.slice(0,40),rect:element.getBoundingClientRect().toJSON(),overflow:getComputedStyle(element).overflow}))}));
  await screenshot(`quartier-zoom-${width}`);await clickMapZoom();await page.waitForSelector('[data-map-zoomed]',{hidden:true});
  await click('[data-map-building="bank"]');await view('treasury');assert.equal(new URL(page.url()).searchParams.get('pole'),'accounting');
  await page.goBack();await view('hub');await click('[data-map-building="office"]');await view('staff');
  await clickText('Trim dans l’Atelier');await view('workshop');assert.equal(await page.$eval('[data-warehouse-section]',element=>element.textContent),'processing');assert.equal(new URL(page.url()).searchParams.get('employee'),'fixture-employee');
  await navTo('hub');await click('[data-map-building="warehouse"]');await click('[data-placard-activity="workshop"]');await view('workshop');assert.equal(await page.$eval('[data-warehouse-section]',element=>element.textContent),'processing','The farm opens the real Atelier');
  await page.goBack();await view('hub');await click('[data-map-building="market"]');await click('[data-placard-activity="social"]');await view('social');
  await page.goBack();await view('hub');await click('[data-map-building="collection"]');await view('school');await click('[data-school-exit]');await view('hub');
  await page.waitForFunction(()=>document.activeElement?.matches('[data-placard-lobby]'));
  for(const destination of ['shop','arena','missions']){
   await click(`[data-map-building="${destination}"]`);await view(destination);
   assert.equal(new URL(page.url()).searchParams.get('view'),destination,`${width}: ${destination} facade opens its destination`);
   await page.goBack();await view('hub');
  }
  await page.focus('[data-map-building="market"]');await page.keyboard.press('Space');await page.waitForSelector('#placard-building-details');
  await click('[data-placard-activity="market"]');await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales','Transformer et vendre opens the sale directly');
  await page.goBack();await view('hub');
  await navTo('shop');await click('[data-cards-tab="collection"]');await page.waitForSelector(album);await click('[data-cards-tab="packs"]');await page.waitForSelector(album,{hidden:true});
  await navTo('harvests');await clickText('Présenter au jury');await view('arena');assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower');
  await page.goBack();await view('harvests');await clickText('Vendre cette récolte');await view('market');assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales','A harvest shortcut still opens its sale');
  await click('button[data-placard-back="harvests"]');await view('harvests');
  assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower','Returning from the sale retains the harvest');
  await clickText('Stockage et affinage');await clickText('Augmenter la capacité');await view('workshop');
  assert.equal(await page.$eval('[data-warehouse-flower]',element=>element.textContent),'fixture-flower','Capacity opens for the selected harvest');
  assert.equal(await page.$eval('aside [data-placard-nav="workshop"]',element=>element.getAttribute('aria-current')),'page','Storage equipment belongs to the warehouse');
  await click('button[data-placard-back="harvests"]');await view('harvests');
  assert.equal(await page.$eval('[data-harvest-section]',element=>element.textContent),'storage','Capacity returns to conservation');
  assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower');
  await clickText('Présenter au jury');await view('arena');
  assert.equal(new URL(page.url()).searchParams.get('fromSection'),'storage','The jury remembers the storage sub-section');
  await click('button[data-placard-back="harvests"]');await view('harvests');
  assert.equal(await page.$eval('[data-harvest-section]',element=>element.textContent),'storage','Returning from the jury restores conservation');
  assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower','Returning from the jury restores the selected harvest');
  await clickText('Vendre cette récolte');await view('market');
  await clickText('Vue d’ensemble');await page.waitForFunction(()=>document.querySelector('[data-market-section]').textContent==='overview');
  assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower','Summary preserves the selected lot without forcing sales');
  await clickText('Vendre ma production');await clickText('Acheter un ordinateur');await view('workshop');
  assert.equal(await page.$eval('[data-warehouse-flower]',element=>element.textContent),'fixture-flower','The equipment catalog keeps the sale lot for its commercial shortcut');
  await click('button[data-placard-back="market"]');await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales');
  assert.equal(await page.$eval('[data-market-flower]',element=>element.textContent),'fixture-flower','Equipment returns to the same commercial lot');
  await clickText('Voir l’annonce ciblée');await page.waitForFunction(()=>document.querySelector('[data-market-listing]').textContent==='fixture-listing');
  await page.reload({waitUntil:'networkidle0'});await view('market');
  assert.equal(await page.$eval('[data-market-listing]',element=>element.textContent),'fixture-listing','Listing deep link survives reload');
  await clickText('Acheter un ordinateur');await view('workshop');await click('button[data-placard-back="market"]');await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'dashboard');
  assert.equal(await page.$eval('[data-market-listing]',element=>element.textContent),'fixture-listing','Equipment returns to the same listing');
  if(width<=1000)assert.deepEqual(await page.$$eval('nav[aria-label="Accès rapides de Kanab Quest"] button',elements=>elements.map(element=>element.textContent.trim())),['Quartier','Culture','Récoltes','Commerce','Plus']);
  await navTo('market');await assertNoOverflow('Commerce');await screenshot(`commerce-navigation-${width}`);
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'overview','The market navigation opens the shop overview');
  await navTo('workshop');await clickText('Acheter une lampe');await view('workshop');await page.waitForFunction(()=>document.querySelector('[data-catalog]')?.textContent==='Matériel');assert.equal(new URL(page.url()).searchParams.get('equipment'),'LED-500');
  results.at(-1).navigation='passed';
 }
 width=390;await page.setViewport({width,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 for(const state of ['starter','lots','jury','investment']){
  await visit(state);await view('hub');await page.waitForSelector('[data-placard-next-action]');await screenshot(`${state}-390`);
  const expected={starter:'game',lots:'market',jury:'arena',investment:'game'}[state];
  await click('[data-placard-next-action] button');await view(expected);
  if(state==='lots')assert.equal(new URL(page.url()).searchParams.get('section'),'sales','Ready lots open the sale directly');
  if(state==='investment')assert.equal(new URL(page.url()).searchParams.has('catalog'),false,'Available cash alone does not send a new player to buy equipment');
  results.push({scenario:state,destination:expected});
 }
 for(const state of ['overflow','overflow-equipment-error']){
  await visit(state);await view('hub');await page.waitForSelector('[data-priority="storage"]');
  const notice=await page.$eval('[data-priority="storage"]',element=>element.textContent);
  assert(notice.includes('375 g sans contenant'),'The priority uses the sum of the server surplus');assert(notice.includes('14:30'),'The earliest server deadline is shown in Paris time');
  assert(notice.includes('Ranger mes récoltes'));assert.equal(await page.$$eval('[data-placard-next-action]',elements=>elements.length),1,'Urgency replaces the ordinary recommendation');
  await assertNoOverflow('Storage urgency');await screenshot(`${state}-390`);await click('[data-priority="storage"] button');await view('harvests');
  assert.equal(new URL(page.url()).searchParams.get('section'),'storage');assert.equal(await page.$eval('[data-harvest-section]',element=>element.textContent),'storage');results.push({scenario:state,destination:'harvests',section:'storage'});
 }
 await visit('storage-error');await view('hub');await page.waitForSelector('[data-placard-next-action]');assert.equal(await page.$('[data-priority="storage"]'),null);await screenshot('storage-error-390');await click('[data-placard-next-action] button');await view('game');results.push({scenario:'storage-error',destination:'game'});
 await visit('error');await page.waitForFunction(()=>document.body.textContent.includes('Ton résumé est indisponible'));await assertNoOverflow('Error');await clickText('Réessayer');await page.waitForSelector('[data-placard-next-action]');
 await visit('starter','view=treasury&pole=management');await view('market');assert.equal(new URL(page.url()).searchParams.get('section'),'management');
 await visit('starter','view=market&section=dashboard');await view('market');await clickText('Acheter un ordinateur');await view('workshop');assert.equal(await page.$eval('[data-equipment]',element=>element.textContent),'COMPUTER');await page.goBack();await view('market');assert.equal(new URL(page.url()).searchParams.get('section'),'dashboard');
 width=1440;await page.setViewport({width,height:1000,isMobile:false,hasTouch:false,deviceScaleFactor:1});
 await visit('starter','view=market&section=dashboard');await view('market');await navTo('shop');
 assert.equal(new URL(page.url()).searchParams.get('from'),'market');assert.equal(new URL(page.url()).searchParams.get('fromSection'),'dashboard','The sidebar shop preserves the current Commerce sub-section');
 assert.equal(await page.$eval('[data-catalog]',element=>element.textContent),'Packs','The sidebar enters the general shop');
 await clickText('Quitter la boutique');await view('market');assert.equal(new URL(page.url()).searchParams.get('section'),'dashboard');assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'dashboard');
 results.push({scenario:'sidebar-shop-return',destination:'market',section:'dashboard'});
 for(const [query,expected] of [['view=market','overview'],['view=market&section=overview','overview'],['view=market&section=sales','sales'],['view=market&section=demands','demands'],['view=market&section=demands&flower=fixture-flower','demands'],['view=market&flower=fixture-flower','sales']]) {
  await visit('starter',query);await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),expected);
  await clickText('Acheter un ordinateur');await view('workshop');assert.equal(await page.$eval('[data-catalog]',element=>element.textContent),'Matériel');await page.goBack();await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),expected,'Browser Back from equipment retains the chosen market section');
  results.push({scenario:'market-entry-and-return',query,section:expected});
 }
 await visit('starter','view=market');await view('market');await clickText('Vendre ma production');
 await page.waitForFunction(()=>new URLSearchParams(location.search).get('section')==='sales');
 await clickText('Demandes clients');await page.waitForFunction(()=>document.querySelector('[data-market-section]')?.textContent==='demands');
 assert.equal(new URL(page.url()).searchParams.get('section'),'demands','Client requests retain their explicit deep link');
 await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-market-section]')?.textContent==='sales');
 results.push({scenario:'market-back-navigation',section:'sales'});
 await visit('starter','view=workshop&section=storage');await view('workshop');assert.equal(await page.$eval('[data-placard-view]',element=>element.dataset.placardView),'workshop');
 await visit('starter','view=arena&flower=fixture-flower&from=workshop&fromSection=storage&fromFlower=fixture-flower');await view('arena');
 await click('button[data-placard-back="workshop"]');await view('workshop');
 assert.equal(new URL(page.url()).searchParams.get('section'),'storage','The jury returns to the warehouse storage when opened there');
 assert.equal(await page.$eval('[data-warehouse-flower]',element=>element.textContent),'fixture-flower','The warehouse return restores the jury lot');
 results.push({scenario:'jury-warehouse-return',section:'storage',flower:'fixture-flower'});
 for(const equipment of ['LED-500','COMPUTER','HASH_SIFTER']){
  await visit('starter',`view=shop&catalog=equipment&equipment=${equipment}`);await view('workshop');
  await page.waitForFunction(()=>new URLSearchParams(location.search).get('view')==='workshop');
  assert.equal(await page.$eval('[data-equipment]',element=>element.textContent),equipment);
  assert.equal(await page.$eval('[data-catalog]',element=>element.textContent),'Matériel');
  results.push({scenario:'legacy-equipment-url',equipment,destination:'workshop'});
 }
 await visit('starter','view=shop&section=buddies');await view('shop');assert.equal(await page.$eval('[data-shop-section]',element=>element.textContent),'buddies');
 await click('[data-open-shop-collection]');await page.waitForSelector(album);assert.equal(await page.$eval('[data-collection-tab=buddies]',element=>element.getAttribute('aria-selected')),'true');await click('[data-cards-tab="packs"]');
 results.push({scenario:'buddies-shop-album',initialSection:'buddies'});
 }
 assert.deepEqual(errors,[]);assert(requests.every(request=>request.method==='GET'||schoolReal&&request.path.startsWith('/api/arena/placard/school')||quarterTeam&&request.path==='/api/arena/placard/staff'),'Only isolated fixtures receive mutations');
 await writeFile(resolve(output,coast?coastReport:quarterTeam?'quarter-team-report.json':reportName),JSON.stringify({results,errors,requests},null,2));
 console.log(JSON.stringify({success:true,output,widths:results.filter(result=>result.width).map(result=>result.width),scenarios:results.filter(result=>result.scenario).length,errors:errors.length},null,2));
}catch(error){
 if(browser){const pages=await browser.pages();await pages.at(-1)?.screenshot({path:resolve(output,buildingRooms?'building-rooms-failure.png':quarterTeam?'quarter-team-failure.png':world3d?'world-3d-failure.png':motionOnly?'motion-failure.png':'failure.png'),fullPage:true}).catch(()=>{});}
 await writeFile(resolve(output,coast?coastReport:quarterTeam?'quarter-team-report.json':reportName),JSON.stringify({results,errors,requests,failure:error.stack},null,2));throw error;
}finally{if(!preview){await browser?.close();await server.close();}}
