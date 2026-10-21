import { describe, expect, it } from 'vitest';
import { canActivateKqHeritage, isKqCultureDead, KQ_CARDS, previewKqResolution } from './kanab-quest-game';
import { getKqCommerceReplenishment, quoteKqCommerce } from './kanab-quest-commerce';
import { KQ_GAME_DAY_MS, KQ_GAME_MONTH_MS, KQ_SHOP_MONTHLY_CENTS } from './kanab-quest-business';
import { KQ_CURING_DURATION_MS } from './kanab-quest-storage';
import { assistKqTutorialCare, canTrialContinue, canTrialRoll, createKqTrial, KQ_TRIAL_VERSION, KQ_TUTORIAL_CARE_RESCUE_NOTICE, reduceKqTrial, restoreKqTrial, startKqTrialCulture, trialCardPermission, trialInstruction, trialQuality, trialRoutes, type KqTrialAction } from './kanab-quest-trial';

function prepared(mode: 'eco'|'balanced'|'intensive'='balanced', rulesVersion: 2 | 3 = 3) {
 let s=createKqTrial(rulesVersion);
 const actions:KqTrialAction[]=[{type:'check',value:'notebook'},{type:'next'},...['buddie','heritage','deck'].map(value=>({type:'check' as const,value})),{type:'next'},{type:'buy'},{type:'next'},...['LED-300','DRYING-ROOM','SIFT-TRAY'].map(code=>({type:'install' as const,code})),{type:'mode',mode},{type:'next'}];
 actions.forEach(a=>{s=reduceKqTrial(s,a);});return {s,actions};
}
function culture(mode: 'eco'|'balanced'|'intensive'='balanced',support=true,rulesVersion: 2 | 3 = 3) {
 const result=prepared(mode,rulesVersion);let s=result.s;
 const act=(a:KqTrialAction)=>{result.actions.push(a);s=reduceKqTrial(s,a);};
 for(let index=0;index<6;index++) {
  expect(s.game?.stageIndex).toBe(index);
  if(index===0)act({type:'play',code:'BOTTE-005'});
  if(index===2&&rulesVersion===2)act({type:'play',code:'BOTTE-004'});
  if(index>=3&&support){const card=KQ_CARDS.find(card=>trialCardPermission(s,card.code).allowed);if(card)act({type:'play',code:card.code});}
  act({type:'roll'});expect(s.game?.phase).toBe('rolled');
  if(canActivateKqHeritage(s.game!).allowed)act({type:'heritage'});
  if(index===2&&trialCardPermission(s,'BOTTE-002').allowed)act({type:'play',code:'BOTTE-002'});
  act({type:'resolve'});expect(s.game?.phase).toBe('resolved');act({type:'advance'});
 }
 return {s,actions:result.actions};
}
function commerce(preferred='dry-sift') {
 let {s}=culture();
 for(const a of [{type:'next'},{type:'duel'},{type:'round'},{type:'round'},{type:'round'},{type:'next'}] as KqTrialAction[])s=reduceKqTrial(s,a);
 const route=trialRoutes(s).find(q=>q.available&&q.route===preferred)??trialRoutes(s).find(q=>q.available&&q.route==='raw')!;
 expect(route).toBeDefined();return reduceKqTrial(s,{type:'transform',route:route.route});
}
describe('isolated Placard learning run',()=>{
 it('deals all nine real trial cards under the ten-card limit and excludes used copies on the next stage',()=>{
  let game=startKqTrialCulture();
  expect(game.handCodes).toHaveLength(9);
  expect([...game.handCodes!].sort()).toEqual([...game.deckCodes].sort());
  let s=prepared().s;
  s=reduceKqTrial(s,{type:'play',code:'BOTTE-005'});
  s=reduceKqTrial(s,{type:'roll'});
  if(canActivateKqHeritage(s.game!).allowed)s=reduceKqTrial(s,{type:'heritage'});
  s=reduceKqTrial(s,{type:'resolve'});
  s=reduceKqTrial(s,{type:'advance'});
  game=s.game!;
  expect(game.handCodes).not.toContain('BOTTE-005');
  expect(game.handCodes).toHaveLength(8);
 });
 it('requires each real interaction before advancing and cannot buy twice',()=>{
  let s=createKqTrial();expect(reduceKqTrial(s,{type:'next'})).toBe(s);
  s=reduceKqTrial(s,{type:'check',value:'notebook'});s=reduceKqTrial(s,{type:'next'});
  expect(reduceKqTrial(s,{type:'next'})).toBe(s);
  const result=prepared();expect(result.s.chapter).toBe(4);const cash=result.s.commerce.cashCents;
  expect(reduceKqTrial(result.s,{type:'buy'}).commerce.cashCents).toBe(cash);
  expect(reduceKqTrial(result.s,{type:'roll'})).toBe(result.s);
  expect(reduceKqTrial(result.s,{type:'redraw'})).toBe(result.s);
 });
 for(const mode of ['eco','balanced','intensive'] as const)for(const support of [true,false])it(`finishes all six stages with ${mode}, support=${support}`,()=>{
  const {s}=culture(mode,support);expect(s.chapter).toBe(5);expect(s.game?.history).toHaveLength(6);expect(s.game?.heritageUsed).toBe(true);
  expect(s.game?.usedCards).not.toContain('BOTTE-002');expect(s.game?.usedCards).not.toContain('BOTTE-004');expect(s.game?.harvestGrams).toBeGreaterThan(0);expect(s.electricity).toBeGreaterThan(0);
 });
 it('ends the culture at the second zero-success stage and lets the player retry without repeating preparation',()=>{
  const preparedTrial=prepared('eco',2);let s=preparedTrial.s;
  expect(reduceKqTrial(s,{type:'restart-culture'})).toBe(s);
  s=reduceKqTrial(s,{type:'play',code:'BOTTE-005'});
  s=reduceKqTrial(s,{type:'roll'});
  s={...s,game:{...s.game!,dice:[2,2,2],heritageUsed:true}};
  s=reduceKqTrial(s,{type:'resolve'});
  expect(s.game?.phase).toBe('resolved');
  expect(trialInstruction(s)).toContain('Une deuxième, même plus tard');
  s=reduceKqTrial(s,{type:'advance'});
  s=reduceKqTrial(s,{type:'roll'});
  s={...s,game:{...s.game!,dice:[1,2,3]}};
  s=reduceKqTrial(s,{type:'resolve'});
  expect(s.chapter).toBe(4);
  expect(s.game?.phase).toBe('complete');
  expect(isKqCultureDead(s.game!)).toBe(true);
  expect(s.game?.harvestGrams).toBe(0);
  expect(trialInstruction(s)).toContain('Ta culture est morte');
  expect(canTrialContinue(s)).toBe(false);
  expect(trialRoutes(s)).toEqual([]);
  for(const type of ['advance','next','roll','resolve','duel'] as const)expect(reduceKqTrial(s,{type})).toBe(s);
  for(const [chapter,action] of [[5,{type:'next'}],[6,{type:'duel'}],[7,{type:'transform',route:'raw'}]] as const){
   const later={...s,chapter};expect(canTrialContinue(later)).toBe(false);expect(reduceKqTrial(later,action)).toBe(later);
  }
  const restarted=reduceKqTrial(s,{type:'restart-culture'});
  expect(restarted.game).toEqual(preparedTrial.s.game);
  expect(restarted.chapter).toBe(4);
  expect(restarted.installed).toEqual(s.installed);
  expect(restarted.commerce).toBe(s.commerce);
  expect(restarted.battle).toBeNull();
  expect(restarted.rounds).toBe(0);
  expect(canTrialRoll(reduceKqTrial(restarted,{type:'play',code:'BOTTE-005'}))).toBe(true);
 });
 it('restores only versioned training actions, never account data',()=>{
  const {s,actions}=culture();const loaded=restoreKqTrial({version:KQ_TRIAL_VERSION,actions,cashCents:99999999});
  expect(loaded.state.game?.history).toEqual(s.game?.history);expect(loaded.state.commerce).toEqual(s.commerce);
  expect(restoreKqTrial({version:0,actions}).state).toEqual(createKqTrial());expect(restoreKqTrial({version:1,actions:new Array(501).fill({type:'buy'})}).state).toEqual(createKqTrial());
 });
 it('finishes assisted cultures with varied seeds, modes, cards and redraws without an official rescue right',()=>{
  for(const mode of ['eco','balanced','intensive'] as const)for(let seed=1;seed<=75;seed++){
   let s={...prepared(mode).s,game:startKqTrialCulture(mode,seed)};
   const act=(action:KqTrialAction)=>{s=reduceKqTrial(s,action) as typeof s;};
   for(let index=0;index<6;index++){
    expect(s.game.stageIndex).toBe(index);
    if(index===0)act({type:'play',code:'BOTTE-005'});
    if(index>=3&&seed%3===0)act({type:'redraw'});
    if(index>=3&&seed%2===0){const cards=KQ_CARDS.filter(card=>trialCardPermission(s,card.code).allowed);if(cards.length)act({type:'play',code:cards[seed%cards.length].code});}
    act({type:'roll'});
    if(canActivateKqHeritage(s.game).allowed)act({type:'heritage'});
    if(index===2&&trialCardPermission(s,'BOTTE-002').allowed)act({type:'play',code:'BOTTE-002'});
    if(index>=3&&seed%2===1){const cards=KQ_CARDS.filter(card=>trialCardPermission(s,card.code).allowed);if(cards.length)act({type:'play',code:cards[seed%cards.length].code});}
    if(canActivateKqHeritage(s.game).allowed)act({type:'heritage'});
    const preview=previewKqResolution(s.game)!;
    act({type:'resolve'});
    expect(s.game.phase,`${mode}, seed ${seed}, stage ${index}`).toBe('resolved');
    expect(s.game.history.at(-1)?.total).toBe(preview.total);
    act({type:'advance'});
   }
   expect(s.chapter).toBe(5);
   expect(s.game.harvestGrams).toBeGreaterThan(0);
   expect(s.game.care?.vitality).toBeGreaterThan(0);
   expect(s.game.usedCards).not.toContain('BOTTE-004');
   expect(s.game.usedCards).not.toContain('BOTTE-002');
   expect(s.game.firstCultureRescue).toBeUndefined();
  }
 });
 it('announces a vitality rescue before a fatal tutorial result without changing its dice or existing losses',()=>{
  const initial=startKqTrialCulture();
  const fatal={...initial,phase:'rolled' as const,dice:[1,1,1] as [number,number,number],care:{...initial.care!,vitality:1,yieldLossPercent:12},heritageUsed:true};
  const assisted=assistKqTutorialCare(fatal);
  expect(assisted.care?.vitality).toBe(100);
  expect(assisted.care?.yieldLossPercent).toBe(12);
  expect(assisted.dice).toEqual(fatal.dice);
  expect(assisted.effectNotices).toContain(KQ_TUTORIAL_CARE_RESCUE_NOTICE);
  expect(assistKqTutorialCare(assisted)).toBe(assisted);
  expect(trialInstruction({...prepared().s,game:{...assisted,phase:'resolved'}})).toContain('vitalité à 0');
 });
 it('restores a complete v2 journal through the jury, sales and final chapter without resetting setup',()=>{
  const run=culture('balanced',true,2);let s=run.s;
  const act=(action:KqTrialAction)=>{run.actions.push(action);s=reduceKqTrial(s,action);};
  for(const action of [{type:'next'},{type:'duel'},{type:'round'},{type:'round'},{type:'round'},{type:'next'},{type:'transform',route:'raw'}] as KqTrialAction[])act(action);
  for(const stock of s.commerce.stocks)act({type:'sell',stockId:stock.id,channel:'wholesale',policy:'advised'});
  act({type:'next'});
  expect(s.chapter).toBe(9);
  const restored=restoreKqTrial({version:2,actions:run.actions}).state;
  expect(restored.chapter).toBe(9);
  expect(restored.checked).toEqual(s.checked);
  expect(restored.installed).toEqual(s.installed);
  expect(restored.game?.history).toEqual(s.game?.history);
  expect(restored.game?.harvestGrams).toBe(s.game?.harvestGrams);
  expect(restored.battle?.rounds).toEqual(s.battle?.rounds);
  expect(restored.battle?.status).toBe(s.battle?.status);
  expect(restored.battle?.playerFlower.stats).toEqual(s.battle?.playerFlower.stats);
  expect(restored.battle?.playerFlower.integrityCode).toBe(s.battle?.playerFlower.integrityCode);
  expect(restored.receipts).toEqual(s.receipts);
  expect(restored.commerce).toEqual(s.commerce);
 });
 it('honors an old v2 restart action after a roll that is now assisted, keeping the preparation chapters',()=>{
  const initial=prepared('balanced',2);let state=initial.s;
  state=reduceKqTrial(state,{type:'play',code:'BOTTE-005'});
  state=reduceKqTrial(state,{type:'roll'});
  // Model a first zero produced by a historical tutorial rule set.
  state={...state,game:{...state.game!,dice:[2,2,2],heritageUsed:true}};
  state=reduceKqTrial(state,{type:'resolve'});
  state=reduceKqTrial(state,{type:'advance'});
  let assisted:typeof state|undefined;
  for(let seed=1;seed<=100;seed++){
   const rolled=reduceKqTrial({...state,game:{...state.game!,seed}},{type:'roll'});
   if(rolled.game?.effectNotices?.some(notice=>notice.startsWith('Essai guidé :'))){assisted=rolled;break;}
  }
  expect(assisted).toBeDefined();
  const resolved=reduceKqTrial(assisted!,{type:'resolve'});
  expect(resolved.game?.phase).toBe('resolved');
  const restarted=reduceKqTrial(resolved,{type:'restart-culture'});
  expect(restarted.chapter).toBe(4);
  expect(restarted.game).toEqual(initial.s.game);
  expect(restarted.checked).toEqual(initial.s.checked);
  expect(restarted.installed).toEqual(initial.s.installed);
  expect(restarted.commerce).toEqual(initial.s.commerce);
 });
 it('evaluates a local opponent and does not skip the jury or transformation',()=>{
  const {s}=culture();expect(reduceKqTrial(s,{type:'transform',route:'raw'})).toBe(s);
  let state=reduceKqTrial(s,{type:'next'});expect(canTrialContinue(state)).toBe(false);state=reduceKqTrial(state,{type:'duel'});
  expect(state.battle?.rounds).toHaveLength(3);expect(trialQuality(state)).toBeGreaterThan(0);expect(reduceKqTrial(state,{type:'duel'})).toBe(state);
  expect(canTrialContinue(state)).toBe(false);
 });
 it('requires a computer and subscription, depletes demand and refills it after waiting',()=>{
  let s=commerce('raw');const stock=s.commerce.stocks[0];
  expect(quoteKqCommerce(s.commerce,stock,'online').reason).not.toBeNull();
  s=reduceKqTrial(s,{type:'computer'});s=reduceKqTrial(s,{type:'internet'});
  expect(quoteKqCommerce(s.commerce,stock,'online').reason).toBeNull();
  const cash=s.commerce.cashCents;s=reduceKqTrial(s,{type:'internet'});expect(s.commerce.cashCents).toBe(cash);
  s=reduceKqTrial(s,{type:'sell',stockId:stock.id,channel:'online',policy:'advised'});
  expect(s.receipts).toHaveLength(1);expect(s.receipts[0].units).toBeGreaterThan(0);expect(s.receipts[0].units).toBeLessThan(stock.initialUnits);
  expect(getKqCommerceReplenishment(s.commerce,'online',s.clock)!.availableFraction).toBeLessThan(.02);
  s=reduceKqTrial(s,{type:'wait'});expect(getKqCommerceReplenishment(s.commerce,'online',s.clock)!.availableFraction).toBe(1);
 });
 it('loans a mature lot exactly six hours after its verdict without paying future charges early',()=>{
  let {s}=culture();
  const harvestedAt=s.game!.completedAt!, harvestClock=s.clock;
  s={...s,clock:s.clock+3*KQ_GAME_DAY_MS};
  for(const action of [{type:'next'},{type:'duel'},{type:'round'},{type:'round'},{type:'round'},{type:'next'}] as KqTrialAction[])s=reduceKqTrial(s,action);
  const verdict=s.battle!, before=s.commerce.cashCents, labDue=s.commerce.business!.lab.outstandingCents;
  expect(Date.parse(verdict.burnedAt!)).toBe(harvestClock+3*KQ_GAME_DAY_MS);
  const soldLesson=reduceKqTrial(s,{type:'transform',route:'raw'});
  expect(soldLesson.clock).toBe(Date.parse(verdict.burnedAt!)+6*3600000);
  expect(soldLesson.clock-Date.parse(verdict.burnedAt!)).toBe(KQ_CURING_DURATION_MS);
  expect(soldLesson.commerce.stocks[0].storage).toMatchObject({stage:'ready',progressPercent:100,remainingMs:0,harvestedAt,curingStartedAt:verdict.burnedAt});
  expect(soldLesson.commerce.business!.lab.outstandingCents).toBe(labDue);
  expect(soldLesson.commerce.business!.lab.overdueCents).toBe(0);
  expect(soldLesson.commerce.cashCents).toBe(before);
  expect(soldLesson.battle).toBe(verdict);
  expect(s.clock).toBe(Date.parse(verdict.burnedAt!));
  const later=reduceKqTrial(soldLesson,{type:'wait'});
  expect(later.clock-soldLesson.clock).toBe(KQ_GAME_DAY_MS);
  expect(later.commerce.stocks[0].storage!.elapsedGameDays).toBe(2);
  expect(later.commerce.stocks[0].storage!.conditionScore).toBeLessThanOrEqual(soldLesson.commerce.stocks[0].storage!.conditionScore);
  expect(later.commerce.cashCents).toBe(soldLesson.commerce.cashCents);
  expect(later.battle).toBe(verdict);
 });
 it('settles charges falling inside the final partial day of simulated curing exactly once',()=>{
  let {s}=culture();
  for(const action of [{type:'next'},{type:'duel'},{type:'round'},{type:'round'},{type:'round'},{type:'next'}] as KqTrialAction[])s=reduceKqTrial(s,action);
  const business=s.commerce.business!,before=s.commerce.cashCents,labDue=business.lab.outstandingCents;
  const dueAt=new Date(s.clock+5*3600000).toISOString();
  business.lab.invoices[0].dueAt=dueAt;
  business.shop={name:'Essai',createdAt:new Date(s.clock).toISOString(),paidUntil:dueAt,renew:true,active:true};
  business.vat={...business.vat,reservedCents:3200,nextSettlementAt:dueAt};
  const matured=reduceKqTrial(s,{type:'transform',route:'raw'});
  expect(matured.clock-s.clock).toBe(6*3600000);
  expect(matured.commerce.cashCents).toBe(before-labDue-KQ_SHOP_MONTHLY_CENTS);
  expect(matured.commerce.business!.lab).toMatchObject({outstandingCents:0,overdueCents:0});
  expect(matured.commerce.business!.shop.paidUntil).toBe(new Date(Date.parse(dueAt)+KQ_GAME_MONTH_MS).toISOString());
  expect(matured.commerce.business!.vat).toMatchObject({paidCents:3200,reservedCents:0,nextSettlementAt:new Date(Date.parse(dueAt)+KQ_GAME_MONTH_MS).toISOString()});
  const later=reduceKqTrial(matured,{type:'wait'});
  expect(later.commerce.cashCents).toBe(matured.commerce.cashCents);
  expect(later.commerce.business!.lab).toEqual(matured.commerce.business!.lab);
  expect(later.commerce.business!.vat).toEqual(matured.commerce.business!.vat);
  expect(business.lab.outstandingCents).toBe(labDue);
  expect(business.vat.reservedCents).toBe(3200);
 });
 it('settles charges once, preserves mass, completes after selling the remainder and cannot double-sell',()=>{
  let s=commerce();const cash=s.commerce.cashCents,energy=s.electricity;
  expect(canTrialContinue(s)).toBe(false);
  for(const stock of s.commerce.stocks)s=reduceKqTrial(s,{type:'sell',stockId:stock.id,channel:'wholesale',policy:'advised'});
  expect(canTrialContinue(s)).toBe(true);expect(s.commerce.stocks.every(stock=>stock.remainingUnits===0)).toBe(true);
  expect(s.receipts.reduce((sum,r)=>sum+r.electricity,0)+s.electricity).toBe(energy);
  expect(s.commerce.cashCents-cash).toBe(s.receipts.reduce((sum,r)=>sum+r.net,0));
  expect(reduceKqTrial(s,{type:'sell',stockId:s.commerce.stocks[0].id,channel:'wholesale',policy:'advised'})).toBe(s);
  expect(reduceKqTrial(s,{type:'next'}).chapter).toBe(9);
 });
 it('keeps a refused transformation unavailable',()=>{
  let {s}=culture();for(const a of [{type:'next'},{type:'duel'},{type:'round'},{type:'round'},{type:'round'},{type:'next'}] as KqTrialAction[])s=reduceKqTrial(s,a);
  const blocked=trialRoutes(s).find(q=>!q.available)!;expect(blocked).toBeDefined();expect(reduceKqTrial(s,{type:'transform',route:blocked.route})).toBe(s);
 });
});
