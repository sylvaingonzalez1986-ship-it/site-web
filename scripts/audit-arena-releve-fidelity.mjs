/** Compare actual live UI against the story, using the same deterministic local data.
 * No account request is permitted. The native reference does not import a tutorial UI.
 * Run --only=culture-health --width=390 while a feature is being integrated.
 * --retry-failed preserves successful pairs and records every retried pair in the report.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)??'output/arena-releve-fidelity');
const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice(7) ?? 3293), origin = `http://127.0.0.1:${port}`;
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const requestedWidth = Number(process.argv.find(arg => arg.startsWith('--width='))?.slice(8));
const previousReport = process.argv.includes('--retry-failed') ? JSON.parse(await readFile(resolve(output, 'report.json'), 'utf8')) : null;
const previousGlobalFailure = previousReport && ['errors', 'blocked', 'consoleErrors'].some(key => previousReport[key]?.length);
const retryPairs = previousReport ? new Set(previousReport.results.filter(row => !row.passed || previousGlobalFailure).map(row => `${row.scenario}:${row.width}`)) : null;
const fixture = String.raw`
import React,{useLayoutEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import'/src/app/globals.css';
import{ArenaReleve,ArenaReleveMeeting}from'/src/components/contest/ArenaReleve';
import{KqWarehouse}from'/src/components/placard/KqWarehouse';
import{KanabQuestDicePrototype}from'/src/components/placard/KanabQuestDicePrototype';
import{KqMarketHub}from'/src/components/placard/KqMarketHub';
import{KqTreasuryDesk}from'/src/components/placard/KqTreasuryDesk';
import{KqMissionCenter}from'/src/components/placard/KqMissionCenter';
import{ChanvrierProfileEditor}from'/src/components/contest/ChanvrierProfileEditor';
import{ContestTastingBook}from'/src/components/contest/ContestTastingBook';
import{PackOpeningFlowModal}from'/src/components/account/PackOpeningFlowModal';
import{KqBotteCollection}from'/src/components/placard/KqBotteCollection';
import{KqWarehouseEntry}from'/src/components/placard/KqWarehouseEntry';
import{KqEquipmentCatalogModal}from'/src/components/placard/KqEquipmentCatalogModal';
import{KqCommerceDesk}from'/src/components/placard/KqCommerceDesk';
import{KqPlacardNavigation}from'/src/components/placard/KqPlacardNavigation';
import{createKqTutorialApi,KqTutorialApiProvider}from'/src/components/placard/KqTutorialApiContext';
import{createKqReleveProduction,createKqReleveExpansion,suggestKqRelevePlan,applyKqReleveProductionAction,getKqReleveHarvests}from'/src/lib/kanab-quest-releve-production';
import{createArenaReleveState,ARENA_RELEVE_STORAGE_KEY}from'/src/lib/arena-releve-session';
import{createReleveCommerce,createReleveCommerceBusiness,createReleveCommerceTransport}from'/src/lib/kanab-quest-releve-commerce';
import{releveMeetingStorageKey}from'/src/lib/arena-releve-meeting-session';
import{createKqTreasuryTutorial}from'/src/lib/kanab-quest-treasury-tutorial';
import{createKqReleveWorkshop,KQ_RELEVE_WORKSHOP_STORAGE_KEY}from'/src/lib/kanab-quest-releve-workshop';
import{createDiscoveryTransport,DISCOVERY_NOTEBOOK_ENTRY,DISCOVERY_TICKET,DISCOVERY_TIME}from'/src/lib/arena-playable-discovery';
import*as WarehouseTransport from'/src/lib/kanab-quest-releve-warehouse';
import{createReleveCultureTransport}from'/src/lib/kanab-quest-releve-culture';
import shell from'/src/components/placard/PlacardPlayerShell.module.css';
import retro from'/src/components/contest/ArenaRetro.module.css';

const query=new URLSearchParams(location.search),scenario=query.get('case')||'culture-health',variant=query.get('variant')||'reference';
const meeting=['expansion','workshop','business','bank','community','notebook'].find(id=>scenario===id||scenario.startsWith(id+'-'))??null;
const lesson=scenario==='bank-loans'?'bank':scenario==='bank-investments'?'investments':scenario==='community-profile'?'specialties':scenario==='community-missions'?'missions':scenario==='notebook-book'?'notebook':scenario.startsWith('notebook-collection')?'collection':null;
const step=scenario.startsWith('plan')?'plan':scenario.startsWith('buddies')?'buddies':scenario.startsWith('launch')?'launch':scenario.startsWith('culture')?'culture':scenario.startsWith('jury')?'jury':scenario;
const chapter=['arrival','plan','buddies','launch','culture','jury','delivery','shop','ledger'].indexOf(step);
const noop=()=>{};
const memory=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),clear:()=>data.clear(),key:index=>[...data.keys()][index]??null,get length(){return data.size}};};
function productionFixture(){
 if(meeting)return createKqReleveExpansion();
 let state=createKqReleveProduction();
 const act=action=>{state=applyKqReleveProductionAction(state,action);};
 if(scenario==='plan-empty')return state;
 act({type:'draft',warehouse:suggestKqRelevePlan(state)});act({type:'save-plan'});
 if(step==='plan')return state;
 for(let index=0;index<3;index++)act({type:'reveal-buddie'});
 if(step==='buddies')return state;
 act({type:'assign',zoneId:state.warehouse.zones[0].id,buddieCode:'HH2026-005'});act({type:'save-plan'});
 if(step==='launch')return state;
 act({type:'launch'});
 if(step==='culture')return state;
 for(let guard=0;guard<30&&state.game.phase!=='complete';guard++){
  if(state.game.care?.vitality<75)act({type:'assist'});
  act({type:state.game.phase==='prepare'?'roll':state.game.phase==='rolled'?'resolve':'advance'});
 }
 if(step==='jury'&&scenario!=='jury-archive')return state;
 for(const harvest of getKqReleveHarvests(state)){
  act({type:'duel',zoneId:harvest.zoneId});act({type:'verdict',zoneId:harvest.zoneId});
  for(let index=0;index<3;index++)act({type:'round',zoneId:harvest.zoneId});
 }
 return state;
}
const originalProduction=productionFixture();
const originalWorkshop=meeting==='workshop'?createKqReleveWorkshop():null;
const originalCommerce=originalWorkshop?.commerce??(meeting==='business'?createReleveCommerceBusiness():chapter>=6?createReleveCommerce({cashCents:originalProduction.cashCents,clock:originalProduction.clock,harvests:getKqReleveHarvests(originalProduction),ledger:originalProduction.ledger}):null);
const initial=createArenaReleveState();Object.assign(initial,{chapter,renovation:'renovated',production:originalProduction,commerce:originalCommerce,completed:false});
initial.checkpoint=structuredClone({chapter,renovation:'renovated',production:originalProduction,commerce:originalCommerce,completed:false});
localStorage.clear();sessionStorage.clear();localStorage.setItem(ARENA_RELEVE_STORAGE_KEY,JSON.stringify(initial));
const meetingState=meeting?{production:originalProduction,business:originalCommerce,completed:[]}:null;
if(meeting)localStorage.setItem(releveMeetingStorageKey(meeting),JSON.stringify({version:1,meeting,state:meetingState}));
if(originalWorkshop)localStorage.setItem(KQ_RELEVE_WORKSHOP_STORAGE_KEY,JSON.stringify(originalWorkshop));
window.__fidelity={scenario,variant,requests:[],initial:structuredClone(originalWorkshop??meetingState??initial),mounted:false};

function NativeCollection({api}){
 const[opened,setOpened]=useState(false),[album,setAlbum]=useState(false);
 return album?<KqBotteCollection initialSection="buddies" onClose={noop}/>:<PackOpeningFlowModal inline ticket={DISCOVERY_TICKET} onOpen={async()=>{const response=await api.request('/api/releve/collection/open',{method:'POST'});const result=await response.json();setOpened(true);api.notify('kq:collection-updated');return result;}} onClose={()=>{if(opened){void api.request('/api/releve/collection/continue',{method:'POST'});setAlbum(true);}}}/>;
}

function NativeReference(){
 const[currentProduction,setProduction]=useState(originalProduction),[currentCommerce,setCommerce]=useState(originalCommerce);
 const production=useRef(currentProduction),commerce=useRef(currentCommerce);
 useLayoutEffect(()=>{production.current=currentProduction;commerce.current=currentCommerce;},[currentProduction,currentCommerce]);
 const[section,setSection]=useState(step==='shop'||meeting==='business'?'management':'overview');
 const isolatedStorage=useMemo(()=>({persistent:memory(),session:memory()}),[]);
 const api=useMemo(()=>{
  const options={getState:()=>production.current,setState:next=>{production.current=next;setProduction(next);}};
  const factory=WarehouseTransport.createReleveWarehouseTransport??WarehouseTransport.createKqReleveWarehouseTransport;
  const request=meeting==='bank'?createKqTreasuryTutorial().request:lesson?createDiscoveryTransport(lesson,noop).request:meeting==='business'||meeting==='workshop'?createReleveCommerceTransport({getState:()=>commerce.current,setState:next=>{commerce.current=next;setCommerce(next);}}):chapter<=2?factory(options):chapter<=5?createReleveCultureTransport(options):createReleveCommerceTransport({getState:()=>commerce.current,setState:next=>{commerce.current=next;setCommerce(next);}});
  return createKqTutorialApi(async(input,init)=>{const path=typeof input==='string'?input:input instanceof URL?input.pathname:input.url;window.__fidelity.requests.push({path,method:init?.method??'GET'});return request(input,init);});
 },[]);
 const active=chapter<=2?'workshop':chapter<=4?'game':chapter===5?'harvests':chapter===8?'treasury':'market';
 const title=chapter<=2?'L’entrepôt':chapter<=4?'Ma culture':chapter===5?'Jury & duels':chapter===8?'Mes finances':'Mon commerce';
 // The real Carnet route renders outside the game's shell and numeric font rules.
 return <KqTutorialApiProvider api={api}><div className={lesson==='notebook'?undefined:retro.surface+' '+shell.shell} data-fidelity-native-reference>
  <KqPlacardNavigation active={active} onNavigate={noop} onHighlight={noop} localNavigation/>
  <div className={shell.content}><header className={shell.sectionHeader}><button type="button">Quartier</button><h1>{title}</h1></header>
   {meeting==='workshop'?(scenario==='workshop-catalog'?<KqEquipmentCatalogModal embedded workshopOnly initialEquipmentCode="SIFT-TRAY" onClose={noop} onOpenWorkshop={noop}/>:scenario==='workshop-counter'?<KqCommerceDesk mode="sales" initialFlowerId="releve-workshop" onOpenShop={noop} onOpenBusiness={noop} onOpenStorage={noop} onOpenTreasury={noop} onOpenCulture={noop}/>:<KqWarehouseEntry embedded workshopOnly initialEquipmentCode="SIFT-TRAY" onClose={noop} onOpenShop={noop}/>):meeting==='bank'?<KqTreasuryDesk initialPole="bank" initialBankDesk={lesson==='investments'?'stocks':'loans'} onOpenShop={noop}/>:lesson==='specialties'?<ChanvrierProfileEditor profile={null} onClose={noop} onSaved={noop}/>:lesson==='missions'?<KqMissionCenter onOpen={noop}/>:lesson==='notebook'?<ContestTastingBook entries={[DISCOVERY_NOTEBOOK_ENTRY]} unlocks={[{entryId:DISCOVERY_NOTEBOOK_ENTRY.id,unlockedAt:DISCOVERY_TIME,source:'purchase'}]} viewerProfile={{pseudo:'Apprenti',createdAt:DISCOVERY_TIME,updatedAt:DISCOVERY_TIME}} badges={[]} isAuthenticated seasonLabel="Carnet d’entraînement · notes fictives" initialTrack="regular" initialCategory="indoor" initialEntryId={DISCOVERY_NOTEBOOK_ENTRY.id} onExitTutorial={noop}/>:lesson==='collection'?<NativeCollection api={api}/>:meeting==='business'?<KqMarketHub section={section} onSectionChange={setSection} onOpenShop={noop} onOpenTreasury={noop} onOpenStorage={noop} onOpenCulture={noop}/>:chapter<=2?<KqWarehouse embedded onClose={noop}/>:chapter<=5?<KanabQuestDicePrototype apiScope="player" showAdminOperations={false} showWarehouseNavigation={false} viewMode={chapter===5?'arena':'game'} initialCampaign initialPreparation={{deckCodes:currentProduction.deckCodes,heritageCode:currentProduction.heritageCode}} isolatedStorage={isolatedStorage} onOpenWarehouse={noop} onOpenArena={noop} onOpenGame={noop} onOpenMarket={noop} onOpenRun={noop}/>:chapter===8?<KqTreasuryDesk initialPole="accounting" onOpenShop={noop}/>:<KqMarketHub section={section} onSectionChange={setSection} onOpenShop={noop} onOpenTreasury={noop} onOpenStorage={noop} onOpenCulture={noop}/>}
  </div>
 </div></KqTutorialApiProvider>;
}
function App(){useLayoutEffect(()=>{window.__fidelity.mounted=true;},[]);return variant==='reference'?<NativeReference/>:scenario==='notebook-book'?<ContestTastingBook entries={[]} unlocks={[]} viewerProfile={null} badges={[]} isAuthenticated={false} seasonLabel="Le Carnet" initialTrack="regular" initialCategory="indoor"/>:meeting?<ArenaReleveMeeting meeting={meeting} onClose={noop}/>:<ArenaReleve onClose={noop}/>;}
createRoot(document.getElementById('root')).render(<App/>);
`;

const modules = {
  'warehouse-manifest': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')}`,
  fixture,
  'next/dynamic': `import React from'react';export default function dynamic(load,options={}){const C=React.lazy(async()=>{const m=await load();return{default:m.default||m}});return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(C,props))}}`,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/navigation': `export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
// The same font files and variables as src/app/layout.tsx, without Next's server layout.
const auditStyle=`
@font-face{font-family:GameBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2) format('woff2');font-weight:400 700;font-style:normal}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Bold.woff2) format('woff2');font-weight:700;font-style:normal}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2) format('woff2');font-weight:800;font-style:normal}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2) format('woff2');font-weight:900;font-style:normal}
@font-face{font-family:GameHandwritten;src:url(/src/app/fonts/Caveat-Latin-Bold.woff2) format('woff2');font-weight:700;font-style:normal}
:root{--font-body:GameBody;--font-display:GameDisplay;--font-handwritten:GameHandwritten}
body{margin:0;background:#fff1d6;font-family:var(--font-body),sans-serif}button{font-family:inherit}
`;
const server = await createServer({
  configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},
  resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'releve-fidelity',enforce:'pre',resolveId(id){if(id.endsWith('warehouse-v2/manifest.json'))return'\0warehouse-manifest';if(id in modules)return'\0'+id;},load(id){if(id==='\0fixture')return{code:modules.fixture,map:null};if(id.startsWith('\0'))return modules[id.slice(1)];},transform(code,id){if(id==='\0fixture')return transformWithOxc(code,'fidelity-fixture.tsx',{jsx:{runtime:'automatic'}});},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+auditStyle+'</style><div id="root"></div><script type="module" src="/@id/__x00__fixture"></script></html>');});}}],
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null},
});

// All regions are selected from the real component's own stable markup.
const scenarios = [
  {id:'plan-empty',region:'[data-warehouse-plan]',ready:'[data-warehouse-action="draw"]'},
  {id:'plan-installed',region:'[data-warehouse-plan]',ready:'[data-warehouse-map] [data-zone-id]'},
  {id:'plan-equipment',region:'[data-warehouse-zone-dialog]',ready:'[data-warehouse-map] [data-zone-id]',actions:['configure']},
  {id:'buddies',region:'[data-warehouse-plan]',ready:'[data-warehouse-map] [data-zone-id]'},
  {id:'buddies-dock',region:'[data-warehouse-buddie-dock]',ready:'[data-warehouse-map] [data-zone-id]',actions:['buddies']},
  {id:'buddies-profile',region:'[data-buddie-variety-popover]',ready:'[data-warehouse-map] [data-zone-id]',actions:['buddies','buddie-profile']},
  {id:'launch',region:'[data-culture-setup-choices]',ready:'[data-culture-setup-choices]'},
  {id:'launch-deck',region:'[data-setup-choice="cards"]',ready:'[data-culture-setup-choices]',actions:['deck']},
  {id:'launch-heritage',region:'[data-setup-choice="heritage"]',ready:'[data-culture-setup-choices]',actions:['heritage']},
  {id:'culture',region:'[data-culture-play]',ready:'[data-culture-care]'},
  {id:'culture-health',region:'[data-culture-care]',ready:'[data-culture-care]',actions:['health']},
  {id:'culture-reserve',region:'[aria-label="Intrants et protection biologique"]',ready:'[data-culture-care]',actions:['health','reserve']},
  {id:'jury',region:'[data-view-mode="arena"]',ready:'[data-view-mode="arena"]'},
  {id:'jury-confirmation',region:'dialog:has([data-culture-confirm-training]):not(:has(dialog))',ready:'[data-culture-training-flower]',actions:['training']},
  {id:'jury-verdict',region:'[data-verdict-result]',ready:'[data-culture-training-flower]',actions:['training','verdict']},
  {id:'jury-archive',region:'[data-archived-jury-recap]',ready:'[data-archived-jury-recap]',actions:['archive']},
  {id:'delivery',region:'div:has(>div>div>[aria-label="Ma boutique"])',ready:'div:has(>div>div>[aria-label="Ma boutique"])'},
  {id:'shop',region:'div:has(>div>div>[aria-label="Ma boutique"])',ready:'div:has(>div>div>[aria-label="Ma boutique"])'},
  {id:'ledger',region:'main:has(>nav[aria-label="Mes finances"])',ready:'[aria-label="Mes finances"]'},
  {id:'expansion',region:'[data-warehouse-v4]',ready:'[data-warehouse-v4]'},
  {id:'business',region:'div:has(>div>div>[aria-label="Ma boutique"])',ready:'div:has(>div>div>[aria-label="Ma boutique"])'},
  {id:'workshop-machines',region:'[data-workshop-only][data-page]',ready:'[data-workshop-inventory-artwork]'},
  {id:'workshop-catalog',region:'[data-arena-tour-surface="catalog"]',ready:'[data-arena-tour-surface="catalog"]',tutorialBefore:['workshop-catalog']},
  {id:'workshop-counter',region:'main[data-screen]',ready:'main[data-screen]',tutorialBefore:['workshop-counter']},
  {id:'bank-loans',lesson:'bank',region:'main:has(>nav[aria-label="Mes finances"])',ready:'[aria-label="Mes finances"]'},
  {id:'bank-investments',lesson:'investments',region:'main:has(>nav[aria-label="Mes finances"])',ready:'[aria-label="Mes finances"]'},
  {id:'community-profile',lesson:'specialties',region:'[data-chanvrier-profile]',ready:'[data-chanvrier-profile]'},
  {id:'community-missions',lesson:'missions',region:'main:has(>nav[aria-label="Parcours des missions"])',ready:'[aria-label="Parcours des missions"]'},
  {id:'notebook-book',lesson:'notebook',region:'[data-tasting-book][data-open]',ready:'[data-tasting-book][data-open]'},
  {id:'notebook-collection-pack',lesson:'collection',region:'[aria-label="Ouverture du booster"]',ready:'[aria-label="Ouverture du booster"]'},
  {id:'notebook-collection-album',lesson:'collection',region:'[data-placard-collections]',ready:'[aria-label="Ouverture du booster"]',actions:['collect-pack']},
].filter(item=>!only||item.id===only||only.endsWith('*')&&item.id.startsWith(only.slice(0,-1)));
const cssProperties=['display','position','color','backgroundColor','backgroundImage','fontFamily','fontSize','fontWeight','fontVariantNumeric','fontFeatureSettings','fontKerning','lineHeight','letterSpacing','textAlign','textTransform','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderTopColor','borderTopStyle','borderRadius','boxShadow','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft','gap','rowGap','columnGap','gridTemplateColumns','flexDirection','alignItems','justifyContent','objectFit','opacity'];
let browser,page;
const results=previousReport?.results??[],errors=[],blocked=[],consoleErrors=[],attempted=[];
const coverage={
 arrival:{status:'narrative',reason:'Original illustrated story and renovation; no live equivalent.'},
 plan:{status:'planned',components:['KqWarehouse','KqWarehousePlan','KqWarehouse zone dialog']},
 buddies:{status:'planned',components:['KqWarehouseBuddieDock','BuddieCard','KqBuddieVarietyPopover'],limits:'The pack widget is paired in the notebook meeting; first-story pack data is checked by the journey audit.'},
 launch:{status:'planned',components:['KanabQuestDicePrototype player setup','KqInventoryCarousel','KqCulturePreparation']},
 culture:{status:'planned',components:['KanabQuestDicePrototype player game','KqCultureCarePanel','KqCareShop']},
 jury:{status:'planned',components:['KanabQuestDicePrototype player reserve','KqBattleVerdictDialog','KqBattleHistory']},
 delivery:{status:'planned',components:['KqMarketHub','KqCommerceDesk'],limits:'Transactions and receipts are additionally exercised by audit-arena-releve-native-lessons.mjs.'},
 shop:{status:'planned',components:['KqMarketHub','KqTreasuryManagement']},
 ledger:{status:'planned',components:['KqTreasuryDesk']},
 expansion:{status:'planned',components:['KqWarehouse']},
 workshop:{status:'planned',components:['KqWarehouseEntry workshopOnly','KqEquipmentCatalogModal','KqCommerceDesk']},
 business:{status:'planned',components:['KqMarketHub','KqTreasuryManagement']},
 bank:{status:'planned',components:['KqTreasuryDesk','KqTreasuryBank loans and stocks']},
 community:{status:'planned',components:['ChanvrierProfileEditor','KqMissionCenter']},
 notebook:{status:'planned',components:['ContestTastingBook','PackOpeningFlowModal','KqBotteCollection','KqBuddiesCollection']},
};
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function click(selector){const element=await page.waitForSelector(selector,{visible:true});assert(element,selector);await element.scrollIntoView();await settle();await element.click();await element.dispose();}
async function clickText(text){
 await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim().includes(text)&&!button.disabled&&button.getClientRects().length),{},text);
 const buttons=await page.$$('button');
 try{for(const button of buttons)if(await button.evaluate((button,text)=>button.textContent.trim().includes(text)&&!button.disabled&&button.getClientRects().length,text)){await button.scrollIntoView();await settle();await button.click();return;}}finally{await Promise.all(buttons.map(button=>button.dispose()));}
 throw new Error('Native button not found: '+text);
}
async function perform(action){
 if(action==='training')return click('[data-culture-training-flower]');
 if(action==='verdict')return click('[data-culture-confirm-training]');
 if(action==='archive')return click('[data-archived-jury-recap] > summary');
 if(action==='buddies'){
  await page.$eval('[aria-label="Mode du plan"] button:nth-child(2)',button=>button.click());
  await page.waitForSelector('[data-warehouse-buddie-toggle]');
  await page.$eval('[data-warehouse-buddie-toggle]',button=>{if(button.getAttribute('aria-expanded')!=='true')button.click();});
  return page.waitForSelector('[data-warehouse-buddie-dock][data-open="true"]',{visible:true});
 }
 if(action==='buddie-profile')return click('[data-warehouse-buddie-card="HH2026-005"]');
 if(action==='collect-pack'){
  await clickText('Ouvrir le pack');await page.waitForSelector('[data-pack-phase="cards"]',{visible:true});
  await clickText('Tout révéler');await page.waitForSelector('[data-pack-phase="recap"]',{visible:true});
  return clickText('Ranger dans mon album');
 }
 if(action==='workshop-counter')return click('[data-releve-guide="workshop-counter"]');
 if(action==='workshop-catalog'){
  await page.waitForSelector('[data-workshop-inventory-artwork]',{visible:true});
  return page.evaluate(()=>{const button=[...document.querySelectorAll('[data-workshop-only] button')].find(button=>button.textContent.includes('atelier commun'));if(!button)throw new Error('Native workshop purchase button not found');button.click();});
 }
 if(action==='configure')return click('[data-warehouse-plan] [data-warehouse-action="configure"]');
 if(action==='deck')return click('[data-setup-choice="cards"] > summary');
 if(action==='heritage')return click('[data-setup-choice="heritage"] > summary');
 if(action==='health'){
  const open=await page.$eval('[data-culture-care]',element=>element.getAttribute('data-expanded')==='true');
  if(!open)await click('[data-care-toggle]');return;
 }
 if(action==='reserve')return click('[data-care-reserve-toggle]');
 throw new Error(`Unknown setup action ${action}`);
}
async function capture(scenario,variant,width){
 const beforeErrors=errors.length;
 await page.goto(`${origin}/?case=${scenario.id}&variant=${variant}`,{waitUntil:'networkidle0'});
 if(variant==='tutorial')await page.evaluate(()=>document.querySelector('[data-releve-guide-card] button[aria-label="Explorer librement"]')?.click());
 if(variant==='tutorial'&&scenario.lesson)await click(scenario.lesson==='notebook'?'[data-notebook-help]':'[data-releve-open-lesson="'+scenario.lesson+'"]');
 if(variant==='tutorial')for(const action of scenario.tutorialBefore??[])await perform(action);
 await page.waitForSelector(scenario.ready,{visible:true});
 if(variant==='tutorial')await page.evaluate(()=>document.querySelector('[data-releve-guide-card] button[aria-label="Explorer librement"]')?.click());
 for(const action of scenario.actions??[])await perform(action);
 await page.waitForSelector(scenario.region,{visible:true});
 await page.$eval(scenario.region,root=>root.querySelectorAll('img').forEach(image=>{image.loading='eager';}));
 await page.waitForFunction(selector=>[...document.querySelectorAll(selector+' img')].every(image=>!image.getClientRects().length||image.complete&&image.naturalWidth>0),{},scenario.region);
 await page.evaluate(async()=>{await document.fonts.ready;if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});await page.mouse.move(0,0);
 await settle();
 const item=await page.$(scenario.region);assert(item,scenario.region);
 await item.evaluate(root=>{for(const element of [root,...root.querySelectorAll('*')])if(element instanceof HTMLElement&&(element.scrollTop||element.scrollLeft))element.scrollTo({top:0,left:0,behavior:'instant'});});
 await item.scrollIntoView();await settle();
 await page.screenshot({path:resolve(output,`${scenario.id}-${variant}-${width}-viewport.png`)});
 await item.evaluate(root=>{
  const outside=[];let child=root;
  for(let parent=child.parentElement;parent;child=parent,parent=parent.parentElement)for(const sibling of parent.children)if(sibling!==child&&sibling instanceof HTMLElement){outside.push([sibling,sibling.style.visibility]);sibling.style.visibility='hidden';}
  for(const guide of root.querySelectorAll('[data-releve-guide-card],[data-playable-coach],[data-releve-floating-guide]')){outside.push([guide,guide.style.visibility]);guide.style.visibility='hidden';}
  window.__fidelityRestoreVisibility=()=>outside.forEach(([element,visibility])=>{element.style.visibility=visibility;});
 });
 // Keep anchored popovers in place: a second automatic scroll can move their anchor.
 // Capture only the visible slice; the structured snapshot below still covers the full region.
 await item.screenshot({path:resolve(output,`${scenario.id}-${variant}-${width}-region.png`),scrollIntoView:false,captureBeyondViewport:false});
 await page.evaluate(()=>{window.__fidelityRestoreVisibility?.();delete window.__fidelityRestoreVisibility;});
 const snapshot=await item.evaluate((root,properties)=>{
  const normalize=value=>value?.replace(/\s+/g,' ').trim()??'';
  const box=root.getBoundingClientRect(),nodes=[];
  function visit(element,path){
   if(element.closest('[data-releve-guide-card],[data-releve-spotlight],[data-playable-coach],[data-releve-floating-guide]')||element!==root&&element.matches('div:has(>[data-releve-guide-card])')||!element.getClientRects().length)return;
   const closedDetails=element.parentElement?.closest('details:not([open])');if(closedDetails&&!closedDetails.querySelector(':scope > summary')?.contains(element))return;
   const style=getComputedStyle(element);if(style.visibility==='hidden'||style.display==='none')return;
   const rect=element.getBoundingClientRect();
   const visuallyHidden=style.position==='absolute'&&rect.width<=1&&rect.height<=1&&(style.clip!=='auto'||style.clipPath!=='none'||style.overflow==='hidden');
   let fixed=false;for(let ancestor=element;ancestor&&ancestor!==root;ancestor=ancestor.parentElement)if(getComputedStyle(ancestor).position==='fixed'){fixed=true;break;}
   nodes.push({path,tag:element.tagName,text:normalize([...element.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join(' ')),role:element.getAttribute('role'),label:element.getAttribute('aria-label'),type:element.getAttribute('type'),disabled:element.matches(':disabled'),value:element.matches('input,select,textarea')?element.value:null,image:element instanceof HTMLImageElement?new URL(element.currentSrc||element.src,location.href).pathname:null,visuallyHidden,coordinateSystem:fixed?'viewport':'region',css:Object.fromEntries(properties.map(property=>[property,style[property]])),rect:visuallyHidden?null:{x:Math.round((rect.x-(fixed?0:box.x))*10)/10,y:Math.round((rect.y-(fixed?0:box.y))*10)/10,width:Math.round(rect.width*10)/10,height:Math.round(rect.height*10)/10}});
   [...element.children].forEach((child,index)=>visit(child,path+'.'+index));
  }visit(root,'0');return{nodes,root:{width:box.width,height:box.height},horizontalOverflow:root.scrollWidth>root.clientWidth+1};
 },cssProperties);
 await item.dispose();
 assert.equal(errors.length,beforeErrors,'No runtime error while opening '+scenario.id+' '+variant);
 const fixture=await page.evaluate(()=>window.__fidelity);
 await writeFile(resolve(output,`${scenario.id}-${variant}-${width}.json`),JSON.stringify({snapshot,fixture},null,2));
 return{snapshot,fixture};
}
function compare(reference,tutorial){
 const differences=[],a=reference.snapshot,b=tutorial.snapshot;
 assert.deepEqual(reference.fixture.initial,tutorial.fixture.initial,'The two screens must receive exactly the same initial save.');
 if(a.nodes.length!==b.nodes.length)differences.push({kind:'structure',nativeNodes:a.nodes.length,tutorialNodes:b.nodes.length});
 for(let index=0;index<Math.min(a.nodes.length,b.nodes.length);index++){
  const left=a.nodes[index],right=b.nodes[index];
  for(const key of ['path','tag','text','role','label','type','disabled','value','image','visuallyHidden'])if(left[key]!==right[key])differences.push({kind:'dom',path:left.path,property:key,native:left[key],tutorial:right[key]});
  if(left.path!==right.path||left.tag!==right.tag)continue;
  for(const property of cssProperties)if(left.css[property]!==right.css[property])differences.push({kind:'style',path:left.path,tag:left.tag,property,native:left.css[property],tutorial:right.css[property]});
  if(left.rect&&right.rect)for(const property of ['x','y','width','height'])if(Math.abs(left.rect[property]-right.rect[property])>1.5)differences.push({kind:'geometry',path:left.path,tag:left.tag,property,native:left.rect[property],tutorial:right.rect[property]});
 }
 return{passed:differences.length===0,nativeNodes:a.nodes.length,tutorialNodes:b.nodes.length,nativeSize:a.root,tutorialSize:b.root,differences};
}
const report=()=>{
 const measured=Object.fromEntries(Object.entries(coverage).map(([key,value])=>{
  const pairs=results.filter(row=>row.scenario===key||row.scenario.startsWith(key+'-'));
  return[key,{...value,status:pairs.length?pairs.every(row=>row.passed)?'passed':'differences':value.status==='planned'?'not-run':value.status,pairs:pairs.map(row=>({scenario:row.scenario,width:row.width,passed:row.passed}))}];
 }));
 return writeFile(resolve(output,'report.json'),JSON.stringify({passed:results.length>0&&results.every(row=>row.passed)&&(!retryPairs||[...retryPairs].every(pair=>attempted.includes(pair)))&&errors.length===0&&blocked.length===0&&consoleErrors.length===0,method:'Separate native player components under PlacardPlayerShell styles and full ArenaReleve/ArenaReleveMeeting, identical deterministic local fixtures and layout.tsx font files. Compare DOM, computed styles and geometry within the business region; fixed child controls use viewport coordinates. Coach and outer HUD excluded. Normalize focus and internal scroll offsets; preserve all widths, heights and typography. Narrative arrival has no live counterpart. PNGs are supporting evidence and may be clipped by native scroll containers; no pixel-hash assertion. No account network request or screenshot-only pass.',rerun:previousReport?{previousFailures:[...retryPairs],attempted,previousErrors:previousReport.errors,previousBlocked:previousReport.blocked,previousConsoleErrors:previousReport.consoleErrors}:undefined,coverage:measured,results,errors,blocked,consoleErrors},null,2));
};
function recordResult(result){const index=results.findIndex(row=>row.scenario===result.scenario&&row.width===result.width);if(index<0)results.push(result);else results[index]=result;}
try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
 await page.evaluateOnNewDocument(()=>{
  const RealDate=Date,epoch=Date.parse('2026-10-17T10:00:00.000Z');
  window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[epoch]));}static now(){return epoch;}};
 });
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{blocked.push(request.url());void request.abort();}});
 for(const width of requestedWidth?[requestedWidth]:[390,1440]){
  await page.setViewport({width,height:960,deviceScaleFactor:1});
  for(const scenario of scenarios){
   if(retryPairs&&!retryPairs.has(`${scenario.id}:${width}`))continue;
   attempted.push(`${scenario.id}:${width}`);
   try{const reference=await capture(scenario,'reference',width),tutorial=await capture(scenario,'tutorial',width);const result={scenario:scenario.id,width,...compare(reference,tutorial)};recordResult(result);console.log(`${result.passed?'PASS':'DIFF'} ${scenario.id} ${width}px: ${result.differences.length} differences`);}
   catch(error){recordResult({scenario:scenario.id,width,passed:false,error:String(error.stack??error)});console.error(`FAIL ${scenario.id} ${width}px: ${error.message}`);await page.screenshot({path:resolve(output,`${scenario.id}-${width}-failure.png`)}).catch(()=>{});}
   await report();
  }
 }
 assert(results.length>0,'No scenario matched --only');assert(!retryPairs||[...retryPairs].every(pair=>attempted.includes(pair)),'Some requested retries were excluded by --only or --width.');assert(results.every(row=>row.passed),'Native parity differences found; inspect report.json and paired captures.');assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.deepEqual(consoleErrors,[]);
 console.log(JSON.stringify({passed:true,pairs:results.length,output}));
}catch(error){process.exitCode=1;console.error(error.message);}finally{await report();await browser?.close();await server.close();}
