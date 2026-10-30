import { ARENA_JOURNEY_STEPS } from "./arena-journey";
import { activateKqHeritage, advanceKqStage, canActivateKqHeritage, canPlayKqCard, getKqHandCodes, getKqZeroSuccessStageCount, isKqCultureDead, KQ_BUDDIES, KQ_CARDS, playKqCard, redrawKqHand, resolveKqStage, rollKqDice, startKqGame, type KqGameState } from './kanab-quest-game';
import { createKqFlower, createKqOpponent, lockKqBattle, resolveKqBattle, type KqBattle } from './kanab-quest-battle';
import { getKqEquipmentDefinition } from './kanab-quest-equipment';
import { type KqEnergyMode } from './kanab-quest-energy';
import { getKqJuryScoreFromRounds, quoteKqMarketRoutes, type KqMarketRouteCode } from './kanab-quest-market';
import { KQ_COMPUTER_PRICE_CENTS, getKqCommerceCapacity, getKqShopBudget, quoteKqCommerce, type KqCommerceOffer, type KqCommerceState, type KqCommerceStock, type KqOnlinePrice, type KqSalesChannel } from './kanab-quest-commerce';
import { createKqBusinessPreview, KQ_GAME_DAY_MS, KQ_GAME_MONTH_MS, KQ_LAB_ANALYSIS_CENTS, KQ_SHOP_CREATION_CENTS, KQ_SHOP_MONTHLY_CENTS, previewKqBusinessPayment } from './kanab-quest-business';
import { createKqStorageLot, KQ_CURING_DURATION_MS, planKqStorageAllocation, projectKqStorageLot } from './kanab-quest-storage';

export const KQ_TRIAL_VERSION = 3;
export const KQ_TRIAL_CHAPTERS = ARENA_JOURNEY_STEPS.map(step=>step.title);
export const KQ_TRIAL_BUDDIE = { ...KQ_BUDDIES.find(b => b.rarity === 'gold')!, name: 'Buddie d’essai' };
const LEGACY_TRIAL_DECK = ['BOTTE-005', 'BOTTE-024', 'BOTTE-004', 'BOTTE-003', 'BOTTE-006', 'BOTTE-015', 'BOTTE-032', 'BOTTE-016', 'BOTTE-030'];
export const KQ_TRIAL_DECK = LEGACY_TRIAL_DECK.map(code => code === 'BOTTE-004' ? 'BOTTE-020' : code);
export const KQ_TRIAL_EQUIPMENT = ['TENT-080-STARTER', 'AIR-STARTER', 'LED-300', 'DRYING-ROOM', 'SIFT-TRAY'];
const TIME = Date.parse('2026-09-16T12:00:00Z');
const TRIAL_RESCUE_NOTICE = 'Essai guidé : un dé passe à 4 pour éviter la mort et poursuivre jusqu’à la récolte fictive.';
export const KQ_TUTORIAL_CARE_RESCUE_NOTICE = 'Essai assisté : la vitalité est rétablie à 100 avant validation pour poursuivre jusqu’à la récolte fictive. Les dés, les problèmes et les pertes déjà subies sont conservés.';
export const KQ_TUTORIAL_STORAGE_NOTICE = 'Affinage simulé : cet essai prête les bocaux et termine les six heures d’affinage avant le jury. Dans ta vraie partie, l’affinage dure six heures réelles dès la récolte.';
const HANDS = [
 ['BOTTE-005','BOTTE-024','BOTTE-006','BOTTE-003','BOTTE-004'],
 ['BOTTE-024','BOTTE-006','BOTTE-003','BOTTE-004','BOTTE-015'],
 ['BOTTE-004','BOTTE-006','BOTTE-003','BOTTE-015','BOTTE-032'],
 ['BOTTE-015','BOTTE-003','BOTTE-006','BOTTE-032','BOTTE-016'],
 ['BOTTE-032','BOTTE-006','BOTTE-003','BOTTE-016','BOTTE-030'],
 ['BOTTE-016','BOTTE-030','BOTTE-003','BOTTE-006'],
];
export type KqTrialState = {
 rulesVersion: 2 | 3;
 chapter: number; checked: string[]; bought: boolean; installed: string[]; mode: KqEnergyMode;
 game: KqGameState | null; battle: KqBattle | null; rounds: number; clock: number;
 curingBeforeJury?: boolean;
 commerce: KqCommerceState; electricity: number; receipts: Array<KqCommerceOffer & { net: number; electricity: number }>;
};
export type KqTrialAction =
 | { type: 'next' } | { type: 'check'; value: string } | { type: 'buy' } | { type: 'install'; code: string }
 | { type: 'mode'; mode: KqEnergyMode } | { type: 'play'; code: string } | { type: 'roll' } | { type: 'heritage' }
 | { type: 'redraw' } | { type: 'resolve' } | { type: 'advance' } | { type: 'restart-culture' } | { type: 'duel' } | { type: 'round' }
 | { type: 'transform'; route: KqMarketRouteCode } | { type: 'computer' } | { type: 'internet' } | { type: 'wait' }
 | { type: 'sell'; stockId: string; channel: KqSalesChannel; policy: KqOnlinePrice };
export function createKqTrial(rulesVersion: 2 | 3 = 3): KqTrialState {
 return { rulesVersion, chapter: 0, checked: [], bought: false, installed: [], mode: 'balanced', game: null, battle: null, rounds: 0, clock: TIME, electricity: 0, receipts: [],
 commerce: { business: createKqBusinessPreview(TIME), revision: 0, cashCents: 200000, reputation: 200, clients: 8, shopPartners: 2, computerOwned: false, internetRenew: false, campaign: null, stocks: [], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {} } };
}
function teachingHand(game: KqGameState): KqGameState {
 const preferred = HANDS[game.stageIndex].map(code => game.rulesVersion === 3 && code === 'BOTTE-004' ? 'BOTTE-020' : code);
 const priority = (code: string) => preferred.includes(code) ? preferred.indexOf(code) : preferred.length;
 // Keep the lesson's useful cards first, with the same real draw limit and
 // remaining physical copies as the game. The trial lends only nine cards.
 return { ...game, handCodes: getKqHandCodes({ ...game, handCodes: undefined }).sort((left, right) => priority(left) - priority(right)) };
}
// Keep this assistance entirely inside the fictitious tutorial. Display the
// prepared dice before validation so the ordinary engine still awards exactly
// what the player sees. Official runs never receive adjusted dice here.
export function assistKqTutorialCare(game: KqGameState): KqGameState {
 if (game.rulesVersion !== 3 || game.phase !== 'rolled' || !game.dice || !game.care || !isKqCultureDead(resolveKqStage(game))) return game;
 return { ...game, care: { ...game.care, vitality: 100 }, effectNotices: [...(game.effectNotices ?? []), KQ_TUTORIAL_CARE_RESCUE_NOTICE].slice(-12) };
}
function teachingRescue(game: KqGameState): KqGameState {
 if (game.rulesVersion === 3) return assistKqTutorialCare(game);
 if (game.phase !== 'rolled' || !game.dice || getKqZeroSuccessStageCount(game) < 1 || game.dice.some(die => die >= 4)) return game;
 const dice = [...game.dice] as [number, number, number];
 dice[dice.indexOf(Math.max(...dice))] = 4;
 return {...game,dice,effectNotices:[...(game.effectNotices??[]),TRIAL_RESCUE_NOTICE].slice(-12)};
}
export function startKqTrialCulture(mode: KqEnergyMode = 'balanced', seed = 2, rulesVersion: 2 | 3 = 3) {
 const deckCodes = rulesVersion === 3 ? KQ_TRIAL_DECK : LEGACY_TRIAL_DECK;
 const game = startKqGame(seed, { rulesVersion, varietyCode: KQ_TRIAL_BUDDIE.code, deckCodes, collectionCodes: rulesVersion === 3 ? deckCodes : [...deckCodes,'BOTTE-002'], heritageCode: 'HERITAGE-007', equipmentCodes: KQ_TRIAL_EQUIPMENT, energyMode: mode, startedAt: new Date(TIME).toISOString() });
 return teachingHand({ ...game, varietyName: KQ_TRIAL_BUDDIE.name, situationCodes: ['SIT-016','SIT-020','SIT-003','SIT-004','SIT-005','SIT-006'] });
}
export function trialInstruction(state: KqTrialState) {
 const g = state.game;
 if (!g || state.chapter !== 4) return '';
 if (g.rulesVersion === 3 && isKqCultureDead(g)) return 'La vitalité a atteint 0 : la culture est terminée sans récolte. Recommence l’essai pour poursuivre le tutoriel.';
 if (isKqCultureDead(g)) return 'Ta culture est morte : deux étapes ont fini à 0 réussite, même sans se suivre. Recommence la culture d’essai pour poursuivre le tutoriel.';
 if (g.phase === 'prepare' && g.stageIndex === 0 && !g.preparationPlayed) return 'Joue Arrosage mesuré : une préparation se joue avant les dés et coûte de l’XP.';
 if (g.phase === 'prepare' && g.stageIndex === 2 && g.rulesVersion !== 3 && !g.revealedPest) return 'Joue la Loupe d’inspection pour identifier le ravageur. La réserve anti-ravageurs devient alors utilisable.';
 if (g.phase === 'prepare' && g.rulesVersion === 3) return 'Consulte gratuitement le suivi de santé : vitalité, problèmes et interventions. Les intrants et les PBI se gèrent à côté des étapes. Prépare ensuite ton opération ou lance les dés.';
 if (g.phase === 'prepare') return 'Lis la situation et ses catégories. Prépare ton lancer avec une carte adaptée, ou conserve tes cartes et lance les dés.';
 if (g.phase === 'rolled' && !g.heritageUsed && canActivateKqHeritage(g).allowed) return 'Active ton Héritage : il transforme un dé neutre en Étincelle, sans consommer de carte Botte du Chanvrier.';
 if (g.phase === 'rolled' && g.rulesVersion !== 3 && g.stageIndex === 2 && !g.reactionPlayed && canPlayKqCard(g, KQ_CARDS.find(c=>c.code==='BOTTE-002')!).allowed) return 'Le ravageur est identifié : joue la Chrysope depuis ta réserve pour corriger un dé faible.';
 if (g.phase === 'rolled') return 'Observe les dés et le résultat prévu. Tu peux jouer une réaction avant de valider. Chaque 6 rapporte 1 XP au verdict.';
 if (g.rulesVersion === 3) return 'Lis le résultat et le suivi de santé : la vitalité évolue avec les problèmes et les opérations. Une vitalité à 0 termine la culture. Floraison, Récolte et Séchage influencent aussi les terpènes. Une assistance explicite protège cette récolte fictive si nécessaire.';
 return getKqZeroSuccessStageCount(g) === 1
  ? 'Une étape a fini à 0 réussite. Une deuxième, même plus tard, tuerait une culture non secourue. Cet essai prépare un dé si nécessaire pour te laisser découvrir la récolte fictive.'
  : 'Lis le résultat : qualité, XP et pression ont évolué. Cet essai prépare un dé si nécessaire pour te laisser découvrir la récolte fictive. En jeu, deux étapes à 0 réussite non secourues font mourir la culture.';
}
export function trialCardPermission(s: KqTrialState, code: string) {
 const g=s.game, card=KQ_CARDS.find(c=>c.code===code);
 if(!g||!card)return {allowed:false,reason:'Carte indisponible.'};
 const lesson=g.stageIndex===0?'BOTTE-005':g.stageIndex===2?(g.phase==='prepare'?'BOTTE-004':'BOTTE-002'):null;
 if((g.stageIndex===0 || g.rulesVersion !== 3 && g.stageIndex<3)&&code!==lesson)return {allowed:false,reason:'Suis d’abord l’action guidée avant de choisir librement tes opérations.'};
 return canPlayKqCard(g,card);
}
export function canTrialRoll(state: KqTrialState) {
 const g=state.game;
 return !!g && g.phase==='prepare' && (g.stageIndex!==0 || g.preparationPlayed) && (g.rulesVersion===3 || g.stageIndex!==2 || !!g.revealedPest);
}
export function canTrialResolve(state: KqTrialState) {
 const g=state.game;
 return !!g && g.phase==='rolled' && (g.heritageUsed || !canActivateKqHeritage(g).allowed)
  && !(g.rulesVersion!==3 && g.stageIndex===2 && !g.reactionPlayed && canPlayKqCard(g,KQ_CARDS.find(c=>c.code==='BOTTE-002')!).allowed);
}
export function trialQuality(state: KqTrialState) { return state.battle ? getKqJuryScoreFromRounds(state.battle.rounds, 'player') : 0; }
export function trialRoutes(state: KqTrialState) { return state.game && isKqCultureDead(state.game) ? [] : quoteKqMarketRoutes({ juryScore: trialQuality(state), harvestGrams: state.game?.harvestGrams ?? 0, equipmentCodes: KQ_TRIAL_EQUIPMENT }); }
export function canTrialContinue(s: KqTrialState) {
 if (s.game && isKqCultureDead(s.game)) return false;
 switch(s.chapter) {
 case 0: return s.checked.includes('notebook');
 case 1: return ['buddie','deck','heritage'].every(key=>s.checked.includes(key));
 case 2: return s.bought;
 case 3: return ['LED-300','DRYING-ROOM','SIFT-TRAY'].every(code=>s.installed.includes(code));
 case 5: return true;
 case 6: return s.rounds===3;
 case 8: return s.receipts.length>0 && s.commerce.stocks.every(stock=>stock.remainingUnits===0);
 default: return false;
 }
}
function trialStorage(s: KqTrialState, nowMs = s.clock) {
 const g=s.game, battle=s.battle;
 if(s.rulesVersion!==3||!g?.care||!g.completedAt||!battle?.burnedAt)return undefined;
 const {terpenes,cannabinoidExpression,cannabinoidConversion,cannabinoidOxidation}=g.care;
 const harvestUnits=Math.round((g.harvestGrams??0)*10);
 const remainingUnits=s.commerce.stocks.length?s.commerce.stocks.reduce((sum,stock)=>sum+(stock.initialUnits>0?Math.ceil(stock.equivalentUnits*stock.remainingUnits/stock.initialUnits):0),0):harvestUnits;
 return projectKqStorageLot(createKqStorageLot({
  flowerId:'TRIAL-FLOWER',harvestedAt:g.completedAt,curingStartedAt:s.curingBeforeJury?g.completedAt:battle.burnedAt,
  capacity:planKqStorageAllocation({totalUnits:Math.min(harvestUnits,remainingUnits),ownedContainers:{'GLASS-1L':Math.max(2,Math.ceil(harvestUnits/500))},preferredMethodCode:'STORAGE-GLASS',nowMs:Date.parse(battle.burnedAt)}),
  baseline:{varietyCode:g.varietyCode,juryScore:trialQuality(s),aroma:battle.playerFlower.stats.aroma,
   care:{terpenes,cannabinoidExpression,cannabinoidConversion,cannabinoidOxidation}},
 }),nowMs);
}
function makeStock(s: KqTrialState, route: KqMarketRouteCode, grams: number, equivalent: number, base: number, id: string): KqCommerceStock {
 const units=Math.round(grams*10);
 const storage=trialStorage(s);
 return { id, flowerId:'TRIAL-FLOWER', name:'Fleur d’essai', route, batchRoute:route, juryScore:trialQuality(s), initialUnits:units, remainingUnits:units, equivalentUnits:Math.round(equivalent*10), originalUnits:Math.round((s.game?.harvestGrams??grams)*10), baseUnitCents:base, payoutExact:0,payoutRounded:0, repExact:0,repRounded:0,professionalUnits:0,counted:false,...(storage?{storage,storageRevision:0}:{}) };
}
// Advance only the fictitious calendar, stopping exactly at the requested time.
// Daily steps preserve charge settlement even when the last step is shorter.
export function advanceKqTrialClock(s: KqTrialState, targetClock: number): KqTrialState {
 if(!Number.isFinite(targetClock)||targetClock<=s.clock)return s;
 let next=s;
 while(next.clock<targetClock){
  const c=next.commerce,clock=Math.min(next.clock+KQ_GAME_DAY_MS,targetClock),business=structuredClone(c.business??createKqBusinessPreview(next.clock));
  let cash=c.cashCents;
  for(const invoice of business.lab.invoices)if(Date.parse(invoice.dueAt)>next.clock&&Date.parse(invoice.dueAt)<=clock&&cash>=invoice.remainingCents){cash-=invoice.remainingCents;invoice.remainingCents=0;}
  business.lab.outstandingCents=business.lab.invoices.reduce((sum,i)=>sum+i.remainingCents,0);
  business.lab.overdueCents=business.lab.invoices.filter(i=>Date.parse(i.dueAt)<=clock).reduce((sum,i)=>sum+i.remainingCents,0);
  if(business.shop.active&&business.shop.paidUntil&&Date.parse(business.shop.paidUntil)<=clock){
   if(business.shop.renew&&cash>=KQ_SHOP_MONTHLY_CENTS){cash-=KQ_SHOP_MONTHLY_CENTS;business.shop.paidUntil=new Date(Date.parse(business.shop.paidUntil)+KQ_GAME_MONTH_MS).toISOString();}
   else business.shop.active=false;
  }
  if(Date.parse(business.vat.nextSettlementAt)<=clock){business.vat.paidCents+=business.vat.reservedCents;business.vat.reservedCents=0;business.vat.nextSettlementAt=new Date(Date.parse(business.vat.nextSettlementAt)+KQ_GAME_MONTH_MS).toISOString();}
  business.serverNow=new Date(clock).toISOString();
  const storage=trialStorage(next,clock);
  next={...next,clock,commerce:{...c,business,cashCents:cash,stocks:storage?c.stocks.map(stock=>({...stock,storage})):c.stocks}};
 }
 return next;
}
export function reduceKqTrial(s: KqTrialState, a: KqTrialAction): KqTrialState {
 const g=s.game, c=s.commerce;
 if(g && isKqCultureDead(g) && a.type!=='restart-culture')return s;
 switch(a.type) {
 // A v2 journal may request a restart after a formerly fatal roll which the
 // current tutorial now assists. Honor that explicit action without replaying
 // the setup chapters or resetting the rest of the tutorial.
 case 'restart-culture': return s.chapter===4 && g && (isKqCultureDead(g) || g.effectNotices?.some(notice => notice === TRIAL_RESCUE_NOTICE || notice === KQ_TUTORIAL_CARE_RESCUE_NOTICE)) ? {...s,game:startKqTrialCulture(s.mode,2,s.rulesVersion),battle:null,rounds:0}:s;
 case 'check': return s.chapter<=1 && ['notebook','buddie','deck','heritage'].includes(a.value) ? {...s, checked:[...new Set([...s.checked,a.value])]} : s;
 case 'buy': {const price=getKqEquipmentDefinition('LED-300')!.priceCents;return s.chapter===2&&!s.bought&&c.cashCents>=price?{...s,bought:true,commerce:{...c,cashCents:c.cashCents-price}}:s;}
 case 'install': return s.chapter===3 && ['LED-300','DRYING-ROOM','SIFT-TRAY'].includes(a.code) && !s.installed.includes(a.code) ? {...s,installed:[...s.installed,a.code]}:s;
 case 'mode': return s.chapter===3 && ['eco','balanced','intensive'].includes(a.mode)?{...s,mode:a.mode}:s;
 case 'next': if(!canTrialContinue(s)) return s; return {...s,chapter:s.chapter+1,...(s.chapter===3?{game:startKqTrialCulture(s.mode,2,s.rulesVersion)}:{})};
 case 'play': {
 if(s.chapter!==4||!g) return s;
 // Keep the first teaching actions available: no competing preparation or redraw can consume their slot.
 if(g.phase==='prepare' && ((g.stageIndex===0&&a.code!=='BOTTE-005')||(g.rulesVersion!==3&&g.stageIndex===2&&a.code!=='BOTTE-004')))return s;
 const card=KQ_CARDS.find(c=>c.code===a.code);if(!card||!trialCardPermission(s,card.code).allowed)return s;
 return {...s,game:teachingRescue(playKqCard(g,a.code))};
 }
 case 'redraw': return s.chapter===4&&g&&g.stageIndex!==0&&(g.rulesVersion===3||g.stageIndex!==2) ? {...s,game:redrawKqHand(g)}:s;
 case 'roll': return s.chapter===4&&canTrialRoll(s)?{...s,game:teachingRescue(rollKqDice(g!))}:s;
 case 'heritage': return s.chapter===4&&g&&canActivateKqHeritage(g).allowed?{...s,game:activateKqHeritage(g)}:s;
 case 'resolve': return s.chapter===4&&canTrialResolve(s)?{...s,game:resolveKqStage(g!)}:s;
 case 'advance': {
 if(s.chapter!==4||g?.phase!=='resolved')return s;
 const advanced=advanceKqStage(g);
 const game=advanced.phase==='complete'?{...advanced,completedAt:new Date(s.clock).toISOString()}:advanced;
 if (game.phase !== 'complete') return {...s,game:teachingHand(game)};
 const business = structuredClone(c.business ?? createKqBusinessPreview(s.clock));
 business.lab = {outstandingCents:KQ_LAB_ANALYSIS_CENTS,overdueCents:0,invoices:[{id:'TRIAL-LAB',runId:'TRIAL',issuedAt:new Date(s.clock).toISOString(),dueAt:new Date(s.clock+KQ_GAME_MONTH_MS).toISOString(),amountCents:KQ_LAB_ANALYSIS_CENTS,remainingCents:KQ_LAB_ANALYSIS_CENTS}]};
 return {...s,chapter:5,game,electricity:game.energy?.totalCents??0,commerce:{...c,business}};
 }
 case 'duel': {
  if(s.chapter!==6||g?.phase!=='complete'||s.battle)return s;
  const matured=s.rulesVersion===3&&g.completedAt?advanceKqTrialClock(s,Math.max(s.clock,Date.parse(g.completedAt)+KQ_CURING_DURATION_MS)):s;
  return {...matured,curingBeforeJury:s.rulesVersion===3,battle:resolveKqBattle(lockKqBattle(createKqFlower(g,'Toi · essai'),createKqOpponent(2026,{ownerName:'Sylvain · entraînement',rulesVersion:g.rulesVersion}),2026),2026,new Date(matured.clock))};
 }
 case 'round': return s.chapter===6&&s.battle&&s.rounds<3?{...s,rounds:s.rounds+1}:s;
 case 'transform': {
 if(s.chapter!==7)return s;
 const q=trialRoutes(s).find(q=>q.route===a.route&&q.available);if(!q)return s;
 const stocks=[makeStock(s,q.route,q.productGrams,q.processedInputGrams,q.productBaseUnitCents??30,'TRIAL-STOCK')];
 if(q.remainderGrams>0){const route=q.remainderDestination==='raw'?'raw':'biomass';const remainder=trialRoutes(s).find(q=>q.route===route)!;stocks.push(makeStock(s,route,q.remainderGrams,q.remainderGrams,remainder.productBaseUnitCents??30,'TRIAL-REMAINDER'));}
 const now=new Date(s.clock).toISOString();
 const next:KqTrialState={...s,chapter:8,commerce:{...c,stocks,demand:{serverNow:now,updatedAt:now,onlineDebt:0,shopDebt:0,growthResetsAt:new Date(s.clock+86400000).toISOString()},campaign:{id:'TRIAL',revision:0,reputation:c.reputation,clientsStart:c.clients,shopPartnersStart:c.shopPartners,event:'normal',internetPaid:false,directUsed:0,shopUsed:0,goodUnits:0,disappointmentUnits:0}}};
 // This exercise lends a mature lot without bypassing the production rule.
 // Reuse its fictitious calendar so due charges are settled exactly once too.
 const readyAt=stocks[0]?.storage?.readyAt;
 return readyAt?advanceKqTrialClock(next,Date.parse(readyAt)):next;
 }
 case 'computer': return s.chapter===8&&!c.computerOwned&&c.cashCents>=KQ_COMPUTER_PRICE_CENTS?{...s,commerce:{...c,computerOwned:true,cashCents:c.cashCents-KQ_COMPUTER_PRICE_CENTS}}:s;
 case 'internet': {
 if(s.chapter!==8||!c.computerOwned||!c.campaign||c.business?.shop.createdAt||c.cashCents<KQ_SHOP_CREATION_CENTS)return s;
 const business=structuredClone(c.business??createKqBusinessPreview(s.clock));
 business.shop={name:'Le shop d’essai',createdAt:new Date(s.clock).toISOString(),paidUntil:new Date(s.clock+KQ_GAME_MONTH_MS).toISOString(),renew:true,active:true};
 return {...s,commerce:{...c,business,cashCents:c.cashCents-KQ_SHOP_CREATION_CENTS,campaign:{...c.campaign,internetPaid:true}}};
 }
 case 'wait': return s.chapter===8?advanceKqTrialClock(s,s.clock+KQ_GAME_DAY_MS):s;
 case 'sell': {
 if(s.chapter!==8||!c.campaign||!['online','cbd-shop','wholesale'].includes(a.channel)||!['advised','premium','discovery'].includes(a.policy))return s;
 const stock=c.stocks.find(stock=>stock.id===a.stockId);if(!stock||stock.remainingUnits<=0)return s;
 const offer=quoteKqCommerce(c,stock,a.channel,a.policy,undefined,s.clock);if(offer.reason||offer.units<=0)return s;
 const business=structuredClone(c.business??createKqBusinessPreview(s.clock));
 const energy=previewKqBusinessPayment(offer.payoutCents,business,s.electricity);
 business.vat.salesTtcCents+=offer.payoutCents;business.vat.reservedCents+=energy.vatCents;
 let lab=energy.labPaidCents;
 for(const invoice of business.lab.invoices)if(Date.parse(invoice.dueAt)<=s.clock){const paid=Math.min(lab,invoice.remainingCents);invoice.remainingCents-=paid;lab-=paid;}
 business.lab.outstandingCents-=energy.labPaidCents;business.lab.overdueCents-=energy.labPaidCents;
 const elapsed=Math.max(0,s.clock-Date.parse(c.demand!.updatedAt));
 const next={...s,electricity:energy.electricityRemainingCents,receipts:[...s.receipts,{...offer,...energy,net:energy.netPayoutCents,electricity:energy.electricityPaidCents}],commerce:{...c,business,cashCents:c.cashCents+energy.netPayoutCents,reputation:Math.max(0,c.reputation+offer.reputationDelta),clients:offer.clientsAfter,shopPartners:offer.shopPartnersAfter,shopRecruitment:offer.shopRecruitmentAfter,shopChurn:offer.shopChurnAfter,
 demand:{...c.demand!,updatedAt:new Date(s.clock).toISOString(),serverNow:new Date(s.clock).toISOString(),onlineDebt:Math.min(1,Math.max(0,c.demand!.onlineDebt-elapsed/(4*3600000))+offer.directCost/(getKqCommerceCapacity(c.campaign.reputation).baseUnits*(1+.25*Math.min(1,c.campaign.clientsStart/getKqCommerceCapacity(c.campaign.reputation).maxClients)))),shopDebt:Math.min(1,Math.max(0,c.demand!.shopDebt-elapsed/(12*3600000))+offer.shopCost/getKqShopBudget(c.campaign.shopPartnersStart??0,c.campaign.event))},
 campaign:{...c.campaign,goodUnits:offer.goodUnitsAfter,disappointmentUnits:offer.disappointmentAfter,shopGoodUnits:offer.shopGoodUnitsAfter,shopBadUnits:offer.shopBadUnitsAfter},
 stocks:c.stocks.map(item=>item.id!==stock.id?item:{...item,remainingUnits:item.remainingUnits-offer.units,payoutExact:offer.payoutExactAfter,payoutRounded:offer.payoutRoundedAfter,repExact:offer.repExactAfter,repRounded:offer.repRoundedAfter}),
 ownVolumes:{...c.ownVolumes,[stock.route]:(c.ownVolumes[stock.route]??0)+offer.equivalentSold/10}}};
 const storage=trialStorage(next);
 return storage?{...next,commerce:{...next.commerce,stocks:next.commerce.stocks.map(item=>({...item,storage}))}}:next;
 }
 default: return s;
 }
}
// Replay only tutorial actions, never restore an arbitrary game/account snapshot.
export function restoreKqTrial(value: unknown): { state: KqTrialState; actions: KqTrialAction[] } {
 const empty={state:createKqTrial(),actions:[] as KqTrialAction[]};
 if(!value||typeof value!=='object')return empty;
 const row=value as {version?:unknown;actions?:unknown};
 if((row.version!==2&&row.version!==KQ_TRIAL_VERSION)||!Array.isArray(row.actions)||row.actions.length>500)return empty;
 try {const actions=row.actions as KqTrialAction[];return {state:actions.reduce((s,a)=>a&&typeof a==='object'?reduceKqTrial(s,a):s,createKqTrial(row.version===2?2:3)),actions};}catch{return empty;}
}
export function kqTrialStorageKey(userId: string){return `kq-guided-trial-v${KQ_TRIAL_VERSION}:${userId}`;}
