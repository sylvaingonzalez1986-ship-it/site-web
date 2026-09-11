import {createServer} from 'vite';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const vite=await createServer({configFile:false,envDir:false,resolve:{alias:{'@':resolve('src')}},server:{middlewareMode:true,watch:null}});
try {
const {startKqGame,rollKqDice,resolveKqStage,advanceKqStage}=await vite.ssrLoadModule('/src/lib/kanab-quest-game.ts');
const {createKqFlower}=await vite.ssrLoadModule('/src/lib/kanab-quest-battle.ts');
const {getKqJuryScoreFromStats,quoteKqMarketRoutes}=await vite.ssrLoadModule('/src/lib/kanab-quest-market.ts');
const results=[];
for(const level of [0,1,5,10])for(const mode of ['eco','balanced','intensive']){
 const equipmentCodes=level?['TENT-120','LED-300','AIR-EC6','CLIMATE-SMART','SECURITY-CAMERA']:['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'];
 const equipmentLevels=Object.fromEntries(equipmentCodes.map(c=>[c,level||1]));let grams=0,quality=0,gross=0,bill=0,biomass=0,unprofitable=0;
 for(let seed=0;seed<200;seed++){
 let s=startKqGame(seed,{equipmentCodes,equipmentLevels,energyMode:mode});
 while(s.phase!=='complete'){if(s.phase==='prepare')s=rollKqDice(s);if(s.phase==='rolled')s=resolveKqStage(s);if(s.phase==='resolved')s=advanceKqStage(s);}
 const score=getKqJuryScoreFromStats(createKqFlower(s).stats); const quotes=quoteKqMarketRoutes({juryScore:score,harvestGrams:s.harvestGrams,equipmentCodes,equipmentLevels});
 const available=quotes.filter(q=>q.available);const revenue=Math.max(...available.map(q=>q.payoutCents));const salvage=quotes.find(q=>q.family==='salvage').payoutCents;
 grams+=s.harvestGrams; quality+=s.quality; gross+=revenue;bill+=s.energy.totalCents;biomass+=salvage;if(salvage<s.energy.totalCents)unprofitable++;
 }
 const avg=n=>Math.round(n/200*100)/100;
 results.push({level:level||'starter',mode,grams:avg(grams),quality:avg(quality),grossCents:avg(gross),electricityCents:avg(bill),netCents:avg(gross-bill),biomassNetCents:avg(biomass-bill),biomassLosses:unprofitable});
}
console.table(results);await mkdir('output/electricity',{recursive:true});await writeFile('output/electricity/simulation.json',JSON.stringify({note:'200 identical seeds per setting; no cards played; jury estimated from flower stats; not a guarantee of profit',results},null,2));
}finally{await vite.close();}
