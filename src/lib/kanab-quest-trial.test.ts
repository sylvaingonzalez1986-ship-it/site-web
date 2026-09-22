import { describe, expect, it } from 'vitest';
import { canActivateKqHeritage, isKqCultureDead, KQ_CARDS } from './kanab-quest-game';
import { getKqCommerceReplenishment, quoteKqCommerce } from './kanab-quest-commerce';
import { canTrialContinue, canTrialRoll, createKqTrial, KQ_TRIAL_VERSION, reduceKqTrial, restoreKqTrial, trialCardPermission, trialInstruction, trialQuality, trialRoutes, type KqTrialAction } from './kanab-quest-trial';

function prepared(mode: 'eco'|'balanced'|'intensive'='balanced') {
 let s=createKqTrial();
 const actions:KqTrialAction[]=[{type:'check',value:'notebook'},{type:'next'},...['buddie','heritage','deck'].map(value=>({type:'check' as const,value})),{type:'next'},{type:'buy'},{type:'next'},...['LED-300','DRYING-ROOM','SIFT-TRAY'].map(code=>({type:'install' as const,code})),{type:'mode',mode},{type:'next'}];
 actions.forEach(a=>{s=reduceKqTrial(s,a);});return {s,actions};
}
function culture(mode: 'eco'|'balanced'|'intensive'='balanced',support=true) {
 const result=prepared(mode);let s=result.s;
 const act=(a:KqTrialAction)=>{result.actions.push(a);s=reduceKqTrial(s,a);};
 for(let index=0;index<6;index++) {
  expect(s.game?.stageIndex).toBe(index);
  if(index===0)act({type:'play',code:'BOTTE-005'});
  if(index===2)act({type:'play',code:'BOTTE-004'});
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
  expect(s.game?.usedCards).toContain('BOTTE-002');expect(s.game?.harvestGrams).toBeGreaterThan(0);expect(s.electricity).toBeGreaterThan(0);
 });
 it('ends the culture at the second zero-success stage and lets the player retry without repeating preparation',()=>{
  const preparedTrial=prepared('eco');let s=preparedTrial.s;
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
