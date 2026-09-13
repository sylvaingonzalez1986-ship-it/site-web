// Deterministic balance scenarios, not a forecast of player retention or real product prices.
import {createServer} from 'vite';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const vite=await createServer({configFile:false,envDir:false,resolve:{alias:{'@':resolve('src')}},server:{middlewareMode:true,watch:null,hmr:false}});
try {
 const {quoteKqCommerce}=await vite.ssrLoadModule('/src/lib/kanab-quest-commerce.ts');
 const results=[];
 for(const quality of [6,7,8,9]) for(const strategy of ['online','shops','wholesale','mixed']) {
  const state={shopPartners:0,shopRecruitment:0,shopChurn:0,revision:0,cashCents:35000,reputation:0,clients:0,computerOwned:false,internetRenew:false,campaign:null,stocks:[],receipts:[],marketVolumes:{},ownVolumes:{},routeSales:{}};
  let electricity=0,fees=0,income=0;
  for(let cycle=0;cycle<60;cycle++) {
   if((strategy==='online'||strategy==='mixed')&&!state.computerOwned&&state.cashCents>=46500){state.cashCents-=45000;fees+=45000;state.computerOwned=true;}
   const paid=state.computerOwned&&state.cashCents>=1500;
   if(paid){state.cashCents-=1500;fees+=1500;}
   const event=cycle%20<12?'normal':cycle%20<15?'spot-flower':cycle%20<18?'promotion':'restock';
   state.campaign={shopPartnersStart:state.shopPartners,shopRecruitmentStart:state.shopRecruitment,shopChurnStart:state.shopChurn,shopGoodUnits:0,shopBadUnits:0,id:String(cycle),revision:0,reputation:state.reputation,clientsStart:state.clients,event,internetPaid:paid,directUsed:0,shopUsed:0,goodUnits:0,disappointmentUnits:0};
   electricity+=1377;
   state.stocks.push({id:String(cycle),flowerId:String(cycle),name:'Test',route:'raw',batchRoute:'raw',juryScore:quality,initialUnits:1200,remainingUnits:1200,equivalentUnits:1200,originalUnits:1200,baseUnitCents:180,repExact:0,repRounded:0,professionalUnits:0,counted:false});
   const channels=strategy==='mixed'?['online','cbd-shop','wholesale']:strategy==='shops'?['cbd-shop','wholesale']:strategy==='wholesale'?['wholesale']:paid?['online']:['cbd-shop','wholesale'];
   for(const channel of channels) for(const stock of state.stocks) {
    if(!stock.remainingUnits)continue;
    const q=quoteKqCommerce(state,stock,channel,'advised');if(!q.units)continue;
    const energyPaid=Math.min(electricity,Math.floor(q.payoutCents/2));electricity-=energyPaid;
    state.cashCents+=q.payoutCents-energyPaid;income+=q.payoutCents;
    state.shopPartners=q.shopPartnersAfter;state.shopRecruitment=q.shopRecruitmentAfter;state.shopChurn=q.shopChurnAfter;state.campaign.shopGoodUnits=q.shopGoodUnitsAfter;state.campaign.shopBadUnits=q.shopBadUnitsAfter;
    state.reputation=Math.max(0,state.reputation+q.reputationDelta);state.clients=q.clientsAfter;
    stock.remainingUnits-=q.units;stock.repExact=q.repExactAfter;stock.repRounded=q.repRoundedAfter;stock.payoutExact=q.payoutExactAfter;stock.payoutRounded=q.payoutRoundedAfter;
    state.campaign.directUsed+=q.directCost;state.campaign.shopUsed+=q.shopCost;state.campaign.goodUnits=q.goodUnitsAfter;state.campaign.disappointmentUnits=q.disappointmentAfter;
   }
   state.stocks=state.stocks.filter(s=>s.remainingUnits>0);
  }
  results.push({quality,strategy,cashEuros:state.cashCents/100,receiptsEuros:income/100,computerAndInternetEuros:fees/100,electricityDueEuros:electricity/100,reputation:state.reputation,clients:state.clients,shopPartners:state.shopPartners,unsoldGrams:state.stocks.reduce((n,s)=>n+s.remainingUnits,0)/10});
 }
 const report={assumptions:'60 cycles of 120 g raw flower at fixed quality, no booster cost, 13.77 EUR energy/cycle, no global or personal saturation; computer bought when affordable, no transformations. Conservative storage choice for online-only; unsuitable shops fall back to wholesale. Compare strategies, not absolute profitability.',results};
 await mkdir(resolve('output/placard-commerce'),{recursive:true});await writeFile(resolve('output/placard-commerce/balance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await vite.close();}
