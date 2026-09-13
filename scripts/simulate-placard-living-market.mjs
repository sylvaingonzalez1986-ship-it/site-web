// Deterministic, local balance study. Stats-based jury estimate, no remote state.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null } });
try {
  const game = await vite.ssrLoadModule("/src/lib/kanab-quest-game.ts");
  const { buildKqRecommendedDeck } = await vite.ssrLoadModule("/src/lib/kanab-quest-economy.ts");
  const { createKqFlower } = await vite.ssrLoadModule("/src/lib/kanab-quest-battle.ts");
  const { getKqJuryScoreFromStats, quoteKqMarketRoutes } = await vite.ssrLoadModule("/src/lib/kanab-quest-market.ts");
  const { KQ_STARTING_EQUIPMENT_CODES } = await vite.ssrLoadModule("/src/lib/kanab-quest-equipment.ts");
  const inventory = Object.fromEntries(game.KQ_CARDS.map(card=>[card.code,1]));
  const result=[];
  for (const supports of [false,true]) {
    const scores=[], receipts=[], buddieScores=[];
    for (const buddie of game.KQ_BUDDIES) {
      const own=[];
      for (let seed=1;seed<=100;seed++) {
        const deckCodes=supports?buildKqRecommendedDeck(buddie.effect,inventory,[],buddie.code).support:[];
        let state=game.startKqGame(seed,{varietyCode:buddie.code,deckCodes,equipmentCodes:[...KQ_STARTING_EQUIPMENT_CODES],energyMode:"balanced"});
        for(let stage=0;stage<6;stage++) {
          const prepare=game.KQ_CARDS.filter(card=>game.canPlayKqCard(state,card).allowed).sort((a,b)=>a.xpCost-b.xpCost)[0];
          if(prepare)state=game.playKqCard(state,prepare.code);
          state=game.rollKqDice(state);
          if(!["critical","success"].includes(game.previewKqResolution(state).outcome)) {
            const reaction=game.KQ_CARDS.filter(card=>game.canPlayKqCard(state,card).allowed).sort((a,b)=>a.xpCost-b.xpCost)[0];
            if(reaction)state=game.playKqCard(state,reaction.code);
          }
          state=game.advanceKqStage(game.resolveKqStage(state));
        }
        const score=getKqJuryScoreFromStats(createKqFlower(state).stats);
        const quotes=quoteKqMarketRoutes({juryScore:score,harvestGrams:state.harvestGrams,equipmentCodes:[...KQ_STARTING_EQUIPMENT_CODES],marketContext:{reputation:0,window:seed%6,routeSales:{},recentSales:{},marketVolumes:{}}});
        const offers=quotes.flatMap(q=>q.market.offers.filter(o=>o.accepted));
        const payout=Math.max(...offers.map(o=>o.payoutCents));
        assert(Number.isSafeInteger(payout) && payout>=0);
        scores.push(score);own.push(score);receipts.push(payout);
      }
      buddieScores.push({code:buddie.code,meanScore:own.reduce((a,b)=>a+b,0)/own.length});
    }
    scores.sort((a,b)=>a-b);receipts.sort((a,b)=>a-b);
    const quantile=(a,p)=>Math.round(a[Math.floor((a.length-1)*p)]*100)/100;
    result.push({supports,runs:scores.length,score:{p10:quantile(scores,.1),median:quantile(scores,.5),p90:quantile(scores,.9)},flowerEligiblePercent:Math.round(scores.filter(x=>x>=5.8).length/scores.length*100),premiumQualityPercent:Math.round(scores.filter(x=>x>=8).length/scores.length*100),grossSaleEUR:{p10:quantile(receipts,.1)/100,median:quantile(receipts,.5)/100,p90:quantile(receipts,.9)/100},buddieMeanRange:[Math.min(...buddieScores.map(t=>t.meanScore)),Math.max(...buddieScores.map(t=>t.meanScore))]});
  }
  assert(result[1].score.median > result[0].score.median,"Support choices should improve results");
  const report={note:"Fresh inventories for each run; estimated jury from flower stats. Does not measure human fun, booster scarcity or long-term live retention.",result};
  await mkdir("output/placard-living-market",{recursive:true});
  await writeFile("output/placard-living-market/balance.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await vite.close(); }
